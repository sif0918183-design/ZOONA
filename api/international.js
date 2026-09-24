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
      "https://zoona-git-jules-2721342884738575238-5a4705ea-sifians-projects.vercel.app",
      "https://zoona-git-jules-7250375803931180038-595003bf-sifians-projects.vercel.app",
      'https://zoonasd.com', 'https://www.zoonasd.com', 'zoonasd.com'
    ];

    const currentOrigin = req.headers.origin;
    if (currentOrigin && allowedOrigins.some(allowed => currentOrigin === allowed || currentOrigin.startsWith(allowed + "/"))) {
      res.setHeader('Access-Control-Allow-Origin', currentOrigin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', 'https://zoonasd.com');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

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

    const productCategory = (product.category && product.category.trim()) ? product.category.trim() : 'عام';

    // Additional gallery images
    let extraImages = [];
    if (product.additional_images) {
      if (Array.isArray(product.additional_images)) {
        extraImages = product.additional_images.filter(img => typeof img === 'string' && img.trim() && img !== product.image_url);
      } else if (typeof product.additional_images === 'string') {
        try {
          const parsed = JSON.parse(product.additional_images);
          if (Array.isArray(parsed)) extraImages = parsed.filter(img => typeof img === 'string' && img.trim() && img !== product.image_url);
        } catch (e) {}
      }
    }

    const allImages = [product.image_url, ...extraImages];

    const jsonLd = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.name_ar,
      "image": allImages,
      "description": metaDescription,
      "category": productCategory,
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
    .product-img { width: 100%; max-height: 380px; object-fit: contain; background: #fafafa; border-radius: 12px; margin-bottom: 12px; transition: opacity 0.2s ease; }
    .gallery-thumbs { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 8px; margin-bottom: 18px; scrollbar-width: thin; }
    .gallery-thumb { width: 64px; height: 64px; min-width: 64px; border-radius: 10px; object-fit: cover; background: #fafafa; border: 2px solid #edf2f7; cursor: pointer; transition: all 0.2s ease; }
    .gallery-thumb.active, .gallery-thumb:hover { border-color: var(--red); transform: scale(1.04); }
    .product-category-badge { display: inline-flex; align-items: center; gap: 6px; background: #f0f4f8; color: #4a5568; font-size: 13px; font-weight: 700; padding: 5px 12px; border-radius: 8px; margin-bottom: 12px; }
    .product-title { font-size: 22px; font-weight: 900; color: #222; margin-bottom: 12px; line-height: 1.4; }
    .product-price-badge { display: inline-block; background: #FFEBEE; color: var(--red); font-size: 24px; font-weight: 900; padding: 6px 16px; border-radius: 10px; margin-bottom: 20px; }
    .product-desc { font-size: 15px; color: #555; line-height: 1.8; margin-bottom: 25px; white-space: pre-wrap; background: #fdfdfd; padding: 15px; border-radius: 10px; border: 1px solid #eee; }
    .buy-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; background: linear-gradient(135deg, #ff4747 0%, #d32f2f 100%); color: #fff; font-size: 18px; font-weight: 800; text-decoration: none; padding: 16px; border-radius: 14px; box-shadow: 0 6px 20px rgba(211,47,47,.3); transition: .25s; border: none; cursor: pointer; font-family: var(--font); }
    .buy-btn:hover { filter: brightness(1.1); transform: translateY(-2px); }
    .disclaimer { text-align: center; font-size: 13px; color: #888; margin-top: 14px; font-weight: 500; }

    /* Popup Modal */
    .popup-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 1000; padding: 16px; opacity: 0; transition: opacity 0.25s ease; }
    .popup-overlay.active { display: flex; opacity: 1; }
    .popup-modal { background: #fff; border-radius: 20px; padding: 22px 20px; max-width: 400px; width: 100%; position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.2); animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); direction: rtl; text-align: center; }
    @keyframes popIn { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .popup-close { position: absolute; top: 12px; left: 14px; background: #f0f2f5; border: none; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #666; cursor: pointer; transition: 0.2s; line-height: 1; }
    .popup-close:hover { background: #e2e8f0; color: #2d3748; }
    .popup-icon { width: 50px; height: 50px; background: #ebf8ff; color: #3182ce; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 12px; }
    .popup-title { font-size: 17px; font-weight: 800; color: #2d3748; margin-bottom: 10px; }
    .popup-text { font-size: 14px; color: #4a5568; line-height: 1.6; margin-bottom: 20px; font-weight: 500; }
    .popup-action-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: linear-gradient(135deg, #ff4747 0%, #d32f2f 100%); color: #fff; font-size: 16px; font-weight: 800; text-decoration: none; padding: 14px; border-radius: 12px; box-shadow: 0 4px 14px rgba(211,47,47,0.3); transition: 0.25s; }
    .popup-action-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
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
      <img id="mainProductImg" src="${esc(product.image_url)}" alt="${esc(product.name_ar)}" class="product-img">
      ${allImages.length > 1 ? `
      <div class="gallery-thumbs">
        ${allImages.map((img, idx) => `
          <img src="${esc(img)}" alt="${esc(product.name_ar)} - ${idx + 1}" class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="swapMainImage('${esc(img)}', this)">
        `).join('')}
      </div>
      ` : ''}
      <div class="product-category-badge"><i class="fas fa-folder"></i> التصنيف: ${esc(productCategory)}</div>
      <h1 class="product-title">${esc(product.name_ar)}</h1>
      <div class="product-price-badge">${esc(product.price)} ${esc(product.currency || 'USD')}</div>
      ${product.description_ar ? `<div class="product-desc">${esc(product.description_ar)}</div>` : ''}
      <button type="button" class="buy-btn" onclick="openPopup()">
        <i class="fas fa-external-link-alt"></i> اشترِ الآن
      </button>
      <div class="disclaimer"><i class="fas fa-info-circle"></i> يتم الشراء والتوصيل عبر AliExpress مباشرة.</div>
    </div>
  </div>

  <div class="popup-overlay" id="aliPopup" onclick="closePopupOnBackdrop(event)">
    <div class="popup-modal">
      <button type="button" class="popup-close" onclick="closePopup()">&times;</button>
      <div class="popup-icon"><i class="fas fa-globe"></i></div>
      <div class="popup-title">تنبيه قبل التحويل</div>
      <div class="popup-text">
        سيتم تحويلك إلى AliExpress لإتمام الشراء. إذا ظهرت الصفحة بالإنجليزية، يمكنك تغيير اللغة إلى العربية من أعلى صفحة AliExpress نفسها.
      </div>
      <a href="${esc(product.affiliate_link)}" target="_blank" rel="nofollow sponsored noopener" class="popup-action-btn" onclick="closePopup()">
        <i class="fas fa-external-link-alt"></i> متابعة إلى AliExpress
      </a>
    </div>
  </div>

  <script>
    function swapMainImage(src, thumbEl) {
      const mainImg = document.getElementById('mainProductImg');
      if (mainImg) {
        mainImg.style.opacity = '0.5';
        setTimeout(() => {
          mainImg.src = src;
          mainImg.style.opacity = '1';
        }, 150);
      }
      document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
      if (thumbEl) thumbEl.classList.add('active');
    }
    function openPopup() {
      const popup = document.getElementById('aliPopup');
      if (popup) popup.classList.add('active');
    }
    function closePopup() {
      const popup = document.getElementById('aliPopup');
      if (popup) popup.classList.remove('active');
    }
    function closePopupOnBackdrop(e) {
      if (e.target && e.target.id === 'aliPopup') {
        closePopup();
      }
    }
  </script>

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
