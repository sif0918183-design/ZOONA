import admin from 'firebase-admin';
import serviceAccount from '../../serviceAccount.json'; // تأكد من المسار

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

export default async function handler(req, res) {
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