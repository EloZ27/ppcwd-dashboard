// api/saveRiverFlow.js
import crypto from 'crypto';
import { DEFAULT_RIVER_STATIONS } from './getRiverFlow.js';

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

  const { action, id, recorded_date, readings, readings_map, name, group, col, stations } = req.body;

  try {
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
