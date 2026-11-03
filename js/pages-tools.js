/* עמודי כלים: בדיקת זמן, המלצות, שינויים חד-פעמיים, הפקת מערכות, דוחות, מדריך */
(function (root) {
  'use strict';
  const E = root.Engine, U = root.UI, Store = root.Model.Store, V = root.Views, R = root.Render;
  const { esc, $, $$, S, modal, toast, options, readForm } = U;
  const P = root.Pages = root.Pages || {};
  const STATUS = { free: 'פנוי', soft: 'אפשרי (בשיעור)', busy: 'תפוס', blocked: 'חסום' };

  // ================= בדיקת זמן =================
  P.check = function (main) {
    const s = S();
    const q = root.App.mem.check || (root.App.mem.check = { day: s.settings.days[0], start: 540, end: 585, studentIds: [], staffIds: [], classIds: [], roomIds: [], activityId: '', weekPattern: 'all' });
    main.innerHTML = '<h1>בדיקת זמן ושינויים</h1><p class="muted">בחרו זמן ומי מעורב – המערכת תראה לכל אחד אם הוא פנוי ומה יש לו. בחירת פעילות תבדוק אם אפשר לשבץ אותה כאן, ואם לא – איך להגיע לפתרון עם מינימום שינויים.</p>' +
      '<div class="card" id="qf"><div class="form-grid"><label><span>יום</span><select data-f="day">' + U.dayOptions(q.day) + '</select></label><label><span>משעה</span>' + U.timeInput('start', q.start) + '</label><label><span>עד שעה</span>' + U.timeInput('end', q.end) + '</label>' +
      (s.settings.abWeeks ? '<label><span>שבוע</span><select data-f="weekPattern">' + options([{ value: 'all', label: 'כל שבוע' }, { value: 'A', label: 'א' }, { value: 'B', label: 'ב' }], q.weekPattern) + '</select></label>' : '') +
      '<label class="full"><span>פעילות לבדיקה (אופציונלי) – בחירה ממלאת אוטומטית את המשתתפים</span><select data-f="activityId" id="qa">' + options(s.activities.map(a => ({ value: a.id, label: a.title + ' – ' + ((a.classIds || []).map(c => U.nameOf('class', c)).join(', ') || (a.studentIds || []).map(x => U.nameOf('student', x)).slice(0, 3).join(', ')) })), q.activityId, { empty: '— ללא —' }) + '</select></label>' +
      '<div class="full field"><span>תלמידים</span>' + U.multiPick('studentIds', U.studentItems(), q.studentIds) + '</div>' +
      '<div class="full field"><span>צוות / מטפלים</span>' + U.multiPick('staffIds', U.staffItems(), q.staffIds) + '</div>' +
      '<div class="field"><span>כיתות (כולל הכיתה שבה התלמיד משולב)</span>' + U.multiPick('classIds', U.classItems(), q.classIds) + '</div>' +
      '<div class="field"><span>חדרים</span>' + U.multiPick('roomIds', s.rooms.map(r => ({ id: r.id, label: r.name })), q.roomIds) + '</div>' +
      '</div><div class="row" style="margin-top:10px"><button class="pri" id="run">בדיקה</button><button id="freeStaff">מי מהצוות פנוי בזמן זה?</button><button id="freeSlots">מתי כל הנבחרים פנויים יחד?</button></div></div><div id="res"></div>';
    U.bindPickers(main);
    $('#qa').onchange = e => {
      const a = s.activities.find(x => x.id === e.target.value); if (!a) return;
      const ctx = E.makeCtx(s);
      const set = (field, ids) => $$('[data-mp="' + field + '"] .mp-list input').forEach(i => { i.checked = ids.includes(i.value); });
      set('studentIds', E.studentsOf(ctx, a)); set('staffIds', a.staffIds || []); set('classIds', (a.classIds || []).concat(a.destClassId ? [a.destClassId] : [])); set('roomIds', a.roomId ? [a.roomId] : []);
      const ses = s.sessions.find(x => x.activityId === a.id);
      const dur = Number(a.duration) || ((Number($('[data-f=end]').value ? E.toMin($('[data-f=end]').value) : 585)) - E.toMin($('[data-f=start]').value || '09:00'));
      if (a.duration) $('[data-f=end]').value = E.fmt(E.toMin($('[data-f=start]').value) + dur);
      if (ses) toast('הפעילות משובצת כרגע ב' + U.slotText(ses));
    };
    const read = () => { const d = readForm($('#qf')); d.day = Number(d.day); Object.assign(q, d); return q; };
    $('#run').onclick = () => run(read());
    $('#freeStaff').onclick = () => freeStaff(read());
    $('#freeSlots').onclick = () => commonFree(read());
    if (q._ran) run(q);

    function run(q) {
      if (!(q.end > q.start)) { toast('טווח שעות לא תקין'); return; }
      q._ran = true;
      const r = E.checkTime(S(), q);
      let h = '<div class="card"><h2>יום ' + E.DAY_NAMES[q.day] + ' ' + E.fmtRange(q.start, q.end) + (r.periods.length ? ' <span class="muted small">(' + esc(r.periods.join(', ')) + ')</span>' : '') + '</h2>' +
        (r.outOfSchool ? '<div class="alert warn">שימו לב: הטווח מחוץ לשעות הלימודים</div>' : '');
      if (r.rows.length) {
        h += '<table class="data"><thead><tr><th>מי</th><th>מצב</th><th>פירוט</th><th>מה משובץ</th></tr></thead><tbody>' + r.rows.map(row => '<tr class="status-' + row.status + '"><td><b>' + esc(row.name) + '</b><div class="small muted">' + esc(row.sub) + '</div></td><td>' + STATUS[row.status] + '</td><td class="small">' + esc(row.note) + '</td><td class="small">' +
          row.items.map(it => '<div>' + esc(it.time) + ' ' + esc(it.title) + (it.staff ? ' (' + esc(it.staff) + ')' : '') + (it.locked ? ' ' : '') + (it.protected ? ' <span class="chip">מוגן</span>' : '') + ' <button class="sm" data-ses="' + it.sessionId + '">פתיחה</button></div>').join('') + '</td></tr>').join('') + '</tbody></table>';
      } else h += '<p class="muted">לא נבחרו תלמידים/צוות/כיתות לבדיקה.</p>';
      h += '</div>';
      const ac = r.activityCheck;
      if (ac) {
        h += '<div class="card"><h2>האם אפשר לשבץ "' + esc(ac.title) + '" בזמן הזה?</h2>';
        if (ac.ok) h += '<div class="alert ok">כן! אין התנגשויות.' + (ac.soft.length ? '<br>' + ac.soft.map(x => esc(x.reason)).join(' · ') : '') + '</div><button class="pri" id="placeHere">שבץ כאן</button>';
        else {
          h += '<div class="alert bad"><b>לא, בגלל:</b><ul>' + ac.hard.map(x => '<li>' + esc(x.reason) + '</li>').join('') + '</ul></div>';
          if (ac.exact) h += '<h3>אפשר בדיוק בזמן הזה עם ' + ac.exact.changes + ' שינויים:</h3>' + U.optionsList([ac.exact]).replace('data-apply-opt="0"', 'data-exact="1"');
          h += '<h3>חלופות קרובות לזמן המבוקש:</h3><div id="alts">' + U.optionsList(ac.alternatives) + '</div>';
        }
        h += '</div>';
      }
      $('#res').innerHTML = h;
      $$('[data-ses]', $('#res')).forEach(b => b.onclick = () => P.sessionDialog(b.dataset.ses));
      if (ac) {
        const apply = o => { Store.change('שיבוץ מבדיקת זמן', st => U.applyOption(st, ac.activityId, null, o)); toast('שובץ: ' + U.slotText(o)); };
        const ph = $('#placeHere'); if (ph) ph.onclick = () => apply({ day: q.day, start: q.start, end: q.end, moves: [] });
        const ex = $('[data-exact]'); if (ex) ex.onclick = () => apply(ac.exact);
        if (!ac.ok) U.bindOptions($('#alts'), ac.alternatives, apply);
      }
    }
    function freeStaff(q) {
      const st = S();
      const r = E.checkTime(st, Object.assign({}, q, { studentIds: [], classIds: [], roomIds: [], staffIds: st.staff.map(x => x.id), activityId: '' }));
      const free = r.rows.filter(x => x.status === 'free');
      $('#res').innerHTML = '<div class="card"><h2>אנשי צוות פנויים ביום ' + E.DAY_NAMES[q.day] + ' ' + E.fmtRange(q.start, q.end) + ' (' + free.length + ')</h2>' +
        (free.length ? '<table class="data"><tr><th>שם</th><th>תפקיד</th><th>תחומים</th></tr>' + free.map(x => { const p = st.staff.find(z => z.id === x.id); return '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.sub) + '</td><td>' + (p.specialties || []).map(z => '<span class="chip">' + esc(z) + '</span>').join('') + '</td></tr>'; }).join('') + '</table>' : '<p>אין אנשי צוות פנויים</p>') + '</div>';
    }
    function commonFree(q) {
      const st = S(); const dur = q.end - q.start;
      const virt = { id: '__common', __virtual: true, type: 'other', title: 'בדיקה', staffIds: q.staffIds, studentIds: q.studentIds, classIds: q.classIds, roomId: q.roomIds[0] || '', duration: dur, alignToPeriods: false };
      const ctx = E.makeCtx(st);
      const free = E.findFreeSlots(st, virt, { ctx, near: { day: q.day, start: q.start } });
      // מאחדים מועדים רצופים
      const byDay = {};
      free.forEach(f => { (byDay[f.day] = byDay[f.day] || []).push(f); });
      let h = '<div class="card"><h2>זמנים שבהם כל הנבחרים פנויים (' + dur + ' דקות)</h2><p class="muted small">ירוק = בלי להוציא תלמידים משיעור; צהוב = אפשרי אך תלמידים יפספסו משהו.</p>';
      for (const d of st.settings.days) {
        const l = (byDay[d] || []).sort((a, b) => a.start - b.start);
        h += '<div class="row" style="margin:6px 0"><b style="width:60px">' + E.DAY_NAMES[d] + '</b>' + (l.length ? l.filter((x, i) => i === 0 || x.start - l[i - 1].start >= 15).map(x => '<span class="chip ' + (x.cost < 1 ? 'ok' : 'warn') + '" title="' + esc(x.soft.map(z => z.reason).join('\n')) + '">' + E.fmtRange(x.start, x.end) + '</span>').join('') : '<span class="muted">—</span>') + '</div>';
      }
      $('#res').innerHTML = h + '</div>';
    }
  };

  // ================= המלצות =================
  P.recs = function (main) {
    const s = S();
    main.innerHTML = '<h1>המלצות לטיפול / עזרה</h1><p class="muted">הכניסו המלצה על תלמיד (למשל: "טיפול רגשי פעם בשבוע 40 דק\'"). המערכת תזהה את אנשי הצוות שמתמחים בתחום ויש להם זמן פנוי, ותציע: הצטרפות לקבוצה קיימת או מפגש חדש – במועד שבו גם התלמיד פנוי.</p>' +
      '<div class="toolbar"><button class="pri" id="add">+ המלצה חדשה</button></div>' +
      '<table class="data"><thead><tr><th>תלמיד</th><th>תחום</th><th>תדירות</th><th>הערות</th><th>סטטוס</th><th></th></tr></thead><tbody>' +
      s.recommendations.slice().reverse().map(r => '<tr><td><b>' + esc(U.nameOf('student', r.studentId)) + '</b></td><td>' + esc(r.specialty) + '</td><td>' + (r.perWeek || 1) + ' × ' + (r.duration || 'שיעור') + ' ד\'</td><td class="small">' + esc(r.notes || '') + '</td><td>' +
        (r.status === 'scheduled' ? '<span class="chip ok">שובץ</span>' : r.status === 'rejected' ? '<span class="chip">נדחה</span>' : '<span class="chip warn">פתוח</span>') + '</td><td style="white-space:nowrap">' +
        (r.status === 'open' ? '<button class="sm pri" data-sug="' + r.id + '">הצע שיבוץ</button> ' : '') + '<button class="sm" data-edit="' + r.id + '">עריכה</button></td></tr>').join('') + '</tbody></table>';
    $('#add').onclick = () => P.recDialog({});
    $$('[data-edit]', main).forEach(b => b.onclick = () => P.recDialog(s.recommendations.find(r => r.id === b.dataset.edit)));
    $$('[data-sug]', main).forEach(b => b.onclick = () => suggest(b.dataset.sug));
  };
  P.recDialog = function (r) {
    const s = S();
    const isNew = !r.id;
    r = Object.assign({ studentId: '', specialty: '', perWeek: 1, duration: 40, groupOk: true, notes: '', type: 'therapy', status: 'open' }, r);
    const specs = Array.from(new Set((s.settings.specialties || []).concat(s.staff.flatMap(x => x.specialties || []))));
    const btns = [{ label: isNew ? 'שמירה והצעת שיבוץ' : 'שמירה', cls: 'pri', onClick: el => {
      const d = readForm(el);
      if (!d.studentId || !d.specialty) { toast('בחרו תלמיד ותחום'); return false; }
      let id = r.id;
      Store.change(isNew ? 'הוספת המלצה' : 'עדכון המלצה', st => {
        if (isNew) { id = E.uid('rec'); st.recommendations.push(Object.assign({ id, status: 'open', createdAt: new Date().toISOString().slice(0, 10) }, d)); }
        else Object.assign(st.recommendations.find(x => x.id === id), d);
      });
      if (isNew) setTimeout(() => suggest(id), 50);
    } }];
    if (!isNew) {
      btns.push({ label: 'סימון כנדחה', onClick: () => { Store.change('דחיית המלצה', st => { st.recommendations.find(x => x.id === r.id).status = 'rejected'; }); } });
      btns.push({ label: 'פתיחה מחדש', onClick: () => { Store.change('פתיחת המלצה', st => { st.recommendations.find(x => x.id === r.id).status = 'open'; }); } });
      btns.push({ label: 'מחיקה', cls: 'danger', onClick: () => { Store.change('מחיקת המלצה', st => { st.recommendations = st.recommendations.filter(x => x.id !== r.id); }); } });
    }
    btns.push({ label: 'ביטול' });
    modal(isNew ? 'המלצה חדשה' : 'עריכת המלצה', '<div class="form-grid"><label><span>תלמיד</span><select data-f="studentId">' + options(U.studentItems().map(x => ({ value: x.id, label: x.label + ' (' + x.group + ')' })), r.studentId, { empty: '— בחרו —' }) + '</select></label>' +
      '<label><span>תחום טיפול / עזרה</span><input data-f="specialty" list="recSpecs" value="' + esc(r.specialty) + '"><datalist id="recSpecs">' + specs.map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></label>' +
      '<label><span>סוג</span><select data-f="type">' + options([{ value: 'therapy', label: 'טיפול' }, { value: 'help', label: 'עזרה / תגבור' }, { value: 'group', label: 'חוג / קבוצה' }], r.type) + '</select></label>' +
      '<label><span>מפגשים בשבוע</span><input type="number" min="1" data-f="perWeek" value="' + esc(r.perWeek) + '"></label><label><span>משך (דקות)</span><input type="number" min="5" step="5" data-f="duration" value="' + esc(r.duration) + '"></label>' +
      '<label class="row"><input type="checkbox" data-f="groupOk"' + (r.groupOk !== false ? ' checked' : '') + '> אפשר בקבוצה</label>' +
      '<label class="full"><span>הערות / מקור ההמלצה</span><textarea data-f="notes">' + esc(r.notes || '') + '</textarea></label></div>', btns);
  };

  function suggest(recId) {
    const s = S();
    const rec = s.recommendations.find(r => r.id === recId);
    const res = E.suggestForRecommendation(s, rec);
    let h = '<p>תלמיד: <b>' + esc(res.student) + '</b> · תחום: <b>' + esc(rec.specialty) + '</b> · ' + rec.perWeek + ' × ' + rec.duration + ' דק\'</p>';
    h += '<h3>אנשי צוות בתחום</h3>' + (res.staff.length ? res.staff.map(x => '<span class="chip">' + esc(x.name) + ' · ' + (x.free != null ? 'פנוי ' + U.hours(x.free) : 'ללא מכסה') + ' · משובץ ' + U.hours(x.load) + '</span>').join('') :
      '<div class="alert bad">אין איש צוות שמוגדר עם התחום "' + esc(rec.specialty) + '". הוסיפו את התחום לאיש צוות (בעמוד צוות) ונסו שוב.</div>');
    h += '<h3>הצעות שיבוץ</h3>';
    if (!res.options.length) h += '<div class="alert warn">לא נמצא זמן פנוי משותף. נסו: להגדיל זמינות של איש הצוות, לקצר משך, או לבדוק ב"בדיקת זמן" מה חוסם.</div>';
    res.options.forEach((o, i) => {
      if (o.kind === 'join') h += '<div class="opt"><div class="row"><span class="chip ok">הצטרפות לקבוצה קיימת</span><b>' + esc(o.title) + '</b> – ' + esc(o.staff) + ' <span class="muted small">(' + esc(o.group) + ')</span><button class="sm pri right" data-o="' + i + '">בחירה</button></div><div class="moves">' + o.slots.map(U.slotText).join(' · ') + (o.notes.length ? '<br>' + esc(o.notes.join(' · ')) : '') + '</div></div>';
      else h += '<div class="opt"><div class="row"><span class="chip">מפגש חדש</span><b>' + esc(o.staff) + '</b>' + (o.complete ? '' : ' <span class="chip warn">נמצאו רק ' + o.slots.length + ' מתוך ' + rec.perWeek + '</span>') + '<button class="sm pri right" data-o="' + i + '">בחירה</button></div><div class="moves">' + o.slots.map(x => esc(U.slotText(x)) + (x.notes && x.notes.length ? ' <span class="muted">(' + esc(x.notes.join(', ')) + ')</span>' : '')).join('<br>') +
        (o.alternatives.length ? '<details><summary class="small">מועדים פנויים נוספים</summary>' + o.alternatives.map(x => '<span class="chip">' + esc(U.slotText(x)) + '</span>').join('') + '</details>' : '') + '</div></div>';
    });
    const m = modal('הצעות שיבוץ להמלצה', h, null, { wide: true });
    $$('[data-o]', m).forEach(b => b.onclick = () => {
      const o = res.options[Number(b.dataset.o)];
      Store.change('שיבוץ המלצה', st => {
        const r = st.recommendations.find(x => x.id === recId);
        if (o.kind === 'join') {
          const a = st.activities.find(x => x.id === o.activityId);
          a.studentIds = Array.from(new Set((a.studentIds || []).concat([r.studentId])));
          r.activityId = a.id;
        } else {
          const st2 = st.students.find(x => x.id === r.studentId);
          const a = { id: E.uid('act'), title: r.specialty + ' – ' + E.studentShort(st2), type: r.type || 'therapy', specialty: r.specialty, classIds: [], studentIds: [r.studentId], excludeStudentIds: [], staffIds: [o.staffId], roomId: '', duration: Number(r.duration) || '', perWeek: Number(r.perWeek) || 1, weekPattern: 'all', alignToPeriods: true, allowedDays: [], preferredDays: [], windowStart: '', windowEnd: '', maxStudents: r.groupOk ? 4 : 1, notes: r.notes || '', icon: '' };
          st.activities.push(a);
          o.slots.forEach(sl => st.sessions.push({ id: E.uid('ses'), activityId: a.id, day: sl.day, start: sl.start, end: sl.end, weekPattern: 'all' }));
          r.activityId = a.id;
        }
        r.status = 'scheduled';
      });
      m.close(); toast('ההמלצה שובצה');
    });
  }

  // ================= שינויים חד-פעמיים ולוח חודשי =================
  P.calendar = function (main) {
    const s = S();
    const mem = root.App.mem;
    const month = mem.calMonth || new Date().toISOString().slice(0, 7);
    const ctx = E.makeCtx(s);
    const oneActs = new Map(E.oneOffActivities(s).map(a => [a.id, a]));
    const list = (s.oneOffs || []).slice().sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
    main.innerHTML = '<h1>שינויים, אירועים והדרכות משתנות</h1><p class="muted">המערכת השבועית היא הבסיס. כאן מוסיפים שינויים לתאריך מסוים: הדרכה משתנה, ביטול מפגש, הזזה חד-פעמית, היעדרות איש צוות (עם הצעת מחליף). הכל מופיע במערכת לפי תאריך / חודש.</p>' +
      '<div class="toolbar"><button class="pri" id="add">+ אירוע / הדרכה חד-פעמית</button><button id="cancel">ביטול / הזזת מפגש בתאריך</button><button id="absent">היעדרות איש צוות</button><label>חודש: <input type="month" id="mon" value="' + month + '"></label></div>' +
      '<div class="card"><h2>שינויים בחודש</h2><table class="data"><thead><tr><th>תאריך</th><th>סוג</th><th>מה</th><th>שעה</th><th>הערה</th><th></th></tr></thead><tbody>' +
      list.filter(o => o.date.startsWith(month)).map(o => {
        const ses = o.sessionId ? s.sessions.find(x => x.id === o.sessionId) : null;
        const a = ses ? ctx.act.get(ses.activityId) : (o.activityId ? ctx.act.get(o.activityId) : oneActs.get('oneoff:' + o.id));
        return '<tr><td>' + V.fmtDate(o.date) + ' (' + E.DAY_SHORT[E.parseDate(o.date).getUTCDay()] + ')</td><td>' + ({ add: '<span class="chip ok">תוספת</span>', cancel: '<span class="chip bad">ביטול</span>', move: '<span class="chip warn">הזזה</span>' })[o.kind] + '</td><td>' + esc(a ? E.actLabel(ctx, a) : '?') + '</td><td>' + (o.kind === 'cancel' && ses ? E.fmtRange(ses.start, ses.end) : E.fmtRange(o.start, o.end)) + '</td><td class="small">' + esc(o.note || '') + '</td><td><button class="sm danger" data-del="' + o.id + '">מחיקה</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="card"><h2>תצוגה חודשית</h2><div class="row"><select id="vk">' + options(Object.entries(V.KINDS).map(([k, v]) => ({ value: k, label: v })), mem.calKind || 'sped') + '</select><select id="vi"></select><button id="show">הצג</button></div><div id="mview" style="margin-top:10px"></div></div>';
    $('#mon').onchange = e => { mem.calMonth = e.target.value; P.calendar(main); };
    $('#add').onclick = () => oneOffDialog();
    $('#cancel').onclick = () => cancelDialog();
    $('#absent').onclick = () => absenceDialog();
    $$('[data-del]', main).forEach(b => b.onclick = () => Store.change('מחיקת שינוי', st => { st.oneOffs = st.oneOffs.filter(x => x.id !== b.dataset.del); }));
    const fillIds = () => { $('#vi').innerHTML = entityOptions($('#vk').value, mem.calId); };
    $('#vk').onchange = () => { mem.calKind = $('#vk').value; fillIds(); }; fillIds();
    $('#show').onclick = () => {
      mem.calId = $('#vi').value;
      const v = V.build(S(), { kind: $('#vk').value, id: $('#vi').value, range: { mode: 'month', month }, options: { showNames: true } });
      $('#mview').innerHTML = '<div class="row no-print" style="margin-bottom:8px"><button id="mp">הדפסה/PDF</button><button id="mx">Excel</button><button id="mw">Word</button></div><div class="tt-preview">' + R.viewHtml(v) + '</div>';
      $('#mp').onclick = () => R.printViews([v]); $('#mx').onclick = () => R.excelViews([v]); $('#mw').onclick = () => R.wordViews([v]);
    };
    if (mem.calId) $('#show').click();
  };

  function oneOffDialog() {
    const s = S();
    modal('אירוע / הדרכה חד-פעמית', '<div class="form-grid"><label><span>תאריך</span><input type="date" data-f="date" value="' + new Date().toISOString().slice(0, 10) + '"></label><label><span>משעה</span>' + U.timeInput('start', 750) + '</label><label><span>עד</span>' + U.timeInput('end', 780) + '</label>' +
      '<label><span>פעילות קיימת (או השאירו ריק ומלאו פרטים)</span><select data-f="activityId">' + options(s.activities.map(a => ({ value: a.id, label: a.title })), '', { empty: '— אירוע חדש —' }) + '</select></label>' +
      '<label><span>כותרת</span><input data-f="title" placeholder="למשל: הדרכה משתנה – מפקחת"></label><label><span>סוג</span><select data-f="type">' + options(Object.entries(E.TYPES).map(([k, t]) => ({ value: k, label: t.label })), 'guidance') + '</select></label>' +
      '<div class="full field"><span>צוות</span>' + U.multiPick('staffIds', U.staffItems(), []) + '</div><div class="full field"><span>תלמידים</span>' + U.multiPick('studentIds', U.studentItems(), []) + '</div><div class="full field"><span>כיתות</span>' + U.multiPick('classIds', U.classItems(), []) + '</div>' +
      '<label class="full"><span>הערה</span><input data-f="note"></label></div>', [
      { label: 'בדיקה ושמירה', cls: 'pri', onClick: el => {
        const d = readForm(el);
        if (!d.date || !(d.end > d.start)) { toast('תאריך/שעות לא תקינים'); return false; }
        // בדיקת התנגשות מול המערכת של אותו תאריך
        const st = S(); const day = E.parseDate(d.date).getUTCDay();
        const ctx = E.makeCtx(st);
        const virt = d.activityId ? ctx.act.get(d.activityId) : { id: '__oo', __virtual: true, type: d.type, title: d.title, staffIds: d.staffIds, studentIds: d.studentIds, classIds: d.classIds, alignToPeriods: false };
        const onDate = E.sessionsOnDate(st, d.date).sessions.filter(x => ctx.act.has(x.activityId));
        const ev = E.evaluate(ctx, { activity: virt, day, start: d.start, end: d.end }, { sessions: onDate });
        const save = () => Store.change('הוספת אירוע חד-פעמי', s2 => { s2.oneOffs.push(Object.assign({ id: E.uid('oo'), kind: 'add' }, d, d.activityId ? { title: '', staffIds: [], studentIds: [], classIds: [] } : {})); });
        if (ev.hard.length) {
          modal('התנגשויות בתאריך זה', '<div class="alert warn"><ul>' + ev.hard.map(h => '<li>' + esc(h.reason) + '</li>').join('') + '</ul></div><p>לשמור בכל זאת?</p>', [{ label: 'שמירה', cls: 'pri', onClick: save }, { label: 'חזרה' }]);
          return false;
        }
        save(); toast('נשמר');
      } }, { label: 'ביטול' }], { wide: true });
    U.bindPickers($('#modalRoot'));
  }

  function cancelDialog() {
    const s = S(); const ctx = E.makeCtx(s);
    const m = modal('ביטול / הזזה של מפגש בתאריך', '<div class="form-grid"><label><span>תאריך</span><input type="date" id="cd" value="' + new Date().toISOString().slice(0, 10) + '"></label><label><span>פעולה</span><select data-f="kind" id="ck">' + options([{ value: 'cancel', label: 'ביטול' }, { value: 'move', label: 'הזזה לשעה אחרת באותו יום' }], 'cancel') + '</select></label>' +
      '<label class="full"><span>מפגש</span><select data-f="sessionId" id="cs"></select></label><label><span>שעה חדשה (להזזה)</span>' + U.timeInput('start', '') + '</label><label><span>עד</span>' + U.timeInput('end', '') + '</label><label class="full"><span>הערה</span><input data-f="note"></label></div>', [
      { label: 'שמירה', cls: 'pri', onClick: el => {
        const d = readForm(el); d.date = $('#cd', el).value;
        if (!d.sessionId) { toast('בחרו מפגש'); return false; }
        if (d.kind === 'move' && !(d.end > d.start)) { toast('שעות לא תקינות'); return false; }
        Store.change('שינוי חד-פעמי', st => st.oneOffs.push(Object.assign({ id: E.uid('oo') }, d)));
      } }, { label: 'ביטול' }]);
    const fill = () => {
      const ds = $('#cd', m).value; if (!ds) return;
      const r = E.sessionsOnDate(S(), ds);
      $('#cs', m).innerHTML = r.holiday ? '<option value="">חג: ' + esc(r.holiday.label || '') + '</option>' : options(r.sessions.filter(x => !x.oneOff).sort((a, b) => a.start - b.start).map(x => { const a = ctx.act.get(x.activityId); return { value: x.id, label: E.fmtRange(x.start, x.end) + ' ' + E.actLabel(ctx, a) + ' – ' + (E.staffNames(ctx, a.staffIds) || (a.classIds || []).map(c => U.nameOf('class', c)).join(',')) }; }), '');
    };
    $('#cd', m).onchange = fill; fill();
  }

  function absenceDialog() {
    const s = S();
    const m = modal('היעדרות איש צוות', '<div class="form-grid"><label><span>איש צוות</span><select id="ab">' + options(s.staff, '') + '</select></label><label><span>תאריך</span><input type="date" id="ad" value="' + new Date().toISOString().slice(0, 10) + '"></label></div><div id="aff" style="margin-top:10px"></div>', [
      { label: 'החלת השינויים', cls: 'pri', onClick: el => {
        const ds = $('#ad', el).value; const sid = $('#ab', el).value;
        const rows = $$('[data-aff]', el);
        if (!rows.length) return;
        Store.change('היעדרות ' + U.nameOf('staff', sid), st => {
          const ctx = E.makeCtx(st);
          rows.forEach(r => {
            const ses = st.sessions.find(x => x.id === r.dataset.aff);
            const rep = $('select', r).value;
            st.oneOffs.push({ id: E.uid('oo'), kind: 'cancel', date: ds, sessionId: ses.id, note: 'היעדרות ' + U.nameOf('staff', sid) });
            if (rep) {
              const a = ctx.act.get(ses.activityId);
              st.oneOffs.push({ id: E.uid('oo'), kind: 'add', date: ds, start: ses.start, end: ses.end, title: E.actLabel(ctx, a) + ' (מחליף/ה)', type: a.type, staffIds: (a.staffIds || []).filter(x => x !== sid).concat([rep]), studentIds: E.studentsOf(ctx, a), classIds: [], note: 'במקום ' + U.nameOf('staff', sid) });
            }
          });
        });
        toast('נשמר – המפגשים בוטלו/הוחלפו לתאריך זה');
      } }, { label: 'ביטול' }], { wide: true });
    const fill = () => {
      const st = S(); const ctx = E.makeCtx(st);
      const sid = $('#ab', m).value, ds = $('#ad', m).value; if (!sid || !ds) return;
      const r = E.sessionsOnDate(st, ds);
      const aff = r.sessions.filter(x => { const a = ctx.act.get(x.activityId); return a && (a.staffIds || []).includes(sid) && !x.oneOff; }).sort((a, b) => a.start - b.start);
      if (!aff.length) { $('#aff', m).innerHTML = '<div class="alert ok">אין לאיש הצוות מפגשים בתאריך זה</div>'; return; }
      const day = E.parseDate(ds).getUTCDay();
      $('#aff', m).innerHTML = '<table class="data"><tr><th>שעה</th><th>מפגש</th><th>תלמידים מושפעים</th><th>מחליף/ה (פנויים, מאותו תחום קודם)</th></tr>' + aff.map(x => {
        const a = ctx.act.get(x.activityId);
        const me = st.staff.find(q => q.id === sid);
        const chk = E.checkTime(st, { day, start: x.start, end: x.end, staffIds: st.staff.filter(q => q.id !== sid).map(q => q.id) });
        const free = chk.rows.filter(q => q.status === 'free').map(q => st.staff.find(z => z.id === q.id))
          .sort((p, q) => (E.specialtyMatch(q, a.specialty || (me.specialties || [])[0]) ? 1 : 0) - (E.specialtyMatch(p, a.specialty || (me.specialties || [])[0]) ? 1 : 0));
        return '<tr data-aff="' + x.id + '"><td>' + E.fmtRange(x.start, x.end) + '</td><td>' + esc(E.actLabel(ctx, a)) + '</td><td class="small">' + esc(E.studentsOf(ctx, a).map(q => E.studentShort(ctx.students.get(q))).join(', ')) + '</td><td><select>' + options(free.map(q => ({ value: q.id, label: q.name + ((q.specialties || []).length ? ' (' + q.specialties.join(', ') + ')' : '') })), '', { empty: '— ביטול בלבד —' }) + '</select></td></tr>';
      }).join('') + '</table>';
    };
    $('#ab', m).onchange = fill; $('#ad', m).onchange = fill; fill();
  }

  function entityOptions(kind, sel) {
    const s = S();
    if (kind === 'student') return options(U.studentItems().map(x => ({ value: x.id, label: x.label + ' – ' + x.group })), sel);
    if (kind === 'staff') return options(s.staff, sel);
    if (kind === 'room') return options(s.rooms, sel);
    if (kind === 'regular') return options(s.classes.filter(c => c.kind === 'regular'), sel);
    return options(s.classes.filter(c => c.kind !== 'regular'), sel);
  }
  function entityIds(kind) {
    const s = S();
    if (kind === 'student') return U.studentItems().map(x => x.id);
    if (kind === 'staff') return s.staff.map(x => x.id);
    if (kind === 'room') return s.rooms.map(x => x.id);
    if (kind === 'regular') return s.classes.filter(c => c.kind === 'regular').map(c => c.id);
    return s.classes.filter(c => c.kind !== 'regular').map(c => c.id);
  }

  // ================= הפקת מערכות =================
  P.export = function (main, params) {
    const s = S();
    const mem = root.App.mem;
    const st = mem.exp || (mem.exp = { kind: 'student', id: '', all: false, mode: 'week', day: s.settings.days[0], from: '', to: '', date: new Date().toISOString().slice(0, 10), month: new Date().toISOString().slice(0, 7), pattern: 'all', showNames: true, icons: false, color: true, staff: true, rooms: false, classFilter: '' });
    if (params && params.kind) { st.kind = params.kind; st.id = params.id || ''; st.all = false; }
    main.innerHTML = '<h1>הפקת מערכות שעות</h1><div class="card" id="ef"><div class="form-grid">' +
      '<label><span>סוג מערכת</span><select data-f="kind" id="ek">' + options(Object.entries(V.KINDS).map(([k, v]) => ({ value: k, label: v })), st.kind) + '</select></label>' +
      '<label><span>עבור</span><select data-f="id" id="ei"></select></label>' +
      '<label class="row"><input type="checkbox" data-f="all" id="eall"' + (st.all ? ' checked' : '') + '> הפקה מרוכזת לכולם (כל אחד בעמוד נפרד)</label>' +
      '<label id="ecfw"><span>סינון לפי כיתה (בהפקה מרוכזת לתלמידים)</span><select data-f="classFilter">' + options(s.classes.filter(c => c.kind !== 'regular'), st.classFilter, { empty: 'כל הכיתות' }) + '</select></label>' +
      '<label><span>טווח</span><select data-f="mode" id="em">' + options([{ value: 'week', label: 'שבוע (תבנית קבועה)' }, { value: 'day', label: 'יום אחד בשבוע' }, { value: 'hours', label: 'שעות מסוימות' }, { value: 'date', label: 'תאריך מסוים (כולל שינויים)' }, { value: 'weekOf', label: 'שבוע מסוים בתאריכים' }, { value: 'month', label: 'חודש' }], st.mode) + '</select></label>' +
      '<label data-m="day hours"><span>יום</span><select data-f="day">' + options([{ value: '', label: 'כל הימים' }].concat(s.settings.days.map(d => ({ value: d, label: E.DAY_NAMES[d] }))), st.day) + '</select></label>' +
      '<label data-m="hours"><span>משעה</span>' + U.timeInput('from', st.from) + '</label><label data-m="hours"><span>עד שעה</span>' + U.timeInput('to', st.to) + '</label>' +
      '<label data-m="date weekOf"><span>תאריך</span><input type="date" data-f="date" value="' + st.date + '"></label>' +
      '<label data-m="month"><span>חודש</span><input type="month" data-f="month" value="' + st.month + '"></label>' +
      (s.settings.abWeeks ? '<label data-m="week day hours"><span>שבוע</span><select data-f="pattern">' + options([{ value: 'all', label: 'כל השבועות' }, { value: 'A', label: 'שבוע א' }, { value: 'B', label: 'שבוע ב' }], st.pattern) + '</select></label>' : '') +
      '<div class="full row"><label class="row"><input type="checkbox" data-f="showNames"' + (st.showNames ? ' checked' : '') + '> שמות תלמידים</label><label class="row"><input type="checkbox" data-f="staff"' + (st.staff ? ' checked' : '') + '> שמות צוות</label><label class="row"><input type="checkbox" data-f="icons"' + (st.icons ? ' checked' : '') + '> סמלים</label><label class="row"><input type="checkbox" data-f="color"' + (st.color ? ' checked' : '') + '> צבעים</label><label class="row"><input type="checkbox" data-f="rooms"' + (st.rooms ? ' checked' : '') + '> חדרים</label></div>' +
      '</div><div class="row" style="margin-top:10px"><button id="prev">תצוגה מקדימה</button><button class="pri" id="pr">הדפסה / שמירה כ-PDF</button><button id="xl">הורדת Excel</button><button id="wd">הורדת Word</button></div>' +
      '<p class="muted small">PDF: בחלון ההדפסה בחרו "שמירה כ-PDF". Word: נפתח ב-Word וניתן לערוך. Excel: כל מערכת בגיליון נפרד.</p></div><div id="eprev" class="tt-preview"></div>';
    const fillIds = () => { $('#ei').innerHTML = entityOptions($('#ek').value, st.id); };
    const sync = () => {
      const mode = $('#em').value;
      $$('[data-m]', main).forEach(l => { l.style.display = l.dataset.m.split(' ').includes(mode) ? '' : 'none'; });
      $('#ei').disabled = $('#eall').checked;
      $('#ecfw').style.display = $('#eall').checked && $('#ek').value === 'student' ? '' : 'none';
    };
    $('#ek').onchange = () => { st.id = ''; fillIds(); sync(); }; $('#em').onchange = sync; $('#eall').onchange = sync;
    fillIds(); sync();
    const build = () => {
      const d = readForm($('#ef')); Object.assign(st, d);
      const range = { mode: d.mode === 'hours' ? (d.day !== '' ? 'day' : 'week') : d.mode, day: d.day === '' ? null : Number(d.day), date: d.date, month: d.month };
      if (d.mode === 'day' && d.day === '') range.mode = 'week';
      if (d.mode === 'hours') { if (d.from === '' || d.to === '') { toast('בחרו שעות'); return null; } range.from = d.from; range.to = d.to; }
      let ids = d.all ? entityIds(d.kind) : [d.id];
      if (d.all && d.kind === 'student' && d.classFilter) ids = ids.filter(id => (S().students.find(x => x.id === id) || {}).classId === d.classFilter);
      ids = ids.filter(Boolean);
      if (!ids.length) { toast('אין למי להפיק'); return null; }
      return ids.map(id => V.build(S(), { kind: d.kind, id, range, pattern: d.pattern, options: { showNames: d.showNames } }));
    };
    const ropts = () => ({ icons: st.icons, color: st.color, staff: st.staff, rooms: st.rooms });
    $('#prev').onclick = () => { const v = build(); if (v) $('#eprev').innerHTML = v.map(x => R.viewHtml(x, ropts())).join('<hr>'); };
    $('#pr').onclick = () => { const v = build(); if (v) R.printViews(v, ropts()); };
    $('#xl').onclick = () => { const v = build(); if (v) R.excelViews(v); };
    $('#wd').onclick = () => { const v = build(); if (v) R.wordViews(v, ropts()); };
    if (st.id || params) $('#prev').click();
  };

  // ================= דוחות =================
  P.reports = function (main) {
    const s = S(); const ctx = E.makeCtx(s);
    const load = E.staffLoad(s);
    const cov = E.coverage(s);
    const rows = s.students.map(st => ({ st, r: E.studentReport(s, st.id) }));
    main.innerHTML = '<h1>דוחות</h1><div class="toolbar"><button id="xl">הורדת כל הדוחות ל-Excel</button></div>' +
      '<div class="card"><h2>עומס צוות (שעות שבועיות)</h2><table class="data"><tr><th>שם</th><th>תפקיד</th><th>משובץ</th><th>מכסה</th></tr>' + load.map(l => '<tr><td>' + esc(l.name) + '</td><td>' + esc(E.ROLES[l.role] || '') + '</td><td>' + U.hours(l.load) + '</td><td>' + (l.max ? '<span class="chip ' + (l.over ? 'bad' : 'ok') + '">' + U.hours(l.max) + '</span>' : '—') + '</td></tr>').join('') + '</table></div>' +
      '<div class="card"><h2>תלמידים – שעות לפי סוג, ומה מפספסים</h2><table class="data"><tr><th>תלמיד</th><th>כיתה</th>' + ['inclusion', 'therapy', 'help', 'group'].map(t => '<th>' + E.TYPES[t].label + '</th>').join('') + '<th>שיעורים שמפספסים (דק\'/שבוע)</th></tr>' +
      rows.map(({ st, r }) => '<tr><td>' + esc(E.studentFull(st)) + '</td><td>' + esc(U.nameOf('class', st.classId)) + '</td>' + ['inclusion', 'therapy', 'help', 'group'].map(t => '<td>' + (r.byType[t] ? U.hours(r.byType[t]) : '') + '</td>').join('') + '<td class="small">' + Object.entries(r.missed).map(([k, v]) => esc(k) + ': ' + Math.round(v)).join(' · ') + '</td></tr>').join('') + '</table></div>' +
      '<div class="card"><h2>כיסוי פעילויות</h2><table class="data"><tr><th>פעילות</th><th>סוג</th><th>נדרש</th><th>שובץ</th></tr>' + cov.map(c => '<tr><td>' + esc(c.title) + '</td><td>' + esc(E.TYPES[c.type] ? E.TYPES[c.type].label : '') + '</td><td>' + c.required + '</td><td><span class="chip ' + (c.missing ? 'warn' : 'ok') + '">' + c.scheduled + '</span></td></tr>').join('') + '</table></div>' +
      '<div class="card"><h2>יומן שינויים אחרונים</h2>' + (s.log || []).slice(-40).reverse().map(l => '<div class="small">' + new Date(l.t).toLocaleString('he-IL') + ' – ' + esc(l.label) + '</div>').join('') + '</div>';
    $('#xl').onclick = () => {
      const X = root.XLSX; const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['שם', 'תפקיד', 'שעות משובצות', 'מכסה']].concat(load.map(l => [l.name, E.ROLES[l.role] || '', +(l.load / 60).toFixed(2), l.max ? +(l.max / 60).toFixed(2) : '']))), 'עומס צוות');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['תלמיד', 'כיתה', 'שילוב (ש)', 'טיפולים (ש)', 'עזרה (ש)', 'חוגים (ש)', 'מפספס']].concat(rows.map(({ st, r }) => [E.studentFull(st), U.nameOf('class', st.classId)].concat(['inclusion', 'therapy', 'help', 'group'].map(t => r.byType[t] ? +(r.byType[t] / 60).toFixed(2) : '')).concat([Object.entries(r.missed).map(([k, v]) => k + ': ' + Math.round(v)).join(', ')])))), 'תלמידים');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['פעילות', 'נדרש', 'שובץ']].concat(cov.map(c => [c.title, c.required, c.scheduled]))), 'כיסוי');
      wb.Workbook = { Views: [{ RTL: true }] };
      X.writeFile(wb, 'דוחות שיבוץ.xlsx');
    };
  };

  // ================= מדריך =================
  P.help = function (main) {
    main.innerHTML = '<h1>מדריך שימוש</h1>' +
      '<div class="card"><h2>סרטון הדרכה</h2><p class="muted small">כחמש דקות. מעבר על כל שלבי העבודה, עם סימון המקום המדויק בכל מסך.</p>' +
      '<video controls preload="metadata" src="docs/video/tutorial.mp4" style="width:100%;max-width:960px;border:1px solid var(--line);border-radius:6px;background:#000"></video></div>' +
      '<div class="card help">' +
      '<h2>הרעיון</h2><p>בונים פעם אחת את <b>הנתונים</b> (תלמידים, צוות, כיתות, מערכת צלצולים) ואת <b>הדרישות</b> (פעילויות: מה צריך לקרות, עם מי, כמה פעמים בשבוע ובאילו אילוצים). המערכת משבצת אוטומטית, מזהה התנגשויות, ומאפשרת לשנות בכל רגע.</p>' +
      '<h2>שכבות – איך המערכת "חושבת" על תלמיד</h2><ul><li><b>כיתת אם</b> – שיעורים כיתתיים ושגרה (תפילה, ארוחה).</li><li><b>שילוב</b> – התלמיד יוצא מכיתת האם לכיתה רגילה. אפשר לקשר לשיעור מסוים של הכיתה הרגילה – והשילוב ישובץ בדיוק בזמנים שלו.</li><li><b>יציאה</b> – טיפול/עזרה/חוג: התלמיד יוצא מכל מקום שבו הוא נמצא.</li></ul><p>שתי פעילויות באותה שכבה בו-זמנית = התנגשות. יציאה משיעור רגיל מותרת אך "עולה" (המערכת מעדיפה להימנע, ובמיוחד מהוצאה משילוב). שיעור שסומן <b>מוגן</b> – אסור לצאת ממנו.</p>' +
      '<h2>בדיקת זמן ושינוי במינימום שינויים</h2><p>בעמוד "בדיקת זמן" בוחרים זמן ואנשים – ומקבלים סטטוס לכל אחד. בוחרים פעילות – ומקבלים: האם אפשר, ואם לא – אילו מפגשים צריך להזיז (0, 1 או 2) כדי שזה יתאפשר בדיוק בזמן המבוקש, או חלופות קרובות. גם גרירה בלוח השיבוץ מפעילה את אותה בדיקה.</p>' +
      '<h2>4 סוגי מערכות (ועוד)</h2><ol><li><b>תלמיד</b> – רק מה שרלוונטי אליו, עם סמלים וצבעים, בלי שיעורים שהוא לא נמצא בהם.</li><li><b>כיתתית</b> – מה שרלוונטי לכל/רוב הכיתה (הסף ניתן לשינוי בהגדרות).</li><li><b>מחנך חנ"מ</b> – הכל: שיעורים, כל יציאה של כל תלמיד (עם שמות), שילובים, הדרכות קבועות ומשתנות (בתצוגת תאריך/חודש).</li><li><b>מורה בכיתה רגילה</b> – קומפקטי: מתי התלמיד בכיתה, ומתי ולאן הוא יוצא ועם מי.</li><li>בנוסף: מערכת לאיש צוות/מטפל ולחדר.</li></ol><p>טווחים: שבוע, יום, שעות מסוימות, תאריך, שבוע בתאריכים, חודש. פורמטים: הדפסה/PDF, Excel, Word.</p>' +
      '<h2>המלצות</h2><p>מכניסים המלצה (תלמיד + תחום + תדירות). המערכת מוצאת אנשי צוות עם התחום ושעות פנויות, ומציעה הצטרפות לקבוצה קיימת או מפגש חדש בזמן שהתלמיד פנוי – ובלחיצה זה משובץ.</p>' +
      '<h2>שמירה וגיבוי</h2><p>הנתונים נשמרים אוטומטית בדפדפן במחשב זה בלבד (לא נשלחים לשום שרת – חשוב לפרטיות התלמידים). מומלץ להוריד <b>גיבוי</b> מדי פעם, ולשמור <b>גרסאות</b> לפני שינויים גדולים. כל פעולה ניתנת לביטול (Ctrl+Z).</p>' +
      '<h2>קיצורי מקלדת</h2><ul><li>Ctrl+Z – ביטול · Ctrl+Y – שחזור</li></ul>' +
      '<h2>מדריך מלא</h2><p>הסבר מפורט צעד אחר צעד לעובד חדש: <a href="https://github.com/hightake/school-scheduler/blob/main/docs/GUIDE.md" target="_blank" rel="noopener">docs/GUIDE.md</a> (נמצא גם בתיקיית docs שליד התוכנה).</p></div>';
  };
})(window);
