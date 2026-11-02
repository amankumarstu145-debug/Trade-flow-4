// TradeFlow 2026 - Master State Engine & Modern Interactive Architecture

class TradeFlowApp {
  static RECORD_TABLES = ['orders', 'contacts', 'products', 'payments', 'documents'];
  constructor() {
    this.storageKey = 'TRADEFLOW_DATA_V3';
    this.data = this.loadData();
    this.activeTab = 'orders';
    this.statusFilter = 'all';
    this.searchQuery = '';
    this.selectedOrder = null;
    this.currentInvoiceOrder = null;
    this.isInvoiceEditMode = false;
    this.invoiceDraftData = null;
    this.isInvoiceMaximized = false;
    this.isOrderModalMaximized = false;
    this.isFactoryPOMaximized = false;
    this.orderSkuItems = [];
    this.currentFactoryPOOrder = null;
    
    // Trade Margin & Order Profit Calculator State (Simple 1-Row + Advanced Multi-Product)
    this.calcMode = 'simple';
    this.simpleCalcData = this.getInitialSimpleCalc();
    this.advancedCalcProducts = this.getInitialAdvancedCalc();

    // Smart Invoice & Billing Studio State
    this.studioSelectedOrderId = null;
    this.studioDraftData = null;
    this.studioShowQr = true;
    this.studioShowSeal = true;
    this.studioShowCases = true;
    this.studioIsEditMode = false;
    this.isInvoiceStudioMaximized = false;
    this.studioHideHsn = false;
    this.studioActiveDocType = 'TAX INVOICE';
    this.studioActiveStep = 0;
    this.studioIsDirty = false;
    this.studioValidationIssues = [];
    this.studioTargetDocType = null;
    this.studioCreditReason = 'Damaged Goods in Transit';
    this.studioCreditInvoiceId = null;
    this.studioAdvancePaymentMode = 'UPI';
    this.studioAdvanceUtr = '';
    this.studioChallanPurpose = 'Job Work / Supply to Processor';

    // Workspace Multi-Tab and Navigation History Engine
    this.openTabs = [
      { id: 'tab-orders', title: 'Orders Pipeline', icon: 'boxes', type: 'orders', closeable: false }
    ];
    this.activeWorkspaceTab = 'tab-orders';
    this.navigationStack = [];
    this.activeOrderId = null;
    this.activeContactId = null;
    this.selectedSearchIndex = -1;
    this.activeKpiType = null;
    this.isUrgentAlertHidden = typeof localStorage !== 'undefined' && localStorage.getItem('tradeflow_urgent_hidden') === 'true';
    this.expandedOrderSkus = new Set();
    this.docPreviewZoom = 1.0;
    this.currentReviewDoc = null;
    this.pendingDocOrderId = null;
    this.pendingDocCategory = null;

    // Payment Ledger & Cockpit State
    this.paymentsState = {
      query: '',
      direction: 'all',
      category: 'all',
      dateFrom: '',
      dateTo: '',
      sortField: 'date',
      sortDirection: 'desc',
      page: 1,
      perPage: 25,
      activePaymentId: null,
      activeDocEntry: null,
      paymentFormDirection: 'received'
    };

    // Orders Pipeline Sort State
    this.ordersSortField = 'date';
    this.ordersSortDirection = 'desc';

    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/lib/pdf.worker.min.js';
    }

    this.isAIEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('tradeflow_ai_enabled') === 'true';
    this.omniboxFilter = 'all';
    this.omniboxSelectedIdx = -1;

