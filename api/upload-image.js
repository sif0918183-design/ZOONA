module.exports = async function handler(req, res) {
  const ALLOWED_ORIGINS = ['zoonasd.com', 'zoonaza.vercel.app', 'localhost', '127.0.0.1'];
  const origin = req.headers.origin || req.headers.referer || '';
  const isOriginAllowed = origin && (ALLOWED_ORIGINS.some(allowed => origin.includes(allowed)) || (origin.includes('.vercel.app') && origin.includes('zoona')));
  
  const resOrigin = req.headers.origin || (origin ? new URL(origin).origin : 'https://zoonasd.com');
  res.setHeader('Access-Control-Allow-Origin', isOriginAllowed ? resOrigin : 'https://zoonasd.com');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!isOriginAllowed) return res.status(403).json({ error: 'Access Denied' });

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Config error' });
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'No boundary' });

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);
    const boundaryBuf = Buffer.from('--' + boundary);
    let start = rawBody.indexOf(boundaryBuf) + boundaryBuf.length;
    const next = rawBody.indexOf(boundaryBuf, start);
    if (next === -1) return res.status(400).json({ error: 'Invalid format' });
    const part = rawBody.slice(start, next - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) return res.status(400).json({ error: 'Invalid headers' });
    const fileData = part.slice(headerEnd + 4);
    const headers = part.slice(0, headerEnd).toString();
    const nameMatch = headers.match(/filename="([^"]+)"/);
    const ext = (nameMatch ? nameMatch[1].slice(nameMatch[1].lastIndexOf('.')) : '.jpg').toLowerCase() || '.jpg';
    const fileName = `product_${Date.now()}${ext}`;
    const mimeType = ext.slice(1) === 'jpg' ? 'jpeg' : ext.slice(1);

    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/products/${fileName}`, {
      method: 'POST',
      headers: { 'Content-Type': `image/${mimeType}`, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'x-upsert': 'true' },
      body: fileData
    });

    if (uploadRes.ok) return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1/object/public/products/${fileName}` });
    if (fileData.length < 500000) return res.status(200).json({ url: `data:image/${mimeType};base64,${fileData.toString('base64')}` });
    return res.status(500).json({ error: 'Upload failed' });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};
