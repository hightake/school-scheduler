/* הפיכת מבנה מערכת ל-HTML, וייצוא: הדפסה/PDF, Excel, Word */
(function (root) {
  'use strict';
  const E = root.Engine;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function itemHtml(it, kind, opts) {
    const big = kind === 'student';
    const parts = [];
    if (it.timeDiffers) parts.push('<div class="tt-time">' + esc(E.fmtRange(it.start, it.end)) + '</div>');
    parts.push('<div class="tt-title">' + (opts.icons !== false && it.icon ? '<span class="tt-ic">' + esc(it.icon) + '</span> ' : '') + esc(it.title) +
      (it.pattern ? ' <span class="tt-badge">שבוע ' + esc(it.pattern) + '</span>' : '') +
      (it.oneOff ? ' <span class="tt-badge tt-once">חד-פעמי</span>' : '') + (it.changed ? ' <span class="tt-badge tt-once">שונה</span>' : '') + '</div>');
    if (it.sub && opts.staff !== false) parts.push('<div class="tt-sub">' + esc(it.sub) + '</div>');
    if (it.names) parts.push('<div class="tt-names">' + esc(it.names) + '</div>');
    if (it.room && opts.rooms) parts.push('<div class="tt-sub">📍 ' + esc(it.room) + '</div>');
    return '<div class="tt-item' + (big ? ' tt-big' : '') + (it.highlight ? ' tt-hl' : '') + '" data-session="' + esc(it.sessionId) + '" style="--c:' + esc(opts.color === false ? '#fff' : it.color) + '">' + parts.join('') + '</div>';
  }

  function pageHtml(view, page, opts) {
    opts = opts || {};
    if (page.layout === 'list') {
      return page.sections.map(sec => '<h3 class="tt-sec">' + esc(sec.title) + '</h3>' + (sec.rows.length
        ? '<table class="tt tt-list"><thead><tr>' + sec.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
          sec.rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'
        : '<p class="tt-empty">' + esc(sec.empty || 'אין נתונים') + '</p>')).join('');
    }
    const cols = page.columns;
    let h = '<table class="tt tt-grid' + (view.kind === 'student' ? ' tt-student' : '') + '"><thead><tr><th class="tt-hcol">שעה</th>';
    for (const c of cols) h += '<th>' + esc(c.label) + (c.weekType && c.weekType !== 'all' ? '<div class="tt-wk">שבוע ' + esc(c.weekType) + '</div>' : '') + '</th>';
    h += '</tr></thead><tbody>';
    page.rows.forEach((r, ri) => {
      const isBreak = r.kind === 'break' || r.kind === 'routine';
      h += '<tr class="' + (isBreak ? 'tt-break' : '') + '"><th class="tt-hcol">' + esc(E.fmtRange(r.start, r.end)) + (r.label && isBreak ? '' : '') + '</th>';
      cols.forEach((c, ci) => {
        if (c.holiday) {
          if (ri === 0) h += '<td class="tt-holiday" rowspan="' + page.rows.length + '">' + esc(c.holiday) + '</td>';
          return;
        }
        const items = page.cells[ri][ci];
        let inner = items.map(it => itemHtml(it, view.kind, opts)).join('');
        if (!items.length && isBreak && page.showRoutineLabels && r.label) inner = '<div class="tt-routine">' + esc(r.label) + '</div>';
        h += '<td>' + inner + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>';
    return h;
  }

  function viewHtml(view, opts) {
    opts = opts || {};
    const hd = view.heading;
    let h = '';
    view.pages.forEach((p, i) => {
      h += '<section class="tt-page">';
      if (i === 0 || opts.repeatHeader !== false) {
        h += '<header class="tt-head">' + (hd.top ? '<div class="tt-top">' + esc(hd.top) + '</div>' : '') +
          '<h2>~ ' + esc(hd.title) + ' ~</h2><div class="tt-subh">' + esc(hd.sub) + '</div></header>';
      }
      h += pageHtml(view, p, opts) + '</section>';
    });
    return h;
  }

  const PRINT_CSS = `
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: "Segoe UI", Arial, "Noto Sans Hebrew", sans-serif; direction: rtl; color:#111; margin:0; background:#fff; }
  .tt-page { page-break-after: always; break-after: page; padding: 4mm 0; }
  .tt-page:last-child { page-break-after: auto; break-after: auto; }
  .tt-head { text-align:center; margin-bottom:6px; }
  .tt-head h2 { margin: 2px 0; font-size: 18pt; }
  .tt-top { text-align:right; font-size:9pt; }
  .tt-subh { font-size: 10pt; color:#444; }
  table.tt { width:100%; border-collapse: collapse; table-layout: fixed; }
  table.tt th, table.tt td { border: 1px solid #555; padding: 3px 4px; vertical-align: top; font-size: 9.5pt; }
  table.tt thead th { background:#e5e7eb; font-size: 11pt; }
  .tt-hcol { width: 78px; background:#f3f4f6; font-weight:600; white-space:nowrap; }
  .tt-break td, .tt-break th { background:#f8fafc; }
  .tt-item { background: var(--c); border-radius:4px; padding:2px 4px; margin:2px 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tt-item + .tt-item { border-top: 1px dashed #999; }
  .tt-hl { outline: 1px solid #b45309; }
  .tt-title { font-weight:700; }
  .tt-big .tt-title { font-size: 12pt; }
  .tt-ic { font-size: 1.1em; }
  .tt-time { display:inline-block; background:#fde047; font-weight:700; padding:0 3px; border-radius:2px; font-size:.9em; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tt-sub { font-size: .88em; color:#333; }
  .tt-names { font-size: .88em; color:#1e3a8a; }
  .tt-badge { font-size:.75em; background:#fff; border:1px solid #888; border-radius:8px; padding:0 4px; font-weight:400; }
  .tt-once { border-color:#b91c1c; color:#b91c1c; }
  .tt-routine { text-align:center; color:#555; font-weight:600; }
  .tt-holiday { text-align:center; vertical-align:middle !important; background:#fef2f2; font-weight:700; color:#991b1b; }
  .tt-wk { font-size:.75em; font-weight:400; }
  .tt-sec { margin: 10px 0 4px; font-size: 12pt; }
  .tt-list td, .tt-list th { font-size: 10.5pt; }
  .tt-empty { color:#666; }
  .tt-student td { font-size: 11pt; }
  `;

  function fullDoc(title, body, extraCss) {
    return '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + PRINT_CSS + (extraCss || '') + '</style></head><body>' + body + '</body></html>';
  }

  function printViews(views, opts) {
    const body = views.map(v => viewHtml(v, opts)).join('');
    const title = views.length === 1 ? views[0].heading.title : 'מערכות שעות';
    const w = window.open('', '_blank');
    if (!w) { alert('הדפדפן חסם חלון קופץ. אפשרו חלונות קופצים לאתר זה כדי להדפיס/לשמור PDF.'); return; }
    w.document.open();
    w.document.write(fullDoc(title, body + '<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>'));
    w.document.close();
  }

  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function safeName(s) { return String(s || 'מערכת').replace(/[\\/:*?"<>|~]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80); }

  function wordViews(views, opts) {
    const body = views.map(v => viewHtml(v, Object.assign({}, opts))).join('<br clear=all style="page-break-before:always">');
    const html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" dir="rtl">' +
      '<head><meta charset="utf-8"><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
      '<style>@page WordSection1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:28pt}div.WordSection1{page:WordSection1}' + PRINT_CSS.replace(/var\(--c\)/g, '#fff') + '</style></head>' +
      '<body><div class="WordSection1">' + inlineColors(body) + '</div></body></html>';
    download(safeName(views.length === 1 ? views[0].heading.title : 'מערכות שעות') + '.doc', new Blob(['﻿', html], { type: 'application/msword' }));
  }
  function inlineColors(html) {
    return html.replace(/style="--c:([^"]+)"/g, (m, c) => 'style="background:' + c + '"');
  }

  function itemText(it, kind) {
    const lines = [];
    if (it.timeDiffers) lines.push(E.fmtRange(it.start, it.end));
    lines.push((it.icon ? it.icon + ' ' : '') + it.title + (it.pattern ? ' (שבוע ' + it.pattern + ')' : ''));
    if (it.sub) lines.push(it.sub);
    if (it.names) lines.push(it.names);
    return lines.join('\n');
  }

  function viewToAoa(view) {
    const aoa = [];
    const hd = view.heading;
    aoa.push([hd.title]); aoa.push([hd.sub]); aoa.push([]);
    for (const p of view.pages) {
      if (p.layout === 'list') {
        for (const sec of p.sections) {
          aoa.push([sec.title]); aoa.push(sec.headers);
          sec.rows.forEach(r => aoa.push(r));
          if (!sec.rows.length) aoa.push([sec.empty || '']);
          aoa.push([]);
        }
        continue;
      }
      aoa.push(['שעה'].concat(p.columns.map(c => c.label)));
      p.rows.forEach((r, ri) => {
        const row = [E.fmtRange(r.start, r.end)];
        p.columns.forEach((c, ci) => {
          if (c.holiday) { row.push(ri === 0 ? c.holiday : ''); return; }
          const items = p.cells[ri][ci];
          let txt = items.map(it => itemText(it, view.kind)).join('\n—\n');
          if (!items.length && (r.kind === 'break' || r.kind === 'routine') && p.showRoutineLabels) txt = r.label || '';
          row.push(txt);
        });
        aoa.push(row);
      });
      aoa.push([]);
    }
    return aoa;
  }

  function excelViews(views, fileName) {
    if (!root.XLSX) { alert('ספריית Excel לא נטענה'); return; }
    const X = root.XLSX;
    const wb = X.utils.book_new();
    const used = new Set();
    views.forEach((v, i) => {
      const aoa = viewToAoa(v);
      const ws = X.utils.aoa_to_sheet(aoa);
      const maxCols = Math.max.apply(null, aoa.map(r => r.length));
      ws['!cols'] = [{ wch: 13 }].concat(Array.from({ length: Math.max(0, maxCols - 1) }, () => ({ wch: 28 })));
      let name = safeName(v.heading.title.split(' – ').slice(1).join(' ') || ('גיליון ' + (i + 1))).replace(/[\[\]]/g, '').slice(0, 28) || ('גיליון ' + (i + 1));
      let n = name, k = 2; while (used.has(n)) n = name.slice(0, 25) + ' ' + (k++);
      used.add(n);
      X.utils.book_append_sheet(wb, ws, n);
    });
    wb.Workbook = { Views: [{ RTL: true }] };
    const name = (fileName || safeName(views.length === 1 ? views[0].heading.title : 'מערכות שעות')) + '.xlsx';
    const out = X.write(wb, { bookType: 'xlsx', type: 'array' });
    styleXlsx(out).then(blob => download(name, blob)).catch(() => X.writeFile(wb, name));
  }

  /** SheetJS (גרסה חינמית) לא כותב עיצוב – מוסיפים "גלישת טקסט", יישור למעלה ומסגרות דרך JSZip */
  async function styleXlsx(arr) {
    const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!root.JSZip) return new Blob([arr], { type });
    const zip = await root.JSZip.loadAsync(arr);
    let st = await zip.file('xl/styles.xml').async('string');
    st = st.replace(/<borders count="\d+">([\s\S]*?)<\/borders>/, (m, inner) =>
      '<borders count="2">' + inner + '<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders>');
    st = st.replace(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/, (m, n, inner) =>
      '<cellXfs count="' + (Number(n) + 1) + '">' + inner + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top" readingOrder="2"/></xf></cellXfs>');
    const idx = (Number((st.match(/<cellXfs count="(\d+)"/) || [])[1]) || 2) - 1;
    zip.file('xl/styles.xml', st);
    for (const f of Object.keys(zip.files).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))) {
      let x = await zip.file(f).async('string');
      x = x.replace(/<c r="([A-Z]+)(\d+)"(?![^>]*\ss=)/g, '<c r="$1$2" s="' + idx + '"');
      zip.file(f, x);
    }
    return zip.generateAsync({ type: 'blob', mimeType: type });
  }

  root.Render = { esc, viewHtml, pageHtml, printViews, wordViews, excelViews, download, safeName, fullDoc, PRINT_CSS };
})(typeof window !== 'undefined' ? window : globalThis);
