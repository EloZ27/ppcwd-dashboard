// scripts/test_vector_pdf_print.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const bin = fs.existsSync(edgePath) ? edgePath : chromePath;

const cdpPort = 9895;
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
    const targetTab = tabs.find(t => t.type === 'page' && t.url.includes('index.html')) || tabs.find(t => t.type === 'page') || tabs[0];
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

    // 1. Render staging
    console.log("Rendering comprehensive report staging...");
    await send('Runtime.evaluate', {
      expression: `window.renderComprehensiveReportStaging()`,
      awaitPromise: true
    });

    // 2. Evaluate visibility in print media
    const printCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const staging = document.getElementById('comprehensive-report-staging');
        if (!staging) return { error: 'No staging element' };
        
        // Emulate print media
        const pages = staging.querySelectorAll('.comp-a4-page');
        return {
          pageCount: pages.length,
          innerHTMLSize: staging.innerHTML.length,
          firstPageText: pages[0] ? pages[0].innerText.slice(0, 100) : ''
        };
      })()`,
      returnByValue: true
    });

    console.log("Staging check:", printCheck.result.value);

    // 3. Print to PDF via CDP Page.printToPDF
    console.log("Printing to PDF via CDP...");
    const pdfResult = await send('Page.printToPDF', {
      paperWidth: 8.27, // A4 inches
      paperHeight: 11.69,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
      printBackground: true,
      preferCSSPageSize: true
    });

    if (pdfResult && pdfResult.data) {
      const pdfBuffer = Buffer.from(pdfResult.data, 'base64');
      fs.writeFileSync('test_output_print.pdf', pdfBuffer);
      console.log(`Saved test_output_print.pdf (${pdfBuffer.length} bytes)`);
      
      // Check if PDF has text streams
      const pdfStr = pdfBuffer.toString('latin1');
      const hasText = pdfStr.includes('BT') && pdfStr.includes('ET');
      console.log("PDF contains vector text stream (BT/ET):", hasText);
      console.log("PDF length:", pdfBuffer.length);
    } else {
      console.error("Failed to generate PDF:", pdfResult);
    }

    ws.close();
    proc.kill();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    proc.kill();
    process.exit(1);
  }
}

run();
