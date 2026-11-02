// TradeFlow: Order stages, dispatch and delivery. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // ================= ORDER INSPECTION & LIFECYCLE MILESTONES =================
  renderMilestoneSteps(order) {
    const statusMap = {
      'action_needed': 1,
      'in_production': order.bottlingDone ? 3 : 2,
      'in_transit': 4,
      'delivered_overdue': 5,
      'settled': 6
    };
    const currentStep = statusMap[order.status] || 1;

    const steps = [
      { step: 1, label: 'Advance Recv', desc: order.customerAdvanceReceived ? this.formatCurrency(order.customerAdvanceReceived) : 'Pending' },
      { step: 2, label: 'Factory PO', desc: order.manufacturerAdvancePaid ? 'PO Placed' : 'Awaited' },
      { step: 3, label: 'Bottling Done', desc: order.bottlingDone ? 'Ready' : (currentStep >= 3 ? 'Ready' : 'In Progress') },
      { step: 4, label: 'In Transit', desc: order.lrNumber || 'LR Pending' },
      { step: 5, label: 'Delivered', desc: order.deliveryDate ? this.formatDate(order.deliveryDate) : 'Balance Due' },
      { step: 6, label: 'Settled', desc: order.status === 'settled' ? 'Closed' : (this.formatCurrency(order.customerBalanceDue) + ' Due') }
    ];

    return steps.map(s => {
      const isPast = s.step < currentStep;
      const isCurrent = s.step === currentStep;
      let badgeBg = 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700';
      let icon = `<span class="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold">${tfEscapeHtml(s.step)}</span>`;

      if (isPast) {
        badgeBg = 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
        icon = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-600"></i>`;
      } else if (isCurrent) {
        badgeBg = 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/50';
        icon = `<span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>`;
      }

      return `
        <div class="p-2.5 rounded-lg border ${tfEscapeHtml(badgeBg)} flex flex-col justify-between transition-all">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold uppercase tracking-wider">Step ${tfEscapeHtml(s.step)}</span>
            ${icon}
          </div>
          <div class="font-bold text-xs truncate">${tfEscapeHtml(s.label)}</div>
          <div class="text-xs opacity-75 truncate mt-0.5">${tfEscapeHtml(s.desc)}</div>
        </div>
      `;
    }).join('');
  }

  advanceOrderLifecycleStage(orderId) {
    const order = this.findOrder(orderId);
    if (!order) return;

    if (order.status === 'action_needed') {
      this.openFactoryPOModal(order.id);
      this.showToast('Forward Factory PO to advance order to production!');
    } else if (order.status === 'in_production') {
      if (!order.bottlingDone) {
        order.bottlingDone = true;
        this.saveData();
        this.renderOrderDetailView(order.id);
        this.showToast('Bottling completed! Ready for transport dispatch.');
      } else {
        this.openTransportDispatchModal(order.id);
      }
    } else if (order.status === 'in_transit') {
      this.openDeliveryConfirmModal(order.id);
    } else if (order.status === 'delivered_overdue') {
      this.openPaymentModal(order.id, order.retailerName, 'received');
      this.showToast('Log final settlement to mark order complete!');
    } else if (order.status === 'settled') {
      this.showToast('Order is completely fulfilled and settled!');
    }
  }

  // --- Transport Dispatch Modal Management ---
  openTransportDispatchModal(orderId) {
    const order = this.findOrder(orderId);
    if (!order) return;
    this.activeDispatchOrderId = order.id;
    this.pendingDispatchBiltyFile = null;

    const modal = document.getElementById('transport-dispatch-modal');
    if (!modal) return;

    // 1. Populate summary box
    const totalCases = (order.items || []).reduce((sum, i) => sum + (i.cases || 0), 0);
    const totalJars = (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
    const summaryBox = document.getElementById('dispatch-summary-box');
    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
          <div>
            <span class="text-slate-400">Order:</span>
            <strong class="font-mono text-slate-900 dark:text-white font-bold ml-1">${tfEscapeHtml(order.invoiceNumber)}</strong>
          </div>
          <div>
            <span class="text-slate-400">Consignment:</span>
            <strong class="text-amber-600 dark:text-amber-400 font-bold ml-1">${tfEscapeHtml(totalCases)} Cases (${tfEscapeHtml(totalJars)} Jars)</strong>
          </div>
        </div>
        <div class="flex items-center justify-between pt-1">
          <div>
            <span class="text-slate-400">Buyer Depot:</span>
            <span class="font-semibold text-slate-800 dark:text-slate-200 ml-1">${tfEscapeHtml(order.retailerName)}</span>
          </div>
          <div>
            <span class="text-slate-400">Invoice Total:</span>
            <strong class="font-mono text-emerald-600 dark:text-emerald-400 font-bold ml-1">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</strong>
          </div>
        </div>
      `;
    }

    // 2. Pre-populate LR input
    const lrInput = document.getElementById('dispatch-lr-number');
    if (lrInput) {
      lrInput.value = (order.lrNumber && order.lrNumber !== 'PENDING' && order.lrNumber !== 'PENDING-DISPATCH') ? order.lrNumber : '';
    }

    // 3. Populate Transporter select
    const trnSelect = document.getElementById('dispatch-transporter-select');
    if (trnSelect) {
      const transporters = (this.data.contacts || []).filter(c => c.type === 'transporter' || c.category === 'transporter' || (c.name && (c.name.toLowerCase().includes('logistics') || c.name.toLowerCase().includes('transport') || c.name.toLowerCase().includes('express'))));
      let options = `<option value="">-- Select Assigned Transporter --</option>`;
      transporters.forEach(t => {
        const isSel = (order.transporterId === t.id) || (order.transporterName === t.name);
        options += `<option value="${tfEscapeHtml(t.id)}" data-name="${tfEscapeHtml(t.name)}" ${tfEscapeHtml(isSel ? 'selected' : '')}>${tfEscapeHtml(t.name)} (${tfEscapeHtml(t.phone || 'Transport')})</option>`;
      });
      if (order.transporterName && !transporters.some(t => t.name === order.transporterName)) {
        options += `<option value="custom" data-name="${tfEscapeHtml(order.transporterName)}" selected>${tfEscapeHtml(order.transporterName)} (Order Default)</option>`;
      }
      trnSelect.innerHTML = options;
    }

    // 4. Vehicle number input
    const vehInput = document.getElementById('dispatch-vehicle-number');
    if (vehInput) {
      vehInput.value = (order.vehicleNumber && order.vehicleNumber !== 'PENDING') ? order.vehicleNumber : '';
    }

    // 5. Dates
    const today = new Date().toISOString().slice(0, 10);
    const dateInput = document.getElementById('dispatch-date-input');
    if (dateInput) dateInput.value = today;

    const estInput = document.getElementById('dispatch-est-delivery-input');
    if (estInput) {
      if (order.dueDate) {
        estInput.value = order.dueDate;
      } else {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        estInput.value = d.toISOString().slice(0, 10);
      }
    }

    const biltyLabel = document.getElementById('dispatch-bilty-label');
    if (biltyLabel) biltyLabel.innerText = 'Choose Bilty Slip File or Drag Here';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => { if (lrInput) lrInput.focus(); }, 100);
  }

  closeTransportDispatchModal() {
    const modal = document.getElementById('transport-dispatch-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.activeDispatchOrderId = null;
    this.pendingDispatchBiltyFile = null;
  }

  selectLrPreset(preset) {
    const input = document.getElementById('dispatch-lr-number');
    if (input) {
      input.value = preset;
      input.focus();
    }
  }

  handleDispatchBiltySelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    this.pendingDispatchBiltyFile = file;
    const label = document.getElementById('dispatch-bilty-label');
    if (label) label.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  }

  async confirmTransportDispatch() {
    const order = this.findOrder(this.activeDispatchOrderId);
    if (!order) return;

    const lrVal = (document.getElementById('dispatch-lr-number')?.value || '').trim();
    const lrNumber = lrVal || 'PENDING-DISPATCH';

    const trnSelect = document.getElementById('dispatch-transporter-select');
    if (trnSelect && trnSelect.value) {
      const opt = trnSelect.options[trnSelect.selectedIndex];
      order.transporterId = trnSelect.value;
      order.transporterName = opt ? opt.getAttribute('data-name') : order.transporterName;
    }

    const vehVal = (document.getElementById('dispatch-vehicle-number')?.value || '').trim();
    if (vehVal) order.vehicleNumber = vehVal;

    const dispatchDate = document.getElementById('dispatch-date-input')?.value;
    if (dispatchDate) order.dispatchDate = dispatchDate;

    const estDelivery = document.getElementById('dispatch-est-delivery-input')?.value;
    if (estDelivery) order.dueDate = estDelivery;

    order.lrNumber = lrNumber;
    order.status = 'in_transit';

    // If bilty file attached, upload it
    if (this.pendingDispatchBiltyFile) {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: order.id,
              category: 'transport_bilty',
              fileName: this.pendingDispatchBiltyFile.name,
              fileData: e.target.result,
              metadata: {
                lrNumber: lrNumber,
                transporterName: order.transporterName || '',
                date: dispatchDate || new Date().toISOString().slice(0, 10)
              }
            })
          });
        };
        reader.readAsDataURL(this.pendingDispatchBiltyFile);
      } catch (err) {}
    }

    this.saveData();
    this.closeTransportDispatchModal();
    this.renderOrderDetailView(order.id);
    this.renderOrdersTable();
    this.renderKpis();
    this.showToast(`Order ${order.invoiceNumber} marked Dispatched / In-Transit! (LR: ${lrNumber})`);
  }

  dispatchWithPendingLr() {
    const lrInput = document.getElementById('dispatch-lr-number');
    if (lrInput) lrInput.value = 'PENDING-DISPATCH';
    this.confirmTransportDispatch();
  }

  // --- Delivery Confirm Modal Management ---
  openDeliveryConfirmModal(orderId) {
    const order = this.findOrder(orderId);
    if (!order) return;
    this.activeDeliveryOrderId = order.id;

    const modal = document.getElementById('delivery-confirm-modal');
    if (!modal) return;

    const summaryBox = document.getElementById('delivery-summary-box');
    if (summaryBox) {
      summaryBox.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
          <div>
            <span class="text-slate-400">Order:</span>
            <strong class="font-mono text-slate-900 dark:text-white font-bold ml-1">${tfEscapeHtml(order.invoiceNumber)}</strong>
          </div>
          <div>
            <span class="text-slate-400">LR Reference:</span>
            <strong class="font-mono text-purple-600 dark:text-purple-400 font-bold ml-1">${tfEscapeHtml(order.lrNumber || 'N/A')}</strong>
          </div>
        </div>
        <div class="space-y-1 pt-1">
          <div class="text-slate-600 dark:text-slate-300">
            Retailer Destination: <strong class="text-slate-900 dark:text-white">${tfEscapeHtml(order.retailerName)}</strong>
          </div>
          <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between">
            <span class="text-amber-800 dark:text-amber-300 font-semibold">Outstanding Balance Receivable:</span>
            <strong class="font-mono text-amber-700 dark:text-amber-400 font-black text-sm">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</strong>
          </div>
        </div>
      `;
    }

    const dateInput = document.getElementById('delivery-date-input');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  }

  closeDeliveryConfirmModal() {
    const modal = document.getElementById('delivery-confirm-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.activeDeliveryOrderId = null;
  }

  confirmDeliveryStageAction() {
    const order = this.findOrder(this.activeDeliveryOrderId);
    if (!order) return;

    const deliveryDate = document.getElementById('delivery-date-input')?.value || new Date().toISOString().slice(0, 10);
    order.status = 'delivered_overdue';
    order.deliveryDate = deliveryDate;

    this.saveData();
    this.closeDeliveryConfirmModal();
    this.renderOrderDetailView(order.id);
    this.renderOrdersTable();
    this.renderKpis();
    this.showToast(`Order ${order.invoiceNumber} marked Delivered! Balance payment due: ${this.formatCurrency(order.customerBalanceDue)}`);
  }

  toggleDispatchPackMenu(orderId) {
    const menu = document.getElementById(`dispatch-pack-menu-${orderId}`);
    if (menu) menu.classList.toggle('hidden');
  }

  dispatchWhatsAppBuyer(orderId) {
    this.shareWhatsApp(orderId);
  }

  dispatchWhatsAppFactory(orderId) {
    const order = this.findOrder(orderId);
    if (!order) return;
    const mfg = this.data.contacts.find(c => c.id === order.manufacturerId);
    const phone = (mfg && (mfg.whatsappPhone || mfg.phone)) || '';
    let msg = `Namaste ${order.manufacturerName || 'Factory'},\n\n`;
    msg += `Production Requisition Update for Order *${order.invoiceNumber}*:\n`;
    msg += `• Batch Cargo: ${(order.items || []).map(i => `${i.cases} Cases (${i.quantity} Jars) of ${i.variant}`).join(', ')}\n`;
    msg += `• Target Retailer: ${order.retailerName}\n`;
    msg += `• Advance Disbursed: ${this.formatCurrency(order.manufacturerAdvancePaid || 0)}\n`;
    msg += `• Order Status: ${order.status.replace(/_/g, ' ').toUpperCase()}\n`;
    if (order.vehicleNumber) msg += `• Assigned Vehicle: ${order.vehicleNumber}\n`;
    msg += `\nPlease confirm production readiness.\n*${this.data.businessProfile.brandName}*`;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  dispatchWhatsAppTransporter(orderId) {
    const order = this.findOrder(orderId);
    if (!order) return;
    const trn = this.data.contacts.find(c => c.id === order.transporterId);
    const phone = (trn && (trn.whatsappPhone || trn.phone)) || '';
    let msg = `Namaste ${order.transporterName || 'Logistics'},\n\n`;
    msg += `Transport Dispatch Instructions for Order *${order.invoiceNumber}*:\n`;
    msg += `• Destination: ${order.destination || order.shippingAddress || ''}\n`;
    msg += `• Consignment: ${(order.items || []).reduce((s, i) => s + (i.cases || 0), 0)} Cases for ${order.retailerName}\n`;
    msg += `• LR Number: ${order.lrNumber || 'PENDING'}\n`;
    msg += `• Vehicle No: ${order.vehicleNumber || 'PENDING'}\n`;
    msg += `\nPlease share LR receipt upon vehicle departure.\n*${this.data.businessProfile.brandName}*`;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  }
});
