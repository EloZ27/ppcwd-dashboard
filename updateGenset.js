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
    genset_id,
    new_station,
    new_status,
    event_type,      // 'Transfer', 'PMS', 'Emergency Repair', 'Status Change'
    remarks,
    technician,
    serviced_date
  } = req.body;

  if (!genset_id || !event_type) {
    return res.status(400).json({ error: 'genset_id and event_type are required.' });
  }

  try {
    // 1. Fetch current record
    const { data: current, error: fetchErr } = await supabase
      .from('gensets')
      .select('*')
      .eq('id', genset_id)
      .single();

    if (fetchErr || !current) throw new Error('Genset record not found.');

    const originStation = current.current_station;
    const destStation = new_station || current.current_station;
    const statusToSet = new_status || current.status;

    // 2. Update master genset record
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

    // 3. Insert into audit trail
    const { error: logErr } = await supabase
      .from('genset_logs')
      .insert([{
        genset_id: genset_id,
        event_type: event_type,
        origin_station: originStation,
        destination_station: destStation,
        remarks: remarks || '',
        technician: technician || 'Operations Staff'
      }]);

    if (logErr) throw logErr;

    return res.status(200).json({ success: true, message: 'Genset updated and action logged.' });
  } catch (err) {
    console.error('Update genset error:', err);
    return res.status(500).json({ error: err.message });
  }
}