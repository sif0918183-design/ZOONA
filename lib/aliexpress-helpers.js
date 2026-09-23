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
