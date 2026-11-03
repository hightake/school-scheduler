/* לוח שיבוץ: תצוגה שבועית, גרירה, שיבוץ אוטומטי, חלופות עם מינימום שינויים */
(function (root) {
  'use strict';
  const E = root.Engine, U = root.UI, Store = root.Model.Store;
  const { esc, $, $$, S, modal, toast, options } = U;
  const P = root.Pages = root.Pages || {};
  const PX = 1.5; // פיקסלים לדקה

  function relevantFilter(ctx, f) {
    if (!f || !f.kind || !f.id) return () => true;
    return (s, a) => {
      const studs = E.studentsOf(ctx, a);
      if (f.kind === 'class') {
        const members = ctx.classMembers.get(f.id) || [];
        const c = ctx.classes.get(f.id);
        return (a.classIds || []).includes(f.id) || a.destClassId === f.id || studs.some(x => members.includes(x)) || (c && c.teacherId && (a.staffIds || []).includes(c.teacherId));
      }
      if (f.kind === 'staff') return (a.staffIds || []).includes(f.id);
      if (f.kind === 'student') return studs.includes(f.id);
      if (f.kind === 'room') return a.roomId === f.id;
      if (f.kind === 'type') return a.type === f.id;
      return true;
    };
  }

  P.board = function (main) {
    const s = S();
    const mem = root.App.mem;
    const f = mem.boardFilter || (mem.boardFilter = { kind: s.classes[0] ? 'class' : '', id: s.classes[0] ? s.classes[0].id : '' });
    const pat = mem.boardPattern || 'all';
    const ctx = E.makeCtx(s);
    const rel = relevantFilter(ctx, f);
    const conflicts = E.allConflicts(s);
    const confIds = new Set(conflicts.flatMap(c => [c.sessionId, c.otherSessionId]).filter(Boolean));
    const cov = E.coverage(s).filter(c => c.missing > 0);
    const covRel = cov.filter(c => { const a = ctx.act.get(c.activityId); return a && rel(null, a); });

    let filterOpts = '<option value="">— הכל —</option>';
    const grp = (label, kind, items) => { if (!items.length) return; filterOpts += '<optgroup label="' + label + '">' + items.map(it => '<option value="' + kind + ':' + esc(it.id) + '"' + (f.kind === kind && f.id === it.id ? ' selected' : '') + '>' + esc(it.label) + '</option>').join('') + '</optgroup>'; };
    grp('כיתות', 'class', s.classes.map(c => ({ id: c.id, label: c.name })));
    grp('צוות', 'staff', s.staff.map(c => ({ id: c.id, label: c.name })));
    grp('תלמידים', 'student', U.studentItems());
    grp('חדרים', 'room', s.rooms.map(c => ({ id: c.id, label: c.name })));
    grp('סוג פעילות', 'type', Object.entries(E.TYPES).map(([k, t]) => ({ id: k, label: t.label })));

    main.innerHTML = '<h1>לוח שיבוץ</h1><div class="toolbar"><label>תצוגה: <select id="flt">' + filterOpts + '</select></label>' +
      (s.settings.abWeeks ? '<select id="pat">' + options([{ value: 'all', label: 'כל השבועות' }, { value: 'A', label: 'שבוע א' }, { value: 'B', label: 'שבוע ב' }], pat) + '</select>' : '') +
      '<button class="pri" id="auto">שיבוץ אוטומטי</button><button id="addS">+ מפגש ידני</button>' +
      (f.kind ? '<button id="tt">מערכת להדפסה</button>' : '') + '<label class="row small"><input type="checkbox" id="dimOthers"' + (mem.dim ? ' checked' : '') + '> הצג גם אחרים (מעומעם)</label></div>' +
      (conflicts.length ? '<div class="alert bad">' + conflicts.length + ' התנגשויות – מסומנות במסגרת אדומה. <a href="#" id="showConf">הצג</a></div>' : '') +
      (covRel.length ? '<div class="card"><b>ממתינים לשיבוץ:</b> <span class="muted small">(לחיצה = חיפוש מקום עם מינימום שינויים; ניתן גם לגרור ללוח)</span><div class="tray" style="margin-top:6px">' + covRel.map(c => { const a = ctx.act.get(c.activityId); return '<span class="chip warn" draggable="true" data-need="' + c.activityId + '">' + U.dot(a) + esc(c.title) + ' ×' + c.missing + '</span>'; }).join('') + '</div></div>' : '') +
      '<div class="legend" style="margin-bottom:8px">' + root.Views.legend().map(l => '<span><i class="dot" style="background:' + l.color + '"></i>' + esc(l.label) + '</span>').join('') + '</div>' +
      '<div class="board-wrap"><div class="board" id="board"></div></div><p class="muted small">טיפ: גררו מפגש כדי להזיז אותו (המערכת תבדוק התנגשויות ותציע פתרון), לחצו על מפגש לעריכה/חלופות, לחצו על משבצת ריקה להוספה.</p>';

    $('#flt').onchange = e => { const [k, id] = e.target.value.split(':'); mem.boardFilter = { kind: k || '', id: id || '' }; P.board(main); };
    const pe = $('#pat'); if (pe) pe.onchange = e => { mem.boardPattern = e.target.value; P.board(main); };
    $('#dimOthers').onchange = e => { mem.dim = e.target.checked; P.board(main); };
    $('#auto').onclick = autoDialog;
    $('#addS').onclick = () => addSessionDialog({});
    const tt = $('#tt'); if (tt) tt.onclick = () => U.openTimetable(f.kind === 'class' ? (ctx.classes.get(f.id).kind === 'regular' ? 'regular' : 'sped') : f.kind, f.id);
    const sc = $('#showConf'); if (sc) sc.onclick = e => { e.preventDefault(); modal('התנגשויות', conflicts.map(c => '<div class="alert bad">יום ' + E.DAY_NAMES[c.day] + ' ' + c.time + ' – <b>' + esc(c.title) + '</b>: ' + esc(c.reason) + ' <button class="sm" data-ses="' + c.sessionId + '">טיפול</button></div>').join(''), null, { wide: true }); $$('[data-ses]').forEach(b => b.onclick = () => sessionDialog(b.dataset.ses)); };
    $$('[data-need]', main).forEach(ch => {
      ch.onclick = () => P.findSlotDialog(ch.dataset.need);
      ch.ondragstart = ev => { ev.dataTransfer.setData('text/plain', 'need:' + ch.dataset.need); };
    });

    drawBoard($('#board'), s, ctx, rel, pat, confIds, mem.dim);
  };

  function drawBoard(el, s, ctx, rel, pat, confIds, dim) {
    const days = s.settings.days;
    let t0 = Infinity, t1 = -Infinity;
    days.forEach(d => { const b = E.dayBounds(ctx, d); if (b) { t0 = Math.min(t0, b.start); t1 = Math.max(t1, b.end); } });
    s.sessions.forEach(x => { t0 = Math.min(t0, x.start); t1 = Math.max(t1, x.end); });
    if (!isFinite(t0)) { t0 = 480; t1 = 960; }
    t0 = Math.floor(t0 / 30) * 30; t1 = Math.ceil(t1 / 30) * 30;
    const H = (t1 - t0) * PX;
    el.style.gridTemplateColumns = '64px repeat(' + days.length + ', minmax(130px, 1fr))';
    let h = '<div class="bh">שעה</div>' + days.map(d => '<div class="bh">' + E.DAY_NAMES[d] + '</div>').join('');
    h += '<div class="axis" style="height:' + H + 'px">';
    for (let t = t0; t < t1; t += 30) h += '<div style="top:' + ((t - t0) * PX) + 'px">' + E.fmt(t) + '</div>';
    h += '</div>';
    for (const d of days) {
      h += '<div class="col" data-day="' + d + '" style="height:' + H + 'px">';
      for (const p of (ctx.periodsByDay[d] || [])) {
        h += '<div class="band ' + (E.isBreak(p) ? 'brk' : '') + '" style="top:' + ((p.start - t0) * PX) + 'px;height:' + ((p.end - p.start) * PX) + 'px"><span>' + esc(p.label || '') + '</span></div>';
      }
      // מפגשים
      const list = s.sessions.filter(x => Number(x.day) === d && (pat === 'all' || !x.weekPattern || x.weekPattern === 'all' || x.weekPattern === pat))
        .map(x => ({ x, a: ctx.act.get(x.activityId) })).filter(o => o.a).map(o => Object.assign(o, { on: rel(o.x, o.a) })).filter(o => o.on || dim)
        .sort((p, q) => p.x.start - q.x.start || q.x.end - p.x.end);
      // חלוקה לנתיבים
      const lanes = []; const groups = []; let g = null, gEnd = -1;
      for (const o of list) {
        if (!g || o.x.start >= gEnd) { g = []; groups.push(g); gEnd = -1; }
        g.push(o); gEnd = Math.max(gEnd, o.x.end);
        let li = lanes.findIndex(e => e <= o.x.start); if (li < 0) { li = lanes.length; lanes.push(0); }
        lanes[li] = o.x.end; o.lane = li;
      }
      for (const grp of groups) {
        const n = Math.max(...grp.map(o => o.lane)) + 1;
        for (const o of grp) {
          const a = o.a, x = o.x, t = E.typeOf(a);
          const studs = E.studentsOf(ctx, a);
          const who = (a.classIds || []).length ? (a.classIds || []).map(c => (ctx.classes.get(c) || {}).name).join(', ') : studs.slice(0, 4).map(id => E.studentShort(ctx.students.get(id))).join(', ') + (studs.length > 4 ? '…' : '');
          h += '<div class="blk' + (confIds.has(x.id) ? ' conflict' : '') + (x.locked ? ' locked' : '') + (o.on ? '' : ' dim') + '" draggable="' + (!x.locked) + '" data-ses="' + x.id + '" title="' + esc(E.actLabel(ctx, a) + ' ' + E.fmtRange(x.start, x.end) + '\n' + E.staffNames(ctx, a.staffIds) + '\n' + who) + '" style="top:' + ((x.start - t0) * PX) + 'px;height:' + Math.max(16, (x.end - x.start) * PX - 2) + 'px;right:calc(' + (o.lane * 100 / n) + '% + 1px);width:calc(' + (100 / n) + '% - 2px);background:' + esc(a.color || t.color) + '">' +
            '<b>' + esc(E.actLabel(ctx, a)) + (x.weekPattern && x.weekPattern !== 'all' ? ' (' + x.weekPattern + ')' : '') + '</b><div class="t">' + E.fmtRange(x.start, x.end) + '</div><div class="t">' + esc(E.staffNames(ctx, a.staffIds)) + '</div><div class="t">' + esc(who) + '</div></div>';
        }
      }
      h += '</div>';
    }
    el.innerHTML = h;

    // אירועים
    $$('.blk', el).forEach(b => {
      b.onclick = e => { e.stopPropagation(); sessionDialog(b.dataset.ses); };
      b.ondragstart = ev => { ev.dataTransfer.setData('text/plain', 'ses:' + b.dataset.ses); ev.dataTransfer.effectAllowed = 'move'; };
    });
    $$('.col', el).forEach(col => {
      const day = Number(col.dataset.day);
      const minuteAt = ev => t0 + Math.round(((ev.clientY - col.getBoundingClientRect().top) / PX) / 5) * 5;
      let ghost = null;
      col.ondragover = ev => {
        ev.preventDefault();
        const m = minuteAt(ev);
        if (!ghost) { ghost = document.createElement('div'); ghost.className = 'drop-ghost'; col.appendChild(ghost); }
        ghost.style.top = ((m - t0) * PX) + 'px'; ghost.style.height = (30 * PX) + 'px'; ghost.textContent = E.fmt(m);
      };
      col.ondragleave = () => { if (ghost) { ghost.remove(); ghost = null; } };
      col.ondrop = ev => {
        ev.preventDefault(); if (ghost) { ghost.remove(); ghost = null; }
        const data = ev.dataTransfer.getData('text/plain');
        const m = minuteAt(ev);
        if (data.startsWith('ses:')) dropSession(data.slice(4), day, m);
        if (data.startsWith('need:')) dropNew(data.slice(5), day, m);
      };
      col.onclick = ev => { if (ev.target.closest('.blk')) return; const m = minuteAt(ev); addSessionDialog({ day, start: snapStart(ctx, null, day, m) }); };
    });
  }

  /** הצמדה לתחילת שיעור / תת-משבצת קרובה */
  function snapStart(ctx, a, day, m) {
    if (a && a.alignToPeriods === false) return Math.round(m / (ctx.granularity || 5)) * (ctx.granularity || 5);
    const cands = a ? E.candidateSlots(ctx, Object.assign({}, a, { allowedDays: [day] })).map(c => c.start) : (ctx.periodsByDay[day] || []).map(p => p.start);
    if (!cands.length) return Math.round(m / 5) * 5;
    let best = cands[0];
    for (const c of cands) if (Math.abs(c - m) < Math.abs(best - m)) best = c;
    return Math.abs(best - m) <= 20 ? best : Math.round(m / 5) * 5;
  }

  function durOf(ctx, a, day, start) {
    if (a.duration) return Number(a.duration);
    const p = (ctx.periodsByDay[day] || []).find(q => q.start === start) || (ctx.periodsByDay[day] || []).find(q => start >= q.start && start < q.end);
    return p ? p.end - start : 45;
  }

  function dropSession(sid, day, m) {
    const s = S(); const ctx = E.makeCtx(s);
    const ses = s.sessions.find(x => x.id === sid); if (!ses) return;
    const a = ctx.act.get(ses.activityId);
    const start = snapStart(ctx, a, day, m);
    const end = start + (ses.end - ses.start);
    tryPlace({ activityId: a.id, sessionId: sid, day, start, end, weekPattern: ses.weekPattern });
  }
  function dropNew(aid, day, m) {
    const s = S(); const ctx = E.makeCtx(s);
    const a = ctx.act.get(aid);
    const start = snapStart(ctx, a, day, m);
    tryPlace({ activityId: aid, day, start, end: start + durOf(ctx, a, day, start), weekPattern: a.weekPattern || 'all' });
  }

  /** ניסיון שיבוץ במקום מסוים – עם הצגת התנגשויות ופתרון מינימום שינויים */
  function tryPlace(c) {
    const s = S(); const ctx = E.makeCtx(s);
    const a = ctx.act.get(c.activityId);
    const ev = E.evaluate(ctx, c, { ignore: new Set(c.sessionId ? [c.sessionId] : []) });
    const apply = (o) => Store.change(c.sessionId ? 'הזזת מפגש' : 'שיבוץ מפגש', state => U.applyOption(state, c.activityId, c.sessionId, o));
    if (!ev.hard.length) {
      apply({ day: c.day, start: c.start, end: c.end, moves: [] });
      toast('' + E.actLabel(ctx, a) + ' – ' + U.slotText(c) + (ev.soft.length ? ' (' + ev.soft.length + ' הערות)' : ''));
      return;
    }
    const exact = ev.hard.every(h => h.sessionId && !h.locked) ? E.findWithMinimalChanges(s, a, { ctx, sessionId: c.sessionId, near: { day: c.day, start: c.start, end: c.end, exact: true }, maxChanges: 3, limit: 1 })[0] : null;
    const alts = E.findWithMinimalChanges(s, a, { ctx, sessionId: c.sessionId, near: { day: c.day, start: c.start }, maxChanges: 2, limit: 8 });
    const opts = (exact && exact.changes !== Infinity ? [exact] : []).concat(alts.filter(o => !(exact && o.day === exact.day && o.start === exact.start)));
    const body = '<div class="alert bad"><b>לא ניתן לשבץ את "' + esc(E.actLabel(ctx, a)) + '" ב' + esc(U.slotText(c)) + ':</b><ul>' + ev.hard.map(h => '<li>' + esc(h.reason) + '</li>').join('') + '</ul></div>' +
      (exact && exact.changes !== Infinity ? '<h3>אפשר בדיוק בזמן הזה – אם מזיזים:</h3>' : '<h3>חלופות קרובות (ממוינות לפי מספר שינויים וקרבה):</h3>') +
      U.optionsList(opts);
    const m = modal('בדיקת שיבוץ', body, [
      { label: 'לשבץ בכל זאת (עם התנגשות)', cls: 'danger', onClick: () => { apply({ day: c.day, start: c.start, end: c.end, moves: [] }); } },
      { label: 'ביטול' }], { wide: true });
    U.bindOptions(m, opts, o => { apply(o); m.close(); toast('בוצע' + (o.changes ? ' – הוזזו ' + o.changes + ' מפגשים' : '')); });
  }
  P.tryPlace = tryPlace;

  /** חיפוש מקום לפעילות (מפגש חדש) */
  P.findSlotDialog = function (activityId, sessionId) {
    const s = S(); const ctx = E.makeCtx(s);
    const a = ctx.act.get(activityId);
    const opts = E.findWithMinimalChanges(s, a, { ctx, sessionId, maxChanges: 2, limit: 15 });
    const m = modal((sessionId ? 'חלופות עבור: ' : 'מקום עבור: ') + E.actLabel(ctx, a), '<p class="muted">המועדים ממוינים: קודם ללא שינויים בכלל, אח"כ לפי מספר המפגשים שצריך להזיז, ואז לפי "עלות" (כמה תלמידים מפספסים שיעורים וכו\').</p>' + U.optionsList(opts), null, { wide: true });
    U.bindOptions(m, opts, o => { Store.change('שיבוץ', state => U.applyOption(state, activityId, sessionId, o)); m.close(); toast('שובץ: ' + U.slotText(o)); });
  };

  function sessionDialog(sid) {
    const s = S(); const ctx = E.makeCtx(s);
    const x = s.sessions.find(q => q.id === sid); if (!x) return;
    const a = ctx.act.get(x.activityId);
    const ev = E.evaluate(ctx, x, { ignore: new Set([x.id]) });
    const studs = E.studentsOf(ctx, a);
    const body = '<div class="row"><span class="chip">' + esc(E.typeOf(a).label) + '</span>' + (x.locked ? '<span class="chip">נעול</span>' : '') + '<b>' + esc(U.slotText(x)) + '</b></div>' +
      '<p><b>צוות:</b> ' + esc(E.staffNames(ctx, a.staffIds) || '—') + '<br><b>משתתפים:</b> ' + esc(studs.map(id => E.studentShort(ctx.students.get(id))).join(', ') || '—') + (a.roomId ? '<br><b>חדר:</b> ' + esc(U.nameOf('room', a.roomId)) : '') + '</p>' +
      (ev.hard.length ? '<div class="alert bad"><b>התנגשויות:</b><ul>' + ev.hard.map(h => '<li>' + esc(h.reason) + '</li>').join('') + '</ul></div>' : '<div class="alert ok">אין התנגשויות</div>') +
      (ev.soft.length ? '<div class="alert warn"><b>הערות:</b><ul>' + ev.soft.map(h => '<li>' + esc(h.reason) + '</li>').join('') + '</ul></div>' : '') +
      '<h3>שינוי מועד</h3><div class="form-grid"><label><span>יום</span><select data-f="day">' + U.dayOptions(x.day) + '</select></label><label><span>התחלה</span>' + U.timeInput('start', x.start) + '</label><label><span>סיום</span>' + U.timeInput('end', x.end) + '</label>' +
      (s.settings.abWeeks ? '<label><span>שבועות</span><select data-f="weekPattern">' + options([{ value: 'all', label: 'כל שבוע' }, { value: 'A', label: 'שבוע א' }, { value: 'B', label: 'שבוע ב' }], x.weekPattern || 'all') + '</select></label>' : '') +
      '<label class="row"><input type="checkbox" data-f="locked"' + (x.locked ? ' checked' : '') + '> נעול (שיבוץ אוטומטי לא יזיז)</label></div>';
    modal(E.actLabel(ctx, a), body, [
      { label: 'שמירה', cls: 'pri', onClick: el => {
        const d = U.readForm(el);
        if (!(d.end > d.start)) { toast('שעת סיום לא תקינה'); return false; }
        const moved = d.day !== x.day || d.start !== x.start || d.end !== x.end;
        if (moved) {
          Store.change('עדכון מפגש', state => { const q = state.sessions.find(z => z.id === sid); q.locked = d.locked; if (d.weekPattern) q.weekPattern = d.weekPattern; });
          tryPlace({ activityId: a.id, sessionId: sid, day: Number(d.day), start: d.start, end: d.end, weekPattern: d.weekPattern || x.weekPattern });
        } else Store.change('עדכון מפגש', state => { const q = state.sessions.find(z => z.id === sid); q.locked = d.locked; if (d.weekPattern) q.weekPattern = d.weekPattern; });
      } },
      { label: 'מצא חלופות', onClick: () => { P.findSlotDialog(a.id, sid); } },
      { label: 'עריכת הפעילות', onClick: () => { root.Pages.editActivity(a.id); } },
      { label: 'מחיקת מפגש', cls: 'danger', onClick: () => { Store.change('מחיקת מפגש', state => { state.sessions = state.sessions.filter(z => z.id !== sid); }); } },
      { label: 'סגירה' }
    ]);
  }
  P.sessionDialog = sessionDialog;

  function addSessionDialog(pre) {
    const s = S();
    if (!s.activities.length) { toast('הגדירו קודם פעילויות'); root.App.go('activities'); return; }
    const ctx = E.makeCtx(s);
    const cnt = new Map(); s.sessions.forEach(x => cnt.set(x.activityId, (cnt.get(x.activityId) || 0) + 1));
    const list = s.activities.slice().sort((a, b) => ((cnt.get(a.id) || 0) >= (Number(a.perWeek) || 0)) - ((cnt.get(b.id) || 0) >= (Number(b.perWeek) || 0)) || a.title.localeCompare(b.title))
      .map(a => ({ value: a.id, label: a.title + ' – ' + ((a.classIds || []).map(c => U.nameOf('class', c)).join(', ') || E.studentsOf(ctx, a).map(id => E.studentShort(ctx.students.get(id))).slice(0, 3).join(', ')) + ' (' + (cnt.get(a.id) || 0) + '/' + (a.perWeek || 0) + ')' }));
    const m = modal('הוספת מפגש', '<div class="form-grid"><label class="full"><span>פעילות</span><select data-f="activityId">' + options(list, pre.activityId) + '</select></label>' +
      '<label><span>יום</span><select data-f="day">' + U.dayOptions(pre.day != null ? pre.day : s.settings.days[0]) + '</select></label><label><span>התחלה</span>' + U.timeInput('start', pre.start != null ? pre.start : 540) + '</label>' +
      '<label><span>משך (דקות, ריק = לפי הפעילות)</span><input type="number" step="5" data-f="dur"></label></div>', [
      { label: 'בדיקה ושיבוץ', cls: 'pri', onClick: el => {
        const d = U.readForm(el); const a = ctx.act.get(d.activityId); const day = Number(d.day);
        const dur = d.dur || durOf(ctx, a, day, d.start);
        tryPlace({ activityId: a.id, day, start: d.start, end: d.start + dur, weekPattern: a.weekPattern || 'all' });
      } },
      { label: 'הצע לי מועד', onClick: el => { const d = U.readForm(el); P.findSlotDialog(d.activityId); } },
      { label: 'ביטול' }]);
    return m;
  }

  function autoDialog() {
    const s = S();
    const missing = E.coverage(s).reduce((x, c) => x + c.missing, 0);
    modal('שיבוץ אוטומטי', '<p>המערכת תשבץ את כל המפגשים החסרים (' + missing + ') לפי האילוצים, ותנסה למזער: התנגשויות, יציאות של תלמידים משיעורים, שיבוץ בהפסקות, וריכוז יתר ביום אחד.</p>' +
      '<label class="row"><input type="radio" name="mode" value="keep" checked> להשאיר את השיבוץ הקיים ולהשלים רק את החסר</label>' +
      '<label class="row"><input type="radio" name="mode" value="rebuild"> לבנות מחדש את כל מה שלא נעול </label>' +
      '<label class="row"><input type="checkbox" id="protect"> לא להזיז מפגשים קיימים בכלל (גם לא לפינוי מקום)</label>' +
      '<label>מספר ניסיונות (יותר = טוב יותר, איטי יותר): <input type="number" id="iters" value="25" min="1" max="200" style="width:80px"></label><p class="muted small">טיפ: לפני שינוי גדול כדאי לשמור גרסה בהגדרות. בכל מקרה ניתן לבטל עם "ביטול".</p>', [
      { label: 'הפעלה', cls: 'pri', onClick: el => {
        const mode = $('input[name=mode]:checked', el).value;
        const iters = Number($('#iters', el).value) || 25;
        toast('משבץ...');
        setTimeout(() => {
          const t = Date.now();
          const r = E.autoSchedule(S(), { keepExisting: mode === 'keep', iterations: iters, protectExisting: $('#protect', el).checked, seed: Date.now() % 100000 });
          Store.change('שיבוץ אוטומטי', state => { state.sessions = r.sessions; });
          const body = '<div class="alert ' + (r.unplaced.length ? 'warn' : 'ok') + '">שובצו ' + r.placed.length + ' מפגשים' + (r.unplaced.length ? ', ' + r.unplaced.length + ' לא שובצו' : ' – הכל שובץ') + ' (' + ((Date.now() - t) / 1000).toFixed(1) + ' שנ\')</div>' +
            r.unplaced.map(u => '<div class="alert bad"><b>' + esc(u.title) + '</b>: ' + esc(u.reason) + ' <button class="sm" data-fs="' + u.activityId + '">מצא מקום</button></div>').join('');
          const m2 = modal('תוצאות השיבוץ', body);
          $$('[data-fs]', m2).forEach(b => b.onclick = () => P.findSlotDialog(b.dataset.fs));
        }, 30);
      } }, { label: 'ביטול' }]);
  }
  P.autoDialog = autoDialog;
})(window);
