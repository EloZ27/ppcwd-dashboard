# Testing Infrastructure: PPCWD Dashboard UI Polish E2E Suite

## Overview
This document defines the automated end-to-end (E2E) testing infrastructure for the **PPCWD Dashboard UI Layout, Navigation Clarity, and Table Scrolling Polish** initiative.

The testing infrastructure implements an opaque-box automated test harness targeting user requirements R1 through R5, derived strictly from `ORIGINAL_REQUEST.md` and architectural interface contracts defined in `PROJECT.md`.

---

## 1. Architecture & Execution Model

### 1.1 Zero-Dependency Pure Node.js Test Harness
The test harness is implemented in `scripts/test_e2e_ui_polish.mjs` and runs natively on standard Node.js (v20+ / v24+). It requires **zero external npm packages** (no external browser automation, Jest, or Mocha installations required), guaranteeing:
- Deterministic, fast execution (< 250ms per run).
- Portability across Windows, Linux, and macOS without headless browser or display server dependencies.
- Bypassing Windows PowerShell script execution policy restrictions on npm wrappers.

### 1.2 Test Execution Command
Execute the test harness from the project root via:
```powershell
node scripts/test_e2e_ui_polish.mjs
```

Or on Windows Command Prompt:
```cmd
cmd.exe /c "node scripts/test_e2e_ui_polish.mjs"
```

---

## 2. Directory Layout & Test Artifacts

```
ppcwd-dashboard/
├── index.html                      # Primary dashboard UI, styles, controllers
├── uploader.html                   # Administrative data upload portal
├── api/
│   └── monthlyProduction.js        # Backend REST API for monthly production records
├── scripts/
│   ├── test_e2e_ui_polish.mjs      # Comprehensive 4-tier E2E UI polish test suite (60 tests)
│   ├── test_comprehensive_report_audit.mjs # Domain report audit suite (16 tests)
│   └── test_adversarial_telemetry.mjs     # Telemetry data audit harness
├── TEST_INFRA.md                   # This infrastructure architecture specification
└── TEST_READY.md                   # Test readiness declaration, runner command & coverage matrix
```

---

## 3. Test Tier Taxonomy & Coverage Hierarchy

The test harness enforces a strict 4-tier testing hierarchy with **60 distinct automated test cases**:

| Tier | Category | Target | Requirements Covered | Description |
|------|----------|--------|----------------------|-------------|
| **Tier 1** | Feature Coverage | 25 Tests (5 / req) | R1, R2, R3, R4, R5 | Primary functionality, DOM presence, attributes, CSS rules, script controllers |
| **Tier 2** | Boundary & Corner Cases | 25 Tests (5 / req) | R1, R2, R3, R4, R5 | Viewport extremes (320px–1920px), long strings, 5px drag thresholds, zero/negative volumes, contrast |
| **Tier 3** | Cross-Feature Combinations | 5 Tests | R1↔R2, R2↔R3, R3↔R4, R1↔R5, R3↔R4↔R5 | Integration between navigation, modals, tables, and period controls |
| **Tier 4** | Real-World Operator Scenarios | 5 Tests | Multi-Track Workflows | End-to-end user workflows for mobile field operators, data admins, SCADA analysts, executives |
| **Total** | **Comprehensive E2E Suite** | **60 Tests** | **Full Scope** | **Opaque-box verification across the entire dashboard lifecycle** |

---

## 4. Verification Mechanisms

### 4.1 DOM Structure & Element Extraction
- Balanced tag parser (`extractElementHtml`) recursively navigates nested HTML tags to extract full parent containers (e.g. `#reports-dropdown-menu`, `#bar-period-pressure`, `.crisis-legend-bar`) without premature termination at inner child closing tags.
- Verifies element IDs, semantic roles, inline styles, text content, and button structure.

### 4.2 CSS Rules & Media Query Inspector
- `hasCssRule(css, selectorRegex, propertyRegex)`: Parses inline stylesheets to verify CSS selectors and declaration properties.
- `hasMediaQueryRule(css, mqRegex, selectorRegex, propertyRegex)`: Validates responsive design rules at breakpoints (`@media (max-width: 820px)`, `@media (max-width: 640px)`, `@media (max-width: 440px)`).
- Ensures responsive behaviors: `.desktop-text` hidden at $\le$820px, `.map-outlier-chips` converted to horizontal swipe ribbon on mobile, and `.crisis-legend-bar` reflowed into a balanced 2x2 grid.

### 4.3 Drag-and-Swipe Simulation Engine
- Mathematical validation of the 5px displacement threshold:
  - $\Delta x < 5\text{px} \implies \text{isDragging} = \text{false}$, click event permitted.
  - $\Delta x \ge 5\text{px} \implies \text{isDragging} = \text{true}$, `user-select: none`, click event captured and suppressed.
- Momentum coasting simulation applying exponential friction decay ($v_{t+1} = v_t \times 0.94$) terminating cleanly in $<80$ frames.
- Boundary clamping at `scrollLeft = 0` and `scrollLeft = maxScroll`.

### 4.4 Responsive Viewport Simulation
- Simulates available horizontal real estate across mobile (320px, 375px), tablet (768px, 820px, 1024px), and desktop (1440px, 1920px) screens.
- Computes title clearance when header actions collapse: ensures $\ge 80\text{px}$ available for `#top-bar-title` on 320px viewports without horizontal scrollbar blowout.

### 4.5 Color Integrity & Contrast Verification
- Authoritative color validation:
  - Normal ($\ge 100\%$): `#0b4f6c`
  - Level 1 Watch ($90\%-99.9\%$): `var(--green)` / `#10B981`
  - Level 2 Alert ($75\%-89.9\%$): `var(--amber)` / `#F59E0B`
  - Level 3 Critical ($< 75\%$): `var(--red)` / `#EF4444`
- WCAG AA accessibility contrast ratio calculation for `#0b4f6c` against `#FFFFFF` ($\ge 4.5:1$).

---

## 5. Milestone Gating & Continuous Verification

The test harness operates as an automated acceptance gate for each milestone:

| Milestone | Target Scope | Passing Tests Required | Gating Rule |
|-----------|--------------|------------------------|-------------|
| **M1** | Navigation & Core Layout Polish | T1.1–T1.5, T1.21–T1.25, T2.1–T2.5, T2.21–T2.25, T3.4 | R1 & R5 tests must pass 100% |
| **M2** | Monthly Volume Input Transfer | T1.6–T1.10, T2.6–T2.10, T3.1, T3.2, T4.2 | R2 tests must pass 100% |
| **M3** | Network Pressure Layout De-clustering | T1.16–T1.20, T2.16–T2.20, T3.3, T3.5, T4.3 | R4 tests must pass 100% |
| **M4** | Drag & Swipe Table Scrolling | T1.11–T1.15, T2.11–T2.15, T3.2, T3.3, T4.4 | R3 tests must pass 100% |
| **M5** | Final E2E Suite Pass & Hardening | All 60 Tests (Tiers 1–4) | 100% pass (60/60) with 0 regressions |

---

## 6. How to Run & Verify

1. Run the E2E UI Polish Suite:
   ```powershell
   node scripts/test_e2e_ui_polish.mjs
   ```
2. Run the Domain Report Audit:
   ```powershell
   node scripts/test_comprehensive_report_audit.mjs
   ```
3. Run the Production Build:
   ```powershell
   cmd.exe /c "npm run build"
   ```
