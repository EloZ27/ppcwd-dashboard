/**
 * scripts/stress_m1_adversarial_deep.mjs
 * 
 * Deep Adversarial Challenge Harness for Milestone 1:
 * - Tests dropdown opening, positioning, bounds clipping across 15 fine-grained viewports
 * - Tests click outside and keyboard escape handling
 * - Tests rapid clicks / toggling on dropdown menu button
 * - Tests `#header-auth-status-btn` interaction in both locked and unlocked states
 * - Tests dynamic text mutation in cycle status pills and title
 * - Tests zoom / font scaling simulation on crisis legend items
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const INDEX_HTML_URL = 'file:///' + INDEX_HTML_PATH.replace(/\\/g, '/');

const FINE_GRAINED_VIEWPORTS = [
  300, 320, 340, 360, 375, 390, 412, 440, 480, 540, 640, 768, 820, 1024, 1440
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testResults = [];

function assert(condition, testName, diagnostic = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    testResults.push({ name: testName, pass: true, diagnostic });
    console.log(`  \x1b[32m[PASS]\x1b[0m ${testName}`);
  } else {
    failedTests++;
    testResults.push({ name: testName, pass: false, diagnostic });
    console.error(`  \x1b[31m[FAIL]\x1b[0m ${testName}`);
    if (diagnostic) console.error(`         └─ Diagnostic: ${diagnostic}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function launchEdgeAndConnect(port = 9232) {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    throw new Error(`Edge executable not found at ${edgePath}`);
  }

  const proc = spawn(edgePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    INDEX_HTML_URL
  ]);

  let connected = false;
  let attempts = 0;
  let target = null;

  while (!connected && attempts < 20) {
    attempts++;
    await sleep(300);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      target = list.find(t => t.type === 'page');
      if (target && target.webSocketDebuggerUrl) {
        connected = true;
      }
    } catch {
      // retry
    }
  }

  if (!connected || !target) {
    proc.kill('SIGKILL');
    throw new Error('Failed to connect to headless Edge via CDP after 6 seconds');
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async function evaluate(code) {
    const res = await send('Runtime.evaluate', {
      expression: code,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  async function setViewport(width, height = 800) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 820
    });
    await sleep(250);
  }

  function close() {
    try { ws.close(); } catch {}
    try { proc.kill('SIGKILL'); } catch {}
  }

  return { send, evaluate, setViewport, close };
}

async function runAdversarialChallenges() {
  console.log('='.repeat(80));
  console.log(' DEEP ADVERSARIAL CHALLENGE HARNESS: MILESTONE 1');
  console.log('='.repeat(80));

  let client;
  try {
    client = await launchEdgeAndConnect(9232);
  } catch (err) {
    console.error('[FATAL] Could not connect to Edge:', err.message);
    process.exit(1);
  }

  try {
    await sleep(500);

    // ─────────────────────────────────────────────────────────────────────────
    // CHALLENGE 1: DROPDOWN VIEWPORT CLIPPING ACROSS FINE VIEWPORTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n>>> CHALLENGE 1: DROPDOWN VIEWPORT CLIPPING ACROSS 15 VIEWPORTS');

    for (const vp of FINE_GRAINED_VIEWPORTS) {
      await client.setViewport(vp, 800);

      // Open dropdown
      await client.evaluate(`
        const menu = document.getElementById('reports-dropdown-menu');
        if (!menu.classList.contains('show')) {
          document.getElementById('btn-reports-menu').click();
        }
      `);
      await sleep(100);

      const dropdownBounds = await client.evaluate(`
        (() => {
          const menu = document.getElementById('reports-dropdown-menu');
          const rect = menu.getBoundingClientRect();
          const docWidth = document.documentElement.clientWidth;
          const bodyScrollWidth = document.body.scrollWidth;
          const docScrollWidth = document.documentElement.scrollWidth;

          return {
            vp: window.innerWidth,
            docWidth,
            bodyScrollWidth,
            docScrollWidth,
            left: rect.left,
            right: rect.right,
            width: rect.width,
            height: rect.height,
            isShown: menu.classList.contains('show'),
            overflowRight: rect.right - docWidth,
            overflowLeft: -rect.left
          };
        })()
      `);

      // Check right overflow: allow at most 2px tolerance for subpixel rounding
      const fitsOnRight = dropdownBounds.overflowRight <= 2;
      assert(
        fitsOnRight,
        `DROPDOWN_FITS_RIGHT_${vp}PX: Dropdown menu does not overflow right boundary at ${vp}px`,
        `Right: ${dropdownBounds.right}px, DocWidth: ${dropdownBounds.docWidth}px, Overflow: ${dropdownBounds.overflowRight}px`
      );

      // Check left overflow
      const fitsOnLeft = dropdownBounds.left >= 0;
      assert(
        fitsOnLeft,
        `DROPDOWN_FITS_LEFT_${vp}PX: Dropdown menu does not overflow left boundary at ${vp}px`,
        `Left: ${dropdownBounds.left}px, OverflowLeft: ${dropdownBounds.overflowLeft}px`
      );

      // Close dropdown
      await client.evaluate(`closeReportsDropdown();`);
      await sleep(50);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHALLENGE 2: DROPDOWN EVENT RESILIENCE (KEYBOARD ESCAPE, OUTSIDE CLICK, RAPID SPAM)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n>>> CHALLENGE 2: DROPDOWN EVENT RESILIENCE & INTERACTION HARDENING');

    // Test 2.1: Outside click closes dropdown
    await client.evaluate(`
      document.getElementById('btn-reports-menu').click();
    `);
    await sleep(100);
    let isOpen = await client.evaluate(`document.getElementById('reports-dropdown-menu').classList.contains('show')`);
    assert(isOpen === true, 'DROPDOWN_OPENS_ON_CLICK: Reports dropdown opens upon clicking button');

    await client.evaluate(`
      // Click on background outside wrap
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    `);
    await sleep(100);
    isOpen = await client.evaluate(`document.getElementById('reports-dropdown-menu').classList.contains('show')`);
    assert(isOpen === false, 'DROPDOWN_CLOSES_ON_OUTSIDE_CLICK: Reports dropdown closes on clicking outside');

    // Test 2.2: Escape key closes dropdown
    await client.evaluate(`
      document.getElementById('btn-reports-menu').click();
    `);
    await sleep(100);
    await client.evaluate(`
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await sleep(100);
    isOpen = await client.evaluate(`document.getElementById('reports-dropdown-menu').classList.contains('show')`);
    assert(isOpen === false, 'DROPDOWN_CLOSES_ON_ESCAPE: Reports dropdown closes on pressing Escape key');

    // Test 2.3: Rapid 50x click spamming
    const spamResult = await client.evaluate(`
      (() => {
        const btn = document.getElementById('btn-reports-menu');
        const menu = document.getElementById('reports-dropdown-menu');
        let errorCount = 0;
        try {
          for (let i = 0; i < 50; i++) {
            btn.click();
          }
        } catch (e) {
          errorCount++;
        }
        return {
          errorCount,
          finalState: menu.classList.contains('show')
        };
      })()
    `);
    assert(spamResult.errorCount === 0, 'DROPDOWN_RAPID_SPAM_RESILIENT: 50 rapid toggle clicks without JS exception');
    // Ensure closed afterwards
    await client.evaluate(`closeReportsDropdown();`);

    // ─────────────────────────────────────────────────────────────────────────
    // CHALLENGE 3: AUTH STATUS BUTTON & MODAL SECURITY INTERACTIONS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n>>> CHALLENGE 3: AUTH STATUS BUTTON & MODAL SECURITY INTERACTIONS');

    // Test 3.1: Clicking auth button when locked opens auth modal
    const authModalOpened = await client.evaluate(`
      (() => {
        isReportPasskeyVerified = false;
        updateReportSecurityUI();
        const btn = document.getElementById('header-auth-status-btn');
        btn.click();
        const modal = document.getElementById('report-auth-modal');
        return modal && window.getComputedStyle(modal).display === 'flex';
      })()
    `);
    assert(authModalOpened, 'AUTH_BTN_OPENS_MODAL_WHEN_LOCKED: Clicking #header-auth-status-btn opens auth modal');

    // Close modal
    await client.evaluate(`closeReportAuthModal();`);

    // Test 3.2: Calling updateReportSecurityUI() repeatedly does not cause memory leaks or broken DOM
    const authDomIntegrity = await client.evaluate(`
      (() => {
        for (let i = 0; i < 20; i++) {
          isReportPasskeyVerified = (i % 2 === 0);
          updateReportSecurityUI();
        }
        // End locked
        isReportPasskeyVerified = false;
        updateReportSecurityUI();

        const btn = document.getElementById('header-auth-status-btn');
        const icon = document.getElementById('header-auth-status-icon');
        const text = document.getElementById('header-auth-status-text');
        return {
          hasSvg: icon.querySelector('svg') !== null,
          textOk: text.textContent === 'Reports Protected',
          btnDisabled: btn.disabled
        };
      })()
    `);
    assert(
      authDomIntegrity.hasSvg && authDomIntegrity.textOk && !authDomIntegrity.btnDisabled,
      'AUTH_DOM_INTEGRITY_AFTER_RAPID_MUTATIONS: SVG, text, and button state intact after rapid state mutations'
    );

    // ─────────────────────────────────────────────────────────────────────────
    // CHALLENGE 4: REPORTING CYCLE PILLS UNDER PATHOLOGICAL STRINGS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n>>> CHALLENGE 4: REPORTING CYCLE PILLS UNDER PATHOLOGICAL STRINGS');

    await client.evaluate(`switchNavTab('overview');`);

    const PATHOLOGICAL_STRINGS = [
      '', // empty
      '   ', // whitespace
      'Very Long '.repeat(20), // 200 chars
      '<span style="color:red">Malicious Injected HTML</span>',
      'Target: 0.00 MLD (Zero Production Incident)',
      'Special & "quoted" \'values\' / \ / /'
    ];

    for (const testStr of PATHOLOGICAL_STRINGS) {
      const pillStress = await client.evaluate(`
        (() => {
          const pill = document.getElementById('global-monthly-pill');
          const textEl = document.getElementById('global-monthly-text');
          textEl.textContent = ${JSON.stringify(testStr)};

          const rect = pill.getBoundingClientRect();
          const comp = window.getComputedStyle(pill);
          const textComp = window.getComputedStyle(textEl);

          return {
            height: rect.height,
            whiteSpace: comp.whiteSpace,
            textWhiteSpace: textComp.whiteSpace,
            flexShrink: comp.flexShrink
          };
        })()
      `);

      assert(
        pillStress.height <= 40,
        `PILL_HEIGHT_STABLE_${testStr.slice(0, 15).replace(/[^a-zA-Z0-9]/g, '_') || 'EMPTY'}: Height remains <=40px`,
        `Height was ${pillStress.height}px`
      );
      assert(
        pillStress.whiteSpace === 'nowrap' && pillStress.textWhiteSpace === 'nowrap',
        `PILL_NOWRAP_ENFORCED_${testStr.slice(0, 15).replace(/[^a-zA-Z0-9]/g, '_') || 'EMPTY'}: white-space is nowrap`,
        `pill ws: ${pillStress.whiteSpace}, text ws: ${pillStress.textWhiteSpace}`
      );
    }

    // Reset pill text
    await client.evaluate(`document.getElementById('global-monthly-text').textContent = 'Loading Monthly...';`);

    // ─────────────────────────────────────────────────────────────────────────
    // CHALLENGE 5: CRISIS THRESHOLDS ZOOM & FONT SCALING RESILIENCE
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n>>> CHALLENGE 5: CRISIS THRESHOLDS ZOOM & FONT SCALING RESILIENCE');

    await client.evaluate(`switchNavTab('crisis');`);

    // Test normal 100% and simulated zoom levels
    for (const zoomScale of [1.0, 1.25, 1.5, 2.0]) {
      await client.setViewport(375, 800);

      const zoomResults = await client.evaluate(`
        (() => {
          document.body.style.fontSize = '${14 * zoomScale}px';
          const legend = document.querySelector('.crisis-legend-bar');
          const items = Array.from(legend.querySelectorAll('.crisis-legend-item'));
          const legendRect = legend.getBoundingClientRect();

          const details = items.map(item => {
            const itemRect = item.getBoundingClientRect();
            return {
              text: item.textContent.trim(),
              itemRight: itemRect.right,
              legendRight: legendRect.right,
              overflow: itemRect.right - legendRect.right
            };
          });

          const allWithinContainer = details.every(d => d.overflow <= 2);

          return {
            zoomScale: ${zoomScale},
            legendWidth: legendRect.width,
            allWithinContainer,
            details
          };
        })()
      `);

      assert(
        zoomResults.allWithinContainer,
        `CRISIS_LEGEND_ZOOM_${zoomScale * 100}%_FITS: Badges remain contained under ${zoomScale * 100}% font scaling`,
        `Legend width: ${zoomResults.legendWidth}px, Details: ${JSON.stringify(zoomResults.details)}`
      );
    }

    // Reset font size
    await client.evaluate(`document.body.style.fontSize = '';`);

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(80));
    console.log(' DEEP ADVERSARIAL CHALLENGE EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Adversarial Tests: ${totalTests}`);
    console.log(`  Passed: ${passedTests}`);
    console.log(`  Failed: ${failedTests}`);
    console.log(`  Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

  } finally {
    if (client) client.close();
  }

  process.exit(failedTests === 0 ? 0 : 1);
}

runAdversarialChallenges().catch(err => {
  console.error('Fatal unhandled error:', err);
  process.exit(1);
});
