import fetch from 'node-fetch';

const BIN_ID = '69336a3dae596e708f8650a1';
const JSONBIN_KEY = '$2a$10$oHNml.lQOJitFfK0hyyT0.81SIcJolFR5be5uAAQ8IOiECZHAELTW';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, error: "No token provided" });
    }

    try {
      // 1️⃣ جلب البيانات الحالية من JSONBin
      const getRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': JSONBIN_KEY }
      });
      const json = await getRes.json();
      let tokens = json.record.tokens || [];

      // 2️⃣ إضافة الـ token الجديد إذا لم يكن موجودًا
      if (!tokens.includes(token)) tokens.push(token);

      // 3️⃣ تحديث الـ Bin في JSONBin
      await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_KEY
        },
        body: JSON.stringify({ tokens })
      });

      return res.status(200).json({ success: true, tokens });

    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: err.message });
    }

  } else {
    res.status(405).end('Method Not Allowed');
  }
}