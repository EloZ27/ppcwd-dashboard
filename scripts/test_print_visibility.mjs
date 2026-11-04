// scripts/test_print_visibility.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const bin = edgePath;
const cdpPort = 9898;

const proc = spawn(bin, [
  '--headless=new',
  `--remote-debugging-port=${cdpPort}`,
  '--disable-gpu',
  '--no-sandbox',
  '--allow-file-access-from-files',
  'file:///' + path.resolve('test_print_win.html').replace(/\\/g, '/')
]);

async function check() {
  await new Promise(r => setTimeout(r, 2000));
  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json`);
    const tabs = await res.json();
    const target = tabs.find(t => t.type === 'page' && t.url.includes('test_print_win.html')) || tabs[0];
    const ws = new WebSocket(target.webSocketDebuggerUrl);

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

    // 1. Check style in screen mode
    const screenRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('.comp-a4-page');
        const h1 = document.querySelector('.comp-a4-page div');
        return {
          pageVisibility: el ? window.getComputedStyle(el).visibility : 'null',
          childVisibility: h1 ? window.getComputedStyle(h1).visibility : 'null'
        };
      })()`,
      returnByValue: true
    });
    console.log("SCREEN computed styles:", screenRes.result.value);

    // 2. Set print emulation
    await send('Emulation.setEmulatedMedia', { media: 'print' });

    // 3. Check style in print mode
    const printRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.querySelector('.comp-a4-page');
        const h1 = document.querySelector('.comp-a4-page div');
        return {
          pageVisibility: el ? window.getComputedStyle(el).visibility : 'null',
          childVisibility: h1 ? window.getComputedStyle(h1).visibility : 'null'
        };
      })()`,
      returnByValue: true
    });
    console.log("PRINT computed styles:", printRes.result.value);

    ws.close();
    proc.kill();
  } catch (e) {
    console.error(e);
    proc.kill();
  }
}

check();

