import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {
  DEFAULT_RATIONING_CONFIG,
  RATIONING_CONFIG_STATION,
  default as getRiverFlowHandler
} from '../api/getRiverFlow.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m[PASS]\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.log(`  \x1b[31m[FAIL]\x1b[0m ${name}`);
    console.log(`         \x1b[33m└─ ${err.message}\x1b[0m`);
    failed++;
  }
}

console.log('================================================================================');
console.log(' PPCWD WATER RATIONING SCHEDULE & LIVE PST TIMER VERIFICATION SUITE');
console.log('================================================================================');

const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
const saveRiverFlowJs = fs.readFileSync(path.resolve('api/saveRiverFlow.js'), 'utf8');
const getRiverFlowJs = fs.readFileSync(path.resolve('api/getRiverFlow.js'), 'utf8');
const vercelJson = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf8'));

// Extract inline scripts from index.html
const scriptBlocks = [];
const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = scriptRegex.exec(indexHtml)) !== null) {
  scriptBlocks.push(m[1]);
}
const mainScript = scriptBlocks.find(s => s.includes('DEFAULT_RATIONING_DATA')) || '';

await test('1. Vercel Hobby serverless limit: api/ contains <= 12 .js files & valid rewrites', () => {
  const apiFiles = fs.readdirSync(path.resolve('api')).filter(f => f.endsWith('.js'));
  assert.ok(apiFiles.length <= 12, `Expected <= 12 api/*.js files, found ${apiFiles.length}: ${apiFiles.join(', ')}`);
  const rewrites = vercelJson.rewrites || [];
  assert.ok(rewrites.some(r => r.source === '/api/getRationingSchedule' && r.destination === '/api/getRiverFlow?type=rationing_schedule'));
  assert.ok(rewrites.some(r => r.source === '/api/saveRationingSchedule' && r.destination === '/api/saveRiverFlow?type=rationing_schedule'));
});

await test('2. API getRiverFlow handler returns valid DEFAULT_RATIONING_CONFIG when offline/unconfigured', async () => {
  const prevUrl = process.env.SUPABASE_URL;
  const prevKey = process.env.SUPABASE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_ANON_KEY;

  let statusCode = null;
  let jsonBody = null;
  const headersSet = {};
  const mockRes = {
    setHeader(k, v) { headersSet[k] = v; },
    status(code) {
      statusCode = code;
      return {
        json(body) { jsonBody = body; return body; }
      };
    }
  };

  await getRiverFlowHandler({ method: 'GET', query: { type: 'rationing_schedule' } }, mockRes);

  if (prevUrl !== undefined) process.env.SUPABASE_URL = prevUrl;
  if (prevKey !== undefined) process.env.SUPABASE_KEY = prevKey;

  assert.equal(statusCode, 200);
  assert.equal(jsonBody.isRationingConfig, true);
  assert.equal(Object.keys(jsonBody.systems).length, 10);
  assert.equal(jsonBody.systems.binduyan.status, 'active');
  assert.equal(jsonBody.systems.maoyon.status, 'active');
  assert.ok(String(headersSet['Cache-Control']).includes('no-store'));
});

await test('3. Sentinel __RATIONING_SCHEDULE_CONFIG__ is excluded from water_level reads & deletes', () => {
  assert.equal(RATIONING_CONFIG_STATION, '__RATIONING_SCHEDULE_CONFIG__');
  assert.ok(getRiverFlowJs.includes('station_name=neq.${encodeURIComponent(RATIONING_CONFIG_STATION)}'));
  assert.ok(getRiverFlowJs.includes('r.station_name !== RATIONING_CONFIG_STATION'));
  assert.ok(saveRiverFlowJs.includes('stationName === RATIONING_CONFIG_STATION'));
  assert.ok(saveRiverFlowJs.includes('requestType === \'rationing_schedule\''));
});

await test('4. index.html inline script parses cleanly with zero syntax errors', () => {
  assert.ok(mainScript.length > 5000, 'Main script block should be present');
  // Replace window.addEventListener template script tag escape if any; vm.Script compiles pure JS
  new vm.Script(mainScript, { filename: 'index.html-inline-script' });
});

