// AC-PDF-1: file tĩnh trả đúng Content-Type (font, ảnh, CSV tiếng Việt).
// AC-PDF-2: meta.json ghi giờ UTC, giữ tiêu đề có dấu, từ chối báo cáo rỗng.
// AC-PDF-3: mỗi trang PDF có một ảnh xem trước (trang-01.jpg …) để xem trong trang có nút Quay lại.
import test from 'node:test';
import assert from 'node:assert/strict';
import { contentType, pdfMeta, PDF_NAME, pageImageNames } from '../tools/make-pdf.mjs';

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
  assert.deepEqual(meta, { generated: '2026-11-25T23:00:00.000Z', pages: 12, title: 'Báo cáo Tổng thể Danh mục Dự án Trọng điểm – 25/11/2026', warns: ['Thiếu GĐDA'], images: pageImageNames(12) });
  assert.equal(PDF_NAME, 'Bao-cao-Du-an-Trong-diem.pdf');
});

test('AC-PDF-2 pdfMeta từ chối dữ liệu sai', () => {
  const bad = [[null, /chưa có trang/], [{ pages: 0 }, /chưa có trang/], [{ pages: 2.5 }, /chưa có trang/], [{ pages: '12' }, /chưa có trang/]];
  for (const [input, re] of bad) assert.throws(() => pdfMeta(input, new Date('2026-11-26T00:00:00Z')), re);
  assert.throws(() => pdfMeta({ pages: 3 }, new Date('không phải ngày')), /không hợp lệ/);
  assert.deepEqual(pdfMeta({ pages: 1 }, new Date('2026-01-01T00:00:00Z')).warns, []);
});

test('AC-PDF-3 pageImageNames đặt tên ảnh theo số trang', () => {
  const cases = [
    [1, ['pages/trang-01.jpg']],
    [3, ['pages/trang-01.jpg', 'pages/trang-02.jpg', 'pages/trang-03.jpg']],
  ];
  for (const [n, want] of cases) assert.deepEqual(pageImageNames(n), want, String(n));
  assert.equal(pageImageNames(12)[11], 'pages/trang-12.jpg');
  assert.equal(pageImageNames(120)[119], 'pages/trang-120.jpg');
  for (const bad of [0, -1, 1.5, '3', null]) assert.throws(() => pageImageNames(bad), /số trang/);
});

test('AC-PDF-3 pdfMeta kèm danh sách ảnh trang', () => {
  const meta = pdfMeta({ pages: 2, title: 'Báo cáo' }, new Date('2026-11-26T11:00:00+07:00'));
  assert.deepEqual(meta.images, ['pages/trang-01.jpg', 'pages/trang-02.jpg']);
  assert.equal(meta.generated, '2026-11-26T04:00:00.000Z');
});
