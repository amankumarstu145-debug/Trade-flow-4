// TradeFlow: Tax invoice window. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // ================= EDITABLE GST TAX INVOICE & MULTI-DOCUMENT ENGINE =================
  switchInvoiceDocumentType(docType) {
    if (!this.invoiceDraftData && !this.currentInvoiceOrder) return;
    const order = this.invoiceDraftData || this.currentInvoiceOrder;
    order.documentType = docType;
    if (this.currentInvoiceOrder) {
      this.currentInvoiceOrder.documentType = docType;
    }

    // Update Tab Buttons UI with bold high-contrast styling (never dim or cut off)
    const tabs = [
      { id: 'doc-tab-tax', type: 'TAX INVOICE' },
      { id: 'doc-tab-proforma', type: 'PROFORMA INVOICE' },
      { id: 'doc-tab-advance', type: 'ADVANCE RECEIPT VOUCHER' },
      { id: 'doc-tab-challan', type: 'DELIVERY CHALLAN' },
      { id: 'doc-tab-credit', type: 'CREDIT NOTE' }
    ];

    tabs.forEach(t => {
      const el = document.getElementById(t.id);
      if (!el) return;
      if (t.type === docType) {
        el.className = 'btn-tactile px-3.5 py-1.5 rounded-lg font-black text-xs bg-amber-400 text-slate-950 flex items-center gap-1.5 whitespace-nowrap shadow-md border-2 border-amber-300 ring-2 ring-amber-400/30';
      } else {
        el.className = 'btn-tactile px-3.5 py-1.5 rounded-lg font-bold text-xs bg-white dark:bg-slate-700/90 text-slate-700 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-600 flex items-center gap-1.5 whitespace-nowrap border border-slate-300 dark:border-slate-600 shadow-2xs';
      }
    });

    const titleEl = document.getElementById('invoice-modal-title');
    const subtitleEl = document.getElementById('invoice-modal-subtitle');
    const badgeEl = document.getElementById('invoice-modal-badge');

    if (docType === 'TAX INVOICE') {
      if (titleEl) titleEl.innerText = 'GST Tax Invoice';
      if (subtitleEl) subtitleEl.innerText = 'Sec 31 CGST Act & Rule 46 • Final Dispatch & Supply';
      if (badgeEl) {
        badgeEl.innerText = 'Official Final';
        badgeEl.className = 'px-2 py-0.5 text-xs font-black uppercase tracking-wider rounded bg-amber-400 text-slate-950';
      }
    } else if (docType === 'PROFORMA INVOICE') {
      if (titleEl) titleEl.innerText = 'Proforma Invoice';
      if (subtitleEl) subtitleEl.innerText = 'Commercial Quotation & Order Booking Request • Advance Demand';
      if (badgeEl) {
        badgeEl.innerText = 'Quotation';
        badgeEl.className = 'px-2 py-0.5 text-xs font-black uppercase tracking-wider rounded bg-blue-500 text-white';
      }
    } else if (docType === 'ADVANCE RECEIPT VOUCHER') {
      if (titleEl) titleEl.innerText = 'Advance Receipt Voucher';
      if (subtitleEl) subtitleEl.innerText = 'Rule 50 CGST Rules & Sec 31(3)(d) • Payment Acknowledgment';
      if (badgeEl) {
        badgeEl.innerText = 'Rule 50 Voucher';
        badgeEl.className = 'px-2 py-0.5 text-xs font-black uppercase tracking-wider rounded bg-emerald-500 text-white';
      }
    } else if (docType === 'DELIVERY CHALLAN') {
      if (titleEl) titleEl.innerText = 'Job Work Delivery Challan';
      if (subtitleEl) subtitleEl.innerText = 'Rule 55 CGST Rules & Sec 143 • Movement of Jars/Labels to Factory';
      if (badgeEl) {
        badgeEl.innerText = 'Rule 55 Job Work';
        badgeEl.className = 'px-2 py-0.5 text-xs font-black uppercase tracking-wider rounded bg-rose-500 text-white';
      }
    } else if (docType === 'CREDIT NOTE') {
      if (titleEl) titleEl.innerText = 'GST Credit Note';
      if (subtitleEl) subtitleEl.innerText = 'Sec 34 CGST Act & Rule 53 • Transit Damage & Leakage Adjustment';
      if (badgeEl) {
        badgeEl.innerText = 'Sec 34 Credit';
        badgeEl.className = 'px-2 py-0.5 text-xs font-black uppercase tracking-wider rounded bg-amber-400 text-slate-950';
      }
    }

    this.renderInvoiceContent();
  }

  openInvoiceModal(orderId) {
    return this.openInvoiceStudioModal(orderId);
  }

  toggleInvoiceMaximize() {
    const panel = document.getElementById('invoice-modal-panel');
    const maxIcon = document.getElementById('invoice-maximize-icon');
    if (!panel) return;

    this.isInvoiceMaximized = !this.isInvoiceMaximized;

    if (this.isInvoiceMaximized) {
      panel.dataset.prevWidth = panel.style.width || panel.offsetWidth + 'px';
      panel.dataset.prevHeight = panel.style.height || panel.offsetHeight + 'px';

      panel.style.width = '98vw';
      panel.style.height = '96vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'minimize-2');
    } else {
      panel.style.width = panel.dataset.prevWidth || '980px';
      panel.style.height = panel.dataset.prevHeight || '92vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'maximize-2');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  toggleOrderModalMaximize() {
    const panel = document.getElementById('new-order-modal-panel');
    const maxBtn = document.getElementById('order-modal-maximize-btn');
    if (!panel) return;

    this.isOrderModalMaximized = !this.isOrderModalMaximized;

    if (this.isOrderModalMaximized) {
      panel.dataset.prevWidth = panel.style.width || panel.offsetWidth + 'px';
      panel.dataset.prevHeight = panel.style.height || panel.offsetHeight + 'px';

      panel.style.width = '98vw';
      panel.style.height = '96vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';

      if (maxBtn) maxBtn.innerHTML = '<i data-lucide="minimize-2" class="w-4 h-4"></i>';
    } else {
      panel.style.width = panel.dataset.prevWidth || '1080px';
      panel.style.height = panel.dataset.prevHeight || '92vh';
      panel.style.maxWidth = '96vw';
      panel.style.maxHeight = '96vh';

      if (maxBtn) maxBtn.innerHTML = '<i data-lucide="maximize-2" class="w-4 h-4"></i>';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  toggleFactoryPOMaximize() {
    const panel = document.getElementById('factory-po-modal-panel');
    if (!panel) return;

    this.isFactoryPOMaximized = !this.isFactoryPOMaximized;

    if (this.isFactoryPOMaximized) {
      panel.dataset.prevWidth = panel.style.width || panel.offsetWidth + 'px';
      panel.dataset.prevHeight = panel.style.height || panel.offsetHeight + 'px';

      panel.style.width = '98vw';
      panel.style.height = '96vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';
    } else {
      panel.style.width = panel.dataset.prevWidth || '1000px';
      panel.style.height = panel.dataset.prevHeight || '92vh';
      panel.style.maxWidth = '96vw';
      panel.style.maxHeight = '96vh';
    }

    if (window.lucide) window.lucide.createIcons();
  }

  togglePaymentModalMaximize() {
    const panel = document.getElementById('payment-modal-panel');
    const maxIcon = document.getElementById('payment-maximize-icon');
    if (!panel) return;

    this.isPaymentModalMaximized = !this.isPaymentModalMaximized;

    if (this.isPaymentModalMaximized) {
      panel.dataset.prevWidth = panel.style.width || panel.offsetWidth + 'px';
      panel.dataset.prevHeight = panel.style.height || panel.offsetHeight + 'px';

      panel.style.width = '98vw';
      panel.style.height = '96vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'minimize-2');
    } else {
      panel.style.width = panel.dataset.prevWidth || '1040px';
      panel.style.height = panel.dataset.prevHeight || '92vh';
      panel.style.maxWidth = '96vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'maximize-2');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  toggleDocPreviewMaximize() {
    const panel = document.getElementById('dvm-panel');
    const maxIcon = document.getElementById('dvm-maximize-icon');
    if (!panel) return;

    this.isDocPreviewMaximized = !this.isDocPreviewMaximized;

    if (this.isDocPreviewMaximized) {
      panel.dataset.prevWidth = panel.style.width || panel.offsetWidth + 'px';
      panel.dataset.prevHeight = panel.style.height || panel.offsetHeight + 'px';

      panel.style.width = '98vw';
      panel.style.height = '96vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'minimize-2');
    } else {
      panel.style.width = panel.dataset.prevWidth || '1040px';
      panel.style.height = panel.dataset.prevHeight || '90vh';
      panel.style.maxWidth = '96vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'maximize-2');
    }

    if (window.lucide) window.lucide.createIcons();
    if (this.dvmState && this.dvmState.pdfDoc) {
      setTimeout(() => this.renderDvmPage(this.dvmState.pageNum), 100);
    }
  }

  toggleDocReviewMaximize() {
    const panel = document.getElementById('document-review-modal-panel');
    const maxIcon = document.getElementById('doc-review-maximize-icon');
    if (!panel) return;

    this.isDocReviewMaximized = !this.isDocReviewMaximized;

    if (this.isDocReviewMaximized) {
      panel.dataset.prevWidth = panel.style.width || panel.offsetWidth + 'px';
      panel.dataset.prevHeight = panel.style.height || panel.offsetHeight + 'px';

      panel.style.width = '98vw';
      panel.style.height = '96vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'minimize-2');
    } else {
      panel.style.width = panel.dataset.prevWidth || '1120px';
      panel.style.height = panel.dataset.prevHeight || '94vh';
      panel.style.maxWidth = '96vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'maximize-2');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  toggleProfitCalculatorMaximize() {
    const panel = document.getElementById('profit-calculator-modal-panel');
    const maxIcon = document.getElementById('calc-maximize-icon');
    if (!panel) return;

    this.isCalcMaximized = !this.isCalcMaximized;

    if (this.isCalcMaximized) {
      panel.dataset.prevWidth = panel.style.width || panel.offsetWidth + 'px';
      panel.dataset.prevHeight = panel.style.height || 'auto';

      panel.style.width = '98vw';
      panel.style.height = '96vh';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '96vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'minimize-2');
    } else {
      panel.style.width = panel.dataset.prevWidth || '1320px';
      panel.style.height = 'auto';
      panel.style.maxWidth = '98vw';
      panel.style.maxHeight = '94vh';

      if (maxIcon) maxIcon.setAttribute('data-lucide', 'maximize-2');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  attachModalResizer(panelId, brId, blId, rId, bId, minW = 540, minH = 440, storageKey = null) {
    const panel = document.getElementById(panelId);
    const handleBR = document.getElementById(brId);
    const handleBL = document.getElementById(blId);
    const handleR = document.getElementById(rId);
    const handleB = document.getElementById(bId);

    if (!panel) return;

    let isResizing = false;
    let currentHandle = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;

    const onMouseDown = (e, handle) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      currentHandle = handle;

      const pointerEvent = e.touches ? e.touches[0] : e;
      startX = pointerEvent.clientX;
      startY = pointerEvent.clientY;

      const rect = panel.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;

      document.body.style.userSelect = 'none';
      if (handle === 'br') document.body.style.cursor = 'se-resize';
      else if (handle === 'bl') document.body.style.cursor = 'sw-resize';
      else if (handle === 'r') document.body.style.cursor = 'e-resize';
      else if (handle === 'b') document.body.style.cursor = 's-resize';

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('touchmove', onMouseMove, { passive: false });
      window.addEventListener('mouseup', onMouseUp, { once: true });
      window.addEventListener('touchend', onMouseUp, { once: true });
    };

    const onMouseMove = (e) => {
      if (!isResizing) return;
      if (e.cancelable) e.preventDefault();

      const pointerEvent = e.touches ? e.touches[0] : e;
      const dx = pointerEvent.clientX - startX;
      const dy = pointerEvent.clientY - startY;

      const maxW = window.innerWidth * 0.98;
      const maxH = window.innerHeight * 0.96;

      if (currentHandle === 'br' || currentHandle === 'r') {
        const newW = Math.max(minW, Math.min(maxW, startWidth + dx));
        panel.style.width = newW + 'px';
        panel.style.maxWidth = 'none';
      }
      if (currentHandle === 'bl') {
        const newW = Math.max(minW, Math.min(maxW, startWidth - dx * 2));
        panel.style.width = newW + 'px';
        panel.style.maxWidth = 'none';
      }
      if (currentHandle === 'br' || currentHandle === 'bl' || currentHandle === 'b') {
        const newH = Math.max(minH, Math.min(maxH, startHeight + dy));
        panel.style.height = newH + 'px';
        panel.style.maxHeight = 'none';
      }
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;
      currentHandle = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      if (storageKey) {
        const rect = panel.getBoundingClientRect();
        localStorage.setItem(`${storageKey}_w`, Math.round(rect.width));
        localStorage.setItem(`${storageKey}_h`, Math.round(rect.height));
      }
    };

    if (handleBR) {
      handleBR.addEventListener('mousedown', (e) => onMouseDown(e, 'br'));
      handleBR.addEventListener('touchstart', (e) => onMouseDown(e, 'br'), { passive: false });
    }
    if (handleBL) {
      handleBL.addEventListener('mousedown', (e) => onMouseDown(e, 'bl'));
      handleBL.addEventListener('touchstart', (e) => onMouseDown(e, 'bl'), { passive: false });
    }
    if (handleR) {
      handleR.addEventListener('mousedown', (e) => onMouseDown(e, 'r'));
    }
    if (handleB) {
      handleB.addEventListener('mousedown', (e) => onMouseDown(e, 'b'));
    }
  }

  initModalResizer() {
    this.attachModalResizer(
      'invoice-modal-panel', 
      'invoice-resize-handle-br', 
      'invoice-resize-handle-bl', 
      'invoice-resize-handle-r', 
      'invoice-resize-handle-b', 
      540, 440, 'tradeflow_invoice_modal'
    );

    this.attachModalResizer(
      'new-order-modal-panel', 
      'order-resize-handle-br', 
      'order-resize-handle-bl', 
      'order-resize-handle-r', 
      'order-resize-handle-b', 
      640, 480, 'tradeflow_order_modal'
    );

    this.attachModalResizer(
      'factory-po-modal-panel', 
      'po-resize-handle-br', 
      'po-resize-handle-bl', 
      'po-resize-handle-r', 
      'po-resize-handle-b', 
      640, 480, 'tradeflow_po_modal'
    );

    this.attachModalResizer(
      'profit-calculator-modal-panel', 
      'calc-resize-handle-br', 
      'calc-resize-handle-bl', 
      'calc-resize-handle-r', 
      'calc-resize-handle-b', 
      720, 500, 'tradeflow_calc_modal'
    );

    this.attachModalResizer(
      'invoice-studio-modal-panel', 
      'studio-resize-handle-br', 
      'studio-resize-handle-bl', 
      'studio-resize-handle-r', 
      'studio-resize-handle-b', 
      720, 500, 'tradeflow_studio_modal'
    );

    this.initDraggableAndResizableModals();
    this.initStudioSplitResizer();
  }

  /* ---------- STUDIO PREVIEW DRAG-TO-RESIZE SPLITTER ---------- */
  initStudioSplitResizer() {
    const resizer = document.getElementById('studio-panel-resizer');
    const previewPanel = document.getElementById('studio-preview-panel');
    const workstationBody = document.getElementById('studio-workstation-body');
    if (!resizer || !previewPanel || !workstationBody) return;
    if (resizer.dataset ? resizer.dataset.initialized : resizer._resizerInitialized) return;
    if (resizer.dataset) resizer.dataset.initialized = 'true';
    resizer._resizerInitialized = true;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = previewPanel.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      resizer.classList.add('bg-emerald-600');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dx = startX - e.clientX; // dragging left makes preview wider
      const bodyWidth = workstationBody.getBoundingClientRect().width;
      if (!bodyWidth) return;
      const newWidthPx = startWidth + dx;
      const minPx = bodyWidth * 0.38; // at least 38%
      const maxPx = bodyWidth * 0.65; // at most 65%
      const clampedPx = Math.max(minPx, Math.min(maxPx, newWidthPx));
      const pct = ((clampedPx / bodyWidth) * 100).toFixed(1);
      previewPanel.style.width = `${pct}%`;
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        resizer.classList.remove('bg-emerald-600');
      }
    });
  }

  setStudioValidity(days) {
    if (!this.studioDraftData) return;
    this.studioDraftData.validityDays = days;
    this.studioIsDirty = true;
    const input = document.getElementById('studio-input-validity');
    if (input) input.value = days;
    this.renderStudioEditor();
    this.renderStudioInvoiceContent();
  }

  /* ---------- UNIVERSAL DRAGGABLE & RESIZABLE WINDOW MANAGER ---------- */
  initDraggableAndResizableModals() {
    let activeDrag = null;
    let activeResize = null;

    const onStartDrag = (e) => {
      const header = e.target.closest('.tf-draggable-header');
      if (!header) return;
      if (e.target.closest('button, input, select, textarea, a, .btn-tactile, .btn-close, .modal-window-controls')) {
        return;
      }
      const panel = header.closest('.tf-draggable-window, .resizable-modal-panel') || header.parentElement;
      if (!panel) return;

      const curX = parseFloat(panel.dataset.dragX) || 0;
      const curY = parseFloat(panel.dataset.dragY) || 0;

      activeDrag = {
        panel,
        startX: e.clientX,
        startY: e.clientY,
        startXPos: curX,
        startYPos: curY
      };

      document.body.style.userSelect = 'none';
      header.style.cursor = 'grabbing';
      panel.style.transition = 'none';
    };

    const onStartResize = (e) => {
      const handle = e.target.closest('.tf-window-resize-handle');
      if (!handle) return;
      const panel = handle.closest('.tf-draggable-window, .resizable-modal-panel') || handle.parentElement;
      if (!panel) return;

      const rect = panel.getBoundingClientRect();
      activeResize = {
        panel,
        dir: handle.dataset.resizeDir || 'se',
        startX: e.clientX,
        startY: e.clientY,
        startW: rect.width,
        startH: rect.height
      };

      document.body.style.userSelect = 'none';
      panel.style.transition = 'none';
      e.preventDefault();
      e.stopPropagation();
    };

    const onMove = (e) => {
      if (activeDrag) {
        const dx = e.clientX - activeDrag.startX;
        const dy = e.clientY - activeDrag.startY;
        const newX = activeDrag.startXPos + dx;
        const newY = activeDrag.startYPos + dy;
        activeDrag.panel.style.transform = `translate(${newX}px, ${newY}px)`;
        activeDrag.panel.dataset.dragX = newX;
        activeDrag.panel.dataset.dragY = newY;
      } else if (activeResize) {
        const dx = e.clientX - activeResize.startX;
        const dy = e.clientY - activeResize.startY;
        const dir = activeResize.dir;

        if (dir.includes('e') || dir === 'se') {
          const newW = Math.max(380, Math.min(window.innerWidth * 0.98, activeResize.startW + dx));
          activeResize.panel.style.width = `${newW}px`;
          activeResize.panel.style.maxWidth = '98vw';
        }
        if (dir.includes('s') || dir === 'se') {
          const newH = Math.max(240, Math.min(window.innerHeight * 0.96, activeResize.startH + dy));
          activeResize.panel.style.height = `${newH}px`;
          activeResize.panel.style.maxHeight = '96vh';
        }
      }
    };

    const onUp = () => {
      if (activeDrag) {
        activeDrag.panel.style.transition = '';
        const hdr = activeDrag.panel.querySelector('.tf-draggable-header');
        if (hdr) hdr.style.cursor = '';
        activeDrag = null;
        document.body.style.userSelect = '';
      }
      if (activeResize) {
        activeResize.panel.style.transition = '';
        activeResize = null;
        document.body.style.userSelect = '';
      }
    };

    // Attach both pointer and mouse events for full browser and automation compatibility
    document.addEventListener('pointerdown', (e) => { onStartDrag(e); onStartResize(e); });
    document.addEventListener('mousedown', (e) => {
      if (!activeDrag && !activeResize) { onStartDrag(e); onStartResize(e); }
    });

    window.addEventListener('pointermove', onMove);
    window.addEventListener('mousemove', onMove);

    window.addEventListener('pointerup', onUp);
    window.addEventListener('mouseup', onUp);
  }

  toggleInvoiceEditMode() {
    this.isInvoiceEditMode = !this.isInvoiceEditMode;
    const editToggleBtn = document.getElementById('btn-toggle-invoice-edit');
    const saveSyncBtn = document.getElementById('btn-save-invoice-sync');

    if (this.isInvoiceEditMode) {
      if (editToggleBtn) {
        editToggleBtn.innerHTML = `<i data-lucide="eye" class="w-3.5 h-3.5 text-blue-400"></i><span>View Mode</span>`;
        editToggleBtn.className = 'btn-tactile px-3 py-1.5 text-xs font-bold text-blue-200 bg-blue-900/60 border border-blue-500/50 rounded-lg flex items-center gap-1.5';
      }
      if (saveSyncBtn) saveSyncBtn.classList.remove('hidden');
    } else {
      if (editToggleBtn) {
        editToggleBtn.innerHTML = `<i data-lucide="edit-3" class="w-3.5 h-3.5 text-amber-400"></i><span>Edit Document</span>`;
        editToggleBtn.className = 'btn-tactile px-3 py-1.5 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center gap-1.5';
      }
      if (saveSyncBtn) saveSyncBtn.classList.add('hidden');
    }

    this.renderInvoiceContent();
    if (window.lucide) window.lucide.createIcons();
  }

  renderInvoiceContent() {
    const container = document.getElementById('printable-invoice-container');
    const order = this.invoiceDraftData || this.currentInvoiceOrder;
    const profile = this.data.businessProfile;
    const retailer = this.data.contacts.find(c => c.id === order.retailerId) || {
      name: order.retailerName || '',
      billingAddress: order.billingAddress || '',
      shippingAddress: order.shippingAddress || '',
      gstin: order.retailerGstin || '',
      state: order.retailerState || '',
      stateCode: order.retailerStateCode || ''
    };

    if (!container || !order) return;

    const currentPhone = (retailer && (retailer.whatsappPhone || retailer.phone)) || order.customerPhone || '';
    const waInput = document.getElementById('invoice-whatsapp-phone');
    if (waInput) {
      waInput.value = currentPhone;
    }

    const isEdit = this.isInvoiceEditMode;
    const docType = order.documentType || 'TAX INVOICE';
    const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

    // Common Items Table HTML (For Tax Invoice & Proforma Invoice)
    const itemsHtml = order.items.map((item, idx) => {
      if (isEdit) {
        return `
          <tr class="border-b border-slate-200">
            <td class="py-2 px-2 text-center text-xs font-mono-num text-slate-500">${tfEscapeHtml(idx + 1)}</td>
            <td class="py-2 px-2 text-xs">
              <input type="text" value="${tfEscapeHtml(item.name)}" onchange="app.onInvoiceItemChange(${tfEscapeHtml(idx)}, 'name', this.value)" class="w-full p-1 border border-amber-300 bg-amber-50/40 rounded text-xs font-bold">
              <input type="text" value="${tfEscapeHtml(item.variant)}" onchange="app.onInvoiceItemChange(${tfEscapeHtml(idx)}, 'variant', this.value)" class="w-full p-1 border border-slate-200 rounded text-xs text-slate-500 mt-1">
            </td>
            <td class="py-2 px-2 text-center text-xs font-mono-num">
              <input type="text" inputmode="numeric" value="${tfEscapeHtml(this.itemHsn(item) === '—' ? '' : this.itemHsn(item))}" onchange="app.onInvoiceItemChange(${tfEscapeHtml(idx)}, 'hsn', this.value)" class="w-20 p-1 text-center border border-slate-200 rounded text-xs">
            </td>
            <td class="py-2 px-2 text-right text-xs">
              <input type="number" value="${tfEscapeHtml(item.quantity)}" min="1" onchange="app.onInvoiceItemChange(${tfEscapeHtml(idx)}, 'quantity', this.value)" class="w-24 p-1 text-right border border-amber-300 bg-amber-50/40 rounded font-mono-num font-bold">
            </td>
            <td class="py-2 px-2 text-right text-xs">
              <input type="number" step="0.5" value="${tfEscapeHtml(item.unitRate)}" onchange="app.onInvoiceItemChange(${tfEscapeHtml(idx)}, 'unitRate', this.value)" class="w-20 p-1 text-right border border-amber-300 bg-amber-50/40 rounded font-mono-num font-bold">
            </td>
            <td class="py-2 px-2 text-right text-xs font-mono-num font-bold text-slate-900">${tfEscapeHtml(this.formatCurrency(item.totalAmount))}</td>
          </tr>
        `;
      }

      return `
        <tr class="border-b border-slate-200">
          <td class="py-2.5 px-3 text-center text-xs font-mono-num text-slate-500">${tfEscapeHtml(idx + 1)}</td>
          <td class="py-2.5 px-3 text-xs">
            <span class="font-bold text-slate-900">${tfEscapeHtml(item.name)}</span>
            <span class="text-slate-500 block">${tfEscapeHtml(item.variant)}</span>
          </td>
          <td class="py-2.5 px-3 text-center text-xs font-mono-num">${tfEscapeHtml(this.itemHsn(item))}</td>
          <td class="py-2.5 px-3 text-right text-xs font-mono-num">${tfEscapeHtml(item.quantity.toLocaleString('en-IN'))} Jars</td>
          <td class="py-2.5 px-3 text-right text-xs font-mono-num">${tfEscapeHtml(this.formatCurrency(item.unitRate))}</td>
          <td class="py-2.5 px-3 text-right text-xs font-mono-num font-bold text-slate-900">${tfEscapeHtml(this.formatCurrency(item.totalAmount))}</td>
        </tr>
      `;
    }).join('');

    // Tax Breakup HTML
    let taxBreakupHtml = '';
    if (order.gstType === 'intra') {
      taxBreakupHtml = `
        <div class="flex justify-between py-1 text-xs">
          <span class="text-slate-500">${tfEscapeHtml(this.gstLabels(order, false).cgst)}:</span>
          <span class="font-mono-num font-medium text-slate-800">${tfEscapeHtml(this.formatCurrency(order.cgstAmount))}</span>
        </div>
        <div class="flex justify-between py-1 text-xs">
          <span class="text-slate-500">${tfEscapeHtml(this.gstLabels(order, false).sgst)}:</span>
          <span class="font-mono-num font-medium text-slate-800">${tfEscapeHtml(this.formatCurrency(order.sgstAmount))}</span>
        </div>
      `;
    } else {
      taxBreakupHtml = `
        <div class="flex justify-between py-1 text-xs">
          <span class="text-slate-500">${tfEscapeHtml(this.gstLabels(order, true).igst)}:</span>
          <span class="font-mono-num font-medium text-slate-800">${tfEscapeHtml(this.formatCurrency(order.igstAmount))}</span>
        </div>
      `;
    }

    // Editable Mode Banner
    const editNoticeBanner = isEdit ? `
      <div class="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between text-xs text-amber-900 no-print">
        <span class="flex items-center gap-1.5 font-bold">
          <i data-lucide="edit-3" class="w-4 h-4 text-amber-600"></i>
          Edit Mode Active: You can edit dates, vehicle #, LR #, quantities, rates, and terms.
        </span>
        <span class="text-xs font-medium text-amber-800">Click 'Save & Sync' on the top right when done.</span>
      </div>
    ` : '';

    // ================= SPECIFIC DOCUMENT VIEWS =================

    // 1. ADVANCE RECEIPT VOUCHER VIEW (RULE 50 CGST)
    if (docType === 'ADVANCE RECEIPT VOUCHER') {
      container.innerHTML = `
        <div class="bg-white p-8 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800">
          ${editNoticeBanner}
          <!-- Voucher Header -->
          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div class="flex items-center gap-2">
                <span class="p-2 bg-emerald-600 text-white rounded-lg font-bold text-xl"><i data-lucide="receipt" class="w-6 h-6 inline-block"></i></span>
                <div>
                  <h1 class="text-2xl font-black text-slate-900 tracking-tight">${tfEscapeHtml(profile.brandName)}</h1>
                  <p class="text-xs text-slate-500 font-medium">${tfEscapeHtml(profile.legalName)}</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 mt-2 space-y-0.5">
                <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)}, ${tfEscapeHtml(profile.state)} - ${tfEscapeHtml(profile.pincode)}</p>
                <p><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(profile.gstin)}</span> (State Code: ${tfEscapeHtml(profile.stateCode)})</p>
                <p><strong>FSSAI Lic. No:</strong> <span class="font-mono-num">${tfEscapeHtml(profile.fssai)}</span></p>
              </div>
            </div>

            <div class="text-right">
              <span class="inline-block px-3 py-1.5 bg-emerald-600 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-xs">
                RECEIPT VOUCHER (RULE 50)
              </span>
              <div class="mt-3 space-y-1 text-xs">
                <p><span class="text-slate-500">Voucher No:</span> <strong class="font-mono-num text-sm text-slate-900">ARV-${tfEscapeHtml(order.invoiceNumber)}</strong></p>
                <p><span class="text-slate-500">Voucher Date:</span> <span class="font-mono-num font-semibold">${tfEscapeHtml(this.formatDate(order.customerAdvanceDate || order.date))}</span></p>
                <p><span class="text-slate-500">Against Booking Ref:</span> <span class="font-mono-num font-bold">${tfEscapeHtml(order.invoiceNumber)}</span></p>
              </div>
            </div>
          </div>

          <!-- Received From Details -->
          <div class="my-5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span class="font-bold text-slate-900 uppercase tracking-wider text-xs block mb-1">Received With Thanks From:</span>
            <p class="text-sm font-bold text-slate-900">${tfEscapeHtml(retailer.name)}</p>
            <p class="text-slate-600 mt-0.5">${tfEscapeHtml(retailer.billingAddress)}</p>
            <p class="mt-1"><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(retailer.gstin)}</span> • <strong>State:</strong> ${tfEscapeHtml(retailer.state)} (${tfEscapeHtml(retailer.stateCode)})</p>
          </div>

          <!-- Acknowledgment Certificate Box -->
          <div class="my-6 p-6 bg-emerald-50/80 border-2 border-emerald-500/40 rounded-xl space-y-4">
            <div class="flex items-center justify-between border-b border-emerald-200 pb-3">
              <div>
                <span class="text-xs font-bold text-emerald-900 uppercase tracking-wider">Payment Acknowledgment (Rule 50 CGST Rules)</span>
                <h3 class="text-xl font-black text-emerald-950 mt-0.5">Advance Received: ${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))}</h3>
              </div>
              <span class="px-3 py-1 bg-emerald-600 text-white font-mono-num font-bold text-xs rounded-full">RECEIVED IN FULL</span>
            </div>

            <div class="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span class="text-slate-500 block">Against Intended Supply:</span>
                <p class="text-slate-800 font-semibold mt-1">${tfEscapeHtml(order.items.map(i => `${i.quantity.toLocaleString('en-IN')} Jars of ${i.name} (${i.variant})`).join(', '))}</p>
                <p class="text-slate-500 mt-2">Total Order Valuation: <strong class="font-mono-num text-slate-800">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</strong></p>
              </div>
              <div>
                <span class="text-slate-500 block">Payment Mode & Date:</span>
                <p class="font-semibold text-slate-900">${tfEscapeHtml(order.customerAdvanceMode)} • Cleared on ${tfEscapeHtml(this.formatDate(order.customerAdvanceDate || order.date))}</p>
                <div class="mt-2 p-2 bg-white rounded border border-emerald-200">
                  <span class="text-slate-500 block text-xs">Balance Payable on Delivery:</span>
                  <strong class="font-mono-num text-sm text-rose-600">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</strong>
                </div>
              </div>
            </div>

            <p class="text-xs text-emerald-800 pt-2 border-t border-emerald-200 leading-relaxed">
              <strong>Statutory Compliance Note:</strong> In accordance with Notification No. 66/2017 - Central Tax dated 15th November 2017, registered persons making supply of goods are exempted from payment of tax on receipt of advances. Tax liability shall be discharged upon final Tax Invoice at the time of physical delivery of goods.
            </p>
          </div>

          <!-- Footer Terms & Signatory -->
          <div class="grid grid-cols-2 gap-6 mt-8 pt-4 border-t border-slate-200 text-xs">
            <div>
              <span class="font-bold text-slate-800 uppercase tracking-wider text-xs block mb-1">Bank Clearance Account:</span>
              <p>${tfEscapeHtml(profile.bankName)} • A/C: <span class="font-mono-num font-bold">${tfEscapeHtml(profile.accountNumber)}</span></p>
              <p>IFSC: <span class="font-mono-num">${tfEscapeHtml(profile.ifsc)}</span> • UPI: <span class="font-mono-num text-emerald-700 font-bold">${tfEscapeHtml(profile.upiId)}</span></p>
            </div>
            <div class="text-right flex flex-col justify-end items-end">
              <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
              <div class="h-12"></div>
              <p class="border-t border-slate-400 pt-1 text-xs text-slate-600 font-medium">Authorized Signatory</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // 2. PROFORMA INVOICE VIEW (PRE-DISPATCH QUOTATION & ADVANCE REQUEST)
    if (docType === 'PROFORMA INVOICE') {
      container.innerHTML = `
        <div class="bg-white p-8 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800">
          ${editNoticeBanner}
          
          <div class="mb-4 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-center text-xs text-blue-900 font-semibold">
            PROFORMA INVOICE / ORDER CONFIRMATION — Not a Tax Invoice for Input Tax Credit. Issued for order booking and advance transfer.
          </div>

          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div class="flex items-center gap-2">
                <span class="p-2 bg-blue-600 text-white rounded-lg font-bold text-xl"><i data-lucide="flame" class="w-6 h-6 inline-block"></i></span>
                <div>
                  <h1 class="text-2xl font-black text-slate-900 tracking-tight">${tfEscapeHtml(profile.brandName)}</h1>
                  <p class="text-xs text-slate-500 font-medium">${tfEscapeHtml(profile.legalName)}</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 mt-2 space-y-0.5">
                <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)}, ${tfEscapeHtml(profile.state)} - ${tfEscapeHtml(profile.pincode)}</p>
                <p><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(profile.gstin)}</span></p>
                <p><strong>FSSAI Lic. No:</strong> <span class="font-mono-num">${tfEscapeHtml(profile.fssai)}</span></p>
              </div>
            </div>

            <div class="text-right">
              <span class="inline-block px-3 py-1.5 bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-xs">
                PROFORMA INVOICE
              </span>
              <div class="mt-3 space-y-1.5 text-xs">
                <p><span class="text-slate-500">Proforma No:</span> <strong class="font-mono-num text-sm text-slate-900">PI-${tfEscapeHtml(order.invoiceNumber)}</strong></p>
                <p><span class="text-slate-500">Date:</span> <span class="font-mono-num font-semibold">${tfEscapeHtml(this.formatDate(order.date))}</span></p>
                <p><span class="text-slate-500">Est. Dispatch:</span> <span class="font-semibold text-blue-700">10-14 Days from Advance</span></p>
              </div>
            </div>
          </div>

          <!-- Receiver Details -->
          <div class="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
            <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
              <span class="font-bold text-slate-900 uppercase tracking-wider text-xs block mb-1">Details of Buyer | Quoted To:</span>
              <p class="font-bold text-slate-900 text-sm">${tfEscapeHtml(retailer.name)}</p>
              <p class="text-slate-600 mt-0.5">${tfEscapeHtml(retailer.billingAddress)}</p>
              <p class="mt-1"><strong>Phone:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(currentPhone)}</span></p>
              <p class="mt-1"><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(retailer.gstin)}</span></p>
            </div>
            <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
              <span class="font-bold text-slate-900 uppercase tracking-wider text-xs block mb-1">Destination Godown:</span>
              <p class="font-bold text-slate-900 text-sm">${tfEscapeHtml(retailer.name)}</p>
              <p class="text-slate-600 mt-0.5">${tfEscapeHtml(retailer.shippingAddress)}</p>
              <p class="mt-2 text-slate-500 italic text-xs">Final Tax Invoice and E-Way bill will accompany physical dispatch.</p>
            </div>
          </div>

          <!-- Items Table -->
          <div class="mt-4">
            <table class="w-full border border-slate-200">
              <thead class="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                <tr>
                  <th class="py-2.5 px-3 text-center w-12">#</th>
                  <th class="py-2.5 px-3 text-left">Description of Goods</th>
                  <th class="py-2.5 px-3 text-center">HSN</th>
                  <th class="py-2.5 px-3 text-right">Quantity</th>
                  <th class="py-2.5 px-3 text-right">Rate (₹)</th>
                  <th class="py-2.5 px-3 text-right">Taxable Value (₹)</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>

          <!-- Financials & Booking Advance Demand -->
          <div class="grid grid-cols-2 gap-6 mt-4 pt-3 border-t border-slate-200">
            <div class="text-xs space-y-2">
              <div class="p-3 bg-blue-50/70 border border-blue-200 rounded-lg">
                <span class="font-bold text-blue-900 block mb-1">Bank Details for Booking Advance Transfer:</span>
                <p>Bank: <strong>${tfEscapeHtml(profile.bankName)}</strong></p>
                <p>A/C Name: <strong>${tfEscapeHtml(profile.accountHolder)}</strong></p>
                <p>A/C Number: <strong class="font-mono-num">${tfEscapeHtml(profile.accountNumber)}</strong></p>
                <p>IFSC Code: <strong class="font-mono-num">${tfEscapeHtml(profile.ifsc)}</strong></p>
                <p>UPI ID: <strong class="font-mono-num text-blue-800 font-bold">${tfEscapeHtml(profile.upiId)}</strong></p>
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex justify-between py-1 text-xs">
                <span class="text-slate-500">Taxable Subtotal:</span>
                <span class="font-mono-num font-medium">${tfEscapeHtml(this.formatCurrency(order.taxableSubtotal))}</span>
              </div>
              ${taxBreakupHtml}
              <div class="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold">
                <span>Total Order Valuation:</span>
                <span class="font-mono-num text-base text-slate-900">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
              </div>
              <div class="flex justify-between py-1.5 text-xs text-blue-800 font-bold bg-blue-50 px-2 rounded border border-blue-200">
                <span>Booking Advance Required to Start Bottling:</span>
                <span class="font-mono-num">${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived || Math.round(order.totalInvoiceAmount * this.config().bookingAdvancePct / 100)))}</span>
              </div>
              <div class="flex justify-between py-1 text-xs text-slate-600 font-medium px-2">
                <span>Balance Payable against Dispatch / LR:</span>
                <span class="font-mono-num">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</span>
              </div>
            </div>
          </div>

          <!-- Footer Terms -->
          <div class="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-slate-200 text-xs">
            <div>
              <span class="font-bold text-slate-800 uppercase tracking-wider text-xs block mb-1">Commercial Booking Terms:</span>
              <p class="text-slate-500 text-xs">1. Production and bottling will commence immediately upon advance clearance.<br>2. Final balance payment must be cleared against LR copy before handover at destination godown.<br>3. Final GST Tax Invoice with E-Way Bill will be issued at the time of loading.</p>
            </div>
            <div class="text-right flex flex-col justify-end items-end">
              <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
              <div class="h-12"></div>
              <p class="border-t border-slate-400 pt-1 text-xs text-slate-600 font-medium">Authorized Signatory</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // 3. DELIVERY CHALLAN VIEW (RULE 55 - JOB WORK PACKAGING DISPATCH)
    if (docType === 'DELIVERY CHALLAN') {
      container.innerHTML = `
        <div class="bg-white p-8 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800">
          ${editNoticeBanner}
          
          <div class="mb-4 p-2 bg-rose-600 text-white text-center text-xs font-black uppercase tracking-wider rounded-lg shadow-xs">
            DELIVERY CHALLAN FOR JOB WORK (RULE 55 CGST RULES) — SUPPLY MEANT FOR JOB WORK PURPOSES ONLY - NOT FOR SALE
          </div>

          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div class="flex items-center gap-2">
                <span class="p-2 bg-slate-900 text-white rounded-lg font-bold text-xl"><i data-lucide="package" class="w-6 h-6 inline-block"></i></span>
                <div>
                  <h1 class="text-2xl font-black text-slate-900 tracking-tight">${tfEscapeHtml(profile.brandName)}</h1>
                  <p class="text-xs text-slate-500 font-medium">${tfEscapeHtml(profile.legalName)}</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 mt-2 space-y-0.5">
                <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)}, ${tfEscapeHtml(profile.state)} - ${tfEscapeHtml(profile.pincode)}</p>
                <p><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(profile.gstin)}</span> (Principal / Consignor)</p>
              </div>
            </div>

            <div class="text-right">
              <span class="inline-block px-3 py-1.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-xs">
                DELIVERY CHALLAN
              </span>
              <div class="mt-3 space-y-1.5 text-xs">
                <p><span class="text-slate-500">Challan No:</span> <strong class="font-mono-num text-sm text-slate-900">DC-${tfEscapeHtml(order.invoiceNumber)}</strong></p>
                <p><span class="text-slate-500">Date:</span> <span class="font-mono-num font-semibold">${tfEscapeHtml(this.formatDate(order.date))}</span></p>
                <p><span class="text-slate-500">Purpose:</span> <strong class="text-rose-700">Job Work (Rule 55)</strong></p>
              </div>
            </div>
          </div>

          <!-- Consignor & Consignee Dual Addresses -->
          <div class="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
            <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
              <span class="font-bold text-slate-900 uppercase tracking-wider text-xs block mb-1">Consignor (Principal Owner of Materials):</span>
              <p class="font-bold text-slate-900 text-sm">${tfEscapeHtml(profile.legalName)}</p>
              <p class="text-slate-600 mt-0.5">${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)}, ${tfEscapeHtml(profile.state)}</p>
              <p class="mt-1"><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(profile.gstin)}</span></p>
            </div>
            <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
              <span class="font-bold text-slate-900 uppercase tracking-wider text-xs block mb-1">Consignee (Job Worker / Manufacturer):</span>
              <p class="font-bold text-slate-900 text-sm">${tfEscapeHtml(order.manufacturerName)}</p>
              <p class="text-slate-600 mt-0.5">${tfEscapeHtml((this.data.contacts.find(c => c.id === order.manufacturerId) || {}).billingAddress || 'Address not set')}</p>
              <p class="mt-1"><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml((this.data.contacts.find(c => c.id === order.manufacturerId) || {}).gstin || 'Not set')}</span></p>
            </div>
          </div>

          <!-- Materials Dispatched for Job Work Table -->
          <div class="mt-4">
            <table class="w-full border border-slate-200 text-xs">
              <thead class="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th class="py-2.5 px-3 text-center w-12">#</th>
                  <th class="py-2.5 px-3 text-left">Description of Raw Materials / Packaging Sent</th>
                  <th class="py-2.5 px-3 text-center">HSN</th>
                  <th class="py-2.5 px-3 text-right">Quantity</th>
                  <th class="py-2.5 px-3 text-right">Declared Value for Transport (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-slate-200">
                  <td class="py-2.5 px-3 text-center font-mono-num">1</td>
                  <td class="py-2.5 px-3 font-semibold">Packaging material for ${tfEscapeHtml((order.items || []).map(i => [i.name, i.variant || i.packSize].filter(Boolean).join(' ')).join(', ') || 'this order')}</td>
                  <td class="py-2.5 px-3 text-center font-mono-num">${tfEscapeHtml(order.packagingHsn || '—')}</td>
                  <td class="py-2.5 px-3 text-right font-mono-num">${tfEscapeHtml(totalQty.toLocaleString('en-IN'))} Units</td>
                  <td class="py-2.5 px-3 text-right font-mono-num">${tfEscapeHtml(this.formatCurrency(Number(order.packagingCost) || 0))}</td>
                </tr>
                <tr class="border-b border-slate-200">
                  <td class="py-2.5 px-3 text-center font-mono-num">2</td>
                  <td class="py-2.5 px-3 font-semibold">Outer shipping cartons</td>
                  <td class="py-2.5 px-3 text-center font-mono-num">—</td>
                  <td class="py-2.5 px-3 text-right font-mono-num">${tfEscapeHtml((order.items || []).reduce((s, i) => s + (Number(i.cases) || 0), 0).toLocaleString('en-IN'))} Boxes</td>
                  <td class="py-2.5 px-3 text-right font-mono-num">Included</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Transport Leg 1 Details -->
          <div class="grid grid-cols-2 gap-6 mt-4 pt-3 border-t border-slate-200 text-xs">
            <div class="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span class="font-bold text-slate-800 block mb-1">Dispatch Logistics (Leg 1 - Pkg Supplier to Factory):</span>
              <p>Transporter: <strong>${tfEscapeHtml(order.transporterName || '')}</strong></p>
              ${order.lrNumber ? `<p>LR / Bilty No: <strong class="font-mono-num">${tfEscapeHtml(order.lrNumber)}</strong></p>` : `<p class="text-slate-400 italic">Dispatched directly via packaging supplier fleet</p>`}
              ${order.vehicleNumber ? `<p>Vehicle No: <strong class="font-mono-num">${tfEscapeHtml(order.vehicleNumber)}</strong></p>` : ''}
            </div>
            <div>
              <div class="flex justify-between py-1 text-xs">
                <span class="text-slate-500">Declared Value for Transport:</span>
                <span class="font-mono-num font-bold">${tfEscapeHtml(this.formatCurrency(order.packagingCost))}</span>
              </div>
              <div class="flex justify-between py-1 text-xs text-rose-700 font-semibold bg-rose-50 px-2 rounded">
                <span>Tax Payable on Challan:</span>
                <span class="font-mono-num">NIL (Job Work u/s 143)</span>
              </div>
            </div>
          </div>

          <!-- Statutory Declaration -->
          <div class="mt-4 p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg text-xs text-slate-700 leading-relaxed">
            <strong>Job Work Declaration under Section 143 CGST Act:</strong> It is certified that the packaging materials described above are sent purely for the purpose of job work processing, bottling, induction sealing, and carton packaging of pickles on our behalf. The manufactured pickles shall be returned or dispatched under our instructions as per Rule 55.
          </div>

          <div class="grid grid-cols-2 gap-6 mt-8 pt-4 border-t border-slate-200 text-xs">
            <div>
              <p class="font-bold text-slate-800 text-xs">Factory Gate Receipt Acknowledgment</p>
              <div class="h-12"></div>
              <p class="border-t border-slate-400 pt-1 text-xs text-slate-600 font-medium">Signature & Stamp of Job Worker (Factory)</p>
            </div>
            <div class="text-right flex flex-col justify-end items-end">
              <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
              <div class="h-12"></div>
              <p class="border-t border-slate-400 pt-1 text-xs text-slate-600 font-medium">Authorized Signatory (Consignor)</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // 4. GST CREDIT NOTE VIEW (SECTION 34 - TRANSIT BREAKAGE / OIL LEAKAGE)
    if (docType === 'CREDIT NOTE') {
      const damageTotal = Number(order.damageAmount) || 0;
      const damageRates = this.orderGstRates(order);
      const damageRate = damageRates.length === 1 ? damageRates[0] : this.config().defaultGstRate;
      const damageTaxable = damageTotal / (1 + damageRate / 100);
      const damageGst = damageTotal - damageTaxable;
      const newBalanceDue = Math.max(0, order.customerBalanceDue - damageTotal);

      container.innerHTML = `
        <div class="bg-white p-8 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800">
          ${editNoticeBanner}

          <div class="mb-4 p-2 bg-rose-700 text-white text-center text-xs font-black uppercase tracking-wider rounded-lg shadow-xs">
            GST CREDIT NOTE (ISSUED UNDER SECTION 34 OF CGST ACT, 2017)
          </div>

          <div class="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div>
              <div class="flex items-center gap-2">
                <span class="p-2 bg-rose-600 text-white rounded-lg font-bold text-xl"><i data-lucide="flame" class="w-6 h-6 inline-block"></i></span>
                <div>
                  <h1 class="text-2xl font-black text-slate-900 tracking-tight">${tfEscapeHtml(profile.brandName)}</h1>
                  <p class="text-xs text-slate-500 font-medium">${tfEscapeHtml(profile.legalName)}</p>
                </div>
              </div>
              <div class="text-xs text-slate-600 mt-2 space-y-0.5">
                <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)}, ${tfEscapeHtml(profile.state)} - ${tfEscapeHtml(profile.pincode)}</p>
                <p><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(profile.gstin)}</span> (State Code: ${tfEscapeHtml(profile.stateCode)})</p>
                <p><strong>FSSAI Lic. No:</strong> <span class="font-mono-num">${tfEscapeHtml(profile.fssai)}</span></p>
              </div>
            </div>

            <div class="text-right">
              <span class="inline-block px-3 py-1.5 bg-rose-600 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-xs">
                GST CREDIT NOTE
              </span>
              <div class="mt-3 space-y-1 text-xs">
                <p><span class="text-slate-500">Credit Note No:</span> <strong class="font-mono-num text-sm text-slate-900">CRN-${tfEscapeHtml(order.invoiceNumber)}</strong></p>
                <p><span class="text-slate-500">Credit Note Date:</span> <span class="font-mono-num font-semibold">${tfEscapeHtml(this.formatDate(order.date))}</span></p>
                <p><span class="text-slate-500">Against Tax Invoice:</span> <strong class="font-mono-num text-slate-900">${tfEscapeHtml(order.invoiceNumber)}</strong></p>
                <p><span class="text-slate-500">Original Invoice Date:</span> <span class="font-mono-num">${tfEscapeHtml(this.formatDate(order.date))}</span></p>
              </div>
            </div>
          </div>

          <!-- Recipient Details -->
          <div class="my-5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span class="font-bold text-slate-900 uppercase tracking-wider text-xs block mb-1">Details of Recipient (Customer):</span>
            <p class="text-sm font-bold text-slate-900">${tfEscapeHtml(retailer.name)}</p>
            <p class="text-slate-600 mt-0.5">${tfEscapeHtml(retailer.billingAddress)}</p>
            <p class="mt-1"><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(retailer.gstin)}</span> • <strong>State:</strong> ${tfEscapeHtml(retailer.state)} (${tfEscapeHtml(retailer.stateCode)})</p>
          </div>

          <!-- Deduction Table -->
          <div class="mt-4">
            <table class="w-full border border-slate-200 text-xs">
              <thead class="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th class="py-2.5 px-3 text-center w-12">#</th>
                  <th class="py-2.5 px-3 text-left">Reason & Description of Deduction</th>
                  <th class="py-2.5 px-3 text-center">HSN</th>
                  <th class="py-2.5 px-3 text-right">Taxable Deduction (₹)</th>
                  <th class="py-2.5 px-3 text-right">GST Adjustment</th>
                  <th class="py-2.5 px-3 text-right">Total Credit Value (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b border-slate-200">
                  <td class="py-2.5 px-3 text-center font-mono-num">1</td>
                  <td class="py-2.5 px-3">
                    <strong>Transit Breakage / Seal Leakage Adjustment</strong>
                    <p class="text-slate-500 text-xs mt-0.5">${tfEscapeHtml(order.damageNote || '')}</p>
                  </td>
                  <td class="py-2.5 px-3 text-center font-mono-num">${tfEscapeHtml([...new Set((order.items || []).map(i => this.itemHsn(i)))].join(', ') || '—')}</td>
                  <td class="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">${tfEscapeHtml(this.formatCurrency(damageTaxable))}</td>
                  <td class="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-900">${tfEscapeHtml(this.formatCurrency(damageGst))}</td>
                  <td class="py-2.5 px-3 text-right font-mono-num font-bold text-rose-600">${tfEscapeHtml(this.formatCurrency(damageTotal))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Financial Adjustment Summary -->
          <div class="grid grid-cols-2 gap-6 mt-4 pt-3 border-t border-slate-200 text-xs">
            <div class="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <span class="font-bold text-slate-800 block mb-1">Adjustment Effect on Customer Balance:</span>
              <div class="flex justify-between">
                <span class="text-slate-500">Original Invoice Amount:</span>
                <span class="font-mono-num font-semibold">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
              </div>
              <div class="flex justify-between text-emerald-700">
                <span>Less Advance Paid:</span>
                <span class="font-mono-num font-semibold">-${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))}</span>
              </div>
              <div class="flex justify-between text-rose-600 font-bold border-t border-slate-200 pt-1">
                <span>Less Credit Note Deduction:</span>
                <span class="font-mono-num">-${tfEscapeHtml(this.formatCurrency(damageTotal))}</span>
              </div>
              <div class="flex justify-between text-slate-900 font-black border-t-2 border-slate-800 pt-1 text-sm">
                <span>REVISED BALANCE PAYABLE:</span>
                <span class="font-mono-num text-rose-600">${tfEscapeHtml(this.formatCurrency(newBalanceDue))}</span>
              </div>
            </div>

            <div class="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg text-xs text-slate-700 leading-relaxed">
              <strong>Statutory Effect u/s 34(2) CGST Act:</strong>
              This Credit Note formally reverses the corresponding output tax liability of the supplier and input tax credit claimed by the buyer. It will be reported in Table 9B of GSTR-1 for the relevant tax period.
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6 mt-8 pt-4 border-t border-slate-200 text-xs">
            <div>
              <p class="text-xs text-slate-500 italic">Adjusted in customer ledger balance automatically.</p>
            </div>
            <div class="text-right flex flex-col justify-end items-end">
              <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
              <div class="h-12"></div>
              <p class="border-t border-slate-400 pt-1 text-xs text-slate-600 font-medium">Authorized Signatory</p>
            </div>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // 5. DEFAULT VIEW: OFFICIAL INDIAN GST TAX INVOICE (FINAL DISPATCH)
    container.innerHTML = `
      <div class="bg-white p-8 max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl text-slate-800">
        ${editNoticeBanner}

        <!-- Invoice Header -->
        <div class="flex justify-between items-start border-b-2 border-slate-900 pb-5">
          <div>
            <div class="flex items-center gap-2">
              <span class="p-2 bg-amber-500 text-white rounded-lg font-bold text-xl"><i data-lucide="flame" class="w-6 h-6 inline-block"></i></span>
              <div>
                <h1 class="text-2xl font-black text-slate-900 tracking-tight">${tfEscapeHtml(profile.brandName)}</h1>
                <p class="text-xs text-slate-500 font-medium">${tfEscapeHtml(profile.legalName)}</p>
              </div>
            </div>
            <div class="text-xs text-slate-600 mt-2 space-y-0.5">
              <p>${tfEscapeHtml(profile.address)}, ${tfEscapeHtml(profile.city)}, ${tfEscapeHtml(profile.state)} - ${tfEscapeHtml(profile.pincode)}</p>
              <p><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(profile.gstin)}</span> (State Code: ${tfEscapeHtml(profile.stateCode)})</p>
              <p><strong>FSSAI Lic. No:</strong> <span class="font-mono-num">${tfEscapeHtml(profile.fssai)}</span></p>
              <p><strong>Phone:</strong> ${tfEscapeHtml(profile.phone)} • <strong>Email:</strong> ${tfEscapeHtml(profile.email)}</p>
            </div>
          </div>

          <div class="text-right">
            <span class="inline-block px-3 py-1.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-xs">
              TAX INVOICE
            </span>
            <span class="block text-xs text-slate-400 mt-0.5">Original for Recipient • Sec 31 CGST</span>
            
            <div class="mt-3 space-y-1.5 text-xs">
              <p>
                <span class="text-slate-500">Invoice No:</span>
                ${isEdit ? 
                  `<input type="text" value="${tfEscapeHtml(order.invoiceNumber)}" onchange="app.invoiceDraftData.invoiceNumber = this.value" class="w-28 p-1 border border-amber-300 rounded font-mono-num font-bold text-right text-xs">` : 
                  `<strong class="font-mono-num text-sm text-slate-900">${tfEscapeHtml(order.invoiceNumber)}</strong>`
                }
              </p>
              <p>
                <span class="text-slate-500">Invoice Date:</span>
                ${isEdit ? 
                  `<input type="date" value="${tfEscapeHtml(order.date)}" onchange="app.invoiceDraftData.date = this.value" class="w-32 p-1 border border-amber-300 rounded font-mono-num text-xs">` : 
                  `<span class="font-mono-num font-semibold">${tfEscapeHtml(this.formatDate(order.date))}</span>`
                }
              </p>
              <p>
                <span class="text-slate-500">Payment Terms:</span>
                ${isEdit ? 
                  `<input type="text" value="${tfEscapeHtml(order.paymentTerms)}" onchange="app.invoiceDraftData.paymentTerms = this.value" class="w-32 p-1 border border-amber-300 rounded font-semibold text-xs">` : 
                  `<strong>${tfEscapeHtml(order.paymentTerms)}</strong>`
                }
              </p>
              <p>
                <span class="text-slate-500">Due Date:</span>
                ${isEdit ? 
                  `<input type="date" value="${tfEscapeHtml(order.dueDate)}" onchange="app.invoiceDraftData.dueDate = this.value" class="w-32 p-1 border border-amber-300 rounded font-mono-num text-xs">` : 
                  `<span class="font-mono-num font-semibold">${tfEscapeHtml(this.formatDate(order.dueDate))}</span>`
                }
              </p>
            </div>
          </div>
        </div>

        <!-- Bill To / Ship To Dual Addresses -->
        <div class="grid grid-cols-2 gap-6 py-4 border-b border-slate-200 text-xs">
          <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
            <span class="font-bold text-slate-900 uppercase tracking-wider text-xs block mb-1">Details of Receiver | Billed To:</span>
            <p class="font-bold text-slate-900 text-sm">${tfEscapeHtml(retailer.name)}</p>
            <p class="text-slate-600 mt-0.5">${tfEscapeHtml(retailer.billingAddress)}</p>
            <p class="mt-1"><strong>Phone / WA:</strong> <span class="font-mono-num font-bold text-slate-800">${tfEscapeHtml(currentPhone)}</span></p>
            <p class="mt-1"><strong>GSTIN:</strong> <span class="font-mono-num font-bold">${tfEscapeHtml(retailer.gstin)}</span></p>
            <p><strong>State:</strong> ${tfEscapeHtml(retailer.state)} (Code: ${tfEscapeHtml(retailer.stateCode)})</p>
          </div>

          <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-200/60">
            <span class="font-bold text-slate-900 uppercase tracking-wider text-xs block mb-1">Details of Consignee | Shipped To:</span>
            <p class="font-bold text-slate-900 text-sm">${tfEscapeHtml(retailer.name)}</p>
            <p class="text-slate-600 mt-0.5">${tfEscapeHtml(retailer.shippingAddress)}</p>
            
            <div class="mt-2 space-y-1">
              ${isEdit ? `
                <p>
                  <strong>Transport / LR No:</strong>
                  <input type="text" value="${tfEscapeHtml(order.lrNumber || '')}" placeholder="Leave blank if not dispatched" onchange="app.invoiceDraftData.lrNumber = this.value" class="w-44 p-1 border border-amber-300 rounded font-mono-num font-bold text-xs ml-1">
                </p>
                <p>
                  <strong>Vehicle No:</strong>
                  <input type="text" value="${tfEscapeHtml(order.vehicleNumber || '')}" placeholder="Leave blank if not loaded" onchange="app.invoiceDraftData.vehicleNumber = this.value" class="w-44 p-1 border border-amber-300 rounded font-mono-num font-semibold text-xs ml-1">
                </p>
                <p>
                  <strong>E-Way Bill No:</strong>
                  <input type="text" value="${tfEscapeHtml(order.ewayBillNumber || '')}" placeholder="Mandatory if > ₹50k" onchange="app.invoiceDraftData.ewayBillNumber = this.value" class="w-44 p-1 border border-amber-300 rounded font-mono-num font-semibold text-xs ml-1">
                </p>
              ` : `
                ${order.lrNumber ? `<p><strong>Transport / LR No:</strong> <span class="font-mono-num font-semibold">${tfEscapeHtml(order.lrNumber)}</span> (${tfEscapeHtml(order.transporterName || '')})</p>` : ''}
                ${order.vehicleNumber ? `<p><strong>Vehicle No:</strong> <span class="font-mono-num font-semibold">${tfEscapeHtml(order.vehicleNumber)}</span></p>` : ''}
                ${order.ewayBillNumber ? `<p><strong>E-Way Bill No:</strong> <span class="font-mono-num font-bold text-amber-700">${tfEscapeHtml(order.ewayBillNumber)}</span></p>` : ''}
                ${!order.lrNumber && !order.vehicleNumber ? `<p class="text-slate-400 italic text-xs no-print">Dispatch details not yet assigned</p>` : ''}
              `}
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div class="mt-4">
          <table class="w-full border border-slate-200">
            <thead class="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
              <tr>
                <th class="py-2.5 px-3 text-center w-12">#</th>
                <th class="py-2.5 px-3 text-left">Description of Goods</th>
                <th class="py-2.5 px-3 text-center">HSN</th>
                <th class="py-2.5 px-3 text-right">Quantity</th>
                <th class="py-2.5 px-3 text-right">Rate (₹)</th>
                <th class="py-2.5 px-3 text-right">Taxable Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- FSSAI Food Safety & Batch Details Box -->
          <div class="mt-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-4">
              <div>
                <span class="text-xs text-slate-400 uppercase font-bold block">Batch No:</span>
                ${isEdit ? 
                  `<input type="text" value="${tfEscapeHtml(order.batchNumber || '')}" placeholder="e.g. MNG-26/B1" onchange="app.invoiceDraftData.batchNumber = this.value" class="p-1 border border-amber-300 rounded font-mono-num font-bold text-xs w-28">` : 
                  `<span class="font-mono-num font-bold text-slate-800">${tfEscapeHtml(order.batchNumber || 'Assigned at Bottling')}</span>`
                }
              </div>
              <div>
                <span class="text-xs text-slate-400 uppercase font-bold block">Mfg / Packing Date:</span>
                ${isEdit ? 
                  `<input type="text" value="${tfEscapeHtml(order.mfgDate || '')}" placeholder="e.g. 09/2026" onchange="app.invoiceDraftData.mfgDate = this.value" class="p-1 border border-amber-300 rounded font-mono-num text-xs w-24">` : 
                  `<span class="font-mono-num text-slate-800">${tfEscapeHtml(order.mfgDate || this.formatDate(order.date))}</span>`
                }
              </div>
              <div>
                <span class="text-xs text-slate-400 uppercase font-bold block">Best Before:</span>
                ${isEdit ? 
                  `<input type="text" value="${tfEscapeHtml(order.bestBefore || '12 Months')}" onchange="app.invoiceDraftData.bestBefore = this.value" class="p-1 border border-amber-300 rounded font-medium text-xs w-24">` : 
                  `<span class="font-medium text-slate-800">${tfEscapeHtml(order.bestBefore || '12 Months from Packing')}</span>`
                }
              </div>
            </div>
            <span class="text-xs font-mono-num text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
              FSSAI Lic: ${tfEscapeHtml(profile.fssai)}
            </span>
          </div>
        </div>

        <!-- Tax Breakdown & Totals -->
        <div class="grid grid-cols-2 gap-6 mt-4 pt-3 border-t border-slate-200">
          <div class="text-xs space-y-2">
            <div class="p-3 bg-amber-50/60 border border-amber-200/60 rounded-lg">
              <span class="font-bold text-amber-900 block mb-1">Bank & Payment Settlement:</span>
              <p>Bank: <strong>${tfEscapeHtml(profile.bankName)}</strong></p>
              <p>A/C Name: <strong>${tfEscapeHtml(profile.accountHolder)}</strong></p>
              <p>A/C Number: <strong class="font-mono-num">${tfEscapeHtml(profile.accountNumber)}</strong></p>
              <p>IFSC Code: <strong class="font-mono-num">${tfEscapeHtml(profile.ifsc)}</strong></p>
              <p>UPI ID: <strong class="font-mono-num text-amber-800 font-bold">${tfEscapeHtml(profile.upiId)}</strong></p>
            </div>
            <p class="text-xs text-slate-400">Scan & pay using any UPI app (GPay, PhonePe, Paytm)</p>
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between py-1 text-xs">
              <span class="text-slate-500">Taxable Subtotal:</span>
              <span class="font-mono-num font-medium text-slate-800">${tfEscapeHtml(this.formatCurrency(order.taxableSubtotal))}</span>
            </div>
            ${taxBreakupHtml}
            <div class="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-bold">
              <span class="text-slate-900">Total Invoice Amount:</span>
              <span class="font-mono-num text-base text-slate-900">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
            </div>
            <div class="flex justify-between py-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 rounded">
              <span>Less Advance Received:</span>
              ${isEdit ? 
                `<input type="number" value="${tfEscapeHtml(order.customerAdvanceReceived)}" onchange="app.onInvoiceAdvanceChange(this.value)" class="w-28 p-1 border border-emerald-300 rounded font-mono-num font-bold text-right text-xs">` : 
                `<span class="font-mono-num">${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))}</span>`
              }
            </div>
            <div class="flex justify-between py-1 text-xs text-rose-700 font-bold bg-rose-50 px-2 rounded">
              <span>Balance Due for Settlement:</span>
              <span class="font-mono-num">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</span>
            </div>
          </div>
        </div>

        <!-- Footer Terms & Signature -->
        <div class="grid grid-cols-2 gap-6 mt-6 pt-4 border-t border-slate-200 text-xs">
          <div>
            <span class="font-bold text-slate-800 uppercase tracking-wider text-xs block mb-1">Terms & Conditions:</span>
            ${isEdit ? 
              `<textarea rows="3" onchange="app.invoiceDraftData.customNotes = this.value" class="w-full p-2 border border-slate-300 rounded text-xs font-mono-num">${tfEscapeHtml(order.customNotes || this.defaultInvoiceNotes())}</textarea>` : 
              `<p class="text-slate-500 whitespace-pre-line text-xs">${tfEscapeHtml(order.customNotes || this.defaultInvoiceNotes())}</p>`
            }
          </div>

          <div class="text-right flex flex-col justify-end items-end">
            <p class="font-bold text-slate-800 text-xs">For ${tfEscapeHtml(profile.legalName)}</p>
            <div class="h-14"></div>
            <p class="border-t border-slate-400 pt-1 text-xs text-slate-600 font-medium">Authorized Signatory</p>
          </div>
        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  onInvoiceItemChange(itemIdx, field, value) {
    if (!this.invoiceDraftData || !this.invoiceDraftData.items[itemIdx]) return;
    const item = this.invoiceDraftData.items[itemIdx];

    if (field === 'quantity') item.quantity = parseInt(value) || 0;
    if (field === 'unitRate') item.unitRate = parseFloat(value) || 0;
    if (field === 'name') item.name = value;
    if (field === 'variant') item.variant = value;
    if (field === 'hsn') item.hsn = String(value || '').replace(/\D/g, '').slice(0, 8);
    if (field === 'gstRate') item.gstRate = value === '' ? undefined : Number(value);

    item.totalAmount = item.quantity * item.unitRate;

    // Recalculate whole order taxes
    this.recalculateDraftOrderFinancials();
    this.renderInvoiceContent();
  }

  onInvoiceAdvanceChange(value) {
    if (!this.invoiceDraftData) return;
    this.invoiceDraftData.customerAdvanceReceived = parseFloat(value) || 0;
    this.invoiceDraftData.customerBalanceDue = Math.max(0, this.invoiceDraftData.totalInvoiceAmount - this.invoiceDraftData.customerAdvanceReceived);
    this.renderInvoiceContent();
  }

  recalculateDraftOrderFinancials() {
    const o = this.invoiceDraftData;
    o.items = o.items || [];
    const gst = this.computeGst(o.items, o.gstType !== 'intra');
    o.taxableSubtotal = gst.taxable;
    o.cgstAmount = gst.cgst;
    o.sgstAmount = gst.sgst;
    o.igstAmount = gst.igst;
    o.gstRates = gst.rates;
    o.totalInvoiceAmount = gst.total;
    o.customerAdvanceReceived = Number(o.customerAdvanceReceived) || 0;
    o.customerBalanceDue = Math.max(0, Math.round((o.totalInvoiceAmount - o.customerAdvanceReceived) * 100) / 100);

    // Profit: each line's own unit costs. Lines without a cost add nothing and are flagged, not guessed.
    const costs = this.orderLineCosts(o.items);
    o.manufacturerTotalCost = costs.manufacturing;
    o.packagingCost = costs.packaging;
    o.costsIncomplete = costs.incomplete;
    o.marketeerCommissionAmount = (Number(o.marketeerCommissionRate) || 0) > 0 ? (o.taxableSubtotal * (Number(o.marketeerCommissionRate) / 100)) : 0;
    o.totalDirectCosts = o.manufacturerTotalCost + o.packagingCost + (Number(o.totalTransportCost) || 0) + o.marketeerCommissionAmount;
    o.netProfit = o.taxableSubtotal - o.totalDirectCosts;
    o.profitMarginPercent = o.taxableSubtotal > 0 ? (o.netProfit / o.taxableSubtotal) * 100 : 0;
  }

  // Manufacturing and packaging cost for each line from that line's unit costs (or its product's).
  orderLineCosts(items) {
    let manufacturing = 0, packaging = 0, incomplete = false;
    for (const item of items || []) {
      const qty = Number(item.quantity) || 0;
      const product = (this.data.products || []).find(p => (item.productId && p.id === item.productId) || (item.name && p.name === item.name));
      const mfgUnit = Number(item.baseCostPerUnit ?? product?.baseCostPerUnit ?? product?.baseMfgCost);
      const pkgUnit = Number(item.pkgCostPerUnit ?? product?.pkgCostPerUnit ?? product?.pkgCost);
      if (Number.isFinite(mfgUnit)) manufacturing += qty * mfgUnit; else if (qty) incomplete = true;
      if (Number.isFinite(pkgUnit)) packaging += qty * pkgUnit;
    }
    return { manufacturing, packaging, incomplete };
  }

  saveInvoiceEditsAndSync() {
    if (!this.invoiceDraftData || !this.currentInvoiceOrder) return;

    // Apply draft to original order in data store
    const idx = this.data.orders.findIndex(o => o.id === this.currentInvoiceOrder.id);
    if (idx !== -1) {
      this.data.orders[idx] = JSON.parse(JSON.stringify(this.invoiceDraftData));
      this.currentInvoiceOrder = this.data.orders[idx];
    }

    this.saveData();
    this.isInvoiceEditMode = false;
    this.render();
    this.toggleInvoiceEditMode(); // switch back to view mode

    // Show feedback toast
    this.showToast(`Invoice ${this.currentInvoiceOrder.invoiceNumber} saved successfully! All tables, balances, and Excel sync state updated.`);
  }

  closeInvoiceModal() {
    this.closeInvoiceStudioModal();
    const modal = document.getElementById('invoice-modal');
    if (modal) modal.classList.add('hidden');
    this.currentInvoiceOrder = null;
    this.invoiceDraftData = null;
    this.isInvoiceEditMode = false;
  }

  printInvoice(bypassValidation = false) {
    const studioModal = document.getElementById('invoice-studio-modal');
    if (studioModal && !studioModal.classList.contains('hidden')) {
      return this.printStudioInvoice();
    }
    const order = this.currentInvoiceOrder || this.invoiceDraftData;
    if (order && !bypassValidation) {
      const validation = this.validateInvoice(order);
      if (!validation.isValid) {
        this.openValidationModal(`Invoice Blocked: ${order.invoiceNumber || order.id || 'Draft'}`, validation, null);
        this.showToast('Invoice cannot be printed: statutory issues detected.');
        return;
      }
      if (validation.warnings.length > 0) {
        this.openValidationModal(
          `Statutory Compliance Advisory: ${order.invoiceNumber || order.id || 'Invoice'}`,
          validation,
          () => { this.printInvoice(true); }
        );
        return;
      }
    }
    this.printStudioInvoice();
  }

  downloadInvoicePDF(showToast = true, bypassValidation = false) {
    const order = this.currentInvoiceOrder || this.invoiceDraftData;
    const container = document.getElementById('printable-invoice-container');
    if (!order || !container) return;

    if (!bypassValidation) {
      const validation = this.validateInvoice(order);
      if (!validation.isValid) {
        this.openValidationModal(`Invoice Blocked: ${order.invoiceNumber || order.id || 'Draft'}`, validation, null);
        this.showToast('Invoice download blocked: statutory issues detected.');
        return;
      }
      if (validation.warnings.length > 0) {
        this.openValidationModal(
          `Statutory Compliance Advisory: ${order.invoiceNumber || order.id || 'Invoice'}`,
          validation,
          () => { this.downloadInvoicePDF(showToast, true); }
        );
        return;
      }
    }

    const docType = order.documentType || 'TAX INVOICE';
    const safeRetailer = (order.retailerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
    
    let prefix = 'Tax_Invoice';
    if (docType === 'PROFORMA INVOICE') prefix = 'Proforma_Invoice';
    else if (docType === 'ADVANCE RECEIPT VOUCHER') prefix = 'Advance_Voucher';
    else if (docType === 'DELIVERY CHALLAN') prefix = 'JobWork_Challan';
    else if (docType === 'CREDIT NOTE') prefix = 'Credit_Note';

    const filename = `${prefix}_${order.invoiceNumber}_${safeRetailer}.pdf`;

    if (window.html2pdf) {
      const opt = {
        margin: [6, 6, 6, 6],
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(container).save().then(() => {
        if (showToast) {
          this.showToast(`Downloaded ${filename} successfully!`);
        }
      });
    } else {
      window.print();
    }
  }

  sendCustomInvoiceWhatsApp() {
    const order = this.currentInvoiceOrder || this.invoiceDraftData;
    if (!order) return;

    const waInput = document.getElementById('invoice-whatsapp-phone');
    const rawPhone = waInput ? waInput.value.trim() : '';

    if (!rawPhone) {
      this.showToast('⚠️ Please enter a valid mobile / WhatsApp number.');
      return;
    }

    // 1. Update Contact in Data Store & LocalStorage (persists for future automatic retrieval)
    const retailer = this.data.contacts.find(c => c.id === order.retailerId);
    if (retailer) {
      retailer.phone = rawPhone;
      retailer.whatsappPhone = rawPhone;
    }
    order.customerPhone = rawPhone;
    this.saveData();

    // 2. Direct PDF Download (Option A: generates & downloads the real PDF file immediately)
    this.downloadInvoicePDF(false);

    // 3. Clean phone number for wa.me API
    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    // 4. Format tailored message based on active Document Type
    const profile = this.data.businessProfile;
    const docType = order.documentType || 'TAX INVOICE';
    const itemsList = order.items.map(i => `• ${i.quantity.toLocaleString('en-IN')} Jars of ${i.name} (${i.variant})`).join('\n');
    let msg = '';

    if (docType === 'ADVANCE RECEIPT VOUCHER') {
      msg = `*ADVANCE RECEIPT VOUCHER - ${profile.brandName}*\n`;
      msg += `═══════════════════════════\n`;
      msg += `Namaste *${order.retailerName}*,\n\n`;
      msg += `We have received your advance payment for order *${order.invoiceNumber}*:\n`;
      msg += `🧾 *Voucher No:* ARV-${order.invoiceNumber}\n`;
      msg += `📅 *Date:* ${this.formatDate(order.customerAdvanceDate || order.date)}\n`;
      msg += `💵 *Advance Amount Received:* *${this.formatCurrency(order.customerAdvanceReceived)}* (${order.customerAdvanceMode})\n`;
      msg += `📦 *Total Order Valuation:* ${this.formatCurrency(order.totalInvoiceAmount)}\n`;
      msg += `⏳ *Balance Due on Dispatch:* *${this.formatCurrency(order.customerBalanceDue)}*\n\n`;
      msg += `📎 *Attached:* Official Advance Receipt Voucher (Rule 50 CGST)\n`;
      msg += `Thank you for your business!\n*${profile.legalName}*`;
    } else if (docType === 'PROFORMA INVOICE') {
      msg = `*PROFORMA INVOICE / BOOKING QUOTATION - ${profile.brandName}*\n`;
      msg += `═══════════════════════════\n`;
      msg += `Namaste *${order.retailerName}*,\n\n`;
      msg += `Please find attached your Proforma Invoice for booking your order:\n`;
      msg += `📄 *Proforma No:* PI-${order.invoiceNumber}\n`;
      msg += `📅 *Date:* ${this.formatDate(order.date)}\n`;
      msg += `*Requested Products:*\n${itemsList}\n\n`;
      msg += `💰 *Taxable Subtotal:* ${this.formatCurrency(order.taxableSubtotal)}\n`;
      msg += `🧾 *Estimated Total with GST:* *${this.formatCurrency(order.totalInvoiceAmount)}*\n`;
      msg += `⏳ *Required Booking Advance:* *${this.formatCurrency(order.customerAdvanceReceived || Math.round(order.totalInvoiceAmount * this.config().bookingAdvancePct / 100))}*\n\n`;
      msg += `*Bank Account for Advance Transfer:*\n`;
      msg += `• Bank: ${profile.bankName}\n`;
      msg += `• A/C No: ${profile.accountNumber}\n`;
      msg += `• IFSC: ${profile.ifsc}\n`;
      msg += `• UPI ID: *${profile.upiId}*\n\n`;
      msg += `📎 *Attached:* Proforma Invoice PDF (${order.invoiceNumber})\n`;
      msg += `*${profile.legalName}*`;
    } else if (docType === 'DELIVERY CHALLAN') {
      msg = `*DELIVERY CHALLAN (JOB WORK) - ${profile.brandName}*\n`;
      msg += `═══════════════════════════\n`;
      msg += `Notice of Material Dispatch for Job Work (Rule 55 CGST Rules):\n`;
      msg += `📦 *Challan No:* DC-${order.invoiceNumber}\n`;
      msg += `📅 *Date:* ${this.formatDate(order.date)}\n`;
      msg += `🏭 *Job Worker / Factory:* ${order.manufacturerName}\n`;
      msg += `📦 *Materials Dispatched:* Jars, Printed Labels, and Master Outer Boxes\n`;
      msg += `🚚 *Transporter:* ${order.transporterName || ''} (Leg 1)\n`;
      if (order.lrNumber) msg += `📄 *LR No:* ${order.lrNumber}\n`;
      msg += `\n*NOT FOR SALE - JOB WORK PURPOSES ONLY*\n`;
      msg += `📎 *Attached:* Official Delivery Challan PDF\n`;
      msg += `*${profile.legalName}*`;
    } else if (docType === 'CREDIT NOTE') {
      const damageTotal = Number(order.damageAmount) || 0;
      const newBalanceDue = Math.max(0, order.customerBalanceDue - damageTotal);
      msg = `*GST CREDIT NOTE (DAMAGE ADJUSTMENT) - ${profile.brandName}*\n`;
      msg += `═══════════════════════════\n`;
      msg += `Namaste *${order.retailerName}*,\n\n`;
      msg += `Please find attached your GST Credit Note for transit damage/leakage adjustment:\n`;
      msg += `✂️ *Credit Note No:* CRN-${order.invoiceNumber}\n`;
      msg += `📄 *Against Original Invoice:* ${order.invoiceNumber}\n`;
      msg += `💵 *Damage Adjustment Amount:* *${this.formatCurrency(damageTotal)}*\n`;
      msg += `📝 *Reason:* ${order.damageNote || ''}\n`;
      msg += `🚨 *Revised Balance Due:* *${this.formatCurrency(newBalanceDue)}*\n\n`;
      msg += `📎 *Attached:* Official Credit Note PDF (Sec 34 CGST)\n`;
      msg += `*${profile.legalName}*`;
    } else {
      // Default: TAX INVOICE
      msg = `*TAX INVOICE - ${profile.brandName}*\n`;
      msg += `═══════════════════════════\n`;
      msg += `Namaste *${order.retailerName}*,\n\n`;
      msg += `Please find attached your official Tax Invoice PDF for your order:\n`;
      msg += `📄 *Invoice No:* ${order.invoiceNumber}\n`;
      msg += `📅 *Invoice Date:* ${this.formatDate(order.date)}\n`;
      msg += `⏳ *Payment Terms:* ${order.paymentTerms} (Due: ${this.formatDate(order.dueDate)})\n\n`;
      msg += `*Dispatched Goods:*\n${itemsList}\n\n`;
      msg += `💰 *Taxable Subtotal:* ${this.formatCurrency(order.taxableSubtotal)}\n`;
      if (order.gstType === 'intra') {
        msg += `🏛️ *${this.gstLabels(order, false).combined}:* ${this.formatCurrency(order.cgstAmount + order.sgstAmount)}\n`;
      } else {
        msg += `🏛️ *${this.gstLabels(order, true).igst}:* ${this.formatCurrency(order.igstAmount)}\n`;
      }
      msg += `🧾 *Total Invoice Amount:* *${this.formatCurrency(order.totalInvoiceAmount)}*\n`;
      msg += `✅ *Advance Paid:* ${this.formatCurrency(order.customerAdvanceReceived)}\n`;
      msg += `🚨 *BALANCE DUE FOR SETTLEMENT:* *${this.formatCurrency(order.customerBalanceDue)}*\n\n`;

      if (order.lrNumber && order.lrNumber !== 'PENDING-DISPATCH') {
        msg += `🚚 *Transport LR:* ${order.lrNumber} (${order.transporterName})\n`;
        if (order.vehicleNumber && order.vehicleNumber !== 'TBD') {
          msg += `🚛 *Vehicle No:* ${order.vehicleNumber}\n`;
        }
        msg += `\n`;
      }

      msg += `*Bank Account Details for Settlement:*\n`;
      msg += `• Bank: ${profile.bankName}\n`;
      msg += `• A/C Name: ${profile.accountHolder}\n`;
      msg += `• A/C No: ${profile.accountNumber}\n`;
      msg += `• IFSC: ${profile.ifsc}\n`;
      msg += `• UPI ID: *${profile.upiId}*\n\n`;
      msg += `📎 *Attached:* Official Tax Invoice PDF (${order.invoiceNumber})\n`;
      msg += `Thank you for your business!\n*${profile.legalName}*`;
    }

    const encoded = encodeURIComponent(msg);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');

    this.showToast(`📄 ${docType} PDF downloaded & saved to ${order.retailerName}'s profile! Drop into the opened WhatsApp chat.`);
    this.renderActiveView();
  }
});
