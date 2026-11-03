// מפיק סרטון הדרכה: מקליט את התוכנה בדפדפן, מוסיף הדגשות, כתוביות וקריינות.
// שימוש: node make-video.js <תיקיית התוכנה> <תיקיית פלט>
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const APP = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3]);
const WORK = path.join(__dirname, 'work');
const TTS = path.join(__dirname, 'tts.py');
const VOICE = 'he-IL-AvriNeural';
fs.mkdirSync(WORK, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const W = 1280, H = 720;

// ---------- סצנות ----------
// text: קריינות. run: פעולות על המסך בזמן הקריינות.
const scenes = [
  { ch: 'פתיחה', text: 'שלום. בסרטון הזה נכיר את תוכנת השיבוץ, ונעבור יחד על כל שלבי העבודה: מהזנת הנתונים, דרך השיבוץ עצמו, ועד הדפסת מערכות השעות.',
    run: async (p, o) => { await o.hl('main h1'); } },
  { ch: 'נתוני דוגמה', text: 'כדי להכיר את התוכנה בלי לסכן נתונים אמיתיים, אפשר לטעון נתוני דוגמה. לוחצים כאן, והתוכנה מתמלאת בכיתות, תלמידים, אנשי צוות ופעילויות לדוגמה.',
    run: async (p, o) => { await o.click('#loadSample', 1800); await sleep(600); await o.hl('.cards'); } },
  { ch: 'לוח בקרה', text: 'זה לוח הבקרה. כאן רואים במבט אחד כמה תלמידים ואנשי צוות יש, האם יש התנגשויות, וכמה מפגשים עוד לא שובצו. כדאי להציץ בו בכל כניסה.',
    run: async (p, o) => { await o.hl('.cards .stat:nth-child(6)', 2200); await o.hl('.cards .stat:nth-child(7)'); } },
  { ch: 'הגדרות', text: 'מתחילים תמיד בהגדרות. כאן קובעים את ימי הלימודים, ואת מערכת הצלצולים: מתי מתחיל כל שיעור, ומתי יש הפסקה, תפילה או ארוחה. זה הבסיס לכל השיבוץ.',
    run: async (p, o) => { await o.nav('settings'); await o.hl('[data-days=days]', 2500); await o.scroll('#per'); await o.hl('#per'); } },
  { ch: 'כיתות', text: 'במסך הכיתות מגדירים את כיתות החינוך המיוחד, שהן כיתות האם של התלמידים, וגם את הכיתות הרגילות שאליהן התלמידים משתלבים בחלק מהיום.',
    run: async (p, o) => { await o.nav('classes'); await o.hl('table.data'); } },
  { ch: 'צוות', text: 'במסך הצוות רושמים לכל איש צוות את התפקיד, את תחומי ההתמחות שלו, ואת הימים והשעות שבהם הוא נמצא במוסד. לפי התחומים, התוכנה תדע להציע מטפל מתאים כשמגיעה המלצה.',
    run: async (p, o) => {
      await o.nav('staff'); await sleep(500);
      await o.click(p.locator('tr', { hasText: 'ליאור' }).locator('[data-edit]'), 900);
      await o.hl('.modal [data-mp=specialties]', 3000); await o.hl('.modal [data-win=availability]', 3000);
    }, after: async (p, o) => { await o.closeModal(); } },
  { ch: 'תלמידים', text: 'לכל תלמיד מגדירים כיתת אם. אם יש זמנים קבועים שבהם הוא לא זמין, למשל טיפול מחוץ למוסד או הסעה מוקדמת, רושמים אותם כאן, והתוכנה לא תשבץ לו כלום בזמנים האלה.',
    run: async (p, o) => {
      await o.nav('students'); await sleep(500);
      await o.click(p.locator('tr', { hasText: 'יענקי' }).locator('[data-edit]'), 900);
      await o.hl('.modal [data-win=unavailable]');
    }, after: async (p, o) => { await o.closeModal(); } },
  { ch: 'פעילויות', text: 'החלק החשוב ביותר הוא הפעילויות. פעילות היא דרישה: מה צריך לקרות, עם מי, כמה זמן, וכמה פעמים בשבוע. למשל, טיפול רגשי לשלושה תלמידים, עם המטפל, ארבעים דקות, פעם בשבוע. את המועדים עצמם התוכנה תמצא לבד.',
    run: async (p, o) => {
      await o.nav('activities'); await sleep(500);
      await o.click(p.locator('tr', { hasText: 'טיפול רגשי – קבוצה' }).first().locator('[data-edit]'), 900);
      await o.hl('.modal [data-mp=studentIds]', 2800); await o.hl('.modal [data-mp=staffIds]', 2400);
      await o.hl('.modal [data-f=duration]', 1800); await o.hl('.modal [data-f=perWeek]');
    }, after: async (p, o) => { await o.closeModal(); } },
  { ch: 'שילוב', text: 'שילוב בכיתה רגילה מוגדר גם הוא כפעילות. מקשרים אותו לשיעור של הכיתה הרגילה, והתוכנה משבצת את התלמידים בדיוק בזמנים של אותו שיעור.',
    run: async (p, o) => { await o.hl(p.locator('tr', { hasText: 'שילוב – חשבון' }).first()); } },
  { ch: 'שיבוץ אוטומטי', text: 'עכשיו עוברים ללוח השיבוץ ולוחצים על שיבוץ אוטומטי. התוכנה משבצת את כל המפגשים החסרים, נמנעת מהתנגשויות, ומשתדלת שתלמידים יפספסו כמה שפחות שיעורים.',
    run: async (p, o) => {
      await o.nav('board'); await sleep(700);
      await o.click('#auto', 1200); await o.hl('.modal .body', 1800);
      await o.click('.modal footer button.pri', 2500); await o.hl('.modal .body', 1500);
    }, after: async (p, o) => { await o.closeModal(); } },
  { ch: 'לוח שיבוץ', text: 'כך נראה הלוח. כל צבע הוא סוג פעילות. בתיבה למעלה בוחרים מה לראות: כיתה, איש צוות, תלמיד או חדר. מפגשים קבועים, כמו תפילה, נעולים, והשיבוץ האוטומטי לא יזיז אותם.',
    run: async (p, o) => { await o.hl('.legend', 2200); await o.hl('#flt', 2600); await o.hl('.blk.locked'); } },
  { ch: 'גרירה', text: 'אפשר לגרור כל מפגש למקום אחר. אם המקום החדש לא מתאים, התוכנה מסבירה מה חוסם, ומציעה פתרון עם מינימום שינויים, למשל להזיז מפגש אחד אחר.',
    run: async (p, o) => {
      const ids = await p.evaluate(() => {
        const s = Model.Store.state; const a1 = s.activities.find(a => a.title === 'טיפול רגשי – קבוצה'); const a2 = s.activities.find(a => a.title === 'טיפול רגשי – קבוצה ב');
        return [s.sessions.find(x => x.activityId === a1.id).id, s.sessions.find(x => x.activityId === a2.id).id];
      });
      await o.scroll('[data-ses="' + ids[1] + '"]');
      await o.drag('[data-ses="' + ids[0] + '"]', '[data-ses="' + ids[1] + '"]');
      await sleep(900);
      if (await p.$('.modal')) { await o.hl('.modal .alert.bad', 2600); await o.hl('.modal .opt'); }
    }, after: async (p, o) => { if (await p.$('.modal')) { await o.click('.modal [data-apply-opt="0"]', 800); } } },
  { ch: 'בדיקת זמן', text: 'במסך בדיקת זמן בודקים כל רגע נתון. בוחרים יום, שעה ופעילות, ומקבלים לכל תלמיד ואיש צוות אם הוא פנוי. אם הזמן לא מתאים, מוצגות חלופות קרובות, וכמה שינויים כל אחת דורשת.',
    run: async (p, o) => {
      await o.nav('check'); await sleep(500);
      await p.evaluate(() => { const sel = document.querySelector('#qa'); const opt = Array.from(sel.options).find(x => x.text.includes('ריפוי בעיסוק')); sel.value = opt.value; sel.dispatchEvent(new Event('change')); });
      await o.hl('#qa', 2000);
      await o.click('#run', 1200); await sleep(400);
      await o.scroll('#res table'); await o.hl('#res table', 2500);
      await o.scroll('#res .opt'); await o.hl('#res .opt');
    } },
  { ch: 'המלצות', text: 'כשמגיעה המלצה על טיפול לתלמיד, רושמים אותה במסך ההמלצות. התוכנה מוצאת את אנשי המקצוע בתחום שיש להם זמן פנוי, ומציעה להצטרף לקבוצה קיימת או לפתוח מפגש חדש. בלחיצה אחת זה משובץ.',
    run: async (p, o) => {
      await o.nav('recs'); await sleep(500);
      await o.click('[data-sug]', 1300); await o.hl('.modal .opt', 3200);
      await o.click('.modal [data-o="0"]', 1200);
    } },
  { ch: 'היעדרות', text: 'גם שינויים חד פעמיים מטופלים כאן. למשל, כשמטפל נעדר ביום מסוים, התוכנה מציגה את כל המפגשים שלו באותו יום, את התלמידים שמושפעים, ומציעה מחליף פנוי.',
    run: async (p, o) => {
      await o.nav('calendar'); await sleep(500);
      await o.click('#absent', 1000);
      await p.evaluate(() => { const ab = document.querySelector('#ab'); const opt = Array.from(ab.options).find(x => x.text.includes('נועם')); ab.value = opt.value; const ad = document.querySelector('#ad'); ad.value = '2026-11-09'; ab.dispatchEvent(new Event('change')); });
      await sleep(400); await o.hl('#aff');
    }, after: async (p, o) => { await o.closeModal(); } },
  { ch: 'הפקת מערכות', text: 'בסוף מפיקים את המערכות. בוחרים סוג: מערכת לתלמיד, מערכת כיתתית, מערכת למחנך עם כל הפרטים, או מערכת קומפקטית למורה בכיתה הרגילה. אפשר להדפיס, לשמור כקובץ PDF, או להוריד לאקסל ולוורד.',
    run: async (p, o) => {
      await o.nav('export'); await sleep(500);
      await p.selectOption('#ek', 'sped'); await o.hl('#ek', 1600);
      await o.click('#prev', 1000); await sleep(300); await o.scroll('#eprev'); await o.hl('#eprev .tt-page', 3000);
      await o.scroll('#pr'); await o.hl('#pr', 1500); await o.hl('#xl', 1000); await o.hl('#wd', 1000);
    } },
  { ch: 'מורה בכיתה רגילה', text: 'כך נראית המערכת למורה בכיתה הרגילה: רק מתי התלמיד נמצא אצלו בכיתה, ומתי ולאן הוא יוצא.',
    run: async (p, o) => { await p.selectOption('#ek', 'regular'); await o.click('#prev', 900); await sleep(300); await o.scroll('#eprev'); await o.hl('#eprev'); } },
  { ch: 'ייבוא', text: 'רשימות קיימות של תלמידים או צוות אפשר לייבא מקובצי אקסל, PDF או וורד. התוכנה מזהה את העמודות, ואתם רק מאשרים.',
    run: async (p, o) => { await o.nav('import'); await sleep(500); await o.hl('#file'); } },
  { ch: 'גיבוי', text: 'חשוב לזכור: הנתונים נשמרים בדפדפן, במחשב שבו עובדים. לכן כדאי להוריד גיבוי באופן קבוע, בכפתור הזה למעלה.',
    run: async (p, o) => { await o.hl('#btnBackup'); } },
  { ch: 'סיום', text: 'זה הכול. בתפריט יש גם מדריך כתוב עם הסבר מלא לכל שלב. בהצלחה.',
    run: async (p, o) => { await o.nav('help'); await sleep(400); await o.hl('a[data-page=help]'); } }
];

// ---------- קריינות ----------
function durOf(f) { return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()); }
// קריינות אנושית: אם קיימת תיקייה voice/ עם קבצים 01.mp3, 02.mp3 ... (לפי מספר הקטע בתסריט) – משתמשים בהם
const OWN = path.join(__dirname, 'voice');
scenes.forEach((s, i) => {
  for (const ext of ['mp3', 'm4a', 'wav']) {
    const own = path.join(OWN, String(i + 1).padStart(2, '0') + '.' + ext);
    if (fs.existsSync(own)) { s.audio = own; s.dur = durOf(own); return; }
  }
  s.audio = path.join(WORK, 'n' + String(i).padStart(2, '0') + '.mp3');
  const stamp = s.audio + '.txt';
  if (!fs.existsSync(s.audio) || !fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== s.text) {
    execFileSync('python3', [TTS, VOICE, s.audio, s.text, '+4%']);
    fs.writeFileSync(stamp, s.text);
  }
  s.dur = durOf(s.audio);
});
console.log('narration total', scenes.reduce((x, s) => x + s.dur, 0).toFixed(1), 's');

