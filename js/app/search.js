// TradeFlow: Search: live search and Ctrl+K command box. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // ================= SMART INSTANT SEARCH & HIGHLIGHTING ENGINE =================
  highlightMatch(text, query) {
    if (!text) return '';
    if (!query || !query.trim()) return String(text);
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return String(text);
    const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return String(text).replace(regex, '<mark class="tf-search-mark">$1</mark>');
  }

  initLiveSearch() {
    const searchInput = document.getElementById('global-search');
    const resultsContainer = document.getElementById('global-search-results');
    if (!searchInput || !resultsContainer) return;

    searchInput.addEventListener('input', (e) => {
      this.handleSearchInput(e.target.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      this.handleSearchKeydown(e);
    });

    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length >= 1) {
        this.renderLiveSearchResults(searchInput.value.trim());
      }
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
        this.closeLiveSearch();
      }
    });
  }

  handleSearchInput(val) {
    const q = val.trim().toLowerCase();
    this.searchQuery = q;
    this.ordersPage = 1;
    this.selectedSearchIndex = -1;

    const inlineInput = document.getElementById('orders-inline-search');
    if (inlineInput && inlineInput.value !== val) {
      inlineInput.value = val;
    }
    const clearBtn = document.getElementById('orders-search-clear');
    if (clearBtn) {
      if (q) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    // Filter main table live in real time
    if (this.activeTab === 'orders') {
      this.renderOrdersTable();
    }

    if (q.length >= 1) {
      this.renderLiveSearchResults(q);
    } else {
      this.closeLiveSearch();
    }
  }

  handleSearchKeydown(e) {
    const resultsContainer = document.getElementById('global-search-results');
    if (!resultsContainer || resultsContainer.classList.contains('hidden')) return;

    const items = resultsContainer.querySelectorAll('.tf-search-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectedSearchIndex = (this.selectedSearchIndex + 1) % items.length;
      this.updateSearchActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectedSearchIndex = (this.selectedSearchIndex - 1 + items.length) % items.length;
      this.updateSearchActiveItem(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.selectedSearchIndex >= 0 && items[this.selectedSearchIndex]) {
        items[this.selectedSearchIndex].click();
      } else if (items.length > 0) {
        items[0].click();
      }
    } else if (e.key === 'Escape') {
      this.closeLiveSearch();
    }
  }

  updateSearchActiveItem(items) {
    items.forEach((item, idx) => {
      if (idx === this.selectedSearchIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  closeLiveSearch() {
    const resultsContainer = document.getElementById('global-search-results');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    this.selectedSearchIndex = -1;
  }

  renderLiveSearchResults(query) {
    const resultsContainer = document.getElementById('global-search-results');
    if (!resultsContainer) return;

    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      this.closeLiveSearch();
      return;
    }

    // 1. Match Orders across multi-token corpus (items, flavours, buyer, factory, invoice)
    const matchingOrders = this.data.orders.filter(order => {
      const retailer = this.data.contacts.find(c => c.id === order.retailerId);
      const mfg = this.data.contacts.find(c => c.id === order.manufacturerId);
      const marketeer = this.data.contacts.find(c => c.id === order.marketeerId);
      const itemsString = (order.items || []).map(i => `${i.name || ''} ${i.variant || ''} ${i.packSize || ''}`).join(' ');
      const corpus = `${order.invoiceNumber} ${order.retailerName} ${itemsString} ${retailer ? retailer.phone + ' ' + retailer.gstin : ''} ${mfg ? mfg.name : ''} ${marketeer ? marketeer.name : ''} ${order.status}`.toLowerCase();
      return tokens.every(token => corpus.includes(token));
    }).slice(0, 5);

    // 2. Match Contacts
    const matchingContacts = this.data.contacts.filter(c => {
      const corpus = `${c.name} ${c.contactPerson || ''} ${c.role} ${c.phone} ${c.city || ''} ${c.gstin || ''}`.toLowerCase();
      return tokens.every(token => corpus.includes(token));
    }).slice(0, 4);

    // 3. Match Products
    const matchingProducts = (this.data.products || []).filter(p => {
      const corpus = `${p.name} ${p.category || ''} ${(p.variants || []).join(' ')}`.toLowerCase();
      return tokens.every(token => corpus.includes(token));
    }).slice(0, 3);

    const hasMatches = matchingOrders.length > 0 || matchingContacts.length > 0 || matchingProducts.length > 0;

    if (!hasMatches) {
      resultsContainer.innerHTML = `
        <div class="p-4 text-center text-slate-400 text-xs">
          <i data-lucide="search-x" class="w-6 h-6 mx-auto mb-1.5 opacity-50 text-slate-400"></i>
          <p class="font-medium text-slate-300">No matches found for "<span class="text-amber-500 font-bold">${tfEscapeHtml(query)}</span>"</p>
          <p class="text-xs text-slate-500 mt-0.5">Try searching by flavour (e.g. Mango, Mix, Della), buyer, invoice, or phone.</p>
        </div>
      `;
      resultsContainer.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let html = '';

    // Section 1: Orders
    if (matchingOrders.length > 0) {
      html += `
        <div>
          <div class="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <i data-lucide="boxes" class="w-3 h-3 text-amber-500"></i>
              <span>Matching Orders (${tfEscapeHtml(matchingOrders.length)})</span>
            </span>
            <span class="text-xs text-slate-500">Click to Open Order Tab</span>
          </div>
          <div class="space-y-1 mt-1">
            ${matchingOrders.map(order => {
              const totalCases = (order.items || []).reduce((sum, i) => sum + (i.cases || 0), 0);
              const totalJars = (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
              const firstItem = order.items && order.items[0] ? order.items[0].name : 'products';
              const skuSnippet = order.items && order.items.length > 1 
                ? `${order.items[0].name} + ${order.items.length - 1} more varieties` 
                : firstItem;

              let statusLabel = order.status.replace(/_/g, ' ').toUpperCase();
              let statusClass = 'text-slate-400 bg-slate-800';
              if (order.status === 'action_needed') statusClass = 'text-amber-400 bg-amber-950/60 border border-amber-700/60';
              else if (order.status === 'in_production') statusClass = 'text-blue-400 bg-blue-950/60 border border-blue-700/60';
              else if (order.status === 'in_transit') statusClass = 'text-purple-400 bg-purple-950/60 border border-purple-700/60';
              else if (order.status === 'delivered_overdue') statusClass = 'text-rose-400 bg-rose-950/60 border border-rose-700/60';

              return `
                <div 
                  class="tf-search-item"
                  onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.closeLiveSearch();"
                  title="Open full inspection tab for ${tfEscapeHtml(order.invoiceNumber)}"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                      <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
                    </span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-mono-num font-bold text-xs text-slate-900 dark:text-white">${tfEscapeHtml(this.highlightMatch(order.invoiceNumber, query))}</span>
                        <span class="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">${tfEscapeHtml(this.highlightMatch(order.retailerName, query))}</span>
                      </div>
                      <div class="text-xs text-slate-400 truncate mt-0.5">
                        ${tfEscapeHtml(this.highlightMatch(skuSnippet, query))} • <span class="font-mono-num text-amber-500 font-bold">${tfEscapeHtml(totalCases)} ${tfEscapeHtml(totalCases === 1 ? 'Case' : 'Cases')}</span> (${tfEscapeHtml(totalJars)} jars)
                      </div>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="font-mono-num font-bold text-xs text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</div>
                    <span class="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${tfEscapeHtml(statusClass)} inline-block mt-0.5">${tfEscapeHtml(statusLabel)}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Section 2: Contacts / Ecosystem Partners
    if (matchingContacts.length > 0) {
      html += `
        <div class="pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
          <div class="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <i data-lucide="users" class="w-3 h-3 text-emerald-500"></i>
              <span>Matching Supply Chain Partners (${tfEscapeHtml(matchingContacts.length)})</span>
            </span>
            <span class="text-xs text-slate-500">Click to Open Partner Hub</span>
          </div>
          <div class="space-y-1 mt-1">
            ${matchingContacts.map(c => {
              const roleLabels = {
                retailer: 'Retailer / Buyer',
                manufacturer: 'Manufacturer',
                packaging: 'Packaging Supplier',
                marketeer: 'Sales Marketeer',
                transporter: 'Freight / Logistics'
              };
              const roleIcon = c.role === 'manufacturer' ? 'factory' : (c.role === 'retailer' ? 'store' : (c.role === 'transporter' ? 'truck' : 'user-check'));

              return `
                <div 
                  class="tf-search-item"
                  onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(c.id))}'); app.closeLiveSearch();"
                  title="Open profile hub for ${tfEscapeHtml(c.name)}"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                      <i data-lucide="${tfEscapeHtml(roleIcon)}" class="w-3.5 h-3.5"></i>
                    </span>
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-xs text-slate-900 dark:text-white truncate">${tfEscapeHtml(this.highlightMatch(c.name, query))}</span>
                        <span class="text-xs font-semibold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">${tfEscapeHtml(roleLabels[c.role] || c.role)}</span>
                      </div>
                      <div class="text-xs text-slate-400 truncate mt-0.5">
                        ${tfEscapeHtml(c.contactPerson ? `Contact: ${this.highlightMatch(c.contactPerson, query)} • ` : '')}Phone: <span class="font-mono-num">${tfEscapeHtml(this.highlightMatch(c.phone, query))}</span>
                      </div>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-xs text-slate-400 block">${tfEscapeHtml(c.role === 'retailer' ? 'Receivable' : 'Payable')}</span>
                    <span class="font-mono-num font-bold text-xs ${tfEscapeHtml(c.currentBalanceDue > 0 ? 'text-amber-500' : 'text-emerald-500')}">
                      ${tfEscapeHtml(this.formatCurrency(c.currentBalanceDue || 0))}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Section 3: Products / SKUs
    if (matchingProducts.length > 0) {
      html += `
        <div class="pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
          <div class="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <i data-lucide="tag" class="w-3 h-3 text-blue-500"></i>
            <span>Product Catalog SKUs (${tfEscapeHtml(matchingProducts.length)})</span>
          </div>
          <div class="space-y-1 mt-1">
            ${matchingProducts.map(p => `
              <div 
                class="tf-search-item"
                onclick="app.activeTab = 'products'; app.updateSidebarUI(); app.renderActiveView(); app.closeLiveSearch();"
                title="View product in catalog"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                    <i data-lucide="tag" class="w-3.5 h-3.5"></i>
                  </span>
                  <div class="min-w-0">
                    <span class="font-bold text-xs text-slate-900 dark:text-white block truncate">${tfEscapeHtml(this.highlightMatch(p.name, query))}</span>
                    <span class="text-xs text-slate-400">Available Packs: ${tfEscapeHtml((p.variants || []).join(', '))}</span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-xs text-slate-400 block">Base Rate</span>
                  <span class="font-mono-num font-bold text-xs text-amber-500">₹${tfEscapeHtml(p.basePrice || 85)}/jar</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Keyboard hints footer
    html += `
      <div class="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 px-2 py-1 flex items-center justify-between text-xs text-slate-400">
        <span>Press <kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">↑</kbd> <kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">↓</kbd> to navigate</span>
        <span><kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">Enter</kbd> to select • <kbd class="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">Esc</kbd> to close</span>
      </div>
    `;

    resultsContainer.innerHTML = html;
    resultsContainer.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  toggleOrderSkuDrawer(drawerId, btn, hiddenCount) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;
    const isNowHidden = drawer.classList.toggle('hidden');
    if (btn) {
      btn.innerHTML = `
        <span>${tfEscapeHtml(isNowHidden ? `+${hiddenCount} more varieties` : 'Hide varieties')}</span>
        <i data-lucide="${tfEscapeHtml(isNowHidden ? 'chevron-down' : 'chevron-up')}" class="w-3 h-3"></i>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  /* ================= 2. UNIVERSAL OMNIBOX SEARCH ENGINE (Ctrl+K) ================= */
  initOmniboxSearch() {
    window.addEventListener('keydown', (e) => {
      // Hotkey Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openOmniboxModal();
      }
      if (e.key === 'Escape') {
        const modal = document.getElementById('universal-omnibox-modal');
        if (modal && !modal.classList.contains('hidden')) {
          this.closeOmniboxModal();
        }
        const bpModal = document.getElementById('bank-protection-modal');
        if (bpModal && !bpModal.classList.contains('hidden')) {
          this.closeBankProtectionModal();
        }
      }
    });
  }

  openOmniboxModal(initialQuery = '') {
    const modal = document.getElementById('universal-omnibox-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const input = document.getElementById('omnibox-input');
    if (input) {
      input.value = initialQuery;
      setTimeout(() => {
        input.focus();
        if (initialQuery) input.select();
      }, 50);
    }
    this.handleOmniboxInput(initialQuery);
  }

  closeOmniboxModal() {
    const modal = document.getElementById('universal-omnibox-modal');
    if (modal) modal.classList.add('hidden');
  }

  clearOmniboxInput() {
    const input = document.getElementById('omnibox-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    this.handleOmniboxInput('');
  }

  setOmniboxFilter(filter) {
    this.omniboxFilter = filter;
    document.querySelectorAll('.omnibox-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-omnibox-tab') === filter) {
        btn.className = 'omnibox-tab-btn px-2.5 py-1 rounded-lg font-bold text-xs bg-emerald-700 text-white';
      } else {
        btn.className = 'omnibox-tab-btn px-2.5 py-1 rounded-lg font-semibold text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      }
    });
    const input = document.getElementById('omnibox-input');
    this.handleOmniboxInput(input ? input.value : '');
  }

  handleOmniboxKeydown(e) {
    const items = document.querySelectorAll('.omnibox-result-card');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.omniboxSelectedIdx = Math.min(this.omniboxSelectedIdx + 1, items.length - 1);
      this.highlightOmniboxSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.omniboxSelectedIdx = Math.max(this.omniboxSelectedIdx - 1, 0);
      this.highlightOmniboxSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.omniboxSelectedIdx >= 0 && items[this.omniboxSelectedIdx]) {
        items[this.omniboxSelectedIdx].click();
      } else if (items[0]) {
        items[0].click();
      }
    }
  }

  highlightOmniboxSelection(items) {
    items.forEach((it, idx) => {
      if (idx === this.omniboxSelectedIdx) {
        it.classList.add('ring-2', 'ring-emerald-600', 'bg-emerald-50/50', 'dark:bg-emerald-950/20');
        it.scrollIntoView({ block: 'nearest' });
      } else {
        it.classList.remove('ring-2', 'ring-emerald-600', 'bg-emerald-50/50', 'dark:bg-emerald-950/20');
      }
    });
  }

  handleOmniboxInput(query = '') {
    const clearBtn = document.getElementById('omnibox-clear-btn');
    if (clearBtn) {
      if (query.trim()) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    const container = document.getElementById('omnibox-results');
    if (!container) return;

    const q = (query || '').trim().toLowerCase();
    this.omniboxSelectedIdx = -1;

    // Detect numeric amount search (e.g. 60000, ₹60,000, 60k, 60,000)
    let parsedAmount = null;
    const cleanAmtStr = q.replace(/[₹,]/g, '').trim();
    if (/^\d+(\.\d+)?k?$/i.test(cleanAmtStr)) {
      if (cleanAmtStr.endsWith('k') || cleanAmtStr.endsWith('K')) {
        parsedAmount = parseFloat(cleanAmtStr.slice(0, -1)) * 1000;
      } else {
        parsedAmount = parseFloat(cleanAmtStr);
      }
    }

    const results = {
      amounts: [],
      orders: [],
      payments: [],
      partners: [],
      documents: []
    };

    const orders = this.data.orders || [];
    const payments = this.data.payments || [];
    const contacts = this.data.contacts || [];
    const documents = this.data.documents || [];

    // 1. AMOUNT MATCHING
    if (parsedAmount !== null && parsedAmount > 0) {
      // Find matching payments
      payments.forEach(p => {
        if (Math.abs((p.amount || 0) - parsedAmount) < 1 || String(p.amount || '').includes(String(parsedAmount))) {
          results.amounts.push({
            type: 'payment',
            title: `₹${(p.amount || 0).toLocaleString('en-IN')} Payment (${p.mode || 'UPI'})`,
            subtitle: `Party: ${p.partyName || 'Unknown'} • UTR: ${p.utr || 'N/A'} • Date: ${p.date || 'N/A'}`,
            badge: p.reconciliationStatus || (p.direction === 'received' ? 'Received' : 'Paid Out'),
            badgeColor: p.direction === 'received' ? 'emerald' : 'blue',
            amount: p.amount || 0,
            date: p.date,
            action: () => {
              this.closeOmniboxModal();
              this.activeTab = 'payments';
              this.updateSidebarUI();
              this.renderActiveView();
              this.showToast(`Showing Payment UTR: ${p.utr || p.id}`);
            }
          });
        }
      });

      // Find matching orders (total amount, balance due, or advance paid)
      orders.forEach(o => {
        const matchesTotal = Math.abs((o.totalInvoiceAmount || 0) - parsedAmount) < 1;
        const matchesBalance = Math.abs((o.customerBalanceDue || 0) - parsedAmount) < 1;
        const matchesAdvance = Math.abs((o.customerAdvanceReceived || 0) - parsedAmount) < 1;

        if (matchesTotal || matchesBalance || matchesAdvance) {
          const matchedField = matchesTotal ? 'Total Invoice' : (matchesBalance ? 'Balance Due' : 'Advance Paid');
          results.amounts.push({
            type: 'order',
            title: `₹${parsedAmount.toLocaleString('en-IN')} in Order ${o.invoiceNumber || o.id} (${matchedField})`,
            subtitle: `Buyer: ${o.retailerName} • Total: ₹${(o.totalInvoiceAmount || 0).toLocaleString('en-IN')} • Status: ${o.status}`,
            badge: matchedField,
            badgeColor: matchesBalance ? 'rose' : 'amber',
            amount: parsedAmount,
            date: o.date,
            action: () => {
              this.closeOmniboxModal();
              this.openOrderDetailPage(o.id);
            }
          });
        }
      });
    }

    // 2. PAYMENTS & UTR MATCHING
    payments.forEach(p => {
      const matchUtr = p.utr && p.utr.toLowerCase().includes(q);
      const matchParty = p.partyName && p.partyName.toLowerCase().includes(q);
      const matchMode = p.mode && p.mode.toLowerCase().includes(q);
      const matchNotes = p.notes && p.notes.toLowerCase().includes(q);
      const matchAmt = !parsedAmount && String(p.amount || '').includes(q);

      if (matchUtr || matchParty || matchMode || matchNotes || matchAmt) {
        results.payments.push({
          id: p.id,
          utr: p.utr,
          party: p.partyName,
          amount: p.amount,
          date: p.date,
          mode: p.mode,
          reconciliationStatus: p.reconciliationStatus || 'matched',
          action: () => {
            this.closeOmniboxModal();
            this.activeTab = 'payments';
            this.updateSidebarUI();
            this.renderActiveView();
          }
        });
      }
    });

    // 3. ORDERS & DEALS MATCHING
    orders.forEach(o => {
      const matchInv = o.invoiceNumber && o.invoiceNumber.toLowerCase().includes(q);
      const matchId = o.id && o.id.toLowerCase().includes(q);
      const matchRetailer = o.retailerName && o.retailerName.toLowerCase().includes(q);
      const matchMfg = o.manufacturerName && o.manufacturerName.toLowerCase().includes(q);
      const matchTrans = o.transporterName && o.transporterName.toLowerCase().includes(q);
      const matchLr = o.lrNumber && o.lrNumber.toLowerCase().includes(q);
      const matchItems = (o.items || []).some(it => it.product && it.product.toLowerCase().includes(q));

      if (matchInv || matchId || matchRetailer || matchMfg || matchTrans || matchLr || matchItems) {
        results.orders.push({
          id: o.id,
          invoiceNumber: o.invoiceNumber,
          retailerName: o.retailerName,
          totalAmount: o.totalInvoiceAmount,
          balanceDue: o.customerBalanceDue,
          status: o.status,
          date: o.date,
          action: () => {
            this.closeOmniboxModal();
            this.openOrderDetailPage(o.id);
          }
        });
      }
    });

    // 4. PARTNERS MATCHING
    contacts.forEach(c => {
      const matchName = c.name && c.name.toLowerCase().includes(q);
      const matchPerson = c.contactPerson && c.contactPerson.toLowerCase().includes(q);
      const matchPhone = c.phone && c.phone.includes(q);
      const matchGstin = c.gstin && c.gstin.toLowerCase().includes(q);
      const matchCity = c.city && c.city.toLowerCase().includes(q);
      const matchRole = c.role && c.role.toLowerCase().includes(q);

      if (matchName || matchPerson || matchPhone || matchGstin || matchCity || matchRole) {
        results.partners.push({
          id: c.id,
          name: c.name,
          person: c.contactPerson,
          phone: c.phone,
          role: c.role,
          city: c.city,
          gstin: c.gstin,
          action: () => {
            this.closeOmniboxModal();
            this.openPartnerSpotlightModal(c.id);
          }
        });
      }
    });

    // 5. DOCUMENTS MATCHING
    documents.forEach(d => {
      const matchName = d.fileName && d.fileName.toLowerCase().includes(q);
      const matchType = d.docType && d.docType.toLowerCase().includes(q);
      const matchOrder = d.orderId && d.orderId.toLowerCase().includes(q);

      if (matchName || matchType || matchOrder) {
        results.documents.push({
          id: d.id,
          fileName: d.fileName,
          docType: d.docType,
          orderId: d.orderId,
          date: d.date,
          action: () => {
            this.closeOmniboxModal();
            if (this.viewDocumentPreview) this.viewDocumentPreview(d.id);
            else this.showToast(`Document: ${d.fileName}`);
          }
        });
      }
    });

    // Render HTML
    this.renderOmniboxResultsHTML(query, parsedAmount, results);
  }

  renderOmniboxResultsHTML(query, parsedAmount, results) {
    const container = document.getElementById('omnibox-results');
    if (!container) return;

    // Filter results based on selected tab
    const filter = this.omniboxFilter || 'all';

    let html = '';

    // If Amount search was detected, render Amount Aggregate Header
    if (parsedAmount !== null && (filter === 'all' || filter === 'amount')) {
      const totalAggregate = results.amounts.reduce((sum, a) => sum + (a.amount || 0), 0);
      html += `
        <div class="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-lg">
              ₹
            </div>
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                ₹${tfEscapeHtml(parsedAmount.toLocaleString('en-IN'))} Financial Intelligence Summary
              </div>
              <div class="text-base font-black text-slate-900 dark:text-white">
                ${tfEscapeHtml(results.amounts.length)} Matching Record(s) • Total ₹${tfEscapeHtml(totalAggregate.toLocaleString('en-IN'))}
              </div>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-xs shadow-xs">
            Aggregated
          </span>
        </div>
      `;

      if (results.amounts.length > 0) {
        html += `<div class="space-y-2 mb-4">`;
        results.amounts.forEach((item, idx) => {
          html += `
            <div 
              class="omnibox-result-card p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11141d] hover:border-emerald-600 dark:hover:border-emerald-600/50 hover:shadow-md cursor-pointer transition-all flex items-center justify-between"
              onclick="window._tfOmniboxAction_${tfEscapeHtml(idx)}()"
            >
              <div class="flex items-center gap-3 min-w-0">
                <span class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                  ₹
                </span>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-900 dark:text-white truncate">${tfEscapeHtml(item.title)}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${tfEscapeHtml(item.subtitle)}</div>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-${tfEscapeHtml(item.badgeColor)}-100 text-${tfEscapeHtml(item.badgeColor)}-800 dark:bg-${tfEscapeHtml(item.badgeColor)}-950/80 dark:text-${tfEscapeHtml(item.badgeColor)}-300">
                  ${tfEscapeHtml(item.badge)}
                </span>
                <span class="text-amber-500 font-bold text-xs">Open →</span>
              </div>
            </div>
          `;
          window[`_tfOmniboxAction_${idx}`] = item.action;
        });
        html += `</div>`;
      }
    }

    // Orders & Deals
    if ((filter === 'all' || filter === 'orders') && results.orders.length > 0) {
      html += `
        <div class="mb-4">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Orders & Deals (${tfEscapeHtml(results.orders.length)})</span>
            <span class="text-xs font-normal text-slate-500">Click to open 360° dossier</span>
          </div>
          <div class="space-y-1.5">
            ${results.orders.map((o, idx) => {
              const actionKey = `_tfOmniboxOrder_${idx}`;
              window[actionKey] = o.action;
              return `
                <div 
                  class="omnibox-result-card p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11141d] hover:border-emerald-600 hover:shadow-xs cursor-pointer transition-all flex items-center justify-between"
                  onclick="window.${tfEscapeHtml(actionKey)}()"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
                      <i data-lucide="package" class="w-4 h-4"></i>
                    </span>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span class="font-mono">${tfEscapeHtml(o.invoiceNumber || o.id)}</span>
                        <span>•</span>
                        <span class="truncate">${tfEscapeHtml(o.retailerName)}</span>
                      </div>
                      <div class="text-xs text-slate-500 dark:text-slate-400">
                        Total ₹${tfEscapeHtml((o.totalAmount || 0).toLocaleString('en-IN'))} • Due: ₹${tfEscapeHtml((o.balanceDue || 0).toLocaleString('en-IN'))} • Date: ${tfEscapeHtml(o.date || 'N/A')}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      ${tfEscapeHtml(o.status)}
                    </span>
                    <span class="text-amber-500 font-bold text-xs">View →</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Payments & UTR
    if ((filter === 'all' || filter === 'payments') && results.payments.length > 0) {
      html += `
        <div class="mb-4">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Payments & UTR Settlements (${tfEscapeHtml(results.payments.length)})</span>
            <span class="text-xs font-normal text-slate-500">Click to view in Payments Ledger</span>
          </div>
          <div class="space-y-1.5">
            ${results.payments.map((p, idx) => {
              const actionKey = `_tfOmniboxPay_${idx}`;
              window[actionKey] = p.action;
              return `
                <div 
                  class="omnibox-result-card p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11141d] hover:border-emerald-400 hover:shadow-xs cursor-pointer transition-all flex items-center justify-between"
                  onclick="window.${tfEscapeHtml(actionKey)}()"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 shrink-0">
                      <i data-lucide="wallet" class="w-4 h-4"></i>
                    </span>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span class="font-mono text-emerald-600 dark:text-emerald-400">₹${tfEscapeHtml((p.amount || 0).toLocaleString('en-IN'))}</span>
                        <span>•</span>
                        <span class="truncate">${tfEscapeHtml(p.party || 'Settlement')}</span>
                      </div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        UTR: ${tfEscapeHtml(p.utr || 'Pending')} • Mode: ${tfEscapeHtml(p.mode || 'UPI')} • Date: ${tfEscapeHtml(p.date || 'N/A')}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                      ${tfEscapeHtml(p.reconciliationStatus || 'Settled')}
                    </span>
                    <span class="text-emerald-500 font-bold text-xs">Inspect →</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Partners
    if ((filter === 'all' || filter === 'partners') && results.partners.length > 0) {
      html += `
        <div class="mb-4">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Partners & Contacts (${tfEscapeHtml(results.partners.length)})</span>
            <span class="text-xs font-normal text-slate-500">Click to open 360° Partner Spotlight</span>
          </div>
          <div class="space-y-1.5">
            ${results.partners.map((c, idx) => {
              const actionKey = `_tfOmniboxPartner_${idx}`;
              window[actionKey] = c.action;
              return `
                <div 
                  class="omnibox-result-card p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11141d] hover:border-purple-400 hover:shadow-xs cursor-pointer transition-all flex items-center justify-between"
                  onclick="window.${tfEscapeHtml(actionKey)}()"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 shrink-0">
                      <i data-lucide="user-check" class="w-4 h-4"></i>
                    </span>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span class="truncate">${tfEscapeHtml(c.name)}</span>
                        <span class="text-xs px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 capitalize">${tfEscapeHtml(c.role)}</span>
                      </div>
                      <div class="text-xs text-slate-500 dark:text-slate-400">
                        ${tfEscapeHtml(c.person ? `Contact: ${c.person} • ` : '')}${tfEscapeHtml(c.phone || '')} ${tfEscapeHtml(c.city ? `• ${c.city}` : '')}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="text-purple-500 font-bold text-xs">Spotlight →</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Documents
    if ((filter === 'all' || filter === 'documents') && results.documents.length > 0) {
      html += `
        <div class="mb-4">
          <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
            <span>Documents & Vault Records (${tfEscapeHtml(results.documents.length)})</span>
            <span class="text-xs font-normal text-slate-500">Original evidence files</span>
          </div>
          <div class="space-y-1.5">
            ${results.documents.map((d, idx) => {
              const actionKey = `_tfOmniboxDoc_${idx}`;
              window[actionKey] = d.action;
              return `
                <div 
                  class="omnibox-result-card p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#11141d] hover:border-emerald-600 hover:shadow-xs cursor-pointer transition-all flex items-center justify-between"
                  onclick="window.${tfEscapeHtml(actionKey)}()"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 shrink-0">
                      <i data-lucide="file-text" class="w-4 h-4"></i>
                    </span>
                    <div class="min-w-0">
                      <div class="text-xs font-bold text-slate-900 dark:text-white truncate font-mono">${tfEscapeHtml(d.fileName)}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400">
                        Type: ${tfEscapeHtml(d.docType || 'Document')} ${tfEscapeHtml(d.orderId ? `• Linked Order: ${d.orderId}` : '')}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="text-amber-500 font-bold text-xs">Preview →</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (!html.trim()) {
      html = `
        <div class="text-center py-12 text-slate-400 dark:text-slate-500">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400 mb-3">
            <i data-lucide="search-x" class="w-6 h-6"></i>
          </div>
          <div class="text-sm font-bold text-slate-700 dark:text-slate-300">No Direct Records Found</div>
          <p class="text-xs mt-1 max-w-sm mx-auto text-slate-500">
            Try searching an exact ₹ amount (e.g. <b>60000</b>), a UTR reference, customer trade name, or invoice number.
          </p>
        </div>
      `;
    }

    container.innerHTML = html;
    if (window.lucide) window.lucide.createIcons();
  }
});
