// בדיקות למנוע השיבוץ: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');
const M = require('../js/model.js');
const V = require('../js/views.js');

function tiny() {
  const s = M.emptyState();
  s.settings.periods = [
    { id: 'p1', start: 540, end: 585, label: '1', kind: 'lesson', days: [] },
    { id: 'p2', start: 585, end: 630, label: '2', kind: 'lesson', days: [] },
    { id: 'b', start: 630, end: 650, label: 'הפסקה', kind: 'break', days: [] },
    { id: 'p3', start: 650, end: 695, label: '3', kind: 'lesson', days: [] }
  ];
  s.settings.days = [0, 1];
  s.staff = [{ id: 't', name: 'מורה', role: 'sped', specialties: [], availability: [] },
    { id: 'th', name: 'מטפל', role: 'therapist', specialties: ['טיפול רגשי'], availability: [{ day: 0, start: 540, end: 630 }] }];
  s.classes = [{ id: 'c', name: 'כיתה', kind: 'sped', teacherId: 't' }, { id: 'r', name: 'רגילה', kind: 'regular' }];
  s.students = [{ id: 's1', firstName: 'א', lastName: 'ב', classId: 'c', unavailable: [] }, { id: 's2', firstName: 'ג', lastName: 'ד', classId: 'c', unavailable: [] }];
  s.activities = [
    { id: 'L', title: 'שיעור', type: 'lesson', classIds: ['c'], staffIds: ['t'], perWeek: 1 },
    { id: 'P', title: 'מוגן', type: 'lesson', classIds: ['c'], staffIds: ['t'], perWeek: 1, protected: true },
    { id: 'T', title: 'טיפול', type: 'therapy', studentIds: ['s1'], staffIds: ['th'], perWeek: 1, duration: 45, specialty: 'טיפול רגשי', maxStudents: 3 }
  ];
  return s;
}

test('staff double booking is a hard conflict', () => {
  const s = tiny();
  s.sessions = [{ id: 'x', activityId: 'L', day: 0, start: 540, end: 585 }];
  const ctx = E.makeCtx(s);
  const ev = E.evaluate(ctx, { activityId: 'P', day: 0, start: 540, end: 585 });
  assert.ok(ev.hard.some(h => h.entity === 'staff'));
});

test('therapy over regular lesson is soft, over protected lesson is hard', () => {
  const s = tiny();
  s.sessions = [{ id: 'x', activityId: 'L', day: 0, start: 540, end: 585 }, { id: 'y', activityId: 'P', day: 0, start: 585, end: 630 }];
  const ctx = E.makeCtx(s);
  const a = E.evaluate(ctx, { activityId: 'T', day: 0, start: 540, end: 585 });
  assert.equal(a.hard.length, 0); assert.ok(a.cost > 0);
  const b = E.evaluate(ctx, { activityId: 'T', day: 0, start: 585, end: 630 });
  assert.ok(b.hard.some(h => /מוגן/.test(h.reason)));
});

test('staff availability and student constraints are respected', () => {
  const s = tiny();
  s.students[0].unavailable = [{ day: 0, start: 540, end: 585, reason: 'הסעה' }];
  const ctx = E.makeCtx(s);
  assert.ok(E.evaluate(ctx, { activityId: 'T', day: 1, start: 540, end: 585 }).hard.length > 0);
  assert.ok(E.evaluate(ctx, { activityId: 'T', day: 0, start: 540, end: 585 }).hard.some(h => /הסעה/.test(h.reason)));
  assert.equal(E.evaluate(ctx, { activityId: 'T', day: 0, start: 585, end: 630 }).hard.length, 0);
});

test('A/B week sessions do not collide', () => {
  const s = tiny();
  s.sessions = [{ id: 'x', activityId: 'L', day: 0, start: 540, end: 585, weekPattern: 'A' }];
  const ctx = E.makeCtx(s);
  assert.equal(E.evaluate(ctx, { activityId: 'P', day: 0, start: 540, end: 585, weekPattern: 'B' }).hard.length, 0);
  assert.ok(E.evaluate(ctx, { activityId: 'P', day: 0, start: 540, end: 585, weekPattern: 'A' }).hard.length > 0);
});

test('auto schedule places everything without conflicts', () => {
  const s = tiny();
  const r = E.autoSchedule(s, { iterations: 5 });
  assert.equal(r.unplaced.length, 0);
  s.sessions = r.sessions;
  assert.equal(E.allConflicts(s).length, 0);
  assert.equal(s.sessions.length, 3);
});

test('sample data schedules fully with zero conflicts', () => {
  const s = M.sampleState();
  const r = E.autoSchedule(s, { iterations: 8 });
  s.sessions = r.sessions;
  assert.equal(r.unplaced.length, 0);
  assert.equal(E.allConflicts(s).length, 0);
});

test('minimal changes: finds exact slot by moving one blocker', () => {
  const s = tiny();
  s.sessions = [{ id: 'x', activityId: 'L', day: 0, start: 540, end: 585 }];
  const opts = E.findWithMinimalChanges(s, 'P', { near: { day: 0, start: 540, end: 585, exact: true }, maxChanges: 2 });
  assert.equal(opts[0].changes, 1);
  assert.equal(opts[0].moves[0].sessionId, 'x');
});

test('recommendation suggests a matching specialist', () => {
  const s = tiny();
  const r = E.suggestForRecommendation(s, { studentId: 's2', specialty: 'טיפול רגשי', perWeek: 1, duration: 45, groupOk: false });
  assert.equal(r.staff[0].staffId, 'th');
  assert.ok(r.options.some(o => o.kind === 'new' && o.slots[0].day === 0));
});

test('regular-class teacher view lists exits during inclusion', () => {
  const s = tiny();
  s.activities.push({ id: 'I', title: 'שילוב', type: 'inclusion', studentIds: ['s1'], destClassId: 'r', perWeek: 1 });
  s.sessions = [{ id: 'i', activityId: 'I', day: 0, start: 540, end: 630 }, { id: 't', activityId: 'T', day: 0, start: 585, end: 630 }];
  const v = V.build(s, { kind: 'regular', id: 'r', range: { mode: 'week' } });
  const exits = v.pages[0].sections[1].rows;
  assert.equal(exits.length, 1);
  assert.ok(exits[0].join(' ').includes('טיפול'));
});

test('calendar: holidays, cancellations and one-offs', () => {
  const s = tiny();
  s.sessions = [{ id: 'x', activityId: 'L', day: 0, start: 540, end: 585 }];
  s.settings.holidays = [{ date: '2026-11-08', label: 'חג' }];
  s.oneOffs = [{ id: 'o1', kind: 'cancel', date: '2026-11-15', sessionId: 'x' }, { id: 'o2', kind: 'add', date: '2026-11-22', title: 'הדרכה', type: 'guidance', staffIds: ['t'], start: 650, end: 695 }];
  assert.equal(E.sessionsOnDate(s, '2026-11-01').sessions.length, 1);
  assert.ok(E.sessionsOnDate(s, '2026-11-08').holiday);
  assert.equal(E.sessionsOnDate(s, '2026-11-15').sessions.length, 0);
  assert.equal(E.sessionsOnDate(s, '2026-11-22').sessions.length, 2);
});
