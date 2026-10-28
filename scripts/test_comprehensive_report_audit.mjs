import fs from 'node:fs';
import path from 'node:path';

console.log("=== COMPREHENSIVE REPORT IMPLEMENTATION AUDIT ===");

const htmlPath = path.resolve('index.html');
const content = fs.readFileSync(htmlPath, 'utf8');

const checks = [
  { name: "Header button #btn-open-comp-report exists", pass: content.includes('id="btn-open-comp-report"') },
  { name: "Header button calls openComprehensiveReportModal()", pass: content.includes('onclick="openComprehensiveReportModal()"') },
  { name: "Modal #comprehensive-report-modal exists", pass: content.includes('id="comprehensive-report-modal"') },
  { name: "Staging container #comprehensive-report-staging exists", pass: content.includes('id="comprehensive-report-staging"') },
  { name: "Title input #comp-rep-title exists", pass: content.includes('id="comp-rep-title"') },
  { name: "Subtitle input #comp-rep-subtitle exists", pass: content.includes('id="comp-rep-subtitle"') },
  { name: "Context input #comp-rep-context exists", pass: content.includes('id="comp-rep-context"') },
  { name: "Start date input #comp-rep-start-date exists", pass: content.includes('id="comp-rep-start-date"') },
  { name: "End date input #comp-rep-end-date exists", pass: content.includes('id="comp-rep-end-date"') },
  { name: "Topic 1 (Production) checkbox exists", pass: content.includes('id="comp-topic-prod"') },
  { name: "Topic 2 (Pressure) checkbox exists", pass: content.includes('id="comp-topic-press"') },
  { name: "Topic 3 (Complaints) checkbox exists", pass: content.includes('id="comp-topic-comp"') },
  { name: "Topic 4 (River) checkbox exists", pass: content.includes('id="comp-topic-river"') },
  { name: "Subtopic monthly production exists", pass: content.includes('id="comp-sub-prod-monthly"') },
  { name: "Subtopic weekly production exists", pass: content.includes('id="comp-sub-prod-weekly"') },
  { name: "Subtopic subsystems exists", pass: content.includes('id="comp-sub-prod-subsystems"') },
  { name: "Subtopic monthly pressure exists", pass: content.includes('id="comp-sub-press-monthly"') },
  { name: "Subtopic weekly major pressure exists", pass: content.includes('id="comp-sub-press-weekly-major"') },
  { name: "Subtopic lowest 5 pressure sensors exists", pass: content.includes('id="comp-sub-press-lowest5"') },
  { name: "Subtopic complaints summary exists", pass: content.includes('id="comp-sub-comp-summary"') },
  { name: "Subtopic complaints hotspots exists", pass: content.includes('id="comp-sub-comp-hotspots"') },
  { name: "Subtopic river depletion matrix exists", pass: content.includes('id="comp-sub-river-depletion"') },
  { name: "CSS .comp-a4-page with 0.5in / 12.7mm margin exists", pass: content.includes('.comp-a4-page') && content.includes('12.7mm') },
  { name: "CSS @page with A4 portrait and 0.5in margin exists", pass: content.includes('size: A4 portrait;') && content.includes('margin: 0.5in;') },
  { name: "Passkey authorization wraps modal opener", pass: content.includes('ensureReportAuthorized(() => _doOpenComprehensiveReportModal()') },
  { name: "Pressure historical backtracking engine exists", pass: content.includes('ensurePressureRangeLoaded(startDt, endDt') },
  { name: "Monthly production range aggregator exists", pass: content.includes('fetchAllMonthlyInRange(startDt, endDt)') },
  { name: "Weekly operational weeks filter exists", pass: content.includes('filterOperationalWeeksInRange(startDt, endDt)') },
  { name: "Pressure analytics engine exists", pass: content.includes('computePressureAnalytics(startDt, endDt, matchedWeeks)') },
  { name: "Complaints analytics engine exists", pass: content.includes('computeComplaintsAnalytics(startDt, endDt)') },
  { name: "River depletion matrix engine exists", pass: content.includes('computeRiverDepletionMatrix(startDt, endDt)') },
  { name: "Print vector PDF function exists", pass: content.includes('function printComprehensiveReport()') },
  { name: "Download multi-page PDF function exists", pass: content.includes('function downloadComprehensiveReportPDF()') },
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
  console.log("\n>>> ALL 33 AUDIT CHECKS PASSED PERFECTLY! <<<");
} else {
  console.error(`\n>>> ${failed} CHECKS FAILED! <<<`);
  process.exit(1);
}

