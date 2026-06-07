/**
 * Vercel API: /api/admin-products
 * يقوم بالعمليات على المنتجات (CRUD) في Supabase مع إخفاء المفاتيح عن المتصفح.
 */

// التحقق من النطاق المسموح
const ALLOWED_ORIGINS = [
  'https://zoonasd.com',
  'https://www.zoonasd.com',
  'https://zoona-git-fix-affiliate-marketing-syste-10e4dc-sifians-projects.vercel.app'
];

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

export default async function handler(req, res) {
  // 1. التحقق من النطاق
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'http://localhost:3000', 'http://localhost:5000', 'http://127.0.0.1:3000', 'http://127.0.0.1:5000',
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-fix-affiliate-marketing-syste-10e4dc-sifians-projects.vercel.app'
  ];
  const isAllowed = origin.endsWith('.vercel.app') || allowedOrigins.some(allowed => origin.startsWith(allowed)) || !origin;
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. التحقق من طريقة الطلب
  const allowedMethods = ['GET', 'POST', 'PATCH', 'DELETE'];
  if (!allowedMethods.includes(req.method)) {
    res.setHeader('Allow', allowedMethods);
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

  // 3. إعداد رؤوس CORS للنطاقات المسموحة فقط
  const allowedOriginsList = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-fix-affiliate-marketing-syste-10e4dc-sifians-projects.vercel.app'
  ];
  const currentOrigin = req.headers.origin;
  
  if (currentOrigin && allowedOriginsList.some(allowed => currentOrigin.startsWith(allowed))) {
    res.setHeader('Access-Control-Allow-Origin', currentOrigin);
  } else if (!currentOrigin) {
    // للطلبات من المتصفح مباشرة
    res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
  } else {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // التعامل مع طلب OPTIONS (Preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    // Debug: log incoming request
    console.log(`[Admin-Products] ${req.method} - id: ${id}, body:`, req.body);

    // 4. بناء الطلب حسب الطريقة
    if (req.method === 'GET') {
      if (id) {
        // جلب منتج واحد محدد
        fetchUrl = `${baseUrl}?id=eq.${id}&select=*`;
      } else {
        // جلب جميع المنتجات
        fetchUrl = `${baseUrl}?select=*&order=id.desc`;
      }
    } 
    else if (req.method === 'POST') {
      // إضافة منتج جديد
      fetchUrl = baseUrl;
      // Handle both string and object body
      let bodyData = req.body;
      if (typeof req.body === 'string') {
        try {
          bodyData = JSON.parse(req.body);
        } catch (e) {
          bodyData = req.body;
        }
      }
      let cleanBody = { ...bodyData }; delete cleanBody.adminPassword; fetchOptions.body = JSON.stringify(cleanBody);
    } 
    else if (req.method === 'PATCH') {
      // تحديث منتج موجود
      if (!id) {
        return res.status(400).json({ error: 'Product ID is required for update' });
      }
      fetchUrl = `${baseUrl}?id=eq.${id}`;
      // Handle both string and object body
      let bodyData = req.body;
      if (typeof req.body === 'string') {
        try {
          bodyData = JSON.parse(req.body);
        } catch (e) {
          bodyData = req.body;
        }
      }
      let cleanBody = { ...bodyData }; delete cleanBody.adminPassword; fetchOptions.body = JSON.stringify({
        ...cleanBody,
        updated_at: new Date().toISOString()
      });
    } 
    else if (req.method === 'DELETE') {
      // حذف منتج
      if (!id) {
        return res.status(400).json({ error: 'Product ID is required for delete' });
      }
      fetchUrl = `${baseUrl}?id=eq.${id}`;
    }

    console.log(`[Admin-Products] ${req.method} request to: ${fetchUrl}`);

    // 5. تنفيذ الطلب على Supabase
    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Admin-Products] Supabase error: ${response.status} - ${errorText}`);
      throw new Error(`Supabase API error: ${response.status}`);
    }

    // 6. إرجاع النتيجة
    let result;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    }

    if (req.method === 'DELETE') {
      return res.status(200).json({ success: true, message: 'Product deleted successfully' });
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      return res.status(200).json({ success: true, data: result });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('[Admin-Products] Error:', error.message);
    return res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}