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

/** Thông tin đi kèm PDF (pdf/meta.json). Thời điểm luôn ghi theo UTC (ISO 8601). */
export function pdfMeta(result, now = new Date()) {
  if (!result || !Number.isInteger(result.pages) || result.pages < 1) throw new Error('Báo cáo chưa có trang nào');
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('Thời điểm tạo PDF không hợp lệ');
  return { generated: now.toISOString(), pages: result.pages, title: String(result.title || ''), warns: Array.isArray(result.warns) ? result.warns : [] };
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
    await page.emulateMedia({ media: 'print' });
    await mkdir(join(root, 'pdf'), { recursive: true });
    await page.pdf({ path: join(root, 'pdf', PDF_NAME), preferCSSPageSize: true, printBackground: true });
    const meta = pdfMeta(result);
    await writeFile(join(root, 'pdf', 'meta.json'), JSON.stringify(meta, null, 2));
    console.log(JSON.stringify(meta));
  } finally {
    await browser.close(); server.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2] || '.', process.argv[3] || '').catch(err => { console.error(err); process.exitCode = 1; });
}
