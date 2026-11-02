// TradeFlow: Inbox: urgent actions list. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ---------- URGENT ACTION CENTER ENGINE ---------- */
  getUrgentActionItems() {
    const items = [];
    const orders = this.data.orders || [];
    const payments = this.data.payments || [];

    // 0a. Pending Mobile Snaps (Deferred from phone intake, awaiting Smart Fill processing)
    const snaps = this.data.pendingMobileSnaps || [];
    snaps.forEach(snap => {
      const tagLabel = snap.tagDisplay || (snap.tag === 'bank_slip' ? 'Bank Deposit Slip' : (snap.tag === 'bilty' ? 'Transport Bilty' : (snap.tag === 'invoice' ? 'Vendor Invoice' : 'Document')));
      items.push({
        id: `urgent-snap-${snap.id}`,
        type: 'pending_mobile_snap',
        snapId: snap.id,
        invoiceNumber: snap.tag?.toUpperCase() || 'MOBILE',
        partyName: snap.fileName,
        title: `Mobile Intake: ${tagLabel}`,
        badgeText: 'Mobile Intake',
        badgeClass: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
        description: `Mobile document "${snap.fileName}" (${tagLabel})${snap.note ? ` with note "${snap.note}"` : ''} saved on disk. Click Start Work Now to launch Smart Fill.`,
        amount: 0,
        amountLabel: 'Document Status',
        timestamp: snap.timestamp || new Date().toISOString(),
        timeFormatted: snap.timeFormatted || 'Received recently',
        actionLabel: 'Start Work Now →',
        actionCallback: `app.processPendingMobileSnap('${snap.id}')`,
        discardCallback: `app.discardPendingMobileSnap('${snap.id}')`,
        fileUrl: snap.fileUrl || snap.base64 || ''
      });
    });

    // 0b. In-Progress Unsaved Intake Draft (Top Urgency)
    try {
      const rawDraft = localStorage.getItem('tradeflow_pending_intake_draft');
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        const ext = draft.extracted || {};
        const hasData = draft.originalDataUrl || draft.fileUrl || ext.party || ext.amount || ext.utr || ext.orderRef;
        if (hasData) {
          const draftParty = ext.party || draft.reviewValues?.party || 'Scanned Document';
          const draftAmt = Number(ext.amount || draft.reviewValues?.amount || 0);
          const draftUtr = ext.utr || draft.reviewValues?.utr || '';
          const draftOrder = ext.orderRef || draft.reviewValues?.orderRef || '';

          items.push({
            id: 'urgent-intake-draft',
            type: 'pending_intake_draft',
            orderId: draftOrder || 'DRAFT',
            invoiceNumber: draftOrder || 'Unsaved',
            partyName: draftParty,
            title: `In-Progress Intake Draft: ${draftParty}`,
            badgeText: 'Unsaved Draft',
            badgeClass: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
            description: `Unsaved intake with attached document (${draftParty}, ₹${draftAmt.toLocaleString('en-IN')}${draftUtr ? `, UTR: ${draftUtr}` : ''}). Click to resume where you left off.`,
            amount: draftAmt,
            amountLabel: 'Draft Amount',
            timestamp: draft.updatedAt || draft.timestamp || new Date().toISOString(),
            timeFormatted: 'In-Progress (Draft)',
            actionLabel: 'Resume Filling →',
            actionCallback: 'app.resumePendingIntakeDraft()'
          });
        }
      }
    } catch (e) {
      console.warn('Error reading intake draft for urgent actions:', e);
    }

    // 1. Unplaced Factory POs on orders with customer advance
    orders.forEach(o => {
      const isAdvanceIdle = o.status === 'action_needed' || 
        (o.customerAdvanceReceived > 0 && (!o.mfgPoPlaced && o.manufacturerStatus === 'not_started'));
      if (isAdvanceIdle) {
        items.push({
          id: `urgent-po-${o.id}`,
          type: 'po_needed',
          orderId: o.id,
          invoiceNumber: o.invoiceNumber,
          partyName: o.retailerName,
          title: `Vendor PO Unplaced: ${o.retailerName}`,
          badgeText: 'Action Urgent',
          badgeClass: 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30',
          description: `Customer gave ${this.formatCurrency(o.customerAdvanceReceived)} advance for ${o.items && o.items[0] ? o.items[0].name : 'products'}. Production not yet triggered.`,
          amount: o.customerAdvanceReceived,
          amountLabel: 'Idle Advance',
          timestamp: o.createdAt || (o.date ? new Date(o.date).toISOString() : new Date().toISOString()),
          timeFormatted: o.timeLog || (o.date ? `${this.formatDate(o.date)} • 10:00:00 AM` : 'Active Order'),
          actionLabel: 'Place Vendor Orders →',
          actionCallback: `app.openFactoryPOModal('${o.id}')`
        });
      }
    });

    // 2. Overdue customer balances
    orders.forEach(o => {
      const isOverdue = (o.customerBalanceDue > 0) && (
        o.status === 'delivered_overdue' || 
        (o.dueDate && new Date(o.dueDate) < new Date())
      );
      if (isOverdue) {
        items.push({
          id: `urgent-overdue-${o.id}`,
          type: 'overdue_receivable',
          orderId: o.id,
          invoiceNumber: o.invoiceNumber,
          partyName: o.retailerName,
          title: `Payment Overdue: ${o.retailerName}`,
          badgeText: 'Overdue Balance',
          badgeClass: 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30',
          description: `Outstanding balance of ${this.formatCurrency(o.customerBalanceDue)} past due date (${this.formatDate(o.dueDate)}).`,
          amount: o.customerBalanceDue,
          amountLabel: 'Balance Due',
          timestamp: o.dueDate ? new Date(o.dueDate).toISOString() : (o.createdAt || new Date().toISOString()),
          timeFormatted: o.dueDate ? `Due by ${this.formatDate(o.dueDate)}` : 'Overdue',
          actionLabel: 'Inspect Order Dossier →',
          actionCallback: `app.openOrderPaymentFullModal('${o.id}')`
        });
      }
    });

    // 3. Factory advances required before production
    orders.forEach(o => {
      const advReq = o.manufacturerAdvanceRequired || 0;
      const advPaid = o.manufacturerAdvancePaid || 0;
      if (advReq > 0 && advPaid < advReq && o.status !== 'settled') {
        items.push({
          id: `urgent-mfg-adv-${o.id}`,
          type: 'mfg_advance_needed',
          orderId: o.id,
          invoiceNumber: o.invoiceNumber,
          partyName: o.manufacturerName || 'Manufacturer',
          title: `Factory Advance Due: ${o.manufacturerName || 'Manufacturer'}`,
          badgeText: 'Mfg Advance Due',
          badgeClass: 'bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30',
          description: `Factory requires ${this.formatCurrency(advReq)} advance to proceed with bottling (Paid: ${this.formatCurrency(advPaid)}).`,
          amount: advReq - advPaid,
          amountLabel: 'Advance Pending',
          timestamp: o.createdAt || (o.date ? new Date(o.date).toISOString() : new Date().toISOString()),
          timeFormatted: o.timeLog || (o.date ? `${this.formatDate(o.date)} • 11:30:00 AM` : 'Active PO'),
          actionLabel: 'Log Advance Payment →',
          actionCallback: `app.openPaymentModal()`
        });
      }
    });

    // 4. Payments missing document receipts (Audit gap)
    payments.forEach(p => {
      const missingDoc = !p.hasProof && !p.pd && !p.dataUrl && (p.amount >= 10000);
      if (missingDoc) {
        items.push({
          id: `urgent-doc-${p.id}`,
          type: 'missing_proof',
          orderId: p.orderRef || '',
          invoiceNumber: p.orderRef || p.id,
          partyName: p.partyName,
          title: `Audit Receipt Missing: ${p.partyName}`,
          badgeText: 'Missing Proof',
          badgeClass: 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30',
          description: `Payment of ${this.formatCurrency(p.amount)} recorded without uploaded bank slip or signed receipt.`,
          amount: p.amount,
          amountLabel: 'Amount',
          timestamp: p.createdAt || (p.date ? new Date(p.date).toISOString() : new Date().toISOString()),
          timeFormatted: p.timeLog || (p.date ? `${this.formatDate(p.date)} • 12:00:00 PM` : 'Recent Payment'),
          actionLabel: 'Attach Proof →',
          actionCallback: `app.openPaymentDetailDrawer('${p.id}')`
        });
      }
    });

    // Sort chronologically by timestamp, keeping in-progress unsaved draft & fresh mobile intakes pinned at top
    items.sort((a, b) => {
      if (a.type === 'pending_intake_draft') return -1;
      if (b.type === 'pending_intake_draft') return 1;
      if (a.type === 'pending_mobile_snap' && b.type !== 'pending_mobile_snap') return -1;
      if (b.type === 'pending_mobile_snap' && a.type !== 'pending_mobile_snap') return 1;
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    });

    return items;
  }

  openUrgentActionsModal() {
    const modal = document.getElementById('urgent-actions-modal');
    if (!modal) return;
    this.renderUrgentActionsList();
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeUrgentActionsModal() {
    const modal = document.getElementById('urgent-actions-modal');
    if (modal) modal.classList.add('hidden');
  }

  renderUrgentActionsList() {
    const container = document.getElementById('urgent-actions-list');
    const badge = document.getElementById('uam-count-badge');
    const footerStatus = document.getElementById('uam-footer-status');
    if (!container) return;

    const items = this.getUrgentActionItems();
    if (badge) {
      badge.textContent = `${items.length} ${items.length === 1 ? 'Matter' : 'Matters'}`;
      if (items.length > 0) {
        badge.className = 'px-2 py-0.5 text-xs font-mono-num font-bold rounded-md bg-amber-500 text-slate-950';
      } else {
        badge.className = 'px-2 py-0.5 text-xs font-mono-num font-bold rounded-md bg-emerald-500 text-white';
      }
    }

    if (footerStatus) {
      footerStatus.textContent = `Total ${items.length} critical items • Live sync active • ${this.getLiveFormattedDateTime()}`;
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center">
          <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-4">
            <i data-lucide="check-circle-2" class="w-8 h-8"></i>
          </div>
          <h4 class="text-sm font-bold text-slate-900 dark:text-white">All Clear! No Urgent Matters</h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            All factory POs are issued, payments are matched with audit proofs, and receivables are on schedule.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="p-4 rounded-xl bg-white dark:bg-[#151926] border border-slate-200 dark:border-slate-800 hover:border-emerald-600/40 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-start gap-3.5 min-w-0">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 overflow-hidden ${
            tfEscapeHtml(item.type === 'po_needed' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
            item.type === 'overdue_receivable' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
            item.type === 'mfg_advance_needed' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
            item.type === 'pending_intake_draft' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
            item.type === 'pending_mobile_snap' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
            'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20')
          }">
            ${item.type === 'pending_mobile_snap' && item.fileUrl ? `
              <img src="${tfEscapeHtml(tfSafeUrl(item.fileUrl))}" alt="Doc" class="w-full h-full object-cover" onerror="this.outerHTML='<i data-lucide=&quot;smartphone&quot; class=&quot;w-5 h-5 text-emerald-600 dark:text-emerald-400&quot;></i>'">
            ` : `
              <i data-lucide="${
                tfEscapeHtml(item.type === 'po_needed' ? 'factory' :
                item.type === 'overdue_receivable' ? 'alert-circle' :
                item.type === 'mfg_advance_needed' ? 'coins' :
                item.type === 'pending_intake_draft' ? 'file-edit' :
                item.type === 'pending_mobile_snap' ? 'smartphone' :
                'file-warning')
              }" class="w-5 h-5"></i>
            `}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              <h4 class="font-bold text-slate-900 dark:text-white text-xs">${tfEscapeHtml(item.title)}</h4>
              <span class="px-2 py-0.5 rounded text-xs font-bold ${tfEscapeHtml(item.badgeClass)}">${tfEscapeHtml(item.badgeText)}</span>
              ${item.invoiceNumber ? `<span class="px-1.5 py-0.5 rounded text-xs font-mono-num font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">${tfEscapeHtml(item.invoiceNumber)}</span>` : ''}
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-300 mb-1.5">${tfEscapeHtml(item.description)}</p>
            <div class="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
              <span class="flex items-center gap-1 font-mono-num">
                <i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i>
                <span>${tfEscapeHtml(item.timeFormatted)}</span>
              </span>
              <span class="text-slate-300 dark:text-slate-700">•</span>
              <span class="font-semibold text-slate-700 dark:text-slate-300">
                ${tfEscapeHtml(item.amountLabel)}: <strong class="font-mono-num ${tfEscapeHtml(item.type === 'overdue_receivable' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400')}">${tfEscapeHtml(item.type === 'pending_mobile_snap' ? 'Awaiting Smart Fill' : this.formatCurrency(item.amount))}</strong>
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          ${item.type === 'pending_intake_draft' ? `
            <button onclick="TradeFlowSmartFill.clearDraft(); app.renderUrgentActionsList(); app.updateSidebarUI();" class="btn-tactile px-2.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-300 dark:border-rose-800" title="Discard this unsaved draft">
              <span>Discard</span>
            </button>
          ` : ''}
          ${item.type === 'pending_mobile_snap' ? `
            <button onclick="app.discardPendingMobileSnap('${tfEscapeHtml(tfEscapeJs(item.snapId))}')" class="btn-tactile px-2.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg border border-rose-300 dark:border-rose-800" title="Discard this mobile intake file">
              <span>Discard</span>
            </button>
          ` : ''}
          <button onclick="${tfEscapeHtml(item.actionCallback)}; app.closeUrgentActionsModal();" class="btn-tactile px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-800 dark:text-white rounded-lg shadow-2xs whitespace-nowrap flex items-center gap-1.5">
            <span>${tfEscapeHtml(item.actionLabel)}</span>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  resumePendingIntakeDraft() {
    try {
      const raw = localStorage.getItem('tradeflow_pending_intake_draft');
      if (!raw) {
        this.showToast('No active in-progress draft found.');
        return;
      }
      const draft = JSON.parse(raw);
      this.closeUrgentActionsModal();
      window.TradeFlowSmartFill?.restoreFromDraft?.(draft);
      this.showToast('Resumed in-progress draft.');
    } catch (e) {
      console.error('Failed to resume draft:', e);
      this.showToast('Error restoring draft.');
    }
  }

  /* ---------- ATTENTION & MISSING ITEMS AUDIT CENTER ---------- */
  initAuditNotices() {
    this.auditFilter = 'all';
    this.auditData = null;

    setTimeout(() => {
      document.querySelectorAll('.audit-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.audit-filter-btn').forEach(b => {
            b.className = 'audit-filter-btn px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors';
          });
          btn.className = 'audit-filter-btn px-2.5 py-1 rounded-md bg-emerald-700 text-white shadow-2xs transition-colors';
          this.auditFilter = btn.getAttribute('data-audit-filter') || 'all';
          this.renderAuditNotices();
        });
      });
      this.refreshAuditNotices();
    }, 100);
  }

  toggleAuditPanel() {
    const panel = document.getElementById('dashboard-audit-panel');
    const resizer = document.getElementById('dashboard-split-resizer');
    const minBtn = document.getElementById('btn-show-audit-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      panel.classList.remove('hidden');
      if (resizer) resizer.classList.remove('hidden');
      if (minBtn) minBtn.classList.add('hidden');
    } else {
      panel.classList.add('hidden');
      if (resizer) resizer.classList.add('hidden');
      if (minBtn) minBtn.classList.remove('hidden');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  async fetchAuditData() {
    try {
      const resp = await fetch('/api/audit/missing-items');
      const data = await resp.json();
      this.auditData = data;
      return data;
    } catch (e) {
      return null;
    }
  }

  async refreshAuditNotices() {
    await this.fetchAuditData();
    this.renderAuditNotices();
  }

  triggerUploadForOrder(orderId, defaultCategory = 'mfg_invoice') {
    this.pendingDocOrderId = orderId;
    this.pendingDocCategory = defaultCategory;
    const input = document.getElementById('order-doc-upload-input');
    if (input) {
      input.click();
      this.showToast(`Select document for ${orderId} (will be saved in data/orders/)`);
    } else {
      this.openDocumentReviewModalForOrder(orderId, defaultCategory);
    }
  }

  openDocumentReviewModalForOrder(orderId, defaultCategory = 'mfg_invoice') {
    const order = this.findOrder(orderId);
    const mockFilePayload = {
      orderId: order ? order.id : (orderId || 'general'),
      fileName: `${order ? order.invoiceNumber : orderId}_Document.pdf`,
      fileData: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwgL0xlbmd0aCA1IDAgUiAvRmlsdGVyIC9GbGF0ZURlY29kZSA+PgpzdHJlYW0KeAEr5HIK4VJISkzOTczLz1Ew5NIAAWwDCA4KZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjMzCmVuZG9iago=...',
      fileType: 'application/pdf',
      analyzed: {
        category: defaultCategory,
        invoiceNumber: order ? order.invoiceNumber : '',
        counterpartyName: order ? order.retailerName : '',
        totalAmount: order ? order.totalInvoiceAmount : 0,
        docDate: new Date().toISOString().split('T')[0]
      }
    };
    this.openDocumentReviewModal(mockFilePayload);
  }

  handleAuditNoticeClick(orderId, paymentId) {
    // 1. Try finding by order ID or invoice number
    let order = this.findOrder(orderId);
    if (!order && orderId) {
      order = (this.data.orders || []).find(o => o.invoiceNumber === orderId || o.id.toLowerCase() === orderId.toLowerCase());
    }
    if (order) {
      this.openOrderDetailPage(order.id);
      return;
    }

    // 2. If it's a payment notice, check if associated with an order
    if (paymentId) {
      const p = (this.data.payments || []).find(item => item.id === paymentId);
      if (p && p.orderRef) {
        const ord = this.findOrder(p.orderRef) || (this.data.orders || []).find(o => o.invoiceNumber === p.orderRef);
        if (ord) {
          this.openOrderDetailPage(ord.id);
          return;
        }
      }
      this.openPaymentDetailDrawer(paymentId);
      return;
    }

    // 3. Fallback to orders view
    this.showToast('Opening Orders Pipeline');
  }

  renderAuditNotices() {
    const container = document.getElementById('audit-notices-feed');
    if (!container) return;

    let issues = (this.auditData && this.auditData.issues) || [];
    
    // Update badge counts
    const badge = document.getElementById('audit-total-badge');
    const minBadge = document.getElementById('audit-min-badge');
    const countAll = document.getElementById('audit-count-all');
    const countInvoice = document.getElementById('audit-count-invoice');
    const countProof = document.getElementById('audit-count-proof');
    const countLr = document.getElementById('audit-count-lr');

    const invCount = issues.filter(i => i.type === 'missing_invoice').length;
    const proofCount = issues.filter(i => i.type === 'missing_bank_proof' || i.type === 'missing_payment_voucher').length;
    const lrCount = issues.filter(i => i.type === 'missing_lr').length;

    if (badge) badge.textContent = issues.length;
    if (minBadge) minBadge.textContent = issues.length;
    if (countAll) countAll.textContent = issues.length;
    if (countInvoice) countInvoice.textContent = invCount;
    if (countProof) countProof.textContent = proofCount;
    if (countLr) countLr.textContent = lrCount;

    // Filter issues
    let filtered = issues;
    if (this.auditFilter === 'invoice') {
      filtered = issues.filter(i => i.type === 'missing_invoice');
    } else if (this.auditFilter === 'bank_proof') {
      filtered = issues.filter(i => i.type === 'missing_bank_proof' || i.type === 'missing_payment_voucher');
    } else if (this.auditFilter === 'lr') {
      filtered = issues.filter(i => i.type === 'missing_lr');
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="py-8 text-center animate-in fade-in duration-300">
          <div class="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 flex items-center justify-center mx-auto mb-2.5 shadow-xs shadow-emerald-500/10">
            <svg class="w-6 h-6 text-emerald-500 animate-draw-check" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2.5" class="opacity-20" />
              <path d="M14 24l7 7 14-14" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <p class="text-xs font-bold text-slate-800 dark:text-slate-200">No missing items in this view!</p>
          <p class="text-xs text-slate-400 mt-0.5">All bills and records are filed in data/orders/</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(item => {
      const isHigh = item.severity === 'high';
      const isMed = item.severity === 'medium';
      const badgeBg = isHigh 
        ? 'bg-rose-50/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60' 
        : (isMed 
            ? 'bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
            : 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60');

      const severityBorder = isHigh ? 'audit-card-high' : (isMed ? 'audit-card-med' : 'audit-card-low');

      const catBadge = item.type === 'missing_invoice' ? 'Tax Invoice' :
        (item.type === 'missing_bank_proof' ? 'Advance Bank Proof' :
          (item.type === 'missing_payment_voucher' ? 'Payment Slip' :
            (item.type === 'missing_lr' ? 'Lorry Receipt (LR)' : 'Jobwork Bill')));

      return `
        <div class="pt-2 pb-2 first:pt-0">
          <div 
            onclick="app.handleAuditNoticeClick('${tfEscapeHtml(tfEscapeJs(item.orderId || 'general'))}', '${tfEscapeHtml(tfEscapeJs(item.paymentId || ''))}')"
            class="p-2.5 rounded-xl border ${tfEscapeHtml(badgeBg)} ${tfEscapeHtml(severityBorder)} shadow-2xs space-y-2 hover:border-emerald-600/60 hover:shadow-md hover:bg-amber-500/5 transition-all cursor-pointer group"
            title="Click to inspect order ${tfEscapeHtml(item.orderRef || item.orderId)}"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="w-2 h-2 rounded-full ${tfEscapeHtml(isHigh ? 'bg-rose-500 shrink-0 animate-pulse' : (isMed ? 'bg-amber-500 shrink-0' : 'bg-blue-500 shrink-0'))}"></span>
                <span class="text-xs font-bold font-mono-num text-slate-900 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(item.orderRef || item.orderId)}</span>
                <span class="text-xs px-1.5 py-0.5 rounded font-medium bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800">${tfEscapeHtml(catBadge)}</span>
              </div>
              ${item.amount ? `<span class="text-xs font-bold font-mono-num text-slate-900 dark:text-slate-100 shrink-0">${tfEscapeHtml(this.formatCurrency(item.amount))}</span>` : ''}
            </div>

            <div class="flex items-center justify-between gap-2 pt-0.5">
              <div class="min-w-0 flex items-center gap-1">
                <span class="text-xs font-medium text-slate-600 dark:text-slate-300 truncate" title="${tfEscapeHtml(item.entityName)}">${tfEscapeHtml(item.entityName)}</span>
                <span class="text-xs text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">Inspect →</span>
              </div>
              <button 
                onclick="event.stopPropagation(); app.triggerUploadForOrder('${tfEscapeHtml(tfEscapeJs(item.orderId || 'general'))}', '${tfEscapeHtml(tfEscapeJs(item.type === 'missing_invoice' ? 'retailer_invoice' : (item.type === 'missing_lr' ? 'transport_bilty' : (item.type === 'missing_mfg_bill' ? 'mfg_invoice' : 'bank_receipt'))))}')" 
                class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 shadow-2xs hover:shadow-sm transition-all shrink-0 active:scale-95"
                title="Direct 1-click document upload"
              >
                <i data-lucide="upload" class="w-3 h-3"></i>
                <span>Upload</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  downloadActiveDoc() {
    const entry = this.paymentsState.activeDocEntry;
    if (!entry || (!entry.pd && !entry.dataUrl)) return;
    const a = document.createElement('a');
    a.href = tfSafeUrl(entry.dataUrl || entry.pd);
    a.download = entry.pn || 'payment_proof.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast(`Downloading ${entry.pn || 'payment_proof.pdf'}...`);
  }

  shareActiveDocWhatsApp() {
    const entry = this.paymentsState.activeDocEntry;
    if (!entry) return;

    const contact = (this.data.contacts || []).find(c =>
      c.name.toLowerCase() === entry.partyName.toLowerCase() ||
      entry.partyName.toLowerCase().includes(c.name.toLowerCase())
    );
    const rawPhone = contact && contact.phone ? contact.phone.replace(/[^0-9]/g, '') : '';
    const phone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;

    const msgLines = [
      `*Payment Receipt & Settlement Notice*`,
      `---------------------------------`,
      `*Party:* ${entry.partyName}`,
      `*Amount:* ${this.formatCurrency(entry.amount)}`,
      `*Date:* ${this.formatDate(entry.date)}`,
      `*Type:* ${entry.direction === 'paid' ? 'Payment Paid Out (Debited)' : 'Payment Received (Credited)'}`,
      `*Mode:* ${entry.mode}`,
      entry.utr ? `*UTR / Ref:* ${entry.utr}` : '',
      entry.orderRef ? `*Order Ref:* ${entry.orderRef}` : '',
      entry.notes ? `*Notes:* ${entry.notes}` : '',
      `*File Attached:* ${entry.pn || 'Receipt'}`,
      `---------------------------------`,
      `_TradeFlow System Verification_`
    ].filter(Boolean);

    const text = encodeURIComponent(msgLines.join('\n'));
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
    this.showToast('💬 WhatsApp settlement notice opened');
  }

  async copyActiveDocPath() {
    const entry = this.paymentsState.activeDocEntry;
    const folder = entry ? (entry.orderFolder || entry.orderRef || 'general') : 'general';
    try {
      const resp = await fetch('/api/documents/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: folder })
      });
      const data = await resp.json().catch(() => ({}));
      const fullPath = data.path || `storage/documents/orders/${folder}/`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullPath);
        this.showToast('Full folder path copied: ' + fullPath);
      } else {
        await this.showModalPrompt({
          title: 'Order Folder Path',
          subtitle: 'Storage Directory Location',
          message: 'Copy the storage path below:',
          defaultValue: fullPath,
          confirmText: 'Done'
        });
      }
    } catch (e) {
      this.showToast('Storage: storage/documents/orders/' + folder + '/');
    }
  }

  /* ================= 3. UNIFIED EXCEPTION CENTER ================= */
  openExceptionsWorkspaceTab() {
    this.activeTab = 'exceptions';
    this.updateSidebarUI();
    this.renderActiveView();
  }

  getExceptionsList() {
    const exceptions = [];
    const orders = this.data.orders || [];
    const payments = this.data.payments || [];
    const today = new Date();

    // 1. Missing Transport LR / Bilties
    orders.forEach(o => {
      const needsLr = (o.status === 'in_transit' || o.status === 'in_production' || o.status === 'ready');
      const hasLr = Boolean(o.lrNumber || (o.documents && o.documents.some(d => (d.category === 'lr' || d.type === 'bilty'))));
      if (needsLr && !hasLr) {
        exceptions.push({
          id: `exc-lr-${o.id}`,
          type: 'missing_lr',
          categoryLabel: 'Missing Transport LR / Bilty',
          severity: 'high',
          badgeColor: 'amber',
          title: `Missing Bilty: Order ${o.invoiceNumber || o.id}`,
          party: o.retailerName,
          orderId: o.id,
          amount: o.totalInvoiceAmount,
          description: `Dispatched or ready with ${o.transporterName || 'Transporter'} but no LR / Bilty slip uploaded. Risk of delivery dispute.`,
          actionLabel: 'Upload Bilty Slip',
          action: () => this.openOrderDetailPage(o.id)
        });
      }
    });

    // 2. Unreconciled / Missing Payment Slips
    orders.forEach(o => {
      const isDelivered = (o.status === 'delivered' || o.status === 'delivered_overdue' || o.status === 'settled');
      if (isDelivered && (o.customerBalanceDue || 0) > 0) {
        const isPastDue = o.dueDate && new Date(o.dueDate) < today;
        exceptions.push({
          id: `exc-pay-${o.id}`,
          type: isPastDue ? 'overdue_account' : 'missing_payment',
          categoryLabel: isPastDue ? 'Overdue Account Ledger' : 'Uncollected Balance',
          severity: isPastDue ? 'critical' : 'urgent',
          badgeColor: isPastDue ? 'rose' : 'orange',
          title: `${isPastDue ? 'Overdue Dues' : 'Outstanding Balance'}: ₹${(o.customerBalanceDue || 0).toLocaleString('en-IN')}`,
          party: o.retailerName,
          orderId: o.id,
          amount: o.customerBalanceDue,
          description: `Order ${o.invoiceNumber || o.id} delivered. Customer owes ₹${(o.customerBalanceDue || 0).toLocaleString('en-IN')}${isPastDue ? ` (Due date: ${o.dueDate})` : ''}.`,
          actionLabel: 'Record Settlement',
          action: () => this.openPaymentModal(o.id, o.retailerName, 'received')
        });
      }
    });

    // 3. Idle Advances (Advance collected from retailer but Factory PO not placed)
    orders.forEach(o => {
      if (o.status === 'action_needed' && (o.customerAdvanceReceived || 0) > 0 && !(o.manufacturerAdvancePaid || 0)) {
        exceptions.push({
          id: `exc-adv-${o.id}`,
          type: 'idle_advance',
          categoryLabel: 'Idle Advance / Factory PO Pending',
          severity: 'medium',
          badgeColor: 'blue',
          title: `Idle Advance ₹${(o.customerAdvanceReceived || 0).toLocaleString('en-IN')}`,
          party: o.retailerName,
          orderId: o.id,
          amount: o.customerAdvanceReceived,
          description: `Advance received from ${o.retailerName} but Factory PO not yet forwarded to ${o.manufacturerName || 'Manufacturer'}.`,
          actionLabel: 'Generate Factory PO',
          action: () => this.openFactoryPOModal(o.id)
        });
      }
    });

    // 4. Duplicate UTR / Suspected Conflict
    payments.forEach(p => {
      if (p.reconciliationStatus === 'duplicate_suspected' || p.isDuplicateUtr) {
        exceptions.push({
          id: `exc-dup-${p.id}`,
          type: 'duplicate_utr',
          categoryLabel: 'Duplicate UTR Collision',
          severity: 'critical',
          badgeColor: 'rose',
          title: `Duplicate UTR Conflict: ${p.utr}`,
          party: p.partyName,
          paymentId: p.id,
          amount: p.amount,
          description: `Payment UTR ${p.utr} has already been logged on another transaction. Possible duplicate entry.`,
          actionLabel: 'Inspect Settlement',
          action: () => {
            this.activeTab = 'payments';
            this.updateSidebarUI();
            this.renderActiveView();
          }
        });
      }
    });

    return exceptions;
  }

  renderExceptionsView(filter = 'all') {
    const container = document.getElementById('exceptions-workspace-content');
    if (!container) return;

    const allExceptions = this.getExceptionsList();
    const criticalCount = allExceptions.filter(e => e.severity === 'critical' || e.severity === 'urgent').length;
    const missingLrCount = allExceptions.filter(e => e.type === 'missing_lr').length;
    const overdueCount = allExceptions.filter(e => e.type === 'overdue_account' || e.type === 'missing_payment').length;
    const idleCount = allExceptions.filter(e => e.type === 'idle_advance').length;
    const dupCount = allExceptions.filter(e => e.type === 'duplicate_utr').length;

    const filtered = allExceptions.filter(e => {
      if (filter === 'all') return true;
      if (filter === 'missing_lr') return e.type === 'missing_lr';
      if (filter === 'payments') return e.type === 'overdue_account' || e.type === 'missing_payment';
      if (filter === 'advances') return e.type === 'idle_advance';
      if (filter === 'duplicates') return e.type === 'duplicate_utr';
      return true;
    });

    const totalRiskAmount = allExceptions.reduce((sum, e) => sum + (e.amount || 0), 0);

    let html = `
      <!-- Top Exception Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-white dark:bg-[#0c0e14] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
              <i data-lucide="shield-alert" class="w-5 h-5"></i>
            </div>
            <div>
              <h1 class="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Unified Exception Center</span>
                <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300">
                  ${tfEscapeHtml(allExceptions.length)} Action Items
                </span>
              </h1>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automated continuous audit: catches missing bilties, uncollected dues, idle advances, and duplicate UTRs.
              </p>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="app.renderExceptionsView('${tfEscapeHtml(tfEscapeJs(filter))}')" class="btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Rescan Now</span>
          </button>
        </div>
      </div>

      <!-- KPI Overview Metrics -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-white dark:bg-[#11141d] border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400">Total Exceptions</div>
          <div class="text-2xl font-black font-mono-num text-slate-900 dark:text-white mt-1">${tfEscapeHtml(allExceptions.length)}</div>
          <div class="text-xs text-slate-400 mt-0.5">${tfEscapeHtml(criticalCount)} Critical / Urgent</div>
        </div>
        <div class="p-4 rounded-xl bg-white dark:bg-[#11141d] border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div class="text-xs font-bold text-amber-600 dark:text-amber-400">Missing Bilties (LR)</div>
          <div class="text-2xl font-black font-mono-num text-amber-600 dark:text-amber-400 mt-1">${tfEscapeHtml(missingLrCount)}</div>
          <div class="text-xs text-slate-400 mt-0.5">Dispatches without proof</div>
        </div>
        <div class="p-4 rounded-xl bg-white dark:bg-[#11141d] border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div class="text-xs font-bold text-rose-600 dark:text-rose-400">Overdue / Uncollected</div>
          <div class="text-2xl font-black font-mono-num text-rose-600 dark:text-rose-400 mt-1">${tfEscapeHtml(overdueCount)}</div>
          <div class="text-xs text-slate-400 mt-0.5">Delivered orders with dues</div>
        </div>
        <div class="p-4 rounded-xl bg-white dark:bg-[#11141d] border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div class="text-xs font-bold text-blue-600 dark:text-blue-400">Total Risk Exposure</div>
          <div class="text-2xl font-black font-mono-num text-slate-900 dark:text-white mt-1">₹${tfEscapeHtml(totalRiskAmount.toLocaleString('en-IN'))}</div>
          <div class="text-xs text-slate-400 mt-0.5">Underlying commercial sum</div>
        </div>
      </div>

      <!-- Exception Category Filter Tabs -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto text-xs">
        <button type="button" onclick="app.renderExceptionsView('all')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${tfEscapeHtml(filter === 'all' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}">
          All Exceptions (${tfEscapeHtml(allExceptions.length)})
        </button>
        <button type="button" onclick="app.renderExceptionsView('missing_lr')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${tfEscapeHtml(filter === 'missing_lr' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}">
          Missing Bilties (${tfEscapeHtml(missingLrCount)})
        </button>
        <button type="button" onclick="app.renderExceptionsView('payments')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${tfEscapeHtml(filter === 'payments' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}">
          Payment & Overdue (${tfEscapeHtml(overdueCount)})
        </button>
        <button type="button" onclick="app.renderExceptionsView('advances')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${tfEscapeHtml(filter === 'advances' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}">
          Idle Advances (${tfEscapeHtml(idleCount)})
        </button>
        <button type="button" onclick="app.renderExceptionsView('duplicates')" class="px-3 py-1.5 rounded-lg font-bold transition-all ${tfEscapeHtml(filter === 'duplicates' ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}">
          Duplicate UTRs (${tfEscapeHtml(dupCount)})
        </button>
      </div>

      <!-- Action Items Stream -->
      <div class="space-y-3">
    `;

    if (filtered.length === 0) {
      html += `
        <div class="p-12 text-center bg-white dark:bg-[#11141d] rounded-2xl border border-slate-200 dark:border-slate-800">
          <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
            <i data-lucide="shield-check" class="w-8 h-8"></i>
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white">All Clear — Zero Exceptions!</h3>
          <p class="text-xs text-slate-500 mt-1">
            No missing transport documents, overdue balances, or duplicate UTR conflicts in this category.
          </p>
        </div>
      `;
    } else {
      filtered.forEach((item, idx) => {
        const actionKey = `_tfExcAction_${idx}`;
        window[actionKey] = item.action;
        html += `
          <div class="p-4 rounded-xl bg-white dark:bg-[#11141d] border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-emerald-600/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div class="flex items-start gap-3 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full bg-${tfEscapeHtml(item.badgeColor)}-500 shrink-0 mt-1.5"></span>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-black uppercase tracking-wider text-${tfEscapeHtml(item.badgeColor)}-600 dark:text-${tfEscapeHtml(item.badgeColor)}-400">
                    ${tfEscapeHtml(item.categoryLabel)}
                  </span>
                  <span class="text-slate-400">•</span>
                  <span class="text-xs font-bold text-slate-900 dark:text-white truncate">
                    ${tfEscapeHtml(item.title)}
                  </span>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  ${tfEscapeHtml(item.description)}
                </p>
                <div class="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                  ${item.party ? `<span>Party: <b class="text-slate-800 dark:text-slate-200">${tfEscapeHtml(item.party)}</b></span>` : ''}
                  ${item.amount ? `<span>Value: <b class="font-mono text-slate-800 dark:text-slate-200">₹${tfEscapeHtml(item.amount.toLocaleString('en-IN'))}</b></span>` : ''}
                  ${item.orderId ? `<span>Order Ref: <b class="font-mono text-amber-600 dark:text-amber-400">${tfEscapeHtml(item.orderId)}</b></span>` : ''}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 self-start md:self-center shrink-0">
              <button 
                type="button" 
                onclick="window.${tfEscapeHtml(actionKey)}()" 
                class="btn-tactile px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm flex items-center gap-1.5"
              >
                <span>${tfEscapeHtml(item.actionLabel)}</span>
                <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }
});
