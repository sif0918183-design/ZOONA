import crypto from 'crypto';

/**
 * Calculates TOP MD5 signature for AliExpress API requests
 */
export function generateTopSignature(params, appSecret) {
  const sortedKeys = Object.keys(params).sort();
  let basestring = appSecret;
  for (const key of sortedKeys) {
    if (params[key] !== undefined && params[key] !== null) {
      basestring += key + params[key];
    }
  }
  basestring += appSecret;
  return crypto.createHash('md5').update(basestring, 'utf8').digest('hex').toUpperCase();
}

/**
 * Formats current date/time to YYYY-MM-DD HH:mm:ss in GMT+8
 */
export function getTopTimestamp() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const gmt8 = new Date(utc + (3600000 * 8));

  const pad = (n) => n.toString().padStart(2, '0');
  const yyyy = gmt8.getFullYear();
  const mm = pad(gmt8.getMonth() + 1);
  const dd = pad(gmt8.getDate());
  const hh = pad(gmt8.getHours());
  const mi = pad(gmt8.getMinutes());
  const ss = pad(gmt8.getSeconds());

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

/**
 * Normalizes input (URL, product ID, or text keywords)
 */
export function parseAliExpressInput(input) {
  if (!input) return { type: 'keyword', value: '' };
  const str = input.trim();

  // Match AliExpress URL pattern e.g. aliexpress.com/item/1005001234567.html or item/1005001234567 or numeric ID
  const urlMatch = str.match(/(?:item\/|id=|\/|)(\d{10,16})/i);
  if (/^\d{10,16}$/.test(str)) {
    return { type: 'product_id', value: str };
  } else if (urlMatch && (str.includes('aliexpress') || str.includes('item/'))) {
    return { type: 'product_id', value: urlMatch[1] };
  }

  return { type: 'keyword', value: str };
}

/**
 * Generates SEO friendly slug from title or fallback
 */
/**
 * Translates English text to Arabic while preserving alphanumeric model codes and numbers (e.g. S26, 4K, 5G, 100%)
 */
export async function translateTitleToArabic(text) {
  if (!text || typeof text !== 'string') return text || '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // If text is already mostly Arabic (no Latin letters), return as is
  if (!/[a-zA-Z]/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=' + encodeURIComponent(trimmed);
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data[0] && Array.isArray(data[0])) {
        const translated = data[0].map(x => x[0]).join('').trim();
        if (translated) return translated;
      }
    }
  } catch (err) {
    console.error('Error translating title to Arabic:', err);
  }

  return trimmed;
}

/**
 * Calls Groq API to generate refined Arabic title and description from verified English product facts
 */
export async function enhanceProductWithGroq({ title_en, category, evaluate_rate, volume }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !title_en) {
    return null;
  }

  const promptContent = `المعطيات الحقيقية المتاحة للمنتج:
- العنوان الأصلي بالإنجليزية: "${title_en}"
- الفئة: "${category || 'غير محددة'}"
- نسبة التقييم: "${evaluate_rate || 'غير متوفرة'}"
- المبيعات: "${volume || 'غير متوفرة'}"

التعليمات الصارمة:
1. استخدم فقط المعلومات المُعطاة أعلاه. لا تُضف أي ميزة، مادة، مواصفة تقنية، أو ادعاء غير مذكور صراحة في هذه المعطيات.
2. الترجمة والصياغة:
   - (أ) ترجم/صغ العنوان الإنجليزي إلى عنوان عربي فصيح ومرتب نحويًا، أمين للمعنى الأصلي دون تغييره.
   - (ب) اكتب وصفًا احترافيًا متوسط الطول (فقرة واحدة، 3-5 جمل) بالعربية الفصحى يقدّم المنتج بأسلوب تسويقي صادق، بدون مبالغة، معتمدًا فقط على المعطيات الحقيقية المُرسَلة (يمكن ذكر التقييم العالي أو الرواج بين المشترين فقط إذا كانت القيم المُعطاة تدعم ذلك فعليًا، وإلا يُهمَل هذا الجزء دون اختلاق).
3. يجب أن تكون الاستجابة بصيغة JSON فقط بهذا الشكل:
{
  "title_ar": "العنوان العربي المنسق",
  "description_ar": "الوصف العربي الاحترافي"
}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'أنت خبير صياغة تسويقية وترجمة احترافية للمنتجات. أجب بصيغة JSON فقط.' },
          { role: 'user', content: promptContent }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(8000)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Groq API Error]:', res.status, errText);
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed.title_ar && parsed.description_ar) {
        return {
          title_ar: parsed.title_ar.trim(),
          description_ar: parsed.description_ar.trim()
        };
      }
    }
  } catch (err) {
    console.error('Error enhancing product with Groq API:', err.message);
  }

  return null;
}

export function generateSlug(name) {
  if (!name) return `product-${Date.now()}`;

  // Transliterate Arabic
  const mapping = {
    'أ': 'a', 'إ': 'i', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w',
    'ي': 'y', 'ى': 'a', 'ة': 't', 'ؤ': 'u', 'ئ': 'i', 'ء': 'a'
  };

  const transliterated = name.split('').map(char => mapping[char] || char).join('');

  const slug = transliterated.toString().toLowerCase().trim()
    .split(/\s+/).slice(0, 6).join(' ')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return slug || `item-${Date.now()}`;
}
