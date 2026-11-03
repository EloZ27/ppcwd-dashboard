// scripts/test_pdf_and_logo_verification.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const bin = fs.existsSync(edgePath) ? edgePath : chromePath;

console.log("================================================================================");
console.log(" VERIFICATION AUDIT: GM REPORT PDF MULTI-PAGE EXTENSION & PPCWD LOGO");
console.log("================================================================================");

const fileUrl = 'file:///' + path.join(ROOT_DIR, 'index.html').replace(/\\/g, '/');
const cdpPort = 9890;

const proc = spawn(bin, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  '--disable-gpu',
  '--no-sandbox',
  '--disable-extensions',
  '--allow-file-access-from-files',
  fileUrl
]);

async function run() {
  await new Promise(r => setTimeout(r, 2500));
  const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
  const tabs = await res.json();
  const targetTab = tabs.find(t => t.type === 'page' && t.url.includes('index.html')) || tabs.find(t => t.type === 'page') || tabs[0];
  const wsUrl = targetTab.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);

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

  await new Promise(resolve => {
    ws.onopen = resolve;
  });

  // Enable Runtime and Log
  await send('Log.enable');
  await send('Runtime.enable');

  ws.addEventListener('message', (msg) => {
    const data = JSON.parse(msg.data);
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('Browser Exception:', JSON.stringify(data.params.exceptionDetails, null, 2));
    }
  });

  // Trigger Comprehensive Report Staging with ALL topics checked (including diurnal, weekly, lowest5)
  console.log("\n1. Rendering Comprehensive Report Staging via DOM...");
  const evalResult = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        // Wait until window.renderComprehensiveReportStaging or document is ready
        let retries = 0;
        while (typeof window.renderComprehensiveReportStaging !== 'function' && retries < 20) {
          await new Promise(r => setTimeout(r, 200));
          retries++;
        }

        if (typeof window.renderComprehensiveReportStaging !== 'function') {
          return { error: 'Function renderComprehensiveReportStaging not found after waiting', typeofFunc: typeof window.renderComprehensiveReportStaging };
        }

        // Ensure modal or elements exist
        const cDiurnal = document.getElementById('comp-sub-press-diurnal');
        if (cDiurnal) cDiurnal.checked = true;
        const cWeekly = document.getElementById('comp-sub-press-weekly-major');
        if (cWeekly) cWeekly.checked = true;
        const cLowest5 = document.getElementById('comp-sub-press-lowest5');
        if (cLowest5) cLowest5.checked = true;
        const cMonthly = document.getElementById('comp-sub-press-monthly');
        if (cMonthly) cMonthly.checked = true;

        const res = await window.renderComprehensiveReportStaging();

        const staging = document.getElementById('comprehensive-report-staging');
        const pages = staging ? Array.from(staging.querySelectorAll('.comp-a4-page')) : [];

        return {
          res,
          pageCount: pages.length,
          pagesInfo: pages.map((p, idx) => {
            const rect = p.getBoundingClientRect();
            const img = p.querySelector('.comp-header-banner img');
            const hasLogo = !!img && (img.src.startsWith('data:image/png;base64,') || img.src.includes('logo'));
            const title = p.querySelector('.comp-section-title')?.textContent?.trim() || '';
            return {
              pageIdx: idx + 1,
              id: p.id,
              widthPx: rect.width,
              heightPx: rect.height,
              hasLogo,
              logoSrcPrefix: img?.src?.substring(0, 30) || 'NONE',
              firstTitle: title,
              textContentLength: p.textContent.length
            };
          })
        };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  const reportData = evalResult?.result?.value;
  console.log("Staging Result:", JSON.stringify(reportData, null, 2));

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  // Audits
  console.log("\n--- PAGE EXTENSION & ASPECT RATIO AUDITS ---");
  assert(
    "Report extends across 5 clean pages when all topics and diurnal pressure are selected",
    reportData?.pageCount === 5,
    `Expected 5 pages, got ${reportData?.pageCount}`
  );

  const p1 = reportData?.pagesInfo?.[0];
  const p2 = reportData?.pagesInfo?.[1];
  const p3 = reportData?.pagesInfo?.[2];
  const p4 = reportData?.pagesInfo?.[3];
  const p5 = reportData?.pagesInfo?.[4];

  assert("Page 1 is Water Production Summary", p1?.firstTitle?.includes("MONTHLY PRODUCTION"));
  assert("Page 2 is Pressure Compliance & Diurnal Profile", p2?.firstTitle?.includes("SYSTEM PRESSURE NETWORK COMPLIANCE"));
  assert("Page 3 is Pressure Weekly Monitoring & Critical Hotspots", p3?.firstTitle?.includes("WEEKLY MAJOR PRESSURE"));
  assert("Page 4 is Customer Service Complaints Diagnostics", p4?.firstTitle?.includes("CUSTOMER SERVICE COMPLAINTS"));
  assert("Page 5 is Watershed Hydrology & River Flow Telemetry", p5?.firstTitle?.includes("WATERSHED RIVER FLOW") || p5?.firstTitle?.includes("RIVER FLOW"));

  console.log("\n--- PPCWD LOGO EMBEDDING AUDITS ---");
  reportData?.pagesInfo?.forEach((info, idx) => {
    assert(
      `Page ${idx + 1} header banner includes valid PPCWD Logo (data:image/png;base64)`,
      info.hasLogo && info.logoSrcPrefix.startsWith('data:image/png;base64'),
      `Got src: ${info.logoSrcPrefix}`
    );
  });

  console.log("\n--- ASPECT RATIO & SKEW PREVENTION AUDITS ---");
  // Check height to width ratio (A4 is 297/210 = 1.414)
  reportData?.pagesInfo?.forEach((info, idx) => {
    const ratio = info.heightPx / info.widthPx;
    // Standard A4 aspect ratio in browser layout is 1.414
    assert(
      `Page ${idx + 1} maintains standard A4 aspect ratio (~1.414) without vertical stretching (got ${ratio.toFixed(3)})`,
      ratio >= 1.40 && ratio <= 1.43,
      `Ratio ${ratio.toFixed(3)} outside expected bounds [1.40, 1.43]`
    );
  });

  console.log("\n" + "=".repeat(80));
  console.log(` TOTAL VERIFICATIONS: ${passed} PASSED / ${failed} FAILED`);
  console.log("=".repeat(80));

  ws.close();
  proc.kill();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error("Test execution error:", err);
  proc.kill();
  process.exit(1);
});
