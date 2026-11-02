// TradeFlow: Recycle bin and undo. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ================= SUGGESTION 2: 10-SECOND FLOATING UNDO & RECYCLE BIN ================= */
  showUndoToast(message, undoCallback, durationSeconds = 10) {
    this.pendingUndoCallback = undoCallback;
    this.undoCountdown = durationSeconds;

    const toast = document.getElementById('floating-undo-toast');
    const msgEl = document.getElementById('undo-toast-message');
    const numEl = document.getElementById('undo-countdown-num');
    const progEl = document.getElementById('undo-toast-progress');

    if (!toast) return;

    if (msgEl) msgEl.innerText = message;
    if (numEl) numEl.innerText = durationSeconds;

    if (progEl) {
      progEl.classList.remove('undo-progress-bar');
      void progEl.offsetWidth;
      progEl.classList.add('undo-progress-bar');
    }

    toast.classList.add('show');

    if (this.undoTimer) clearInterval(this.undoTimer);
    this.undoTimer = setInterval(() => {
      this.undoCountdown--;
      if (numEl) numEl.innerText = this.undoCountdown;
      if (this.undoCountdown <= 0) {
        this.dismissUndoToast();
      }
    }, 1000);
  }

  executePendingUndo() {
    if (typeof this.pendingUndoCallback === 'function') {
      try {
        this.pendingUndoCallback();
        this.showToast('Action undone successfully!');
      } catch (err) {
        console.error('Undo execution error:', err);
      }
    }
    this.dismissUndoToast();
  }

  dismissUndoToast() {
    if (this.undoTimer) {
      clearInterval(this.undoTimer);
      this.undoTimer = null;
    }
    this.pendingUndoCallback = null;
    const toast = document.getElementById('floating-undo-toast');
    if (toast) toast.classList.remove('show');
  }

  // Deleted orders live in their own list so no total, ledger or report counts them.
  deletedOrdersList() {
    return [...(this.data.deletedOrders || []), ...(this.data.orders || []).filter(o => o.isDeleted)];
  }

  async deleteOrder(orderId) {
    const index = (this.data.orders || []).findIndex(o => o.id === orderId);
    if (index === -1) return;
    const order = this.data.orders[index];
    const linkedPayments = (this.data.payments || []).filter(p => !p.isDeleted && p.orderRef && this.findOrder(p.orderRef) === order);
    const confirmed = await this.showModalConfirm({
      title: 'Delete Order',
      subtitle: 'Move to Recycle Bin',
      message: `Move order <b>${tfEscapeHtml(order.invoiceNumber || order.id)}</b> (${tfEscapeHtml(order.retailerName || '')}) to the Recycle Bin?` +
        (linkedPayments.length ? `<br><br><span class="text-xs text-amber-600 font-bold">${tfEscapeHtml(linkedPayments.length)} payment(s) recorded against it stay in the payments ledger.</span>` : '') +
        '<br><br><span class="text-xs text-slate-500">You can restore it from the Recycle Bin.</span>',
      confirmText: 'Move to Recycle Bin',
      confirmClass: 'bg-rose-600 hover:bg-rose-500',
      icon: 'trash-2'
    });
    if (!confirmed) return;
    this.data.orders.splice(index, 1);
    Object.assign(order, { isDeleted: true, deletedAt: new Date().toISOString(), deletedBy: 'Operator' });
    this.data.deletedOrders = this.data.deletedOrders || [];
    this.data.deletedOrders.unshift(order);
    this.saveData();
    // Leave the deleted order's page and close any tab showing it.
    (this.openTabs || []).filter(t => t.orderId === order.id || t.refId === order.id || String(t.id || '').includes(order.id)).forEach(t => this.closeWorkspaceTab(t.id));
    if (this.activeOrderId === order.id || this.activeTab === 'order-detail') { this.activeOrderId = null; this.activeTab = 'orders'; }
    this.render();
    this.updateRecycleBinBadge();
    this.showUndoToast(`Order ${order.invoiceNumber || order.id} moved to Recycle Bin.`, () => this.restoreDeletedOrder(order.id));
  }

  updateRecycleBinBadge() {
    const deletedOrders = this.deletedOrdersList().length;
    const deletedPayments = (this.data.payments || []).filter(p => p.isDeleted).length;
    const total = deletedOrders + deletedPayments;
    const badge = document.getElementById('recycle-bin-badge');
    if (badge) badge.innerText = total;
  }

  openRecycleBinModal() {
    this.renderRecycleBinList();
    const modal = document.getElementById('recycle-bin-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeRecycleBinModal() {
    const modal = document.getElementById('recycle-bin-modal');
    if (modal) modal.classList.add('hidden');
  }

  renderRecycleBinList() {
    const emptyState = document.getElementById('recycle-bin-empty-state');
    const listWrap = document.getElementById('recycle-bin-items-list');
    if (!listWrap) return;

    const deletedOrders = this.deletedOrdersList();
    const deletedPayments = (this.data.payments || []).filter(p => p.isDeleted);

    if (deletedOrders.length === 0 && deletedPayments.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      listWrap.classList.add('hidden');
      listWrap.innerHTML = tfSanitizeHtml('');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    listWrap.classList.remove('hidden');

    let html = '';

    deletedPayments.forEach(p => {
      html += `
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5">
            <span class="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 font-bold shrink-0">₹</span>
            <div>
              <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Payment: ${tfEscapeHtml(this.formatCurrency(p.amount))}</span>
                <span class="px-1.5 py-0.2 rounded text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">${tfEscapeHtml(p.id)}</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Party: ${tfEscapeHtml(p.partyName || 'General')} · Date: ${tfEscapeHtml(p.date || 'N/A')}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="app.restoreDeletedPayment('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1 shadow-2xs">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Restore</span>
            </button>
            <button type="button" onclick="app.purgeDeletedPayment('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="p-1 text-slate-400 hover:text-rose-500 rounded" title="Permanently delete">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    });

    deletedOrders.forEach(o => {
      html += `
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2.5">
            <span class="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 font-bold shrink-0"><i data-lucide="package" class="w-4 h-4 inline-block"></i></span>
            <div>
              <div class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>Order: ${tfEscapeHtml(o.id)}</span>
                <span class="px-1.5 py-0.2 rounded text-xs bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">${tfEscapeHtml(o.customerName || 'Customer')}</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400">Total: ${tfEscapeHtml(this.formatCurrency(o.totalInvoiceAmount || 0))}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="app.restoreDeletedOrder('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1 shadow-2xs">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Restore</span>
            </button>
            <button type="button" onclick="app.purgeDeletedOrder('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="p-1 text-slate-400 hover:text-rose-500 rounded" title="Permanently delete">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    });

    listWrap.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }

  restoreDeletedPayment(id) {
    const p = (this.data.payments || []).find(x => x.id === id);
    if (!p || !p.isDeleted) return;
    p.isDeleted = false;
    delete p.deletedAt;
    delete p.deletedBy;
    this.applyPaymentToOrder(p, 1);
    this.saveData();
    this.renderPaymentsLedger();
    this.renderRecycleBinList();
    this.updateRecycleBinBadge();
    this.showToast(`Payment of ${this.formatCurrency(p.amount)} restored successfully.`);
  }

  async purgeDeletedPayment(id) {
    const p = (this.data.payments || []).find(x => x.id === id);
    const amountStr = p ? ` of <b>${tfEscapeHtml(this.formatCurrency(p.amount))}</b>` : '';
    const confirmed = await this.showModalConfirm({
      title: 'Permanently Purge Payment',
      subtitle: 'Irreversible Deletion',
      message: `Permanently purge this payment${amountStr} from the database?<br><br><span class="text-xs text-rose-500 font-bold">This operation cannot be undone.</span>`,
      confirmText: 'Purge Payment',
      confirmClass: 'bg-rose-600 hover:bg-rose-500',
      icon: 'trash-2'
    });
    if (!confirmed) return;
    this.data.payments = (this.data.payments || []).filter(p => p.id !== id);
    this.saveData();
    this.renderRecycleBinList();
    this.updateRecycleBinBadge();
    this.showToast('Payment permanently purged.');
  }

  restoreDeletedOrder(id) {
    const binIndex = (this.data.deletedOrders || []).findIndex(x => x.id === id);
    let o;
    if (binIndex !== -1) {
      o = this.data.deletedOrders.splice(binIndex, 1)[0];
      if ((this.data.orders || []).some(x => x.id === o.id)) { this.showToast(`An order with id ${o.id} already exists.`); this.data.deletedOrders.splice(binIndex, 0, o); return; }
      this.data.orders.unshift(o);
    } else {
      o = (this.data.orders || []).find(x => x.id === id);
    }
    if (!o) return;
    o.isDeleted = false;
    delete o.deletedAt;
    delete o.deletedBy;
    this.saveData();
    this.renderOrdersTable();
    this.renderRecycleBinList();
    this.updateRecycleBinBadge();
    this.showToast(`Order ${o.id} restored successfully.`);
  }

  async purgeDeletedOrder(id) {
    const confirmed = await this.showModalConfirm({
      title: 'Permanently Purge Order',
      subtitle: 'Irreversible Deletion',
      message: `Permanently purge order <b>${tfEscapeHtml(id)}</b> from the database?<br><br><span class="text-xs text-rose-500 font-bold">This operation cannot be undone.</span>`,
      confirmText: 'Purge Order',
      confirmClass: 'bg-rose-600 hover:bg-rose-500',
      icon: 'trash-2'
    });
    if (!confirmed) return;
    this.data.orders = (this.data.orders || []).filter(o => !(o.id === id && o.isDeleted));
    this.data.deletedOrders = (this.data.deletedOrders || []).filter(o => o.id !== id);
    this.saveData();
    this.renderRecycleBinList();
    this.updateRecycleBinBadge();
    this.showToast(`Order ${id} permanently purged.`);
  }

  async emptyRecycleBin() {
    const count = this.deletedOrdersList().length +
                  ((this.data.payments || []).filter(p => p.isDeleted).length);
    if (count === 0) {
      this.showToast('Recycle Bin is already empty.');
      return;
    }
    const confirmed = await this.showModalConfirm({
      title: 'Empty Recycle Bin',
      subtitle: 'Purge All Deleted Items',
      message: `Are you sure you want to permanently empty the Recycle Bin (<b>${tfEscapeHtml(count)}</b> items)?<br><br><span class="text-xs text-rose-500 font-bold">All deleted orders and payments will be permanently purged. This operation cannot be undone.</span>`,
      confirmText: 'Empty Recycle Bin',
      confirmClass: 'bg-rose-600 hover:bg-rose-500',
      icon: 'trash-2'
    });
    if (!confirmed) return;
    this.data.orders = (this.data.orders || []).filter(o => !o.isDeleted);
    this.data.deletedOrders = [];
    this.data.payments = (this.data.payments || []).filter(p => !p.isDeleted);
    this.saveData();
    this.renderRecycleBinList();
    this.updateRecycleBinBadge();
    this.showToast('Recycle Bin emptied.');
  }
});
