const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: 'Missing Supabase credentials in Vercel. Please configure SUPABASE_URL and SUPABASE_ANON_KEY.'
    });
  }

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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Register a brand new unit
    if (action === 'create_genset') {
      if (!genset_no || !new_station) {
        return res.status(400).json({ error: 'Genset No and Station are required.' });
      }

      const { data: newUnit, error: insErr } = await supabase
        .from('gensets')
        .insert([{
          genset_no: String(genset_no).trim().toUpperCase(),
          brand_model: brand_model || null,
          capacity_kva: capacity_kva ? parseFloat(capacity_kva) : null,
          fuel_capacity_liters: fuel_capacity_liters ? parseFloat(fuel_capacity_liters) : null,
          current_station: new_station,
          status: new_status || 'Operational',
          last_serviced_date: serviced_date || new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

      if (insErr) throw insErr;

      // Log commissioning
      await supabase.from('genset_logs').insert([{
        genset_id: newUnit.id,
        event_type: 'Commissioned / Deployed',
        origin_station: 'Central Storage',
        destination_station: new_station,
        remarks: remarks || 'Initial unit registration.',
        technician: technician || 'EMD Staff'
      }]);

      return res.status(200).json({ success: true, message: `Genset ${genset_no} successfully registered!` });
    }

    // Update existing unit
    if (!genset_id || !event_type) {
      return res.status(400).json({ error: 'genset_id and event_type are required.' });
    }

    const { data: current, error: fetchErr } = await supabase
      .from('gensets')
      .select('*')
      .eq('id', genset_id)
      .single();

    if (fetchErr || !current) throw new Error('Genset not found.');

    const originStation = current.current_station;
    const destStation = new_station || current.current_station;
    const statusToSet = new_status || current.status;

    const updateFields = {
      current_station: destStation,
      status: statusToSet
    };
    if (serviced_date) updateFields.last_serviced_date = serviced_date;

    const { error: upErr } = await supabase
      .from('gensets')
      .update(updateFields)
      .eq('id', genset_id);

    if (upErr) throw upErr;

    const { error: logErr } = await supabase
      .from('genset_logs')
      .insert([{
        genset_id: genset_id,
        event_type: event_type,
        origin_station: originStation,
        destination_station: destStation,
        remarks: remarks || '',
        technician: technician || 'EMD Staff'
      }]);

    if (logErr) throw logErr;

    return res.status(200).json({ success: true, message: 'Genset updated and action logged.' });
  } catch (err) {
    console.error('updateGenset error:', err);
    return res.status(500).json({ error: err.message || 'Server error processing update' });
  }
};