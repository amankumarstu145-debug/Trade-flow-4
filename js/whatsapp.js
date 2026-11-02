/* TradeFlow WhatsApp window.
 * Left: every partner and contact person as a contact list, with Favourites and Recent on top.
 * Search by name, company, city, person or any part of a phone number; a number that is not
 * saved yet can still be messaged. Right: the chosen contact's details and short, clean
 * messages built from the real orders and payments (empty details are left out).
 * Favourites and "last messaged" are stored on the partner record, so they sync like any edit. */
(function () {
  'use strict';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const jsArg = v => esc(JSON.stringify(String(v ?? '')));
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const inr = n => '₹' + Math.round(num(n)).toLocaleString('en-IN');
  const date = d => { if (!d) return ''; const t = new Date(d); return isNaN(t) ? String(d) : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const today = () => new Date().toISOString().slice(0, 10);
  const initials = name => String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const app = () => window.app;

  /* ------------------------------------------------------------------ phone numbers */
  const digits = v => String(v || '').replace(/\D/g, '');
  // Indian numbers are stored many ways (0 98…, +91 98…, 98…); compare and dial on the last 10 digits.
  function phoneKey(v) {
    let d = digits(v);
    if (d.length > 10 && (d.startsWith('91') || d.startsWith('0'))) d = d.slice(-10);
    return d;
  }
  function waNumber(v) {
    const d = phoneKey(v);
    if (!d) return '';
    return d.length === 10 ? '91' + d : d;
  }
  function prettyPhone(v) {
    const d = phoneKey(v);
    if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
    return d ? '+' + d : '';
  }
  const isRealPhone = v => /[1-9]/.test(phoneKey(v)) && phoneKey(v).length >= 8;

  /* ------------------------------------------------------------------ contacts */
  const ROLE = {
    retailer: { label: 'Buyer', plural: 'Buyers', key: 'retailerId' },
    manufacturer: { label: 'Manufacturer', plural: 'Manufacturers', key: 'manufacturerId' },
    transporter: { label: 'Transport', plural: 'Transport', key: 'transporterId' },
    packaging: { label: 'Packaging', plural: 'Packaging', key: 'packagingVendorId' },
    marketeer: { label: 'Marketeer', plural: 'Marketeers', key: 'marketeerId' }
  };
  const roleOf = c => ROLE[c && c.role] || { label: 'Contact', plural: 'Others', key: '' };
  function peopleOf(c) {
    if (window.TFPartnerUI && typeof TFPartnerUI.peopleOf === 'function') return TFPartnerUI.peopleOf(c);
    return [{ id: 'p1', name: c.contactPerson || '', role: c.designation || '', phone: c.phone || '', whatsapp: c.whatsappPhone || '' }];
  }
  function primaryOf(c) {
    const list = peopleOf(c);
    return list.find(p => p.id === c.primaryPersonId) || list[0] || {};
  }
  const personPhone = (c, p) => (p && (p.whatsapp || p.phone)) || c.whatsappPhone || c.phone || '';
  const contacts = () => ((app() && app().data.contacts) || []).filter(c => c && !c.isDeleted);

  // One searchable entry per contact person (a company with two people gives two ways to find it).
  function searchIndex(c) {
    const people = peopleOf(c);
    return {
      text: [c.name, c.tradeName, c.city, c.state, c.dealsIn, roleOf(c).label, ...people.map(p => p.name + ' ' + (p.role || ''))].filter(Boolean).join(' ').toLowerCase(),
      phones: [c.phone, c.whatsappPhone, c.altPhone, ...people.flatMap(p => [p.phone, p.whatsapp])].map(phoneKey).filter(d => d.length >= 3)
    };
  }
  // Returns contacts that match, with the person whose name or number matched (if any).
  function search(query, list = contacts()) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return list.map(c => ({ c, person: null }));
    const qd = digits(q);
    const words = q.split(/\s+/).filter(Boolean);
    const out = [];
    for (const c of list) {
      const idx = searchIndex(c);
      const byText = words.every(w => idx.text.includes(w));
      const byPhone = qd.length >= 3 && qd.length === q.replace(/[\s+()-]/g, '').length && idx.phones.some(p => p.includes(phoneKey(qd) || qd));
      if (!byText && !byPhone) continue;
      let person = null;
      for (const p of peopleOf(c)) {
        if (byPhone && [p.phone, p.whatsapp].some(v => phoneKey(v).includes(phoneKey(qd) || qd))) { person = p; break; }
        if (!byPhone && p.name && words.every(w => String(p.name).toLowerCase().includes(w))) { person = p; break; }
      }
      out.push({ c, person, exact: byPhone && idx.phones.includes(phoneKey(qd)) });
    }
    return out;
  }

  /* ------------------------------------------------------------------ orders and money */
  const isOpen = o => o && !o.isDeleted && o.status !== 'settled' && o.status !== 'cancelled';
  function ordersOf(c) {
    const key = roleOf(c).key;
    if (!key) return [];
    return ((app() && app().data.orders) || []).filter(o => !o.isDeleted && o[key] === c.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
  function paymentsOf(c, direction) {
    const name = String(c.name || '').trim().toLowerCase();
    return ((app() && app().data.payments) || []).filter(p => !p.isDeleted && p.direction === direction && ((p.partyId && p.partyId === c.id) || String(p.partyName || '').trim().toLowerCase() === name))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
  function money(c, o) {
    switch (c.role) {
      case 'manufacturer': return { total: num(o.manufacturerTotalCost), paid: num(o.manufacturerAdvancePaid) };
      case 'packaging': return { total: num(o.packagingCost), paid: num(o.packagingAdvancePaid) };
      case 'transporter': return { total: num(o.totalTransportCost), paid: 0 };
      case 'marketeer': return { total: num(o.marketeerCommissionAmount), paid: 0 };
      default: { const t = num(o.totalInvoiceAmount); return { total: t, paid: Math.max(0, t - Math.max(0, num(o.customerBalanceDue))) }; }
    }
  }
  function facts(c) {
    const orders = ordersOf(c), open = orders.filter(isOpen);
    let due = 0, label = 'Balance due';
    if (window.TFPartnerUI && typeof TFPartnerUI.summary === 'function') {
      try { const s = TFPartnerUI.summary(app(), c); due = s.big; label = s.bigLabel; } catch (_) { /* fall back below */ }
    } else if (c.role === 'retailer') due = orders.reduce((t, o) => t + Math.max(0, num(o.customerBalanceDue)), 0);
    return { orders, open, due, dueLabel: label, last: orders[0] };
  }
  const itemsOf = o => (o.items || []).map(i => `${i.name || i.shortName || 'Item'}${i.variant ? ' ' + String(i.variant).replace(/ PET Jar$/, '') : ''} × ${num(i.cases)} cases`);
  const totalCases = o => (o.items || []).reduce((t, i) => t + num(i.cases), 0);

  /* ------------------------------------------------------------------ messages */
  // Short and clean: a greeting, the facts that matter (blank details are skipped), one clear ask, sign-off.
  function profile() { return (app() && app().data.businessProfile) || {}; }
  function brand() { const p = profile(); return p.brandName || p.tradeName || p.companyName || p.legalName || 'TradeFlow'; }
  function signOff() { const p = profile(); return ['', 'Regards,', [brand(), p.phone && isRealPhone(p.phone) ? prettyPhone(p.phone) : ''].filter(Boolean).join(' · ')]; }
  function bankLines() {
    const p = profile(), b = p.bankDetails || {};
    const bank = p.bankName || b.bankName, acc = p.accountNumber || b.accountNumber, ifsc = p.ifsc || b.ifsc, upi = p.upiId || b.upiId;
    const name = b.beneficiaryName || p.legalName || p.companyName;
    const lines = [];
    if (bank || acc) lines.push(`Bank: ${[bank, acc && 'A/c ' + acc, ifsc && 'IFSC ' + ifsc].filter(Boolean).join(' · ')}`);
    if (bank && name) lines.push(`Name: ${name}`);
    if (upi) lines.push(`UPI: ${upi}`);
    return lines;
  }
  function itemLines(o, max = 4) {
    const list = itemsOf(o);
    const lines = list.slice(0, max).map(x => '• ' + x);
    if (list.length > max) lines.push(`• +${list.length - max} more`);
    return lines;
  }
  const ref = o => o.invoiceNumber || o.id;
  const greet = (c, person) => `Hello ${(person && person.name) || c.contactPerson || c.name},`;
  const join = lines => lines.filter(l => l !== null && l !== undefined && l !== false).join('\n').replace(/\n{3,}/g, '\n\n').trim();

  // Which messages fit each partner type. `needsOrder` shows the order picker.
  const TEMPLATES = {
    retailer: [['confirm', 'Order confirmed', true], ['invoice', 'Invoice', true], ['dispatch', 'Dispatched', true], ['reminder', 'Payment reminder', false], ['thanks', 'Payment received', false], ['summary', 'Account summary', false], ['bank', 'Bank details', false]],
    manufacturer: [['po', 'Production order', true], ['status', 'Status check', true], ['paid', 'Payment sent', false], ['summary', 'Account summary', false]],
    packaging: [['po', 'Packaging order', true], ['status', 'Status check', true], ['paid', 'Payment sent', false], ['summary', 'Account summary', false]],
    transporter: [['pickup', 'Pickup request', true], ['lr', 'Ask for LR', true], ['paid', 'Payment sent', false], ['summary', 'Account summary', false]],
    marketeer: [['neworder', 'Order update', true], ['summary', 'Commission summary', false], ['paid', 'Payment sent', false]],
    number: [['hello', 'Introduction', false], ['bank', 'Bank details', false]]
  };
  const templatesFor = c => [...(TEMPLATES[c ? c.role : 'number'] || TEMPLATES.number), ['custom', 'Blank', false]];

  function compose(kind, c, person, o) {
    const p = profile();
    const name = (c && c.name) || '';
    const hello = c ? greet(c, person) : 'Hello,';
    const sum = c ? facts(c) : null;
    switch (kind) {
      case 'confirm': if (!o) break; {
        const bal = Math.max(0, num(o.customerBalanceDue)), adv = num(o.customerAdvanceReceived);
        return join([hello, '', `Thank you for your order. It is confirmed.`, '', `*Order ${ref(o)}* · ${date(o.date)}`, ...itemLines(o), '',
          `Amount: ${inr(o.totalInvoiceAmount)} (incl. GST)`, adv > 0 ? `Advance received: ${inr(adv)}` : null,
          bal > 0 ? `Balance: ${inr(bal)}${o.dueDate ? ' · due ' + date(o.dueDate) : ''}` : null, ...signOff()]);
      }
      case 'invoice': if (!o) break; {
        const bal = Math.max(0, num(o.customerBalanceDue));
        return join([hello, '', `Please find the invoice details for your order.`, '', `*Invoice ${ref(o)}* · ${date(o.date)}`,
          `Amount: ${inr(o.totalInvoiceAmount)} (incl. GST)`, bal > 0 ? `*Balance due: ${inr(bal)}*${o.dueDate ? ' · by ' + date(o.dueDate) : ''}` : 'Fully paid. Thank you.',
          ...(bal > 0 && bankLines().length ? ['', ...bankLines()] : []), ...signOff()]);
      }
      case 'dispatch': if (!o) break;
        return join([hello, '', `Your order *${ref(o)}* has been dispatched.`, '', ...itemLines(o),
          o.transporterName ? `Transporter: ${o.transporterName}` : null, o.lrNumber ? `LR no.: ${o.lrNumber}` : null, o.vehicleNumber ? `Vehicle: ${o.vehicleNumber}` : null,
          '', 'Please confirm once the goods are received.', ...signOff()]);
      case 'reminder': {
        if (!c) break;
        const open = sum.orders.filter(x => num(x.customerBalanceDue) > 0 && x.status !== 'settled');
        if (!open.length) return join([hello, '', 'There is no pending balance on your account. Thank you for the timely payments.', ...signOff()]);
        const overdue = open.filter(x => x.dueDate && x.dueDate < today());
        const total = open.reduce((t, x) => t + num(x.customerBalanceDue), 0);
        return join([hello, '', overdue.length ? 'A gentle reminder about the pending payment:' : 'A reminder about the open invoices:', '',
          ...open.slice(0, 6).map(x => `• ${ref(x)} · ${date(x.date)} · ${inr(x.customerBalanceDue)}${x.dueDate ? (x.dueDate < today() ? ' (overdue since ' + date(x.dueDate) + ')' : ' (due ' + date(x.dueDate) + ')') : ''}`),
          open.length > 6 ? `• +${open.length - 6} more` : null, '', `*Total due: ${inr(total)}*`,
          ...(bankLines().length ? ['', ...bankLines()] : []), '', 'Please share the UTR once paid.', ...signOff()]);
      }
      case 'thanks': {
        if (!c) break;
        const pay = paymentsOf(c, 'received')[0];
        if (!pay) return join([hello, '', 'No payment has been recorded from you yet.', ...signOff()]);
        const due = sum.orders.reduce((t, x) => t + Math.max(0, num(x.customerBalanceDue)), 0);
        return join([hello, '', `We have received your payment. Thank you.`, '', `Amount: *${inr(pay.amount)}* · ${date(pay.date)}`, [pay.mode, pay.utr && 'UTR ' + pay.utr].filter(Boolean).join(' · ') || null,
          pay.orderRef ? `Against: ${ref(((app().data.orders) || []).find(x => x.id === pay.orderRef) || { id: pay.orderRef })}` : null,
          due > 0 ? `Balance now: ${inr(due)}` : 'Your account is fully settled.', ...signOff()]);
      }
      case 'summary': {
        if (!c) break;
        const rows = sum.orders.map(x => ({ o: x, m: money(c, x) })).filter(r => r.m.total);
        const total = rows.reduce((t, r) => t + r.m.total, 0);
        const paidDir = c.role === 'retailer' ? 'received' : 'paid';
        const paid = c.role === 'retailer' ? rows.reduce((t, r) => t + r.m.paid, 0) : (typeof app().paymentsPaidToContact === 'function' && (c.role === 'transporter' || c.role === 'marketeer') ? num(app().paymentsPaidToContact(c)) : rows.reduce((t, r) => t + r.m.paid, 0));
        const bal = Math.max(0, total - paid);
        const word = { retailer: ['Billed', 'Received', 'Balance due'], manufacturer: ['Total cost', 'Paid', 'Payable'], packaging: ['Total cost', 'Paid', 'Payable'], transporter: ['Freight', 'Paid', 'Payable'], marketeer: ['Commission earned', 'Paid', 'Commission due'] }[c.role] || ['Total', 'Paid', 'Balance'];
        return join([hello, '', `Account summary with ${brand()} as on ${date(today())}:`, '', `Orders: ${rows.length}`, `${word[0]}: ${inr(total)}`, `${word[1]}: ${inr(paid)}`, `*${word[2]}: ${inr(bal)}*`,
          paidDir === 'received' && bal > 0 && bankLines().length ? '' : null, ...(paidDir === 'received' && bal > 0 ? bankLines() : []),
          '', 'Please let me know if anything does not match your records.', ...signOff()]);
      }
      case 'bank':
        return join([hello, '', `Payment details for ${p.legalName || p.companyName || brand()}:`, '', ...(bankLines().length ? bankLines() : ['(Add bank details in Settings > Business profile)']),
          p.gstin ? `GSTIN: ${p.gstin}` : null, '', 'Please share the UTR after payment.', ...signOff()]);
      case 'po': if (!o) break; {
        const m = money(c, o), what = c.role === 'packaging' ? 'packaging' : 'production';
        return join([hello, '', `New ${what} order from ${brand()}:`, '', `*Order ${ref(o)}* · ${date(o.date)}`, ...itemLines(o, 6), totalCases(o) ? `Total: ${totalCases(o)} cases` : null, '',
          m.total ? `Agreed cost: ${inr(m.total)}` : null, m.paid ? `Advance paid: ${inr(m.paid)}` : null, '', 'Please confirm the order and the ready date.', ...signOff()]);
      }
      case 'status': if (!o) break;
        return join([hello, '', `Please share the current status of order *${ref(o)}*:`, ...itemLines(o), '', 'Expected ready date?', ...signOff()]);
      case 'paid': {
        if (!c) break;
        const pay = paymentsOf(c, 'paid')[0];
        if (!pay) return join([hello, '', 'No payment to you has been recorded yet.', ...signOff()]);
        return join([hello, '', 'We have sent you a payment.', '', `Amount: *${inr(pay.amount)}* · ${date(pay.date)}`, [pay.mode, pay.utr && 'UTR ' + pay.utr].filter(Boolean).join(' · ') || null,
          pay.orderRef ? `For order: ${ref(((app().data.orders) || []).find(x => x.id === pay.orderRef) || { id: pay.orderRef })}` : null, '', 'Please confirm receipt.', ...signOff()]);
      }
      case 'pickup': if (!o) break; {
        const from = ((app().data.contacts) || []).find(x => x.id === o.manufacturerId);
        const to = o.shippingAddress || o.billingAddress || '';
        return join([hello, '', `Please arrange pickup for order *${ref(o)}*.`, '', totalCases(o) ? `Load: ${totalCases(o)} cases` : null,
          from ? `Pickup: ${from.name}${from.city ? ', ' + from.city : ''}` : null, `Deliver to: ${o.retailerName || ''}${to ? ' – ' + to : ''}`,
          num(o.totalTransportCost) ? `Agreed freight: ${inr(o.totalTransportCost)}` : null, '', 'Please share the vehicle number and LR once loaded.', ...signOff()]);
      }
      case 'lr': if (!o) break;
        return join([hello, '', `Please share the LR copy and vehicle number for order *${ref(o)}*${o.retailerName ? ' (to ' + o.retailerName + ')' : ''}.`, ...signOff()]);
      case 'neworder': if (!o) break;
        return join([hello, '', `Update on your buyer's order:`, '', `*Order ${ref(o)}* · ${date(o.date)}`, o.retailerName ? `Buyer: ${o.retailerName}` : null,
          `Order value: ${inr(o.totalInvoiceAmount)}`, num(o.marketeerCommissionAmount) ? `Your commission: ${inr(o.marketeerCommissionAmount)}` : null, ...signOff()]);
      case 'hello':
        return join(['Hello,', '', `This is ${brand()}${p.city ? ', ' + p.city : ''}.`, '', ...signOff()]);
      default: break;
    }
    return join([hello, '', '', ...signOff()]);
  }

  /* ------------------------------------------------------------------ state */
  const state = { open: false, query: '', filter: 'all', contactId: null, personId: null, number: '', kind: null, orderId: null, text: '', edited: false, searchTimer: null };
  const byId = id => contacts().find(c => c.id === id);
  const selected = () => (state.contactId ? byId(state.contactId) : null);
  const selectedPerson = c => (c ? peopleOf(c).find(p => p.id === state.personId) || primaryOf(c) : null);

  function sortContacts(list) {
    return list.sort((a, b) => (b.c.waFavorite ? 1 : 0) - (a.c.waFavorite ? 1 : 0) || String(b.c.waLastAt || '').localeCompare(String(a.c.waLastAt || '')) || String(a.c.name || '').localeCompare(String(b.c.name || '')));
  }

  /* ------------------------------------------------------------------ rendering */
  const ICONS = { search: 'search', star: 'star', phone: 'phone', copy: 'copy', send: 'send', close: 'x', user: 'user', back: 'arrow-left', open: 'external-link', plus: 'user-plus', chat: 'message-circle' };
  const icon = (name, cls = 'w-4 h-4') => `<i data-lucide="${ICONS[name] || name}" class="${cls}"></i>`;

  function shell() {
    let el = document.getElementById('tf-wa');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tf-wa';
    el.className = 'wa-overlay';
    el.hidden = true;
    el.innerHTML = `
      <div class="wa-window" role="dialog" aria-modal="true" aria-labelledby="wa-title">
        <header class="wa-head">
          <span class="wa-head-icon">${icon('chat', 'w-5 h-5')}</span>
          <div class="wa-head-text"><h2 id="wa-title">WhatsApp</h2><p>Find a contact, pick a message, send.</p></div>
          <button type="button" class="tf-btn tf-btn--ghost tf-btn--sm wa-close" onclick="TFWhatsApp.close()" aria-label="Close">${icon('close', 'w-5 h-5')}</button>
        </header>
        <div class="wa-body">
          <aside class="wa-side">
            <label class="wa-search">${icon('search')}<span class="sr-only">Search contacts</span>
              <input id="wa-q" type="search" autocomplete="off" placeholder="Name, company, city or phone number" oninput="TFWhatsApp.setQuery(this.value)" onkeydown="TFWhatsApp.searchKey(event)">
            </label>
            <div class="wa-filters" id="wa-filters" role="tablist" aria-label="Contact groups"></div>
            <div class="wa-list" id="wa-list" role="listbox" aria-label="Contacts"></div>
          </aside>
          <section class="wa-main" id="wa-main" aria-live="polite"></section>
        </div>
      </div>`;
    el.addEventListener('mousedown', e => { if (e.target === el) close(); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    document.body.appendChild(el);
    return el;
  }

  function filters() {
    const all = contacts();
    const groups = [['all', 'All', all.length], ['fav', 'Favourites', all.filter(c => c.waFavorite).length]];
    for (const [role, r] of Object.entries(ROLE)) { const n = all.filter(c => c.role === role).length; if (n) groups.push([role, r.plural, n]); }
    document.getElementById('wa-filters').innerHTML = groups.map(([id, label, n]) =>
      `<button type="button" role="tab" aria-selected="${state.filter === id}" class="wa-filter${state.filter === id ? ' is-on' : ''}" onclick="TFWhatsApp.setFilter(${jsArg(id)})">${id === 'fav' ? icon('star', 'w-3.5 h-3.5') : ''}${esc(label)} <span>${n}</span></button>`).join('');
  }

  function row(c, person, active) {
    const p = person || primaryOf(c);
    const phone = personPhone(c, p);
    const sub = [roleOf(c).label, person && person.name ? person.name : c.city, isRealPhone(phone) ? prettyPhone(phone) : 'No number'].filter(Boolean).join(' · ');
    return `<div class="wa-row${active ? ' is-on' : ''}" role="option" aria-selected="${active}" tabindex="0" data-id="${esc(c.id)}"
        onclick="TFWhatsApp.select(${jsArg(c.id)}, ${jsArg(person ? person.id : '')})" onkeydown="if(event.key==='Enter'){TFWhatsApp.select(${jsArg(c.id)}, ${jsArg(person ? person.id : '')})}">
      <span class="wa-avatar wa-avatar--${esc(c.role || 'x')}">${c.logo ? `<img src="${esc(c.logo)}" alt="">` : esc(initials(c.name))}</span>
      <span class="wa-row-text"><b>${esc(c.name)}</b><small>${esc(sub)}</small></span>
      <button type="button" class="wa-star${c.waFavorite ? ' is-on' : ''}" aria-pressed="${!!c.waFavorite}" aria-label="${c.waFavorite ? 'Remove from' : 'Add to'} favourites" title="${c.waFavorite ? 'Remove from favourites' : 'Add to favourites'}"
        onclick="event.stopPropagation(); TFWhatsApp.toggleFavorite(${jsArg(c.id)})">${icon('star', 'w-4 h-4')}</button>
    </div>`;
  }

  function list() {
    const box = document.getElementById('wa-list');
    if (!box) return;
    let pool = contacts();
    if (state.filter === 'fav') pool = pool.filter(c => c.waFavorite);
    else if (state.filter !== 'all') pool = pool.filter(c => c.role === state.filter);
    const hits = sortContacts(search(state.query, pool));
    const qd = digits(state.query);
    const typedNumber = qd.length >= 10 && qd.length === state.query.replace(/[\s+()-]/g, '').length;
    let html = '';
    if (typedNumber && !hits.some(h => h.exact)) {
      html += `<div class="wa-group">Not in your contacts</div>
        <div class="wa-row wa-row--new${state.number === phoneKey(qd) ? ' is-on' : ''}" role="option" tabindex="0" onclick="TFWhatsApp.selectNumber(${jsArg(qd)})" onkeydown="if(event.key==='Enter'){TFWhatsApp.selectNumber(${jsArg(qd)})}">
          <span class="wa-avatar">${icon('phone')}</span><span class="wa-row-text"><b>${esc(prettyPhone(qd))}</b><small>Message this number</small></span></div>`;
    }
    if (!state.query && state.filter === 'all') {
      const fav = hits.filter(h => h.c.waFavorite), recent = hits.filter(h => !h.c.waFavorite && h.c.waLastAt).slice(0, 5);
      const shown = new Set([...fav, ...recent].map(h => h.c.id));
      const rest = hits.filter(h => !shown.has(h.c.id)).sort((a, b) => String(a.c.name || '').localeCompare(String(b.c.name || '')));
      if (fav.length) html += `<div class="wa-group">${icon('star', 'w-3.5 h-3.5')} Favourites</div>` + fav.map(h => row(h.c, null, h.c.id === state.contactId)).join('');
      if (recent.length) html += `<div class="wa-group">Recent</div>` + recent.map(h => row(h.c, null, h.c.id === state.contactId)).join('');
      if (!fav.length) html += `<div class="wa-tip">Tap the ${icon('star', 'w-3.5 h-3.5')} on a contact to keep it at the top.</div>`;
      html += `<div class="wa-group">All contacts</div>` + rest.map(h => row(h.c, null, h.c.id === state.contactId)).join('');
    } else {
      if (hits.length) html += (state.query ? `<div class="wa-group">${hits.length} found</div>` : '') + hits.map(h => row(h.c, h.person, h.c.id === state.contactId)).join('');
      else if (!typedNumber) html += `<div class="wa-empty">${state.filter === 'fav' && !state.query ? 'No favourites yet. Tap the star on any contact.' : 'No contact matches. Type a full phone number to message someone new.'}</div>`;
    }
    box.innerHTML = html;
    drawIcons();
  }

  function contactCard(c) {
    const p = selectedPerson(c);
    const phone = personPhone(c, p);
    const f = facts(c);
    const people = peopleOf(c).filter(x => x.name || x.phone || x.whatsapp);
    const tiles = [
      [f.dueLabel, inr(f.due), f.due > 0 && c.role === 'retailer' ? 'is-due' : ''],
      ['Open orders', `${f.open.length} of ${f.orders.length}`, ''],
      ['Last order', f.last ? date(f.last.date) : '—', '']
    ];
    return `
      <div class="wa-card">
        <div class="wa-card-top">
          <button type="button" class="tf-btn tf-btn--ghost tf-btn--sm wa-back" onclick="TFWhatsApp.back()" aria-label="Back to contacts">${icon('back')}</button>
          <span class="wa-avatar wa-avatar--lg wa-avatar--${esc(c.role || 'x')}">${c.logo ? `<img src="${esc(c.logo)}" alt="">` : esc(initials(c.name))}</span>
          <div class="wa-card-name"><h3>${esc(c.name)}</h3><p>${esc([roleOf(c).label, c.city, c.dealsIn].filter(Boolean).join(' · '))}</p></div>
          <button type="button" class="wa-star wa-star--lg${c.waFavorite ? ' is-on' : ''}" aria-pressed="${!!c.waFavorite}" title="${c.waFavorite ? 'Remove from favourites' : 'Add to favourites'}" aria-label="Favourite" onclick="TFWhatsApp.toggleFavorite(${jsArg(c.id)})">${icon('star', 'w-5 h-5')}</button>
        </div>
        ${people.length > 1 ? `<div class="wa-people" role="radiogroup" aria-label="Send to">${people.map(x => `<button type="button" role="radio" aria-checked="${x.id === (p && p.id)}" class="wa-person${x.id === (p && p.id) ? ' is-on' : ''}" onclick="TFWhatsApp.setPerson(${jsArg(x.id)})">${esc(x.name || 'Contact')}${x.role ? ` <small>${esc(x.role)}</small>` : ''}</button>`).join('')}</div>` : ''}
        <div class="wa-phone">
          ${icon('phone')}<span class="wa-phone-num">${isRealPhone(phone) ? esc(prettyPhone(phone)) : 'No phone number saved'}</span>
          ${p && p.name ? `<span class="wa-phone-who">${esc(p.name)}${p.role ? ', ' + esc(p.role) : ''}</span>` : ''}
          <span class="wa-phone-actions">
            ${isRealPhone(phone) ? `<button type="button" class="tf-btn tf-btn--sm" onclick="TFWhatsApp.copy(${jsArg(prettyPhone(phone))}, 'Number copied')">${icon('copy')}Copy</button><a class="tf-btn tf-btn--sm" href="tel:+${esc(waNumber(phone))}">${icon('phone')}Call</a>` : ''}
            <button type="button" class="tf-btn tf-btn--sm" onclick="TFWhatsApp.openPartner(${jsArg(c.id)})">${icon('open')}Partner page</button>
          </span>
        </div>
        <div class="wa-facts">${tiles.map(([l, v, cls]) => `<div class="wa-fact ${cls}"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join('')}</div>
      </div>`;
  }

  function numberCard() {
    return `
      <div class="wa-card">
        <div class="wa-card-top">
          <button type="button" class="tf-btn tf-btn--ghost tf-btn--sm wa-back" onclick="TFWhatsApp.back()" aria-label="Back to contacts">${icon('back')}</button>
          <span class="wa-avatar wa-avatar--lg">${icon('phone', 'w-5 h-5')}</span>
          <div class="wa-card-name"><h3>${esc(prettyPhone(state.number))}</h3><p>Not in your contacts</p></div>
        </div>
        <div class="wa-phone">
          <span class="wa-phone-actions">
            <button type="button" class="tf-btn tf-btn--sm" onclick="TFWhatsApp.copy(${jsArg(prettyPhone(state.number))}, 'Number copied')">${icon('copy')}Copy</button>
            <a class="tf-btn tf-btn--sm" href="tel:+${esc(waNumber(state.number))}">${icon('phone')}Call</a>
            <button type="button" class="tf-btn tf-btn--sm" onclick="TFWhatsApp.saveNumber()">${icon('plus')}Save as partner</button>
          </span>
        </div>
      </div>`;
  }

  // Picks a message type that fits this contact, and the order it is about (latest open one first).
  function prepare(c) {
    const kinds = templatesFor(c);
    if (!kinds.some(k => k[0] === state.kind)) state.kind = kinds[0][0];
    const orders = c ? ordersOf(c) : [];
    if (!orders.some(o => o.id === state.orderId)) state.orderId = (orders.find(isOpen) || orders[0] || {}).id || null;
  }
  function composer(c) {
    const kinds = templatesFor(c);
    const needsOrder = (kinds.find(k => k[0] === state.kind) || [])[2];
    const orders = c ? ordersOf(c) : [];
    const phone = c ? personPhone(c, selectedPerson(c)) : state.number;
    const canSend = isRealPhone(phone);
    return `
      <div class="wa-compose">
        <div class="wa-compose-head"><h4>Message</h4>
          ${needsOrder ? (orders.length ? `<label class="wa-order"><span>Order</span><select onchange="TFWhatsApp.setOrder(this.value)">${orders.map(o => `<option value="${esc(o.id)}"${o.id === state.orderId ? ' selected' : ''}>${esc(ref(o))} · ${esc(date(o.date))} · ${esc(inr(money(c, o).total || o.totalInvoiceAmount))}${isOpen(o) ? '' : ' · done'}</option>`).join('')}</select></label>` : '<span class="wa-hint">No orders with this partner yet</span>') : ''}
        </div>
        <div class="wa-kinds" role="tablist" aria-label="Message type">${kinds.map(([k, label]) => `<button type="button" role="tab" aria-selected="${state.kind === k}" class="wa-kind${state.kind === k ? ' is-on' : ''}" onclick="TFWhatsApp.setKind(${jsArg(k)})">${esc(label)}</button>`).join('')}</div>
        <textarea id="wa-text" class="wa-text" spellcheck="true" aria-label="Message text" oninput="TFWhatsApp.edit(this.value)">${esc(state.text)}</textarea>
        <div class="wa-foot">
          <span class="wa-hint" id="wa-count">${state.text.length} characters${state.edited ? ' · edited' : ''}</span>
          <button type="button" id="wa-undo" class="tf-btn tf-btn--ghost tf-btn--sm" onclick="TFWhatsApp.resetText()" ${state.edited ? '' : 'hidden'}>Undo my edits</button>
          <button type="button" class="tf-btn tf-btn--sm" onclick="TFWhatsApp.copy(document.getElementById('wa-text').value, 'Message copied')">${icon('copy')}Copy</button>
          <button type="button" class="tf-btn tf-btn--primary wa-send" onclick="TFWhatsApp.send()" ${canSend ? '' : 'disabled title="Add a phone number first"'}>${icon('send')}Send on WhatsApp</button>
        </div>
      </div>`;
  }

  function main() {
    const box = document.getElementById('wa-main');
    if (!box) return;
    const c = selected();
    document.getElementById('tf-wa').classList.toggle('has-pick', !!(c || state.number));
    if (!c && !state.number) {
      box.innerHTML = `<div class="wa-start">${icon('chat', 'w-8 h-8')}<h3>Who do you want to message?</h3><p>Pick a contact on the left, or type a name or phone number in the search.</p></div>`;
      return;
    }
    prepare(c);
    if (!state.edited) state.text = compose(state.kind, c, selectedPerson(c), orderById(state.orderId));
    box.innerHTML = (c ? contactCard(c) : numberCard()) + composer(c);
    drawIcons();
  }
  const orderById = id => ((app() && app().data.orders) || []).find(o => o.id === id) || null;
  function drawIcons() { if (window.lucide && typeof lucide.createIcons === 'function') { try { lucide.createIcons(); } catch (_) { /* icons are decoration */ } } }
  function render() { filters(); list(); main(); drawIcons(); }

  /* ------------------------------------------------------------------ actions */
  function open(opts = {}) {
    const el = shell();
    state.open = true;
    state.edited = false;
    if (opts.contactId && byId(opts.contactId)) { state.contactId = opts.contactId; state.personId = null; state.number = ''; }
    if (opts.orderId) state.orderId = opts.orderId;
    if (opts.kind) state.kind = opts.kind;
    if (!state.contactId && opts.orderId) { const o = orderById(opts.orderId); if (o && o.retailerId && byId(o.retailerId)) state.contactId = o.retailerId; }
    el.hidden = false;
    document.body.classList.add('wa-lock');
    render();
    const q = document.getElementById('wa-q'); if (q) { q.value = state.query; setTimeout(() => q.focus(), 30); }
  }
  function close() {
    const el = document.getElementById('tf-wa');
    if (el) el.hidden = true;
    state.open = false;
    document.body.classList.remove('wa-lock');
  }
  function select(id, personId) {
    if (state.contactId !== id) { state.edited = false; state.kind = null; state.orderId = null; }
    state.contactId = id; state.personId = personId || null; state.number = '';
    list(); main();
  }
  function selectNumber(n) { state.contactId = null; state.personId = null; state.number = phoneKey(n); state.kind = null; state.edited = false; list(); main(); }
  function back() { state.contactId = null; state.number = ''; list(); main(); const q = document.getElementById('wa-q'); if (q) q.focus(); }
  function setQuery(v) {
    state.query = v;
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(list, 80);
  }
  function searchKey(e) {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      list();
      const first = document.querySelector('#wa-list .wa-row');
      if (!first) return;
      e.preventDefault();
      if (e.key === 'Enter') first.click(); else first.focus();
    }
  }
  function setFilter(f) { state.filter = f; filters(); list(); drawIcons(); }
  function setPerson(id) { state.personId = id; state.edited = false; main(); }
  async function setKind(k) {
    if (k === state.kind) return;
    const a = app();
    if (state.edited && a && typeof a.showModalConfirm === 'function') {
      const ok = await a.showModalConfirm({ title: 'Replace your message?', subtitle: 'You changed the text', message: 'Switching the message type replaces the text you edited.', confirmText: 'Replace', cancelText: 'Keep editing' });
      if (!ok) return;
    }
    state.kind = k; state.edited = false; main();
  }
  function setOrder(id) { state.orderId = id; state.edited = false; main(); }
  function edit(v) {
    state.text = v; state.edited = true;
    const n = document.getElementById('wa-count'); if (n) n.textContent = v.length + ' characters · edited';
    const u = document.getElementById('wa-undo'); if (u) u.hidden = false;
  }
  function resetText() { state.edited = false; main(); }

  function save(reason) { const a = app(); if (a && typeof a.saveData === 'function') a.saveData('Operator', reason); }
  function toggleFavorite(id) {
    const c = byId(id);
    if (!c) return;
    c.waFavorite = !c.waFavorite;
    save(c.waFavorite ? 'Added to WhatsApp favourites' : 'Removed from WhatsApp favourites');
    filters(); list(); if (state.contactId === id) main(); drawIcons();
  }
  function copy(text, done) {
    const ok = () => { const a = app(); if (a && a.showToast) a.showToast(done || 'Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, () => fallbackCopy(text, ok));
    else fallbackCopy(text, ok);
  }
  function fallbackCopy(text, ok) {
    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); ok(); } catch (_) { /* nothing else to try */ }
    t.remove();
  }
  function link(phone, text) { return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`; }
  function send() {
    const c = selected();
    const phone = c ? personPhone(c, selectedPerson(c)) : state.number;
    if (!isRealPhone(phone)) return;
    const text = (document.getElementById('wa-text') || {}).value || state.text;
    window.open(link(phone, text), '_blank', 'noopener');
    if (c) { c.waLastAt = new Date().toISOString(); save('WhatsApp sent'); }
  }
  function openPartner(id) { close(); if (window.TFPartnerUI) TFPartnerUI.open(id, 'company'); }
  function saveNumber() {
    const n = prettyPhone(state.number);
    close();
    const a = app(); if (!a) return;
    if (window.TFPartnerUI && TFPartnerUI.quickAdd) { TFPartnerUI.quickAdd(null, { phone: n }); return; }
    a.openEditContactModal(null, 'retailer');
    setTimeout(() => { const f = document.getElementById('edit-contact-phone'); if (f) { f.value = n; f.dispatchEvent(new Event('input', { bubbles: true })); } }, 120);
  }

  window.TFWhatsApp = {
    open, close, select, selectNumber, back, setQuery, searchKey, setFilter, setPerson, setKind, setOrder, edit, resetText,
    toggleFavorite, copy, send, openPartner, saveNumber,
    // used by tests
    phoneKey, waNumber, prettyPhone, search, compose, templatesFor, link
  };
})();
