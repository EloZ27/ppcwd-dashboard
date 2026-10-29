import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'index.html');
const INDEX_HTML_URL = 'file:///' + INDEX_HTML_PATH.replace(/\\/g, '/');

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const proc = spawn(edgePath, [
    '--headless=new',
    '--remote-debugging-port=9240',
    '--disable-gpu',
    INDEX_HTML_URL
  ]);

  await new Promise(r => setTimeout(r, 1500));
  const res = await fetch('http://127.0.0.1:9240/json/list');
  const list = await res.json();
  const target = list.find(t => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (m, p={}) => new Promise(resolve => {
    const mid = id++;
    const h = e => {
      const d = JSON.parse(e.data);
      if (d.id === mid) {
        ws.removeEventListener('message', h);
        resolve(d.result);
      }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: mid, method: m, params: p }));
  });

  await new Promise(r => setTimeout(r, 1000));
  await send('Runtime.evaluate', { expression: "switchNavTab('crisis');", awaitPromise: true });
  await new Promise(r => setTimeout(r, 500));

  console.log('=== EMPIRICAL INVESTIGATION: CRISIS LEGEND CLIPPING ON MOBILE VIEWPORTS ===\n');

  for (const vp of [320, 360, 375, 414, 440, 640]) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp, height: 800, deviceScaleFactor: 1, mobile: true });
    await new Promise(r => setTimeout(r, 200));

    const metrics = await send('Runtime.evaluate', { expression: `(() => {
      const legend = document.querySelector('.crisis-legend-bar');
      const items = Array.from(legend.querySelectorAll('.crisis-legend-item'));
      const legendRect = legend.getBoundingClientRect();
      const pageContent = document.getElementById('page-crisis');
      const pageRect = pageContent.getBoundingClientRect();
      const winWidth = window.innerWidth;

      return {
        vp: ${vp},
        winWidth,
        legendWidth: legendRect.width,
        legendRight: legendRect.right,
        pageRight: pageRect.right,
        items: items.map(item => {
          const r = item.getBoundingClientRect();
          return {
            text: item.textContent.replace(/\\s+/g, ' ').trim(),
            width: r.width,
            left: r.left,
            right: r.right,
            clippedByLegend: r.right > legendRect.right,
            clippedByViewport: r.right > winWidth,
            bleedOverLegendPx: Math.max(0, r.right - legendRect.right),
            bleedOverVpPx: Math.max(0, r.right - winWidth)
          };
        })
      };
    })()`, returnByValue: true });

    if (!metrics || !metrics.result || !metrics.result.value) {
      console.log('Error evaluating at vp', vp, metrics);
      continue;
    }
    const val = metrics.result.value;

    console.log(`Viewport: ${vp}px (Legend Right: ${val.legendRight}px, Page Right: ${val.pageRight}px)`);
    for (const item of val.items) {
      const status = item.clippedByLegend ? `[CLIPPED by ${item.bleedOverLegendPx.toFixed(1)}px (VP bleed: ${item.bleedOverVpPx.toFixed(1)}px)]` : `[OK]`;
      console.log(`  ${status.padEnd(40)} "${item.text}" (right: ${item.right.toFixed(1)}px)`);
    }
    console.log('');
  }

  ws.close();
  proc.kill('SIGKILL');
}

main().catch(console.error);
