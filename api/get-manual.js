module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/manual_articles?active=eq.true&order=published_at.desc&limit=20`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY}`
    }
  });

  
  const data = await r.json();
  res.status(200).json(data);
}