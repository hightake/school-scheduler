/* עזרי ממשק משותפים */
(function (root) {
  'use strict';
  const E = root.Engine;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const S = () => root.Model.Store.state;

  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }

  /** מודאל: מחזיר אלמנט; buttons: [{label, cls, onClick(el) -> false כדי לא לסגור}] */
  function modal(title, bodyHtml, buttons, opts) {
    opts = opts || {};
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '"><header><h3>' + esc(title) + '</h3><button class="sm" data-x>✕</button></header><div class="body">' + bodyHtml + '</div><footer></footer></div>';
    const foot = $('footer', back);
    const close = () => { back.remove(); if (opts.onClose) opts.onClose(); };
    (buttons || [{ label: 'סגירה' }]).forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.label; if (b.cls) btn.className = b.cls;
      btn.onclick = async () => { const r = b.onClick ? await b.onClick(back) : true; if (r !== false) close(); };
      foot.appendChild(btn);
    });
    $('[data-x]', back).onclick = close;
    back.addEventListener('mousedown', e => { if (e.target === back && opts.backdropClose !== false) close(); });
    $('#modalRoot').appendChild(back);
    back.close = close;
    const first = $('input,select,textarea', back); if (first && !opts.noFocus) setTimeout(() => first.focus(), 30);
    return back;
  }
  function confirmBox(msg, okLabel) {
    return new Promise(res => {
      modal('אישור', '<p>' + esc(msg) + '</p>', [
        { label: okLabel || 'אישור', cls: 'pri', onClick: () => { res(true); } },
        { label: 'ביטול', onClick: () => { res(false); } }
      ], { onClose: () => res(false) });
    });
  }

  function options(list, selected, opts) {
    opts = opts || {};
    let h = opts.empty != null ? '<option value="">' + esc(opts.empty) + '</option>' : '';
    for (const it of list) {
      const v = it.value != null ? it.value : it.id;
      const l = it.label != null ? it.label : it.name;
      h += '<option value="' + esc(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }
    return h;
  }

  function dayOptions(sel) { return options(S().settings.days.map(d => ({ value: d, label: E.DAY_NAMES[d] })), sel); }

  function timeInput(field, val, extra) {
    return '<input type="time" step="300" data-f="' + field + '" value="' + esc(val == null || val === '' ? '' : E.fmt(val)) + '" ' + (extra || '') + '>';
  }

  /** בורר מרובה עם חיפוש; items: [{id,label,group}] */
  function multiPick(field, items, selected, opts) {
    opts = opts || {};
    const sel = new Set(selected || []);
    let h = '<div class="mpick" data-mp="' + field + '"><div class="mp-tools"><input type="search" placeholder="חיפוש..." data-mp-filter>' +
      '<button type="button" class="sm" data-mp-all>הכל</button><button type="button" class="sm" data-mp-none>נקה</button><span class="small muted" data-mp-count></span></div><div class="mp-list">';
    let g = null;
    for (const it of items) {
      if (it.group && it.group !== g) { g = it.group; h += '<div class="mp-group">' + esc(g) + '</div>'; }
      h += '<label title="' + esc(it.label) + '"><input type="checkbox" value="' + esc(it.id) + '"' + (sel.has(it.id) ? ' checked' : '') + '> ' + esc(it.label) + '</label>';
    }
    if (!items.length) h += '<span class="muted small">' + esc(opts.emptyText || 'אין פריטים') + '</span>';
    return h + '</div></div>';
  }
  function bindPickers(el) {
    $$('.mpick', el).forEach(mp => {
      const upd = () => { const n = $$('.mp-list input:checked', mp).length; const c = $('[data-mp-count]', mp); if (c) c.textContent = n ? n + ' נבחרו' : ''; };
      $('[data-mp-filter]', mp).oninput = e => {
        const q = e.target.value.trim();
        $$('.mp-list label', mp).forEach(l => { l.style.display = !q || l.textContent.includes(q) ? '' : 'none'; });
      };
      $('[data-mp-all]', mp).onclick = () => { $$('.mp-list label', mp).forEach(l => { if (l.style.display !== 'none') $('input', l).checked = true; }); upd(); mp.dispatchEvent(new Event('change', { bubbles: true })); };
      $('[data-mp-none]', mp).onclick = () => { $$('.mp-list input', mp).forEach(i => i.checked = false); upd(); mp.dispatchEvent(new Event('change', { bubbles: true })); };
      mp.addEventListener('change', upd); upd();
    });
    $$('.wins', el).forEach(bindWins);
  }

  /** עורך חלונות זמן: [{day,start,end,reason}] */
  function winsEditor(field, list, opts) {
    opts = opts || {};
    return '<div class="wins" data-win="' + field + '" data-reason="' + (opts.reason ? 1 : 0) + '"><div class="wins-list">' +
      (list || []).map(w => winRow(w, opts.reason)).join('') + '</div><button type="button" class="sm" data-add-win>+ הוספת חלון זמן</button>' +
      (opts.quick ? ' <button type="button" class="sm" data-fill-days>מלא את כל ימי הלימודים</button>' : '') + '</div>';
  }
  function winRow(w, reason) {
    w = w || {};
    return '<div class="win-row"><select data-w="day">' + dayOptions(w.day) + '</select> מ- <input type="time" step="300" data-w="start" value="' + (w.start != null ? E.fmt(w.start) : '') + '"> עד <input type="time" step="300" data-w="end" value="' + (w.end != null ? E.fmt(w.end) : '') + '">' +
      (reason ? ' <input data-w="reason" placeholder="סיבה" value="' + esc(w.reason || '') + '">' : '') + ' <button type="button" class="sm danger" data-del-win>✕</button></div>';
  }
  function bindWins(box) {
    if (box._bound) return; box._bound = true;
    const reason = box.dataset.reason === '1';
    box.addEventListener('click', e => {
      if (e.target.matches('[data-add-win]')) {
        const last = $$('.win-row', box).pop();
        const w = last ? readWin(last) : { day: S().settings.days[0], start: 510, end: 780 };
        if (last) w.day = S().settings.days[(S().settings.days.indexOf(Number(w.day)) + 1) % S().settings.days.length];
        $('.wins-list', box).insertAdjacentHTML('beforeend', winRow(w, reason));
      }
      if (e.target.matches('[data-del-win]')) e.target.closest('.win-row').remove();
      if (e.target.matches('[data-fill-days]')) {
        const first = $$('.win-row', box)[0];
        const w = first ? readWin(first) : { start: 510, end: 985 };
        $('.wins-list', box).innerHTML = S().settings.days.map(d => winRow({ day: d, start: w.start, end: w.end }, reason)).join('');
      }
    });
  }
  function readWin(row) {
    const g = k => $('[data-w="' + k + '"]', row);
    return { day: Number(g('day').value), start: E.toMin(g('start').value), end: E.toMin(g('end').value), reason: g('reason') ? g('reason').value : undefined };
  }

  /** קריאת טופס: data-f (ערכים), data-mp (בורר מרובה), data-win (חלונות), data-days (תיבות ימים) */
  function readForm(el) {
    const out = {};
    $$('[data-f]', el).forEach(i => {
      const k = i.dataset.f;
      if (i.type === 'checkbox') out[k] = i.checked;
      else if (i.type === 'time') out[k] = i.value ? E.toMin(i.value) : '';
      else if (i.type === 'number') out[k] = i.value === '' ? '' : Number(i.value);
      else out[k] = i.value;
    });
    $$('[data-mp]', el).forEach(mp => { out[mp.dataset.mp] = $$('.mp-list input:checked', mp).map(i => i.value); });
    $$('[data-win]', el).forEach(w => {
      out[w.dataset.win] = $$('.win-row', w).map(readWin).filter(x => x.start != null && x.end != null && x.end > x.start)
        .map(x => { if (x.reason === undefined) delete x.reason; return x; });
    });
    $$('[data-days]', el).forEach(box => { out[box.dataset.days] = $$('input:checked', box).map(i => Number(i.value)); });
    return out;
  }
  function daysBoxes(field, selected, all) {
    const days = all ? [0, 1, 2, 3, 4, 5, 6] : S().settings.days;
    return '<div class="row" data-days="' + field + '">' + days.map(d => '<label class="row" style="gap:3px"><input type="checkbox" value="' + d + '"' + ((selected || []).map(Number).includes(d) ? ' checked' : '') + '>' + E.DAY_NAMES[d] + '</label>').join('') + '</div>';
  }

  // ---- רשימות לבחירה ----
  function studentItems() {
    const s = S();
    const cls = new Map(s.classes.map(c => [c.id, c.name]));
    return s.students.slice().sort((a, b) => String(cls.get(a.classId) || '').localeCompare(String(cls.get(b.classId) || '')) || E.studentFull(a).localeCompare(E.studentFull(b)))
      .map(st => ({ id: st.id, label: E.studentFull(st), group: cls.get(st.classId) || 'ללא כיתה' }));
  }
  function staffItems() {
    return S().staff.slice().sort((a, b) => (a.role || '').localeCompare(b.role || '') || a.name.localeCompare(b.name))
      .map(st => ({ id: st.id, label: st.name, group: E.ROLES[st.role] || 'אחר' }));
  }
  function classItems(kind) {
    return S().classes.filter(c => !kind || c.kind === kind).map(c => ({ id: c.id, label: c.name, group: c.kind === 'regular' ? 'כיתות רגילות' : 'כיתות חינוך מיוחד' }));
  }

  function nameOf(kind, id) {
    const s = S();
    if (kind === 'student') return E.studentFull(s.students.find(x => x.id === id));
    if (kind === 'staff') return (s.staff.find(x => x.id === id) || {}).name || '';
    if (kind === 'class' || kind === 'sped' || kind === 'regular') return (s.classes.find(x => x.id === id) || {}).name || '';
    if (kind === 'room') return (s.rooms.find(x => x.id === id) || {}).name || '';
    if (kind === 'activity') return E.actLabel(null, s.activities.find(x => x.id === id));
    return '';
  }

  function slotText(sl) { return 'יום ' + E.DAY_NAMES[sl.day] + ' ' + E.fmtRange(sl.start, sl.end); }

  /** חלון תצוגת מערכת שעות עם הדפסה/ייצוא */
  function openTimetable(kind, id, range) {
    const req = { kind, id, range: range || { mode: 'week' }, options: { showNames: kind !== 'student' } };
    const v = root.Views.build(S(), req);
    const m = modal(v.heading.title, '<div class="tt-preview">' + root.Render.viewHtml(v) + '</div>', [
      { label: '🖨️ הדפסה / PDF', cls: 'pri', onClick: () => { root.Render.printViews([v]); return false; } },
      { label: '📗 Excel', onClick: () => { root.Render.excelViews([v]); return false; } },
      { label: '📘 Word', onClick: () => { root.Render.wordViews([v]); return false; } },
      { label: 'אפשרויות נוספות', onClick: () => { root.App.go('export', { kind, id }); } },
      { label: 'סגירה' }
    ], { wide: true });
    return m;
  }

  /** הצגת אפשרויות "מינימום שינויים" עם כפתור ביצוע */
  function optionsList(opts, onApply) {
    if (!opts.length) return '<div class="alert bad">לא נמצאה אפשרות שיבוץ, גם עם הזזת 2 מפגשים. נסו לשנות אילוצים (ימים, חלון זמן, משך) או להוסיף זמינות לאיש הצוות.</div>';
    return opts.map((o, i) => '<div class="opt"><div class="row"><span class="pill ' + (o.changes ? 'n' : 'z') + '">' + (o.changes || 0) + '</span><b>' + esc(slotText(o)) + '</b>' +
      '<span class="muted small">' + (o.changes ? 'דורש ' + o.changes + ' שינויים' : 'ללא שינויים') + (o.cost ? ' · עלות ' + Math.round(o.cost * 10) / 10 : '') + '</span>' +
      '<button class="sm pri right" data-apply-opt="' + i + '">בצע</button></div>' +
      (o.moves && o.moves.length ? '<div class="moves">' + o.moves.map(mv => '↪ להזיז את "' + esc(mv.title) + '" מ' + esc(slotText(mv.from)) + ' ל' + esc(slotText(mv.to))).join('<br>') + '</div>' : '') +
      (o.soft && o.soft.length ? '<div class="moves muted">⚠ ' + summarizeSoft(o.soft).map(esc).join(' · ') + '</div>' : '') + '</div>').join('');
  }
  /** איחוד הערות: "6 תלמידים יפספסו X" במקום שורה לכל תלמיד */
  function summarizeSoft(soft) {
    const groups = new Map(); const out = [];
    for (const x of soft) {
      if (x.entity === 'student' && x.sessionId) {
        const k = x.sessionId + '|' + x.reason.replace(/^.*? (יפספס|יהיה ב)/, '$1');
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(x);
      } else out.push(x.reason);
    }
    for (const [k, list] of groups) {
      if (list.length <= 2) list.forEach(x => out.push(x.reason));
      else out.push(list.length + ' תלמידים ' + k.split('|')[1].replace(/^יפספס/, 'יפספסו').replace(/^יהיה ב/, 'יהיו ב'));
    }
    return out;
  }
  function bindOptions(el, opts, onApply) {
    $$('[data-apply-opt]', el).forEach(b => b.onclick = () => onApply(opts[Number(b.dataset.applyOpt)]));
  }

  /** החלת אפשרות (מיקום + הזזות) על המצב */
  function applyOption(state, activityId, sessionId, o) {
    for (const mv of (o.moves || [])) {
      const s = state.sessions.find(x => x.id === mv.sessionId);
      if (s) { s.day = mv.to.day; s.start = mv.to.start; s.end = mv.to.end; }
    }
    if (sessionId) {
      const s = state.sessions.find(x => x.id === sessionId);
      if (s) { s.day = o.day; s.start = o.start; s.end = o.end; }
    } else {
      const a = state.activities.find(x => x.id === activityId);
      state.sessions.push({ id: E.uid('ses'), activityId, day: o.day, start: o.start, end: o.end, weekPattern: (a && a.weekPattern) || 'all' });
    }
  }

  function hours(min) { return min == null ? '' : (Math.round(min / 6) / 10) + ' ש\''; }

  root.UI = { esc, $, $$, S, toast, modal, confirmBox, options, dayOptions, timeInput, multiPick, bindPickers, winsEditor, readForm, daysBoxes,
    studentItems, staffItems, classItems, nameOf, slotText, openTimetable, optionsList, bindOptions, applyOption, hours, summarizeSoft };
})(window);
