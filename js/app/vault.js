// TradeFlow: Document preview window. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ---------- UNIVERSAL DOCUMENT PREVIEW MODAL ---------- */
  openDocPreviewModal(paymentId) {
    const p = (this.data.payments || []).find(x => x.id === paymentId);
    if (!p) {
      this.showToast('Payment entry not found.');
      return;
    }

    this.paymentsState.activeDocEntry = p;
    const modal = document.getElementById('dvm');
    if (!modal) return;

    const partyLabel = p.partyName || 'Payment Proof';
    const dirLabel = p.direction === 'paid' ? 'Paid Out' : 'Received';
    const titleEl = document.getElementById('dvm-title');
    if (titleEl) {
      titleEl.innerText = `${partyLabel} (${this.formatCurrency(p.amount)} · ${dirLabel})`;
      titleEl.title = p.pn || 'Payment_Slip.pdf';
    }

    const subEl = document.getElementById('dvm-sub');
    if (subEl) {
      subEl.innerText = `${p.pn || 'Payment_Slip.pdf'} · ${this.formatDate(p.date)}`;
      subEl.title = p.pn || '';
    }

    const partyInfoEl = document.getElementById('dvm-party-info');
    if (partyInfoEl) partyInfoEl.innerText = p.partyName;
    const amtInfoEl = document.getElementById('dvm-amount-info');
    if (amtInfoEl) amtInfoEl.innerText = (p.direction === 'paid' ? '- ' : '+ ') + this.formatCurrency(p.amount);

    const folder = p.orderFolder || p.orderRef || 'general';
    const pathInfoEl = document.getElementById('dvm-path-info');
    if (pathInfoEl) pathInfoEl.innerText = `Storage: storage/documents/orders/${folder}/`;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();

    const area = document.getElementById('dvm-preview-area');
    const controls = document.getElementById('dvm-pdf-controls');

    if (!p.pd && !p.dataUrl) {
      if (controls) controls.innerHTML = tfSanitizeHtml('');
      if (area) {
        area.innerHTML = `
          <div class="max-w-md w-full mx-auto my-auto p-6 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl shadow-xl text-center space-y-4">
            <div class="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <i data-lucide="receipt" class="w-6 h-6"></i>
            </div>
            <div>
              <span class="text-xs font-black uppercase tracking-wider text-slate-400">Electronic Payment Advice</span>
              <h4 class="text-xl font-black font-mono-num text-slate-900 dark:text-white mt-1">${tfEscapeHtml(this.formatCurrency(p.amount))}</h4>
              <p class="text-xs font-semibold ${tfEscapeHtml(p.direction === 'paid' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400')} mt-0.5">
                ${tfEscapeHtml(p.direction === 'paid' ? 'Disbursed to ' + (p.partyName || 'Vendor') : 'Received from ' + (p.partyName || 'Customer'))}
              </p>
            </div>
            <div class="text-left text-xs bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div class="flex justify-between">
                <span class="text-slate-400">Transaction ID / UTR:</span>
                <strong class="font-mono text-slate-800 dark:text-slate-200">${tfEscapeHtml(p.utr || p.txnId || 'TRF-' + p.id)}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Order Reference:</span>
                <strong class="font-mono text-slate-800 dark:text-slate-200">${tfEscapeHtml(p.orderRef || '—')}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Payment Date:</span>
                <strong class="text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatDate(p.date))}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Payment Mode:</span>
                <strong class="text-slate-800 dark:text-slate-200">${tfEscapeHtml(p.mode || 'NEFT')}</strong>
              </div>
              ${p.notes ? `
                <div class="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                  Remarks: ${tfEscapeHtml(p.notes)}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const isImg = (p.pt && p.pt.startsWith('image/')) || (p.pd && p.pd.startsWith('data:image')) || (p.pn && /\.(png|jpg|jpeg|webp)$/i.test(p.pn));

    if (isImg) {
      if (controls) controls.innerHTML = tfSanitizeHtml('');
      if (area) {
        area.innerHTML = `<img src="${tfEscapeHtml(tfSafeUrl(p.dataUrl || p.pd))}" class="max-w-full max-h-full rounded-xl object-contain m-auto shadow-xl" alt="Proof">`;
      }
    } else {
      setTimeout(() => {
        this.renderPdfDocument(p.dataUrl || p.pd, area, controls);
      }, 50);
    }
  }

  closeDocPreview() {
    const modal = document.getElementById('dvm');
    if (modal) modal.classList.add('hidden');
  }

  async openFileInExplorer(filePath) {
    if (!filePath) {
      this.showToast('No document path provided');
      return;
    }
    try {
      this.showToast('Opening file in Windows Explorer...');
      const resp = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        this.showToast('Revealed in Windows Explorer!');
      } else {
        this.showToast('Could not open in Windows Explorer: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.warn('openFileInExplorer error:', e);
      this.showToast('Failed to communicate with local server');
    }
  }

  async openOrderFolder(orderId) {
    if (!orderId) {
      this.showToast('No Order ID provided');
      return;
    }
    try {
      this.showToast(`Opening order folder (${orderId}) in Windows Explorer...`);
      const resp = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        this.showToast(`Opened order folder (${orderId}) in Windows Explorer!`);
      } else {
        this.showToast('Could not open folder: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.warn('openOrderFolder error:', e);
      this.showToast('Failed to open folder');
    }
  }

  async openDocFolderForEntry(paymentId) {
    const p = (this.data.payments || []).find(x => x.id === paymentId);
    if (!p) return;
    this.paymentsState.activeDocEntry = p;
    const targetFile = p.slipPath || p.documentPath || p.docPath || p.receiptPath || p.pn;
    if (targetFile) {
      await this.openFileInExplorer(targetFile);
    } else {
      await this.openActiveDocFolder();
    }
  }

  async openActiveDocFolder() {
    const entry = this.paymentsState.activeDocEntry;
    const targetFile = entry ? (entry.slipPath || entry.documentPath || entry.docPath || entry.receiptPath || entry.pn) : null;
    if (targetFile) {
      await this.openFileInExplorer(targetFile);
      return;
    }
    const folder = entry ? (entry.orderFolder || entry.orderRef || 'general') : 'general';
    await this.openDocFolder(folder);
  }

  async openDocFolder(folder = 'general') {
    try {
      this.showToast(`Opening folder (${folder}) in Windows Explorer...`);
      const resp = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: folder })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        const fullPath = data.path || `data/orders/${folder}/`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(fullPath).catch(() => {});
        }
        this.showToast(`Opened in File Explorer: ${folder}`);
      } else {
        this.showToast(`Could not open folder: ${data.error || 'Unknown error'}`);
      }
    } catch (e) {
      this.showToast(`Storage directory: data/orders/${folder}/`);
    }
  }

  async openDataFolder() {
    try {
      this.showToast('Opening master data directory in Windows Explorer...');
      const resp = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'root' })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.success) {
        this.showToast('Opened master data & documents folder (data/) in File Explorer');
      } else {
        this.showToast('Could not open data folder: ' + (data.error || ''));
      }
    } catch (e) {
      this.showToast('Data folder: data/');
    }
  }

  openExcelFile() {
    window.open('/api/export/excel', '_blank');
    this.showToast('Exporting / Opening TradeFlow_Master_Database.xlsx...');
  }

  revealExcelFile() {
    this.openFileInExplorer('data/TradeFlow_Master_Database.xlsx');
  }

  // ====================== DOCUMENT VAULT & SMART ANALYZER ENGINE ======================

  /**
   * Smart rule-based analyzer. Extracts structured fields from a filename,
   * file text blob, or image caption. Works fully offline.
   */
  analyzeDocument(rawContent, orderId, defaultCategory = 'mfg_invoice') {
    const text = (rawContent || '').toLowerCase();
    const order = this.findOrder(orderId);

    const result = {
      category: defaultCategory,
      invoiceNumber: '',
      docDate: new Date().toISOString().split('T')[0],
      counterpartyName: '',
      counterpartyGstin: '',
      taxableAmount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalAmount: 0,
      utrNumber: '',
      bankName: '',
      paymentMode: '',
      notes: '',
    };

    // Category Detection
    if (/bank|neft|rtgs|imps|utr|transfer|payment|advice/.test(text)) result.category = 'bank_receipt';
    else if (/transport|lr|bilty|consign|lorry|freight|eway/.test(text)) result.category = 'transport_bilty';
    else if (/packaging|jar|cap|label|bottle|apex|polymer/.test(text)) result.category = 'pkg_invoice';
    else if (/retailer|buyer|sale|dispatch/.test(text)) result.category = 'retailer_invoice';
    else if (/factory|mfg|manufacture|production|job.?work|saurashtra|agro/.test(text)) result.category = 'mfg_invoice';

    // Invoice Number
    const invMatch = rawContent.match(/(?:inv|invoice|bill|sa|ref|lr|utr|neft|no)[.\-_#:\s]*([A-Z0-9\-\/]+)/i);
    if (invMatch) result.invoiceNumber = invMatch[1].trim();

    // UTR (bank receipts)
    const utrMatch = rawContent.match(/([A-Z0-9]{12,22})/i);
    if (utrMatch && result.category === 'bank_receipt') result.utrNumber = utrMatch[1].trim();

    // Date from filename
    const dateMatch = rawContent.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
    if (dateMatch) {
      const [, y, m, d] = dateMatch;
      const year = parseInt(y);
      if (year > 2000 && year < 2100) result.docDate = `${y}-${m}-${d}`;
    }

    // Counterparty matching
    if (order) {
      const candidates = [];
      if (result.category === 'mfg_invoice') candidates.push(this.data.contacts.find(c => c.id === order.manufacturerId));
      else if (result.category === 'pkg_invoice') candidates.push(this.data.contacts.find(c => c.id === order.packagingVendorId));
      else if (result.category === 'transport_bilty') candidates.push(this.data.contacts.find(c => c.id === order.transporterId));
      else if (result.category === 'retailer_invoice') candidates.push(this.data.contacts.find(c => c.id === order.retailerId));
      else candidates.push(...this.data.contacts);
      const validCandidates = candidates.filter(Boolean);
      for (const c of validCandidates) {
        const name = (c.name || '').toLowerCase();
        if (name && text.includes(name.split(' ')[0])) {
          result.counterpartyName = c.name;
          result.counterpartyGstin = c.gstin || '';
          break;
        }
      }
      if (!result.counterpartyName && validCandidates.length > 0 && validCandidates[0]) {
        result.counterpartyName = validCandidates[0].name;
        result.counterpartyGstin = validCandidates[0].gstin || '';
      }
    }

    // Amount extraction
    const amtMatches = [...(rawContent.matchAll(/(?:total|amount|amt|rs\.?|inr)\s*:?\s*([\d,]+\.?\d*)/gi))];
    if (amtMatches.length > 0) {
      const amounts = amtMatches.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(n => n > 0);
      if (amounts.length > 0) {
        result.totalAmount = Math.max(...amounts);
        result.taxableAmount = Math.round(result.totalAmount / 1.12 * 100) / 100;
        const gst = Math.round((result.totalAmount - result.taxableAmount) * 100) / 100;
        if (order && order.gstType === 'intra') {
          result.cgst = Math.round(gst / 2 * 100) / 100;
          result.sgst = Math.round(gst / 2 * 100) / 100;
        } else {
          result.igst = gst;
        }
      }
    }

    // Bank name detection
    for (const b of ['hdfc', 'icici', 'axis', 'sbi', 'kotak', 'yes bank', 'pnb', 'bob', 'canara', 'union']) {
      if (text.includes(b)) { result.bankName = b.toUpperCase(); break; }
    }

    // Payment mode
    if (/neft/.test(text)) result.paymentMode = 'NEFT';
    else if (/rtgs/.test(text)) result.paymentMode = 'RTGS';
    else if (/imps/.test(text)) result.paymentMode = 'IMPS';
    else if (/upi/.test(text)) result.paymentMode = 'UPI';
    else if (/cheque|check/.test(text)) result.paymentMode = 'Cheque';
    else if (/cash/.test(text)) result.paymentMode = 'Cash';
    else if (result.category === 'bank_receipt') result.paymentMode = 'Bank Transfer';

    return result;
  }

  triggerOrderDocUpload(orderId, defaultCategory = 'mfg_invoice') {
    this.pendingDocOrderId = orderId;
    this.pendingDocCategory = defaultCategory;
    const input = document.getElementById('order-doc-upload-input');
    if (input) { input.value = ''; input.click(); }
  }

  handleOrderDocSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const orderId = this.pendingDocOrderId;
    const defaultCategory = this.pendingDocCategory || 'mfg_invoice';
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target.result;
      const analyzed = this.analyzeDocument(file.name, orderId, defaultCategory);
      this.openDocumentReviewModal({ orderId, fileName: file.name, fileData, fileType: file.type, analyzed });
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  openDocumentReviewModal(payload) {
    const modal = document.getElementById('document-review-modal');
    if (!modal) return;
    this.currentReviewDoc = payload;
    const { orderId, fileName, fileData, fileType, analyzed } = payload;

    const orderBadge = document.getElementById('doc-review-order-badge');
    const fileNameEl = document.getElementById('doc-review-filename');
    const destPath = document.getElementById('doc-review-dest-path');
    if (orderBadge) orderBadge.innerText = orderId;
    if (fileNameEl) fileNameEl.innerText = `${fileName} • ${fileType || 'Document'}`;
    if (destPath) destPath.innerText = `storage/documents/orders/${orderId}/`;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('review-order-id', orderId);
    setVal('review-file-data', fileData);
    setVal('review-file-name', fileName);
    setVal('review-file-type', fileType || '');
    const catSel = document.getElementById('review-category');
    if (catSel) catSel.value = analyzed.category;
    setVal('review-doc-number', analyzed.invoiceNumber);
    setVal('review-doc-date', analyzed.docDate);
    setVal('review-counterparty-name', analyzed.counterpartyName);
    setVal('review-gstin', analyzed.counterpartyGstin);
    setVal('review-taxable-amount', analyzed.taxableAmount || '');
    setVal('review-cgst', analyzed.cgst || '');
    setVal('review-sgst', analyzed.sgst || '');
    setVal('review-igst', analyzed.igst || '');
    setVal('review-total-amount', analyzed.totalAmount || '');
    setVal('review-utr-number', analyzed.utrNumber || '');
    setVal('review-bank-name', analyzed.bankName || '');
    setVal('review-payment-mode', analyzed.paymentMode || '');
    setVal('review-notes', analyzed.notes || '');

    const cSel = document.getElementById('review-counterparty-select');
    if (cSel) {
      const order = this.findOrder(orderId);
      const relevant = this.data.contacts.filter(c => {
        if (!order) return true;
        const cat = analyzed.category;
        if (cat === 'mfg_invoice') return c.role === 'manufacturer';
        if (cat === 'pkg_invoice') return c.role === 'packaging';
        if (cat === 'transport_bilty') return c.role === 'transporter';
        if (cat === 'retailer_invoice') return c.role === 'retailer';
        return true;
      });
      cSel.innerHTML = `<option value="">— Select Known Partner —</option>` +
        relevant.map(c => `<option value="${tfEscapeHtml(c.id)}" ${tfEscapeHtml(c.name === analyzed.counterpartyName ? 'selected' : '')}>${tfEscapeHtml(c.name)} (${tfEscapeHtml(c.role)})</option>`).join('');
    }

    this.docPreviewZoom = 1.0;
    this._renderDocPreview(fileData, fileType, fileName);
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  _renderDocPreview(fileData, fileType) {
    const iframe = document.getElementById('doc-preview-iframe');
    const imgWrapper = document.getElementById('doc-preview-img-wrapper');
    const img = document.getElementById('doc-preview-img');
    const placeholder = document.getElementById('doc-preview-placeholder');
    const extLink = document.getElementById('doc-preview-external-link');

    if (iframe) iframe.classList.add('hidden');
    if (imgWrapper) imgWrapper.classList.remove('hidden');
    if (img) img.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (!fileData) return;
    if (extLink) extLink.href = tfSafeUrl(fileData);

    if (fileType && fileType.includes('pdf')) {
      if (iframe) {
        iframe.src = tfSafeUrl(fileData);
        iframe.classList.remove('hidden');
        if (imgWrapper) imgWrapper.classList.add('hidden');
        if (placeholder) placeholder.classList.add('hidden');
      }
    } else if (fileType && fileType.startsWith('image/')) {
      if (img && imgWrapper) {
        img.src = tfSafeUrl(fileData);
        img.style.transform = `scale(${this.docPreviewZoom})`;
        img.style.transformOrigin = 'top center';
        img.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
      }
    }
  }

  closeDocumentReviewModal() {
    const modal = document.getElementById('document-review-modal');
    if (modal) modal.classList.add('hidden');
    this.currentReviewDoc = null;
  }

  reanalyzeCurrentDocument() {
    if (!this.currentReviewDoc) return;
    const { orderId, fileName, fileData, fileType } = this.currentReviewDoc;
    const defaultCat = document.getElementById('review-category')?.value || 'mfg_invoice';
    const analyzed = this.analyzeDocument(fileName, orderId, defaultCat);
    this.openDocumentReviewModal({ orderId, fileName, fileData, fileType, analyzed });
    this.showToast('Re-analysis complete — fields updated from filename!');
  }

  zoomDocPreview(delta) {
    this.docPreviewZoom = Math.max(0.4, Math.min(3.0, (this.docPreviewZoom || 1.0) + delta));
    const img = document.getElementById('doc-preview-img');
    if (img && !img.classList.contains('hidden')) img.style.transform = `scale(${this.docPreviewZoom})`;
  }

  resetDocPreviewZoom() {
    this.docPreviewZoom = 1.0;
    const img = document.getElementById('doc-preview-img');
    if (img) img.style.transform = 'scale(1)';
  }

  handleReviewCategoryChange(val) {
    const cSel = document.getElementById('review-counterparty-select');
    if (!cSel) return;
    const orderId = document.getElementById('review-order-id')?.value;
    const order = this.findOrder(orderId);
    const relevant = this.data.contacts.filter(c => {
      if (!order) return true;
      if (val === 'mfg_invoice') return c.role === 'manufacturer';
      if (val === 'pkg_invoice') return c.role === 'packaging';
      if (val === 'transport_bilty') return c.role === 'transporter';
      if (val === 'retailer_invoice') return c.role === 'retailer';
      return true;
    });
    cSel.innerHTML = `<option value="">— Select Known Partner —</option>` +
      relevant.map(c => `<option value="${tfEscapeHtml(c.id)}">${tfEscapeHtml(c.name)} (${tfEscapeHtml(c.role)})</option>`).join('');
  }

  handleReviewCounterpartySelect(contactId) {
    if (!contactId) return;
    const contact = this.data.contacts.find(c => c.id === contactId);
    if (!contact) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('review-counterparty-name', contact.name);
    setVal('review-gstin', contact.gstin || '');
  }

  handleSaveReviewedDocument(event) {
    if (event && event.preventDefault) event.preventDefault();
    const getVal = (id) => (document.getElementById(id)?.value || '').trim();
    const orderId = getVal('review-order-id');
    const fileData = getVal('review-file-data');
    const fileName = getVal('review-file-name');
    const fileType = getVal('review-file-type');
    const category = getVal('review-category') || 'other';
    const docNumber = getVal('review-doc-number') || `DOC-${Date.now().toString().slice(-6)}`;
    const docDate = getVal('review-doc-date') || new Date().toISOString().split('T')[0];
    const counterpartyName = getVal('review-counterparty-name');
    const gstin = getVal('review-gstin');
    const taxableAmount = parseFloat(getVal('review-taxable-amount')) || 0;
    const cgst = parseFloat(getVal('review-cgst')) || 0;
    const sgst = parseFloat(getVal('review-sgst')) || 0;
    const igst = parseFloat(getVal('review-igst')) || 0;
    const totalAmount = parseFloat(getVal('review-total-amount')) || (taxableAmount + cgst + sgst + igst);
    const utrNumber = getVal('review-utr-number');
    const bankName = getVal('review-bank-name');
    const paymentMode = getVal('review-payment-mode');
    const notes = getVal('review-notes');

    if (!orderId || !fileData || !fileName) { this.showToast('Error: Missing required document data.'); return; }

    const docPayload = { orderId, category, fileName, fileData, metadata: { invoiceNumber: docNumber, docDate, counterpartyName, gstin, taxableAmount, cgst, sgst, igst, totalAmount, utrNumber, bankName, paymentMode, notes } };

    const saveLocally = () => {
      if (!this.data.documents) this.data.documents = [];
      this.data.documents.unshift({ id: `DOC-${Date.now()}`, orderId, category, fileName, fileData, metadata: docPayload.metadata, createdAt: new Date().toISOString(), status: 'saved_locally' });
      this.saveData();
      this.closeDocumentReviewModal();
      this.renderActiveView();
      if (window.lucide) window.lucide.createIcons();
      this.showToast(`Document "${fileName}" saved & filed to ${orderId} vault!`);
    };

    if (typeof fetch !== 'undefined') {
      fetch('/api/documents/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(docPayload) })
        .then(res => res.json()).then(result => {
          if (result.success && result.doc) {
            if (!this.data.documents) this.data.documents = [];
            this.data.documents.unshift({ ...result.doc, fileData });
            this.saveData();
            this.closeDocumentReviewModal();
            this.renderActiveView();
            if (window.lucide) window.lucide.createIcons();
            this.showToast(`Invoice "${fileName}" analyzed, saved & filed to disk at storage/documents/orders/${orderId}/`);
          } else { saveLocally(); }
        }).catch(() => saveLocally());
    } else { saveLocally(); }
  }

  previewDocument(docId) {
    const doc = (this.data.documents || []).find(d => d.id === docId);
    if (!doc) {
      this.showToast('Document not found.');
      return;
    }

    const modal = document.getElementById('dvm');
    if (!modal) return;

    const meta = doc.metadata || {};
    const catLabels = {
      mfg_invoice: 'Factory Invoice',
      pkg_invoice: 'Packaging Bill',
      transport_bilty: 'LR / Bilty',
      retailer_invoice: 'Buyer Invoice',
      bank_receipt: 'Bank Receipt',
      other: 'Document'
    };
    const catLabel = catLabels[doc.category] || 'Document';

    const titleEl = document.getElementById('dvm-title');
    if (titleEl) {
      titleEl.innerText = `${meta.counterpartyName || catLabel} (${meta.totalAmount ? this.formatCurrency(meta.totalAmount) : (meta.invoiceNumber || doc.fileName)})`;
      titleEl.title = doc.fileName || 'Document.pdf';
    }

    const subEl = document.getElementById('dvm-sub');
    if (subEl) {
      subEl.innerText = `${doc.fileName || meta.invoiceNumber || 'Document.pdf'} · ${meta.docDate ? this.formatDate(meta.docDate) : (doc.uploadedAt ? this.formatDate(doc.uploadedAt) : '')}`;
      subEl.title = doc.fileName || '';
    }

    const partyInfoEl = document.getElementById('dvm-party-info');
    if (partyInfoEl) partyInfoEl.innerText = meta.counterpartyName || catLabel;
    const amtInfoEl = document.getElementById('dvm-amount-info');
    if (amtInfoEl) amtInfoEl.innerText = meta.totalAmount ? this.formatCurrency(meta.totalAmount) : (meta.invoiceNumber || 'Filed Bill');

    const folder = doc.orderId || 'general';
    const pathInfoEl = document.getElementById('dvm-path-info');
    if (pathInfoEl) pathInfoEl.innerText = `Storage: storage/documents/orders/${folder}/`;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();

    const area = document.getElementById('dvm-preview-area');
    const controls = document.getElementById('dvm-pdf-controls');
    const isImg = (doc.fileType && doc.fileType.startsWith('image/')) || 
                  (doc.fileData && doc.fileData.startsWith('data:image')) || 
                  (doc.fileName && /\.(png|jpg|jpeg|webp)$/i.test(doc.fileName)) ||
                  (doc.fileUrl && /\.(png|jpg|jpeg|webp)$/i.test(doc.fileUrl));

    const source = doc.fileData || doc.fileUrl;
    if (!source) {
      if (area) area.innerHTML = `<div class="p-8 text-center text-slate-400">Preview not available for this document.</div>`;
      return;
    }

    if (isImg) {
      if (controls) controls.innerHTML = tfSanitizeHtml('');
      if (area) {
        area.innerHTML = `<img src="${tfEscapeHtml(tfSafeUrl(source))}" class="max-w-full max-h-full rounded-xl object-contain m-auto shadow-xl" alt="${tfEscapeHtml(doc.fileName)}">`;
      }
    } else {
      setTimeout(() => {
        this.renderPdfDocument(source, area, controls);
      }, 50);
    }
  }

  async deleteDocument(docId, orderId) {
    const confirmed = await this.showModalConfirm({
      title: 'Remove Document from Vault',
      subtitle: 'Vault Index Deregistration',
      message: 'Remove this document from the vault?<br><br><span class="text-xs text-slate-500">The local disk copy is preserved in storage.</span>',
      confirmText: 'Remove Document',
      confirmClass: 'bg-rose-600 hover:bg-rose-500',
      icon: 'trash-2'
    });
    if (!confirmed) return;
    if (!this.data.documents) return;
    this.data.documents = this.data.documents.filter(d => d.id !== docId);
    this.saveData();
    this.renderActiveView();
    if (window.lucide) window.lucide.createIcons();
    this.showToast('Document removed from vault index.');
  }

  renderDocumentVaultHTML(orderId) {
    const docs = (this.data.documents || []).filter(d => d.orderId === orderId);
    if (window.TFComponents && typeof window.TFComponents.renderDocumentVault === 'function') {
      return window.TFComponents.renderDocumentVault(orderId, docs);
    }

    const catLabel = { mfg_invoice: 'Factory Invoice', pkg_invoice: 'Packaging Bill', transport_bilty: 'LR / Bilty', retailer_invoice: 'Buyer Invoice', bank_receipt: 'Bank Proof', other: 'Other' };
    const catIcon = { mfg_invoice: 'factory', pkg_invoice: 'package', transport_bilty: 'truck', retailer_invoice: 'building-2', bank_receipt: 'landmark', other: 'file-text' };
    const catColor = { mfg_invoice: 'text-blue-500', pkg_invoice: 'text-blue-500', transport_bilty: 'text-purple-500', retailer_invoice: 'text-emerald-500', bank_receipt: 'text-amber-500', other: 'text-slate-400' };

    const docCards = docs.map(doc => {
      const meta = doc.metadata || {};
      const label = catLabel[doc.category] || 'Document';
      const icon = catIcon[doc.category] || 'file-text';
      const color = catColor[doc.category] || 'text-slate-400';
      const dateStr = meta.docDate ? this.formatDate(meta.docDate) : '';
      const amtStr = meta.totalAmount ? this.formatCurrency(meta.totalAmount) : '';
      return `<div class="tf-doc-card group">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 ${tfEscapeHtml(color)} shrink-0"><i data-lucide="${tfEscapeHtml(icon)}" class="w-3.5 h-3.5"></i></span>
            <div class="min-w-0">
              <p class="font-bold text-xs text-slate-900 dark:text-white truncate">${tfEscapeHtml(meta.invoiceNumber || doc.fileName)}</p>
              <p class="text-xs text-slate-400 truncate">${tfEscapeHtml(label)}${tfEscapeHtml(dateStr ? ' • ' + dateStr : '')}</p>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="event.stopPropagation(); app.previewDocument('${tfEscapeHtml(tfEscapeJs(doc.id))}')" class="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-white" title="Preview"><i data-lucide="eye" class="w-3 h-3"></i></button>
            <button onclick="event.stopPropagation(); app.deleteDocument('${tfEscapeHtml(tfEscapeJs(doc.id))}', '${tfEscapeHtml(tfEscapeJs(orderId))}')" class="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500" title="Remove"><i data-lucide="trash-2" class="w-3 h-3"></i></button>
          </div>
        </div>
        ${meta.counterpartyName ? `<p class="text-xs text-slate-500 mt-1 truncate">${tfEscapeHtml(meta.counterpartyName)}${tfEscapeHtml(meta.gstin ? ' • ' + meta.gstin : '')}</p>` : ''}
        ${amtStr ? `<p class="text-xs font-black font-mono-num text-slate-900 dark:text-white mt-1">${tfEscapeHtml(amtStr)}</p>` : ''}
        ${meta.utrNumber ? `<p class="text-xs font-mono-num text-amber-600 dark:text-amber-400 mt-0.5">UTR: ${tfEscapeHtml(meta.utrNumber)}</p>` : ''}
        <button onclick="app.previewDocument('${tfEscapeHtml(tfEscapeJs(doc.id))}')" class="mt-2 w-full text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1 py-1 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <i data-lucide="eye" class="w-3 h-3"></i> View Bill Copy
        </button>
      </div>`;
    }).join('');

    const uploadBtns = [
      { cat: 'mfg_invoice', label: 'Factory Invoice', icon: 'factory', color: 'text-blue-500' },
      { cat: 'pkg_invoice', label: 'Packaging Bill', icon: 'package', color: 'text-blue-500' },
      { cat: 'transport_bilty', label: 'LR / Bilty', icon: 'truck', color: 'text-purple-500' },
      { cat: 'bank_receipt', label: 'Bank Receipt', icon: 'landmark', color: 'text-amber-500' },
      { cat: 'retailer_invoice', label: 'Buyer Invoice', icon: 'building-2', color: 'text-emerald-500' },
    ].map(b => `<button onclick="app.triggerOrderDocUpload('${tfEscapeHtml(tfEscapeJs(orderId))}', '${tfEscapeHtml(tfEscapeJs(b.cat))}')" class="btn-tactile flex flex-col items-center gap-1 p-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all text-center min-w-[90px]">
      <i data-lucide="${tfEscapeHtml(b.icon)}" class="w-4 h-4 ${tfEscapeHtml(b.color)}"></i>
      <span class="text-xs font-bold leading-tight">${tfEscapeHtml(b.label)}</span>
      <span class="text-xs opacity-60">Upload</span>
    </button>`).join('');

    return `<div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
      <div class="p-4 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <i data-lucide="archive" class="w-4 h-4 text-amber-500"></i>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Attached Invoices &amp; Bank Proofs Vault</h3>
          <span class="px-2 py-0.5 text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded font-mono-num">${tfEscapeHtml(docs.length)} Filed</span>
        </div>
        <span class="text-xs text-slate-400">storage/documents/orders/${tfEscapeHtml(orderId)}/</span>
      </div>
      ${docs.length > 0 ? `<div class="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${docCards}</div>
      <div class="px-4 pb-4"><p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Upload More Bills</p><div class="flex items-center gap-2 flex-wrap">${uploadBtns}</div></div>`
      : `<div class="p-6">
          <p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><i data-lucide="upload-cloud" class="w-4 h-4 text-amber-500"></i> Upload Bills, Receipts &amp; Bank Proofs for this Order</p>
          <div class="flex items-center gap-2 flex-wrap">${uploadBtns}</div>
          <p class="text-xs text-slate-400 mt-3">AI will auto-analyze &amp; extract all fields. You can verify and correct before saving.</p>
        </div>`}
    </div>`;
  }

  // ================= DOCUMENT VAULT & FILE MANAGER CONTROLLER =================
  openVaultTab(category = 'all') {
    let tab = (this.openTabs || []).find(t => t.id === 'tab-vault');
    if (!tab) {
      tab = { id: 'tab-vault', title: 'Document Vault', icon: 'archive', type: 'vault', closeable: true };
      this.openTabs.push(tab);
    }
    this.activeWorkspaceTab = 'tab-vault';
    this.activeTab = 'vault';
    this.vaultFilter = category;
    this.renderWorkspaceTabs();
    this.updateSidebarUI();
    this.renderActiveView();
  }

  renderVaultView() {
    this.loadVaultFiles();
  }

  async loadVaultFiles() {
    try {
      const resp = await fetch('/api/vault/files');
      if (resp.ok) {
        const data = await resp.json();
        this.vaultFiles = data.files || [];
      } else {
        this.vaultFiles = [];
      }
    } catch (e) {
      console.warn('Failed to load vault files:', e);
      this.vaultFiles = [];
    }

    const files = this.vaultFiles || [];
    const invoiceCount = files.filter(f => f.category === 'invoice').length;
    const excelCount = files.filter(f => f.category === 'excel').length;
    const receiptCount = files.filter(f => f.category === 'receipt').length;

    const elTotal = document.getElementById('vault-total-count');
    const elAll = document.getElementById('vault-count-all');
    const elInv = document.getElementById('vault-count-invoice');
    const elExc = document.getElementById('vault-count-excel');
    const elRec = document.getElementById('vault-count-receipt');

    if (elTotal) elTotal.innerText = `${files.length} Files`;
    if (elAll) elAll.innerText = files.length;
    if (elInv) elInv.innerText = invoiceCount;
    if (elExc) elExc.innerText = excelCount;
    if (elRec) elRec.innerText = receiptCount;

    this.renderVaultTable();
  }

  setVaultCategoryFilter(category) {
    this.vaultFilter = category;
    document.querySelectorAll('.vault-filter-btn').forEach(btn => {
      const match = btn.getAttribute('data-vault-filter') === category;
      btn.classList.toggle('bg-blue-600', match);
      btn.classList.toggle('text-white', match);
      btn.classList.toggle('shadow-xs', match);
      btn.classList.toggle('bg-slate-100', !match);
      btn.classList.toggle('text-slate-600', !match);
    });
    this.renderVaultTable();
  }

  filterVaultFiles(query) {
    this.vaultSearchQuery = (query || '').toLowerCase().trim();
    this.renderVaultTable();
  }

  renderVaultTable() {
    const tbody = document.getElementById('vault-table-body');
    if (!tbody) return;

    let files = this.vaultFiles || [];
    const filter = this.vaultFilter || 'all';

    if (filter !== 'all') {
      files = files.filter(f => f.category === filter);
    }

    if (this.vaultSearchQuery) {
      const q = this.vaultSearchQuery;
      files = files.filter(f => 
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.orderRef && f.orderRef.toLowerCase().includes(q)) ||
        (f.partyName && f.partyName.toLowerCase().includes(q))
      );
    }

    if (files.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-12 text-slate-400">
            <i data-lucide="folder-search" class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600"></i>
            <p class="text-xs font-semibold">No files match your search or filter.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = files.map(f => {
      const isPdf = f.name.toLowerCase().endsWith('.pdf');
      const isXlsx = f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls');
      let icon = '<i data-lucide="file" class="w-4 h-4 text-slate-400"></i>';
      if (isPdf) icon = '<i data-lucide="file-text" class="w-4 h-4 text-rose-500"></i>';
      if (isXlsx) icon = '<i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-500"></i>';
      if (f.category === 'receipt') icon = '<i data-lucide="receipt" class="w-4 h-4 text-purple-500"></i>';

      const sizeStr = f.sizeFormatted || (f.size ? `${(f.size / 1024).toFixed(1)} KB` : (f.sizeBytes ? `${(f.sizeBytes / 1024).toFixed(1)} KB` : '—'));
      const modStr = f.modified ? this.formatDate(f.modified) : (f.modifiedAt ? this.formatDate(f.modifiedAt) : '—');

      // Financial Amount color-coding:
      // Green (+ ₹...) for Inward / Customer Payments / Receivables / Buyer Invoices
      // Red (- ₹...) for Outward / Vendor Payments / Factory Advances / Expenses
      let amountBadge = '<span class="text-slate-400 font-mono-num text-xs">—</span>';
      if (f.amountFormatted && f.amountFormatted !== '—') {
        const isOutward = f.direction === 'OUT' || f.amountFormatted.startsWith('-');
        const isInward = f.direction === 'IN' || f.amountFormatted.startsWith('+');
        if (isOutward) {
          amountBadge = `<span class="inline-flex items-center gap-1 font-mono-num font-bold text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200/80 dark:border-rose-800/60 shadow-2xs">${tfEscapeHtml(f.amountFormatted)}</span>`;
        } else if (isInward) {
          amountBadge = `<span class="inline-flex items-center gap-1 font-mono-num font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">${tfEscapeHtml(f.amountFormatted)}</span>`;
        } else {
          amountBadge = `<span class="inline-flex items-center gap-1 font-mono-num font-bold text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">${tfEscapeHtml(f.amountFormatted)}</span>`;
        }
      }

      return `
        <tr onclick="app.previewVaultFile('${tfEscapeHtml(tfEscapeJs(encodeURIComponent(f.path)))}', '${tfEscapeHtml(tfEscapeJs(f.name))}', '${tfEscapeHtml(tfEscapeJs(f.category))}')" class="hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group/row" title="Click to preview ${tfEscapeHtml(f.name)}">
          <td class="py-3 px-4 overflow-hidden text-ellipsis whitespace-nowrap">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="p-1 rounded bg-slate-100 dark:bg-slate-800 shrink-0">${icon}</span>
              <span class="font-mono text-xs font-bold text-slate-900 dark:text-white truncate group-hover/row:text-blue-600 transition-colors" title="${tfEscapeHtml(f.path)}">${tfEscapeHtml(f.name)}</span>
            </div>
          </td>
          <td class="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
            ${f.orderRef ? `<button onclick="event.stopPropagation(); app.navigateToOrderDetail('${tfEscapeHtml(tfEscapeJs(f.orderRef))}')" class="text-blue-600 dark:text-blue-400 hover:underline font-mono-num">${tfEscapeHtml(f.orderRef)}</button>` : '<span class="text-slate-400">—</span>'}
          </td>
          <td class="py-3 px-3 text-slate-700 dark:text-slate-300 truncate" title="${tfEscapeHtml(f.partyName || '')}">
            ${f.partyName || '<span class="text-slate-400">—</span>'}
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            ${amountBadge}
          </td>
          <td class="py-3 px-3 whitespace-nowrap">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${tfEscapeHtml(f.category === 'invoice' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' : f.category === 'excel' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300')}">
              ${tfEscapeHtml(f.category)}
            </span>
          </td>
          <td class="py-3 px-3 font-mono-num text-slate-500 whitespace-nowrap">${tfEscapeHtml(sizeStr)}</td>
          <td class="py-3 px-3 font-mono-num text-slate-500 whitespace-nowrap">${tfEscapeHtml(modStr)}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="event.stopPropagation(); app.previewVaultFile('${tfEscapeHtml(tfEscapeJs(encodeURIComponent(f.path)))}', '${tfEscapeHtml(tfEscapeJs(f.name))}', '${tfEscapeHtml(tfEscapeJs(f.category))}')" class="btn-tactile px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1" title="Preview / Open Document">
                <i data-lucide="eye" class="w-3 h-3 text-blue-500"></i>
                <span>Open</span>
              </button>
              <button onclick="event.stopPropagation(); app.openFileInExplorer('${tfEscapeHtml(tfEscapeJs(encodeURIComponent(f.path)))}')" class="btn-tactile p-1 text-slate-400 hover:text-emerald-700 rounded" title="Reveal ${tfEscapeHtml(f.name)} in Windows Explorer">
                <i data-lucide="folder-open" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
    this.enableTableResizing('vault-files-table');
  }

  enableTableResizing(tableId) {
    const table = typeof tableId === 'string' ? document.getElementById(tableId) : tableId;
    if (!table || table.dataset.resizingEnabled === 'true') return;
    table.dataset.resizingEnabled = 'true';

    const thElements = table.querySelectorAll('thead th');
    thElements.forEach((th) => {
      let resizer = th.querySelector('.tf-col-resizer');
      if (!resizer && !th.classList.contains('text-right')) {
        resizer = document.createElement('div');
        resizer.className = 'tf-col-resizer';
        resizer.title = 'Drag to stretch column';
        th.classList.add('tf-resizable-th');
        th.appendChild(resizer);
      }
      if (!resizer) return;

      let startX = 0;
      let startWidth = 0;
      let isDragging = false;

      const onMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.pageX;
        startWidth = th.offsetWidth;
        isDragging = true;
        resizer.classList.add('is-resizing');
        document.body.classList.add('tf-resizing-columns');

        const onMouseMove = (ev) => {
          if (!isDragging) return;
          const diff = ev.pageX - startX;
          const minW = parseInt(th.style.minWidth || '60', 10);
          const newWidth = Math.max(minW, startWidth + diff);
          th.style.width = `${newWidth}px`;
        };

        const onMouseUp = () => {
          isDragging = false;
          resizer.classList.remove('is-resizing');
          document.body.classList.remove('tf-resizing-columns');
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      };

      resizer.addEventListener('mousedown', onMouseDown);
    });
  }

  openStudioMetricsDrilldownModal(tab = 'all_time') {
    return this.openStudioMetricsDrilldown(tab);
  }

  async reindexVaultFiles() {
    this.showToast('Scanning directories for newly dropped files...');
    try {
      const resp = await fetch('/api/vault/reindex', { method: 'POST' });
      if (resp.ok) {
        const res = await resp.json();
        this.showToast(`Vault re-indexed! ${res.newlyIndexed || 0} new documents recorded.`);
        this.loadVaultFiles();
      } else {
        this.showToast('Vault re-index failed.');
      }
    } catch (e) {
      console.warn('Reindex error:', e);
      this.showToast('Vault re-index network error.');
    }
  }

  openActiveVaultFileInExplorer() {
    if (this.activeVaultFilePath) {
      this.openFileInExplorer(this.activeVaultFilePath);
    } else {
      this.openNativeFolder('root');
    }
  }

  async previewVaultFile(encodedPath, fileName, category) {
    const rawPath = decodeURIComponent(encodedPath);
    this.activeVaultFilePath = rawPath;
    const modal = document.getElementById('vault-document-viewer-modal');
    if (!modal) {
      window.open(`/api/documents/preview?path=${encodeURIComponent(rawPath)}`, '_blank');
      return;
    }

    const titleEl = document.getElementById('vdv-title');
    const subEl = document.getElementById('vdv-sub');
    const catBadge = document.getElementById('vdv-category-badge');
    const sizeBadge = document.getElementById('vdv-size-badge');
    const downloadBtn = document.getElementById('vdv-download-btn');
    const mediaContainer = document.getElementById('vdv-media-container');
    const excelContainer = document.getElementById('vdv-excel-container');
    const zoomControls = document.getElementById('vdv-zoom-controls');

    if (titleEl) titleEl.textContent = fileName || 'Document';
    if (subEl) subEl.textContent = rawPath;
    if (catBadge) catBadge.textContent = (category || 'file').toUpperCase();

    const isExcel = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const isImg = /\.(png|jpe?g|webp|gif)$/i.test(fileName);
    const fileUrl = `/api/documents/preview?path=${encodeURIComponent(rawPath)}`;

    const openTabBtn = document.getElementById('vdv-open-tab-btn');
    if (openTabBtn) {
      openTabBtn.onclick = () => window.open(fileUrl, '_blank');
    }

    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = tfSafeUrl(fileUrl);
        a.download = fileName || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
    }

    this.vaultViewerZoom = 1.0;
    this.resetVaultViewerZoom();

    // Content-adaptive default dimensions: 840px width for portrait A4 PDFs & images (no empty lateral void), wide for Excel
    const panel = document.getElementById('vdv-modal-panel') || modal.querySelector('.tf-draggable-window') || modal.firstElementChild;
    if (panel) {
      if (isExcel) {
        panel.style.width = '96vw';
        panel.style.height = '94vh';
        panel.style.maxWidth = '98vw';
      } else {
        panel.style.width = '840px';
        panel.style.height = '88vh';
        panel.style.maxWidth = '96vw';
        panel.style.maxHeight = '94vh';
      }
    }

    if (isExcel) {
      if (mediaContainer) mediaContainer.classList.add('hidden');
      if (excelContainer) excelContainer.classList.remove('hidden');
      if (zoomControls) zoomControls.classList.add('hidden');
      await this.loadExcelPreviewInVault(rawPath);
    } else {
      if (excelContainer) excelContainer.classList.add('hidden');
      if (mediaContainer) {
        mediaContainer.classList.remove('hidden');
        if (isPdf) {
          try {
            await this.renderPdfDocument(fileUrl, mediaContainer, zoomControls);
          } catch (e) {
            console.warn('PDF.js render failed, falling back to iframe:', e);
            mediaContainer.innerHTML = `<iframe id="vdv-viewport-frame" src="${tfEscapeHtml(tfSafeUrl(fileUrl))}" class="w-full h-full rounded border border-slate-700 bg-white" style="min-height: 80vh;"></iframe>`;
          }
        } else if (isImg) {
          mediaContainer.innerHTML = `<div id="vdv-zoom-target" class="transition-transform duration-150 origin-top flex items-center justify-center p-4"><img src="${tfEscapeHtml(tfSafeUrl(fileUrl))}" class="max-w-full max-h-[85vh] rounded shadow border border-slate-700 object-contain"></div>`;
        } else {
          mediaContainer.innerHTML = `<iframe id="vdv-viewport-frame" src="${tfEscapeHtml(tfSafeUrl(fileUrl))}" class="w-full h-full rounded border border-slate-700 bg-white" style="min-height: 80vh;"></iframe>`;
        }
      }
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeVaultDocumentViewer() {
    const modal = document.getElementById('vault-document-viewer-modal');
    if (modal) modal.classList.add('hidden');
    const mediaContainer = document.getElementById('vdv-media-container');
    if (mediaContainer) mediaContainer.innerHTML = tfSanitizeHtml('');
    const panel = document.getElementById('vdv-modal-panel');
    if (panel) {
      panel.style.transform = '';
      delete panel.dataset.dragX;
      delete panel.dataset.dragY;
    }
  }

  zoomVaultViewer(delta) {
    this.vaultViewerZoom = Math.max(0.4, Math.min(3.0, (this.vaultViewerZoom || 1.0) + delta));
    const target = document.getElementById('vdv-zoom-target') || document.getElementById('vdv-viewport-frame');
    if (target) target.style.transform = `scale(${this.vaultViewerZoom})`;
    const lbl = document.getElementById('vdv-zoom-level');
    if (lbl) lbl.textContent = `${Math.round(this.vaultViewerZoom * 100)}%`;
  }

  resetVaultViewerZoom() {
    this.vaultViewerZoom = 1.0;
    const target = document.getElementById('vdv-zoom-target') || document.getElementById('vdv-viewport-frame');
    if (target) target.style.transform = 'scale(1)';
    const lbl = document.getElementById('vdv-zoom-level');
    if (lbl) lbl.textContent = '100%';
  }

  async loadExcelPreviewInVault(filePath) {
    const tabs = document.getElementById('vdv-excel-tabs');
    const table = document.getElementById('vdv-excel-table');
    const countEl = document.getElementById('vdv-excel-row-count');
    if (table) table.innerHTML = '<tr><td class="p-8 text-center text-slate-400">Loading spreadsheet data...</td></tr>';
    
    try {
      const resp = await fetch('/api/vault/excel-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        if (table) table.innerHTML = `<tr><td class="p-8 text-center text-rose-500">Failed to load Excel sheet: ${tfEscapeHtml(data.error || 'Unknown error')}</td></tr>`;
        return;
      }
      this.currentExcelData = data.sheets;
      const sheetNames = Object.keys(data.sheets || {});
      if (!sheetNames.length) {
        if (table) table.innerHTML = '<tr><td class="p-8 text-center text-slate-400">Empty workbook</td></tr>';
        return;
      }

      if (tabs) {
        tabs.innerHTML = sheetNames.map((name, i) => `
          <button type="button" onclick="app.switchExcelSheet('${tfEscapeHtml(tfEscapeJs(name))}')" class="vdv-sheet-tab px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${tfEscapeHtml(i === 0 ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100')}">
            ${tfEscapeHtml(name)} (${tfEscapeHtml((data.sheets[name] || []).length)})
          </button>
        `).join('');
      }

      this.switchExcelSheet(sheetNames[0]);
    } catch (e) {
      if (table) table.innerHTML = `<tr><td class="p-8 text-center text-rose-500">Error reading Excel file: ${tfEscapeHtml(e.message)}</td></tr>`;
    }
  }

  switchExcelSheet(sheetName) {
    document.querySelectorAll('.vdv-sheet-tab').forEach(b => {
      const active = b.textContent.includes(sheetName);
      b.className = `vdv-sheet-tab px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${active ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'}`;
    });
    this.activeSheetName = sheetName;
    const rows = (this.currentExcelData && this.currentExcelData[sheetName]) || [];
    this.renderExcelRows(rows);
  }

  renderExcelRows(rows) {
    const table = document.getElementById('vdv-excel-table');
    const countEl = document.getElementById('vdv-excel-row-count');
    if (!table) return;
    if (countEl) countEl.textContent = `Showing ${rows.length} rows`;
    if (!rows.length) {
      table.innerHTML = '<tr><td class="p-8 text-center text-slate-400">Sheet is empty</td></tr>';
      return;
    }
    const headers = Object.keys(rows[0] || {});
    let html = `<thead><tr class="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 sticky top-0 border-b border-slate-300 dark:border-slate-700">`;
    headers.forEach(h => {
      html += `<th class="p-2.5 px-3 font-bold text-xs uppercase tracking-wider whitespace-nowrap">${tfEscapeHtml(h)}</th>`;
    });
    html += `</tr></thead><tbody>`;
    rows.forEach((row, idx) => {
      const bg = idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-950/60';
      html += `<tr class="${tfEscapeHtml(bg)} border-b border-slate-200 dark:border-slate-800/80 hover:bg-amber-500/10 transition-colors">`;
      headers.forEach(h => {
        const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
        html += `<td class="p-2 px-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">${tfEscapeHtml(val)}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody>`;
    table.innerHTML = html;
  }

  filterExcelPreviewRows(q) {
    if (!this.currentExcelData || !this.activeSheetName) return;
    const allRows = this.currentExcelData[this.activeSheetName] || [];
    if (!q || !q.trim()) {
      this.renderExcelRows(allRows);
      return;
    }
    const query = q.toLowerCase().trim();
    const filtered = allRows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(query)));
    this.renderExcelRows(filtered);
  }

  togglePaymentProofPreviewFrame() {
    const container = document.getElementById('payment-preview-container');
    if (container) container.classList.toggle('hidden');
  }
});