// ---------- שכבת הדגשה ----------
const OVERLAY = () => {
  const css = document.createElement('style');
  css.textContent = `
  #__cur{position:fixed;width:20px;height:20px;border-radius:50%;background:rgba(232,89,12,.35);border:2px solid #e8590c;z-index:99999;pointer-events:none;transform:translate(-50%,-50%);transition:left .7s ease,top .7s ease;left:640px;top:360px}
  #__cur.click{animation:__c .35s}
  @keyframes __c{50%{transform:translate(-50%,-50%) scale(.6)}}
  #__hl{position:fixed;border:3px solid #e8590c;border-radius:6px;z-index:99998;pointer-events:none;box-shadow:0 0 0 4000px rgba(20,28,38,.18);transition:all .35s ease;opacity:0}
  #__sub{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);max-width:82%;background:rgba(20,28,38,.88);color:#fff;font:600 21px/1.45 Assistant,Arial,sans-serif;padding:9px 18px;border-radius:6px;z-index:99999;direction:rtl;text-align:center;pointer-events:none}
  #__sub:empty{display:none}
  #__ch{position:fixed;top:62px;left:18px;background:#23527c;color:#fff;font:600 15px Assistant,Arial,sans-serif;padding:4px 12px;border-radius:4px;z-index:99999;direction:rtl;pointer-events:none}
  #__ch:empty{display:none}`;
  const add = () => {
    if (document.getElementById('__cur')) return;
    document.head.appendChild(css);
    for (const id of ['__cur', '__hl', '__sub', '__ch']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
};

(async () => {
  const browser = await chromium.launch({ args: ['--lang=he-IL'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: WORK, size: { width: W, height: H } }, locale: 'he-IL' });
  const t0 = Date.now();
  const p = await ctx.newPage();
  await p.addInitScript(OVERLAY);
  await p.goto('file://' + APP + '/index.html');
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await sleep(800);

  const box = async (target) => {
    const loc = typeof target === 'string' ? p.locator(target).first() : target;
    await loc.scrollIntoViewIfNeeded().catch(() => {});
    return loc.boundingBox();
  };
  const o = {
    async hl(target, ms) {
      const b = await box(target); if (!b) return;
      await p.evaluate(b => { const h = document.getElementById('__hl'); Object.assign(h.style, { left: (b.x - 6) + 'px', top: (b.y - 6) + 'px', width: (b.width + 12) + 'px', height: (b.height + 12) + 'px', opacity: 1 }); }, b);
      await o.cursor(b.x + b.width / 2, b.y + Math.min(b.height / 2, 40));
      await sleep(ms || 1800);
    },
    async unhl() { await p.evaluate(() => { document.getElementById('__hl').style.opacity = 0; }); },
    async cursor(x, y) { await p.evaluate(([x, y]) => { const c = document.getElementById('__cur'); c.style.left = x + 'px'; c.style.top = y + 'px'; }, [x, y]); await sleep(750); },
    async click(target, ms) {
      const b = await box(target); if (!b) return;
      await o.cursor(b.x + b.width / 2, b.y + b.height / 2);
      await p.evaluate(() => { const c = document.getElementById('__cur'); c.classList.remove('click'); void c.offsetWidth; c.classList.add('click'); });
      await o.unhl();
      await (typeof target === 'string' ? p.locator(target).first() : target).click();
      await sleep(ms || 700);
    },
    async nav(page) { await o.click('a[data-page=' + page + ']', 700); },
    async scroll(sel) { await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await sleep(300); },
    async drag(from, to) {
      const a = await box(from), b = await box(to);
      await o.cursor(a.x + a.width / 2, a.y + 12);
      await p.dragAndDrop(from, to, { targetPosition: { x: Math.min(30, b.width / 2), y: 8 } });
      await o.cursor(b.x + 30, b.y + 8);
    },
    async closeModal() { while (await p.$('.modal [data-x]')) { await p.click('.modal [data-x]'); await sleep(250); } }
  };

  const timeline = [];
  for (const s of scenes) {
    const start = (Date.now() - t0) / 1000;
    s.start = start;
    // כתוביות: פיצול למשפטים, זמן יחסי לאורך
    const parts = s.text.split(/(?<=[.,:])\s+/).reduce((acc, x) => { if (acc.length && (acc[acc.length - 1].length + x.length) < 70) acc[acc.length - 1] += ' ' + x; else acc.push(x); return acc; }, []);
    const total = parts.reduce((x, y) => x + y.length, 0);
    let acc = 0;
    s.subs = parts.map(t => { const a = acc; acc += t.length; return { t, from: start + s.dur * a / total, to: start + s.dur * acc / total }; });
    await p.evaluate(({ ch, subs, dur }) => {
      document.getElementById('__ch').textContent = ch;
      const el = document.getElementById('__sub');
      let ofs = 0;
      subs.forEach(x => { setTimeout(() => { el.textContent = x.t; }, ofs); ofs += x.ms; });
      setTimeout(() => { el.textContent = ''; }, dur * 1000);
    }, { ch: s.ch, dur: s.dur, subs: s.subs.map(x => ({ t: x.t, ms: (x.to - x.from) * 1000 })) });
    try { await s.run(p, o); } catch (e) { console.log('scene error', s.ch, e.message); }
    const elapsed = (Date.now() - t0) / 1000 - start;
    if (elapsed < s.dur + 0.5) await sleep((s.dur + 0.5 - elapsed) * 1000);
    await o.unhl();
    if (s.after) { try { await s.after(p, o); } catch (e) { console.log('after error', s.ch, e.message); } }
    await sleep(350);
    s.end = (Date.now() - t0) / 1000;
    timeline.push({ ch: s.ch, start: s.start, end: s.end, dur: s.dur, text: s.text });
    console.log(s.ch, s.start.toFixed(1), '→', s.end.toFixed(1));
  }
  await sleep(1200);
  const video = await p.video().path();
  await ctx.close(); await browser.close();

  // ---------- מיזוג קול ותמונה ----------
  const args = ['-y', '-i', video];
  scenes.forEach(s => args.push('-i', s.audio));
  const filt = scenes.map((s, i) => `[${i + 1}:a]adelay=${Math.round(s.start * 1000)}|${Math.round(s.start * 1000)}[a${i}]`).join(';') +
    ';' + scenes.map((s, i) => `[a${i}]`).join('') + `amix=inputs=${scenes.length}:normalize=0[aout]`;
  const mp4 = path.join(OUT, 'tutorial.mp4');
  args.push('-filter_complex', filt, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', mp4);
  execFileSync('ffmpeg', args, { stdio: 'ignore' });

  // ---------- ציר זמן לקריינות עתידית ----------
  const ts = t => { const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0'); };
  const srtT = t => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = Math.floor(t % 60), ms = Math.round((t % 1) * 1000); return [h, m, s].map(x => String(x).padStart(2, '0')).join(':') + ',' + String(ms).padStart(3, '0'); };
  let srt = '', n = 1;
  scenes.forEach(s => s.subs.forEach(x => { srt += (n++) + '\n' + srtT(x.from) + ' --> ' + srtT(x.to) + '\n' + x.t + '\n\n'; }));
  fs.writeFileSync(path.join(OUT, 'tutorial.srt'), srt);
  let md = '<div dir="rtl">\n\n# תסריט קריינות – סרטון הדרכה\n\nלהקלטה מחדש של הקריינות: כל קטע מתחיל בזמן שבעמודה "התחלה". משך הקריינות המקורית מופיע לצורך התאמה. אם ההקלטה ארוכה יותר, אפשר לבקש לבנות את הסרטון מחדש לפי ההקלטות.\n\n| # | התחלה | סיום | משך קריינות | פרק | טקסט |\n|---|---|---|---|---|---|\n';
  timeline.forEach((x, i) => { md += `| ${i + 1} | ${ts(x.start)} | ${ts(x.end)} | ${x.dur.toFixed(1)} ש' | ${x.ch} | ${x.text} |\n`; });
  md += '\n</div>\n';
  fs.writeFileSync(path.join(OUT, 'NARRATION.md'), md);
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline, null, 1));
  console.log('done', mp4, (fs.statSync(mp4).size / 1e6).toFixed(1) + 'MB');
})();