await test('5. DOM & Accessibility structure for Water Rationing tab, sticky bar, and modal', () => {
  assert.ok(indexHtml.includes('id="page-rationing"'));
  assert.ok(indexHtml.includes('id="bar-period-rationing"'));
  assert.ok(indexHtml.includes('id="rat-timeline-board"'));
  assert.ok(indexHtml.includes('id="rat-standby-grid"'));
  assert.ok(indexHtml.includes('onclick="switchNavTab(\'rationing\')"'));
  assert.ok(indexHtml.includes('id="nav-rationing-count"'));
  assert.ok(indexHtml.includes('id="rationing-admin-modal"'));
  assert.ok(indexHtml.includes('aria-labelledby="rat-modal-title"'));
  assert.ok(indexHtml.includes('--rat-now-pct'));
  assert.ok(indexHtml.includes('Rationing Active ↗'));
  // Ensure no cluttered full social-media Tagalog/English paragraph text in page-rationing
  assert.ok(!indexHtml.includes('Bilang tugon sa patuloy na pagbaba'), 'Should not include raw Tagalog press-release paragraphs');
  assert.ok(!indexHtml.includes('Hinihiling ng PPCWD ang pang-unawa'), 'Should not include raw Tagalog advisory footer');
});

// Helper to evaluate rationing pure functions directly from index.html
function loadRationingSandbox() {
  const startMarker = '// ── APPROVED WATER RATIONING SCHEDULE & LIVE 24H PST TIMER ENGINE ──';
  const endMarker = '// ── WATER RATIONING SCHEDULE ADMIN MODAL CONTROLLER ──';
  const sIdx = mainScript.indexOf(startMarker);
  const eIdx = mainScript.indexOf(endMarker);
  assert.ok(sIdx !== -1 && eIdx !== -1 && eIdx > sIdx, 'Could not locate rationing engine block');
  const slice = mainScript.slice(sIdx, eIdx);

  const sandbox = {
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    parseInt,
    CSS: { escape: s => s },
    CRISIS_SYSTEMS: [
      { id: 'overall_system', name: 'PPCWD Overall' },
      { id: 'city_total', name: 'City Proper - Main System' },
      { id: 'stalucia', name: 'Sta. Lucia Water System' },
      { id: 'inagawan', name: 'Inagawan PS' },
      { id: 'napsan', name: 'Napsan Water System' },
      { id: 'bacungan', name: 'Bacungan Water System' },
      { id: 'bahile', name: 'Bahile-Macarascas-Salvacion' },
      { id: 'sabang', name: 'Sabang Water System' },
      { id: 'maoyon', name: 'Maoyon-Lucbuan-Maruyogon WS' },
      { id: 'sanrafael', name: 'San Rafael Water System' },
      { id: 'binduyan', name: 'Binduyan Water System' }
    ],
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(slice + '\nthis.__exports = { DEFAULT_RATIONING_DATA, parseHmToMin, fmtMinTo12h, fmtDurationShort, expandZoneSegments, evaluateZoneAtMinute, computeNextValveTransition, getNowPstParts };', sandbox);
  return sandbox.__exports;
}

const rat = loadRationingSandbox();

await test('6. All 10 CRISIS_SYSTEMS mapped: 2 Active (Binduyan, Maoyon) & 8 No Water Rationing', () => {
  const sysMap = rat.DEFAULT_RATIONING_DATA.systems;
  const keys = Object.keys(sysMap);
  assert.equal(keys.length, 10);
  const active = keys.filter(k => sysMap[k].status === 'active');
  const none = keys.filter(k => sysMap[k].status === 'none');
  assert.deepEqual(active.sort(), ['binduyan', 'maoyon']);
  assert.equal(none.length, 8);
  none.forEach(k => assert.equal(sysMap[k].driver, 'No Water Rationing'));
});

await test('7. Brgy. Binduyan schedule geometry & overnight wrap-around math', () => {
  const [north, south] = rat.DEFAULT_RATIONING_DATA.systems.binduyan.zones;

  // Segment expansion
  const northSegs = rat.expandZoneSegments(north);
  assert.equal(northSegs.length, 1);
  assert.deepEqual({ s: northSegs[0].startMin, e: northSegs[0].endMin }, { s: 360, e: 720 });

  const southSegs = rat.expandZoneSegments(south);
  assert.equal(southSegs.length, 2);
  assert.deepEqual({ s: southSegs[0].startMin, e: southSegs[0].endMin }, { s: 0, e: 360 });
  assert.deepEqual({ s: southSegs[1].startMin, e: southSegs[1].endMin }, { s: 780, e: 1440 });

  // 08:00 AM PST (480): North active (4h left), South closed (Opens 1:00 PM)
  const n08 = rat.evaluateZoneAtMinute(north, 480);
  const s08 = rat.evaluateZoneAtMinute(south, 480);
  assert.equal(n08.isActive, true);
  assert.equal(n08.statusText, 'Supplying · 4h left');
  assert.equal(s08.isActive, false);
  assert.equal(s08.statusText, 'Closed · Opens 1:00 PM');

  // 12:30 PM PST (750): Valve shift gap — both closed!
  const n1230 = rat.evaluateZoneAtMinute(north, 750);
  const s1230 = rat.evaluateZoneAtMinute(south, 750);
  assert.equal(n1230.isActive, false);
  assert.equal(s1230.isActive, false);
  assert.equal(s1230.minutesUntilOpen, 30);

  // 02:00 PM PST (840): South supplying overnight -> 16h remaining until 6:00 AM!
  const s14 = rat.evaluateZoneAtMinute(south, 840);
  assert.equal(s14.isActive, true);
  assert.equal(s14.minutesRemaining, 960);
  assert.equal(s14.statusText, 'Supplying · 16h left');

  // 02:30 AM PST (150): South supplying overnight -> 3h 30m remaining until 6:00 AM!
  const s0230 = rat.evaluateZoneAtMinute(south, 150);
  assert.equal(s0230.isActive, true);
  assert.equal(s0230.minutesRemaining, 210);
  assert.equal(s0230.statusText, 'Supplying · 3h 30m left');
});

await test('8. Maoyon-Lucbuan-Maruyogon schedule windows & conditional status', () => {
  const [maoyon, maruyogon, lucPuroks, lucHall] = rat.DEFAULT_RATIONING_DATA.systems.maoyon.zones;

  // Maoyon 24h continuous
  assert.equal(rat.evaluateZoneAtMinute(maoyon, 150).isActive, true);
  assert.equal(rat.evaluateZoneAtMinute(maoyon, 750).statusText, '24h Continuous');

  // Maruyogon 06:00 - 10:00
  assert.equal(rat.evaluateZoneAtMinute(maruyogon, 480).isActive, true);
  assert.equal(rat.evaluateZoneAtMinute(maruyogon, 480).statusText, 'Supplying · 2h left');
  assert.equal(rat.evaluateZoneAtMinute(maruyogon, 630).isActive, false);

  // Lucbuan Puroks 11:00 - 15:00
  assert.equal(rat.evaluateZoneAtMinute(lucPuroks, 750).isActive, true);
  assert.equal(rat.evaluateZoneAtMinute(lucPuroks, 750).statusText, 'Supplying · 2h 30m left');
  assert.equal(rat.evaluateZoneAtMinute(lucPuroks, 990).isActive, false);

  // Lucbuan Hall Area 16:00 - 21:00 (conditional)
  const hall18 = rat.evaluateZoneAtMinute(lucHall, 1080);
  assert.equal(hall18.isActive, true);
  assert.equal(hall18.stateClass, 'is-cond');
  assert.equal(hall18.statusText, 'Conditional · 3h left');
  assert.equal(rat.evaluateZoneAtMinute(lucHall, 1320).isActive, false);
});

await test('9. Next Valve Shift countdown & PST moving hand % calculation', () => {
  const activeEntries = [
    { sys: { id: 'binduyan' }, config: rat.DEFAULT_RATIONING_DATA.systems.binduyan },
    { sys: { id: 'maoyon' }, config: rat.DEFAULT_RATIONING_DATA.systems.maoyon }
  ];

  // At 08:00 AM (480): next shift is Maruyogon closing at 10:00 AM (2h)
  const nextAt8 = rat.computeNextValveTransition(activeEntries, 480);
  assert.equal(nextAt8.timeLabel, '10:00 AM');
  assert.equal(nextAt8.inLabel, '2h');
  assert.ok(nextAt8.desc.includes('Brgy. Maruyogon closes'));

  // At 12:30 PM (750): next shift is South Binduyan opening at 1:00 PM (30m)
  const nextAt1230 = rat.computeNextValveTransition(activeEntries, 750);
  assert.equal(nextAt1230.timeLabel, '1:00 PM');
  assert.equal(nextAt1230.inLabel, '30m');
  assert.ok(nextAt1230.desc.includes('South Binduyan opens'));

  // Moving hand pctOfDay at exact PST Noon (12:00:00 UTC+8 = 04:00:00 UTC) -> 50%
  const noonUtcMs = Date.UTC(2026, 10, 24, 4, 0, 0);
  const parts = rat.getNowPstParts(noonUtcMs);
  assert.equal(parts.hours, 12);
  assert.equal(parts.minutes, 0);
  assert.equal(parts.pctOfDay, 50);
  assert.equal(parts.shortClockStr, '12:00 PM');
});

console.log('================================================================================');
console.log(` Total Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('================================================================================');
if (failed > 0) process.exit(1);
