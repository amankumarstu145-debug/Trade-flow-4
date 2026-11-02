// TradeFlow: Finance screen. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // ================= FINANCE & COMMERCIAL COCKPIT CONTROLLER =================
  openFinanceCockpitTab() {
    let tab = (this.openTabs || []).find(t => t.id === 'tab-finance');
    if (!tab) {
      tab = { id: 'tab-finance', title: 'Finance Cockpit', icon: 'badge-indian-rupee', type: 'finance', closeable: true };
      this.openTabs.push(tab);
    }
    this.activeWorkspaceTab = 'tab-finance';
    this.activeTab = 'finance';
    this.renderWorkspaceTabs();
    this.updateSidebarUI();
    this.renderActiveView();
  }

  renderFinanceView() {
    const orders = this.data.orders || [];
    const totalReceivables = orders.reduce((sum, o) => sum + (o.customerBalanceDue || 0), 0);
    const overdueOrders = orders.filter(o => o.status === 'delivered_overdue' || (new Date(o.dueDate) < new Date() && (o.customerBalanceDue || 0) > 0));

    let totalVendorPayables = 0;
    let totalAdvancesPaid = 0;
    orders.forEach(o => {
      const mfgDue = Math.max(0, (o.manufacturerTotalCost || 0) - (o.manufacturerAdvancePaid || 0) - (o.damageDeductedFrom === 'manufacturer' ? (o.damageAmount || 0) : 0));
      const pkgDue = Math.max(0, (o.packagingCost || 0) - (o.packagingAdvancePaid || 0));
      totalVendorPayables += (mfgDue + pkgDue);
      totalAdvancesPaid += (o.manufacturerAdvancePaid || 0) + (o.packagingAdvancePaid || 0);
    });

    const advancesInHand = orders
      .filter(o => (o.customerAdvanceReceived || 0) > 0)
      .reduce((sum, o) => sum + (o.customerAdvanceReceived || 0), 0);

    const netFloat = advancesInHand - totalAdvancesPaid;

    const elRecvVal = document.getElementById('fc-receivables-val');
    const elRecvSub = document.getElementById('fc-receivables-sub');
    if (elRecvVal) elRecvVal.innerText = this.formatCurrency(totalReceivables);
    if (elRecvSub) elRecvSub.innerText = `${overdueOrders.length} Overdue Accounts`;

    const elPayVal = document.getElementById('fc-payables-val');
    const elPaySub = document.getElementById('fc-payables-sub');
    if (elPayVal) elPayVal.innerText = this.formatCurrency(totalVendorPayables);
    if (elPaySub) elPaySub.innerText = `Factory & Packaging Dues`;

    const elAdvHandVal = document.getElementById('fc-adv-hand-val');
    const elAdvHandSub = document.getElementById('fc-adv-hand-sub');
    if (elAdvHandVal) elAdvHandVal.innerText = this.formatCurrency(advancesInHand);
    if (elAdvHandSub) elAdvHandSub.innerText = `Cash Collected in Hand`;

    const elAdvPaidVal = document.getElementById('fc-adv-paid-val');
    const elAdvPaidSub = document.getElementById('fc-adv-paid-sub');
    if (elAdvPaidVal) elAdvPaidVal.innerText = this.formatCurrency(totalAdvancesPaid);
    if (elAdvPaidSub) elAdvPaidSub.innerText = `Disbursed to Suppliers`;

    const elFloatVal = document.getElementById('fc-float-val');
    if (elFloatVal) elFloatVal.innerText = this.formatCurrency(netFloat);

    this.renderFinanceLedger();
  }

  setFinanceDrilldown(mode) {
    this.financeDrilldownMode = mode;
    ['fc-card-receivables', 'fc-card-payables', 'fc-card-adv-hand', 'fc-card-adv-paid', 'fc-card-float'].forEach(id => {
      const card = document.getElementById(id);
      if (!card) return;
      const isTarget = 
        (mode === 'receivables' && id === 'fc-card-receivables') ||
        (mode === 'payables' && id === 'fc-card-payables') ||
        (mode === 'advances_in_hand' && id === 'fc-card-adv-hand') ||
        (mode === 'advances_paid' && id === 'fc-card-adv-paid') ||
        (mode === 'all' && id === 'fc-card-float');
      card.classList.toggle('active-drilldown', isTarget);
      card.classList.toggle('border-amber-500', isTarget);
    });
    this.renderFinanceLedger();
  }

  filterFinanceLedger(query) {
    this.financeLedgerQuery = (query || '').toLowerCase().trim();
    this.renderFinanceLedger();
  }

  renderFinanceLedger() {
    const mode = this.financeDrilldownMode || 'payables';
    const thead = document.getElementById('fc-ledger-thead');
    const tbody = document.getElementById('fc-ledger-tbody');
    const titleEl = document.getElementById('fc-ledger-title');
    const badgeEl = document.getElementById('fc-ledger-count-badge');
    if (!tbody || !thead) return;

    let orders = [...(this.data.orders || [])];

    // Filter by mode
    if (mode === 'receivables') {
      orders = orders.filter(o => (o.customerBalanceDue || 0) > 0);
      if (titleEl) titleEl.innerText = 'Showing: Pending Buyer Receivables & Invoices';
    } else if (mode === 'payables') {
      orders = orders.filter(o => {
        const mfgDue = Math.max(0, (o.manufacturerTotalCost || 0) - (o.manufacturerAdvancePaid || 0));
        const pkgDue = Math.max(0, (o.packagingCost || 0) - (o.packagingAdvancePaid || 0));
        return (mfgDue + pkgDue) > 0;
      });
      if (titleEl) titleEl.innerText = 'Showing: Pending Factory & Packaging Payables';
    } else if (mode === 'advances_in_hand') {
      orders = orders.filter(o => (o.customerAdvanceReceived || 0) > 0);
      if (titleEl) titleEl.innerText = 'Showing: Orders with Customer Advances in Hand';
    } else if (mode === 'advances_paid') {
      orders = orders.filter(o => (o.manufacturerAdvancePaid || 0) > 0 || (o.packagingAdvancePaid || 0) > 0);
      if (titleEl) titleEl.innerText = 'Showing: Supplier Advances Disbursed';
    } else {
      if (titleEl) titleEl.innerText = 'Showing: All Commercial Accounts & Settlements';
    }

    // Apply inline text search
    if (this.financeLedgerQuery) {
      const q = this.financeLedgerQuery;
      orders = orders.filter(o => 
        (o.invoiceNumber && o.invoiceNumber.toLowerCase().includes(q)) ||
        (o.retailerName && o.retailerName.toLowerCase().includes(q)) ||
        (o.manufacturerName && o.manufacturerName.toLowerCase().includes(q)) ||
        (o.destination && o.destination.toLowerCase().includes(q))
      );
    }

    if (badgeEl) badgeEl.innerText = `${orders.length} Orders`;

    if (orders.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-12 text-slate-400">
            <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600"></i>
            <p class="text-xs font-semibold">No records match this finance drill-down.</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (mode === 'receivables') {
      thead.innerHTML = `
        <tr>
          <th class="py-3 px-4">Order / Invoice</th>
          <th class="py-3 px-3">Buyer Account</th>
          <th class="py-3 px-3">Total Invoice</th>
          <th class="py-3 px-3">Advance Recv</th>
          <th class="py-3 px-3">Balance Due</th>
          <th class="py-3 px-3">Due Date / Aging</th>
          <th class="py-3 px-4 text-right">Settlement Actions</th>
        </tr>
      `;
      tbody.innerHTML = orders.map(o => {
        const isOverdue = new Date(o.dueDate) < new Date();
        return `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors" onclick="app.navigateToOrderDetail('${tfEscapeHtml(tfEscapeJs(o.id))}')">
            <td class="py-3 px-4 font-mono-num font-bold text-slate-900 dark:text-white">
              ${tfEscapeHtml(o.invoiceNumber)}
              <div class="text-xs text-slate-400 font-normal">${tfEscapeHtml(this.formatDate(o.date))}</div>
            </td>
            <td class="py-3 px-3">
              <button type="button" onclick="event.stopPropagation(); app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(o.retailerName || ''))}')" class="font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline inline-flex items-center gap-1 group text-left" title="Click to view Buyer details">
                <span>${tfEscapeHtml(o.retailerName)}</span>
                <i data-lucide="arrow-up-right" class="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-500 shrink-0"></i>
              </button>
              <div class="text-xs text-slate-400 font-normal">${tfEscapeHtml(o.paymentTerms || 'Net 15')}</div>
            </td>
            <td class="py-3 px-3 font-mono-num text-slate-700 dark:text-slate-300 font-bold">${tfEscapeHtml(this.formatCurrency(o.totalInvoiceAmount))}</td>
            <td class="py-3 px-3 font-mono-num text-emerald-600 dark:text-emerald-400 font-bold">${tfEscapeHtml(this.formatCurrency(o.customerAdvanceReceived || 0))}</td>
            <td class="py-3 px-3 font-mono-num text-rose-600 dark:text-rose-400 font-black text-sm">${tfEscapeHtml(this.formatCurrency(o.customerBalanceDue))}</td>
            <td class="py-3 px-3">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${tfEscapeHtml(isOverdue ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300')}">
                ${tfEscapeHtml(isOverdue ? 'Overdue' : 'Due')} ${tfEscapeHtml(this.formatDate(o.dueDate))}
              </span>
            </td>
            <td class="py-3 px-4 text-right" onclick="event.stopPropagation()">
              <div class="flex items-center justify-end gap-1.5">
                <button onclick="app.shareWhatsApp('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1" title="Send WhatsApp Reminder">
                  <i data-lucide="message-square" class="w-3 h-3"></i>
                  <span>WhatsApp</span>
                </button>
                <button onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(o.id))}', '${tfEscapeHtml(tfEscapeJs(o.retailerName))}', 'received')" class="btn-tactile px-2.5 py-1 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 shadow-2xs" title="Log Payment Receipt">
                  <i data-lucide="receipt" class="w-3 h-3"></i>
                  <span>Log Receipt</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      // Default: Payables and Other drilldowns
      thead.innerHTML = `
        <tr>
          <th class="py-3 px-4">Order / Invoice</th>
          <th class="py-3 px-3">Factory & Pkg Vendors</th>
          <th class="py-3 px-3">Supplier Costs</th>
          <th class="py-3 px-3">Advance Disbursed</th>
          <th class="py-3 px-3">Remaining Payables</th>
          <th class="py-3 px-3">Batch Status</th>
          <th class="py-3 px-4 text-right">Disbursement Actions</th>
        </tr>
      `;
      tbody.innerHTML = orders.map(o => {
        const mfgCost = o.manufacturerTotalCost || 0;
        const pkgCost = o.packagingCost || 0;
        const totalSupCost = mfgCost + pkgCost;
        const mfgAdv = o.manufacturerAdvancePaid || 0;
        const pkgAdv = o.packagingAdvancePaid || 0;
        const totalAdv = mfgAdv + pkgAdv;
        const remaining = Math.max(0, totalSupCost - totalAdv);

        return `
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors" onclick="app.navigateToOrderDetail('${tfEscapeHtml(tfEscapeJs(o.id))}')">
            <td class="py-3 px-4 font-mono-num font-bold text-slate-900 dark:text-white">
              ${tfEscapeHtml(o.invoiceNumber)}
              <div class="text-xs text-slate-400 font-normal">Buyer: ${tfEscapeHtml(o.retailerName)}</div>
            </td>
            <td class="py-3 px-3">
              <button type="button" onclick="event.stopPropagation(); app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(o.manufacturerName || 'Factory'))}')" class="font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline inline-flex items-center gap-1 group text-left" title="Click to view Factory details">
                <span>${tfEscapeHtml(o.manufacturerName || 'Factory')}</span>
                <i data-lucide="arrow-up-right" class="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-500 shrink-0"></i>
              </button>
              ${o.packagingVendorName ? `
                <div class="text-xs text-slate-400 font-normal mt-0.5">
                  <button type="button" onclick="event.stopPropagation(); app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(o.packagingVendorName || ''))}')" class="hover:text-emerald-700 hover:underline inline-flex items-center gap-0.5" title="Click to view Packaging Vendor">
                    <span>${tfEscapeHtml(o.packagingVendorName)}</span>
                    <i data-lucide="arrow-up-right" class="w-2.5 h-2.5 opacity-60"></i>
                  </button>
                </div>
              ` : ''}
            </td>
            <td class="py-3 px-3 font-mono-num text-slate-700 dark:text-slate-300 font-bold">${tfEscapeHtml(this.formatCurrency(totalSupCost))}</td>
            <td class="py-3 px-3 font-mono-num text-blue-600 dark:text-blue-400 font-bold">${tfEscapeHtml(this.formatCurrency(totalAdv))}</td>
            <td class="py-3 px-3 font-mono-num text-amber-600 dark:text-amber-400 font-black text-sm">${tfEscapeHtml(this.formatCurrency(remaining))}</td>
            <td class="py-3 px-3">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize">
                ${tfEscapeHtml(o.status.replace(/_/g, ' '))}
              </span>
            </td>
            <td class="py-3 px-4 text-right" onclick="event.stopPropagation()">
              <div class="flex items-center justify-end gap-1.5">
                <button onclick="app.openFactoryPOModal('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1" title="View Factory PO">
                  <i data-lucide="factory" class="w-3 h-3 text-amber-500"></i>
                  <span>PO</span>
                </button>
                <button onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(o.id))}', '${tfEscapeHtml(tfEscapeJs(o.manufacturerName || ''))}', 'paid')" class="btn-tactile px-2.5 py-1 text-xs font-bold rounded bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 shadow-2xs" title="Disburse Vendor Payment">
                  <i data-lucide="send" class="w-3 h-3"></i>
                  <span>Pay Vendor</span>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }
});
