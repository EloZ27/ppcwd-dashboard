import fs from 'node:fs';
import path from 'node:path';

console.log("=== COMPREHENSIVE REPORT REFINEMENTS AUDIT ===");

const htmlPath = path.resolve('index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const checks = [
  // 1. Monthly Production
  { 
    name: "Header banner displays 'Reporting Period' with start and end dates", 
    pass: content.includes('Reporting Period') && content.includes('${escapeHtml(startStr)} &ndash; ${escapeHtml(endStr)}') 
  },
  { 
    name: "Monthly Production displays all available records descending", 
    pass: content.includes('fetchAllMonthlyRecords(startDt, endDt)') && content.includes('sortedMonths = Array.from(set).sort((a, b) => b.localeCompare(a))') 
  },
  { 
    name: "Card shows recent reported month LWUA Status", 
    pass: content.includes('Recent Month LWUA Status') && content.includes('recentMonth.lwuaStatus') 
  },

  // 2. Pressure Telemetry & Hydraulic Network Classification
  { 
    name: "Robust period date parser parsePeriodDates exists", 
    pass: content.includes('function parsePeriodDates(pStr, fallbackDateStr)') 
  },
  { 
    name: "MBS (col: 2) is included in system distribution average", 
    pass: content.includes('distCols = PRESSURE_STATIONS') && !content.includes('col !== 2') 
  },
  { 
    name: "Transmission lines (Campo Uno col 8, UV col 19, Escalante col 3, Tagburos col 5) are excluded from system distribution average", 
    pass: content.includes('transCols = [8, 19, 3, 5]') && content.includes('!transCols.includes(s.col)') 
  },
  { 
    name: "Sta. Monica (col 10) is excluded from general distribution average and tracked separately", 
    pass: content.includes('boostedCols = [10]') && content.includes('!boostedCols.includes(s.col)') && content.includes('staMonicaMean') 
  },
  { 
    name: "Sta. Monica Boosted Zone KPI card exists on Page 2", 
    pass: content.includes('Sta. Monica (Boosted Zone)') && content.includes('pressData.staMonicaMean') 
  },
  { 
    name: "PPCWD regulatory compliance bands updated (6.5 - 14.9 psi and < 6.5 psi)", 
    pass: content.includes('6.5&ndash;14.9 psi') && content.includes('&lt; 6.5 psi') && content.includes('val >= 6.5') 
  },
  { 
    name: "Top 5 lowest pressure stations reflect hours < 6.5 psi", 
    pass: content.includes('Hours &lt; 6.5 psi') && content.includes('hoursLt65') && content.includes('dailyHoursLt65') 
  },
  { 
    name: "Operational Risk Status column is removed from Top 5 lowest table", 
    pass: !content.includes('Operational Risk Status') 
  },

  // 3. Customer Service Complaints
  { 
    name: "Correlated SCADA Pressure Sensor column is removed from complaints table", 
    pass: !content.includes('Correlated SCADA Pressure Sensor') && !content.includes('Correlated SCADA SCADA') 
  },

  // 4. Watershed Hydrology & River Flow
  { 
    name: "Top KPI cards removed from river hydrology section", 
    pass: !content.includes('Most Vulnerable Gauge') && !content.includes('Primary City Sources Peak') 
  },
  { 
    name: "Vulnerability Status column removed from river matrix table", 
    pass: !content.includes('Vulnerability Status') 
  },
  { 
    name: "River matrix table reflects Previous Flow & Date vs Latest Flow & Date with Net Change and % Change", 
    pass: content.includes('Previous Flow (m&sup3;/d)') && content.includes('Previous Date') && content.includes('Latest Flow (m&sup3;/d)') && content.includes('Latest Date') 
  },
  { 
    name: "Dual export engines (Print window & multi-page jsPDF) remain intact", 
    pass: content.includes('function printComprehensiveReport()') && content.includes('function downloadComprehensiveReportPDF()') 
  }
];

let failed = 0;
checks.forEach(c => {
  if (c.pass) {
    console.log(`[PASS] ${c.name}`);
  } else {
    console.error(`[FAIL] ${c.name}`);
    failed++;
  }
});

if (failed === 0) {
  console.log("\n>>> ALL 16 REFINEMENT AUDIT CHECKS PASSED PERFECTLY! <<<");
} else {
  console.error(`\n>>> ${failed} CHECKS FAILED! <<<`);
  process.exit(1);
}
