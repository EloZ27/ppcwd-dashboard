/**
 * scripts/stress_m1_layout.mjs
 * 
 * EMPIRICAL STRESS TEST HARNESS FOR REQUIREMENT R5 (Milestone 1)
 * Reporting Cycle Pills & Crisis Thresholds Legend
 * 
 * Empirical Challenges:
 * 1. Extreme long dynamic month/status strings inside .cycle-status-pill across 7 viewports
 *    - Verifies zero internal line wrapping (range rects = 1, white-space: nowrap, flex-shrink: 0).
 *    - Measures pill heights, container flex-wrap behavior, and overflow bounds.
 * 2. Crisis Thresholds Legend layout at 320px viewport (and 375px, 440px, 640px, 1920px)
 *    - Verifies balanced 2x2 grid reflow on mobile.
 *    - Verifies item fit, bounding boxes, scrollWidth vs clientWidth, zero label truncation.
 * 3. Color preservation of all 4 crisis threshold dots across conditions
 *    - Strictly checks computed RGB against #0b4f6c, var(--green), var(--amber), var(--red).
 * 
 * Execution:
 *   node scripts/stress_m1_layout.mjs
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html').replace(/\\/g, '/');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9555;

let testCount = 0;
let passedCount = 0;
let failedCount = 0;
const failures = [];

function assert(condition, testId, message, diagnostic = '') {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${testId}: ${message}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${testId}: ${message}`);
    if (diagnostic) console.error(`         └─ Diagnostic: ${diagnostic}`);
    failures.push({ testId, message, diagnostic });
  }
}

// ── CDP CLIENT HELPER ──
class CDPClient {
  constructor(port) {
    this.port = port;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
  }

  async connect() {
    // Wait for Chrome to be ready and get a page target
    let targetWsUrl = null;
    for (let i = 0; i < 20; i++) {
      try {
        const pages = await new Promise((resolve, reject) => {
          http.get(`http://127.0.0.1:${this.port}/json/list`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
          }).on('error', reject);
        });
        if (Array.isArray(pages) && pages.length > 0) {
          const pageTarget = pages.find(p => p.type === 'page') || pages[0];
          targetWsUrl = pageTarget.webSocketDebuggerUrl;
          if (targetWsUrl) break;
        }
      } catch (e) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (!targetWsUrl) throw new Error('Chrome CDP page target not responding');

    this.ws = new WebSocket(targetWsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Eval error');
    }
    return res.result?.value;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 820
    });
  }

  async close() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
  }
}

async function runEmpiricalStressSuite() {
  console.log('='.repeat(80));
  console.log(' EMPIRICAL CHALLENGER STRESS SUITE: REQUIREMENT R5');
  console.log(' Target: Reporting Cycle Pills & Crisis Thresholds Legend in index.html');
  console.log(' Host Environment: Headless Chrome CDP / Real Layout Engine');
  console.log('='.repeat(80));

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-extensions',
    'about:blank'
  ]);

  const cdp = new CDPClient(CDP_PORT);

  try {
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');

    // Navigate to local index.html
    const targetUrl = `file:///${INDEX_HTML_PATH}`;
    await cdp.send('Page.navigate', { url: targetUrl });
    await new Promise(r => setTimeout(r, 800));

    // Wait until document is ready
    await cdp.eval(`new Promise(res => {
      if (document.readyState === 'complete') res(true);
      else window.addEventListener('load', () => res(true));
    })`);

    // ══════════════════════════════════════════════════════════════════════════
    // CHALLENGE 1: EXTREME LONG DYNAMIC STATUS STRINGS INSIDE CYCLE PILLS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n>>> CHALLENGE 1: DYNAMIC REPORTING CYCLE PILLS & NO-WRAP STRESS <<<');

    const testStrings = [
      {
        id: 'NORMAL_STATUS',
        desc: 'Standard monthly status string',
        text: 'September 2026: In Capacity (100.4%)'
      },
      {
        id: 'DEFICIT_STATUS',
        desc: 'Standard deficit status string',
        text: 'October 2026: For Reporting (72.3%)'
      },
      {
        id: 'CHALLENGE_PROMPT_STRING',
        desc: 'Extreme long dynamic month/status string from prompt',
        text: 'December 2026: Level 3 Critical Deficit (42.1%) — Emergency Contingency Active'
      },
      {
        id: 'ULTRA_LONG_OVERSIGHT',
        desc: 'Stress 115-char dynamic status string',
        text: 'December 2026: Level 3 Critical Deficit (42.1%) — Severe Severe Drought Declared — Emergency System-Wide Rationing Stage 4'
      }
    ];

    const viewports = [
      { name: 'Desktop 1920px', width: 1920, height: 1080 },
      { name: 'Laptop 1024px', width: 1024, height: 768 },
      { name: 'Tablet 768px', width: 768, height: 1024 },
      { name: 'Mobile Breakpoint 640px', width: 640, height: 900 },
      { name: 'Mobile 440px', width: 440, height: 800 },
      { name: 'Mobile 375px', width: 375, height: 667 },
      { name: 'Extreme Narrow 320px', width: 320, height: 568 }
    ];

    for (const vp of viewports) {
      await cdp.setViewport(vp.width, vp.height);
      await new Promise(r => setTimeout(r, 100));

      // Test Target Pill static integrity
      const targetPillMetrics = await cdp.eval(`(() => {
        const pill = document.querySelector('.cycle-status-pill');
        if (!pill) return null;
        const style = window.getComputedStyle(pill);
        const rect = pill.getBoundingClientRect();
        const textNode = pill.firstChild;
        const range = document.createRange();
        range.selectNodeContents(pill);
        const clientRects = range.getClientRects();
        return {
          whiteSpace: style.whiteSpace,
          flexShrink: style.flexShrink,
          height: rect.height,
          rectCount: clientRects.length
        };
      })()`);

      assert(
        targetPillMetrics && targetPillMetrics.whiteSpace === 'nowrap' && targetPillMetrics.flexShrink === '0',
        `T_CH1_TARGET_NOWRAP_${vp.width}PX`,
        `Target pill maintains white-space: nowrap and flex-shrink: 0 at ${vp.name}`,
        JSON.stringify(targetPillMetrics)
      );

      // Now inject each dynamic string into #global-monthly-text
      for (const t of testStrings) {
        const pillMetrics = await cdp.eval(`((injectedText) => {
          const pill = document.getElementById('global-monthly-pill');
          const textEl = document.getElementById('global-monthly-text');
          if (!pill || !textEl) return { error: 'Elements not found' };
          textEl.textContent = injectedText;

          const pillStyle = window.getComputedStyle(pill);
          const textStyle = window.getComputedStyle(textEl);
          const pillRect = pill.getBoundingClientRect();
          const textRect = textEl.getBoundingClientRect();

          // Check text node line wrapping via Range
          const range = document.createRange();
          range.selectNodeContents(textEl);
          const lineRects = range.getClientRects();

          // Sibling pills in parent
          const parent = pill.parentElement;
          const parentStyle = window.getComputedStyle(parent);
          const siblingPills = Array.from(parent.querySelectorAll('.cycle-status-pill'));
          const siblingTops = siblingPills.map(p => Math.round(p.getBoundingClientRect().top));

          // Check if parent container wraps cleanly
          return {
            pillWhiteSpace: pillStyle.whiteSpace,
            pillFlexShrink: pillStyle.flexShrink,
            textWhiteSpace: textStyle.whiteSpace,
            textFlexShrink: textStyle.flexShrink,
            lineRectCount: lineRects.length,
            pillHeight: Math.round(pillRect.height),
            pillWidth: Math.round(pillRect.width),
            pillTop: Math.round(pillRect.top),
            parentFlexWrap: parentStyle.flexWrap,
            siblingTops
          };
        })(${JSON.stringify(t.text)})`);

        // Check 1: Zero internal line wrapping
        assert(
          pillMetrics && pillMetrics.lineRectCount === 1,
          `T_CH1_NOWRAP_${t.id}_${vp.width}PX`,
          `[${vp.name}] "${t.text.slice(0, 35)}..." has EXACTLY 1 internal line (zero internal wrapping)`,
          `lineRectCount: ${pillMetrics?.lineRectCount}, pillHeight: ${pillMetrics?.pillHeight}px`
        );

        // Check 2: Computed white-space is nowrap
        assert(
          pillMetrics && pillMetrics.pillWhiteSpace === 'nowrap' && pillMetrics.textWhiteSpace === 'nowrap',
          `T_CH1_STYLE_NOWRAP_${t.id}_${vp.width}PX`,
          `[${vp.name}] Computed style white-space is strictly 'nowrap'`,
          `pillWhiteSpace: ${pillMetrics?.pillWhiteSpace}, textWhiteSpace: ${pillMetrics?.textWhiteSpace}`
        );

        // Check 3: Flex-shrink is strictly 0
        assert(
          pillMetrics && pillMetrics.pillFlexShrink === '0',
          `T_CH1_FLEX_SHRINK_${t.id}_${vp.width}PX`,
          `[${vp.name}] Computed style flex-shrink is strictly '0'`,
          `pillFlexShrink: ${pillMetrics?.pillFlexShrink}`
        );

        // Check 4: Single line height is preserved (no multi-line badge expansion)
        assert(
          pillMetrics && pillMetrics.pillHeight <= 32,
          `T_CH1_SINGLE_LINE_HEIGHT_${t.id}_${vp.width}PX`,
          `[${vp.name}] Pill height is <= 32px (remains a compact single-line pill, got ${pillMetrics?.pillHeight}px)`,
          `pillHeight: ${pillMetrics?.pillHeight}px`
        );
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CHALLENGE 2: CRISIS THRESHOLDS LEGEND LAYOUT AT 320PX VIEWPORT
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n>>> CHALLENGE 2: CRISIS THRESHOLDS LEGEND AT 320PX VIEWPORT <<<');

    // Switch to Crisis tab
    await cdp.eval(`(() => {
      if (typeof switchNavTab === 'function') switchNavTab('crisis');
      else {
        document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
        const crisis = document.getElementById('page-crisis');
        if (crisis) { crisis.classList.add('active'); crisis.style.display = 'block'; }
      }
    })()`);
    await new Promise(r => setTimeout(r, 200));

    const legendViewports = [
      { name: '1920px Desktop', width: 1920, height: 1080 },
      { name: '640px Mobile Threshold', width: 640, height: 900 },
      { name: '440px Small Mobile', width: 440, height: 800 },
      { name: '375px Standard iPhone', width: 375, height: 667 },
      { name: '320px Extreme Narrow', width: 320, height: 568 }
    ];

    for (const vp of legendViewports) {
      await cdp.setViewport(vp.width, vp.height);
      await new Promise(r => setTimeout(r, 100));

      const legendMetrics = await cdp.eval(`(() => {
        const bar = document.querySelector('.crisis-legend-bar');
        if (!bar) return { error: 'crisis-legend-bar not found' };

        const barStyle = window.getComputedStyle(bar);
        const barRect = bar.getBoundingClientRect();
        const items = Array.from(bar.querySelectorAll('.crisis-legend-item'));
        const title = bar.querySelector('.crisis-legend-title');

        const itemMetrics = items.map((it, idx) => {
          const style = window.getComputedStyle(it);
          const rect = it.getBoundingClientRect();
          return {
            idx,
            text: it.textContent.trim().replace(/\\s+/g, ' '),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            scrollWidth: it.scrollWidth,
            clientWidth: it.clientWidth,
            fontSize: style.fontSize,
            display: style.display,
            isOverflowing: it.scrollWidth > it.clientWidth
          };
        });

        return {
          display: barStyle.display,
          gridTemplateColumns: barStyle.gridTemplateColumns,
          barWidth: Math.round(barRect.width),
          barScrollWidth: bar.scrollWidth,
          barClientWidth: bar.clientWidth,
          barLeft: Math.round(barRect.left),
          barRight: Math.round(barRect.right),
          itemCount: items.length,
          titleColSpan: title ? window.getComputedStyle(title).gridColumn : null,
          items: itemMetrics
        };
      })()`);

      assert(
        legendMetrics && !legendMetrics.error,
        `T_CH2_EXISTS_${vp.width}PX`,
        `Crisis legend bar exists and rendered at ${vp.name}`,
        JSON.stringify(legendMetrics)
      );

      // Check grid reflow on <=640px
      if (vp.width <= 640) {
        const isGrid = legendMetrics.display === 'grid';
        const colCount = legendMetrics.gridTemplateColumns.split(' ').length;
        assert(
          isGrid && colCount === 2,
          `T_CH2_2X2_GRID_${vp.width}PX`,
          `[${vp.name}] Legend uses balanced 2x2 grid (display: grid, 2 columns, got: ${legendMetrics.gridTemplateColumns})`,
          `display: ${legendMetrics.display}, columns: ${legendMetrics.gridTemplateColumns}`
        );

        // Check title spans full width
        assert(
          legendMetrics.titleColSpan === '1 / -1' || legendMetrics.titleColSpan === '1 / span 2',
          `T_CH2_TITLE_SPAN_${vp.width}PX`,
          `[${vp.name}] Legend title 'Thresholds:' spans full row (grid-column: 1 / -1, got: ${legendMetrics.titleColSpan})`,
          `titleColSpan: ${legendMetrics.titleColSpan}`
        );
      }

      // Check item count = 4
      assert(
        legendMetrics.itemCount === 4,
        `T_CH2_ITEM_COUNT_${vp.width}PX`,
        `[${vp.name}] Exactly 4 threshold items present in legend`,
        `Found ${legendMetrics.itemCount}`
      );

      // Check horizontal overflow of the legend bar container
      const barOverflows = legendMetrics.barScrollWidth > legendMetrics.barClientWidth;
      console.log(`  -> [${vp.name}] Bar Width: clientWidth=${legendMetrics.barClientWidth}px, scrollWidth=${legendMetrics.barScrollWidth}px (Overflow: ${barOverflows ? '+' + (legendMetrics.barScrollWidth - legendMetrics.barClientWidth) + 'px' : 'none'})`);

      // Check fit & zero label truncation at 320px
      if (vp.width === 320) {
        console.log(`  -> Detailed 320px Item Metrics:`);
        for (const it of legendMetrics.items) {
          console.log(`     Item ${it.idx} ("${it.text}"): rectWidth=${it.width}px, clientWidth=${it.clientWidth}px, scrollWidth=${it.scrollWidth}px, fontSize=${it.fontSize}`);
        }

        // Verify bar fits within viewport
        const simMetrics = await cdp.eval(`(() => {
          const bar = document.querySelector('.crisis-legend-bar');
          const items = Array.from(bar.querySelectorAll('.crisis-legend-item'));
          
          // Test with 9.5px font-size and minmax(0, 1fr)
          const results = [];
          for (const fs of ['11px', '10px', '9.5px', '9px']) {
            items.forEach(it => {
              it.style.fontSize = fs;
              it.style.padding = '3px 5px';
              it.style.gap = '4px';
            });
            results.push({
              fontSize: fs,
              barScrollWidth: bar.scrollWidth,
              barClientWidth: bar.clientWidth,
              items: items.map(it => ({ text: it.textContent.trim(), width: Math.round(it.getBoundingClientRect().width), scrollWidth: it.scrollWidth }))
            });
          }
          // Reset styles
          items.forEach(it => {
            it.style.fontSize = '';
            it.style.padding = '';
            it.style.gap = '';
          });
          return results;
        })()`);
        console.log('  -> Simulated Font-Size Diagnostics at 320px:');
        for (const s of simMetrics) {
          console.log(`     fontSize=${s.fontSize}: barScrollWidth=${s.barScrollWidth}px vs clientWidth=${s.barClientWidth}px, Item widths: ${s.items.map(i => i.scrollWidth + 'px').join(', ')}`);
        }

        assert(
          legendMetrics.barRight <= 320 && legendMetrics.barScrollWidth <= legendMetrics.barClientWidth,
          'T_CH2_320PX_BAR_FIT',
          'Crisis legend bar fits within 320px viewport without horizontal bar overflow',
          `barRight: ${legendMetrics.barRight}px, barClientWidth: ${legendMetrics.barClientWidth}px, barScrollWidth: ${legendMetrics.barScrollWidth}px`
        );

        // Verify items do not clip internally (scrollWidth <= clientWidth)
        for (const it of legendMetrics.items) {
          assert(
            !it.isOverflowing,
            `T_CH2_320PX_ITEM_FIT_${it.idx}`,
            `Item ${it.idx} ("${it.text}") fits within column without text clipping (scrollWidth ${it.scrollWidth} <= clientWidth ${it.clientWidth})`,
            `scrollWidth: ${it.scrollWidth}, clientWidth: ${it.clientWidth}`
          );
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // CHALLENGE 3: COLOR PRESERVATION UNDER ALL CONDITIONS
    // ══════════════════════════════════════════════════════════════════════════
    console.log('\n>>> CHALLENGE 3: CRISIS THRESHOLDS COLOR PRESERVATION <<<');

    const expectedThresholdColors = [
      { name: 'Normal', hex: '#0b4f6c', rgb: 'rgb(11, 79, 108)', itemClass: 'crisis-legend-normal' },
      { name: 'Level 1: Watch', hex: 'var(--green)', rgb: 'rgb(16, 185, 129)', itemClass: 'crisis-legend-watch' },
      { name: 'Level 2: Alert', hex: 'var(--amber)', rgb: 'rgb(245, 158, 11)', itemClass: 'crisis-legend-alert' },
      { name: 'Level 3: Critical', hex: 'var(--red)', rgb: 'rgb(239, 68, 68)', itemClass: 'crisis-legend-critical' }
    ];

    const colorAuditResults = await cdp.eval(`(() => {
      const items = Array.from(document.querySelectorAll('.crisis-legend-item'));
      return items.map((it, idx) => {
        const dot = it.querySelector('.crisis-legend-dot');
        const text = it.textContent.trim().replace(/\\s+/g, ' ');
        const dotStyle = dot ? window.getComputedStyle(dot) : null;
        const itStyle = window.getComputedStyle(it);
        return {
          idx,
          text,
          classes: Array.from(it.classList),
          dotBg: dotStyle ? dotStyle.backgroundColor : null,
          dotBorderRadius: dotStyle ? dotStyle.borderRadius : null,
          dotWidth: dot ? dot.getBoundingClientRect().width : null,
          itemBorderColor: itStyle.borderColor,
          itemBg: itStyle.backgroundColor
        };
      });
    })()`);

    for (let i = 0; i < expectedThresholdColors.length; i++) {
      const exp = expectedThresholdColors[i];
      const actual = colorAuditResults[i];

      assert(
        actual && actual.dotBg === exp.rgb,
        `T_CH3_COLOR_${exp.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
        `Dot ${i} (${exp.name}) strictly resolves to authoritative color ${exp.rgb} (${exp.hex})`,
        `Expected ${exp.rgb}, got ${actual?.dotBg}`
      );

      // Verify dot geometry (8px circle)
      assert(
        actual && actual.dotBorderRadius === '50%' && actual.dotWidth >= 7 && actual.dotWidth <= 9,
        `T_CH3_DOT_GEOMETRY_${i}`,
        `Dot ${i} is a circular indicator (borderRadius: 50%, width: ~8px, got: ${actual?.dotWidth}px)`,
        `width: ${actual?.dotWidth}px, borderRadius: ${actual?.dotBorderRadius}`
      );

      // Verify tinted badge class applied
      assert(
        actual && actual.classes.includes(exp.itemClass),
        `T_CH3_BADGE_CLASS_${i}`,
        `Item ${i} has thematic badge class .${exp.itemClass}`,
        `classes: ${actual?.classes?.join(' ')}`
      );
    }

    // Interactive Hover State Color Invariance Test
    console.log('\n  -> Hover State Color Invariance Check:');
    const hoverColorAudit = await cdp.eval(`(() => {
      const items = Array.from(document.querySelectorAll('.crisis-legend-item'));
      return items.map((it, idx) => {
        const dot = it.querySelector('.crisis-legend-dot');
        const beforeBg = dot ? window.getComputedStyle(dot).backgroundColor : null;

        // Simulate hover
        it.classList.add('hover-simulated');
        const afterBg = dot ? window.getComputedStyle(dot).backgroundColor : null;
        it.classList.remove('hover-simulated');

        return { idx, beforeBg, afterBg, unchanged: beforeBg === afterBg };
      });
    })()`);

    for (const h of hoverColorAudit) {
      assert(
        h.unchanged,
        `T_CH3_HOVER_INVARIANCE_${h.idx}`,
        `Item ${h.idx} threshold dot background is strictly immutable under hover (${h.beforeBg})`,
        `before: ${h.beforeBg}, after: ${h.afterBg}`
      );
    }

  } catch (err) {
    console.error('\n[FATAL ERROR IN STRESS HARNESS]:', err);
    assert(false, 'T_FATAL', 'Stress harness encountered fatal error', err.message);
  } finally {
    await cdp.close();
    chromeProc.kill('SIGKILL');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUMMARY AND VERDICT
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(80));
  console.log(' EMPIRICAL STRESS TEST EXECUTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Stress Tests: ${testCount}`);
  console.log(`  Passed: ${passedCount}`);
  console.log(`  Failed: ${failedCount}`);

  if (failures.length > 0) {
    console.log('\nFailed Test Details:');
    for (const f of failures) {
      console.log(`- [${f.testId}] ${f.message}`);
      if (f.diagnostic) console.log(`  Diagnostic: ${f.diagnostic}`);
    }
  }

  const verdict = failedCount === 0 ? 'APPROVE' : 'REJECT';
  console.log(`\nEXPLICIT VERDICT: ${verdict}`);
  console.log('='.repeat(80));

  process.exit(failedCount === 0 ? 0 : 1);
}

runEmpiricalStressSuite().catch(e => {
  console.error('Unhandled failure:', e);
  process.exit(1);
});
