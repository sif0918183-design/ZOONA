import admin from 'firebase-admin';
import serviceAccount from './serviceAccount.json';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// Endpoint لإرسال الإشعار
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { title, body, url, token } = req.body;

  const message = {
    notification: { title, body },
    webpush: {
      fcmOptions: { link: url || '/' },
      notification: {
        badge: '/assets/splash-logo.png',
        icon: '/assets/splash-logo.png'
      }
    },
    token
  };

  try {
    const response = await admin.messaging().send(message);
    return res.status(200).json({ success: true, response });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}