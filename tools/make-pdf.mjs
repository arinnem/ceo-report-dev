// Tạo bản PDF báo cáo từ report.html (dùng trong GitHub Actions và trên máy).
// Cách chạy: node tools/make-pdf.mjs <thư mục site> [query]   vd: node tools/make-pdf.mjs _site "?src=local"
import http from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PDF_NAME = 'Bao-cao-Du-an-Trong-diem.pdf';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv; charset=utf-8', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };

/** Content-Type cho file tĩnh. */
export function contentType(path) {
  return TYPES[extname(String(path)).toLowerCase()] || 'application/octet-stream';
}

/** Tên ảnh xem trước của từng trang, tương đối với thư mục pdf/. */
export function pageImageNames(pages) {
  if (!Number.isInteger(pages) || pages < 1) throw new Error('Cần số trang nguyên dương');
  return Array.from({ length: pages }, (_, i) => `pages/trang-${String(i + 1).padStart(2, '0')}.jpg`);
}

/** Thông tin đi kèm PDF (pdf/meta.json). Thời điểm luôn ghi theo UTC (ISO 8601). */
export function pdfMeta(result, now = new Date()) {
  if (!result || !Number.isInteger(result.pages) || result.pages < 1) throw new Error('Báo cáo chưa có trang nào');
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('Thời điểm tạo PDF không hợp lệ');
  return { generated: now.toISOString(), pages: result.pages, title: String(result.title || ''), warns: Array.isArray(result.warns) ? result.warns : [], images: pageImageNames(result.pages) };
}

async function main(root = '.', query = '') {
  const { chromium } = await import('playwright');
  const server = http.createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    try {
      const body = await readFile(join(root, path === '/' ? 'index.html' : path));
      res.writeHead(200, { 'content-type': contentType(path) }); res.end(body);
    } catch (err) { res.writeHead(404); res.end(String(err.code || err)); }
  });
  await new Promise(r => server.listen(0, r));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/report.html${query}`);
    await page.waitForFunction(() => window.__result || document.getElementById('loading')?.textContent.startsWith('Chưa tải'), null, { timeout: 60000 });
    const result = await page.evaluate(() => window.__result ? { pages: window.__result.pages, warns: window.__result.warns, title: document.title } : null);
    if (!result) throw new Error('Không dựng được báo cáo: ' + await page.textContent('#loading'));
    if (errors.length) throw new Error('Lỗi trang: ' + errors.join(' | '));
    const meta = pdfMeta(result);
    // ảnh xem trước từng trang (cho pdf.html: xem được trên mọi điện thoại, có nút Quay lại)
    await mkdir(join(root, 'pdf', 'pages'), { recursive: true });
    const shot = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
    shot.on('pageerror', e => errors.push(e.message));
    await shot.goto(`http://localhost:${server.address().port}/report.html${query}`);
    await shot.waitForFunction(() => window.__result, null, { timeout: 60000 });
    await shot.evaluate(() => { document.querySelector('.bar')?.remove(); document.getElementById('pages').style.zoom = ''; });
    const pages = await shot.$$('.page');
    if (pages.length !== meta.pages) throw new Error(`Số trang ảnh (${pages.length}) khác số trang PDF (${meta.pages})`);
    for (let i = 0; i < pages.length; i++) await pages[i].screenshot({ path: join(root, 'pdf', meta.images[i]), type: 'jpeg', quality: 82 });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({ path: join(root, 'pdf', PDF_NAME), preferCSSPageSize: true, printBackground: true });
    await writeFile(join(root, 'pdf', 'meta.json'), JSON.stringify(meta, null, 2));
    console.log(JSON.stringify(meta));
  } finally {
    await browser.close(); server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] || '.', process.argv[3] || '').catch(err => { console.error(err); process.exitCode = 1; });
}
