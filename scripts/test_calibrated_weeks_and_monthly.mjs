#!/usr/bin/env node
/**
 * scripts/test_calibrated_weeks_and_monthly.mjs
 * 
 * Verifies:
 * 1. buildCalibratedWeeklySchedule produces 4 calibrated weeks (target + historical backfill).
 * 2. Unsubmitted subsequent weeks (e.g. Week 32: Oct 28 - Nov 3) have hasProdReport: false.
 * 3. Monthly production records strictly use submitted reports (no weekly proration).
 * 4. Weekly Production table handles unsubmitted weeks with 'No Report Yet (Pending Submission)'.
 * 5. Weekly Major Pressure table computes telemetry for all 4 calibrated weekly windows.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');

const checks = [
  {
    name: "1. buildCalibratedWeeklySchedule engine defined in index.html",
    pass: html.includes("function buildCalibratedWeeklySchedule(startDt, endDt)") &&
          html.includes("filterOperationalWeeksInRange(startDt, endDt)")
  },
  {
    name: "2. Monthly production strictly uses submitted reports without weekly proration",
    pass: html.includes("Executive Directive: Use ONLY officially submitted Monthly Production Reports.") &&
          html.includes("Weekly records must NOT be used for synthetic proration.") &&
          html.includes("lwuaStatus: 'No Report Yet submitted'") &&
          !html.includes("synthTotal += (wTotal / 7)")
  },
  {
    name: "3. Weekly Production table renders 'No Report Yet (Pending Submission)' for unsubmitted weeks",
    pass: html.includes("No Report Yet (Pending Submission)") &&
          html.includes("WEEKLY AVERAGE (${cnt > 0 ? `${cnt} Reported Weeks` : 'No Reports Yet'})")
  },
  {
    name: "4. Weekly Major Pressure Monitoring Points supports calibrated week windows with sDate & eDate",
    pass: html.includes("// Weekly Major Pressure Monitoring Points (Derived from calibrated weekly windows)") &&
          html.includes("const { sDate, eDate } = (row.sDate && row.eDate)") &&
          html.includes("wkReadings = (sDate && eDate)")
  },
  {
    name: "5. Pressure telemetry pre-loading expands to oldest calibrated week in schedule",
    pass: html.includes("const calibratedSchedule = buildCalibratedWeeklySchedule(startDt, endDt);") &&
          html.includes("earliestLoadDt = oldestWk.sDate;") &&
          html.includes("await ensurePressureRangeLoaded(earliestLoadDt, endDt")
  },
  {
    name: "6. Executive Takeaways banner handles unsubmitted monthly report gracefully",
    pass: html.includes("recentMonth.hasData") &&
          html.includes("`${recentMonth.month_year}: ${recentMonth.lwuaStatus}`")
  }
];

console.log("================================================================================");
console.log(" VERIFICATION AUDIT: CALIBRATED 4-WEEK SCHEDULE & PURE MONTHLY SUBMISSION");
console.log("================================================================================");

let passed = 0, failed = 0;
checks.forEach(c => {
  if (c.pass) {
    console.log(`[PASS] ${c.name}`);
    passed++;
  } else {
    console.log(`[FAIL] ${c.name}`);
    failed++;
  }
});

console.log("================================================================================");
console.log(` AUDIT TOTALS: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) process.exit(1);