    this.initTheme();
    this.init();
    this.initRoleMode();
    this.initAIMode();
    this.initOmniboxSearch();
    this.updateRecycleBinBadge();
  }

  findOrder(orderId) {
    if (!orderId) return null;
    const str = String(orderId).trim();
    return this.data.orders.find(o => 
      o.id === str || 
      o.invoiceNumber === str || 
      o.id === `ORD-${str}` || 
      o.invoiceNumber === `INV-${str}` ||
      (o.id && o.id.toLowerCase() === str.toLowerCase()) ||
      (o.invoiceNumber && o.invoiceNumber.toLowerCase() === str.toLowerCase())
    ) || null;
  }

  // QR image as a data URL, or '' when the text is too long for a QR code.
  createQrDataUrl(text) {
    try {
      const code = qrcode(0, 'M');
      code.addData(String(text));
      code.make();
      return code.createDataURL(5, 4);
    } catch (err) {
      console.warn('QR code not generated:', err.message);
      return '';
    }
  }

  /* ---------- UNIVERSAL CONTACT & HARD-RULE PROFILE RESOLUTION ENGINE ---------- */
  findContact(identifier) {
    if (!identifier) return null;
    const str = String(identifier).trim().toLowerCase();
    const contacts = this.data.contacts || [];

    // 1. Exact ID match
    let found = contacts.find(c => c.id && c.id.toLowerCase() === str);
    if (found) return found;

    // 2. Exact Name match
    found = contacts.find(c => c.name && c.name.toLowerCase() === str);
    if (found) return found;

    // 3. Exact Contact Person match
    found = contacts.find(c => c.contactPerson && c.contactPerson.toLowerCase() === str);
    if (found) return found;

    // 4. Substring / Containment match
    found = contacts.find(c => {
      const cName = (c.name || '').toLowerCase();
      const cPerson = (c.contactPerson || '').toLowerCase();
      const cBrand = (c.brandName || '').toLowerCase();
      return (cName && (str.includes(cName) || cName.includes(str))) ||
             (cPerson && (str.includes(cPerson) || cPerson.includes(str))) ||
             (cBrand && (str.includes(cBrand) || cBrand.includes(str)));
    });
    if (found) return found;

    // 5. Significant token match (skip stop words)
    const stopWords = new Set(['m/s', 'shri', 'mr', 'and', 'the', 'pvt', 'ltd', 'limited', 'foods', 'agro', 'traders', 'supermarket', 'logistics', 'transport', 'agency', 'broker']);
    const tokens = str.split(/[\s,·\-_/]+/).map(t => t.toLowerCase()).filter(t => t.length >= 3 && !stopWords.has(t));
    if (tokens.length > 0) {
      found = contacts.find(c => {
        const fullTxt = `${c.name || ''} ${c.contactPerson || ''} ${c.brandName || ''}`.toLowerCase();
        return tokens.some(t => fullTxt.includes(t));
      });
      if (found) return found;
    }

    return null;
  }

  // Next number for an ID series (ORD/INV, CNT, ...). Uses the highest number ever issued, including
  // deleted records and a stored high-water mark, so a number is never handed out twice.
  nextSequenceNumber(series, prefixes, records, minimum = 0) {
    const pattern = new RegExp('^(?:' + prefixes.join('|') + ')-(\\d+)$', 'i');
    let highest = minimum;
    for (const record of [...records, ...(this.data.recycleBin || [])]) {
      for (const value of [record && record.id, record && record.invoiceNumber]) {
        const match = pattern.exec(String(value || ''));
        if (match) highest = Math.max(highest, Number(match[1]));
      }
    }
    this.data.idCounters = this.data.idCounters || {};
    const next = Math.max(highest, Number(this.data.idCounters[series]) || 0) + 1;
    this.data.idCounters[series] = next;
    return next;
  }

  // Next order: one sequential number shared by the order ID and its invoice number (with your prefix).
  nextOrderNumbers() {
    const cfg = this.config();
    const n = this.nextSequenceNumber('order', ['ORD', 'INV'], this.data.orders || [], Math.max(0, cfg.startingNumber - 1));
    return { n, orderId: `ORD-${n}`, invoiceNumber: `${cfg.invoicePrefix}${n}` };
  }

  nextContactId() {
    return `CNT-${String(this.nextSequenceNumber('contact', ['CNT'], this.data.contacts || [])).padStart(2, '0')}`;
  }

  // Adds (sign 1) or reverses (sign -1) one payment's effect on its order's running totals.
  // Used when a payment is recorded, edited, deleted, restored or undone, so balances never drift.
  applyPaymentToOrder(payment, sign = 1) {
    if (!payment || !payment.orderRef) return;
    const order = this.findOrder(payment.orderRef);
    if (!order) return;
    const amount = (Number(payment.amount) || 0) * sign;
    const round2 = v => Math.round(v * 100) / 100;
    const type = payment.partyType || payment.category;
    if (payment.direction === 'received') {
      order.customerAdvanceReceived = Math.max(0, round2((Number(order.customerAdvanceReceived) || 0) + amount));
      order.customerBalanceDue = Math.max(0, round2((Number(order.totalInvoiceAmount) || 0) - order.customerAdvanceReceived));
      if (order.customerBalanceDue === 0 && order.status === 'delivered_overdue') order.status = 'settled';
      else if (order.customerBalanceDue > 0 && order.status === 'settled') order.status = 'delivered_overdue';
    } else if (type === 'manufacturer') {
      order.manufacturerAdvancePaid = Math.max(0, round2((Number(order.manufacturerAdvancePaid) || 0) + amount));
      if (sign > 0 && order.status === 'action_needed') { order.status = 'in_production'; order.urgentAlert = null; }
    } else if (type === 'packaging') {
      order.packagingAdvancePaid = Math.max(0, round2((Number(order.packagingAdvancePaid) || 0) + amount));
    }
  }

  // Total of payments recorded as paid to a partner (matched by partner id, else by name).
  paymentsPaidToContact(contact) {
    const name = String(contact.name || '').trim().toLowerCase();
    return (this.data.payments || []).filter(p => !p.isDeleted && p.direction === 'paid' && ((p.partyId && p.partyId === contact.id) || (name && String(p.partyName || '').trim().toLowerCase() === name)))
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }

  // Units per case for each pack size, kept in the business profile so they persist and can be edited.
  get casePackConfig() {
    const profile = this.data && this.data.businessProfile;
    if (!profile) return (this._casePackFallback = this._casePackFallback || {});
    if (!profile.casePacks || typeof profile.casePacks !== 'object') profile.casePacks = {};
    return profile.casePacks;
  }

  /* ---------- Business defaults: every default lives in the business profile (Settings > Business Profile) ---------- */
  config() {
    const p = (this.data && this.data.businessProfile) || {};
    const num = (value, fallback) => (value === undefined || value === null || value === '' || !Number.isFinite(Number(value))) ? fallback : Number(value);
    const fyStart = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    return {
      brand: p.brandName || p.legalName || 'Your Company',
      legalName: p.legalName || p.brandName || '',
      city: p.city || '',
      state: p.state || '',
      stateCode: p.stateCode || (p.gstin ? String(p.gstin).slice(0, 2) : ''),
      defaultGstRate: num(p.defaultGstRate, 12),
      defaultHsn: p.defaultHsn || '',
      defaultPaymentTerms: p.defaultPaymentTerms || p.paymentTerms || 'Net 15 Days',
      defaultCommissionRate: num(p.defaultCommissionRate, 3),
      manufacturerAdvancePct: num(p.manufacturerAdvancePct, 30),
      bookingAdvancePct: num(p.bookingAdvancePct, 30),
      defaultCasePack: Math.max(1, Math.round(num(p.defaultCasePack, 24))),
      jurisdiction: p.jurisdiction || p.city || '',
      defaultFreightTerms: p.defaultFreightTerms || '',
      calcTransportPct: num(p.calcTransportPct, 5),
      calcProfitPct: num(p.calcProfitPct, 20),
      calcMarketeerPct: num(p.calcMarketeerPct, 30),
      invoicePrefix: p.invoicePrefix || 'INV-',
      startingNumber: num(p.startingNumber, 1001),
      financialYear: `${fyStart}-${String(fyStart + 1).slice(-2)}`,
      placeOfSupply: p.state ? `${p.state}${p.stateCode ? ` (${p.stateCode})` : ''}` : ''
    };
  }

  // Notes printed on invoices: the profile's own notes, else a generic set ending with the jurisdiction line.
  defaultInvoiceNotes() {
    const profileNotes = this.data.businessProfile && this.data.businessProfile.invoiceNotes;
    if (profileNotes) return profileNotes;
    const lines = ['Goods once sold and inspected will not be returned without authorization.', 'Transit damage claims must be lodged with LR endorsement within 24 hours.', this.jurisdictionLine()].filter(Boolean);
    return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
  }

  // "Subject to <city> Jurisdiction" line, or '' when no city is set.
  jurisdictionLine() {
    const city = this.config().jurisdiction;
    return city ? `Subject to ${city} Jurisdiction.` : '';
  }

  /* ---------- GST: one place for rates, amounts and labels ---------- */
  // Rate for one invoice line: the line's own rate, else its product's rate, else the profile default, else 12%.
  itemGstRate(item) {
    const valid = value => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
    if (item && valid(item.gstRate)) return Number(item.gstRate);
    const product = item && (this.data.products || []).find(p => (item.productId && p.id === item.productId) || (item.sku && p.sku === item.sku) || (item.name && p.name === item.name));
    if (product && valid(product.gstRate)) return Number(product.gstRate);
    if (product && valid(product.gst)) return Number(product.gst); // older records
    return this.config().defaultGstRate;
  }

  // Tax is worked out per line at that line's rate and rounded to paise, then added up.
  computeGst(items, interState) {
    const round2 = value => Math.round((value + Number.EPSILON) * 100) / 100;
    let taxable = 0, cgst = 0, sgst = 0, igst = 0;
    const rates = new Set();
    for (const item of items || []) {
      const amount = Number(item && item.totalAmount) || 0;
      const rate = this.itemGstRate(item);
      rates.add(rate);
      taxable += amount;
      if (interState) igst += round2(amount * rate / 100);
      else { const half = round2(amount * rate / 200); cgst += half; sgst += half; }
    }
    return { taxable: round2(taxable), cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst), total: round2(taxable + cgst + sgst + igst), rates: [...rates].sort((a, b) => a - b) };
  }

  // HSN code for a line: its own, else its product's.
  itemHsn(item) {
    const product = item && (this.data.products || []).find(p => (item.productId && p.id === item.productId) || (item.name && p.name === item.name));
    return String((item && (item.hsn || item.hsnCode)) || (product && (product.hsn || product.hsnCode)) || this.config().defaultHsn || '—');
  }

  // One summary row per HSN code and GST rate, as a tax invoice requires.
  hsnSummaryRows(items, interState) {
    const groups = new Map();
    for (const item of items || []) {
      const key = this.itemHsn(item) + '|' + this.itemGstRate(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups.entries()].map(([key, groupItems]) => {
      const [hsn, rate] = key.split('|');
      return { hsn, rate: Number(rate), ...this.computeGst(groupItems, interState) };
    });
  }

  // Rates used by an order (stored when last calculated, else derived from its items).
  orderGstRates(order) {
    if (order && Array.isArray(order.gstRates) && order.gstRates.length) return order.gstRates;
    const items = (order && order.items) || [];
    return items.length ? [...new Set(items.map(item => this.itemGstRate(item)))].sort((a, b) => a - b) : [12];
  }

  // Display strings, e.g. { cgst: 'CGST (9%)', igst: 'IGST (18%)', combined: 'CGST 9% + SGST 9%' }.
  gstLabels(order, interState) {
    const rates = this.orderGstRates(order);
    const inter = interState === undefined ? !(order && order.gstType === 'intra') : interState;
    const fmt = n => String(Math.round(n * 100) / 100);
    if (rates.length !== 1) {
      return { single: false, rate: null, cgst: 'CGST', sgst: 'SGST', igst: 'IGST', combined: inter ? 'IGST (mixed rates)' : 'CGST + SGST (mixed rates)', total: 'GST (mixed rates)' };
    }
    const r = rates[0];
    return { single: true, rate: r, cgst: `CGST (${fmt(r / 2)}%)`, sgst: `SGST (${fmt(r / 2)}%)`, igst: `IGST (${fmt(r)}%)`, combined: inter ? `IGST ${fmt(r)}%` : `CGST ${fmt(r / 2)}% + SGST ${fmt(r / 2)}%`, total: `GST ${fmt(r)}%` };
  }

  ensureContact(partyName, defaultRole = 'manufacturer') {
    let contact = this.findContact(partyName);
    if (contact) return contact;

    const cleanName = String(partyName || 'New Partner').trim();
    const newId = this.nextContactId();
    const isRetailer = /supermarket|mart|kirana|stores|retail|buyer/i.test(cleanName);
    const isTransporter = /transport|logistics|cargo|roadways/i.test(cleanName);
    const isPackaging = /pack|polymer|flexo|box|carton|label/i.test(cleanName);
    const isMarketeer = /broker|agent|channel|sales/i.test(cleanName);

    let role = defaultRole;
    if (isRetailer) role = 'retailer';
    else if (isTransporter) role = 'transporter';
    else if (isPackaging) role = 'packaging';
    else if (isMarketeer) role = 'marketeer';

    // Created from a name only: every other detail is left blank for the user to complete, never guessed.
    const newContact = {
      id: newId,
      name: cleanName,
      contactPerson: '',
      role: role,
      phone: '',
      email: '',
      gstin: '',
      billingAddress: '',
      shippingAddress: '',
      bankDetails: { bankName: '', accountNumber: '', ifsc: '', beneficiaryName: '' },
      bankName: '',
      accountNumber: '',
      ifsc: '',
      needsDetails: true,
      paymentTerms: this.config().defaultPaymentTerms,
      totalOrders: 1,
      currentBalanceDue: 0,
      createdAt: new Date().toISOString()
    };

    if (!this.data.contacts) this.data.contacts = [];
    this.data.contacts.push(newContact);
    return newContact;
  }

  openPartyProfile(partyNameOrId, options = {}) {
    if (!partyNameOrId) return;
    const contact = this.ensureContact(partyNameOrId);
    if (!contact) return;

    // Check if daily-diary-modal is open and active
    const diaryModal = document.getElementById('daily-diary-modal');
    const isDiaryModalOpen = diaryModal && !diaryModal.classList.contains('hidden');

    if (options.forceTab || (!isDiaryModalOpen && options.preferTab !== false)) {
      this.closeDailyDiaryModal();
      this.navigateToContact(contact.id);
    } else {
      // In modal mode: open partner spotlight modal elevated on top
      this.openPartnerSpotlightModal(contact.id);
    }
  }

  openOrderFromDiary(orderRef) {
    if (!orderRef) return;
    const order = this.findOrder(orderRef);
    if (!order) {
      this.showToast(`Order "${orderRef}" not found`);
      return;
    }
    // Close diary modal if open so the user transitions smoothly into order detail view
    this.closeDailyDiaryModal();
    this.openOrderDetailPage(order.id);
  }

  toggleUrgentAlertBanner() {
    this.isUrgentAlertHidden = !this.isUrgentAlertHidden;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tradeflow_urgent_hidden', this.isUrgentAlertHidden ? 'true' : 'false');
      }
    } catch (e) {
      console.error(e);
    }
    this.renderKPIs();
    if (window.lucide) window.lucide.createIcons();
  }

  /* ---------- LIVE PRECISION CLOCK ENGINE (OPTION 4: DD-MMM-YYYY) ---------- */
  getLiveFormattedDateTime(d = new Date()) {
    return `${this.formatDateWithDay(d)} • ${this.formatTime(d, true)}`;
  }

  updateLiveClock() {
    const d = new Date();
    const clockEl = document.getElementById('topbar-clock-text');
    if (clockEl) {
      clockEl.textContent = this.formatTime(d, true);
    }
    const clockDate = document.getElementById('topbar-clock-date');
    if (clockDate) clockDate.textContent = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

    const popoverTime = document.getElementById('clock-popover-time');
    const popoverDate = document.getElementById('clock-popover-date');
    if (popoverTime) {
      popoverTime.textContent = this.formatTime(d, true);
    }
    if (popoverDate) {
      popoverDate.textContent = this.formatDateWithDay(d);
    }
  }

  toggleClockPopover() {
    const popover = document.getElementById('topbar-clock-popover');
    if (popover) {
      popover.classList.toggle('hidden');
    }
  }

  initLiveClock() {
    this.updateLiveClock();
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.clockInterval = setInterval(() => {
      this.updateLiveClock();
    }, 1000);

    // Auto-close clock popover and card kebab menus when clicking outside
    document.addEventListener('click', (e) => {
      const clockBtn = document.getElementById('topbar-live-clock');
      const popover = document.getElementById('topbar-clock-popover');
      if (popover && !popover.classList.contains('hidden')) {
        if (clockBtn && !clockBtn.contains(e.target) && !popover.contains(e.target)) {
          popover.classList.add('hidden');
        }
      }

      // Auto-close partner card kebab menus
      if (!e.target.closest('.tf-kebab-btn-v4') && !e.target.closest('.tf-kebab-menu-popup')) {
        document.querySelectorAll('.tf-kebab-menu-popup').forEach(m => m.classList.add('hidden'));
      }
    });
  }

  initTheme() {
    const savedTheme = localStorage.getItem('tradeflow_theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme ? savedTheme === 'dark' : systemPrefersDark;
    
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('tradeflow_theme', isDark ? 'dark' : 'light');
    this.updateThemeButton();
  }

  updateThemeButton() {
    const isDark = document.documentElement.classList.contains('dark');
    const themeIcons = document.querySelectorAll('.theme-toggle-icon');
    const themeLabels = document.querySelectorAll('.theme-toggle-label');
    
    themeIcons.forEach(icon => {
      icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    });
    themeLabels.forEach(lbl => {
      lbl.innerText = isDark ? 'Light Mode' : 'Dark Mode';
    });

    if (window.lucide) window.lucide.createIcons();
  }

  loadData() {
    try {
      if (typeof localStorage !== 'undefined' && typeof localStorage.removeItem === 'function') {
        localStorage.removeItem('TRADEFLOW_DATA_V2');
        localStorage.removeItem('TRADEFLOW_DATA_V1');
        localStorage.removeItem('TF_PAYLOG_V1');
      }
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.orders && parsed.contacts) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Using initial dataset', e);
    }
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  // Saves run one at a time so each carries the timestamp returned by the previous one.
  saveData(userName = 'Operator', reason = 'App State Update') {
    this._saveChain = (this._saveChain || Promise.resolve()).then(() => this._saveDataNow(userName, reason));
    return this._saveChain;
  }

  get tabId() {
    if (!this._tabId) this._tabId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'tab-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    return this._tabId;
  }

  async _saveDataNow(userName, reason) {
    // 1. Cache to localStorage for offline resilience
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.data));
      if (this.data && this.data.payments) {
        localStorage.setItem('TF_PAYLOG_V1', JSON.stringify(this.data.payments));
      }
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }

    // 2. Persist to authoritative backend SQLite master store.
    //    Only the records that changed since the last save are sent; the whole set goes only when
    //    there is nothing to compare against yet (first save, or the server was not reachable at start).
    const diff = this.collectChanges();
    if (diff && diff.count === 0) return;
    try {
      const resp = diff
        ? await fetch('/api/data/changes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: diff.changes, userName, reason, baseTimestamp: this.serverSyncedAt || null, tabId: this.tabId })
        })
        : await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: this.data, userName, reason, baseTimestamp: this.serverSyncedAt || null, tabId: this.tabId })
        });
      const res = await resp.json();

      if (res.success) {
        if (res.timestamp) this.serverSyncedAt = res.timestamp;
        this.rememberSaved(diff ? diff.saved : this.savedState(this.data));
        if (Array.isArray(res.conflicts) && res.conflicts.length) {
          // Another window, the phone or an import changed these records first; their version was kept.
          const ids = res.conflicts.map(c => c.id).slice(0, 5).join(', ');
          await this.syncAuthoritativeDataFromServer();
          this.render();
          this.showSyncAlert(`Some records were changed elsewhere before this save (${ids}${res.conflicts.length > 5 ? '…' : ''}). The newer version was kept and this window has been refreshed. Please check and redo your last change if needed.`);
        }
        if (res.excelSync && res.excelSync.locked) {
          this.showSyncAlert('TradeFlow_Master_Database.xlsx is currently open in Microsoft Excel. Data is saved safely to TradeFlow DB, but Excel sync is paused. Close the file and click Retry Sync.');
          this.updateExcelSyncPill('locked');
        } else if (res.excelSync && res.excelSync.success) {
          this.hideSyncAlert();
          this.updateExcelSyncPill('synced');
        }
      } else {
        this.showSyncAlert(`Database save error: ${res.error || 'Failed to save to backend'}`);
        this.updateExcelSyncPill('error');
      }
    } catch (err) {
      console.warn('Could not reach backend server; running in offline fallback mode:', err);
      this.showSyncAlert('Backend server unreachable. Running in offline fallback mode.');
      this.updateExcelSyncPill('offline');
    }
  }

  // What the server holds, as text per record, so the next save can send only what changed.
  savedState(data) {
    const state = { tables: {}, meta: '' };
    for (const table of TradeFlowApp.RECORD_TABLES) {
      const rows = Array.isArray(data && data[table]) ? data[table] : [];
      const map = new Map();
      for (const row of rows) {
        if (!row || typeof row.id !== 'string' || !row.id.trim() || map.has(row.id)) return null; // let the server report it
        map.set(row.id, JSON.stringify(row));
      }
      state.tables[table] = map;
    }
    state.meta = JSON.stringify(this.metadataOf(data));
    return state;
  }

  metadataOf(data) {
    return Object.fromEntries(Object.entries(data || {}).filter(([key]) => !TradeFlowApp.RECORD_TABLES.includes(key)));
  }

  rememberSaved(state) { this._savedState = state || null; }

  // Returns null when a full save is needed, otherwise { changes, count, saved }.
  collectChanges() {
    const before = this._savedState;
    if (!before || !this.serverSyncedAt) return null;
    const now = this.savedState(this.data);
    if (!now) return null;
    const changes = { tables: {} };
    let count = 0;
    for (const table of TradeFlowApp.RECORD_TABLES) {
      const was = before.tables[table], is = now.tables[table];
      const upsert = [], remove = [];
      for (const [id, json] of is) if (was.get(id) !== json) upsert.push(JSON.parse(json));
      for (const id of was.keys()) if (!is.has(id)) remove.push(id);
      if (upsert.length || remove.length) { changes.tables[table] = { upsert, remove }; count += upsert.length + remove.length; }
    }
    if (now.meta !== before.meta) { changes.meta = JSON.parse(now.meta); count++; }
    return { changes, count, saved: now };
  }

  showSyncAlert(msg) {
    const banner = document.getElementById('system-sync-alert-banner');
    const text = document.getElementById('system-sync-alert-text');
    if (banner && text) {
      text.textContent = msg;
      banner.classList.remove('hidden');
    }
  }

  hideSyncAlert() {
    const banner = document.getElementById('system-sync-alert-banner');
    if (banner) banner.classList.add('hidden');
  }

  dismissSyncAlert() {
    this.hideSyncAlert();
  }

  async retryExcelSync() {
    this.showToast('↻ Retrying Excel Export...');
    try {
      const resp = await fetch('/api/sync/to-excel', { method: 'POST' });
      const res = await resp.json();
      if (res.success) {
        this.hideSyncAlert();
        this.updateExcelSyncPill('synced');
        this.showToast('Excel successfully synced!');
      } else if (res.locked) {
        this.showSyncAlert('Excel file is still open/locked in Microsoft Excel. Please close it and retry.');
        this.updateExcelSyncPill('locked');
      } else {
        this.showToast(`Sync failed: ${res.error || 'Unknown error'}`);
      }
    } catch (e) {
      this.showToast('Could not connect to sync service.');
    }
  }

  updateExcelSyncPill(status, time = null) {
    const dot = document.getElementById('excel-sync-dot');
    const label = document.getElementById('excel-sync-label');
    const pill = document.getElementById('topbar-excel-sync');
    if (!label) return;

    if (status === 'synced') {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 shrink-0';
      if (pill) pill.className = 'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 shadow-2xs cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors';
      label.textContent = time ? `Excel Synced (${time})` : 'Excel Synced';
    } else if (status === 'locked') {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0';
      if (pill) pill.className = 'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 shadow-2xs cursor-pointer hover:bg-amber-100 transition-colors';
      label.textContent = 'Excel Locked (Open)';
    } else if (status === 'error') {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0';
      if (pill) pill.className = 'inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 shadow-2xs cursor-pointer hover:bg-rose-100 transition-colors';
      label.textContent = 'Excel Sync Error';
    } else if (status === 'offline') {
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-slate-400 shrink-0';
      label.textContent = 'Offline Mode';
    }
  }

  async syncAuthoritativeDataFromServer() {
    try {
      const resp = await fetch('/api/data');
      if (resp.ok) {
        const json = await resp.json();
        if (json.success && json.data) {
          this.data = json.data;
          if (json.timestamp) this.serverSyncedAt = json.timestamp;
          this.rememberSaved(this.savedState(this.data));
          try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
          } catch (_) {}
          if (json.status) {
            this.updateExcelSyncPill(json.status.excelStatus || 'synced');
            if (json.status.excelStatus === 'locked') {
              this.showSyncAlert(json.status.lastError || 'TradeFlow_Master_Database.xlsx is open in Microsoft Excel.');
            } else {
              this.hideSyncAlert();
            }
          }
          console.log('[TradeFlow] Synced authoritative state from SQLite master store.');
          return true;
        }
      }
    } catch (e) {
      console.warn('[TradeFlow] Backend API unreachable, falling back to local dataset:', e.message);
      this.updateExcelSyncPill('offline');
    }
    return false;
  }

  formatCurrency(num) {
    if (isNaN(num) || num === null || num === undefined) return '₹0';
    const val = Number(num);
    const hasDecimals = val % 1 !== 0;
    return '₹' + val.toLocaleString('en-IN', {
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  /* ---------- CENTRALIZED DATE & TIME STANDARDIZATION ENGINE (OPTION 4: DD-MMM-YYYY) ---------- */
  formatDate(dateInput) {
    if (!dateInput) return '—';
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      const [y, m, d] = dateInput.trim().split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(m, 10) - 1;
      const mmm = months[mIdx] || m;
      return `${d.padStart(2, '0')}-${mmm}-${y}`;
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = months[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd}-${mmm}-${yyyy}`;
  }

  formatTime(timeInput, includeSeconds = false) {
    if (!timeInput) return '';
    if (typeof timeInput === 'string') {
      const tMatch = timeInput.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
      if (tMatch) {
        let h = parseInt(tMatch[1], 10);
        const m = tMatch[2];
        const s = tMatch[3] || '00';
        const existingAmpm = tMatch[4];
        let ampm = existingAmpm ? existingAmpm.toUpperCase() : (h >= 12 ? 'PM' : 'AM');
        if (!existingAmpm) {
          h = h % 12 || 12;
        }
        const hh = String(h).padStart(2, '0');
        return includeSeconds ? `${hh}:${m}:${s} ${ampm}` : `${hh}:${m} ${ampm}`;
      }
    }
    const d = timeInput instanceof Date ? timeInput : new Date(timeInput);
    if (isNaN(d.getTime())) return String(timeInput);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const hh = String(h).padStart(2, '0');
    return includeSeconds ? `${hh}:${m}:${s} ${ampm}` : `${hh}:${m} ${ampm}`;
  }

  formatDateTime(dateTimeInput, includeSeconds = false) {
    if (!dateTimeInput) return '—';
    const d = new Date(dateTimeInput);
    if (isNaN(d.getTime())) return String(dateTimeInput);
    return `${this.formatDate(d)} • ${this.formatTime(d, includeSeconds)}`;
  }

  formatDateWithDay(dateInput) {
    if (!dateInput) return '—';
    let d;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      const [y, m, day] = dateInput.trim().split('-');
      d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(day, 10));
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return String(dateInput);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[d.getDay()]}, ${this.formatDate(d)}`;
  }

  formatMonthYear(dateInput) {
    if (!dateInput) return '';
    let d;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}/.test(dateInput.trim())) {
      const parts = dateInput.trim().split('-');
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    } else {
      d = new Date(dateInput);
    }
    if (isNaN(d.getTime())) return String(dateInput);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${d.getFullYear()}`;
  }

  async init() {
    this.ordersPage = 1;
    this.ordersPageSize = 15;
    this.bindEvents();
    this.initLiveClock();
    this.initModalResizer();
    this.initLiveSearch();
    this.initExcelSync();
    this.initAuditNotices();
    this.initDashboardSplitResizer();
    await this.syncAuthoritativeDataFromServer();
    this.render();
    this.updateThemeButton();
  }

  /* ---------- LOGO CLICK NAVIGATION & REFRESH HANDLER ---------- */
  handleLogoClick() {
    const isAlreadyOnHome = this.activeTab === 'orders' && !this.activeOrderId && !this.activeContactId;

    // Close any open modals
    this.closeAllOpenModals();

    if (!isAlreadyOnHome) {
      // 1. If on another page/dossier: Navigate back to Home Dashboard ('orders')
      this.activeTab = 'orders';
      this.activeOrderId = null;
      this.activeContactId = null;
      this.searchQuery = '';
      this.statusFilter = 'all';

      const searchInput = document.getElementById('global-search');
      if (searchInput) searchInput.value = '';

      // Reset filter status pills to 'all'
      document.querySelectorAll('[data-filter-status]').forEach(btn => {
        if (btn.getAttribute('data-filter-status') === 'all') {
          btn.className = 'btn-tactile px-3 py-1 text-xs font-bold rounded-lg bg-emerald-700 text-white dark:bg-emerald-700 dark:text-white shadow-xs transition-all';
        } else {
          btn.className = 'btn-tactile px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
        }
      });

      this.updateSidebarUI();
      this.renderWorkspaceTabs();
      this.renderKPIs();
      this.renderActiveView();
      this.showToast('Returned to Home Dashboard (Orders Pipeline)');
    } else {
      // 2. If ALREADY on home page: Refresh dashboard & reload data
      this.searchQuery = '';
      this.statusFilter = 'all';

      const searchInput = document.getElementById('global-search');
      if (searchInput) searchInput.value = '';

      document.querySelectorAll('[data-filter-status]').forEach(btn => {
        if (btn.getAttribute('data-filter-status') === 'all') {
          btn.className = 'btn-tactile px-3 py-1 text-xs font-bold rounded-lg bg-emerald-700 text-white dark:bg-emerald-700 dark:text-white shadow-xs transition-all';
        } else {
          btn.className = 'btn-tactile px-3 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all';
        }
      });

      // Smooth spin animation on the logo icon
      const logoIcon = document.getElementById('sidebar-logo-icon');
      if (logoIcon) {
        logoIcon.classList.add('rotate-360', 'transition-transform', 'duration-500');
        setTimeout(() => logoIcon.classList.remove('rotate-360'), 550);
      }

      this.loadData();
      this.render();
      this.showToast('Home Dashboard Refreshed');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  closeAllOpenModals() {
    if (typeof this.closeLiveSearch === 'function') this.closeLiveSearch();
    if (typeof this.closeKpiBreakdownModal === 'function') this.closeKpiBreakdownModal();
    if (typeof this.closeUrgentActionsModal === 'function') this.closeUrgentActionsModal();
    if (typeof this.closeOrderDrawer === 'function') this.closeOrderDrawer();
    if (typeof this.closeInvoiceModal === 'function') this.closeInvoiceModal();
    if (typeof this.closeNewOrderModal === 'function') this.closeNewOrderModal();
    if (typeof this.closePaymentModal === 'function') this.closePaymentModal();
    if (typeof this.closePaymentDetailDrawer === 'function') this.closePaymentDetailDrawer();
    if (typeof this.closeDocPreview === 'function') this.closeDocPreview();
    if (typeof this.closeEditContactModal === 'function') this.closeEditContactModal();
  }

  // Phones and tablets: the sidebar slides in over the page instead of taking a fixed column.
  toggleMobileSidebar(force) {
    const open = typeof force === 'boolean' ? force : !document.body.classList.contains('tf-sidebar-open');
    document.body.classList.toggle('tf-sidebar-open', open);
    const btn = document.getElementById('tf-menu-btn');
    if (btn) { btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu'); }
  }

  bindEvents() {
    // Close the mobile sidebar after choosing a screen, and with Escape.
    document.getElementById('app-sidebar')?.addEventListener('click', e => {
      if (e.target.closest('button, a') && window.matchMedia('(max-width: 1023px)').matches) this.toggleMobileSidebar(false);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('tf-sidebar-open')) this.toggleMobileSidebar(false); });

    // Left Sidebar Navigation Items
    document.querySelectorAll('[data-sidebar-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-sidebar-tab');
        // The fixed first tab always shows the sidebar screen you are on (it used to stay "Orders Pipeline").
        const homeTab = (this.openTabs || []).find(t => t.id === 'tab-orders');
        if (homeTab) {
          homeTab.type = this.activeTab;
          homeTab.title = (btn.querySelector('span') || btn).textContent.trim() || this.getCurrentViewLabel();
          homeTab.icon = btn.querySelector('[data-lucide]')?.getAttribute('data-lucide') || homeTab.icon;
          this.activeWorkspaceTab = 'tab-orders';
        }
        this.updateSidebarUI();
        this.renderWorkspaceTabs();
        this.renderActiveView();
      });
    });

    // Theme Toggle Buttons
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleTheme());
    });

    // Keyboard shortcut for search (Ctrl+K or /)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === 'k') || (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName))) {
        e.preventDefault();
        const s = document.getElementById('global-search');
        if (s) { s.focus(); s.select(); }
      }
      if (e.key === 'Escape') {
        this.closeCompanyExecutiveHubModal();
        this.closeSheetsSyncHubModal();
        this.closeInvoiceStudioModal();
        this.closeStudioMetricsDrilldown();
        this.closeStudioMagicDrawer();
        this.closeLiveSearch();
        this.closeKpiBreakdownModal();
        this.closeUrgentActionsModal();
        this.closeOrderDrawer();
        this.closeInvoiceModal();
        this.closeNewOrderModal();
        this.closePaymentModal();
        this.closePaymentDetailDrawer();
        this.closeDocPreview();
        this.closeSettingsModal();
      }
    });

    // Payment Dropzone Drag & Drop
    const payDropzone = document.getElementById('payment-dropzone');
    if (payDropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        payDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          payDropzone.classList.add('border-amber-500', 'bg-amber-50/50', 'dark:bg-amber-950/20');
        }, false);
      });
      ['dragleave', 'drop'].forEach(eventName => {
        payDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          payDropzone.classList.remove('border-amber-500', 'bg-amber-50/50', 'dark:bg-amber-950/20');
        }, false);
      });
      payDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          const input = document.getElementById('payment-doc-file-input');
          if (input) {
            input.files = files;
            this.handlePaymentDocumentSelected({ target: input });
          }
        }
      }, false);
    }

    // Global Clipboard Paste Listeners for Intelligent Input Intake
    const newOrderModal = document.getElementById('new-order-modal');
    if (newOrderModal) {
      newOrderModal.addEventListener('paste', (e) => this.handleNewOrderClipboardPaste(e));
    }
    const paymentModal = document.getElementById('payment-modal');
    if (paymentModal) {
      paymentModal.addEventListener('paste', (e) => this.handlePaymentClipboardPaste(e));
    }

    // Status Filter Pills
    document.querySelectorAll('[data-filter-status]').forEach(btn => {
      btn.addEventListener('click', () => this.setOrdersFilter(btn.getAttribute('data-filter-status')));
    });

    // Forms
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveProfileSettings(new FormData(profileForm));
      });
    }

    const newOrderForm = document.getElementById('new-order-form');
    if (newOrderForm) {
      newOrderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleNewOrderSubmit(new FormData(newOrderForm));
      });
    }

    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
      paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handlePaymentSubmit(new FormData(paymentForm));
      });
    }
  }

  updateSidebarUI() {
    // Determine effective sidebar tab (contact-detail / order-detail map to parent categories)
    let effectiveTab = this.activeTab;
    if (this.activeTab === 'contact-detail' && this.activeContactId) {
      const c = this.data.contacts.find(x => x.id === this.activeContactId);
      const roleMap = { manufacturer: 'manufacturers', packaging: 'packaging', transporter: 'transport', retailer: 'retailers', marketeer: 'marketeers' };
      if (c && roleMap[c.role]) effectiveTab = roleMap[c.role];
    } else if (this.activeTab === 'order-detail' || this.activeTab === 'order-edit') {
      effectiveTab = 'orders';
    }

    document.querySelectorAll('[data-sidebar-tab]').forEach(btn => {
      const tab = btn.getAttribute('data-sidebar-tab');
      const isActive = tab === effectiveTab;
      if (isActive) {
        btn.className = 'flex items-center justify-between w-full px-3 py-2 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200 border border-emerald-500/25 shadow-xs transition-all';
      } else {
        btn.className = 'flex items-center justify-between w-full px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/60 transition-all';
      }
    });

    // Update Sidebar Badges
    const payBadge = document.getElementById('sidebar-payments-badge');
    if (payBadge) payBadge.innerText = this.data.payments ? this.data.payments.length : 0;

    const urgentBadge = document.getElementById('sidebar-urgent-badge');
    if (urgentBadge) {
      const urgentItems = this.getUrgentActionItems();
      urgentBadge.innerText = urgentItems.length;
      if (urgentItems.length > 0) {
        urgentBadge.classList.remove('hidden');
      } else {
        urgentBadge.classList.add('hidden');
      }
    }

    // Update Exceptions Badge
    const excBadge = document.getElementById('sidebar-exceptions-badge');
    if (excBadge) {
      const excItems = this.getExceptionsList ? this.getExceptionsList() : [];
      excBadge.innerText = excItems.length;
      if (excItems.length > 0) {
        excBadge.classList.remove('hidden');
      } else {
        excBadge.classList.add('hidden');
      }
    }

    // Update Top Breadcrumb (if present)
    const breadcrumb = document.getElementById('current-view-title');
    if (breadcrumb) {
      if (this.activeTab === 'order-detail') {
        const o = this.data.orders.find(x => x.id === this.activeOrderId);
        breadcrumb.innerText = o ? `Order Inspection • ${o.invoiceNumber} (${o.retailerName})` : 'Order Details';
      } else if (this.activeTab === 'contact-detail') {
        const c = this.data.contacts.find(x => x.id === this.activeContactId);
        breadcrumb.innerText = c ? `${c.name} • ${c.role.toUpperCase()} Hub` : 'Partner Profile';
      } else {
        const titles = {
          orders: 'Orders Pipeline & Operations',
          finance: 'Finance & Commercial Cockpit',
          vault: 'Document Vault & File Manager',
          payments: 'Payment Ledger & Cash Flow',
          manufacturers: 'Manufacturers',
          packaging: 'Packaging & Labels Suppliers',
          transport: 'Logistics & Transporters',
          retailers: 'Retailers & Buyers Directory',
          marketeers: 'Marketeers & Sales Brokers',
          products: 'Product Catalog',
          profile: 'Business Profile & Tax Settings',
          'daily-diary': 'Daily Business Diary (Roznamcha)',
          exceptions: 'Unified Exception Center',
          'executive-hub': `${this.config().brand} • Executive Hub & Corporate Operations`
        };
        breadcrumb.innerText = titles[this.activeTab] || 'Dashboard';
      }
    }
  }

  render() {
    this.applyBrandText();
    this.renderWorkspaceTabs();
    this.updateSidebarUI();
    this.renderKPIs();
    this.renderActiveView();
    this.populateProfileForm();
    this.populateNewOrderSelects();
    if (window.lucide) window.lucide.createIcons();
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  showToast(message) {
    // Messages read as plain text: any leading emoji is dropped (icons come from the design system).
    message = String(message ?? '').replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, '');
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'bg-slate-900/95 dark:bg-slate-900/95 text-white text-xs px-4 py-3 rounded-xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-2 pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 z-[999999] font-medium';
    const text = document.createElement('span');
    text.textContent = String(message);
    toast.appendChild(text);
    container.appendChild(toast);
    // Keep at most three messages on screen so they never cover the form.
    while (container.children.length > 3) container.firstElementChild.remove();
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);
    setTimeout(() => {
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  shareWhatsApp(orderId) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return;
    const retailer = this.data.contacts.find(c => c.id === order.retailerId);
    const phone = (retailer && (retailer.whatsappPhone || retailer.phone)) || order.customerPhone || '';
    
    let message = `Namaste ${order.retailerName},\n\n`;
    message += `Here is your order update for Invoice *${order.invoiceNumber}*:\n`;
    message += `• Product: ${order.items.map(i => `${i.quantity} Jars of ${i.variant}`).join(', ')}\n`;
    message += `• Total Bill: ${this.formatCurrency(order.totalInvoiceAmount)}\n`;
    message += `• Advance Received: ${this.formatCurrency(order.customerAdvanceReceived)}\n`;
    message += `• Remaining Balance: *${this.formatCurrency(order.customerBalanceDue)}*\n`;
    message += `• Status: ${order.status.replace(/_/g, ' ').toUpperCase()}\n`;
    if (order.lrNumber && order.lrNumber !== 'PENDING-DISPATCH') {
      message += `• Transport LR: ${order.lrNumber} (${order.transporterName})\n`;
    }
    message += `\nPlease find the attached GST Tax Invoice for your records.\nThank you,\n*${this.data.businessProfile.brandName}*`;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const encoded = encodeURIComponent(message);
    const url = targetPhone ? `https://wa.me/${targetPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  }

  // Profile Settings
  populateProfileForm() {
    const p = this.data.businessProfile;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('prof-brand-name', p.brandName);
    setVal('prof-legal-name', p.legalName);
    setVal('prof-gstin', p.gstin);
    setVal('prof-pan', p.pan);
    setVal('prof-fssai', p.fssai);
    setVal('prof-phone', p.phone);
    setVal('prof-email', p.email);
    setVal('prof-address', p.address);
    setVal('prof-city', p.city);
    setVal('prof-state', p.state);
    setVal('prof-state-code', p.stateCode);
    setVal('prof-pincode', p.pincode);
    setVal('prof-bank-name', p.bankName);
    setVal('prof-acc-holder', p.accountHolder);
    setVal('prof-acc-no', p.accountNumber);
    setVal('prof-ifsc', p.ifsc);
    setVal('prof-upi', p.upiId);
    setVal('prof-inv-notes', p.invoiceNotes);

    const brandHeader = document.getElementById('sidebar-brand-name');
    if (brandHeader) brandHeader.innerText = p.brandName || this.config().brand;
  }

  saveProfileSettings(formData) {
    const p = this.data.businessProfile;
    p.brandName = formData.get('brandName');
    p.legalName = formData.get('legalName');
    p.gstin = formData.get('gstin');
    p.pan = formData.get('pan');
    p.fssai = formData.get('fssai');
    p.phone = formData.get('phone');
    p.email = formData.get('email');
    p.address = formData.get('address');
    p.city = formData.get('city');
    p.state = formData.get('state');
    p.stateCode = formData.get('stateCode');
    p.pincode = formData.get('pincode');
    p.bankName = formData.get('bankName');
    p.accountHolder = formData.get('accountHolder');
    p.accountNumber = formData.get('accountNumber');
    p.ifsc = formData.get('ifsc');
    p.upiId = formData.get('upiId');
    p.invoiceNotes = formData.get('invoiceNotes');

    this.saveData();
    this.render();
    this.showToast('Business Profile & Tax Settings updated successfully! All invoices will now reflect these details.');
  }

  formatOrderSkuDisplay(items, orderId, contextPrefix = 'kpi') {
    if (!items || items.length === 0) {
      return `<span class="text-xs text-slate-400 italic">No SKU items listed</span>`;
    }

    const cleanName = (item) => {
      if (item.shortName) return item.shortName;
      if (!item.name) return 'Product';
      return item.name.split('(')[0].trim();
    };

    const drawerId = `${contextPrefix}-sku-drawer-${orderId}`;

    if (items.length <= 3) {
      return `
        <div class="flex items-center gap-1.5 flex-wrap">
          ${items.map(i => `
            <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-slate-700/60">
              ${tfEscapeHtml(cleanName(i))} <strong class="font-mono-num text-amber-600 dark:text-amber-400 font-bold">${tfEscapeHtml(i.cases || 0)} ${tfEscapeHtml((i.cases || 0) === 1 ? 'Case' : 'Cases')}</strong> (${tfEscapeHtml(i.packSize || '500g')})
            </span>
          `).join('')}
        </div>
      `;
    }

    // 4 or more varieties (e.g. 14 varieties)
    const previewItems = items.slice(0, 2);
    const hiddenCount = items.length - 2;

    return `
      <div class="space-y-1.5 w-full">
        <div class="flex items-center gap-1.5 flex-wrap">
          ${previewItems.map(i => `
            <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 font-medium border border-slate-200/60 dark:border-slate-700/60">
              ${tfEscapeHtml(cleanName(i))} <strong class="font-mono-num text-amber-600 dark:text-amber-400 font-bold">${tfEscapeHtml(i.cases || 0)} ${tfEscapeHtml((i.cases || 0) === 1 ? 'Case' : 'Cases')}</strong> (${tfEscapeHtml(i.packSize || '500g')})
            </span>
          `).join('')}
          <button type="button" onclick="event.stopPropagation(); app.toggleOrderSkuDrawer('${tfEscapeHtml(tfEscapeJs(drawerId))}', this, ${tfEscapeHtml(hiddenCount)})" class="btn-tactile px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 transition-colors">
            <span>+${tfEscapeHtml(hiddenCount)} more varieties</span>
            <i data-lucide="chevron-down" class="w-3 h-3"></i>
          </button>
        </div>

        <div id="${tfEscapeHtml(drawerId)}" class="hidden p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 mt-2 transition-all">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
            <span>All ${tfEscapeHtml(items.length)} Varieties in Order</span>
            <span>Cases & Bottling Units</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
            ${items.map((i, idx) => `
              <div class="flex items-center justify-between p-1.5 px-2 rounded bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-750">
                <span class="font-medium text-slate-800 dark:text-slate-200 truncate pr-2" title="${tfEscapeHtml(i.name)}">
                  <span class="text-slate-400 font-mono-num mr-1">${tfEscapeHtml(idx + 1)}.</span>${tfEscapeHtml(cleanName(i))} <span class="text-slate-400 text-xs">(${tfEscapeHtml(i.packSize || '500g')})</span>
                </span>
                <span class="font-mono-num font-bold text-amber-600 dark:text-amber-400 shrink-0 whitespace-nowrap">${tfEscapeHtml(i.cases || 0)} ${tfEscapeHtml((i.cases || 0) === 1 ? 'Case' : 'Cases')} • ${tfEscapeHtml((i.quantity || 0).toLocaleString('en-IN'))} jars</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  async openNativeFolder(target = 'root', orderId = null) {
    try {
      this.showToast('Opening folder in Windows Explorer...');
      const resp = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, orderId })
      });
      if (resp.ok) {
        this.showToast(`Opened folder in Windows Explorer!`);
      } else {
        const err = await resp.json().catch(() => ({}));
        this.showToast(`Could not open folder: ${err.error || 'Unknown error'}`);
      }
    } catch (e) {
      console.warn('Failed to open native folder:', e);
      this.showToast('Could not open folder on Windows.');
    }
  }

  // Buttons in the backup, data and company-hub panels call these names.
  openFolderByTarget(target = 'root') {
    return this.openNativeFolder(target);
  }

  revealDataFolder() {
    return this.openNativeFolder('root');
  }

  async copyToClipboard(text, label = 'Text') {
    const value = String(text ?? '').trim();
    if (!value || value === '—' || value === 'Not set') {
      this.showToast(`${label} is not set yet.`);
      return false;
    }
    try {
      if (navigator.clipboard && window.isSecureContext !== false) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.cssText = 'position:fixed;left:-9999px;top:0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      this.showToast(`${label} copied`);
      return true;
    } catch (err) {
      this.showToast(`Could not copy ${label}: ${err.message}`);
      return false;
    }
  }

  copyStudioValue(elementId, label = 'Value') {
    const el = document.getElementById(elementId);
    return this.copyToClipboard(el ? (el.value ?? el.textContent) : '', label);
  }

  // --- Universal Modal System (Zero window.prompt and zero window.confirm) ---
  showModalPrompt({ title = 'Input Required', subtitle = 'Please enter details', message = '', defaultValue = '', placeholder = '', suggestions = [], confirmText = 'Confirm' } = {}) {
    return new Promise((resolve) => {
      this._modalPromptResolver = resolve;
      const modal = document.getElementById('universal-prompt-modal');
      if (!modal) {
        // Fallback
        const val = prompt(message, defaultValue);
        return resolve(val);
      }

      document.getElementById('prompt-modal-title').innerText = title;
      document.getElementById('prompt-modal-subtitle').innerText = subtitle;
      document.getElementById('prompt-modal-message').innerHTML = tfSanitizeHtml(message);

      const input = document.getElementById('prompt-modal-input');
      input.value = defaultValue;
      input.placeholder = placeholder;

      const suggBox = document.getElementById('prompt-modal-suggestions');
      if (suggBox) {
        if (suggestions && suggestions.length > 0) {
          suggBox.classList.remove('hidden');
          suggBox.innerHTML = suggestions.map(s => `
            <button type="button" onclick="document.getElementById('prompt-modal-input').value = '${tfEscapeHtml(tfEscapeJs(s))}'; document.getElementById('prompt-modal-input').focus();" class="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 hover:bg-amber-500/20 text-slate-700 dark:text-slate-300 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors">
              ${tfEscapeHtml(s)}
            </button>
          `).join('');
        } else {
          suggBox.classList.add('hidden');
          suggBox.innerHTML = tfSanitizeHtml('');
        }
      }

      document.getElementById('prompt-modal-confirm-btn').innerText = confirmText;

      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => { input.focus(); input.select(); }, 80);
    });
  }

  resolveModalPrompt(val) {
    const modal = document.getElementById('universal-prompt-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    if (this._modalPromptResolver) {
      const res = this._modalPromptResolver;
      this._modalPromptResolver = null;
      res(val);
    }
  }

  showModalConfirm({ title = 'Confirmation', subtitle = 'Please confirm to proceed', message = '', icon = 'help-circle', confirmText = 'Proceed', confirmClass = 'bg-amber-600 hover:bg-amber-500', cancelText = 'Cancel' } = {}) {
    return new Promise((resolve) => {
      this._modalConfirmResolver = resolve;
      const modal = document.getElementById('universal-confirm-modal');
      if (!modal) {
        const res = confirm(message.replace(/<[^>]+>/g, ''));
        return resolve(res);
      }

      document.getElementById('confirm-modal-title').innerText = title;
      document.getElementById('confirm-modal-subtitle').innerText = subtitle;
      document.getElementById('confirm-modal-message').innerHTML = tfSanitizeHtml(message);

      const actionBtn = document.getElementById('confirm-modal-action-btn');
      if (actionBtn) {
        actionBtn.innerText = confirmText;
        actionBtn.className = `btn-tactile px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1.5 ${confirmClass}`;
      }

      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (window.lucide) window.lucide.createIcons();
    });
  }

  resolveModalConfirm(val) {
    const modal = document.getElementById('universal-confirm-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    if (this._modalConfirmResolver) {
      const res = this._modalConfirmResolver;
      this._modalConfirmResolver = null;
      res(!!val);
    }
  }

  /* ================= SUGGESTION 1: AMOUNT-IN-WORDS & MATH & ZERO ALERT ================= */
  convertNumberToIndianWords(amount) {
    const { rupees, paise, negative } = this.splitRupeesPaise(parseFloat(amount) || 0);
    if (rupees === 0 && paise === 0) return { english: 'Zero Rupees Only', hindi: '' };
    let enStr = (negative ? 'Minus ' : '') + (this.indianIntegerWords(rupees) || 'Zero') + ' Rupees';
    if (paise > 0) enStr += ' and ' + this.indianIntegerWords(paise) + ' Paise';
    return { english: enStr + ' Only', hindi: '' };
  }

  // Reads an amount typed as "1,25,000", "₹ 2500.50" or "1000+250"; returns 0 when it is not a number.
  parseAmount(value) {
    const clean = String(value ?? '').replace(/[₹,\s]/g, '');
    if (!clean) return 0;
    if (/^[0-9.+\-*\/()]+$/.test(clean) && /[+*\/]|\d-/.test(clean)) {
      try {
        const result = Function(`'use strict'; return (${clean})`)();
        return Number.isFinite(result) ? Math.round(result * 100) / 100 : 0;
      } catch (_) { return 0; }
    }
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  }

  initRoleMode() {
    const saved = localStorage.getItem('tradeflow_role_mode') || 'operator';
    this.setRoleMode(saved, { silent: true }); // no toast on every page load
  }

  toggleUserRoleMode() {
    const current = this.currentRoleMode || 'operator';
    const next = current === 'operator' ? 'owner' : 'operator';
    this.setRoleMode(next);
  }

  setRoleMode(mode, { silent = false } = {}) {
    this.currentRoleMode = mode;
    localStorage.setItem('tradeflow_role_mode', mode);

    const label = document.getElementById('topbar-role-label');
    const icon = document.getElementById('topbar-role-icon');

    if (mode === 'operator') {
      document.body.classList.add('operator-mode');
      if (label) label.innerText = 'Operator Mode';
      if (!silent) this.showToast('Operator Mode: Trade margins & sensitive figures hidden from screen.');
    } else {
      document.body.classList.remove('operator-mode');
      if (label) label.innerText = 'Owner Mode';
      if (!silent) this.showToast('Owner Mode: Full trade financial visibility unlocked.');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  /* ================= 4-CARD DIRECTORY INTERACTION & SEARCH HELPERS ================= */
  copyTextToClipboard(text, label = 'Copied', triggerEl = null) {
    if (!text) return;

    const flashElement = () => {
      if (triggerEl && triggerEl instanceof HTMLElement) {
        triggerEl.classList.add('tf-copied-flash');
        const isPill = triggerEl.classList.contains('tf-copy-btn');
        const originalContent = triggerEl.innerHTML;
        if (isPill) {
          triggerEl.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-emerald-600"></i><span class="text-xs font-bold text-emerald-700">Copied!</span>`;
          if (window.lucide) window.lucide.createIcons();
        }
        setTimeout(() => {
          triggerEl.classList.remove('tf-copied-flash');
          if (isPill) {
            triggerEl.innerHTML = tfSanitizeHtml(originalContent);
            if (window.lucide) window.lucide.createIcons();
          }
        }, 1400);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(`${label} copied to clipboard!`);
        flashElement();
      }).catch(() => {
        this.fallbackCopyText(text, label, triggerEl);
        flashElement();
      });
    } else {
      this.fallbackCopyText(text, label, triggerEl);
      flashElement();
    }
  }

  fallbackCopyText(text, label, triggerEl = null) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      this.showToast(`${label} copied to clipboard!`);
    } catch (err) {
      this.showToast(`Copy: ${text}`);
    }
    document.body.removeChild(textArea);
  }

  /* =========================================================================
   * TRADEFLOW VERSION 2 - MASTER VITAL NECESSITIES ENGINE
   * ========================================================================= */

  /* ================= 1. TOP-LEVEL AI CONTROL GATE ================= */
  initAIMode() {
    this.isAIEnabled = typeof localStorage !== 'undefined' && localStorage.getItem('tradeflow_ai_enabled') === 'true';
    this.updateAIModeUI();
  }

  toggleAIMode() {
    this.isAIEnabled = !this.isAIEnabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tradeflow_ai_enabled', this.isAIEnabled ? 'true' : 'false');
    }
    this.updateAIModeUI();
    this.showToast(this.isAIEnabled 
      ? 'AI Mode: ON (Vision, Ambiguity Resolution & Deep Extraction Active)' 
      : 'AI Mode: OFF (100% Offline Local Deterministic Engine Active)');
  }

  updateAIModeUI() {
    const btn = document.getElementById('topbar-ai-toggle-btn');
    if (!btn) return;
    if (this.isAIEnabled) {
      btn.className = 'tf-topbar-pill btn-tactile text-white bg-purple-600 hover:bg-purple-700 border border-purple-500 shadow-2xs flex items-center gap-1.5 transition-all';
      btn.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> <span class="font-bold text-xs">AI ● ON</span>`;
      btn.title = 'AI Assistance is ACTIVE (Vision, Summaries & Recommendations)';
    } else {
      btn.className = 'tf-topbar-pill btn-tactile text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-1.5 transition-all';
      btn.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-400"></span> <span class="font-medium text-xs text-slate-600 dark:text-slate-300">AI ● OFF</span>`;
      btn.title = 'AI is OFF (100% Offline Local Engine with deterministic search & calculations)';
    }
  }

  /* Convenience aliases for zero-dead-end navigation */
  openOrderDossierModal(orderId) {
    if (this.openOrderDetailPage) return this.openOrderDetailPage(orderId);
    if (this.openOrderDrawer) return this.openOrderDrawer(orderId);
  }

  openPartnerSpotlight(contactId) {
    return this.openPartnerSpotlightModal(contactId);
  }
}

// Each screen's methods live in js/app/<screen>.js and are added to the class here, before the app starts.
// They are the same methods as before, only kept in smaller files.
TradeFlowApp.addMethods = function (part) {
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
    if (name === 'constructor') continue;
    if (Object.prototype.hasOwnProperty.call(TradeFlowApp.prototype, name)) throw new Error('TradeFlowApp.' + name + ' is defined twice');
    Object.defineProperty(TradeFlowApp.prototype, name, descriptor);
  }
};


// Global initialization
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new TradeFlowApp();
  window.app = app;
});
