// TradeFlow: Invoice studio, company hub and Sheets hub. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // =========================================================================
  // SMART INVOICE & BILLING STUDIO ENGINE (TOOLS & UTILITIES)
  // =========================================================================

  // Whole number in the Indian system (Crore / Lakh / Thousand), any size, e.g. 1500000000 -> "One Hundred Fifty Crore".
  indianIntegerWords(n) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const twoDigit = val => val < 20 ? ones[val] : (tens[Math.floor(val / 10)] + (val % 10 ? ' ' + ones[val % 10] : ''));
    const threeDigit = val => [Math.floor(val / 100) ? ones[Math.floor(val / 100)] + ' Hundred' : '', val % 100 ? twoDigit(val % 100) : ''].filter(Boolean).join(' ');
    if (!n) return '';
    const crore = Math.floor(n / 10000000);
    let rem = n % 10000000;
    const lakh = Math.floor(rem / 100000); rem %= 100000;
    const thousand = Math.floor(rem / 1000); rem %= 1000;
    return [
      crore ? this.indianIntegerWords(crore) + ' Crore' : '',
      lakh ? twoDigit(lakh) + ' Lakh' : '',
      thousand ? twoDigit(thousand) + ' Thousand' : '',
      rem ? threeDigit(rem) : ''
    ].filter(Boolean).join(' ');
  }

  // Splits an amount into whole rupees and paise after rounding to the paisa (1999.995 -> 2000, 0).
  splitRupeesPaise(num) {
    const totalPaise = Math.round(Math.abs(Number(num)) * 100);
    return { rupees: Math.floor(totalPaise / 100), paise: totalPaise % 100, negative: Number(num) < 0 && totalPaise > 0 };
  }

  numberToIndianWords(num) {
    if (num === null || num === undefined || num === '' || Number.isNaN(Number(num))) return 'Zero Rupees Only';
    const { rupees, paise, negative } = this.splitRupeesPaise(num);
    if (rupees === 0 && paise === 0) return 'Zero Rupees Only';
    let words = (negative ? 'Minus ' : '') + 'Rupees ' + (this.indianIntegerWords(rupees) || 'Zero');
    if (paise > 0) words += ' and ' + this.indianIntegerWords(paise) + ' Paise';
    return words + ' Only';
  }

  generateUpiQrUrl(upiId, name, amount, invoiceNo) {
    // No UPI ID in the business profile means no QR code: never route money to a default account.
    if (!upiId || !String(upiId).includes('@')) return '';
    const cleanAmount = Math.max(0, Number(amount || 0)).toFixed(2);
    const cleanName = encodeURIComponent(name || this.config().brand);
    const cleanNote = encodeURIComponent(`Invoice ${invoiceNo || 'MR'}`);
    const upiUri = `upi://pay?pa=${encodeURIComponent(String(upiId).trim())}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanNote}`;
    return this.createQrDataUrl(upiUri);
  }

  openInvoiceStudioModal(orderId = null) {
    const select = document.getElementById('studio-order-select');
    if (select) {
      let optionsHtml = `<option value="draft">Freeform Custom Invoice (Blank Draft)</option>`;
      if (this.data && this.data.orders) {
        optionsHtml += this.data.orders.map(o => `
          <option value="${tfEscapeHtml(o.id)}">${tfEscapeHtml(o.invoiceNumber || o.id)} • ${tfEscapeHtml(o.retailerName)} (${tfEscapeHtml(this.formatCurrency(o.totalInvoiceAmount))})</option>
        `).join('');
      }
      select.innerHTML = optionsHtml;
    }

    const targetOrder = orderId 
      ? (this.data.orders.find(o => o.id === orderId || o.invoiceNumber === orderId) || (this.selectedOrder && (this.selectedOrder.id === orderId || this.selectedOrder.invoiceNumber === orderId) ? this.selectedOrder : null))
      : (this.selectedOrder || (this.data.orders && this.data.orders[0]));

    if (targetOrder) {
      this.studioSelectedOrderId = targetOrder.id;
      if (select) select.value = targetOrder.id;
      this.studioDraftData = JSON.parse(JSON.stringify(targetOrder));
      if (!this.studioDraftData.documentType) this.studioDraftData.documentType = 'TAX INVOICE';
    } else {
      this.studioSelectedOrderId = 'draft';
      if (select) select.value = 'draft';
      this.studioDraftData = this.getInitialStudioDraft();
    }

    this.studioActiveDocType = this.studioDraftData.documentType || 'TAX INVOICE';
    this.studioActiveStep = 0;
    this.studioIsDirty = false;
    this.studioTargetDocType = null;
    this.studioCreditReason = this.studioCreditReason || '';

    // Set phone input
    const phoneInput = document.getElementById('studio-whatsapp-phone');
    if (phoneInput && this.studioDraftData) {
      phoneInput.value = this.studioDraftData.customerPhone || '';
    }

    // Ensure legacy modal is closed so there is never modal overlap
    const oldModal = document.getElementById('invoice-modal');
    if (oldModal) oldModal.classList.add('hidden');

    const modal = document.getElementById('invoice-studio-modal');
    if (modal) modal.classList.remove('hidden');
    this.closeStudioMagicDrawer();
    this.initStudioSplitResizer();

    this.updateStudioTabsUI();
    this.renderStudioSteps();
    this.renderStudioEditor();
    this.updateStudioValidation();
    this.renderStudioInvoiceContent();
    this.renderStudioCommercialPulse();
    if (window.lucide) window.lucide.createIcons();
  }

  closeInvoiceStudioModal() {
    this.closeStudioMagicDrawer();
    const modal = document.getElementById('invoice-studio-modal');
    if (modal) modal.classList.add('hidden');
  }

  toggleInvoiceStudioMaximize() {
    const panel = document.getElementById('invoice-studio-modal-panel');
    const maxIcon = document.getElementById('studio-maximize-icon');
    if (!panel) return;

    this.isInvoiceStudioMaximized = !this.isInvoiceStudioMaximized;
    if (this.isInvoiceStudioMaximized) {
      panel.dataset.prevWidth = panel.style.width || panel.offsetWidth + 'px';
      panel.dataset.prevHeight = panel.style.height || panel.offsetHeight + 'px';
      panel.style.width = '98vw';
      panel.style.height = '96vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';
      if (maxIcon) maxIcon.setAttribute('data-lucide', 'minimize-2');
    } else {
      panel.style.width = panel.dataset.prevWidth || '1180px';
      panel.style.height = panel.dataset.prevHeight || '94vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';
      if (maxIcon) maxIcon.setAttribute('data-lucide', 'maximize-2');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  getInitialStudioDraft() {
    const now = new Date();
    // Indian financial year runs April to March.
    const curYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const nextYearShort = String(curYear + 1).slice(-2);
    const fyStr = `${this.config().invoicePrefix}${curYear}-${nextYearShort}/${String(this.config().startingNumber).padStart(4, '0')}`;
    const product = ((this.data && this.data.products) || []).find(p => p.active !== false) || {};
    const casePack = Number(product.casePack) || this.config().defaultCasePack;
    const unitRate = Number(product.defaultUnitRate ?? product.standardSellingRate) || 0;
    const starterItem = {
      id: product.id || 'ITEM-1', productId: product.id, name: product.name || '', variant: product.variant || '', packSize: product.defaultPackSize || product.packSize || '',
      hsn: product.hsn, gstRate: this.itemGstRate({ productId: product.id }), casePack, cases: 1, quantity: casePack, unitRate,
      totalAmount: Math.round(casePack * unitRate * 100) / 100, isOptional: false, creditQty: 0
    };
    const starterTax = this.computeGst([starterItem], false);

    return {
      id: 'DRAFT-' + Date.now().toString().slice(-4),
      invoiceNumber: fyStr,
      date: now.toISOString().split('T')[0],
      dueDate: this.dueDateFromTerms(now.toISOString().split('T')[0], this.config().defaultPaymentTerms),
      documentType: 'TAX INVOICE',
      retailerName: '',
      retailerId: null,
      customerPhone: '',
      retailerGstin: '',
      billingAddress: '',
      shippingAddress: '',
      gstType: 'intra',
      paymentTerms: '50% Advance, Balance against LR Delivery',
      lrNumber: '',
      transporterName: '',
      vehicleNumber: '',
      driverName: '',
      driverPhone: '',
      ewayBillNumber: '',
      batchNumber: '',
      mfgDate: '',
      bestBefore: product.bestBefore || product.shelfLife || '',
      // One starter line from the first catalogue product; totals are worked out from it.
      items: [starterItem],
      taxableSubtotal: starterTax.taxable,
      cgstAmount: starterTax.cgst,
      sgstAmount: starterTax.sgst,
      igstAmount: starterTax.igst,
      gstRates: starterTax.rates,
      totalInvoiceAmount: starterTax.total,
      customerAdvanceReceived: 0,
      amountReceived: 0,
      paymentMode: 'UPI',
      utrNumber: '',
      customerBalanceDue: starterTax.total,
      movementPurpose: 'Job Work / Supply to Processor',
      validityDays: 15,
      advancePercent: 50,
      originalInvoiceNumber: fyStr,
      originalInvoiceDate: now.toISOString().split('T')[0],
      originalInvoiceAmount: starterTax.total,
      creditReason: '',
      settlementMode: 'Adjust against outstanding invoice balance',
      customNotes: this.defaultInvoiceNotes()
    };
  }

  onStudioOrderSelect(orderId) {
    if (orderId === 'draft') {
      this.studioSelectedOrderId = 'draft';
      this.studioDraftData = this.getInitialStudioDraft();
    } else {
      const o = this.data.orders.find(x => x.id === orderId);
      if (o) {
        this.studioSelectedOrderId = o.id;
        this.studioDraftData = JSON.parse(JSON.stringify(o));
        if (!this.studioDraftData.documentType) this.studioDraftData.documentType = this.studioActiveDocType || 'TAX INVOICE';
        this.studioDraftData.originalInvoiceNumber = o.invoiceNumber;
        this.studioDraftData.originalInvoiceDate = o.date;
        this.studioDraftData.originalInvoiceAmount = o.totalInvoiceAmount;
      }
    }
    const phoneInput = document.getElementById('studio-whatsapp-phone');
    if (phoneInput && this.studioDraftData) {
      phoneInput.value = this.studioDraftData.customerPhone || '';
    }
    this.studioIsDirty = false;
    this.recalculateStudioFinancials();
    this.renderStudioSteps();
    this.renderStudioEditor();
    this.updateStudioValidation();
    this.renderStudioInvoiceContent();
    this.renderStudioCommercialPulse();
  }

  requestSwitchStudioDocType(docType) {
    let normalized = docType;
    if (docType === 'ADVANCE RECEIPT VOUCHER') normalized = 'ADVANCE RECEIPT';
    if (this.studioActiveDocType === normalized) return;

    if (this.studioIsDirty) {
      this.studioTargetDocType = normalized;
      const modal = document.getElementById('studio-unsaved-modal');
      if (modal) modal.classList.remove('hidden');
    } else {
      this.switchStudioDocumentType(normalized);
    }
  }

  closeStudioUnsavedModal() {
    const modal = document.getElementById('studio-unsaved-modal');
    if (modal) modal.classList.add('hidden');
    this.studioTargetDocType = null;
  }

  confirmStudioDocSwitch() {
    this.studioIsDirty = false;
    const target = this.studioTargetDocType || 'TAX INVOICE';
    this.closeStudioUnsavedModal();
    this.switchStudioDocumentType(target);
  }

  switchStudioDocumentType(docType) {
    if (!this.studioDraftData) {
      this.studioDraftData = this.getInitialStudioDraft();
    }
    let normalized = docType;
    if (docType === 'ADVANCE RECEIPT VOUCHER') normalized = 'ADVANCE RECEIPT';

    this.studioActiveDocType = normalized;
    this.studioDraftData.documentType = normalized;
    this.studioActiveStep = 0;
    this.studioIsDirty = false;

    // Type specific defaults
    if (normalized === 'PROFORMA INVOICE') {
      this.studioDraftData.validityDays = this.studioDraftData.validityDays || 15;
      this.studioDraftData.advancePercent = this.studioDraftData.advancePercent || 50;
    } else if (normalized === 'ADVANCE RECEIPT') {
      // A receipt shows only money actually received; the user enters amount and UTR if not recorded yet.
      this.studioDraftData.amountReceived = Number(this.studioDraftData.customerAdvanceReceived || this.studioDraftData.amountReceived) || 0;
      this.studioDraftData.paymentMode = this.studioDraftData.paymentMode || this.studioAdvancePaymentMode || 'UPI';
      this.studioDraftData.utrNumber = this.studioDraftData.utrNumber || '';
    } else if (normalized === 'DELIVERY CHALLAN') {
      this.studioDraftData.movementPurpose = this.studioDraftData.movementPurpose || this.studioChallanPurpose || 'Job Work / Supply to Processor';
      this.studioDraftData.driverName = this.studioDraftData.driverName || '';
      this.studioDraftData.driverPhone = this.studioDraftData.driverPhone || '';
    } else if (normalized === 'CREDIT NOTE') {
      this.studioDraftData.originalInvoiceNumber = this.studioDraftData.originalInvoiceNumber || this.studioDraftData.invoiceNumber;
      this.studioDraftData.originalInvoiceDate = this.studioDraftData.originalInvoiceDate || this.studioDraftData.date;
      this.studioDraftData.originalInvoiceAmount = this.studioDraftData.originalInvoiceAmount || this.studioDraftData.totalInvoiceAmount;
      this.studioDraftData.creditReason = this.studioDraftData.creditReason || this.studioCreditReason || '';
      this.studioDraftData.settlementMode = this.studioDraftData.settlementMode || 'Adjust against outstanding invoice balance';
    }

    this.updateStudioTabsUI();
    this.recalculateStudioFinancials();
    this.renderStudioSteps();
    this.renderStudioEditor();
    this.updateStudioValidation();
    this.renderStudioInvoiceContent();
  }

  updateStudioTabsUI() {
    const docType = this.studioActiveDocType;
    const tabs = [
      { id: 'studio-doc-tax', type: 'TAX INVOICE' },
      { id: 'studio-doc-proforma', type: 'PROFORMA INVOICE' },
      { id: 'studio-doc-advance', type: 'ADVANCE RECEIPT' },
      { id: 'studio-doc-challan', type: 'DELIVERY CHALLAN' },
      { id: 'studio-doc-credit', type: 'CREDIT NOTE' }
    ];

    tabs.forEach(t => {
      const el = document.getElementById(t.id);
      if (!el) return;
      const isMatch = (t.type === docType) || (t.type === 'ADVANCE RECEIPT' && docType === 'ADVANCE RECEIPT VOUCHER');
      const subspan = typeof el.querySelector === 'function' ? el.querySelector('span:last-child') : null;
      if (isMatch) {
        el.className = 'studio-nav-tab px-3 py-1.5 rounded-lg font-black text-xs bg-emerald-600 text-white flex flex-col items-center leading-none whitespace-nowrap shadow-sm border border-emerald-700 cursor-pointer transition-all active';
        if (subspan) subspan.className = 'text-xs font-bold text-emerald-100 mt-0.5';
      } else {
        el.className = 'studio-nav-tab px-3 py-1.5 rounded-lg font-extrabold text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:text-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-2xs flex flex-col items-center leading-none whitespace-nowrap cursor-pointer transition-all';
        if (subspan) subspan.className = 'text-xs font-bold text-slate-600 dark:text-slate-300 mt-0.5';
      }
    });

    const labelEl = document.getElementById('studio-doc-supporting-label');
    if (labelEl) {
      if (docType === 'TAX INVOICE') labelEl.textContent = 'Final GST sale document';
      else if (docType === 'PROFORMA INVOICE') labelEl.textContent = 'Estimate before sale';
      else if (docType === 'ADVANCE RECEIPT' || docType === 'ADVANCE RECEIPT VOUCHER') labelEl.textContent = 'Payment received before final invoice';
      else if (docType === 'DELIVERY CHALLAN') labelEl.textContent = 'Goods movement / proof of delivery';
      else if (docType === 'CREDIT NOTE') labelEl.textContent = 'Adjustment against a prior invoice';
    }
  }

  getStudioSteps(docType) {
    const type = docType || this.studioActiveDocType || 'TAX INVOICE';
    if (type === 'PROFORMA INVOICE') {
      return [
        { id: 'details', name: 'Estimate Details', icon: 'file-text' },
        { id: 'parties', name: 'Prospect / Buyer', icon: 'user-check' },
        { id: 'items', name: 'Proposed Items', icon: 'layers' },
        { id: 'commercial', name: 'Commercial Terms', icon: 'clock' },
        { id: 'convert', name: 'Review & Convert', icon: 'arrow-right-circle' }
      ];
    }
    if (type === 'ADVANCE RECEIPT' || type === 'ADVANCE RECEIPT VOUCHER') {
      return [
        { id: 'details', name: 'Voucher Details', icon: 'receipt' },
        { id: 'payer', name: 'Received From', icon: 'user' },
        { id: 'payment', name: 'Amount & Mode', icon: 'wallet' },
        { id: 'allocation', name: 'Order Allocation', icon: 'link' },
        { id: 'review', name: 'Review & Issue', icon: 'check-circle' }
      ];
    }
    if (type === 'DELIVERY CHALLAN') {
      return [
        { id: 'details', name: 'Challan & Purpose', icon: 'truck' },
        { id: 'consignee', name: 'Consignee & Godown', icon: 'map-pin' },
        { id: 'goods', name: 'Goods & Packaging', icon: 'boxes' },
        { id: 'transport', name: 'Transport & E-Way', icon: 'navigation' },
        { id: 'review', name: 'Review & Dispatch', icon: 'shield-check' }
      ];
    }
    if (type === 'CREDIT NOTE') {
      return [
        { id: 'original', name: 'Original Invoice', icon: 'search' },
        { id: 'reason', name: 'Credit Reason', icon: 'alert-circle' },
        { id: 'items', name: 'Adjusted Items', icon: 'scissors' },
        { id: 'settlement', name: 'Tax & Settlement', icon: 'dollar-sign' },
        { id: 'review', name: 'Review & Issue', icon: 'check-circle' }
      ];
    }
    return [
      { id: 'details', name: 'Invoice Details', icon: 'file-text' },
      { id: 'parties', name: 'Billed & Shipped To', icon: 'users' },
      { id: 'items', name: 'Line Items & Tax', icon: 'package' },
      { id: 'terms', name: 'Terms & Transport', icon: 'truck' },
      { id: 'review', name: 'Review & Issue', icon: 'check-circle' }
    ];
  }

  renderStudioSteps() {
    const sidebar = document.getElementById('studio-steps-sidebar');
    if (!sidebar) return;

    const docType = this.studioActiveDocType || 'TAX INVOICE';
    const steps = this.getStudioSteps(docType);
    const activeStep = this.studioActiveStep || 0;

    const stepsHtml = steps.map((s, idx) => {
      const isActive = idx === activeStep;
      const isCompleted = idx < activeStep;
      const stepClasses = `studio-step-btn w-full p-2.5 rounded-lg border mb-1.5 flex items-center gap-2.5 text-left transition-all ${
        isActive 
          ? 'active bg-emerald-100 dark:bg-emerald-950/80 border-emerald-500/60 text-slate-950 dark:text-white font-black shadow-xs' 
          : (isCompleted 
              ? 'completed bg-slate-100/90 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-extrabold hover:bg-slate-200/80' 
              : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-bold hover:bg-slate-100 dark:hover:bg-slate-800/50')
      }`;

      const numBadge = isCompleted
        ? `<span class="step-num w-5 h-5 rounded-full bg-emerald-600 border border-emerald-700 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">✓</span>`
        : `<span class="step-num w-5 h-5 rounded-full ${tfEscapeHtml(isActive ? 'bg-emerald-700 text-white border-emerald-800 font-black' : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-400 dark:border-slate-600 font-black')} border flex items-center justify-center text-xs shrink-0 font-mono-num">${tfEscapeHtml(idx + 1)}</span>`;

      return `
        <button type="button" onclick="app.goToStudioStep(${tfEscapeHtml(idx)})" class="${tfEscapeHtml(stepClasses)}">
          ${numBadge}
          <div class="min-w-0 flex-1">
            <p class="text-xs truncate leading-tight font-extrabold text-slate-900 dark:text-white">${tfEscapeHtml(s.name)}</p>
            <span class="text-xs text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1 mt-0.5">
              <i data-lucide="${tfEscapeHtml(s.icon)}" class="w-3 h-3 text-slate-600 dark:text-slate-400"></i>
              <span>Step ${tfEscapeHtml(idx + 1)}</span>
            </span>
          </div>
        </button>
      `;
    }).join('');

    sidebar.innerHTML = `
      <div class="mb-2.5 px-1 flex items-center justify-between">
        <span class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Workflow Steps</span>
        <span class="text-xs font-black text-slate-900 dark:text-emerald-300 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 border border-emerald-500/40">${tfEscapeHtml(activeStep + 1)} of ${tfEscapeHtml(steps.length)}</span>
      </div>
      <div class="flex-1 overflow-y-auto space-y-0.5 pr-0.5">
        ${stepsHtml}
      </div>
      <div class="mt-auto pt-2.5 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 px-1 font-bold">
        <div class="flex items-center justify-between text-xs text-slate-800 dark:text-slate-200 mb-1 font-extrabold">
          <span>Completion</span>
          <span class="font-mono-num text-slate-900 dark:text-white font-black">${tfEscapeHtml(Math.round(((activeStep + 1) / steps.length) * 100))}%</span>
        </div>
        <div class="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div class="bg-emerald-600 h-full rounded-full transition-all duration-300" style="width: ${tfEscapeHtml(((activeStep + 1) / steps.length) * 100)}%"></div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  goToStudioStep(idx) {
    const steps = this.getStudioSteps(this.studioActiveDocType);
    if (idx >= 0 && idx < steps.length) {
      this.studioActiveStep = idx;
      this.renderStudioSteps();
      this.renderStudioEditor();
      this.updateStudioValidation();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  renderStudioEditor() {
    const editorEl = document.getElementById('studio-editor-content');
    if (!editorEl || !this.studioDraftData) return;

    const o = this.studioDraftData;
    const docType = this.studioActiveDocType || 'TAX INVOICE';
    const step = this.studioActiveStep || 0;
    const steps = this.getStudioSteps(docType);
    const stepInfo = steps[step] || steps[0];

    let formHtml = '';

    const stepHeaderHtml = `
      <div class="mb-3.5 pb-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Step ${tfEscapeHtml(step + 1)} of ${tfEscapeHtml(steps.length)}</span>
            <h4 class="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
              <i data-lucide="${tfEscapeHtml(stepInfo.icon)}" class="w-4 h-4 text-emerald-500"></i>
              <span>${tfEscapeHtml(stepInfo.name)}</span>
            </h4>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize fields for ${tfEscapeHtml(docType.toLowerCase())} — updates live on A4 sheet preview.</p>
        </div>
      </div>
    `;

    if (docType === 'TAX INVOICE') {
      if (step === 0) {
        formHtml = `
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice Number *</label>
                <input type="text" value="${tfEscapeHtml(o.invoiceNumber)}" oninput="app.studioDraftData.invoiceNumber = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice Date *</label>
                <input type="date" value="${tfEscapeHtml(o.date)}" oninput="app.studioDraftData.date = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                <input type="date" value="${tfEscapeHtml(o.dueDate)}" oninput="app.studioDraftData.dueDate = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">GST Tax Supply Type</label>
                <select onchange="app.studioDraftData.gstType = this.value; app.studioIsDirty = true; app.recalculateStudioFinancials(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold">
                  <option value="intra" ${tfEscapeHtml(o.gstType === 'intra' ? 'selected' : '')}>Intra-State Supply (${tfEscapeHtml(this.gstLabels(o, false).combined)})</option>
                  <option value="inter" ${tfEscapeHtml(o.gstType === 'inter' ? 'selected' : '')}>Inter-State Supply (${tfEscapeHtml(this.gstLabels(o, true).combined)})</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Place of Supply</label>
                <input type="text" value="${tfEscapeHtml(o.placeOfSupply || this.config().placeOfSupply)}" oninput="app.studioDraftData.placeOfSupply = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reverse Charge (RCM)</label>
                <select onchange="app.studioDraftData.reverseCharge = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
                  <option value="No">No (Standard Taxable Sale)</option>
                  <option value="Yes">Yes (Tax Payable by Recipient)</option>
                </select>
              </div>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
              <div class="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>Customer / Billed To:</span>
                <span class="text-slate-900 dark:text-white font-extrabold">${tfEscapeHtml(o.retailerName || 'Not Selected')}</span>
              </div>
              <div class="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>Gross Invoice Total:</span>
                <span class="font-mono text-emerald-600 dark:text-emerald-400 font-black text-sm">${tfEscapeHtml(this.formatCurrency(o.totalInvoiceAmount))}</span>
              </div>
              <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Tax Breakdown:</span>
                <span class="font-mono font-semibold">${tfEscapeHtml(this.gstLabels(o).combined)} (${tfEscapeHtml(this.formatCurrency((o.cgstAmount || 0) + (o.sgstAmount || 0) + (o.igstAmount || 0)))})</span>
              </div>
            </div>
          </div>
        `;
      } else if (step === 1) {
        const contactsOptions = (this.data.contacts || []).map(c => `
          <option value="${tfEscapeHtml(c.id)}" ${tfEscapeHtml(o.retailerId === c.id ? 'selected' : '')}>${tfEscapeHtml(c.name)} (${tfEscapeHtml(c.phone || c.whatsappPhone || 'No Phone')})</option>
        `).join('');

        formHtml = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Load Customer from Directory</label>
              <select onchange="app.onSelectStudioContact(this.value)" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold">
                <option value="">-- Choose Existing Retailer / Distributor --</option>
                ${contactsOptions}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Billed To (Party Name) *</label>
                <input type="text" value="${tfEscapeHtml(o.retailerName || '')}" oninput="app.studioDraftData.retailerName = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone / WhatsApp</label>
                <input type="text" value="${tfEscapeHtml(o.customerPhone || '')}" oninput="app.studioDraftData.customerPhone = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">GSTIN (15 Digits)</label>
              <input type="text" value="${tfEscapeHtml(o.retailerGstin || '')}" oninput="app.studioDraftData.retailerGstin = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono uppercase text-slate-900 dark:text-white">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Billing Address</label>
              <textarea rows="2" oninput="app.studioDraftData.billingAddress = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">${tfEscapeHtml(o.billingAddress || '')}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Shipping / Godown Address</label>
              <textarea rows="2" oninput="app.studioDraftData.shippingAddress = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">${tfEscapeHtml(o.shippingAddress || '')}</textarea>
            </div>
          </div>
        `;
      } else if (step === 2) {
        const rowsHtml = o.items.map((it, idx) => `
          <div class="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 mb-2">
            <div class="flex items-center justify-between gap-2">
              <span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center">${tfEscapeHtml(idx + 1)}</span>
              <input type="text" value="${tfEscapeHtml(it.name)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'name', this.value); app.studioIsDirty = true;" placeholder="Product Name" class="flex-1 p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-xs font-bold text-slate-900 dark:text-white">
              <input type="text" value="${tfEscapeHtml(it.variant)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'variant', this.value); app.studioIsDirty = true;" placeholder="Variant (e.g. 500g Jar)" class="w-28 p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-xs text-slate-600 dark:text-slate-300">
              <button type="button" onclick="app.removeStudioItem(${tfEscapeHtml(idx)})" class="text-rose-500 hover:text-rose-600 p-1" title="Delete product">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
            <div class="grid grid-cols-4 gap-2 text-xs">
              <div>
                <label class="block text-xs text-slate-400 font-medium">Cases</label>
                <input type="number" min="1" value="${tfEscapeHtml(it.cases || Math.ceil(it.quantity / (it.casePack || 24)))}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'cases', this.value); app.studioIsDirty = true;" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-center font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Jars Qty</label>
                <input type="number" min="1" value="${tfEscapeHtml(it.quantity)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'quantity', this.value); app.studioIsDirty = true;" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-right font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Rate (₹)</label>
                <input type="number" step="0.5" value="${tfEscapeHtml(it.unitRate)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'unitRate', this.value); app.studioIsDirty = true;" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-right font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Amount (₹)</label>
                <div class="p-1 font-mono font-bold text-right text-emerald-500">${tfEscapeHtml(this.formatCurrency(it.totalAmount))}</div>
              </div>
            </div>
          </div>
        `).join('');

        formHtml = `
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Line Items (${tfEscapeHtml(o.items.length)})</span>
              <button type="button" onclick="app.addStudioItem()" class="btn-tactile px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-1">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>Add Product Line</span>
              </button>
            </div>
            <div class="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              ${rowsHtml}
            </div>
            <div class="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs">
              <span class="text-slate-500 font-medium">Taxable Subtotal:</span>
              <span class="font-mono font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(o.taxableSubtotal))}</span>
            </div>
          </div>
        `;
      } else if (step === 3) {
        formHtml = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Terms</label>
              <input type="text" value="${tfEscapeHtml(o.paymentTerms || '')}" oninput="app.studioDraftData.paymentTerms = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Transporter Name</label>
                <input type="text" value="${tfEscapeHtml(o.transporterName || '')}" oninput="app.studioDraftData.transporterName = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">LR / Bilty Number</label>
                <input type="text" value="${tfEscapeHtml(o.lrNumber || '')}" oninput="app.studioDraftData.lrNumber = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle Number</label>
                <input type="text" value="${tfEscapeHtml(o.vehicleNumber || '')}" oninput="app.studioDraftData.vehicleNumber = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white" placeholder="MH-04-GP-8842">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-Way Bill Number</label>
                <input type="text" value="${tfEscapeHtml(o.ewayBillNumber || '')}" oninput="app.studioDraftData.ewayBillNumber = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white" placeholder="281099238812">
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Batch No</label>
                <input type="text" value="${tfEscapeHtml(o.batchNumber || '')}" oninput="app.studioDraftData.batchNumber = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mfg Date</label>
                <input type="text" value="${tfEscapeHtml(o.mfgDate || '09/2026')}" oninput="app.studioDraftData.mfgDate = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Best Before</label>
                <input type="text" value="${tfEscapeHtml(o.bestBefore || '12 Months')}" oninput="app.studioDraftData.bestBefore = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
          </div>
        `;
      } else if (step === 4) {
        formHtml = `
          <div class="space-y-4">
            <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div class="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Taxable Subtotal:</span>
                <span class="font-mono font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(o.taxableSubtotal))}</span>
              </div>
              <div class="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total GST (${tfEscapeHtml(this.gstLabels(o).combined)}):</span>
                <span class="font-mono font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency((o.cgstAmount || 0) + (o.sgstAmount || 0) + (o.igstAmount || 0)))}</span>
              </div>
              <div class="flex justify-between text-sm font-black border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-900 dark:text-white">
                <span>Total Invoice Value:</span>
                <span class="font-mono text-emerald-500">${tfEscapeHtml(this.formatCurrency(o.totalInvoiceAmount))}</span>
              </div>
              <div class="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                <span class="font-bold text-slate-700 dark:text-slate-300">Advance Received (₹):</span>
                <input type="number" value="${tfEscapeHtml(o.customerAdvanceReceived || 0)}" oninput="app.studioDraftData.customerAdvanceReceived = parseFloat(this.value) || 0; app.studioIsDirty = true; app.recalculateStudioFinancials(); app.renderStudioInvoiceContent();" class="w-32 p-1 border border-slate-300 dark:border-slate-600 rounded font-mono font-bold text-right text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
              </div>
              <div class="flex justify-between text-sm font-black text-rose-500 border-t border-slate-200 dark:border-slate-700 pt-2">
                <span>Net Balance Due:</span>
                <span class="font-mono">${tfEscapeHtml(this.formatCurrency(o.customerBalanceDue))}</span>
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Custom Notes / Terms</label>
              <textarea rows="3" oninput="app.studioDraftData.customNotes = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">${tfEscapeHtml(o.customNotes || '')}</textarea>
            </div>
          </div>
        `;
      }
    } else if (docType === 'PROFORMA INVOICE') {
      if (step === 0) {
        formHtml = `
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Proforma Number *</label>
                <input type="text" value="${tfEscapeHtml(o.invoiceNumber)}" oninput="app.studioDraftData.invoiceNumber = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Estimate Date *</label>
                <input type="date" value="${tfEscapeHtml(o.date)}" oninput="app.studioDraftData.date = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Price Validity (Days)</label>
                <input id="studio-input-validity" type="number" value="${tfEscapeHtml(o.validityDays || 15)}" oninput="app.studioDraftData.validityDays = parseInt(this.value) || 15; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white">
                <div class="flex items-center gap-1.5 mt-1.5">
                  <span class="text-xs text-slate-400 font-semibold">Quick:</span>
                  <button type="button" onclick="app.setStudioValidity(7)" class="px-2 py-0.5 text-xs font-bold rounded cursor-pointer ${tfEscapeHtml(o.validityDays == 7 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-300 dark:border-slate-700')}">7d</button>
                  <button type="button" onclick="app.setStudioValidity(15)" class="px-2 py-0.5 text-xs font-bold rounded cursor-pointer ${tfEscapeHtml(o.validityDays == 15 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-300 dark:border-slate-700')}">15d</button>
                  <button type="button" onclick="app.setStudioValidity(30)" class="px-2 py-0.5 text-xs font-bold rounded cursor-pointer ${tfEscapeHtml(o.validityDays == 30 ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 border border-slate-300 dark:border-slate-700')}">30d</button>
                </div>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quotation Subject</label>
                <input type="text" value="${tfEscapeHtml(o.quotationSubject || 'Bulk Distribution Supply Quotation')}" oninput="app.studioDraftData.quotationSubject = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2 text-xs">
              <div class="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>Proposed Buyer:</span>
                <span class="text-slate-900 dark:text-white font-extrabold">${tfEscapeHtml(o.retailerName || 'Not Selected')}</span>
              </div>
              <div class="flex items-center justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>Estimated Quotation Value:</span>
                <span class="font-mono text-emerald-600 dark:text-emerald-400 font-black text-sm">${tfEscapeHtml(this.formatCurrency(o.totalInvoiceAmount))}</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 italic pt-1 border-t border-slate-200 dark:border-slate-700">
                Proforma invoices serve as commercial price quotations before final tax billing. Convert to official Tax Invoice at Step 5.
              </p>
            </div>
          </div>
        `;
      } else if (step === 1) {
        formHtml = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Prospect / Buyer Name *</label>
              <input type="text" value="${tfEscapeHtml(o.retailerName || '')}" oninput="app.studioDraftData.retailerName = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone / WhatsApp</label>
                <input type="text" value="${tfEscapeHtml(o.customerPhone || '')}" oninput="app.studioDraftData.customerPhone = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Delivery Destination</label>
                <input type="text" value="${tfEscapeHtml(o.destinationCity || '')}" oninput="app.studioDraftData.destinationCity = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Commercial Billing Address</label>
              <textarea rows="2" oninput="app.studioDraftData.billingAddress = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">${tfEscapeHtml(o.billingAddress || '')}</textarea>
            </div>
          </div>
        `;
      } else if (step === 2) {
        const rowsHtml = o.items.map((it, idx) => `
          <div class="p-3 bg-white dark:bg-slate-800/80 border ${tfEscapeHtml(it.isOptional ? 'border-amber-400/60 bg-amber-500/5' : 'border-slate-200 dark:border-slate-700')} rounded-xl space-y-2 mb-2">
            <div class="flex items-center justify-between gap-2">
              <span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center">${tfEscapeHtml(idx + 1)}</span>
              <input type="text" value="${tfEscapeHtml(it.name)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'name', this.value); app.studioIsDirty = true;" placeholder="Item Name" class="flex-1 p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-xs font-bold text-slate-900 dark:text-white">
              <label class="flex items-center gap-1.5 text-xs font-bold ${tfEscapeHtml(it.isOptional ? 'text-amber-500' : 'text-slate-400')} cursor-pointer px-2 py-1 rounded bg-slate-100 dark:bg-slate-700">
                <input type="checkbox" ${tfEscapeHtml(it.isOptional ? 'checked' : '')} onchange="app.studioDraftData.items[${tfEscapeHtml(idx)}].isOptional = this.checked; app.studioIsDirty = true; app.recalculateStudioFinancials(); app.renderStudioEditor(); app.renderStudioInvoiceContent();" class="accent-emerald-700 rounded">
                <span>Optional</span>
              </label>
              <button type="button" onclick="app.removeStudioItem(${tfEscapeHtml(idx)})" class="text-rose-500 hover:text-rose-600 p-1">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
            <div class="grid grid-cols-4 gap-2 text-xs">
              <div>
                <label class="block text-xs text-slate-400 font-medium">Cases</label>
                <input type="number" min="1" value="${tfEscapeHtml(it.cases || Math.ceil(it.quantity / (it.casePack || 24)))}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'cases', this.value); app.studioIsDirty = true;" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-center font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Units (Jars)</label>
                <input type="number" min="1" value="${tfEscapeHtml(it.quantity)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'quantity', this.value); app.studioIsDirty = true;" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-right font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Quoted Rate (₹)</label>
                <input type="number" step="0.5" value="${tfEscapeHtml(it.unitRate)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'unitRate', this.value); app.studioIsDirty = true;" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-right font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Total (₹)</label>
                <div class="p-1 font-mono font-bold text-right ${tfEscapeHtml(it.isOptional ? 'text-amber-500' : 'text-emerald-500')}">
                  ${tfEscapeHtml(this.formatCurrency(it.totalAmount))}
                  ${it.isOptional ? '<span class="text-xs block text-amber-500/80 font-normal">(Excluded)</span>' : ''}
                </div>
              </div>
            </div>
          </div>
        `).join('');

        formHtml = `
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Proposed Line Items (${tfEscapeHtml(o.items.length)})</span>
              <button type="button" onclick="app.addStudioItem()" class="btn-tactile px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-1">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>Add Proposed SKU</span>
              </button>
            </div>
            <div class="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              ${rowsHtml}
            </div>
          </div>
        `;
      } else if (step === 3) {
        formHtml = `
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Advance % Required</label>
                <input type="number" value="${tfEscapeHtml(o.advancePercent || 50)}" oninput="app.studioDraftData.advancePercent = parseInt(this.value) || 50; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white" placeholder="50">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Estimated Dispatch Time</label>
                <input type="text" value="${tfEscapeHtml(o.dispatchDays || '5-7 Working Days from Advance')}" oninput="app.studioDraftData.dispatchDays = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Freight & Logistics Terms</label>
              <input type="text" value="${tfEscapeHtml(o.freightTerms || this.config().defaultFreightTerms)}" oninput="app.studioDraftData.freightTerms = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
            </div>
          </div>
        `;
      } else if (step === 4) {
        formHtml = `
          <div class="space-y-4">
            <div class="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
              <div class="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>Total Estimated Order Value:</span>
                <span class="font-mono text-base text-emerald-500 font-black">${tfEscapeHtml(this.formatCurrency(o.totalInvoiceAmount))}</span>
              </div>
              <p class="text-xs text-slate-400">Proforma estimates are non-taxable commercial quotes. Convert directly to official Tax Invoice once customer approves.</p>
            </div>
            <button type="button" onclick="app.convertProformaToTaxInvoice()" class="btn-tactile w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg">
              <i data-lucide="zap" class="w-4 h-4"></i>
              <span>Convert this Proforma to Official Tax Invoice</span>
            </button>
          </div>
        `;
      }
    } else if (docType === 'ADVANCE RECEIPT' || docType === 'ADVANCE RECEIPT VOUCHER') {
      if (step === 0) {
        formHtml = `
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Receipt Voucher Number *</label>
                <input type="text" value="${tfEscapeHtml(o.invoiceNumber)}" oninput="app.studioDraftData.invoiceNumber = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Receipt Date *</label>
                <input type="date" value="${tfEscapeHtml(o.date)}" oninput="app.studioDraftData.date = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Financial Year</label>
              <input type="text" value="2026-27" readonly class="w-full p-2 bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-500">
            </div>
          </div>
        `;
      } else if (step === 1) {
        formHtml = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Received From (Customer / Firm) *</label>
              <input type="text" value="${tfEscapeHtml(o.retailerName || '')}" oninput="app.studioDraftData.retailerName = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white">
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">GSTIN of Customer</label>
                <input type="text" value="${tfEscapeHtml(o.retailerGstin || '')}" oninput="app.studioDraftData.retailerGstin = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono uppercase text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone</label>
                <input type="text" value="${tfEscapeHtml(o.customerPhone || '')}" oninput="app.studioDraftData.customerPhone = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white">
              </div>
            </div>
          </div>
        `;
      } else if (step === 2) {
        const amt = Number(o.amountReceived || o.customerAdvanceReceived || 0);
        formHtml = `
          <div class="space-y-4">
            <div class="p-4 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl text-center space-y-1">
              <label class="block text-xs font-black uppercase tracking-wider text-emerald-400">Amount Received in Advance (₹) *</label>
              <div class="flex items-center justify-center gap-1">
                <span class="text-2xl font-black text-emerald-500">₹</span>
                <input type="number" step="1" value="${tfEscapeHtml(amt)}" oninput="app.onStudioAdvAmountChange(this.value)" class="w-56 text-center text-3xl font-black font-mono text-emerald-400 bg-transparent border-b-2 border-emerald-500/50 outline-none focus:border-emerald-400">
              </div>
              <p id="studio-adv-amount-words" class="text-xs text-slate-300 font-semibold mt-1 font-mono">${tfEscapeHtml(this.numberToIndianWords(amt))}</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Mode</label>
                <select onchange="app.studioDraftData.paymentMode = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold">
                  <option value="UPI" ${tfEscapeHtml(o.paymentMode === 'UPI' ? 'selected' : '')}>UPI (GPay / PhonePe / Paytm)</option>
                  <option value="NEFT/RTGS" ${tfEscapeHtml(o.paymentMode === 'NEFT/RTGS' ? 'selected' : '')}>NEFT / RTGS (Bank Transfer)</option>
                  <option value="Cheque" ${tfEscapeHtml(o.paymentMode === 'Cheque' ? 'selected' : '')}>Cheque / Demand Draft</option>
                  <option value="Cash" ${tfEscapeHtml(o.paymentMode === 'Cash' ? 'selected' : '')}>Cash Receipt</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">UTR / Ref / Cheque No</label>
                <input type="text" value="${tfEscapeHtml(o.utrNumber || '')}" oninput="app.studioDraftData.utrNumber = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white">
              </div>
            </div>
          </div>
        `;
      } else if (step === 3) {
        formHtml = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Allocation Reference</label>
              <input type="text" value="${tfEscapeHtml(o.allocationRef || 'Supply Order #' + (o.invoiceNumber || ''))}" oninput="app.studioDraftData.allocationRef = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white">
            </div>
            <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <p class="font-bold text-slate-800 dark:text-slate-200">Statutory Tax Treatment:</p>
              <p>Under Rule 50 of CGST Rules, 2017, this advance voucher records received consideration before issuance of tax invoice. Tax will be discharged upon final supply invoice.</p>
            </div>
          </div>
        `;
      } else if (step === 4) {
        const amt = Number(o.amountReceived || o.customerAdvanceReceived || 0);
        formHtml = `
          <div class="space-y-4">
            <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-500">Payer Name:</span>
                <span class="font-bold text-slate-900 dark:text-white">${tfEscapeHtml(o.retailerName)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Amount Received:</span>
                <span class="font-mono font-black text-emerald-500 text-sm">${tfEscapeHtml(this.formatCurrency(amt))}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Payment Mode:</span>
                <span class="font-bold text-slate-900 dark:text-white">${tfEscapeHtml(o.paymentMode || 'UPI')} (Ref: ${tfEscapeHtml(o.utrNumber || 'N/A')})</span>
              </div>
            </div>
            <button type="button" onclick="app.executeStudioPrimaryAction()" class="btn-tactile w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Issue Advance Receipt Voucher</span>
            </button>
          </div>
        `;
      }
    } else if (docType === 'DELIVERY CHALLAN') {
      if (step === 0) {
        formHtml = `
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Challan Number *</label>
                <input type="text" value="${tfEscapeHtml(o.invoiceNumber)}" oninput="app.studioDraftData.invoiceNumber = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Dispatch Date *</label>
                <input type="date" value="${tfEscapeHtml(o.date)}" oninput="app.studioDraftData.date = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nature of Movement (Rule 55)</label>
              <select onchange="app.studioDraftData.movementPurpose = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold">
                <option value="Job Work / Supply to Processor" ${tfEscapeHtml(o.movementPurpose === 'Job Work / Supply to Processor' ? 'selected' : '')}>1. Job Work / Supply to Processor (Pickle Factory)</option>
                <option value="Stock Transfer between Godowns" ${tfEscapeHtml(o.movementPurpose === 'Stock Transfer between Godowns' ? 'selected' : '')}>2. Stock Transfer between Godowns</option>
                <option value="Supply on Approval / Returnable" ${tfEscapeHtml(o.movementPurpose === 'Supply on Approval / Returnable' ? 'selected' : '')}>3. Supply on Approval / Returnable Basis</option>
                <option value="Goods Movement for Sale" ${tfEscapeHtml(o.movementPurpose === 'Goods Movement for Sale' ? 'selected' : '')}>4. Goods Movement for Sale (with E-Way Bill)</option>
              </select>
            </div>
          </div>
        `;
      } else if (step === 1) {
        formHtml = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Consignee Name (Receiver) *</label>
              <input type="text" value="${tfEscapeHtml(o.retailerName || '')}" oninput="app.studioDraftData.retailerName = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Delivery Destination / Godown Address</label>
              <textarea rows="2" oninput="app.studioDraftData.shippingAddress = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">${tfEscapeHtml(o.shippingAddress || '')}</textarea>
            </div>
          </div>
        `;
      } else if (step === 2) {
        const rowsHtml = o.items.map((it, idx) => `
          <div class="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 mb-2">
            <div class="flex items-center justify-between gap-2">
              <span class="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center">${tfEscapeHtml(idx + 1)}</span>
              <input type="text" value="${tfEscapeHtml(it.name)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'name', this.value); app.studioIsDirty = true;" class="flex-1 p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-xs font-bold text-slate-900 dark:text-white">
              <input type="text" value="${tfEscapeHtml(it.variant)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'variant', this.value); app.studioIsDirty = true;" class="w-28 p-1.5 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-xs text-slate-600 dark:text-slate-300">
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label class="block text-xs text-slate-400 font-medium">Cases</label>
                <input type="number" min="1" value="${tfEscapeHtml(it.cases || Math.ceil(it.quantity / (it.casePack || 24)))}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'cases', this.value); app.studioIsDirty = true;" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-center font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Total Jars</label>
                <input type="number" min="1" value="${tfEscapeHtml(it.quantity)}" oninput="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'quantity', this.value); app.studioIsDirty = true;" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-right font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Net Weight (kg)</label>
                <div class="p-1 font-mono font-bold text-right text-slate-700 dark:text-slate-300">${tfEscapeHtml((it.quantity * 0.5).toFixed(1))} kg</div>
              </div>
            </div>
          </div>
        `).join('');

        formHtml = `
          <div class="space-y-3">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Dispatch Cargo (${tfEscapeHtml(o.items.length)} Products)</span>
            <div class="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              ${rowsHtml}
            </div>
          </div>
        `;
      } else if (step === 3) {
        formHtml = `
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Vehicle Registration No *</label>
                <input type="text" value="${tfEscapeHtml(o.vehicleNumber || '')}" oninput="app.studioDraftData.vehicleNumber = this.value; app.studioIsDirty = true; app.updateStudioValidation(); app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Transporter / Fleet</label>
                <input type="text" value="${tfEscapeHtml(o.transporterName || '')}" oninput="app.studioDraftData.transporterName = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Driver Name</label>
                <input type="text" value="${tfEscapeHtml(o.driverName || '')}" oninput="app.studioDraftData.driverName = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white">
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Driver Phone</label>
                <input type="text" value="${tfEscapeHtml(o.driverPhone || '')}" oninput="app.studioDraftData.driverPhone = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white">
              </div>
            </div>
          </div>
        `;
      } else if (step === 4) {
        formHtml = `
          <div class="space-y-4">
            <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-500">Nature of Movement:</span>
                <span class="font-bold text-blue-500">${tfEscapeHtml(o.movementPurpose || 'Job Work / Supply')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Consignee:</span>
                <span class="font-bold text-slate-900 dark:text-white">${tfEscapeHtml(o.retailerName)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Vehicle:</span>
                <span class="font-mono font-bold text-slate-900 dark:text-white">${tfEscapeHtml(o.vehicleNumber || '')}</span>
              </div>
            </div>
            <button type="button" onclick="app.executeStudioPrimaryAction()" class="btn-tactile w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Generate Delivery Challan</span>
            </button>
          </div>
        `;
      }
    } else if (docType === 'CREDIT NOTE') {
      if (step === 0) {
        const ordersOptions = (this.data.orders || []).map(ord => `
          <option value="${tfEscapeHtml(ord.id)}" ${tfEscapeHtml(o.originalInvoiceNumber === ord.invoiceNumber ? 'selected' : '')}>
            ${tfEscapeHtml(ord.invoiceNumber || ord.id)} • ${tfEscapeHtml(ord.retailerName)} (${tfEscapeHtml(this.formatCurrency(ord.totalInvoiceAmount))})
          </option>
        `).join('');

        formHtml = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Issued Tax Invoice to Credit *</label>
              <select onchange="app.onSelectStudioCreditInvoice(this.value)" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold">
                <option value="">-- Choose Tax Invoice --</option>
                ${ordersOptions}
              </select>
            </div>
            <div class="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-400">Original Tax Invoice:</span>
                <span class="font-mono font-bold text-slate-900 dark:text-white">${tfEscapeHtml(o.originalInvoiceNumber || o.invoiceNumber)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Original Invoice Date:</span>
                <span class="font-mono font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatDate(o.originalInvoiceDate || o.date))}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Original Invoiced Total:</span>
                <span class="font-mono font-bold text-emerald-500">${tfEscapeHtml(this.formatCurrency(o.originalInvoiceAmount || o.totalInvoiceAmount))}</span>
              </div>
            </div>
          </div>
        `;
      } else if (step === 1) {
        const reasons = [
          { name: 'Damaged Goods in Transit', icon: 'package', desc: 'Jars cracked or leakage in transit' },
          { name: 'Rate Difference / Price Correction', icon: 'trending-down', desc: 'Invoiced at higher rate than agreed' },
          { name: 'Shortage in Delivery', icon: 'truck', desc: 'Fewer cases received than invoiced' },
          { name: 'Sales Return (Defective)', icon: 'refresh-cw', desc: 'Goods returned by buyer' },
          { name: 'Post-Sale Volume Discount', icon: 'tag', desc: 'Turnover or quarterly rebate' },
          { name: 'Broken Packaging / Seal Leak', icon: 'octagon', desc: 'Factory seal compromised' },
          { name: 'Billing / Calculation Error', icon: 'pencil', desc: 'Clerical error in invoice' },
          { name: 'Order Cancellation', icon: 'circle-x', desc: 'Non-delivery / cancellation' }
        ];

        const selectedReason = o.creditReason || this.studioCreditReason || reasons[0].name;

        formHtml = `
          <div class="space-y-3">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Select Statutory Reason for Credit (Sec 34 CGST Act)</span>
            <div class="grid grid-cols-2 gap-2">
              ${reasons.map(r => `
                <button type="button" onclick="app.setStudioCreditReason('${tfEscapeHtml(tfEscapeJs(r.name))}')" class="credit-reason-tile p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 ${
                  tfEscapeHtml(selectedReason === r.name 
                    ? 'active bg-rose-500/15 border-rose-500 text-white font-bold shadow-xs ring-1 ring-rose-500/50' 
                    : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800')
                }">
                  <i data-lucide="${tfEscapeHtml(r.icon)}" class="w-4 h-4 inline-block"></i>
                  <div class="min-w-0 flex-1">
                    <p class="truncate leading-tight text-xs font-bold">${tfEscapeHtml(r.name)}</p>
                    <span class="text-xs text-slate-400 block mt-0.5">${tfEscapeHtml(r.desc)}</span>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        `;
      } else if (step === 2) {
        const rowsHtml = o.items.map((it, idx) => `
          <div class="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 mb-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-slate-900 dark:text-white">${tfEscapeHtml(it.name)} (${tfEscapeHtml(it.variant)})</span>
              <span class="text-xs text-slate-400">Orig Qty: <strong class="font-mono">${tfEscapeHtml(it.quantity)}</strong></span>
            </div>
            <div class="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label class="block text-xs text-slate-400 font-medium">Credit Qty (Jars)</label>
                <input type="number" min="0" max="${tfEscapeHtml(it.quantity)}" value="${tfEscapeHtml(it.creditQty !== undefined ? it.creditQty : 0)}" oninput="app.studioDraftData.items[${tfEscapeHtml(idx)}].creditQty = Math.min(${tfEscapeHtml(it.quantity)}, parseInt(this.value) || 0); app.studioIsDirty = true; app.recalculateStudioFinancials(); app.renderStudioInvoiceContent();" class="w-full p-1 border border-slate-300 dark:border-slate-600 rounded bg-transparent text-center font-mono font-bold text-rose-500">
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Unit Rate (₹)</label>
                <div class="p-1 font-mono text-right font-bold text-slate-700 dark:text-slate-300">${tfEscapeHtml(this.formatCurrency(it.unitRate))}</div>
              </div>
              <div>
                <label class="block text-xs text-slate-400 font-medium">Credit Amount</label>
                <div class="p-1 font-mono font-bold text-right text-rose-500">
                  ${tfEscapeHtml(this.formatCurrency((it.creditQty !== undefined ? it.creditQty : 0) * it.unitRate))}
                </div>
              </div>
            </div>
          </div>
        `).join('');

        formHtml = `
          <div class="space-y-3">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Specify Credited Quantities (Cannot exceed invoiced qty)</span>
            <div class="max-h-[360px] overflow-y-auto space-y-2 pr-1">
              ${rowsHtml}
            </div>
          </div>
        `;
      } else if (step === 3) {
        formHtml = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Settlement Method</label>
              <select onchange="app.studioDraftData.settlementMode = this.value; app.studioIsDirty = true; app.renderStudioInvoiceContent();" class="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold">
                <option value="Adjust against outstanding invoice balance" ${tfEscapeHtml(o.settlementMode === 'Adjust against outstanding invoice balance' ? 'selected' : '')}>1. Adjust directly against outstanding balance of this invoice</option>
                <option value="Credit to Customer Account Ledger" ${tfEscapeHtml(o.settlementMode === 'Credit to Customer Account Ledger' ? 'selected' : '')}>2. Credit to Customer Account Ledger (Apply on future orders)</option>
                <option value="Direct Bank Refund" ${tfEscapeHtml(o.settlementMode === 'Direct Bank Refund' ? 'selected' : '')}>3. Direct Bank Refund to Customer</option>
              </select>
            </div>
            <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <p class="font-bold text-slate-800 dark:text-slate-200">GST Output Tax Reversal:</p>
              <p>Under Section 34 of the CGST Act, this credit note reverses previously paid GST liability. The customer must reverse corresponding Input Tax Credit in their GSTR-2B.</p>
            </div>
          </div>
        `;
      } else if (step === 4) {
        formHtml = `
          <div class="space-y-4">
            <div class="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-500">Credit Note Reason:</span>
                <span class="font-bold text-rose-500">${tfEscapeHtml(o.creditReason || 'Damaged Goods')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Original Invoice Ref:</span>
                <span class="font-mono font-bold text-slate-900 dark:text-white">${tfEscapeHtml(o.originalInvoiceNumber || o.invoiceNumber)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Settlement Method:</span>
                <span class="font-bold text-slate-900 dark:text-white">${tfEscapeHtml(o.settlementMode || 'Adjust invoice')}</span>
              </div>
            </div>
            <button type="button" onclick="app.executeStudioPrimaryAction()" class="btn-tactile w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Issue Credit Note</span>
            </button>
          </div>
        `;
      }
    }

    editorEl.innerHTML = stepHeaderHtml + formHtml;
    this.updateStudioValidation();
    if (window.lucide) window.lucide.createIcons();
  }

  onSelectStudioContact(contactId) {
    if (!contactId || !this.studioDraftData) return;
    const c = (this.data.contacts || []).find(x => x.id === contactId);
    if (!c) return;
    this.studioDraftData.retailerId = c.id;
    this.studioDraftData.retailerName = c.name;
    this.studioDraftData.retailerGstin = c.gstin || '';
    this.studioDraftData.customerPhone = c.phone || c.whatsappPhone || '';
    this.studioDraftData.billingAddress = c.billingAddress || '';
    this.studioDraftData.shippingAddress = c.shippingAddress || c.billingAddress || '';
    this.studioIsDirty = true;
    this.renderStudioEditor();
    this.updateStudioValidation();
    this.renderStudioInvoiceContent();
  }

  onSelectStudioCreditInvoice(orderId) {
    if (!orderId || !this.studioDraftData) return;
    const ord = (this.data.orders || []).find(x => x.id === orderId);
    if (!ord) return;
    this.studioDraftData.originalInvoiceNumber = ord.invoiceNumber || ord.id;
    this.studioDraftData.originalInvoiceDate = ord.date;
    this.studioDraftData.originalInvoiceAmount = ord.totalInvoiceAmount;
    this.studioDraftData.retailerName = ord.retailerName;
    this.studioDraftData.retailerGstin = ord.retailerGstin || '';
    this.studioDraftData.items = JSON.parse(JSON.stringify(ord.items));
    this.studioDraftData.items.forEach(it => {
      it.creditQty = 0; // the user enters the quantity actually returned or credited
    });
    this.studioIsDirty = true;
    this.recalculateStudioFinancials();
    this.renderStudioEditor();
    this.updateStudioValidation();
    this.renderStudioInvoiceContent();
  }

  setStudioCreditReason(reason) {
    this.studioCreditReason = reason;
    if (this.studioDraftData) {
      this.studioDraftData.creditReason = reason;
      this.studioIsDirty = true;
      this.renderStudioEditor();
      this.updateStudioValidation();
      this.renderStudioInvoiceContent();
    }
  }

  onStudioAdvAmountChange(val) {
    const num = parseFloat(val) || 0;
    if (this.studioDraftData) {
      this.studioDraftData.amountReceived = num;
      this.studioDraftData.customerAdvanceReceived = num;
      this.studioIsDirty = true;
      this.recalculateStudioFinancials();
      this.updateStudioValidation();
      this.renderStudioInvoiceContent();
      const numWordsEl = document.getElementById('studio-adv-amount-words');
      if (numWordsEl) {
        numWordsEl.textContent = this.numberToIndianWords(num);
      }
    }
  }

  convertProformaToTaxInvoice() {
    if (!this.studioDraftData) return;
    // A proforma keeps its order; it only receives the next sequential invoice number.
    const newInvNo = this.nextOrderNumbers().invoiceNumber;

    const validItems = this.studioDraftData.items.map(i => ({
      ...i,
      isOptional: false
    }));

    this.studioDraftData.items = validItems;
    this.studioDraftData.invoiceNumber = newInvNo;
    this.studioDraftData.documentType = 'TAX INVOICE';
    this.studioActiveDocType = 'TAX INVOICE';
    this.studioActiveStep = 0;
    this.studioIsDirty = true;

    this.updateStudioTabsUI();
    this.recalculateStudioFinancials();
    this.renderStudioSteps();
    this.renderStudioEditor();
    this.updateStudioValidation();
    this.renderStudioInvoiceContent();

    this.showToast(`Converted Proforma to Tax Invoice #${newInvNo}! Review and issue.`);
  }

  updateStudioValidation() {
    const o = this.studioDraftData;
    const docType = this.studioActiveDocType || 'TAX INVOICE';
    const issues = [];

    if (!o) return;

    if (!o.date) issues.push('Document Date');

    if (docType === 'TAX INVOICE') {
      if (!o.invoiceNumber) issues.push('Invoice Number');
      if (!o.retailerName) issues.push('Retailer Name');
      if (!o.items || o.items.length === 0) {
        issues.push('At least 1 Product Item');
      } else {
        const hasZeroQty = o.items.some(i => !i.quantity || i.quantity <= 0);
        if (hasZeroQty) issues.push('Item Quantities must be > 0');
      }
    } else if (docType === 'PROFORMA INVOICE') {
      if (!o.invoiceNumber) issues.push('Proforma Number');
      if (!o.retailerName) issues.push('Buyer / Prospect Name');
      if (!o.items || o.items.length === 0) issues.push('At least 1 Proposed Item');
    } else if (docType === 'ADVANCE RECEIPT' || docType === 'ADVANCE RECEIPT VOUCHER') {
      if (!o.invoiceNumber) issues.push('Voucher Number');
      if (!o.retailerName) issues.push('Payer Name');
      const amt = Number(o.amountReceived || o.customerAdvanceReceived || 0);
      if (amt <= 0) issues.push('Amount Received must be > 0');
    } else if (docType === 'DELIVERY CHALLAN') {
      if (!o.invoiceNumber) issues.push('Challan Number');
      if (!o.retailerName) issues.push('Consignee Name');
      if (!o.items || o.items.length === 0) issues.push('At least 1 Goods Item');
      if (!o.vehicleNumber && !o.transporterName) issues.push('Vehicle or Transporter');
    } else if (docType === 'CREDIT NOTE') {
      if (!o.originalInvoiceNumber) issues.push('Original Invoice Link');
      if (!o.creditReason) issues.push('Credit Reason');
      if (!o.items || o.items.length === 0) issues.push('At least 1 Credited Item');
    }

    this.studioValidationIssues = issues;
    const isValid = issues.length === 0;

    const bar = document.getElementById('studio-validation-bar');
    if (bar) {
      const steps = this.getStudioSteps(docType);
      const curStep = this.studioActiveStep || 0;
      const isLastStep = curStep >= steps.length - 1;

      const navHtml = `
        <div class="flex items-center gap-1.5 shrink-0 ml-2">
          <button type="button" onclick="app.goToStudioStep(${tfEscapeHtml(curStep - 1)})" ${tfEscapeHtml(curStep === 0 ? 'disabled' : '')} class="btn-tactile px-2.5 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer shadow-2xs">
            <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
            <span>Prev</span>
          </button>
          <span class="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 px-1.5 whitespace-nowrap">
            ${tfEscapeHtml(curStep + 1)} / ${tfEscapeHtml(steps.length)}
          </span>
          ${!isLastStep ? `
            <button type="button" onclick="app.goToStudioStep(${tfEscapeHtml(curStep + 1)})" class="btn-tactile px-3 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1 shadow-xs cursor-pointer">
              <span>Next</span>
              <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
            </button>
          ` : `
            <button type="button" onclick="app.executeStudioPrimaryAction()" ${tfEscapeHtml(!isValid ? 'disabled' : '')} class="btn-tactile px-3.5 py-1 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none rounded-lg flex items-center gap-1 shadow-sm cursor-pointer">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
              <span>Issue Document</span>
            </button>
          `}
        </div>
      `;

      if (isValid) {
        bar.className = 'mt-3 p-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-between text-xs shadow-2xs text-emerald-700 dark:text-emerald-400';
        bar.innerHTML = `
          <div class="flex items-center gap-2 font-bold min-w-0">
            <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span class="truncate">All required fields valid — Ready to issue ${tfEscapeHtml(docType.toLowerCase())}</span>
          </div>
          ${navHtml}
        `;
      } else {
        bar.className = 'mt-3 p-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-center justify-between text-xs shadow-2xs text-amber-700 dark:text-amber-400';
        bar.innerHTML = `
          <div class="flex items-center gap-2 font-semibold min-w-0">
            <span class="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse"></span>
            <span class="truncate">${tfEscapeHtml(issues.length)} field(s) need attention: <strong class="text-amber-800 dark:text-amber-300 font-bold">${tfEscapeHtml(issues.join(', '))}</strong></span>
          </div>
          ${navHtml}
        `;
      }
      if (window.lucide) window.lucide.createIcons();
    }

    const statusText = document.getElementById('studio-status-text');
    const statusBadge = document.getElementById('studio-status-badge');
    if (statusText && statusBadge) {
      if (isValid) {
        statusText.textContent = 'Ready to Issue';
        statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-slate-900 dark:text-white border border-emerald-500/40 shadow-2xs';
      } else {
        statusText.textContent = 'Draft';
        statusBadge.className = 'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black bg-amber-100 dark:bg-amber-950 text-slate-900 dark:text-white border border-amber-500/40 shadow-2xs';
      }
    }

    const actionText = document.getElementById('studio-primary-action-text');
    if (actionText) {
      if (docType === 'TAX INVOICE') actionText.textContent = 'Issue Invoice';
      else if (docType === 'PROFORMA INVOICE') actionText.textContent = 'Convert to Invoice';
      else if (docType === 'ADVANCE RECEIPT' || docType === 'ADVANCE RECEIPT VOUCHER') actionText.textContent = 'Issue Receipt';
      else if (docType === 'DELIVERY CHALLAN') actionText.textContent = 'Generate Challan';
      else if (docType === 'CREDIT NOTE') actionText.textContent = 'Issue Credit Note';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  executeStudioPrimaryAction() {
    const o = this.studioDraftData;
    const docType = this.studioActiveDocType || 'TAX INVOICE';
    if (!o) return;

    if (docType === 'PROFORMA INVOICE') {
      this.convertProformaToTaxInvoice();
      return;
    }

    if (docType === 'TAX INVOICE') {
      if (this.studioSelectedOrderId && this.studioSelectedOrderId !== 'draft') {
        const order = this.data.orders.find(x => x.id === this.studioSelectedOrderId);
        if (order) {
          order.invoiceNumber = o.invoiceNumber;
          order.date = o.date;
          order.status = 'confirmed';
        }
      }
      this.studioIsDirty = false;
      const statusText = document.getElementById('studio-status-text');
      const statusBadge = document.getElementById('studio-status-badge');
      if (statusText) statusText.textContent = 'Issued';
      if (statusBadge) statusBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white border border-emerald-500';
      this.downloadStudioInvoicePDF(false);
      this.showToast(`Tax Invoice #${o.invoiceNumber} issued & saved!`);
    } else if (docType === 'ADVANCE RECEIPT' || docType === 'ADVANCE RECEIPT VOUCHER') {
      const amt = Number(o.amountReceived || o.customerAdvanceReceived || 0);
      if (this.studioSelectedOrderId && this.studioSelectedOrderId !== 'draft') {
        const order = this.data.orders.find(x => x.id === this.studioSelectedOrderId);
        if (order) {
          order.customerAdvanceReceived = (order.customerAdvanceReceived || 0) + amt;
          order.customerBalanceDue = Math.max(0, (order.totalInvoiceAmount || 0) - order.customerAdvanceReceived);
        }
      }
      this.studioIsDirty = false;
      this.downloadStudioInvoicePDF(false);
      this.showToast(`Advance Receipt Voucher #${o.invoiceNumber} issued for ${this.formatCurrency(amt)}!`);
    } else if (docType === 'DELIVERY CHALLAN') {
      this.studioIsDirty = false;
      this.downloadStudioInvoicePDF(false);
      this.showToast(`Delivery Challan #${o.invoiceNumber} generated & ready for dispatch!`);
    } else if (docType === 'CREDIT NOTE') {
      this.studioIsDirty = false;
      this.downloadStudioInvoicePDF(false);
      this.showToast(`Credit Note #${o.invoiceNumber} issued against ${o.originalInvoiceNumber || 'original invoice'}!`);
    }
  }

  saveStudioDraft() {
    this.studioIsDirty = false;
    this.updateStudioValidation();
    this.showToast(`Draft changes saved for ${this.studioDraftData ? this.studioDraftData.invoiceNumber : 'document'}`);
  }

  toggleStudioQr(checked) {
    this.studioShowQr = checked;
    this.renderStudioInvoiceContent();
  }

  toggleStudioSeal(checked) {
    this.studioShowSeal = checked;
    this.renderStudioInvoiceContent();
  }

  toggleStudioCases(checked) {
    this.studioShowCases = checked;
    this.renderStudioInvoiceContent();
  }

  toggleStudioEdit(checked) {
    this.studioIsEditMode = checked;
    this.renderStudioInvoiceContent();
  }

  toggleStudioHideHsn(checked) {
    this.studioHideHsn = !!checked;
    this.renderStudioInvoiceContent();
  }

  toggleStudioHsn(showHsn) {
    this.studioHideHsn = !showHsn;
    this.renderStudioInvoiceContent();
  }

  onStudioItemChange(itemIdx, field, value) {
    if (!this.studioDraftData || !this.studioDraftData.items[itemIdx]) return;
    const item = this.studioDraftData.items[itemIdx];

    if (field === 'cases') {
      item.cases = parseInt(value) || 0;
      item.casePack = item.casePack || 24;
      item.quantity = item.cases * item.casePack;
    } else if (field === 'quantity') {
      item.quantity = parseInt(value) || 0;
      item.casePack = item.casePack || 24;
      item.cases = Math.ceil(item.quantity / item.casePack);
    } else if (field === 'unitRate') {
      item.unitRate = parseFloat(value) || 0;
    } else if (field === 'name') {
      item.name = value;
    } else if (field === 'variant') {
      item.variant = value;
    }

    item.totalAmount = item.quantity * item.unitRate;
    this.recalculateStudioFinancials();
    this.renderStudioInvoiceContent();
  }

  addStudioItem() {
    if (!this.studioDraftData) return;
    this.studioDraftData.items.push({
      id: 'PRD-' + Date.now().toString().slice(-3),
      name: 'New Product Variety',
      variant: '500g Jar',
      packSize: '500g',
      casePack: 24,
      cases: 10,
      quantity: 240,
      unitRate: 46.50,
      totalAmount: 11160.00,
      isOptional: false,
      creditQty: 24
    });
    this.studioIsDirty = true;
    this.recalculateStudioFinancials();
    this.renderStudioEditor();
    this.updateStudioValidation();
    this.renderStudioInvoiceContent();
  }

  removeStudioItem(idx) {
    if (!this.studioDraftData || this.studioDraftData.items.length <= 1) {
      this.showToast('Must have at least 1 item in the document.');
      return;
    }
    this.studioDraftData.items.splice(idx, 1);
    this.studioIsDirty = true;
    this.recalculateStudioFinancials();
    this.renderStudioEditor();
    this.updateStudioValidation();
    this.renderStudioInvoiceContent();
  }

  recalculateStudioFinancials() {
    const o = this.studioDraftData;
    if (!o) return;

    // Filter out optional items in proforma
    const effectiveItems = (o.items || []).filter(i => !i.isOptional);
    const gst = this.computeGst(effectiveItems, o.gstType !== 'intra');
    o.taxableSubtotal = gst.taxable;
    o.cgstAmount = gst.cgst;
    o.sgstAmount = gst.sgst;
    o.igstAmount = gst.igst;
    o.gstRates = gst.rates;
    o.totalInvoiceAmount = gst.total;
    o.customerAdvanceReceived = Number(o.customerAdvanceReceived || o.amountReceived || 0);
    o.customerBalanceDue = Math.max(0, parseFloat((o.totalInvoiceAmount - o.customerAdvanceReceived).toFixed(2)));
  }

  renderStudioInvoiceContent() {
    const container = document.getElementById('printable-studio-invoice-container');
    const order = this.studioDraftData;
    const profile = this.data.businessProfile || {};

    if (!container || !order) return;

    const retailer = (order.retailerId && this.data.contacts.find(c => c.id === order.retailerId)) || {
      name: order.retailerName || '',
      billingAddress: order.billingAddress || '',
      shippingAddress: order.shippingAddress || '',
      gstin: order.retailerGstin || '',
      state: order.retailerState || '',
      stateCode: order.retailerStateCode || '',
      phone: order.customerPhone || ''
    };

    const docType = this.studioActiveDocType || order.documentType || 'TAX INVOICE';
    const isEdit = this.studioIsEditMode;
    const showQr = this.studioShowQr;
    const showSeal = this.studioShowSeal;
    const showCases = this.studioShowCases;
    const hideHsn = !!this.studioHideHsn;

    const totalItems = order.items.length;
    let descFont = 'text-xs';
    let numFont = 'text-xs';
    let rowPad = 'py-1.5 px-2';
    let sealSize = '56px';
    let sealInnerSize = '48px';
    let qrSize = '62px';

    if (totalItems > 12) {
      descFont = 'text-xs';
      numFont = 'text-xs';
      rowPad = 'py-1.2 px-2';
      sealSize = '50px';
      sealInnerSize = '42px';
      qrSize = '56px';
    } else if (totalItems > 7) {
      descFont = 'text-xs';
      numFont = 'text-xs';
      rowPad = 'py-1.5 px-2';
      sealSize = '56px';
      sealInnerSize = '46px';
      qrSize = '62px';
    } else {
      descFont = 'text-xs';
      numFont = 'text-xs';
      rowPad = 'py-2 px-2.5';
      sealSize = '62px';
      sealInnerSize = '52px';
      qrSize = '68px';
    }

    const digitalSealHtml = showSeal ? `
      <div class="relative mx-auto my-1 flex items-center justify-center rounded-full border-2 border-dashed border-emerald-700 text-emerald-800 rotate-[-5deg] select-none pointer-events-none opacity-90" style="width: ${tfEscapeHtml(sealSize)}; height: ${tfEscapeHtml(sealSize)};">
        <div class="rounded-full border border-emerald-600 flex flex-col items-center justify-center text-center bg-emerald-50/30" style="width: ${tfEscapeHtml(sealInnerSize)}; height: ${tfEscapeHtml(sealInnerSize)};">
          <span class="text-[6.5px] font-black uppercase tracking-tighter text-emerald-900 leading-none">MAGIC ROOTS</span>
          <span class="text-[5.5px] font-bold text-emerald-700 leading-none my-0.5">SEAL</span>
          <span class="text-[6px] font-black uppercase tracking-wider text-emerald-950 border-y border-emerald-600 py-0.5">AUTHORIZED</span>
        </div>
      </div>
    ` : '<div class="h-8"></div>';

    // ================= 1. PROFORMA INVOICE PREVIEW =================
    if (docType === 'PROFORMA INVOICE') {
      const itemsHtml = order.items.map((item, idx) => {
        const cPack = item.casePack || this.config().defaultCasePack;
        const cs = item.cases || Math.ceil(item.quantity / cPack);
        const varLabel = (item.variant && item.variant !== 'undefined') ? item.variant : (item.packSize && item.packSize !== 'undefined' ? item.packSize : '');
        return `
          <tr class="border-b border-slate-200/80 hover:bg-slate-50/50 ${tfEscapeHtml(item.isOptional ? 'bg-amber-50/30' : '')}">
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-500">${tfEscapeHtml(idx + 1)}</td>
            <td class="${tfEscapeHtml(rowPad)} text-left ${tfEscapeHtml(descFont)} leading-tight">
              <span class="font-bold text-slate-900">${tfEscapeHtml(item.name)}</span>
              ${varLabel ? `<span class="text-slate-500 font-medium text-xs ml-1">(${tfEscapeHtml(varLabel)})</span>` : ''}
              ${item.isOptional ? '<span class="ml-1.5 px-1.5 py-0.2 text-xs font-black uppercase bg-amber-100 text-amber-900 rounded border border-amber-300">Optional</span>' : ''}
            </td>
            ${!hideHsn ? `<td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-600">${tfEscapeHtml(this.itemHsn(item))}</td>` : ''}
            ${showCases ? `<td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num font-bold text-slate-900">${tfEscapeHtml(cs)} ${tfEscapeHtml(cs === 1 ? 'case' : 'cases')}</td>` : ''}
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num font-semibold text-slate-900">${tfEscapeHtml(item.quantity.toLocaleString('en-IN'))}</td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num">${tfEscapeHtml(this.formatCurrency(item.unitRate))}</td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num font-bold text-slate-900">${tfEscapeHtml(this.formatCurrency(item.totalAmount))}</td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div class="studio-invoice-sheet bg-white p-4 sm:p-5 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800" style="max-width: 820px;">
          <!-- Header -->
          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-2">
            <div>
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-sm font-bold"><i data-lucide="leaf" class="w-4 h-4 inline-block"></i></div>
                <div>
                  <h1 class="text-xl font-black text-slate-900 leading-none">${tfEscapeHtml(profile.brandName)}</h1>
                  <p class="text-xs text-slate-600 font-bold mt-0.5">${tfEscapeHtml(profile.legalName)}</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 mt-1 leading-snug">
                <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)} - ${tfEscapeHtml(profile.pincode)}</p>
                <p><strong>GSTIN:</strong> ${tfEscapeHtml(profile.gstin)} | <strong>FSSAI:</strong> ${tfEscapeHtml(profile.fssai)}</p>
                <p><strong>Phone:</strong> ${tfEscapeHtml(profile.phone)} • ${tfEscapeHtml(profile.email)}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="inline-block px-3 py-1 bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded shadow-xs">PROFORMA INVOICE</span>
              <span class="block text-xs text-slate-500 font-medium mt-0.5">Commercial Estimation • Pre-Shipment Quotation</span>
              <div class="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-right">
                <span class="text-slate-500">Estimate No:</span>
                <strong class="font-mono-num text-slate-900">${tfEscapeHtml(order.invoiceNumber)}</strong>
                <span class="text-slate-500">Date:</span>
                <span class="font-mono-num font-semibold text-slate-800">${tfEscapeHtml(this.formatDate(order.date))}</span>
                <span class="text-slate-500">Validity:</span>
                <span class="font-semibold text-slate-800">${tfEscapeHtml(order.validityDays || 15)} Days</span>
              </div>
            </div>
          </div>

          <!-- Mandatory Estimate Banner -->
          <div class="my-1.5 py-1 px-3 bg-amber-50 border border-amber-300 rounded text-center text-xs font-black uppercase tracking-wider text-amber-900 flex items-center justify-center gap-1.5">
            <span><i data-lucide="triangle-alert" class="w-4 h-4 inline-block"></i></span>
            <span>COMMERCIAL ESTIMATE ONLY — NOT A TAX INVOICE (NO INPUT TAX CREDIT VALIDITY)</span>
          </div>

          <!-- Quoted For -->
          <div class="grid grid-cols-2 gap-2.5 py-1.5 border-b border-slate-200 text-xs">
            <div class="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span class="font-bold uppercase tracking-wider text-xs block text-slate-500 mb-0.5">Quotation Prepared For:</span>
              <p class="font-black text-slate-900 text-xs">${tfEscapeHtml(retailer.name)}</p>
              <p class="text-slate-600 truncate mt-0.5">${tfEscapeHtml(retailer.billingAddress)}</p>
              <p class="mt-0.5"><strong>Phone / WA:</strong> ${tfEscapeHtml(retailer.phone || order.customerPhone)}</p>
            </div>
            <div class="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span class="font-bold uppercase tracking-wider text-xs block text-slate-500 mb-0.5">Commercial Dispatch Terms:</span>
              <p><strong>Advance Required:</strong> ${tfEscapeHtml(order.advancePercent || 50)}% with Purchase Confirmation</p>
              <p class="mt-0.5"><strong>Est. Dispatch:</strong> ${tfEscapeHtml(order.dispatchDays || '5-7 Working Days')}</p>
              <p class="mt-0.5"><strong>Freight:</strong> ${tfEscapeHtml(order.freightTerms || this.config().defaultFreightTerms || '—')}</p>
            </div>
          </div>

          <!-- Table -->
          <div class="mt-1.5">
            <table class="w-full border border-slate-200 text-xs">
              <thead class="bg-slate-100 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                <tr>
                  <th class="py-1 px-1 text-center w-7">#</th>
                  <th class="py-1 px-2 text-left">Proposed Goods Description</th>
                  ${!hideHsn ? '<th class="py-1 px-1 text-center w-16">HSN</th>' : ''}
                  ${showCases ? '<th class="py-1 px-1 text-center w-16">Packing</th>' : ''}
                  <th class="py-1 px-1 text-right w-16">Qty (Jars)</th>
                  <th class="py-1 px-1 text-right w-18">Quoted Rate</th>
                  <th class="py-1 px-2 text-right w-22">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <!-- Financials -->
          <div class="grid grid-cols-12 gap-3 mt-2 pt-2 border-t border-slate-200">
            <div class="col-span-7 space-y-1 text-xs">
              <div class="p-1.5 bg-slate-50 border border-slate-200 rounded leading-relaxed">
                <span class="text-xs uppercase font-bold text-slate-400 block">Total Quotation Value in Words:</span>
                <p class="font-bold text-slate-900">${tfEscapeHtml(this.numberToIndianWords(order.totalInvoiceAmount))}</p>
              </div>
              <p class="text-xs text-slate-400 italic">Prices valid for 15 days. GST rates apply as statutory on final sale invoice.</p>
            </div>
            <div class="col-span-5 space-y-1 text-xs">
              <div class="flex justify-between text-slate-600">
                <span>Proposed Subtotal:</span>
                <span class="font-mono font-medium">${tfEscapeHtml(this.formatCurrency(order.taxableSubtotal))}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>Estimated GST (${tfEscapeHtml(this.gstLabels(order).combined)}):</span>
                <span class="font-mono font-medium">${tfEscapeHtml(this.formatCurrency((order.cgstAmount || 0) + (order.sgstAmount || 0) + (order.igstAmount || 0)))}</span>
              </div>
              <div class="flex justify-between py-1 border-t-2 border-slate-900 font-bold text-xs">
                <span class="font-black text-slate-900">Total Estimated Value:</span>
                <span class="font-mono font-black text-slate-900">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
              </div>
            </div>
          </div>

          <!-- Signatures -->
          <div class="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-200 text-xs">
            <div>
              <span class="font-bold text-slate-800 uppercase tracking-wider text-xs block mb-0.5">Commercial Terms:</span>
              <p class="text-slate-500 text-xs leading-relaxed">Standard production schedule starts upon advance receipt. Final GST invoice issued upon dispatch.</p>
            </div>
            <div class="text-right flex flex-col justify-end items-end">
              <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
              ${digitalSealHtml}
              <p class="border-t border-slate-400 pt-0.5 text-xs text-slate-600 font-medium">Commercial Executive</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // ================= 2. ADVANCE RECEIPT VOUCHER PREVIEW =================
    if (docType === 'ADVANCE RECEIPT' || docType === 'ADVANCE RECEIPT VOUCHER') {
      const advAmt = Number(order.amountReceived || order.customerAdvanceReceived || 0);
      container.innerHTML = `
        <div class="studio-invoice-sheet bg-white p-5 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800" style="max-width: 820px;">
          <!-- Header -->
          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-2">
            <div>
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-sm font-bold"><i data-lucide="leaf" class="w-4 h-4 inline-block"></i></div>
                <div>
                  <h1 class="text-xl font-black text-slate-900 leading-none">${tfEscapeHtml(profile.brandName)}</h1>
                  <p class="text-xs text-slate-600 font-bold mt-0.5">${tfEscapeHtml(profile.legalName)}</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 mt-1 leading-snug">
                <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)} - ${tfEscapeHtml(profile.pincode)}</p>
                <p><strong>GSTIN:</strong> ${tfEscapeHtml(profile.gstin)} | <strong>FSSAI:</strong> ${tfEscapeHtml(profile.fssai)}</p>
                <p><strong>Phone:</strong> ${tfEscapeHtml(profile.phone)} • ${tfEscapeHtml(profile.email)}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="inline-block px-3 py-1 bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded shadow-xs">ADVANCE RECEIPT VOUCHER</span>
              <span class="block text-xs text-slate-500 font-medium mt-0.5">Statutory Receipt Voucher • Rule 50 CGST Rules</span>
              <div class="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-right">
                <span class="text-slate-500">Voucher No:</span>
                <strong class="font-mono-num text-slate-900">${tfEscapeHtml(order.invoiceNumber)}</strong>
                <span class="text-slate-500">Receipt Date:</span>
                <span class="font-mono-num font-semibold text-slate-800">${tfEscapeHtml(this.formatDate(order.date))}</span>
                <span class="text-slate-500">Financial Year:</span>
                <span class="font-semibold text-slate-800">2026-27</span>
              </div>
            </div>
          </div>

          <!-- Prominent Amount Card -->
          <div class="my-3 p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl flex items-center justify-between">
            <div>
              <span class="text-xs uppercase font-bold text-emerald-800 tracking-wider">Amount Received in Advance:</span>
              <h2 class="text-2xl font-black text-emerald-950 font-mono-num leading-tight">${tfEscapeHtml(this.formatCurrency(advAmt))}</h2>
              <p class="text-xs font-bold text-emerald-800 mt-0.5">${tfEscapeHtml(this.numberToIndianWords(advAmt))}</p>
            </div>
            <div class="text-right space-y-1">
              <span class="px-2.5 py-1 rounded-md bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-2xs">${tfEscapeHtml(order.paymentMode || 'UPI')}</span>
              <p class="text-xs text-slate-600 font-mono-num mt-1 font-bold">UTR / Ref: ${tfEscapeHtml(order.utrNumber || '')}</p>
            </div>
          </div>

          <!-- Payer & Allocation Cards -->
          <div class="grid grid-cols-2 gap-3 py-2 border-y border-slate-200 text-xs">
            <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span class="font-bold uppercase tracking-wider text-xs block text-slate-500 mb-0.5">Received With Thanks From:</span>
              <p class="font-black text-slate-900 text-xs">${tfEscapeHtml(retailer.name)}</p>
              <p class="text-slate-600 truncate mt-0.5">${tfEscapeHtml(retailer.billingAddress)}</p>
              <p class="mt-0.5"><strong>GSTIN:</strong> ${tfEscapeHtml(retailer.gstin)} | <strong>Phone:</strong> ${tfEscapeHtml(retailer.phone || order.customerPhone)}</p>
            </div>
            <div class="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span class="font-bold uppercase tracking-wider text-xs block text-slate-500 mb-0.5">Allocation &amp; Bank Account:</span>
              <p><strong>Allocated Against:</strong> ${tfEscapeHtml(order.allocationRef || 'Supply Order #' + order.invoiceNumber)}</p>
              <p class="mt-0.5"><strong>Deposited Bank:</strong> ${tfEscapeHtml(profile.bankName)} (A/C: ${tfEscapeHtml(profile.accountNumber)})</p>
              <p class="mt-0.5"><strong>IFSC Code:</strong> ${tfEscapeHtml(profile.ifsc)}</p>
            </div>
          </div>

          <!-- Statutory Declaration -->
          <div class="my-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
            <p class="font-bold text-slate-800">Statutory GST Declaration (Rule 50 CGST Rules, 2017):</p>
            <p>This voucher legally acknowledges receipt of advance consideration toward taxable supply of packaged foods. A regular GST Tax Invoice will be issued at the time of dispatch, and the advance amount will be adjusted therein.</p>
          </div>

          <!-- Signatures -->
          <div class="grid grid-cols-2 gap-3 mt-4 pt-2 border-t border-slate-200 text-xs">
            <div class="flex flex-col justify-end">
              <p class="text-slate-500 text-xs">System-authenticated digital receipt record.</p>
            </div>
            <div class="text-right flex flex-col justify-end items-end">
              <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
              ${digitalSealHtml}
              <p class="border-t border-slate-400 pt-0.5 text-xs text-slate-600 font-medium">Authorized Cashier / Accountant</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // ================= 3. DELIVERY CHALLAN PREVIEW =================
    if (docType === 'DELIVERY CHALLAN') {
      const itemsHtml = order.items.map((item, idx) => {
        const cPack = item.casePack || this.config().defaultCasePack;
        const cs = item.cases || Math.ceil(item.quantity / cPack);
        const netKg = (item.quantity * (item.packSize === '1kg' ? 1.0 : (item.packSize === '5kg' ? 5.0 : 0.5))).toFixed(1);
        const grossKg = (netKg * 1.1).toFixed(1);
        const varLabel = (item.variant && item.variant !== 'undefined') ? item.variant : (item.packSize && item.packSize !== 'undefined' ? item.packSize : '');

        return `
          <tr class="border-b border-slate-200/80 hover:bg-slate-50/50">
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-500">${tfEscapeHtml(idx + 1)}</td>
            <td class="${tfEscapeHtml(rowPad)} text-left ${tfEscapeHtml(descFont)}">
              <span class="font-bold text-slate-900">${tfEscapeHtml(item.name)}</span>
              ${varLabel ? `<span class="text-slate-500 text-xs ml-1">(${tfEscapeHtml(varLabel)})</span>` : ''}
            </td>
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-700">${tfEscapeHtml(order.batchNumber || '')}</td>
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num font-bold text-slate-900">${tfEscapeHtml(cs)} ${tfEscapeHtml(cs === 1 ? 'case' : 'cases')} (${tfEscapeHtml(cPack)}/case)</td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num font-bold text-slate-900">${tfEscapeHtml(item.quantity.toLocaleString('en-IN'))} Jars</td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num">${tfEscapeHtml(netKg)} kg</td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num font-semibold text-slate-900">${tfEscapeHtml(grossKg)} kg</td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div class="studio-invoice-sheet bg-white p-4 sm:p-5 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800" style="max-width: 820px;">
          <!-- Header -->
          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-2">
            <div>
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-sm font-bold"><i data-lucide="leaf" class="w-4 h-4 inline-block"></i></div>
                <div>
                  <h1 class="text-xl font-black text-slate-900 leading-none">${tfEscapeHtml(profile.brandName)}</h1>
                  <p class="text-xs text-slate-600 font-bold mt-0.5">${tfEscapeHtml(profile.legalName)}</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 mt-1 leading-snug">
                <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)} - ${tfEscapeHtml(profile.pincode)}</p>
                <p><strong>GSTIN:</strong> ${tfEscapeHtml(profile.gstin)} | <strong>FSSAI:</strong> ${tfEscapeHtml(profile.fssai)}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="inline-block px-3 py-1 bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded shadow-xs">DELIVERY CHALLAN</span>
              <span class="block text-xs text-slate-500 font-medium mt-0.5">Goods Movement • Rule 55 CGST Rules</span>
              <div class="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-right">
                <span class="text-slate-500">Challan No:</span>
                <strong class="font-mono-num text-slate-900">${tfEscapeHtml(order.invoiceNumber)}</strong>
                <span class="text-slate-500">Dispatch Date:</span>
                <span class="font-mono-num font-semibold text-slate-800">${tfEscapeHtml(this.formatDate(order.date))}</span>
              </div>
            </div>
          </div>

          <!-- Nature of Movement Banner -->
          <div class="my-1.5 py-1 px-3 bg-blue-50 border border-blue-300 rounded text-center text-xs font-black uppercase tracking-wider text-blue-950 flex items-center justify-center gap-1.5">
            <span>NATURE OF MOVEMENT:</span>
            <span class="text-blue-800">${tfEscapeHtml(order.movementPurpose || 'JOB WORK / SUPPLY TO PROCESSOR')}</span>
          </div>

          <!-- Consignee & Transport 2-Column Strip -->
          <div class="grid grid-cols-2 gap-2.5 py-1.5 border-b border-slate-200 text-xs">
            <div class="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span class="font-bold uppercase tracking-wider text-xs block text-slate-500 mb-0.5">Consignee (Shipped To):</span>
              <p class="font-black text-slate-900 text-xs">${tfEscapeHtml(retailer.name)}</p>
              <p class="text-slate-600 truncate mt-0.5">${tfEscapeHtml(retailer.shippingAddress || retailer.billingAddress)}</p>
              <p class="mt-0.5"><strong>Phone:</strong> ${tfEscapeHtml(retailer.phone || order.customerPhone)}</p>
            </div>
            <div class="bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span class="font-bold uppercase tracking-wider text-xs block text-slate-500 mb-0.5">Transport &amp; Vehicle Details:</span>
              <p><strong>Vehicle No:</strong> <span class="font-mono-num font-bold text-slate-900">${tfEscapeHtml(order.vehicleNumber || '')}</span></p>
              <p class="mt-0.5"><strong>Fleet / Transporter:</strong> ${tfEscapeHtml(order.transporterName || '')}</p>
              <p class="mt-0.5"><strong>Driver:</strong> ${tfEscapeHtml(order.driverName || '')} (${tfEscapeHtml(order.driverPhone || '')})</p>
            </div>
          </div>

          <!-- Goods Table (Strictly NO PRICES, NO RATES, NO GST) -->
          <div class="mt-1.5">
            <table class="w-full border border-slate-200 text-xs">
              <thead class="bg-slate-100 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                <tr>
                  <th class="py-1 px-1 text-center w-7">#</th>
                  <th class="py-1 px-2 text-left">Description of Goods</th>
                  <th class="py-1 px-1 text-center w-20">Batch No</th>
                  <th class="py-1 px-1 text-center w-24">Packing</th>
                  <th class="py-1 px-1 text-right w-20">Units</th>
                  <th class="py-1 px-1 text-right w-16">Net Wt</th>
                  <th class="py-1 px-2 text-right w-18">Gross Wt</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <!-- Statutory Declaration -->
          <div class="my-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 leading-relaxed">
            <p><strong>Statutory Note (Rule 55 CGST Rules):</strong> Goods dispatched strictly for movement / job work under Rule 55. Value declared for transit insurance only and does not constitute a sale. Not valid for claiming GST Input Tax Credit.</p>
          </div>

          <!-- 3-Way Acknowledgment Slip -->
          <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200 text-xs">
            <div class="border border-dashed border-slate-300 p-2 rounded text-center">
              <span class="text-slate-400 block mb-4">Driver's Signature</span>
              <p class="font-bold text-slate-700">${tfEscapeHtml(order.driverName || '')}</p>
            </div>
            <div class="border border-dashed border-slate-300 p-2 rounded text-center">
              <span class="text-slate-400 block mb-4">Receiver's Seal &amp; Signature</span>
              <p class="font-bold text-slate-700">Acknowledgment of Receipt</p>
            </div>
            <div class="text-right flex flex-col justify-end items-end">
              <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
              ${digitalSealHtml}
              <p class="border-t border-slate-400 pt-0.5 text-xs text-slate-600 font-medium">Authorized Dispatcher</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // ================= 4. CREDIT NOTE PREVIEW =================
    if (docType === 'CREDIT NOTE') {
      const itemsHtml = order.items.map((item, idx) => {
        const cQty = item.creditQty !== undefined ? item.creditQty : 0;
        const cAmt = cQty * item.unitRate;

        return `
          <tr class="border-b border-slate-200/80 hover:bg-slate-50/50">
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-500">${tfEscapeHtml(idx + 1)}</td>
            <td class="${tfEscapeHtml(rowPad)} text-left ${tfEscapeHtml(descFont)}">
              <span class="font-bold text-slate-900">${tfEscapeHtml(item.name)}</span>
              ${item.variant && item.variant !== 'undefined' ? `<span class="text-slate-500 text-xs ml-1">(${tfEscapeHtml(item.variant)})</span>` : ''}
            </td>
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-500">${tfEscapeHtml(item.quantity)}</td>
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num font-bold text-rose-600">${tfEscapeHtml(cQty)}</td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num">${tfEscapeHtml(this.formatCurrency(item.unitRate))}</td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num font-bold text-rose-600">${tfEscapeHtml(this.formatCurrency(cAmt))}</td>
          </tr>
        `;
      }).join('');

      const creditLines = order.items.map(i => ({ ...i, totalAmount: (Number(i.creditQty) || 0) * (Number(i.unitRate) || 0) }));
      const creditTax = this.computeGst(creditLines, order.gstType !== 'intra');
      const creditSubtotal = creditTax.taxable;
      const creditGst = Math.round((creditTax.cgst + creditTax.sgst + creditTax.igst) * 100) / 100;
      const creditTotal = creditTax.total;

      container.innerHTML = `
        <div class="studio-invoice-sheet bg-white p-4 sm:p-5 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800" style="max-width: 820px;">
          <!-- Header -->
          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-2">
            <div>
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-sm font-bold"><i data-lucide="leaf" class="w-4 h-4 inline-block"></i></div>
                <div>
                  <h1 class="text-xl font-black text-slate-900 leading-none">${tfEscapeHtml(profile.brandName)}</h1>
                  <p class="text-xs text-slate-600 font-bold mt-0.5">${tfEscapeHtml(profile.legalName)}</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 mt-1 leading-snug">
                <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)} - ${tfEscapeHtml(profile.pincode)}</p>
                <p><strong>GSTIN:</strong> ${tfEscapeHtml(profile.gstin)} | <strong>FSSAI:</strong> ${tfEscapeHtml(profile.fssai)}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="inline-block px-3 py-1 bg-rose-600 text-white text-xs font-black uppercase tracking-wider rounded shadow-xs">CREDIT NOTE</span>
              <span class="block text-xs text-slate-500 font-medium mt-0.5">Statutory Credit Adjustment • Sec 34 CGST Act</span>
              <div class="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-right">
                <span class="text-slate-500">Credit Note No:</span>
                <strong class="font-mono-num text-slate-900">CN-${tfEscapeHtml(order.invoiceNumber.replace(/[^0-9]/g, '').slice(-4) || '0101')}</strong>
                <span class="text-slate-500">Date:</span>
                <span class="font-mono-num font-semibold text-slate-800">${tfEscapeHtml(this.formatDate(order.date))}</span>
              </div>
            </div>
          </div>

          <!-- Original Invoice Link Box -->
          <div class="my-1.5 p-2 bg-rose-50/90 border border-rose-200 rounded-lg flex items-center justify-between text-xs">
            <div>
              <span class="text-xs font-bold uppercase text-rose-800 tracking-wider">Adjustment Against Original Tax Invoice:</span>
              <p class="font-black text-xs text-slate-900 font-mono-num leading-tight">${tfEscapeHtml(order.originalInvoiceNumber || order.invoiceNumber)}</p>
              <p class="text-slate-600 mt-0.5">Original Date: ${tfEscapeHtml(this.formatDate(order.originalInvoiceDate || order.date))} • Invoiced Value: ${tfEscapeHtml(this.formatCurrency(order.originalInvoiceAmount || order.totalInvoiceAmount))}</p>
            </div>
            <div class="text-right">
              <span class="px-2 py-0.5 rounded bg-rose-600 text-white font-bold uppercase text-xs shadow-2xs">${tfEscapeHtml(order.creditReason || this.studioCreditReason || '')}</span>
              <p class="text-xs text-rose-700 font-medium mt-1">Sec 34(1) CGST Act</p>
            </div>
          </div>

          <!-- Credited Items Table -->
          <div class="mt-1.5">
            <table class="w-full border border-slate-200 text-xs">
              <thead class="bg-slate-100 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
                <tr>
                  <th class="py-1 px-1 text-center w-7">#</th>
                  <th class="py-1 px-2 text-left">Description of Goods</th>
                  <th class="py-1 px-1 text-center w-18">Orig Qty</th>
                  <th class="py-1 px-1 text-center w-18">Credit Qty</th>
                  <th class="py-1 px-1 text-right w-18">Unit Rate</th>
                  <th class="py-1 px-2 text-right w-22">Credit Taxable (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <!-- Credit Financials -->
          <div class="grid grid-cols-12 gap-3 mt-2 pt-2 border-t border-slate-200">
            <div class="col-span-7 space-y-1 text-xs">
              <div class="p-1.5 bg-slate-50 border border-slate-200 rounded leading-relaxed">
                <span class="text-xs uppercase font-bold text-slate-400 block">Total Credit in Words:</span>
                <p class="font-bold text-slate-900">${tfEscapeHtml(this.numberToIndianWords(creditTotal))}</p>
              </div>
              <p class="text-xs text-slate-500"><strong>Settlement Method:</strong> ${tfEscapeHtml(order.settlementMode || 'Adjust directly against outstanding invoice balance')}</p>
            </div>
            <div class="col-span-5 space-y-1 text-xs">
              <div class="flex justify-between text-slate-600">
                <span>Taxable Credit:</span>
                <span class="font-mono font-medium text-rose-600">-${tfEscapeHtml(this.formatCurrency(creditSubtotal))}</span>
              </div>
              <div class="flex justify-between text-slate-600">
                <span>GST Reversal (${tfEscapeHtml(this.gstLabels(order).combined)}):</span>
                <span class="font-mono font-medium text-rose-600">-${tfEscapeHtml(this.formatCurrency(creditGst))}</span>
              </div>
              <div class="flex justify-between py-1 border-t-2 border-slate-900 font-bold text-xs">
                <span class="font-black text-rose-700">Total Credit Note Value:</span>
                <span class="font-mono font-black text-rose-700">${tfEscapeHtml(this.formatCurrency(creditTotal))}</span>
              </div>
            </div>
          </div>

          <!-- Signatures -->
          <div class="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-200 text-xs">
            <div>
              <span class="font-bold text-slate-800 uppercase tracking-wider text-xs block mb-0.5">Statutory Declaration:</span>
              <p class="text-slate-500 text-xs leading-relaxed">Issued under Section 34 of the CGST Act. The recipient agrees to reverse the corresponding Input Tax Credit.</p>
            </div>
            <div class="text-right flex flex-col justify-end items-end">
              <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
              ${digitalSealHtml}
              <p class="border-t border-slate-400 pt-0.5 text-xs text-slate-600 font-medium">Authorized Signatory</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // ================= 5. STANDARD TAX INVOICE PREVIEW =================
    const amountInWords = this.numberToIndianWords(order.totalInvoiceAmount);
    const upiQrUrl = this.generateUpiQrUrl(profile.upiId, profile.brandName, order.customerBalanceDue, order.invoiceNumber);

    const itemsHtml = order.items.map((item, idx) => {
      const cPack = item.casePack || this.casePackConfig[item.packSize] || this.config().defaultCasePack;
      const cs = item.cases || Math.ceil(item.quantity / cPack);
      const varLabel = (item.variant && item.variant !== 'undefined') ? item.variant : (item.packSize && item.packSize !== 'undefined' ? item.packSize : '');

      if (isEdit) {
        return `
          <tr class="border-b border-slate-200">
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-500">${tfEscapeHtml(idx + 1)}</td>
            <td class="${tfEscapeHtml(rowPad)} text-left ${tfEscapeHtml(descFont)}">
              <input type="text" value="${tfEscapeHtml(item.name)}" onchange="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'name', this.value)" class="w-full p-0.5 border border-amber-300 bg-amber-50/50 rounded font-bold text-xs">
              <input type="text" value="${tfEscapeHtml(varLabel)}" onchange="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'variant', this.value)" class="w-full p-0.5 border border-slate-200 rounded text-xs text-slate-500 mt-0.5">
            </td>
            ${!hideHsn ? `<td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num">${tfEscapeHtml(this.itemHsn(item))}</td>` : ''}
            ${showCases ? `
              <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num whitespace-nowrap">
                <input type="number" value="${tfEscapeHtml(cs)}" min="1" onchange="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'cases', this.value)" class="w-12 p-0.5 text-center border border-amber-300 bg-amber-50/50 rounded font-bold text-xs">
                <span class="text-xs text-slate-400 block">×${tfEscapeHtml(cPack)}</span>
              </td>
            ` : ''}
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)}">
              <input type="number" value="${tfEscapeHtml(item.quantity)}" min="1" onchange="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'quantity', this.value)" class="w-14 p-0.5 text-right border border-amber-300 bg-amber-50/50 rounded font-mono-num font-bold text-xs">
            </td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)}">
              <input type="number" step="0.5" value="${tfEscapeHtml(item.unitRate)}" onchange="app.onStudioItemChange(${tfEscapeHtml(idx)}, 'unitRate', this.value)" class="w-14 p-0.5 text-right border border-amber-300 bg-amber-50/50 rounded font-mono-num font-bold text-xs">
            </td>
            <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num font-bold text-slate-900 whitespace-nowrap">${tfEscapeHtml(this.formatCurrency(item.totalAmount))}</td>
          </tr>
        `;
      }

      return `
        <tr class="border-b border-slate-200/80 hover:bg-slate-50/50">
          <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-500">${tfEscapeHtml(idx + 1)}</td>
          <td class="${tfEscapeHtml(rowPad)} text-left ${tfEscapeHtml(descFont)} leading-tight">
            <span class="font-bold text-slate-900">${tfEscapeHtml(item.name)}</span>
            ${varLabel ? `<span class="text-slate-500 font-medium text-xs ml-1.5 whitespace-nowrap">(${tfEscapeHtml(varLabel)})</span>` : ''}
          </td>
          ${!hideHsn ? `<td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num text-slate-600 whitespace-nowrap">${tfEscapeHtml(this.itemHsn(item))}</td>` : ''}
          ${showCases ? `
            <td class="${tfEscapeHtml(rowPad)} text-center ${tfEscapeHtml(numFont)} font-mono-num whitespace-nowrap">
              <span class="font-bold text-slate-900">${tfEscapeHtml(cs)} ${tfEscapeHtml(cs === 1 ? 'case' : 'cases')}</span>
              <span class="text-xs text-slate-400 ml-0.5">(${tfEscapeHtml(cPack)}/case)</span>
            </td>
          ` : ''}
          <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num font-semibold text-slate-900 whitespace-nowrap">${tfEscapeHtml(Number(item.quantity ?? item.units ?? 0).toLocaleString('en-IN'))}</td>
          <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num whitespace-nowrap">${tfEscapeHtml(this.formatCurrency(item.unitRate))}</td>
          <td class="${tfEscapeHtml(rowPad)} text-right ${tfEscapeHtml(numFont)} font-mono-num font-bold text-slate-900 whitespace-nowrap">${tfEscapeHtml(this.formatCurrency(item.totalAmount))}</td>
        </tr>
      `;
    }).join('');

    const hsnTableHtml = `
      <div class="mt-1.5">
        <table class="w-full border border-slate-200 text-xs">
          <thead class="bg-slate-100 text-slate-700 uppercase font-bold text-xs">
            <tr>
              <th class="py-1 px-2 text-left">HSN / SAC</th>
              <th class="py-1 px-2 text-right">Taxable Value</th>
              ${order.gstType === 'intra' ? `
                <th class="py-1 px-1 text-center">CGST</th>
                <th class="py-1 px-2 text-right">CGST Amt</th>
                <th class="py-1 px-1 text-center">SGST</th>
                <th class="py-1 px-2 text-right">SGST Amt</th>
              ` : `
                <th class="py-1 px-1 text-center">IGST</th>
                <th class="py-1 px-2 text-right">IGST Amt</th>
              `}
              <th class="py-1 px-2 text-right font-bold text-slate-900">Total Tax</th>
            </tr>
          </thead>
          <tbody>
            ${this.hsnSummaryRows((order.items || []).filter(i => !i.isOptional), order.gstType !== 'intra').map(row => `
            <tr class="border-t border-slate-200 font-mono-num">
              <td class="py-1 px-2 text-left font-bold text-slate-800">${tfEscapeHtml(row.hsn)}</td>
              <td class="py-1 px-2 text-right">${tfEscapeHtml(this.formatCurrency(row.taxable))}</td>
              ${order.gstType === 'intra' ? `
                <td class="py-1 px-1 text-center">${tfEscapeHtml(row.rate / 2)}%</td>
                <td class="py-1 px-2 text-right">${tfEscapeHtml(this.formatCurrency(row.cgst))}</td>
                <td class="py-1 px-1 text-center">${tfEscapeHtml(row.rate / 2)}%</td>
                <td class="py-1 px-2 text-right">${tfEscapeHtml(this.formatCurrency(row.sgst))}</td>
                <td class="py-1 px-2 text-right font-bold text-slate-900">${tfEscapeHtml(this.formatCurrency(row.cgst + row.sgst))}</td>
              ` : `
                <td class="py-1 px-1 text-center">${tfEscapeHtml(row.rate)}%</td>
                <td class="py-1 px-2 text-right">${tfEscapeHtml(this.formatCurrency(row.igst))}</td>
                <td class="py-1 px-2 text-right font-bold text-slate-900">${tfEscapeHtml(this.formatCurrency(row.igst))}</td>
              `}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = `
      <div class="studio-invoice-sheet bg-white p-4 sm:p-5 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800" style="max-width: 820px;">
        <!-- Header Banner -->
        <div class="flex justify-between items-start border-b-2 border-slate-900 pb-2">
          <div>
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center text-sm shadow-xs font-bold shrink-0"><i data-lucide="leaf" class="w-4 h-4 inline-block"></i></div>
              <div>
                <h1 class="text-xl font-black text-slate-900 tracking-tight leading-none">${tfEscapeHtml(profile.brandName)}</h1>
                <p class="text-xs text-slate-600 font-bold mt-0.5">${tfEscapeHtml(profile.legalName)}</p>
              </div>
            </div>
            <div class="text-xs text-slate-600 mt-1.5 leading-snug">
              <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)}, ${tfEscapeHtml(profile.state)} - ${tfEscapeHtml(profile.pincode)}</p>
              <p><strong>GSTIN:</strong> <span class="font-mono-num font-bold text-slate-900">${tfEscapeHtml(profile.gstin)}</span> (State: ${tfEscapeHtml(profile.stateCode)}) | <strong>FSSAI Lic:</strong> <span class="font-mono-num font-semibold text-slate-900">${tfEscapeHtml(profile.fssai)}</span></p>
              <p><strong>Contact:</strong> ${tfEscapeHtml(profile.phone)} • ${tfEscapeHtml(profile.email)}</p>
            </div>
          </div>

          <div class="text-right">
            <span class="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded shadow-xs">TAX INVOICE</span>
            <span class="block text-xs text-slate-500 font-medium mt-1">Original for Recipient • Sec 31 CGST / Rule 46</span>
            
            <div class="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-right">
              <span class="text-slate-500">Document No:</span>
              <strong class="font-mono-num text-slate-900">${tfEscapeHtml(order.invoiceNumber)}</strong>
              <span class="text-slate-500">Date:</span>
              <span class="font-mono-num font-semibold text-slate-800">${tfEscapeHtml(this.formatDate(order.date))}</span>
              <span class="text-slate-500">Payment Terms:</span>
              <span class="font-semibold text-slate-800">${tfEscapeHtml(order.paymentTerms || 'Standard Terms')}</span>
              <span class="text-slate-500">Due Date:</span>
              <span class="font-mono-num font-semibold text-slate-800">${tfEscapeHtml(this.formatDate(order.dueDate))}</span>
            </div>
          </div>
        </div>

        <!-- Parties Strip -->
        <div class="grid grid-cols-2 gap-2.5 py-2 border-b border-slate-200 text-xs">
          <div class="bg-slate-50/80 p-2 rounded-lg border border-slate-200/90">
            <span class="font-bold uppercase tracking-wider text-xs block text-slate-500 mb-0.5">Billed To (Receiver):</span>
            <p class="font-black text-slate-900 text-xs leading-snug">${tfEscapeHtml(retailer.name)}</p>
            <p class="text-slate-600 leading-snug mt-0.5 truncate">${tfEscapeHtml(retailer.billingAddress)}</p>
            <p class="mt-0.5"><strong>GSTIN:</strong> <span class="font-mono-num font-bold text-slate-900">${tfEscapeHtml(retailer.gstin)}</span> (State: ${tfEscapeHtml(retailer.state)} - ${tfEscapeHtml(retailer.stateCode)})</p>
            <p><strong>Phone / WA:</strong> <span class="font-mono-num font-semibold">${tfEscapeHtml(retailer.whatsappPhone || retailer.phone || order.customerPhone)}</span></p>
          </div>

          <div class="bg-slate-50/80 p-2 rounded-lg border border-slate-200/90">
            <span class="font-bold uppercase tracking-wider text-xs block text-slate-500 mb-0.5">Shipped To &amp; Dispatch:</span>
            <p class="font-black text-slate-900 text-xs leading-snug">${tfEscapeHtml(retailer.shippingAddress === retailer.billingAddress ? 'Same as Billed Address' : retailer.name)}</p>
            ${retailer.shippingAddress !== retailer.billingAddress ? `<p class="text-slate-600 leading-snug mt-0.5 truncate">${tfEscapeHtml(retailer.shippingAddress)}</p>` : ''}
            <div class="mt-0.5 space-y-0.5">
              <p><strong>Transport:</strong> ${tfEscapeHtml(order.transporterName || '')} ${order.lrNumber ? `(LR: <span class="font-mono-num font-semibold">${tfEscapeHtml(order.lrNumber)}</span>)` : ''}</p>
              ${order.vehicleNumber ? `<p><strong>Vehicle:</strong> <span class="font-mono-num">${tfEscapeHtml(order.vehicleNumber)}</span>` : ''}
              ${order.ewayBillNumber ? ` • <strong>E-Way:</strong> <span class="font-mono-num font-bold text-emerald-800">${tfEscapeHtml(order.ewayBillNumber)}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Quality Strip -->
        <div class="my-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs flex items-center justify-between text-slate-600">
          <div class="flex items-center gap-3">
            <span><strong>Batch:</strong> <span class="font-mono-num font-bold text-slate-800">${tfEscapeHtml(order.batchNumber || '')}</span></span>
            <span><strong>Mfg:</strong> <span class="font-mono-num">${tfEscapeHtml(order.mfgDate || this.formatDate(order.date))}</span></span>
            <span><strong>Best Before:</strong> ${tfEscapeHtml(order.bestBefore || '12 Months from Packing')}</span>
          </div>
          <span class="text-slate-500 font-medium">Standard Pack Quality Verified</span>
        </div>

        <!-- Line Items Table -->
        <div class="mt-1.5">
          <table class="w-full border border-slate-200 text-xs table-auto">
            <thead class="bg-slate-100 text-slate-800 uppercase font-bold text-xs border-b border-slate-300">
              <tr>
                <th class="py-1 px-1 text-center w-7">#</th>
                <th class="py-1 px-2 text-left">Description of Goods</th>
                ${!hideHsn ? `<th class="py-1 px-1 text-center w-16 whitespace-nowrap">HSN</th>` : ''}
                ${showCases ? `<th class="py-1 px-1 text-center w-18 whitespace-nowrap">Packing</th>` : ''}
                <th class="py-1 px-1 text-right w-16 whitespace-nowrap">Qty (Jars)</th>
                <th class="py-1 px-1 text-right w-18 whitespace-nowrap">Rate (₹)</th>
                <th class="py-1 px-2 text-right w-22 whitespace-nowrap">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          ${!hideHsn ? hsnTableHtml : ''}
        </div>

        <!-- Financial Breakdown -->
        <div class="grid grid-cols-12 gap-3 mt-2 pt-2 border-t border-slate-200">
          <div class="col-span-7 space-y-1.5">
            <div class="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs leading-relaxed">
              <span class="text-xs uppercase font-bold text-slate-400 block">Total Amount in Words:</span>
              <p class="font-bold text-slate-900 mt-0.5">${tfEscapeHtml(amountInWords)}</p>
            </div>

            <div class="grid grid-cols-2 gap-2 p-2 bg-amber-50/40 border border-amber-200/60 rounded text-xs">
              <div class="leading-relaxed space-y-0.5">
                <span class="font-bold text-amber-900 block text-xs">Bank Settlement:</span>
                <p>Bank: <strong>${tfEscapeHtml(profile.bankName)}</strong></p>
                <p>A/C: <strong class="font-mono-num">${tfEscapeHtml(profile.accountNumber)}</strong></p>
                <p>IFSC: <strong class="font-mono-num">${tfEscapeHtml(profile.ifsc)}</strong></p>
                <p>UPI ID: <strong class="font-mono-num text-amber-900 font-bold">${tfEscapeHtml(profile.upiId)}</strong></p>
              </div>

              ${showQr && upiQrUrl ? `
                <div class="flex flex-col items-center justify-center text-center pl-2 border-l border-amber-200/80">
                  <img src="${tfEscapeHtml(tfSafeUrl(upiQrUrl))}" alt="UPI QR Code" class="rounded border border-amber-300 shadow-2xs bg-white p-0.5" style="width: ${tfEscapeHtml(qrSize)}; height: ${tfEscapeHtml(qrSize)};">
                  <span class="text-xs font-bold text-amber-900 mt-0.5 block leading-none">Scan to Pay UPI</span>
                  <span class="text-[7.5px] text-slate-500 font-mono-num leading-none mt-0.5">GPay • PhonePe • Paytm</span>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="col-span-5 space-y-1 text-xs">
            <div class="flex justify-between py-0.5 text-slate-600">
              <span>Taxable Subtotal:</span>
              <span class="font-mono-num font-medium text-slate-800">${tfEscapeHtml(this.formatCurrency(order.taxableSubtotal))}</span>
            </div>
            ${order.gstType === 'intra' ? `
              <div class="flex justify-between py-0.5 text-slate-600">
                <span>${tfEscapeHtml(this.gstLabels(order, false).cgst)}:</span>
                <span class="font-mono-num">${tfEscapeHtml(this.formatCurrency(order.cgstAmount))}</span>
              </div>
              <div class="flex justify-between py-0.5 text-slate-600">
                <span>${tfEscapeHtml(this.gstLabels(order, false).sgst)}:</span>
                <span class="font-mono-num">${tfEscapeHtml(this.formatCurrency(order.sgstAmount))}</span>
              </div>
            ` : `
              <div class="flex justify-between py-0.5 text-slate-600">
                <span>${tfEscapeHtml(this.gstLabels(order, true).igst)}:</span>
                <span class="font-mono-num">${tfEscapeHtml(this.formatCurrency(order.igstAmount))}</span>
              </div>
            `}
            <div class="flex justify-between py-1 border-t-2 border-slate-900 font-bold text-xs">
              <span class="text-slate-900 font-black">Total Amount:</span>
              <span class="font-mono-num text-[12px] font-black text-slate-900">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
            </div>
            <div class="flex justify-between py-0.5 px-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 rounded border border-emerald-200">
              <span>Less Advance Paid:</span>
              <span class="font-mono-num font-bold">${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))}</span>
            </div>
            <div class="flex justify-between py-1 px-2 text-xs text-rose-700 font-black bg-rose-50 rounded border border-rose-200">
              <span>Balance Due:</span>
              <span class="font-mono-num text-[12px]">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-slate-200 text-xs">
          <div>
            <span class="font-bold text-slate-800 uppercase tracking-wider text-xs block mb-0.5">Terms &amp; Conditions:</span>
            <p class="text-slate-500 whitespace-pre-line text-xs leading-relaxed">${tfEscapeHtml(order.customNotes || this.defaultInvoiceNotes())}</p>
          </div>
          <div class="text-right flex flex-col justify-end items-end">
            <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
            ${digitalSealHtml}
            <p class="border-t border-slate-400 pt-0.5 text-xs text-slate-600 font-medium">Authorized Signatory</p>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  downloadStudioInvoicePDF(showToast = true) {
    const sheet = document.querySelector('#printable-studio-invoice-container .studio-invoice-sheet');
    const order = this.studioDraftData;
    if (!order || !sheet) return;

    const docType = this.studioActiveDocType || order.documentType || 'TAX INVOICE';
    const safeRetailer = (order.retailerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${docType.replace(/\s+/g, '_')}_${order.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${safeRetailer}.pdf`;

    const clone = sheet.cloneNode(true);
    clone.style.width = '780px';
    clone.style.maxWidth = '780px';
    clone.style.margin = '0 auto';
    clone.style.padding = '18px 22px';
    clone.style.boxShadow = 'none';
    clone.style.border = '1px solid #334155';
    clone.style.borderRadius = '0';
    clone.style.background = '#ffffff';

    const offscreen = document.createElement('div');
    offscreen.style.position = 'fixed';
    offscreen.style.left = '-9999px';
    offscreen.style.top = '0';
    offscreen.style.width = '780px';
    offscreen.style.background = '#ffffff';
    offscreen.appendChild(clone);
    document.body.appendChild(offscreen);

    if (window.html2pdf) {
      const opt = {
        margin: [6, 6, 6, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false, width: 780 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: 'avoid-all' }
      };

      html2pdf().set(opt).from(clone).save().then(() => {
        offscreen.remove();
        if (showToast) {
          this.showToast(`Downloaded ${filename} (Strict 1-Page A4) successfully!`);
        }
      }).catch(err => {
        offscreen.remove();
        console.error('PDF export error:', err);
      });
    } else {
      offscreen.remove();
      this.printStudioInvoice();
    }
  }

  printStudioInvoice() {
    const sheet = document.querySelector('#printable-studio-invoice-container .studio-invoice-sheet');
    if (!sheet) {
      window.print();
      return;
    }

    let printFrame = document.getElementById('studio-print-iframe');
    if (printFrame) printFrame.remove();

    printFrame = document.createElement('iframe');
    printFrame.id = 'studio-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';

    const studioHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${tfEscapeHtml(this.studioDraftData ? this.studioDraftData.invoiceNumber : 'Invoice')}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 4mm 5mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          }
          .studio-invoice-sheet {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 3mm 4mm !important;
            border: 1px solid #1e293b !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
            overflow: hidden !important;
          }
        </style>
      </head>
      <body class="bg-white">
        ${tfEscapeHtml(sheet.outerHTML)}
      </body>
      </html>
    `;

    printFrame.srcdoc = studioHtml;
    document.body.appendChild(printFrame);

    const triggerPrint = () => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (e) {
        console.warn('Iframe print failed, falling back to window.print()', e);
        window.print();
      }
    };

    printFrame.onload = () => {
      setTimeout(triggerPrint, 250);
    };
    // Fallback if onload already fired
    setTimeout(triggerPrint, 450);
  }

  sendStudioInvoiceWhatsApp() {
    const order = this.studioDraftData;
    if (!order) return;

    const phoneInput = document.getElementById('studio-whatsapp-phone');
    const rawPhone = phoneInput ? phoneInput.value.trim() : '';
    if (!rawPhone) {
      this.showToast('⚠️ Please enter a valid mobile / WhatsApp phone number.');
      return;
    }

    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    this.downloadStudioInvoicePDF(false);

    const profile = this.data.businessProfile || {};
    const docType = this.studioActiveDocType || order.documentType || 'TAX INVOICE';
    let msg = `*${docType} - ${profile.brandName}*\n`;
    msg += `═══════════════════════════\n`;
    msg += `Namaste *${order.retailerName}*,\n\n`;
    msg += `Please find attached your official ${docType}:\n`;
    msg += `📄 *Document No:* ${order.invoiceNumber}\n`;
    msg += `📅 *Date:* ${this.formatDate(order.date)}\n`;
    msg += `📦 *Total Value:* ${this.formatCurrency(order.totalInvoiceAmount)}\n`;
    if (docType === 'TAX INVOICE') {
      msg += `💰 *Advance Paid:* ${this.formatCurrency(order.customerAdvanceReceived)}\n`;
      msg += `🚨 *BALANCE DUE:* *${this.formatCurrency(order.customerBalanceDue)}*\n\n`;
    }
    msg += `*Bank Account for Settlement:*\n`;
    msg += `• Bank: ${profile.bankName}\n`;
    msg += `• A/C No: ${profile.accountNumber}\n`;
    msg += `• IFSC: ${profile.ifsc}\n`;
    msg += `• UPI ID: *${profile.upiId}*\n\n`;
    msg += `📎 *Attached:* Official ${docType} PDF with UPI QR code\n`;
    msg += `*${profile.legalName}*`;

    const encoded = encodeURIComponent(msg);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');
    this.showToast(`📄 PDF downloaded & WhatsApp chat opened for ${order.retailerName}!`);
  }

  saveStudioInvoiceToVault() {
    const order = this.studioDraftData;
    if (!order) return;

    this.downloadStudioInvoicePDF(false);
    this.showToast(`Invoice saved to documents vault for order ${order.invoiceNumber}!`);
  }

  /* =========================================================================
   * MAGIC ROOTS "PAGE OF MAGIC" INVOICE STUDIO SUITE
   * Commercial Pulse, Interactive P&L Drilldowns & Reusable Magic Messenger
   * ========================================================================= */

  calculateCompanyCommercialPulse() {
    const orders = (this.data.orders || []).filter(o => !o.isDeleted);
    const num = value => Number(value) || 0;
    const revenueOf = o => num(o.totalInvoiceAmount);                       // billed, GST included
    const taxableOf = o => num(o.taxableSubtotal ?? o.totalInvoiceAmount);   // before GST: the base for margins
    const profitOf = o => o.netProfit !== undefined && o.netProfit !== null ? num(o.netProfit) : taxableOf(o) - num(o.totalDirectCosts);
    const blank = () => ({ revenue: 0, taxable: 0, profit: 0, count: 0 });
    const add = (bucket, o) => { bucket.revenue += revenueOf(o); bucket.taxable += taxableOf(o); bucket.profit += profitOf(o); bucket.count++; return bucket; };

    // Calendar months, and the Indian financial year (April to March), taken from today's date.
    const today = new Date();
    const ym = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const latestMonthKey = ym(today);
    const lastMonthKey = ym(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    const fyStartYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    const fyStart = `${fyStartYear}-04-01`, fyEnd = `${fyStartYear + 1}-03-31`;

    const monthGroups = {};
    const lifetime = blank(), year = blank();
    orders.forEach(o => {
      add(lifetime, o);
      const date = String(o.date || '');
      if (/^\d{4}-\d{2}/.test(date)) {
        const key = date.slice(0, 7);
        monthGroups[key] = add(monthGroups[key] || { ...blank(), ym: key }, o);
      }
      if (date >= fyStart && date <= fyEnd) add(year, o);
    });
    const latestMonth = monthGroups[latestMonthKey] || blank();
    const lastMonth = monthGroups[lastMonthKey] || blank();

    const formatMonthLabel = key => {
      const [y, m] = key.split('-').map(Number);
      return `${new Date(y, m - 1, 1).toLocaleString('default', { month: 'short' })} ${y}`;
    };

    let totalCollected = 0;
    let totalDue = 0;
    orders.forEach(o => {
      const rev = revenueOf(o);
      const adv = num(o.customerAdvanceReceived);
      const due = o.customerBalanceDue !== undefined && o.customerBalanceDue !== null ? num(o.customerBalanceDue) : Math.max(0, rev - adv);
      if (o.status === 'settled') {
        totalCollected += rev;
      } else {
        totalCollected += adv;
        totalDue += due;
      }
    });

    return {
      lifetimeRevenue: lifetime.revenue,
      lifetimeProfit: lifetime.profit,
      lifetimeTaxable: lifetime.taxable,
      lifetimeCount: orders.length,
      monthRevenue: latestMonth.revenue,
      monthProfit: latestMonth.profit,
      monthTaxable: latestMonth.taxable,
      monthCount: latestMonth.count,
      monthLabel: formatMonthLabel(latestMonthKey),
      lastMonthRevenue: lastMonth.revenue,
      lastMonthProfit: lastMonth.profit,
      lastMonthTaxable: lastMonth.taxable,
      lastMonthCount: lastMonth.count,
      lastMonthLabel: formatMonthLabel(lastMonthKey),
      yearRevenue: year.revenue,
      yearProfit: year.profit,
      yearTaxable: year.taxable,
      yearLabel: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      totalCollected,
      totalDue,
      monthGroups
    };
  }

  renderStudioCommercialPulse() {
    const stats = this.calculateCompanyCommercialPulse();

    const elLifeVal = document.getElementById('studio-pulse-lifetime-val');
    const elLifeCount = document.getElementById('studio-pulse-lifetime-count');
    if (elLifeVal) elLifeVal.innerText = this.formatCurrency(stats.lifetimeRevenue);
    if (elLifeCount) elLifeCount.innerText = `${stats.lifetimeCount} orders`;

    const elMonthVal = document.getElementById('studio-pulse-month-val');
    const elMonthProfit = document.getElementById('studio-pulse-month-profit');
    const elMonthLabel = document.getElementById('studio-pulse-month-label');
    const elMonthSub = document.getElementById('studio-pulse-month-sub');
    if (elMonthVal) elMonthVal.innerText = this.formatCurrency(stats.monthRevenue);
    if (elMonthProfit) {
      const sign = stats.monthProfit >= 0 ? '+' : '';
      elMonthProfit.innerText = `${sign}${this.formatCurrency(stats.monthProfit)} net`;
      elMonthProfit.className = stats.monthProfit >= 0 ? 'text-xs font-bold text-emerald-400' : 'text-xs font-bold text-rose-400';
    }
    if (elMonthLabel) elMonthLabel.innerText = `${stats.monthLabel} P&L`;
    if (elMonthSub) {
      const margin = stats.monthTaxable > 0 ? ((stats.monthProfit / stats.monthTaxable) * 100).toFixed(1) : '0.0';
      elMonthSub.innerText = `${margin}% net margin · ${stats.monthCount} batches`;
    }

    const elYearVal = document.getElementById('studio-pulse-year-val');
    const elYearProfit = document.getElementById('studio-pulse-year-profit');
    const elYearLabel = document.getElementById('studio-pulse-year-label');
    const elYearSub = document.getElementById('studio-pulse-year-sub');
    if (elYearVal) elYearVal.innerText = this.formatCurrency(stats.yearRevenue);
    if (elYearProfit) {
      const sign = stats.yearProfit >= 0 ? '+' : '';
      elYearProfit.innerText = `${sign}${this.formatCurrency(stats.yearProfit)} profit`;
    }
    if (elYearLabel) elYearLabel.innerText = `${stats.yearLabel} P&L`;
    if (elYearSub) {
      const margin = stats.yearTaxable > 0 ? ((stats.yearProfit / stats.yearTaxable) * 100).toFixed(1) : '0.0';
      elYearSub.innerText = `FY turnover · ${margin}% profit`;
    }

    const elCollectedVal = document.getElementById('studio-pulse-collected-val');
    const elDueVal = document.getElementById('studio-pulse-due-val');
    const elAccountsSub = document.getElementById('studio-pulse-accounts-sub');
    if (elCollectedVal) elCollectedVal.innerText = this.formatCurrency(stats.totalCollected);
    if (elDueVal) elDueVal.innerText = `${this.formatCurrency(stats.totalDue)} due`;
    if (elAccountsSub) elAccountsSub.innerText = `Realized cash vs pending`;

    this.renderExecutiveHubFinancials(stats);
  }

  /* =========================================================================
   * MAGIC ROOTS EXECUTIVE HUB CONTROLLER & WORKSPACE TAB
   * ========================================================================= */
  openCompanyExecutiveHub() {
    this.closeCompanyExecutiveHubModal();
    const tabId = 'tab-executive-hub';
    let existingTab = this.openTabs.find(t => t.id === tabId);
    if (!existingTab) {
      existingTab = {
        id: tabId,
        type: 'executive-hub',
        title: `${this.config().brand} Hub`,
        icon: 'building-2',
        closeable: true
      };
      this.openTabs.push(existingTab);
    }
    this.activateWorkspaceTab(tabId);
  }

  closeCompanyExecutiveHub() {
    this.closeWorkspaceTab('tab-executive-hub');
  }

  openCompanyExecutiveHubModal() {
    this.openCompanyExecutiveHub();
  }

  closeCompanyExecutiveHubModal() {
    const modal = document.getElementById('company-executive-hub-modal');
    if (modal) modal.classList.add('hidden');
    this.toggleCompanyProfileEditMode(false);
  }

  renderCompanyExecutiveHubWorkspace() {
    const container = document.getElementById('executive-hub-workspace-content');
    if (!container) return;

    const p = this.data.businessProfile || {};
    const stats = this.calculateCompanyCommercialPulse();

    container.innerHTML = `
      <!-- Executive Workspace Hero Card -->
      <div class="relative rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-800 to-slate-900 text-white p-6 shadow-xl border border-emerald-500/40 overflow-hidden">
        <div class="absolute -right-8 -bottom-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute right-1/3 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-3xl shadow-lg shrink-0">
              <i data-lucide="leaf" class="w-5 h-5"></i>
            </div>
            <div>
              <div class="flex items-center gap-2.5 flex-wrap">
                <h2 id="hub-brand-header-title" class="text-xl sm:text-2xl font-black text-white tracking-tight">
                  ${tfEscapeHtml(p.brandName || this.config().brand)} • ${tfEscapeHtml(p.legalName || '')}
                </h2>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-400 text-emerald-950 shadow-xs">
                  Executive Hub
                </span>
                <span id="hub-profile-mode-badge" class="text-xs font-bold text-emerald-200 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                  ${tfEscapeHtml(this.isCompanyProfileEditing ? 'Edit Mode Active' : 'View Mode')}
                </span>
              </div>
              <p class="text-xs text-emerald-100/90 mt-1 font-medium">
                Master Company Identity, Statutory Registrations &amp; Live Commercial Analytics
              </p>
              <div class="flex items-center gap-2 mt-2 flex-wrap text-xs font-bold">
                <span class="px-2 py-0.5 rounded bg-white/10 text-emerald-200 border border-white/15">${tfEscapeHtml(p.cin ? `CIN/LLPIN: ${p.cin}` : 'CIN/LLPIN not set')}</span>
                ${p.gstin ? `<span class="px-2 py-0.5 rounded bg-white/10 text-emerald-100 border border-white/15">GSTIN ${tfEscapeHtml(p.gstin)}</span>` : '<span class="px-2 py-0.5 rounded bg-white/10 text-amber-100 border border-white/15">GSTIN not set</span>'}
                ${p.fssai ? `<span class="px-2 py-0.5 rounded bg-white/10 text-amber-100 border border-white/15">FSSAI ${tfEscapeHtml(p.fssai)}</span>` : ''}
              </div>
            </div>
          </div>

          <!-- Hero Action Buttons -->
          <div class="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button 
              id="hub-profile-toggle-edit-btn" 
              onclick="app.toggleCompanyProfileEditMode()" 
              class="btn-tactile px-4 py-2 text-xs font-black text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl flex items-center gap-2 shadow-md cursor-pointer transition-all hover:scale-105"
            >
              <i data-lucide="${tfEscapeHtml(this.isCompanyProfileEditing ? 'x-circle' : 'edit-3')}" class="w-4 h-4"></i>
              <span id="hub-profile-toggle-edit-text">${tfEscapeHtml(this.isCompanyProfileEditing ? 'Exit Edit Mode' : 'Live Edit Details')}</span>
            </button>
            <button 
              type="button" 
              onclick="app.copyCompanyHubProfileSummary()" 
              class="btn-tactile px-3.5 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              title="Copy formatted enterprise profile for WhatsApp/Email sharing"
            >
              <i data-lucide="clipboard-copy" class="w-4 h-4 text-emerald-300"></i>
              <span>Copy Summary</span>
            </button>
            <button 
              type="button" 
              onclick="app.revealDataFolder()" 
              class="btn-tactile px-3.5 py-2 text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              title="Reveal TradeFlow data directory in Windows Explorer"
            >
              <i data-lucide="folder" class="w-4 h-4 text-amber-300"></i>
              <span>Data Folder</span>
            </button>
            <button 
              type="button" 
              onclick="app.closeCompanyExecutiveHub()" 
              class="btn-tactile px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-900/60 hover:bg-rose-900/50 border border-slate-700 hover:border-rose-500/50 rounded-xl flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              title="Close Executive Hub workspace tab"
            >
              <i data-lucide="x" class="w-4 h-4"></i>
              <span>Close Tab</span>
            </button>
          </div>
        </div>
      </div>

      <!-- SECTION 1 & 2 & 3 & 4 & 5: Profile View Mode -->
      <div id="hub-profile-view-container" class="${tfEscapeHtml(this.isCompanyProfileEditing ? 'hidden' : '')} space-y-6">

        <!-- 1. STATUTORY & TAX IDENTIFICATION -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">1</span>
              <span>Statutory Registrations &amp; Tax Credentials</span>
            </h3>
            <span class="text-xs font-bold text-slate-400">Government of India &amp; State Authorities</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <!-- GSTIN Card -->
            <div class="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/50 to-slate-50 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-500/30 flex items-start justify-between shadow-2xs group hover:border-emerald-500/60 transition-all">
              <div class="min-w-0 pr-2">
                <span class="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-1">GSTIN Number</span>
                <span id="hub-view-gstin" class="font-mono-num font-black text-base text-slate-900 dark:text-white block select-all tracking-wide">—</span>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">State: <strong>${tfEscapeHtml([p.stateCode, p.state].filter(Boolean).join(' ') || 'Not set')}</strong></p>
              </div>
              <button type="button" onclick="app.copyStudioValue('hub-view-gstin', 'GSTIN')" class="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors shrink-0" title="Copy GSTIN">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- PAN Card -->
            <div class="p-3.5 rounded-xl bg-gradient-to-br from-blue-50/50 to-slate-50 dark:from-blue-950/20 dark:to-slate-900 border border-blue-500/30 flex items-start justify-between shadow-2xs group hover:border-blue-500/60 transition-all">
              <div class="min-w-0 pr-2">
                <span class="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 block mb-1">Income Tax PAN</span>
                <span id="hub-view-pan" class="font-mono-num font-black text-base text-slate-900 dark:text-white block select-all tracking-wide">—</span>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Entity: <strong>${tfEscapeHtml(({ P: 'Individual / Proprietor', C: 'Company', H: 'HUF', F: 'Firm / LLP', A: 'Association of Persons', T: 'Trust', B: 'Body of Individuals', L: 'Local Authority', J: 'Artificial Juridical Person', G: 'Government' })[String(p.pan || '')[3]] || 'Not set')}</strong></p>
              </div>
              <button type="button" onclick="app.copyStudioValue('hub-view-pan', 'PAN')" class="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 transition-colors shrink-0" title="Copy PAN">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- FSSAI License -->
            <div class="p-3.5 rounded-xl bg-gradient-to-br from-amber-50/50 to-slate-50 dark:from-amber-950/20 dark:to-slate-900 border border-amber-500/30 flex items-start justify-between shadow-2xs group hover:border-emerald-600/60 transition-all">
              <div class="min-w-0 pr-2">
                <span class="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block mb-1">FSSAI Central License #</span>
                <span id="hub-view-fssai" class="font-mono-num font-black text-base text-slate-900 dark:text-white block select-all tracking-wide">—</span>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Food Safety &amp; Standards Authority</p>
              </div>
              <button type="button" onclick="app.copyStudioValue('hub-view-fssai', 'FSSAI')" class="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors shrink-0" title="Copy FSSAI">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- MSME / Udyam -->
            <div class="p-3.5 rounded-xl bg-gradient-to-br from-purple-50/50 to-slate-50 dark:from-purple-950/20 dark:to-slate-900 border border-purple-500/30 flex items-start justify-between shadow-2xs group hover:border-purple-500/60 transition-all">
              <div class="min-w-0 pr-2">
                <span class="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-300 block mb-1">MSME / Udyam Registration</span>
                <span class="font-mono-num font-black text-base text-slate-900 dark:text-white block select-all tracking-wide">${tfEscapeHtml(p.udyam || 'Not set')}</span>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Udyam Registration Portal (MSME)</p>
              </div>
              <button type="button" onclick="app.copyToClipboard('${tfEscapeHtml(tfEscapeJs(p.udyam || ''))}', 'MSME Udyam number')" class="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 transition-colors shrink-0" title="Copy MSME">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- IEC Code -->
            <div class="p-3.5 rounded-xl bg-gradient-to-br from-blue-50/50 to-slate-50 dark:from-blue-950/20 dark:to-slate-900 border border-blue-500/30 flex items-start justify-between shadow-2xs group hover:border-blue-500/60 transition-all">
              <div class="min-w-0 pr-2">
                <span class="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 block mb-1">Import Export Code (IEC)</span>
                <span class="font-mono-num font-black text-base text-slate-900 dark:text-white block select-all tracking-wide">${tfEscapeHtml(p.iec || 'Not set')}</span>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">DGFT Ministry of Commerce &amp; Industry</p>
              </div>
              <button type="button" onclick="app.copyToClipboard('${tfEscapeHtml(tfEscapeJs(p.iec || ''))}', 'IEC')" class="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 transition-colors shrink-0" title="Copy IEC">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>

            <!-- Legal Form -->
            <div class="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/50 to-slate-50 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-500/30 flex items-start justify-between shadow-2xs group hover:border-emerald-500/60 transition-all">
              <div class="min-w-0 pr-2">
                <span class="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-1">Legal Constitution &amp; Form</span>
                <span id="hub-view-legalName" class="font-black text-sm text-slate-900 dark:text-white block truncate">—</span>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Trade Brand: <strong id="hub-view-brandName" class="text-emerald-600">${tfEscapeHtml(this.config().brand)}</strong></p>
              </div>
              <button type="button" onclick="app.copyStudioValue('hub-view-legalName', 'Legal Name')" class="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors shrink-0" title="Copy Legal Name">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. BANKING COORDINATES & SETTLEMENTS -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">2</span>
              <span>Corporate Banking Coordinates &amp; Instant Digital Settlements</span>
            </h3>
            <span class="text-xs font-bold text-slate-400">RTGS / NEFT / IMPS &amp; Dynamic UPI VPA</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <!-- Primary HDFC Bank -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-emerald-50/60 to-slate-50 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-500/30 space-y-2.5 shadow-2xs group hover:border-emerald-500/60 transition-all">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <i data-lucide="credit-card" class="w-3.5 h-3.5 text-emerald-600"></i>
                  <span>Primary Bank${p.bankName ? ` (${tfEscapeHtml(p.bankName)})` : ''}</span>
                </span>
                <span class="text-xs font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">Active Current A/C</span>
              </div>
              <div>
                <span class="text-xs text-slate-500 dark:text-slate-400 block">Bank &amp; Account Number:</span>
                <div class="flex items-center justify-between mt-0.5">
                  <div>
                    <span id="hub-view-bankName" class="font-extrabold text-xs text-slate-900 dark:text-white block">—</span>
                    <span id="hub-view-accountNumber" class="font-mono-num font-black text-base text-emerald-600 dark:text-emerald-400 block tracking-wide">—</span>
                  </div>
                  <button type="button" onclick="app.copyStudioValue('hub-view-accountNumber', 'Account Number')" class="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors" title="Copy Account #">
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
              <div class="pt-2 border-t border-emerald-200/50 dark:border-emerald-900/50 flex items-center justify-between text-xs">
                <div>
                  <span class="text-xs text-slate-400 block">IFSC Code:</span>
                  <span id="hub-view-ifsc" class="font-mono-num font-bold text-slate-900 dark:text-white">—</span>
                </div>
                <div class="text-right">
                  <span class="text-xs text-slate-400 block">Branch:</span>
                  <span id="hub-view-branch" class="text-slate-700 dark:text-slate-300 font-medium">—</span>
                </div>
              </div>
            </div>

            <!-- Secondary ICICI Bank -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-purple-50/60 to-slate-50 dark:from-purple-950/20 dark:to-slate-900 border border-purple-500/30 space-y-2.5 shadow-2xs group hover:border-purple-500/60 transition-all">
              <div class="flex items-center justify-between">
                <span class="text-xs font-black uppercase tracking-wider text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                  <i data-lucide="landmark" class="w-3.5 h-3.5 text-purple-600"></i>
                  <span>Secondary Bank${p.secondaryBankName ? ` (${tfEscapeHtml(p.secondaryBankName)})` : ''}</span>
                </span>
                <span class="text-xs font-extrabold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-300">Escrow Reserve</span>
              </div>
              <div>
                <span class="text-xs text-slate-500 dark:text-slate-400 block">Bank &amp; Account Number:</span>
                <div class="flex items-center justify-between mt-0.5">
                  <div>
                    <span class="font-extrabold text-xs text-slate-900 dark:text-white block">${tfEscapeHtml(p.secondaryBankName || 'Not set')}</span>
                    <span class="font-mono-num font-black text-base text-purple-600 dark:text-purple-400 block tracking-wide">${tfEscapeHtml(p.secondaryAccountNumber || 'Not set')}</span>
                  </div>
                  <button type="button" onclick="app.copyToClipboard('${tfEscapeHtml(tfEscapeJs(p.secondaryAccountNumber || ''))}', 'Secondary account number')" class="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 transition-colors" title="Copy secondary account number">
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
              <div class="pt-2 border-t border-purple-200/50 dark:border-purple-900/50 flex items-center justify-between text-xs">
                <div>
                  <span class="text-xs text-slate-400 block">IFSC Code:</span>
                  <span class="font-mono-num font-bold text-slate-900 dark:text-white">${tfEscapeHtml(p.secondaryIfsc || 'Not set')}</span>
                </div>
                <div class="text-right">
                  <span class="text-xs text-slate-400 block">Branch:</span>
                  <span class="text-slate-700 dark:text-slate-300 font-medium">${tfEscapeHtml(p.secondaryBranch || 'Not set')}</span>
                </div>
              </div>
            </div>

            <!-- Dynamic UPI Merchant VPA -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-emerald-50/60 to-slate-50 dark:from-emerald-950/20 dark:to-slate-900 border border-emerald-500/30 space-y-2.5 shadow-2xs group hover:border-emerald-500/60 transition-all flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <i data-lucide="qr-code" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>Official UPI Merchant VPA</span>
                  </span>
                  <span class="text-xs font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">Instant UPI QR</span>
                </div>
                <div class="mt-2">
                  <span class="text-xs text-slate-500 dark:text-slate-400 block">Merchant VPA Address:</span>
                  <div class="flex items-center justify-between mt-0.5">
                    <span id="hub-view-upiId" class="font-mono-num font-black text-sm text-emerald-600 dark:text-emerald-400 block select-all tracking-wide">—</span>
                    <button type="button" onclick="app.copyStudioValue('hub-view-upiId', 'UPI VPA')" class="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors" title="Copy UPI VPA">
                      <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-emerald-200/50 dark:border-emerald-900/50">
                Directly connected to dynamic QR generation on Tax Invoices &amp; Receipts.
              </p>
            </div>
          </div>
        </div>

        <!-- 3. HEADQUARTERS, FACILITIES & COMMUNICATIONS -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">3</span>
              <span>Facilities, Headquarters &amp; Operational Logistics</span>
            </h3>
            <span class="text-xs font-bold text-slate-400">Warehouse Dispatches &amp; Helpline Contacts</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <!-- Facility Address -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-amber-50/50 to-slate-50 dark:from-amber-950/20 dark:to-slate-900 border border-amber-500/30 space-y-2 shadow-2xs group hover:border-emerald-600/60 transition-all flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-amber-600"></i>
                    <span>Head Office &amp; Facility</span>
                  </span>
                  <button type="button" onclick="app.copyStudioValue('hub-view-address', 'Address')" class="p-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20" title="Copy Address">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                  </button>
                </div>
                <p id="hub-view-address" class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed mt-2">
                  ${tfEscapeHtml([p.address, p.city, p.state].filter(Boolean).join(', ') + (p.pincode ? ' - ' + p.pincode : '') || 'Not set')}
                </p>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-amber-200/50 dark:border-amber-900/50">
                Primary Manufacturing, Batch Curing &amp; Dispatch Warehouse
              </p>
            </div>

            <!-- Invoicing Email & Contact -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-slate-50 dark:from-blue-950/20 dark:to-slate-900 border border-blue-500/30 space-y-2.5 shadow-2xs group hover:border-blue-500/60 transition-all">
              <span class="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <i data-lucide="mail" class="w-3.5 h-3.5 text-blue-600"></i>
                <span>Executive Helpline &amp; Billing</span>
              </span>
              <div>
                <span class="text-xs text-slate-400 block">Commercial Billing Email:</span>
                <div class="flex items-center justify-between mt-0.5">
                  <span id="hub-view-email" class="font-bold text-xs text-slate-900 dark:text-white select-all">—</span>
                  <button type="button" onclick="app.copyStudioValue('hub-view-email', 'Email')" class="p-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20" title="Copy Email">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                  </button>
                </div>
              </div>
              <div class="pt-2 border-t border-blue-200/50 dark:border-blue-900/50">
                <span class="text-xs text-slate-400 block">Executive Contact Phone:</span>
                <div class="flex items-center justify-between mt-0.5">
                  <span id="hub-view-phone" class="font-mono-num font-black text-sm text-slate-900 dark:text-white select-all">—</span>
                  <button type="button" onclick="app.copyStudioValue('hub-view-phone', 'Phone')" class="p-1 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20" title="Copy Phone">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                  </button>
                </div>
              </div>
            </div>

            <!-- Factory Dispatch Desk -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-slate-50 dark:from-blue-950/20 dark:to-slate-900 border border-blue-500/30 space-y-2.5 shadow-2xs group hover:border-blue-500/60 transition-all">
              <span class="text-xs font-black uppercase tracking-wider text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                <i data-lucide="truck" class="w-3.5 h-3.5 text-blue-600"></i>
                <span>Factory Dispatch &amp; Operating Timings</span>
              </span>
              <div>
                <span class="text-xs text-slate-400 block">Factory Bilty &amp; Logistics Desk:</span>
                <span class="font-bold text-xs text-slate-900 dark:text-white block mt-0.5">${tfEscapeHtml([this.data.businessProfile?.email, this.data.businessProfile?.phone].filter(Boolean).join(' • ') || 'Not set')}</span>
              </div>
              <div class="pt-2 border-t border-blue-200/50 dark:border-blue-900/50">
                <span class="text-xs text-slate-400 block">Dispatch Operating Shifts:</span>
                <span class="font-bold text-xs text-slate-800 dark:text-slate-200 block mt-0.5">Mon - Sat: 9:00 AM - 7:30 PM IST (Warehouse: 10:00 AM - 6:00 PM)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. FINANCIAL PERFORMANCE & COMMERCIAL TURNOVERS -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">4</span>
              <span>Financial Performance &amp; Real-Time Commercial Turnovers</span>
            </h3>
            <span class="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Live Real-Time Financials</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <!-- Card 1: Current Month -->
            <div onclick="app.openStudioMetricsDrilldownModal('monthly')" class="p-4 rounded-xl bg-gradient-to-br from-emerald-50/70 to-slate-50 dark:from-emerald-950/30 dark:to-slate-900 border border-emerald-500/40 hover:border-emerald-500 shadow-2xs hover:shadow-md transition-all cursor-pointer group">
              <div class="flex items-center justify-between mb-1.5">
                <span id="hub-stat-cur-month-label" class="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                  <span>${tfEscapeHtml(stats.monthLabel)}</span>
                </span>
                <span class="text-xs font-bold text-emerald-600 group-hover:underline flex items-center gap-0.5">Inspect <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
              </div>
              <span id="hub-stat-cur-month-rev" class="font-mono-num font-black text-2xl text-slate-900 dark:text-white block tracking-tight my-1">
                ${tfEscapeHtml(this.formatCurrency(stats.monthRevenue))}
              </span>
              <div class="flex items-center justify-between text-xs mt-1">
                <span id="hub-stat-cur-month-profit" class="font-bold ${tfEscapeHtml(stats.monthProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600')}">
                  ${tfEscapeHtml(stats.monthProfit >= 0 ? '+' : '')}${tfEscapeHtml(this.formatCurrency(stats.monthProfit))} net
                </span>
              </div>
              <p id="hub-stat-cur-month-sub" class="text-xs text-slate-500 dark:text-slate-400 mt-1 pt-1.5 border-t border-emerald-200/50 dark:border-emerald-900/50">
                ${tfEscapeHtml(stats.monthTaxable > 0 ? ((stats.monthProfit / stats.monthTaxable) * 100).toFixed(1) : '0.0')}% net margin · ${tfEscapeHtml(stats.monthCount)} batches
              </p>
            </div>

            <!-- Card 2: Last Month -->
            <div onclick="app.openStudioMetricsDrilldownModal('monthly')" class="p-4 rounded-xl bg-gradient-to-br from-blue-50/70 to-slate-50 dark:from-blue-950/30 dark:to-slate-900 border border-blue-500/40 hover:border-blue-500 shadow-2xs hover:shadow-md transition-all cursor-pointer group">
              <div class="flex items-center justify-between mb-1.5">
                <span id="hub-stat-last-month-label" class="text-xs font-extrabold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                  <i data-lucide="history" class="w-3.5 h-3.5"></i>
                  <span>${tfEscapeHtml(stats.lastMonthLabel || 'Last Month')}</span>
                </span>
                <span class="text-xs font-bold text-blue-600 group-hover:underline flex items-center gap-0.5">Inspect <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
              </div>
              <span id="hub-stat-last-month-rev" class="font-mono-num font-black text-2xl text-slate-900 dark:text-white block tracking-tight my-1">
                ${tfEscapeHtml(this.formatCurrency(stats.lastMonthRevenue || 0))}
              </span>
              <div class="flex items-center justify-between text-xs mt-1">
                <span id="hub-stat-last-month-profit" class="font-bold ${tfEscapeHtml((stats.lastMonthProfit || 0) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600')}">
                  ${tfEscapeHtml((stats.lastMonthProfit || 0) >= 0 ? '+' : '')}${tfEscapeHtml(this.formatCurrency(stats.lastMonthProfit || 0))} net
                </span>
              </div>
              <p id="hub-stat-last-month-sub" class="text-xs text-slate-500 dark:text-slate-400 mt-1 pt-1.5 border-t border-blue-200/50 dark:border-blue-900/50">
                ${tfEscapeHtml((stats.lastMonthTaxable || 0) > 0 ? (((stats.lastMonthProfit || 0) / stats.lastMonthTaxable) * 100).toFixed(1) : '0.0')}% net margin · ${tfEscapeHtml(stats.lastMonthCount || 0)} batches
              </p>
            </div>

            <!-- Card 3: Financial Year -->
            <div onclick="app.openStudioMetricsDrilldownModal('yearly')" class="p-4 rounded-xl bg-gradient-to-br from-blue-50/70 to-slate-50 dark:from-blue-950/30 dark:to-slate-900 border border-blue-500/40 hover:border-blue-500 shadow-2xs hover:shadow-md transition-all cursor-pointer group">
              <div class="flex items-center justify-between mb-1.5">
                <span id="hub-stat-fy-label" class="text-xs font-extrabold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                  <i data-lucide="trending-up" class="w-3.5 h-3.5"></i>
                  <span>${tfEscapeHtml(stats.yearLabel)}</span>
                </span>
                <span class="text-xs font-bold text-blue-600 group-hover:underline flex items-center gap-0.5">Inspect <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
              </div>
              <span id="hub-stat-fy-rev" class="font-mono-num font-black text-2xl text-slate-900 dark:text-white block tracking-tight my-1">
                ${tfEscapeHtml(this.formatCurrency(stats.yearRevenue))}
              </span>
              <div class="flex items-center justify-between text-xs mt-1">
                <span id="hub-stat-fy-profit" class="font-bold ${tfEscapeHtml(stats.yearProfit >= 0 ? 'text-purple-600 dark:text-purple-400' : 'text-rose-600')}">
                  ${tfEscapeHtml(stats.yearProfit >= 0 ? '+' : '')}${tfEscapeHtml(this.formatCurrency(stats.yearProfit))} profit
                </span>
              </div>
              <p id="hub-stat-fy-sub" class="text-xs text-slate-500 dark:text-slate-400 mt-1 pt-1.5 border-t border-blue-200/50 dark:border-blue-900/50">
                FY turnover · ${tfEscapeHtml(stats.yearTaxable > 0 ? ((stats.yearProfit / stats.yearTaxable) * 100).toFixed(1) : '0.0')}% profit margin
              </p>
            </div>

            <!-- Card 4: Lifetime Turnover -->
            <div onclick="app.openStudioMetricsDrilldownModal('receivables')" class="p-4 rounded-xl bg-gradient-to-br from-emerald-50/70 to-slate-50 dark:from-emerald-950/30 dark:to-slate-900 border border-emerald-500/40 hover:border-emerald-500 shadow-2xs hover:shadow-md transition-all cursor-pointer group">
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-xs font-extrabold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <i data-lucide="award" class="w-3.5 h-3.5"></i>
                  <span>LIFETIME TURNOVER</span>
                </span>
                <span class="text-xs font-bold text-emerald-600 group-hover:underline flex items-center gap-0.5">Inspect <i data-lucide="chevron-right" class="w-3 h-3"></i></span>
              </div>
              <span id="hub-stat-lifetime-rev" class="font-mono-num font-black text-2xl text-slate-900 dark:text-white block tracking-tight my-1">
                ${tfEscapeHtml(this.formatCurrency(stats.lifetimeRevenue))}
              </span>
              <div class="flex items-center justify-between text-xs mt-1">
                <span id="hub-stat-lifetime-count" class="font-bold text-slate-700 dark:text-slate-300">${tfEscapeHtml(stats.lifetimeOrdersCount)} orders</span>
              </div>
              <p id="hub-stat-lifetime-sub" class="text-xs text-slate-500 dark:text-slate-400 mt-1 pt-1.5 border-t border-emerald-200/50 dark:border-emerald-900/50">
                Collected ${tfEscapeHtml(this.formatCurrency(stats.totalCollected))} · Due ${tfEscapeHtml(this.formatCurrency(stats.totalBalanceDue))}
              </p>
            </div>
          </div>
        </div>

        <!-- 5. QUALITY GOVERNANCE & STATUTORY TRADE TERMS -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">5</span>
              <span>Commercial Governance Directives &amp; Statutory Trade Terms</span>
            </h3>
            <span class="text-xs font-bold text-slate-400">Applied automatically across invoices &amp; challans</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span class="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">Standard Payment Terms</span>
              <p id="hub-terms-text" class="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                Payment within 15 days of invoice date via RTGS/NEFT/UPI. Interest @ 18% p.a. chargeable on delayed settlements.
              </p>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span class="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">Legal Jurisdiction</span>
              <p id="hub-jurisdiction-text" class="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                ${tfEscapeHtml(this.jurisdictionLine() || 'Jurisdiction city not set (Settings > Business Profile > Business Defaults).')}
              </p>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span class="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">Quality Mandate</span>
              <p class="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                ${tfEscapeHtml(this.data.businessProfile?.qualityStatement || 'Not set')}
              </p>
            </div>

            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span class="text-xs font-black uppercase tracking-wider text-slate-500 block mb-1">Registered Trademarks</span>
              <p class="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                ${tfEscapeHtml(this.data.businessProfile?.trademarks || 'Not set')}
              </p>
            </div>
          </div>
        </div>

      </div>

      <!-- EDIT MODE CONTAINER (Hidden by default, shown when Live Edit Details clicked) -->
      <div id="hub-profile-edit-container" class="${tfEscapeHtml(this.isCompanyProfileEditing ? '' : 'hidden')} bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-md space-y-6">
        <div class="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <i data-lucide="edit-3" class="w-4 h-4 text-emerald-600"></i>
              <span>Live Edit Company Master Profile</span>
            </h3>
            <p class="text-xs text-slate-500">Changes will be saved to authoritative store and reflected across invoices &amp; sidebar.</p>
          </div>
          <span class="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            Interactive Editor
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Legal Company Name *</label>
            <input id="hub-input-legalName" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Trade Brand Name *</label>
            <input id="hub-input-brandName" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">GSTIN Number *</label>
            <input id="hub-input-gstin" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Income Tax PAN</label>
            <input id="hub-input-pan" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">FSSAI License #</label>
            <input id="hub-input-fssai" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">State Code</label>
            <input id="hub-input-stateCode" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div class="lg:col-span-2">
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Head Office Address</label>
            <input id="hub-input-address" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">City</label>
            <input id="hub-input-city" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">State</label>
            <input id="hub-input-state" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Pincode</label>
            <input id="hub-input-pincode" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Commercial Billing Email</label>
            <input id="hub-input-email" type="email" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Executive Phone</label>
            <input id="hub-input-phone" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Primary Bank Name</label>
            <input id="hub-input-bankName" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs text-slate-900 dark:text-white font-bold outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Account Number</label>
            <input id="hub-input-accountNumber" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">IFSC Code</label>
            <input id="hub-input-ifsc" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>

          <div>
            <label class="block text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300 mb-1">Official UPI ID</label>
            <input id="hub-input-upiId" type="text" class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500">
          </div>
        </div>

        <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button 
            type="button" 
            onclick="app.toggleCompanyProfileEditMode(false)" 
            class="btn-tactile px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button" 
            onclick="app.saveCompanyExecutiveHubProfile()" 
            class="btn-tactile px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <i data-lucide="save" class="w-4 h-4"></i>
            <span>Save Company Changes</span>
          </button>
        </div>
      </div>
    `;

    this.renderCompanyExecutiveHubProfile();
    this.renderExecutiveHubFinancials(stats);
    if (window.lucide) window.lucide.createIcons();
  }

  renderCompanyExecutiveHubProfile() {
    const p = this.data.businessProfile || {};
    
    // Header title
    const headerTitle = document.getElementById('hub-brand-header-title');
    if (headerTitle) {
      headerTitle.textContent = p.legalName ? `${p.brandName || this.config().brand} • ${p.legalName}` : (p.brandName || this.config().brand);
    }

    // View Fields
    const setView = (id, val, fallback = '—') => {
      const el = document.getElementById(id);
      if (el) el.textContent = val || fallback;
    };

    setView('hub-view-legalName', p.legalName, 'Not set');
    setView('hub-view-brandName', p.brandName, 'Not set');
    setView('hub-view-gstin', p.gstin, 'Not set');
    setView('hub-view-pan', p.pan, 'Not set');
    setView('hub-view-fssai', p.fssai, 'Not set');
    setView('hub-view-address', p.address ? `${p.address}, ${p.city || ''} - ${p.pincode || ''}` : 'Not set');
    setView('hub-view-email', p.email, 'Not set');
    setView('hub-view-phone', p.phone, 'Not set');
    setView('hub-view-bankName', p.bankName, 'Not set');
    setView('hub-view-accountNumber', p.accountNumber, 'Not set');
    setView('hub-view-ifsc', p.ifsc, 'Not set');
    setView('hub-view-branch', p.branch, 'Not set');
    setView('hub-view-upiId', p.upiId, 'Not set');

    // Terms & Directives
    if (p.paymentTerms) {
      const t = document.getElementById('hub-terms-text');
      if (t) t.textContent = p.paymentTerms;
    }
    const j = document.getElementById('hub-jurisdiction-text');
    if (j) j.textContent = this.jurisdictionLine() || 'Jurisdiction city not set';
    const notes = document.getElementById('hub-notes-text');
    if (notes) notes.textContent = p.qualityStatement || p.invoiceNotes || 'Not set';
    this.applyBrandText();
  }

  // Fills every element marked data-tf-brand / data-tf-state from the business profile.
  applyBrandText() {
    const cfg = this.config();
    document.querySelectorAll('[data-tf-brand]').forEach(el => { el.textContent = cfg.brand; });
    document.querySelectorAll('[data-tf-state]').forEach(el => { el.textContent = cfg.stateCode ? `${cfg.stateCode}${cfg.state ? ` (${cfg.state})` : ''}` : '—'; });
  }

  toggleCompanyProfileEditMode(forceState) {
    const isEditing = forceState !== undefined ? forceState : !this.isCompanyProfileEditing;
    this.isCompanyProfileEditing = isEditing;

    const viewContainer = document.getElementById('hub-profile-view-container');
    const editContainer = document.getElementById('hub-profile-edit-container');
    const toggleBtnText = document.getElementById('hub-profile-toggle-edit-text');
    const modeBadge = document.getElementById('hub-profile-mode-badge');

    if (isEditing) {
      const p = this.data.businessProfile || {};
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
      };

      setVal('hub-input-legalName', p.legalName || '');
      setVal('hub-input-brandName', p.brandName || '');
      setVal('hub-input-gstin', p.gstin || '');
      setVal('hub-input-pan', p.pan || '');
      setVal('hub-input-fssai', p.fssai || '');
      setVal('hub-input-stateCode', p.stateCode || '');
      setVal('hub-input-address', p.address || '');
      setVal('hub-input-city', p.city || '');
      setVal('hub-input-state', p.state || '');
      setVal('hub-input-pincode', p.pincode || '');
      setVal('hub-input-email', p.email || '');
      setVal('hub-input-phone', p.phone || '');
      setVal('hub-input-bankName', p.bankName || '');
      setVal('hub-input-accountNumber', p.accountNumber || '');
      setVal('hub-input-ifsc', p.ifsc || '');
      setVal('hub-input-upiId', p.upiId || '');

      if (viewContainer) viewContainer.classList.add('hidden');
      if (editContainer) editContainer.classList.remove('hidden');
      if (toggleBtnText) toggleBtnText.textContent = 'Exit Edit Mode';
      if (modeBadge) {
        modeBadge.textContent = 'Edit Mode Active';
        modeBadge.className = 'text-xs font-bold text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30';
      }
    } else {
      if (viewContainer) viewContainer.classList.remove('hidden');
      if (editContainer) editContainer.classList.add('hidden');
      if (toggleBtnText) toggleBtnText.textContent = 'Live Edit Details';
      if (modeBadge) {
        modeBadge.textContent = 'View Mode';
        modeBadge.className = 'text-xs font-bold text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750';
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  saveCompanyExecutiveHubProfile() {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const legalName = getVal('hub-input-legalName');
    const brandName = getVal('hub-input-brandName');
    const gstin = getVal('hub-input-gstin');

    if (!legalName || !brandName || !gstin) {
      this.showToast('Please enter Legal Name, Brand Name, and GSTIN.');
      return;
    }

    if (!this.data.businessProfile) this.data.businessProfile = {};
    const p = this.data.businessProfile;

    p.legalName = legalName;
    p.brandName = brandName;
    p.gstin = gstin;
    p.pan = getVal('hub-input-pan') || p.pan;
    p.fssai = getVal('hub-input-fssai') || p.fssai;
    p.stateCode = getVal('hub-input-stateCode') || p.stateCode || '';
    p.address = getVal('hub-input-address') || p.address;
    p.city = getVal('hub-input-city') || p.city;
    p.state = getVal('hub-input-state') || p.state;
    p.pincode = getVal('hub-input-pincode') || p.pincode;
    p.email = getVal('hub-input-email') || p.email;
    p.phone = getVal('hub-input-phone') || p.phone;
    p.bankName = getVal('hub-input-bankName') || p.bankName;
    p.accountNumber = getVal('hub-input-accountNumber') || p.accountNumber;
    p.ifsc = getVal('hub-input-ifsc') || p.ifsc;
    p.upiId = getVal('hub-input-upiId') || p.upiId;

    // Update sidebar brand name if changed
    const sidebarBrand = document.getElementById('sidebar-brand-name');
    if (sidebarBrand) sidebarBrand.textContent = this.config().brand;

    // Save authoritative data
    this.saveData();
    this.renderCompanyExecutiveHubProfile();
    this.toggleCompanyProfileEditMode(false);
    this.showToast(`${this.config().brand} company profile saved.`);
  }

  renderExecutiveHubFinancials(providedStats) {
    const stats = providedStats || this.calculateCompanyCommercialPulse();

    // 1. Current Month
    const elCurLabel = document.getElementById('hub-stat-cur-month-label');
    const elCurRev = document.getElementById('hub-stat-cur-month-rev');
    const elCurProfit = document.getElementById('hub-stat-cur-month-profit');
    const elCurSub = document.getElementById('hub-stat-cur-month-sub');
    if (elCurLabel) elCurLabel.textContent = stats.monthLabel;
    if (elCurRev) elCurRev.textContent = this.formatCurrency(stats.monthRevenue);
    if (elCurProfit) {
      const sign = stats.monthProfit >= 0 ? '+' : '';
      elCurProfit.textContent = `${sign}${this.formatCurrency(stats.monthProfit)} net`;
      elCurProfit.className = stats.monthProfit >= 0 ? 'text-xs font-bold text-emerald-600 dark:text-emerald-400' : 'text-xs font-bold text-rose-600 dark:text-rose-400';
    }
    if (elCurSub) {
      const margin = stats.monthTaxable > 0 ? ((stats.monthProfit / stats.monthTaxable) * 100).toFixed(1) : '0.0';
      elCurSub.textContent = `${margin}% net margin · ${stats.monthCount} batches`;
    }

    // 2. Last Month
    const elLastLabel = document.getElementById('hub-stat-last-month-label');
    const elLastRev = document.getElementById('hub-stat-last-month-rev');
    const elLastProfit = document.getElementById('hub-stat-last-month-profit');
    const elLastSub = document.getElementById('hub-stat-last-month-sub');
    if (elLastLabel) elLastLabel.textContent = stats.lastMonthLabel || 'Last Month';
    if (elLastRev) elLastRev.textContent = this.formatCurrency(stats.lastMonthRevenue || 0);
    if (elLastProfit) {
      const sign = (stats.lastMonthProfit || 0) >= 0 ? '+' : '';
      elLastProfit.textContent = `${sign}${this.formatCurrency(stats.lastMonthProfit || 0)} net`;
      elLastProfit.className = (stats.lastMonthProfit || 0) >= 0 ? 'text-xs font-bold text-blue-600 dark:text-blue-400' : 'text-xs font-bold text-rose-600 dark:text-rose-400';
    }
    if (elLastSub) {
      const margin = (stats.lastMonthTaxable || 0) > 0 ? (((stats.lastMonthProfit || 0) / stats.lastMonthTaxable) * 100).toFixed(1) : '0.0';
      elLastSub.textContent = `${margin}% net margin · ${stats.lastMonthCount || 0} batches`;
    }

    // 3. Financial Year
    const elFyLabel = document.getElementById('hub-stat-fy-label');
    const elFyRev = document.getElementById('hub-stat-fy-rev');
    const elFyProfit = document.getElementById('hub-stat-fy-profit');
    const elFySub = document.getElementById('hub-stat-fy-sub');
    if (elFyLabel) elFyLabel.textContent = stats.yearLabel;
    if (elFyRev) elFyRev.textContent = this.formatCurrency(stats.yearRevenue);
    if (elFyProfit) {
      const sign = stats.yearProfit >= 0 ? '+' : '';
      elFyProfit.textContent = `${sign}${this.formatCurrency(stats.yearProfit)} profit`;
    }
    if (elFySub) {
      const margin = stats.yearTaxable > 0 ? ((stats.yearProfit / stats.yearTaxable) * 100).toFixed(1) : '0.0';
      elFySub.textContent = `FY turnover · ${margin}% profit margin`;
    }

    // 4. Lifetime
    const elLifeRev = document.getElementById('hub-stat-lifetime-rev');
    const elLifeCount = document.getElementById('hub-stat-lifetime-count');
    const elLifeSub = document.getElementById('hub-stat-lifetime-sub');
    if (elLifeRev) elLifeRev.textContent = this.formatCurrency(stats.lifetimeRevenue);
    if (elLifeCount) elLifeCount.textContent = `${stats.lifetimeCount} orders`;
    if (elLifeSub) elLifeSub.textContent = `Collected ${this.formatCurrency(stats.totalCollected)} · Due ${this.formatCurrency(stats.totalDue)}`;
  }

  copyCompanyHubProfileSummary() {
    const p = this.data.businessProfile || {};
    const text = `====================================================
${p.brandName || this.config().brand} Executive Company Summary
====================================================
• Legal Entity: ${p.legalName || ''}
• Brand Trade Name: ${p.brandName || this.config().brand}
• GSTIN: ${p.gstin || ''}
• PAN: ${p.pan || ''}
• FSSAI: ${p.fssai || ''}
• Registered Office: ${p.address || ''}, ${p.city || ''}, ${p.state || ''} - ${p.pincode || ''}
• Billing Email: ${p.email || ''}
• Commercial Phone: ${p.phone || ''}

BANKING & PAYMENT COORDINATES:
• Primary Bank: ${p.bankName || ''}
• Account Number: ${p.accountNumber || ''}
• IFSC Code: ${p.ifsc || ''}
• Branch: ${p.branch || ''}
• UPI ID (VPA): ${p.upiId || ''}
====================================================`;

    this.copyToClipboard(text, 'Complete Company Profile Summary');
  }

  /* ---------- COMMERCIAL PERFORMANCE DRILLDOWN ENGINE ---------- */
  openStudioMetricsDrilldown(tab = 'all_time') {
    this.activeStudioDrilldownTab = tab;
    const modal = document.getElementById('studio-metrics-drilldown-modal');
    if (modal) modal.classList.remove('hidden');
    this.renderStudioMetricsDrilldown();
  }

  closeStudioMetricsDrilldown() {
    const modal = document.getElementById('studio-metrics-drilldown-modal');
    if (modal) modal.classList.add('hidden');
  }

  switchStudioDrilldownTab(tab) {
    this.activeStudioDrilldownTab = tab;
    this.renderStudioMetricsDrilldown();
  }

  renderStudioMetricsDrilldown() {
    const tab = this.activeStudioDrilldownTab || 'all_time';
    const container = document.getElementById('drilldown-content-container');
    if (!container) return;

    // Update Tab UI Buttons
    ['all_time', 'monthly', 'yearly', 'receivables'].forEach(t => {
      const btn = document.getElementById(`drilldown-tab-${t === 'all_time' ? 'all' : t}`);
      if (btn) {
        const isActive = t === tab;
        btn.classList.toggle('text-emerald-400', isActive);
        btn.classList.toggle('bg-emerald-500/10', isActive);
        btn.classList.toggle('border-emerald-500/30', isActive);
        btn.classList.toggle('font-bold', isActive);
        btn.classList.toggle('text-slate-400', !isActive);
        btn.classList.toggle('border-transparent', !isActive);
      }
    });

    const orders = (this.data.orders || []).filter(o => !o.isDeleted);
    const stats = this.calculateCompanyCommercialPulse();

    if (tab === 'all_time') {
      let rowsHtml = orders.map(o => {
        const rev = Number(o.totalInvoiceAmount) || 0;
        const profit = o.netProfit !== undefined ? Number(o.netProfit) : (rev - (Number(o.totalDirectCosts) || 0));
        const marginPct = rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0.0';
        return `
          <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
            <td class="px-3 py-2.5 font-bold font-mono text-xs text-white">${tfEscapeHtml(o.invoiceNumber || o.id)}</td>
            <td class="px-3 py-2.5 text-xs text-slate-300 font-medium">${tfEscapeHtml(o.retailerName)}</td>
            <td class="px-3 py-2.5 text-xs text-slate-400 font-mono-num">${tfEscapeHtml(this.formatDate(o.date))}</td>
            <td class="px-3 py-2.5 text-xs font-bold text-white font-mono-num">${tfEscapeHtml(this.formatCurrency(rev))}</td>
            <td class="px-3 py-2.5 text-xs font-bold ${tfEscapeHtml(profit >= 0 ? 'text-emerald-400' : 'text-rose-400')} font-mono-num">
              +${tfEscapeHtml(this.formatCurrency(profit))} <span class="text-xs text-slate-400 font-normal">(${tfEscapeHtml(marginPct)}%)</span>
            </td>
            <td class="px-3 py-2.5 text-xs">
              <span class="px-2 py-0.5 rounded-full text-xs font-bold ${tfEscapeHtml(o.status === 'settled' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30')}">
                ${tfEscapeHtml((o.status || 'draft').replace('_', ' '))}
              </span>
            </td>
            <td class="px-3 py-2.5 text-right">
              <button 
                type="button" 
                onclick="app.loadOrderIntoStudioFromDrilldown('${tfEscapeHtml(tfEscapeJs(o.id))}')" 
                class="btn-tactile px-2.5 py-1 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-800 border border-emerald-500/40 rounded-lg inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                title="Load this order into Invoice Studio editor"
              >
                <i data-lucide="external-link" class="w-3 h-3 text-emerald-400"></i>
                <span>Load in Studio</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div>
              <span class="text-xs text-slate-400 block font-medium">Total Lifetime Turnover</span>
              <span class="text-lg font-black font-mono-num text-emerald-400">${tfEscapeHtml(this.formatCurrency(stats.lifetimeRevenue))}</span>
            </div>
            <div class="text-right">
              <span class="text-xs text-slate-400 block font-medium">Total Realized Profit</span>
              <span class="text-lg font-black font-mono-num text-emerald-400">+${tfEscapeHtml(this.formatCurrency(stats.lifetimeProfit))}</span>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-900 border-b border-slate-800 text-xs uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th class="px-3 py-2">Document #</th>
                  <th class="px-3 py-2">Buyer / Retailer</th>
                  <th class="px-3 py-2">Date</th>
                  <th class="px-3 py-2">Invoice Value</th>
                  <th class="px-3 py-2">Net Profit</th>
                  <th class="px-3 py-2">Status</th>
                  <th class="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-850">
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tab === 'monthly') {
      const monthKeys = Object.keys(stats.monthGroups).sort().reverse();
      let monthRows = monthKeys.map(k => {
        const g = stats.monthGroups[k];
        const [y, m] = k.split('-');
        const d = new Date(parseInt(y), parseInt(m) - 1, 1);
        const name = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        const marginPct = g.revenue > 0 ? ((g.profit / g.revenue) * 100).toFixed(1) : '0.0';
        return `
          <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
            <td class="px-4 py-3 font-bold text-xs text-white">${tfEscapeHtml(name)}</td>
            <td class="px-4 py-3 text-xs font-mono-num text-slate-300 font-bold">${tfEscapeHtml(this.formatCurrency(g.revenue))}</td>
            <td class="px-4 py-3 text-xs font-mono-num text-slate-400">${tfEscapeHtml(this.formatCurrency(g.revenue - g.profit))}</td>
            <td class="px-4 py-3 text-xs font-mono-num font-bold text-emerald-400">+${tfEscapeHtml(this.formatCurrency(g.profit))}</td>
            <td class="px-4 py-3 text-xs font-mono-num text-emerald-400 font-bold">${tfEscapeHtml(marginPct)}%</td>
            <td class="px-4 py-3 text-right text-xs text-slate-300 font-mono-num">${tfEscapeHtml(g.count)} orders</td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div class="space-y-3">
          <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i data-lucide="calendar" class="w-4 h-4 text-emerald-400"></i>
              <span class="text-xs font-bold text-slate-200">Month-by-Month Commercial Trajectory</span>
            </div>
            <span class="text-xs text-slate-400">${tfEscapeHtml(monthKeys.length)} Billing Periods Active</span>
          </div>

          <div class="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-900 border-b border-slate-800 text-xs uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th class="px-4 py-2">Billing Month</th>
                  <th class="px-4 py-2">Invoiced Volume</th>
                  <th class="px-4 py-2">Direct Outflow</th>
                  <th class="px-4 py-2">Net Realized Profit</th>
                  <th class="px-4 py-2">Margin</th>
                  <th class="px-4 py-2 text-right">Orders Count</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-850">
                ${monthRows}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else if (tab === 'yearly') {
      const marginPct = stats.yearTaxable > 0 ? ((stats.yearProfit / stats.yearTaxable) * 100).toFixed(1) : '0.0';
      container.innerHTML = `
        <div class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <span class="text-xs font-bold text-blue-400 uppercase tracking-wider block">${tfEscapeHtml(stats.yearLabel)} Annual Turnover</span>
              <span class="text-xl font-black font-mono-num text-white mt-1 block">${tfEscapeHtml(this.formatCurrency(stats.yearRevenue))}</span>
              <span class="text-xs text-slate-400 mt-0.5 block">Total invoiced supply across all channels</span>
            </div>
            <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Cumulative Realized Profit</span>
              <span class="text-xl font-black font-mono-num text-emerald-300 mt-1 block">+${tfEscapeHtml(this.formatCurrency(stats.yearProfit))}</span>
              <span class="text-xs text-emerald-400 font-bold mt-0.5 block">${tfEscapeHtml(marginPct)}% Net Profit Margin</span>
            </div>
            <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <span class="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Cash In Flow Protection</span>
              <span class="text-xl font-black font-mono-num text-emerald-300 mt-1 block">${tfEscapeHtml(this.formatCurrency(stats.totalCollected))}</span>
              <span class="text-xs text-slate-400 mt-0.5 block">Advances &amp; Settlements In Hand</span>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <h4 class="text-xs font-bold text-slate-200 uppercase tracking-wider">Company Commercial Standing (${tfEscapeHtml(this.config().brand)})</h4>
            <p class="text-xs text-slate-400 leading-relaxed">
              Figures reflect invoices billed, production and packaging costs, freight and commission recorded in TradeFlow.
            </p>
          </div>
        </div>
      `;
    } else if (tab === 'receivables') {
      const pendingOrders = orders.filter(o => (Number(o.customerBalanceDue) || 0) > 0);
      let recvRows = pendingOrders.map(o => {
        const rev = Number(o.totalInvoiceAmount) || 0;
        const adv = Number(o.customerAdvanceReceived) || 0;
        const due = Number(o.customerBalanceDue) || Math.max(0, rev - adv);
        return `
          <tr class="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
            <td class="px-3 py-2.5 font-bold font-mono text-xs text-white">${tfEscapeHtml(o.invoiceNumber || o.id)}</td>
            <td class="px-3 py-2.5 text-xs text-slate-300 font-medium">${tfEscapeHtml(o.retailerName)}</td>
            <td class="px-3 py-2.5 text-xs text-slate-400 font-mono-num">${tfEscapeHtml(this.formatDate(o.dueDate))}</td>
            <td class="px-3 py-2.5 text-xs text-slate-300 font-mono-num">${tfEscapeHtml(this.formatCurrency(rev))}</td>
            <td class="px-3 py-2.5 text-xs text-emerald-400 font-mono-num">${tfEscapeHtml(this.formatCurrency(adv))}</td>
            <td class="px-3 py-2.5 text-xs font-bold text-amber-400 font-mono-num">${tfEscapeHtml(this.formatCurrency(due))}</td>
            <td class="px-3 py-2.5 text-right">
              <button 
                type="button" 
                onclick="app.loadOrderIntoStudioFromDrilldown('${tfEscapeHtml(tfEscapeJs(o.id))}')" 
                class="btn-tactile px-2.5 py-1 text-xs font-bold text-emerald-300 hover:text-white bg-emerald-950/60 hover:bg-emerald-800 border border-emerald-500/40 rounded-lg inline-flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                title="Load this order into Invoice Studio editor"
              >
                <i data-lucide="external-link" class="w-3 h-3 text-emerald-400"></i>
                <span>Load in Studio</span>
              </button>
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div>
              <span class="text-xs text-slate-400 block font-medium">Pending Buyer Receivables</span>
              <span class="text-lg font-black font-mono-num text-amber-400">${tfEscapeHtml(this.formatCurrency(stats.totalDue))}</span>
            </div>
            <div class="text-right">
              <span class="text-xs text-slate-400 block font-medium">Open Accounts</span>
              <span class="text-lg font-bold font-mono-num text-white">${tfEscapeHtml(pendingOrders.length)} Buyers</span>
            </div>
          </div>

          <div class="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-900 border-b border-slate-800 text-xs uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th class="px-3 py-2">Document #</th>
                  <th class="px-3 py-2">Buyer / Retailer</th>
                  <th class="px-3 py-2">Due Date</th>
                  <th class="px-3 py-2">Total Invoiced</th>
                  <th class="px-3 py-2">Advance In Hand</th>
                  <th class="px-3 py-2">Balance Due</th>
                  <th class="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-850">
                ${recvRows || '<tr><td colspan="7" class="p-4 text-center text-slate-500">No pending receivables. All accounts clear!</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  loadOrderIntoStudioFromDrilldown(orderId) {
    this.closeStudioMetricsDrilldown();
    this.openInvoiceStudioModal(orderId);
    this.showToast(`Loaded order ${orderId} into Invoice Studio!`);
  }

  copyStudioCommercialSummary() {
    const stats = this.calculateCompanyCommercialPulse();
    const marginPct = stats.lifetimeTaxable > 0 ? ((stats.lifetimeProfit / stats.lifetimeTaxable) * 100).toFixed(1) : '0.0';
    const summary = `*MAGIC ROOTS - COMMERCIAL PERFORMANCE EXECUTIVE SUMMARY*\n` +
      `═══════════════════════════════════════\n` +
      `🏆 Lifetime Business Done: ${this.formatCurrency(stats.lifetimeRevenue)} (${stats.lifetimeCount} Batches)\n` +
      `💰 Cumulative Net Profit: ${this.formatCurrency(stats.lifetimeProfit)} (${marginPct}% Net Margin)\n` +
      `📅 This Month (${stats.monthLabel}): ${this.formatCurrency(stats.monthRevenue)} | Profit: +${this.formatCurrency(stats.monthProfit)}\n` +
      `📈 FY Turnover: ${this.formatCurrency(stats.yearRevenue)} | Net Profit: +${this.formatCurrency(stats.yearProfit)}\n` +
      `💳 Cash Collected in Hand: ${this.formatCurrency(stats.totalCollected)}\n` +
      `🚨 Outstanding Receivables: ${this.formatCurrency(stats.totalDue)}\n` +
      `═══════════════════════════════════════\n` +
      `Official ERP Report · ${this.config().brand}${this.config().legalName && this.config().legalName !== this.config().brand ? ` (${this.config().legalName})` : ''}`;

    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(summary).catch(() => {});
    }
    this.showToast('Commercial executive summary copied to clipboard!');
  }

  /* ---------- WHATSAPP QUICK MESSENGER & LIVE CONTACT DIRECTORY ENGINE ---------- */
  openStudioMagicDrawer() {
    const modal = document.getElementById('studio-magic-drawer-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    let order = null;
    const studioModal = document.getElementById('invoice-studio-modal');
    const isStudioOpen = studioModal && !studioModal.classList.contains('hidden');

    if (isStudioOpen && this.studioDraftData) {
      order = this.studioDraftData;
    } else if (this.activeOrderId) {
      order = this.findOrder(this.activeOrderId);
    }
    if (!order && this.studioDraftData) {
      order = this.studioDraftData;
    }
    if (!order && this.data.orders && this.data.orders.length > 0) {
      order = this.data.orders[0];
    }
    order = order || {};
    this.activeMessengerOrder = order;

    const profile = this.data.businessProfile || {};

    // Update 1-Column Snippet Previews
    const elSumPrev = document.getElementById('studio-snippet-summary-preview');
    if (elSumPrev) {
      elSumPrev.innerText = `${order.invoiceNumber || 'INV'} · ${order.retailerName || 'Retailer'} · ${this.formatCurrency(order.totalInvoiceAmount || 0)} (Due: ${this.formatCurrency(order.customerBalanceDue || 0)})`;
    }

    const elBankPrev = document.getElementById('studio-snippet-banking-preview');
    if (elBankPrev) {
      elBankPrev.innerText = `${profile.bankName} · A/C: ${profile.accountNumber} · ${profile.upiId}`;
    }

    const elLogPrev = document.getElementById('studio-snippet-logistics-preview');
    if (elLogPrev) {
      elLogPrev.innerText = `${order.transporterName || ''} · LR: ${order.lrNumber || ''} · ${order.vehicleNumber || ''}`;
    }

    const elItemsPrev = document.getElementById('studio-snippet-items-preview');
    if (elItemsPrev) {
      const items = order.items || [];
      const totalCases = items.reduce((s, i) => s + (i.cases || 0), 0);
      elItemsPrev.innerText = `${items.length} Product SKUs · ${totalCases} Cases (${items.reduce((s, i) => s + (i.quantity || 0), 0)} Pcs)`;
    }

    // Populate Target Order Select for Reusability
    const reuseSelect = document.getElementById('studio-reuse-target-order');
    if (reuseSelect) {
      const otherOrders = (this.data.orders || []).filter(o => o.id !== order.id && !o.isDeleted);
      reuseSelect.innerHTML = otherOrders.map(o => `
        <option value="${tfEscapeHtml(o.id)}">${tfEscapeHtml(o.invoiceNumber || o.id)} - ${tfEscapeHtml(o.retailerName)}</option>
      `).join('') || '<option value="">No other orders</option>';
    }

    // Resolve Initial Recipient from Order or Contacts
    const rawOrderPhone = order.customerPhone || '';
    const orderDigits = rawOrderPhone.replace(/[^0-9]/g, '');
    let matchedContact = (this.data.contacts || []).find(c => {
      if (order.retailerId && c.id === order.retailerId) return true;
      if (order.retailerName && c.name && c.name.toLowerCase().trim() === order.retailerName.toLowerCase().trim()) return true;
      if (orderDigits.length >= 7) {
        const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
        if (cPhone && (cPhone.endsWith(orderDigits.slice(-10)) || orderDigits.endsWith(cPhone.slice(-10)))) return true;
      }
      return false;
    });

    if (matchedContact) {
      this.activeMessengerContact = matchedContact;
    } else {
      this.activeMessengerContact = {
        id: 'order-counterparty',
        name: order.retailerName || 'Valued Partner',
        contactPerson: order.retailerName || '',
        phone: rawOrderPhone || '',
        role: 'retailer'
      };
    }

    // Setup Top Recipient Card & Phone Input
    const cleanPhone = (this.activeMessengerContact.phone || '').replace(/[^0-9]/g, '').slice(-10);
    const phoneInput = document.getElementById('messenger-phone-input');
    if (phoneInput) {
      phoneInput.value = cleanPhone;
    }

    const elRecipient = document.getElementById('studio-magic-recipient-name');
    if (elRecipient) {
      elRecipient.innerText = this.activeMessengerContact.name;
    }

    const elBadge = document.getElementById('messenger-recipient-badge');
    if (elBadge) {
      elBadge.innerText = (this.activeMessengerContact.role || 'Partner').toUpperCase();
    }

    const elStatus = document.getElementById('messenger-lookup-status');
    if (elStatus) {
      elStatus.innerText = matchedContact ? 'Matched in Database' : 'Active Order Counterparty';
    }

    // Clear Search Input & Render Directory
    const searchInput = document.getElementById('messenger-contact-search');
    if (searchInput) searchInput.value = '';
    this.renderMessengerDirectory('');

    // Set Default Template
    this.setStudioMessageTemplate(this.activeStudioMessageTemplate || 'invoice_dispatch');
    if (window.lucide) window.lucide.createIcons();
  }

  closeStudioMagicDrawer() {
    const modal = document.getElementById('studio-magic-drawer-modal');
    if (modal) modal.classList.add('hidden');
  }

  /* Render Ecosystem Phone Directory & Speed Dial Chips */
  renderMessengerDirectory(filterQuery = '') {
    const contactsListEl = document.getElementById('messenger-contacts-list');
    const speedDialEl = document.getElementById('messenger-speed-dial-chips');
    const countBadgeEl = document.getElementById('messenger-contact-count-badge');

    const contacts = (this.data.contacts || []).filter(c => !c.isDeleted);
    
    // Render Speed Dial / Frequent Partner Chips (Top 5 active partners)
    if (speedDialEl) {
      const topFrequent = contacts.slice(0, 5);
      speedDialEl.innerHTML = topFrequent.map(c => {
        const shortName = c.name.split(' ')[0] + (c.name.split(' ')[1] ? ' ' + c.name.split(' ')[1].slice(0, 3) : '');
        const isSelected = this.activeMessengerContact && (this.activeMessengerContact.id === c.id || this.activeMessengerContact.name === c.name);
        return `
          <button 
            type="button" 
            onclick="app.selectMessengerContact('${tfEscapeHtml(tfEscapeJs(c.id))}')"
            class="px-2 py-0.5 rounded-full text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
              tfEscapeHtml(isSelected 
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700')
            }"
            title="${tfEscapeHtml(c.name)} (${tfEscapeHtml(c.phone || '')})"
          >
            ${tfEscapeHtml(shortName)}
          </button>
        `;
      }).join('');
    }

    // Filter Contacts by User Query
    const q = (filterQuery || '').trim().toLowerCase();
    const filtered = contacts.filter(c => {
      if (!q) return true;
      const name = (c.name || '').toLowerCase();
      const person = (c.contactPerson || '').toLowerCase();
      const phone = (c.phone || '').replace(/[^0-9]/g, '');
      const role = (c.role || '').toLowerCase();
      const gstin = (c.gstin || '').toLowerCase();
      const cleanQ = q.replace(/[^0-9]/g, '');
      return name.includes(q) || person.includes(q) || role.includes(q) || gstin.includes(q) || (cleanQ && phone.includes(cleanQ)) || (c.phone || '').toLowerCase().includes(q);
    });

    if (countBadgeEl) {
      countBadgeEl.innerText = `${filtered.length} Contacts`;
    }

    if (!contactsListEl) return;

    if (filtered.length === 0) {
      contactsListEl.innerHTML = `
        <div class="py-6 px-3 text-center text-slate-400 space-y-1">
          <i data-lucide="search-x" class="w-5 h-5 mx-auto opacity-50"></i>
          <p class="text-xs font-semibold">No contacts match "${tfEscapeHtml(filterQuery)}"</p>
          <p class="text-xs">Type any mobile number directly into the recipient box above.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const roleColors = {
      retailer: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      manufacturer: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
      marketeer: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
      transporter: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
      packaging: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
    };

    contactsListEl.innerHTML = filtered.map(c => {
      const isSelected = this.activeMessengerContact && (this.activeMessengerContact.id === c.id || this.activeMessengerContact.name === c.name);
      const roleKey = (c.role || '').toLowerCase();
      const roleBadge = roleColors[roleKey] || 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30';
      
      const initials = (c.name || 'PT')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');

      return `
        <div 
          onclick="app.selectMessengerContact('${tfEscapeHtml(tfEscapeJs(c.id))}')"
          class="p-2 rounded-xl cursor-pointer transition-all duration-150 flex items-center justify-between gap-2.5 ${
            tfEscapeHtml(isSelected 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/50 shadow-2xs' 
              : 'hover:bg-slate-100/80 dark:hover:bg-slate-900/80 border border-transparent')
          }"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${tfEscapeHtml(roleBadge)}">
              ${tfEscapeHtml(initials)}
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                <span>${tfEscapeHtml(c.name)}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                ${c.contactPerson && c.contactPerson !== c.name ? `<span>${tfEscapeHtml(c.contactPerson)} · </span>` : ''}
                <span class="font-mono text-emerald-600 dark:text-emerald-400 font-medium">${tfEscapeHtml(c.phone || 'No phone')}</span>
              </div>
            </div>
          </div>

          <div class="shrink-0 flex items-center gap-1">
            <span class="text-xs font-black uppercase px-2 py-0.5 rounded-full border ${tfEscapeHtml(roleBadge)}">
              ${tfEscapeHtml(c.role || 'Partner')}
            </span>
            ${isSelected ? '<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ml-1"></i>' : ''}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  filterMessengerContacts(query) {
    this.renderMessengerDirectory(query);
  }

  clearMessengerSearch() {
    const input = document.getElementById('messenger-contact-search');
    if (input) input.value = '';
    this.renderMessengerDirectory('');
  }

  /* Select Contact from Directory or Speed Dial */
  selectMessengerContact(contactId) {
    const contact = (this.data.contacts || []).find(c => c.id === contactId);
    if (!contact) return;

    this.activeMessengerContact = contact;
    const cleanPhone = (contact.phone || (contact.altPhones && contact.altPhones[0]) || '').replace(/[^0-9]/g, '').slice(-10);

    const phoneInput = document.getElementById('messenger-phone-input');
    if (phoneInput) phoneInput.value = cleanPhone;

    const elRecipient = document.getElementById('studio-magic-recipient-name');
    if (elRecipient) elRecipient.innerText = contact.name;

    const elBadge = document.getElementById('messenger-recipient-badge');
    if (elBadge) {
      elBadge.innerText = (contact.role || 'Partner').toUpperCase();
    }

    const elStatus = document.getElementById('messenger-lookup-status');
    if (elStatus) {
      elStatus.innerText = contact.contactPerson && contact.contactPerson !== contact.name 
        ? `Matched: ${contact.contactPerson}` 
        : 'Matched in Database';
    }

    this.setStudioMessageTemplate(this.activeStudioMessageTemplate || 'invoice_dispatch');
    const searchVal = document.getElementById('messenger-contact-search')?.value || '';
    this.renderMessengerDirectory(searchVal);
    this.showToast(`Recipient set to ${contact.name}`);
  }

  /* Real-Time Phone Input Auto-Lookup & Dynamic Greeting */
  onMessengerPhoneInput(val) {
    const rawVal = val || '';
    const digits = rawVal.replace(/[^0-9]/g, '');

    // Check if phone matches any saved contact (last 10 digits or altPhones)
    if (digits.length >= 7) {
      const matched = (this.data.contacts || []).find(c => {
        const cDigits = (c.phone || '').replace(/[^0-9]/g, '');
        if (cDigits && (cDigits.endsWith(digits) || digits.endsWith(cDigits.slice(-10)))) return true;
        if (c.altPhones && c.altPhones.some(ap => ap.replace(/[^0-9]/g, '').endsWith(digits))) return true;
        return false;
      });

      if (matched) {
        this.activeMessengerContact = matched;
        const elRecipient = document.getElementById('studio-magic-recipient-name');
        if (elRecipient) elRecipient.innerText = matched.name;

        const elBadge = document.getElementById('messenger-recipient-badge');
        if (elBadge) elBadge.innerText = (matched.role || 'Partner').toUpperCase();

        const elStatus = document.getElementById('messenger-lookup-status');
        if (elStatus) {
          elStatus.innerText = matched.contactPerson && matched.contactPerson !== matched.name 
            ? `Matched: ${matched.contactPerson}` 
            : 'Matched in Database';
        }

        this.setStudioMessageTemplate(this.activeStudioMessageTemplate || 'invoice_dispatch');
        const searchVal = document.getElementById('messenger-contact-search')?.value || '';
        this.renderMessengerDirectory(searchVal);
        return;
      }
    }

    // If Unsaved / Custom Mobile Number
    const displayName = digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : (digits ? `+91 ${digits}` : 'Enter Mobile Number');
    this.activeMessengerContact = {
      id: 'custom-number',
      name: digits ? `Partner (+91 ${digits})` : 'Custom Recipient',
      contactPerson: '',
      phone: digits,
      role: digits.length === 10 ? 'Custom' : 'Manual'
    };

    const elRecipient = document.getElementById('studio-magic-recipient-name');
    if (elRecipient) elRecipient.innerText = displayName;

    const elBadge = document.getElementById('messenger-recipient-badge');
    if (elBadge) elBadge.innerText = digits.length === 10 ? 'CUSTOM' : 'MANUAL';

    const elStatus = document.getElementById('messenger-lookup-status');
    if (elStatus) elStatus.innerText = 'Unsaved Number';

    this.setStudioMessageTemplate(this.activeStudioMessageTemplate || 'invoice_dispatch');
    const searchVal = document.getElementById('messenger-contact-search')?.value || '';
    this.renderMessengerDirectory(searchVal);
  }

  /* Reset Phone & Recipient to Order Default */
  resetMessengerPhone() {
    const order = this.activeMessengerOrder || this.studioDraftData || (this.data.orders && this.data.orders[0]) || {};
    const rawOrderPhone = order.customerPhone || '';
    const orderDigits = rawOrderPhone.replace(/[^0-9]/g, '');

    let matchedContact = (this.data.contacts || []).find(c => {
      if (order.retailerId && c.id === order.retailerId) return true;
      if (order.retailerName && c.name && c.name.toLowerCase().trim() === order.retailerName.toLowerCase().trim()) return true;
      if (orderDigits.length >= 7) {
        const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
        if (cPhone && (cPhone.endsWith(orderDigits.slice(-10)) || orderDigits.endsWith(cPhone.slice(-10)))) return true;
      }
      return false;
    });

    if (matchedContact) {
      this.activeMessengerContact = matchedContact;
    } else {
      this.activeMessengerContact = {
        id: 'order-counterparty',
        name: order.retailerName || 'Valued Partner',
        contactPerson: order.retailerName || '',
        phone: rawOrderPhone,
        role: 'retailer'
      };
    }

    const cleanPhone = (this.activeMessengerContact.phone || '').replace(/[^0-9]/g, '').slice(-10);
    const phoneInput = document.getElementById('messenger-phone-input');
    if (phoneInput) phoneInput.value = cleanPhone;

    const elRecipient = document.getElementById('studio-magic-recipient-name');
    if (elRecipient) elRecipient.innerText = this.activeMessengerContact.name;

    const elBadge = document.getElementById('messenger-recipient-badge');
    if (elBadge) elBadge.innerText = (this.activeMessengerContact.role || 'Partner').toUpperCase();

    const elStatus = document.getElementById('messenger-lookup-status');
    if (elStatus) elStatus.innerText = matchedContact ? 'Matched in Database' : 'Active Order Counterparty';

    this.setStudioMessageTemplate(this.activeStudioMessageTemplate || 'invoice_dispatch');
    this.renderMessengerDirectory('');
    this.showToast('Reset to order default recipient');
  }

  /* Copy 1-Column Reusable Detail Snippet */
  copyStudioSnippet(type) {
    const order = this.studioDraftData || this.activeMessengerOrder || (this.data.orders && this.data.orders[0]) || {};
    const profile = this.data.businessProfile || {};

    let text = '';
    let label = '';

    if (type === 'summary') {
      label = 'Invoice Summary';
      text = `*${profile.brandName} - INVOICE SUMMARY*\n` +
        `══════════════════════════════════\n` +
        `📄 Document No: ${order.invoiceNumber || 'INV-DRAFT'}\n` +
        `📅 Date: ${this.formatDate(order.date)}\n` +
        `🏪 Buyer: ${order.retailerName || 'Valued Partner'}\n` +
        `💰 Total Invoice Value: ${this.formatCurrency(order.totalInvoiceAmount || 0)}\n` +
        `💵 Advance Received: ${this.formatCurrency(order.customerAdvanceReceived || 0)}\n` +
        `🚨 BALANCE DUE: ${this.formatCurrency(order.customerBalanceDue || 0)}\n` +
        `⏳ Due Date: ${this.formatDate(order.dueDate)}\n` +
        `══════════════════════════════════`;
    } else if (type === 'banking') {
      label = 'Banking & UPI Coordinates';
      const cleanAmt = order.customerBalanceDue || order.totalInvoiceAmount || 0;
      const upiUri = `upi://pay?pa=${profile.upiId}&pn=${encodeURIComponent(profile.brandName)}&am=${cleanAmt}&cu=INR&tn=${encodeURIComponent('Invoice ' + (order.invoiceNumber || 'INV'))}`;
      text = `*${profile.brandName} - PAYMENT DETAILS*\n` +
        `══════════════════════════════════\n` +
        `🏦 Bank: ${profile.bankName}\n` +
        `👤 A/C Name: ${profile.accountHolder}\n` +
        `🔢 A/C Number: ${profile.accountNumber}\n` +
        `🏛️ IFSC Code: ${profile.ifsc}\n` +
        `📱 UPI ID: ${profile.upiId}\n` +
        `🔗 Instant UPI Payment Link:\n${upiUri}\n` +
        `══════════════════════════════════`;
    } else if (type === 'logistics') {
      label = 'Logistics & LR Details';
      text = `*${profile.brandName} - DISPATCH & TRANSPORT*\n` +
        `══════════════════════════════════\n` +
        `📄 Invoice: ${order.invoiceNumber || 'INV-DRAFT'}\n` +
        `🚚 Transporter: ${order.transporterName || ''}\n` +
        `📦 LR Number: ${order.lrNumber || ''}\n` +
        `🚛 Vehicle Number: ${order.vehicleNumber || ''}\n` +
        `📞 Driver: ${order.driverName || ''} (${order.driverPhone || ''})\n` +
        `📋 E-Way Bill: ${order.ewayBillNumber || ''}\n` +
        `📍 Delivery Godown: ${order.shippingAddress || order.billingAddress || ''}\n` +
        `══════════════════════════════════`;
    } else if (type === 'items') {
      label = 'Itemized Case Breakdown';
      const items = order.items || [];
      const itemLines = items.map((it, idx) => 
        `${idx + 1}. *${it.name}* (${it.variant || it.packSize || 'Standard'}): ${it.cases || Math.ceil((it.quantity || 1) / (it.casePack || 24))} Cases (${it.quantity || 1} Pcs) @ ₹${it.unitRate || 0}/pc = ${this.formatCurrency(it.totalAmount || 0)}`
      ).join('\n') || '• No line items added';
      text = `*${profile.brandName} - ITEM CASE BREAKDOWN*\n` +
        `══════════════════════════════════\n` +
        `📄 Invoice: ${order.invoiceNumber || 'INV-DRAFT'}\n` +
        `🏪 Buyer: ${order.retailerName || 'Valued Partner'}\n\n` +
        `${itemLines}\n\n` +
        `📦 Taxable Subtotal: ${this.formatCurrency(order.taxableSubtotal || 0)}\n` +
        `💰 Total Invoice Value (incl. GST): ${this.formatCurrency(order.totalInvoiceAmount || 0)}\n` +
        `══════════════════════════════════`;
    }

    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    this.showToast(`Copied ${label} to clipboard!`);
  }

  /* Smart Message Templates Switcher with Dynamic Recipient Greetings */
  setStudioMessageTemplate(templateId) {
    this.activeStudioMessageTemplate = templateId;
    
    // Update active styles on 4 single-row template buttons
    ['invoice_dispatch', 'payment_reminder', 'advance_receipt', 'quote'].forEach(t => {
      const btn = document.getElementById(`tpl-btn-${t}`);
      if (btn) {
        const isActive = t === templateId;
        btn.className = isActive 
          ? 'px-2 py-1.5 text-xs font-black rounded-lg text-white bg-emerald-600 transition-all whitespace-nowrap cursor-pointer text-center truncate shadow-xs'
          : 'px-2 py-1.5 text-xs font-extrabold rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-all whitespace-nowrap cursor-pointer text-center truncate';
      }
    });

    const order = this.studioDraftData || this.activeMessengerOrder || (this.data.orders && this.data.orders[0]) || {};
    const profile = this.data.businessProfile || {};

    // Dynamic greeting based on active contact
    const contact = this.activeMessengerContact || { name: order.retailerName || 'Valued Partner' };
    const entityName = contact.name || order.retailerName || 'Valued Partner';
    const contactPerson = contact.contactPerson || '';

    let greetingDispatch = `Namaste *${entityName}*,`;
    let greetingReminder = `Dear *${entityName}*,`;
    let greetingAdvance = `Namaste *${entityName}*,`;
    let greetingQuote = `Dear *${entityName}*,`;

    if (contactPerson && contactPerson !== entityName) {
      greetingDispatch = `Namaste *${contactPerson}* (*${entityName}*),`;
      greetingReminder = `Dear *${contactPerson}* (*${entityName}*),`;
      greetingAdvance = `Namaste *${contactPerson}* (*${entityName}*),`;
      greetingQuote = `Dear *${contactPerson}* (*${entityName}*),`;
    }

    let msg = '';
    if (templateId === 'invoice_dispatch') {
      msg = `*TAX INVOICE & DISPATCH NOTICE - ${profile.brandName}*\n` +
        `══════════════════════════════════\n` +
        `${greetingDispatch}\n\n` +
        `Your consignment for invoice *${order.invoiceNumber || 'INV-DRAFT'}* has been issued and dispatched.\n\n` +
        `📄 *Document:* ${order.invoiceNumber || 'INV-DRAFT'}\n` +
        `📅 *Date:* ${this.formatDate(order.date)}\n` +
        `💰 *Total Invoiced:* ${this.formatCurrency(order.totalInvoiceAmount || 0)}\n` +
        `💵 *Advance Paid:* ${this.formatCurrency(order.customerAdvanceReceived || 0)}\n` +
        `🚨 *BALANCE DUE:* *${this.formatCurrency(order.customerBalanceDue || 0)}*\n\n` +
        `🚚 *Logistics Tracking:*\n` +
        `• Transporter: ${order.transporterName || ''}\n` +
        `• LR No: *${order.lrNumber || ''}*\n` +
        `• Vehicle: ${order.vehicleNumber || ''}\n\n` +
        `*Settlement Coordinates:*\n` +
        `• Bank: ${profile.bankName} | A/C: ${profile.accountNumber}\n` +
        `• IFSC: ${profile.ifsc} | UPI: *${profile.upiId}*\n\n` +
        `Thank you for your valued partnership!\n` +
        `*${profile.legalName}*`;
    } else if (templateId === 'payment_reminder') {
      msg = `*PAYMENT SETTLEMENT REMINDER - ${profile.brandName}*\n` +
        `══════════════════════════════════\n` +
        `${greetingReminder}\n\n` +
        `This is a gentle reminder regarding the outstanding balance for invoice *${order.invoiceNumber || 'INV-DRAFT'}* dated ${this.formatDate(order.date)}.\n\n` +
        `📦 *Invoice Amount:* ${this.formatCurrency(order.totalInvoiceAmount || 0)}\n` +
        `💵 *Advance Received:* ${this.formatCurrency(order.customerAdvanceReceived || 0)}\n` +
        `🚨 *OUTSTANDING BALANCE DUE:* *${this.formatCurrency(order.customerBalanceDue || 0)}*\n` +
        `⏳ *Due Date:* ${this.formatDate(order.dueDate)}\n\n` +
        `Kindly settle the outstanding amount at your earliest convenience:\n` +
        `• Bank: ${profile.bankName}\n` +
        `• A/C No: ${profile.accountNumber}\n` +
        `• IFSC: ${profile.ifsc}\n` +
        `• UPI ID: *${profile.upiId}*\n\n` +
        `Warm regards,\n` +
        `*${profile.brandName} Accounts Team*`;
    } else if (templateId === 'advance_receipt') {
      msg = `*ADVANCE PAYMENT RECEIPT - ${profile.brandName}*\n` +
        `══════════════════════════════════\n` +
        `${greetingAdvance}\n\n` +
        `We acknowledge with thanks the receipt of your advance payment towards order *${order.invoiceNumber || 'INV-DRAFT'}*:\n\n` +
        `💰 *Advance Received:* *${this.formatCurrency(order.customerAdvanceReceived || order.amountReceived || 0)}*\n` +
        `📄 *Voucher Ref:* ${order.utrNumber || ''}\n` +
        `📅 *Date:* ${this.formatDate(order.date)}\n` +
        `📦 *Order Value:* ${this.formatCurrency(order.totalInvoiceAmount || 0)}\n` +
        `🚨 *Remaining Balance:* ${this.formatCurrency(order.customerBalanceDue || 0)}\n\n` +
        `Your production and dispatch are in active progress.\n` +
        `*${profile.legalName}*`;
    } else if (templateId === 'quote') {
      msg = `*COMMERCIAL ESTIMATE & QUOTATION - ${profile.brandName}*\n` +
        `══════════════════════════════════\n` +
        `${greetingQuote}\n\n` +
        `Please find below our commercial proforma price quotation:\n\n` +
        `📄 *Proforma Ref:* ${order.invoiceNumber || 'PROFORMA-QUOTE'}\n` +
        `📅 *Date:* ${this.formatDate(order.date)}\n` +
        `💰 *Total Estimated Value:* ${this.formatCurrency(order.totalInvoiceAmount || 0)}\n` +
        `⏳ *Terms:* 50% Advance, Balance against LR Delivery\n\n` +
        `Please confirm to initiate batch manufacturing.\n` +
        `*${profile.brandName}*`;
    }

    const textarea = document.getElementById('studio-magic-message-text');
    if (textarea) textarea.value = msg;
  }

  copyStudioMagicMessage() {
    const textarea = document.getElementById('studio-magic-message-text');
    const text = textarea ? textarea.value : '';
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    this.showToast('📋 WhatsApp message copied to clipboard!');
  }

  sendStudioTemplatedWhatsApp() {
    const textarea = document.getElementById('studio-magic-message-text');
    const msg = textarea ? textarea.value : '';
    
    // Check editable messenger phone input first
    const phoneInput = document.getElementById('messenger-phone-input');
    let rawPhone = phoneInput ? phoneInput.value.trim() : '';

    if (!rawPhone) {
      const fallback = document.getElementById('studio-whatsapp-phone');
      if (fallback) rawPhone = fallback.value.trim();
    }
    if (!rawPhone && this.activeMessengerContact) {
      rawPhone = this.activeMessengerContact.phone || '';
    }

    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    if (!cleanPhone || cleanPhone.length < 10) {
      this.showToast('Please enter a valid 10-digit mobile number.');
      return;
    }

    const encoded = encodeURIComponent(msg);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');
    this.showToast(`🚀 Opening WhatsApp chat with +${cleanPhone}!`);
  }

  duplicateStudioDraftAsNewOrder() {
    if (!this.studioDraftData) return;
    const now = new Date();
    const numbers = this.nextOrderNumbers();

    const newOrder = JSON.parse(JSON.stringify(this.studioDraftData));
    newOrder.id = numbers.orderId;
    newOrder.invoiceNumber = numbers.invoiceNumber;
    newOrder.date = now.toISOString().split('T')[0];
    newOrder.dueDate = this.dueDateFromTerms(newOrder.date, newOrder.paymentTerms);
    newOrder.status = 'action_needed';
    newOrder.isDeleted = false;

    if (!this.data.orders) this.data.orders = [];
    this.data.orders.unshift(newOrder);
    this.saveData();

    this.showToast(`Duplicated draft as brand-new order ${newOrder.invoiceNumber}!`);
    this.closeStudioMagicDrawer();
    this.openInvoiceStudioModal(newOrder.id);
  }

  applyStudioDetailsToTargetOrder() {
    const select = document.getElementById('studio-reuse-target-order');
    const targetId = select ? select.value : null;
    if (!targetId) {
      this.showToast('Please select a target order.');
      return;
    }

    const targetOrder = this.data.orders.find(o => o.id === targetId);
    if (!targetOrder || !this.studioDraftData) {
      this.showToast('Order not found.');
      return;
    }

    // Apply Party & Logistics from current studio draft
    targetOrder.retailerName = this.studioDraftData.retailerName;
    targetOrder.retailerId = this.studioDraftData.retailerId;
    targetOrder.customerPhone = this.studioDraftData.customerPhone;
    targetOrder.billingAddress = this.studioDraftData.billingAddress;
    targetOrder.shippingAddress = this.studioDraftData.shippingAddress;
    targetOrder.transporterName = this.studioDraftData.transporterName;
    targetOrder.vehicleNumber = this.studioDraftData.vehicleNumber;
    targetOrder.driverName = this.studioDraftData.driverName;
    targetOrder.driverPhone = this.studioDraftData.driverPhone;

    this.saveData();
    this.showToast(`Party & Logistics details applied to ${targetOrder.invoiceNumber || targetOrder.id}!`);
  }
});
