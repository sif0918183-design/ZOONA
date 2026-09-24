import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  const reqFormat = req.query.format;
  const reqSlug = req.query.slug || '';
  const slug = decodeURIComponent(reqSlug).trim();

  // 1. JSON List mode for storefront tab
  if (reqFormat === 'json') {
    const origin = req.headers.origin || req.headers.referer || '';
    const allowedOrigins = [
    "https://zoona-git-jules-7250375803931180038-595003bf-sifians-projects.vercel.app",'https://zoonasd.com', 'https://www.zoonasd.com', 'zoonasd.com'];

    const currentOrigin = req.headers.origin;
    if (currentOrigin && allowedOrigins.some(allowed => currentOrigin === allowed || currentOrigin.startsWith(allowed + "/"))) {
      res.setHeader('Access-Control-Allow-Origin', currentOrigin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
      const fetchUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?is_active=eq.true&select=id,slug,name_ar,description_ar,category,image_url,price,currency,affiliate_link,source_product_id,created_at&order=created_at.desc`;
      const response = await fetch(fetchUrl, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      if (!response.ok) throw new Error(`Supabase status ${response.status}`);
      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      console.error('Error fetching international products:', err);
      return res.status(500).json({ error: 'Failed to fetch international products' });
    }
  }

  // 2. SSR HTML Mode for /international/[slug]
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!slug) {
    return res.status(404).send('<h1>Product Not Found</h1>');
  }

  try {
    const fetchUrl = `${SUPABASE_URL}/rest/v1/aliexpress_products?slug=eq.${encodeURIComponent(slug)}&select=*`;
    const response = await fetch(fetchUrl, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!response.ok) {
      return res.status(500).send('<h1>Error loading product</h1>');
    }

    const data = await response.json();
    if (!data || data.length === 0 || !data[0].is_active) {
      return res.status(404).send('<h1>المنتج غير موجود أو غير متاح حالياً</h1>');
    }

    const product = data[0];
    const canonicalUrl = `https://zoonasd.com/international/${product.slug}`;
    const pageTitle = `${product.name_ar} | منتجات عالمية - ZOONA`;
    const metaDescription = product.description_ar
      ? product.description_ar.replace(/\n/g, ' ').substring(0, 160)
      : `تسوق ${product.name_ar} بسعر ${product.price} USD شحن وتوصيل مباشر عبر AliExpress من متجر زونا.`;

    const esc = (str) => String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));

    const jsonLd = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.name_ar,
      "image": [product.image_url],
      "description": metaDescription,
      "sku": `ALIEXPRESS-${product.source_product_id}`,
      "offers": {
        "@type": "Offer",
        "url": canonicalUrl,
        "priceCurrency": product.currency || "USD",
        "price": product.price,
        "itemCondition": "https://schema.org/NewCondition",
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": "ZOONA"
        }
      }
    };

    const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="referrer" content="no-referrer-when-downgrade">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(metaDescription)}">
  <link rel="canonical" href="${esc(canonicalUrl)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="product">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(metaDescription)}">
  <meta property="og:image" content="${esc(product.image_url)}">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${esc(canonicalUrl)}">
  <meta property="twitter:title" content="${esc(pageTitle)}">
  <meta property="twitter:description" content="${esc(metaDescription)}">
  <meta property="twitter:image" content="${esc(product.image_url)}">

  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

  <script type="application/ld+json">
  ${JSON.stringify(jsonLd)}
  </script>

  <style>
    * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    :root {
      --red: #D32F2F;
      --red-dark: #B71C1C;
      --red-gradient: linear-gradient(135deg, #D32F2F 0%, #B71C1C 100%);
      --font: 'Tajawal', sans-serif;
    }
    body { font-family: var(--font); background: #f5f5f5; color: #333; direction: rtl; min-height: 100vh; display: flex; flex-direction: column; }
    .header { background: var(--red-gradient); padding: 14px 16px; color: #fff; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
    .header a { color: #fff; text-decoration: none; font-weight: 800; font-size: 18px; display: flex; align-items: center; gap: 8px; }
    .container { max-width: 800px; margin: 20px auto; padding: 0 16px; flex: 1; width: 100%; }
    .card { background: #fff; border-radius: 18px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,.08); }
    .product-img { width: 100%; max-height: 380px; object-fit: contain; background: #fafafa; border-radius: 12px; margin-bottom: 20px; }
    .product-title { font-size: 22px; font-weight: 900; color: #222; margin-bottom: 12px; line-height: 1.4; }
    .product-price-badge { display: inline-block; background: #FFEBEE; color: var(--red); font-size: 24px; font-weight: 900; padding: 6px 16px; border-radius: 10px; margin-bottom: 20px; }
    .product-desc { font-size: 15px; color: #555; line-height: 1.8; margin-bottom: 25px; white-space: pre-wrap; background: #fdfdfd; padding: 15px; border-radius: 10px; border: 1px solid #eee; }
    .buy-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; background: linear-gradient(135deg, #ff4747 0%, #d32f2f 100%); color: #fff; font-size: 18px; font-weight: 800; text-decoration: none; padding: 16px; border-radius: 14px; box-shadow: 0 6px 20px rgba(211,47,47,.3); transition: .25s; }
    .buy-btn:hover { filter: brightness(1.1); transform: translateY(-2px); }
    .disclaimer { text-align: center; font-size: 13px; color: #888; margin-top: 14px; font-weight: 500; }
    .back-nav { display: inline-flex; align-items: center; gap: 6px; color: var(--red); text-decoration: none; font-weight: 700; margin-bottom: 16px; font-size: 14px; }
    .footer { text-align: center; padding: 20px; color: #888; font-size: 13px; border-top: 1px solid #eee; margin-top: 30px; background: #fff; }
  </style>
  <script defer src="/_vercel/insights/script.js"></script>
</head>
<body>

  <header class="header">
    <a href="/"><i class="fas fa-store"></i> متجر ZOONA</a>
    <span style="font-size: 13px; opacity: .9; font-weight: 600;">منتجات عالمية 🌐</span>
  </header>

  <div class="container">
    <a href="/" class="back-nav"><i class="fas fa-arrow-right"></i> العودة للمتجر الرئيسي</a>
    <div class="card">
      <img src="${esc(product.image_url)}" alt="${esc(product.name_ar)}" class="product-img">
      <h1 class="product-title">${esc(product.name_ar)}</h1>
      <div class="product-price-badge">${esc(product.price)} ${esc(product.currency || 'USD')}</div>
      ${product.description_ar ? `<div class="product-desc">${esc(product.description_ar)}</div>` : ''}
      <a href="${esc(product.affiliate_link)}" target="_blank" rel="nofollow sponsored noopener" class="buy-btn">
        <i class="fas fa-external-link-alt"></i> اشترِ الآن
      </a>
      <div class="disclaimer"><i class="fas fa-info-circle"></i> يتم الشراء والتوصيل عبر AliExpress مباشرة.</div>
    </div>
  </div>

  <footer class="footer">
    ZOONA © 2026 - جميع الحقوق محفوظة
  </footer>

</body>
</html>`;

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).send(htmlContent);

  } catch (err) {
    console.error('Error rendering international product page:', err);
    return res.status(500).send('<h1>Server Error</h1>');
  }
}
