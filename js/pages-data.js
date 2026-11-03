/* עמודי נתונים: לוח בקרה, תלמידים, צוות, כיתות, פעילויות, הגדרות, ייבוא */
(function (root) {
  'use strict';
  const E = root.Engine, U = root.UI, Store = root.Model.Store;
  const { esc, $, $$, S, modal, toast, options, readForm } = U;
  const P = root.Pages = root.Pages || {};

  // ================= לוח בקרה =================
  P.dashboard = function (main) {
    const s = S();
    if (!s.students.length && !s.staff.length) {
      main.innerHTML = '<h1>ברוכים הבאים לשיבוץ </h1><div class="card"><p>מערכת לבניית מערכות שעות חכמה למוסד חינוכי – עם התחשבות באילוצים של תלמידים, מורים, מטפלים, כיתות ושילוב בכיתות רגילות.</p>' +
        '<ol><li>הגדירו את ימי הלימודים ושעות השיעורים ב<b>הגדרות</b>.</li><li>הכניסו (או ייבאו מאקסל/PDF/Word) <b>תלמידים, צוות וכיתות</b>.</li><li>הגדירו <b>פעילויות ודרישות</b> – שיעורים, שילוב, טיפולים, הדרכות.</li><li>לחצו <b>שיבוץ אוטומטי</b> בלוח השיבוץ, ותקנו בגרירה.</li><li>הפיקו מערכות לתלמיד / כיתה / מחנך / מורה בכיתה רגילה.</li></ol>' +
        '<div class="row"><button class="pri" id="loadSample">טעינת נתוני דוגמה להתנסות</button><button data-go="settings">התחלה מאפס – להגדרות</button><button data-go="import">ייבוא מקבצים</button></div></div>';
      $('#loadSample').onclick = () => { Store.replace(root.Model.sampleState(), 'טעינת נתוני דוגמה'); toast('נתוני דוגמה נטענו. עברו ללוח השיבוץ ולחצו "שיבוץ אוטומטי"'); };
      return;
    }
    const conf = E.allConflicts(s);
    const cov = E.coverage(s).filter(c => c.missing > 0);
    const load = E.staffLoad(s).filter(x => x.over);
    const recs = s.recommendations.filter(r => r.status === 'open');
    main.innerHTML = '<h1>לוח בקרה</h1><div class="cards">' +
      stat(s.students.length, 'תלמידים', '', 'students') + stat(s.staff.length, 'אנשי צוות', '', 'staff') + stat(s.classes.length, 'כיתות', '', 'classes') +
      stat(s.activities.length, 'פעילויות', '', 'activities') + stat(s.sessions.length, 'מפגשים משובצים', '', 'board') +
      stat(conf.length, 'התנגשויות', conf.length ? 'bad' : 'ok', 'board') + stat(cov.reduce((x, c) => x + c.missing, 0), 'מפגשים שטרם שובצו', cov.length ? 'warn' : 'ok', 'board') +
      stat(recs.length, 'המלצות פתוחות', recs.length ? 'warn' : 'ok', 'recs') + '</div>' +
      '<div class="toolbar"><button class="pri" data-go="board">ללוח השיבוץ</button><button data-go="check">בדיקת זמן</button><button data-go="export">הפקת מערכות</button></div>' +
      (conf.length ? '<div class="card"><h2>התנגשויות (' + conf.length + ')</h2>' + conf.slice(0, 30).map(c => '<div class="alert bad">יום ' + E.DAY_NAMES[c.day] + ' ' + c.time + ' – <b>' + esc(c.title) + '</b>: ' + esc(c.reason) + '</div>').join('') + '</div>' : '<div class="alert ok">אין התנגשויות במערכת</div>') +
      (cov.length ? '<div class="card"><h2>⏳ פעילויות שחסרים להן מפגשים</h2><table class="data"><tr><th>פעילות</th><th>נדרש</th><th>שובץ</th><th></th></tr>' + cov.map(c => '<tr><td>' + esc(c.title) + '</td><td>' + c.required + '</td><td>' + c.scheduled + '</td><td><button class="sm" data-find="' + c.activityId + '">מצא מקום</button></td></tr>').join('') + '</table></div>' : '') +
      (load.length ? '<div class="card"><h2>חריגה ממכסת שעות</h2>' + load.map(l => '<div class="alert warn">' + esc(l.name) + ': ' + U.hours(l.load) + ' מתוך ' + U.hours(l.max) + '</div>').join('') + '</div>' : '') +
      (recs.length ? '<div class="card"><h2>המלצות שממתינות לשיבוץ</h2>' + recs.map(r => '<div class="alert info">' + esc(U.nameOf('student', r.studentId)) + ' – ' + esc(r.specialty) + ' <button class="sm" data-go="recs">לטיפול</button></div>').join('') + '</div>' : '');
    $$('[data-find]', main).forEach(b => b.onclick = () => root.Pages.findSlotDialog(b.dataset.find));
  };
  function stat(n, label, cls, go) { return '<div class="stat ' + (cls || '') + '" data-go="' + go + '" style="cursor:pointer"><b>' + n + '</b>' + esc(label) + '</div>'; }

  // ================= תלמידים =================
  P.students = function (main, params) {
    const s = S();
    const f = (params && params.classId) || root.App.mem.studentClass || '';
    const list = s.students.filter(x => !f || x.classId === f).sort((a, b) => E.studentFull(a).localeCompare(E.studentFull(b)));
    const cls = new Map(s.classes.map(c => [c.id, c]));
    const ctx = E.makeCtx(s);
    main.innerHTML = '<h1>תלמידים</h1><div class="toolbar"><button class="pri" id="add">+ תלמיד חדש</button><button id="bulk">+ הוספה מרובה (רשימת שמות)</button><button data-go="import">ייבוא מקובץ</button>' +
      '<select id="fcls">' + options(s.classes, f, { empty: 'כל הכיתות' }) + '</select><input id="q" type="search" placeholder="חיפוש שם..."><span class="muted">' + list.length + ' תלמידים</span></div>' +
      '<table class="data" id="tbl"><thead><tr><th>שם</th><th>כיתה</th><th>פעילויות</th><th>אילוצים</th><th>הערות</th><th></th></tr></thead><tbody>' +
      list.map(st => {
        const acts = s.activities.filter(a => E.studentsOf(ctx, a).includes(st.id) && E.layerOf(a) > 0);
        return '<tr data-name="' + esc(E.studentFull(st)) + '"><td><b>' + esc(E.studentFull(st)) + '</b></td><td>' + esc((cls.get(st.classId) || {}).name || '—') + '</td><td>' +
          acts.map(a => '<span class="chip">' + U.dot(a) + esc(a.title) + '</span>').join('') + '</td><td>' + (st.unavailable || []).map(u => '<span class="chip warn">' + E.DAY_SHORT[u.day] + ' ' + E.fmtRange(u.start, u.end) + '</span>').join('') +
          '</td><td class="small">' + esc(st.notes || '') + '</td><td style="white-space:nowrap"><button class="sm" data-tt="' + st.id + '">מערכת</button> <button class="sm" data-rec="' + st.id + '">+ המלצה</button> <button class="sm" data-edit="' + st.id + '">עריכה</button></td></tr>';
      }).join('') + '</tbody></table>';
    $('#fcls').onchange = e => { root.App.mem.studentClass = e.target.value; P.students(main); };
    $('#q').oninput = e => $$('#tbl tbody tr', main).forEach(tr => tr.style.display = tr.dataset.name.includes(e.target.value.trim()) ? '' : 'none');
    $('#add').onclick = () => editStudent(null, f);
    $('#bulk').onclick = () => bulkStudents(f);
    $$('[data-edit]', main).forEach(b => b.onclick = () => editStudent(b.dataset.edit));
    $$('[data-tt]', main).forEach(b => b.onclick = () => U.openTimetable('student', b.dataset.tt));
    $$('[data-rec]', main).forEach(b => b.onclick = () => root.Pages.recDialog({ studentId: b.dataset.rec }));
  };

  function editStudent(id, classId) {
    const s = S();
    const st = id ? s.students.find(x => x.id === id) : { firstName: '', lastName: '', classId: classId || '', unavailable: [], notes: '', icon: '' };
    const ctx = E.makeCtx(s);
    const acts = id ? s.activities.filter(a => E.studentsOf(ctx, a).includes(id)) : [];
    const rep = id ? E.studentReport(s, id) : null;
    const body = '<div class="form-grid"><label><span>שם פרטי</span><input data-f="firstName" value="' + esc(st.firstName) + '"></label><label><span>שם משפחה</span><input data-f="lastName" value="' + esc(st.lastName) + '"></label>' +
      '<label><span>כיתת אם</span><select data-f="classId">' + options(s.classes, st.classId, { empty: '— ללא —' }) + '</select></label><label><span>סמל לזיהוי (לא חובה)</span><input data-f="icon" value="' + esc(st.icon || '') + '" maxlength="4"></label>' +
      '<div class="full field"><span>זמנים שבהם התלמיד לא זמין (טיפול חיצוני, הסעה, וכו\')</span>' + U.winsEditor('unavailable', st.unavailable, { reason: true }) + '</div>' +
      '<label class="full"><span>הערות / צרכים</span><textarea data-f="notes">' + esc(st.notes || '') + '</textarea></label></div>' +
      (id ? '<h3>פעילויות של התלמיד</h3>' + (acts.length ? acts.map(a => '<span class="chip">' + U.dot(a) + esc(a.title) + '</span>').join('') : '<span class="muted">אין</span>') +
        (Object.keys(rep.missed).length ? '<h3>מה התלמיד מפספס בגלל יציאות (דקות בשבוע)</h3>' + Object.entries(rep.missed).map(([k, v]) => '<span class="chip warn">' + esc(k) + ': ' + Math.round(v) + '</span>').join('') : '') : '');
    const btns = [{ label: 'שמירה', cls: 'pri', onClick: el => {
      const d = readForm(el);
      if (!d.firstName.trim()) { toast('נא להזין שם'); return false; }
      Store.change(id ? 'עדכון תלמיד' : 'הוספת תלמיד', state => {
        if (id) Object.assign(state.students.find(x => x.id === id), d);
        else state.students.push(Object.assign({ id: E.uid('stu'), needs: [] }, d));
      });
    } }];
    if (id) btns.push({ label: 'מחיקה', cls: 'danger', onClick: async () => {
      if (!(await U.confirmBox('למחוק את התלמיד? הוא יוסר מכל הפעילויות.'))) return false;
      Store.change('מחיקת תלמיד', state => {
        state.students = state.students.filter(x => x.id !== id);
        state.activities.forEach(a => { a.studentIds = (a.studentIds || []).filter(x => x !== id); });
        state.recommendations = state.recommendations.filter(r => r.studentId !== id);
      });
    } });
    btns.push({ label: 'ביטול' });
    U.bindPickers(modal(id ? 'עריכת תלמיד' : 'תלמיד חדש', body, btns));
  }

  function bulkStudents(classId) {
    const s = S();
    const m = modal('הוספת תלמידים מרובה', '<label><span>כיתה</span><select data-f="classId">' + options(s.classes, classId, { empty: '— ללא —' }) + '</select></label><p class="muted">הדביקו שם מלא בכל שורה (שם פרטי ואחריו שם משפחה):</p><textarea data-f="names" style="min-height:200px"></textarea>', [
      { label: 'הוספה', cls: 'pri', onClick: el => {
        const d = readForm(el);
        const names = d.names.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
        Store.change('הוספת ' + names.length + ' תלמידים', state => {
          for (const n of names) state.students.push(Object.assign({ id: E.uid('stu'), classId: d.classId, unavailable: [], needs: [], notes: '' }, root.Importer.splitName(n)));
        });
        toast('נוספו ' + names.length + ' תלמידים');
      } }, { label: 'ביטול' }]);
    return m;
  }

  // ================= צוות =================
  P.staff = function (main) {
    const s = S();
    const loads = new Map(E.staffLoad(s).map(x => [x.staffId, x]));
    const list = s.staff.slice().sort((a, b) => (a.role || '').localeCompare(b.role || '') || a.name.localeCompare(b.name));
    main.innerHTML = '<h1>צוות ומטפלים</h1><div class="toolbar"><button class="pri" id="add">+ איש צוות</button><button data-go="import">ייבוא מקובץ</button><input id="q" type="search" placeholder="חיפוש..."></div>' +
      '<table class="data" id="tbl"><thead><tr><th>שם</th><th>תפקיד</th><th>תחומים</th><th>זמינות</th><th>עומס שבועי</th><th></th></tr></thead><tbody>' +
      list.map(st => {
        const l = loads.get(st.id);
        return '<tr data-name="' + esc(st.name + ' ' + (st.specialties || []).join(' ')) + '"><td><b>' + esc(st.name) + '</b>' + (st.phone ? '<div class="small muted">' + esc(st.phone) + '</div>' : '') + '</td><td>' + esc(E.ROLES[st.role] || '') + '</td><td>' +
          (st.specialties || []).map(x => '<span class="chip">' + esc(x) + '</span>').join('') + '</td><td class="small">' + (st.availability && st.availability.length ? st.availability.map(w => E.DAY_SHORT[w.day] + ' ' + E.fmtRange(w.start, w.end)).join('<br>') : 'כל שעות הלימודים') +
          '</td><td><span class="chip ' + (l.over ? 'bad' : '') + '">' + U.hours(l.load) + (l.max ? ' / ' + U.hours(l.max) : '') + '</span></td><td style="white-space:nowrap"><button class="sm" data-tt="' + st.id + '">מערכת</button> <button class="sm" data-edit="' + st.id + '">עריכה</button></td></tr>';
      }).join('') + '</tbody></table>';
    $('#q').oninput = e => $$('#tbl tbody tr', main).forEach(tr => tr.style.display = tr.dataset.name.includes(e.target.value.trim()) ? '' : 'none');
    $('#add').onclick = () => editStaff(null);
    $$('[data-edit]', main).forEach(b => b.onclick = () => editStaff(b.dataset.edit));
    $$('[data-tt]', main).forEach(b => b.onclick = () => U.openTimetable('staff', b.dataset.tt));
  };

  function editStaff(id) {
    const s = S();
    const st = id ? s.staff.find(x => x.id === id) : { name: '', role: 'therapist', specialties: [], availability: [], unavailable: [], maxMinutesWeek: '', maxPerDay: '', phone: '', notes: '' };
    const specs = Array.from(new Set((s.settings.specialties || []).concat(st.specialties || [])));
    const body = '<div class="form-grid"><label><span>שם</span><input data-f="name" value="' + esc(st.name) + '"></label><label><span>תפקיד</span><select data-f="role">' + options(Object.entries(E.ROLES).map(([k, v]) => ({ value: k, label: v })), st.role) + '</select></label>' +
      '<label><span>טלפון</span><input data-f="phone" value="' + esc(st.phone || '') + '"></label>' +
      '<label><span>מכסת שעות שבועית (שעות)</span><input type="number" step="0.5" min="0" data-f="maxH" value="' + (st.maxMinutesWeek ? st.maxMinutesWeek / 60 : '') + '"></label>' +
      '<label><span>מקסימום שעות ביום</span><input type="number" step="0.5" min="0" data-f="maxD" value="' + (st.maxPerDay ? st.maxPerDay / 60 : '') + '"></label>' +
      '<div class="full field"><span>תחומי התמחות (לזיהוי אוטומטי בהמלצות)</span>' + U.multiPick('specialties', specs.map(x => ({ id: x, label: x })), st.specialties) + '<input data-f="newSpec" placeholder="תחום נוסף (מופרד בפסיקים)" style="margin-top:4px;width:100%"></div>' +
      '<div class="full field"><span>ימים ושעות נוכחות במוסד (ריק = כל שעות הלימודים)</span>' + U.winsEditor('availability', st.availability, { quick: true }) + '</div>' +
      '<div class="full field"><span>זמנים חסומים קבועים (ישיבה, תפקיד אחר...)</span>' + U.winsEditor('unavailable', st.unavailable, { reason: true }) + '</div>' +
      '<label class="full"><span>הערות</span><textarea data-f="notes">' + esc(st.notes || '') + '</textarea></label></div>';
    const btns = [{ label: 'שמירה', cls: 'pri', onClick: el => {
      const d = readForm(el);
      if (!d.name.trim()) { toast('נא להזין שם'); return false; }
      const extra = (d.newSpec || '').split(/[,،]/).map(x => x.trim()).filter(Boolean);
      d.specialties = Array.from(new Set(d.specialties.concat(extra)));
      d.maxMinutesWeek = d.maxH ? Math.round(d.maxH * 60) : ''; d.maxPerDay = d.maxD ? Math.round(d.maxD * 60) : '';
      delete d.maxH; delete d.maxD; delete d.newSpec;
      Store.change(id ? 'עדכון איש צוות' : 'הוספת איש צוות', state => {
        extra.forEach(x => { if (!state.settings.specialties.includes(x)) state.settings.specialties.push(x); });
        if (id) Object.assign(state.staff.find(x => x.id === id), d);
        else state.staff.push(Object.assign({ id: E.uid('stf') }, d));
      });
    } }];
    if (id) btns.push({ label: 'מחיקה', cls: 'danger', onClick: async () => {
      if (!(await U.confirmBox('למחוק את איש הצוות? הוא יוסר מכל הפעילויות.'))) return false;
      Store.change('מחיקת איש צוות', state => {
        state.staff = state.staff.filter(x => x.id !== id);
        state.activities.forEach(a => { a.staffIds = (a.staffIds || []).filter(x => x !== id); });
        state.classes.forEach(c => { if (c.teacherId === id) c.teacherId = ''; });
      });
    } });
    btns.push({ label: 'ביטול' });
    U.bindPickers(modal(id ? 'עריכת איש צוות' : 'איש צוות חדש', body, btns, { wide: true }));
  }

  // ================= כיתות =================
  P.classes = function (main) {
    const s = S();
    const ctx = E.makeCtx(s);
    main.innerHTML = '<h1>כיתות</h1><p class="muted">כיתות חינוך מיוחד = כיתת האם של התלמידים. כיתות רגילות = כיתות שאליהן התלמידים משתלבים בחלק מהיום.</p><div class="toolbar"><button class="pri" id="add">+ כיתה</button><button data-go="import">ייבוא מקובץ</button></div>' +
      '<table class="data"><thead><tr><th>כיתה</th><th>סוג</th><th>מחנך/ת</th><th>תלמידים</th><th></th></tr></thead><tbody>' +
      s.classes.map(c => {
        const n = (ctx.classMembers.get(c.id) || []).length;
        const incl = s.activities.filter(a => a.type === 'inclusion' && a.destClassId === c.id).reduce((x, a) => x + (a.studentIds || []).length, 0);
        return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + (c.kind === 'regular' ? 'רגילה' : 'חינוך מיוחד') + '</td><td>' + esc(U.nameOf('staff', c.teacherId)) + '</td><td>' + (c.kind === 'regular' ? incl + ' משולבים' : n) + '</td><td style="white-space:nowrap">' +
          (c.kind === 'regular' ? '<button class="sm" data-tt="regular:' + c.id + '">מערכת למורה</button>' : '<button class="sm" data-tt="class:' + c.id + '">מערכת כיתתית</button> <button class="sm" data-tt="sped:' + c.id + '">מערכת מחנך</button> <button class="sm" data-go="students" data-cls="' + c.id + '">תלמידים</button>') +
          ' <button class="sm" data-edit="' + c.id + '">עריכה</button></td></tr>';
      }).join('') + '</tbody></table>';
    $('#add').onclick = () => editClass(null);
    $$('[data-edit]', main).forEach(b => b.onclick = () => editClass(b.dataset.edit));
    $$('[data-tt]', main).forEach(b => b.onclick = () => { const [k, id] = b.dataset.tt.split(':'); U.openTimetable(k, id); });
    $$('[data-cls]', main).forEach(b => b.onclick = e => { e.stopPropagation(); root.App.mem.studentClass = b.dataset.cls; root.App.go('students'); });
  };
  function editClass(id) {
    const s = S();
    const c = id ? s.classes.find(x => x.id === id) : { name: '', kind: 'sped', teacherId: '', grade: '', notes: '' };
    const body = '<div class="form-grid"><label><span>שם הכיתה</span><input data-f="name" value="' + esc(c.name) + '"></label><label><span>סוג</span><select data-f="kind">' + options([{ value: 'sped', label: 'חינוך מיוחד (כיתת אם)' }, { value: 'regular', label: 'כיתה רגילה (לשילוב)' }], c.kind) + '</select></label>' +
      '<label><span>מחנך/ת</span><select data-f="teacherId">' + options(s.staff, c.teacherId, { empty: '— ללא —' }) + '</select></label><label><span>שכבה</span><input data-f="grade" value="' + esc(c.grade || '') + '"></label>' +
      '<label class="full"><span>הערות</span><textarea data-f="notes">' + esc(c.notes || '') + '</textarea></label></div>';
    const btns = [{ label: 'שמירה', cls: 'pri', onClick: el => {
      const d = readForm(el); if (!d.name.trim()) { toast('נא להזין שם'); return false; }
      Store.change(id ? 'עדכון כיתה' : 'הוספת כיתה', state => { if (id) Object.assign(state.classes.find(x => x.id === id), d); else state.classes.push(Object.assign({ id: E.uid('cls') }, d)); });
    } }];
    if (id) btns.push({ label: 'מחיקה', cls: 'danger', onClick: async () => {
      if (!(await U.confirmBox('למחוק את הכיתה? התלמידים יישארו ללא כיתה.'))) return false;
      Store.change('מחיקת כיתה', state => {
        state.classes = state.classes.filter(x => x.id !== id);
        state.students.forEach(x => { if (x.classId === id) x.classId = ''; });
        state.activities.forEach(a => { a.classIds = (a.classIds || []).filter(x => x !== id); if (a.destClassId === id) a.destClassId = ''; });
      });
    } });
    btns.push({ label: 'ביטול' });
    modal(id ? 'עריכת כיתה' : 'כיתה חדשה', body, btns);
  }

  // ================= פעילויות =================
  P.activities = function (main) {
    const s = S();
    const ctx = E.makeCtx(s);
    const ft = root.App.mem.actType || '';
    const cnt = new Map(); s.sessions.forEach(x => cnt.set(x.activityId, (cnt.get(x.activityId) || 0) + 1));
    const list = s.activities.filter(a => !ft || a.type === ft);
    main.innerHTML = '<h1>פעילויות ודרישות</h1><p class="muted">כל דבר שצריך להופיע במערכת: שיעור כיתתי, שגרה (תפילה/ארוחה), שילוב בכיתה רגילה, טיפול, עזרה פרטנית, חוג, הדרכה, ישיבה. לכל פעילות מגדירים משתתפים, משך, כמה פעמים בשבוע ואילוצים – והמערכת משבצת.</p>' +
      '<div class="toolbar"><button class="pri" id="add">+ פעילות</button><select id="ft">' + options(Object.entries(E.TYPES).map(([k, t]) => ({ value: k, label: t.label })), ft, { empty: 'כל הסוגים' }) + '</select><input id="q" type="search" placeholder="חיפוש..."></div>' +
      '<table class="data" id="tbl"><thead><tr><th>פעילות</th><th>סוג</th><th>משתתפים</th><th>צוות</th><th>משך</th><th>שובץ / נדרש</th><th></th></tr></thead><tbody>' +
      list.map(a => {
        const studs = E.studentsOf(ctx, a);
        const n = cnt.get(a.id) || 0, req = Number(a.perWeek) || 0;
        const who = (a.classIds || []).map(c => U.nameOf('class', c)).concat((a.studentIds || []).length ? [(a.studentIds || []).map(x => E.studentShort(ctx.students.get(x))).join(', ')] : []).filter(Boolean).join(' + ');
        return '<tr data-name="' + esc(a.title + ' ' + who) + '"><td>' + U.dot(a) + '<b>' + esc(a.title) + '</b>' + (a.weekPattern && a.weekPattern !== 'all' ? ' <span class="chip">שבוע ' + a.weekPattern + '</span>' : '') + (E.isProtected(a) ? ' <span class="chip">מוגן</span>' : '') + (a.linkActivityId ? ' <span class="chip">מקושר ל"' + esc(U.nameOf('activity', a.linkActivityId)) + '"</span>' : '') + '</td><td>' + esc(E.typeOf(a).label) + '</td><td class="small">' + esc(who || '—') + (studs.length ? ' <span class="muted">(' + studs.length + ')</span>' : '') + '</td><td class="small">' + esc(E.staffNames(ctx, a.staffIds)) + '</td><td>' + (a.duration ? a.duration + ' ד\'' : 'שיעור') + '</td><td><span class="chip ' + (n >= req ? 'ok' : 'warn') + '">' + n + ' / ' + req + '</span></td>' +
          '<td style="white-space:nowrap">' + (n < req && !a.linkActivityId ? '<button class="sm" data-find="' + a.id + '">מצא מקום</button> ' : '') + '<button class="sm" data-dup="' + a.id + '">שכפול</button> <button class="sm" data-edit="' + a.id + '">עריכה</button></td></tr>';
      }).join('') + '</tbody></table>';
    $('#ft').onchange = e => { root.App.mem.actType = e.target.value; P.activities(main); };
    $('#q').oninput = e => $$('#tbl tbody tr', main).forEach(tr => tr.style.display = tr.dataset.name.includes(e.target.value.trim()) ? '' : 'none');
    $('#add').onclick = () => editActivity(null);
    $$('[data-edit]', main).forEach(b => b.onclick = () => editActivity(b.dataset.edit));
    $$('[data-find]', main).forEach(b => b.onclick = () => root.Pages.findSlotDialog(b.dataset.find));
    $$('[data-dup]', main).forEach(b => b.onclick = () => {
      Store.change('שכפול פעילות', state => { const a = state.activities.find(x => x.id === b.dataset.dup); state.activities.push(Object.assign(JSON.parse(JSON.stringify(a)), { id: E.uid('act'), title: a.title + ' (עותק)' })); });
    });
  };

  function editActivity(id, preset) {
    const s = S();
    const a = id ? s.activities.find(x => x.id === id) : Object.assign({ title: '', type: 'therapy', classIds: [], studentIds: [], excludeStudentIds: [], staffIds: [], roomId: '', duration: 45, perWeek: 1, weekPattern: 'all', alignToPeriods: true, allowedDays: [], preferredDays: [], windowStart: '', windowEnd: '', specialty: '', maxStudents: '', notes: '', icon: '', protected: null }, preset || {});
    const lessonsOf = s.activities.filter(x => x.type === 'lesson' && x.id !== id);
    const body = '<div class="form-grid">' +
      '<label><span>שם הפעילות</span><input data-f="title" value="' + esc(a.title) + '"></label>' +
      '<label><span>סוג</span><select data-f="type" id="aType">' + options(Object.entries(E.TYPES).map(([k, t]) => ({ value: k, label: t.label })), a.type) + '</select></label>' +
      '<label><span>משך בדקות (ריק = אורך השיעור)</span><input type="number" min="5" step="5" data-f="duration" value="' + esc(a.duration) + '"></label>' +
      '<label><span>מספר מפגשים בשבוע</span><input type="number" min="0" data-f="perWeek" value="' + esc(a.perWeek) + '"></label>' +
      '<label><span>תבנית שבועות</span><select data-f="weekPattern">' + options([{ value: 'all', label: 'כל שבוע' }, { value: 'A', label: 'שבוע א בלבד (לסירוגין)' }, { value: 'B', label: 'שבוע ב בלבד (לסירוגין)' }], a.weekPattern) + '</select></label>' +
      '<label><span>חדר</span><select data-f="roomId">' + options(s.rooms, a.roomId, { empty: '— ללא —' }) + '</select></label>' +
      '<label><span>תחום (לזיהוי בהמלצות)</span><input data-f="specialty" list="specList" value="' + esc(a.specialty || '') + '"><datalist id="specList">' + (s.settings.specialties || []).map(x => '<option value="' + esc(x) + '">').join('') + '</datalist></label>' +
      '<label><span>מקסימום תלמידים בקבוצה</span><input type="number" min="0" data-f="maxStudents" value="' + esc(a.maxStudents || '') + '"></label>' +
      '<label><span>סמל במערכת התלמיד (לא חובה)</span><input data-f="icon" value="' + esc(a.icon || '') + '" maxlength="4" placeholder="' + esc(E.typeOf(a).icon) + '"></label>' +
      '<label><span>צבע</span><input type="color" data-f="color" value="' + esc(a.color || E.typeOf(a).color) + '"></label>' +
      '<div class="full field"><span>כיתות משתתפות (כל תלמידי הכיתה)</span>' + U.multiPick('classIds', U.classItems(), a.classIds) + '</div>' +
      '<div class="full field"><span>תלמידים משתתפים (בנוסף/במקום כיתה)</span>' + U.multiPick('studentIds', U.studentItems(), a.studentIds) + '</div>' +
      '<div class="full field"><span>אנשי צוות</span>' + U.multiPick('staffIds', U.staffItems(), a.staffIds) + '</div>' +
      '<div class="full card" id="inclBox" style="background:#f0fdf4"><b>שילוב בכיתה רגילה</b><div class="form-grid" style="margin-top:6px"><label><span>כיתת היעד (רגילה)</span><select data-f="destClassId">' + options(s.classes.filter(c => c.kind === 'regular'), a.destClassId, { empty: '— בחרו —' }) + '</select></label>' +
      '<label><span>מקושר לשיעור של כיתת היעד (אופציונלי – השיבוץ יהיה בדיוק בזמני השיעור)</span><select data-f="linkActivityId">' + options(lessonsOf.map(x => ({ value: x.id, label: x.title + ' – ' + (x.classIds || []).map(c => U.nameOf('class', c)).join(', ') })), a.linkActivityId, { empty: '— ללא קישור —' }) + '</select></label></div></div>' +
      '<details class="full"><summary><b>אילוצים מתקדמים</b></summary><div class="form-grid" style="margin-top:8px">' +
      '<div class="field full"><span>רק בימים</span>' + U.daysBoxes('allowedDays', a.allowedDays) + '</div>' +
      '<div class="field full"><span>ימים מועדפים</span>' + U.daysBoxes('preferredDays', a.preferredDays) + '</div>' +
      '<label><span>לא לפני שעה</span>' + U.timeInput('windowStart', a.windowStart) + '</label><label><span>לא אחרי שעה</span>' + U.timeInput('windowEnd', a.windowEnd) + '</label>' +
      '<label><span>שעת התחלה מועדפת</span>' + U.timeInput('preferredStart', a.preferredStart) + '</label>' +
      '<label class="row"><input type="checkbox" data-f="alignToPeriods"' + (a.alignToPeriods !== false ? ' checked' : '') + '> להתחיל בתחילת שיעור / תת-משבצת</label>' +
      '<label class="row"><input type="checkbox" data-f="protected"' + (E.isProtected(a) ? ' checked' : '') + '> מוגן – אסור להוציא תלמידים מפעילות זו</label>' +
      '<label class="row"><input type="checkbox" data-f="allowInBreak"' + (a.allowInBreak ? ' checked' : '') + '> מותר בזמן הפסקה</label>' +
      '<label class="row"><input type="checkbox" data-f="allowSameDay"' + (a.allowSameDay ? ' checked' : '') + '> מותר יותר ממפגש אחד ביום</label>' +
      '<label class="row"><input type="checkbox" data-f="manualOnly"' + (a.manualOnly ? ' checked' : '') + '> שיבוץ ידני בלבד (לא בשיבוץ אוטומטי)</label>' +
      '<div class="full field"><span>תלמידים פטורים (לא משתתפים למרות שהם בכיתה)</span>' + U.multiPick('excludeStudentIds', U.studentItems(), a.excludeStudentIds) + '</div>' +
      '</div></details>' +
      '<label class="full"><span>הערות</span><textarea data-f="notes">' + esc(a.notes || '') + '</textarea></label></div>';
    const btns = [{ label: 'שמירה', cls: 'pri', onClick: el => {
      const d = readForm(el);
      if (!d.title.trim()) d.title = E.TYPES[d.type].label;
      if (d.type !== 'inclusion') { d.destClassId = ''; d.linkActivityId = ''; }
      if (d.color === E.TYPES[d.type].color) d.color = '';
      if (d.protected === !!E.TYPES[d.type].protected) d.protected = null;
      Store.change(id ? 'עדכון פעילות' : 'הוספת פעילות', state => {
        if (id) {
          const x = state.activities.find(q => q.id === id); Object.assign(x, d);
          state.sessions.filter(q => q.activityId === id && !q.locked && d.duration && (q.end - q.start) !== Number(d.duration)).forEach(q => { q.end = q.start + Number(d.duration); });
        } else state.activities.push(Object.assign({ id: E.uid('act') }, d));
      });
      if (!id && d.perWeek && !d.linkActivityId) toast('נשמר. ניתן ללחוץ "מצא מקום" או להריץ שיבוץ אוטומטי');
    } }];
    if (id) {
      btns.push({ label: 'מחיקה', cls: 'danger', onClick: async () => {
        if (!(await U.confirmBox('למחוק את הפעילות ואת כל המפגשים שלה?'))) return false;
        Store.change('מחיקת פעילות', state => { state.activities = state.activities.filter(x => x.id !== id); state.sessions = state.sessions.filter(x => x.activityId !== id); });
      } });
    }
    btns.push({ label: 'ביטול' });
    const m = modal(id ? 'עריכת פעילות' : 'פעילות חדשה', body, btns, { wide: true });
    U.bindPickers(m);
    const sync = () => { $('#inclBox', m).style.display = $('#aType', m).value === 'inclusion' ? '' : 'none'; };
    $('#aType', m).onchange = sync; sync();
  }
  P.editActivity = editActivity;
  P.editStudent = editStudent;
  P.editStaff = editStaff;

  // ================= הגדרות =================
  P.settings = function (main) {
    const s = S(), st = s.settings;
    main.innerHTML = '<h1>הגדרות</h1>' +
      '<div class="card"><h2>כללי</h2><div class="form-grid" id="gen"><label><span>שם המוסד</span><input data-f="institution" value="' + esc(st.institution) + '"></label><label><span>שנת לימודים</span><input data-f="year" value="' + esc(st.year) + '"></label>' +
      '<label><span>כותרת עליונה בהדפסה</span><input data-f="headerLine" value="' + esc(st.headerLine || '') + '"></label>' +
      '<label><span>תחילת שנה"ל</span><input type="date" data-f="yearStart" value="' + esc(st.yearStart || '') + '"></label><label><span>סוף שנה"ל</span><input type="date" data-f="yearEnd" value="' + esc(st.yearEnd || '') + '"></label>' +
      '<label><span>רזולוציית זמן (דקות)</span><input type="number" min="5" step="5" data-f="granularity" value="' + st.granularity + '"></label>' +
      '<label><span>סף "רוב הכיתה" למערכת כיתתית (%)</span><input type="number" min="10" max="100" data-f="thr" value="' + Math.round((st.classThreshold || 0.6) * 100) + '"></label>' +
      '<label class="row"><input type="checkbox" data-f="abWeeks"' + (st.abWeeks ? ' checked' : '') + '> שבועות א/ב לסירוגין</label>' +
      '<div class="full field"><span>ימי לימודים</span>' + U.daysBoxes('days', st.days, true) + '</div></div><button class="pri" id="saveGen">שמירה</button></div>' +
      '<div class="card"><h2>מערכת צלצולים (שיעורים והפסקות)</h2><p class="muted small">"סוג" קובע: שיעור = זמן לשיבוץ; הפסקה/שגרה = מוצג בכל המערכות ולא משובצים בו טיפולים. ימים ריקים = כל הימים.</p><table class="data" id="per"><thead><tr><th>התחלה</th><th>סיום</th><th>שם</th><th>סוג</th><th>רק בימים</th><th></th></tr></thead><tbody>' +
      st.periods.slice().sort((a, b) => a.start - b.start).map(perRow).join('') + '</tbody></table><div class="row" style="margin-top:8px"><button id="addPer">+ שורה</button><button class="pri" id="savePer">שמירת צלצולים</button></div></div>' +
      '<div class="card"><h2>חדרים</h2><table class="data" id="rooms"><thead><tr><th>שם</th><th>קיבולת (מפגשים במקביל)</th><th></th></tr></thead><tbody>' + s.rooms.map(roomRow).join('') + '</tbody></table><div class="row" style="margin-top:8px"><button id="addRoom">+ חדר</button><button class="pri" id="saveRooms">שמירת חדרים</button></div></div>' +
      '<div class="card"><h2>חגים וימים ללא לימודים</h2><table class="data" id="hol"><thead><tr><th>מתאריך</th><th>עד תאריך</th><th>תיאור</th><th></th></tr></thead><tbody>' + (st.holidays || []).map(holRow).join('') + '</tbody></table><div class="row" style="margin-top:8px"><button id="addHol">+ חג/חופשה</button><button class="pri" id="saveHol">שמירה</button></div></div>' +
      '<div class="card"><h2>תחומי טיפול והתמחות</h2><textarea id="specs">' + esc((st.specialties || []).join('\n')) + '</textarea><button class="pri" id="saveSpecs">שמירה</button></div>' +
      '<div class="card"><h2>גיבוי, גרסאות ונתונים</h2><div class="row"><button id="exp">הורדת גיבוי (JSON)</button><label class="row"><span>שחזור מגיבוי:</span><input type="file" id="imp" accept=".json"></label></div>' +
      '<h3>גרסאות שמורות</h3><div class="row"><input id="snapName" placeholder="שם הגרסה (למשל: לפני שינוי טיפולים)"><button id="snap">שמירת גרסה נוכחית</button></div><div id="snaps"></div>' +
      '<h3>אחר</h3><div class="row"><button id="sample">טעינת נתוני דוגמה</button><button class="danger" id="reset">מחיקת כל הנתונים</button><button class="danger" id="clearSes">מחיקת כל המפגשים שאינם נעולים</button></div></div>';

    $('#saveGen').onclick = () => {
      const d = readForm($('#gen'));
      if (!d.days.length) { toast('בחרו לפחות יום אחד'); return; }
      Store.change('עדכון הגדרות', state => { const t = state.settings; t.institution = d.institution; t.year = d.year; t.headerLine = d.headerLine; t.yearStart = d.yearStart; t.yearEnd = d.yearEnd; t.granularity = Number(d.granularity) || 5; t.classThreshold = (Number(d.thr) || 60) / 100; t.abWeeks = d.abWeeks; t.days = d.days.sort(); });
      toast('נשמר');
    };
    $('#addPer').onclick = () => $('#per tbody').insertAdjacentHTML('beforeend', perRow({ start: '', end: '', label: '', kind: 'lesson', days: [] }));
    $('#per').onclick = e => { if (e.target.matches('[data-del]')) e.target.closest('tr').remove(); };
    $('#savePer').onclick = () => {
      const rows = $$('#per tbody tr').map(tr => ({ id: tr.dataset.id || E.uid('per'), start: E.toMin($('[data-p=start]', tr).value), end: E.toMin($('[data-p=end]', tr).value), label: $('[data-p=label]', tr).value, kind: $('[data-p=kind]', tr).value, days: $$('[data-p=days] input:checked', tr).map(i => Number(i.value)) }))
        .filter(p => p.start != null && p.end != null && p.end > p.start).sort((a, b) => a.start - b.start);
      Store.change('עדכון מערכת צלצולים', state => { state.settings.periods = rows; });
      toast('נשמר');
    };
    $('#addRoom').onclick = () => $('#rooms tbody').insertAdjacentHTML('beforeend', roomRow({ name: '', capacity: 1 }));
    $('#rooms').onclick = e => { if (e.target.matches('[data-del]')) e.target.closest('tr').remove(); };
    $('#saveRooms').onclick = () => {
      const rows = $$('#rooms tbody tr').map(tr => ({ id: tr.dataset.id || E.uid('room'), name: $('[data-p=name]', tr).value.trim(), capacity: Number($('[data-p=cap]', tr).value) || 1 })).filter(r => r.name);
      Store.change('עדכון חדרים', state => { const ids = new Set(rows.map(r => r.id)); state.rooms = rows; state.activities.forEach(a => { if (a.roomId && !ids.has(a.roomId)) a.roomId = ''; }); });
      toast('נשמר');
    };
    $('#addHol').onclick = () => $('#hol tbody').insertAdjacentHTML('beforeend', holRow({}));
    $('#hol').onclick = e => { if (e.target.matches('[data-del]')) e.target.closest('tr').remove(); };
    $('#saveHol').onclick = () => {
      const rows = $$('#hol tbody tr').map(tr => ({ date: $('[data-p=date]', tr).value, to: $('[data-p=to]', tr).value, label: $('[data-p=label]', tr).value })).filter(h => h.date).sort((a, b) => a.date.localeCompare(b.date));
      Store.change('עדכון חגים', state => { state.settings.holidays = rows; }); toast('נשמר');
    };
    $('#saveSpecs').onclick = () => { const l = $('#specs').value.split(/\r?\n/).map(x => x.trim()).filter(Boolean); Store.change('עדכון תחומים', state => { state.settings.specialties = l; }); toast('נשמר'); };
    $('#exp').onclick = () => root.App.backup();
    $('#imp').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const data = JSON.parse(await f.text()); if (!(await U.confirmBox('לשחזר מהגיבוי? הנתונים הנוכחיים יוחלפו (ניתן לבטל עם "ביטול").'))) return; Store.replace(data, 'שחזור מגיבוי'); toast('שוחזר'); }
      catch (err) { toast('קובץ לא תקין'); }
    };
    const drawSnaps = () => {
      const l = Store.snapshots().slice().reverse();
      $('#snaps').innerHTML = l.length ? l.map(x => '<div class="row" style="margin:4px 0"><b>' + esc(x.name) + '</b><span class="muted small">' + new Date(x.t).toLocaleString('he-IL') + '</span><button class="sm" data-rs="' + x.id + '">שחזור</button><button class="sm danger" data-ds="' + x.id + '">מחיקה</button></div>').join('') : '<span class="muted">אין גרסאות שמורות</span>';
      $$('[data-rs]').forEach(b => b.onclick = async () => { if (await U.confirmBox('לשחזר גרסה זו?')) { Store.restoreSnapshot(b.dataset.rs); toast('שוחזר'); } });
      $$('[data-ds]').forEach(b => b.onclick = () => { Store.deleteSnapshot(b.dataset.ds); drawSnaps(); });
    };
    drawSnaps();
    $('#snap').onclick = () => { if (Store.saveSnapshot($('#snapName').value.trim())) { toast('הגרסה נשמרה'); $('#snapName').value = ''; drawSnaps(); } else toast('אין מספיק מקום בדפדפן – הורידו גיבוי לקובץ'); };
    $('#sample').onclick = async () => { if (await U.confirmBox('לטעון נתוני דוגמה? הנתונים הנוכחיים יוחלפו (ניתן לבטל).')) Store.replace(root.Model.sampleState(), 'נתוני דוגמה'); };
    $('#reset').onclick = async () => { if (await U.confirmBox('למחוק את כל הנתונים? (מומלץ להוריד גיבוי קודם)', 'מחיקה')) Store.replace(root.Model.emptyState(), 'איפוס'); };
    $('#clearSes').onclick = async () => { if (await U.confirmBox('למחוק את כל המפגשים שאינם נעולים?', 'מחיקה')) Store.change('ניקוי מפגשים', state => { state.sessions = state.sessions.filter(x => x.locked); }); };
  };
  function perRow(p) {
    const days = U.S().settings.days;
    return '<tr data-id="' + esc(p.id || '') + '"><td><input type="time" step="300" data-p="start" value="' + (p.start !== '' ? E.fmt(p.start) : '') + '"></td><td><input type="time" step="300" data-p="end" value="' + (p.end !== '' ? E.fmt(p.end) : '') + '"></td><td><input data-p="label" value="' + esc(p.label) + '"></td><td><select data-p="kind">' +
      options([{ value: 'lesson', label: 'שיעור' }, { value: 'break', label: 'הפסקה' }, { value: 'routine', label: 'שגרה (תפילה/ארוחה)' }], p.kind) + '</select></td><td><span class="row" data-p="days">' + days.map(d => '<label class="row" style="gap:2px"><input type="checkbox" value="' + d + '"' + ((p.days || []).includes(d) ? ' checked' : '') + '>' + E.DAY_SHORT[d] + '</label>').join('') + '</span></td><td><button class="sm danger" data-del>✕</button></td></tr>';
  }
  function roomRow(r) { return '<tr data-id="' + esc(r.id || '') + '"><td><input data-p="name" value="' + esc(r.name) + '"></td><td><input type="number" min="1" data-p="cap" value="' + (r.capacity || 1) + '"></td><td><button class="sm danger" data-del>✕</button></td></tr>'; }
  function holRow(h) { return '<tr><td><input type="date" data-p="date" value="' + esc(h.date || '') + '"></td><td><input type="date" data-p="to" value="' + esc(h.to || '') + '"></td><td><input data-p="label" value="' + esc(h.label || '') + '"></td><td><button class="sm danger" data-del>✕</button></td></tr>'; }

  // ================= ייבוא =================
  P.import = function (main) {
    const st = root.App.mem.imp || (root.App.mem.imp = { sheets: null, sheet: 0, entity: 'students', header: true, map: null, reverse: false, classId: '' });
    main.innerHTML = '<h1>ייבוא נתונים מקבצים</h1><div class="card"><p>ניתן להעלות <b>Excel (xlsx/xls), CSV, PDF, Word (docx)</b> או להדביק טקסט. המערכת תחלץ את הטבלה, תזהה עמודות (שם, כיתה, תפקיד, תחום...) ותאפשר לבחור מה לייבא.</p>' +
      '<div class="row"><input type="file" id="file" accept=".xlsx,.xls,.xlsm,.ods,.csv,.pdf,.docx,.txt,.tsv"><span class="muted">או</span><button id="paste">הדבקת טקסט</button></div><div id="impMsg"></div></div><div id="impBody"></div>';
    $('#file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      $('#impMsg').innerHTML = '<div class="alert info">קורא את הקובץ...</div>';
      try { const r = await root.Importer.readFile(f); Object.assign(st, { sheets: r.sheets, sheet: 0, map: null, entity: root.Importer.guessEntity((r.sheets[0] || {}).rows || []) || st.entity }); $('#impMsg').innerHTML = '<div class="alert ok">נקרא: ' + esc(f.name) + '</div>'; draw(); }
      catch (err) { console.error(err); $('#impMsg').innerHTML = '<div class="alert bad">שגיאה בקריאת הקובץ: ' + esc(err.message) + '</div>'; }
    };
    $('#paste').onclick = () => modal('הדבקת טקסט', '<p class="muted">הדביקו רשימה (שורה לכל רשומה; עמודות מופרדות בטאב או בפסיק – למשל העתקה מאקסל):</p><textarea id="pt" style="min-height:240px"></textarea>', [
      { label: 'המשך', cls: 'pri', onClick: el => { Object.assign(st, root.Importer.fromText($('#pt', el).value), { sheet: 0, map: null }); draw(); } }, { label: 'ביטול' }]);
    if (st.sheets) draw();

    function draw() {
      const sheet = st.sheets[st.sheet] || { rows: [] };
      let rows = sheet.rows.map(r => st.reverse ? r.map(c => c.split('').reverse().join('')) : r);
      const ncol = Math.max(1, ...rows.map(r => r.length));
      if (!st.map) { st.header = rows[0] ? root.Importer.looksLikeHeader(st.entity, rows[0]) : false; st.map = st.header ? root.Importer.guessMapping(st.entity, rows[0]) : { 0: st.entity === 'students' ? 'fullName' : 'name' }; }
      const labels = root.Importer.FIELD_LABELS[st.entity];
      const fieldSel = i => '<select data-col="' + i + '"><option value="">— לא לייבא —</option>' + Object.entries(labels).map(([k, v]) => '<option value="' + k + '"' + (st.map[i] === k ? ' selected' : '') + '>' + esc(v) + '</option>').join('') + '</select>';
      const body = rows.slice(st.header ? 1 : 0);
      $('#impBody').innerHTML = '<div class="card"><div class="row">' +
        (st.sheets.length > 1 ? '<label>גיליון: <select id="sheet">' + st.sheets.map((sh, i) => '<option value="' + i + '"' + (i === st.sheet ? ' selected' : '') + '>' + esc(sh.name) + '</option>').join('') + '</select></label>' : '') +
        '<label>מה לייבא: <select id="ent">' + options([{ value: 'students', label: 'תלמידים' }, { value: 'staff', label: 'צוות ומטפלים' }, { value: 'classes', label: 'כיתות' }], st.entity) + '</select></label>' +
        '<label class="row"><input type="checkbox" id="hdr"' + (st.header ? ' checked' : '') + '> השורה הראשונה היא כותרת</label>' +
        '<label class="row"><input type="checkbox" id="rev"' + (st.reverse ? ' checked' : '') + '> הפוך כיוון טקסט (אם העברית מ-PDF הפוכה)</label>' +
        (st.entity === 'students' ? '<label>כיתה ברירת מחדל: <select id="defCls">' + options(S().classes, st.classId, { empty: '— לפי העמודה / ללא —' }) + '</select></label>' : '') +
        '</div><p class="muted small">בחרו לכל עמודה לאיזה שדה היא שייכת. ניתן לבטל סימון של שורות שאין לייבא. כיתות שלא קיימות ייווצרו אוטומטית.</p>' +
        '<div class="import-table"><table class="data"><thead><tr><th><input type="checkbox" id="allRows" checked></th>' + Array.from({ length: ncol }, (_, i) => '<th>' + fieldSel(i) + (st.header && rows[0] ? '<div class="small muted">' + esc(rows[0][i] || '') + '</div>' : '') + '</th>').join('') + '</tr></thead><tbody>' +
        body.map((r, ri) => '<tr><td><input type="checkbox" data-row="' + ri + '" checked></td>' + Array.from({ length: ncol }, (_, i) => '<td>' + esc(r[i] || '') + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
        '<div class="row" style="margin-top:10px"><label class="row"><input type="checkbox" id="upd" checked> לעדכן רשומות קיימות עם אותו שם (במקום ליצור כפילות)</label><button class="pri" id="doImp">ייבוא ' + body.length + ' שורות</button></div></div>';
      const sh = $('#sheet'); if (sh) sh.onchange = e => { st.sheet = Number(e.target.value); st.map = null; draw(); };
      $('#ent').onchange = e => { st.entity = e.target.value; st.map = null; draw(); };
      $('#hdr').onchange = e => { st.header = e.target.checked; st.map = st.header ? root.Importer.guessMapping(st.entity, rows[0]) : st.map; draw(); };
      $('#rev').onchange = e => { st.reverse = e.target.checked; draw(); };
      const dc = $('#defCls'); if (dc) dc.onchange = e => { st.classId = e.target.value; };
      $$('[data-col]').forEach(s2 => s2.onchange = () => { st.map[s2.dataset.col] = s2.value; });
      $('#allRows').onchange = e => $$('[data-row]').forEach(c => c.checked = e.target.checked);
      $('#doImp').onclick = () => {
        const sel = $$('[data-row]').filter(c => c.checked).map(c => body[Number(c.dataset.row)]);
        const recs = sel.map(r => { const o = {}; Object.entries(st.map).forEach(([i, f]) => { if (f) o[f] = (o[f] ? o[f] + ' ' : '') + (r[i] || '').trim(); }); return o; });
        const res = doImport(st.entity, recs, { update: $('#upd').checked, classId: st.classId });
        $('#impMsg').innerHTML = '<div class="alert ok">' + esc(res) + '</div>';
        st.sheets = null; $('#impBody').innerHTML = ''; window.scrollTo(0, 0);
      };
    }
  };

  function doImport(entity, recs, opts) {
    let added = 0, updated = 0, newClasses = 0;
    Store.change('ייבוא ' + entity, state => {
      const classByName = name => {
        const n = String(name || '').trim(); if (!n) return '';
        let c = state.classes.find(x => x.name === n || x.name.replace(/['"׳״\s]/g, '') === n.replace(/['"׳״\s]/g, ''));
        if (!c) { c = { id: E.uid('cls'), name: n, kind: 'sped', teacherId: '', grade: '', notes: '' }; state.classes.push(c); newClasses++; }
        return c.id;
      };
      for (const r of recs) {
        if (entity === 'students') {
          let nm = { firstName: r.firstName || '', lastName: r.lastName || '' };
          if (r.fullName && !r.firstName) nm = root.Importer.splitName(r.fullName);
          if (!nm.firstName && !nm.lastName) continue;
          if (/^(שם|תלמיד|מס'?)$/.test(nm.firstName)) continue;
          const classId = r.className ? classByName(r.className) : (opts.classId || '');
          const ex = opts.update && state.students.find(x => x.firstName === nm.firstName && x.lastName === nm.lastName);
          const notes = [r.notes, r.needs ? 'צרכים: ' + r.needs : ''].filter(Boolean).join(' | ');
          if (ex) { if (classId) ex.classId = classId; if (notes) ex.notes = notes; updated++; }
          else { state.students.push(Object.assign({ id: E.uid('stu'), classId, unavailable: [], needs: [], notes, icon: '' }, nm)); added++; }
          if (r.inclusionClass) {
            const dest = classByName(r.inclusionClass); const dc = state.classes.find(c => c.id === dest); if (dc) dc.kind = 'regular';
          }
        } else if (entity === 'staff') {
          const name = (r.name || '').trim(); if (!name) continue;
          const specs = (r.specialties || '').split(/[,،/;]/).map(x => x.trim()).filter(Boolean);
          specs.forEach(x => { if (!state.settings.specialties.includes(x)) state.settings.specialties.push(x); });
          const role = r.role ? root.Importer.guessRole(r.role) : (specs.length ? 'therapist' : 'other');
          const ex = opts.update && state.staff.find(x => x.name === name);
          const hrs = parseFloat(r.hours);
          if (ex) { if (r.role) ex.role = role; if (specs.length) ex.specialties = Array.from(new Set((ex.specialties || []).concat(specs))); if (r.phone) ex.phone = r.phone; if (hrs) ex.maxMinutesWeek = Math.round(hrs * 60); updated++; }
          else { state.staff.push({ id: E.uid('stf'), name, role, specialties: specs, availability: [], unavailable: [], maxMinutesWeek: hrs ? Math.round(hrs * 60) : '', maxPerDay: '', phone: r.phone || '', notes: r.notes || '' }); added++; }
        } else if (entity === 'classes') {
          const name = (r.name || '').trim(); if (!name) continue;
          const kind = /רגיל/.test(r.kind || '') ? 'regular' : 'sped';
          let teacherId = '';
          if (r.teacher) { let t = state.staff.find(x => x.name === r.teacher.trim()); if (!t) { t = { id: E.uid('stf'), name: r.teacher.trim(), role: kind === 'regular' ? 'regular' : 'sped', specialties: [], availability: [], unavailable: [], maxMinutesWeek: '', maxPerDay: '', phone: '', notes: '' }; state.staff.push(t); } teacherId = t.id; }
          const ex = opts.update && state.classes.find(x => x.name === name);
          if (ex) { if (r.kind) ex.kind = kind; if (teacherId) ex.teacherId = teacherId; if (r.grade) ex.grade = r.grade; updated++; }
          else { state.classes.push({ id: E.uid('cls'), name, kind, teacherId, grade: r.grade || '', notes: r.notes || '' }); added++; }
        }
      }
    });
    return 'נוספו ' + added + ', עודכנו ' + updated + (newClasses ? ', נוצרו ' + newClasses + ' כיתות חדשות' : '');
  }
  P._doImport = doImport;
})(window);
