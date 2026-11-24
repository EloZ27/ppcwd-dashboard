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

export const DEFAULT_WATER_LEVEL_CONFIG = {
  default_station: "Campo Uno Source (Irawan River)",
  stations: [
    {
      name: "Campo Uno Source (Irawan River)",
      river_name: "Irawan River",
      measuring_point: "Campo Uno Intake Staff Gauge (Normal: 195 cm)",
      unit: "cm",
      normal_level: 195,
      warning_level: 145,   // -50 cm from normal (engineering watch margin)
      critical_level: 115,  // -80 cm from normal (engineering operating limit)
      pressure_col: 8
    },
    {
      name: "Lapu-Lapu Source (Lapu-Lapu River)",
      river_name: "Lapu-Lapu River",
      measuring_point: "Lapu-Lapu Intake Weir Gauge (Normal: 265 cm)",
      unit: "cm",
      normal_level: 265,
      warning_level: 215,   // -50 cm from normal
      critical_level: 185,  // -80 cm from normal
      pressure_col: 8
    },
    {
      name: "Montible Source (Montible River)",
      river_name: "Montible River",
      measuring_point: "Montible Intake Gauge (Provisional Design: 15 cm — undeclared)",
      unit: "cm",
      normal_level: 15,
      warning_level: 10,    // Provisional until formal declaration
      critical_level: 5,    // Provisional until formal declaration
      pressure_col: 19
    }
  ],
  milestones: [
    {
      label: "Montible Source Activated",
      date: "",
      color: "#0D9488"
    }
  ]
};

export const WATER_LEVEL_CONFIG_STATION = "__WATER_LEVEL_CONFIG__";
export const RATIONING_CONFIG_STATION = "__RATIONING_SCHEDULE_CONFIG__";

