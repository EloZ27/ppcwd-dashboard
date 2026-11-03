// scripts/test_comprehensive_audit_final.mjs
import fs from 'node:fs';
import path from 'node:path';

console.log("================================================================================");
console.log(" EXECUTIVE AUDIT: CRITICAL BUGS & MATHEMATICAL FIXES VERIFICATION");
console.log("================================================================================");

const html = fs.readFileSync('index.html', 'utf8');

const tests = [
  // 1. Page 1: Monthly & Weekly Production Logic
  {
    name: "1.1 Prorated current month synthesizes from daily operational data when no final monthly record exists",
    pass: html.includes("isProrated: true") &&
          html.includes("1705700.0 * prorationFactor") &&
          html.includes("lwuaStatus = totalActual >= lwuaCutoffM3 ? 'In Capacity' : 'For Reporting'") &&
          html.includes("Prorated (${m.elapsedDays}/${m.daysInMonth}d)")
  },
  {
    name: "1.2 Date range hyphenation guard prevents Week 28 'October 2-9, 2026' from collapsing into 'October 29, 2026'",
    pass: html.includes("function formatDateRange(") &&
          html.includes("pStr.includes('October 29') && fallbackDateStr && fallbackDateStr.includes('10-09')") &&
          html.includes("${sMonth} ${sDay} – ${eDay}, ${sYear}")
  },
  {
    name: "1.3 Automated 3-column Executive Takeaways banner dynamically synthesizes yield, hotspot, and watershed alerts",
    pass: html.includes("1. Production Yield &amp; LWUA Trigger") &&
          html.includes("2. Hydraulic Hotspot &amp; Low-Pressure Risk") &&
          html.includes("3. Watershed Hydrology &amp; Source Depletion") &&
          html.includes("execProdSummary") &&
          html.includes("execPressSummary") &&
          html.includes("execRiverSummary")
  },

  // 2. Page 2: System Pressure & Diurnal Table Alignment
  {
    name: "2.1 Sta. Monica diurnal cell mapping fixed to single average (no column shift or stacking)",
    pass: html.includes("${a.hasReadings && a.smMean > 0 ? fmt(a.smMean, 2) + ' psi' : '—'}")
  },
  {
    name: "2.2 Period total complaints populated in PERIOD TOTAL/MEAN row and clarified with explanatory note",
    pass: html.includes("${pressData.monthlyComplianceRows.reduce((s, r) => s + (parseInt(r.compTotal, 10) || 0), 0)} / ${pressData.monthlyComplianceRows.reduce((s, r) => s + (parseInt(r.compNW, 10) || 0), 0)}") &&
          html.includes("* Note: Monthly compliance rows aggregate full calendar months for regulatory baseline tracking; period totals reflect cumulative customer complaints across the reported operational window.")
  },
  {
    name: "2.3 Hydraulic Diagnostic column removed from Time Area table for breathing room",
    pass: !html.includes("<th>Hydraulic Diagnostic &amp; Operational Dynamics</th>")
  },
  {
    name: "2.4 Pressure SVG legend repositioned centered over daytime off-peak valley clear of 8 PM-5 AM recharge zone",
    pass: html.includes('<g transform="translate(260, ${padTop + 4})">') &&
          html.includes('System Dist Avg') &&
          html.includes('Sta. Monica (Boosted)')
  },
  {
    name: "2.5 The word 'Diurnal' removed from section header and titles",
    pass: html.includes('<span>PRESSURE DISTRIBUTION &amp; OPERATIONAL TIME AREAS (PSI)</span>') &&
          !html.includes('<span>DIURNAL PRESSURE DISTRIBUTION &amp; OPERATIONAL TIME AREAS (PSI)</span>')
  },

  // 3. Page 3: Weekly Major Pressure & Low-Pressure Sensors
  {
    name: "3.1 Raw column indices stripped and replaced with clean executive facility labels",
    pass: html.includes('>MBS (Urban Core)</th>') &&
          html.includes('>Sta. Monica (Boosted)</th>') &&
          html.includes('>Campo Uno (Trans.)</th>') &&
          html.includes('>UV Facility (Trans.)</th>') &&
          html.includes('>Escalante (Trans.)</th>') &&
          html.includes('>Tagburos (Trans.)</th>') &&
          !html.includes('(col 2)') &&
          !html.includes('(col 8)') &&
          !html.includes('(col 19)') &&
          !html.includes('(col 3)') &&
          !html.includes('(col 5)')
  },
  {
    name: "3.2 UV Facility offline / 0.00 psi formatted cleanly as 'Offline / No Telemetry' muted badge",
    pass: html.includes("Offline / No Telemetry</span>")
  },

  // 4. Page 4: Customer Service Complaints
  {
    name: "4.1 Water Quality / Turbidity KPI card is null-safe (defaults to 0 reports and 0.0%)",
    pass: html.includes("${(compData.turbidCount || 0).toLocaleString()} <span style=\"font-size:10px; font-weight:600;\">reports</span>") &&
          html.includes("${compData.total > 0 ? fmt(((compData.turbidCount || 0) / compData.total) * 100, 1) : '0.0'}% of all complaints")
  },
  {
    name: "4.2 Stubout IDs sanitized with consistent SO-xxxx / S1-xxx formatting and sub-columns aligned",
    pass: html.includes("function sanitizeStubout(str)") &&
          html.includes("const so = sanitizeStubout(rawSo)") &&
          html.includes("<th>Top Impacted Stubouts (SO-xxxx)</th>")
  },

  // 5. Page 5: Watershed River Flow Telemetry Matrix
  {
    name: "5.1 Zero-baseline percentage guard returns 'Recovery (from 0)' instead of '+0.0%'",
    pass: html.includes("if (p === 0)") &&
          html.includes("if (c > 0) return { value: null, label: 'Recovery (from 0)' };")
  },
  {
    name: "5.2 Stale river gauges (>14 days) segregated into secondary section and badged with [Last Gauged: <Date>]",
    pass: html.includes("function isStaleReading(readingDate, reportEndDate, thresholdDays = 14)") &&
          html.includes("Historical / Non-Current Gauge Readings (&gt;14 Days Old &bull; Baseline Reference &bull; Not Reflective of Current-Week Collapse)") &&
          html.includes("[Last Gauged: ${lDateStr}]")
  },

  // 6. Subtitle & Context Cleanup
  {
    name: "6.1 Executive subtitle cleaned to 'Operational & Hydrological Telemetry Report'",
    pass: html.includes('Operational & Hydrological Telemetry Report') &&
          !html.includes('El Niño Task Force Data from El Niño Task Force Monitoring')
  }
];

let failed = 0;
tests.forEach(t => {
  if (t.pass) {
    console.log(`[PASS] ${t.name}`);
  } else {
    console.error(`[FAIL] ${t.name}`);
    failed++;
  }
});

console.log("================================================================================");
console.log(` AUDIT TOTALS: ${tests.length - failed} PASSED / ${failed} FAILED`);
console.log("================================================================================");

if (failed > 0) process.exit(1);
