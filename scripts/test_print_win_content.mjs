// scripts/test_print_win_content.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const bin = fs.existsSync(edgePath) ? edgePath : chromePath;

const cdpPort = 9896;
const proc = spawn(bin, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  '--disable-gpu',
  '--no-sandbox',
  '--allow-file-access-from-files',
  'file:///' + path.resolve('index.html').replace(/\\/g, '/')
]);

async function run() {
  await new Promise(r => setTimeout(r, 2000));
  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
    const tabs = await res.json();
    const targetTab = tabs.find(t => t.type === 'page' && t.url.includes('index.html')) || tabs[0];
    const ws = new WebSocket(targetTab.webSocketDebuggerUrl);

    let msgId = 0;
    const send = (method, params = {}) => new Promise((resolve) => {
      const id = ++msgId;
      const handler = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await new Promise(resolve => ws.onopen = resolve);

    // Render staging
    await send('Runtime.evaluate', {
      expression: `window.renderComprehensiveReportStaging()`,
      awaitPromise: true
    });

    // Create the exact printWin HTML content as printComprehensiveReport() currently does
    const printWinHtml = await send('Runtime.evaluate', {
      expression: `(() => {
        const staging = document.getElementById('comprehensive-report-staging');
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map(el => el.outerHTML).join('\\n');
        return \`<!DOCTYPE html>
        <html>
          <head>
            <title>PPCWD Report</title>
            <meta charset="utf-8">
            \${styles}
            <style>
              @page { size: A4 portrait; margin: 0.5in; }
              body { margin: 0; padding: 0; background: #FFF; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .comp-a4-page { width: 100% !important; min-height: 270mm !important; padding: 0 !important; margin: 0 0 20px 0 !important; box-shadow: none !important; border: none !important; page-break-after: always; }
              @media print {
                .comp-a4-page { margin: 0 !important; page-break-after: always; }
              }
            </style>
          </head>
          <body>
            \${staging.innerHTML}
          </body>
        </html>\`;
      })()`,
      returnByValue: true
    });

    const htmlContent = printWinHtml.result.value;
    fs.writeFileSync('test_print_win.html', htmlContent);
    console.log("Written test_print_win.html:", htmlContent.length);

    ws.close();
    proc.kill();

    // Now open test_print_win.html in a new browser instance and print it!
    const proc2 = spawn(bin, [
      '--headless=new',
      `--remote-debugging-port=${cdpPort + 1}`,
      '--disable-gpu',
      '--no-sandbox',
      '--allow-file-access-from-files',
      'file:///' + path.resolve('test_print_win.html').replace(/\\/g, '/')
    ]);

    await new Promise(r => setTimeout(r, 2000));
    const res2 = await fetch(`http://127.0.0.1:${cdpPort + 1}/json`);
    const tabs2 = await res2.json();
    const ws2 = new WebSocket(tabs2[0].webSocketDebuggerUrl);

    let msgId2 = 0;
    const send2 = (method, params = {}) => new Promise((resolve) => {
      const id = ++msgId2;
      const handler = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id === id) {
          ws2.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws2.addEventListener('message', handler);
      ws2.send(JSON.stringify({ id, method, params }));
    });

    await new Promise(resolve => ws2.onopen = resolve);

    // Check visibility in print mode!
    const visibilityCheck = await send2('Runtime.evaluate', {
      expression: `(() => {
        const p1 = document.querySelector('.comp-a4-page');
        const computed = p1 ? window.getComputedStyle(p1) : null;
        return {
          hasP1: !!p1,
          computedVisibility: computed ? computed.visibility : null,
          computedDisplay: computed ? computed.display : null
        };
      })()`,
      returnByValue: true
    });
    console.log("Visibility on screen:", visibilityCheck.result.value);

    // Print to PDF
    const pdfResult = await send2('Page.printToPDF', {
      paperWidth: 8.27,
      paperHeight: 11.69,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      printBackground: true,
      preferCSSPageSize: true
    });

    const pdfBuffer = Buffer.from(pdfResult.data, 'base64');
    fs.writeFileSync('test_print_win_output.pdf', pdfBuffer);
    console.log(`Saved test_print_win_output.pdf (${pdfBuffer.length} bytes)`);

    // Check PDF content
    const pdfStr = pdfBuffer.toString('latin1');
    const textMatches = pdfStr.match(/BT[\s\S]*?ET/g) || [];
    console.log("Number of text blocks (BT/ET) in PDF:", textMatches.length);
    console.log("PDF contains 'PPCWD' or 'Puerto Princesa':", pdfStr.includes('PPCWD') || pdfStr.includes('Puerto'));

    ws2.close();
    proc2.kill();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    proc.kill();
    process.exit(1);
  }
}

run();

