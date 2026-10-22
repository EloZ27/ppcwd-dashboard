// api/getRiverFlow.js
export const DEFAULT_RIVER_STATIONS = [
  { name: "Montible Teruvian", col: 2, group: "City / Primary Sources" },
  { name: "Montible Bridge 1", col: 3, group: "City / Primary Sources" },
  { name: "Upper Montible", col: 4, group: "City / Primary Sources" },
  { name: "Lapu Lapu Upstream", col: 5, group: "City / Primary Sources" },
  { name: "Lapu Lapu Downstream", col: 6, group: "City / Primary Sources" },
  { name: "Sta. Lucia", col: 7, group: "Satellite South" },
  { name: "Santiago", col: 8, group: "Satellite South" },
  { name: "Campo Uno", col: 9, group: "City / Primary Sources" },
  { name: "Binuan", col: 10, group: "Satellite South" },
  { name: "Napsan", col: 11, group: "Satellite South" },
  { name: "San Rafael", col: 12, group: "Satellite North" },
  { name: "Binduyan", col: 13, group: "Satellite North" },
  { name: "Bacungan", col: 14, group: "Satellite North" },
  { name: "Langogan Downstream", col: 15, group: "Satellite North" },
  { name: "San Rafael Downstream", col: 16, group: "Satellite North" },
  { name: "Maoyon", col: 17, group: "Satellite North" },
  { name: "Tanabag Downstream", col: 18, group: "Satellite North" },
  { name: "Olangoan Downstream", col: 19, group: "Satellite North" },
  { name: "Maranat II", col: 20, group: "Satellite South" }
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  const { type } = req.query;

  // ── A. GET MONITORED RIVER STATIONS ──
  if (type === 'stations') {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(200).json(DEFAULT_RIVER_STATIONS);
    }

    const headers = { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' };
    if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }

    let customStations = [];
    try {
      // 1. Check dedicated table if present
      const stationsRes = await fetch(`${SUPABASE_URL}/rest/v1/river_stations?select=*&order=col.asc`, { headers });
      if (stationsRes.ok) {
        const dbStations = await stationsRes.json();
        if (Array.isArray(dbStations) && dbStations.length > 0) {
          const hasDefaults = dbStations.some(s => s.col === 2);
          if (hasDefaults) {
            return res.status(200).json(dbStations.map(s => ({
              name: s.name,
              col: Number(s.col),
              group: s.group_name || s.group || "City / Primary Sources",
              isCustom: s.col > 20
            })));
          } else {
            customStations = dbStations.map(s => ({
              name: s.name,
              col: Number(s.col),
              group: s.group_name || s.group || "Satellite Other",
              isCustom: true
            }));
          }
        }
      } else {
        // 2. Check resilient config record in river_flow
        const configRes = await fetch(`${SUPABASE_URL}/rest/v1/river_flow?recorded_date=eq.1970-01-01&select=readings`, { headers });
        if (configRes.ok) {
          const rows = await configRes.json();
          if (rows.length > 0 && Array.isArray(rows[0].readings) && rows[0].readings[0] === '__RIVER_STATIONS_CONFIG__') {
            try {
              const parsed = typeof rows[0].readings[1] === 'string' ? JSON.parse(rows[0].readings[1]) : rows[0].readings[1];
              if (Array.isArray(parsed)) customStations = parsed;
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.warn('getRiverStations error:', err);
    }

    const mergedMap = new Map();
    DEFAULT_RIVER_STATIONS.forEach(s => mergedMap.set(s.col, { ...s, isCustom: false }));
    customStations.forEach(s => {
      const colNum = Number(s.col);
      if (!isNaN(colNum)) {
        mergedMap.set(colNum, {
          name: s.name,
          col: colNum,
          group: s.group || "Satellite Other",
          isCustom: true
        });
      }
    });

    const mergedList = Array.from(mergedMap.values()).sort((a, b) => a.col - b.col);
    return res.status(200).json(mergedList);
  }

  // ── B. GET RIVER FLOW MEASUREMENT RECORDS ──
  const url = `${SUPABASE_URL}/rest/v1/river_flow?recorded_date=neq.1970-01-01&select=*&order=recorded_date.desc`;

  try {
    const headers = { 'apikey': SUPABASE_KEY };
    if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    
    const data = await response.json();
    const cleanData = (Array.isArray(data) ? data : []).filter(r => 
      r.recorded_date !== '1970-01-01' && 
      (!Array.isArray(r.readings) || r.readings[0] !== '__RIVER_STATIONS_CONFIG__')
    );
    res.status(200).json(cleanData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch River Flow data" });
  }
}
