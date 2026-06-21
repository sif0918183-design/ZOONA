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
    'http://localhost:3000',
    'https://zoona-git-feat-complete-affiliate-syste-30a731-sifians-projects.vercel.app',
    'https://zoona-git-feat-complete-affiliate-system-v2-30a731-sifians-projects.vercel.app'
  ];

  const isVercelPreview = origin.endsWith('.vercel.app') && origin.includes('sifians-projects');
  const isAllowed = allowedOrigins.some(allowed => origin.startsWith(allowed)) || isVercelPreview || !origin;
  
  if (!isAllowed && origin) {
    return res.status(403).json({ error: 'Access denied. Invalid origin.' });
  }

  // 2. جلب متغيرات البيئة
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 2. جلب متغيرات البيئة
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD missing');
    return res.status(500).json({ 
      error: 'Server configuration error',
      details: 'ADMIN_PASSWORD environment variable not set.'
    });
  }

  // 3. التحقق من طريقة الطلب (GET فقط)
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 4. إعداد رؤوس CORS
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? (req.headers.origin || '*') : 'https://zoonasd.com');
  
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

    // 4. التحقق من كلمة المرور
    const valid = password === ADMIN_PASSWORD;
    return res.status(200).json({ valid });

  } catch (error) {
    console.error('[Admin-Auth] Error:', error.message);
    return res.status(200).json({ valid: false, error: error.message });
  }
}