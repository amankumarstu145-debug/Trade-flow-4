/* TradeFlow smart features (v5 step 4)
   - One Inbox: urgent actions, exceptions, missing files and partner reminders in one list,
     grouped (money, documents, orders, partners), each with a one-click fix.
   - Licence expiry reminders (FSSAI) 30 days ahead.
   - Payment matching: suggests which order a payment belongs to.
   - Ctrl+K actions: "payment Sunrise 35000", "paid Riverbend 20000", "order Sunrise",
     "open Maple", "remind Sunrise", "statement Sunrise", "inbox".
   Everything reads app.data and calls the app's existing actions. */
(function () {
  'use strict';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const jsArg = v => esc(JSON.stringify(String(v ?? '')));
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const inr = n => '₹' + Math.round(num(n)).toLocaleString('en-IN');
  const app = () => window.app;
  const today = () => new Date().toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
  const shortDate = d => { const t = new Date(d); return isNaN(t) ? String(d || '') : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };

  /* ======================================================================= Inbox */
  const GROUPS = {
    money: { label: 'Money', icon: 'indian-rupee' },
    documents: { label: 'Documents', icon: 'file-text' },
    orders: { label: 'Orders', icon: 'package' },
    partners: { label: 'Partners', icon: 'users' }
  };
  const ROLE_KEY = { retailer: 'retailerId', manufacturer: 'manufacturerId', packaging: 'packagingVendorId', transporter: 'transporterId', marketeer: 'marketeerId' };
  const runCode = code => { try { return new Function(String(code))(); } catch (err) { console.error('Inbox action failed:', err); } };
  const contactByName = name => { const n = String(name || '').trim().toLowerCase(); return (app().data.contacts || []).find(c => String(c.name || '').trim().toLowerCase() === n); };
  let actions = [];
  let filter = 'all';

  function collect() {
    const a = app();
    if (!a || !a.data) return [];
    const map = new Map();
    const add = item => { if (!map.has(item.key)) map.set(item.key, item); else { const prev = map.get(item.key); if (item.severity > prev.severity) map.set(item.key, { ...prev, severity: item.severity }); } };
    let urgent = [], exceptions = [];
    try { urgent = a.getUrgentActionItems ? a.getUrgentActionItems() : []; } catch (_) {}
    try { exceptions = a.getExceptionsList ? a.getExceptionsList() : []; } catch (_) {}
    const issues = (a.auditData && Array.isArray(a.auditData.issues)) ? a.auditData.issues : [];

    for (const u of urgent) {
      const base = { sub: [u.partyName, u.invoiceNumber].filter(Boolean).join(' · '), amount: u.amount, run: () => runCode(u.actionCallback), fix: String(u.actionLabel || 'Open').replace(/\s*→$/, '') };
      if (u.type === 'overdue_receivable') add({ ...base, key: 'overdue:' + u.orderId, group: 'money', severity: 3, title: `Overdue payment from ${u.partyName}`, sub: `${u.invoiceNumber} · due ${u.timeFormatted.replace(/^Due by /, '')}`, fix: 'Open order', remind: contactByName(u.partyName) });
      else if (u.type === 'mfg_advance_needed') add({ ...base, key: 'mfgadv:' + u.orderId, group: 'money', severity: 2, title: `Pay factory advance to ${u.partyName}`, fix: 'Record payment' });
      else if (u.type === 'po_needed') add({ ...base, key: 'po:' + u.orderId, group: 'orders', severity: 2, title: `Place factory order for ${u.invoiceNumber}`, sub: `${u.partyName} paid an advance · production not started`, fix: 'Place factory PO' });
      else if (u.type === 'missing_proof') add({ ...base, key: 'slip:' + String(u.id).replace(/^urgent-doc-/, ''), group: 'documents', kind: 'bank slip', order: u.orderId, party: u.partyName, severity: 2, title: `Bank slip missing for ${inr(u.amount)} payment`, sub: [u.partyName, u.timeFormatted].filter(Boolean).join(' · '), fix: 'Attach slip' });
      else if (u.type === 'pending_mobile_snap' || u.type === 'pending_intake_draft') add({ ...base, key: 'intake:' + u.id, group: 'orders', severity: 2, title: u.title, sub: u.description || base.sub, fix: 'Continue' });
      else add({ ...base, key: 'urgent:' + u.id, group: 'orders', severity: 1, title: u.title });
    }
    for (const e of exceptions) {
      const run = typeof e.action === 'function' ? e.action : () => a.openOrderDetailPage && a.openOrderDetailPage(e.orderId);
      const sev = e.severity === 'critical' ? 3 : e.severity === 'high' ? 2 : 1;
      if (e.type === 'overdue_account') add({ key: 'overdue:' + e.orderId, group: 'money', severity: 3, title: `Overdue payment from ${e.party}`, sub: e.description, amount: e.amount, run, fix: 'Record payment', remind: contactByName(e.party) });
      else if (e.type === 'missing_payment') continue; // a normal open balance, not a to-do
      else if (e.type === 'idle_advance') add({ key: 'po:' + e.orderId, group: 'orders', severity: 2, title: `Place factory order (${e.party})`, sub: e.description, amount: e.amount, run, fix: 'Place factory PO' });
      else if (e.type === 'missing_lr') add({ key: 'lr:' + e.orderId, group: 'documents', kind: 'LR', order: e.orderId, party: e.party, severity: 2, title: 'LR / transport receipt missing', sub: `${e.party} · ${String(e.title).replace(/^Missing Bilty: Order /, '')}`, run, fix: 'Upload LR' });
      else if (e.type === 'duplicate_utr') add({ key: 'dupe:' + e.id, group: 'money', severity: 3, title: e.title, sub: e.description, amount: e.amount, run, fix: e.actionLabel || 'Check' });
      else add({ key: 'exc:' + e.id, group: 'orders', severity: sev, title: e.title, sub: [e.party, e.description].filter(Boolean).join(' · '), amount: e.amount, run, fix: e.actionLabel || 'Open' });
    }
    const docCat = { missing_invoice: ['invoice', 'retailer_invoice', 'Tax invoice missing', 'tax invoice'], missing_bank_proof: ['advslip', 'bank_receipt', 'Advance receipt missing', 'advance receipt'], missing_mfg_bill: ['mfgbill', 'mfg_invoice', 'Factory bill missing', 'factory bill'], missing_payment_voucher: ['slip', 'bank_receipt', 'Bank slip missing', 'bank slip'] };
    for (const i of issues) {
      const d = docCat[i.type]; if (!d) continue;
      const ref = d[0] === 'slip' ? (i.paymentId || i.orderId) : i.orderId;
      add({ key: d[0] + ':' + ref, group: 'documents', kind: d[3], order: i.orderId, party: i.entityName, orderRef: i.orderRef, severity: i.severity === 'high' ? 2 : 1, title: d[2], sub: [i.entityName, i.orderRef].filter(Boolean).join(' · '), amount: i.amount, run: () => a.triggerUploadForOrder && a.triggerUploadForOrder(i.orderId || 'general', d[1]), fix: 'Upload' });
    }
    // Partners: licence expiry, missing GSTIN, missing bank details for people we pay
    for (const c of (a.data.contacts || [])) {
      if (c.isDeleted) continue;
      const open = () => window.TFPartnerUI && TFPartnerUI.open(c.id, 'company', 'kyc');
      if (c.fssaiExpiry) {
        const left = daysBetween(today(), c.fssaiExpiry);
        if (left <= 30) add({ key: 'fssai:' + c.id, group: 'partners', severity: left < 0 ? 3 : 2, title: left < 0 ? `FSSAI licence expired · ${c.name}` : `FSSAI licence expires in ${left} ${left === 1 ? 'day' : 'days'} · ${c.name}`, sub: `Valid till ${shortDate(c.fssaiExpiry)}`, run: open, fix: 'Update licence' });
      }
      const hasOrders = (a.data.orders || []).some(o => o[ROLE_KEY[c.role]] === c.id);
      if (!c.gstin && ['retailer', 'manufacturer', 'packaging'].includes(c.role) && hasOrders) add({ key: 'gstin:' + c.id, group: 'partners', severity: 1, title: `GSTIN missing · ${c.name}`, sub: 'Needed on tax invoices', run: open, fix: 'Add GSTIN' });
      if (c.role !== 'retailer' && hasOrders && !(c.accountNumber || c.upiId || (c.bankDetails && (c.bankDetails.accountNumber || c.bankDetails.upiId)))) add({ key: 'bank:' + c.id, group: 'partners', severity: 1, title: `Bank or UPI missing · ${c.name}`, sub: 'Needed to pay this partner', run: () => window.TFPartnerUI && TFPartnerUI.open(c.id, 'company', 'bank'), fix: 'Add bank' });
    }
    // One item per order for missing files, listing what is missing.
    const all = [...map.values()];
    const docs = all.filter(i => i.group === 'documents' && i.order);
    const byOrder = new Map();
    docs.forEach(i => { if (!byOrder.has(i.order)) byOrder.set(i.order, []); byOrder.get(i.order).push(i); });
    const merged = [];
    for (const [orderId, list] of byOrder) {
      if (list.length === 1) { merged.push(list[0]); continue; }
      const o = (a.data.orders || []).find(x => x.id === orderId) || {};
      const kinds = [...new Set(list.map(i => i.kind).filter(Boolean))];
      merged.push({ key: 'files:' + orderId, group: 'documents', severity: Math.max(...list.map(i => i.severity)), title: `${list.length} files missing · ${o.invoiceNumber || list[0].orderRef || orderId}`, sub: [o.retailerName || list[0].party, kinds.join(', ')].filter(Boolean).join(' · '), run: () => a.openOrderDetailPage && a.openOrderDetailPage(orderId), fix: 'Open order files', count: list.length });
    }
    const rest = all.filter(i => !(i.group === 'documents' && i.order));
    return [...rest, ...merged].sort((x, y) => y.severity - x.severity || num(y.amount) - num(x.amount));
  }

  function counts(items) {
    const c = { all: items.length }; Object.keys(GROUPS).forEach(g => { c[g] = items.filter(i => i.group === g).length; }); return c;
  }

  function ensureModal() {
    let m = document.getElementById('tf-inbox-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'tf-inbox-modal';
    m.className = 'tf-inbox-modal hidden no-print';
    m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'tf-inbox-title');
    m.addEventListener('click', e => { if (e.target === m) close(); });
    document.body.appendChild(m);
    return m;
  }
  function render() {
    const m = ensureModal();
    const items = collect();
    const c = counts(items);
    const shown = filter === 'all' ? items : items.filter(i => i.group === filter);
    actions = shown;
    const chip = (id, label) => `<button type="button" class="tf-chip ${filter === id ? 'is-on' : ''}" onclick="TFInbox.setFilter('${id}')">${esc(label)} <b>${c[id] || 0}</b></button>`;
    m.innerHTML = `<div class="tf-dialog tf-inbox-panel">
      <div class="tf-box__head">
        <span class="tf-icon-tile"><i data-lucide="inbox" class="w-4 h-4"></i></span>
        <div class="pu-grow" style="flex:1 1 auto;min-width:0"><h2 id="tf-inbox-title" class="tf-box__title">Inbox</h2><span class="tf-hint">${c.all ? `${c.all} ${c.all === 1 ? 'thing' : 'things'} to do, most important first` : 'Nothing to do right now'}</span></div>
        <button type="button" class="tf-btn tf-btn--sm tf-btn--icon" aria-label="Close inbox" onclick="TFInbox.close()">✕</button>
      </div>
      <div class="tf-inbox-chips">${chip('all', 'All')}${Object.entries(GROUPS).map(([id, g]) => chip(id, g.label)).join('')}</div>
      <div class="tf-inbox-list">
        ${shown.length ? shown.map((it, i) => `
          <div class="tf-inbox-row sev-${it.severity}">
            <span class="tf-inbox-icon g-${it.group}"><i data-lucide="${GROUPS[it.group].icon}" class="w-4 h-4"></i></span>
            <div class="tf-inbox-text"><b>${esc(it.title)}</b><span>${esc(it.sub || '')}</span></div>
            ${it.amount ? `<span class="tf-inbox-amt tf-num">${esc(inr(it.amount))}</span>` : ''}
            <div class="tf-inbox-actions">
              ${it.remind ? `<button type="button" class="tf-btn tf-btn--sm" onclick="TFInbox.remind(${i})" title="Send a payment reminder on WhatsApp">Remind</button>` : ''}
              <button type="button" class="tf-btn tf-btn--sm tf-btn--primary" onclick="TFInbox.run(${i})">${esc(it.fix || 'Open')}</button>
            </div>
          </div>`).join('') : `<div class="tf-empty">${filter === 'all' ? 'All clear. New items appear here as soon as something needs you.' : 'Nothing in this group.'}</div>`}
      </div>
    </div>`;
    if (window.lucide) window.lucide.createIcons();
    refreshBadges(items);
  }
  function open(group) {
    filter = group || 'all';
    const a = app();
    const m = ensureModal();
    m.classList.remove('hidden');
    render();
    // Missing-file data comes from the server; refresh it, then redraw.
    if (a && typeof a.fetchAuditData === 'function') Promise.resolve(a.fetchAuditData()).then(() => { if (!m.classList.contains('hidden')) render(); }).catch(() => {});
    setTimeout(() => { const first = m.querySelector('.tf-inbox-row .tf-btn--primary, .tf-btn'); if (first) first.focus(); }, 30);
  }
  function close() { const m = document.getElementById('tf-inbox-modal'); if (m) m.classList.add('hidden'); }
  function refreshBadges(items) {
    const n = (items || collect()).length;
    const b = document.getElementById('sidebar-urgent-badge');
    if (b && b.textContent !== String(n)) b.textContent = String(n);
    if (window.TFShell) TFShell.syncInbox();
    const strip = document.getElementById('tf-inbox-strip');
    if (strip) {
      const c = counts(items || collect());
      strip.hidden = n === 0;
      strip.innerHTML = `<span class="tf-inbox-strip-dot" aria-hidden="true"></span><b>${n} ${n === 1 ? 'thing' : 'things'} to do</b>
        <span class="tf-hint">${Object.entries(GROUPS).filter(([g]) => c[g]).map(([g, x]) => `${c[g]} ${x.label.toLowerCase()}`).join(' · ')}</span>
        <button type="button" class="tf-btn tf-btn--sm tf-btn--primary" onclick="TFInbox.open()">Open Inbox</button>`;
    }
  }

  window.TFInbox = {
    collect, open, close, refreshBadges,
    setFilter(f) { filter = f; render(); },
    run(i) { const it = actions[i]; if (!it) return; close(); setTimeout(() => it.run && it.run(), 0); },
    remind(i) { const it = actions[i]; if (it && it.remind && window.TFPartnerUI) TFPartnerUI.remind(it.remind.id); }
  };

  /* ======================================================================= Payment matching */
  function partyContact() {
    const name = (document.getElementById('pay-input-party') || {}).value || '';
    const n = name.trim().toLowerCase();
    if (!n) return null;
    const list = app().data.contacts || [];
    return list.find(c => String(c.name || '').toLowerCase() === n) || list.find(c => n.length > 3 && String(c.name || '').toLowerCase().includes(n));
  }
  function balanceOf(c, o) {
    if (c.role === 'manufacturer') return Math.max(0, num(o.manufacturerTotalCost) - num(o.manufacturerAdvancePaid));
    if (c.role === 'packaging') return Math.max(0, num(o.packagingCost) - num(o.packagingAdvancePaid));
    if (c.role === 'retailer') return Math.max(0, num(o.customerBalanceDue));
    return 0;
  }
  function paymentSuggest() {
    const box = ensurePayBox(); if (!box) return;
    const c = partyContact();
    const raw = (document.getElementById('pay-input-amount') || {}).value || '';
    const amount = typeof app().parseAmount === 'function' ? app().parseAmount(raw) : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
    const sel = document.getElementById('pay-select-order');
    if (!c || !(amount > 0) || !ROLE_KEY[c.role]) { box.hidden = true; return; }
    const open = (app().data.orders || []).filter(o => o[ROLE_KEY[c.role]] === c.id && o.status !== 'settled').map(o => ({ o, bal: balanceOf(c, o) })).filter(x => x.bal > 0);
    if (!open.length) { box.hidden = true; return; }
    const exact = open.filter(x => Math.abs(x.bal - amount) <= 1);
    let picks, note;
    if (exact.length) { picks = exact; note = 'clears the balance of'; }
    else if (open.length === 1 && amount < open[0].bal) { picks = open; note = 'is a part payment for'; }
    else { picks = open.sort((x, y) => Math.abs(x.bal - amount) - Math.abs(y.bal - amount)).slice(0, 3); note = 'may be for'; }
    const current = sel ? sel.value : '';
    box.hidden = false;
    box.innerHTML = `<span class="tf-label">Suggested order</span><span class="tf-hint">${esc(inr(amount))} from ${esc(c.name)} ${note}</span>
      <div class="tf-pay-suggest-list">${picks.map(x => { const inv = x.o.invoiceNumber || x.o.id; const on = current === inv;
        return `<button type="button" class="tf-btn tf-btn--sm ${on ? 'tf-btn--primary' : ''}" onclick="TFSmart.linkOrder(${jsArg(inv)})">${on ? '✓ Linked: ' : 'Link '}${esc(inv)} · balance ${esc(inr(x.bal))}</button>`; }).join('')}</div>`;
  }
  function ensurePayBox() {
    const amt = document.getElementById('pay-input-amount'); if (!amt) return null;
    let box = document.getElementById('tf-pay-suggest');
    if (!box) {
      box = document.createElement('div'); box.id = 'tf-pay-suggest'; box.className = 'tf-pay-suggest'; box.hidden = true; box.setAttribute('aria-live', 'polite');
      const host = amt.closest('div') || amt.parentElement;
      host.parentElement.insertBefore(box, host.nextSibling);
    }
    return box;
  }
  document.addEventListener('input', e => { if (e.target && /^(pay-input-amount|pay-input-party)$/.test(e.target.id)) paymentSuggest(); });
  document.addEventListener('change', e => { if (e.target && /^(pay-select-party|pay-select-order|pay-input-party)$/.test(e.target.id)) setTimeout(paymentSuggest, 0); });

  /* ======================================================================= Ctrl+K actions */
  let commands = [];
  function parseAmountText(t) { const s = String(t).replace(/[₹,\s]/g, '').toLowerCase(); const k = s.endsWith('k'); const n = parseFloat(k ? s.slice(0, -1) : s); return Number.isFinite(n) ? n * (k ? 1000 : 1) : NaN; }
  function findContacts(q) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return (app().data.contacts || []).filter(c => !c.isDeleted && words.every(w => String(c.name || '').toLowerCase().includes(w))).slice(0, 3);
  }
  function buildCommands(query) {
    const q = String(query || '').trim();
    const out = [];
    let m;
    if ((m = /^(pay(?:ment)?|received?|got|paid)\s+(.+?)\s+(₹?\s*[\d,]+(?:\.\d+)?k?)$/i.exec(q))) {
      const amount = parseAmountText(m[3]);
      if (amount > 0) for (const c of findContacts(m[2])) {
        const direction = /^paid$/i.test(m[1]) || (c.role !== 'retailer' && !/^received?|got$/i.test(m[1])) ? 'paid' : 'received';
        out.push({ icon: 'indian-rupee', title: `Record ${inr(amount)} ${direction === 'paid' ? 'paid to' : 'received from'} ${c.name}`, sub: 'Opens the payment form filled in', run: () => openPayment(c, amount, direction) });
      }
    } else if ((m = /^(?:new\s+)?order\s+(.+)$/i.exec(q))) {
      for (const c of findContacts(m[1]).filter(c => c.role === 'retailer')) out.push({ icon: 'package-plus', title: `New order for ${c.name}`, sub: 'Opens the order form with this buyer', run: () => newOrder(c) });
    } else if ((m = /^(?:open|go|partner)\s+(.+)$/i.exec(q))) {
      for (const c of findContacts(m[1])) out.push({ icon: 'user', title: `Open ${c.name}`, sub: 'Partner page', run: () => window.TFPartnerUI && TFPartnerUI.open(c.id, 'company') });
    } else if ((m = /^remind(?:er)?\s+(.+)$/i.exec(q))) {
      for (const c of findContacts(m[1])) out.push({ icon: 'message-circle', title: `WhatsApp payment reminder to ${c.name}`, sub: 'Lists overdue invoices with your bank and UPI details', run: () => window.TFPartnerUI && TFPartnerUI.remind(c.id) });
    } else if ((m = /^statement\s+(.+)$/i.exec(q))) {
      for (const c of findContacts(m[1])) out.push({ icon: 'file-down', title: `Download statement for ${c.name}`, sub: 'PDF of all orders and payments with running balance', run: () => window.TFPartnerUI && TFPartnerUI.statement(c.id) });
    } else if (/^(inbox|to ?do|todo)$/i.test(q)) {
      out.push({ icon: 'inbox', title: 'Open Inbox', sub: 'Everything that needs you', run: () => TFInbox.open() });
    }
    return out;
  }
  function openPayment(c, amount, direction) {
    const a = app();
    a.openPaymentModal(null, c.name, direction);
    setTimeout(() => {
      const party = document.getElementById('pay-input-party'); if (party && !party.value) { party.value = c.name; party.dispatchEvent(new Event('input', { bubbles: true })); }
      if (typeof a.onPaymentPartySelected === 'function') a.onPaymentPartySelected(c.name);
      const amt = document.getElementById('pay-input-amount');
      if (amt) { amt.value = String(amount); amt.dispatchEvent(new Event('input', { bubbles: true })); }
      paymentSuggest();
    }, 120);
  }
  function newOrder(c) {
    app().openNewOrderModal();
    setTimeout(() => { const s = document.getElementById('new-order-retailer'); if (s) { s.value = c.id; if (s.value !== c.id) { const o = [...s.options].find(x => x.textContent.includes(c.name)); if (o) s.value = o.value; } s.dispatchEvent(new Event('change', { bubbles: true })); } }, 150);
  }
  function hookOmnibox() {
    const a = app();
    if (!a || a.__tfCommandsHooked || typeof a.handleOmniboxInput !== 'function') return;
    a.__tfCommandsHooked = true;
    const original = a.handleOmniboxInput.bind(a);
    a.handleOmniboxInput = function (query = '') {
      original(query);
      commands = buildCommands(query);
      const box = document.getElementById('omnibox-results');
      if (!box || !commands.length) return;
      const html = `<div class="tf-cmd-group"><div class="tf-label" style="padding:4px 6px">Actions</div>${commands.map((c, i) => `
        <button type="button" class="omnibox-result-card tf-cmd" onclick="TFSmart.runCommand(${i})"><span class="tf-icon-tile"><i data-lucide="${c.icon}" class="w-4 h-4"></i></span><span class="tf-cmd-text"><b>${esc(c.title)}</b><span class="tf-hint">${esc(c.sub)}</span></span><span class="tf-hint">Enter</span></button>`).join('')}</div>`;
      // When an action matches, the "no records found" message underneath is not useful.
      [...box.children].forEach(el => { if (/No Direct Records Found/i.test(el.textContent || '')) el.style.display = 'none'; });
      box.insertAdjacentHTML('afterbegin', html);
      if (window.lucide) window.lucide.createIcons();
    };
  }

  /* ======================================================================= wiring */
  function start() {
    const a = app();
    if (!a || !a.data) { setTimeout(start, 200); return; }
    hookOmnibox();
    // Inbox replaces the old urgent / exception / missing-file surfaces.
    const urgentBtn = document.getElementById('sidebar-urgent-btn');
    if (urgentBtn) { urgentBtn.setAttribute('onclick', 'TFInbox.open()'); const label = urgentBtn.querySelector('.truncate'); if (label) label.textContent = 'Inbox'; urgentBtn.title = 'Everything that needs you, in one list'; }
    const inboxTop = document.getElementById('tf-inbox-btn'); if (inboxTop) inboxTop.setAttribute('onclick', 'TFInbox.open()');
    document.body.classList.add('tf-has-inbox');
    const banner = document.getElementById('urgent-action-banner');
    if (banner && !document.getElementById('tf-inbox-strip')) { const s = document.createElement('div'); s.id = 'tf-inbox-strip'; s.className = 'tf-inbox-strip no-print'; s.hidden = true; banner.parentElement.insertBefore(s, banner); }
    for (const fn of ['updateSidebarUI', 'renderAuditNotices', 'renderActiveView']) {
      const orig = a[fn]; if (typeof orig !== 'function' || orig.__tfWrapped) continue;
      a[fn] = function () { const r = orig.apply(this, arguments); try { refreshBadges(); } catch (_) {} return r; };
      a[fn].__tfWrapped = true;
    }
    if (typeof a.fetchAuditData === 'function') Promise.resolve(a.fetchAuditData()).then(() => refreshBadges()).catch(() => refreshBadges());
    else refreshBadges();
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { const m = document.getElementById('tf-inbox-modal'); if (m && !m.classList.contains('hidden')) close(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(start, 0)); else setTimeout(start, 0);

  window.TFSmart = {
    buildCommands, paymentSuggest,
    runCommand(i) { const c = commands[i]; if (!c) return; const a = app(); if (a && a.closeOmniboxModal) a.closeOmniboxModal(); setTimeout(() => c.run(), 0); },
    linkOrder(inv) { const sel = document.getElementById('pay-select-order'); if (!sel) return; sel.value = inv; sel.dispatchEvent(new Event('change', { bubbles: true })); paymentSuggest(); }
  };
})();
