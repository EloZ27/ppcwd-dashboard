// api/checkPressure.js
export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  };

  try {
    // 1. Get the latest reading time
    const latestTimeUrl = `${SUPABASE_URL}/rest/v1/pressure_readings?select=reading_time&order=reading_time.desc&limit=1`;
    const timeResponse = await fetch(latestTimeUrl, { headers });

    if (!timeResponse.ok) throw new Error(`Supabase (time) returned ${timeResponse.status}`);
    const timeData = await timeResponse.json();

    if (!timeData || timeData.length === 0 || !timeData[0].reading_time) {
      // No data in the table at all, return null which the client can handle.
      return res.status(200).json(null);
    }

    const latestTime = timeData[0].reading_time;

    // 2. Get the count of readings at that exact time to detect new data for the same timestamp
    const countUrl = `${SUPABASE_URL}/rest/v1/pressure_readings?reading_time=eq.${latestTime}&select=count`;
    const countResponse = await fetch(countUrl, {
      headers: { ...headers, 'Prefer': 'count=exact' }
    });

    if (!countResponse.ok) throw new Error(`Supabase (count) returned ${countResponse.status}`);
    
    // The count is in the 'Content-Range' header, e.g., "0-4/5" -> 5
    const contentRange = countResponse.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1], 10) : 0;
    
    // Disable caching on this specific API so it always checks the live database
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    // Return a more informative object that includes the latest time and the count of records at that time.
    res.status(200).json({
      reading_time: latestTime,
      count: count
    });

  } catch (error) {
    // Provide a more descriptive error message
    res.status(500).json({ error: "Failed to ping Supabase: " + error.message });
  }
}