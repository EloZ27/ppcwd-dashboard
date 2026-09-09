import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    action, // 'update_log' or 'create_genset'
    genset_id,
    genset_no,
    brand_model,
    capacity_kva,
    fuel_capacity_liters,
    new_station,
    new_status,
    event_type, // 'Transfer', 'PMS', 'Emergency Repair', 'Battery Replacement', etc.
    remarks,
    technician,
    serviced_date
  } = req.body;

  try {
    // 1. Register a Brand New Genset
    if (action === 'create_genset') {
      if (!genset_no || !new_station) {
        return res.status(400).json({ error: 'Genset No and Station are required.' });
      }

      const { data: newGenset, error: insertErr } = await supabase
        .from('gensets')
        .insert([{
          genset_no: genset_no.trim().toUpperCase(),
          brand_model: brand_model || null,
          capacity_kva: capacity_kva ? parseFloat(capacity_kva) : null,
          fuel_capacity_liters: fuel_capacity_liters ? parseFloat(fuel_capacity_liters) : null,
          current_station: new_station,
          status: new_status || 'Operational',
          last_serviced_date: serviced_date || new Date().toISOString().split('T')[0]
        }])
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Log initial commissioning
      await supabase.from('genset_logs').insert([{
        genset_id: newGenset.id,
        event_type: 'Commissioned / Deployed',
        origin_station: 'Warehouse / Central Storage',
        destination_station: new_station,
        remarks: remarks || 'Initial unit registration into fleet.',
        technician: technician || 'Electro-Mechanical Division'
      }]);

      return res.status(200).json({ success: true, message: `Genset ${genset_no} created successfully.` });
    }

    // 2. Update Existing Genset & Log Movement / Maintenance
    if (!genset_id || !event_type) {
      return res.status(400).json({ error: 'genset_id and event_type are required.' });
    }

    const { data: current, error: fetchErr } = await supabase
      .from('gensets')
      .select('*')
      .eq('id', genset_id)
      .single();

    if (fetchErr || !current) throw new Error('Genset record not found.');

    const originStation = current.current_station;
    const destStation = new_station || current.current_station;
    const statusToSet = new_status || current.status;

    const updatePayload = {
      current_station: destStation,
      status: statusToSet
    };
    if (serviced_date) updatePayload.last_serviced_date = serviced_date;

    const { error: updateErr } = await supabase
      .from('gensets')
      .update(updatePayload)
      .eq('id', genset_id);

    if (updateErr) throw updateErr;

    const { error: logErr } = await supabase
      .from('genset_logs')
      .insert([{
        genset_id: genset_id,
        event_type: event_type,
        origin_station: originStation,
        destination_station: destStation,
        remarks: remarks || '',
        technician: technician || 'Electro-Mechanical Division'
      }]);

    if (logErr) throw logErr;

    return res.status(200).json({ success: true, message: 'Genset updated and audit trail logged.' });
  } catch (err) {
    console.error('Update genset error:', err);
    return res.status(500).json({ error: err.message });
  }
}