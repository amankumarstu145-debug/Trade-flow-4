// TradeFlow: Partner screens (buyers, manufacturers, packaging, transport, marketeers). Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // View: Manufacturers
  renderManufacturersView() {
    const container = document.getElementById('view-manufacturers-container');
    if (!container) return;

    if (window.TFPartnerUI) {
      container.innerHTML = window.TFPartnerUI.renderDirectory(this, 'manufacturer');
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const mfgs = this.data.contacts.filter(c => c.role === 'manufacturer');

    const cardsHtml = mfgs.map(mfg => {
      const mfgOrders = this.data.orders.filter(o => o.manufacturerId === mfg.id);
      const totalJobWorkAmount = mfgOrders.reduce((s, o) => s + (o.manufacturerTotalCost || 0), 0);
      const totalAdvancePaid = mfgOrders.reduce((s, o) => s + (o.manufacturerAdvancePaid || 0), 0);
      const remainingBalance = Math.max(0, totalJobWorkAmount - totalAdvancePaid);
      const activeBatchesCount = mfgOrders.length;
      const latestBatches = mfgOrders.slice(0, 2);

      const rawPhone = mfg.phone || '';
      const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
      const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
      const waPhone = digitsOnly.length === 10 ? '91' + digitsOnly : digitsOnly;
      const waMsg = encodeURIComponent(`Hello ${mfg.name || ''}, inquiring regarding our production batches and payments on TradeFlow.`);

      const mfgLogo = mfg.logo || mfg.logoUrl;
      const logoHtml = mfgLogo ? `
        <div class="tf-banner-avatar-v4">
          <img src="${tfEscapeHtml(tfSafeUrl(mfgLogo))}" alt="${tfEscapeHtml(mfg.name)}" class="w-full h-full object-contain p-1" onerror="this.onerror=null; if (this.parentElement) this.parentElement.innerHTML='<span class=\\'font-black text-emerald-950 text-lg\\'>${tfEscapeHtml(tfEscapeJs((mfg.name||'MF').substring(0,2).toUpperCase()))}</span>'">
        </div>
      ` : `
        <div class="tf-banner-avatar-v4">
          ${tfEscapeHtml((mfg.name||'MF').substring(0,2).toUpperCase())}
        </div>
      `;

      const safeAddress = (mfg.billingAddress || mfg.shippingAddress || '').replace(/'/g, "\\'");
      const safeEmail = (mfg.email || `sales@${(mfg.name || 'mfg').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`).replace(/'/g, "\\'");
      const safeGstin = (mfg.gstin || '').replace(/'/g, "\\'");

      const healthBadgeText = remainingBalance > 0 ? `Payable ${this.formatCurrency(remainingBalance)}` : 'Clear';
      const healthBadgeClass = remainingBalance > 0 ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30' : 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30';

      return `
        <div class="tf-card-v4 group" id="partner-card-${tfEscapeHtml(mfg.id)}" data-partner-type="manufacturer" data-name="${tfEscapeHtml((mfg.name||'').toLowerCase())}" data-person="${tfEscapeHtml((mfg.contactPerson||'').toLowerCase())}" data-city="${tfEscapeHtml(safeAddress.toLowerCase())}" data-active-orders="${tfEscapeHtml(activeBatchesCount)}" data-has-balance="${tfEscapeHtml(remainingBalance > 0 ? 'true' : 'false')}">
          <!-- Top Banner: Forest Green Gradient matching uploaded reference (media_1790693953581.png) -->
          <div class="tf-card-banner-v4" style="background: linear-gradient(135deg, #064e3b 0%, #047857 55%, #065f46 100%);">
            <!-- Top Badges & Kebab Row -->
            <div class="flex items-center justify-between gap-2 relative">
              <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/15 backdrop-blur-md text-white border border-white/20 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                  <span>MANUFACTURER</span>
                </span>
                <span class="font-mono text-xs text-white/90 font-bold bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15">${tfEscapeHtml(mfg.id)}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${tfEscapeHtml(healthBadgeClass)}">${tfEscapeHtml(healthBadgeText)}</span>
              </div>
              
              <!-- 3-Dots Kebab Menu Button -->
              <div class="relative shrink-0">
                <button type="button" onclick="event.stopPropagation(); app.toggleCardKebabMenu('${tfEscapeHtml(tfEscapeJs(mfg.id))}', event)" class="tf-kebab-btn-v4" title="Quick Actions">
                  <i data-lucide="more-vertical" class="w-3.5 h-3.5"></i>
                </button>
                <div id="kebab-menu-${tfEscapeHtml(mfg.id)}" class="tf-kebab-menu-popup hidden" onclick="event.stopPropagation()">
                  <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}', 'dossier'); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="user-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>Profile Dossier &amp; AI Filler</span>
                  </button>
                  ${cleanPhone ? `
                    <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}&text=${tfEscapeHtml(waMsg)}" target="_blank" rel="noopener noreferrer" class="tf-kebab-item">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5 text-emerald-500"></i>
                      <span>WhatsApp Direct</span>
                    </a>
                    <a href="tel:${tfEscapeHtml(cleanPhone)}" class="tf-kebab-item">
                      <i data-lucide="phone" class="w-3.5 h-3.5 text-blue-500"></i>
                      <span>Call Factory</span>
                    </a>
                  ` : ''}
                  <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeGstin))}', 'GSTIN', this); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="copy" class="w-3.5 h-3.5 text-slate-500"></i>
                    <span>Copy GSTIN</span>
                  </button>
                  <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAddress))}', 'Address', this); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-amber-500"></i>
                    <span>Copy Address</span>
                  </button>
                  <button onclick="app.openOrderFormModal(); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5 text-emerald-600"></i>
                    <span>Place Production Batch</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Identity Core: Circle Avatar + Bold Name + Contact Person + Phone & WA -->
            <div class="flex items-center gap-3 min-w-0 cursor-pointer" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}', 'dossier')" title="Click to view full Profile Dossier for ${tfEscapeHtml(mfg.name)}">
              ${logoHtml}
              <div class="min-w-0 flex-1">
                <div class="min-h-[44px] max-h-[44px] flex items-center">
                  <h3 class="font-black text-white text-[18px] sm:text-[19px] leading-tight line-clamp-2 drop-shadow-xs hover:text-emerald-200 transition-colors" title="${tfEscapeHtml(mfg.name)}">
                    ${tfEscapeHtml(mfg.name)}
                  </h3>
                </div>
                <div class="h-[20px] flex items-center mt-0.5">
                  ${mfg.contactPerson ? `
                    <div class="text-emerald-100 text-sm font-bold flex items-center gap-1.5 truncate">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-emerald-300 shrink-0"></i>
                      <span class="truncate">${tfEscapeHtml(mfg.contactPerson)}</span>
                    </div>
                  ` : `
                    <div class="text-emerald-200/70 text-xs font-medium flex items-center gap-1.5 truncate">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-emerald-300/70 shrink-0"></i>
                      <span class="truncate italic">Factory Representative</span>
                    </div>
                  `}
                </div>
                <div class="h-[20px] flex items-center gap-2 mt-0.5">
                  <a href="tel:${tfEscapeHtml(cleanPhone)}" onclick="event.stopPropagation()" class="text-white text-xs font-mono font-bold hover:text-emerald-200 transition-colors flex items-center gap-1 truncate" title="Call ${tfEscapeHtml(mfg.phone)}">
                    <i data-lucide="phone" class="w-3 h-3 text-white/80 shrink-0"></i>
                    <span>${tfEscapeHtml(mfg.phone || 'No phone')}</span>
                  </a>
                  ${waPhone ? `
                    <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}&text=${tfEscapeHtml(waMsg)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="tf-wa-btn" title="Chat on WhatsApp">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- 2-Column Info Grid inside Banner (Exact match to uploaded reference) -->
            <div class="tf-banner-grid-v4">
              <!-- Left Column: Address & Email -->
              <div class="space-y-1 min-w-0 pr-1">
                <div class="tf-copy-clickable" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAddress))}', 'Address', this)" title="Click to copy Address">
                  <div class="text-xs text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="map-pin" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>Address</span>
                  </div>
                  <div class="text-xs text-white font-medium line-clamp-2 leading-tight mt-0.5">
                    ${tfEscapeHtml(mfg.billingAddress || mfg.shippingAddress || '')}
                  </div>
                </div>
                <div class="tf-copy-clickable truncate" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeEmail))}', 'Email', this)" title="Click to copy Email">
                  <div class="text-xs text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="mail" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span class="truncate text-xs text-white font-medium">${tfEscapeHtml(mfg.email || '')}</span>
                  </div>
                </div>
              </div>

              <!-- Right Column: Business Type & GSTIN -->
              <div class="space-y-1 min-w-0 pl-1 border-l border-white/15">
                <div>
                  <div class="text-xs text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="factory" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>Business Type</span>
                  </div>
                  <div class="text-xs text-white font-semibold truncate mt-0.5">
                    ${tfEscapeHtml(mfg.businessType || 'Manufacturer')}
                  </div>
                </div>
                <div class="tf-copy-clickable truncate" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeGstin))}', 'GSTIN', this)" title="Click to copy GSTIN">
                  <div class="text-xs text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="file-text" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>GSTIN</span>
                  </div>
                  <div class="text-xs text-white font-mono font-semibold truncate mt-0.5">
                    ${tfEscapeHtml(mfg.gstin || '')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card Body Zone: White Container with Metrics & Latest Orders Table -->
          <div class="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
            <!-- Dual Soft Metric Tiles with 1-Click Deep Linking -->
            <div class="grid grid-cols-2 gap-2.5">
              <!-- Left Tile: Active Orders (Mint) -> Deep links to Hub Orders -->
              <div onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}', 'hub', 'orders')" class="tf-metric-tile-v4 tf-metric-tile-mint tf-metric-tile-clickable group/tile cursor-pointer" title="Click to view all Production Batches in dedicated Hub">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
                      <i data-lucide="file-text" class="w-3 h-3"></i>
                    </div>
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">Active Orders</span>
                  </div>
                  <div class="w-4.5 h-4.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/25 flex items-center justify-center text-emerald-700 dark:text-emerald-300 group-hover/tile:bg-emerald-600 group-hover/tile:text-white transition-colors shrink-0">
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </div>
                </div>
                <div class="flex items-baseline justify-between gap-1 mt-1">
                  <span class="text-xl font-black text-slate-900 dark:text-white leading-none">
                    ${tfEscapeHtml(String(activeBatchesCount).padStart(2, '0'))}
                  </span>
                  <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    ${tfEscapeHtml(activeBatchesCount > 0 ? activeBatchesCount + ' Batches' : 'Capacity Open')}
                  </span>
                </div>
              </div>

              <!-- Right Tile: Payables (Sky Blue) -> Deep links to Hub Payments -->
              <div onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}', 'hub', 'payments')" class="tf-metric-tile-v4 tf-metric-tile-blue tf-metric-tile-clickable group/tile cursor-pointer" title="Click to view Financial Ledger & Settlements in dedicated Hub">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                      <i data-lucide="wallet" class="w-3 h-3"></i>
                    </div>
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">Payables</span>
                  </div>
                  <div class="w-4.5 h-4.5 rounded-full bg-blue-500/15 dark:bg-blue-500/25 flex items-center justify-center text-blue-700 dark:text-blue-300 group-hover/tile:bg-blue-600 group-hover/tile:text-white transition-colors shrink-0">
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </div>
                </div>
                <div class="flex items-baseline justify-between gap-1 mt-1">
                  <span class="text-lg font-black text-[#1d4ed8] dark:text-blue-400 leading-none font-mono-num truncate" title="${tfEscapeHtml(this.formatCurrency(remainingBalance))}">
                    ${tfEscapeHtml(this.formatCurrency(remainingBalance))}
                  </span>
                  <span class="text-xs font-semibold ${tfEscapeHtml(remainingBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')} truncate">
                    ${tfEscapeHtml(remainingBalance > 0 ? 'Due' : 'Settled')}
                  </span>
                </div>
              </div>
            </div>

            <!-- Latest Orders Mini-Table (Matches uploaded reference exactly) -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between px-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <i data-lucide="package" class="w-3.5 h-3.5 text-emerald-600"></i>
                  <span>Latest Orders</span>
                </div>
                <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}', 'hub', 'orders')" class="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5" title="View all batches for ${tfEscapeHtml(mfg.name)}">
                  <span>View All</span>
                  <i data-lucide="chevron-right" class="w-3 h-3"></i>
                </button>
              </div>

              <div class="tf-orders-minitable-v4">
                <div class="minitable-header">
                  <span>PO Number</span>
                  <span>Product</span>
                  <span class="text-right">Cases</span>
                </div>
                ${latestBatches.length === 0 ? `
                  <div onclick="app.openOrderFormModal()" class="flex-1 flex items-center justify-center gap-1.5 p-2 text-center text-xs text-slate-400 hover:text-emerald-600 cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                    <span>No active batches · Book first batch</span>
                  </div>
                ` : `
                  ${latestBatches.slice(0, 2).map(o => `
                    <div onclick="event.stopPropagation(); app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="minitable-row" title="Click to inspect batch ${tfEscapeHtml(o.invoiceNumber)}">
                      <span class="font-mono font-bold text-slate-900 dark:text-white truncate">${tfEscapeHtml(o.invoiceNumber)}</span>
                      <span class="truncate text-slate-700 dark:text-slate-300 font-medium">${tfEscapeHtml((o.items && o.items[0]) ? (o.items[0].variant || o.items[0].name) : '—')}</span>
                      <span class="text-right font-medium text-slate-600 dark:text-slate-400 flex items-center justify-end gap-0.5 truncate">
                        <span>${tfEscapeHtml((o.items || []).reduce((sum, i) => sum + (Number(i.cases) || 0), 0))} Cases</span>
                        <i data-lucide="chevron-right" class="w-2.5 h-2.5 text-slate-400 shrink-0"></i>
                      </span>
                    </div>
                  `).join('')}
                  ${latestBatches.length === 1 ? `
                    <div class="minitable-row minitable-row-empty">
                      <span>-</span>
                      <span>Slot available for Batch 2</span>
                      <span class="text-right">-</span>
                    </div>
                  ` : ''}
                `}
              </div>
            </div>

            <!-- Tactile Footer Action Bar (Matches uploaded reference exactly) -->
            <div class="pt-2 flex items-center gap-2">
              <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}', 'hub', 'all')" class="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-[#064e3b] hover:bg-[#043e2f] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98">
                <i data-lucide="factory" class="w-3.5 h-3.5"></i>
                <span>View Factory Hub &amp; Orders</span>
                <i data-lucide="chevron-right" class="w-3 h-3"></i>
              </button>
              <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(mfg.id))}', 'dossier')" class="w-9 h-9 rounded-xl text-emerald-800 bg-[#dcfce7] hover:bg-[#bbf7d0] border border-emerald-200/60 flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-2xs" title="View &amp; Edit Profile Dossier">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Smart Filter & Search Bar -->
        <div class="tf-directory-toolbar">
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <div class="relative w-full">
              <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
              <input type="text" id="mfg-search-input" oninput="app.searchPartnerCards('manufacturer', this.value)" placeholder="Search factories by name, city, GSTIN, phone..." class="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Filter:</span>
            <button type="button" onclick="app.filterPartnerCards('manufacturer', 'all', this)" class="tf-filter-chip active">All (${tfEscapeHtml(mfgs.length)})</button>
            <button type="button" onclick="app.filterPartnerCards('manufacturer', 'active_orders', this)" class="tf-filter-chip">Active Batches</button>
            <button type="button" onclick="app.filterPartnerCards('manufacturer', 'balance_due', this)" class="tf-filter-chip">Payables Due</button>
            <button type="button" onclick="app.filterPartnerCards('manufacturer', 'all_clear', this)" class="tf-filter-chip">All Settled</button>
          </div>
        </div>

        <!-- 4 Cards Per Row Grid with Responsive Squeezing -->
        <div id="manufacturers-card-grid" class="grid gap-4 w-full tf-partner-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  // View: Packaging & Labels Suppliers
  renderPackagingView() {
    const container = document.getElementById('view-packaging-container');
    if (!container) return;

    if (window.TFPartnerUI) {
      container.innerHTML = window.TFPartnerUI.renderDirectory(this, 'packaging');
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const pkgs = this.data.contacts.filter(c => c.role === 'packaging');

    const cardsHtml = pkgs.map(pkg => {
      const pkgOrders = this.data.orders.filter(o => o.packagingVendorId === pkg.id);
      const totalPkgCost = pkgOrders.reduce((s, o) => s + (o.packagingCost || 0), 0);
      const totalPaid = pkgOrders.reduce((s, o) => s + (o.packagingAdvancePaid || 0), 0);
      const balance = Math.max(0, totalPkgCost - totalPaid);
      const latestOrders = pkgOrders.slice(0, 2);

      const rawPhone = pkg.phone || '';
      const cleanPhone = rawPhone.replace(/[^0-9+]/g, '');
      const digitsOnly = rawPhone.replace(/[^0-9]/g, '');
      const waPhone = digitsOnly.length === 10 ? '91' + digitsOnly : digitsOnly;
      const waMsg = encodeURIComponent(`Hello ${pkg.name || ''}, inquiring regarding our packaging materials POs and payments on TradeFlow.`);

      const pkgLogo = pkg.logo || pkg.logoUrl;
      const logoHtml = pkgLogo ? `
        <div class="tf-banner-avatar-v4" style="background: #dbeafe; color: #1e3a8a;">
          <img src="${tfEscapeHtml(tfSafeUrl(pkgLogo))}" alt="${tfEscapeHtml(pkg.name)}" class="w-full h-full object-contain p-1" onerror="this.onerror=null; if (this.parentElement) this.parentElement.innerHTML='<span class=\\'font-black text-blue-950 text-lg\\'>${tfEscapeHtml(tfEscapeJs((pkg.name||'PK').substring(0,2).toUpperCase()))}</span>'">
        </div>
      ` : `
        <div class="tf-banner-avatar-v4" style="background: #dbeafe; color: #1e3a8a;">
          ${tfEscapeHtml((pkg.name||'PK').substring(0,2).toUpperCase())}
        </div>
      `;

      const safeAddress = (pkg.billingAddress || pkg.shippingAddress || '').replace(/'/g, "\\'");
      const safeEmail = (pkg.email || `orders@${(pkg.name || 'pkg').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`).replace(/'/g, "\\'");
      const safeGstin = (pkg.gstin || '').replace(/'/g, "\\'");

      const healthBadgeText = balance > 0 ? `Payable ${this.formatCurrency(balance)}` : 'Clear';
      const healthBadgeClass = balance > 0 ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30' : 'bg-blue-500/20 text-blue-200 border border-blue-400/30';

      return `
        <div class="tf-card-v4 group" id="partner-card-${tfEscapeHtml(pkg.id)}" data-partner-type="packaging" data-name="${tfEscapeHtml((pkg.name||'').toLowerCase())}" data-person="${tfEscapeHtml((pkg.contactPerson||'').toLowerCase())}" data-city="${tfEscapeHtml(safeAddress.toLowerCase())}" data-active-orders="${tfEscapeHtml(pkgOrders.length)}" data-has-balance="${tfEscapeHtml(balance > 0 ? 'true' : 'false')}">
          <!-- Top Banner: Deep Marine Blue Gradient -->
          <div class="tf-card-banner-v4" style="background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #1e40af 100%);">
            <!-- Top Badges & Kebab Row -->
            <div class="flex items-center justify-between gap-2 relative">
              <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/15 backdrop-blur-md text-white border border-white/20 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse"></span>
                  <span>PACKAGING SUPPLIER</span>
                </span>
                <span class="font-mono text-xs text-white/90 font-bold bg-white/15 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15">${tfEscapeHtml(pkg.id)}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${tfEscapeHtml(healthBadgeClass)}">${tfEscapeHtml(healthBadgeText)}</span>
              </div>
              
              <!-- 3-Dots Kebab Menu Button -->
              <div class="relative shrink-0">
                <button type="button" onclick="event.stopPropagation(); app.toggleCardKebabMenu('${tfEscapeHtml(tfEscapeJs(pkg.id))}', event)" class="tf-kebab-btn-v4" title="Quick Actions">
                  <i data-lucide="more-vertical" class="w-3.5 h-3.5"></i>
                </button>
                <div id="kebab-menu-${tfEscapeHtml(pkg.id)}" class="tf-kebab-menu-popup hidden" onclick="event.stopPropagation()">
                  <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}', 'dossier'); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="user-check" class="w-3.5 h-3.5 text-blue-600"></i>
                    <span>Profile Dossier &amp; AI Filler</span>
                  </button>
                  ${cleanPhone ? `
                    <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}&text=${tfEscapeHtml(waMsg)}" target="_blank" rel="noopener noreferrer" class="tf-kebab-item">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5 text-emerald-500"></i>
                      <span>WhatsApp Direct</span>
                    </a>
                    <a href="tel:${tfEscapeHtml(cleanPhone)}" class="tf-kebab-item">
                      <i data-lucide="phone" class="w-3.5 h-3.5 text-blue-500"></i>
                      <span>Call Supplier</span>
                    </a>
                  ` : ''}
                  <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeGstin))}', 'GSTIN', this); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="copy" class="w-3.5 h-3.5 text-slate-500"></i>
                    <span>Copy GSTIN</span>
                  </button>
                  <button onclick="app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAddress))}', 'Address', this); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-amber-500"></i>
                    <span>Copy Address</span>
                  </button>
                  <button onclick="app.openOrderFormModal(); app.closeAllCardKebabMenus();" class="tf-kebab-item w-full text-left">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5 text-blue-600"></i>
                    <span>Create Material PO</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Identity Core: Circle Avatar + Bold Name + Contact Person + Phone & WA -->
            <div class="flex items-center gap-3 min-w-0 cursor-pointer" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}', 'dossier')" title="Click to view full Profile Dossier for ${tfEscapeHtml(pkg.name)}">
              ${logoHtml}
              <div class="min-w-0 flex-1">
                <div class="min-h-[44px] max-h-[44px] flex items-center">
                  <h3 class="font-black text-white text-[18px] sm:text-[19px] leading-tight line-clamp-2 drop-shadow-xs hover:text-blue-200 transition-colors" title="${tfEscapeHtml(pkg.name)}">
                    ${tfEscapeHtml(pkg.name)}
                  </h3>
                </div>
                <div class="h-[20px] flex items-center mt-0.5">
                  ${pkg.contactPerson ? `
                    <div class="text-blue-100 text-sm font-bold flex items-center gap-1.5 truncate">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-blue-300 shrink-0"></i>
                      <span class="truncate">${tfEscapeHtml(pkg.contactPerson)}</span>
                    </div>
                  ` : `
                    <div class="text-blue-200/70 text-xs font-medium flex items-center gap-1.5 truncate">
                      <i data-lucide="user" class="w-3.5 h-3.5 text-blue-300/70 shrink-0"></i>
                      <span class="truncate italic">Packaging Executive</span>
                    </div>
                  `}
                </div>
                <div class="h-[20px] flex items-center gap-2 mt-0.5">
                  <a href="tel:${tfEscapeHtml(cleanPhone)}" onclick="event.stopPropagation()" class="text-white text-xs font-mono font-bold hover:text-blue-200 transition-colors flex items-center gap-1 truncate" title="Call ${tfEscapeHtml(pkg.phone)}">
                    <i data-lucide="phone" class="w-3 h-3 text-white/80 shrink-0"></i>
                    <span>${tfEscapeHtml(pkg.phone || 'No phone')}</span>
                  </a>
                  ${waPhone ? `
                    <a href="https://api.whatsapp.com/send?phone=${tfEscapeHtml(waPhone)}&text=${tfEscapeHtml(waMsg)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()" class="tf-wa-btn" title="Chat on WhatsApp">
                      <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- 2-Column Info Grid inside Banner -->
            <div class="tf-banner-grid-v4">
              <!-- Left Column: Address & Email -->
              <div class="space-y-1 min-w-0 pr-1">
                <div class="tf-copy-clickable" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeAddress))}', 'Address', this)" title="Click to copy Address">
                  <div class="text-xs text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="map-pin" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>Address</span>
                  </div>
                  <div class="text-xs text-white font-medium line-clamp-2 leading-tight mt-0.5">
                    ${tfEscapeHtml(pkg.billingAddress || pkg.shippingAddress || '')}
                  </div>
                </div>
                <div class="tf-copy-clickable truncate" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeEmail))}', 'Email', this)" title="Click to copy Email">
                  <div class="text-xs text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="mail" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span class="truncate text-xs text-white font-medium">${tfEscapeHtml(pkg.email || 'supply@' + (pkg.name || 'pkg').toLowerCase().replace(/[^a-z0-9]/g, '') + '.com')}</span>
                  </div>
                </div>
              </div>

              <!-- Right Column: Business Type & GSTIN -->
              <div class="space-y-1 min-w-0 pl-1 border-l border-white/15">
                <div>
                  <div class="text-xs text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="box" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>Business Type</span>
                  </div>
                  <div class="text-xs text-white font-semibold truncate mt-0.5">
                    ${tfEscapeHtml(pkg.businessType || 'Jars & Labels')}
                  </div>
                </div>
                <div class="tf-copy-clickable truncate" onclick="event.stopPropagation(); app.copyTextToClipboard('${tfEscapeHtml(tfEscapeJs(safeGstin))}', 'GSTIN', this)" title="Click to copy GSTIN">
                  <div class="text-xs text-white/70 font-medium flex items-center gap-1">
                    <i data-lucide="file-text" class="w-2.5 h-2.5 text-white/70 shrink-0"></i>
                    <span>GSTIN</span>
                  </div>
                  <div class="text-xs text-white font-mono font-semibold truncate mt-0.5">
                    ${tfEscapeHtml(pkg.gstin || '')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card Body Zone -->
          <div class="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
            <!-- Dual Soft Metric Tiles with 1-Click Deep Linking -->
            <div class="grid grid-cols-2 gap-2.5">
              <!-- Left Tile: Active POs (Mint) -> Deep links to Hub Orders -->
              <div onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}', 'hub', 'orders')" class="tf-metric-tile-v4 tf-metric-tile-mint tf-metric-tile-clickable group/tile cursor-pointer" title="Click to view all Packaging Orders in dedicated Hub">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                      <i data-lucide="boxes" class="w-3 h-3"></i>
                    </div>
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">Active POs</span>
                  </div>
                  <div class="w-4.5 h-4.5 rounded-full bg-blue-500/15 dark:bg-blue-500/25 flex items-center justify-center text-blue-700 dark:text-blue-300 group-hover/tile:bg-blue-600 group-hover/tile:text-white transition-colors shrink-0">
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </div>
                </div>
                <div class="flex items-baseline justify-between gap-1 mt-1">
                  <span class="text-xl font-black text-slate-900 dark:text-white leading-none">
                    ${tfEscapeHtml(String(pkgOrders.length).padStart(2, '0'))}
                  </span>
                  <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                    ${tfEscapeHtml(pkgOrders.length > 0 ? pkgOrders.length + ' POs' : 'Ready for PO')}
                  </span>
                </div>
              </div>

              <!-- Right Tile: Payables (Sky Blue) -> Deep links to Hub Payments -->
              <div onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}', 'hub', 'payments')" class="tf-metric-tile-v4 tf-metric-tile-blue tf-metric-tile-clickable group/tile cursor-pointer" title="Click to view Financial Ledger & Settlements in dedicated Hub">
                <div class="flex items-center justify-between gap-1">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <div class="w-5 h-5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                      <i data-lucide="wallet" class="w-3 h-3"></i>
                    </div>
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide truncate">Payables</span>
                  </div>
                  <div class="w-4.5 h-4.5 rounded-full bg-blue-500/15 dark:bg-blue-500/25 flex items-center justify-center text-blue-700 dark:text-blue-300 group-hover/tile:bg-blue-600 group-hover/tile:text-white transition-colors shrink-0">
                    <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
                  </div>
                </div>
                <div class="flex items-baseline justify-between gap-1 mt-1">
                  <span class="text-lg font-black text-[#1d4ed8] dark:text-blue-400 leading-none font-mono-num truncate" title="${tfEscapeHtml(this.formatCurrency(balance))}">
                    ${tfEscapeHtml(this.formatCurrency(balance))}
                  </span>
                  <span class="text-xs font-semibold ${tfEscapeHtml(balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')} truncate">
                    ${tfEscapeHtml(balance > 0 ? 'Due' : 'Settled')}
                  </span>
                </div>
              </div>
            </div>

            <!-- Latest Orders Mini-Table -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between px-0.5">
                <div class="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <i data-lucide="package" class="w-3.5 h-3.5 text-blue-600"></i>
                  <span>Latest Deliveries</span>
                </div>
                <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}', 'hub', 'orders')" class="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-0.5" title="View all POs for ${tfEscapeHtml(pkg.name)}">
                  <span>View All</span>
                  <i data-lucide="chevron-right" class="w-3 h-3"></i>
                </button>
              </div>

              <div class="tf-orders-minitable-v4">
                <div class="minitable-header">
                  <span>PO Number</span>
                  <span>Batch Link</span>
                  <span class="text-right">Cost</span>
                </div>
                ${latestOrders.length === 0 ? `
                  <div onclick="app.openOrderFormModal()" class="flex-1 flex items-center justify-center gap-1.5 p-2 text-center text-xs text-slate-400 hover:text-blue-600 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                    <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
                    <span>No active POs · Create packaging PO</span>
                  </div>
                ` : `
                  ${latestOrders.slice(0, 2).map(o => `
                    <div onclick="event.stopPropagation(); app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="minitable-row" title="Inspect PO ${tfEscapeHtml(o.invoiceNumber)}">
                      <span class="font-mono font-bold text-slate-900 dark:text-white truncate">${tfEscapeHtml(o.invoiceNumber)}</span>
                      <span class="truncate text-slate-700 dark:text-slate-300 font-medium">${tfEscapeHtml(o.retailerName || 'Standard Consignment')}</span>
                      <span class="text-right font-medium text-slate-700 dark:text-slate-300 flex items-center justify-end gap-0.5 truncate font-mono-num font-bold">
                        <span>${tfEscapeHtml(this.formatCurrency(o.packagingCost || 0))}</span>
                        <i data-lucide="chevron-right" class="w-2.5 h-2.5 text-slate-400 shrink-0"></i>
                      </span>
                    </div>
                  `).join('')}
                  ${latestOrders.length === 1 ? `
                    <div class="minitable-row minitable-row-empty">
                      <span>-</span>
                      <span>Slot available for Delivery 2</span>
                      <span class="text-right">-</span>
                    </div>
                  ` : ''}
                `}
              </div>
            </div>

            <!-- Tactile Footer Action Bar -->
            <div class="pt-2 flex items-center gap-2">
              <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}', 'hub', 'all')" class="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-[#1e3a8a] hover:bg-[#1e40af] transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-98">
                <i data-lucide="boxes" class="w-3.5 h-3.5"></i>
                <span>View Supplier Hub &amp; POs</span>
                <i data-lucide="chevron-right" class="w-3 h-3"></i>
              </button>
              <button type="button" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(pkg.id))}', 'dossier')" class="w-9 h-9 rounded-xl text-blue-800 bg-[#dbeafe] hover:bg-[#bfdbfe] border border-blue-200/60 flex items-center justify-center shrink-0 transition-all active:scale-95 shadow-2xs" title="View &amp; Edit Profile Dossier">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Smart Filter & Search Bar -->
        <div class="tf-directory-toolbar">
          <div class="flex items-center gap-2 flex-1 max-w-md">
            <div class="relative w-full">
              <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
              <input type="text" id="pkg-search-input" oninput="app.searchPartnerCards('packaging', this.value)" placeholder="Search packaging suppliers by name, city, GSTIN, phone..." class="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">Filter:</span>
            <button type="button" onclick="app.filterPartnerCards('packaging', 'all', this)" class="tf-filter-chip active">All (${tfEscapeHtml(pkgs.length)})</button>
            <button type="button" onclick="app.filterPartnerCards('packaging', 'active_orders', this)" class="tf-filter-chip">Active POs</button>
            <button type="button" onclick="app.filterPartnerCards('packaging', 'balance_due', this)" class="tf-filter-chip">Payables Due</button>
            <button type="button" onclick="app.filterPartnerCards('packaging', 'all_clear', this)" class="tf-filter-chip">All Settled</button>
          </div>
        </div>

        <!-- 4 Cards Per Row Grid with Responsive Squeezing -->
        <div id="packaging-card-grid" class="grid gap-4 w-full tf-partner-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }

  /* ================= PARTNER SPOTLIGHT CENTERED WINDOW ================= */
  openPartnerSpotlightModal(contactId) {
    const contact = (this.data.contacts || []).find(c => c.id === contactId);
    if (!contact) return;

    const modal = document.getElementById('partner-spotlight-modal');
    if (!modal) return;

    const headerName = document.getElementById('spotlight-header-name');
    const headerRole = document.getElementById('spotlight-header-role');
    const headerSub = document.getElementById('spotlight-header-sub');
    const editBtn = document.getElementById('spotlight-btn-edit');
    const content = document.getElementById('partner-spotlight-content');

    if (headerName) headerName.textContent = contact.name;
    if (headerRole) {
      const roleMap = {
        manufacturer: 'Manufacturer',
        packaging: 'Packaging & Labels',
        retailer: 'Buyer / Retailer',
        transporter: 'Transporter / Logistics',
        marketeer: 'Sales Broker'
      };
      headerRole.textContent = roleMap[contact.role] || contact.role;
    }
    if (headerSub) {
      headerSub.textContent = `${contact.contactPerson || 'Direct'} · ${contact.phone || 'No Phone'} · GSTIN: ${contact.gstin || 'Unregistered'}`;
    }
    if (editBtn) {
      editBtn.onclick = () => {
        this.closePartnerSpotlightModal();
        this.openEditContactModal(contact.id);
      };
    }

    const tabBtn = document.getElementById('spotlight-btn-tab');
    if (tabBtn) {
      tabBtn.onclick = () => {
        this.closeDailyDiaryModal();
        this.closePartnerSpotlightModal();
        this.navigateToContact(contact.id);
      };
    }

    // Find linked orders (both ID and Name match, or linked through payments)
    const cLower = (contact.name || '').toLowerCase();
    let linkedOrders = (this.data.orders || []).filter(o => !o.isDeleted && (
      (contact.role === 'manufacturer' && (o.manufacturerId === contact.id || (o.manufacturerName && o.manufacturerName.toLowerCase().includes(cLower)))) ||
      (contact.role === 'packaging' && (o.packagingVendorId === contact.id || (o.packagingVendorName && o.packagingVendorName.toLowerCase().includes(cLower)))) ||
      (contact.role === 'retailer' && (o.retailerId === contact.id || (o.retailerName && o.retailerName.toLowerCase().includes(cLower)))) ||
      (contact.role === 'transporter' && (o.transporterId === contact.id || (o.transporterName && o.transporterName.toLowerCase().includes(cLower)))) ||
      (contact.role === 'marketeer' && (o.marketeerId === contact.id || (o.marketeerName && o.marketeerName.toLowerCase().includes(cLower))))
    ));

    // Also include orders referenced by any payment with this partner
    const partnerPayments = (this.data.payments || []).filter(p => !p.isDeleted && (
      (p.partyName && p.partyName.toLowerCase().includes(cLower)) ||
      (cLower && cLower.includes((p.partyName || '').toLowerCase()))
    ));
    partnerPayments.forEach(p => {
      if (p.orderRef) {
        const ord = this.findOrder(p.orderRef);
        if (ord && !linkedOrders.some(x => x.id === ord.id)) {
          linkedOrders.push(ord);
        }
      }
    });

    // Compute metrics
    let totalVol = 0;
    let totalPaid = 0;
    if (contact.role === 'manufacturer') {
      totalVol = linkedOrders.reduce((s, o) => s + (o.manufacturerTotalCost || 0), 0);
      totalPaid = linkedOrders.reduce((s, o) => s + (o.manufacturerAdvancePaid || 0), 0);
    } else if (contact.role === 'packaging') {
      totalVol = linkedOrders.reduce((s, o) => s + (o.packagingCost || 0), 0);
      totalPaid = linkedOrders.reduce((s, o) => s + (o.packagingAdvancePaid || 0), 0);
    } else if (contact.role === 'retailer') {
      totalVol = linkedOrders.reduce((s, o) => s + (o.totalInvoiceAmount || 0), 0);
      totalPaid = linkedOrders.reduce((s, o) => s + (o.customerAdvanceReceived || 0), 0);
    } else {
      totalVol = linkedOrders.reduce((s, o) => s + (o.totalInvoiceAmount || 0), 0);
    }
    const balanceDue = Math.max(0, totalVol - totalPaid);

    if (content) {
      content.innerHTML = `
        <!-- Top Metrics Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Total Lifetime Volume</span>
            <span class="text-base font-black font-mono-num text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(totalVol))}</span>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-center">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Advances / Cleared</span>
            <span class="text-base font-black font-mono-num text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(this.formatCurrency(totalPaid))}</span>
          </div>
          <div class="p-3.5 rounded-xl ${tfEscapeHtml(balanceDue > 0 ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60' : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60')} border text-center">
            <span class="text-xs font-bold uppercase tracking-wider ${tfEscapeHtml(balanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')} block mb-1">
              ${tfEscapeHtml(contact.role === 'retailer' ? 'Balance Receivable' : 'Current Factory Payable')}
            </span>
            <span class="text-base font-black font-mono-num ${tfEscapeHtml(balanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}">${tfEscapeHtml(this.formatCurrency(balanceDue))}</span>
          </div>
        </div>

        <!-- Banking Settlement & Payout Coordinates -->
        <div class="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-slate-900/80 dark:to-slate-800/60 border border-slate-200 dark:border-slate-700/80">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <i data-lucide="landmark" class="w-4 h-4"></i>
              </span>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">Verified Bank Payout &amp; Settlement Coordinates</h4>
            </div>
            <button type="button" onclick="app.closePartnerSpotlightModal(); app.openPaymentModal(null, '${tfEscapeHtml(tfEscapeJs(contact.name))}', '${tfEscapeHtml(tfEscapeJs(contact.role === 'retailer' ? 'received' : 'paid'))}')" class="btn-tactile px-3 py-1 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 shadow-xs">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Log Payment</span>
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div class="bg-white dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span class="text-xs text-slate-400 block font-medium">Bank Name</span>
              <span class="font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(contact.bankName || '')}</span>
            </div>
            <div class="bg-white dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span class="text-xs text-slate-400 block font-medium">Account Number</span>
              <div class="flex items-center justify-between">
                <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(contact.accountNumber || '')}</span>
                <button type="button" onclick="navigator.clipboard.writeText('${tfEscapeHtml(tfEscapeJs(contact.accountNumber || ''))}'); app.showToast('Account number copied!');" class="text-slate-400 hover:text-emerald-700" title="Copy Account Number">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>
            <div class="bg-white dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span class="text-xs text-slate-400 block font-medium">IFSC Code</span>
              <span class="font-mono font-bold text-amber-600 dark:text-amber-400">${tfEscapeHtml(contact.ifsc || '')}</span>
            </div>
            <div class="bg-white dark:bg-slate-900/90 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <span class="text-xs text-slate-400 block font-medium">Payment Terms</span>
              <span class="font-semibold text-slate-800 dark:text-slate-200">${tfEscapeHtml(contact.paymentTerms || this.config().defaultPaymentTerms)}</span>
            </div>
          </div>
        </div>

        <!-- Address & Contact Row -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div class="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Billing &amp; Registered Address</span>
            <p class="text-slate-700 dark:text-slate-300">${tfEscapeHtml(contact.billingAddress || 'Address on file')}</p>
          </div>
          <div class="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Direct Contact &amp; Telephony</span>
            <p class="text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span><strong>${tfEscapeHtml(contact.contactPerson || 'Direct')}</strong></span>
              <span>•</span>
              <a href="tel:${tfEscapeHtml(contact.phone)}" class="font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline">${tfEscapeHtml(contact.phone)}</a>
            </p>
          </div>
        </div>

        <!-- Orders & Batches Ledger -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div class="p-3 px-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">Production Batches &amp; Orders (${tfEscapeHtml(linkedOrders.length)})</span>
            </div>
            <span class="text-xs text-slate-400">Click any row to open full Order dossier</span>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
            ${linkedOrders.length === 0 ? `
              <div class="p-6 text-center text-xs text-slate-400">No active batches or orders linked yet.</div>
            ` : linkedOrders.map(o => `
              <div onclick="app.closePartnerSpotlightModal(); app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="p-3 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 cursor-pointer flex items-center justify-between text-xs transition-colors">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-amber-600 dark:text-amber-400">${tfEscapeHtml(o.invoiceNumber || o.id)}</span>
                    <span class="text-slate-500">· For: ${tfEscapeHtml(o.retailerName || 'Retailer')}</span>
                    <span class="px-1.5 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">${tfEscapeHtml((o.status || '').replace(/_/g, ' '))}</span>
                  </div>
                  <p class="text-xs text-slate-400 mt-0.5">${tfEscapeHtml(o.items ? o.items.map(i => `${i.quantity}x ${i.variant || i.name}`).join(', ') : 'Pickle Batch')}</p>
                </div>
                <div class="flex items-center gap-3">
                  <div class="text-right">
                    <span class="font-mono font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(contact.role === 'manufacturer' ? o.manufacturerTotalCost : contact.role === 'packaging' ? o.packagingCost : o.totalInvoiceAmount))}</span>
                    <span class="block text-xs text-slate-400">Paid: ${tfEscapeHtml(this.formatCurrency(contact.role === 'manufacturer' ? o.manufacturerAdvancePaid : contact.role === 'packaging' ? o.packagingAdvancePaid : o.customerAdvanceReceived))}</span>
                  </div>
                  <button type="button" class="btn-tactile px-2.5 py-1 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-amber-500 hover:text-slate-950 transition-colors">Inspect →</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closePartnerSpotlightModal() {
    const modal = document.getElementById('partner-spotlight-modal');
    if (modal) modal.classList.add('hidden');
  }

  // View: Logistics & Transport Tracker
  renderTransportView() {
    const container = document.getElementById('view-transport-container');
    if (!container) return;

    const orders = this.data.orders;
    const totalFreightPaid = orders.reduce((s, o) => s + (o.transportPaidByUs ? o.totalTransportCost : 0), 0);
    const partnerDirectory = window.TFPartnerUI ? window.TFPartnerUI.renderDirectory(this, 'transporter') + '<h2 class="text-base font-bold text-slate-900 dark:text-slate-100 mt-8 mb-3">All trips · LR &amp; freight tracker</h2>' : '';

    container.innerHTML = partnerDirectory + `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs mb-4 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">Lorry Receipt (LR / Bilty) & Freight Tracker</h3>
          <p class="text-xs text-slate-500">Track transport legs from Packaging Vendor Factory Retailer Destination.</p>
        </div>
        <div class="text-right">
          <span class="text-xs text-slate-400 block">Total Freight Absorbed By You</span>
          <span class="text-lg font-black font-mono-num text-slate-900 dark:text-slate-100">${tfEscapeHtml(this.formatCurrency(totalFreightPaid))}</span>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase text-xs">
              <th class="p-3.5">Invoice / Order</th>
              <th class="p-3.5">Transporter</th>
              <th class="p-3.5">LR / Bilty Number</th>
              <th class="p-3.5">Vehicle Number</th>
              <th class="p-3.5">Destination</th>
              <th class="p-3.5 text-right">Freight Charges</th>
              <th class="p-3.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            ${orders.map(o => `
              <tr onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}', event)" class="hover:bg-amber-500/5 dark:hover:bg-amber-500/10 cursor-pointer transition-colors group" title="Click to view full Order Inspection tab">
                <td class="p-3.5 font-mono-num font-bold text-amber-600 dark:text-amber-400">
                  <span class="group-hover:underline flex items-center gap-1">${tfEscapeHtml(o.invoiceNumber)} <i data-lucide="external-link" class="w-3 h-3 opacity-60"></i></span>
                </td>
                <td class="p-3.5 font-medium text-slate-800 dark:text-slate-200">
                  <div class="flex items-center justify-between gap-1">
                    <button onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(o.transporterId || ''))}')" class="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 font-semibold" title="Click to open Transporter hub">
                      <i data-lucide="truck" class="w-3.5 h-3.5 text-blue-500"></i>
                      <span>${tfEscapeHtml(o.transporterName)}</span>
                    </button>
                    <button onclick="event.stopPropagation(); app.openEditContactModal('${tfEscapeHtml(tfEscapeJs(o.transporterId || ''))}')" class="text-slate-400 hover:text-emerald-700 p-0.5" title="Edit Transporter Details">
                      <i data-lucide="edit-3" class="w-3 h-3"></i>
                    </button>
                  </div>
                  ${tfEscapeHtml((() => {
                    const tr = this.data.contacts.find(c => c.id === (o.transporterId || ''));
                    return tr && tr.phone ? `<a href="tel:${tfEscapeHtml(tr.phone.replace(/[^0-9+]/g, ''))}" class="inline-flex items-center gap-1 text-xs font-mono-num font-bold text-emerald-600 dark:text-emerald-400 hover:underline mt-0.5"><i data-lucide="phone" class="w-3 h-3"></i> ${tfEscapeHtml(tr.phone)}</a>` : '';
                  })())}
                </td>
                <td class="p-3.5 font-mono-num font-bold ${tfEscapeHtml(o.lrNumber ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 italic')}">${tfEscapeHtml(o.lrNumber || 'Pending (Awaiting Dispatch)')}</td>
                <td class="p-3.5 font-mono-num ${tfEscapeHtml(o.vehicleNumber ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 italic')}">${tfEscapeHtml(o.vehicleNumber || 'Unassigned')}</td>
                <td class="p-3.5 text-slate-600 dark:text-slate-400">
                  <button onclick="event.stopPropagation(); app.navigateToContact('${tfEscapeHtml(tfEscapeJs(o.retailerId))}')" class="text-slate-900 dark:text-slate-100 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold hover:underline" title="Click to open Buyer hub">
                    ${tfEscapeHtml(o.retailerName)}
                  </button>
                </td>
                <td class="p-3.5 text-right font-mono-num font-bold text-slate-900 dark:text-slate-100">${tfEscapeHtml(this.formatCurrency(o.totalTransportCost))}</td>
                <td class="p-3.5 text-center">
                  <span class="px-2 py-0.5 rounded text-xs font-semibold ${tfEscapeHtml(o.status === 'in_transit' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}">
                    ${tfEscapeHtml(o.status.replace(/_/g, ' ').toUpperCase())}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // View: Retailers Directory
  renderRetailersView() {
    const container = document.getElementById('view-retailers-container');
    if (!container) return;

    if (window.TFPartnerUI) {
      container.innerHTML = window.TFPartnerUI.renderDirectory(this, 'retailer');
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (window.TFComponents && typeof window.TFComponents.renderRetailersDirectory === 'function') {
      const retailers = this.data.contacts.filter(c => c.role === 'retailer');
      container.innerHTML = window.TFComponents.renderRetailersDirectory(retailers, this.data.orders, this.data.payments);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const retailers = this.data.contacts.filter(c => c.role === 'retailer');

    container.innerHTML = retailers.map(r => `
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs flex flex-col justify-between hover:border-emerald-600 transition-colors">
        <div>
          <div class="flex items-start justify-between mb-2">
            <div>
              <h4 class="font-bold text-slate-900 dark:text-slate-100 text-sm hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline cursor-pointer" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}')">${tfEscapeHtml(r.name)}</h4>
              <div class="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>Contact: <strong class="text-slate-900 dark:text-white">${tfEscapeHtml(r.contactPerson)}</strong></span>
                <span>•</span>
                <a href="tel:${tfEscapeHtml((r.phone || '').replace(/[^0-9+]/g, ''))}" class="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono-num font-bold text-xs text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 rounded-md transition-colors" title="Call ${tfEscapeHtml(r.name)}">
                  <i data-lucide="phone" class="w-3.5 h-3.5 text-emerald-500"></i>
                  <span>${tfEscapeHtml(r.phone)}</span>
                </a>
              </div>
            </div>
            <span class="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 rounded">
              ${tfEscapeHtml(r.paymentTerms)}
            </span>
          </div>

          <div class="space-y-1 my-3 text-xs text-slate-600 dark:text-slate-400">
            <p><strong>GSTIN:</strong> <span class="font-mono-num uppercase">${tfEscapeHtml(r.gstin)}</span></p>
            <p><strong>Billing:</strong> ${tfEscapeHtml(r.billingAddress)}</p>
            <p><strong>Godown (Shipping):</strong> ${tfEscapeHtml(r.shippingAddress)}</p>
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span class="text-xs text-slate-400 block">Balance Receivable</span>
            <span class="text-base font-bold font-mono-num ${tfEscapeHtml(r.currentBalanceDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300')}">
              ${tfEscapeHtml(this.formatCurrency(r.currentBalanceDue))}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="event.stopPropagation(); app.openEditContactModal('${tfEscapeHtml(tfEscapeJs(r.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-1" title="Edit Retailer Details">
              <i data-lucide="edit-3" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Edit</span>
            </button>
            <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(r.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-lg border border-amber-300 dark:border-amber-700 flex items-center gap-1">
              <span>View Account (${tfEscapeHtml(r.totalOrders)} Orders)</span>
              <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // View: Marketeers & Brokers
  renderMarketeersView() {
    const container = document.getElementById('view-marketeers-container');
    if (!container) return;

    if (window.TFPartnerUI) {
      container.innerHTML = window.TFPartnerUI.renderDirectory(this, 'marketeer');
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (window.TFComponents && typeof window.TFComponents.renderMarketeersDirectory === 'function') {
      const marketeers = this.data.contacts.filter(c => c.role === 'marketeer');
      container.innerHTML = window.TFComponents.renderMarketeersDirectory(marketeers, this.data.orders, this.data.payments);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const marketeers = this.data.contacts.filter(c => c.role === 'marketeer');

    container.innerHTML = marketeers.map(m => {
      const orders = this.data.orders.filter(o => o.marketeerId === m.id);
      const totalCommission = orders.reduce((s, o) => s + (o.marketeerCommissionAmount || 0), 0);

      return `
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs space-y-4">
          <div class="flex items-start justify-between">
            <div>
              <h4 class="font-bold text-slate-900 dark:text-slate-100 text-base hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline cursor-pointer" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}')">${tfEscapeHtml(m.name)}</h4>
              <div class="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-1">
                <a href="tel:${tfEscapeHtml((m.phone || '').replace(/[^0-9+]/g, ''))}" class="inline-flex items-center gap-1.5 px-2 py-0.5 font-mono-num font-bold text-xs text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 rounded-md transition-colors" title="Call ${tfEscapeHtml(m.name)}">
                  <i data-lucide="phone" class="w-3.5 h-3.5 text-emerald-500"></i>
                  <span>${tfEscapeHtml(m.phone)}</span>
                </a>
                <span>• Terms: ${tfEscapeHtml(m.paymentTerms)}</span>
              </div>
            </div>
            <div class="text-right flex flex-col items-end gap-1.5">
              <div>
                <span class="text-xs text-slate-400 block">Total Brokerage Generated</span>
                <span class="text-base font-bold font-mono-num text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(this.formatCurrency(totalCommission))}</span>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="event.stopPropagation(); app.openEditContactModal('${tfEscapeHtml(tfEscapeJs(m.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-1" title="Edit Marketeer Details">
                  <i data-lucide="edit-3" class="w-3 h-3 text-amber-500"></i>
                  <span>Edit</span>
                </button>
                <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(m.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded border border-amber-300 dark:border-amber-700">
                  View Marketeer Hub →
                </button>
              </div>
            </div>
          </div>

          <div class="border-t border-slate-100 dark:border-slate-800 pt-3">
            <h5 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Orders Brought by Marketeer (${tfEscapeHtml(orders.length)})</h5>
            <div class="space-y-1.5 text-xs">
              ${orders.map(o => `
                <div onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="flex justify-between p-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-500/5 rounded-lg cursor-pointer group transition-colors">
                  <div>
                    <span class="font-mono-num font-bold text-emerald-700 dark:text-emerald-400 group-hover:underline">${tfEscapeHtml(o.invoiceNumber)}</span>
                    <span class="text-slate-500 ml-2">${tfEscapeHtml(o.retailerName)}</span>
                  </div>
                  <span class="font-mono-num font-bold text-slate-800 dark:text-slate-200">Cut: ${tfEscapeHtml(this.formatCurrency(o.marketeerCommissionAmount))}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  quickFilterContactOrders(contactId) {
    const contact = this.data.contacts.find(c => c.id === contactId);
    if (!contact) return;
    this.activeTab = 'orders';
    this.updateSidebarUI();
    this.statusFilter = 'all';
    this.searchQuery = contact.name.toLowerCase();
    const searchInput = document.getElementById('global-search');
    if (searchInput) searchInput.value = contact.name;
    this.renderActiveView();
  }

  toggleCardKebabMenu(contactId, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const allMenus = document.querySelectorAll('.tf-kebab-menu-popup');
    const targetMenu = document.getElementById(`kebab-menu-${contactId}`);
    
    // Close other open kebab menus
    allMenus.forEach(m => {
      if (m !== targetMenu) m.classList.add('hidden');
    });

    if (targetMenu) {
      targetMenu.classList.toggle('hidden');
    }
  }

  closeAllCardKebabMenus() {
    const allMenus = document.querySelectorAll('.tf-kebab-menu-popup');
    allMenus.forEach(m => m.classList.add('hidden'));
  }

  filterPartnerCards(type, filterMode, btn) {
    // Update active chip style in toolbar
    if (btn && btn.parentElement) {
      btn.parentElement.querySelectorAll('.tf-filter-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
    }

    const cards = document.querySelectorAll(`[data-partner-type="${type}"]`);
    cards.forEach(card => {
      let visible = true;
      if (filterMode === 'active_orders') {
        const count = parseInt(card.getAttribute('data-active-orders') || '0', 10);
        visible = count > 0;
      } else if (filterMode === 'balance_due') {
        visible = card.getAttribute('data-has-balance') === 'true';
      } else if (filterMode === 'all_clear') {
        visible = card.getAttribute('data-has-balance') === 'false';
      }
      card.style.display = visible ? '' : 'none';
    });
  }

  searchPartnerCards(type, query) {
    const q = (query || '').toLowerCase().trim();
    const cards = document.querySelectorAll(`[data-partner-type="${type}"]`);
    cards.forEach(card => {
      if (!q) {
        card.style.display = '';
        return;
      }
      const name = card.getAttribute('data-name') || '';
      const person = card.getAttribute('data-person') || '';
      const city = card.getAttribute('data-city') || '';
      const cardText = card.innerText.toLowerCase();
      const match = name.includes(q) || person.includes(q) || city.includes(q) || cardText.includes(q);
      card.style.display = match ? '' : 'none';
    });
  }
});
