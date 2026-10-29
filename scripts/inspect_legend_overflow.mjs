import { spawn } from 'node:child_process';
import fs from 'node:fs';

async function main() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const proc = spawn(edgePath, ['--headless=new', '--remote-debugging-port=9238', '--disable-gpu', 'file:///d:/Vibe%20Coding/Git/ppcwd-dashboard/index.html']);
  await new Promise(r => setTimeout(r, 1200));
  const res = await fetch('http://127.0.0.1:9238/json/list');
  const list = await res.json();
  const ws = new WebSocket(list[0].webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, p={}) => new Promise(resolve => {
    const mid = id++;
    const h = e => { const d = JSON.parse(e.data); if (d.id === mid) { ws.removeEventListener('message', h); resolve(d.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: mid, method: m, params: p }));
  });
  
  await new Promise(r => setTimeout(r, 2000));
  await send('Runtime.evaluate', { expression: "switchNavTab('crisis');", awaitPromise: true });
  await new Promise(r => setTimeout(r, 500));

  for (const vp of [320, 360, 375, 414, 440, 500, 600, 640]) {
    await send('Emulation.setDeviceMetricsOverride', { width: vp, height: 800, deviceScaleFactor: 1, mobile: true });
    await new Promise(r => setTimeout(r, 200));
    const evalRes = await send('Runtime.evaluate', { expression: `(() => {
      const legend = document.querySelector('.crisis-legend-bar');
      const items = Array.from(legend.querySelectorAll('.crisis-legend-item'));
      const legendRect = legend.getBoundingClientRect();
      const docWidth = document.documentElement.clientWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      return {
        vp: ${vp},
        docWidth,
        bodyScrollWidth,
        legendWidth: legendRect.width,
        legendRight: legendRect.right,
        items: items.map(i => {
          const r = i.getBoundingClientRect();
          return { text: i.textContent.trim(), width: r.width, right: r.right, overflowLegend: r.right - legendRect.right, overflowVp: r.right - docWidth };
        })
      };
    })()`, returnByValue: true });
    console.log('vp:', vp, evalRes);
  }
  ws.close();
  proc.kill('SIGKILL');
}
main().catch(console.error);
