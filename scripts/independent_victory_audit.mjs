/**
 * scripts/independent_victory_audit.mjs
 * 
 * Independent Victory Verification Engine executed by VICTORY AUDITOR.
 * Zero shared context. Empirically inspects and validates:
 * 1. R1: Dashboard header and navigation simplification (#top-bar-title visibility at 320px-1920px).
 * 2. R2: Monthly production transfer to uploader.html and total removal from index.html.
 * 3. R3: Drag/swipe table scrolling controller on all 4 tables with 5px threshold and font legibility.
 * 4. R4: Network pressure controls de-clustering and mobile outlier chip ribbon.
 * 5. R5: Reporting cycle pills non-wrapping and crisis threshold legend compact reflow with exact colors.
 * 6. Live browser CDP execution on Headless Edge for layout geometry and clipping.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const INDEX_HTML = path.join(ROOT_DIR, 'index.html');
const UPLOADER_HTML = path.join(ROOT_DIR, 'uploader.html');
const API_MONTHLY = path.join(ROOT_DIR, 'api', 'monthlyProduction.js');

let auditPasses = 0;
let auditFails = 0;
const failureDetails = [];

function check(name, condition, errorMsg = '') {
  if (condition) {
    auditPasses++;
    console.log(`  [PASS] ${name}`);
  } else {
    auditFails++;
    console.error(`  [FAIL] ${name}: ${errorMsg}`);
    failureDetails.push({ name, errorMsg });
  }
}

async function runBrowserAudit() {
  console.log('\n--- BROWSER CDP AUDIT (Real Blink Layout Engine) ---');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const bin = fs.existsSync(edgePath) ? edgePath : chromePath;

  const fileUrl = 'file:///' + INDEX_HTML.replace(/\\/g, '/');
  const cdpPort = 9876;
  const proc = spawn(bin, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--disable-gpu',
    '--no-sandbox',
    fileUrl
  ]);

  await new Promise(r => setTimeout(r, 1800));

  let res, list, ws;
  try {
    res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
    list = await res.json();
    const target = list.find(t => t.type === 'page');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
  } catch (e) {
    proc.kill('SIGKILL');
    throw new Error('Could not connect to browser CDP: ' + e.message);
  }

  let msgId = 1;
  const cdpSend = (method, params = {}) => new Promise(resolve => {
    const id = msgId++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await new Promise(r => setTimeout(r, 800));

  // 1. Viewport testing across mobile to desktop
  const viewports = [320, 360, 375, 414, 640, 768, 820, 1024, 1440, 1920];
  for (const w of viewports) {
    await cdpSend('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w <= 820 });
    await new Promise(r => setTimeout(r, 150));

    const titleMetrics = await cdpSend('Runtime.evaluate', { expression: `(() => {
      const title = document.getElementById('top-bar-title');
      const header = document.querySelector('.app-header');
      const actions = document.querySelector('.header-actions');
      if (!title || !header || !actions) return null;
      const tRect = title.getBoundingClientRect();
      const aRect = actions.getBoundingClientRect();
      const hRect = header.getBoundingClientRect();
      return {
        titleWidth: tRect.width,
        titleLeft: tRect.left,
        titleRight: tRect.right,
        actionsLeft: aRect.left,
        headerWidth: hRect.width,
        overlap: tRect.right > aRect.left,
        overlapPx: Math.max(0, tRect.right - aRect.left),
        titleVisible: tRect.width > 0 && tRect.right <= hRect.right
      };
    })()`, returnByValue: true });

    const val = titleMetrics?.result?.value;
    check(`R1_TITLE_UNOBSTRUCTED_${w}PX`, val && !val.overlap && val.titleVisible, `Title overlap at ${w}px: ${val ? val.overlapPx + 'px overlap' : 'null'}`);
  }

  // 2. Crisis legend clipping audit
  await cdpSend('Runtime.evaluate', { expression: "switchNavTab('crisis');", awaitPromise: true });
  await new Promise(r => setTimeout(r, 400));

  for (const w of [320, 360, 375, 414, 640]) {
    await cdpSend('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: true });
    await new Promise(r => setTimeout(r, 150));

    const legendMetrics = await cdpSend('Runtime.evaluate', { expression: `(() => {
      const legend = document.querySelector('.crisis-legend-bar');
      if (!legend) return null;
      const lRect = legend.getBoundingClientRect();
      const items = Array.from(legend.querySelectorAll('.crisis-legend-item'));
      return {
        legendRight: lRect.right,
        items: items.map(it => {
          const r = it.getBoundingClientRect();
          return {
            text: it.textContent.replace(/\\s+/g, ' ').trim(),
            right: r.right,
            clipped: r.right > lRect.right + 0.5
          };
        })
      };
    })()`, returnByValue: true });

    const lVal = legendMetrics?.result?.value;
    const anyClipped = lVal?.items?.some(i => i.clipped);
    check(`R5_CRISIS_LEGEND_ZERO_CLIP_${w}PX`, lVal && !anyClipped, `Legend clipped at ${w}px: ${JSON.stringify(lVal?.items)}`);
  }

  // 3. Table Drag Controller live attachment audit
  await cdpSend('Runtime.evaluate', { expression: "switchNavTab('pressure');", awaitPromise: true });
  await new Promise(r => setTimeout(r, 500));

  const dragAudit = await cdpSend('Runtime.evaluate', { expression: `(() => {
    const monthlyWrap = document.querySelector('#page-monthly .table-responsive');
    const prodWrap = document.querySelector('#page-production .table-responsive');
    const priorityRow = document.getElementById('priority-cards-row');
    const pressWrap = document.querySelector('.press-table-wrap');
    return {
      monthlyCursor: monthlyWrap ? window.getComputedStyle(monthlyWrap).cursor : null,
      prodCursor: prodWrap ? window.getComputedStyle(prodWrap).cursor : null,
      priorityCursor: priorityRow ? window.getComputedStyle(priorityRow).cursor : null,
      pressCursor: pressWrap ? window.getComputedStyle(pressWrap).cursor : null,
      monthlyHasScroll: monthlyWrap !== null,
      pressHasScroll: pressWrap !== null
    };
  })()`, returnByValue: true });

  const dVal = dragAudit?.result?.value;
  check('R3_TABLE_DRAG_MONTHLY_GRAB', dVal?.monthlyCursor === 'grab', `Monthly cursor: ${dVal?.monthlyCursor}`);
  check('R3_TABLE_DRAG_PROD_GRAB', dVal?.prodCursor === 'grab', `Prod cursor: ${dVal?.prodCursor}`);
  check('R3_TABLE_DRAG_PRIORITY_GRAB', dVal?.priorityCursor === 'grab', `Priority cards cursor: ${dVal?.priorityCursor}`);
  check('R3_TABLE_DRAG_PRESS_GRAB', dVal?.pressCursor === 'grab', `Pressure table cursor: ${dVal?.pressCursor}`);

  // 4. Color fidelity check
  const colorAudit = await cdpSend('Runtime.evaluate', { expression: `(() => {
    const dots = Array.from(document.querySelectorAll('.crisis-legend-dot'));
    return dots.map(d => window.getComputedStyle(d).backgroundColor);
  })()`, returnByValue: true });

  const cVal = colorAudit?.result?.value;
  check('R5_COLOR_NORMAL_0B4F6C', cVal && cVal[0] === 'rgb(11, 79, 108)', `Got ${cVal ? cVal[0] : 'null'}`);
  check('R5_COLOR_WATCH_GREEN', cVal && cVal[1] === 'rgb(16, 185, 129)', `Got ${cVal ? cVal[1] : 'null'}`);
  check('R5_COLOR_ALERT_AMBER', cVal && cVal[2] === 'rgb(245, 158, 11)', `Got ${cVal ? cVal[2] : 'null'}`);
  check('R5_COLOR_CRITICAL_RED', cVal && cVal[3] === 'rgb(239, 68, 68)', `Got ${cVal ? cVal[3] : 'null'}`);

  ws.close();
  proc.kill('SIGKILL');
}

async function main() {
  console.log('='.repeat(80));
  console.log(' INDEPENDENT VICTORY AUDIT SUITE — PPCWD DASHBOARD & UPLOADER UI OVERHAUL');
  console.log(' Executing adversarial, un-biased verification against ORIGINAL_REQUEST.md');
  console.log('='.repeat(80));

  // --- STATIC AUDIT ---
  console.log('\n--- STATIC SOURCE CODE INTEGRITY AUDIT ---');
  const indexContent = fs.readFileSync(INDEX_HTML, 'utf8');
  const uploaderContent = fs.readFileSync(UPLOADER_HTML, 'utf8');
  const apiMonthlyContent = fs.readFileSync(API_MONTHLY, 'utf8');

  // Requirement R1: Dashboard Title & Navigation
  check('R1_TITLE_ELEMENT_EXISTS', indexContent.includes('id="top-bar-title"'), 'Missing #top-bar-title');
  check('R1_TITLE_ELLIPSIS_CSS', indexContent.includes('text-overflow: ellipsis') && indexContent.includes('white-space: nowrap'), 'Title missing text-overflow: ellipsis nowrap');
  check('R1_REPORTS_DROPDOWN_MENU', indexContent.includes('id="reports-dropdown-menu"') && indexContent.includes('toggleReportsDropdown'), 'Missing reports dropdown menu or toggle function');
  check('R1_REPORTS_FULL_SHORT_LABELS', indexContent.includes('class="reports-btn-full"') && indexContent.includes('class="reports-btn-short"'), 'Missing responsive reports button label classes');
  check('R1_DESKTOP_TEXT_RESPONSIVE_HIDE', indexContent.includes('@media (max-width: 820px)') && indexContent.includes('.desktop-text { display: none !important; }'), 'desktop-text not hidden at <=820px');
  check('R1_AUTH_SVG_CONTAINER', indexContent.includes('id="header-auth-status-icon"'), 'Missing #header-auth-status-icon');

  // Requirement R2: Monthly Production Transfer
  check('R2_MODAL_REMOVED_FROM_INDEX', !indexContent.includes('id="monthly-input-modal"'), 'Old modal #monthly-input-modal still found in index.html');
  check('R2_LEGACY_HANDLERS_REMOVED_INDEX', !indexContent.includes('function openMonthlyInputModal') && !indexContent.includes('function submitMonthlyData'), 'Legacy modal functions still in index.html');
  check('R2_ROUTE_LINK_IN_INDEX', indexContent.includes('href="uploader.html#monthly"'), 'Missing route link to uploader.html#monthly in index.html');
  check('R2_UPLOADER_SECTION_MONTHLY_EXISTS', uploaderContent.includes('id="section-monthly"'), 'Missing #section-monthly in uploader.html');
  check('R2_UPLOADER_34_STATIONS_INPUT', uploaderContent.includes('Monthly Production Volumetric Ingestion (34 Stations)'), 'Missing 34 stations header in uploader.html');
  check('R2_UPLOADER_SUBMIT_FUNCTION', uploaderContent.includes('async function submitMonthlyProduction'), 'Missing submitMonthlyProduction in uploader.html');
  check('R2_UPLOADER_HASH_ROUTING', uploaderContent.includes("window.location.hash === '#monthly'") || uploaderContent.includes("switchPortalSection('monthly')"), 'Missing hash routing for #monthly in uploader.html');
  check('R2_INDEX_MONTHLY_MASTER_PRESERVED', indexContent.includes('MONTHLY_STATIONS_MASTER = [') && indexContent.includes('exportMonthlyXLS') && indexContent.includes('generateMonthlyPDF'), 'MONTHLY_STATIONS_MASTER or export functions broken in index.html');

  // Requirement R3: Drag/Swipe Table Scrolling
  check('R3_MAKE_SCROLLABLE_DRAG_FUNCTION', indexContent.includes('function makeScrollableDrag'), 'Missing makeScrollableDrag controller in index.html');
  check('R3_INIT_TABLE_DRAG_SCROLLING', indexContent.includes('function initDashboardTableDragScrolling'), 'Missing initDashboardTableDragScrolling in index.html');
  check('R3_DRAG_5PX_THRESHOLD', indexContent.includes('Math.abs(deltaX) >= 5') || indexContent.includes('Math.abs(deltaY) >= 5'), 'Missing 5px movement threshold in drag controller');
  check('R3_DRAG_CLICK_SUPPRESSION', indexContent.includes('clickEvent.preventDefault()') && indexContent.includes('clickEvent.stopPropagation()'), 'Missing click event suppression on drag');
  check('R3_DRAG_CSS_AFFORDANCES', indexContent.includes('cursor: grab') && indexContent.includes('cursor: grabbing !important'), 'Missing cursor grab/grabbing CSS affordances');
  check('R3_TYPOGRAPHY_MIN_WIDTH_LEGIBILITY', indexContent.includes('min-width: 72px') && indexContent.includes('min-width: 140px'), 'Missing min-width typography legibility guardrails');

  // Requirement R4: Network Pressure De-clustering
  check('R4_PRESSURE_META_CLUSTER', indexContent.includes('class="pressure-meta-cluster"'), 'Missing pressure-meta-cluster in index.html');
  check('R4_PRESSURE_CONTROLS_CLUSTER', indexContent.includes('class="pressure-controls-cluster"'), 'Missing pressure-controls-cluster in index.html');
  check('R4_MAP_OUTLIER_HORIZONTAL_SWIPE', indexContent.includes('overflow-x: auto !important') && indexContent.includes('flex-wrap: nowrap !important') && indexContent.includes('.map-outlier-chips'), 'Missing mobile horizontal swipe ribbon CSS for map-outlier-chips');
  check('R4_CHIP_TOUCH_TARGET_36PX', indexContent.includes('min-height: 36px !important'), 'Outlier chips lack 36px min touch target');
  check('R4_UV_FACILITY_DISTINCTION', indexContent.includes('focusMainMapOnStation(19)') && indexContent.includes('UV Facility:'), 'Missing UV Facility station 19 outlier chip');

  // Requirement R5: Reporting Cycle and Thresholds Layout Polish
  check('R5_CYCLE_PILLS_NOWRAP', indexContent.includes('white-space: nowrap !important') && indexContent.includes('flex-shrink: 0 !important') && indexContent.includes('.cycle-status-pill'), 'Missing white-space nowrap flex-shrink 0 on cycle-status-pill');
  check('R5_CRISIS_LEGEND_GRID_2X2', indexContent.includes('grid-template-columns: repeat(2, minmax(0, 1fr)) !important;'), 'Missing repeat(2, minmax(0, 1fr)) for mobile crisis legend');
  check('R5_CRISIS_COLORS_PRESERVED', indexContent.includes('rgba(11, 79, 108,') && indexContent.includes('var(--green)') && indexContent.includes('var(--amber)') && indexContent.includes('var(--red)'), 'Crisis threshold colors not preserved');

  // Backend API Verification
  check('API_MONTHLY_PRODUCTION_GET_POST', apiMonthlyContent.includes("req.method === 'GET'") && apiMonthlyContent.includes("req.method === 'POST'"), 'Missing GET/POST handlers in api/monthlyProduction.js');
  check('API_MONTHLY_AUTH_PASSKEY', apiMonthlyContent.includes('ADMIN_PASSKEY') && apiMonthlyContent.includes('timingSafeEqual'), 'Missing timingSafeEqual passkey authorization in api/monthlyProduction.js');

  // Run live Browser layout audit
  await runBrowserAudit();

  console.log('\n' + '='.repeat(80));
  console.log(` AUDIT TOTALS: ${auditPasses} PASSED / ${auditFails} FAILED`);
  console.log('='.repeat(80));

  if (auditFails > 0) {
    console.error('\nFAILURE DETAILS:');
    failureDetails.forEach(f => console.error(` - ${f.name}: ${f.errorMsg}`));
    process.exit(1);
  } else {
    console.log('\nALL INDEPENDENT CHECKS PASSED PERFECTLY!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Audit crashed with error:', err);
  process.exit(1);
});
