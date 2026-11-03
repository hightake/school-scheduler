/* בניית מערכות שעות לתצוגה/הדפסה/ייצוא – מחזיר מבני נתונים, ללא HTML */
(function (root) {
  'use strict';
  const E = root.Engine;

  const KINDS = {
    student: 'מערכת שעות תלמיד',
    class: 'מערכת שעות כיתתית',
    sped: 'מערכת למחנך/ת חינוך מיוחד',
    regular: 'מערכת למורה בכיתה הרגילה',
    staff: 'מערכת איש צוות / מטפל',
    room: 'מערכת חדר'
  };

  function ctxWithOneOffs(state) {
    const ctx = E.makeCtx(state);
    for (const a of E.oneOffActivities(state)) ctx.act.set(a.id, a);
    return ctx;
  }

  /** עמודות לפי טווח */
  function columnsFor(state, range) {
    const days = state.settings.days || [0, 1, 2, 3, 4];
    const mode = range.mode || 'week';
    if (mode === 'day') return [[{ key: 'd' + range.day, label: 'יום ' + E.DAY_NAMES[range.day], day: Number(range.day) }]];
    if (mode === 'date') return [[dateCol(state, range.date)]];
    if (mode === 'month') {
      const [y, mo] = range.month.split('-').map(Number);
      const first = new Date(Date.UTC(y, mo - 1, 1));
      const last = new Date(Date.UTC(y, mo, 0));
      const pages = [];
      const cur = new Date(first); cur.setUTCDate(cur.getUTCDate() - cur.getUTCDay());
      while (cur <= last) {
        const cols = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(cur); d.setUTCDate(cur.getUTCDate() + i);
          if (d.getUTCMonth() !== mo - 1) continue;
          if (!days.includes(d.getUTCDay())) continue;
          cols.push(dateCol(state, E.dateStr(d)));
        }
        if (cols.length) pages.push(cols);
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
      return pages;
    }
    if (mode === 'weekOf') {
      const d0 = E.parseDate(range.date); d0.setUTCDate(d0.getUTCDate() - d0.getUTCDay());
      const cols = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(d0); d.setUTCDate(d0.getUTCDate() + i);
        if (days.includes(d.getUTCDay())) cols.push(dateCol(state, E.dateStr(d)));
      }
      return [cols];
    }
    const sel = (range.days && range.days.length) ? days.filter(d => range.days.map(Number).includes(d)) : days;
    return [sel.map(d => ({ key: 'd' + d, label: E.DAY_NAMES[d], day: d }))];
  }
  function dateCol(state, ds) {
    const dt = E.parseDate(ds);
    const day = dt.getUTCDay();
    const hol = E.holidayOf(state, ds);
    return { key: ds, date: ds, day, label: E.DAY_SHORT[day] + ' ' + dt.getUTCDate() + '/' + (dt.getUTCMonth() + 1), holiday: hol ? (hol.label || 'אין לימודים') : null, weekType: E.weekTypeOf(state, ds) };
  }

  function sessionsForCol(state, col, pattern) {
    if (col.date) return E.sessionsOnDate(state, col.date).sessions;
    return state.sessions.filter(s => Number(s.day) === col.day &&
      (!pattern || pattern === 'all' || !s.weekPattern || s.weekPattern === 'all' || s.weekPattern === pattern));
  }

  function namesFor(ctx, studentIds, members) {
    if (members && members.length && studentIds.length === members.length && members.every(m => studentIds.includes(m))) return 'כל הכיתה';
    if (members && members.length >= 4 && studentIds.length >= members.length * 0.6 && studentIds.every(s => members.includes(s))) {
      const missing = members.filter(m => !studentIds.includes(m)).map(m => E.studentShort(ctx.students.get(m)));
      return 'כל הכיתה חוץ מ: ' + missing.join(', ');
    }
    return studentIds.map(id => E.studentShort(ctx.students.get(id))).join(', ');
  }

  /** האם פעילות רלוונטית לתצוגה, ואיך להציג */
  function itemFor(ctx, kind, id, s, a, opts) {
    const studs = E.studentsOf(ctx, a);
    const t = E.typeOf(a);
    const base = {
      sessionId: s.id, start: s.start, end: s.end, title: E.actLabel(ctx, a), icon: a.icon || t.icon, color: a.color || t.color,
      type: a.type, layer: E.layerOf(a), pattern: s.weekPattern && s.weekPattern !== 'all' ? s.weekPattern : '',
      changed: !!s.changed, oneOff: !!s.oneOff, note: a.notes || '', room: a.roomId ? ((ctx.rooms.get(a.roomId) || {}).name || '') : ''
    };
    const staff = E.staffNames(ctx, a.staffIds);
    if (kind === 'student') {
      if (!studs.includes(id)) return null;
      return Object.assign(base, { sub: staff, names: '' });
    }
    if (kind === 'class' || kind === 'sped') {
      const cls = ctx.classes.get(id);
      const members = ctx.classMembers.get(id) || [];
      const inClass = studs.filter(x => members.includes(x));
      const direct = (a.classIds || []).includes(id);
      if (kind === 'class') {
        if (t.staffOnly) return null;
        const thr = opts.threshold != null ? opts.threshold : (ctx.settings.classThreshold || 0.6);
        if (!direct && !(members.length && inClass.length >= Math.ceil(members.length * thr))) return null;
        return Object.assign(base, { sub: staff, names: opts.showNames && !direct ? namesFor(ctx, inClass, members) : '' });
      }
      // sped – הכל: שיעורי כיתה, כל יציאה של תלמיד, הדרכות של המחנך
      const teacherHere = cls && cls.teacherId && (a.staffIds || []).includes(cls.teacherId);
      if (!direct && !inClass.length && !teacherHere) return null;
      return Object.assign(base, { sub: staff, names: inClass.length ? namesFor(ctx, inClass, members) : '', highlight: !direct && !!inClass.length });
    }
    if (kind === 'staff') {
      if (!(a.staffIds || []).includes(id)) return null;
      const clsNames = (a.classIds || []).map(c => (ctx.classes.get(c) || {}).name).filter(Boolean);
      const others = (a.staffIds || []).filter(x => x !== id).map(x => (ctx.staff.get(x) || {}).name).filter(Boolean);
      let names = '';
      if (clsNames.length) {
        const teacher = (a.classIds || []).map(c => (ctx.classes.get(c) || {}).teacherId).filter(Boolean).map(x => (ctx.staff.get(x) || {}).name).filter(Boolean);
        names = clsNames.join(', ') + (teacher.length && !teacher.includes((ctx.staff.get(id) || {}).name) ? ' – ' + teacher.join(', ') : '');
        const extra = (a.studentIds || []).map(x => E.studentShort(ctx.students.get(x))).filter(Boolean);
        if (extra.length) names += ' + ' + extra.join(', ');
      } else if (studs.length) names = studs.map(x => E.studentShort(ctx.students.get(x))).join(', ');
      return Object.assign(base, { sub: others.length ? 'עם ' + others.join(', ') : '', names });
    }
    if (kind === 'room') {
      if (a.roomId !== id) return null;
      return Object.assign(base, { sub: staff, names: studs.length <= 6 ? studs.map(x => E.studentShort(ctx.students.get(x))).join(', ') : studs.length + ' תלמידים' });
    }
    return null;
  }

  /** מסתיר שיעור כיתתי שהתלמיד יוצא ממנו לגמרי (בתצוגת תלמיד) */
  function hideCovered(items) {
    return items.filter(it => {
      const higher = items.filter(o => o !== it && o.layer > it.layer && E.overlaps(o.start, o.end, it.start, it.end)).sort((x, y) => x.start - y.start);
      let cur = it.start;
      for (const h of higher) { if (h.start > cur) break; cur = Math.max(cur, h.end); }
      return cur < it.end;
    });
  }

  function rowsFor(state, cols) {
    const map = new Map();
    for (const p of (state.settings.periods || [])) {
      if (p.days && p.days.length && !cols.some(c => p.days.includes(c.day))) continue;
      const k = p.start + '-' + p.end;
      if (!map.has(k)) map.set(k, { start: p.start, end: p.end, label: p.label || '', kind: p.kind || 'lesson', days: p.days || [] });
    }
    return Array.from(map.values()).sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function rowIndexFor(rows, it) {
    let best = -1, bestOv = 0;
    rows.forEach((r, i) => {
      const ov = Math.min(r.end, it.end) - Math.max(r.start, it.start);
      if (ov > bestOv || (ov === bestOv && ov > 0 && r.start <= it.start)) { best = i; bestOv = ov; }
    });
    if (best >= 0) {
      // עדיפות לשורה שבה מתחיל הפריט
      const startRow = rows.findIndex(r => it.start >= r.start && it.start < r.end && r.kind === 'lesson');
      if (startRow >= 0) return startRow;
    }
    return best;
  }

  function titleFor(ctx, kind, id) {
    if (kind === 'student') { const s = ctx.students.get(id); const c = s && ctx.classes.get(s.classId); return E.studentFull(s) + (c ? ' – ' + c.name : ''); }
    if (kind === 'class' || kind === 'sped' || kind === 'regular') { const c = ctx.classes.get(id); const t = c && ctx.staff.get(c.teacherId); return (c ? c.name : '') + (t ? ' – ' + t.name : ''); }
    if (kind === 'staff') return (ctx.staff.get(id) || {}).name || '';
    if (kind === 'room') return (ctx.rooms.get(id) || {}).name || '';
    return '';
  }

  function rangeLabel(range) {
    const m = range.mode || 'week';
    if (m === 'day') return 'יום ' + E.DAY_NAMES[range.day];
    if (m === 'date') return 'תאריך ' + fmtDate(range.date);
    if (m === 'weekOf') return 'שבוע של ' + fmtDate(range.date);
    if (m === 'month') { const [y, mo] = range.month.split('-'); return 'חודש ' + mo + '/' + y; }
    return 'מערכת שבועית';
  }
  function fmtDate(ds) { if (!ds) return ''; const [y, m, d] = ds.split('-'); return d + '/' + m + '/' + y; }

  /**
   * בניית מערכת
   * req: {kind, id, range:{mode, day, date, month, days, from, to}, pattern, options:{showNames, threshold, showRoutine}}
   */
  function build(state, req) {
    const ctx = ctxWithOneOffs(state);
    const kind = req.kind, id = req.id, range = req.range || { mode: 'week' }, opts = req.options || {};
    const set = state.settings;
    const heading = {
      top: set.headerLine || '',
      title: KINDS[kind] + ' – ' + titleFor(ctx, kind, id),
      sub: [set.institution, set.year ? 'שנה"ל ' + set.year : '', rangeLabel(range), req.pattern && req.pattern !== 'all' ? 'שבוע ' + req.pattern : ''].filter(Boolean).join(' · ')
    };
    if (kind === 'regular') return buildRegular(state, ctx, id, range, req, heading);

    const pages = columnsFor(state, range).map(cols => {
      let rows = rowsFor(state, cols);
      const cells = rows.map(() => cols.map(() => []));
      const extras = [];
      cols.forEach((col, ci) => {
        if (col.holiday) return;
        let items = [];
        for (const s of sessionsForCol(state, col, req.pattern)) {
          const a = ctx.act.get(s.activityId);
          if (!a) continue;
          const it = itemFor(ctx, kind, id, s, a, opts);
          if (it) items.push(it);
        }
        if (kind === 'student') items = hideCovered(items);
        items.sort((x, y) => x.start - y.start || x.layer - y.layer);
        for (const it of items) {
          if (range.from != null && range.to != null && !E.overlaps(it.start, it.end, range.from, range.to)) continue;
          const ri = rowIndexFor(rows, it);
          if (ri < 0) { extras.push({ it, ci }); continue; }
          const r = rows[ri];
          it.timeDiffers = it.start !== r.start || it.end !== r.end;
          cells[ri][ci].push(it);
        }
      });
      // פריטים מחוץ לשעות המוגדרות -> שורות נוספות
      for (const { it, ci } of extras) {
        let ri = rows.findIndex(r => r.start === it.start && r.end === it.end);
        if (ri < 0) {
          rows.push({ start: it.start, end: it.end, label: '', kind: 'extra' });
          rows.sort((a, b) => a.start - b.start);
          ri = rows.findIndex(r => r.start === it.start && r.end === it.end && r.kind === 'extra');
          cells.splice(ri, 0, cols.map(() => []));
        }
        it.timeDiffers = false;
        cells[ri][ci].push(it);
      }
      // סינון לפי שעות
      let keep = rows.map((r, i) => i);
      if (range.from != null && range.to != null) keep = keep.filter(i => E.overlaps(rows[i].start, rows[i].end, range.from, range.to));
      // הסתרת שורות ריקות לגמרי (לצוות/חדר)
      if (kind === 'staff' || kind === 'room' || opts.compact) keep = keep.filter(i => cells[i].some(c => c.length));
      rows = keep.map(i => rows[i]);
      const cells2 = keep.map(i => cells[i]);
      const showRoutine = opts.showRoutine !== false && (kind === 'student' || kind === 'class' || kind === 'sped');
      return { layout: 'grid', columns: cols, rows, cells: cells2, showRoutineLabels: showRoutine };
    });
    return { heading, pages, kind };
  }

  /** מורה בכיתה רגילה: רק הזמנים שבהם תלמיד השילוב נמצא בכיתה, ומתי ולאן הוא יוצא */
  function buildRegular(state, ctx, classId, range, req, heading) {
    const incl = state.activities.filter(a => a.type === 'inclusion' && (a.destClassId === classId || (a.classIds || []).includes(classId)));
    const pages = columnsFor(state, range).map(cols => {
      const presence = []; const exits = [];
      for (const col of cols) {
        if (col.holiday) continue;
        const sess = sessionsForCol(state, col, req.pattern);
        for (const s of sess) {
          const a = ctx.act.get(s.activityId);
          if (!a || !incl.includes(a)) continue;
          if (range.from != null && range.to != null && !E.overlaps(s.start, s.end, range.from, range.to)) continue;
          for (const sid of E.studentsOf(ctx, a)) {
            const st = ctx.students.get(sid);
            presence.push({ col: col.label, day: col.day, start: s.start, end: s.end, student: E.studentFull(st), what: E.actLabel(ctx, a) });
            for (const s2 of sess) {
              if (s2 === s || !E.overlaps(s.start, s.end, s2.start, s2.end)) continue;
              const a2 = ctx.act.get(s2.activityId);
              if (!a2 || E.layerOf(a2) <= E.layerOf(a) || !E.studentsOf(ctx, a2).includes(sid)) continue;
              exits.push({ col: col.label, day: col.day, start: Math.max(s.start, s2.start), end: Math.min(s.end, s2.end), student: E.studentFull(st), to: E.actLabel(ctx, a2), with: E.staffNames(ctx, a2.staffIds), icon: a2.icon || E.typeOf(a2).icon });
            }
          }
        }
      }
      const sorter = (x, y) => (cols.findIndex(c => c.label === x.col) - cols.findIndex(c => c.label === y.col)) || x.start - y.start || x.student.localeCompare(y.student);
      presence.sort(sorter); exits.sort(sorter);
      return {
        layout: 'list',
        sections: [
          { title: 'מתי התלמיד/ים נמצאים בכיתה', headers: ['יום', 'שעה', 'תלמיד', 'שיעור'], rows: presence.map(p => [p.col, E.fmtRange(p.start, p.end), p.student, p.what]) },
          { title: 'יציאות מהכיתה – לאן ועם מי', headers: ['יום', 'שעה', 'תלמיד', 'יוצא ל', 'עם'], rows: exits.map(x => [x.col, E.fmtRange(x.start, x.end), x.student, x.icon + ' ' + x.to, x.with]), empty: 'אין יציאות מהכיתה בזמנים אלו' }
        ]
      };
    });
    return { heading, pages, kind: 'regular' };
  }

  /** מקרא סוגי פעילויות */
  function legend() {
    return Object.entries(E.TYPES).map(([k, t]) => ({ type: k, label: t.label, color: t.color, icon: t.icon }));
  }

  root.Views = { KINDS, build, legend, columnsFor, fmtDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Views;
})(typeof window !== 'undefined' ? window : globalThis);
