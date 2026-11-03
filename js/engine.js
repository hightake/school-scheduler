/*
 * מנוע השיבוץ – לוגיקה טהורה ללא תלות בדפדפן (ניתן להרצה גם ב-Node לבדיקות).
 * כל הזמנים נשמרים בדקות מחצות (למשל 08:30 => 510).
 *
 * מודל "שכבות" לתלמיד:
 *   שכבה 0 – כיתת האם (שיעורים כיתתיים, שגרה)
 *   שכבה 1 – שילוב בכיתה רגילה (התלמיד יוצא מכיתת האם לכיתה הרגילה)
 *   שכבה 2 – יציאה לטיפול / עזרה / חוג (התלמיד יוצא מכל מקום שבו הוא נמצא)
 * בכל רגע התלמיד נמצא בפעילות שבשכבה הגבוהה ביותר.
 * חפיפה באותה שכבה = התנגשות קשה. יציאה משיעור "מוגן" = התנגשות קשה.
 * יציאה משיעור רגיל = "עלות" (התלמיד מפספס) – מותר אך המערכת תעדיף להימנע.
 */
(function (root) {
  'use strict';

  const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const DAY_SHORT = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

  const TYPES = {
    lesson:    { label: 'שיעור כיתתי',             layer: 0, color: '#dbeafe', icon: '📘' },
    routine:   { label: 'שגרה (תפילה/ארוחה/הפסקה)', layer: 0, color: '#f1f5f9', icon: '🍎', protected: true },
    inclusion: { label: 'שילוב בכיתה רגילה',        layer: 1, color: '#dcfce7', icon: '🏫' },
    therapy:   { label: 'טיפול',                    layer: 2, color: '#fef3c7', icon: '💬' },
    help:      { label: 'עזרה / תגבור פרטני',       layer: 2, color: '#ffedd5', icon: '✏️' },
    group:     { label: 'חוג / קבוצה',              layer: 2, color: '#fae8ff', icon: '🎯' },
    guidance:  { label: 'הדרכת צוות',               layer: 2, color: '#e0e7ff', icon: '🧭', staffOnly: true },
    meeting:   { label: 'ישיבת צוות',               layer: 2, color: '#e2e8f0', icon: '👥', staffOnly: true },
    other:     { label: 'אחר',                      layer: 2, color: '#f5f5f4', icon: '📌' }
  };

  const ROLES = {
    sped: 'מחנך/ת חינוך מיוחד',
    regular: 'מורה בכיתה רגילה',
    therapist: 'מטפל/ת',
    teacher: 'מורה מקצועי/ת',
    guide: 'מדריך/ה',
    assistant: 'סייע/ת',
    admin: 'הנהלה',
    other: 'אחר'
  };

  // ---------- עזרי זמן ----------
  function toMin(v) {
    if (typeof v === 'number') return v;
    if (!v) return null;
    const m = String(v).trim().match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function fmt(m) {
    if (m == null || isNaN(m)) return '';
    const h = Math.floor(m / 60), mm = m % 60;
    return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }
  function fmtRange(s, e) { return fmt(s) + '-' + fmt(e); }
  function overlaps(s1, e1, s2, e2) { return s1 < e2 && s2 < e1; }
  function patternsMeet(p1, p2) {
    p1 = p1 || 'all'; p2 = p2 || 'all';
    return p1 === 'all' || p2 === 'all' || p1 === p2;
  }

  // ---------- עזרי ישויות ----------
  function typeOf(a) { return TYPES[a && a.type] || TYPES.other; }
  function layerOf(a) {
    if (a && a.layer != null && a.layer !== '') return Number(a.layer);
    return typeOf(a).layer;
  }
  function isProtected(a) {
    if (a && a.protected != null) return !!a.protected;
    return !!typeOf(a).protected;
  }
  function studentShort(st) {
    if (!st) return '';
    const f = (st.firstName || '').trim();
    const l = (st.lastName || '').trim();
    return l ? f + ' ' + l[0] + '.' : f;
  }
  function studentFull(st) { return st ? ((st.firstName || '') + ' ' + (st.lastName || '')).trim() : ''; }

  // ---------- הקשר (אינדקס) ----------
  function makeCtx(state) {
    const s = state.settings || {};
    const ctx = {
      state,
      settings: s,
      act: new Map(), staff: new Map(), students: new Map(), classes: new Map(), rooms: new Map(),
      classMembers: new Map(), actStudents: new Map(), periodsByDay: {}, days: s.days || [0, 1, 2, 3, 4],
      granularity: s.granularity || 5
    };
    (state.staff || []).forEach(x => ctx.staff.set(x.id, x));
    (state.classes || []).forEach(x => { ctx.classes.set(x.id, x); ctx.classMembers.set(x.id, []); });
    (state.rooms || []).forEach(x => ctx.rooms.set(x.id, x));
    (state.students || []).forEach(x => {
      ctx.students.set(x.id, x);
      if (x.classId && ctx.classMembers.has(x.classId)) ctx.classMembers.get(x.classId).push(x.id);
    });
    (state.activities || []).forEach(a => ctx.act.set(a.id, a));
    ctx.days.forEach(d => {
      ctx.periodsByDay[d] = (s.periods || [])
        .filter(p => !p.days || p.days.length === 0 || p.days.includes(d))
        .slice().sort((a, b) => a.start - b.start);
    });
    return ctx;
  }

  function studentsOf(ctx, a) {
    if (!a) return [];
    if (a.id && ctx.actStudents.has(a.id) && !a.__virtual) return ctx.actStudents.get(a.id);
    const set = new Set(a.studentIds || []);
    (a.classIds || []).forEach(cid => (ctx.classMembers.get(cid) || []).forEach(sid => set.add(sid)));
    (a.excludeStudentIds || []).forEach(sid => set.delete(sid));
    const arr = Array.from(set).filter(id => ctx.students.has(id));
    if (a.id && !a.__virtual) ctx.actStudents.set(a.id, arr);
    return arr;
  }
  function staffOf(a) { return (a && a.staffIds) || []; }

  function dayBounds(ctx, day) {
    const ps = ctx.periodsByDay[day] || [];
    if (!ps.length) return null;
    return { start: Math.min.apply(null, ps.map(p => p.start)), end: Math.max.apply(null, ps.map(p => p.end)) };
  }

  function windowCovers(windows, day, start, end) {
    // windows: [{day,start,end}] – האם הטווח מכוסה במלואו ע"י חלונות (מאחדים חלונות רצופים)
    const ws = windows.filter(w => Number(w.day) === day).sort((a, b) => a.start - b.start);
    let cur = start;
    for (const w of ws) {
      if (w.start > cur) break;
      if (w.end > cur) cur = w.end;
      if (cur >= end) return true;
    }
    return cur >= end;
  }

  function sessionsByDay(sessions) {
    const map = {};
    for (const s of sessions) { (map[s.day] = map[s.day] || []).push(s); }
    return map;
  }

  function actLabel(ctx, a) {
    if (!a) return '';
    if (a.title) return a.title;
    return typeOf(a).label;
  }

  function staffNames(ctx, ids) {
    return (ids || []).map(id => (ctx.staff.get(id) || {}).name).filter(Boolean).join(', ');
  }

  // ---------- הערכת מועד מועמד ----------
  /**
   * cand: {activityId | activity, day, start, end, weekPattern}
   * opts: {sessions (מערך מפגשים לבדיקה), ignore:Set(sessionIds)}
   * מחזיר {hard:[], soft:[], cost}
   */
  function evaluate(ctx, cand, opts) {
    opts = opts || {};
    const sessions = opts.sessions || ctx.state.sessions || [];
    const ignore = opts.ignore || new Set();
    const a = cand.activity || ctx.act.get(cand.activityId);
    const hard = [], soft = [];
    if (!a) return { hard: [{ reason: 'פעילות לא קיימת' }], soft, cost: 0 };
    const day = Number(cand.day), start = cand.start, end = cand.end;
    const pat = cand.weekPattern || a.weekPattern || 'all';
    const t = typeOf(a);
    const layer = layerOf(a);
    const prot = isProtected(a);
    const studs = studentsOf(ctx, a);
    const staffIds = staffOf(a);

    if (!ctx.days.includes(day)) hard.push({ reason: 'יום ' + DAY_NAMES[day] + ' אינו יום לימודים' });
    if (a.allowedDays && a.allowedDays.length && !a.allowedDays.map(Number).includes(day))
      hard.push({ reason: 'הפעילות מוגבלת לימים: ' + a.allowedDays.map(d => DAY_NAMES[d]).join(', ') });
    if (a.windowStart != null && a.windowStart !== '' && start < a.windowStart)
      hard.push({ reason: 'מוקדם מחלון הזמן שהוגדר לפעילות (' + fmt(a.windowStart) + ')' });
    if (a.windowEnd != null && a.windowEnd !== '' && end > a.windowEnd)
      hard.push({ reason: 'מאוחר מחלון הזמן שהוגדר לפעילות (' + fmt(a.windowEnd) + ')' });

    const b = dayBounds(ctx, day);
    if (b && (start < b.start || end > b.end)) {
      if (t.staffOnly) soft.push({ cost: 1, reason: 'מחוץ לשעות הלימודים' });
      else hard.push({ reason: 'מחוץ לשעות הלימודים (' + fmtRange(b.start, b.end) + ')' });
    }

    // זמינות צוות
    for (const sid of staffIds) {
      const st = ctx.staff.get(sid);
      if (!st) continue;
      if (st.availability && st.availability.length && !windowCovers(st.availability, day, start, end))
        hard.push({ entity: 'staff', id: sid, reason: st.name + ' אינו/ה נמצא/ת במוסד בזמן זה' });
      for (const u of (st.unavailable || [])) {
        if (Number(u.day) === day && overlaps(start, end, u.start, u.end))
          hard.push({ entity: 'staff', id: sid, reason: st.name + ' חסום/ה: ' + (u.reason || fmtRange(u.start, u.end)) });
      }
    }
    // אילוצי תלמידים
    for (const sid of studs) {
      const st = ctx.students.get(sid);
      for (const u of (st.unavailable || [])) {
        if (Number(u.day) === day && overlaps(start, end, u.start, u.end))
          hard.push({ entity: 'student', id: sid, reason: studentFull(st) + ' לא זמין: ' + (u.reason || fmtRange(u.start, u.end)) });
      }
    }

    // הפסקות ויישור
    const ps = ctx.periodsByDay[day] || [];
    if (a.type !== 'routine' && !a.allowInBreak && !t.staffOnly) {
      for (const p of ps) {
        if (isBreak(p) && overlaps(start, end, p.start, p.end))
          soft.push({ cost: 3, reason: 'חופף ל"' + (p.label || 'הפסקה') + '"' });
      }
    }
    if (a.alignToPeriods !== false && ps.length && !ps.some(p => p.start === start))
      soft.push({ cost: 1, reason: 'לא מתחיל בתחילת שיעור' });
    if (a.alignToPeriods === false && start % 15 !== 0 && !ps.some(p => p.start === start || p.end === start))
      soft.push({ cost: 0.4, reason: 'שעת התחלה לא עגולה' });
    // חציית גבול בין שיעורים (למשל שיעור של 60 דק' במשבצת של 45)
    const startP = ps.find(p => start >= p.start && start < p.end);
    if (a.alignToPeriods !== false && startP && end > startP.end && !ps.some(p => p.end === end))
      soft.push({ cost: 2, reason: 'חוצה את גבול השיעור' });
    if (a.preferredDays && a.preferredDays.length && !a.preferredDays.map(Number).includes(day))
      soft.push({ cost: 1, reason: 'לא ביום מועדף' });
    if (a.preferredStart != null && a.preferredStart !== '' && Math.abs(a.preferredStart - start) > 0)
      soft.push({ cost: Math.min(3, Math.abs(a.preferredStart - start) / 60), reason: 'רחוק מהשעה המועדפת' });

    // השוואה מול מפגשים קיימים
    const staffDayMin = {}; const studPullsDay = {};
    let sameActSameDay = 0;
    for (const s of sessions) {
      if (ignore.has(s.id)) continue;
      if (Number(s.day) !== day) continue;
      const b2 = ctx.act.get(s.activityId);
      if (!b2) continue;
      if (!patternsMeet(pat, s.weekPattern || b2.weekPattern)) continue;
      // עומס יומי
      for (const sid of staffOf(b2)) staffDayMin[sid] = (staffDayMin[sid] || 0) + (s.end - s.start);
      if (b2.id === a.id) sameActSameDay++;
      if (layerOf(b2) === 2 && !typeOf(b2).staffOnly) {
        for (const x of studentsOf(ctx, b2)) studPullsDay[x] = (studPullsDay[x] || 0) + 1;
      }
      if (!overlaps(start, end, s.start, s.end)) continue;
      const otherLabel = actLabel(ctx, b2) + ' ' + fmtRange(s.start, s.end);

      // צוות
      for (const sid of staffIds) {
        if (staffOf(b2).includes(sid)) {
          hard.push({ entity: 'staff', id: sid, sessionId: s.id, locked: !!s.locked,
            reason: (ctx.staff.get(sid) || {}).name + ' כבר משובץ/ת ב"' + otherLabel + '"' });
        }
      }
      // חדר
      if (a.roomId && b2.roomId === a.roomId) {
        const room = ctx.rooms.get(a.roomId);
        if (!room || !(Number(room.capacity) > 1))
          hard.push({ entity: 'room', id: a.roomId, sessionId: s.id, locked: !!s.locked,
            reason: 'החדר ' + ((room && room.name) || '') + ' תפוס ע"י "' + otherLabel + '"' });
      }
      // תלמידים
      const others = studentsOf(ctx, b2);
      if (!studs.length || !others.length) continue;
      const otherSet = new Set(others);
      const lb = layerOf(b2);
      const pb = isProtected(b2);
      for (const sid of studs) {
        if (!otherSet.has(sid)) continue;
        const name = studentShort(ctx.students.get(sid));
        if (layer === lb) {
          hard.push({ entity: 'student', id: sid, sessionId: s.id, locked: !!s.locked,
            reason: name + ' כבר משובץ ב"' + otherLabel + '"' });
        } else if (layer > lb) {
          if (pb) hard.push({ entity: 'student', id: sid, sessionId: s.id, locked: !!s.locked,
            reason: name + ' – "' + otherLabel + '" מוגדר כמוגן (אין יציאה)' });
          else soft.push({ cost: lb === 1 ? 3 : 2, entity: 'student', id: sid, sessionId: s.id,
            reason: name + ' יפספס "' + otherLabel + '"' });
        } else {
          if (prot) hard.push({ entity: 'student', id: sid, sessionId: s.id, locked: !!s.locked,
            reason: name + ' יוצא בזמן זה ל"' + otherLabel + '" והשיעור מוגדר מוגן' });
          else soft.push({ cost: 2, entity: 'student', id: sid, sessionId: s.id,
            reason: name + ' יהיה ב"' + otherLabel + '" בזמן זה' });
        }
      }
    }

    if (sameActSameDay > 0 && !a.allowSameDay) soft.push({ cost: 4, reason: 'מפגש נוסף של אותה פעילות באותו יום' });
    if (layer === 2 && !t.staffOnly) {
      for (const sid of studs) {
        if ((studPullsDay[sid] || 0) >= 2) soft.push({ cost: 1, entity: 'student', id: sid,
          reason: studentShort(ctx.students.get(sid)) + ' כבר יוצא ' + studPullsDay[sid] + ' פעמים ביום זה' });
      }
    }
    for (const sid of staffIds) {
      const st = ctx.staff.get(sid);
      if (st && st.maxPerDay && (staffDayMin[sid] || 0) + (end - start) > st.maxPerDay)
        soft.push({ cost: 3, entity: 'staff', id: sid, reason: st.name + ' יעבור את המכסה היומית' });
    }

    const cost = soft.reduce((x, y) => x + (y.cost || 0), 0);
    return { hard, soft, cost };
  }

  // ---------- מועדים מועמדים ----------
  function candidateSlots(ctx, a) {
    const out = [];
    const days = (a.allowedDays && a.allowedDays.length) ? a.allowedDays.map(Number).filter(d => ctx.days.includes(d)) : ctx.days;
    for (const day of days) {
      const ps = (ctx.periodsByDay[day] || []);
      const b = dayBounds(ctx, day);
      if (!b) continue;
      const seen = new Set();
      const push = (start, end) => {
        const k = start + '-' + end;
        if (seen.has(k) || end <= start) return;
        seen.add(k); out.push({ day, start, end });
      };
      if (a.alignToPeriods !== false) {
        for (const p of ps) {
          if (isBreak(p) && a.type !== 'routine' && !a.allowInBreak) continue;
          const plen = p.end - p.start;
          const dur = Number(a.duration) || plen;
          if (dur <= plen) {
            // מפצלים את השיעור לתתי-משבצות בגודל הפעילות
            for (let st = p.start; st + dur <= p.end; st += dur) push(st, st + dur);
            if ((plen % dur) !== 0) push(p.end - dur, p.end);
          } else {
            push(p.start, p.start + dur);
          }
        }
      } else {
        const g = ctx.granularity;
        const dur = Number(a.duration) || 45;
        const from = t0(a.windowStart, b.start), to = t0(a.windowEnd, b.end);
        for (let st = from; st + dur <= to; st += g) push(st, st + dur);
      }
    }
    return out;
    function t0(v, d) { return (v == null || v === '') ? d : Number(v); }
  }

  function isBreak(p) { return p && (p.kind === 'break' || p.kind === 'routine'); }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  }

  // ---------- חיפוש מועדים פנויים ----------
  function findFreeSlots(state, activityOrId, opts) {
    opts = opts || {};
    const ctx = opts.ctx || makeCtx(state);
    const a = typeof activityOrId === 'string' ? ctx.act.get(activityOrId) : activityOrId;
    const ignore = new Set(opts.ignore || []);
    const sessions = opts.sessions || state.sessions;
    const res = [];
    for (const c of candidateSlots(ctx, a)) {
      const ev = evaluate(ctx, { activity: a, day: c.day, start: c.start, end: c.end, weekPattern: opts.weekPattern },
        { sessions, ignore });
      if (!ev.hard.length) res.push(Object.assign({}, c, { cost: ev.cost, soft: ev.soft }));
    }
    sortByTarget(res, opts.near);
    return res;
  }

  function sortByTarget(list, near) {
    list.sort((x, y) => {
      if (near) {
        const dx = distance(x, near), dy = distance(y, near);
        if (x.changes !== y.changes && x.changes != null) return x.changes - y.changes;
        if (Math.abs(dx - dy) > 0.001) return (x.cost + dx) - (y.cost + dy);
      }
      if (x.changes != null && x.changes !== y.changes) return x.changes - y.changes;
      return x.cost - y.cost || x.day - y.day || x.start - y.start;
    });
  }
  function distance(c, near) {
    // מרחק "אנושי": שעה הפרש = 1, יום הפרש = 2
    let d = 0;
    if (near.day != null) d += Math.abs(Number(near.day) - c.day) * 2;
    if (near.start != null) d += Math.abs(near.start - c.start) / 60;
    return d;
  }

  /**
   * חיפוש פתרון עם מינימום שינויים: מחזיר אפשרויות שיבוץ ממוינות לפי מספר המפגשים שצריך להזיז.
   * opts: {sessionId – אם מזיזים מפגש קיים, maxChanges, limit, near:{day,start}, onlyNear}
   */
  function findWithMinimalChanges(state, activityOrId, opts) {
    opts = opts || {};
    const ctx = opts.ctx || makeCtx(state);
    const a = typeof activityOrId === 'string' ? ctx.act.get(activityOrId) : activityOrId;
    if (!a) return [];
    const maxChanges = opts.maxChanges == null ? 2 : opts.maxChanges;
    const limit = opts.limit || 12;
    const baseIgnore = new Set(opts.sessionId ? [opts.sessionId] : []);
    const sessions = (opts.sessions || state.sessions).filter(s => !baseIgnore.has(s.id));
    const pat = opts.weekPattern || a.weekPattern || 'all';
    let cands = candidateSlots(ctx, a);
    if (opts.near && opts.near.exact) {
      cands = [{ day: Number(opts.near.day), start: opts.near.start, end: opts.near.end }];
    }
    const results = [];
    for (const c of cands) {
      const ev = evaluate(ctx, { activity: a, day: c.day, start: c.start, end: c.end, weekPattern: pat }, { sessions });
      if (!ev.hard.length) { results.push(Object.assign({}, c, { changes: 0, moves: [], cost: ev.cost, soft: ev.soft })); continue; }
      if (maxChanges === 0) continue;
      if (ev.hard.some(h => !h.sessionId || h.locked)) {
        if (opts.near && opts.near.exact) results.push(Object.assign({}, c, { changes: Infinity, blockedBy: ev.hard, cost: ev.cost }));
        continue;
      }
      const blockers = Array.from(new Set(ev.hard.map(h => h.sessionId)));
      if (blockers.length > maxChanges) {
        if (opts.near && opts.near.exact) results.push(Object.assign({}, c, { changes: Infinity, blockedBy: ev.hard, cost: ev.cost }));
        continue;
      }
      // מנסים להזיז כל חוסם למקום פנוי אחר
      const temp = { id: '__cand', activityId: a.id, day: c.day, start: c.start, end: c.end, weekPattern: pat };
      let work = sessions.filter(s => !blockers.includes(s.id)).concat([temp]);
      const tempCtx = a.__virtual ? withVirtual(ctx, a) : ctx;
      const moves = [];
      let ok = true, extra = 0;
      for (const bid of blockers) {
        const bs = sessions.find(s => s.id === bid);
        const ba = ctx.act.get(bs.activityId);
        if (ba.linkActivityId) { ok = false; break; }
        const free = findFreeSlots(state, ba, { ctx: tempCtx, sessions: work, weekPattern: bs.weekPattern, near: { day: bs.day, start: bs.start } });
        if (!free.length) { ok = false; break; }
        const f = free[0];
        const moved = Object.assign({}, bs, { day: f.day, start: f.start, end: f.end });
        work = work.concat([moved]);
        moves.push({ sessionId: bid, activityId: ba.id, title: actLabel(ctx, ba), from: { day: bs.day, start: bs.start, end: bs.end }, to: { day: f.day, start: f.start, end: f.end } });
        extra += f.cost;
      }
      if (ok) results.push(Object.assign({}, c, { changes: moves.length, moves, cost: ev.cost + extra, soft: ev.soft, solvedConflicts: ev.hard }));
      else if (opts.near && opts.near.exact) results.push(Object.assign({}, c, { changes: Infinity, blockedBy: ev.hard, cost: ev.cost }));
    }
    sortByTarget(results, opts.near);
    return results.slice(0, limit);
  }

  function withVirtual(ctx, a) {
    const c2 = Object.assign({}, ctx, { act: new Map(ctx.act) });
    c2.act.set(a.id, a);
    return c2;
  }

  // ---------- שיבוץ אוטומטי ----------
  /**
   * opts: {keepExisting (ברירת מחדל true), iterations, activityIds (רק פעילויות אלו), seed}
   * מחזיר {sessions, placed:[], unplaced:[{activityId,title,reason}], cost}
   */
  function autoSchedule(state, opts) {
    opts = opts || {};
    const ctx = makeCtx(state);
    const keep = opts.keepExisting !== false;
    const iterations = opts.iterations || 25;
    let rnd = mulberry32(opts.seed || 12345);
    const scope = opts.activityIds ? new Set(opts.activityIds) : null;
    const base = (state.sessions || []).filter(s => {
      if (s.locked) return true;
      if (!keep) return scope ? !scope.has(s.activityId) : false;
      return true;
    });

    const linked = state.activities.filter(a => a.linkActivityId && (!scope || scope.has(a.id)));
    const normal = state.activities.filter(a => !a.linkActivityId && (!scope || scope.has(a.id)) && !a.manualOnly);

    // שלב א – פעילויות מקושרות (שילוב בשיעור של כיתה רגילה) אשר יעדן כבר משובץ
    function mirrorLinked(sessions) {
      for (const a of linked) {
        const target = sessions.filter(s => s.activityId === a.linkActivityId);
        for (const ts of target) {
          if (sessions.some(s => s.activityId === a.id && s.day === ts.day && s.start === ts.start)) continue;
          sessions.push({ id: uid('ses'), activityId: a.id, day: ts.day, start: ts.start, end: ts.end, weekPattern: ts.weekPattern || 'all', auto: true });
        }
      }
    }

    const needs = [];
    for (const a of normal) {
      const have = base.filter(s => s.activityId === a.id).length;
      const n = Math.max(0, (Number(a.perWeek) || 0) - have);
      for (let i = 0; i < n; i++) needs.push(a);
    }
    // גמישות: כמה מועדים אפשריים ללא אילוצים "קבועים"
    const flex = new Map();
    for (const a of normal) {
      const cands = candidateSlots(ctx, a);
      let n = 0;
      for (const c of cands) {
        const ev = evaluate(ctx, { activity: a, day: c.day, start: c.start, end: c.end }, { sessions: [] });
        if (!ev.hard.length) n++;
      }
      flex.set(a.id, n);
    }

    let best = null;
    for (let it = 0; it < iterations; it++) {
      const sessions = base.map(s => Object.assign({}, s));
      mirrorLinked(sessions);
      const order = needs.slice().sort((x, y) => {
        const fx = flex.get(x.id) * (it ? (0.7 + rnd() * 0.6) : 1);
        const fy = flex.get(y.id) * (it ? (0.7 + rnd() * 0.6) : 1);
        const sx = studentsOf(ctx, x).length + staffOf(x).length, sy = studentsOf(ctx, y).length + staffOf(y).length;
        return (fx - fy) || (sy - sx);
      });
      const unplaced = []; const placed = [];
      let total = 0;
      for (const a of order) {
        const cands = candidateSlots(ctx, a);
        let bestC = null, bestCost = Infinity;
        for (const c of cands) {
          const ev = evaluate(ctx, { activity: a, day: c.day, start: c.start, end: c.end }, { sessions });
          if (ev.hard.length) continue;
          const jitter = it ? rnd() * 0.9 : 0;
          if (ev.cost + jitter < bestCost) { bestCost = ev.cost + jitter; bestC = Object.assign({ cost: ev.cost }, c); }
        }
        if (bestC) {
          const s = { id: uid('ses'), activityId: a.id, day: bestC.day, start: bestC.start, end: bestC.end, weekPattern: a.weekPattern || 'all', auto: true };
          sessions.push(s); placed.push(s); total += bestC.cost;
          continue;
        }
        // ניסיון תיקון: הזזת מפגש חוסם אחד שאינו נעול
        const opts2 = findWithMinimalChanges(state, a, { ctx, sessions, maxChanges: 1, limit: 3 });
        const fix = opts2.find(o => o.changes <= 1 && o.moves.every(m => {
          const ss = sessions.find(s => s.id === m.sessionId);
          return ss && !ss.locked && !(opts.protectExisting && base.some(b => b.id === m.sessionId));
        }));
        if (fix) {
          for (const m of fix.moves) {
            const ss = sessions.find(s => s.id === m.sessionId);
            ss.day = m.to.day; ss.start = m.to.start; ss.end = m.to.end; ss.moved = true;
          }
          const s = { id: uid('ses'), activityId: a.id, day: fix.day, start: fix.start, end: fix.end, weekPattern: a.weekPattern || 'all', auto: true };
          sessions.push(s); placed.push(s); total += fix.cost + 2;
        } else {
          unplaced.push({ activityId: a.id, title: actLabel(ctx, a), reason: explainNoSlot(ctx, a, sessions) });
        }
      }
      mirrorLinked(sessions);
      const score = unplaced.length * 1000 + total;
      if (!best || score < best.score) best = { score, sessions, unplaced, placed, cost: total };
      if (best.unplaced.length === 0 && it >= 3) break;
    }
    return best;
  }

  function explainNoSlot(ctx, a, sessions) {
    const counts = {};
    for (const c of candidateSlots(ctx, a)) {
      const ev = evaluate(ctx, { activity: a, day: c.day, start: c.start, end: c.end }, { sessions });
      for (const h of ev.hard) {
        const key = h.entity === 'staff' ? 'צוות: ' + ((ctx.staff.get(h.id) || {}).name || '')
          : h.entity === 'student' ? 'תלמיד: ' + studentShort(ctx.students.get(h.id))
            : h.entity === 'room' ? 'חדר' : h.reason;
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]);
    return top.length ? 'חוסמים עיקריים – ' + top.join(' | ') : 'אין מועדים אפשריים (בדקו ימים/שעות/משך)';
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- היכן נמצא התלמיד ----------
  function studentSessionsAt(ctx, sessions, studentId, day, start, end, pattern) {
    const out = [];
    for (const s of sessions) {
      if (Number(s.day) !== Number(day) || !overlaps(start, end, s.start, s.end)) continue;
      const a = ctx.act.get(s.activityId);
      if (!a || !patternsMeet(pattern, s.weekPattern || a.weekPattern)) continue;
      if (studentsOf(ctx, a).includes(studentId)) out.push({ s, a, layer: layerOf(a) });
    }
    return out.sort((x, y) => y.layer - x.layer);
  }

  // ---------- בדיקת זמן ----------
  /**
   * q: {day, start, end, weekPattern, studentIds, staffIds, classIds, roomIds, activityId}
   */
  function checkTime(state, q) {
    const ctx = makeCtx(state);
    const day = Number(q.day), start = q.start, end = q.end, pat = q.weekPattern || 'all';
    const rows = [];
    const sess = state.sessions || [];
    const bounds = dayBounds(ctx, day);
    const periodsHere = (ctx.periodsByDay[day] || []).filter(p => overlaps(start, end, p.start, p.end));

    const describe = (s, a) => ({ sessionId: s.id, title: actLabel(ctx, a), time: fmtRange(s.start, s.end), type: a.type, staff: staffNames(ctx, a.staffIds), locked: !!s.locked, protected: isProtected(a), layer: layerOf(a) });

    for (const sid of (q.studentIds || [])) {
      const st = ctx.students.get(sid); if (!st) continue;
      const at = studentSessionsAt(ctx, sess, sid, day, start, end, pat);
      const blocks = (st.unavailable || []).filter(u => Number(u.day) === day && overlaps(start, end, u.start, u.end));
      let status = 'free', note = 'פנוי/ה – אין פעילות משובצת';
      if (blocks.length) { status = 'blocked'; note = 'אילוץ: ' + blocks.map(b => b.reason || fmtRange(b.start, b.end)).join(', '); }
      else if (at.some(x => x.layer === 2)) { status = 'busy'; note = 'יוצא/ת לפעילות אחרת'; }
      else if (at.some(x => x.protected || isProtected(x.a))) { status = 'busy'; note = 'בפעילות מוגנת'; }
      else if (at.length) { status = 'soft'; note = 'בשיעור – ניתן להוציא (יפספס)'; }
      const cls = ctx.classes.get(st.classId);
      rows.push({ entity: 'student', id: sid, name: studentFull(st), sub: cls ? cls.name : '', status, note, items: at.map(x => describe(x.s, x.a)) });
    }
    for (const sid of (q.staffIds || [])) {
      const st = ctx.staff.get(sid); if (!st) continue;
      const items = [];
      for (const s of sess) {
        if (Number(s.day) !== day || !overlaps(start, end, s.start, s.end)) continue;
        const a = ctx.act.get(s.activityId);
        if (a && staffOf(a).includes(sid) && patternsMeet(pat, s.weekPattern || a.weekPattern)) items.push(describe(s, a));
      }
      let status = 'free', note = 'פנוי/ה';
      const avail = !st.availability || !st.availability.length || windowCovers(st.availability, day, start, end);
      const blk = (st.unavailable || []).filter(u => Number(u.day) === day && overlaps(start, end, u.start, u.end));
      if (!avail) { status = 'blocked'; note = 'לא נמצא/ת במוסד בזמן זה'; }
      else if (blk.length) { status = 'blocked'; note = 'חסום/ה: ' + blk.map(b => b.reason || '').join(', '); }
      else if (items.length) { status = 'busy'; note = 'משובץ/ת'; }
      rows.push({ entity: 'staff', id: sid, name: st.name, sub: ROLES[st.role] || '', status, note, items });
    }
    for (const cid of (q.classIds || [])) {
      const c = ctx.classes.get(cid); if (!c) continue;
      const members = ctx.classMembers.get(cid) || [];
      const items = [];
      for (const s of sess) {
        if (Number(s.day) !== day || !overlaps(start, end, s.start, s.end)) continue;
        const a = ctx.act.get(s.activityId);
        if (!a || !patternsMeet(pat, s.weekPattern || a.weekPattern)) continue;
        if ((a.classIds || []).includes(cid) || a.destClassId === cid) items.push(describe(s, a));
      }
      let out = 0; const outNames = [];
      for (const m of members) {
        const at = studentSessionsAt(ctx, sess, m, day, start, end, pat);
        if (at.length && at[0].layer > 0) { out++; outNames.push(studentShort(ctx.students.get(m)) + ' (' + actLabel(ctx, at[0].a) + ')'); }
      }
      const status = items.some(i => i.protected) ? 'busy' : items.length ? 'soft' : 'free';
      rows.push({ entity: 'class', id: cid, name: c.name, sub: members.length + ' תלמידים', status,
        note: (items.length ? 'יש שיעור כיתתי' : 'אין שיעור כיתתי') + (out ? ' · ' + out + ' תלמידים מחוץ לכיתה: ' + outNames.join(', ') : ''), items });
    }
    for (const rid of (q.roomIds || [])) {
      const r = ctx.rooms.get(rid); if (!r) continue;
      const items = [];
      for (const s of sess) {
        if (Number(s.day) !== day || !overlaps(start, end, s.start, s.end)) continue;
        const a = ctx.act.get(s.activityId);
        if (a && a.roomId === rid && patternsMeet(pat, s.weekPattern || a.weekPattern)) items.push(describe(s, a));
      }
      rows.push({ entity: 'room', id: rid, name: r.name, sub: '', status: items.length ? 'busy' : 'free', note: items.length ? 'תפוס' : 'פנוי', items });
    }

    let activityCheck = null;
    if (q.activityId) {
      const a = ctx.act.get(q.activityId);
      if (a) {
        const ev = evaluate(ctx, { activity: a, day, start, end, weekPattern: pat }, { ignore: new Set(q.ignoreSessionId ? [q.ignoreSessionId] : []) });
        const alternatives = ev.hard.length
          ? findWithMinimalChanges(state, a, { ctx, sessionId: q.ignoreSessionId, near: { day, start }, maxChanges: 2, limit: 8 })
          : [];
        const exact = ev.hard.length && ev.hard.every(h => h.sessionId && !h.locked)
          ? findWithMinimalChanges(state, a, { ctx, sessionId: q.ignoreSessionId, near: { day, start, end, exact: true }, maxChanges: 3, limit: 1 })[0]
          : null;
        activityCheck = { activityId: a.id, title: actLabel(ctx, a), ok: !ev.hard.length, hard: ev.hard, soft: ev.soft, cost: ev.cost, alternatives, exact: exact && exact.changes !== Infinity ? exact : null };
      }
    }
    return { day, start, end, outOfSchool: bounds ? (start < bounds.start || end > bounds.end) : true, periods: periodsHere.map(p => p.label || fmtRange(p.start, p.end)), rows, activityCheck };
  }

  // ---------- המלצות לטיפול / עזרה ----------
  function staffWeeklyMinutes(ctx, staffId, sessions) {
    let m = 0;
    for (const s of sessions) {
      const a = ctx.act.get(s.activityId);
      if (a && staffOf(a).includes(staffId)) m += (s.end - s.start) * ((s.weekPattern && s.weekPattern !== 'all') ? 0.5 : 1);
    }
    return m;
  }
  function staffAvailableMinutes(ctx, st) {
    if (st.availability && st.availability.length) return st.availability.reduce((x, w) => x + (w.end - w.start), 0);
    let m = 0;
    for (const d of ctx.days) { const b = dayBounds(ctx, d); if (b) m += b.end - b.start; }
    return m;
  }
  function specialtyMatch(st, spec) {
    if (!spec) return true;
    const s = String(spec).trim();
    return (st.specialties || []).some(x => x === s || x.includes(s) || s.includes(x));
  }

  /**
   * rec: {studentId, specialty, perWeek, duration, groupOk, staffId?}
   * מחזיר {staff:[{staffId,name,free,load,max}], options:[{kind:'join'|'new', ...}]}
   */
  function suggestForRecommendation(state, rec) {
    const ctx = makeCtx(state);
    const student = ctx.students.get(rec.studentId);
    const perWeek = Number(rec.perWeek) || 1;
    const duration = Number(rec.duration) || 0;
    const staffList = state.staff.filter(st => (rec.staffId ? st.id === rec.staffId : specialtyMatch(st, rec.specialty)) && st.active !== false);
    const staffInfo = staffList.map(st => {
      const load = staffWeeklyMinutes(ctx, st.id, state.sessions);
      const avail = Math.min(staffAvailableMinutes(ctx, st), st.maxMinutesWeek ? Number(st.maxMinutesWeek) : Infinity);
      return { staffId: st.id, name: st.name, load, max: avail === Infinity ? null : avail, free: avail === Infinity ? null : Math.max(0, avail - load) };
    }).sort((x, y) => (y.free == null ? 1e9 : y.free) - (x.free == null ? 1e9 : x.free));

    const options = [];
    // אפשרות 1: הצטרפות לקבוצה קיימת של אותו תחום
    if (rec.groupOk !== false) {
      for (const a of state.activities) {
        if (!['therapy', 'help', 'group'].includes(a.type)) continue;
        if (!staffList.some(st => staffOf(a).includes(st.id))) continue;
        if (rec.specialty && a.specialty && !String(a.specialty).includes(rec.specialty) && !String(rec.specialty).includes(a.specialty)) continue;
        const cur = studentsOf(ctx, a);
        if (cur.includes(rec.studentId)) continue;
        const max = Number(a.maxStudents) || 0;
        if (!max || cur.length >= max) continue;
        const virt = Object.assign({}, a, { __virtual: true, studentIds: (a.studentIds || []).concat([rec.studentId]) });
        const vctx = withVirtual(ctx, virt);
        const ses = state.sessions.filter(s => s.activityId === a.id);
        if (!ses.length) continue;
        let ok = true, cost = 0; const notes = [];
        for (const s of ses) {
          const ev = evaluate(vctx, { activity: virt, day: s.day, start: s.start, end: s.end, weekPattern: s.weekPattern }, { ignore: new Set([s.id]) });
          if (ev.hard.length) { ok = false; break; }
          cost += ev.cost; ev.soft.filter(x => x.id === rec.studentId).forEach(x => notes.push(x.reason));
        }
        if (ok) options.push({ kind: 'join', activityId: a.id, title: actLabel(ctx, a), staff: staffNames(ctx, a.staffIds), slots: ses.map(s => ({ day: s.day, start: s.start, end: s.end })), cost, notes, group: cur.length + 1 + '/' + max });
      }
    }
    // אפשרות 2: מפגשים חדשים עם כל איש צוות מתאים
    for (const info of staffInfo) {
      if (info.free != null && info.free < (duration || 30) * perWeek) continue;
      const virt = { id: '__rec_' + info.staffId, __virtual: true, type: rec.type || 'therapy', title: rec.specialty || 'טיפול', specialty: rec.specialty,
        staffIds: [info.staffId], studentIds: [rec.studentId], duration: duration || null, perWeek, alignToPeriods: rec.alignToPeriods !== false };
      const vctx = withVirtual(ctx, virt);
      const temp = state.sessions.slice();
      const slots = []; let cost = 0;
      for (let i = 0; i < perWeek; i++) {
        const free = findFreeSlots(state, virt, { ctx: vctx, sessions: temp });
        if (!free.length) break;
        const f = free[0];
        slots.push({ day: f.day, start: f.start, end: f.end, notes: f.soft.map(x => x.reason) });
        cost += f.cost;
        temp.push({ id: '__t' + i, activityId: virt.id, day: f.day, start: f.start, end: f.end, weekPattern: 'all' });
      }
      const alt = findFreeSlots(state, virt, { ctx: vctx, sessions: state.sessions }).slice(0, 8);
      if (slots.length) options.push({ kind: 'new', staffId: info.staffId, staff: info.name, slots, complete: slots.length === perWeek, cost, alternatives: alt, free: info.free });
    }
    options.sort((x, y) => (x.complete === false) - (y.complete === false) || x.cost - y.cost || (x.kind === 'join' ? -1 : 1));
    return { student: student ? studentFull(student) : '', staff: staffInfo, options };
  }

  // ---------- דוחות ----------
  function allConflicts(state) {
    const ctx = makeCtx(state);
    const out = []; const seen = new Set();
    for (const s of state.sessions) {
      const ev = evaluate(ctx, { activityId: s.activityId, day: s.day, start: s.start, end: s.end, weekPattern: s.weekPattern }, { ignore: new Set([s.id]) });
      for (const h of ev.hard) {
        const key = h.sessionId ? [s.id, h.sessionId].sort().join('|') + h.entity + h.id : s.id + h.reason;
        if (seen.has(key)) continue; seen.add(key);
        const a = ctx.act.get(s.activityId);
        out.push({ sessionId: s.id, otherSessionId: h.sessionId || null, day: s.day, time: fmtRange(s.start, s.end), title: actLabel(ctx, a), reason: h.reason });
      }
    }
    return out;
  }

  function coverage(state) {
    const ctx = makeCtx(state);
    return state.activities.filter(a => !a.linkActivityId).map(a => {
      const n = state.sessions.filter(s => s.activityId === a.id).length;
      return { activityId: a.id, title: actLabel(ctx, a), type: a.type, required: Number(a.perWeek) || 0, scheduled: n, missing: Math.max(0, (Number(a.perWeek) || 0) - n) };
    });
  }

  function studentReport(state, studentId) {
    const ctx = makeCtx(state);
    const byType = {}; const missed = {};
    for (const s of state.sessions) {
      const a = ctx.act.get(s.activityId);
      if (!a || !studentsOf(ctx, a).includes(studentId)) continue;
      const w = (s.weekPattern && s.weekPattern !== 'all') ? 0.5 : 1;
      byType[a.type] = (byType[a.type] || 0) + (s.end - s.start) * w;
      if (layerOf(a) > 0) {
        // מה מפספסים
        const lower = studentSessionsAt(ctx, state.sessions, studentId, s.day, s.start, s.end, s.weekPattern).filter(x => x.layer < layerOf(a));
        for (const l of lower) {
          const ov = Math.min(s.end, l.s.end) - Math.max(s.start, l.s.start);
          const k = actLabel(ctx, l.a);
          missed[k] = (missed[k] || 0) + ov * w;
        }
      }
    }
    return { byType, missed };
  }

  function staffLoad(state) {
    const ctx = makeCtx(state);
    return state.staff.map(st => {
      const load = staffWeeklyMinutes(ctx, st.id, state.sessions);
      const max = st.maxMinutesWeek ? Number(st.maxMinutesWeek) : null;
      return { staffId: st.id, name: st.name, role: st.role, load, max, over: max != null && load > max };
    });
  }

  // ---------- לוח שנה ----------
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  function dateStr(dt) { return dt.toISOString().slice(0, 10); }
  function weekTypeOf(state, ds) {
    const st = state.settings || {};
    if (!st.abWeeks || !st.yearStart) return 'all';
    const d0 = parseDate(st.yearStart); d0.setUTCDate(d0.getUTCDate() - d0.getUTCDay());
    const d = parseDate(ds); d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const w = Math.round((d - d0) / (7 * 864e5));
    return (((w % 2) + 2) % 2) === 0 ? 'A' : 'B';
  }
  function holidayOf(state, ds) {
    return (state.settings.holidays || []).find(h => h.date === ds || (h.to && ds >= h.date && ds <= h.to)) || null;
  }
  /** מפגשים בתאריך מסוים: תבנית שבועית + שינויים חד-פעמיים */
  function sessionsOnDate(state, ds) {
    const day = parseDate(ds).getUTCDay();
    const hol = holidayOf(state, ds);
    if (hol) return { day, holiday: hol, sessions: [] };
    if (!(state.settings.days || []).includes(day)) return { day, holiday: null, sessions: [], off: true };
    const wt = weekTypeOf(state, ds);
    const ones = (state.oneOffs || []).filter(o => o.date === ds);
    const cancelled = new Set(ones.filter(o => o.kind === 'cancel' || o.kind === 'move').map(o => o.sessionId));
    const out = [];
    for (const s of state.sessions) {
      if (Number(s.day) !== day) continue;
      if (wt !== 'all' && s.weekPattern && s.weekPattern !== 'all' && s.weekPattern !== wt) continue;
      if (cancelled.has(s.id)) continue;
      out.push(Object.assign({}, s, { date: ds }));
    }
    for (const o of ones) {
      if (o.kind === 'cancel') continue;
      if (o.kind === 'move') {
        const s = state.sessions.find(x => x.id === o.sessionId);
        if (s) out.push(Object.assign({}, s, { id: s.id + '@' + ds, start: o.start, end: o.end, date: ds, oneOff: o.id, changed: true }));
        continue;
      }
      out.push({ id: 'oo_' + o.id, activityId: o.activityId || ('oneoff:' + o.id), day, start: o.start, end: o.end, date: ds, oneOff: o.id, weekPattern: 'all' });
    }
    return { day, holiday: null, weekType: wt, sessions: out };
  }
  /** פעילויות "מדומות" עבור אירועים חד-פעמיים שאינם מקושרים לפעילות קיימת */
  function oneOffActivities(state) {
    return (state.oneOffs || []).filter(o => o.kind === 'add' && !o.activityId).map(o => ({
      id: 'oneoff:' + o.id, title: o.title || 'אירוע', type: o.type || 'other', staffIds: o.staffIds || [], studentIds: o.studentIds || [],
      classIds: o.classIds || [], notes: o.note || '', oneOff: true
    }));
  }

  const Engine = {
    DAY_NAMES, DAY_SHORT, TYPES, ROLES,
    toMin, fmt, fmtRange, overlaps, patternsMeet,
    typeOf, layerOf, isProtected, studentShort, studentFull, actLabel, staffNames,
    makeCtx, studentsOf, staffOf, dayBounds, windowCovers, sessionsByDay,
    evaluate, candidateSlots, findFreeSlots, findWithMinimalChanges, autoSchedule,
    checkTime, studentSessionsAt, suggestForRecommendation, specialtyMatch,
    allConflicts, coverage, studentReport, staffLoad, staffWeeklyMinutes,
    weekTypeOf, holidayOf, isBreak, sessionsOnDate, oneOffActivities, parseDate, dateStr, uid
  };

  root.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
