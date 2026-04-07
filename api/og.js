import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const BOT_USER_AGENTS = [
  'facebookexternalhit', 'Twitterbot', 'WhatsApp', 'LinkedInBot', 'Googlebot', 'bingbot',
  'Pinterest', 'Discordbot', 'TelegramBot', 'Slackbot', 'google-structured-data-testing-tool',
  'Slack-ImgProxy', 'Slackbot-LinkExpanding', 'Embedly', 'ShowyouBot', 'outbrain',
  'pinterest/0.', 'BingPreview', 'Mediapartners-Google', 'proximic', 'vkShare',
  'W3C_Validator', 'redditbot', 'Applebot', 'Baiduspider', 'SiteAnalyzer',
  'SiteExplorer', 'YandexBot', 'Sogou', 'SkypeShell', 'ia_archiver'
];

const categorySlugs = {
  'الكل': 'all',
  'موبايلات': 'mobiles',
  'أجهزة إلكترونية': 'electronics',
  'أجهزة كهربائية': 'electrical-appliances',
  'ألعاب أطفال': 'toys',
  'إكسسوارات موبايلات': 'accessories',
  'مستحضرات تجميل': 'cosmetics'
};

function transliterateArabic(text) {
  const mapping = {
    'أ': 'a', 'إ': 'i', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w',
    'ي': 'y', 'ى': 'a', 'ة': 't', 'ؤ': 'u', 'ئ': 'i', 'ء': 'a'
  };
  return text.split('').map(char => mapping[char] || char).join('');
}

function slugify(text) {
  if (!text) return "";
  const trimmed = text.toString().trim();
  if (categorySlugs[trimmed]) return categorySlugs[trimmed];

  const words = trimmed.split(/\s+/).slice(0, 3).join(' ');
  return transliterateArabic(words.toLowerCase())
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^a-z0-9-]+/g, '')    // Remove non-Latin alphanumeric except -
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

let productsCache = null;
let cacheTime = 0;
let indexHtmlCache = null;

function getIndexHtml() {
  if (!indexHtmlCache) {
    try {
      const indexPath = path.join(process.cwd(), 'index.html');
      indexHtmlCache = fs.readFileSync(indexPath, 'utf8');
    } catch (e) {
      console.error('Error reading index.html:', e);
      return '';
    }
  }
  return indexHtmlCache;
}

async function getProducts() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) return [];

  if (productsCache && (Date.now() - cacheTime < 60000)) {
    return productsCache;
  }
  try {
    const fetchUrl = `${url}/rest/v1/products?select=name,category,image,description&order=id.desc`;
    const res = await fetch(fetchUrl, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    if (res.ok) {
      productsCache = await res.json();
      cacheTime = Date.now();
      return productsCache;
    }
  } catch (e) {
    console.error('Error fetching products for OG:', e);
  }
  return productsCache || [];
}

function isBot(ua) {
  if (!ua) return false;
  return BOT_USER_AGENTS.some(bot => ua.toLowerCase().includes(bot.toLowerCase()));
}

export default async function handler(req, res) {
  const userAgent = req.headers['user-agent'] || '';
  const reqPathQuery = req.query.path || '/';
  const fullPath = decodeURIComponent(reqPathQuery);
  const htmlBase = getIndexHtml();

  if (!isBot(userAgent)) {
     res.setHeader('Content-Type', 'text/html');
     res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
     return res.status(200).send(htmlBase);
  }

  let html = htmlBase;
  const parts = fullPath.split('/').filter(p => p.length > 0);
  let title = "ZOONA - متجر إلكتروني";
  let description = "متجر ZOONA الإلكتروني - أحدث الموبايلات والأجهزة الإلكترونية في السودان";
  let image = "https://zoonasd.com/assets/splash-logo.png";
  let url = `https://zoonasd.com${fullPath}`;

  const products = await getProducts();

  if (parts.length === 2 && parts[0] === 'c') {
    const slug = parts[1];
    let catName = Object.keys(categorySlugs).find(k => categorySlugs[k] === slug);
    if (!catName) {
      const categories = [...new Set(products.map(p => p.category))];
      catName = categories.find(c => slugify(c) === slug);
    }
    if (catName) {
      title = `${catName} | ZOONA`;
      description = `تسوق أحدث منتجات ${catName} في متجر زونا السودان.`;
    }
  } else if (parts.length === 1) {
    const slug = parts[0];
    const product = products.find(p => slugify(p.name) === slug);
    if (product) {
      title = `${product.name} | ZOONA`;
      description = product.description ? product.description.substring(0, 160).replace(/\n/g, ' ') : description;
      image = product.image;
    }
  }

  // Upgrade image quality for Pexels (increase width from 400 to 1200)
  if (image && image.includes('pexels.com')) {
    image = image.replace(/w=400/g, 'w=1200');
  }

  // Determine image dimensions
  const imageWidth = (image && image.includes('splash-logo.png')) ? "512" : "1200";
  const imageHeight = (image && image.includes('splash-logo.png')) ? "512" : "630";

  const esc = (str) => str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));

  const replacements = {
    'og:title': title,
    'og:description': description,
    'og:image': image,
    'og:image:width': imageWidth,
    'og:image:height': imageHeight,
    'og:url': url,
    'twitter:title': title,
    'twitter:description': description,
    'twitter:image': image,
    'twitter:image:width': imageWidth,
    'twitter:image:height': imageHeight,
    'twitter:url': url,
  };

  for (const [prop, val] of Object.entries(replacements)) {
    const regex = new RegExp(`<meta property="${prop}" content="[^"]*">`, 'g');
    html = html.replace(regex, `<meta property="${prop}" content="${esc(val)}">`);
  }

  html = html.replace(/<title>[^<]*<\/title>/g, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/g, `<meta name="description" content="${esc(description)}">`);

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(html);
}
