// AC-PDF-1: file tĩnh trả đúng Content-Type (font, ảnh, CSV tiếng Việt).
// AC-PDF-2: meta.json ghi giờ UTC, giữ tiêu đề có dấu, từ chối báo cáo rỗng.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentType, pdfMeta, PDF_NAME } from '../tools/make-pdf.mjs';

test('AC-PDF-1 contentType', () => {
  const cases = [
    ['fonts/SVN-Gilroy-Regular.woff2', 'font/woff2'],
    ['assets/sungroup.png', 'image/png'],
    ['data/DuAn.csv', 'text/csv; charset=utf-8'],
    ['report.html', 'text/html; charset=utf-8'],
    ['REPORT.HTML', 'text/html; charset=utf-8'],
    ['pdf/meta.json', 'application/json'],
    ['tệp-lạ.xyz', 'application/octet-stream'],
    ['', 'application/octet-stream'],
  ];
  for (const [path, want] of cases) assert.equal(contentType(path), want, path);
});

test('AC-PDF-2 pdfMeta ghi giờ UTC, giữ tiếng Việt', () => {
  const at6am = new Date('2026-11-26T06:00:00+07:00');
  const meta = pdfMeta({ pages: 12, title: 'Báo cáo Tổng thể Danh mục Dự án Trọng điểm – 25/11/2026', warns: ['Thiếu GĐDA'] }, at6am);
  assert.deepEqual(meta, { generated: '2026-11-25T23:00:00.000Z', pages: 12, title: 'Báo cáo Tổng thể Danh mục Dự án Trọng điểm – 25/11/2026', warns: ['Thiếu GĐDA'] });
  assert.equal(PDF_NAME, 'Bao-cao-Du-an-Trong-diem.pdf');
});

test('AC-PDF-2 pdfMeta từ chối dữ liệu sai', () => {
  const bad = [[null, /chưa có trang/], [{ pages: 0 }, /chưa có trang/], [{ pages: 2.5 }, /chưa có trang/], [{ pages: '12' }, /chưa có trang/]];
  for (const [input, re] of bad) assert.throws(() => pdfMeta(input, new Date('2026-11-26T00:00:00Z')), re);
  assert.throws(() => pdfMeta({ pages: 3 }, new Date('không phải ngày')), /không hợp lệ/);
  assert.deepEqual(pdfMeta({ pages: 1 }, new Date('2026-01-01T00:00:00Z')).warns, []);
});
