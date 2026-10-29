/**
 * scripts/extract_telemetry_report.mjs
 * 
 * Dynamic Historical Telemetry Extraction & Comprehensive Executive Report Generator.
 * Supports any freely chosen date range, operational week, or standard template preset:
 *   --preset 2weeks    (Last 14 days)
 *   --preset 4weeks    (Last 28 days / 4 operational weeks)
 *   --preset month     (Month to date)
 *   --preset 3months   (Last 3 months / ~90 days)
 *   --preset 6months   (Last 6 months / ~180 days)
 *   --preset aug_oct_2026 (El Niño Board Report Archive: 2026-08-01 to 2026-10-28)
 *   --start YYYY-MM-DD --end YYYY-MM-DD (Custom date range)
 * 
 * Automatically generates 7-day sliding chunks to safely bypass PostgREST's 1,000-row limit,
 * dynamically prorates any active/in-progress months, segregates transmission mains, and outputs
 * verified executive Markdown and CSV deliverables.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const BASE_URL = process.env.PPCWD_API_BASE || 'https://ppcwd-dashboard.vercel.app';

// Operational Benchmarks & Regulatory Standards
const BENCHMARK_MONTHLY_NORMAL_M3 = 1705700.0;
const BENCHMARK_MONTHLY_LWUA_CUTOFF_M3 = 1620415.0; // 95% Cutoff
const BENCHMARK_MONTHLY_CONTINGENCY_FLOOR_M3 = 1383277.04; // 80.92% Floor

// Transmission facilities segregated from consumer distribution network
const TRANSMISSION_STATIONS = new Set([
  'Lapu Lapu Campo Uno Chamber Box',
  'UV Facility',
  'UV Iwahig',
  'Beside Lito Escalante',
  'Tagburos Highway near Villa Grande'
]);

// Boosted distribution zone isolated for dedicated tracking
const BOOSTED_STATIONS = new Set([
  'Gemma Res, Bgy. Sta. Monica'
]);

// HTTP Fetch with exponential backoff
async function fetchWithRetry(url, options = {}, retries = 3, backoff = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, backoff));
      backoff *= 2;
    }
  }
}

// PST Date Conversion
function toPST(isoUtcString) {
  const d = new Date(isoUtcString);
  const pstMs = d.getTime() + (8 * 60 * 60 * 1000);
  const pst = new Date(pstMs);
  const y = pst.getUTCFullYear();
  const m = String(pst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pst.getUTCDate()).padStart(2, '0');
  const h = String(pst.getUTCHours()).padStart(2, '0');
  const min = String(pst.getUTCMinutes()).padStart(2, '0');
  const s = String(pst.getUTCSeconds()).padStart(2, '0');
  return {
    dateStr: `${y}-${m}-${day}`,
    hour: pst.getUTCHours(),
    timeStr: `${h}:${min}:${s}`,
    fullPST: `${y}-${m}-${day} ${h}:${min}:${s}`,
    dateObj: pst
  };
}

// Generate dynamic 7-day non-overlapping chunks between startDt and endDt
function generateDynamicChunks(startDate, endDate) {
  const chunks = [];
  let curStart = new Date(startDate);
  let chunkIdx = 1;

  while (curStart <= endDate) {
    let curEnd = new Date(curStart);
    curEnd.setDate(curEnd.getDate() + 6);
    curEnd.setHours(23, 59, 59, 999);
    if (curEnd > endDate) curEnd = new Date(endDate);

    chunks.push({
      chunk: chunkIdx++,
      start: curStart.toISOString(),
      end: curEnd.toISOString(),
      label: `${curStart.toISOString().slice(0, 10)} to ${curEnd.toISOString().slice(0, 10)}`
    });

    curStart = new Date(curEnd);
    curStart.setDate(curStart.getDate() + 1);
    curStart.setHours(0, 0, 0, 0);
  }
  return chunks;
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    preset: '4weeks',
    startDate: null,
    endDate: null
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--preset' && args[i + 1]) {
      params.preset = args[++i];
    } else if (a === '--start' && args[i + 1]) {
      params.startDate = args[++i];
    } else if (a === '--end' && args[i + 1]) {
      params.endDate = args[++i];
    }
  }

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (params.startDate && params.endDate) {
    return {
      startStr: params.startDate,
      endStr: params.endDate,
      startDt: new Date(`${params.startDate}T00:00:00+08:00`),
      endDt: new Date(`${params.endDate}T23:59:59+08:00`),
      presetName: `Custom (${params.startDate} to ${params.endDate})`
    };
  }

  let startDt, endDt, presetName;
  const p = params.preset.toLowerCase();

  if (p === '2weeks') {
    endDt = new Date(now);
    startDt = new Date(now);
    startDt.setDate(startDt.getDate() - 13);
    presetName = 'Last 2 Weeks';
  } else if (p === 'month') {
    endDt = new Date(now);
    startDt = new Date(now.getFullYear(), now.getMonth(), 1);
    presetName = 'Current Month MTD';
  } else if (p === '3months') {
    endDt = new Date(now);
    startDt = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    presetName = 'Last 3 Months';
  } else if (p === '6months') {
    endDt = new Date(now);
    startDt = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    presetName = 'Last 6 Months';
  } else if (p === 'aug_oct_2026') {
    startDt = new Date('2026-08-01T00:00:00+08:00');
    endDt = new Date('2026-10-28T23:59:59+08:00');
    presetName = 'Aug–Oct 2026 (El Niño Board Report Archive)';
  } else {
    // Default 4weeks
    endDt = new Date(now);
    startDt = new Date(now);
    startDt.setDate(startDt.getDate() - 27);
    presetName = 'Last 4 Weeks';
  }

  startDt.setHours(0, 0, 0, 0);
  endDt.setHours(23, 59, 59, 999);

  return {
    startStr: fmt(startDt),
    endStr: fmt(endDt),
    startDt,
    endDt,
    presetName
  };
}

async function main() {
  const { startStr, endStr, startDt, endDt, presetName } = parseArgs();

  console.log('='.repeat(80));
  console.log(` PPCWD HISTORICAL TELEMETRY EXTRACTION & REPORT GENERATOR`);
  console.log(` Template / Preset : ${presetName}`);
  console.log(` Extraction Window : ${startStr} to ${endStr}`);
  console.log('='.repeat(80));

  // 1. Fetch Weekly Production
  console.log('\n[1/5] Fetching Weekly Production Telemetry...');
  const weeklyRaw = await fetchWithRetry(`${BASE_URL}/api/getProduction`);
  const weeklyRows = Array.isArray(weeklyRaw) ? weeklyRaw : (Array.isArray(weeklyRaw?.records) ? weeklyRaw.records : []);
  console.log(`  -> Retrieved ${weeklyRows.length} total operational weekly records.`);

  // 2. Fetch Monthly Production Records
  console.log('\n[2/5] Fetching Monthly Production Records...');
  const monthlyRecords = await fetchWithRetry(`${BASE_URL}/api/monthlyProduction`);
  console.log(`  -> Retrieved ${monthlyRecords.length} monthly production station line-items.`);

  // 3. Fetch Hourly Pressure Telemetry via Dynamic 7-day Sliding Chunks
  console.log('\n[3/5] Generating Dynamic 7-Day Sliding Chunks for Pressure Extraction...');
  const chunks = generateDynamicChunks(startDt, endDt);
  console.log(`  -> Created ${chunks.length} sliding temporal chunks (bypass 1,000-row limit).`);

  const pressureMap = new Map();
  for (const c of chunks) {
    const url = `${BASE_URL}/api/getPressure?start=${encodeURIComponent(c.start)}&end=${encodeURIComponent(c.end)}`;
    const rows = await fetchWithRetry(url);
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const timeKey = r.reading_time || r.timestamp;
        const key = `${timeKey}_${r.station_name}`;
        if (!pressureMap.has(key)) {
          pressureMap.set(key, r);
        }
      }
      console.log(`  -> Chunk ${c.chunk}/${chunks.length} [${c.label}]: fetched ${rows.length} rows.`);
    }
  }
  console.log(`  -> Total deduplicated pressure readings in window: ${pressureMap.size} records.`);

  // 4. Fetch Watershed River Flow Surveys
  console.log('\n[4/5] Fetching River Flow Monitoring Surveys...');
  const riverRaw = await fetchWithRetry(`${BASE_URL}/api/getRiverFlow`);
  const riverSurveys = Array.isArray(riverRaw) ? riverRaw : [];
  console.log(`  -> Retrieved ${riverSurveys.length} river flow survey logs.`);

  // 5. Fetch Customer Service Complaints
  console.log('\n[5/5] Fetching Consumer Service Complaints...');
  const complaintsRaw = await fetchWithRetry(`${BASE_URL}/api/getComplaints`);
  const complaints = Array.isArray(complaintsRaw) ? complaintsRaw : (Array.isArray(complaintsRaw?.records) ? complaintsRaw.records : []);
  console.log(`  -> Retrieved ${complaints.length} customer complaints.`);

  // --------------------------------------------------------------------------
  // DATA ANALYSIS & METRICS COMPUTATION
  // --------------------------------------------------------------------------
  console.log('\n--- Processing Operational Metrics & Hydraulic Network Segregation ---');

  // Pressure filtering & segregation
  let distributionReadings = [];
  let mbsReadings = [];
  let staMonicaReadings = [];
  let transmissionReadings = [];
  let zeroOutageCount = 0;

  for (const r of pressureMap.values()) {
    const psi = Number(r.psi);
    if (isNaN(psi) || psi < 0) continue; // Filter corrupted negative drift

    const pst = toPST(r.reading_time || r.timestamp);
    if (pst.dateStr < startStr || pst.dateStr > endStr) continue;

    const item = { ...r, psi, pst };

    if (TRANSMISSION_STATIONS.has(r.station_name)) {
      transmissionReadings.push(item);
      continue;
    }

    if (BOOSTED_STATIONS.has(r.station_name)) {
      staMonicaReadings.push(item);
      continue;
    }

    if (psi > 30.0) continue; // Outlier on distribution

    distributionReadings.push(item);
    if (r.station_name === 'MBS' || r.station_name.includes('MBS')) {
      mbsReadings.push(item);
    }
    if (psi === 0) zeroOutageCount++;
  }

  const distAvg = distributionReadings.length ? (distributionReadings.reduce((s, r) => s + r.psi, 0) / distributionReadings.length) : 0;
  const peakReadings = distributionReadings.filter(r => (r.pst.hour >= 6 && r.pst.hour <= 9) || (r.pst.hour >= 17 && r.pst.hour <= 20));
  const offPeakReadings = distributionReadings.filter(r => r.pst.hour >= 22 || r.pst.hour <= 4);
  const peakAvg = peakReadings.length ? (peakReadings.reduce((s, r) => s + r.psi, 0) / peakReadings.length) : 0;
  const offPeakAvg = offPeakReadings.length ? (offPeakReadings.reduce((s, r) => s + r.psi, 0) / offPeakReadings.length) : 0;

  const mbsAvg = mbsReadings.length ? (mbsReadings.reduce((s, r) => s + r.psi, 0) / mbsReadings.length) : 0;
  const staMonicaAvg = staMonicaReadings.length ? (staMonicaReadings.reduce((s, r) => s + r.psi, 0) / staMonicaReadings.length) : 0;

  // Pressure compliance bins (PPCWD standard)
  const ge15Count = distributionReadings.filter(r => r.psi >= 15.0).length;
  const b65_15Count = distributionReadings.filter(r => r.psi >= 6.5 && r.psi < 15.0).length;
  const lt65Count = distributionReadings.filter(r => r.psi < 6.5 && r.psi > 0).length;
  const eq0Count = distributionReadings.filter(r => r.psi === 0).length;
  const totalDist = distributionReadings.length || 1;

  // Monthly Production Analysis with Dynamic MTD Prorating
  const monthsInWindow = new Set();
  let curM = new Date(startDt.getFullYear(), startDt.getMonth(), 1);
  const endMonth = new Date(endDt.getFullYear(), endDt.getMonth(), 1);
  while (curM <= endMonth) {
    monthsInWindow.add(`${curM.getFullYear()}-${String(curM.getMonth() + 1).padStart(2, '0')}`);
    curM.setMonth(curM.getMonth() + 1);
  }

  const monthlySummaries = Array.from(monthsInWindow).sort().reverse().map(ym => {
    const parts = ym.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const daysInMonth = new Date(y, m, 0).getDate();

    let elapsedDays = daysInMonth;
    let isProrated = false;
    if (endDt.getFullYear() === y && (endDt.getMonth() + 1) === m) {
      if (endDt.getDate() < daysInMonth) {
        elapsedDays = Math.max(1, endDt.getDate());
        isProrated = true;
      }
    }

    const prorationFactor = elapsedDays / daysInMonth;
    const baselineM3 = BENCHMARK_MONTHLY_NORMAL_M3 * prorationFactor;
    const lwuaCutoffM3 = BENCHMARK_MONTHLY_LWUA_CUTOFF_M3 * prorationFactor;
    const contingencyFloorM3 = BENCHMARK_MONTHLY_CONTINGENCY_FLOOR_M3 * prorationFactor;

    const recs = monthlyRecords.filter(r => r.month_year === ym);
    const totalActual = recs.reduce((s, r) => s + (parseFloat(r.monthly_volume) || 0), 0);
    const swVol = recs.filter(r => r.category === 'Surface Water').reduce((s, r) => s + (parseFloat(r.monthly_volume) || 0), 0);
    const gwVol = recs.filter(r => r.category === 'Groundwater').reduce((s, r) => s + (parseFloat(r.monthly_volume) || 0), 0);
    const dailyAvg = elapsedDays > 0 ? totalActual / elapsedDays : 0;
    const swPct = totalActual > 0 ? (swVol / totalActual) * 100 : 0;
    const gwPct = totalActual > 0 ? (gwVol / totalActual) * 100 : 0;
    const pctVsNormal = (totalActual / baselineM3) * 100;
    const lwuaStatus = totalActual >= lwuaCutoffM3 ? 'In Capacity' : 'For Reporting';

    return {
      month_year: ym,
      hasData: recs.length > 0,
      isProrated,
      elapsedDays,
      daysInMonth,
      baselineM3,
      lwuaCutoffM3,
      contingencyFloorM3,
      totalActual,
      dailyAvg,
      swPct,
      gwPct,
      pctVsNormal,
      lwuaStatus
    };
  });

  // Filter complaints in window
  const inRangeComplaints = complaints.filter(c => c.date >= startStr && c.date <= endStr);
  const noWaterCount = inRangeComplaints.filter(c => c.complaint_type === 'No Water').length;
  const lowPressureCount = inRangeComplaints.filter(c => c.complaint_type === 'Low Pressure').length;

  // Ensure output directory exists
  const reportsDir = path.join(PROJECT_ROOT, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const outBase = `telemetry_report_${startStr}_to_${endStr}`;
  const mdOutPath = path.join(reportsDir, `${outBase}.md`);
  const csvOutPath = path.join(reportsDir, `${outBase}.csv`);

  // Build Markdown Report
  const mdReport = `# PPCWD Comprehensive Telemetry Report
**Reporting Period:** ${startStr} – ${endStr} (${presetName})  
**Generated On:** ${new Date().toISOString().replace('T', ' ').slice(0, 19)} PST  
**System Standard:** Puerto Princesa City Water District (PPCWD) Operational Guidelines  

---

## 1. Executive Summary & Production Performance

### Monthly Capacity & LWUA Regulatory Status
| Month / Period | Status | Total Actual (m³) | Daily Avg (m³/d) | Surface % | Ground % | Target Benchmark (m³) | % vs Target | LWUA Evaluation |
|---|---|---|---|---|---|---|---|---|
${monthlySummaries.map(m => `| **${m.month_year}** | ${m.isProrated ? `*Prorated (${m.elapsedDays}/${m.daysInMonth}d)*` : 'Full Month'} | ${m.hasData ? m.totalActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'No Data'} | ${m.hasData ? m.dailyAvg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} | ${m.hasData ? m.swPct.toFixed(1) + '%' : '—'} | ${m.hasData ? m.gwPct.toFixed(1) + '%' : '—'} | ${m.baselineM3.toLocaleString('en-US', { maximumFractionDigits: 0 })} | ${m.hasData ? m.pctVsNormal.toFixed(1) + '%' : '—'} | **${m.lwuaStatus}** |`).join('\n')}

---

## 2. Distribution Network Hydraulic Pressure Telemetry
*Note: High-pressure transmission lines (Campo Uno, UV Facility, Escalante, Tagburos) are segregated from distribution calculations. MBS is included in the urban core distribution average, and Sta. Monica is isolated for boosted zone reporting.*

- **System-Wide Distribution Average:** **${distAvg.toFixed(2)} psi** (Target: ≥ 15.0 psi)
- **Peak Demand Hours (06:00–09:00 & 17:00–20:00):** **${peakAvg.toFixed(2)} psi**
- **Off-Peak Night Hours (22:00–04:00):** **${offPeakAvg.toFixed(2)} psi**
- **MBS Urban Core Monitoring Point:** **${mbsAvg.toFixed(2)} psi**
- **Sta. Monica Boosted Zone Average:** **${staMonicaAvg.toFixed(2)} psi**
- **Supply Interruptions (0 psi):** **${eq0Count} network hours** logged

### Service Level Compliance (PPCWD Pressure Bands)
| Service Compliance Band | Station-Hours Logged | Compliance Percentage | Standard Target |
|---|---|---|---|
| **Standard Service (≥ 15.0 psi)** | ${ge15Count.toLocaleString()} | **${((ge15Count / totalDist) * 100).toFixed(2)}%** | ≥ 80.0% Network Hours |
| **Marginal Pressure (6.5 – 14.9 psi)** | ${b65_15Count.toLocaleString()} | **${((b65_15Count / totalDist) * 100).toFixed(2)}%** | Operational Buffer Band |
| **Critical Low Pressure (< 6.5 psi)** | ${lt65Count.toLocaleString()} | **${((lt65Count / totalDist) * 100).toFixed(2)}%** | 0.0% Target |
| **Supply Outage (0.0 psi)** | ${eq0Count.toLocaleString()} | **${((eq0Count / totalDist) * 100).toFixed(2)}%** | 0.0% Target |

---

## 3. Consumer Service Complaints Summary
- **Total Complaints Logged:** **${inRangeComplaints.length}**
  - **No Water:** ${noWaterCount} (${inRangeComplaints.length ? ((noWaterCount / inRangeComplaints.length) * 100).toFixed(1) : 0}%)
  - **Low Pressure:** ${lowPressureCount} (${inRangeComplaints.length ? ((lowPressureCount / inRangeComplaints.length) * 100).toFixed(1) : 0}%)
`;

  fs.writeFileSync(mdOutPath, mdReport, 'utf8');

  // Build CSV Summary
  const csvRows = [
    ['Metric', 'Value', 'Unit', 'Standard / Target'],
    ['Reporting Period Start', startStr, 'Date', ''],
    ['Reporting Period End', endStr, 'Date', ''],
    ['Template Preset', presetName, 'Text', ''],
    ['System Dist Avg Pressure', distAvg.toFixed(2), 'psi', '>= 15.0 psi'],
    ['Peak Hours Dist Pressure', peakAvg.toFixed(2), 'psi', '>= 15.0 psi'],
    ['Off-Peak Dist Pressure', offPeakAvg.toFixed(2), 'psi', '>= 15.0 psi'],
    ['MBS Urban Core Avg Pressure', mbsAvg.toFixed(2), 'psi', 'Distribution Key Point'],
    ['Sta. Monica Boosted Zone Avg Pressure', staMonicaAvg.toFixed(2), 'psi', 'Boosted Zone'],
    ['Pressure Compliance >= 15 psi', ((ge15Count / totalDist) * 100).toFixed(2), '%', '>= 80%'],
    ['Pressure Marginal 6.5-14.9 psi', ((b65_15Count / totalDist) * 100).toFixed(2), '%', 'Buffer'],
    ['Pressure Critical < 6.5 psi', ((lt65Count / totalDist) * 100).toFixed(2), '%', '0%'],
    ['Supply Outage 0 psi Hours', eq0Count, 'Hours', '0 Hours'],
    ['Total Consumer Complaints', inRangeComplaints.length, 'Count', 'Minimization Target'],
    ['No Water Complaints', noWaterCount, 'Count', ''],
    ['Low Pressure Complaints', lowPressureCount, 'Count', '']
  ];

  fs.writeFileSync(csvOutPath, csvRows.map(r => r.map(c => `"${c}"`).join(',')).join('\n'), 'utf8');

  console.log('\n' + '='.repeat(80));
  console.log(` EXTRACTION & REPORT COMPLETED SUCCESSFULLY!`);
  console.log(` Markdown Deliverable : ${path.relative(PROJECT_ROOT, mdOutPath)}`);
  console.log(` CSV Deliverable      : ${path.relative(PROJECT_ROOT, csvOutPath)}`);
  console.log('='.repeat(80));
}

main().catch(err => {
  console.error('\n[FATAL ERROR]:', err);
  process.exit(1);
});
