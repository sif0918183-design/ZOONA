/**
 * Vercel API: /api/feedback
 * يقوم بإدارة الشكاوى والمقترحات عبر JSONBIN مع إخفاء المفاتيح.
 */

export default async function handler(req, res) {
  // 1. التحقق من النطاق
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'zoonasd.com',
    'https://zoona-git-secure-supabase-keys-77307646-147e2c-sifians-projects.vercel.app',
    'https://zoona-git-indicate-out-of-stock-markete-081854-sifians-projects.vercel.app',
    'https://zoona-git-fix-affiliate-registration-er-d6e282-sifians-projects.vercel.app',
    'https://zoona-git-unique-affiliate-id-generatio-561ea2-sifians-projects.vercel.app',
    'https://zoona-git-tier-commission-and-ui-improv-d14974-sifians-projects.vercel.app'
  ];
  const isAllowed = allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed + "/"));
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. جلب متغيرات البيئة
  const JSONBIN_BIN_ID = process.env.JSONBIN_BIN_ID;
  const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY;

  if (!JSONBIN_BIN_ID || !JSONBIN_API_KEY) {
    console.error('JSONBIN credentials missing.');
    return res.status(500).json({ 
      error: 'Server configuration error',
      details: 'Please set JSONBIN_BIN_ID and JSONBIN_API_KEY environment variables in Vercel project settings.'
    });
  }

  // 3. إعداد رؤوس CORS للنطاقات المسموحة فقط
  const allowedOriginsList = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'zoonasd.com',
    'https://zoona-git-secure-supabase-keys-77307646-147e2c-sifians-projects.vercel.app',
    'https://zoona-git-indicate-out-of-stock-markete-081854-sifians-projects.vercel.app',
    'https://zoona-git-fix-affiliate-registration-er-d6e282-sifians-projects.vercel.app',
    'https://zoona-git-unique-affiliate-id-generatio-561ea2-sifians-projects.vercel.app',
    'https://zoona-git-tier-commission-and-ui-improv-d14974-sifians-projects.vercel.app'
  ];
  const currentOrigin = req.headers.origin;
  
  if (currentOrigin && allowedOriginsList.includes(currentOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  } else if (!currentOrigin) {
    res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
  } else {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // التعامل مع طلب OPTIONS (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_URL = 'https://api.jsonbin.io/v3/b';

  try {
    if (req.method === 'GET') {
      // جلب التقييمات والشكاوى
      const fetchUrl = `${API_URL}/${JSONBIN_BIN_ID}/latest`;
      
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'X-Master-Key': JSONBIN_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`JSONBIN error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return res.status(200).json(data.record || { ratings: [], complaints: [] });

    } else if (req.method === 'POST') {
      // إضافة تقييم أو شكوى
      const { type, data: newData } = req.body;
      
      // جلب البيانات الحالية
      const getResponse = await fetch(`${API_URL}/${JSONBIN_BIN_ID}/latest`, {
        method: 'GET',
        headers: {
          'X-Master-Key': JSONBIN_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      let currentData = { ratings: [], complaints: [] };
      
      if (getResponse.ok) {
        const existingData = await getResponse.json();
        currentData = existingData.record || { ratings: [], complaints: [] };
      }

      // إضافة البيانات الجديدة
      if (type === 'rating') {
        currentData.ratings = currentData.ratings || [];
        currentData.ratings.push(newData);
      } else if (type === 'complaint') {
        currentData.complaints = currentData.complaints || [];
        currentData.complaints.push(newData);
      }

      // حفظ البيانات المحدثة
      const updateResponse = await fetch(`${API_URL}/${JSONBIN_BIN_ID}`, {
        method: 'PUT',
        headers: {
          'X-Master-Key': JSONBIN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentData)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`JSONBIN update error: ${updateResponse.status} - ${errorText}`);
      }

      const result = await updateResponse.json();
      return res.status(200).json({ success: true, data: result });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

  } catch (error) {
    console.error('[Feedback API] Error:', error.message);
    return res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}
