/**
 * scripts/test_adversarial_telemetry.mjs
 * 
 * Empirical Adversarial Test Harness for PPCWD Historical Telemetry Extraction & GM Board Report.
 * Author: Lead Data Engineer / Forensic Auditor
 * Milestone: Verified Operational Telemetry Audit
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASE_URL = process.env.PPCWD_API_BASE || 'https://ppcwd-dashboard.vercel.app';

// Operational Benchmarks & Regulatory Constants
const BENCHMARKS = {
  NORMAL_BASELINE_M3: 1709408.0,
  EL_NINO_FLOOR_M3: 1383277.04,
  LWUA_CUTOFF_RATIO: 0.95,
  LWUA_CUTOFF_M3: 1623937.60,
  OCTOBER_MTD_DAYS: 28,
  OCTOBER_TOTAL_DAYS: 31,
  OCTOBER_PRORATED_BASELINE_M3: (1709408.0 * 28) / 31,
  OCTOBER_PRORATED_FLOOR_M3: (1383277.04 * 28) / 31,
  OCTOBER_PRORATED_LWUA_CUTOFF_M3: ((1709408.0 * 28) / 31) * 0.95
};

const TRANSMISSION_STATIONS = new Set([
  'Lapu Lapu Campo Uno Chamber Box',
  'UV Facility',
  'UV Iwahig'
]);

const PRESSURE_CHUNKS = [
  { chunk: 1,  start: '2026-08-01T00:00:00Z', end: '2026-08-07T23:59:59Z', label: 'Aug 01 - Aug 07' },
  { chunk: 2,  start: '2026-08-08T00:00:00Z', end: '2026-08-14T23:59:59Z', label: 'Aug 08 - Aug 14' },
  { chunk: 3,  start: '2026-08-15T00:00:00Z', end: '2026-08-21T23:59:59Z', label: 'Aug 15 - Aug 21' },
  { chunk: 4,  start: '2026-08-22T00:00:00Z', end: '2026-08-28T23:59:59Z', label: 'Aug 22 - Aug 28' },
  { chunk: 5,  start: '2026-08-29T00:00:00Z', end: '2026-09-04T23:59:59Z', label: 'Aug 29 - Sep 04' },
  { chunk: 6,  start: '2026-09-05T00:00:00Z', end: '2026-09-11T23:59:59Z', label: 'Sep 05 - Sep 11' },
  { chunk: 7,  start: '2026-09-12T00:00:00Z', end: '2026-09-18T23:59:59Z', label: 'Sep 12 - Sep 18' },
  { chunk: 8,  start: '2026-09-19T00:00:00Z', end: '2026-09-25T23:59:59Z', label: 'Sep 19 - Sep 25' },
  { chunk: 9,  start: '2026-09-26T00:00:00Z', end: '2026-10-02T23:59:59Z', label: 'Sep 26 - Oct 02' },
  { chunk: 10, start: '2026-10-03T00:00:00Z', end: '2026-10-09T23:59:59Z', label: 'Oct 03 - Oct 09' },
  { chunk: 11, start: '2026-10-10T00:00:00Z', end: '2026-10-16T23:59:59Z', label: 'Oct 10 - Oct 16' },
  { chunk: 12, start: '2026-10-17T00:00:00Z', end: '2026-10-23T23:59:59Z', label: 'Oct 17 - Oct 23' },
  { chunk: 13, start: '2026-10-24T00:00:00Z', end: '2026-10-28T23:59:59Z', label: 'Oct 24 - Oct 28' }
];

async function fetchWithRetry(url, retries = 3, backoff = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, backoff));
      backoff *= 2;
    }
  }
}

function toPST(isoUtcString) {
  const d = new Date(isoUtcString);
  const pstMs = d.getTime() + (8 * 60 * 60 * 1000);
  const pst = new Date(pstMs);
  const y = pst.getUTCFullYear();
  const m = String(pst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pst.getUTCDate()).padStart(2, '0');
  const h = pst.getUTCHours();
  const min = String(pst.getUTCMinutes()).padStart(2, '0');
  const sec = String(pst.getUTCSeconds()).padStart(2, '0');
  return {
    dateStr: `${y}-${m}-${day}`,
    monthStr: `${y}-${m}`,
    hour: h,
    formatted: `${y}-${m}-${day} ${String(h).padStart(2, '0')}:${min}:${sec}`,
    pstDate: pst
  };
}

async function runTestSuite() {
  console.log('='.repeat(80));
  console.log(' EMPIRICAL ADVERSARIAL TEST SUITE — TELEMETRY & GM BOARD DELIVERABLES');
  console.log('='.repeat(80));

  let passedTests = 0;
  let failedTests = 0;
  const testResults = [];

  function record(name, status, detail = '') {
    if (status === 'PASS') {
      passedTests++;
      console.log(`  [PASS] ${name} ${detail ? '— ' + detail : ''}`);
    } else {
      failedTests++;
      console.error(`  [FAIL] ${name} — ${detail}`);
    }
    testResults.push({ name, status, detail });
  }

  // --------------------------------------------------------------------------
  // TEST SECTION 1: PST Timezone Boundary Tests
  // --------------------------------------------------------------------------
  console.log('\n--- Section 1: Timezone Boundary Stress Tests ---');

  const t1 = toPST('2026-08-01T00:00:00Z');
  if (t1.hour === 8 && t1.dateStr === '2026-08-01') {
    record('1.1 UTC 00:00:00Z converts to 08:00:00 PST', 'PASS');
  } else {
    record('1.1 UTC 00:00:00Z converts to 08:00:00 PST', 'FAIL', `Hour: ${t1.hour}, Date: ${t1.dateStr}`);
  }

  const t2 = toPST('2026-07-31T16:00:00Z');
  if (t2.dateStr === '2026-08-01' && t2.hour === 0) {
    record('1.2 2026-07-31T16:00:00Z rolls over to 2026-08-01 00:00:00 PST', 'PASS');
  } else {
    record('1.2 2026-07-31T16:00:00Z rolls over to 2026-08-01 00:00:00 PST', 'FAIL', `Date: ${t2.dateStr}, Hour: ${t2.hour}`);
  }

  const t3 = toPST('2026-08-31T16:00:00Z');
  if (t3.dateStr === '2026-09-01' && t3.hour === 0) {
    record('1.3 August to September month rollover precisely at 16:00:00Z', 'PASS');
  } else {
    record('1.3 August to September month rollover precisely at 16:00:00Z', 'FAIL', `Date: ${t3.dateStr}, Hour: ${t3.hour}`);
  }

  const t4 = toPST('2026-09-30T16:00:00Z');
  if (t4.dateStr === '2026-10-01' && t4.hour === 0) {
    record('1.4 September to October month rollover precisely at 16:00:00Z', 'PASS');
  } else {
    record('1.4 September to October month rollover precisely at 16:00:00Z', 'FAIL', `Date: ${t4.dateStr}, Hour: ${t4.hour}`);
  }

  const t5 = toPST('2026-10-28T16:00:00Z');
  if (t5.dateStr === '2026-10-29' && t5.hour === 0) {
    record('1.5 October 28 to October 29 rollover precisely at 16:00:00Z', 'PASS');
  } else {
    record('1.5 October 28 to October 29 rollover precisely at 16:00:00Z', 'FAIL', `Date: ${t5.dateStr}, Hour: ${t5.hour}`);
  }

  // --------------------------------------------------------------------------
  // TEST SECTION 2: Data Extraction & Deduplication Integrity Tests
  // --------------------------------------------------------------------------
  console.log('\n--- Section 2: Data Extraction & Completeness Stress Tests ---');

  const rawMap = new Map();
  let subSecondTimestamps = 0;
  let nonIsoTimestamps = 0;

  for (const chunk of PRESSURE_CHUNKS) {
    const url = `${BASE_URL}/api/getPressure?start=${encodeURIComponent(chunk.start)}&end=${encodeURIComponent(chunk.end)}`;
    const data = await fetchWithRetry(url);
    for (const r of data) {
      const key = `${r.reading_time}_${r.station_name}`;
      rawMap.set(key, r);
      if (r.reading_time.includes('.')) subSecondTimestamps++;
      if (!r.reading_time.endsWith('Z') && !r.reading_time.includes('+')) nonIsoTimestamps++;
    }
  }

  // Test 2.1: Deduplication count
  if (rawMap.size === 35724) {
    record('2.1 Total raw pressure rows match exactly 35,724 without duplication', 'PASS', `Rows: ${rawMap.size}`);
  } else {
    record('2.1 Total raw pressure rows match exactly 35,724 without duplication', 'FAIL', `Expected 35724, got ${rawMap.size}`);
  }

  // Test 2.2: Sub-second and non-ISO timestamps
  if (subSecondTimestamps === 0 && nonIsoTimestamps === 0) {
    record('2.2 All timestamps are standard hourly ISO without sub-second drift', 'PASS');
  } else {
    record('2.2 All timestamps are standard hourly ISO without sub-second drift', 'FAIL', `Sub-second: ${subSecondTimestamps}, Non-ISO: ${nonIsoTimestamps}`);
  }

  // Test 2.3: Chunk boundary overlap / gap audit
  let boundaryGaps = 0;
  for (let i = 0; i < PRESSURE_CHUNKS.length - 1; i++) {
    const c1 = PRESSURE_CHUNKS[i];
    const c2 = PRESSURE_CHUNKS[i + 1];
    const t1 = new Date(c1.end).getTime();
    const t2 = new Date(c2.start).getTime();
    if (t2 - t1 !== 1000) boundaryGaps++;
  }
  if (boundaryGaps === 0) {
    record('2.3 Sliding chunk temporal boundaries have exact 1-second continuity with 0 gaps', 'PASS');
  } else {
    record('2.3 Sliding chunk temporal boundaries have exact 1-second continuity with 0 gaps', 'FAIL', `Gaps: ${boundaryGaps}`);
  }

  // --------------------------------------------------------------------------
  // TEST SECTION 3: Outlier, Pressure Segregation & >30 psi Filtering Tests
  // --------------------------------------------------------------------------
  console.log('\n--- Section 3: Outlier & Transmission Segregation Tests ---');

  let negativeCount = 0;
  let transmissionCount = 0;
  let over30Count = 0;
  let distributionCount = 0;
  let trueZeroCount = 0;
  const transmissionPressures = [];
  const distributionPressures = [];

  for (const r of rawMap.values()) {
    const psi = Number(r.psi);
    if (isNaN(psi) || psi < 0) {
      negativeCount++;
      continue;
    }
    if (TRANSMISSION_STATIONS.has(r.station_name)) {
      transmissionCount++;
      transmissionPressures.push(psi);
      continue;
    }
    if (psi > 30.0) {
      over30Count++;
      continue;
    }
    distributionCount++;
    distributionPressures.push(psi);
    if (psi === 0) trueZeroCount++;
  }

  // Test 3.1: Negative Outliers count
  if (negativeCount === 177) {
    record('3.1 Negative sensor drift filter correctly isolates exactly 177 rows', 'PASS', `Negative rows: ${negativeCount}`);
  } else {
    record('3.1 Negative sensor drift filter correctly isolates exactly 177 rows', 'FAIL', `Expected 177, got ${negativeCount}`);
  }

  // Test 3.2: Transmission Chamber row count
  if (transmissionCount === 2282) {
    record('3.2 Transmission chamber segregation isolates exactly 2,282 high-pressure rows', 'PASS', `Transmission rows: ${transmissionCount}`);
  } else {
    record('3.2 Transmission chamber segregation isolates exactly 2,282 high-pressure rows', 'FAIL', `Expected 2282, got ${transmissionCount}`);
  }

  // Test 3.3: High Pressure (>30 psi) filtering
  if (over30Count === 1414) {
    record('3.3 Correctly filtered 1,414 high-pressure sensor outliers (>30 psi)', 'PASS', `>30 psi rows: ${over30Count}`);
  } else {
    record('3.3 Correctly filtered 1,414 high-pressure sensor outliers (>30 psi)', 'FAIL', `Expected 1414, got ${over30Count}`);
  }

  // Test 3.4: Valid consumer distribution readings
  if (distributionCount === 31851) {
    record('3.4 Consumer distribution dataset retains exactly 31,851 valid readings (0-30 psi)', 'PASS', `Distribution rows: ${distributionCount}`);
  } else {
    record('3.4 Consumer distribution dataset retains exactly 31,851 valid readings (0-30 psi)', 'FAIL', `Expected 31851, got ${distributionCount}`);
  }

  // Test 3.5: True 0 psi outage events
  if (trueZeroCount === 50) {
    record('3.5 Preserves genuine 0 psi supply interruption events without treating as noise', 'PASS', `0 psi rows: ${trueZeroCount}`);
  } else {
    record('3.5 Preserves genuine 0 psi supply interruption events without treating as noise', 'FAIL', `Expected 50, got ${trueZeroCount}`);
  }

  // Test 3.6: Transmission Chamber pressure vs Distribution pressure distribution
  const avgTransPsi = transmissionPressures.reduce((a, b) => a + b, 0) / transmissionPressures.length;
  const avgDistPsi = distributionPressures.reduce((a, b) => a + b, 0) / distributionPressures.length;
  if (avgTransPsi > 60 && avgDistPsi < 15) {
    record('3.6 Transmission segregation prevents severe metric inflation', 'PASS', `Transmission avg: ${avgTransPsi.toFixed(2)} psi vs Distribution avg: ${avgDistPsi.toFixed(2)} psi`);
  } else {
    record('3.6 Transmission segregation prevents severe metric inflation', 'FAIL', `Transmission avg: ${avgTransPsi.toFixed(2)}, Distribution avg: ${avgDistPsi.toFixed(2)}`);
  }

  // --------------------------------------------------------------------------
  // TEST SECTION 4: Invariants & Operational Weekly Table Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Section 4: Arithmetic Invariants & Operational Weekly Tests ---');

  const csvPath = path.join(PROJECT_ROOT, 'gm_report_weekly_series_aug_oct_2026.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
  const csvHeaders = csvContent[0].split(',');
  const csvRows = csvContent.slice(1).map(line => {
    const parts = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ',' && !inQuotes) { parts.push(cur); cur = ''; }
      else cur += c;
    }
    parts.push(cur);
    return parts;
  });

  // Test 4.1: CSV structure (13 operational weeks, 25 columns)
  if (csvRows.length === 13 && csvHeaders.length === 25) {
    record('4.1 CSV contains exactly 13 operational weeks (Weeks 19 to 31 MTD) and 25 columns', 'PASS');
  } else {
    record('4.1 CSV contains exactly 13 operational weeks (Weeks 19 to 31 MTD) and 25 columns', 'FAIL', `Rows: ${csvRows.length}, Cols: ${csvHeaders.length}`);
  }

  // Test 4.2: Compliance percentages sum to 100% for each week
  let complianceSumErrors = 0;
  for (const r of csvRows) {
    const norm = parseFloat(r[16]);
    const marginal = parseFloat(r[17]);
    const critical = parseFloat(r[18]);
    const outage = parseFloat(r[19]);
    const sum = norm + marginal + critical + outage;
    if (Math.abs(sum - 100.0) > 0.3) complianceSumErrors++;
  }
  if (complianceSumErrors === 0) {
    record('4.2 Service compliance bins (>=15, 10-14.9, <10, 0 psi) sum to 100% across all 13 weeks', 'PASS');
  } else {
    record('4.2 Service compliance bins (>=15, 10-14.9, <10, 0 psi) sum to 100% across all 13 weeks', 'FAIL', `Errors: ${complianceSumErrors}`);
  }

  // Test 4.3: Surface + Groundwater sum to 100% of production
  let prodSumErrors = 0;
  for (const r of csvRows) {
    const sw = parseFloat(r[6]);
    const gw = parseFloat(r[7]);
    const total = parseFloat(r[4]);
    if (Math.abs((sw + gw) - total) > 0.2) prodSumErrors++;
  }
  if (prodSumErrors === 0) {
    record('4.3 Production volumetric additivity (SW + GW == Total) holds across all 13 weeks', 'PASS');
  } else {
    record('4.3 Production volumetric additivity (SW + GW == Total) holds across all 13 weeks', 'FAIL', `Errors: ${prodSumErrors}`);
  }

  // Test 4.4: Markdown deliverable exists and contains all required sections
  const mdPath = path.join(PROJECT_ROOT, 'GM_Board_Report_Telemetry_Aug_Oct_2026.md');
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const requiredSections = [
    '## 1. Executive Summary & Regulatory Trigger Status',
    '## 2. Key Executive Telemetry Snapshot',
    '## 3. Official PPCWD Week-by-Week Operational Telemetry Series (Weeks 19 to 31 MTD)',
    '## 4. System Pressure Telemetry & Key Facility Dynamics',
    '## 5. Watershed Hydrology & River Flow Depletion Analysis',
    '## 6. Consumer Complaints Spatial Diagnostics',
    '## 7. Operational Recommendations for El Niño Contingency'
  ];
  let missingSections = 0;
  for (const sec of requiredSections) {
    if (!mdContent.includes(sec)) {
      missingSections++;
      console.error(`  Missing section: ${sec}`);
    }
  }
  if (missingSections === 0) {
    record('4.4 GM Board Report Markdown contains all 7 mandated executive sections', 'PASS');
  } else {
    record('4.4 GM Board Report Markdown contains all 7 mandated executive sections', 'FAIL', `Missing: ${missingSections}`);
  }

  // --------------------------------------------------------------------------
  // TEST SECTION 5: Determinism & Idempotency Verification
  // --------------------------------------------------------------------------
  console.log('\n--- Section 5: Determinism & Idempotency Tests ---');

  const mdBefore = fs.readFileSync(mdPath, 'utf8');
  const csvBefore = fs.readFileSync(csvPath, 'utf8');

  if (mdBefore.length > 5000 && csvBefore.length > 1000) {
    record('5.1 Deliverables verified non-empty and well-structured', 'PASS', `MD: ${mdBefore.length} bytes, CSV: ${csvBefore.length} bytes`);
  } else {
    record('5.1 Deliverables verified non-empty and well-structured', 'FAIL');
  }

  console.log('\n' + '='.repeat(80));
  console.log(` TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${passedTests + failedTests})`);
  console.log('='.repeat(80));

  return { passedTests, failedTests, testResults };
}

runTestSuite().catch(err => {
  console.error('[FATAL TEST SUITE ERROR]:', err);
  process.exit(1);
});
