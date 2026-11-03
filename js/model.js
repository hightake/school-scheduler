/* מודל נתונים: מצב, שמירה מקומית, ביטול/שחזור, נתוני דוגמה */
(function (root) {
  'use strict';
  const E = root.Engine;
  const KEY = 'shibutz.state.v1';
  const SNAP_KEY = 'shibutz.snapshots.v1';
  const m = E.toMin;

  function defaultSpecialties() {
    return ['טיפול רגשי', 'ספורט טיפולי', 'ריפוי בעיסוק', 'קלינאות תקשורת', 'טיפול באומנות', 'טיפול במוזיקה',
      'תגבור לימודי', 'קריאה', 'חשבון', 'מיומנויות חברתיות', 'פיזיותרפיה', 'הדרכה פדגוגית'];
  }

  function defaultPeriods() {
    const P = (s, e, label, kind) => ({ id: E.uid('per'), start: m(s), end: m(e), label: label || '', kind: kind || 'lesson', days: [] });
    return [
      P('08:30', '09:00', 'תפילת שחרית', 'routine'),
      P('09:00', '09:45', 'שיעור 1'),
      P('09:45', '10:25', 'שיעור 2'),
      P('10:25', '10:50', 'ארוחת בוקר', 'break'),
      P('10:50', '11:50', 'שיעור 3'),
      P('11:50', '12:20', 'הפסקה', 'break'),
      P('12:20', '13:25', 'שיעור 4'),
      P('13:40', '14:30', 'ארוחת צהריים', 'break'),
      P('14:30', '15:00', 'הפסקה פעילה', 'break'),
      P('15:00', '15:45', 'שיעור 5'),
      P('15:45', '16:25', 'שיעור 6')
    ];
  }

  function emptyState() {
    return {
      version: 1,
      settings: {
        institution: '', year: 'תשפ"ז', headerLine: 'בס"ד',
        days: [0, 1, 2, 3, 4], granularity: 5,
        periods: defaultPeriods(),
        abWeeks: false, yearStart: '2026-09-01', yearEnd: '2027-06-30',
        holidays: [], classThreshold: 0.6,
        specialties: defaultSpecialties()
      },
      staff: [], classes: [], students: [], rooms: [],
      activities: [], sessions: [], oneOffs: [], recommendations: [], log: []
    };
  }

  function sampleState() {
    const st = emptyState();
    st.settings.institution = 'מוסד לדוגמה – חינוך מיוחד';
    const id = E.uid;
    const S = (name, role, specialties, extra) => Object.assign({ id: id('stf'), name, role, specialties: specialties || [], availability: [], unavailable: [], maxMinutesWeek: '', maxPerDay: '', phone: '', notes: '' }, extra || {});
    const tCohen = S('הרב דוד כהן', 'sped');
    const tLevi = S('הרב משה לוי', 'sped');
    const tReg1 = S('הרב אברהם פרידמן', 'regular');
    const tReg2 = S('הרב יצחק גולד', 'regular');
    const lior = S('ליאור – טיפול רגשי', 'therapist', ['טיפול רגשי'], { availability: [0, 1, 3].map(d => ({ day: d, start: m('09:00'), end: m('13:25') })) });
    const gavriel = S('ר\' גבריאל וייס – ספורט טיפולי', 'therapist', ['ספורט טיפולי'], { availability: [0, 1, 2, 3, 4].map(d => ({ day: d, start: m('10:50'), end: m('13:25') })) });
    const ot = S('נועם – ריפוי בעיסוק', 'therapist', ['ריפוי בעיסוק'], { availability: [1, 2, 4].map(d => ({ day: d, start: m('09:00'), end: m('15:45') })), maxMinutesWeek: 600 });
    const slp = S('אריאל – קלינאות תקשורת', 'therapist', ['קלינאות תקשורת'], { availability: [0, 2].map(d => ({ day: d, start: m('09:00'), end: m('15:45') })) });
    const tutor = S('הרב שמואל – תגבור', 'teacher', ['תגבור לימודי', 'קריאה', 'חשבון']);
    const guide = S('הרבנית/המדריך – הדרכה פדגוגית', 'guide', ['הדרכה פדגוגית'], { availability: [{ day: 1, start: m('10:50'), end: m('13:25') }, { day: 3, start: m('10:50'), end: m('13:25') }] });
    st.staff = [tCohen, tLevi, tReg1, tReg2, lior, gavriel, ot, slp, tutor, guide];

    const C = (name, kind, teacherId, grade) => ({ id: id('cls'), name, kind, teacherId, grade: grade || '', room: '', notes: '' });
    const c5 = C("כיתה ה' תקשורת", 'sped', tCohen.id, "ה'");
    const c7 = C("כיתה ז' תקשורת", 'sped', tLevi.id, "ז'");
    const r5 = C("ה'1", 'regular', tReg1.id, "ה'");
    const r7 = C("ז'2", 'regular', tReg2.id, "ז'");
    st.classes = [c5, c7, r5, r7];

    const ST = (f, l, cls, extra) => Object.assign({ id: id('stu'), firstName: f, lastName: l, classId: cls.id, unavailable: [], needs: [], notes: '', icon: '' }, extra || {});
    const s5 = [ST('ארי', 'רוזן', c5), ST('נטע', 'לוי', c5), ST('זלמן', 'וייס', c5), ST('יענקי', 'זילבר', c5), ST('אהרן', 'ברגר', c5), ST('שלמה', 'רבינוביץ', c5)];
    const s7 = [ST('אשר', 'פרידמן', c7), ST('נפתלי', 'קפלן', c7), ST('שמואל', 'ונגר', c7), ST('חיים', 'שטרן', c7), ST('מנחם', 'הלר', c7)];
    s5[3].unavailable.push({ day: 2, start: m('09:00'), end: m('10:25'), reason: 'טיפול חיצוני קבוע' });
    st.students = s5.concat(s7);

    const room1 = { id: id('room'), name: 'חדר טיפולים', capacity: 1 };
    const gym = { id: id('room'), name: 'אולם ספורט', capacity: 1 };
    st.rooms = [room1, gym];

    const A = (o) => Object.assign({ id: id('act'), title: '', type: 'lesson', classIds: [], studentIds: [], excludeStudentIds: [], staffIds: [], roomId: '', duration: '', perWeek: 1, weekPattern: 'all', alignToPeriods: true, allowedDays: [], preferredDays: [], windowStart: '', windowEnd: '', specialty: '', maxStudents: '', notes: '', icon: '' }, o);
    const acts = [];
    // שגרה – מוגנת
    for (const c of [c5, c7]) {
      acts.push(A({ title: 'תפילת שחרית', type: 'routine', classIds: [c.id], staffIds: [c.teacherId], perWeek: 5, duration: 30, icon: '🙏', manualOnly: true, protected: true, _fix: { start: '08:30', end: '09:00', days: [0, 1, 2, 3, 4] } }));
      acts.push(A({ title: 'ארוחת בוקר', type: 'routine', classIds: [c.id], perWeek: 5, duration: 25, icon: '🥪', manualOnly: true, protected: true, _fix: { start: '10:25', end: '10:50', days: [0, 1, 2, 3, 4] } }));
    }
    // שיעורי כיתה
    const lessons5 = [['גמרא קבוצתי', 5, 60, '📖', { preferredStart: m('10:50') }], ['כתיבה', 3, 45, '✍️'], ['חשבון', 4, 45, '🔢'], ['הבנת הנקרא', 3, 40, '📚'], ['שיעור חברה', 4, 65, '🤝', { preferredStart: m('12:20') }]];
    for (const [t, n, d, ic, ex] of lessons5) acts.push(A(Object.assign({ title: t, type: 'lesson', classIds: [c5.id], staffIds: [tCohen.id], perWeek: n, duration: d, icon: ic }, ex || {})));
    const lessons7 = [['גמרא', 5, 60, '📖'], ['חשבון', 4, 45, '🔢'], ['כתיבה והבעה', 3, 45, '✍️'], ['ידע עולם', 2, 45, '🌍']];
    for (const [t, n, d, ic] of lessons7) acts.push(A({ title: t, type: 'lesson', classIds: [c7.id], staffIds: [tLevi.id], perWeek: n, duration: d, icon: ic }));
    // שיעורי כיתה רגילה (לשילוב) – קבועים
    const regMath = A({ title: 'חשבון (כיתה רגילה)', type: 'lesson', classIds: [r5.id], staffIds: [tReg1.id], perWeek: 2, duration: 45, manualOnly: true, _fix: { start: '09:00', end: '09:45', days: [1, 3] } });
    const regTorah = A({ title: 'חומש (כיתה רגילה)', type: 'lesson', classIds: [r7.id], staffIds: [tReg2.id], perWeek: 2, duration: 40, manualOnly: true, _fix: { start: '09:45', end: '10:25', days: [0, 2] } });
    acts.push(regMath, regTorah);
    acts.push(A({ title: "שילוב – חשבון בה'1", type: 'inclusion', studentIds: [s5[0].id, s5[1].id], destClassId: r5.id, linkActivityId: regMath.id, perWeek: 2, icon: '🏫' }));
    acts.push(A({ title: "שילוב – חומש בז'2", type: 'inclusion', studentIds: [s7[0].id], destClassId: r7.id, linkActivityId: regTorah.id, perWeek: 2, icon: '🏫' }));
    // טיפולים
    acts.push(A({ title: 'טיפול רגשי – קבוצה', type: 'therapy', specialty: 'טיפול רגשי', studentIds: [s5[0].id, s5[1].id, s5[2].id], staffIds: [lior.id], roomId: room1.id, duration: 40, perWeek: 1, maxStudents: 4, alignToPeriods: false, icon: '💬' }));
    acts.push(A({ title: 'טיפול רגשי – קבוצה ב', type: 'therapy', specialty: 'טיפול רגשי', studentIds: [s5[4].id, s5[3].id, s5[5].id], staffIds: [lior.id], roomId: room1.id, duration: 40, perWeek: 1, maxStudents: 4, alignToPeriods: false, icon: '💬' }));
    acts.push(A({ title: 'ספורט טיפולי', type: 'therapy', specialty: 'ספורט טיפולי', classIds: [c5.id], staffIds: [gavriel.id], roomId: gym.id, duration: 45, perWeek: 1, icon: '⚽' }));
    acts.push(A({ title: 'ספורט טיפולי', type: 'therapy', specialty: 'ספורט טיפולי', classIds: [c7.id], staffIds: [gavriel.id], roomId: gym.id, duration: 45, perWeek: 1, icon: '⚽' }));
    acts.push(A({ title: 'ספורט טיפולי – פרטני', type: 'therapy', specialty: 'ספורט טיפולי', studentIds: [s7[2].id], staffIds: [gavriel.id], roomId: gym.id, duration: 20, perWeek: 2, alignToPeriods: false, icon: '⚽' }));
    acts.push(A({ title: 'ריפוי בעיסוק', type: 'therapy', specialty: 'ריפוי בעיסוק', studentIds: [s5[3].id], staffIds: [ot.id], roomId: room1.id, duration: 30, perWeek: 2, alignToPeriods: false, icon: '✋' }));
    acts.push(A({ title: 'ריפוי בעיסוק', type: 'therapy', specialty: 'ריפוי בעיסוק', studentIds: [s7[1].id, s7[3].id], staffIds: [ot.id], roomId: room1.id, duration: 40, perWeek: 1, maxStudents: 3, icon: '✋' }));
    acts.push(A({ title: 'קלינאות תקשורת', type: 'therapy', specialty: 'קלינאות תקשורת', studentIds: [s7[4].id], staffIds: [slp.id], duration: 30, perWeek: 2, alignToPeriods: false, icon: '🗣️' }));
    acts.push(A({ title: 'תגבור קריאה', type: 'help', specialty: 'קריאה', studentIds: [s5[5].id], staffIds: [tutor.id], duration: 30, perWeek: 2, alignToPeriods: false, icon: '✏️' }));
    // הדרכות
    acts.push(A({ title: 'הדרכה פדגוגית', type: 'guidance', staffIds: [guide.id, tCohen.id], duration: 30, perWeek: 1, alignToPeriods: false, icon: '🧭', classIds: [] }));
    acts.push(A({ title: 'הדרכה פדגוגית', type: 'guidance', staffIds: [guide.id, tLevi.id], duration: 30, perWeek: 1, alignToPeriods: false, icon: '🧭', classIds: [] }));
    st.activities = acts;

    // מפגשים קבועים (נעולים)
    for (const a of acts) {
      if (!a._fix) continue;
      for (const d of a._fix.days) st.sessions.push({ id: id('ses'), activityId: a.id, day: d, start: m(a._fix.start), end: m(a._fix.end), weekPattern: 'all', locked: true });
      delete a._fix;
    }
    st.recommendations.push({ id: id('rec'), studentId: s7[3].id, specialty: 'טיפול רגשי', perWeek: 1, duration: 40, groupOk: true, notes: 'המלצת יועצת – קושי בוויסות רגשי', status: 'open', createdAt: new Date().toISOString().slice(0, 10) });
    st.oneOffs.push({ id: id('oo'), kind: 'add', date: '2026-11-17', title: 'הדרכה משתנה – מפקחת', type: 'guidance', staffIds: [tCohen.id, tLevi.id], start: m('12:20'), end: m('13:00'), note: 'הדרכה חודשית' });
    return st;
  }

  // ---------- Store ----------
  const Store = {
    state: null,
    undo: [], redo: [],
    listeners: [],
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        this.state = raw ? migrate(JSON.parse(raw)) : emptyState();
      } catch (e) { this.state = emptyState(); }
      return this.state;
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { console.warn('שמירה נכשלה', e); }
    },
    /** ביצוע שינוי עם אפשרות ביטול */
    change(label, fn) {
      this.undo.push(JSON.stringify(this.state));
      if (this.undo.length > 60) this.undo.shift();
      this.redo = [];
      fn(this.state);
      this.state.log = (this.state.log || []).slice(-199);
      this.state.log.push({ t: new Date().toISOString(), label });
      this.save(); this.emit();
    },
    doUndo() {
      if (!this.undo.length) return false;
      this.redo.push(JSON.stringify(this.state));
      this.state = JSON.parse(this.undo.pop());
      this.save(); this.emit(); return true;
    },
    doRedo() {
      if (!this.redo.length) return false;
      this.undo.push(JSON.stringify(this.state));
      this.state = JSON.parse(this.redo.pop());
      this.save(); this.emit(); return true;
    },
    replace(newState, label) {
      this.change(label || 'החלפת נתונים', (s) => { Object.keys(s).forEach(k => delete s[k]); Object.assign(s, migrate(newState)); });
    },
    on(fn) { this.listeners.push(fn); },
    emit() { this.listeners.forEach(f => { try { f(this.state); } catch (e) { console.error(e); } }); },
    // גרסאות שמורות
    snapshots() { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); } catch (e) { return []; } },
    saveSnapshot(name) {
      const list = this.snapshots();
      list.push({ id: E.uid('snap'), name: name || ('גרסה ' + (list.length + 1)), t: new Date().toISOString(), data: JSON.stringify(this.state) });
      while (list.length > 15) list.shift();
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
    },
    restoreSnapshot(sid) {
      const sn = this.snapshots().find(x => x.id === sid);
      if (sn) this.replace(JSON.parse(sn.data), 'שחזור גרסה: ' + sn.name);
    },
    deleteSnapshot(sid) {
      const list = this.snapshots().filter(x => x.id !== sid);
      localStorage.setItem(SNAP_KEY, JSON.stringify(list));
    }
  };

  function migrate(s) {
    const base = emptyState();
    const out = Object.assign({}, base, s || {});
    out.settings = Object.assign({}, base.settings, (s && s.settings) || {});
    ['staff', 'classes', 'students', 'rooms', 'activities', 'sessions', 'oneOffs', 'recommendations', 'log'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
    if (!out.settings.specialties || !out.settings.specialties.length) out.settings.specialties = defaultSpecialties();
    return out;
  }

  root.Model = { Store, emptyState, sampleState, migrate, defaultPeriods };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Model;
})(typeof window !== 'undefined' ? window : globalThis);