export const DEFAULT_RATIONING_CONFIG = {
  isRationingConfig: true,
  updatedAt: "2026-11-24T00:00:00.000Z",
  systems: {
    binduyan: {
      status: "active",
      basis: "Social Media",
      sourceMix: "SW Only",
      driver: "Low surface source level · No GW backup",
      effectiveDate: "In Effect",
      zones: [
        {
          name: "North Binduyan",
          area: "Toward Roxas, Palawan",
          mode: "scheduled",
          start: "06:00",
          end: "12:00",
          label: "6:00 AM – 12:00 PM"
        },
        {
          name: "South Binduyan",
          area: "Toward Puerto Princesa City",
          mode: "scheduled",
          start: "13:00",
          end: "06:00",
          label: "1:00 PM – 6:00 AM"
        }
      ]
    },
    maoyon: {
      status: "active",
      basis: "Social Media",
      sourceMix: "SW + GW",
      driver: "Maoyon River turbidity & upper line repair",
      effectiveDate: "In Effect",
      zones: [
        {
          name: "Brgy. Maoyon",
          area: "Main Service Area",
          mode: "continuous",
          start: "00:00",
          end: "24:00",
          label: "24h Continuous"
        },
        {
          name: "Brgy. Maruyogon",
          area: "Main Gate Valve closes 10:00 AM",
          mode: "scheduled",
          start: "06:00",
          end: "10:00",
          label: "6:00 AM – 10:00 AM"
        },
        {
          name: "Brgy. Lucbuan — Puroks",
          area: "Human, Mandaragat, Teresa, Katumbal",
          mode: "scheduled",
          start: "11:00",
          end: "15:00",
          label: "11:00 AM – 3:00 PM"
        },
        {
          name: "Brgy. Lucbuan — Hall Area",
          area: "Subject to gravity source turbidity",
          mode: "conditional",
          start: "16:00",
          end: "21:00",
          label: "4:00 PM – 9:00 PM"
        }
      ]
    },
    stalucia: {
      status: "none",
      basis: "Monitoring",
      sourceMix: "SW Only",
      driver: "No Water Rationing",
      effectiveDate: "",
      zones: []
    },
    sabang: {
      status: "none",
      basis: "Monitoring",
      sourceMix: "SW + GW",
      driver: "No Water Rationing",
      effectiveDate: "",
      zones: []
    },
    bacungan: {
      status: "none",
      basis: "Monitoring",
      sourceMix: "SW Only",
      driver: "No Water Rationing",
      effectiveDate: "",
      zones: []
    },
    bahile: {
      status: "none",
      basis: "Monitoring",
      sourceMix: "SW + GW",
      driver: "No Water Rationing",
      effectiveDate: "",
      zones: []
    },
    sanrafael: {
      status: "none",
      basis: "Monitoring",
      sourceMix: "SW Only",
      driver: "No Water Rationing",
      effectiveDate: "",
      zones: []
    },
    napsan: {
      status: "none",
      basis: "Monitoring",
      sourceMix: "SW Only",
      driver: "No Water Rationing",
      effectiveDate: "",
      zones: []
    },
    inagawan: {
      status: "none",
      basis: "Monitoring",
      sourceMix: "GW Only",
      driver: "No Water Rationing",
      effectiveDate: "",
      zones: []
    },
    city_total: {
      status: "none",
      basis: "Monitoring",
      sourceMix: "SW + GW Grid",
      driver: "No Water Rationing",
      effectiveDate: "",
      zones: []
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  const { type } = req.query;

  // ── 00. APPROVED WATER RATIONING SCHEDULE CONFIG ──
  if (type === 'rationing_schedule') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(200).json(DEFAULT_RATIONING_CONFIG);
    }

    const headers = { 'apikey': SUPABASE_KEY, 'Accept': 'application/json' };
    if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }

    try {
      const cfgUrl = `${SUPABASE_URL}/rest/v1/water_level_readings?station_name=eq.${encodeURIComponent(RATIONING_CONFIG_STATION)}&select=id,remarks&limit=1`;
      const cfgRes = await fetch(cfgUrl, { headers });
      if (cfgRes.ok) {
        const cfgRows = await cfgRes.json();
        if (Array.isArray(cfgRows) && cfgRows.length > 0 && cfgRows[0].remarks) {
          const parsed = JSON.parse(cfgRows[0].remarks);
          if (parsed && parsed.isRationingConfig === true && parsed.systems && typeof parsed.systems === 'object') {
            return res.status(200).json({
              isRationingConfig: true,
              updatedAt: parsed.updatedAt || DEFAULT_RATIONING_CONFIG.updatedAt,
              systems: { ...DEFAULT_RATIONING_CONFIG.systems, ...parsed.systems }
            });
          }
        }
      }
    } catch (e) {
      console.warn('getRationingSchedule fallback:', e.message);
    }
    return res.status(200).json(DEFAULT_RATIONING_CONFIG);
  }

  // ── 0. BOOSTER / RESERVOIR WATER LEVEL CONFIG & READINGS ──
  if (type === 'water_level_config' || type === 'water_level') {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      if (type === 'water_level_config') {
        return res.status(200).json(DEFAULT_WATER_LEVEL_CONFIG);
      }
      return res.status(500).json({ error: 'Missing Supabase environment variables.' });
    }

    const headers = { 'apikey': SUPABASE_KEY, 'Accept': 'application/json' };
    if (SUPABASE_KEY && SUPABASE_KEY.startsWith('ey')) {
      headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
    }

    const fetchWaterLevelConfig = async () => {
      try {
        const cfgUrl = `${SUPABASE_URL}/rest/v1/water_level_readings?station_name=eq.${encodeURIComponent(WATER_LEVEL_CONFIG_STATION)}&select=id,remarks&limit=1`;
        const cfgRes = await fetch(cfgUrl, { headers });
        if (cfgRes.ok) {
          const cfgRows = await cfgRes.json();
          if (Array.isArray(cfgRows) && cfgRows.length > 0 && cfgRows[0].remarks) {
            const parsed = JSON.parse(cfgRows[0].remarks);
            if (parsed && Array.isArray(parsed.stations) && parsed.stations.length > 0) {
              return {
                default_station: parsed.default_station || parsed.stations[0].name || DEFAULT_WATER_LEVEL_CONFIG.default_station,
                stations: parsed.stations,
                milestones: Array.isArray(parsed.milestones) ? parsed.milestones : DEFAULT_WATER_LEVEL_CONFIG.milestones
              };
            }
          }
        }
      } catch (e) {
        console.warn('getWaterLevelConfig fallback:', e.message);
      }
      return DEFAULT_WATER_LEVEL_CONFIG;
    };

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    if (type === 'water_level_config') {
      const config = await fetchWaterLevelConfig();
      return res.status(200).json(config);
    }

    // Fetch water_level_readings
    try {
      const { station, start, end, order, include_config } = req.query;
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 2000, 1), 5000);
      const sortOrder = String(order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

      const cols = 'id,station_name,reading_time,water_level,normal_level,unit,warning_level,critical_level,source_context,operator_name,remarks,created_at';
      let query = `select=${cols}&station_name=neq.${encodeURIComponent(WATER_LEVEL_CONFIG_STATION)}&station_name=neq.${encodeURIComponent(RATIONING_CONFIG_STATION)}`;
      if (station && station !== 'ALL') {
        query += `&station_name=eq.${encodeURIComponent(station)}`;
      }
      if (start) {
        query += `&reading_time=gte.${encodeURIComponent(start)}`;
      }
      if (end) {
        query += `&reading_time=lte.${encodeURIComponent(end)}`;
      }
      query += `&order=reading_time.${sortOrder}&limit=${limit}`;

      const url = `${SUPABASE_URL}/rest/v1/water_level_readings?${query}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `Supabase returned ${response.status}`, details: errText });
      }
      const rows = await response.json();
      const cleanRows = (Array.isArray(rows) ? rows : []).filter(
        r => r.station_name !== WATER_LEVEL_CONFIG_STATION && r.station_name !== RATIONING_CONFIG_STATION
      );

      if (include_config === '1' || include_config === 'true') {
        const config = await fetchWaterLevelConfig();
        return res.status(200).json({ readings: cleanRows, config });
      }
      return res.status(200).json(cleanRows);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch water level readings: ' + error.message });
    }
  }

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
