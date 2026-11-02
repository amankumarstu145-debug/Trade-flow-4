/* TradeFlow partner directory and partner page.
 * One design for every partner type (buyers, manufacturers, transporters, packaging, marketeers):
 * menu-style cards on the directory, and a partner page split into "Company & contact" and a
 * money/work tab. Everything renders from app.data and saves through app.saveData(). */
(function () {
  'use strict';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const jsArg = v => esc(JSON.stringify(String(v ?? '')));
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const today = () => new Date().toISOString().slice(0, 10);
  const inr = n => '₹' + Math.round(num(n)).toLocaleString('en-IN');
  const shortDate = d => { if (!d) return '—'; const t = new Date(d); return isNaN(t) ? String(d) : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
  const longDate = d => { if (!d) return '—'; const t = new Date(d); return isNaN(t) ? String(d) : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const initials = name => String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const splitList = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

  const ICON = {
    place: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 7a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    gst: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M7 9h10 M7 13h6',
    email: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6',
    user: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M4 21a8 8 0 0 1 16 0',
    building: 'M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16 M16 9h2a2 2 0 0 1 2 2v10 M8 7h4 M8 11h4 M8 15h4 M3 21h18',
    bank: 'M3 10h18 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 21h18 M12 3l9 5H3z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
    card: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M6 10h5 M6 14h8',
    terms: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h5',
    tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 6a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
    camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z M12 10a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    copy: 'M11 9h10v12H9V11a2 2 0 0 1 2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
    truck: 'M1 3h15v13H1z M16 8h4l3 3v5h-7z M5.5 16a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z M18.5 16a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
    box: 'M21 8 12 3 3 8v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8'
  };
  const svg = (path, size = 16, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${path}"></path></svg>`;

  /* ------------------------------------------------------------------ partner types */
  const ROLES = {
    retailer: {
      plural: 'Buyers & Retailers', single: 'Buyer / Retailer', prefix: 'RET', badge: 'Deals in', badgeHint: 'e.g. Achar, Hair oil, Medicine',
      orderKey: 'retailerId', workTab: 'Orders & Money', addLabel: '+ Add buyer'
    },
    manufacturer: {
      plural: 'Manufacturers', single: 'Manufacturer', prefix: 'MFG', badge: 'Makes', badgeHint: 'e.g. Achar, Masala',
      orderKey: 'manufacturerId', workTab: 'Production & Payments', addLabel: '+ Add manufacturer'
    },
    packaging: {
      plural: 'Packaging & Labels', single: 'Packaging supplier', prefix: 'PKG', badge: 'Supplies', badgeHint: 'e.g. PET jars, Labels, Cartons',
      orderKey: 'packagingVendorId', workTab: 'Supplies & Payments', addLabel: '+ Add supplier'
    },
    transporter: {
      plural: 'Transport & Logistics', single: 'Transporter', prefix: 'TRN', badge: 'Routes / vehicles', badgeHint: 'e.g. Pune–Nagpur, 10-ton truck',
      orderKey: 'transporterId', workTab: 'Trips & Freight', addLabel: '+ Add transporter'
    },
    marketeer: {
      plural: 'Sales Marketeers', single: 'Sales marketeer', prefix: 'MKT', badge: 'Areas / channels', badgeHint: 'e.g. Nagpur, Modern trade',
      orderKey: 'marketeerId', workTab: 'Commission', addLabel: '+ Add marketeer'
    }
  };
  const roleOf = c => ROLES[c && c.role] || ROLES.retailer;

  /* ------------------------------------------------------------------ people (contact persons) */
  // Older records keep one contact person in flat fields; read them as the first person.
  function peopleOf(c) {
    if (Array.isArray(c.people) && c.people.length) return c.people;
    return [{ id: 'p1', name: c.contactPerson || '', role: c.designation || '', phone: c.phone || '', whatsapp: c.whatsappPhone || '', email: c.email || '', language: '', bestTime: '', upi: '', bankAccount: '', note: '' }];
  }
  function primaryOf(c) {
    const list = peopleOf(c);
    return list.find(p => p.id === c.primaryPersonId) || list[0];
  }
  // Keep the flat fields (used by invoices, WhatsApp, Excel sync) in step with the primary person.
  function syncPrimary(c) {
    const p = primaryOf(c);
    if (!p) return;
    c.contactPerson = p.name || c.contactPerson || '';
    if (p.phone) c.phone = p.phone;
    if (p.whatsapp) c.whatsappPhone = p.whatsapp;
    if (p.email) c.email = p.email;
    if (p.role) c.designation = p.role;
  }

  /* ------------------------------------------------------------------ fields per box */
  const F = (key, label, opts = {}) => ({ key, label, full: false, wrap: false, type: 'text', ...opts });
  const get = (c, key) => {
    if (key === 'rate500') return c.agreedRates && c.agreedRates['500g'] ? '₹' + c.agreedRates['500g'] + ' per jar' : '';
    if (key === 'rate1kg') return c.agreedRates && c.agreedRates['1kg'] ? '₹' + c.agreedRates['1kg'] + ' per jar' : '';
    if (key === 'commissionRate') return c.commissionRate ? c.commissionRate + '%' : '';
    if (key === 'creditLimit' || key === 'openingBalance') return c[key] ? inr(c[key]) : '';
    if (key === 'creditPeriod') return c.creditPeriod ? c.creditPeriod + ' days' : '';
    if (key === 'tradeDiscount') return c.tradeDiscount ? c.tradeDiscount + '%' : '';
    if (key === 'upiId') return c.upiId || (c.bankDetails && c.bankDetails.upiId) || '';
    if (['bankName', 'beneficiaryName', 'accountNumber', 'ifsc', 'branch'].includes(key)) return c[key] || (c.bankDetails && c.bankDetails[key]) || (key === 'ifsc' ? c.ifscCode : '') || '';
    if (key === 'fssai') return c.fssai || c.fssaiNumber || '';
    return c[key] == null ? '' : String(c[key]);
  };
  const raw = (c, key) => {
    if (key === 'rate500') return c.agreedRates && c.agreedRates['500g'] ? String(c.agreedRates['500g']) : '';
    if (key === 'rate1kg') return c.agreedRates && c.agreedRates['1kg'] ? String(c.agreedRates['1kg']) : '';
    if (['commissionRate', 'creditLimit', 'openingBalance', 'creditPeriod', 'tradeDiscount'].includes(key)) return c[key] ? String(c[key]) : '';
    return get(c, key);
  };
  function put(c, key, value) {
    const v = String(value ?? '').trim();
    if (key === 'rate500' || key === 'rate1kg') {
      c.agreedRates = c.agreedRates || {};
      const n = parseFloat(v.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n)) c.agreedRates[key === 'rate500' ? '500g' : '1kg'] = n; else delete c.agreedRates[key === 'rate500' ? '500g' : '1kg'];
      return;
    }
    if (['commissionRate', 'creditLimit', 'openingBalance', 'creditPeriod', 'tradeDiscount'].includes(key)) {
      const n = parseFloat(v.replace(/[^0-9.]/g, ''));
      c[key] = Number.isFinite(n) ? n : 0;
      if (key === 'commissionRate') c.brokerageRate = c[key];
      return;
    }
    if (['bankName', 'beneficiaryName', 'accountNumber', 'ifsc', 'branch', 'upiId'].includes(key)) {
      c.bankDetails = c.bankDetails || {};
      c.bankDetails[key] = v;
      c[key] = v;
      if (key === 'accountNumber') c.bankAccountNumber = v;
      if (key === 'ifsc') c.ifscCode = v;
      return;
    }
    if (key === 'fssai') { c.fssai = v; c.fssaiNumber = v; return; }
    if (key === 'gstin') { c.gstin = v.toUpperCase(); if (/^[0-9]{2}/.test(c.gstin)) c.stateCode = c.gstin.slice(0, 2); return; }
    if (key === 'pan') { c.pan = v.toUpperCase(); return; }
    if (key === 'billingAddress') { c.billingAddress = v; c.address = v || c.shippingAddress || ''; return; }
    c[key] = v;
  }

  function sections(c) {
    const r = roleOf(c);
    const extras = {
      retailer: [F('paymentTerms', 'Payment terms'), F('creditPeriod', 'Credit period (days)', { type: 'number' }), F('creditLimit', 'Credit limit (₹)', { type: 'number' }), F('tradeDiscount', 'Trade discount (%)', { type: 'number' }), F('rate500', 'Agreed rate · 500g (₹)', { type: 'number' }), F('rate1kg', 'Agreed rate · 1kg (₹)', { type: 'number' }), F('openingBalance', 'Opening balance (₹)', { type: 'number' }), F('outlets', 'Outlets / branches'), F('preferredTransporter', 'Preferred transporter', { full: true })],
      manufacturer: [F('paymentTerms', 'Payment terms'), F('capacity', 'Capacity per month'), F('specialties', 'Specialties', { full: true }), F('minimumBatch', 'Minimum batch'), F('leadTime', 'Production time'), F('openingBalance', 'Opening balance (₹)', { type: 'number' })],
      packaging: [F('paymentTerms', 'Payment terms'), F('supplyItems', 'Items and rates', { full: true, wrap: true }), F('minimumOrder', 'Minimum order'), F('leadTime', 'Delivery time'), F('openingBalance', 'Opening balance (₹)', { type: 'number' })],
      transporter: [F('paymentTerms', 'Payment terms'), F('vehicles', 'Vehicles (number · type · capacity)', { full: true, wrap: true }), F('routes', 'Routes served', { full: true, wrap: true }), F('ratePerTrip', 'Rate per trip / km'), F('drivers', 'Drivers (name · phone · licence)', { full: true, wrap: true }), F('openingBalance', 'Opening balance (₹)', { type: 'number' })],
      marketeer: [F('commissionRate', 'Commission (%)', { type: 'number' }), F('territory', 'Territory'), F('channels', 'Channels'), F('paymentTerms', 'Payment terms'), F('openingBalance', 'Opening balance (₹)', { type: 'number' })]
    }[c.role] || [];
    return [
      { id: 'company', col: 0, title: 'Company', icon: ICON.building, fields: [F('name', 'Company / trade name', { full: true }), F('brandName', 'Brand name'), F('businessNature', 'Business type'), F('dealsIn', r.badge + ' (separate with commas)', { full: true }), F('officePhone', 'Office phone'), F('billingEmail', 'Office / billing email'), F('website', 'Website', { full: true })] },
      { id: 'address', col: 0, title: 'Address & location', icon: ICON.place, isAddress: true, fields: [F('billingAddress', 'Billing address', { full: true, wrap: true }), F('shippingAddress', c.role === 'manufacturer' ? 'Factory address' : 'Shipping / godown address', { full: true, wrap: true }), F('city', 'City'), F('state', 'State'), F('pincode', 'PIN code'), F('landmark', 'Landmark'), F('mapsLink', 'Google Maps link', { full: true })] },
      { id: 'card', col: 0, title: 'Business card', icon: ICON.card, isCard: true, fields: [] },
      { id: 'kyc', col: 1, title: 'Licences & KYC', icon: ICON.shield, fields: [F('gstin', 'GSTIN'), F('pan', 'PAN'), F('fssai', 'FSSAI licence'), F('fssaiExpiry', 'FSSAI valid till', { type: 'date' }), F('msme', 'MSME / Udyam'), F('shopLicence', 'Shop / trade licence'), ...(c.role === 'manufacturer' ? [F('factoryLicense', 'Factory licence')] : []), F('cin', 'CIN')] },
      { id: 'terms', col: 1, title: c.role === 'marketeer' ? 'Commission & terms' : 'Trade terms', icon: ICON.terms, fields: [...extras, F('bio', 'Notes', { full: true, wrap: true })] },
      { id: 'bank', col: 1, title: 'Company bank account', icon: ICON.bank, fields: [F('bankName', 'Bank'), F('beneficiaryName', 'Beneficiary'), F('accountNumber', 'Account number'), F('ifsc', 'IFSC'), F('upiId', 'UPI ID'), F('branch', 'Branch')] }
    ];
  }
  const PERSON_FIELDS = [F('name', 'Full name'), F('role', 'Role / what they handle'), F('phone', 'Mobile', { type: 'tel' }), F('whatsapp', 'WhatsApp', { type: 'tel' }), F('email', 'Email', { full: true, type: 'email' }), F('language', 'Preferred language'), F('bestTime', 'Best time to call'), F('upi', 'Personal UPI'), F('bankAccount', 'Personal bank account'), F('note', 'Personal note', { full: true, wrap: true })];

  /* ------------------------------------------------------------------ money and orders per type */
  const isOpen = o => o && o.status !== 'settled' && o.status !== 'cancelled' && !o.isDeleted;
  function linkedOrders(app, c) {
    const key = roleOf(c).orderKey;
    return (app.data.orders || []).filter(o => o[key] === c.id).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
  function orderMoney(app, c, o) {
    switch (c.role) {
      case 'manufacturer': { const t = num(o.manufacturerTotalCost), p = num(o.manufacturerAdvancePaid); return { total: t, paid: p, bal: Math.max(0, t - p), totalLabel: 'Factory cost', paidLabel: 'Paid', balLabel: 'Payable' }; }
      case 'packaging': { const t = num(o.packagingCost), p = num(o.packagingAdvancePaid); return { total: t, paid: p, bal: Math.max(0, t - p), totalLabel: 'Packaging cost', paidLabel: 'Paid', balLabel: 'Payable' }; }
      case 'transporter': { const t = num(o.totalTransportCost); return { total: t, paid: null, bal: null, totalLabel: 'Freight', paidLabel: 'LR', balLabel: 'Vehicle' }; }
      case 'marketeer': { const t = num(o.marketeerCommissionAmount); return { total: t, paid: null, bal: null, totalLabel: 'Commission', paidLabel: 'Order value', balLabel: 'Buyer' }; }
      default: { const t = num(o.totalInvoiceAmount), b = Math.max(0, num(o.customerBalanceDue)); return { total: t, paid: Math.max(0, t - b), bal: b, totalLabel: 'Invoice', paidLabel: 'Received', balLabel: 'Balance' }; }
    }
  }
  function summary(app, c) {
    const orders = linkedOrders(app, c);
    const open = orders.filter(isOpen);
    const sum = (list, f) => list.reduce((t, o) => t + f(o), 0);
    const last = orders[0];
    const base = { orders, open, last, openCount: open.length, lastDate: last ? shortDate(last.date) : '—' };
    if (c.role === 'retailer') {
      const billed = sum(orders, o => num(o.totalInvoiceAmount));
      const due = sum(orders, o => Math.max(0, num(o.customerBalanceDue)));
      const overdueOrders = orders.filter(o => num(o.customerBalanceDue) > 0 && o.dueDate && o.dueDate < today() && o.status !== 'settled');
      const overdue = sum(overdueOrders, o => num(o.customerBalanceDue));
      const nextDue = open.filter(o => num(o.customerBalanceDue) > 0 && o.dueDate).map(o => o.dueDate).sort()[0];
      return { ...base, big: due, bigLabel: 'Balance due', of: billed, ofLabel: 'billed', done: billed - due, doneLabel: 'received', overdue, overdueSince: overdueOrders.map(o => o.dueDate).sort()[0],
        tiles: [['Open', open.length + ' of ' + orders.length], ['Last order', base.lastDate], ['Due on', nextDue ? shortDate(nextDue) : '—', overdue > 0]] };
    }
    if (c.role === 'manufacturer' || c.role === 'packaging') {
      const m = c.role === 'manufacturer';
      const cost = sum(orders, o => num(m ? o.manufacturerTotalCost : o.packagingCost));
      const paid = sum(orders, o => num(m ? o.manufacturerAdvancePaid : o.packagingAdvancePaid));
      return { ...base, big: Math.max(0, cost - paid), bigLabel: 'Payable', of: cost, ofLabel: 'total cost', done: paid, doneLabel: 'paid', overdue: 0,
        tiles: [[m ? 'In production' : 'Open', String(m ? open.filter(o => o.status === 'in_production' || o.status === 'action_needed').length : open.length)], ['Last order', base.lastDate], ['Total orders', String(orders.length)]] };
    }
    if (c.role === 'transporter') {
      const freight = sum(orders.filter(o => o.transportPaidByUs !== false), o => num(o.totalTransportCost));
      const paid = typeof app.paymentsPaidToContact === 'function' ? app.paymentsPaidToContact(c) : 0;
      return { ...base, big: Math.max(0, freight - paid), bigLabel: 'Freight payable', of: freight, ofLabel: 'freight', done: paid, doneLabel: 'paid', overdue: 0,
        tiles: [['Trips', String(orders.length)], ['In transit', String(orders.filter(o => o.status === 'in_transit').length)], ['Last trip', base.lastDate]] };
    }
    const earned = sum(orders, o => num(o.marketeerCommissionAmount));
    const paid = typeof app.paymentsPaidToContact === 'function' ? app.paymentsPaidToContact(c) : 0;
    const buyers = new Set(orders.map(o => o.retailerId || o.retailerName)).size;
    return { ...base, big: Math.max(0, earned - paid), bigLabel: 'Commission due', of: earned, ofLabel: 'earned', done: paid, doneLabel: 'paid', overdue: 0,
      tiles: [['Buyers brought', String(buyers)], ['Orders', String(orders.length)], ['Last order', base.lastDate]] };
  }

  const STATUS = {
    action_needed: ['Needs action', 'warn', 0], in_production: ['In production', 'info', 1], in_transit: ['In transit', 'info', 2],
    delivered: ['Delivered', 'info', 3], delivered_overdue: ['Delivered · overdue', 'bad', 3], settled: ['Completed', 'ok', 5]
  };
  const statusOf = o => STATUS[o.status] || [String(o.status || 'Open').replace(/_/g, ' '), 'info', 1];

  /* ------------------------------------------------------------------ UI state */
  const state = { tab: {}, editing: null, overlay: null, query: {}, filter: {}, prevQuery: '', draftPerson: null, undo: null };

  /* ------------------------------------------------------------------ directory */
  // Two middle summary tiles that matter for each partner type.
  function roleTiles(app, role, rows) {
    const orders = rows.flatMap(x => x.s.orders);
    const open = orders.filter(isOpen);
    const count = f => open.filter(f).length;
    if (role === 'retailer') {
      const overdue = rows.reduce((t, x) => t + x.s.overdue, 0), n = rows.filter(x => x.s.overdue > 0).length;
      return [['Overdue', inr(overdue), n ? n + (n === 1 ? ' buyer' : ' buyers') : 'nothing overdue', overdue > 0 ? 'pu-red' : ''], ['Open orders', String(open.length), count(o => o.status === 'action_needed') + ' need action', '']];
    }
    if (role === 'manufacturer') return [['In production', String(count(o => o.status === 'in_production')), 'orders being made', ''], ['Waiting to start', String(count(o => o.status === 'action_needed')), 'need advance or PO', '']];
    if (role === 'packaging') return [['Pending supply', String(count(o => o.packagingStatus !== 'delivered')), 'orders not yet delivered', ''], ['Delivered', String(orders.filter(o => o.packagingStatus === 'delivered').length), 'supplies received', '']];
    if (role === 'transporter') return [['In transit', String(count(o => o.status === 'in_transit')), 'trips on the road', ''], ['Trips', String(orders.length), 'all trips so far', '']];
    return [['Buyers brought', String(new Set(orders.map(o => o.retailerId || o.retailerName)).size), 'unique buyers', ''], ['Orders brought', String(orders.length), open.length + ' still open', '']];
  }
  function renderDirectory(app, role) {
    const r = ROLES[role];
    const contacts = (app.data.contacts || []).filter(c => c.role === role && !c.isDeleted);
    const rows = contacts.map(c => ({ c, s: summary(app, c) })).sort((a, b) => b.s.big - a.s.big);
    const q = (state.query[role] || '').toLowerCase();
    const f = state.filter[role] || 'all';
    const totalBig = rows.reduce((t, x) => t + x.s.big, 0);
    const totalDone = rows.reduce((t, x) => t + x.s.done, 0);
    const totalOf = rows.reduce((t, x) => t + x.s.of, 0);
    const totalOverdue = rows.reduce((t, x) => t + x.s.overdue, 0);
    const openOrders = rows.reduce((t, x) => t + x.s.openCount, 0);
    const counts = { all: rows.length, balance: rows.filter(x => x.s.big > 0).length, open: rows.filter(x => x.s.openCount > 0).length, overdue: rows.filter(x => x.s.overdue > 0).length, clear: rows.filter(x => x.s.big <= 0).length };
    const shown = rows.filter(x => {
      if (f === 'balance' && !(x.s.big > 0)) return false;
      if (f === 'open' && !(x.s.openCount > 0)) return false;
      if (f === 'overdue' && !(x.s.overdue > 0)) return false;
      if (f === 'clear' && x.s.big > 0) return false;
      return true;
    });
    const visibleCount = shown.filter(x => !q || searchText(x.c).includes(q)).length;
    const extra = roleTiles(app, role, rows);
    const tiles = [
      [rows[0] ? rows[0].s.bigLabel : 'Balance', inr(totalBig), `across ${rows.length} ${rows.length === 1 ? 'partner' : 'partners'}`, ''],
      ...extra,
      [rows[0] ? rows[0].s.doneLabel.replace(/^./, ch => ch.toUpperCase()) + ' so far' : 'Paid so far', inr(totalDone), totalOf ? Math.round(totalDone * 100 / totalOf) + '% of ' + (rows[0] ? rows[0].s.ofLabel : 'total') : '—', 'pu-green']
    ];
    const chip = (id, label, n, tone = '') => `<button type="button" class="pu-chip ${f === id ? 'is-on' : ''} ${tone}" onclick="TFPartnerUI.setFilter('${role}','${id}')">${esc(label)} <b>${n}</b></button>`;
    return `
    <div class="pu-root pu-dir">
      <div class="pu-dir-head">
        <div><h1 class="pu-h1">${esc(r.plural)}</h1><p class="pu-sub">${rows.length} ${rows.length === 1 ? 'partner' : 'partners'} · tap any detail to copy it</p></div>
        <div class="pu-row-wrap">
          <label class="pu-sr" for="pu-search-${role}">Search ${esc(r.plural)}</label>
          <input id="pu-search-${role}" type="search" class="pu-input pu-search" placeholder="Search name, city, GSTIN, person or product" value="${esc(state.query[role] || '')}" oninput="TFPartnerUI.setQuery('${role}', this.value)">
          <button type="button" class="pu-btn pu-primary" onclick="app.openEditContactModal(null, '${role}')">${esc(r.addLabel)}</button>
        </div>
      </div>
      <div class="pu-kpis">${tiles.map(t => `<div class="pu-kpi"><span class="pu-label">${esc(t[0])}</span><span class="pu-kpi-val ${t[3]}">${esc(t[1])}</span><span class="pu-hint">${esc(t[2])}</span></div>`).join('')}</div>
      <div class="pu-row-wrap">
        ${chip('all', 'All', counts.all)}${chip('balance', role === 'retailer' ? 'Balance due' : 'With balance', counts.balance)}${role === 'retailer' ? chip('overdue', 'Overdue', counts.overdue, 'pu-chip-red') : ''}${chip('open', 'Open orders', counts.open, 'pu-chip-amber')}${chip('clear', 'All clear', counts.clear)}
      </div>
      ${shown.length ? `<div class="pu-grid">${shown.map(x => card(app, x.c, x.s, q)).join('')}</div>` : ''}
      <div class="pu-empty" data-pu-empty="${role}" ${visibleCount ? 'hidden' : ''}>${rows.length ? 'No partners match this search or filter.' : 'No ' + esc(r.plural.toLowerCase()) + ' yet. Use “' + esc(r.addLabel) + '” to add one.'}</div>
    </div>`;
  }

  // Text the directory search looks through: names, places, GST, products and people.
  function searchText(c) {
    const p = peopleOf(c);
    return [c.name, c.brandName, c.city, c.state, c.gstin, c.dealsIn, c.id, ...p.map(pp => [pp.name, pp.phone, pp.email].join(' '))].join(' ').toLowerCase();
  }
  function card(app, c, s, q = '') {
    const r = roleOf(c);
    const p = primaryOf(c);
    const id = jsArg(c.id);
    const deals = splitList(c.dealsIn).slice(0, 3);
    const rows = [
      ['place', 'Place', [c.city, c.state].filter(Boolean).join(', ') || c.billingAddress || ''],
      ['phone', 'Phone', (p && p.phone) || c.phone || ''],
      ['gst', 'GSTIN', c.gstin ? 'GST ' + c.gstin : ''],
      ['email', 'Email', (p && p.email) || c.email || '']
    ];
    const pct = s.of > 0 ? Math.min(100, Math.round(s.done * 100 / s.of)) : 0;
    const logo = c.logo || c.logoUrl;
    return `
    <article class="pu-card" data-partner-type="${esc(c.role)}" data-name="${esc(String(c.name || '').toLowerCase())}" data-search="${esc(searchText(c))}" ${q && !searchText(c).includes(q) ? 'hidden' : ''}>
      <div class="pu-card-top">
        <button type="button" class="pu-icon-btn pu-card-edit" title="Edit" aria-label="Edit ${esc(c.name)}" onclick="TFPartnerUI.open(${id}, 'company', 'company')">${svg(ICON.edit, 15)}</button>
        <label class="pu-avatar-wrap" title="Change photo">
          <span class="pu-avatar">${logo ? `<img src="${esc(logo)}" alt="">` : esc(initials(c.name))}</span>
          <span class="pu-cam" aria-hidden="true">${svg(ICON.camera, 13)}</span>
          <input type="file" accept="image/*" class="pu-sr" aria-label="Upload photo of ${esc(c.name)}" onchange="TFPartnerUI.uploadLogo(${id}, this)">
        </label>
        <h2 class="pu-card-name"><button type="button" onclick="TFPartnerUI.open(${id}, 'company')" title="${esc(c.name)}">${esc(c.name || 'Unnamed partner')}</button></h2>
        <div class="pu-badges">${deals.length ? deals.map(d => `<span class="pu-badge">${svg(ICON.tag, 12)}${esc(d)}</span>`).join('') : `<button type="button" class="pu-badge pu-badge-add" onclick="TFPartnerUI.open(${id}, 'company', 'company')">+ ${esc(r.badge)}</button>`}</div>
        <div class="pu-lines">
          ${rows.map(([k, label, v]) => v
            ? `<button type="button" class="pu-line" title="Tap to copy" aria-label="Copy ${esc(label)}: ${esc(v)}" onclick="TFPartnerUI.copy(${jsArg(v.replace(/^GST /, ''))}, '${label}')">${svg(ICON[k], 15, 'class="pu-line-icon"')}<span class="pu-line-text">${esc(v)}</span><span class="pu-copy">${svg(ICON.copy, 14)}</span></button>`
            : `<button type="button" class="pu-line is-empty" onclick="TFPartnerUI.open(${id}, 'company', '${k === 'gst' ? 'kyc' : k === 'place' ? 'address' : 'person:' + esc((p && p.id) || 'p1')}')">${svg(ICON[k], 15, 'class="pu-line-icon"')}<span class="pu-line-text">Add ${esc(label.toLowerCase())}</span></button>`).join('')}
        </div>
      </div>
      <div class="pu-card-body">
        <div class="pu-money">
          <div class="pu-between"><span class="pu-label">${esc(s.bigLabel)}</span><span class="pu-hint">of ${esc(inr(s.of))} ${esc(s.ofLabel)}</span></div>
          <span class="pu-big ${s.overdue > 0 ? 'pu-red' : ''}">${esc(inr(s.big))}</span>
          <div class="pu-bar"><div style="width:${pct}%"></div></div>
          <span class="pu-hint">${esc(inr(s.done))} ${esc(s.doneLabel)} · ${pct}%</span>
        </div>
        <div class="pu-tiles">${s.tiles.map(t => `<div class="pu-tile ${t[2] ? 'is-bad' : ''}"><span class="pu-label">${esc(t[0])}</span><b>${esc(t[1])}</b></div>`).join('')}</div>
        ${s.overdue > 0 ? `<button type="button" class="pu-remind-link" onclick="TFPartnerUI.remind(${id})">${svg('M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z', 14)} Send WhatsApp reminder for ${esc(inr(s.overdue))} overdue</button>` : ''}
        <div class="pu-two">
          <button type="button" class="pu-btn" onclick="TFPartnerUI.open(${id}, 'company')">Company &amp; contact</button>
          <button type="button" class="pu-btn pu-primary" onclick="TFPartnerUI.open(${id}, 'work')">${esc(r.workTab)}</button>
        </div>
      </div>
    </article>`;
  }

  /* ------------------------------------------------------------------ partner page */
  function renderPage(app, c) {
    setTimeout(() => migrateImages(c), 0);
    const r = roleOf(c);
    const tab = state.tab[c.id] || 'company';
    const s = summary(app, c);
    const p = primaryOf(c);
    const id = jsArg(c.id);
    const deals = splitList(c.dealsIn);
    const chips = [
      ['place', 'Place', [c.city, c.state].filter(Boolean).join(', ') || c.billingAddress || ''],
      ['phone', 'Phone', (p && p.phone) || c.phone || ''],
      ['gst', 'GSTIN', c.gstin || ''],
      ['email', 'Email', (p && p.email) || c.email || '']
    ];
    const phone = String((p && p.phone) || c.phone || '').replace(/[^0-9+]/g, '');
    const wa = String((p && (p.whatsapp || p.phone)) || c.whatsappPhone || c.phone || '').replace(/[^0-9]/g, '');
    const logo = c.logo || c.logoUrl;
    return `
    <div class="pu-root pu-page">
      <button type="button" class="pu-back" onclick="app.navigateBack()">← Back</button>
      <section class="pu-hero">
        <label class="pu-avatar-wrap pu-avatar-lg" title="Change logo or photo">
          <span class="pu-avatar">${logo ? `<img src="${esc(logo)}" alt="">` : esc(initials(c.name))}</span>
          <span class="pu-cam" aria-hidden="true">${svg(ICON.camera, 15)}</span>
          <input type="file" accept="image/*" class="pu-sr" aria-label="Upload logo or photo" onchange="TFPartnerUI.uploadLogo(${id}, this)">
        </label>
        <div class="pu-hero-main">
          <div class="pu-row-wrap pu-hero-title"><h1 class="pu-h1 pu-hero-name">${esc(c.name || 'Unnamed partner')}</h1><span class="pu-idtag">${esc(c.id)} · ${esc(r.single)}</span>
            <button type="button" class="pu-balance ${s.overdue > 0 ? 'is-bad' : ''}" onclick="TFPartnerUI.setTab(${id}, 'work')" title="Open ${esc(r.workTab)}">${esc(inr(s.big))} <span>${esc(s.bigLabel.toLowerCase())}</span></button></div>
          <div class="pu-row-wrap pu-gap6">
            <span class="pu-label">${esc(r.badge)}</span>
            ${deals.map(d => `<span class="pu-badge">${svg(ICON.tag, 12)}${esc(d)}</span>`).join('')}
            <button type="button" class="pu-icon-btn pu-icon-sm" title="${deals.length ? 'Edit' : 'Add'} ${esc(r.badge.toLowerCase())}" aria-label="${deals.length ? 'Edit' : 'Add'} ${esc(r.badge.toLowerCase())}" onclick="TFPartnerUI.edit(${id}, 'company')">${svg(deals.length ? ICON.edit : 'M12 5v14 M5 12h14', 14)}</button>
            ${dealSuggestions(app, c).map(x => `<button type="button" class="pu-badge pu-badge-suggest" title="Seen in their orders – tap to add" onclick="TFPartnerUI.addDeal(${id}, ${jsArg(x)})">+ ${esc(x)}</button>`).join('')}
          </div>
          ${p && p.name ? `<div class="pu-hint pu-contact-line">Contact person: <b>${esc(p.name)}</b>${p.role ? ' · ' + esc(p.role) : ''}</div>` : ''}
          <div class="pu-chip-grid">${chips.map(([k, label, v]) => `<button type="button" class="pu-copychip ${v ? '' : 'is-empty'}" ${v ? `onclick="TFPartnerUI.copy(${jsArg(v)}, '${label}')" title="Click to copy"` : `onclick="TFPartnerUI.edit(${id}, '${k === 'phone' || k === 'email' ? 'person:' + esc(p ? p.id : 'p1') : k === 'gst' ? 'kyc' : 'address'}')"`}>${svg(ICON[k], 14)}<span>${esc(v ? (k === 'gst' ? 'GST ' + v : v) : 'Add ' + label.toLowerCase())}</span></button>`).join('')}</div>
        </div>
        <div class="pu-row-wrap pu-hero-actions">
          ${phone ? `<a class="pu-btn" href="tel:${esc(phone)}">Call</a>` : ''}
          ${wa ? `<a class="pu-btn" href="https://wa.me/${esc(wa.length === 10 ? '91' + wa : wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${s.overdue > 0 ? `<button type="button" class="pu-btn pu-btn-remind" onclick="TFPartnerUI.remind(${id})">Send reminder</button>` : ''}
          <button type="button" class="pu-btn pu-dark" onclick="TFPartnerUI.edit(${id}, 'company')">${svg(ICON.edit, 15)} Edit company</button>
        </div>
      </section>
      <div class="pu-tabs" role="tablist" aria-label="Partner sections">
        ${[['company', 'Company & contact', 'Details, licences, bank'], ['work', r.workTab, s.openCount + ' open · ' + inr(s.big)]].map(([t, label, hint]) => `
        <button type="button" role="tab" aria-selected="${tab === t}" class="pu-tab ${tab === t ? 'is-on' : ''}" onclick="TFPartnerUI.setTab(${id}, '${t}')"><span>${esc(label)}</span><small>${esc(hint)}</small></button>`).join('')}
      </div>
      ${tab === 'work' ? workTab(app, c, s) : companyTab(app, c)}
      ${overlay(app, c)}
    </div>`;
  }

  function companyTab(app, c) {
    const secs = sections(c);
    const people = peopleOf(c);
    const need = [];
    if (!c.gstin) need.push('GSTIN');
    if (c.fssai && !c.fssaiExpiry) need.push('FSSAI expiry date');
    if (!c.billingAddress) need.push('billing address');
    if (!get(c, 'accountNumber') && !get(c, 'upiId')) need.push('bank account or UPI');
    const find = idv => secs.find(x => x.id === idv);
    const left = ['company', 'address', 'card'].map(find);
    const right = ['kyc', 'terms', 'bank'].map(find);
    return `
      ${need.length ? `<div class="pu-attn"><b>${need.length} ${need.length === 1 ? 'thing' : 'things'} to complete</b><span>Missing: ${esc(need.join(', '))}.</span><button type="button" class="pu-btn pu-btn-sm" onclick="TFPartnerUI.edit(${jsArg(c.id)}, '${!c.gstin || (c.fssai && !c.fssaiExpiry) ? 'kyc' : !c.billingAddress ? 'address' : 'bank'}')">Complete now</button></div>` : ''}
      <div class="pu-cols">
        <div class="pu-col">${left.map(sx => box(app, c, sx)).join('')}</div>
        <div class="pu-col">
          ${people.map((pp, i) => personBox(app, c, pp, i, people.length)).join('')}
          <button type="button" class="pu-add-person" onclick="TFPartnerUI.addPerson(${jsArg(c.id)})">+ Add another person <small>(only if someone else also handles this company)</small></button>
          ${right.map(sx => box(app, c, sx)).join('')}
        </div>
      </div>`;
  }

  function boxHead(icon, title, subtitle, editing, editCall) {
    return `<div class="pu-box-head"><span class="pu-box-icon">${svg(icon, 16)}</span><div class="pu-grow"><h2>${esc(title)}</h2><span class="pu-hint">${esc(subtitle)}</span></div>
      ${editing ? '<span class="pu-editing">Editing</span>' : `<button type="button" class="pu-btn pu-btn-sm" onclick="${editCall}">${svg(ICON.edit, 14)} Edit</button>`}</div>`;
  }
  function tiles(list) {
    return `<div class="pu-fields">${list.map(x => `
      <button type="button" class="pu-field ${x.full ? 'is-full' : ''} ${x.wrap ? 'is-wrap' : ''}" onclick="TFPartnerUI.copy(${jsArg(x.value)}, ${jsArg(x.label)})" title="Click to copy">
        <span class="pu-field-label"><span>${esc(x.label)}</span>${x.tag ? `<em class="pu-tag ${x.tagTone || ''}">${esc(x.tag)}</em>` : ''}<i>Copy</i></span>
        <span class="pu-field-value">${esc(x.value)}</span>
      </button>`).join('')}</div>`;
  }
  function editForm(fields, values, saveCall, cancelCall, extraLeft = '') {
    return `<form class="pu-form" onsubmit="event.preventDefault(); ${saveCall}">
      <div class="pu-fields">${fields.map(f => `
        <div class="pu-input-wrap ${f.full ? 'is-full' : ''}">
          <label for="pu-in-${esc(f.key)}">${esc(f.label)}</label>
          ${f.wrap ? `<textarea id="pu-in-${esc(f.key)}" data-pu-field="${esc(f.key)}" class="pu-input" rows="2" name="${esc(f.key)}">${esc(values[f.key] || '')}</textarea>`
                   : `<input id="pu-in-${esc(f.key)}" data-pu-field="${esc(f.key)}" class="pu-input" type="${f.type === 'number' ? 'text' : esc(f.type)}" ${f.type === 'number' ? 'inputmode="decimal"' : ''} name="${esc(f.key)}" value="${esc(values[f.key] || '')}" placeholder="Add ${esc(f.label.toLowerCase())}">`}
        </div>`).join('')}</div>
      <div class="pu-form-foot">${extraLeft}<span class="pu-grow"></span><button type="button" class="pu-btn" onclick="${cancelCall}">Cancel</button><button type="submit" class="pu-btn pu-primary">Save changes</button></div>
    </form>`;
  }

  function box(app, c, sx) {
    const id = jsArg(c.id);
    const editing = state.editing === c.id + '|' + sx.id;
    // Name, "deals in", city and state are already in the page header, so the box does not repeat them.
    const inHeader = new Set(['name', 'dealsIn', 'city', 'state']);
    const filledAll = sx.fields.filter(f => get(c, f.key));
    const filled = filledAll.filter(f => !inHeader.has(f.key));
    const missing = sx.fields.filter(f => !get(c, f.key));
    const subtitle = sx.isCard ? 'Front and back photo' : filledAll.length + ' of ' + sx.fields.length + ' filled';
    let body = '';
    if (editing && !sx.isCard) {
      const values = {}; sx.fields.forEach(f => { values[f.key] = raw(c, f.key); });
      body = editForm(sx.fields, values, `TFPartnerUI.saveBox(${id}, '${sx.id}', this)`, 'TFPartnerUI.cancel()');
    } else {
      const docs = c.kycDocs || {};
      body = (filled.length ? tiles(filled.map(f => ({ label: f.label.replace(/ \((separate with commas|₹|%|days)\)$/, ''), value: get(c, f.key), full: f.full, wrap: f.wrap,
        tag: sx.id === 'kyc' && ['gstin', 'pan', 'fssai'].includes(f.key) ? (docs[f.key] ? 'Scan saved' : 'Scan missing') : '', tagTone: sx.id === 'kyc' && ['gstin', 'pan', 'fssai'].includes(f.key) && !docs[f.key] ? 'is-amber' : 'is-green' }))) : '');
      if (sx.isAddress) {
        const q = encodeURIComponent([c.billingAddress || c.shippingAddress, c.city, c.state, c.pincode].filter(Boolean).join(', '));
        const link = c.mapsLink || (q ? 'https://www.google.com/maps/search/?api=1&query=' + q : '');
        const mapQuery = mapQueryOf(c);
        body += `<div class="pu-pad">${c.mapsLink && mapQuery ? `<iframe class="pu-map pu-map-live" title="Map of ${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups" src="https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&amp;output=embed"></iframe>` : `<div class="pu-map"><span class="pu-map-pin">${svg(ICON.place, 18)}</span><span class="pu-map-label">${esc(c.city || 'Location')}${c.mapsLink ? '' : ' · add a Google Maps link to see the real map'}</span></div>`}
          <div class="pu-two">${link ? `<a class="pu-btn pu-primary" href="${esc(link)}" target="_blank" rel="noopener">Open in Google Maps</a><a class="pu-btn" href="https://wa.me/?text=${encodeURIComponent((c.name || '') + ' – ' + decodeURIComponent(link))}" target="_blank" rel="noopener">Send location on WhatsApp</a>` : '<span class="pu-hint">Add an address or a Google Maps link to see it on the map.</span>'}</div></div>`;
      }
      if (sx.isCard) {
        const card = c.businessCard || {};
        body += `<div class="pu-fields pu-pad">${[['front', 'Front of card'], ['back', 'Back (optional)']].map(([side, label]) => card[side]
          ? `<div class="pu-cardimg"><img src="${esc(card[side])}" alt="${esc(label)}"><div class="pu-row-wrap"><button type="button" class="pu-btn pu-btn-sm" onclick="TFPartnerUI.viewImage(${id}, '${side}')">View</button><label class="pu-btn pu-btn-sm">Replace<input type="file" accept="image/*" class="pu-sr" onchange="TFPartnerUI.uploadCard(${id}, '${side}', this)"></label><button type="button" class="pu-btn pu-btn-sm pu-danger" onclick="TFPartnerUI.removeCard(${id}, '${side}')">Remove</button></div></div>`
          : `<label class="pu-drop">${svg(ICON.upload, 20)}<b>${esc(label)}</b><span class="pu-hint">Tap to upload or take a photo</span><input type="file" accept="image/*" capture="environment" class="pu-sr" onchange="TFPartnerUI.uploadCard(${id}, '${side}', this)"></label>`).join('')}</div>`;
      }
      if (missing.length) body += `<button type="button" class="pu-add-missing" onclick="TFPartnerUI.edit(${id}, '${sx.id}')"><b>+ Add</b><span>${esc(missing.map(f => f.label.replace(/ \((separate with commas|₹|%|days)\)$/, '')).join(' · '))}</span></button>`;
    }
    return `<section class="pu-box ${editing ? 'is-editing' : ''}">${boxHead(sx.icon, sx.title, subtitle, editing, `TFPartnerUI.edit(${id}, '${sx.id}')`)}${body}</section>`;
  }

  function personBox(app, c, p, i, total) {
    const id = jsArg(c.id);
    const key = 'person:' + p.id;
    const editing = state.editing === c.id + '|' + key;
    const isPrimary = (primaryOf(c) || {}).id === p.id;
    const title = total > 1 ? (isPrimary ? 'Primary contact' : 'Person ' + (i + 1)) : 'Contact person';
    // The primary person's phone and email are already in the page header.
    const shown = PERSON_FIELDS.filter(f => f.key !== 'name' && f.key !== 'role' && !(isPrimary && (f.key === 'phone' || f.key === 'email')));
    const filled = shown.filter(f => p[f.key]);
    const missing = shown.filter(f => !p[f.key]);
    let body;
    if (editing) {
      body = editForm(PERSON_FIELDS, p, `TFPartnerUI.savePerson(${id}, ${jsArg(p.id)}, this)`, 'TFPartnerUI.cancel()',
        total > 1 ? `<button type="button" class="pu-btn pu-danger" onclick="TFPartnerUI.removePerson(${id}, ${jsArg(p.id)})">Remove person</button>` : '');
    } else {
      body = `<div class="pu-person">
          <label class="pu-avatar-wrap pu-avatar-md" title="Change photo"><span class="pu-avatar">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : esc(initials(p.name))}</span>
            <span class="pu-cam" aria-hidden="true">${svg(ICON.camera, 12)}</span><input type="file" accept="image/*" class="pu-sr" aria-label="Upload photo of ${esc(p.name || 'this person')}" onchange="TFPartnerUI.uploadPersonPhoto(${id}, ${jsArg(p.id)}, this)"></label>
          <div class="pu-grow"><b class="pu-person-name">${esc(p.name || 'Name not added')}</b><span class="pu-hint">${esc(p.role || 'Add their role')}</span></div>
          ${total > 1 ? (isPrimary ? '<span class="pu-tag is-green">★ Primary contact</span>' : `<button type="button" class="pu-btn pu-btn-sm" onclick="TFPartnerUI.makePrimary(${id}, ${jsArg(p.id)})">Make primary</button>`) : ''}
        </div>`
        + (filled.length ? tiles(filled.map(f => ({ label: f.label, value: p[f.key], full: f.full, wrap: f.wrap }))) : '')
        + (missing.length ? `<button type="button" class="pu-add-missing" onclick="TFPartnerUI.edit(${id}, '${esc(key)}')"><b>+ Add</b><span>${esc(missing.map(f => f.label).join(' · '))}</span></button>` : '');
    }
    const n = PERSON_FIELDS.filter(f => p[f.key]).length;
    return `<section class="pu-box ${editing ? 'is-editing' : ''}">${boxHead(ICON.user, title, n + ' of ' + PERSON_FIELDS.length + ' filled', editing, `TFPartnerUI.edit(${id}, '${esc(key)}')`)}${body}</section>`;
  }

  /* ------------------------------------------------------------------ work & money tab */
  function steps(o) {
    const st = statusOf(o);
    const reached = st[2];
    const bad = st[1] === 'bad';
    return ['Booked', 'Production', 'Dispatched', 'Delivered', 'Paid'].map((label, i) => {
      const done = i < reached, now = i === reached;
      return `<div class="pu-step ${done ? 'is-done' : ''} ${now ? (bad ? 'is-bad' : 'is-now') : ''} ${i === 0 ? 'is-first' : ''} ${i <= reached ? 'is-lit' : ''}"><span>${done ? '✓' : i + 1}</span><small>${label}</small></div>`;
    }).join('');
  }
  // Coordinates or place text from a saved Google Maps link, else the written address.
  function mapQueryOf(c) {
    const link = String(c.mapsLink || '');
    const at = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(link);
    if (at) return at[1] + ',' + at[2];
    try { const u = new URL(link); const q = u.searchParams.get('q') || u.searchParams.get('query'); if (q) return q; const place = /\/place\/([^/]+)/.exec(u.pathname); if (place) return decodeURIComponent(place[1].replace(/\+/g, ' ')); } catch (_) {}
    return [c.billingAddress || c.shippingAddress, c.city, c.state, c.pincode].filter(Boolean).join(', ');
  }
  function docsFor(app, o) { return (app.data.documents || []).filter(d => d.orderId === o.id && !d.isDeleted); }
  // The saved invoice file for an order, as seen from this partner (buyer invoice, factory bill or packaging bill).
  const INVOICE_CATEGORY = { retailer: ['retailer_invoice', 'tax_invoice'], manufacturer: ['mfg_invoice'], packaging: ['pkg_invoice'] };
  function invoiceDocsFor(app, c, o) { const cats = INVOICE_CATEGORY[c.role] || []; return docsFor(app, o).filter(d => cats.includes(d.category)); }
  function paymentsFor(app, c, o) { return (app.data.payments || []).filter(p => !p.isDeleted && (p.orderRef === o.id || p.orderId === o.id)); }
  function productsOf(o) { return (o.items || []).map(i => `${i.name || i.shortName || 'Item'}${i.variant ? ' ' + String(i.variant).replace(/ PET Jar$/, '') : ''} × ${num(i.cases)}`).join(' · '); }
  const casesOf = o => (o.items || []).reduce((t, i) => t + num(i.cases), 0);

  function workTab(app, c, s) {
    const r = roleOf(c);
    const id = jsArg(c.id);
    const money = o => orderMoney(app, c, o);
    const prevQ = state.prevQuery.toLowerCase();
    const previous = s.orders.filter(o => !isOpen(o)).filter(o => !prevQ || [o.id, o.invoiceNumber, productsOf(o)].join(' ').toLowerCase().includes(prevQ));
    const direction = c.role === 'retailer' ? 'received' : 'paid';
    const kpis = [
      [s.bigLabel, inr(s.big), 'across ' + s.openCount + ' open', ''],
      c.role === 'retailer' ? ['Overdue', inr(s.overdue), s.overdueSince ? 'since ' + shortDate(s.overdueSince) : 'nothing overdue', s.overdue > 0 ? 'pu-red' : ''] : roleTiles(app, c.role, [{ c, s }])[0],
      ['Total ' + s.ofLabel, inr(s.of), s.orders.length + ' orders', ''],
      [s.doneLabel.replace(/^./, ch => ch.toUpperCase()), inr(s.done), s.of ? Math.round(s.done * 100 / s.of) + '% of total' : '—', 'pu-green'],
      ['Terms', c.paymentTerms || (c.commissionRate ? c.commissionRate + '%' : '—'), c.role === 'marketeer' ? 'commission terms' : 'payment terms', '']
    ];
    const current = s.open;
    const undo = state.undo && state.undo.contactId === c.id ? state.undo : null;
    return `
      ${undo ? `<div class="pu-attn pu-undo" role="status"><b>${esc(undo.text)}</b><span>A copy of the file stays on disk.</span><button type="button" class="pu-btn pu-btn-sm" onclick="TFPartnerUI.undoDelete()">Undo</button><button type="button" class="pu-icon-btn" aria-label="Dismiss" onclick="TFPartnerUI.dismissUndo()">✕</button></div>` : ''}
      <div class="pu-kpis pu-kpis-5">${kpis.map(t => `<div class="pu-kpi"><span class="pu-label">${esc(t[0])}</span><span class="pu-kpi-val ${t[3]}">${esc(t[1])}</span><span class="pu-hint">${esc(t[2])}</span></div>`).join('')}</div>
      <div class="pu-dir-head"><h2 class="pu-h2">Current orders <span class="pu-hint">· ${current.length} open</span></h2>
        <div class="pu-row-wrap">
          <button type="button" class="pu-btn" onclick="TFPartnerUI.statement(${id})">${svg(ICON.download, 15)} Statement (PDF)</button>
          ${c.role === 'retailer' && s.overdue > 0 ? `<button type="button" class="pu-btn" onclick="TFPartnerUI.remind(${id})">Send reminder</button>` : ''}
          <button type="button" class="pu-btn" onclick="app.openPaymentModal(null, ${jsArg(c.name)}, '${direction}')">Record payment</button>
          ${c.role === 'retailer' ? '<button type="button" class="pu-btn pu-primary" onclick="app.openNewOrderModal()">+ New order</button>' : ''}
        </div></div>
      ${current.length ? `<div class="pu-orders">${current.map(o => {
        const m = money(o); const st = statusOf(o); const docs = docsFor(app, o);
        const overdue = c.role === 'retailer' && num(o.customerBalanceDue) > 0 && o.dueDate && o.dueDate < today();
        const third = m.bal != null ? [m.balLabel + (o.dueDate && c.role === 'retailer' ? ' · due ' + shortDate(o.dueDate) : ''), inr(m.bal)] : c.role === 'transporter' ? ['Vehicle', o.vehicleNumber || '—'] : ['Buyer', o.retailerName || '—'];
        const second = m.paid != null ? [m.paidLabel, inr(m.paid)] : c.role === 'transporter' ? ['LR', o.lrNumber || 'Pending'] : ['Order value', inr(o.totalInvoiceAmount)];
        return `<article class="pu-box">
          <div class="pu-box-head"><div class="pu-grow"><button type="button" class="pu-link" onclick="app.openOrderDetailPage(${jsArg(o.id)})">${esc(o.invoiceNumber || o.id)}</button><span class="pu-hint">Booked ${esc(longDate(o.date))} · ${casesOf(o)} cases</span></div><span class="pu-status is-${overdue ? 'bad' : st[1]}">${esc(overdue ? 'Overdue' : st[0])}</span></div>
          <div class="pu-pad pu-stack">
            <div class="pu-steps">${steps(o)}</div>
            <span class="pu-small">${esc(productsOf(o))}</span>
            <div class="pu-tiles"><div class="pu-tile"><span class="pu-label">${esc(m.totalLabel)}</span><b>${esc(inr(m.total))}</b></div><div class="pu-tile"><span class="pu-label">${esc(second[0])}</span><b class="${m.paid != null ? 'pu-green' : ''}">${esc(second[1])}</b></div><div class="pu-tile ${overdue ? 'is-bad' : ''}"><span class="pu-label">${esc(third[0])}</span><b>${esc(third[1])}</b></div></div>
            <div class="pu-row-wrap"><button type="button" class="pu-btn pu-primary pu-btn-sm" onclick="app.openOrderDetailPage(${jsArg(o.id)})">Open order</button><button type="button" class="pu-btn pu-btn-sm" onclick="TFPartnerUI.folder(${id}, ${jsArg(o.id)})">Folder · ${docs.length} ${docs.length === 1 ? 'file' : 'files'}</button>${c.role === 'retailer' ? `<button type="button" class="pu-btn pu-btn-sm" onclick="app.openInvoiceModal(${jsArg(o.id)})">View invoice</button>` : ''}${invoiceDocsFor(app, c, o).length ? `<button type="button" class="pu-btn pu-btn-sm pu-danger" onclick="TFPartnerUI.deleteInvoice(${id}, ${jsArg(o.id)})">Delete invoice</button>` : ''}</div>
          </div></article>`;
      }).join('')}</div>` : '<div class="pu-empty">No open orders right now.</div>'}
      <section class="pu-box">
        <div class="pu-box-head"><h2 class="pu-grow">Previous orders <span class="pu-hint">· completed &amp; paid</span></h2>
          <label class="pu-sr" for="pu-prev-q">Search previous orders</label><input id="pu-prev-q" type="search" class="pu-input pu-input-sm" placeholder="Search order no. or product" value="${esc(state.prevQuery)}" oninput="TFPartnerUI.setPrevQuery(this.value)"></div>
        ${previous.length ? `<div class="pu-table-wrap"><table class="pu-table"><thead><tr><th>Order</th><th>Products</th><th class="pu-num">Cases</th><th class="pu-num">${esc(money(previous[0]).totalLabel)}</th><th>Payment</th><th>Completed</th><th class="pu-num">Invoice &amp; files</th></tr></thead><tbody>
          ${previous.map(o => { const m = money(o); const pays = paymentsFor(app, c, o); const docs = docsFor(app, o); const last = pays.map(p => p.date).sort().pop();
            return `<tr><td><button type="button" class="pu-link" onclick="app.openOrderDetailPage(${jsArg(o.id)})">${esc(o.invoiceNumber || o.id)}</button><div class="pu-hint">${esc(longDate(o.date))}</div></td>
              <td class="pu-small">${esc(productsOf(o))}</td><td class="pu-num">${casesOf(o)}</td><td class="pu-num"><b>${esc(inr(m.total))}</b></td>
              <td><span class="pu-status is-ok">✓ Paid in full</span><div class="pu-hint">${pays.length ? pays.length + (pays.length === 1 ? ' payment' : ' payments') + (last ? ' · last ' + esc(shortDate(last)) : '') : 'payments recorded on the order'}</div></td>
              <td>${esc(o.settledDate || o.deliveredDate || last ? longDate(o.settledDate || o.deliveredDate || last) : '—')}</td>
              <td class="pu-num"><div class="pu-row-end">${c.role === 'retailer' ? `<button type="button" class="pu-btn pu-btn-sm" onclick="app.openInvoiceModal(${jsArg(o.id)})">View invoice</button>` : ''}<button type="button" class="pu-btn pu-btn-sm" onclick="TFPartnerUI.folder(${id}, ${jsArg(o.id)})">Folder · ${docs.length}</button>${invoiceDocsFor(app, c, o).length ? `<button type="button" class="pu-btn pu-btn-sm pu-danger" title="Delete the saved invoice file" onclick="TFPartnerUI.deleteInvoice(${id}, ${jsArg(o.id)})">Delete invoice</button>` : ''}</div></td></tr>`; }).join('')}
        </tbody></table></div>` : `<div class="pu-empty">${prevQ ? 'No previous orders match this search.' : 'No completed orders yet. Orders move here once they are delivered and fully paid.'}</div>`}
      </section>`;
  }

  function overlay(app, c) {
    const ov = state.overlay;
    if (!ov || ov.contactId !== c.id) return '';
    const close = 'TFPartnerUI.closeOverlay()';
    if (ov.kind === 'image') {
      const src = (c.businessCard || {})[ov.side];
      return `<div class="pu-overlay" onclick="if (event.target === this) ${close}"><div class="pu-dialog" role="dialog" aria-modal="true" aria-label="Business card"><div class="pu-box-head"><h2 class="pu-grow">Business card · ${esc(ov.side)}</h2><button type="button" class="pu-icon-btn" aria-label="Close" onclick="${close}">✕</button></div><div class="pu-pad"><img src="${esc(src)}" alt="Business card" style="width:100%;border-radius:10px"></div></div></div>`;
    }
    const o = (app.data.orders || []).find(x => x.id === ov.orderId);
    if (!o) return '';
    const docs = docsFor(app, o);
    const label = d => (d.metadata && (d.metadata.customFileName || d.metadata.invoiceNumber)) || d.fileName || 'Document';
    return `<div class="pu-overlay" onclick="if (event.target === this) ${close}"><div class="pu-dialog" role="dialog" aria-modal="true" aria-label="Order folder">
      <div class="pu-box-head"><div class="pu-grow"><span class="pu-hint">Order folder · ${docs.length} ${docs.length === 1 ? 'file' : 'files'}</span><h2>${esc(o.invoiceNumber || o.id)}</h2></div><button type="button" class="pu-icon-btn" aria-label="Close" onclick="${close}">✕</button></div>
      <div class="pu-pad pu-stack">
        ${docs.length ? docs.map(d => `<div class="pu-file"><span class="pu-file-ext">${esc((String(d.fileName || '').split('.').pop() || 'FILE').slice(0, 4).toUpperCase())}</span><div class="pu-grow"><b>${esc(label(d))}</b><span class="pu-hint">${esc(String(d.category || '').replace(/_/g, ' '))}${d.created_at || d.createdAt ? ' · ' + esc(shortDate(d.created_at || d.createdAt)) : ''}</span></div><button type="button" class="pu-btn pu-btn-sm" onclick="TFPartnerUI.closeOverlay(); app.previewDocument(${jsArg(d.id)})">View</button><button type="button" class="pu-btn pu-btn-sm pu-danger" aria-label="Delete ${esc(label(d))}" onclick="TFPartnerUI.deleteFile(${jsArg(c.id)}, ${jsArg(d.id)})">Delete</button></div>`).join('')
          : '<div class="pu-empty">No files saved for this order yet.</div>'}
        <div class="pu-form-foot"><span class="pu-grow"></span>${c.role === 'retailer' ? `<button type="button" class="pu-btn" onclick="TFPartnerUI.closeOverlay(); app.openInvoiceModal(${jsArg(o.id)})">View invoice</button>` : ''}<button type="button" class="pu-btn" onclick="TFPartnerUI.closeOverlay(); app.openDocumentReviewModalForOrder(${jsArg(o.id)})">+ Add file</button><button type="button" class="pu-btn pu-dark" onclick="app.openOrderFolder(${jsArg(o.id)})">Open in File Explorer</button></div>
      </div></div></div>`;
  }

  /* ------------------------------------------------------------------ smart helpers (v5 step 4) */
  // Products this partner actually deals in, taken from their orders, that are not in "Deals in" yet.
  function dealSuggestions(app, c) {
    const have = splitList(c.dealsIn).map(x => x.toLowerCase());
    const names = new Map();
    for (const o of linkedOrders(app, c)) for (const i of (o.items || [])) {
      const label = c.role === 'packaging' ? String(i.variant || '').replace(/^\d+\s*(g|kg|ml|l)\s*/i, '').trim() || i.variant : (i.name || i.shortName);
      if (label) names.set(label.toLowerCase(), label);
    }
    return [...names.values()].filter(n => !have.some(h => h === n.toLowerCase() || n.toLowerCase().includes(h) || h.includes(n.toLowerCase()))).slice(0, 3);
  }
  function overdueOrders(app, c) {
    return linkedOrders(app, c).filter(o => c.role === 'retailer' && num(o.customerBalanceDue) > 0 && o.dueDate && o.dueDate < today() && o.status !== 'settled');
  }
  function reminderText(app, c) {
    const p = primaryOf(c) || {};
    const prof = (app.data && app.data.businessProfile) || {};
    const list = overdueOrders(app, c);
    const open = list.length ? list : linkedOrders(app, c).filter(o => num(o.customerBalanceDue) > 0 && o.status !== 'settled');
    const total = open.reduce((t, o) => t + num(o.customerBalanceDue), 0);
    const lines = [`Namaste ${p.name || c.name},`, '', list.length ? 'A gentle reminder about these overdue invoices:' : 'A reminder about these open invoices:'];
    open.forEach(o => lines.push(`• ${o.invoiceNumber || o.id} dated ${longDate(o.date)} – balance ${inr(o.customerBalanceDue)}${o.dueDate ? ' (due ' + longDate(o.dueDate) + ')' : ''}`));
    lines.push('', `Total due: ${inr(total)}`);
    const bank = [prof.bankName && `Bank: ${prof.bankName}`, prof.accountNumber && `A/c: ${prof.accountNumber}`, prof.ifsc && `IFSC: ${prof.ifsc}`, (prof.accountHolder || prof.legalName) && `Name: ${prof.accountHolder || prof.legalName}`].filter(Boolean);
    if (bank.length) lines.push('', 'Bank details:', ...bank);
    if (prof.upiId) lines.push(`UPI: ${prof.upiId}`);
    lines.push('', 'Please share the UTR once paid. Thank you!', `– ${prof.brandName || prof.legalName || ''}`.trim());
    return { text: lines.join('\n'), total, count: open.length };
  }
  function statementRows(app, c) {
    const r = roleOf(c);
    const rows = [];
    for (const o of linkedOrders(app, c)) { const m = orderMoney(app, c, o); if (m.total) rows.push({ date: o.date, ref: o.invoiceNumber || o.id, what: c.role === 'retailer' ? 'Invoice' : c.role === 'marketeer' ? 'Commission' : c.role === 'transporter' ? 'Freight' : 'Bill', debit: m.total, credit: 0 }); }
    const name = String(c.name || '').trim().toLowerCase();
    const dir = c.role === 'retailer' ? 'received' : 'paid';
    for (const pay of (app.data.payments || [])) {
      if (pay.isDeleted || pay.direction !== dir) continue;
      if (!((pay.partyId && pay.partyId === c.id) || String(pay.partyName || '').trim().toLowerCase() === name)) continue;
      rows.push({ date: pay.date, ref: [pay.mode, pay.utr].filter(Boolean).join(' · ') || 'Payment', what: dir === 'received' ? 'Payment received' : 'Payment made', debit: 0, credit: num(pay.amount), order: pay.orderRef });
    }
    rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    let bal = num(c.openingBalance);
    rows.forEach(x => { bal += x.debit - x.credit; x.balance = bal; });
    return { rows, opening: num(c.openingBalance), closing: bal, label: r.single };
  }

  /* ------------------------------------------------------------------ actions */
  const appRef = () => window.app;
  const contactById = idv => (appRef().data.contacts || []).find(c => c.id === idv);
  function rerender() {
    const a = appRef();
    if (a.activeTab === 'contact-detail' && typeof a.renderContactDetailView === 'function') a.renderContactDetailView(a.activeContactId);
    else if (typeof a.renderActiveView === 'function') a.renderActiveView();
  }
  function stamp(c, why) {
    c.updated_at = new Date().toISOString();
    const a = appRef();
    a.saveData('Operator', why);
    rerender();
  }
  function readForm(form) {
    const out = {};
    form.querySelectorAll('[data-pu-field]').forEach(el => { out[el.getAttribute('data-pu-field')] = el.value; });
    return out;
  }
  function shrinkImage(file, maxSide, quality = 0.82) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('Please choose an image (JPG or PNG).')); return; }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('This image could not be opened.'));
        img.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }
  const toast = m => { const a = appRef(); if (a && a.showToast) a.showToast(m); };
  // Images are saved as files next to the data; the partner record keeps only the link.
  async function storeImage(contactId, slot, dataUrl) {
    const resp = await fetch('/api/partners/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId, slot, dataUrl: dataUrl || '' }) });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.success) throw new Error(json.error || 'Could not save the image');
    return json.url;
  }
  const isInline = v => typeof v === 'string' && v.startsWith('data:image');
  const migrating = new Set();
  // Older records kept photos inside the data; move them to files once, then save.
  async function migrateImages(c) {
    if (!c || migrating.has(c.id) || typeof fetch !== 'function') return;
    const jobs = [];
    if (isInline(c.logo)) jobs.push(['logo', v => { c.logo = v; }, c.logo]);
    const card = c.businessCard || {};
    for (const side of ['front', 'back']) if (isInline(card[side])) jobs.push(['card-' + side, v => { c.businessCard = { ...(c.businessCard || {}), [side]: v }; }, card[side]]);
    (Array.isArray(c.people) ? c.people : []).forEach(p => { if (isInline(p.photo)) jobs.push(['person-' + p.id, v => { p.photo = v; }, p.photo]); });
    if (!jobs.length) return;
    migrating.add(c.id);
    try {
      for (const [slot, apply, data] of jobs) apply(await storeImage(c.id, slot, data));
      c.updated_at = new Date().toISOString();
      await appRef().saveData('Operator', 'Moved partner images to files · ' + (c.name || c.id));
      rerender();
    } catch (e) { console.warn('Image move skipped:', e.message); }
    finally { migrating.delete(c.id); }
  }
  function ask(title, message, confirmText) {
    const a = appRef();
    if (a && typeof a.showModalConfirm === 'function') return a.showModalConfirm({ title, subtitle: 'Please confirm', message, confirmText, confirmClass: 'bg-rose-600 hover:bg-rose-500', icon: 'trash-2' });
    return Promise.resolve(window.confirm(String(message).replace(/<[^>]+>/g, '')));
  }
  function removeDocs(c, docs, text) {
    const a = appRef();
    const ids = new Set(docs.map(d => d.id));
    a.data.documents = (a.data.documents || []).filter(d => !ids.has(d.id));
    state.undo = { contactId: c.id, docs, text };
    a.saveData('Operator', text + ' · ' + (c.name || c.id));
    rerender();
  }

  window.TFPartnerUI = {
    ROLES, peopleOf, primaryOf, summary, sections, invoiceDocsFor,
    renderDirectory, renderPage,
    open(contactId, tab = 'company', editSection = null) {
      state.tab[contactId] = tab;
      state.editing = editSection ? contactId + '|' + editSection : null;
      state.overlay = null;
      appRef().navigateToContact(contactId, tab);
    },
    setTab(contactId, tab) { state.tab[contactId] = tab; state.editing = null; rerender(); },
    setFilter(role, f) { state.filter[role] = f; rerender(); },
    // Search filters the cards already on screen (no redraw), a moment after typing stops.
    setQuery(role, q) {
      state.query[role] = q;
      clearTimeout(state.searchTimer);
      const apply = () => {
        const needle = String(q || '').toLowerCase();
        let visible = 0;
        document.querySelectorAll(`.pu-card[data-partner-type="${role}"]`).forEach(el => {
          const show = !needle || (el.getAttribute('data-search') || '').includes(needle);
          el.hidden = !show; if (show) visible++;
        });
        document.querySelectorAll(`[data-pu-empty="${role}"]`).forEach(el => { el.hidden = visible > 0; });
      };
      if (typeof setTimeout === 'function' && q) state.searchTimer = setTimeout(apply, 120); else apply();
    },
    setPrevQuery(q) {
      state.prevQuery = q; rerender();
      const el = document.getElementById('pu-prev-q'); if (el) { el.focus(); el.setSelectionRange(q.length, q.length); }
    },
    edit(contactId, sectionId) { state.tab[contactId] = 'company'; state.editing = contactId + '|' + sectionId; rerender();
      setTimeout(() => { const f = document.querySelector('.pu-box.is-editing .pu-input'); if (f) { f.focus(); f.closest('.pu-box').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 30); },
    cancel() {
      // A person added with "+ Add another person" and never saved is dropped again.
      const d = state.draftPerson;
      if (d) {
        const c = contactById(d.contactId);
        if (c && Array.isArray(c.people)) c.people = c.people.filter(p => p.id !== d.personId);
        state.draftPerson = null;
      }
      state.editing = null; rerender();
    },
    saveBox(contactId, sectionId, form) {
      const c = contactById(contactId); if (!c) return;
      if (window.TFFormGuard && TFFormGuard.validateScope && TFFormGuard.validateScope(form).length) { toast('Please fix the highlighted fields first.'); return; }
      const values = readForm(form);
      if (sectionId === 'company' && !String(values.name || '').trim()) { toast('Company name cannot be empty.'); return; }
      Object.keys(values).forEach(k => put(c, k, values[k]));
      state.editing = null;
      stamp(c, `Updated ${c.name} · ${sectionId}`);
      toast('✓ Saved');
    },
    savePerson(contactId, personId, form) {
      const c = contactById(contactId); if (!c) return;
      if (window.TFFormGuard && TFFormGuard.validateScope && TFFormGuard.validateScope(form).length) { toast('Please fix the highlighted fields first.'); return; }
      const values = readForm(form);
      const list = peopleOf(c).map(p => ({ ...p }));
      const p = list.find(x => x.id === personId); if (!p) return;
      Object.keys(values).forEach(k => { p[k] = String(values[k] || '').trim(); });
      c.people = list;
      if (!c.primaryPersonId) c.primaryPersonId = list[0].id;
      syncPrimary(c);
      state.editing = null;
      state.draftPerson = null;
      stamp(c, `Updated contact person of ${c.name}`);
      toast('✓ Saved');
    },
    addPerson(contactId) {
      const c = contactById(contactId); if (!c) return;
      const list = peopleOf(c).map(p => ({ ...p }));
      if (!c.primaryPersonId) c.primaryPersonId = list[0].id;
      const ids = new Set(list.map(p => p.id));
      let n = list.length + 1; while (ids.has('p' + n)) n++;
      list.push({ id: 'p' + n, name: '', role: '', phone: '', whatsapp: '', email: '', language: '', bestTime: '', upi: '', bankAccount: '', note: '' });
      c.people = list;
      state.draftPerson = { contactId, personId: 'p' + n };
      this.edit(contactId, 'person:p' + n);
    },
    removePerson(contactId, personId) {
      const c = contactById(contactId); if (!c) return;
      const list = peopleOf(c).filter(p => p.id !== personId);
      if (!list.length) return;
      ask('Remove this person?', 'Remove <b>' + esc(peopleOf(c).find(p => p.id === personId)?.name || 'this person') + '</b> from ' + esc(c.name || 'this partner') + '?', 'Remove person').then(ok => { if (!ok) return;
      c.people = list;
      if (c.primaryPersonId === personId) c.primaryPersonId = list[0].id;
      syncPrimary(c);
      state.editing = null; state.draftPerson = null;
      stamp(c, `Removed a contact person from ${c.name}`);
      });
    },
    makePrimary(contactId, personId) {
      const c = contactById(contactId); if (!c) return;
      c.people = peopleOf(c).map(p => ({ ...p }));
      c.primaryPersonId = personId;
      syncPrimary(c);
      stamp(c, `Changed primary contact of ${c.name}`);
    },
    async uploadLogo(contactId, input) {
      const c = contactById(contactId); const file = input.files && input.files[0]; if (!c || !file) return;
      try { c.logo = await storeImage(c.id, 'logo', await shrinkImage(file, 320)); c.logoUrl = ''; stamp(c, `Updated photo of ${c.name}`); toast('✓ Photo updated'); } catch (e) { toast(e.message); } finally { input.value = ''; }
    },
    async uploadPersonPhoto(contactId, personId, input) {
      const c = contactById(contactId); const file = input.files && input.files[0]; if (!c || !file) return;
      try { const list = peopleOf(c).map(p => ({ ...p })); const p = list.find(x => x.id === personId); if (!p) return; p.photo = await storeImage(c.id, 'person-' + p.id, await shrinkImage(file, 240)); c.people = list; if (!c.primaryPersonId) c.primaryPersonId = list[0].id; stamp(c, `Updated person photo for ${c.name}`); } catch (e) { toast(e.message); }
    },
    async uploadCard(contactId, side, input) {
      const c = contactById(contactId); const file = input.files && input.files[0]; if (!c || !file) return;
      try { const url = await storeImage(c.id, 'card-' + side, await shrinkImage(file, 1400)); c.businessCard = { ...(c.businessCard || {}), [side]: url }; stamp(c, `Saved business card of ${c.name}`); toast('✓ Business card saved'); } catch (e) { toast(e.message); } finally { input.value = ''; }
    },
    removeCard(contactId, side) {
      const c = contactById(contactId); if (!c || !c.businessCard) return;
      ask('Remove business card image?', 'Remove the <b>' + esc(side) + '</b> of the business card?', 'Remove').then(ok => { if (!ok) return;
      const card = { ...c.businessCard }; delete card[side]; c.businessCard = card;
      storeImage(c.id, 'card-' + side, '').catch(() => {});
      stamp(c, `Removed business card image of ${c.name}`); });
    },
    viewImage(contactId, side) { state.overlay = { kind: 'image', contactId, side }; rerender(); },
    folder(contactId, orderId) { state.overlay = { kind: 'folder', contactId, orderId }; rerender(); },
    closeOverlay() { state.overlay = null; rerender(); },
    dealSuggestions(contactId) { const c = contactById(contactId); return c ? dealSuggestions(appRef(), c) : []; },
    reminderText(contactId) { const c = contactById(contactId); return c ? reminderText(appRef(), c) : null; },
    statementRows(contactId) { const c = contactById(contactId); return c ? statementRows(appRef(), c) : null; },
    addDeal(contactId, label) {
      const c = contactById(contactId); if (!c) return;
      c.dealsIn = [...splitList(c.dealsIn), label].join(', ');
      stamp(c, `Added "${label}" to ${c.name}`); toast(`✓ Added ${label}`);
    },
    remind(contactId) {
      const c = contactById(contactId); if (!c) return;
      const p = primaryOf(c) || {};
      const phone = String(p.whatsapp || p.phone || c.whatsappPhone || c.phone || '').replace(/[^0-9]/g, '');
      const { text, count } = reminderText(appRef(), c);
      if (!count) { toast('Nothing is due from ' + c.name + '.'); return; }
      const to = phone.length === 10 ? '91' + phone : phone;
      const url = (to ? 'https://wa.me/' + to : 'https://wa.me/') + '?text=' + encodeURIComponent(text);
      window.open(url, '_blank', 'noopener');
      if (!to) toast('No WhatsApp number saved – choose the contact in WhatsApp.');
    },
    async statement(contactId) {
      const a = appRef(); const c = contactById(contactId); if (!c) return;
      const st = statementRows(a, c);
      const prof = a.data.businessProfile || {};
      const el = document.createElement('div');
      el.className = 'tf-statement';
      el.innerHTML = `<div class="tf-st-head"><div><h1>${esc(prof.legalName || prof.brandName || 'Statement')}</h1><p>${esc([prof.gstin && 'GSTIN ' + prof.gstin, prof.city].filter(Boolean).join(' · '))}</p></div>
          <div class="tf-st-right"><h2>Statement of account</h2><p>${esc(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))}</p></div></div>
        <div class="tf-st-party"><b>${esc(c.name)}</b> · ${esc(st.label)}${c.gstin ? ' · GSTIN ' + esc(c.gstin) : ''}<br>${esc(c.billingAddress || [c.city, c.state].filter(Boolean).join(', '))}</div>
        <table><thead><tr><th>Date</th><th>Particulars</th><th>Reference</th><th class="n">${c.role === 'retailer' ? 'Billed' : 'Bill'} (₹)</th><th class="n">${c.role === 'retailer' ? 'Received' : 'Paid'} (₹)</th><th class="n">Balance (₹)</th></tr></thead><tbody>
          ${st.opening ? `<tr><td></td><td>Opening balance</td><td></td><td></td><td></td><td class="n">${esc(inr(st.opening).slice(1))}</td></tr>` : ''}
          ${st.rows.map(x => `<tr><td>${esc(longDate(x.date))}</td><td>${esc(x.what)}</td><td>${esc(x.ref)}${x.order ? ' · ' + esc(x.order) : ''}</td><td class="n">${x.debit ? esc(inr(x.debit).slice(1)) : ''}</td><td class="n">${x.credit ? esc(inr(x.credit).slice(1)) : ''}</td><td class="n">${esc(inr(x.balance).slice(1))}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="5">${st.closing >= 0 ? (c.role === 'retailer' ? 'Balance due from ' : 'Balance payable to ') + esc(c.name) : 'Advance with ' + esc(c.name)}</td><td class="n">${esc(inr(Math.abs(st.closing)))}</td></tr></tfoot></table>
        <p class="tf-st-foot">Computer-generated statement from TradeFlow. Please report any difference within 7 days.</p>`;
      const file = `Statement_${String(c.name || c.id).replace(/[^A-Za-z0-9]+/g, '_')}_${today()}.pdf`;
      if (typeof window.html2pdf === 'function') {
        document.body.appendChild(el);
        try { await window.html2pdf().set({ margin: 10, filename: file, html2canvas: { scale: 2, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(el).save(); toast('✓ Statement downloaded'); }
        catch (e) { toast('Could not create the PDF: ' + e.message); }
        finally { el.remove(); }
      } else {
        const w = window.open('', '_blank'); if (!w) return;
        w.document.write('<title>' + esc(file) + '</title>'); w.document.body.appendChild(el); w.print();
      }
    },
    async deleteInvoice(contactId, orderId) {
      const a = appRef(); const c = contactById(contactId); const o = (a.data.orders || []).find(x => x.id === orderId);
      if (!c || !o) return;
      const docs = invoiceDocsFor(a, c, o);
      if (!docs.length) { toast('This order has no saved invoice file.'); return; }
      const names = docs.map(d => esc((d.metadata && d.metadata.customFileName) || d.fileName || 'Invoice')).join('<br>');
      const ok = await ask('Delete invoice?', `Delete the saved invoice for <b>${esc(o.invoiceNumber || o.id)}</b>?<br><br>${names}<br><br><span class="text-xs">The order, its amounts and payments do not change. You can undo this right after.</span>`, 'Delete invoice');
      if (!ok) return;
      removeDocs(c, docs, 'Invoice deleted for ' + (o.invoiceNumber || o.id));
      toast('Invoice deleted');
    },
    async deleteFile(contactId, docId) {
      const a = appRef(); const c = contactById(contactId); const d = (a.data.documents || []).find(x => x.id === docId);
      if (!c || !d) return;
      const name = (d.metadata && d.metadata.customFileName) || d.fileName || 'this file';
      const ok = await ask('Delete file?', `Delete <b>${esc(name)}</b> from this order's folder?`, 'Delete file');
      if (!ok) return;
      removeDocs(c, [d], 'File deleted: ' + name);
    },
    undoDelete() {
      const a = appRef(); const u = state.undo; if (!u) return;
      const have = new Set((a.data.documents || []).map(d => d.id));
      a.data.documents = [...(a.data.documents || []), ...u.docs.filter(d => !have.has(d.id))];
      state.undo = null;
      a.saveData('Operator', 'Undo delete');
      rerender(); toast('Restored');
    },
    dismissUndo() { state.undo = null; rerender(); },
    copy(text, label) { const a = appRef(); if (a && a.copyToClipboard) a.copyToClipboard(text, label); },
    _state: state
  };

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.overlay) { state.overlay = null; rerender(); } });
})();
