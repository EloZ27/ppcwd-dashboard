// scripts/test_diurnal_pressure_profile.mjs
import fs from 'node:fs';
import path from 'node:path';

console.log("================================================================================");
console.log(" VERIFICATION AUDIT: GM PRESSURE DIURNAL PROFILE & MULTI-WEEK API PAGINATION");
console.log("================================================================================");

const rootDir = process.cwd();
const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const apiContent = fs.readFileSync(path.join(rootDir, 'api', 'getPressure.js'), 'utf8');
const mdContent = fs.readFileSync(path.join(rootDir, 'GM_Board_Report_Telemetry_Aug_Oct_2026.md'), 'utf8');
const scriptContent = fs.readFileSync(path.join(rootDir, 'scripts', 'extract_gm_board_report_aug_oct_2026.mjs'), 'utf8');

const checks = [
  // 1. API Pagination & Metadata Headers
  {
    category: "API Pagination",
    name: "api/getPressure.js parses limit and offset parameters",
    pass: apiContent.includes('const limit = Math.min(Math.max(parseInt(req.query.limit, 10)') &&
          apiContent.includes('const offset = Math.max(parseInt(req.query.offset, 10)')
  },
  {
    category: "API Pagination",
    name: "api/getPressure.js supports sort order parameter",
    pass: apiContent.includes('const orderParam = req.query.order') &&
          apiContent.includes('order=reading_time.${order}')
  },
  {
    category: "API Pagination",
    name: "api/getPressure.js sets PostgREST count headers (Content-Range, x-total-count, x-has-more)",
    pass: apiContent.includes("'Prefer': 'count=exact'") &&
          apiContent.includes("res.setHeader('Content-Range', contentRange)") &&
          apiContent.includes("res.setHeader('x-total-count', parts[1])") &&
          apiContent.includes("res.setHeader('x-has-more'")
  },

  // 2. Client-Side Multi-Week Sliding Cursor
  {
    category: "Client Data Ingestion",
    name: "index.html fetchPressureRange implements sliding cursor pagination loop",
    pass: htmlContent.includes('async function fetchPressureRange(startDt, endDt, onProgress)') &&
          htmlContent.includes('while (curStart < targetEnd && batchNum < MAX_BATCHES)') &&
          htmlContent.includes('curStart = new Date(newestInBatch.getTime() + 1000)')
  },
  {
    category: "Client Data Ingestion",
    name: "index.html ensurePressureRangeLoaded delegates to multi-batch fetchPressureRange",
    pass: htmlContent.includes('async function ensurePressureRangeLoaded(startDt, endDt, onProgress)') &&
          htmlContent.includes('await fetchPressureRange(startDt, endDt, onProgress)')
  },

  // 3. Peak and Off-Peak Zone Unification (Official PPCWD Office Hours: 5-8 AM/PM Peak, 8AM-5PM & 8PM-5AM Off-Peak)
  {
    category: "Zone Unification",
    name: "Peak hours in index.html match official 5-8 AM & 5-8 PM PST standard",
    pass: htmlContent.includes('(hr >= 5 && hr < 8) || (hr >= 17 && hr < 20)')
  },
  {
    category: "Zone Unification",
    name: "Off-Peak hours in index.html match official 8AM-5PM & 8PM-5AM PST standard",
    pass: htmlContent.includes('(hr >= 8 && hr < 17) || (hr >= 20 || hr < 5)')
  },
  {
    category: "Zone Unification",
    name: "Monthly compliance table header specifies Peak (5-8 AM & 5-8 PM) and Off-Peak (8AM-5PM & 8PM-5AM)",
    pass: htmlContent.includes('Peak (5-8 AM &amp; 5-8 PM)') &&
          htmlContent.includes('Off-Peak (8AM-5PM &amp; 8PM-5AM)')
  },

  // 4. Diurnal Vector Graph & Summary Table in index.html
  {
    category: "Comprehensive Report",
    name: "Modal UI includes comp-sub-press-diurnal checkbox",
    pass: htmlContent.includes('id="comp-sub-press-diurnal"') &&
          htmlContent.includes('Diurnal Pressure Distribution Profile (Peak &amp; Off-Peak Zone Graph + Summary Table)')
  },
  {
    category: "Comprehensive Report",
    name: "updateCompTopicsUI manages comp-sub-press-diurnal disable state",
    pass: htmlContent.includes("'comp-sub-press-diurnal'")
  },
  {
    category: "Comprehensive Report",
    name: "generateDiurnalPressureSVG builder exists with 4 official Peak and Off-Peak visual zones and reference guidelines",
    pass: htmlContent.includes('function generateDiurnalPressureSVG(hourlyProfiles, timeAreaSummaries)') &&
          htmlContent.includes('PEAK (5-8 AM)') &&
          htmlContent.includes('OFF-PEAK (8 AM - 5 PM)') &&
          htmlContent.includes('PEAK (5-8 PM)') &&
          htmlContent.includes('OFF-PEAK (8PM-5AM)') &&
          htmlContent.includes('15.0 PSI Benchmark (Standard)') &&
          htmlContent.includes('6.5 PSI Alert Level (Critical)')
  },
  {
    category: "Comprehensive Report",
    name: "generateTimeAreaSummaryTableHtml summarizes official operational time areas and combined rows with Hydraulic Diagnostic removed for breathing room",
    pass: htmlContent.includes('function generateTimeAreaSummaryTableHtml(timeAreaSummaries, fmt)') &&
          htmlContent.includes('OFFICIAL PEAK (6h)') &&
          htmlContent.includes('OFFICIAL OFF-PEAK (18h)') &&
          !htmlContent.includes('Hydraulic Diagnostic &amp; Operational Dynamics')
  },
  {
    category: "Comprehensive Report",
    name: "Page 2 staging engine renders Diurnal SVG and Time Area Table when selected",
    pass: htmlContent.includes('if (subPressDiurnal)') &&
          htmlContent.includes('generateDiurnalPressureSVG(pressData.hourlyProfiles, pressData.timeAreaSummaries)') &&
          htmlContent.includes('generateTimeAreaSummaryTableHtml(pressData.timeAreaSummaries, fmt)')
  },

  // 5. Official GM Board Report Markdown Document
  {
    category: "GM Board Report Deliverable",
    name: "GM_Board_Report_Telemetry_Aug_Oct_2026.md contains Section 4.3 Diurnal Profile",
    pass: mdContent.includes('### 4.3 Diurnal Pressure Distribution Profile Across Operational Time Areas')
  },
  {
    category: "GM Board Report Deliverable",
    name: "GM Board Report contains 24-hour visual ASCII diurnal curve with 4 official operational zones",
    pass: mdContent.includes('[NIGHTTIME OFF-PEAK]') &&
          mdContent.includes('[MORNING PEAK]') &&
          mdContent.includes('[DAYTIME OFF-PEAK]') &&
          mdContent.includes('[EVENING PEAK]')
  },
  {
    category: "GM Board Report Deliverable",
    name: "GM Board Report contains Empirical Time Area Operational Summary Table with official zones and combined rows",
    pass: mdContent.includes('Nighttime Off-Peak Recharge') &&
          mdContent.includes('Morning Peak Demand') &&
          mdContent.includes('Daytime Off-Peak Baseline') &&
          mdContent.includes('Evening Peak Demand') &&
          mdContent.includes('COMBINED PEAK DEMAND') &&
          mdContent.includes('COMBINED OFF-PEAK HOURS')
  },
  {
    category: "GM Board Report Deliverable",
    name: "extract_gm_board_report_aug_oct_2026.mjs generates Section 4.3 automatically",
    pass: scriptContent.includes('### 4.3 Diurnal Pressure Distribution Profile Across Operational Time Areas')
  }
];

let failed = 0;
let currentCat = '';
for (const c of checks) {
  if (c.category !== currentCat) {
    currentCat = c.category;
    console.log(`\n--- ${currentCat.toUpperCase()} ---`);
  }
  if (c.pass) {
    console.log(`  [PASS] ${c.name}`);
  } else {
    console.error(`  [FAIL] ${c.name}`);
    failed++;
  }
}

console.log("\n" + "=".repeat(80));
console.log(` AUDIT TOTALS: ${checks.length - failed} PASSED / ${failed} FAILED`);
console.log("=".repeat(80));

if (failed > 0) {
  console.error(`\n>>> ${failed} CHECKS FAILED! <<<`);
  process.exit(1);
} else {
  console.log("\n>>> ALL CHECKS PASSED PERFECTLY! <<<");
  process.exit(0);
}
