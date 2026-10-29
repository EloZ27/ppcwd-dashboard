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
    '--remote-debugging-port=9242',
    '--disable-gpu',
    INDEX_HTML_URL
  ]);

  await new Promise(r => setTimeout(r, 1500));
  const res = await fetch('http://127.0.0.1:9242/json/list');
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
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 1, mobile: true });
  await new Promise(r => setTimeout(r, 300));

  const info = await send('Runtime.evaluate', { expression: `(() => {
    const bar = document.querySelector('.crisis-legend-bar');
    const items = Array.from(bar.querySelectorAll('.crisis-legend-item'));
    const barComp = window.getComputedStyle(bar);
    const parent = bar.parentElement;
    const parentComp = window.getComputedStyle(parent);
    
    return {
      bar: {
        rect: bar.getBoundingClientRect(),
        gridCols: barComp.gridTemplateColumns,
        display: barComp.display,
        width: barComp.width
      },
      parent: {
        tag: parent.tagName,
        id: parent.id,
        rect: parent.getBoundingClientRect(),
        overflowX: parentComp.overflowX
      },
      items: items.map(i => ({
        text: i.textContent.trim(),
        rect: i.getBoundingClientRect(),
        display: window.getComputedStyle(i).display,
        whiteSpace: window.getComputedStyle(i).whiteSpace,
        width: window.getComputedStyle(i).width,
        fontSize: window.getComputedStyle(i).fontSize,
        padding: window.getComputedStyle(i).padding
      }))
    };
  })()`, returnByValue: true });

  console.log(JSON.stringify(info.result.value, null, 2));

  ws.close();
  proc.kill('SIGKILL');
}

main().catch(console.error);
