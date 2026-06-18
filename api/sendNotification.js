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

  return res.status(200).json({ success: true, message: 'Sent' });
};
