// api/saveRiverFlow.js
import crypto from 'crypto';
import { DEFAULT_RIVER_STATIONS, DEFAULT_WATER_LEVEL_CONFIG, WATER_LEVEL_CONFIG_STATION } from './getRiverFlow.js';

function sanitizeWaterLevelRecord(rec, fallbackStation = 'Campo Uno Source (Irawan River)') {
  if (!rec || typeof rec !== 'object') return null;
  const stationName = String(rec.station_name || fallbackStation).trim();
  if (!stationName || stationName === WATER_LEVEL_CONFIG_STATION) return null;

  const rawTime = rec.reading_time;
  const parsedDt = rawTime ? new Date(rawTime) : null;
  if (!parsedDt || isNaN(parsedDt.getTime())) return null;

  const waterLevel = parseFloat(rec.water_level);
  const normalLevel = parseFloat(rec.normal_level);
  if (!Number.isFinite(waterLevel) || waterLevel < 0 || waterLevel > 9999) return null;
  if (!Number.isFinite(normalLevel) || normalLevel <= 0 || normalLevel > 9999) return null;

  const warnParsed = rec.warning_level !== undefined && rec.warning_level !== null && rec.warning_level !== '' ? parseFloat(rec.warning_level) : null;
  const critParsed = rec.critical_level !== undefined && rec.critical_level !== null && rec.critical_level !== '' ? parseFloat(rec.critical_level) : null;

  const allowedUnits = ['cm', 'm', 'ft', '%'];
  const unit = allowedUnits.includes(String(rec.unit || 'cm').trim()) ? String(rec.unit || 'cm').trim() : 'cm';

  return {
    station_name: stationName.slice(0, 120),
    reading_time: parsedDt.toISOString(),
    water_level: Number(waterLevel.toFixed(2)),
    normal_level: Number(normalLevel.toFixed(2)),
    unit,
    warning_level: Number.isFinite(warnParsed) ? Number(warnParsed.toFixed(2)) : null,
    critical_level: Number.isFinite(critParsed) ? Number(critParsed.toFixed(2)) : null,
    source_context: rec.source_context ? String(rec.source_context).trim().slice(0, 160) : null,
    operator_name: rec.operator_name ? String(rec.operator_name).trim().slice(0, 100) : null,
    remarks: rec.remarks ? String(rec.remarks).trim().slice(0, 500) : null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables.' });
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
    headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
  }

  const configuredPasskey = process.env.ADMIN_PASSKEY;
  if (!configuredPasskey) {
    return res.status(500).json({ error: 'Server authentication configuration missing (ADMIN_PASSKEY).' });
  }

  const providedPasskey = req.headers['x-admin-passkey'] || req.body?.admin_passkey;

  if (!providedPasskey || typeof providedPasskey !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing administrator passkey.' });
  }

  const provBuf = Buffer.from(String(providedPasskey));
  const confBuf = Buffer.from(String(configuredPasskey));
  const isAuthorized = provBuf.length === confBuf.length && crypto.timingSafeEqual(provBuf, confBuf);

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing administrator passkey.' });
  }

  const { type: bodyType, action, id, recorded_date, readings, readings_map, name, group, col, stations } = req.body || {};
  const requestType = bodyType || req.query?.type;

  try {
    // ── 0. BOOSTER / RESERVOIR WATER LEVEL OPERATIONS ──
    if (requestType === 'water_level') {
      // A. Save station thresholds & operational milestones config
      if (action === 'save_config') {
        const incoming = req.body.config || {};
        const rawStations = Array.isArray(incoming.stations) && incoming.stations.length > 0
          ? incoming.stations
          : DEFAULT_WATER_LEVEL_CONFIG.stations;

        const allowedUnits = ['m', 'ft', 'cm', '%'];
        const cleanStations = rawStations
          .filter(s => s && String(s.name || '').trim() && String(s.name).trim() !== WATER_LEVEL_CONFIG_STATION)
          .map(s => {
            const norm = parseFloat(s.normal_level);
            const warn = parseFloat(s.warning_level);
            const crit = parseFloat(s.critical_level);
            const pCol = parseInt(s.pressure_col, 10);
            const unit = allowedUnits.includes(String(s.unit || 'cm').trim()) ? String(s.unit || 'cm').trim() : 'cm';
            return {
              name: String(s.name).trim().slice(0, 120),
              river_name: s.river_name ? String(s.river_name).trim().slice(0, 80) : '',
              measuring_point: s.measuring_point ? String(s.measuring_point).trim().slice(0, 120) : '',
              unit,
              normal_level: Number.isFinite(norm) && norm > 0 ? Number(norm.toFixed(2)) : 195,
              warning_level: Number.isFinite(warn) && warn >= 0 ? Number(warn.toFixed(2)) : Math.max(0, Number(((Number.isFinite(norm) ? norm : 195) - 50).toFixed(2))),
              critical_level: Number.isFinite(crit) && crit >= 0 ? Number(crit.toFixed(2)) : Math.max(0, Number(((Number.isFinite(norm) ? norm : 195) - 80).toFixed(2))),
              pressure_col: Number.isFinite(pCol) && pCol >= 2 ? pCol : 2
            };
          });

        if (cleanStations.length === 0) {
          return res.status(400).json({ error: 'At least one valid station configuration is required.' });
        }

        const cleanMilestones = Array.isArray(incoming.milestones)
          ? incoming.milestones
              .filter(m => m && String(m.label || '').trim())
              .slice(0, 12)
              .map(m => ({
                label: String(m.label).trim().slice(0, 100),
                date: m.date ? String(m.date).trim().slice(0, 30) : '',
                color: /^#[0-9a-fA-F]{6}$/.test(String(m.color || '')) ? String(m.color) : '#0D9488'
              }))
          : DEFAULT_WATER_LEVEL_CONFIG.milestones;

        const cleanConfig = {
          default_station: cleanStations.some(s => s.name === incoming.default_station)
            ? incoming.default_station
            : cleanStations[0].name,
          stations: cleanStations,
          milestones: cleanMilestones
        };

        const cfgRow = {
          station_name: WATER_LEVEL_CONFIG_STATION,
          reading_time: '1970-01-01T00:00:00.000Z',
          water_level: 0,
          normal_level: 0,
          unit: 'cfg',
          remarks: JSON.stringify(cleanConfig)
        };

        const upsertRes = await fetch(
          `${SUPABASE_URL}/rest/v1/water_level_readings?on_conflict=station_name,reading_time`,
          {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify([cfgRow])
          }
        );
        if (!upsertRes.ok) throw new Error(await upsertRes.text());
        return res.status(200).json({ success: true, message: 'Water level configuration saved.', config: cleanConfig });
      }

      // B. Delete a single water level reading by ID
      if (action === 'delete') {
        const targetId = parseInt(id, 10);
        if (!Number.isFinite(targetId) || targetId <= 0) {
          return res.status(400).json({ error: 'Valid numeric record id is required for deletion.' });
        }
        const delRes = await fetch(
          `${SUPABASE_URL}/rest/v1/water_level_readings?id=eq.${targetId}&station_name=neq.${encodeURIComponent(WATER_LEVEL_CONFIG_STATION)}`,
          { method: 'DELETE', headers }
        );
        if (!delRes.ok) throw new Error(await delRes.text());
        return res.status(200).json({ success: true, message: 'Water level reading deleted.' });
      }

      // C. Bulk save / upsert (from Group Chat or Excel/CSV import)
      if (action === 'bulk_save') {
        const rawRecords = Array.isArray(req.body.records) ? req.body.records : [];
        if (rawRecords.length === 0) {
          return res.status(400).json({ error: 'records array must contain at least one valid reading.' });
        }

        // Deduplicate by (station_name, reading_time) so PostgreSQL upsert never collides within one batch
        const dedupMap = new Map();
        const rejected = [];
        rawRecords.forEach((r, idx) => {
          const clean = sanitizeWaterLevelRecord(r);
          if (clean) {
            dedupMap.set(`${clean.station_name}__${clean.reading_time}`, clean);
          } else {
            rejected.push(idx + 1);
          }
        });

        const validRows = Array.from(dedupMap.values());
        if (validRows.length === 0) {
          return res.status(400).json({ error: 'No valid water level records found in payload.' });
        }

        let savedCount = 0;
        const CHUNK_SIZE = 200;
        for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
          const chunk = validRows.slice(i, i + CHUNK_SIZE);
          const upRes = await fetch(
            `${SUPABASE_URL}/rest/v1/water_level_readings?on_conflict=station_name,reading_time`,
            {
              method: 'POST',
              headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
              body: JSON.stringify(chunk)
            }
          );
          if (!upRes.ok) throw new Error(await upRes.text());
          const savedChunk = await upRes.json();
          savedCount += Array.isArray(savedChunk) ? savedChunk.length : chunk.length;
        }

        return res.status(200).json({
          success: true,
          count: savedCount,
          rejectedCount: rejected.length,
          message: `Successfully saved ${savedCount} water level reading${savedCount === 1 ? '' : 's'}.`
        });
      }

      // D. Save / Update single water level reading
      if (action === 'save' || action === 'update') {
        const clean = sanitizeWaterLevelRecord(req.body.record || req.body);
        if (!clean) {
          return res.status(400).json({ error: 'Invalid water level payload. Required: reading_time, water_level, normal_level.' });
        }

        let saveRes;
        const numericId = parseInt(id || req.body.record?.id, 10);
        if (action === 'update' && Number.isFinite(numericId) && numericId > 0) {
          saveRes = await fetch(
            `${SUPABASE_URL}/rest/v1/water_level_readings?id=eq.${numericId}&station_name=neq.${encodeURIComponent(WATER_LEVEL_CONFIG_STATION)}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify(clean)
            }
          );
        } else {
          saveRes = await fetch(
            `${SUPABASE_URL}/rest/v1/water_level_readings?on_conflict=station_name,reading_time`,
            {
              method: 'POST',
              headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
              body: JSON.stringify([clean])
            }
          );
        }

        if (!saveRes.ok) throw new Error(await saveRes.text());
        const savedData = await saveRes.json();
        return res.status(200).json({
          success: true,
          message: action === 'update' ? 'Water level reading updated.' : 'Water level reading saved.',
          data: Array.isArray(savedData) ? savedData[0] : savedData
        });
      }

      return res.status(400).json({ error: 'Invalid water_level action. Supported: save, update, bulk_save, delete, save_config' });
    }
    // ── 1. ADD / DELETE / SYNC MONITORED RIVER STATIONS ──
    if (action === 'add_station' || action === 'delete_station' || action === 'sync_stations') {
      let currentCustom = [];
      let tableExists = false;

      try {
        const checkTable = await fetch(`${SUPABASE_URL}/rest/v1/river_stations?select=*&order=col.asc`, { headers });
        if (checkTable.ok) {
          tableExists = true;
          const rows = await checkTable.json();
          currentCustom = rows.filter(r => r.col > 20).map(r => ({
            name: r.name,
            col: Number(r.col),
            group: r.group_name || r.group || "Satellite Other"
          }));
        }
      } catch (e) {
        tableExists = false;
      }

      if (!tableExists) {
        const configRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?recorded_date=eq.1970-01-01&select=id,readings`, { headers });
        if (configRes.ok) {
          const rows = await configRes.json();
          if (rows.length > 0 && Array.isArray(rows[0].readings) && rows[0].readings[0] === '__RIVER_STATIONS_CONFIG__') {
            try {
              const parsed = typeof rows[0].readings[1] === 'string' ? JSON.parse(rows[0].readings[1]) : rows[0].readings[1];
              if (Array.isArray(parsed)) currentCustom = parsed;
            } catch (e) {}
          }
        }
      }

      let newStation = null;
      if (action === 'add_station') {
        if (!name || !name.trim()) {
          return res.status(400).json({ error: 'River name is required.' });
        }
        const trimmedName = name.trim();
        const stationGroup = (group && group.trim()) || 'Satellite Other';
        const allCols = [...DEFAULT_RIVER_STATIONS.map(s => s.col), ...currentCustom.map(s => s.col)];
        const nextCol = Math.max(20, ...allCols) + 1;

        newStation = {
          name: trimmedName,
          col: nextCol,
          group: stationGroup,
          isCustom: true
        };
        currentCustom.push(newStation);
      } else if (action === 'delete_station') {
        const targetCol = Number(col);
        if (isNaN(targetCol) || targetCol <= 20) {
          return res.status(400).json({ error: 'Valid custom river col index (> 20) is required for deletion.' });
        }
        currentCustom = currentCustom.filter(s => Number(s.col) !== targetCol);
      } else if (action === 'sync_stations') {
        if (Array.isArray(stations)) {
          currentCustom = stations.filter(s => Number(s.col) > 20);
        }
      }

      // Persist to table if exists
      if (tableExists) {
        if (action === 'add_station' && newStation) {
          await fetch(`${SUPABASE_URL}/rest/v1/river_stations`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              col: newStation.col,
              name: newStation.name,
              group_name: newStation.group
            })
          });
        } else if (action === 'delete_station') {
          await fetch(`${SUPABASE_URL}/rest/v1/river_stations?col=eq.${Number(col)}`, {
            method: 'DELETE',
            headers
          });
        }
      }

      // Always update config row in river_flow
      const checkConfig = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?recorded_date=eq.1970-01-01&select=id`, { headers });
      const existingConfig = checkConfig.ok ? await checkConfig.json() : [];

      const configPayload = {
        recorded_date: '1970-01-01',
        readings: ['__RIVER_STATIONS_CONFIG__', JSON.stringify(currentCustom)]
      };

      if (existingConfig.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/river_flow?id=eq.${existingConfig[0].id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(configPayload)
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/river_flow`, {
          method: 'POST',
          headers,
          body: JSON.stringify(configPayload)
        });
      }

      const fullStationList = [
        ...DEFAULT_RIVER_STATIONS.map(s => ({ ...s, isCustom: false })),
        ...currentCustom.map(s => ({ ...s, isCustom: true }))
      ].sort((a, b) => a.col - b.col);

      return res.status(200).json({
        success: true,
        message: action === 'add_station' ? `Added "${newStation.name}" to monitored rivers list.` : 'Monitored rivers updated successfully.',
        newStation,
        stations: fullStationList
      });
    }

    // ── 2. DELETE WEEKLY MEASUREMENT RECORD ──
    if (action === 'delete') {
      const targetId = id || req.body.recorded_date;
      if (!targetId) return res.status(400).json({ error: 'id or recorded_date is required for deletion.' });

      let delRes;
      if (id) {
        delRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?id=eq.${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers
        });
      } else {
        delRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?recorded_date=eq.${encodeURIComponent(targetId)}`, {
          method: 'DELETE',
          headers
        });
      }

      if (!delRes.ok) throw new Error(await delRes.text());
      return res.status(200).json({ success: true, message: 'River flow record deleted successfully.' });
    }

    // ── 3. SAVE / UPSERT WEEKLY MEASUREMENT RECORD ──
    if (action === 'save' || recorded_date) {
      if (!recorded_date) {
        return res.status(400).json({ error: 'recorded_date is required (YYYY-MM-DD).' });
      }

      const colIndices = readings_map && typeof readings_map === 'object'
        ? Object.keys(readings_map).map(Number).filter(n => !isNaN(n))
        : [];
      const maxCol = Math.max(20, ...colIndices);

      let finalReadings = Array.isArray(readings) && readings.length >= maxCol + 1 ? [...readings] : null;

      if (!finalReadings) {
        finalReadings = new Array(maxCol + 1).fill(null);
        finalReadings[0] = "Discharge (m3/day)";

        const [y, m, d] = recorded_date.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        finalReadings[1] = `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;

        if (readings_map && typeof readings_map === 'object') {
          for (let col = 2; col <= maxCol; col++) {
            const rawVal = readings_map[col];
            if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
              const numVal = parseFloat(String(rawVal).replace(/,/g, ''));
              finalReadings[col] = isNaN(numVal) ? null : numVal;
            } else {
              finalReadings[col] = null;
            }
          }
        }
      }

      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?recorded_date=eq.${encodeURIComponent(recorded_date)}&select=id`, {
        headers
      });
      const existing = checkRes.ok ? await checkRes.json() : [];

      let saveRes;
      if (existing.length > 0) {
        const existingId = existing[0].id;
        saveRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?id=eq.${existingId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            recorded_date,
            readings: finalReadings
          })
        });
      } else {
        saveRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            recorded_date,
            readings: finalReadings
          })
        });
      }

      if (!saveRes.ok) throw new Error(await saveRes.text());
      const data = await saveRes.json();
      return res.status(200).json({
        success: true,
        message: existing.length > 0 ? 'River flow readings updated!' : 'River flow readings saved!',
        data: data[0]
      });
    }

    return res.status(400).json({ error: 'Invalid action. Supported: save, delete, add_station, delete_station' });
  } catch (err) {
    console.error('saveRiverFlow error:', err);
    return res.status(500).json({ error: err.message });
  }
}
