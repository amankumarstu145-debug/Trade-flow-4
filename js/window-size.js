/* Full window / normal size button for work windows.
 * Every window where you fill in details or work through a list gets one button next to its
 * close button. Full window fills the dashboard's work area (beside the sidebar, under the top
 * bar; the whole screen on phones and tablets). Clicking again restores the normal size. Each window
 * remembers the size you left it at. Small confirm, warning and prompt boxes do not get the button.
 * The button replaces the older per-window "maximize" buttons so every window behaves the same. */
(function () {
  'use strict';

  // Windows that get the button. Small dialogs (confirm, prompt, warnings, QR code, search) are left out.
  const WORK = new Set([
    'invoice-modal', 'new-order-modal', 'factory-po-modal', 'kpi-breakdown-modal', 'contact-edit-modal', 'payment-modal',
    'order-payment-full-modal', 'document-review-modal', 'urgent-actions-modal', 'sku-edit-modal', 'profit-calculator-modal',
    'invoice-studio-modal', 'studio-magic-drawer-modal', 'smart-fill-modal', 'excel-preview-modal', 'backup-recovery-modal',
    'change-history-modal', 'dual-slip-comparison-modal', 'dual-slip-order-dossier-modal', 'vault-document-viewer-modal',
    'whatsapp-dispatch-modal', 'partner-spotlight-modal', 'daily-diary-modal', 'recycle-bin-modal', 'transport-dispatch-modal',
    'system-settings-modal', 'company-executive-hub-modal', 'sheets-sync-hub-modal', 'tf-inbox-modal', 'tf-wa'
  ]);
  const OLD_MAX = /toggle[A-Za-z]*Maximize\(\)/;
  const KEY = id => 'tf-win-full:' + id;
  const read = id => { try { return localStorage.getItem(KEY(id)) === '1'; } catch (_) { return false; } };
  const write = (id, on) => { try { if (on) localStorage.setItem(KEY(id), '1'); else localStorage.removeItem(KEY(id)); } catch (_) { /* per-browser convenience only */ } };

  // The window frame: walk up from the close button to the largest box that is not the full-screen backdrop.
  function closeButtonOf(root) {
    const list = [...root.querySelectorAll('button, [role="button"]')].filter(b => /close|resolveModalPrompt/i.test((b.getAttribute('onclick') || '') + ' ' + (b.getAttribute('aria-label') || '') + ' ' + (b.title || '')));
    if (!list.length) return null;
    // Prefer the one in the header: the earliest in the document whose onclick is a close call.
    return list.find(b => /close/i.test(b.getAttribute('onclick') || '')) || list[0];
  }
  const FRAME = '.resizable-modal-panel, .tf-draggable-window, .wa-window, .tf-dialog, [id$="-modal-panel"]';
  function panelOf(root, closeBtn) {
    if (root.__tfPanel && root.contains(root.__tfPanel)) return root.__tfPanel;
    let el = closeBtn.closest(FRAME);
    if (!el || !root.contains(el) || el === root) {
      // No frame class: walk up to the largest box that is not the full-screen backdrop (needs the window open).
      if (!closeBtn.getBoundingClientRect().width) return null;
      el = closeBtn;
      while (el.parentElement && el.parentElement !== root) {
        const r = el.parentElement.getBoundingClientRect();
        if (r.width >= window.innerWidth - 2 && r.height >= window.innerHeight - 2) break;
        el = el.parentElement;
      }
      if (el.parentElement !== root && el === closeBtn) return null;
    }
    root.__tfPanel = el;
    return el;
  }

  function icon(full) { return `<i data-lucide="${full ? 'minimize-2' : 'maximize-2'}" class="w-4 h-4"></i>`; }
  function label(full) { return full ? 'Back to normal size' : 'Full window'; }
  function drawIcons() { if (window.lucide && typeof lucide.createIcons === 'function') { try { lucide.createIcons(); } catch (_) { /* decoration */ } } }

  function place() {
    // Work area of the dashboard: right of the sidebar, under the top bar. Phones and tablets: whole screen.
    const wide = window.innerWidth >= 1024;
    const side = wide ? document.querySelector('.tf-app-sidebar') : null;
    const bar = wide ? document.querySelector('header.tf-topbar') : null;
    const left = side ? Math.max(0, Math.round(side.getBoundingClientRect().right)) : 0;
    const top = bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0;
    document.documentElement.style.setProperty('--tf-win-left', (wide ? left + 12 : 0) + 'px');
    document.documentElement.style.setProperty('--tf-win-top', (wide ? top + 12 : 0) + 'px');
    document.documentElement.style.setProperty('--tf-win-gap', (wide ? 12 : 0) + 'px');
  }

  function apply(root, full) {
    const btn = root.querySelector('.tf-win-btn');
    const panel = btn && panelOf(root, btn);
    if (!panel) return;
    place();
    panel.classList.toggle('tf-win-full', full);
    root.classList.toggle('tf-win-host', full);
    btn.setAttribute('aria-pressed', String(full));
    btn.setAttribute('aria-label', label(full));
    btn.title = label(full);
    btn.innerHTML = icon(full);
    drawIcons();
    // Charts, splitters and canvases inside the window size themselves on resize.
    try { window.dispatchEvent(new Event('resize')); } catch (_) { /* old browsers */ }
  }

  function toggle(btn) {
    const root = btn.closest('[data-tf-win]');
    if (!root) return;
    const full = !root.querySelector('.tf-win-full');
    write(root.getAttribute('data-tf-win'), full);
    apply(root, full);
  }

  function setup(root) {
    if (!root || root.hasAttribute('data-tf-win') || !WORK.has(root.id)) return;
    if (!inject(root)) return;
    root.setAttribute('data-tf-win', root.id);
    apply(root, read(root.id));
    watch(root);
  }
  // Puts the button next to the close button (again, if the window redrew its contents).
  function inject(root) {
    if (root.querySelector('.tf-win-btn')) return true;
    const closeBtn = closeButtonOf(root);
    if (!closeBtn) return false;
    root.__tfPanel = null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('onclick', 'TFWindowSize.toggle(this)');
    const old = [...root.querySelectorAll('button')].find(b => OLD_MAX.test(b.getAttribute('onclick') || ''));
    // Look like the controls already in that header.
    btn.className = 'tf-win-btn ' + ((old || closeBtn).className || '').replace(/\btf-win-btn\b/g, '');
    if (old) old.replaceWith(btn); else closeBtn.parentElement.insertBefore(btn, closeBtn);
    btn.innerHTML = icon(false); btn.title = label(false); btn.setAttribute('aria-label', label(false)); btn.setAttribute('aria-pressed', 'false');
    return true;
  }

  // When a window opens again, use the size it was left at.
  function watch(root) {
    const sync = () => {
      const open = !root.hidden && !root.classList.contains('hidden');
      if (open && !root.__tfWasOpen) apply(root, read(root.id));
      root.__tfWasOpen = open;
    };
    root.__tfWasOpen = !root.hidden && !root.classList.contains('hidden');
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['class', 'hidden'] });
    // Windows that rebuild their contents (for example the Inbox) get the button back, at the same size.
    new MutationObserver(() => { if (!root.querySelector('.tf-win-btn') && inject(root)) apply(root, read(root.id)); }).observe(root, { childList: true, subtree: true });
  }

  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (WORK.has(node.id)) setup(node);
    // A loaded template can bring a window wrapped in another element.
    if (node.children && node.children.length && node.children.length < 50) for (const ch of node.children) if (WORK.has(ch.id)) setup(ch);
  }

  function start() {
    place();
    // Windows already on the page (pop-ups still waiting in a template are set up when they load).
    const waiting = new Set(window.TFLazyModals ? TFLazyModals.pending() : []);
    for (const id of WORK) if (!waiting.has(id)) scan(document.getElementById(id));
    new MutationObserver(list => { for (const m of list) for (const n of m.addedNodes) scan(n); }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', () => { if (document.querySelector('.tf-win-full')) place(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.TFWindowSize = { toggle, setup, WORK };
})();
