// Vercel API endpoint for saving FCM tokens
// Uses environment variables for JSONBIN credentials

export default async function handler(req, res) {
  // 1. التحقق من النطاق
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = ['https://zoonasd.com', 'https://www.zoonasd.com',
    'https://zoona-git-feat-local-orders-api-4665680-ca81a9-sifians-projects.vercel.app', 'https://zoona-git-feature-out-of-stock-indicato-6a745f-sifians-projects.vercel.app'];
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed)) || origin.includes('localhost') || (origin.endsWith('.vercel.app') && origin.includes('zoona'));
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. Set CORS headers for allowed origins only
  const allowedOriginsList = ['https://zoonasd.com', 'https://www.zoonasd.com',
    'https://zoona-git-feat-local-orders-api-4665680-ca81a9-sifians-projects.vercel.app', 'https://zoona-git-feature-out-of-stock-indicato-6a745f-sifians-projects.vercel.app'];
  const currentOrigin = req.headers.origin;
  
  if (currentOrigin && allowedOriginsList.includes(currentOrigin) || (currentOrigin && (currentOrigin.includes('localhost') || (currentOrigin.endsWith('.vercel.app') && currentOrigin.includes('zoona'))))) {
    res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  } else if (!currentOrigin) {
    res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
  } else {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // 3. جلب متغيرات البيئة
  const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID_FCM || '69336a3dae596e708f8650a1';
  const JSONBIN_KEY = process.env.JSONBIN_API_KEY_FCM || process.env.JSONBIN_API_KEY;

  if (!JSONBIN_BIN_ID || !JSONBIN_KEY) {
    console.error('Missing JSONBIN credentials');
    return res.status(500).json({ success: false, error: 'Server configuration error' });
  }

  if (req.method === 'POST') {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: "No token provided" });
    }

    try {
      // 1️⃣ جلب البيانات الحالية من JSONBin
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });

      if (!getRes.ok) {
        const errorText = await getRes.text();
        throw new Error(`Failed to GET data from JSONBin. Status: ${getRes.status}. Response: ${errorText}`);
      }

      const json = await getRes.json();
      let tokens = json.tokens || []; 

      // 2️⃣ إضافة الـ token الجديد إذا لم يكن موجودًا
      if (!tokens.includes(token)) tokens.push(token);

      // 3️⃣ تحديث الـ Bin في JSONBin
      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_KEY
        },
        body: JSON.stringify({ tokens })
      });
      
      if (!putRes.ok) {
        const errorText = await putRes.text();
        throw new Error(`Failed to PUT data to JSONBin. Status: ${putRes.status}. Response: ${errorText}`);
      }

      return res.status(200).json({ success: true, tokens });

    } catch (err) {
      console.error('JSONBin API Error:', err.message);
      return res.status(500).json({ success: false, error: "Server error during token update. Check Vercel logs for details." });
    }

  } else {
    res.status(405).end('Method Not Allowed');
  }
}