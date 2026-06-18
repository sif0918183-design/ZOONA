module.exports = async function handler(req, res) {
  const ALLOWED_ORIGINS = ['zoonasd.com', 'zoonaza.vercel.app', 'localhost', '127.0.0.1'];
  const origin = req.headers.origin || req.headers.referer || '';
  const isOriginAllowed = origin && (ALLOWED_ORIGINS.some(allowed => origin.includes(allowed)) || (origin.includes('.vercel.app') && origin.includes('zoona')));

  const resOrigin = req.headers.origin || (origin ? new URL(origin).origin : 'https://zoonasd.com');
  res.setHeader('Access-Control-Allow-Origin', isOriginAllowed ? resOrigin : 'https://zoonasd.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isOriginAllowed) return res.status(403).json({ error: 'Access Denied' });

  try {
    const { id } = req.query;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    const url = id ? `${supabaseUrl}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=*` : `${supabaseUrl}/rest/v1/products?select=*&order=id.desc`;

    const response = await fetch(url, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(id ? (data[0] || null) : data);
  } catch (error) {
    return res.status(500).json({ error: 'Database error' });
  }
};
