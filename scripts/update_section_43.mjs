import fs from 'node:fs';

let code = fs.readFileSync('scripts/extract_gm_board_report_aug_oct_2026.mjs', 'utf8');

const targetStr = `### 4.3 Diurnal Pressure Distribution Profile Across Operational Time Areas (Peak vs. Off-Peak Dynamics)`;
const endStr = `## 5. Watershed Hydrology & River Flow Depletion Analysis`;

const targetIndex = code.indexOf(targetStr);
const endIndex = code.indexOf(endStr);

if (targetIndex === -1 || endIndex === -1) {
  console.error('Target not found!', { targetIndex, endIndex });
  process.exit(1);
}

const replacement = `### 4.3 Diurnal Pressure Distribution Profile Across Operational Time Areas (Peak vs. Off-Peak Dynamics)

To evaluate system-wide hydraulic stress and service recovery across diurnal consumption cycles, distribution telemetry across the 89-day reporting span was aggregated into 24 one-hour time bins (PST) and partitioned into PPCWD's official operational time areas:

\\\`\\\`\\\`
  Pressure (psi)
    ▲
 20 ┤
    │ [NIGHTTIME OFF-PEAK]   [MORNING PEAK]     [DAYTIME OFF-PEAK]      [EVENING PEAK] [NIGHT OFF-PEAK]
 15 ┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  Standard (≥ 15.0 psi)
    │        ╭───╮ (15.6)                                                      ╭──╮ (13.8)
    │   ╭────╯   ╰──╮                                                    ╭─────╯  ╰─
 10 ┼───╯           ╰──────╮  (11.1)                             ╭───────╯ (11.0)
    │   [20:00 - 05:00]    ╰───────╮ (7.8)               ╭───────╯ [17:00 - 20:00]
  5 ┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ╰───────────────────────╯ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  Critical Alert (< 6.5 psi)
    │                      [05:00 - 08:00]     [08:00 - 17:00]
  0 ┴────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────► Hour (PST)
        00    02    04    06    08    10    12    14    16    18    20    22
\\\`\\\`\\\`

#### Empirical Time Area Operational Summary Table:

| Operational Time Area | Zone Classification | Time Window (PST) | Distribution Avg (psi) | MBS Booster (psi) | Sta. Monica (psi) | Compliance (≥ 15.0 psi) | Critical Low (< 6.5 psi) | Primary Hydraulic Diagnostic & Operational Status |
|---|---|---|---|---|---|---|---|---|
\${zoneStats.map(z => \`| **\${z.name}** | \${z.zoneClass} | \${z.window} | **\${z.distAvg.toFixed(2)} psi** | **\${z.mbsAvg.toFixed(2)} psi** | \${z.smAvg.toFixed(2)} psi | **\${z.compliancePct.toFixed(1)}%** | **\${z.criticalPct.toFixed(1)}%** | \${z.diagnostic} |\`).join('\\n')}
| **COMBINED PEAK DEMAND** | **Official Peak Demand Hours** | **5:00–8:00 AM & 5:00–8:00 PM (6 hrs/day)** | **\${combPeak.distAvg.toFixed(2)} psi** | **\${combPeak.mbsAvg.toFixed(2)} psi** | \${combPeak.smAvg.toFixed(2)} psi | **\${combPeak.compliancePct.toFixed(1)}%** | **\${combPeak.criticalPct.toFixed(1)}%** | **Aggregated peak demand hours characterized by maximum hydraulic friction and customer deficit exposure.** |
| **COMBINED OFF-PEAK HOURS** | **Official Off-Peak Hours** | **8:00 AM–5:00 PM & 8:00 PM–5:00 AM (18 hrs/day)** | **\${combOffPeak.distAvg.toFixed(2)} psi** | **\${combOffPeak.mbsAvg.toFixed(2)} psi** | \${combOffPeak.smAvg.toFixed(2)} psi | **\${combOffPeak.compliancePct.toFixed(1)}%** | **\${combOffPeak.criticalPct.toFixed(1)}%** | **Combined non-peak operating windows: daytime institutional drawdown balanced by overnight network head recovery.** |

**Key Engineering Findings from Diurnal Telemetry:**
1. **The Peak Demand Vulnerability Paradox**: During the two peak extraction windows (**05:00–08:00** and **17:00–20:00**), system distribution pressure averages **\${combPeak.distAvg.toFixed(2)} psi** (Morning Peak: **\${zoneStats[1].distAvg.toFixed(2)} psi**, Evening Peak: **\${zoneStats[3].distAvg.toFixed(2)} psi**). Because downstream service friction rises exponentially with flow velocity ($h_f \\propto v^2$), pressures at critical nodes like **Valencia cor Manalo** and **Manalo Booster Station** collapse below 7.0 psi, creating direct consumer outages in San Miguel and San Pedro.
2. **Nighttime Off-Peak Head Recovery**: Between **20:00 and 05:00**, when domestic withdrawal drops to minimal levels, system distribution pressure recovers to an average of **\${zoneStats[0].distAvg.toFixed(2)} psi** (with peak night readings of **15.6 psi** at 04:00). Critical low pressure exposure ($< 6.5\\text{ psi}$) plummets from **\${combPeak.criticalPct.toFixed(1)}%** during peak hours down to **\${zoneStats[0].criticalPct.toFixed(1)}%** at night.
3. **Daytime Off-Peak Base Load Stabilization**: Between **08:00 and 17:00**, continuous municipal commercial and institutional activity stabilizes pressure at an average of **\${zoneStats[2].distAvg.toFixed(2)} psi**, maintaining a steady daytime operating plateau.
4. **Sta. Monica Boosting Dynamics**: In the elevated Sta. Monica zone, pressures surge during the evening peak to **\${zoneStats[3].smAvg.toFixed(2)} psi** as dedicated booster pumps cycle on to maintain terminal head, while lower-elevation nodes experience simultaneous drawdown.

---

`;

const updatedCode = code.slice(0, targetIndex) + replacement + code.slice(endIndex);
fs.writeFileSync('scripts/extract_gm_board_report_aug_oct_2026.mjs', updatedCode, 'utf8');
console.log('Successfully updated Section 4.3 in extract_gm_board_report_aug_oct_2026.mjs');

