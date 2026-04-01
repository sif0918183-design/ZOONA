const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 5000;
const HOST = '0.0.0.0';
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const PRODUCTS_IMAGES_DIR = path.join(__dirname, 'assets', 'products');

// Ensure products images directory exists
if (!fs.existsSync(PRODUCTS_IMAGES_DIR)) {
  fs.mkdirSync(PRODUCTS_IMAGES_DIR, { recursive: true });
}

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
};

// ── Helpers ──
function readProducts() {
  try {
    return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeProducts(products) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2), 'utf8');
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(body); }
    });
    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Server ──
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const urlPath = urlObj.pathname;
  const method = req.method;

  // ═══════════════════════════════════════════
  // API: Products CRUD
  // ═══════════════════════════════════════════

  // GET /api/products — list all
  if (urlPath === '/api/products' && method === 'GET') {
    return sendJSON(res, 200, readProducts());
  }

  // POST /api/products — create product
  if (urlPath === '/api/products' && method === 'POST') {
    const body = await readBody(req);
    const products = readProducts();
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    const product = {
      id: newId,
      name: body.name || '',
      price: Number(body.price) || 0,
      oldPrice: body.oldPrice ? Number(body.oldPrice) : null,
      discount: body.discount ? Number(body.discount) : null,
      image: body.image || '',
      category: body.category || 'عام',
      description: body.description || '',
      warehouse: body.warehouse || 'الخرطوم',
    };
    products.push(product);
    writeProducts(products);
    return sendJSON(res, 201, product);
  }

  // PUT /api/products/:id — update product
  const putMatch = urlPath.match(/^\/api\/products\/(\d+)$/);
  if (putMatch && method === 'PUT') {
    const id = parseInt(putMatch[1]);
    const body = await readBody(req);
    const products = readProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Product not found' });
    products[idx] = {
      ...products[idx],
      name: body.name ?? products[idx].name,
      price: body.price !== undefined ? Number(body.price) : products[idx].price,
      oldPrice: body.oldPrice !== undefined ? (body.oldPrice ? Number(body.oldPrice) : null) : products[idx].oldPrice,
      discount: body.discount !== undefined ? (body.discount ? Number(body.discount) : null) : products[idx].discount,
      image: body.image ?? products[idx].image,
      category: body.category ?? products[idx].category,
      description: body.description ?? products[idx].description,
      warehouse: body.warehouse ?? products[idx].warehouse,
    };
    writeProducts(products);
    return sendJSON(res, 200, products[idx]);
  }

  // DELETE /api/products/:id — delete product
  const delMatch = urlPath.match(/^\/api\/products\/(\d+)$/);
  if (delMatch && method === 'DELETE') {
    const id = parseInt(delMatch[1]);
    const products = readProducts();
    const idx = products.findIndex(p => p.id === id);
    if (idx === -1) return sendJSON(res, 404, { error: 'Product not found' });
    products.splice(idx, 1);
    writeProducts(products);
    return sendJSON(res, 200, { success: true });
  }

  // POST /api/upload-image — upload product image
  if (urlPath === '/api/upload-image' && method === 'POST') {
    try {
      const contentType = req.headers['content-type'] || '';
      const boundary = contentType.split('boundary=')[1];
      if (!boundary) return sendJSON(res, 400, { error: 'No boundary found' });

      const rawBody = await readRawBody(req);
      const boundaryBuf = Buffer.from('--' + boundary);

      // Parse multipart
      let start = rawBody.indexOf(boundaryBuf) + boundaryBuf.length;
      const next = rawBody.indexOf(boundaryBuf, start);
      const part = rawBody.slice(start, next - 2); // remove trailing \r\n

      const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
      const headers = part.slice(0, headerEnd).toString();
      const fileData = part.slice(headerEnd + 4);

      // Extract filename
      const nameMatch = headers.match(/filename="([^"]+)"/);
      const origName = nameMatch ? nameMatch[1] : 'image.jpg';
      const ext = path.extname(origName).toLowerCase() || '.jpg';
      const fileName = `product_${Date.now()}${ext}`;
      const filePath = path.join(PRODUCTS_IMAGES_DIR, fileName);

      fs.writeFileSync(filePath, fileData);
      return sendJSON(res, 200, { url: `/assets/products/${fileName}` });
    } catch (e) {
      console.error('Upload error:', e);
      return sendJSON(res, 500, { error: 'Upload failed: ' + e.message });
    }
  }

  // ═══════════════════════════════════════════
  // Static Files
  // ═══════════════════════════════════════════

  let staticPath = urlPath;
  if (staticPath === '/') staticPath = '/index.html';

  const filePath = path.join(__dirname, staticPath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (err2, data) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err2, data) => {
      if (err2) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
