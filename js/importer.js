/* ייבוא נתונים מקבצים: Excel / CSV / PDF / Word (docx) / טקסט – מחזיר טבלה (מערך שורות) */
(function (root) {
  'use strict';

  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector('script[data-src="' + src + '"]')) return res();
      const s = document.createElement('script');
      s.src = src; s.dataset.src = src;
      s.onload = () => res(); s.onerror = () => rej(new Error('טעינת ' + src + ' נכשלה'));
      document.head.appendChild(s);
    });
  }

  function readAs(file, how) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result); r.onerror = () => rej(r.error);
      if (how === 'text') r.readAsText(file, 'utf-8'); else r.readAsArrayBuffer(file);
    });
  }

  function clean(rows) {
    return rows.map(r => r.map(c => String(c == null ? '' : c).replace(/\s+/g, ' ').trim()))
      .filter(r => r.some(c => c !== ''));
  }

  async function fromExcel(file) {
    const buf = await readAs(file, 'buf');
    const wb = root.XLSX.read(buf, { type: 'array', codepage: 1255 });
    const sheets = wb.SheetNames.map(n => ({ name: n, rows: clean(root.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' })) }));
    return { sheets };
  }

  function fromText(text) {
    const lines = text.split(/\r?\n/);
    const delim = /\t/.test(text) ? '\t' : (lines.filter(l => l.includes(',')).length > lines.length / 2 ? ',' : (lines.filter(l => l.includes(';')).length > lines.length / 2 ? ';' : null));
    const rows = lines.map(l => delim ? l.split(delim) : [l]);
    return { sheets: [{ name: 'טקסט', rows: clean(rows) }] };
  }

  async function fromPdf(file) {
    if (!root.pdfjsLib) await loadScript('js/vendor/pdf.min.js');
    // טוען את ה-worker כסקריפט רגיל => עובד גם מקובץ מקומי (file://)
    if (!root.pdfjsWorker) await loadScript('js/vendor/pdf.worker.min.js');
    const lib = root.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
    const buf = await readAs(file, 'buf');
    const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
    const rows = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const lines = new Map();
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const y = Math.round(it.transform[5] / 3) * 3;
        if (!lines.has(y)) lines.set(y, []);
        lines.get(y).push({ x: it.transform[4], w: it.width || 0, s: it.str, fs: Math.abs(it.transform[0]) || 10 });
      }
      const ys = Array.from(lines.keys()).sort((a, b) => b - a);
      for (const y of ys) {
        // סדר מימין לשמאל (עברית)
        const items = lines.get(y).sort((a, b) => b.x - a.x);
        const cells = []; let cur = null, lastX = null;
        for (const it of items) {
          // רווח גדול מ~חצי גובה אות = עמודה חדשה (רווח בין מילים הוא כרבע)
          if (cur !== null && lastX !== null && (lastX - (it.x + it.w)) > Math.max(4, it.fs * 0.45)) { cells.push(cur); cur = null; }
          cur = cur === null ? it.s : cur + ' ' + it.s;
          lastX = it.x;
        }
        if (cur !== null) cells.push(cur);
        rows.push(cells);
      }
    }
    return { sheets: [{ name: 'PDF', rows: clean(rows) }] };
  }

  async function fromDocx(file) {
    const buf = await readAs(file, 'buf');
    const zip = await root.JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const body = doc.getElementsByTagNameNS(W, 'body')[0];
    const rows = [];
    const pText = p => Array.from(p.getElementsByTagNameNS(W, 't')).map(t => t.textContent).join('');
    for (const el of Array.from(body.childNodes)) {
      if (el.localName === 'p') { const t = pText(el); if (t.trim()) rows.push([t]); }
      if (el.localName === 'tbl') {
        for (const tr of Array.from(el.getElementsByTagNameNS(W, 'tr'))) {
          const cells = Array.from(tr.childNodes).filter(n => n.localName === 'tc')
            .map(tc => Array.from(tc.getElementsByTagNameNS(W, 'p')).map(pText).filter(x => x.trim()).join(' / '));
          rows.push(cells);
        }
      }
    }
    return { sheets: [{ name: 'Word', rows: clean(rows) }] };
  }

  async function readFile(file) {
    const n = file.name.toLowerCase();
    if (/\.(xlsx|xlsm|xls|ods)$/.test(n)) return fromExcel(file);
    if (/\.csv$/.test(n)) {
      // CSV – מנסים UTF-8, ואם יש סימני שבירה מנסים Windows-1255 דרך SheetJS
      const txt = await readAs(file, 'text');
      if (/�/.test(txt)) return fromExcel(file);
      return fromText(txt);
    }
    if (/\.pdf$/.test(n)) return fromPdf(file);
    if (/\.docx$/.test(n)) return fromDocx(file);
    if (/\.(txt|tsv)$/.test(n)) return fromText(await readAs(file, 'text'));
    throw new Error('סוג קובץ לא נתמך: ' + file.name + ' (נתמכים: Excel, CSV, PDF, Word docx, טקסט)');
  }

  // ---- זיהוי עמודות אוטומטי ----
  const FIELD_HINTS = {
    students: {
      fullName: ['שם מלא', 'שם התלמיד', 'תלמיד', 'שם'],
      firstName: ['שם פרטי', 'פרטי'],
      lastName: ['שם משפחה', 'משפחה'],
      className: ['כיתה', 'כתה', 'קבוצה'],
      inclusionClass: ['שילוב', 'כיתת שילוב', 'משולב'],
      needs: ['טיפולים', 'צרכים', 'המלצות', 'טיפול'],
      notes: ['הערות', 'הערה']
    },
    staff: {
      name: ['שם', 'שם מלא', 'שם איש הצוות', 'מורה', 'מטפל'],
      role: ['תפקיד', 'סוג'],
      specialties: ['תחום', 'תחומים', 'התמחות', 'מקצוע'],
      phone: ['טלפון', 'נייד', 'פלאפון'],
      hours: ['שעות', 'היקף', 'שעות שבועיות'],
      notes: ['הערות']
    },
    classes: {
      name: ['שם', 'כיתה', 'שם הכיתה'],
      kind: ['סוג'],
      teacher: ['מחנך', 'מורה', 'מחנכת', 'מחנך/ת'],
      grade: ['שכבה'],
      notes: ['הערות']
    }
  };
  const FIELD_LABELS = {
    students: { fullName: 'שם מלא', firstName: 'שם פרטי', lastName: 'שם משפחה', className: 'כיתה', inclusionClass: 'כיתת שילוב', needs: 'טיפולים/צרכים', notes: 'הערות' },
    staff: { name: 'שם', role: 'תפקיד', specialties: 'תחומי התמחות', phone: 'טלפון', hours: 'שעות שבועיות', notes: 'הערות' },
    classes: { name: 'שם הכיתה', kind: 'סוג (רגילה/חנ"מ)', teacher: 'מחנך/ת', grade: 'שכבה', notes: 'הערות' }
  };

  function guessMapping(entity, header) {
    const hints = FIELD_HINTS[entity];
    const map = {};
    header.forEach((h, i) => {
      const hv = String(h || '').trim();
      let best = null;
      for (const [field, words] of Object.entries(hints)) {
        if (Object.values(map).includes(field)) continue;
        for (const w of words) {
          if (hv === w) { best = field; break; }
          if (!best && hv.includes(w)) best = field;
        }
        if (best === field) break;
      }
      map[i] = best || '';
    });
    if (!Object.values(map).some(Boolean)) map[0] = entity === 'students' ? 'fullName' : 'name';
    return map;
  }

  /** ניחוש סוג הנתונים לפי שורת הכותרת */
  function guessEntity(rows) {
    const txt = (rows.slice(0, 3).flat().join(' ') || '');
    if (/תפקיד|תחום|התמחות|מטפל|טלפון/.test(txt) && !/תלמיד/.test(txt)) return 'staff';
    if (/מחנך|שכבה/.test(txt) && !/תלמיד/.test(txt)) return 'classes';
    if (/תלמיד|שם פרטי|שם משפחה/.test(txt)) return 'students';
    return null;
  }

  function looksLikeHeader(entity, row) {
    const hints = Object.values(FIELD_HINTS[entity]).flat();
    return row.some(c => hints.some(w => String(c).trim() === w || String(c).includes(w)));
  }

  function splitName(full) {
    const p = String(full || '').trim().split(/\s+/);
    if (p.length <= 1) return { firstName: p[0] || '', lastName: '' };
    // שם משפחה = המילה האחרונה; אם יש "בן"/"בר" וכו' – מצרפים
    const last = p.pop();
    return { firstName: p.join(' '), lastName: last };
  }

  const ROLE_WORDS = [['sped', ['חנ"מ', 'חינוך מיוחד', 'מחנך']], ['regular', ['כיתה רגילה', 'מורה רגיל']], ['therapist', ['מטפל', 'טיפול', 'קלינאי', 'מרפא', 'פיזיו']], ['guide', ['מדריך', 'הדרכה']], ['assistant', ['סייע', 'סייעת']], ['admin', ['מנהל', 'רכז', 'יועץ']], ['teacher', ['מורה']]];
  function guessRole(text) {
    const t = String(text || '');
    for (const [k, ws] of ROLE_WORDS) if (ws.some(w => t.includes(w))) return k;
    return 'other';
  }

  root.Importer = { readFile, fromText, guessMapping, guessEntity, looksLikeHeader, splitName, guessRole, FIELD_LABELS, loadScript };
})(typeof window !== 'undefined' ? window : globalThis);
