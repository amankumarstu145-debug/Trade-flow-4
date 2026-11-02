// TradeFlow: Daily diary. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ================= SUGGESTION 5: END-OF-DAY 6:00 PM DAILY DIARY & OPERATOR MODE ================= */
  openDailyDiaryModal(targetDate) {
    const today = new Date().toISOString().split('T')[0];
    const date = targetDate || today;
    this.dailyDiaryWorkspaceDate = date;
    const dateInput = document.getElementById('daily-diary-date');
    if (dateInput) dateInput.value = date;

    this.renderDailyDiary(date);
    const modal = document.getElementById('daily-diary-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeDailyDiaryModal() {
    const modal = document.getElementById('daily-diary-modal');
    if (modal) modal.classList.add('hidden');
  }

  stepDailyDiaryDate(delta) {
    const curDate = this.dailyDiaryWorkspaceDate || document.getElementById('daily-diary-date')?.value || new Date().toISOString().split('T')[0];
    const d = new Date(curDate);
    d.setDate(d.getDate() + delta);
    const newDateStr = d.toISOString().split('T')[0];
    this.setDailyDiaryDate(newDateStr);
  }

  setDailyDiaryDate(dateStr) {
    this.dailyDiaryWorkspaceDate = dateStr;
    const modalDate = document.getElementById('daily-diary-date');
    if (modalDate) modalDate.value = dateStr;
    this.renderDailyDiary(dateStr);
    if (this.activeTab === 'daily-diary') {
      this.renderDailyDiaryWorkspaceView(dateStr);
    }
  }

  openDailyDiaryWorkspaceTab(targetDate) {
    this.closeDailyDiaryModal();
    const today = new Date().toISOString().split('T')[0];
    const date = targetDate || document.getElementById('daily-diary-date')?.value || this.dailyDiaryWorkspaceDate || today;
    this.dailyDiaryWorkspaceDate = date;

    const tabId = 'tab-daily-diary';
    let existingTab = this.openTabs.find(t => t.id === tabId);
    if (!existingTab) {
      existingTab = {
        id: tabId,
        type: 'daily-diary',
        title: 'Daily Business Diary',
        icon: 'book-open',
        closeable: true
      };
      this.openTabs.push(existingTab);
    }
    this.activeWorkspaceTab = tabId;
    this.activeTab = 'daily-diary';
    this.renderWorkspaceTabs();
    this.updateSidebarUI();
    this.renderActiveView();
  }

  renderDailyDiary(dateStr) {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = dateStr || this.dailyDiaryWorkspaceDate || today;
    this.dailyDiaryWorkspaceDate = targetDate;

    const modalDateInput = document.getElementById('daily-diary-date');
    if (modalDateInput && modalDateInput.value !== targetDate) {
      modalDateInput.value = targetDate;
    }

    const payments = this.data.payments || [];
    const orders = this.data.orders || [];

    const dayPayments = payments.filter(p => !p.isDeleted && ((p.date === targetDate) || (p.createdAt && p.createdAt.startsWith(targetDate))));

    const moneyIn = dayPayments.filter(p => p.direction === 'received').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const inCount = dayPayments.filter(p => p.direction === 'received').length;

    const moneyOut = dayPayments.filter(p => p.direction === 'paid').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const outCount = dayPayments.filter(p => p.direction === 'paid').length;

    const netCash = moneyIn - moneyOut;

    const dispatchedOrders = orders.filter(o => !o.isDeleted && (o.status === 'in_transit' || o.status === 'delivered_overdue'));
    const dispatchedValue = dispatchedOrders.reduce((sum, o) => sum + (Number(o.totalInvoiceAmount) || 0), 0);

    const inEl = document.getElementById('diary-money-in');
    const inCountEl = document.getElementById('diary-money-in-count');
    const outEl = document.getElementById('diary-money-out');
    const outCountEl = document.getElementById('diary-money-out-count');
    const netEl = document.getElementById('diary-net-cash');
    const dispCountEl = document.getElementById('diary-dispatched-count');
    const dispValEl = document.getElementById('diary-dispatched-val');

    if (inEl) inEl.innerText = this.formatCurrency(moneyIn);
    if (inCountEl) inCountEl.innerText = `${inCount} receipts logged`;
    if (outEl) outEl.innerText = this.formatCurrency(moneyOut);
    if (outCountEl) outCountEl.innerText = `${outCount} payments made`;
    if (netEl) netEl.innerText = `${netCash >= 0 ? '+' : '-'}${this.formatCurrency(Math.abs(netCash))}`;
    if (dispCountEl) dispCountEl.innerText = `${dispatchedOrders.length} Consignments`;
    if (dispValEl) dispValEl.innerText = `Valued ${this.formatCurrency(dispatchedValue)}`;

    const tbody = document.getElementById('diary-payments-tbody');
    const pill = document.getElementById('diary-payments-pill');
    if (pill) pill.innerText = `${dayPayments.length} entries`;

    if (tbody) {
      if (dayPayments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No payment settlements logged on this date.</td></tr>`;
      } else {
        tbody.innerHTML = dayPayments.map(p => {
          const isRecv = p.direction === 'received';
          const safeParty = (p.partyName || 'Counterparty').replace(/'/g, "\\'");
          const safeOrder = (p.orderRef || '').replace(/'/g, "\\'");
          return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <td class="p-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">${tfEscapeHtml(p.time ? this.formatTime(p.time) : this.formatDate(p.date))}</td>
              <td class="p-2.5">
                <button type="button" onclick="app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(safeParty))}')" class="font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 group text-left" title="Click to inspect partner coordinates & order history">
                  <span>${tfEscapeHtml(p.partyName || 'Counterparty')}</span>
                  <i data-lucide="arrow-up-right" class="w-3 h-3 opacity-60 group-hover:opacity-100 text-amber-500 shrink-0"></i>
                </button>
              </td>
              <td class="p-2.5">
                <span class="px-2 py-0.5 rounded text-xs font-bold ${tfEscapeHtml(isRecv ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300')}">
                  ${tfEscapeHtml(isRecv ? 'Money In' : 'Money Out')}
                </span>
              </td>
              <td class="p-2.5 text-right font-mono font-black ${tfEscapeHtml(isRecv ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}">
                ${tfEscapeHtml(isRecv ? '+' : '-')}${tfEscapeHtml(this.formatCurrency(p.amount))}
              </td>
              <td class="p-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">${tfEscapeHtml(p.mode)} · ${tfEscapeHtml(p.utr || 'Direct')}</td>
              <td class="p-2.5">
                ${p.orderRef ? `
                  <button type="button" onclick="app.openOrderFromDiary('${tfEscapeHtml(tfEscapeJs(safeOrder))}')" class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline inline-flex items-center gap-1 group" title="Click to inspect order ${tfEscapeHtml(p.orderRef)}">
                    <span>${tfEscapeHtml(p.orderRef)}</span>
                    <i data-lucide="external-link" class="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0"></i>
                  </button>
                ` : '<span class="font-mono text-xs text-slate-400">General</span>'}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    const urgList = document.getElementById('diary-urgency-list');
    const overdueOrders = orders.filter(o => !o.isDeleted && (o.customerBalanceDue > 0 || o.status === 'action_needed'));

    if (urgList) {
      if (overdueOrders.length === 0) {
        urgList.innerHTML = `<div class="p-3 text-center text-slate-400 text-xs">All consignments clear! No critical urgencies for tomorrow.</div>`;
      } else {
        urgList.innerHTML = overdueOrders.slice(0, 6).map(o => {
          const safeCust = (o.customerName || o.retailerName || 'Customer').replace(/'/g, "\\'");
          return `
            <div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3 text-xs">
              <div class="flex items-center gap-2 min-w-0">
                <span class="p-1 rounded bg-amber-500/20 text-amber-600 font-bold shrink-0"><i data-lucide="triangle-alert" class="w-4 h-4 inline-block"></i></span>
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <button type="button" onclick="app.openOrderFromDiary('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="font-mono font-black text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 group" title="Click to inspect order ${tfEscapeHtml(o.id)}">
                      <span>${tfEscapeHtml(o.id)}</span>
                      <i data-lucide="external-link" class="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0"></i>
                    </button>
                    <span class="text-slate-400">·</span>
                    <button type="button" onclick="app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(safeCust))}')" class="font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 group text-left truncate" title="Click to view customer profile & history">
                      <span class="truncate">${tfEscapeHtml(o.customerName || o.retailerName || 'Customer')}</span>
                      <i data-lucide="arrow-up-right" class="w-3 h-3 opacity-60 group-hover:opacity-100 text-amber-500 shrink-0"></i>
                    </button>
                  </div>
                  <p class="text-xs text-slate-500 truncate">Balance Pending: <strong class="text-rose-600 dark:text-rose-400 font-mono-num font-bold">${tfEscapeHtml(this.formatCurrency(o.customerBalanceDue || 0))}</strong> · Due: ${tfEscapeHtml(o.dueDate || 'Soon')}</p>
                </div>
              </div>
              <button type="button" onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(o.id))}', '${tfEscapeHtml(tfEscapeJs(safeCust))}', 'received')" class="btn-tactile px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs shrink-0 flex items-center gap-1" title="Log payment collection for this order">
                <i data-lucide="plus" class="w-3 h-3"></i>
                <span>Log Collection</span>
              </button>
            </div>
          `;
        }).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  }

  renderDailyDiaryWorkspaceView(targetDate) {
    const container = document.getElementById('daily-diary-workspace-content');
    if (!container) return;

    const today = new Date().toISOString().split('T')[0];
    const dateStr = targetDate || this.dailyDiaryWorkspaceDate || today;
    this.dailyDiaryWorkspaceDate = dateStr;

    const payments = this.data.payments || [];
    const orders = this.data.orders || [];

    const dayPayments = payments.filter(p => !p.isDeleted && ((p.date === dateStr) || (p.createdAt && p.createdAt.startsWith(dateStr))));

    const moneyIn = dayPayments.filter(p => p.direction === 'received').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const inCount = dayPayments.filter(p => p.direction === 'received').length;

    const moneyOut = dayPayments.filter(p => p.direction === 'paid').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const outCount = dayPayments.filter(p => p.direction === 'paid').length;

    const netCash = moneyIn - moneyOut;

    const dispatchedOrders = orders.filter(o => !o.isDeleted && (o.status === 'in_transit' || o.status === 'delivered_overdue'));
    const dispatchedValue = dispatchedOrders.reduce((sum, o) => sum + (Number(o.totalInvoiceAmount) || 0), 0);

    const overdueOrders = orders.filter(o => !o.isDeleted && (o.customerBalanceDue > 0 || o.status === 'action_needed'));

    const formattedDate = this.formatDateWithDay(dateStr);

    container.innerHTML = `
      <!-- Sticky Workspace Header -->
      <div class="sticky top-[-24px] z-30 -mx-6 px-6 py-3 bg-white dark:bg-[#0c0e14] border-b border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <i data-lucide="book-open" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Daily Business Diary</h1>
              <span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">Evening Closing 6:00 PM</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Complete day ledger, collections, disbursements, dispatches, and next-day collections pipeline</p>
          </div>
        </div>

        <!-- Date Controls & Action Buttons -->
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
            <button type="button" onclick="app.stepDailyDiaryDate(-1)" class="btn-tactile px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded" title="Previous Day">
              <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
            <button type="button" onclick="app.setDailyDiaryDate('${tfEscapeHtml(tfEscapeJs(today))}')" class="btn-tactile px-2.5 py-1 text-xs font-bold ${tfEscapeHtml(dateStr === today ? 'bg-amber-400 text-slate-950 shadow-2xs rounded' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900')}" title="Go to Today">
              Today
            </button>
            <button type="button" onclick="app.stepDailyDiaryDate(1)" class="btn-tactile px-2 py-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded" title="Next Day">
              <i data-lucide="chevron-right" class="w-4 h-4"></i>
            </button>
          </div>

          <input type="date" value="${tfEscapeHtml(dateStr)}" onchange="app.setDailyDiaryDate(this.value)" class="p-1.5 text-xs font-mono font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 outline-none">

          <button type="button" onclick="app.openPaymentModal(null, null, 'received')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 shadow-xs" title="Log new payment settlement">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            <span>Log Payment</span>
          </button>

          <button type="button" onclick="app.sendDailyDiaryToOwnerWhatsApp()" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 shadow-xs" title="Send today's summary to business owner via WhatsApp">
            <i data-lucide="send" class="w-3.5 h-3.5"></i>
            <span>Send to Owner WhatsApp</span>
          </button>

          <button type="button" onclick="window.print()" class="btn-tactile px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1 shadow-2xs" title="Print Diary Ledger">
            <i data-lucide="printer" class="w-3.5 h-3.5 text-slate-500"></i>
            <span class="hidden sm:inline">Print</span>
          </button>

          <button type="button" onclick="app.openDailyDiaryModal('${tfEscapeHtml(tfEscapeJs(dateStr))}')" class="btn-tactile px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1 shadow-2xs" title="Switch to floating popup window">
            <i data-lucide="minimize-2" class="w-3.5 h-3.5 text-amber-500"></i>
            <span class="hidden sm:inline">Popup Mode</span>
          </button>
        </div>
      </div>

      <!-- Date Banner Subtitle -->
      <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800/60 pb-2">
        <span class="font-bold text-slate-700 dark:text-slate-300">Closing Statement for: <strong>${tfEscapeHtml(formattedDate)}</strong></span>
        <span>Auto-synced with TradeFlow General Ledger & Bank Feeds</span>
      </div>

      <!-- 4 Expansive KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Money In -->
        <div class="tf-card p-4 border-l-4 border-emerald-500 space-y-1">
          <span class="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
            <i data-lucide="arrow-down-left" class="w-4 h-4 text-emerald-600"></i>
            <span>Money Received (Collections)</span>
          </span>
          <div class="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono-num">${tfEscapeHtml(this.formatCurrency(moneyIn))}</div>
          <div class="text-xs text-emerald-600/80 font-medium">${tfEscapeHtml(inCount)} customer receipts logged</div>
        </div>

        <!-- Money Out -->
        <div class="tf-card p-4 border-l-4 border-rose-500 space-y-1">
          <span class="text-xs font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
            <i data-lucide="arrow-up-right" class="w-4 h-4 text-rose-600"></i>
            <span>Money Paid Out (Disbursements)</span>
          </span>
          <div class="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono-num">${tfEscapeHtml(this.formatCurrency(moneyOut))}</div>
          <div class="text-xs text-rose-600/80 font-medium">${tfEscapeHtml(outCount)} supplier dispatches paid</div>
        </div>

        <!-- Net Cash Movement -->
        <div class="tf-card p-4 border-l-4 ${tfEscapeHtml(netCash >= 0 ? 'border-blue-500' : 'border-amber-500')} space-y-1">
          <span class="text-xs font-bold ${tfEscapeHtml(netCash >= 0 ? 'text-blue-800 dark:text-blue-300' : 'text-amber-800 dark:text-amber-300')} flex items-center gap-1.5">
            <i data-lucide="wallet" class="w-4 h-4 text-blue-600"></i>
            <span>Net Cash Movement</span>
          </span>
          <div class="text-2xl font-black ${tfEscapeHtml(netCash >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-amber-700 dark:text-amber-400')} font-mono-num">
            ${tfEscapeHtml(netCash >= 0 ? '+' : '-')}${tfEscapeHtml(this.formatCurrency(Math.abs(netCash)))}
          </div>
          <div class="text-xs text-slate-500 font-medium">${tfEscapeHtml(netCash >= 0 ? 'Cash Surplus for Day' : 'Net Cash Outflow')}</div>
        </div>

        <!-- Dispatches -->
        <div class="tf-card p-4 border-l-4 border-amber-500 space-y-1">
          <span class="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
            <i data-lucide="truck" class="w-4 h-4 text-amber-600"></i>
            <span>Goods Dispatched</span>
          </span>
          <div class="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono-num">${tfEscapeHtml(dispatchedOrders.length)} Consignments</div>
          <div class="text-xs text-amber-600/80 font-medium">Valued ${tfEscapeHtml(this.formatCurrency(dispatchedValue))}</div>
        </div>
      </div>

      <!-- Main Two-Column Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Left: Settlements Logged Today (2 Cols Wide) -->
        <div class="lg:col-span-2 space-y-3">
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div class="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <i data-lucide="receipt" class="w-4 h-4 text-emerald-500"></i>
                <h2 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Settlements Logged Today</h2>
                <span class="text-xs font-bold font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">${tfEscapeHtml(dayPayments.length)} logs</span>
              </div>
              <button type="button" onclick="app.openPaymentModal(null, null, 'received')" class="btn-tactile px-2.5 py-1 text-xs font-bold rounded bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 shadow-2xs">
                <i data-lucide="plus" class="w-3 h-3"></i> Log Settlement
              </button>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="bg-slate-100 dark:bg-slate-950 text-xs uppercase font-bold text-slate-500 dark:text-slate-400">
                  <tr>
                    <th class="p-3">Time</th>
                    <th class="p-3">Counterparty (Click to inspect)</th>
                    <th class="p-3">Direction</th>
                    <th class="p-3 text-right">Amount (₹)</th>
                    <th class="p-3">Mode · UTR</th>
                    <th class="p-3">Order Ref</th>
                    <th class="p-3 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  ${dayPayments.length === 0 ? `
                    <tr><td colspan="7" class="p-8 text-center text-slate-400">No payment settlements logged for ${tfEscapeHtml(this.formatDate(dateStr))}.</td></tr>
                  ` : dayPayments.map(p => {
                    const isRecv = p.direction === 'received';
                    const safeParty = (p.partyName || 'Counterparty').replace(/'/g, "\\'");
                    const safeOrder = (p.orderRef || '').replace(/'/g, "\\'");
                    return `
                      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td class="p-3 font-mono text-xs text-slate-500 whitespace-nowrap">${tfEscapeHtml(p.time ? this.formatTime(p.time) : (p.date ? this.formatDate(p.date) : '—'))}</td>
                        <td class="p-3">
                          <button type="button" onclick="app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(safeParty))}')" class="font-bold text-slate-800 dark:text-slate-100 hover:text-emerald-700 hover:underline inline-flex items-center gap-1.5 group text-left" title="Click to view detailed partner profile & ledger">
                            <span>${tfEscapeHtml(p.partyName || 'Counterparty')}</span>
                            <i data-lucide="arrow-up-right" class="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 text-amber-500 shrink-0"></i>
                          </button>
                        </td>
                        <td class="p-3 whitespace-nowrap">
                          <span class="px-2 py-0.5 rounded text-xs font-bold ${tfEscapeHtml(isRecv ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300')}">
                            ${tfEscapeHtml(isRecv ? '↓ Inward' : '↑ Outward')}
                          </span>
                        </td>
                        <td class="p-3 text-right font-mono font-black ${tfEscapeHtml(isRecv ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')} whitespace-nowrap">
                          ${tfEscapeHtml(isRecv ? '+' : '-')}${tfEscapeHtml(this.formatCurrency(p.amount))}
                        </td>
                        <td class="p-3 font-mono text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          ${tfEscapeHtml(p.mode)} · ${tfEscapeHtml(p.utr || 'Direct')}
                        </td>
                        <td class="p-3 whitespace-nowrap">
                          ${p.orderRef ? `
                            <button type="button" onclick="app.openOrderFromDiary('${tfEscapeHtml(tfEscapeJs(safeOrder))}')" class="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline inline-flex items-center gap-1 group" title="Click to view full Order dossier ${tfEscapeHtml(p.orderRef)}">
                              <span>${tfEscapeHtml(p.orderRef)}</span>
                              <i data-lucide="external-link" class="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0"></i>
                            </button>
                          ` : '<span class="font-mono text-xs text-slate-400">General</span>'}
                        </td>
                        <td class="p-3 text-center">
                          <button type="button" onclick="app.openOrderPaymentFullModal('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="p-1 rounded text-slate-400 hover:text-emerald-700" title="Inspect settlement voucher">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Right: Tomorrow's Urgencies & WhatsApp Dispatch Preview (1 Col Wide) -->
        <div class="space-y-4">
          
          <!-- Tomorrow's Urgencies Card -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div class="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="alert-circle" class="w-4 h-4 text-amber-500"></i>
                <span>Tomorrow's Urgencies &amp; Collections</span>
              </h3>
              <span class="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">${tfEscapeHtml(overdueOrders.length)} pending</span>
            </div>
            <div class="p-3 space-y-2.5 max-h-[420px] overflow-y-auto">
              ${overdueOrders.length === 0 ? `
                <div class="p-6 text-center text-slate-400 text-xs">All consignments clear! No pending urgencies for tomorrow.</div>
              ` : overdueOrders.map(o => {
                const safeCust = (o.customerName || o.retailerName || 'Customer').replace(/'/g, "\\'");
                return `
                  <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 text-xs">
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <button type="button" onclick="app.openOrderFromDiary('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="font-mono font-black text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 group" title="Click to inspect order ${tfEscapeHtml(o.id)}">
                          <span>${tfEscapeHtml(o.id)}</span>
                          <i data-lucide="external-link" class="w-3 h-3 opacity-60 group-hover:opacity-100 shrink-0"></i>
                        </button>
                        <span class="text-slate-400">·</span>
                        <button type="button" onclick="app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(safeCust))}')" class="font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 group text-left truncate" title="Click to view customer details">
                          <span class="truncate">${tfEscapeHtml(o.customerName || o.retailerName || 'Customer')}</span>
                          <i data-lucide="arrow-up-right" class="w-3 h-3 opacity-60 group-hover:opacity-100 text-amber-500 shrink-0"></i>
                        </button>
                      </div>
                      <span class="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 uppercase">${tfEscapeHtml((o.status || '').replace(/_/g, ' '))}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Pending Balance: <strong class="text-rose-600 dark:text-rose-400 font-mono-num font-bold">${tfEscapeHtml(this.formatCurrency(o.customerBalanceDue || 0))}</strong></span>
                      <span>Due: <strong class="text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatDate(o.dueDate) || 'Immediate')}</strong></span>
                    </div>
                    <div class="flex items-center justify-end gap-2 pt-1 border-t border-amber-500/20">
                      <button type="button" onclick="app.dispatchWhatsAppBuyer('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-lg flex items-center gap-1 border border-emerald-200 dark:border-emerald-800">
                        <i data-lucide="message-square" class="w-3 h-3"></i> WhatsApp Reminder
                      </button>
                      <button type="button" onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(o.id))}', '${tfEscapeHtml(tfEscapeJs(safeCust))}', 'received')" class="btn-tactile px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs flex items-center gap-1">
                        <i data-lucide="plus" class="w-3 h-3"></i> Log Collection
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- WhatsApp Evening Summary Preview Card -->
          <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="send" class="w-4 h-4 text-emerald-500"></i>
                <span>Owner WhatsApp Closing Report</span>
              </h3>
              <span class="text-xs text-slate-400 font-mono">6:00 PM Summary</span>
            </div>
            <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
*DAILY BUSINESS DIARY*
📅 *Date*: ${tfEscapeHtml(this.formatDateWithDay(dateStr))} (Evening Closing 6:00 PM)
🏢 *TradeFlow Command Center*
========================================
🟢 *Money In (Collections)*: ${tfEscapeHtml(this.formatCurrency(moneyIn))} (${tfEscapeHtml(inCount)} entries)
🔴 *Money Out (Payments)*: ${tfEscapeHtml(this.formatCurrency(moneyOut))} (${tfEscapeHtml(outCount)} entries)
⚖️ *Net Cash Movement*: ${tfEscapeHtml(netCash >= 0 ? '+' : '-')}${tfEscapeHtml(this.formatCurrency(Math.abs(netCash)))}
🚚 *Dispatches Today*: ${tfEscapeHtml(dispatchedOrders.length)} Consignments (${tfEscapeHtml(this.formatCurrency(dispatchedValue))})
========================================
_Automated evening closing report - TradeFlow_
            </div>
            <div class="flex items-center justify-end gap-2">
              <button type="button" onclick="app.sendDailyDiaryToOwnerWhatsApp()" class="btn-tactile w-full py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center justify-center gap-1.5 shadow-sm">
                <i data-lucide="send" class="w-3.5 h-3.5"></i>
                <span>Dispatch Summary to Owner</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  sendDailyDiaryToOwnerWhatsApp() {
    const dateInput = document.getElementById('daily-diary-date');
    const dateStr = dateInput?.value || this.dailyDiaryWorkspaceDate || new Date().toISOString().split('T')[0];

    const payments = (this.data.payments || []).filter(p => !p.isDeleted && ((p.date === dateStr) || (p.createdAt && p.createdAt.startsWith(dateStr))));
    const moneyIn = payments.filter(p => p.direction === 'received').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const inCount = payments.filter(p => p.direction === 'received').length;
    const moneyOut = payments.filter(p => p.direction === 'paid').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const outCount = payments.filter(p => p.direction === 'paid').length;
    const netCash = moneyIn - moneyOut;

    const reportMsg = `*DAILY BUSINESS DIARY*\n` +
      `📅 *Date*: ${this.formatDateWithDay(dateStr)} (Evening Closing 6:00 PM)\n` +
      `🏢 *TradeFlow Command Center*\n` +
      `========================================\n` +
      `🟢 *Money Received (Collections)*: ${this.formatCurrency(moneyIn)} (${inCount} entries)\n` +
      `🔴 *Money Paid Out (Payments)*: ${this.formatCurrency(moneyOut)} (${outCount} entries)\n` +
      `⚖️ *Net Cash Movement*: ${netCash >= 0 ? '+' : '-'}${this.formatCurrency(Math.abs(netCash))}\n` +
      `========================================\n` +
      `_Automated business summary - TradeFlow_\n` +
      `_Business accounts closed successfully._`;

    this.openWhatsAppDispatchModal({
      partyName: 'Owner',
      phone: this.data.businessProfile?.ownerPhone || this.data.businessProfile?.phone || '',
      type: 'custom',
      data: {}
    });

    const textarea = document.getElementById('wa-message-textarea');
    if (textarea) textarea.value = reportMsg;
  }
});
