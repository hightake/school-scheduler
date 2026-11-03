/* אפליקציה: ניווט, אירועים גלובליים */
(function (root) {
  'use strict';
  const Store = root.Model.Store, U = root.UI;
  const App = root.App = {
    page: 'dashboard', params: null, mem: {},
    go(page, params) {
      if (!root.Pages[page]) page = 'dashboard';
      App.page = page; App.params = params || null;
      try { history.replaceState(null, '', '#' + page); } catch (e) { /* file:// */ }
      App.render();
      window.scrollTo(0, 0);
    },
    render() {
      U.$$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.page === App.page));
      const main = U.$('#main');
      try { root.Pages[App.page](main, App.params); }
      catch (e) { console.error(e); main.innerHTML = '<div class="alert bad">שגיאה בהצגת העמוד: ' + U.esc(e.message) + '</div>'; }
      App.params = null;
      U.$('#instName').textContent = Store.state.settings.institution || '';
      U.$('#btnUndo').disabled = !Store.undo.length;
      U.$('#btnRedo').disabled = !Store.redo.length;
    },
    backup() {
      const s = Store.state;
      const name = 'גיבוי שיבוץ ' + (s.settings.institution || '') + ' ' + new Date().toISOString().slice(0, 10) + '.json';
      root.Render.download(root.Render.safeName(name.replace('.json', '')) + '.json', new Blob([JSON.stringify(s, null, 1)], { type: 'application/json' }));
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    Store.load();
    Store.on(() => { if (!document.querySelector('.modal-back')) App.render(); else App._pending = true; U.$('#saveState').textContent = 'נשמר ' + new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); });
    // רענון העמוד כשנסגר מודאל אחרי שינוי
    new MutationObserver(() => { if (App._pending && !document.querySelector('.modal-back')) { App._pending = false; App.render(); } }).observe(U.$('#modalRoot'), { childList: true });

    U.$('#nav').addEventListener('click', e => { const a = e.target.closest('a[data-page]'); if (a) { e.preventDefault(); App.go(a.dataset.page); } });
    document.addEventListener('click', e => {
      const g = e.target.closest('[data-go]');
      if (g && !e.defaultPrevented && !g.closest('#nav')) { App.go(g.dataset.go); }
    });
    U.$('#btnUndo').onclick = () => { if (Store.doUndo()) U.toast('בוטל'); };
    U.$('#btnRedo').onclick = () => { if (Store.doRedo()) U.toast('שוחזר'); };
    U.$('#btnBackup').onclick = () => App.backup();
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); if (Store.doUndo()) U.toast('בוטל'); }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); if (Store.doRedo()) U.toast('שוחזר'); }
    });
    const h = (location.hash || '').slice(1);
    App.go(root.Pages[h] ? h : 'dashboard');
  });
})(window);
