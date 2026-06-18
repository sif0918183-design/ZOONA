module.exports = async function handler(req, res) {
  const ALLOWED_ORIGINS = ['zoonasd.com', 'zoonaza.vercel.app', 'localhost', '127.0.0.1'];
  const origin = req.headers.origin || req.headers.referer || '';
  const isOriginAllowed = origin && (ALLOWED_ORIGINS.some(allowed => origin.includes(allowed)) || (origin.includes('.vercel.app') && origin.includes('zoona')));

  const resOrigin = req.headers.origin || (origin ? new URL(origin).origin : 'https://zoonasd.com');
  res.setHeader('Access-Control-Allow-Origin', isOriginAllowed ? resOrigin : 'https://zoonasd.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isOriginAllowed) return res.status(403).json({ error: 'Access Denied' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  try {
    const { id } = req.query;
    const baseUrl = `${SUPABASE_URL}/rest/v1/products`;
    let fetchUrl = '';
    let fetchOptions = {
      method: req.method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': req.method === 'POST' ? 'return=representation' : 'return=minimal'
      }
    };

    if (req.method === 'GET') {
      fetchUrl = id ? `${baseUrl}?id=eq.${encodeURIComponent(id)}&select=*` : `${baseUrl}?select=*&order=id.desc`;
    } else if (req.method === 'POST') {
      fetchUrl = baseUrl;
      let bodyData = req.body;
      if (typeof req.body === 'string') try { bodyData = JSON.parse(req.body); } catch (e) {}
      if (bodyData && typeof bodyData === 'object') { delete bodyData.adminPassword; delete bodyData.action; }
      fetchOptions.body = JSON.stringify(bodyData);
    } else if (req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'ID is required' });
      fetchUrl = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
      let bodyData = req.body;
      if (typeof req.body === 'string') try { bodyData = JSON.parse(req.body); } catch (e) {}
      if (bodyData && typeof bodyData === 'object') { delete bodyData.adminPassword; delete bodyData.action; }
      fetchOptions.body = JSON.stringify({ ...bodyData, updated_at: new Date().toISOString() });
    } else if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'ID is required' });
      fetchUrl = `${baseUrl}?id=eq.${encodeURIComponent(id)}`;
    }

    const response = await fetch(fetchUrl, fetchOptions);
    if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
    if (req.method === 'DELETE') return res.status(200).json({ success: true });
    const result = response.status !== 204 ? await response.json() : null;
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to process request' });
  }
};
