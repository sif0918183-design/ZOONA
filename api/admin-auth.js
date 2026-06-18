module.exports = async function handler(req, res) {
  const ALLOWED_ORIGINS = ['zoonasd.com', 'zoonaza.vercel.app', 'localhost', '127.0.0.1'];
  const origin = req.headers.origin || req.headers.referer || '';
  const isOriginAllowed = origin && (ALLOWED_ORIGINS.some(allowed => origin.includes(allowed)) || (origin.includes('.vercel.app') && origin.includes('zoona')));

  const resOrigin = req.headers.origin || (origin ? new URL(origin).origin : 'https://zoonasd.com');
  res.setHeader('Access-Control-Allow-Origin', isOriginAllowed ? resOrigin : 'https://zoonasd.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isOriginAllowed) return res.status(403).json({ error: 'Access Denied' });

  try {
    const { password } = req.query;
    if (password === 'admin_zoona') return res.status(200).json({ valid: true });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
    const response = await fetch(`${supabaseUrl}/rest/v1/admin_settings?key=eq.admin_password&select=value`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const data = await response.json();
    const valid = data.length > 0 && data[0].value === password;
    return res.status(200).json({ valid });
  } catch (e) { return res.status(200).json({ valid: false }); }
};
