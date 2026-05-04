/**
 * Vercel API: /api/products
 * يقوم بجلب المنتجات من Supabase وإخفاء المفاتيح عن المتصفح.
 */

// التحقق من النطاق المسموح
export default async function handler(req, res) {
  // 1. التحقق من النطاق
  const origin = req.headers.origin || req.headers.referer || '';
  const allowedOrigins = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-feat-product-modal-enhancemen-94c8c9-sifians-projects.vercel.app'
  ];
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed));
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. التحقق من طريقة الطلب (GET فقط)
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

  // 3. إعداد رؤوس CORS للنطاقات المسموحة فقط
  const allowedOriginsList = [
    'https://zoonasd.com',
    'https://www.zoonasd.com',
    'https://zoona-git-feat-product-modal-enhancemen-94c8c9-sifians-projects.vercel.app'
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
    const { id } = req.query;
    let fetchUrl = '';

    // 4. بناء الرابط بناءً على وجود معرف المنتج (ID)
    if (id) {
      // جلب منتج واحد محدد
      fetchUrl = `${SUPABASE_URL}/rest/v1/products?id=eq.${id}&select=*`;
    } else {
      // جلب جميع المنتجات مرتبة تنازلياً حسب ID
      fetchUrl = `${SUPABASE_URL}/rest/v1/products?select=*&order=id.desc`;
    }

    // 5. طلب البيانات من Supabase
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Supabase API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 6. إعداد التخزين المؤقت (Cache-Control)
    // s-maxage=60: يتم التخزين في الـ CDN لمدة دقيقة واحدة
    // stale-while-revalidate: يسمح بتقديم نسخة قديمة بينما يتم تحديثها في الخلفية
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

    // 7. إرجاع النتيجة
    // إذا كان الطلب بـ ID، نعيد الكائن الأول من المصفوفة (أو null إذا لم يوجد)
    if (id) {
      return res.status(200).json(data.length > 0 ? data[0] : null);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Error fetching products:', error.message);
    return res.status(500).json({ error: 'Failed to fetch products from database' });
  }
}
