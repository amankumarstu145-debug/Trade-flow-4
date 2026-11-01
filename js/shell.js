/* TradeFlow app shell: the slim top bar's "New" and "More" menus and the Inbox count.
   The menus reuse the app's existing buttons and functions; nothing here owns data. */
(function () {
  'use strict';
  const menus = ['tf-new-menu', 'tf-more-menu'];
  function close(exceptId) {
    menus.forEach(id => {
      if (id === exceptId) return;
      const menu = document.getElementById(id);
      const btn = document.querySelector(`[aria-controls="${id}"]`);
      if (menu) menu.hidden = true;
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }
  function toggle(id) {
    const menu = document.getElementById(id);
    const btn = document.querySelector(`[aria-controls="${id}"]`);
    if (!menu) return;
    const open = menu.hidden;
    close(id);
    menu.hidden = !open;
    if (btn) btn.setAttribute('aria-expanded', String(open));
    if (open) { const first = menu.querySelector('button, a'); if (first) first.focus(); }
  }
  // Run an item's action, then close the menu.
  function run(fn) { close(); try { fn(); } catch (err) { console.error(err); } }

  document.addEventListener('click', e => {
    if (!e.target.closest('.tf-menu-wrap')) close();
    else if (e.target.closest('.tf-menu button, .tf-menu a') && !e.target.closest('#topbar-live-clock, #topbar-clock-popover')) setTimeout(() => close(), 0);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const openMenu = menus.map(id => document.getElementById(id)).find(m => m && !m.hidden);
    if (openMenu) { close(); const btn = document.querySelector(`[aria-controls="${openMenu.id}"]`); if (btn) btn.focus(); }
  });

  // The Inbox count mirrors the urgent-actions count the app already keeps up to date.
  function syncInbox() {
    const src = document.getElementById('sidebar-urgent-badge');
    const out = document.getElementById('tf-inbox-count');
    if (!src || !out) return;
    const n = parseInt(String(src.textContent).replace(/[^0-9]/g, ''), 10) || 0;
    out.textContent = String(n);
    out.hidden = n === 0;
    const btn = document.getElementById('tf-inbox-btn');
    if (btn) btn.setAttribute('aria-label', n ? `Inbox, ${n} things to do` : 'Inbox, nothing to do');
  }
  function start() {
    syncInbox();
    const src = document.getElementById('sidebar-urgent-badge');
    if (src && typeof MutationObserver === 'function') new MutationObserver(syncInbox).observe(src, { childList: true, characterData: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.TFShell = { toggle, close, run, syncInbox };
})();
