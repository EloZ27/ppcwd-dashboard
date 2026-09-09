export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Missing Supabase environment variables.' });
  }

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  const {
    action,
    genset_id,
    genset_no,
    brand_model,
    capacity_kva,
    fuel_capacity_liters,
    new_station,
    new_status,
    event_type,
    remarks,
    technician,
    serviced_date
  } = req.body;

  try {
    // 1. Register new genset unit
    if (action === 'create_genset') {
      if (!genset_no || !new_station) {
        return res.status(400).json({ error: 'Genset No and Station are required.' });
      }

      const newUnitPayload = {
        genset_no: String(genset_no).trim().toUpperCase(),
        brand_model: brand_model || null,
        capacity_kva: capacity_kva ? parseFloat(capacity_kva) : null,
        fuel_capacity_liters: fuel_capacity_liters ? parseFloat(fuel_capacity_liters) : null,
        current_station: new_station,
        status: new_status || 'Operational',
        last_serviced_date: serviced_date || new Date().toISOString().split('T')[0]
      };

      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/gensets`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newUnitPayload)
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        throw new Error(`Failed to create genset: ${errText}`);
      }

      const createdRows = await createRes.json();
      const createdUnit = createdRows[0];

      // Add commissioning log
      if (createdUnit && createdUnit.id) {
        await fetch(`${SUPABASE_URL}/rest/v1/genset_logs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            genset_id: createdUnit.id,
            event_type: 'Commissioned / Deployed',
            origin_station: 'Central Storage',
            destination_station: new_station,
            remarks: remarks || 'Initial unit registration into fleet.',
            technician: technician || 'EMD Staff'
          })
        });
      }

      return res.status(200).json({ success: true, message: `Genset ${genset_no} successfully registered!` });
    }

    // 2. Update existing genset & log repair / transfer
    if (!genset_id || !event_type) {
      return res.status(400).json({ error: 'genset_id and event_type are required.' });
    }

    // Read current unit to identify origin station
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/gensets?id=eq.${genset_id}&select=*`, { headers });
    const rows = await getRes.json();
    const current = rows[0];

    if (!current) throw new Error('Genset record not found.');

    const originStation = current.current_station;
    const destStation = new_station || current.current_station;
    const statusToSet = new_status || current.status;

    const patchPayload = {
      current_station: destStation,
      status: statusToSet
    };
    if (serviced_date) patchPayload.last_serviced_date = serviced_date;

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/gensets?id=eq.${genset_id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patchPayload)
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      throw new Error(`Update failed: ${errText}`);
    }

    // Record movement/repair entry in audit trail
    await fetch(`${SUPABASE_URL}/rest/v1/genset_logs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        genset_id: genset_id,
        event_type: event_type,
        origin_station: originStation,
        destination_station: destStation,
        remarks: remarks || '',
        technician: technician || 'EMD Staff'
      })
    });

    return res.status(200).json({ success: true, message: 'Genset updated and action logged.' });
  } catch (err) {
    console.error('updateGenset error:', err);
    return res.status(500).json({ error: err.message });
  }
}