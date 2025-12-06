// ❌ تم حذف سطر استيراد node-fetch للاعتماد على دالة fetch المضمنة في Vercel

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

      // 💡 فحص رمز الحالة: إذا فشل الجلب (4xx أو 5xx)
      if (!getRes.ok) {
        const errorText = await getRes.text();
        throw new Error(`Failed to GET data from JSONBin. Status: ${getRes.status}. Response: ${errorText}`);
      }

      const json = await getRes.json();
      
      // البنية الحالية هي: {"tokens": []}، لذا يجب أن يكون المسار 'tokens' وليس 'record.tokens'
      // 💡 التعديل: تغيير المسار إلى 'json.tokens' بدلاً من 'json.record.tokens' بناءً على محتوى Bin الحالي
      let tokens = json.tokens || []; 

      // 2️⃣ إضافة الـ token الجديد إذا لم يكن موجودًا
      if (!tokens.includes(token)) tokens.push(token);

      // 3️⃣ تحديث الـ Bin في JSONBin
      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Master-Key': JSONBIN_KEY
        },
        body: JSON.stringify({ tokens })
      });
      
      // 💡 فحص رمز الحالة للتحديث
      if (!putRes.ok) {
        const errorText = await putRes.text();
        throw new Error(`Failed to PUT data to JSONBin. Status: ${putRes.status}. Response: ${errorText}`);
      }


      return res.status(200).json({ success: true, tokens });

    } catch (err) {
      console.error('JSONBin API Error:', err.message);
      // إرجاع رسالة خطأ أكثر تحديداً
      return res.status(500).json({ success: false, error: "Server error during token update. Check Vercel logs for details." });
    }

  } else {
    res.status(405).end('Method Not Allowed');
  }
}
