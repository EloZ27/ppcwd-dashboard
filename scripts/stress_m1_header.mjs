/**
 * scripts/stress_m1_header.mjs
 * 
 * Empirical Stress Testing & Adversarial Challenge Suite for Milestone 1:
 * - R1: Dashboard Header & Navigation Simplification
 * - R5: Reporting Cycle and Thresholds Layout Polish
 * 
 * Tests extreme conditions:
 * 1. 10 Viewports: 320px, 340px, 375px, 440px, 640px, 768px, 820px, 1024px, 1440px, 1920px.
 * 2. Extreme title strings: long string (150 chars), super-long string (500 chars), special characters, Unicode & emojis.
 * 3. Dynamic authentication state toggling: rapid locked/unlocked cycles, SVG icon updates, color updates, responsive .desktop-text hiding at <=820px.
 * 4. Overflow & collision checks: boundingClientRect overlaps, negative clearance prevention, flex-shrink resilience, line-wrapping prevention.
 * 5. Reporting cycle pills: single-line nowrap preservation under extreme status texts.
 * 6. Crisis thresholds legend: 2x2 grid reflow at <=640px and authoritative color preservation.
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

const VIEWPORTS = [320, 340, 375, 440, 640, 768, 820, 1024, 1440, 1920];

const EXTREME_TITLES = [
  {
    name: 'Standard Title',
    text: 'Monitoring Dashboard'
  },
  {
    name: 'Long Title (140 chars)',
    text: 'PUERTO PRINCESA CITY WATER DISTRICT - TASK FORCE EL NIÑO CRITICAL INCIDENT MONITORING AND PRODUCTION DISPATCH COMMAND CENTER - REGULATORY'
  },
  {
    name: 'Super-Long Title (500 chars)',
    text: 'PPCWD_CRITICAL_TELEMETRY_LONG_STRING_'.repeat(14).slice(0, 500)
  },
  {
    name: 'Special Characters & HTML Entities',
    text: '<script>alert("xss")</script> & "quotes" \'single\' / \\ | ~ ! @ # $ % ^ & * ( ) _ + { } : ; ? > <'
  },
  {
    name: 'Unicode & Emojis',
    text: '🌊💧 Puerto Princesa 🇵🇭 City Water District 📊 Telemetry System 🚀 高压供水监控 2026'
  }
];

const EXTREME_STATUS_STRINGS = [
  'Target: 56.86 MLD',
  'September 2026: In Capacity (100.4%)',
  'September 2026: Level 1 Watch (94.2%)',
  'September 2026: Level 2 Alert (81.0%)',
  'September 2026: Level 3 Critical Deficit (48.2%)',
  'December 2026 (Extended Reporting Cycle Final Audit): Level 3 Critical Deficit (12.3456%)',
  'Unreported Reporting Period: Awaiting Data Acquisition'
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

// ── CDP HELPERS ─────────────────────────────────────────────────────────────

async function launchEdgeAndConnect(port = 9228) {
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
    // Allow layout reflow and 0.28s CSS sidebar transition to settle
    await sleep(300);
  }

  function close() {
    try {
      ws.close();
    } catch {
      // ignore
    }
    try {
      proc.kill('SIGKILL');
    } catch {
      // ignore
    }
  }

  return { send, evaluate, setViewport, close };
}

// ── MAIN EMPIRICAL STRESS SUITE ─────────────────────────────────────────────

async function main() {
  console.log('='.repeat(80));
  console.log(' EMPIRICAL STRESS & ADVERSARIAL CHALLENGE SUITE: MILESTONE 1');
  console.log(' Target: index.html (R1 Header/Nav + R5 Reporting Cycle & Thresholds)');
  console.log(' Engine: Headless Chromium (Microsoft Edge CDP Protocol)');
  console.log('='.repeat(80));

  let client;
  try {
    console.log('\n[INIT] Launching Headless Chromium via Edge DevTools Protocol...');
    client = await launchEdgeAndConnect(9230);
    console.log('[INIT] Connected successfully to page context.');
  } catch (err) {
    console.error('[FATAL] Could not launch headless Edge:', err.message);
    process.exit(1);
  }

  try {
    // Wait for initial render
    await sleep(500);

    // ── SECTION 1: VIEWPORT EXTREMES & TITLE CLEARANCE (10 VIEWPORTS) ─────────
    console.log('\n>>> SECTION 1: VIEWPORT EXTREMES & TITLE CLEARANCE (10 VIEWPORTS)');
    
    for (const vp of VIEWPORTS) {
      await client.setViewport(vp, 800);

      const metrics = await client.evaluate(`
        (() => {
          const title = document.getElementById('top-bar-title');
          const actions = document.querySelector('.header-actions');
          const authBtn = document.getElementById('header-auth-status-btn');
          const reportsBtn = document.getElementById('btn-reports-menu');
          const desktopText = document.getElementById('header-auth-status-text');

          const titleRect = title.getBoundingClientRect();
          const actionsRect = actions.getBoundingClientRect();
          const authRect = authBtn.getBoundingClientRect();
          const reportsRect = reportsBtn.getBoundingClientRect();

          const desktopTextDisplay = window.getComputedStyle(desktopText).display;
          const titleStyle = window.getComputedStyle(title);

          return {
            viewport: window.innerWidth,
            titleRect: { left: titleRect.left, right: titleRect.right, width: titleRect.width, height: titleRect.height },
            actionsRect: { left: actionsRect.left, right: actionsRect.right, width: actionsRect.width, height: actionsRect.height },
            authRect: { width: authRect.width, height: authRect.height },
            reportsRect: { width: reportsRect.width, height: reportsRect.height },
            desktopTextDisplay,
            fontSize: titleStyle.fontSize,
            overlap: Math.max(0, titleRect.right - actionsRect.left),
            isNowrap: titleStyle.whiteSpace === 'nowrap',
            isEllipsis: titleStyle.textOverflow === 'ellipsis',
            isOverflowHidden: titleStyle.overflow === 'hidden'
          };
        })()
      `);

      // Test 1.1: Title never physically overlaps actions
      const noOverlap = metrics.overlap <= 0.5; // 0.5px subpixel tolerance
      assert(
        noOverlap,
        `VP_${vp}PX_NO_TITLE_OVERLAP: Title does not collide with .header-actions at ${vp}px`,
        `Title right (${metrics.titleRect.right}px) vs Actions left (${metrics.actionsRect.left}px), Overlap=${metrics.overlap}px`
      );

      // Test 1.2: Title height remains single-line (clamp and nowrap enforce single row)
      const singleLine = metrics.titleRect.height <= 28;
      assert(
        singleLine,
        `VP_${vp}PX_TITLE_SINGLE_LINE: Title remains clean single line (height <= 28px) at ${vp}px`,
        `Title height was ${metrics.titleRect.height}px`
      );

      // Test 1.3: Responsive auth button text visibility rule
      if (vp <= 820) {
        assert(
          metrics.desktopTextDisplay === 'none',
          `VP_${vp}PX_AUTH_TEXT_COLLAPSED: .desktop-text hidden at ${vp}px (<=820px)`,
          `Display was "${metrics.desktopTextDisplay}" (auth btn width: ${metrics.authRect.width}px)`
        );
        assert(
          metrics.authRect.width <= 48,
          `VP_${vp}PX_AUTH_BTN_COMPACT: Auth button is compact icon badge (<=48px) at ${vp}px`,
          `Auth button width was ${metrics.authRect.width}px`
        );
      } else {
        assert(
          metrics.desktopTextDisplay !== 'none',
          `VP_${vp}PX_AUTH_TEXT_VISIBLE: .desktop-text visible at ${vp}px (>820px)`,
          `Display was "${metrics.desktopTextDisplay}" (auth btn width: ${metrics.authRect.width}px)`
        );
      }

      // Test 1.4: Reports menu button compact label rule
      if (vp <= 640) {
        assert(
          metrics.reportsRect.width <= 115,
          `VP_${vp}PX_REPORTS_MENU_COMPACT: Reports button uses shortened "Reports" label at ${vp}px`,
          `Reports button width was ${metrics.reportsRect.width}px`
        );
      }
    }

    // ── SECTION 2: EXTREME TITLE STRINGS & OVERFLOW RESILIENCE ───────────────
    console.log('\n>>> SECTION 2: EXTREME TITLE STRINGS & OVERFLOW RESILIENCE');

    const testViewports = [320, 375, 768, 1440];

    for (const titleCase of EXTREME_TITLES) {
      console.log(`\n  -- Scenario: ${titleCase.name} --`);
      
      for (const vp of testViewports) {
        await client.setViewport(vp, 800);

        const res = await client.evaluate(`
          (() => {
            const title = document.getElementById('top-bar-title');
            title.textContent = ${JSON.stringify(titleCase.text)};

            const actions = document.querySelector('.header-actions');
            const titleRect = title.getBoundingClientRect();
            const actionsRect = actions.getBoundingClientRect();

            const isTruncated = title.scrollWidth > (title.clientWidth + 1);
            const computed = window.getComputedStyle(title);

            return {
              textLength: title.textContent.length,
              titleWidth: titleRect.width,
              titleRight: titleRect.right,
              actionsLeft: actionsRect.left,
              overlap: Math.max(0, titleRect.right - actionsRect.left),
              isTruncated,
              scrollWidth: title.scrollWidth,
              clientWidth: title.clientWidth,
              overflow: computed.overflow,
              textOverflow: computed.textOverflow,
              whiteSpace: computed.whiteSpace,
              titleHeight: titleRect.height
            };
          })()
        `);

        // Assert no collision with actions
        assert(
          res.overlap <= 0.5,
          `TITLE_COLLISION_FREE_${vp}PX_${titleCase.name.replace(/[^a-zA-Z0-9]/g, '_')}: Zero collision at ${vp}px`,
          `Title right=${res.titleRight}px, Actions left=${res.actionsLeft}px, Overlap=${res.overlap}px`
        );

        // Assert single line constraint is never broken
        assert(
          res.titleHeight <= 30,
          `TITLE_SINGLE_ROW_${vp}PX_${titleCase.name.replace(/[^a-zA-Z0-9]/g, '_')}: Height <= 30px (single row)`,
          `Title height was ${res.titleHeight}px`
        );

        // For long titles, assert ellipsis truncation is actively operating
        if (titleCase.text.length > 50) {
          assert(
            res.textOverflow === 'ellipsis' && res.overflow === 'hidden' && res.whiteSpace === 'nowrap',
            `TITLE_ELLIPSIS_ACTIVE_${vp}PX_${titleCase.name.replace(/[^a-zA-Z0-9]/g, '_')}: Graceful ellipsis applied`,
            `textOverflow: ${res.textOverflow}, overflow: ${res.overflow}, isTruncated: ${res.isTruncated}`
          );
        }
      }
    }

    // Reset title back to original
    await client.evaluate(`
      document.getElementById('top-bar-title').textContent = 'Monitoring Dashboard';
    `);

    // ── SECTION 3: DYNAMIC AUTHENTICATION STATE TOGGLING ────────────────────
    console.log('\n>>> SECTION 3: DYNAMIC AUTHENTICATION STATE TOGGLING');

    // Test across desktop (>820px) and mobile (<=820px)
    for (const vp of [375, 1024]) {
      await client.setViewport(vp, 800);

      // Perform 10 rapid toggles between locked and unlocked
      const toggleResults = await client.evaluate(`
        (() => {
          const results = [];
          const authBtn = document.getElementById('header-auth-status-btn');
          const authIcon = document.getElementById('header-auth-status-icon');
          const authText = document.getElementById('header-auth-status-text');

          for (let i = 0; i < 10; i++) {
            // Toggle to unlocked
            isReportPasskeyVerified = true;
            updateReportSecurityUI();
            const unlockedIconHtml = authIcon.innerHTML;
            const unlockedText = authText.textContent;
            const unlockedColor = authBtn.style.color;
            const unlockedBg = authBtn.style.background;

            // Toggle to locked
            isReportPasskeyVerified = false;
            updateReportSecurityUI();
            const lockedIconHtml = authIcon.innerHTML;
            const lockedText = authText.textContent;
            const lockedColor = authBtn.style.color;
            const lockedBg = authBtn.style.background;

            results.push({
              unlocked: {
                hasCheckmarkSvg: unlockedIconHtml.includes('polyline') && unlockedIconHtml.includes('20 6 9 17 4 12'),
                text: unlockedText,
                color: unlockedColor,
                bg: unlockedBg
              },
              locked: {
                hasPadlockSvg: lockedIconHtml.includes('rect') && lockedIconHtml.includes('path'),
                text: lockedText,
                color: lockedColor,
                bg: lockedBg
              }
            });
          }

          return results;
        })()
      `);

      // Verify all 10 toggle iterations were deterministic and clean
      const allPassed = toggleResults.every((r, idx) => 
        r.unlocked.hasCheckmarkSvg &&
        r.unlocked.text === 'Reports Unlocked' &&
        r.unlocked.color === 'var(--green)' &&
        r.locked.hasPadlockSvg &&
        r.locked.text === 'Reports Protected' &&
        r.locked.color === 'var(--text-muted)'
      );

      assert(
        allPassed,
        `AUTH_TOGGLE_10X_CYCLES_${vp}PX: 10 rapid locked/unlocked cycles execute cleanly at ${vp}px`,
        allPassed ? 'All 10 cycles transitioned SVG, text, and styles correctly' : 'Inconsistent toggle state'
      );

      // Ensure that in unlocked state, clearance and lack of overlap are maintained
      await client.evaluate(`
        isReportPasskeyVerified = true;
        updateReportSecurityUI();
      `);

      const clearanceUnlocked = await client.evaluate(`
        (() => {
          const title = document.getElementById('top-bar-title');
          const actions = document.querySelector('.header-actions');
          const titleRect = title.getBoundingClientRect();
          const actionsRect = actions.getBoundingClientRect();
          return {
            overlap: Math.max(0, titleRect.right - actionsRect.left),
            actionsWidth: actionsRect.width
          };
        })()
      `);

      assert(
        clearanceUnlocked.overlap <= 0.5,
        `AUTH_UNLOCKED_NO_OVERLAP_${vp}PX: No title overlap when button is 'Reports Unlocked' at ${vp}px`,
        `Overlap was ${clearanceUnlocked.overlap}px (Actions width: ${clearanceUnlocked.actionsWidth}px)`
      );

      // Re-lock
      await client.evaluate(`
        isReportPasskeyVerified = false;
        updateReportSecurityUI();
      `);
    }

    // ── SECTION 4: R5 REPORTING CYCLE PILLS STRESS TESTING ──────────────────
    console.log('\n>>> SECTION 4: R5 REPORTING CYCLE PILLS STRESS TESTING');

    // Switch to tab where global-period-bar is active
    await client.evaluate(`switchNavTab('overview');`);

    for (const statusStr of EXTREME_STATUS_STRINGS) {
      for (const vp of [320, 375, 768, 1440]) {
        await client.setViewport(vp, 800);

        const pillMetrics = await client.evaluate(`
          (() => {
            const monthlyBtn = document.getElementById('global-monthly-pill');
            const monthlyText = document.getElementById('global-monthly-text');
            const targetPill = document.querySelector('#global-period-bar .cycle-status-pill');

            monthlyText.textContent = ${JSON.stringify(statusStr)};

            const monthlyRect = monthlyBtn.getBoundingClientRect();
            const targetRect = targetPill.getBoundingClientRect();

            const computedMonthly = window.getComputedStyle(monthlyBtn);
            const computedTarget = window.getComputedStyle(targetPill);

            return {
              monthlyHeight: monthlyRect.height,
              targetHeight: targetRect.height,
              monthlyWhiteSpace: computedMonthly.whiteSpace,
              targetWhiteSpace: computedTarget.whiteSpace,
              monthlyFlexShrink: computedMonthly.flexShrink,
              targetFlexShrink: computedTarget.flexShrink
            };
          })()
        `);

        // Check nowrap rule enforced
        assert(
          pillMetrics.monthlyWhiteSpace === 'nowrap' && pillMetrics.targetWhiteSpace === 'nowrap',
          `CYCLE_PILL_NOWRAP_${vp}PX_${statusStr.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}: Pills enforce white-space: nowrap`,
          `Monthly ws: "${pillMetrics.monthlyWhiteSpace}", Target ws: "${pillMetrics.targetWhiteSpace}"`
        );

        // Check flex-shrink 0 enforced
        assert(
          pillMetrics.monthlyFlexShrink === '0' && pillMetrics.targetFlexShrink === '0',
          `CYCLE_PILL_FLEX_SHRINK_0_${vp}PX_${statusStr.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}: Pills enforce flex-shrink: 0`,
          `Monthly shrink: ${pillMetrics.monthlyFlexShrink}, Target shrink: ${pillMetrics.targetFlexShrink}`
        );

        // Check pill does not wrap internally (height stays compact <= 36px)
        assert(
          pillMetrics.monthlyHeight <= 36 && pillMetrics.targetHeight <= 36,
          `CYCLE_PILL_NO_INTERNAL_WRAP_${vp}PX_${statusStr.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}: Pill height <= 36px (unbroken)`,
          `Monthly height: ${pillMetrics.monthlyHeight}px, Target height: ${pillMetrics.targetHeight}px`
        );
      }
    }

    // ── SECTION 5: R5 CRISIS THRESHOLDS LEGEND COMPACTNESS & REFLOW ─────────
    console.log('\n>>> SECTION 5: R5 CRISIS THRESHOLDS LEGEND COMPACTNESS & REFLOW');

    await client.evaluate(`switchNavTab('crisis');`);

    for (const vp of [320, 375, 440, 640, 768, 1024, 1440]) {
      await client.setViewport(vp, 800);

      const legendMetrics = await client.evaluate(`
        (() => {
          const legend = document.querySelector('.crisis-legend-bar');
          const title = legend.querySelector('.crisis-legend-title');
          const items = Array.from(legend.querySelectorAll('.crisis-legend-item'));
          const dots = Array.from(legend.querySelectorAll('.crisis-legend-dot'));

          const legendRect = legend.getBoundingClientRect();
          const computedLegend = window.getComputedStyle(legend);

          const dotColors = dots.map(d => window.getComputedStyle(d).backgroundColor);
          const itemRects = items.map(item => {
            const r = item.getBoundingClientRect();
            return { width: r.width, height: r.height, left: r.left, right: r.right };
          });

          return {
            vp: window.innerWidth,
            display: computedLegend.display,
            gridColumns: computedLegend.gridTemplateColumns,
            padding: computedLegend.padding,
            legendWidth: legendRect.width,
            dotColors,
            itemCount: items.length,
            itemRects
          };
        })()
      `);

      // Test 5.1: Exactly 4 threshold items present
      assert(
        legendMetrics.itemCount === 4,
        `CRISIS_LEGEND_ITEM_COUNT_${vp}PX: All 4 threshold badges present`,
        `Count: ${legendMetrics.itemCount}`
      );

      // Test 5.2: Mobile 2x2 grid reflow at <=640px
      if (vp <= 640) {
        assert(
          legendMetrics.display === 'grid',
          `CRISIS_LEGEND_GRID_REFLOW_${vp}PX: Reflows to CSS Grid at ${vp}px (<=640px)`,
          `Display was "${legendMetrics.display}", Grid cols: "${legendMetrics.gridColumns}"`
        );
      } else {
        assert(
          legendMetrics.display === 'flex',
          `CRISIS_LEGEND_FLEX_LAYOUT_${vp}PX: Uses horizontal flex layout at ${vp}px (>640px)`,
          `Display was "${legendMetrics.display}"`
        );
      }

      // Test 5.3: Strict preservation of all 4 authoritative colors
      // rgb(11, 79, 108) = #0b4f6c
      // rgb(16, 185, 129) = var(--green)
      // rgb(245, 158, 11) = var(--amber)
      // rgb(239, 68, 68) = var(--red)
      const colorsValid = (
        legendMetrics.dotColors[0] === 'rgb(11, 79, 108)' &&
        legendMetrics.dotColors[1] === 'rgb(16, 185, 129)' &&
        legendMetrics.dotColors[2] === 'rgb(245, 158, 11)' &&
        legendMetrics.dotColors[3] === 'rgb(239, 68, 68)'
      );

      assert(
        colorsValid,
        `CRISIS_LEGEND_COLORS_PRESERVED_${vp}PX: All 4 authoritative colors preserved at ${vp}px`,
        `Observed colors: ${JSON.stringify(legendMetrics.dotColors)}`
      );

      // Test 5.4: Badges fit within legend container width (no horizontal blowout)
      const fitsInContainer = legendMetrics.itemRects.every(r => r.width <= legendMetrics.legendWidth);
      assert(
        fitsInContainer,
        `CRISIS_LEGEND_NO_CONTAINER_OVERFLOW_${vp}PX: Items fit within legend container at ${vp}px`,
        `Legend width: ${legendMetrics.legendWidth}px`
      );
    }

    // ── SECTION 6: CONSOLIDATED VERDICT ─────────────────────────────────────
    console.log('\n' + '='.repeat(80));
    console.log(' EMPIRICAL STRESS TEST EXECUTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Stress Tests Executed: ${totalTests}`);
    console.log(`  Passed: ${passedTests}`);
    console.log(`  Failed: ${failedTests}`);
    console.log(`  Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests === 0) {
      console.log('\n\x1b[32m>>> EMPIRICAL VERDICT: APPROVE <<<\x1b[0m');
      console.log('Milestone 1 satisfies all stress conditions without layout breakages, overlaps, or color drift.');
    } else {
      console.log('\n\x1b[31m>>> EMPIRICAL VERDICT: REJECT <<<\x1b[0m');
      console.log(`${failedTests} stress tests failed. Review diagnostics above.`);
    }
    console.log('='.repeat(80));

  } finally {
    if (client) {
      client.close();
    }
  }

  process.exit(failedTests === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal unhandled error during stress execution:', err);
  process.exit(1);
});
