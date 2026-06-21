import admin from 'firebase-admin';
import serviceAccount from '../../serviceAccount.json'; // تأكد من المسار

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

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

  // 2. إعداد رؤوس CORS
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? (req.headers.origin || '*') : 'https://zoonasd.com');
  
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  const { title, body, url, tokens } = req.body; // tokens = array of FCM Tokens

  if (!tokens || tokens.length === 0) {
    return res.status(400).json({ success: false, error: "No tokens provided" });
  }

  const message = {
    notification: { title, body },
    webpush: {
      fcmOptions: { link: url || '/' },
      notification: {
        badge: '/assets/splash-logo.png',
        icon: '/assets/splash-logo.png',
        requireInteraction: true
      }
    },
    tokens // مصفوفة Tokens
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}