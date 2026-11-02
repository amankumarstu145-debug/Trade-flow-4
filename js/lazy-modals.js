/* Pop-up windows are shipped inside <template data-tf-lazy> so the page starts with far fewer
   elements. A window is put into the page the first time any code asks for it or for anything
   inside it (getElementById, or querySelector/querySelectorAll that would match inside it).
   No other code needs to know: lookups behave exactly as if the window had always been there.
   Queries that only look for *open* windows (":not(.hidden)") do not load anything, because a
   window that was never loaded cannot be open. */
(function () {
  'use strict';
  const templates = [...document.querySelectorAll('template[data-tf-lazy]')];
  if (!templates.length) return;
  const byId = new Map();
  templates.forEach(t => t.content.querySelectorAll('[id]').forEach(el => byId.set(el.id, t)));
  const pending = new Set(templates);
  const docGetById = Document.prototype.getElementById;
  const docQuery = Document.prototype.querySelector;
  const docQueryAll = Document.prototype.querySelectorAll;
  const elQuery = Element.prototype.querySelector;
  const elQueryAll = Element.prototype.querySelectorAll;

  function load(t) {
    if (!pending.has(t)) return;
    pending.delete(t);
    t.content.querySelectorAll('[id]').forEach(el => byId.delete(el.id));
    t.replaceWith(t.content);
    if (window.lucide && typeof window.lucide.createIcons === 'function') { try { window.lucide.createIcons(); } catch (_) {} }
  }
  function loadFor(selector, root) {
    if (!pending.size || typeof selector !== 'string') return;
    if (/:not\(\.hidden\)/.test(selector)) return; // only open windows wanted
    if (/data-lucide/.test(selector)) return; // icon sweep: icons are drawn when the window loads
    const simple = /^#([A-Za-z][\w-]*)$/.exec(selector.trim());
    if (simple) { const t = byId.get(simple[1]); if (t) load(t); return; }
    for (const t of [...pending]) {
      if (root && root !== document && !(root.contains && root.contains(t))) continue;
      let hit = false;
      try { hit = !!t.content.querySelector(selector); } catch (_) { return; }
      if (hit) load(t);
    }
  }
  Document.prototype.getElementById = function (id) {
    const found = docGetById.call(this, id);
    if (found || this !== document || !byId.has(id)) return found;
    load(byId.get(id));
    return docGetById.call(this, id);
  };
  Document.prototype.querySelector = function (sel) { if (this === document) loadFor(sel, document); return docQuery.call(this, sel); };
  Document.prototype.querySelectorAll = function (sel) { if (this === document) loadFor(sel, document); return docQueryAll.call(this, sel); };
  Element.prototype.querySelector = function (sel) { if (pending.size && (this === document.body || this === document.documentElement)) loadFor(sel, this); return elQuery.call(this, sel); };
  Element.prototype.querySelectorAll = function (sel) { if (pending.size && (this === document.body || this === document.documentElement)) loadFor(sel, this); return elQueryAll.call(this, sel); };

  window.TFLazyModals = { pending: () => [...pending].map(t => t.getAttribute('data-tf-lazy')), loadAll: () => [...pending].forEach(load) };
})();
