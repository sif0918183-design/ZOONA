/**
 * Vercel API: /api/admin-auth
 * للتحقق من كلمة مرور المسؤول عبر Supabase مع إخفاء المفاتيح.
 */

export default async function handler(req, res) {
  // 1. التحقق من النطاق
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-feature-out-of-stock-indicato-6a745f-sifians-projects.vercel.app',
    'https://zoona-git-feat-complete-affiliate-syste-30a731-sifians-projects.vercel.app'
  ];
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. جلب متغيرات البيئة
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 2. جلب متغيرات البيئة
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase credentials missing. SUPABASE_URL:', !!SUPABASE_URL, 'SUPABASE_KEY:', !!SUPABASE_KEY);
    return res.status(500).json({ 
      error: 'Server configuration error',
      details: 'Please set SUPABASE_URL and SUPABASE_KEY environment variables in Vercel project settings.'
    });
  }

  // 3. التحقق من طريقة الطلب (GET فقط)
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 4. إعداد رؤوس CORS للنطاقات المسموحة فقط
  const allowedOriginsList = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-feature-out-of-stock-indicato-6a745f-sifians-projects.vercel.app',
    'https://zoona-git-feat-complete-affiliate-syste-30a731-sifians-projects.vercel.app'
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // التعامل مع طلب OPTIONS (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { password } = req.query;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // 4. التحقق من كلمة المرور من Supabase
    const fetchUrl = `${SUPABASE_URL}/rest/v1/admin_settings?key=eq.admin_password&select=value`;
    
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      // في حالة الخطأ، نرجع فشل للتحقق
      return res.status(200).json({ valid: false, error: 'Database error' });
    }

    const data = await response.json();
    const valid = data.length > 0 && data[0].value === password;

    return res.status(200).json({ valid });

  } catch (error) {
    console.error('[Admin-Auth] Error:', error.message);
    return res.status(200).json({ valid: false, error: error.message });
  }
}