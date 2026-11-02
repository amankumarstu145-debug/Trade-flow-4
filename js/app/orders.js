// TradeFlow: Orders dashboard: number tiles, orders table and filters. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  renderKPIs() {
    const orders = this.data.orders;
    
    // Active orders in flight
    const activeOrders = orders.filter(o => o.status !== 'settled');
    const totalPipelineValue = activeOrders.reduce((sum, o) => sum + o.totalInvoiceAmount, 0);
    
    const kpiActiveCount = document.getElementById('kpi-active-count');
    const kpiActiveValue = document.getElementById('kpi-active-value');
    if (kpiActiveCount) kpiActiveCount.innerText = `${activeOrders.length} Active Batches`;
    if (kpiActiveValue) kpiActiveValue.innerText = this.formatCurrency(totalPipelineValue);

    // Urgent Action Items Engine & Badges
    const urgentItems = this.getUrgentActionItems();
    const urgentBanner = document.getElementById('urgent-action-banner');
    const sidebarUrgentBadge = document.getElementById('sidebar-urgent-badge');
    const sidebarAdvanceBadge = document.getElementById('sidebar-advance-badge');

    const unassignedAdvances = orders.filter(o => o.status === 'action_needed');
    const totalUnassignedAdvance = unassignedAdvances.reduce((sum, o) => sum + o.customerAdvanceReceived, 0);
    
    const kpiAdvanceCount = document.getElementById('kpi-advance-count');
    const kpiAdvanceValue = document.getElementById('kpi-advance-value');
    if (kpiAdvanceCount) kpiAdvanceCount.innerText = `${unassignedAdvances.length} Need Action`;
    if (kpiAdvanceValue) kpiAdvanceValue.innerText = this.formatCurrency(totalUnassignedAdvance);

    if (sidebarUrgentBadge) {
      sidebarUrgentBadge.innerText = urgentItems.length;
      if (urgentItems.length > 0) {
        sidebarUrgentBadge.classList.remove('hidden');
      } else {
        sidebarUrgentBadge.classList.add('hidden');
      }
    }

    if (sidebarAdvanceBadge) {
      const poNeeded = urgentItems.filter(x => x.type === 'po_needed');
      if (poNeeded.length > 0) {
        sidebarAdvanceBadge.innerText = poNeeded.length;
        sidebarAdvanceBadge.classList.remove('hidden');
      } else {
        sidebarAdvanceBadge.classList.add('hidden');
      }
    }

    // Dashboard Home Urgent Banner Display
    if (urgentBanner) {
      if (this.isUrgentAlertHidden || urgentItems.length === 0) {
        urgentBanner.classList.add('hidden');
        urgentBanner.innerHTML = tfSanitizeHtml('');
      } else {
        const topItem = urgentItems[0];
        urgentBanner.classList.remove('hidden');
        urgentBanner.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl relative transition-all">
            <div class="flex items-center gap-3 pr-2">
              <span class="flex h-3 w-3 shrink-0 rounded-full bg-amber-500 animate-urgent"></span>
              <div>
                <p class="text-sm font-bold text-amber-900 dark:text-amber-200">
                  ${tfEscapeHtml(topItem.title)}: ${tfEscapeHtml(topItem.description)}
                </p>
                <p class="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5 flex items-center gap-2">
                  <span class="font-mono-num">${tfEscapeHtml(topItem.timeFormatted)}</span>
                  <span>•</span>
                  <span>${tfEscapeHtml(urgentItems.length > 1 ? `+${urgentItems.length - 1} other urgent matter${urgentItems.length > 2 ? 's' : ''}` : 'Action required immediately')}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button onclick="${tfEscapeHtml(topItem.actionCallback)}" class="btn-tactile px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1.5">
                <span>${tfEscapeHtml(topItem.actionLabel)}</span>
              </button>
              ${urgentItems.length > 1 ? `
                <button onclick="app.openUrgentActionsModal()" class="btn-tactile px-3 py-2 text-xs font-bold text-amber-900 dark:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg whitespace-nowrap flex items-center gap-1">
                  <span>View All (${tfEscapeHtml(urgentItems.length)})</span>
                </button>
              ` : ''}
              <button onclick="app.toggleUrgentAlertBanner()" class="btn-tactile px-2.5 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg flex items-center gap-1.5 transition-colors" title="Hide this alert on dashboard">
                <i data-lucide="eye-off" class="w-3.5 h-3.5"></i>
                <span class="hidden sm:inline">Hide</span>
              </button>
            </div>
          </div>
        `;
      }
    }

    // Receivables
    const totalReceivables = orders.reduce((sum, o) => sum + (o.customerBalanceDue || 0), 0);
    const overdueOrders = orders.filter(o => o.status === 'delivered_overdue' || (new Date(o.dueDate) < new Date() && o.customerBalanceDue > 0));
    
    const kpiReceivables = document.getElementById('kpi-receivables-value');
    const kpiOverdueSub = document.getElementById('kpi-overdue-sub');
    if (kpiReceivables) kpiReceivables.innerText = this.formatCurrency(totalReceivables);
    if (kpiOverdueSub) {
      kpiOverdueSub.innerText = `${overdueOrders.length} Overdue (${this.formatCurrency(overdueOrders.reduce((s, o) => s + o.customerBalanceDue, 0))})`;
    }

    // Vendor Payables
    let totalVendorPayables = 0;
    orders.forEach(o => {
      const mfgDue = Math.max(0, o.manufacturerTotalCost - o.manufacturerAdvancePaid - (o.damageDeductedFrom === 'manufacturer' ? o.damageAmount : 0));
      const pkgDue = Math.max(0, o.packagingCost - o.packagingAdvancePaid);
      totalVendorPayables += (mfgDue + pkgDue);
    });

    const kpiPayables = document.getElementById('kpi-payables-value');
    if (kpiPayables) kpiPayables.innerText = this.formatCurrency(totalVendorPayables);

    // Operational Throughput Cards
    const workingOrders = orders.filter(o => o.status === 'in_production' || o.status === 'in_transit');
    const inBottling = orders.filter(o => o.status === 'in_production').length;
    const inTransit = orders.filter(o => o.status === 'in_transit').length;
    const upcomingOrders = orders.filter(o => o.status === 'action_needed');
    const completedOrders = orders.filter(o => o.status === 'settled' || o.status === 'delivered_overdue');

    const kpiWorkingCount = document.getElementById('kpi-working-count');
    const kpiWorkingSub = document.getElementById('kpi-working-sub');
    const setText = (id, text) => { const el = document.getElementById(id); if (el) { el.textContent = text; el.title = text; } };
    const ordersLink = n => n ? `View ${n} order${n === 1 ? '' : 's'}` : 'No orders yet';
    const advanceIdle = upcomingOrders.reduce((t, o) => t + (Number(o.customerAdvanceReceived) || 0), 0);
    const settledCount = completedOrders.filter(o => o.status === 'settled').length;
    const payPending = completedOrders.length - settledCount;
    if (kpiWorkingCount) kpiWorkingCount.textContent = String(workingOrders.length);
    setText('kpi-working-sub', `${inBottling} bottling · ${inTransit} in transit`);
    setText('kpi-working-link', ordersLink(workingOrders.length));

    const kpiUpcomingCount = document.getElementById('kpi-upcoming-count');
    if (kpiUpcomingCount) kpiUpcomingCount.textContent = String(upcomingOrders.length);
    setText('kpi-upcoming-sub', upcomingOrders.length ? `${this.formatCurrency(advanceIdle)} advance waiting` : 'Nothing waiting');
    setText('kpi-upcoming-link', ordersLink(upcomingOrders.length));

    const kpiCompletedCount = document.getElementById('kpi-completed-count');
    if (kpiCompletedCount) kpiCompletedCount.textContent = String(completedOrders.length);
    setText('kpi-completed-sub', payPending ? `${settledCount} settled · ${payPending} payment due` : `${settledCount} delivered and settled`);
    setText('kpi-completed-link', ordersLink(completedOrders.length));

    const kpiFinanceRecv = document.getElementById('kpi-finance-recv');
    const kpiFinancePay = document.getElementById('kpi-finance-pay');
    if (kpiFinanceRecv) kpiFinanceRecv.innerText = this.formatCurrency(totalReceivables);
    if (kpiFinancePay) kpiFinancePay.innerText = this.formatCurrency(totalVendorPayables);

    // Quick Filter Chips Counts
    const missingLrCount = orders.filter(o => (o.status === 'in_transit' || o.status === 'delivered_overdue') && !o.lrNumber).length;
    const overdueCount = overdueOrders.length;
    const idleCount = orders.filter(o => o.status === 'action_needed' && o.customerAdvanceReceived > 0 && !o.manufacturerAdvancePaid).length;
    const highMarginCount = orders.filter(o => {
      const rev = o.totalInvoiceAmount || 0;
      if (rev <= 0) return false;
      const profit = o.netProfit !== undefined ? o.netProfit : (rev - (o.totalDirectCosts || 0));
      return (profit / rev) >= 0.18;
    }).length;

    const chipMissingLr = document.getElementById('chip-count-missing-lr');
    const chipOverdue = document.getElementById('chip-count-overdue');
    const chipIdle = document.getElementById('chip-count-idle');
    const chipMargin = document.getElementById('chip-count-margin');
    if (chipMissingLr) chipMissingLr.innerText = missingLrCount;
    if (chipOverdue) chipOverdue.innerText = overdueCount;
    if (chipIdle) chipIdle.innerText = idleCount;
    if (chipMargin) chipMargin.innerText = highMarginCount;
  }

  renderActiveView() {
    const views = ['orders', 'finance', 'payments', 'vault', 'manufacturers', 'packaging', 'transport', 'retailers', 'marketeers', 'products', 'profile', 'order-detail', 'contact-detail', 'order-edit', 'daily-diary', 'exceptions', 'executive-hub'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.toggle('hidden', v !== this.activeTab);
    });

    if (this.activeTab === 'orders') this.renderOrdersTable();
    if (this.activeTab === 'finance') this.renderFinanceView();
    if (this.activeTab === 'payments') this.renderPaymentsLedger();
    if (this.activeTab === 'vault') this.renderVaultView();
    if (this.activeTab === 'manufacturers') this.renderManufacturersView();
    if (this.activeTab === 'packaging') this.renderPackagingView();
    if (this.activeTab === 'transport') this.renderTransportView();
    if (this.activeTab === 'retailers') this.renderRetailersView();
    if (this.activeTab === 'marketeers') this.renderMarketeersView();
    if (this.activeTab === 'products') this.renderProductsGrid();
    if (this.activeTab === 'profile') this.populateProfileForm();
    if (this.activeTab === 'order-detail') this.renderOrderDetailView(this.activeOrderId);
    if (this.activeTab === 'contact-detail') this.renderContactDetailView(this.activeContactId);
    if (this.activeTab === 'order-edit') this.renderOrderEditView(this.activeEditOrderId);
    if (this.activeTab === 'daily-diary') this.renderDailyDiaryWorkspaceView();
    if (this.activeTab === 'exceptions') this.renderExceptionsView();
    if (this.activeTab === 'executive-hub') this.renderCompanyExecutiveHubWorkspace();

    if (window.lucide) window.lucide.createIcons();
  }

  // View: Orders Pipeline
  // statusOverride lets the pill counts use the exact same rules as the table (quick chip and search included).
  getFilteredOrders(statusOverride, skipSort = false) {
    const statusFilter = statusOverride !== undefined ? statusOverride : this.statusFilter;
    const filtered = this.data.orders.filter(order => {
      if (order.isDeleted) return false;
      // 1. Commercial Quick-Filter Chip Logic
      if (this.quickFilterChip) {
        if (this.quickFilterChip === 'missing_lr') {
          if (!((order.status === 'in_transit' || order.status === 'delivered_overdue') && (!order.lrNumber || order.lrNumber === 'PENDING-DISPATCH'))) {
            return false;
          }
        } else if (this.quickFilterChip === 'overdue_accounts') {
          const isOverdue = order.status === 'delivered_overdue' || (new Date(order.dueDate) < new Date() && (order.customerBalanceDue || 0) > 0);
          if (!isOverdue) return false;
        } else if (this.quickFilterChip === 'advance_idle') {
          const isIdle = order.status === 'action_needed' && (order.customerAdvanceReceived || 0) > 0 && !(order.manufacturerAdvancePaid > 0);
          if (!isIdle) return false;
        } else if (this.quickFilterChip === 'high_margin') {
          const rev = order.totalInvoiceAmount || 0;
          if (rev <= 0) return false;
          const profit = order.netProfit !== undefined ? order.netProfit : (rev - (order.totalDirectCosts || 0));
          if ((profit / rev) < 0.18) return false;
        }
      }

      // 2. Status Filter Logic
      if (statusFilter !== 'all') {
        if (statusFilter === 'working') {
          if (order.status !== 'in_production' && order.status !== 'in_transit') return false;
        } else if (statusFilter === 'completed') {
          if (order.status !== 'settled' && order.status !== 'delivered_overdue') return false;
        } else if (statusFilter === 'action_needed' && order.status !== 'action_needed') {
          return false;
        } else if (statusFilter === 'in_production' && order.status !== 'in_production') {
          return false;
        } else if (statusFilter === 'in_transit' && order.status !== 'in_transit') {
          return false;
        } else if (statusFilter === 'delivered_overdue' && order.status !== 'delivered_overdue') {
          return false;
        } else if (statusFilter === 'settled' && order.status !== 'settled') {
          return false;
        }
      }

      if (this.searchQuery) {
        const tokens = this.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return true;

        const retailer = this.data.contacts.find(c => c.id === order.retailerId);
        const mfg = this.data.contacts.find(c => c.id === order.manufacturerId);
        const transporter = this.data.contacts.find(c => c.id === order.transporterId);
        const marketeer = this.data.contacts.find(c => c.id === order.marketeerId);

        const itemsString = (order.items || []).map(i => `${i.name || ''} ${i.variant || ''} ${i.packSize || ''} ${i.shortName || ''}`).join(' ');
        
        const corpus = [
          order.invoiceNumber,
          order.retailerName,
          order.status,
          order.paymentTerms,
          order.lrNumber || '',
          order.vehicleNumber || '',
          order.destination || '',
          order.shippingAddress || '',
          retailer ? `${retailer.name} ${retailer.phone} ${retailer.gstin} ${retailer.contactPerson} ${retailer.billingAddress || ''} ${retailer.city || ''}` : '',
          mfg ? `${mfg.name} ${mfg.phone} ${mfg.contactPerson} ${mfg.city || ''}` : '',
          marketeer ? `${marketeer.name} ${marketeer.phone}` : '',
          transporter ? `${transporter.name} ${transporter.phone}` : '',
          itemsString
        ].join(' ').toLowerCase();

        return tokens.every(token => corpus.includes(token));
      }
      return true;
    });

    if (skipSort) return filtered;
    // Apply multi-column sort
    const sf = this.ordersSortField || 'date';
    const sd = this.ordersSortDirection || 'desc';
    const statusPriority = { action_needed: 0, in_production: 1, in_transit: 2, delivered_overdue: 3, settled: 4 };

    filtered.sort((a, b) => {
      let valA, valB;
      if (sf === 'date') {
        valA = new Date(a.date || 0).getTime();
        valB = new Date(b.date || 0).getTime();
      } else if (sf === 'invoice') {
        valA = (a.invoiceNumber || '').toLowerCase();
        valB = (b.invoiceNumber || '').toLowerCase();
        return sd === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sf === 'retailer') {
        valA = (a.retailerName || '').toLowerCase();
        valB = (b.retailerName || '').toLowerCase();
        return sd === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (sf === 'quantity') {
        valA = (a.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
        valB = (b.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
      } else if (sf === 'amount') {
        valA = Number(a.totalInvoiceAmount) || 0;
        valB = Number(b.totalInvoiceAmount) || 0;
      } else if (sf === 'status') {
        valA = statusPriority[a.status] ?? 99;
        valB = statusPriority[b.status] ?? 99;
      } else {
        valA = new Date(a.date || 0).getTime();
        valB = new Date(b.date || 0).getTime();
      }
      return sd === 'asc' ? valA - valB : valB - valA;
    });

    return filtered;
  }

  setOrdersPage(page) {
    this.ordersPage = page;
    this.renderOrdersTable();
  }

  setOrderSearchQuery(query) {
    this.searchQuery = (query || '').trim();
    this.ordersPage = 1;
    const clearBtn = document.getElementById('orders-search-clear');
    if (clearBtn) {
      if (this.searchQuery) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }
    const globalInput = document.getElementById('global-search');
    if (globalInput && globalInput.value !== this.searchQuery) {
      globalInput.value = this.searchQuery;
    }
    this.renderOrdersTable();
  }

  clearOrderSearchQuery() {
    const input = document.getElementById('orders-inline-search');
    if (input) input.value = '';
    this.setOrderSearchQuery('');
  }

  renderOrdersTable() {
    const tbody = document.getElementById('orders-table-body');
    const paginationBar = document.getElementById('orders-pagination-bar');
    if (!tbody) return;

    // Update sortable column indicators
    const sortFields = ['invoice', 'date', 'retailer', 'quantity', 'amount', 'status'];
    sortFields.forEach(f => {
      const el = document.getElementById(`sort-icon-${f}`);
      if (!el) return;
      if (this.ordersSortField === f) {
        el.className = 'text-amber-500 font-bold ml-1 text-xs';
        el.innerText = this.ordersSortDirection === 'asc' ? '↑' : '↓';
      } else {
        el.className = 'text-slate-400 dark:text-slate-500 font-normal ml-0.5 text-xs opacity-60';
        el.innerText = '⇅';
      }
    });

    const filtered = this.getFilteredOrders();
    this.updateFilterCounts();
    this.renderActiveOrderFilters();
    const totalOrders = filtered.length;
    const pageSize = this.ordersPageSize || 15;
    const totalPages = Math.ceil(totalOrders / pageSize) || 1;
    const currentPage = Math.min(Math.max(1, this.ordersPage || 1), totalPages);
    this.ordersPage = currentPage;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalOrders);

    if (totalOrders === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-12 text-slate-400 dark:text-slate-500">
            <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600"></i>
            <p class="text-sm font-medium">${tfEscapeHtml(this.emptyOrdersMessage())}</p>
            ${(this.searchQuery || this.quickFilterChip || this.statusFilter !== 'all') ? `<button type="button" class="tf-btn tf-btn--sm" style="margin-top:12px" onclick="app.clearAllOrderFilters()">Clear filters</button>` : ''}
          </td>
        </tr>
      `;
      if (paginationBar) paginationBar.innerHTML = '<span class="text-xs text-slate-400">0 orders found</span>';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const pagedOrders = filtered.slice(startIndex, endIndex);

    tbody.innerHTML = pagedOrders.map(order => {
      const mfg = this.data.contacts.find(c => c.id === order.manufacturerId);
      const totalCases = (order.items || []).reduce((sum, i) => sum + (i.cases || Math.ceil((i.quantity || 0) / (i.casePack || this.casePackConfig[i.packSize] || this.config().defaultCasePack))), 0);
      const totalJars = (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
      const varCount = (order.items || []).length;
      const caseWord = totalCases === 1 ? 'Case' : 'Cases';
      const jarWord = totalJars === 1 ? 'jar' : 'jars';
      const itemsSummary = `${varCount === 1 ? '1 Variety' : `${varCount} Varieties`} • ${totalCases} ${caseWord} (${totalJars.toLocaleString('en-IN')} ${jarWord})`;
      
      let statusBadge = '';
      if (order.status === 'action_needed') {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Action Needed
        </span>`;
      } else if (order.status === 'in_production') {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 shadow-2xs whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> In Production
        </span>`;
      } else if (order.status === 'in_transit') {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shadow-2xs whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span> In Transit
        </span>`;
      } else if (order.status === 'delivered_overdue') {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 shadow-2xs whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Overdue Balance
        </span>`;
      } else {
        statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs whitespace-nowrap">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Settled
        </span>`;
      }

      const advancePercent = Math.round((order.customerAdvanceReceived / order.totalInvoiceAmount) * 100);
      const hasInvoice = true;
      const hasPay = (order.customerAdvanceReceived || 0) > 0 || (this.data.payments || []).some(p => p.orderRef === order.invoiceNumber || p.orderRef === order.id);
      const hasBilty = !!(order.lrNumber && order.lrNumber !== 'PENDING');
      const hasPod = !!(order.deliveryDate || order.status === 'delivered_overdue' || order.status === 'settled');

      const docChips = `
        <div class="flex items-center gap-1 mt-1 text-xs font-mono">
          <span class="px-1.5 py-0.2 rounded font-bold ${tfEscapeHtml(hasInvoice ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 border border-slate-200 dark:border-slate-700')}" title="Invoice">INV</span>
          <span class="px-1.5 py-0.2 rounded font-bold ${tfEscapeHtml(hasPay ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 border border-slate-200 dark:border-slate-700')}" title="Payment Proof">PAY</span>
          <span class="px-1.5 py-0.2 rounded font-bold ${tfEscapeHtml(hasBilty ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 border border-slate-200 dark:border-slate-700')}" title="LR / Bilty">LR</span>
          <span class="px-1.5 py-0.2 rounded font-bold ${tfEscapeHtml(hasPod ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 border border-slate-200 dark:border-slate-700')}" title="Delivery / POD">POD</span>
        </div>
      `;

      return `
        <tr onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(order.id))}', event)" class="hover:bg-amber-500/5 dark:hover:bg-amber-500/10 cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors group" title="Click anywhere to inspect full order details">
          <td class="px-4 py-3.5 whitespace-nowrap">
            <div class="flex items-center gap-1.5">
              <span class="font-mono-num font-bold text-sm text-emerald-700 dark:text-emerald-400 group-hover:underline whitespace-nowrap">${tfEscapeHtml(order.invoiceNumber)}</span>
              ${order.urgentAlert ? '<span class="text-amber-500 font-bold" title="' + order.urgentAlert + '"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 inline-block align-[-2px]"></i></span>' : ''}
            </div>
            <div class="text-xs text-slate-400 font-mono-num whitespace-nowrap">${tfEscapeHtml(this.formatDate(order.date))}</div>
          </td>

          <td class="px-4 py-3.5">
            <button type="button" onclick="event.stopPropagation(); app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(order.retailerName || ''))}')" class="font-bold text-xs text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline transition-colors leading-snug inline-flex items-center gap-1 group text-left" title="Click to view Buyer account & order history">
              <span>${tfEscapeHtml(order.retailerName)}</span>
              <i data-lucide="arrow-up-right" class="w-3 h-3 opacity-0 group-hover:opacity-100 text-amber-500 shrink-0"></i>
            </button>
            ${docChips}
          </td>

          <td class="px-4 py-3.5 whitespace-nowrap">
            <div class="text-xs font-bold font-mono-num text-slate-800 dark:text-slate-200">${tfEscapeHtml(totalCases)} ${tfEscapeHtml(caseWord)}</div>
            <div class="text-xs text-slate-400 font-normal">(${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} ${tfEscapeHtml(jarWord)})</div>
          </td>

          <td class="px-4 py-3.5 text-right font-mono-num whitespace-nowrap">
            <div class="text-sm font-bold text-slate-900 dark:text-slate-100">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</div>
          </td>

          <td class="px-4 py-3.5 text-center whitespace-nowrap">
            ${statusBadge}
          </td>

          <td class="px-4 py-3.5 text-right whitespace-nowrap">
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-700 transition-colors">
              <span>Details</span>
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </span>
          </td>
        </tr>
      `;
    }).join('');

    if (paginationBar) {
      paginationBar.innerHTML = `
        <span class="text-xs text-slate-500 dark:text-slate-400">Showing <strong>${tfEscapeHtml(startIndex + 1)}-${tfEscapeHtml(endIndex)}</strong> of <strong>${tfEscapeHtml(totalOrders)}</strong> batches</span>
        <div class="flex items-center gap-1.5">
          <button onclick="app.setOrdersPage(${tfEscapeHtml(currentPage - 1)})" class="btn-tactile px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 font-semibold ${tfEscapeHtml(currentPage <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}" ${tfEscapeHtml(currentPage <= 1 ? 'disabled' : '')}>Previous</button>
          <span class="px-2 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">${tfEscapeHtml(currentPage)} / ${tfEscapeHtml(totalPages)}</span>
          <button onclick="app.setOrdersPage(${tfEscapeHtml(currentPage + 1)})" class="btn-tactile px-2.5 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 font-semibold ${tfEscapeHtml(currentPage >= totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 dark:hover:bg-slate-800')}" ${tfEscapeHtml(currentPage >= totalPages ? 'disabled' : '')}>Next</button>
        </div>
      `;
    }

    this.updateFilterCounts();
    if (window.lucide) window.lucide.createIcons();
    this.enableTableResizing('orders-master-table');
  }

  // Pill counts = what the table will show after clicking that pill (same chip and search rules).
  updateFilterCounts() {
    const setBadge = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.innerText = count;
    };
    for (const status of ['all', 'action_needed', 'in_production', 'in_transit', 'delivered_overdue']) {
      setBadge('filter-count-' + status, this.getFilteredOrders(status, true).length);
    }
  }

  // Search word and quick chip are easy to forget: show them above the table with a way to clear each.
  renderActiveOrderFilters() {
    const table = document.getElementById('orders-table-body');
    const shell = table && table.closest('.tf-orders-table-shell, table');
    if (!shell) return;
    let bar = document.getElementById('orders-active-filters');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'orders-active-filters';
      bar.className = 'tf-active-filters';
      shell.parentElement.insertBefore(bar, shell);
    }
    const chipNames = { missing_lr: 'Missing LR', overdue_accounts: 'Overdue accounts', advance_idle: 'Advance idle (PO pending)', high_margin: 'High margin (>18%)' };
    const parts = [];
    if (this.searchQuery) parts.push(`<button type="button" class="tf-af-chip" onclick="app.setOrderSearchQuery(''); app.renderOrdersTable()" title="Remove this search">Search: “${tfEscapeHtml(this.searchQuery)}”<i data-lucide="x" class="w-3.5 h-3.5"></i></button>`);
    if (this.quickFilterChip) parts.push(`<button type="button" class="tf-af-chip" onclick="app.clearQuickFilterChip()" title="Remove this filter">${tfEscapeHtml(chipNames[this.quickFilterChip] || this.quickFilterChip)}<i data-lucide="x" class="w-3.5 h-3.5"></i></button>`);
    bar.hidden = !parts.length;
    bar.innerHTML = parts.length ? `<span class="tf-af-label">Filtered by</span>${parts.join('')}<button type="button" class="tf-af-clear" onclick="app.clearAllOrderFilters()">Clear all</button>` : '';
    const inline = document.getElementById('orders-inline-search');
    if (inline && document.activeElement !== inline && inline.value !== (this.searchQuery || '')) inline.value = this.searchQuery || '';
    const clearBtn = document.getElementById('orders-search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !this.searchQuery);
  }

  clearAllOrderFilters() {
    this.searchQuery = '';
    const g = document.getElementById('global-search'); if (g) g.value = '';
    this.quickFilterChip = null;
    const clearBtn = document.getElementById('chip-clear-filter');
    if (clearBtn) clearBtn.classList.add('hidden');
    document.querySelectorAll('.tf-chip-filter').forEach(c => c.classList.remove('ring-2', 'ring-emerald-600', 'shadow-xs'));
    this.setOrdersFilter('all');
  }

  /* ---------- DASHBOARD SPLIT RESIZER (ORDERS vs ATTENTION PANEL) ---------- */
  initDashboardSplitResizer() {
    const resizer = document.getElementById('dashboard-split-resizer');
    const auditPanel = document.getElementById('dashboard-audit-panel');
    const container = document.getElementById('dashboard-split-container');
    if (!resizer || !auditPanel || !container) return;

    // Retrieve saved width (default is squeezed ~15%: 325px)
    const savedWidth = localStorage.getItem('tradeflow_audit_panel_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (parsed >= 240 && parsed <= 650 && window.innerWidth >= 1280) {
        auditPanel.style.width = `${parsed}px`;
      }
    }

    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (window.innerWidth < 1280) return; // Only active in split desktop mode

      isDragging = true;
      startX = e.clientX;
      startWidth = auditPanel.getBoundingClientRect().width;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        // Moving left (deltaX > 0) increases audit panel width and reduces orders panel width
        // Moving right (deltaX < 0) reduces audit panel width and expands orders panel width
        const deltaX = startX - moveEvent.clientX;
        let newWidth = startWidth + deltaX;

        const containerWidth = container.getBoundingClientRect().width;
        const maxAllowed = Math.max(280, containerWidth - 450); // Ensure orders table gets at least 450px
        newWidth = Math.max(240, Math.min(newWidth, Math.min(650, maxAllowed)));

        auditPanel.style.width = `${newWidth}px`;
      };

      const onMouseUp = () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        const finalWidth = parseInt(auditPanel.style.width, 10);
        if (finalWidth) {
          localStorage.setItem('tradeflow_audit_panel_width', `${finalWidth}px`);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Double-click on handle resets to default 325px
    resizer.addEventListener('dblclick', () => {
      auditPanel.style.width = '325px';
      localStorage.setItem('tradeflow_audit_panel_width', '325px');
      this.showToast('Panels reset to default split width (325px)');
    });
  }

  // Bottom part of a dashboard card: show exactly those orders in the table below.
  emptyOrdersMessage() {
    const status = { action_needed: 'action-needed', in_production: 'in-production', in_transit: 'in-transit', delivered_overdue: 'overdue', working: 'working', completed: 'completed', settled: 'settled' }[this.statusFilter];
    const what = status ? `No ${status} orders` : 'No orders';
    const why = [];
    if (this.searchQuery) why.push(`match the search “${this.searchQuery}”`);
    if (this.quickFilterChip) why.push('fit the quick filter');
    if (!(this.data.orders || []).some(o => !o.isDeleted)) return 'No orders yet. Create your first order with “New”.';
    return why.length ? `${what} ${why.join(' and ')}.` : `${what} right now.`;
  }

  showKpiOrders(kind) {
    const filter = { working: 'working', upcoming: 'action_needed', completed: 'completed' }[kind] || 'all';
    this.setOrdersFilter(filter);
    // Working and completed have no pill of their own in the filter row: add one, so it is clear what the table shows.
    const allPill = document.querySelector('[data-filter-status="all"]');
    const label = { working: 'Working orders', completed: 'Completed orders' }[kind];
    if (allPill && label) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.id = 'kpi-filter-pill';
      pill.className = 'tf-kpi-pill';
      pill.title = 'Show all orders again';
      pill.innerHTML = `${tfEscapeHtml(label)}<i data-lucide="x" class="w-3.5 h-3.5"></i>`;
      pill.onclick = () => this.setOrdersFilter('all');
      allPill.insertAdjacentElement('afterend', pill);
      allPill.classList.remove('bg-emerald-700', 'text-white', 'dark:bg-emerald-700', 'dark:text-white');
      if (window.lucide) window.lucide.createIcons();
    }
    requestAnimationFrame(() => {
      const box = (allPill && allPill.parentElement && allPill.parentElement.parentElement) || document.getElementById('orders-table-body');
      if (!box) return;
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
      box.classList.remove('tf-flash'); void box.offsetWidth; box.classList.add('tf-flash');
    });
  }

  // Top part of a dashboard card: performance of that group of orders (or of money, for Finance).
  openKpiPerformance(kind) {
    const modal = document.getElementById('kpi-breakdown-modal');
    const bodyEl = document.getElementById('kpi-modal-body');
    if (!modal || !bodyEl) return;
    this.activeKpiType = 'performance:' + kind;
    const esc = v => tfEscapeHtml(String(v ?? ''));
    const num = v => Number(v) || 0;
    const inr = v => this.formatCurrency(num(v));
    const all = (this.data.orders || []).filter(o => !o.isDeleted);
    const groups = {
      working: { title: 'Working orders', icon: 'cog', list: all.filter(o => o.status === 'in_production' || o.status === 'in_transit'), filter: 'working' },
      upcoming: { title: 'Upcoming orders', icon: 'clock', list: all.filter(o => o.status === 'action_needed'), filter: 'action_needed' },
      completed: { title: 'Completed orders', icon: 'circle-check', list: all.filter(o => o.status === 'settled' || o.status === 'delivered_overdue'), filter: 'completed' },
      finance: { title: 'Finance', icon: 'wallet', list: all }
    };
    const g = groups[kind] || groups.working;
    const list = g.list;
    const casesOf = o => (o.items || []).reduce((t, i) => t + num(i.cases), 0);
    const profitOf = o => (o.netProfit !== undefined && o.netProfit !== null) ? num(o.netProfit) : num(o.totalInvoiceAmount) - num(o.totalDirectCosts);
    const value = list.reduce((t, o) => t + num(o.totalInvoiceAmount), 0);
    const profit = list.reduce((t, o) => t + profitOf(o), 0);
    const cases = list.reduce((t, o) => t + casesOf(o), 0);
    const due = list.reduce((t, o) => t + Math.max(0, num(o.customerBalanceDue)), 0);
    const received = Math.max(0, value - due);
    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    const tile = (label, val, hint = '', tone = '') => `<div class="kp-tile ${tone}"><span>${esc(label)}</span><b>${esc(val)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
    const bars = (title, rows, fmt) => {
      const max = Math.max(1, ...rows.map(r => r[1]));
      return `<div class="kp-box"><h4>${esc(title)}</h4>${rows.length ? rows.map(([name, v, extra]) => `<div class="kp-bar"><span class="kp-bar__name" title="${esc(name)}">${esc(name)}</span><span class="kp-bar__track"><span style="width:${Math.max(4, Math.round((v / max) * 100))}%"></span></span><span class="kp-bar__val">${esc(fmt(v))}${extra ? ` <small>${esc(extra)}</small>` : ''}</span></div>`).join('') : '<p class="kp-empty">Nothing to show yet.</p>'}</div>`;
    };
    const top = (keyOf, valOf, n = 5) => {
      const m = new Map();
      for (const o of list) for (const [k, v] of keyOf(o)) if (k) m.set(k, (m.get(k) || 0) + v);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    };
    let html = '';
    let subtitle = '';
    if (kind === 'finance') {
      const today = new Date().toISOString().slice(0, 10);
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const overdue = all.filter(o => num(o.customerBalanceDue) > 0 && o.dueDate && o.dueDate < today && o.status !== 'settled').reduce((t, o) => t + num(o.customerBalanceDue), 0);
      const payable = all.reduce((t, o) => t + Math.max(0, num(o.manufacturerTotalCost) - num(o.manufacturerAdvancePaid) - (o.damageDeductedFrom === 'manufacturer' ? num(o.damageAmount) : 0)) + Math.max(0, num(o.packagingCost) - num(o.packagingAdvancePaid)), 0);
      const pays = (this.data.payments || []).filter(p => !p.isDeleted && p.date >= since);
      const inflow = pays.filter(p => p.direction === 'received').reduce((t, p) => t + num(p.amount), 0);
      const outflow = pays.filter(p => p.direction === 'paid').reduce((t, p) => t + num(p.amount), 0);
      subtitle = `To receive ${inr(due)} · to pay ${inr(payable)}`;
      html = `<div class="kp-tiles">${tile('To receive', inr(due), `${list.filter(o => num(o.customerBalanceDue) > 0).length} orders`)}${tile('Overdue', inr(overdue), 'past due date', overdue > 0 ? 'is-bad' : '')}${tile('To pay', inr(payable), 'factory and packaging')}${tile('Net position', inr(due - payable), due - payable >= 0 ? 'more to receive than to pay' : 'more to pay than to receive', due - payable >= 0 ? 'is-good' : 'is-bad')}${tile('Received, last 30 days', inr(inflow))}${tile('Paid out, last 30 days', inr(outflow))}</div>
        <div class="kp-two">${bars('Who owes you most', top(o => [[o.retailerName, Math.max(0, num(o.customerBalanceDue))]], v => v).filter(r => r[1] > 0), inr)}
        ${bars('Whom you owe most', (() => { const m = new Map(); for (const o of all) { const a = Math.max(0, num(o.manufacturerTotalCost) - num(o.manufacturerAdvancePaid)); const b = Math.max(0, num(o.packagingCost) - num(o.packagingAdvancePaid)); if (a && o.manufacturerName) m.set(o.manufacturerName, (m.get(o.manufacturerName) || 0) + a); if (b && o.packagingVendorName) m.set(o.packagingVendorName, (m.get(o.packagingVendorName) || 0) + b); } return [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5); })(), inr)}</div>`;
    } else {
      const margin = pct(profit, value);
      const avg = list.length ? value / list.length : 0;
      const extra = kind === 'working'
        ? tile('In bottling / in transit', `${list.filter(o => o.status === 'in_production').length} / ${list.filter(o => o.status === 'in_transit').length}`)
        : kind === 'upcoming'
          ? tile('Advance in hand', inr(list.reduce((t, o) => t + num(o.customerAdvanceReceived), 0)), 'waiting for a factory order', 'is-warn')
          : tile('Settled / payment due', `${list.filter(o => o.status === 'settled').length} / ${list.filter(o => o.status !== 'settled').length}`);
      subtitle = `${list.length} ${list.length === 1 ? 'order' : 'orders'} · ${inr(value)}`;
      html = `<div class="kp-tiles">${tile('Order value', inr(value), `${list.length} orders`)}${tile('Profit', inr(profit), `${margin}% margin`, profit >= 0 ? 'is-good' : 'is-bad')}${tile('Cases', cases.toLocaleString('en-IN'), list.length ? `${Math.round(cases / list.length)} per order` : '')}${tile('Average order', inr(avg))}${tile('Received', inr(received), `${pct(received, value)}% of value`)}${extra}</div>
        <div class="kp-two">${bars('Top buyers by value', top(o => [[o.retailerName, num(o.totalInvoiceAmount)]]), inr)}
        ${bars('Top products by cases', top(o => (o.items || []).map(i => [`${i.name || i.shortName || 'Item'}${i.variant ? ' ' + String(i.variant).replace(/ PET Jar$/, '') : ''}`, num(i.cases)])), v => v.toLocaleString('en-IN') + ' cases')}</div>
        ${bars('Profit margin by order', list.slice().sort((a, b) => profitOf(b) / Math.max(1, num(b.totalInvoiceAmount)) - profitOf(a) / Math.max(1, num(a.totalInvoiceAmount))).slice(0, 8).map(o => [`${o.invoiceNumber || o.id} · ${o.retailerName || ''}`, Math.max(0, pct(profitOf(o), num(o.totalInvoiceAmount))), inr(profitOf(o))]), v => v + '%')}`;
    }
    const footer = g.filter
      ? `<div class="kp-foot"><button type="button" class="tf-btn tf-btn--primary tf-btn--sm" onclick="app.closeKpiBreakdownModal(); app.showKpiOrders('${esc(kind)}')">View these orders<i data-lucide="arrow-right" class="w-4 h-4"></i></button></div>`
      : `<div class="kp-foot"><button type="button" class="tf-btn tf-btn--primary tf-btn--sm" onclick="app.closeKpiBreakdownModal(); app.openFinanceCockpitTab()">Open finance tab<i data-lucide="arrow-right" class="w-4 h-4"></i></button></div>`;
    const titleEl = document.getElementById('kpi-modal-title');
    const subtitleEl = document.getElementById('kpi-modal-subtitle');
    const iconContainer = document.getElementById('kpi-modal-icon-container');
    const iconEl = document.getElementById('kpi-modal-icon');
    if (titleEl) titleEl.innerText = `${g.title} · performance`;
    if (subtitleEl) subtitleEl.innerText = subtitle;
    if (iconContainer) iconContainer.className = 'p-2 rounded-xl bg-emerald-500/10 text-emerald-700 border border-emerald-500/20';
    if (iconEl) iconEl.setAttribute('data-lucide', g.icon);
    bodyEl.innerHTML = `<div class="kp">${html}${footer}</div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (window.lucide) window.lucide.createIcons();
  }

  // ================= KPI BREAKDOWN & ACTION MODAL CONTROLLER =================
  openKpiBreakdownModal(metricType) {
    this.activeKpiType = metricType;
    const modal = document.getElementById('kpi-breakdown-modal');
    const titleEl = document.getElementById('kpi-modal-title');
    const subtitleEl = document.getElementById('kpi-modal-subtitle');
    const iconContainer = document.getElementById('kpi-modal-icon-container');
    const iconEl = document.getElementById('kpi-modal-icon');
    const bodyEl = document.getElementById('kpi-modal-body');

    if (!modal || !bodyEl) return;

    if (metricType === 'orders_in_flight') {
      const activeOrders = this.data.orders.filter(o => o.status !== 'settled');
      const totalVal = activeOrders.reduce((s, o) => s + o.totalInvoiceAmount, 0);
      const totalCases = activeOrders.reduce((s, o) => s + (o.items || []).reduce((sum, i) => sum + (i.cases || 0), 0), 0);
      const totalJars = activeOrders.reduce((s, o) => s + (o.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0), 0);

      if (titleEl) titleEl.innerText = 'Active Orders in Flight';
      if (subtitleEl) subtitleEl.innerText = `${activeOrders.length} active production and transit batches • Total Value: ${this.formatCurrency(totalVal)}`;
      if (iconContainer) iconContainer.className = 'p-2 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20';
      if (iconEl) iconEl.setAttribute('data-lucide', 'package-search');

      bodyEl.innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Total In Flight</span>
            <span class="text-lg font-black font-mono-num text-slate-900 dark:text-white mt-0.5 block">${tfEscapeHtml(this.formatCurrency(totalVal))}</span>
            <span class="text-xs text-slate-400">${tfEscapeHtml(activeOrders.length)} Batches</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Master Cases</span>
            <span class="text-lg font-black font-mono-num text-amber-500 mt-0.5 block">${tfEscapeHtml(totalCases)} Cases</span>
            <span class="text-xs text-slate-400">Shipper Cartons</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Bottling Count</span>
            <span class="text-lg font-black font-mono-num text-slate-900 dark:text-white mt-0.5 block">${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} Jars</span>
            <span class="text-xs text-slate-400">Total Units</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Advance In Hand</span>
            <span class="text-lg font-black font-mono-num text-emerald-500 mt-0.5 block">${tfEscapeHtml(this.formatCurrency(activeOrders.reduce((s, o) => s + o.customerAdvanceReceived, 0)))}</span>
            <span class="text-xs text-emerald-600 font-semibold">Credited to Bank</span>
          </div>
        </div>

        <div class="space-y-3 pt-2">
          <div class="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            <span>In-Flight Orders List</span>
            <span>Click any order card to inspect or manage</span>
          </div>
          ${activeOrders.map(order => {
            const mfg = this.data.contacts.find(c => c.id === order.manufacturerId);
            const oCases = (order.items || []).reduce((s, i) => s + (i.cases || 0), 0);
            const oJars = (order.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
            
            let statusBadge = '';
            if (order.status === 'action_needed') {
              statusBadge = `<span class="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30">Action Needed (Advance Recv)</span>`;
            } else if (order.status === 'in_production') {
              statusBadge = `<span class="px-2 py-0.5 text-xs font-bold rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/30">In Production (Factory)</span>`;
            } else if (order.status === 'in_transit') {
              statusBadge = `<span class="px-2 py-0.5 text-xs font-bold rounded-md bg-purple-500/10 text-purple-500 border border-purple-500/30">In Transit (Logistics)</span>`;
            } else {
              statusBadge = `<span class="px-2 py-0.5 text-xs font-bold rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/30">Delivered • Overdue</span>`;
            }

            return `
              <div onclick="app.openInModalOrderDetail('${tfEscapeHtml(tfEscapeJs(order.id))}', 'orders_in_flight');" class="tf-card p-4 space-y-3 hover:border-emerald-600 hover:shadow-md cursor-pointer transition-all group">
                <div class="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-mono-num font-black text-sm text-slate-900 dark:text-white group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order.invoiceNumber)}</span>
                      ${statusBadge}
                      <span class="text-xs text-slate-400">• Created ${tfEscapeHtml(this.formatDate(order.date))}</span>
                    </div>
                    <div class="font-bold text-xs text-slate-800 dark:text-slate-200 mt-1">
                      <span onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.retailerId))}'); app.closeKpiBreakdownModal();" class="hover:underline hover:text-emerald-700 cursor-pointer" title="View Buyer Hub">${tfEscapeHtml(order.retailerName)}</span>
                      <span class="font-normal text-slate-400">• Factory: <span onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.manufacturerId))}'); app.closeKpiBreakdownModal();" class="hover:underline hover:text-blue-400 cursor-pointer" title="View Factory Hub">${tfEscapeHtml(mfg ? mfg.name : 'Manufacturer not set')}</span></span>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="font-mono-num font-black text-sm text-slate-900 dark:text-white block">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
                    <span class="text-xs text-slate-400">Balance Due: <strong class="font-mono-num text-amber-500">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</strong></span>
                  </div>
                </div>

                <div class="flex items-start justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-xs">
                  <div class="flex-1 pr-2">
                    <span class="text-xs font-bold uppercase text-slate-400 block mb-1">SKUs & Varieties:</span>
                    ${this.formatOrderSkuDisplay(order.items, order.id, 'flight')}
                  </div>
                  <div class="flex items-center gap-2 shrink-0 pt-1">
                    <span class="font-mono-num text-xs font-bold text-slate-400 mr-1">${tfEscapeHtml(oCases)} Cases • ${tfEscapeHtml(oJars.toLocaleString('en-IN'))} Jars</span>
                    <button onclick="event.stopPropagation(); app.openInModalOrderDetail('${tfEscapeHtml(tfEscapeJs(order.id))}', 'orders_in_flight');" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-800 dark:text-white rounded-lg flex items-center gap-1 shadow-sm">
                      <span>Inspect Order</span>
                      <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (metricType === 'advance_in_hand') {
      const unassigned = this.data.orders.filter(o => o.status === 'action_needed');
      const totalAdvance = unassigned.reduce((s, o) => s + o.customerAdvanceReceived, 0);

      if (titleEl) titleEl.innerText = 'Idle Advance in Hand — Factory PO Action Required';
      if (subtitleEl) subtitleEl.innerText = `${this.formatCurrency(totalAdvance)} received in advance from buyers • ${unassigned.length} orders need factory dispatch`;
      if (iconContainer) iconContainer.className = 'p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20';
      if (iconEl) iconEl.setAttribute('data-lucide', 'alert-triangle');

      bodyEl.innerHTML = `
        <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
          <span class="flex h-3 w-3 shrink-0 rounded-full bg-amber-500 animate-pulse mt-1"></span>
          <div>
            <h4 class="font-bold text-xs text-amber-900 dark:text-amber-200">Customer Cash Sitting Idle (${tfEscapeHtml(this.formatCurrency(totalAdvance))})</h4>
            <p class="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
              Advances have been received in your bank account, but production job-work has NOT been placed with the manufacturer or packaging suppliers. Issue the Rule 55 Production POs immediately so bottling can commence.
            </p>
          </div>
        </div>

        <div class="space-y-3 pt-2">
          ${unassigned.map(order => {
            const mfg = this.data.contacts.find(c => c.id === order.manufacturerId);
            const totalCases = (order.items || []).reduce((s, i) => s + (i.cases || 0), 0);
            const totalJars = (order.items || []).reduce((s, i) => s + (i.quantity || 0), 0);

            return `
              <div onclick="app.openInModalOrderDetail('${tfEscapeHtml(tfEscapeJs(order.id))}', 'advance_in_hand');" class="tf-card p-4 space-y-3 border-amber-300 dark:border-amber-700/60 hover:border-emerald-600 hover:shadow-md cursor-pointer transition-all group">
                <div class="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-mono-num font-black text-sm text-slate-900 dark:text-white group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order.invoiceNumber)}</span>
                      <span class="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500 text-slate-950">Action Needed</span>
                      <span class="text-xs text-slate-400">• Booked on ${tfEscapeHtml(this.formatDate(order.date))}</span>
                    </div>
                    <h4 class="font-bold text-sm text-slate-900 dark:text-white mt-1">
                      <span onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.retailerId))}'); app.closeKpiBreakdownModal();" class="hover:underline hover:text-emerald-700 cursor-pointer">${tfEscapeHtml(order.retailerName)}</span>
                    </h4>
                    <p class="text-xs text-slate-400 mt-0.5">Target Manufacturer: <strong>${tfEscapeHtml(mfg ? mfg.name : 'Manufacturer not set')}</strong></p>
                  </div>
                  <div class="text-right">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Advance In Hand</span>
                    <span class="text-xl font-black font-mono-num text-emerald-500">${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))}</span>
                    <span class="text-xs text-slate-400 block">Total Order: ${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
                  </div>
                </div>

                <div class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs">
                  <div class="flex items-center justify-between text-slate-500 font-semibold mb-1">
                    <span>${tfEscapeHtml((order.items || []).length)} Varieties Ordered</span>
                    <span class="font-mono-num text-amber-500 font-bold">${tfEscapeHtml(totalCases)} Cases (${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} Jars)</span>
                  </div>
                  <div class="pt-1">
                    ${this.formatOrderSkuDisplay(order.items, order.id, 'advance')}
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button onclick="event.stopPropagation(); app.openInModalOrderDetail('${tfEscapeHtml(tfEscapeJs(order.id))}', 'advance_in_hand');" class="btn-tactile px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
                    Inspect Order
                  </button>
                  <button onclick="event.stopPropagation(); app.openFactoryPOModal('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-4 py-1.5 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 border-2 border-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5">
                    <i data-lucide="factory" class="w-4 h-4"></i>
                    <span>Forward PO to Factory (Rule 55 Challan) →</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (metricType === 'receivables') {
      const unpaidOrders = this.data.orders.filter(o => (o.customerBalanceDue || 0) > 0);
      const totalReceivables = unpaidOrders.reduce((s, o) => s + o.customerBalanceDue, 0);
      const overdueOrders = unpaidOrders.filter(o => o.status === 'delivered_overdue' || new Date(o.dueDate) < new Date());
      const totalOverdue = overdueOrders.reduce((s, o) => s + o.customerBalanceDue, 0);

      if (titleEl) titleEl.innerText = 'Customer Receivables & Overdue Aging Ledger';
      if (subtitleEl) subtitleEl.innerText = `Total Outstanding Due: ${this.formatCurrency(totalReceivables)} • ${overdueOrders.length} Overdue Invoices (${this.formatCurrency(totalOverdue)})`;
      if (iconContainer) iconContainer.className = 'p-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20';
      if (iconEl) iconEl.setAttribute('data-lucide', 'arrow-down-left');

      bodyEl.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Total Receivables</span>
            <span class="text-lg font-black font-mono-num text-slate-900 dark:text-white mt-0.5 block">${tfEscapeHtml(this.formatCurrency(totalReceivables))}</span>
            <span class="text-xs text-slate-400">${tfEscapeHtml(unpaidOrders.length)} Invoices with balance</span>
          </div>
          <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block">Overdue Balance</span>
            <span class="text-lg font-black font-mono-num text-rose-600 dark:text-rose-400 mt-0.5 block">${tfEscapeHtml(this.formatCurrency(totalOverdue))}</span>
            <span class="text-xs text-rose-600 font-semibold">${tfEscapeHtml(overdueOrders.length)} Overdue Invoices</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Current / Upcoming</span>
            <span class="text-lg font-black font-mono-num text-amber-500 mt-0.5 block">${tfEscapeHtml(this.formatCurrency(Math.max(0, totalReceivables - totalOverdue)))}</span>
            <span class="text-xs text-slate-400">Within payment terms</span>
          </div>
        </div>

        <div class="space-y-3 pt-2">
          ${unpaidOrders.map(order => {
            const retailer = this.data.contacts.find(c => c.id === order.retailerId);
            const isOverdue = order.status === 'delivered_overdue' || new Date(order.dueDate) < new Date();
            const daysOverdue = Math.max(1, Math.round((new Date() - new Date(order.dueDate)) / (1000 * 60 * 60 * 24)));

            return `
              <div onclick="app.openInModalOrderDetail('${tfEscapeHtml(tfEscapeJs(order.id))}', 'receivables');" class="tf-card p-4 space-y-3 hover:border-emerald-600 hover:shadow-md cursor-pointer transition-all group ${tfEscapeHtml(isOverdue ? 'border-rose-300 dark:border-rose-900/60' : '')}">
                <div class="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="font-mono-num font-black text-sm text-slate-900 dark:text-white group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order.invoiceNumber)}</span>
                      ${isOverdue 
                        ? `<span class="px-2 py-0.5 text-xs font-bold rounded-md bg-rose-500/15 text-rose-500 border border-rose-500/30 font-mono-num">${tfEscapeHtml(daysOverdue)} Days Overdue</span>`
                        : `<span class="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30">Due in ${tfEscapeHtml(order.paymentTerms || this.config().defaultPaymentTerms)}</span>`
                      }
                      <span class="text-xs text-slate-400">• Due Date: <strong>${tfEscapeHtml(this.formatDate(order.dueDate))}</strong></span>
                    </div>
                    <h4 class="font-bold text-sm text-slate-900 dark:text-white mt-1">
                      <span onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.retailerId))}'); app.closeKpiBreakdownModal();" class="hover:underline hover:text-emerald-700 cursor-pointer">${tfEscapeHtml(order.retailerName)}</span>
                    </h4>
                    <p class="text-xs text-slate-400 mt-0.5">Contact: <strong>${tfEscapeHtml(retailer ? retailer.contactPerson : 'Buyer')}</strong> • Phone: <strong class="font-mono-num">${tfEscapeHtml(retailer ? retailer.phone : '—')}</strong></p>
                  </div>
                  <div class="text-right">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Balance Outstanding Due</span>
                    <span class="text-xl font-black font-mono-num ${tfEscapeHtml(isOverdue ? 'text-rose-500' : 'text-amber-500')}">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</span>
                    <span class="text-xs text-slate-400 block">Total: ${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))} (Adv: ${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))})</span>
                  </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                  <button onclick="event.stopPropagation(); app.openInModalOrderDetail('${tfEscapeHtml(tfEscapeJs(order.id))}', 'receivables');" class="btn-tactile px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg">
                    Inspect Order
                  </button>
                  <button onclick="event.stopPropagation(); app.sendPaymentReminderWhatsApp('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg flex items-center gap-1.5 shadow-sm" title="Open pre-filled WhatsApp reminder">
                    <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                    <span>WhatsApp Reminder</span>
                  </button>
                  <button onclick="event.stopPropagation(); app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-800 dark:text-white rounded-lg flex items-center gap-1.5 shadow-sm">
                    <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                    <span>Record Payment</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (metricType === 'payables') {
      const orders = this.data.orders;
      const mfgs = this.data.contacts.filter(c => c.role === 'manufacturer');
      const pkgs = this.data.contacts.filter(c => c.role === 'packaging');

      let totalMfgDue = 0;
      let totalPkgDue = 0;

      orders.forEach(o => {
        totalMfgDue += Math.max(0, o.manufacturerTotalCost - o.manufacturerAdvancePaid - (o.damageDeductedFrom === 'manufacturer' ? o.damageAmount : 0));
        totalPkgDue += Math.max(0, o.packagingCost - o.packagingAdvancePaid);
      });

      const totalVendorPayables = totalMfgDue + totalPkgDue;

      if (titleEl) titleEl.innerText = 'Vendor Payables & Trade Liabilities Ledger';
      if (subtitleEl) subtitleEl.innerText = `Total Outstanding Trade Liabilities: ${this.formatCurrency(totalVendorPayables)} • Factories & Packaging`;
      if (iconContainer) iconContainer.className = 'p-2 rounded-xl bg-slate-500/10 text-slate-400 border border-slate-500/20';
      if (iconEl) iconEl.setAttribute('data-lucide', 'arrow-up-right');

      bodyEl.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Total Vendor Liabilities</span>
            <span class="text-lg font-black font-mono-num text-slate-900 dark:text-white mt-0.5 block">${tfEscapeHtml(this.formatCurrency(totalVendorPayables))}</span>
            <span class="text-xs text-slate-400">All External Suppliers</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-blue-500 block">Manufacturer Dues</span>
            <span class="text-lg font-black font-mono-num text-blue-500 mt-0.5 block">${tfEscapeHtml(this.formatCurrency(totalMfgDue))}</span>
            <span class="text-xs text-slate-400">${tfEscapeHtml(mfgs.length)} Contract Manufacturers</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-blue-500 block">Packaging Dues</span>
            <span class="text-lg font-black font-mono-num text-blue-500 mt-0.5 block">${tfEscapeHtml(this.formatCurrency(totalPkgDue))}</span>
            <span class="text-xs text-slate-400">Jars, Caps & Labels</span>
          </div>
        </div>

        <div class="space-y-2 pt-3">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
            <i data-lucide="factory" class="w-3.5 h-3.5 text-blue-500"></i>
            <span>Manufacturers (Contract Job-Work)</span>
          </h4>
          ${mfgs.map(mfg => {
            const mfgOrders = orders.filter(o => o.manufacturerId === mfg.id);
            const billed = mfgOrders.reduce((s, o) => s + o.manufacturerTotalCost, 0);
            const paid = mfgOrders.reduce((s, o) => s + o.manufacturerAdvancePaid, 0);
            const balance = Math.max(0, billed - paid);

            return `
              <div onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}'); app.closeKpiBreakdownModal();" class="tf-card p-3.5 flex items-center justify-between flex-wrap gap-3 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group">
                <div>
                  <div class="flex items-center gap-2">
                    <h5 class="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">${tfEscapeHtml(mfg.name)}</h5>
                    <span class="text-xs font-semibold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500">Factory</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5">${tfEscapeHtml(mfg.contactPerson)} • Phone: <span class="font-mono-num">${tfEscapeHtml(mfg.phone)}</span> • Location: ${tfEscapeHtml(mfg.city || '')}</p>
                </div>
                <div class="flex items-center gap-4">
                  <div class="text-right">
                    <span class="text-xs text-slate-400 block">Pending Payable</span>
                    <span class="font-mono-num font-black text-sm ${tfEscapeHtml(balance > 0 ? 'text-rose-500' : 'text-emerald-500')}">${tfEscapeHtml(this.formatCurrency(balance))}</span>
                    <span class="text-xs text-slate-500 block">Paid: ${tfEscapeHtml(this.formatCurrency(paid))}</span>
                  </div>
                  <button onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-3 py-1.5 text-xs font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center gap-1">
                    <span>View Hub</span>
                    <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="space-y-2 pt-3">
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-1">
            <i data-lucide="package" class="w-3.5 h-3.5 text-blue-500"></i>
            <span>Packaging & Bottles Suppliers</span>
          </h4>
          ${pkgs.map(pkg => {
            const pkgOrders = orders.filter(o => o.packagingVendorId === pkg.id);
            const billed = pkgOrders.reduce((s, o) => s + o.packagingCost, 0);
            const paid = pkgOrders.reduce((s, o) => s + o.packagingAdvancePaid, 0);
            const balance = Math.max(0, billed - paid);

            return `
              <div onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}'); app.closeKpiBreakdownModal();" class="tf-card p-3.5 flex items-center justify-between flex-wrap gap-3 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all group">
                <div>
                  <div class="flex items-center gap-2">
                    <h5 class="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">${tfEscapeHtml(pkg.name)}</h5>
                    <span class="text-xs font-semibold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500">Jars & Caps</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5">${tfEscapeHtml(pkg.contactPerson)} • Phone: <span class="font-mono-num">${tfEscapeHtml(pkg.phone)}</span> • Materials Dispatched Direct to Factory</p>
                </div>
                <div class="flex items-center gap-4">
                  <div class="text-right">
                    <span class="text-xs text-slate-400 block">Pending Payable</span>
                    <span class="font-mono-num font-black text-sm ${tfEscapeHtml(balance > 0 ? 'text-amber-500' : 'text-emerald-500')}">${tfEscapeHtml(this.formatCurrency(balance))}</span>
                    <span class="text-xs text-slate-500 block">Paid: ${tfEscapeHtml(this.formatCurrency(paid))}</span>
                  </div>
                  <button onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-3 py-1.5 text-xs font-bold text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg flex items-center gap-1">
                    <span>View Hub</span>
                    <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  // Render Full Order Details directly inside the KPI Breakdown Modal without closing or opening new tabs
  openInModalOrderDetail(orderId, originMetric = 'orders_in_flight') {
    const modal = document.getElementById('kpi-breakdown-modal');
    const titleEl = document.getElementById('kpi-modal-title');
    const subtitleEl = document.getElementById('kpi-modal-subtitle');
    const iconContainer = document.getElementById('kpi-modal-icon-container');
    const iconEl = document.getElementById('kpi-modal-icon');
    const bodyEl = document.getElementById('kpi-modal-body');

    if (!modal || !bodyEl) return;

    this.currentModalOrderId = orderId;
    this.currentModalOriginMetric = originMetric;

    const order = this.findOrder(orderId);
    if (!order) return;

    const retailer = this.data.contacts.find(c => c.id === order.retailerId);
    const mfg = this.data.contacts.find(c => c.id === order.manufacturerId);
    const pkg = this.data.contacts.find(c => c.id === order.packagingVendorId);
    const transporter = this.data.contacts.find(c => c.id === order.transporterId);

    const totalCases = (order.items || []).reduce((sum, i) => sum + (i.cases || 0), 0);
    const totalJars = (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
    const advancePercent = Math.round(((order.customerAdvanceReceived || 0) / (order.totalInvoiceAmount || 1)) * 100);

    // Determine peer orders for instant batch switcher
    let peerOrders = [];
    let originTitle = 'In-Flight Orders';
    if (originMetric === 'advance_in_hand') {
      peerOrders = this.data.orders.filter(o => o.status === 'action_needed');
      originTitle = 'Idle Advance List';
    } else if (originMetric === 'receivables') {
      peerOrders = this.data.orders.filter(o => (o.customerBalanceDue || 0) > 0);
      originTitle = 'Receivables Ledger';
    } else {
      peerOrders = this.data.orders.filter(o => o.status !== 'settled');
      originTitle = 'In-Flight Batches';
    }

    // Ensure currently selected order is present in the switcher list
    if (!peerOrders.some(po => po.id === order.id)) {
      peerOrders.unshift(order);
    }

    if (titleEl) titleEl.innerText = `${order.invoiceNumber} • ${order.retailerName}`;
    if (subtitleEl) subtitleEl.innerText = `In-Modal Inspection • ${totalCases} Cases (${totalJars.toLocaleString('en-IN')} Jars) • Total: ${this.formatCurrency(order.totalInvoiceAmount)}`;
    if (iconContainer) iconContainer.className = 'p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20';
    if (iconEl) iconEl.setAttribute('data-lucide', 'package-check');

    // Status Pill
    let statusPill = '';
    if (order.status === 'action_needed') {
      statusPill = `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Action Needed (Advance in Hand)</span>`;
    } else if (order.status === 'in_production') {
      statusPill = `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-500/15 text-blue-500 border border-blue-500/30 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-blue-500"></span> In Factory Production</span>`;
    } else if (order.status === 'in_transit') {
      statusPill = `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-500/15 text-purple-500 border border-purple-500/30 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-purple-500"></span> In Transit (Logistics)</span>`;
    } else if (order.status === 'delivered_overdue') {
      statusPill = `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span> Delivered • Overdue Balance</span>`;
    } else {
      statusPill = `<span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Settled & Closed</span>`;
    }

    bodyEl.innerHTML = `
      <!-- Navigation & Instant 1-Click Batch Switcher -->
      <div class="space-y-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <button onclick="app.openKpiBreakdownModal('${tfEscapeHtml(tfEscapeJs(originMetric))}')" class="btn-tactile px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            <span>← Back to ${tfEscapeHtml(originTitle)}</span>
          </button>

          <div class="flex items-center gap-2">
            ${statusPill}
            <button onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 bg-slate-100 dark:bg-slate-800/80 rounded-lg flex items-center gap-1" title="Open as permanent workspace tab">
              <span>Full Tab</span>
              <i data-lucide="external-link" class="w-3 h-3"></i>
            </button>
          </div>
        </div>

        <!-- Horizontal Instant Batch Switcher Strip (Zero reload / Zero lost state) -->
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800">
          <div class="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
            <span class="flex items-center gap-1.5">
              <i data-lucide="layers" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Instant Batch Switcher (${tfEscapeHtml(peerOrders.length)} In-Flight Orders)</span>
            </span>
            <span class="text-xs text-slate-400 font-normal lowercase">Click any order chip to switch instantly:</span>
          </div>
          <div class="flex items-center gap-2 overflow-x-auto pb-1.5 tf-scrollbar">
            ${peerOrders.map(po => {
              const isCurrent = po.id === order.id;
              const poCases = (po.items || []).reduce((s, i) => s + (i.cases || 0), 0);
              return `
                <button 
                  onclick="app.openInModalOrderDetail('${tfEscapeHtml(tfEscapeJs(po.id))}', '${tfEscapeHtml(tfEscapeJs(originMetric))}')"
                  class="btn-tactile px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${
                    tfEscapeHtml(isCurrent 
                      ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/50 font-black' 
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700')
                  }"
                  title="Switch to ${tfEscapeHtml(po.invoiceNumber)} (${tfEscapeHtml(po.retailerName)})"
                >
                  <span class="font-mono-num">${tfEscapeHtml(po.invoiceNumber)}</span>
                  <span class="text-xs font-normal ${tfEscapeHtml(isCurrent ? 'text-slate-900' : 'text-slate-400')}">• ${tfEscapeHtml((po.retailerName || '').split(' ')[0])} (${tfEscapeHtml(poCases)} cs)</span>
                  ${isCurrent ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Financial & Volume Metrics Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Total Invoice</span>
          <span class="text-base font-black font-mono-num text-slate-900 dark:text-white mt-0.5 block">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
          <span class="text-xs text-slate-400 font-mono-num">${tfEscapeHtml((order.gstType === 'intra' ? 'Intrastate (' : 'Interstate (') + this.gstLabels(order).combined + ')')}</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Advance In Hand</span>
          <span class="text-base font-black font-mono-num text-emerald-500 mt-0.5 block">${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))}</span>
          <span class="text-xs text-emerald-600 font-semibold">${tfEscapeHtml(advancePercent)}% of Total</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Balance Due</span>
          <span class="text-base font-black font-mono-num ${tfEscapeHtml(order.customerBalanceDue > 0 ? 'text-amber-500' : 'text-emerald-500')} mt-0.5 block">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</span>
          <span class="text-xs text-slate-400">Due: ${tfEscapeHtml(this.formatDate(order.dueDate))}</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Master Cases</span>
          <span class="text-base font-black font-mono-num text-amber-500 mt-0.5 block">${tfEscapeHtml(totalCases)} Cases</span>
          <span class="text-xs text-slate-400">Shipper Cartons</span>
        </div>
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Bottling Units</span>
          <span class="text-base font-black font-mono-num text-slate-900 dark:text-white mt-0.5 block">${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} Jars</span>
          <span class="text-xs text-slate-400">${tfEscapeHtml((order.items || []).length)} Varieties</span>
        </div>
      </div>

      <!-- Connected Supply Chain Partners (4-Grid) -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          <span>Connected Supply Chain Partners</span>
          <span class="text-xs font-normal lowercase">Click hub link to view partner history</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <!-- Buyer -->
          <div onclick="app.navigateToContactFromModal('${tfEscapeHtml(tfEscapeJs(order.retailerId))}', 'kpi-breakdown-modal', '${tfEscapeHtml(tfEscapeJs(order.id))}')" class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-600/70 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between" title="Click to view Buyer account & history">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Buyer / Retailer</span>
                <i data-lucide="building-2" class="w-3.5 h-3.5 text-emerald-500"></i>
              </div>
              <div>
                <h5 class="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order.retailerName)}</h5>
                <p class="text-xs text-slate-400 mt-0.5">${tfEscapeHtml(retailer ? retailer.contactPerson : 'Buyer')}</p>
                <div class="flex items-center justify-between text-xs font-mono-num font-bold text-slate-800 dark:text-slate-200 mt-1">
                  <a href="tel:${tfEscapeHtml(retailer && retailer.phone ? retailer.phone.replace(/[^0-9+]/g, '') : '')}" onclick="event.stopPropagation();" class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline" title="Call ${tfEscapeHtml(order.retailerName)}">
                    <i data-lucide="phone" class="w-3 h-3"></i> <span>${tfEscapeHtml(retailer ? retailer.phone : '—')}</span>
                  </a>
                </div>
                <p class="text-xs font-mono-num text-slate-500 mt-0.5">GST: ${tfEscapeHtml(retailer ? retailer.gstin : '—')}</p>
              </div>
            </div>
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-400 font-bold group-hover:underline mt-2">
              <span class="text-slate-400 font-normal">Terms: ${tfEscapeHtml(order.paymentTerms || 'Net 15')}</span>
              <span class="flex items-center gap-0.5">
                <span>View Hub</span>
                <i data-lucide="arrow-right" class="w-3 h-3"></i>
              </span>
            </div>
          </div>

          <!-- Pickle Factory -->
          <div onclick="app.navigateToContactFromModal('${tfEscapeHtml(tfEscapeJs(order.manufacturerId))}', 'kpi-breakdown-modal', '${tfEscapeHtml(tfEscapeJs(order.id))}')" class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-600/70 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between" title="Click to view Factory profile & active batches">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Manufacturer</span>
                <i data-lucide="factory" class="w-3.5 h-3.5 text-blue-500"></i>
              </div>
              <div>
                <h5 class="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(mfg ? mfg.name : 'Manufacturer')}</h5>
                <p class="text-xs text-slate-400 mt-0.5">${tfEscapeHtml(mfg ? mfg.contactPerson : 'Factory Manager')} • ${tfEscapeHtml(mfg ? mfg.city || 'Gondal' : 'Gujarat')}</p>
                <div class="flex items-center justify-between text-xs font-mono-num font-bold text-slate-800 dark:text-slate-200 mt-1">
                  <a href="tel:${tfEscapeHtml(mfg && mfg.phone ? mfg.phone.replace(/[^0-9+]/g, '') : '')}" onclick="event.stopPropagation();" class="flex items-center gap-1 text-blue-500 dark:text-blue-400 hover:underline" title="Call Factory">
                    <i data-lucide="phone" class="w-3 h-3"></i> <span>${tfEscapeHtml(mfg ? mfg.phone : '—')}</span>
                  </a>
                </div>
                <p class="text-xs font-mono-num text-slate-500 mt-0.5">Job-Work: ${tfEscapeHtml(this.formatCurrency(order.manufacturerTotalCost))}</p>
              </div>
            </div>
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-400 font-bold group-hover:underline mt-2">
              <span class="text-slate-400 font-mono-num font-normal">Adv: ${tfEscapeHtml(this.formatCurrency(order.manufacturerAdvancePaid))}</span>
              <span class="flex items-center gap-0.5">
                <span>View Hub</span>
                <i data-lucide="arrow-right" class="w-3 h-3"></i>
              </span>
            </div>
          </div>

          <!-- Packaging Vendor -->
          <div onclick="app.navigateToContactFromModal('${tfEscapeHtml(tfEscapeJs(order.packagingVendorId))}', 'kpi-breakdown-modal', '${tfEscapeHtml(tfEscapeJs(order.id))}')" class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-600/70 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between" title="Click to view Packaging Vendor & balance">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Packaging Supplier</span>
                <i data-lucide="package" class="w-3.5 h-3.5 text-blue-500"></i>
              </div>
              <div>
                <h5 class="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(pkg ? pkg.name : 'Packaging Vendor')}</h5>
                <p class="text-xs text-slate-400 mt-0.5">${tfEscapeHtml(pkg ? pkg.contactPerson : 'Vendor')} • Jars & Labels</p>
                <div class="flex items-center justify-between text-xs font-mono-num font-bold text-slate-800 dark:text-slate-200 mt-1">
                  <a href="tel:${tfEscapeHtml(pkg && pkg.phone ? pkg.phone.replace(/[^0-9+]/g, '') : '')}" onclick="event.stopPropagation();" class="flex items-center gap-1 text-blue-500 dark:text-blue-400 hover:underline" title="Call Packaging Supplier">
                    <i data-lucide="phone" class="w-3 h-3"></i> <span>${tfEscapeHtml(pkg ? pkg.phone : '—')}</span>
                  </a>
                </div>
                <p class="text-xs font-mono-num text-slate-500 mt-0.5">Cost: ${tfEscapeHtml(this.formatCurrency(order.packagingCost))}</p>
              </div>
            </div>
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-400 font-bold group-hover:underline mt-2">
              <span class="text-slate-400 font-mono-num font-normal">Adv: ${tfEscapeHtml(this.formatCurrency(order.packagingAdvancePaid))}</span>
              <span class="flex items-center gap-0.5">
                <span>View Hub</span>
                <i data-lucide="arrow-right" class="w-3 h-3"></i>
              </span>
            </div>
          </div>

          <!-- Logistics & Transporter -->
          <div onclick="app.navigateToContactFromModal('${tfEscapeHtml(tfEscapeJs(order.transporterId))}', 'kpi-breakdown-modal', '${tfEscapeHtml(tfEscapeJs(order.id))}')" class="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-600/70 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between" title="Click to view Transporter & LR tracker">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Logistics & Freight</span>
                <i data-lucide="truck" class="w-3.5 h-3.5 text-purple-500"></i>
              </div>
              <div>
                <h5 class="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(transporter ? transporter.name : 'Transporter')}</h5>
                <p class="text-xs text-slate-400 mt-0.5 font-mono-num">${tfEscapeHtml(order.lrNumber ? 'LR: ' + order.lrNumber : 'LR: Pending Loading')}</p>
                <div class="flex items-center justify-between text-xs font-mono-num font-bold text-slate-800 dark:text-slate-200 mt-1">
                  <a href="tel:${tfEscapeHtml(transporter && transporter.phone ? transporter.phone.replace(/[^0-9+]/g, '') : '')}" onclick="event.stopPropagation();" class="flex items-center gap-1 text-purple-500 dark:text-purple-400 hover:underline" title="Call Transporter">
                    <i data-lucide="phone" class="w-3 h-3"></i> <span>${tfEscapeHtml(transporter ? transporter.phone : '—')}</span>
                  </a>
                </div>
                <p class="text-xs font-mono-num text-slate-500 mt-0.5">${tfEscapeHtml(order.vehicleNumber || 'Vehicle: Not Assigned')}</p>
              </div>
            </div>
            <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-400 font-bold group-hover:underline mt-2">
              <span class="text-slate-400 font-normal">Freight: ${tfEscapeHtml(this.formatCurrency(order.freightAmount || 0))}</span>
              <span class="flex items-center gap-0.5">
                <span>View Hub</span>
                <i data-lucide="arrow-right" class="w-3 h-3"></i>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Complete SKU Breakdown Table -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        <div class="p-3 px-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h4 class="text-xs font-bold text-slate-900 dark:text-white">SKU & Bottling Line Items</h4>
            <span class="px-2 py-0.5 text-xs font-bold rounded bg-amber-500/10 text-amber-500 font-mono-num">${tfEscapeHtml((order.items || []).length)} SKUs</span>
          </div>
          <span class="text-xs text-slate-400">HSN: ${tfEscapeHtml([...new Set((order.items || []).map(i => this.itemHsn(i)))].join(', ') || '—')} • ${tfEscapeHtml(this.gstLabels(order).total)}</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th class="py-2.5 px-3 w-8 text-center">#</th>
                <th class="py-2.5 px-3 min-w-[160px]">Product</th>
                <th class="py-2.5 px-3 w-20">Pack Size</th>
                <th class="py-2.5 px-3 w-20 text-right">Cases</th>
                <th class="py-2.5 px-3 w-24 text-center">Pack Math</th>
                <th class="py-2.5 px-3 w-24 text-right">Total Jars</th>
                <th class="py-2.5 px-3 w-24 text-right">Unit Rate</th>
                <th class="py-2.5 px-3 w-28 text-right font-black">Line Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              ${(order.items || []).map((item, idx) => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="py-2.5 px-3 text-center text-slate-400 font-mono-num">${tfEscapeHtml(idx + 1)}</td>
                  <td class="py-2.5 px-3">
                    <span class="font-bold text-slate-900 dark:text-white block">${tfEscapeHtml(item.name || item.shortName)}</span>
                    <span class="text-xs text-slate-400">${tfEscapeHtml(item.variant || 'Standard')}</span>
                  </td>
                  <td class="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">${tfEscapeHtml(item.packSize || '500g')}</td>
                  <td class="py-2.5 px-3 text-right font-mono-num font-bold text-amber-500">${tfEscapeHtml(item.cases || 0)}</td>
                  <td class="py-2.5 px-3 text-center text-xs font-mono-num text-slate-400">${tfEscapeHtml(item.casePack || 24)} / cs</td>
                  <td class="py-2.5 px-3 text-right font-mono-num font-bold text-slate-900 dark:text-white">${tfEscapeHtml((item.quantity || 0).toLocaleString('en-IN'))}</td>
                  <td class="py-2.5 px-3 text-right font-mono-num text-slate-600 dark:text-slate-400">${tfEscapeHtml(this.formatCurrency(item.unitRate))}</td>
                  <td class="py-2.5 px-3 text-right font-mono-num font-black text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(item.totalAmount))}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-slate-50 dark:bg-slate-900/80 font-black border-t-2 border-slate-200 dark:border-slate-700 text-xs">
                <td colspan="3" class="py-2.5 px-3 text-right uppercase tracking-wider text-slate-400">Total:</td>
                <td class="py-2.5 px-3 text-right font-mono-num text-amber-500">${tfEscapeHtml(totalCases)} cs</td>
                <td></td>
                <td class="py-2.5 px-3 text-right font-mono-num text-slate-900 dark:text-white">${tfEscapeHtml(totalJars.toLocaleString('en-IN'))}</td>
                <td></td>
                <td class="py-2.5 px-3 text-right font-mono-num text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(order.taxableSubtotal))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- Compact Document Vault Bar -->
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div class="p-3 px-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i data-lucide="archive" class="w-3.5 h-3.5 text-amber-500"></i>
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300">Document Vault</span>
            <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono-num">${tfEscapeHtml((this.data.documents || []).filter(d => d.orderId === order.id).length)} filed</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="app.triggerOrderDocUpload('${tfEscapeHtml(tfEscapeJs(order.id))}', 'bank_receipt')" class="btn-tactile px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg flex items-center gap-1" title="Upload bank proof / receipt">
              <i data-lucide="landmark" class="w-3 h-3"></i> Bank Proof
            </button>
            <button onclick="app.triggerOrderDocUpload('${tfEscapeHtml(tfEscapeJs(order.id))}', 'mfg_invoice')" class="btn-tactile px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-700 rounded-lg flex items-center gap-1" title="Upload factory/vendor invoice">
              <i data-lucide="upload" class="w-3 h-3"></i> Upload Bill
            </button>
          </div>
        </div>
        ${(this.data.documents || []).filter(d => d.orderId === order.id).length > 0 ? `
          <div class="p-2 flex items-center gap-2 overflow-x-auto tf-scrollbar">
            ${(this.data.documents || []).filter(d => d.orderId === order.id).slice(0, 6).map(doc => {
              const meta = doc.metadata || {};
              const icons = { mfg_invoice: 'factory', pkg_invoice: 'package', transport_bilty: 'truck', retailer_invoice: 'building-2', bank_receipt: 'landmark', other: 'file-text' };
              const colors = { mfg_invoice: 'text-blue-500', pkg_invoice: 'text-blue-500', transport_bilty: 'text-purple-500', retailer_invoice: 'text-emerald-500', bank_receipt: 'text-amber-500', other: 'text-slate-400' };
              return `<button onclick="app.previewDocument('${tfEscapeHtml(tfEscapeJs(doc.id))}')" class="btn-tactile shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all text-left min-w-[120px] max-w-[160px]" title="View: ${tfEscapeHtml(doc.fileName)}">
                <i data-lucide="${tfEscapeHtml(icons[doc.category] || 'file-text')}" class="w-3 h-3 ${tfEscapeHtml(colors[doc.category] || 'text-slate-400')} shrink-0"></i>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-slate-900 dark:text-white truncate">${tfEscapeHtml(meta.invoiceNumber || doc.fileName)}</p>
                  <p class="text-xs text-slate-400 truncate">${tfEscapeHtml(meta.totalAmount ? '₹' + Number(meta.totalAmount).toLocaleString('en-IN') : doc.category)}</p>
                </div>
              </button>`;
            }).join('')}
          </div>
        ` : `<p class="text-xs text-slate-400 text-center py-2">No bills filed yet — upload above ↑</p>`}
      </div>

      <!-- Action Buttons Footer inside body -->
      <div class="pt-2 flex items-center justify-between flex-wrap gap-2">
        <button onclick="app.openKpiBreakdownModal('${tfEscapeHtml(tfEscapeJs(originMetric))}')" class="btn-tactile px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
          <span>← Back to In-Flight Batches</span>
        </button>

        <div class="flex items-center gap-2 flex-wrap">
          ${order.status === 'action_needed' ? `
            <button onclick="app.openFactoryPOModal('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-4 py-2 text-xs font-black text-white bg-emerald-700 hover:bg-emerald-800 border-2 border-emerald-700 rounded-lg shadow-sm flex items-center gap-1.5">
              <i data-lucide="factory" class="w-4 h-4"></i>
              <span>Forward Factory PO (Rule 55 Challan) →</span>
            </button>
          ` : ''}

          <button onclick="app.openInvoiceModal('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5" title="Open GST Invoice Dialog">
            <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>GST Invoice</span>
          </button>

          ${order.customerBalanceDue > 0 ? `
            <button onclick="app.sendPaymentReminderWhatsApp('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg flex items-center gap-1.5 shadow-sm" title="Open pre-filled WhatsApp reminder">
              <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
              <span>WhatsApp Reminder</span>
            </button>
            <button onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-800 dark:text-white rounded-lg flex items-center gap-1.5 shadow-sm">
              <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
              <span>Record Payment</span>
            </button>
          ` : ''}

          <button onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.closeKpiBreakdownModal();" class="btn-tactile px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5">
            <span>Open in Full Tab ↗</span>
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    bodyEl.scrollTop = 0;
  }

  closeKpiBreakdownModal() {
    const modal = document.getElementById('kpi-breakdown-modal');
    if (modal) modal.classList.add('hidden');
    this.activeKpiType = null;
    this.currentModalOrderId = null;
    this.currentModalOriginMetric = null;
  }

  sendPaymentReminderWhatsApp(orderId) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return;

    const retailer = this.data.contacts.find(c => c.id === order.retailerId);
    const phone = retailer && retailer.phone ? retailer.phone.replace(/[^0-9]/g, '') : '';
    
    const msg = `Namaste *${order.retailerName}*,\n\nThis is a gentle payment reminder from *${this.config().brand}* regarding GST Tax Invoice *${order.invoiceNumber}* (Dated: ${this.formatDate(order.date)}).\n\n• *Invoice Total:* ${this.formatCurrency(order.totalInvoiceAmount)}\n• *Advance Received:* ${this.formatCurrency(order.customerAdvanceReceived)}\n• *Outstanding Balance Due:* *${this.formatCurrency(order.customerBalanceDue)}*\n• *Due Date:* ${this.formatDate(order.dueDate)}\n\nPlease arrange balance disbursement to our company bank account:\n• *Bank:* ${this.data.businessProfile?.bankName || 'Not set'}\n• *A/C:* ${this.data.businessProfile?.accountNumber || 'Not set'}\n• *IFSC:* ${this.data.businessProfile?.ifsc || 'Not set'}\n\nKindly share the transaction UTR once processed. Thank you!`;

    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  // ================= OPERATIONAL & QUICK FILTER CONTROLLERS =================
  setOrdersFilter(filter) {
    this.statusFilter = filter;
    this.ordersPage = 1;
    const kpiPill = document.getElementById('kpi-filter-pill');
    if (kpiPill) kpiPill.remove();
    this.quickFilterChip = null;
    const clearBtn = document.getElementById('chip-clear-filter');
    if (clearBtn) clearBtn.classList.add('hidden');
    document.querySelectorAll('.tf-chip-filter').forEach(c => c.classList.remove('ring-2', 'ring-emerald-600', 'shadow-xs'));

    document.querySelectorAll('[data-filter-status]').forEach(b => {
      const match = b.getAttribute('data-filter-status') === filter;
      b.classList.toggle('bg-emerald-700', match);
      b.classList.toggle('text-white', match);
      b.classList.toggle('dark:bg-emerald-700', match);
      b.classList.toggle('dark:text-white', match);
      b.classList.toggle('shadow-xs', match);
      ['bg-slate-100', 'text-slate-600', 'dark:bg-slate-800/80', 'dark:text-slate-400'].forEach(c => b.classList.toggle(c, !match));
    });

    if (this.activeTab !== 'orders') {
      this.activeTab = 'orders';
      this.activeWorkspaceTab = 'tab-orders';
      this.renderWorkspaceTabs();
      this.updateSidebarUI();
      this.renderActiveView();
    } else {
      this.renderOrdersTable();
    }
  }

  setQuickFilterChip(chip) {
    if (this.quickFilterChip === chip) {
      this.clearQuickFilterChip();
      return;
    }
    this.quickFilterChip = chip;
    const clearBtn = document.getElementById('chip-clear-filter');
    if (clearBtn) clearBtn.classList.remove('hidden');

    document.querySelectorAll('.tf-chip-filter').forEach(btn => {
      const isCurrent = btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(chip);
      if (isCurrent) {
        btn.classList.add('ring-2', 'ring-emerald-600', 'shadow-xs');
      } else {
        btn.classList.remove('ring-2', 'ring-emerald-600', 'shadow-xs');
      }
    });

    if (this.activeTab !== 'orders') {
      this.activeTab = 'orders';
      this.activeWorkspaceTab = 'tab-orders';
      this.renderWorkspaceTabs();
      this.updateSidebarUI();
      this.renderActiveView();
    } else {
      this.renderOrdersTable();
    }
  }

  clearQuickFilterChip() {
    this.quickFilterChip = null;
    const clearBtn = document.getElementById('chip-clear-filter');
    if (clearBtn) clearBtn.classList.add('hidden');
    document.querySelectorAll('.tf-chip-filter').forEach(c => c.classList.remove('ring-2', 'ring-emerald-600', 'shadow-xs'));
    this.renderOrdersTable();
  }
});
