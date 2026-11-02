// TradeFlow: New order window. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // New Order Modal
  // ================= SMART MULTI-SKU NEW ORDER COCKPIT & WHATSAPP PARSER =================

  populateNewOrderSelects() {
    const retailerSelect = document.getElementById('new-order-retailer');
    const mfgSelect = document.getElementById('new-order-mfg');
    const pkgSelect = document.getElementById('new-order-pkg');
    const transporterSelect = document.getElementById('new-order-transporter');
    const marketeerSelect = document.getElementById('new-order-marketeer');
    const cloneSelect = document.getElementById('new-order-clone-select');
    const dateInput = document.getElementById('new-order-date');

    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    if (retailerSelect) {
      retailerSelect.innerHTML = '<option value="">Select Retailer / Customer...</option>' + 
        this.data.contacts.filter(c => c.role === 'retailer').map(c => 
          `<option value="${tfEscapeHtml(c.id)}">${tfEscapeHtml(c.name)}${c.state ? ` (${tfEscapeHtml(c.state)})` : ''}</option>`
        ).join('');
      retailerSelect.onchange = (e) => {
        this.checkRetailerCreditExposure(e.target.value);
      };
    }

    if (cloneSelect) {
      cloneSelect.innerHTML = '<option value="">-- Clone Commercials from Past Order --</option>' +
        this.data.orders.map(o => 
          `<option value="${tfEscapeHtml(o.id)}">${tfEscapeHtml(o.invoiceNumber)} - ${tfEscapeHtml(o.retailerName)} (${tfEscapeHtml((o.items || []).length)} SKUs, ${tfEscapeHtml(this.formatCurrency(o.totalInvoiceAmount))})</option>`
        ).join('');
    }

    if (mfgSelect) {
      mfgSelect.innerHTML = '<option value="">— Select manufacturer —</option>' + this.data.contacts.filter(c => c.role === 'manufacturer').map(c => 
        `<option value="${tfEscapeHtml(c.id)}">${tfEscapeHtml(c.name)}${c.state ? ` (${tfEscapeHtml(c.state)})` : ''}</option>`
      ).join('');
    }

    if (pkgSelect) {
      pkgSelect.innerHTML = '<option value="">— Select packaging supplier —</option>' + this.data.contacts.filter(c => c.role === 'packaging').map(c => 
        `<option value="${tfEscapeHtml(c.id)}">${tfEscapeHtml(c.name)}</option>`
      ).join('');
    }

    if (transporterSelect) {
      transporterSelect.innerHTML = '<option value="">— Select transporter —</option>' + this.data.contacts.filter(c => c.role === 'transporter').map(c => 
        `<option value="${tfEscapeHtml(c.id)}">${tfEscapeHtml(c.name)}</option>`
      ).join('');
    }

    if (marketeerSelect) {
      marketeerSelect.innerHTML = '<option value="">Direct Order (No Broker)</option>' + 
        this.data.contacts.filter(c => c.role === 'marketeer').map(c => 
          `<option value="${tfEscapeHtml(c.id)}">${tfEscapeHtml(c.name)}</option>`
        ).join('');
    }

    // Quick-add buttons: one per pack size in the catalogue, labelled with its units per case.
    const quickSizes = document.getElementById('new-order-quick-sizes');
    if (quickSizes) {
      const sizes = [...new Map((this.data.products || []).filter(p => p.active !== false && (p.defaultPackSize || p.packSize))
        .map(p => [p.defaultPackSize || p.packSize, Number(p.casePack) || this.casePackConfig[p.defaultPackSize || p.packSize] || this.config().defaultCasePack])).entries()].slice(0, 4);
      quickSizes.innerHTML = sizes.map(([size, perCase]) => `<button type="button" onclick="app.quickAddSkuRow('${tfEscapeHtml(tfEscapeJs(size))}')" class="btn-tactile px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-lg">+ ${tfEscapeHtml(size)} Row (${tfEscapeHtml(perCase)}/cs)</button>`).join('');
    }
  }

  openNewOrderModal() {
    this.unmountOrderEditCockpit();
    const modal = document.getElementById('new-order-modal');
    if (!modal) return;

    this.editingOrderId = null;
    const titleEl = document.getElementById('order-modal-title');
    if (titleEl) titleEl.innerText = 'Create FMCG Batch & Trade Order';
    const draftBtn = document.getElementById('order-modal-submit-draft');
    if (draftBtn) draftBtn.innerText = 'Save Pipeline Draft';
    const mainLabel = document.getElementById('order-modal-submit-label');
    if (mainLabel) mainLabel.innerText = 'Create Order & Open Factory PO';

    this.populateNewOrderSelects();

    // A new order starts with no advance and the default payment terms (the buyer's own terms apply when chosen).
    const advanceInput = document.getElementById('new-order-advance');
    if (advanceInput) advanceInput.value = '';
    const termsInput = document.getElementById('new-order-payment-terms');
    if (termsInput) termsInput.value = this.config().defaultPaymentTerms;
    const dateInput = document.getElementById('new-order-date');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);

    // Sync carton packaging config inputs
    ['500g', '1kg', '5kg'].forEach(ps => {
      const el = document.getElementById(`master-pack-${ps}`);
      if (el) el.value = this.casePackConfig[ps] || this.config().defaultCasePack;
    });

    // If no items are in the table yet, add a starter row from the first active product.
    if (!this.orderSkuItems || this.orderSkuItems.length === 0) {
      const defaultProd = (this.data.products || []).find(p => p.active !== false);
      this.orderSkuItems = defaultProd ? [this.skuItemFromProduct(defaultProd, { cases: 1 })] : [];
      if (!defaultProd) this.showToast('Add a product in the Products tab before creating an order.');
    }

    this.renderOrderSkuTable();
    this.recomputeOrderTotals();

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeNewOrderModal() {
    const modal = document.getElementById('new-order-modal');
    if (modal) modal.classList.add('hidden');
    this.editingOrderId = null;
    const title = document.getElementById('order-modal-title');
    if (title) title.innerText = 'Create FMCG Batch & Trade Order';
    const draftBtn = document.getElementById('order-modal-submit-draft');
    if (draftBtn) draftBtn.innerText = 'Save Pipeline Draft';
    const mainLabel = document.getElementById('order-modal-submit-label');
    if (mainLabel) mainLabel.innerText = 'Create Order & Open Factory PO';
  }

  openEditOrderModal(orderId) {
    const order = (this.data.orders || []).find(o => o.id === orderId);
    if (!order) {
      this.showToast('Order not found.');
      return;
    }

    // Set editing state
    this.editingOrderId = order.id;
    this.activeEditOrderId = order.id;

    // Populate SKU items for edit
    if (order.items && Array.isArray(order.items) && order.items.length) {
      this.orderSkuItems = order.items.map(it => ({ ...it }));
    }

    // Register or reuse the edit tab
    const tabId = `tab-edit-order-${order.id}`;
    const existingTab = this.openTabs.find(t => t.id === tabId);
    if (!existingTab) {
      this.openTabs.push({
        id: tabId,
        type: 'order-edit',
        orderId: order.id,
        title: `${order.invoiceNumber}`,
        icon: 'edit-3',
        closeable: true
      });
    }

    this.activateWorkspaceTab(tabId);
    this.mountOrderEditCockpit(order.id);
  }

  // Load the exact WhatsApp order from the user's uploaded screenshot
  // Sample WhatsApp message built from your own buyers and products, so it always parses.
  loadS3MDemoOrder() {
    const input = document.getElementById('whatsapp-order-input');
    if (!input) return;
    const buyer = (this.data.contacts || []).find(c => c.role === 'retailer');
    const products = (this.data.products || []).filter(p => p.active !== false).slice(0, 4);
    if (!products.length) { this.showToast('Add products in the Products tab to load a sample order.'); return; }
    input.value = [`${buyer ? buyer.name : 'Buyer name'} (order)`, '']
      .concat(products.map((p, i) => `${p.shortName || p.name} ${p.defaultPackSize || p.packSize || ''} - ${i + 2}case`)).join('\n');

    this.parseWhatsAppOrderInput();
  }

  clearWhatsAppOrderInput() {
    const input = document.getElementById('whatsapp-order-input');
    const status = document.getElementById('whatsapp-parse-status');
    if (input) input.value = '';
    if (status) {
      status.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-slate-400"></span>
        <span>Ready to parse WhatsApp text or manually enter rows below.</span>
      `;
    }
  }

  // Natural Language & Regex WhatsApp Message Parser
  parseWhatsAppOrderInput() {
    const input = document.getElementById('whatsapp-order-input');
    const status = document.getElementById('whatsapp-parse-status');
    if (!input) return;

    const rawText = input.value.trim();
    if (!rawText) {
      this.showToast('⚠️ Please paste a WhatsApp order message into the text box first.');
      return;
    }

    // 1. Detect Retailer / Brand
    const lowerText = rawText.toLowerCase();
    // Match the message against your own retailers: full name first, else the distinctive words of the name.
    const genericWords = /^(traders?|stores?|mart|super|market|foods?|enterprises?|private|limited|pvt|ltd|and|the|company|co)$/;
    const bestRetailer = (this.data.contacts || []).filter(c => c.role === 'retailer' && c.name).map(c => {
      const name = String(c.name).toLowerCase();
      const words = name.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !genericWords.test(w));
      return { id: c.id, score: lowerText.includes(name) ? 100 : words.filter(w => new RegExp('\\b' + w + '\\b').test(lowerText)).length };
    }).filter(r => r.score > 0).sort((x, y) => y.score - x.score)[0];
    let detectedRetailerId = bestRetailer ? bestRetailer.id : null;

    if (detectedRetailerId) {
      const retailerSelect = document.getElementById('new-order-retailer');
      if (retailerSelect) {
        retailerSelect.value = detectedRetailerId;
        this.handleNewOrderRetailerChange(detectedRetailerId, false);
      }
    }

    const currentRetailer = this.data.contacts.find(c => c.id === (detectedRetailerId || (document.getElementById('new-order-retailer') ? document.getElementById('new-order-retailer').value : '')));

    // 2. Line by Line Parser
    const lines = rawText.split('\n');
    let currentPackSize = '500g';
    const parsedItems = [];
    const unmatchedLines = [];

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const lower = line.toLowerCase();

      // Check section header for pack size
      if (/^(500\s*g|500\s*gm|half\s*kg)/i.test(line) && !line.includes('case')) {
        currentPackSize = '500g';
        continue;
      }
      if (/^(1\s*kg|1000\s*g|1000\s*gm|one\s*kg)/i.test(line) && !line.includes('case')) {
        currentPackSize = '1kg';
        continue;
      }
      if (/^(5\s*kg|5000\s*g|bulk)/i.test(line) && !line.includes('case')) {
        currentPackSize = '5kg';
        continue;
      }

      // Skip lines that are purely brand names or headers without cases
      if (lower === 'order' && !line.includes('case')) {
        continue;
      }

      // Extract case count: match digits before or after case/cs
      const caseMatch = line.match(/[-:\s](\d+)\s*(?:case|cases|cs|box|boxes|ctn)?\.?$/i) || 
                        line.match(/(\d+)\s*(?:case|cases|cs|box|boxes|ctn)/i) || 
                        line.match(/[-:]\s*(\d+)/);

      if (!caseMatch) continue;
      const cases = parseInt(caseMatch[1], 10);
      if (isNaN(cases) || cases <= 0) continue;

      // Line-specific pack size override
      let itemPackSize = currentPackSize;
      if (/1\s*kg/i.test(line)) {
        itemPackSize = '1kg';
      } else if (/500\s*g|500\s*gm/i.test(line)) {
        itemPackSize = '500g';
      } else if (/5\s*kg/i.test(line)) {
        itemPackSize = '5kg';
      }

      // Extract pickle flavour
      let flavourKey = 'MIX';
      if (lower.includes('sweet mango') || lower.includes('chhundo') || lower.includes('chundo')) {
        flavourKey = 'SWEET MANGO';
      } else if (lower.includes('sweet lemon') || lower.includes('meetha nimbu') || lower.includes('khatta meetha') || lower.includes('khatta-meetha')) {
        flavourKey = 'SWEET LEMON';
      } else if (lower.includes('red chilli') || lower.includes('red chili') || lower.includes('lal mirch') || lower.includes('bharwa')) {
        flavourKey = 'RED CHILLI';
      } else if (lower.includes('green chilli') || lower.includes('mirch') || lower.includes('hari mirch')) {
        flavourKey = 'MIRCH';
      } else if (lower.includes('mango') || lower.includes('kairi') || lower.includes('aam')) {
        flavourKey = 'Mango';
      } else if (lower.includes('carrot') || lower.includes('gajar')) {
        flavourKey = 'CARROT';
      } else if (lower.includes('garlic') || lower.includes('lehsun')) {
        flavourKey = 'GARLIC';
      } else if (lower.includes('kathal') || lower.includes('jackfruit')) {
        flavourKey = 'KATHAL';
      } else if (lower.includes('della') || lower.includes('tenti') || lower.includes('gunda') || lower.includes('kair')) {
        flavourKey = 'DELLA';
      } else if (lower.includes('karela') || lower.includes('bitter')) {
        flavourKey = 'KARELA';
      } else if (lower.includes('mix') || lower.includes('pachranga')) {
        flavourKey = 'MIX';
      }

      // Match a catalogue product named in the line (name or short name), preferring the same pack size;
      // the keyword above is a fallback. Unknown products are reported, never swapped for another product.
      const named = p => [p.name, p.shortName].filter(Boolean).some(n => lower.includes(String(n).toLowerCase()));
      const sameSize = p => (p.defaultPackSize || p.packSize) === itemPackSize || (p.variant || '').includes(itemPackSize);
      const byKey = p => flavourKey && (p.shortName || '').toUpperCase() === String(flavourKey).toUpperCase();
      const product = this.data.products.find(p => named(p) && sameSize(p)) || this.data.products.find(p => byKey(p) && sameSize(p))
        || this.data.products.find(named) || this.data.products.find(byKey);
      if (!product) { unmatchedLines.push(line); continue; }
      parsedItems.push(this.skuItemFromProduct(product, { packSize: itemPackSize, cases }));
    }

    if (parsedItems.length > 0) {
      this.orderSkuItems = parsedItems;
      this.renderOrderSkuTable();
      this.recomputeOrderTotals();

      const totalCases = parsedItems.reduce((sum, item) => sum + item.cases, 0);
      const totalJars = parsedItems.reduce((sum, item) => sum + item.quantity, 0);

      if (status) {
        status.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400">
            Parsed ${tfEscapeHtml(parsedItems.length)} SKUs (${tfEscapeHtml(totalCases)} Cases, ${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} Units).${unmatchedLines.length ? ` Not in catalogue: ${tfEscapeHtml(unmatchedLines.join(' · '))}` : ''}
          </span>
        `;
      }
    } else {
      if (status) {
        status.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span class="font-bold text-amber-600 dark:text-amber-400">
            No variety lines detected with case counts. Check message formatting.
          </span>
        `;
      }
    }
  }

  // Handle buyer change to auto-fill defaults and pre-agreed rates
  handleNewOrderRetailerChange(retailerId, updatePrices = true) {
    this.checkRetailerCreditExposure(retailerId);
    const retailer = this.data.contacts.find(c => c.id === retailerId);
    if (!retailer) return;

    const marketeerSelect = document.getElementById('new-order-marketeer');
    const mfgSelect = document.getElementById('new-order-mfg');
    const pkgSelect = document.getElementById('new-order-pkg');
    const transporterSelect = document.getElementById('new-order-transporter');
    const termsInput = document.getElementById('new-order-payment-terms');

    if (marketeerSelect && retailer.defaultMarketeerId) {
      marketeerSelect.value = retailer.defaultMarketeerId;
    }
    if (mfgSelect && retailer.defaultMfgId) {
      mfgSelect.value = retailer.defaultMfgId;
    }
    if (pkgSelect && retailer.defaultPkgId) {
      pkgSelect.value = retailer.defaultPkgId;
    }
    if (transporterSelect && retailer.defaultTransporterId) {
      transporterSelect.value = retailer.defaultTransporterId;
    }
    if (termsInput && retailer.paymentTerms) {
      termsInput.value = retailer.paymentTerms;
    }

    // Auto-update rates for items in table with buyer's pre-agreed price list
    if (updatePrices && retailer.agreedRates && this.orderSkuItems) {
      this.orderSkuItems.forEach(item => {
        if (retailer.agreedRates[item.packSize]) {
          item.unitRate = retailer.agreedRates[item.packSize];
          item.totalAmount = item.quantity * item.unitRate;
        }
      });
      this.renderOrderSkuTable();
    }

    this.recomputeOrderTotals();
  }

  // Clone from previous order in 1-click
  clonePreviousOrder(orderId) {
    if (!orderId) return;
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return;

    const retailerSelect = document.getElementById('new-order-retailer');
    const marketeerSelect = document.getElementById('new-order-marketeer');
    const mfgSelect = document.getElementById('new-order-mfg');
    const pkgSelect = document.getElementById('new-order-pkg');
    const transporterSelect = document.getElementById('new-order-transporter');
    const termsInput = document.getElementById('new-order-payment-terms');
    const advanceInput = document.getElementById('new-order-advance');

    if (retailerSelect) retailerSelect.value = order.retailerId || '';
    if (marketeerSelect) marketeerSelect.value = order.marketeerId || '';
    if (mfgSelect) mfgSelect.value = order.manufacturerId || '';
    if (pkgSelect) pkgSelect.value = order.packagingVendorId || '';
    if (transporterSelect) transporterSelect.value = order.transporterId || '';
    if (termsInput) termsInput.value = order.paymentTerms || this.config().defaultPaymentTerms;
    if (advanceInput && order.customerAdvanceReceived) advanceInput.value = order.customerAdvanceReceived;

    if (order.items && order.items.length > 0) {
      this.orderSkuItems = order.items.map(item => {
        const prod = this.data.products.find(p => p.id === item.productId) || this.data.products[0];
        const packSize = prod.packSize || (item.variant.includes('1kg') ? '1kg' : '500g');
        const casePack = item.casePack || this.casePackConfig[packSize] || prod.casePack || this.config().defaultCasePack;
        const cases = item.cases || Math.ceil(item.quantity / casePack);
        return {
          productId: prod.id,
          name: item.name,
          shortName: prod.shortName || prod.name,
          variant: item.variant,
          packSize: packSize,
          casePack: casePack,
          cases: cases,
          quantity: item.quantity,
          unitRate: item.unitRate,
          totalAmount: item.totalAmount,
          baseCostPerUnit: item.baseCostPerUnit || prod.baseMfgCost,
          pkgCostPerUnit: item.pkgCostPerUnit || prod.packagingCost
        };
      });
      this.renderOrderSkuTable();
    }

    this.recomputeOrderTotals();
  }

  // Render dynamic SKU items table
  renderOrderSkuTable() {
    const tbody = document.getElementById('order-sku-rows');
    const badge = document.getElementById('order-item-count-badge');
    if (!tbody) return;

    if (badge) badge.innerText = `${this.orderSkuItems.length} SKUs`;

    if (this.orderSkuItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-8 text-slate-400 dark:text-slate-500 italic">
            No variety lines added yet. Paste a WhatsApp message above or click '+ Add SKU Line'.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.orderSkuItems.map((item, idx) => {
      // Group products for selection
      const productOptions = this.data.products.map(p => 
        `<option value="${tfEscapeHtml(p.id)}" ${tfEscapeHtml(p.id === item.productId ? 'selected' : '')}>${tfEscapeHtml(p.shortName || p.name)} (${tfEscapeHtml(p.packSize || p.variant)})</option>`
      ).join('');

      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
          <td class="py-2.5 px-3 text-center text-slate-400 font-mono-num">${tfEscapeHtml(idx + 1)}</td>
          <td class="py-2.5 px-3">
            <select onchange="app.updateSkuRowProduct(${tfEscapeHtml(idx)}, this.value)" class="table-cell-input font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800">
              ${productOptions}
            </select>
          </td>
          <td class="py-2.5 px-3">
            <select onchange="app.updateSkuRowPackSize(${tfEscapeHtml(idx)}, this.value)" class="table-cell-input bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <option value="500g" ${tfEscapeHtml(item.packSize === '500g' ? 'selected' : '')}>500g PET</option>
              <option value="1kg" ${tfEscapeHtml(item.packSize === '1kg' ? 'selected' : '')}>1kg Glass</option>
              <option value="5kg" ${tfEscapeHtml(item.packSize === '5kg' ? 'selected' : '')}>5kg Bucket</option>
            </select>
          </td>
          <td class="py-2.5 px-3 text-right">
            <input 
              type="number" 
              min="1" 
              step="1" 
              value="${tfEscapeHtml(item.cases)}" 
              oninput="app.updateSkuRowCases(${tfEscapeHtml(idx)}, this.value)"
              class="table-cell-input text-right font-mono-num font-bold text-amber-600 dark:text-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
            >
          </td>
          <td class="py-2.5 px-3 text-center">
            <div class="inline-flex items-center justify-center gap-1 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded px-1.5 py-0.5 shadow-2xs" title="Jars per case (changing syncs all ${tfEscapeHtml(item.packSize)} rows)">
              <input 
                type="number" 
                id="row-pack-${tfEscapeHtml(idx)}"
                min="1" 
                max="100" 
                value="${tfEscapeHtml(item.casePack)}" 
                onchange="app.updateRowCasePack(${tfEscapeHtml(idx)}, this.value)"
                onkeydown="if(event.key==='Enter') this.blur()"
                class="w-7 text-center font-mono-num font-black text-amber-700 dark:text-amber-400 bg-transparent outline-none text-xs"
              >
              <span class="text-xs text-slate-400 font-semibold">/cs</span>
            </div>
          </td>
          <td id="sku-row-qty-${tfEscapeHtml(idx)}" class="py-2.5 px-3 text-right font-mono-num font-black text-slate-900 dark:text-white">
            ${tfEscapeHtml(item.quantity.toLocaleString('en-IN'))}
          </td>
          <td class="py-2.5 px-3 text-right">
            <input 
              type="number" 
              step="0.5" 
              value="${tfEscapeHtml(item.unitRate)}" 
              oninput="app.updateSkuRowRate(${tfEscapeHtml(idx)}, this.value)"
              class="table-cell-input text-right font-mono-num font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800"
            >
          </td>
          <td id="sku-row-total-${tfEscapeHtml(idx)}" class="py-2.5 px-3 text-right font-mono-num font-black text-slate-900 dark:text-white">
            ${tfEscapeHtml(this.formatCurrency(item.totalAmount))}
          </td>
          <td class="py-2.5 px-3 text-center">
            <button type="button" onclick="app.removeSkuRow(${tfEscapeHtml(idx)})" class="p-1 text-slate-400 hover:text-rose-500 transition-colors rounded" title="Remove row">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // Update calculated display cells for a SKU row without losing input focus
  updateSkuRowDisplay(idx) {
    const item = this.orderSkuItems[idx];
    if (!item) return;
    const qtyEl = document.getElementById(`sku-row-qty-${idx}`);
    if (qtyEl) qtyEl.innerText = (item.quantity || 0).toLocaleString('en-IN');
    const totEl = document.getElementById(`sku-row-total-${idx}`);
    if (totEl) totEl.innerText = this.formatCurrency(item.totalAmount || 0);
  }

  // Update master carton pack size (500g, 1kg, 5kg) and synchronize across all matching rows
  updateMasterCasePack(packSize, val) {
    const count = parseInt(val, 10);
    if (isNaN(count) || count <= 0) return;

    this.casePackConfig[packSize] = count;

    // Sync the top master setting input if not active
    const masterInput = document.getElementById(`master-pack-${packSize}`);
    if (masterInput && document.activeElement !== masterInput && parseInt(masterInput.value, 10) !== count) {
      masterInput.value = count;
    }

    // Update all matching SKU items in the current order draft in-place
    let updatedCount = 0;
    (this.orderSkuItems || []).forEach((item, idx) => {
      if (item.packSize === packSize) {
        item.casePack = count;
        item.quantity = item.cases * count;
        item.totalAmount = item.quantity * item.unitRate;
        const rowPackInput = document.getElementById(`row-pack-${idx}`);
        if (rowPackInput && document.activeElement !== rowPackInput) {
          rowPackInput.value = count;
        }
        this.updateSkuRowDisplay(idx);
        updatedCount++;
      }
    });

    this.recomputeOrderTotals();

    if (updatedCount > 0) {
      this.showToast(`Updated all ${updatedCount} ${packSize} varieties to ${count} jars/case`);
    }
  }

  // Update case pack directly from a row input and synchronize across all items of that pack size
  updateRowCasePack(idx, val) {
    const item = this.orderSkuItems[idx];
    if (!item) return;
    const count = parseInt(val, 10);
    if (isNaN(count) || count <= 0) return;

    // Update master config and sync all other rows with the same pack size
    this.updateMasterCasePack(item.packSize, count);
  }

  updateSkuRowCases(idx, val) {
    const item = this.orderSkuItems[idx];
    if (!item) return;
    const cases = parseInt(val) || 0;
    item.cases = cases;
    item.quantity = cases * item.casePack;
    item.totalAmount = item.quantity * item.unitRate;
    // In-place update to preserve input cursor & focus
    this.updateSkuRowDisplay(idx);
    this.recomputeOrderTotals();
  }

  updateSkuRowRate(idx, val) {
    const item = this.orderSkuItems[idx];
    if (!item) return;
    const rate = parseFloat(val) || 0;
    item.unitRate = rate;
    item.totalAmount = item.quantity * rate;
    // In-place update to preserve input cursor & focus
    this.updateSkuRowDisplay(idx);
    this.recomputeOrderTotals();
  }

  // One order line from a catalogue product: its own price (or the buyer's agreed rate), costs, GST and HSN.
  skuItemFromProduct(prod, { packSize, cases = 1, unitRate } = {}) {
    const size = packSize || prod.defaultPackSize || prod.packSize || '';
    const casePack = (size === (prod.defaultPackSize || prod.packSize) && Number(prod.casePack)) || this.casePackConfig[size] || Number(prod.casePack) || this.config().defaultCasePack;
    const retailerId = document.getElementById('new-order-retailer') ? document.getElementById('new-order-retailer').value : '';
    const retailer = this.data.contacts.find(c => c.id === retailerId);
    const agreed = retailer && retailer.agreedRates && retailer.agreedRates[size];
    const rate = Number(unitRate ?? agreed ?? prod.defaultUnitRate ?? prod.standardSellingRate) || 0;
    return {
      productId: prod.id, name: prod.name, shortName: prod.shortName || prod.name, variant: prod.variant || size,
      packSize: size, casePack, cases, quantity: cases * casePack, unitRate: rate, totalAmount: cases * casePack * rate,
      baseCostPerUnit: prod.baseCostPerUnit ?? prod.baseMfgCost, pkgCostPerUnit: prod.pkgCostPerUnit ?? prod.pkgCost ?? prod.packagingCost,
      gstRate: this.itemGstRate({ productId: prod.id }), hsn: prod.hsn
    };
  }

  updateSkuRowProduct(idx, productId) {
    const item = this.orderSkuItems[idx];
    const prod = this.data.products.find(p => p.id === productId);
    if (!item || !prod) return;
    this.orderSkuItems[idx] = this.skuItemFromProduct(prod, { cases: item.cases || 1 });
    this.renderOrderSkuTable();
    this.recomputeOrderTotals();
  }

  updateSkuRowPackSize(idx, packSize) {
    const item = this.orderSkuItems[idx];
    if (!item) return;
    // Prefer the catalogue product of the same name in that pack size; else keep the product and its price.
    const sameLine = this.data.products.find(p => p.name === item.name && (p.defaultPackSize || p.packSize) === packSize);
    const prod = sameLine || this.data.products.find(p => p.id === item.productId);
    if (!prod) return;
    this.orderSkuItems[idx] = this.skuItemFromProduct(prod, { packSize, cases: item.cases || 1, unitRate: sameLine ? undefined : item.unitRate });
    this.renderOrderSkuTable();
    this.recomputeOrderTotals();
  }

  addEmptySkuRow() {
    const prod = (this.data.products || []).find(p => p.active !== false);
    if (!prod) { this.showToast('Add a product in the Products tab first.'); return; }
    this.orderSkuItems.push(this.skuItemFromProduct(prod, { cases: 1 }));
    this.renderOrderSkuTable();
    this.recomputeOrderTotals();
  }

  quickAddSkuRow(packSize) {
    const prod = (this.data.products || []).find(p => p.active !== false && (p.defaultPackSize || p.packSize) === packSize);
    if (!prod) { this.showToast(`No product with pack size ${packSize} in the catalogue.`); return; }
    this.orderSkuItems.push(this.skuItemFromProduct(prod, { packSize, cases: 1 }));
    this.renderOrderSkuTable();
    this.recomputeOrderTotals();
  }

  quickInsertFlavour(flavourKey, packSize, cases) {
    const prod = this.data.products.find(p => (p.shortName || '').toUpperCase() === String(flavourKey).toUpperCase() && ((p.defaultPackSize || p.packSize) === packSize || (p.variant || '').includes(packSize)))
      || this.data.products.find(p => (p.shortName || '').toUpperCase() === String(flavourKey).toUpperCase());
    if (!prod) { this.showToast(`No product "${flavourKey}" in the catalogue.`); return; }
    this.orderSkuItems.push(this.skuItemFromProduct(prod, { packSize, cases }));
    this.renderOrderSkuTable();
    this.recomputeOrderTotals();
  }

  removeSkuRow(idx) {
    this.orderSkuItems.splice(idx, 1);
    this.renderOrderSkuTable();
    this.recomputeOrderTotals();
  }

  // Real-Time Commercial Math & Profitability Engine
  // Totals for a new order. Freight is not known yet, so it starts at 0 (entered later on the order).
  newOrderFinancials(items, retailer, customerAdvance, marketeer) {
    // State codes: the stored code, else the first two digits of the GSTIN.
    const stateOf = party => party ? String(party.stateCode || (party.gstin ? String(party.gstin).slice(0, 2) : '')).padStart(party.stateCode || party.gstin ? 2 : 0, '0') : '';
    const profileState = stateOf(this.data.businessProfile);
    const buyerState = stateOf(retailer);
    const isInterstate = Boolean(buyerState && profileState && buyerState !== profileState);
    const gst = this.computeGst(items, isInterstate);
    const costs = this.orderLineCosts(items);
    const commissionRate = marketeer ? (Number.isFinite(Number(marketeer.commissionRate)) && marketeer.commissionRate !== '' && marketeer.commissionRate !== undefined && marketeer.commissionRate !== null ? Number(marketeer.commissionRate) : this.config().defaultCommissionRate) : 0;
    const marketeerComm = gst.taxable * commissionRate / 100;
    const totalTransport = 0;
    const totalDirectCosts = costs.manufacturing + costs.packaging + totalTransport + marketeerComm;
    const netProfit = gst.taxable - totalDirectCosts;
    return {
      isInterstate, gst, costs, commissionRate, marketeerComm, totalTransport, totalDirectCosts, netProfit,
      balanceDue: Math.max(0, Math.round((gst.total - customerAdvance) * 100) / 100),
      profitMargin: gst.taxable > 0 ? (netProfit / gst.taxable) * 100 : 0,
      totalCases: (items || []).reduce((s, i) => s + (Number(i.cases) || 0), 0),
      totalJars: (items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0)
    };
  }

  // "Net 30 Days" / "30 days" / "Advance" -> due date counted from the order date.
  dueDateFromTerms(orderDate, paymentTerms) {
    const days = /(\d+)\s*day/i.exec(String(paymentTerms || ''));
    const start = new Date((orderDate || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
    if (Number.isNaN(start.getTime())) return new Date().toISOString().slice(0, 10);
    const defaultDays = /(\d+)\s*day/i.exec(this.config().defaultPaymentTerms);
    start.setUTCDate(start.getUTCDate() + (days ? Number(days[1]) : (/advance|immediate|cash/i.test(String(paymentTerms || '')) ? 0 : (defaultDays ? Number(defaultDays[1]) : 15))));
    return start.toISOString().slice(0, 10);
  }

  recomputeOrderTotals() {
    const retailerId = document.getElementById('new-order-retailer') ? document.getElementById('new-order-retailer').value : '';
    const retailer = this.data.contacts.find(c => c.id === retailerId);
    const advanceInput = document.getElementById('new-order-advance');
    const customerAdvance = advanceInput ? (parseFloat(advanceInput.value) || 0) : 0;

    const marketeerId = document.getElementById('new-order-marketeer') ? document.getElementById('new-order-marketeer').value : '';
    const marketeer = marketeerId ? this.data.contacts.find(c => c.id === marketeerId) : null;
    const f = this.newOrderFinancials(this.orderSkuItems || [], retailer, customerAdvance, marketeer);
    const { isInterstate, totalCases, totalJars, balanceDue, netProfit, profitMargin } = f;
    const taxableSubtotal = f.gst.taxable;
    const cgstAmount = f.gst.cgst, sgstAmount = f.gst.sgst, igstAmount = f.gst.igst;
    const grandTotal = f.gst.total;
    const labels = this.gstLabels({ gstRates: f.gst.rates }, isInterstate);

    // Update DOM summary elements
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    };

    setEl('summary-total-cases', totalCases);
    setEl('summary-total-jars', totalJars.toLocaleString('en-IN'));
    setEl('summary-taxable-subtotal', this.formatCurrency(taxableSubtotal));
    setEl('summary-gst-amount', this.formatCurrency(cgstAmount + sgstAmount + igstAmount));
    setEl('summary-gst-label', isInterstate ? `${labels.combined} (Inter-State)` : `${labels.cgst} ${this.formatCurrency(cgstAmount)} + ${labels.sgst} ${this.formatCurrency(sgstAmount)}`);
    setEl('summary-grand-total', this.formatCurrency(grandTotal));
    setEl('summary-balance-due', this.formatCurrency(balanceDue));
    setEl('summary-advance-chip', `Adv: ${this.formatCurrency(customerAdvance)}`);
    setEl('summary-net-profit', this.formatCurrency(netProfit));
    setEl('summary-margin-chip', `Margin: ${profitMargin.toFixed(1)}%`);
  }

  // Create Multi-SKU Order and optionally open Factory PO
  async archiveWhatsAppOrderRecord(order, sourceText) {
    if (!order || !sourceText || !window.html2pdf) {
      if (sourceText) this.showToast('Order saved, but PDF generation is unavailable in this browser session.');
      return;
    }

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const rows = (order.items || []).map(item => `<tr><td>${tfEscapeHtml(item.name)} ${tfEscapeHtml(item.variant || '')}</td><td>${tfEscapeHtml(item.cases || 0)}</td><td>${tfEscapeHtml(item.quantity || 0)}</td><td>₹${tfEscapeHtml(Number(item.unitRate || 0).toLocaleString('en-IN'))}</td><td>₹${tfEscapeHtml(Number(item.totalAmount || 0).toLocaleString('en-IN'))}</td></tr>`).join('');
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;color:#172033;padding:36px;font:14px Arial,sans-serif;';
    wrapper.innerHTML = `<h1 style="margin:0 0 6px;font-size:24px">WhatsApp Order Record</h1><p style="margin:0 0 20px;color:#475569">Internal order record · not a tax invoice or bill</p><table style="width:100%;border-collapse:collapse;margin-bottom:20px"><tbody><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #cbd5e1">Order</th><td style="padding:6px;border-bottom:1px solid #cbd5e1">${tfEscapeHtml(order.id)}</td><th style="text-align:left;padding:6px;border-bottom:1px solid #cbd5e1">Date</th><td style="padding:6px;border-bottom:1px solid #cbd5e1">${tfEscapeHtml(order.date)}</td></tr><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #cbd5e1">Buyer</th><td colspan="3" style="padding:6px;border-bottom:1px solid #cbd5e1">${tfEscapeHtml(order.retailerName)}</td></tr></tbody></table><table style="width:100%;border-collapse:collapse"><thead><tr>${['Product','Cases','Units','Rate','Line total'].map(x => `<th style="text-align:left;padding:8px;background:#f1f5f9;border:1px solid #cbd5e1">${tfEscapeHtml(x)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table><p style="text-align:right;font-weight:bold;margin:16px 0">Order total: ₹${tfEscapeHtml(Number(order.totalInvoiceAmount || 0).toLocaleString('en-IN'))}</p><h2 style="font-size:16px;margin:24px 0 8px">Original WhatsApp message</h2><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:#f8fafc;border:1px solid #cbd5e1;font:12px/1.5 Arial,sans-serif">${tfEscapeHtml(sourceText)}</pre>`;
    document.body.appendChild(wrapper);
    try {
      const blob = await window.html2pdf().set({ margin: 8, filename: `${order.id}_WhatsApp_Order_Record.pdf`, image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 1.5, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(wrapper).outputPdf('blob');
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('Could not read generated PDF'));
        reader.readAsDataURL(blob);
      });
      const response = await fetch('/api/documents/upload', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, category: 'whatsapp_order_record', fileName: `${order.id}_WhatsApp_Order_Record.pdf`, fileData, metadata: { customFileName: `${order.id}_WhatsApp_Order_Record_${order.date}.pdf`, partyName: order.retailerName, date: order.date, direction: 'internal' } })
      });
      const result = await response.json();
      if (!response.ok || result.success === false) throw new Error(result.error || 'Document archive failed');
      this.showToast('WhatsApp order record PDF saved with the order.');
    } catch (error) {
      this.showToast(`Order saved; WhatsApp PDF could not be archived: ${error.message}`);
    } finally {
      wrapper.remove();
    }
  }

  submitNewMultiSkuOrder(openFactoryPO = false, bypassValidation = false) {
    const retailerId = document.getElementById('new-order-retailer') ? document.getElementById('new-order-retailer').value : '';
    const retailer = this.data.contacts.find(c => c.id === retailerId);

    if (!retailer) {
      this.showToast('Please select a Retailer / Buyer first.');
      return;
    }

    if (!this.orderSkuItems || this.orderSkuItems.length === 0) {
      this.showToast('Please add at least one product line.');
      return;
    }

    const marketeerId = document.getElementById('new-order-marketeer') ? document.getElementById('new-order-marketeer').value : '';
    const marketeer = marketeerId ? this.data.contacts.find(c => c.id === marketeerId) : null;
    const mfgId = document.getElementById('new-order-mfg') ? document.getElementById('new-order-mfg').value : '';
    // Only partners actually chosen on the form; an empty choice stays empty.
    const mfg = this.data.contacts.find(c => c.id === mfgId) || null;
    const pkgId = document.getElementById('new-order-pkg') ? document.getElementById('new-order-pkg').value : '';
    const pkg = this.data.contacts.find(c => c.id === pkgId) || null;
    const transporterId = document.getElementById('new-order-transporter') ? document.getElementById('new-order-transporter').value : '';
    const transporter = this.data.contacts.find(c => c.id === transporterId) || null;

    const paymentTerms = (document.getElementById('new-order-payment-terms') ? document.getElementById('new-order-payment-terms').value : '') || this.config().defaultPaymentTerms;
    const orderDate = (document.getElementById('new-order-date') ? document.getElementById('new-order-date').value : '') || new Date().toISOString().split('T')[0];
    const advanceInput = document.getElementById('new-order-advance');
    const customerAdvance = advanceInput ? (parseFloat(advanceInput.value) || 0) : 0;
    const advanceMode = (document.getElementById('new-order-advance-mode') ? document.getElementById('new-order-advance-mode').value : '') || 'NEFT / Bank Transfer';

    const orderItems = this.orderSkuItems.map(item => {
      return {
        productId: item.productId,
        name: item.name,
        shortName: item.shortName || item.name,
        variant: item.variant,
        packSize: item.packSize,
        casePack: item.casePack,
        cases: item.cases,
        quantity: item.quantity,
        unitRate: item.unitRate,
        totalAmount: item.totalAmount,
        baseCostPerUnit: item.baseCostPerUnit,
        pkgCostPerUnit: item.pkgCostPerUnit,
        gstRate: this.itemGstRate(item)
      };
    });

    const f = this.newOrderFinancials(orderItems, retailer, customerAdvance, marketeer);
    const { isInterstate, totalCases, totalJars, totalTransport, marketeerComm, totalDirectCosts, netProfit, profitMargin } = f;
    const taxableSubtotal = f.gst.taxable;
    const singleRate = f.gst.rates.length === 1 ? f.gst.rates[0] : null;
    const cgstRate = !isInterstate && singleRate !== null ? singleRate / 2 : 0;
    const sgstRate = cgstRate;
    const igstRate = isInterstate && singleRate !== null ? singleRate : 0;
    const cgstAmount = f.gst.cgst, sgstAmount = f.gst.sgst, igstAmount = f.gst.igst;
    const totalInvoiceAmount = f.gst.total;
    const customerBalanceDue = f.balanceDue;
    const totalMfgCost = f.costs.manufacturing;
    const totalPkgCost = f.costs.packaging;
    const transportEst1 = 0;
    const transportEst2 = 0;

    const numbers = this.nextOrderNumbers();
    const nextOrderNum = numbers.n;
    const orderId = numbers.orderId;
    const invoiceNum = numbers.invoiceNumber;

    const status = customerAdvance > 0 ? 'action_needed' : 'in_production';
    const urgentAlert = customerAdvance > 0 ? `Advance in Hand (${this.formatCurrency(customerAdvance)})! Place Manufacturer PO!` : null;

    const newOrder = {
      id: orderId,
      invoiceNumber: invoiceNum,
      date: orderDate,
      retailerId: retailer.id,
      retailerName: retailer.name,
      marketeerId: marketeer ? marketeer.id : null,
      marketeerName: marketeer ? marketeer.name : 'Direct',
      marketeerCommissionRate: f.commissionRate,
      status: status,
      urgentAlert: urgentAlert,
      paymentTerms: paymentTerms,
      dueDate: this.dueDateFromTerms(orderDate, paymentTerms),
      items: orderItems,
      taxableSubtotal: taxableSubtotal,
      gstType: isInterstate ? 'inter' : 'intra',
      cgstRate: cgstRate,
      sgstRate: sgstRate,
      igstRate: igstRate,
      cgstAmount: cgstAmount,
      sgstAmount: sgstAmount,
      igstAmount: igstAmount,
      gstRates: f.gst.rates,
      totalInvoiceAmount: totalInvoiceAmount,
      costsIncomplete: f.costs.incomplete,
      customerAdvanceReceived: customerAdvance,
      customerAdvanceDate: orderDate,
      customerAdvanceMode: advanceMode,
      customerBalanceDue: customerBalanceDue,
      packagingVendorId: pkg ? pkg.id : '',
      packagingVendorName: pkg ? pkg.name : '',
      packagingCost: totalPkgCost,
      packagingAdvancePaid: 0.0,
      packagingStatus: 'po_draft',
      manufacturerId: mfg ? mfg.id : '',
      manufacturerName: mfg ? mfg.name : '',
      manufacturerTotalCost: totalMfgCost,
      manufacturerAdvanceRequired: totalMfgCost * this.config().manufacturerAdvancePct / 100,
      manufacturerAdvancePaid: 0.0,
      manufacturerStatus: 'not_started',
      transporterId: transporter ? transporter.id : '',
      transporterName: transporter ? transporter.name : '',
      transportLeg1Cost: transportEst1,
      transportLeg2Cost: transportEst2,
      totalTransportCost: totalTransport,
      transportPaidByUs: true,
      lrNumber: '', // ZERO HALLUCINATIONS: empty until loaded
      vehicleNumber: '', // ZERO HALLUCINATIONS: empty until loaded
      damageAmount: 0.0,
      damageDeductedFrom: 'none',
      damageNote: '',
      marketeerCommissionAmount: marketeerComm,
      totalDirectCosts: totalDirectCosts,
      netProfit: netProfit,
      profitMarginPercent: profitMargin,
      time: this.formatTime(new Date(), true),
      timeLog: this.getLiveFormattedDateTime(),
      createdAt: new Date().toISOString()
    };

    // Pre-flight statutory validation check
    const candidateOrder = this.editingOrderId
      ? { ...((this.data.orders || []).find(o => o.id === this.editingOrderId) || {}), ...newOrder, id: this.editingOrderId }
      : newOrder;

    if (!bypassValidation) {
      const validation = this.validateOrder(candidateOrder);
      if (!validation.isValid) {
        this.openValidationModal(
          `Order Blocked: ${candidateOrder.invoiceNumber || candidateOrder.id || 'New Order'}`,
          validation,
          null
        );
        this.showToast('Order cannot be saved: validation issues detected.');
        return;
      }
      if (validation.warnings.length > 0) {
        this.openValidationModal(
          `Order Statutory Advisory: ${candidateOrder.invoiceNumber || candidateOrder.id || 'New Order'}`,
          validation,
          () => { this.submitNewMultiSkuOrder(openFactoryPO, true); }
        );
        return;
      }
    }

    if (this.editingOrderId) {
      const existingOrder = (this.data.orders || []).find(o => o.id === this.editingOrderId);
      if (existingOrder) {
        // Adjust retailer balance from old order
        const oldRetailer = this.data.contacts.find(c => c.id === existingOrder.retailerId);
        if (oldRetailer) {
          oldRetailer.currentBalanceDue = Math.max(0, (oldRetailer.currentBalanceDue || 0) - (existingOrder.customerBalanceDue || 0));
        }

        // Update fields in place
        existingOrder.date = orderDate;
        existingOrder.lastModifiedTimeLog = this.getLiveFormattedDateTime();
        existingOrder.retailerId = retailer.id;
        existingOrder.retailerName = retailer.name;
        existingOrder.marketeerId = marketeer ? marketeer.id : null;
        existingOrder.marketeerName = marketeer ? marketeer.name : 'Direct';
        existingOrder.marketeerCommissionRate = f.commissionRate;
        existingOrder.gstRates = f.gst.rates;
        existingOrder.costsIncomplete = f.costs.incomplete;
        existingOrder.dueDate = this.dueDateFromTerms(orderDate, paymentTerms);
        existingOrder.paymentTerms = paymentTerms;
        existingOrder.items = orderItems;
        existingOrder.taxableSubtotal = taxableSubtotal;
        existingOrder.gstType = isInterstate ? 'inter' : 'intra';
        existingOrder.cgstRate = cgstRate;
        existingOrder.sgstRate = sgstRate;
        existingOrder.igstRate = igstRate;
        existingOrder.cgstAmount = cgstAmount;
        existingOrder.sgstAmount = sgstAmount;
        existingOrder.igstAmount = igstAmount;
        existingOrder.totalInvoiceAmount = totalInvoiceAmount;
        existingOrder.customerAdvanceReceived = customerAdvance;
        existingOrder.customerAdvanceMode = advanceMode;
        existingOrder.customerBalanceDue = customerBalanceDue;
        existingOrder.packagingVendorId = pkg ? pkg.id : '';
        existingOrder.packagingVendorName = pkg ? pkg.name : '';
        existingOrder.packagingCost = totalPkgCost;
        existingOrder.manufacturerId = mfg ? mfg.id : '';
        existingOrder.manufacturerName = mfg ? mfg.name : '';
        existingOrder.manufacturerTotalCost = totalMfgCost;
        existingOrder.transporterId = transporter ? transporter.id : '';
        existingOrder.transporterName = transporter ? transporter.name : '';
        existingOrder.marketeerCommissionAmount = marketeerComm;
        // Keep freight already entered on the order; a new order starts with none.
        const existingFreight = Number(existingOrder.totalTransportCost) || 0;
        existingOrder.totalDirectCosts = totalDirectCosts + existingFreight;
        existingOrder.netProfit = netProfit - existingFreight;
        existingOrder.profitMarginPercent = taxableSubtotal > 0 ? (existingOrder.netProfit / taxableSubtotal) * 100 : 0;

        retailer.currentBalanceDue = (retailer.currentBalanceDue || 0) + customerBalanceDue;

        this.saveData();

        // If editing via workspace tab, close that tab and navigate to order detail
        const editTabId = `tab-edit-order-${this.editingOrderId}`;
        const editTabIdx = this.openTabs.findIndex(t => t.id === editTabId);
        if (editTabIdx !== -1) {
          this.openTabs.splice(editTabIdx, 1);
        }
        this.editingOrderId = null;
        this.activeEditOrderId = null;
        this.unmountOrderEditCockpit();
        this.closeNewOrderModal(); // safe no-op if modal is already hidden

        this.showToast(`Order ${existingOrder.invoiceNumber || existingOrder.id} updated successfully!`);

        if (openFactoryPO) {
          this.openOrderDetailPage(existingOrder.id);
          setTimeout(() => this.openFactoryPOModal(existingOrder.id), 200);
        } else {
          this.openOrderDetailPage(existingOrder.id);
        }

        if (this.opfState && this.opfState.paymentId) {
          this.openOrderPaymentFullModal(this.opfState.paymentId);
        }

        return;
      }
    }

    const whatsappSource = document.getElementById('whatsapp-order-input')?.value?.trim() || '';
    this.data.orders.unshift(newOrder);
    retailer.totalOrders = (retailer.totalOrders || 0) + 1;
    retailer.currentBalanceDue = (retailer.currentBalanceDue || 0) + customerBalanceDue;

    const orderSnapshot = {
      orderId: newOrder.id,
      retailerId: retailer.id,
      customerBalanceDue,
      invoiceNum,
      orderItems: JSON.parse(JSON.stringify(orderItems || [])),
      orderDate,
      paymentTerms,
      advanceMode,
      customerAdvance,
      mfgId: mfg ? mfg.id : '',
      pkgId: pkg ? pkg.id : '',
      transporterId: transporter ? transporter.id : '',
      lrNumber: newOrder.lrNumber || '',
      notes: newOrder.notes || ''
    };

    this.saveData();
    if (whatsappSource) void this.archiveWhatsAppOrderRecord(newOrder, whatsappSource);
    this.closeNewOrderModal();
    this.render();

    this.showToast(`Order ${invoiceNum} created (${orderItems.length} varieties, ${totalCases} cases)!`);

    // 10-Second Floating Undo Banner with Reopen
    this.showUndoToast(`Order created: ${newOrder.invoiceNumber || newOrder.id} · ${newOrder.retailerName}`, () => {
      const idx = this.data.orders.findIndex(x => x.id === newOrder.id);
      if (idx !== -1) {
        this.data.orders.splice(idx, 1);
        retailer.totalOrders = Math.max(0, (retailer.totalOrders || 1) - 1);
        retailer.currentBalanceDue = Math.max(0, (retailer.currentBalanceDue || 0) - customerBalanceDue);
        this.saveData();
        this.render();
        this.restoreNewOrderModalFromSnapshot(orderSnapshot);
        this.showToast('Order creation undone! Reopened details in form so you can make changes.');
      }
    });

    if (openFactoryPO) {
      this.openFactoryPOModal(newOrder.id);
    }
  }

  restoreNewOrderModalFromSnapshot(snapshot) {
    if (!snapshot) return;
    this.openNewOrderModal();
    const retSelect = document.getElementById('new-order-retailer');
    if (retSelect && snapshot.retailerId) {
      retSelect.value = snapshot.retailerId;
      this.handleOrderRetailerChange(snapshot.retailerId);
    }
    const invInput = document.getElementById('new-order-invoice');
    if (invInput && snapshot.invoiceNum) invInput.value = snapshot.invoiceNum;
    const dateInput = document.getElementById('new-order-date');
    if (dateInput && snapshot.orderDate) dateInput.value = snapshot.orderDate;
    const termsSelect = document.getElementById('new-order-terms');
    if (termsSelect && snapshot.paymentTerms) termsSelect.value = snapshot.paymentTerms;
    const advInput = document.getElementById('new-order-advance');
    if (advInput) advInput.value = snapshot.customerAdvance || 0;
    const advModeSelect = document.getElementById('new-order-advance-mode');
    if (advModeSelect && snapshot.advanceMode) advModeSelect.value = snapshot.advanceMode;

    if (Array.isArray(snapshot.orderItems) && snapshot.orderItems.length > 0) {
      this.currentOrderItems = JSON.parse(JSON.stringify(snapshot.orderItems));
      this.renderOrderItemsTable();
    }
    this.calculateOrderFinancials();
  }

  // Backwards compatibility delegate
  handleNewOrderSubmit() {
    this.submitNewMultiSkuOrder(false);
  }

  // ================= UNIFIED CLIPBOARD PASTE INTAKE LISTENERS =================
  handleNewOrderClipboardPaste(event) {
    const items = event.clipboardData?.items || [];
    let imageFile = null;
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        imageFile = item.getAsFile();
        break;
      }
    }

    if (imageFile) {
      event.preventDefault();
      this.showToast('Screenshot detected from clipboard! Processing...');
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        const apiKey = localStorage.getItem('tradeflow_gemini_api_key');
        if (apiKey) {
          try {
            const base64Data = dataUrl.split(',')[1];
            const mimeType = imageFile.type || 'image/jpeg';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
            const prompt = `Extract all FMCG pickle order details from this screenshot (cases, variants, jars, rates, retailer name).
Format as plain text line by line like:
[Retailer Name]
[Variant] [Cases] cases, [Rate] rs`;
            const resp = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }]
              })
            });
            if (resp.ok) {
              const resJson = await resp.json();
              const reply = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const input = document.getElementById('whatsapp-order-input');
              if (input && reply) {
                input.value = reply;
                this.parseWhatsAppOrderInput();
                this.showToast('Gemini Vision extracted order from screenshot!');
              }
            }
          } catch (err) {
            console.warn('Screenshot extraction error:', err);
          }
        } else {
          this.showToast('📸 Screenshot captured! Tip: Paste WhatsApp text or enter Gemini key in Settings for Vision AI.');
        }
      };
      reader.readAsDataURL(imageFile);
      return;
    }

    const text = event.clipboardData?.getData('text');
    if (text && /(?:case|order|500g|1kg|5kg|mango|mix|mirch|lemon|carrot|panch|pickles?)/i.test(text)) {
      const active = document.activeElement;
      if (!active || active.id !== 'whatsapp-order-input') {
        event.preventDefault();
        const input = document.getElementById('whatsapp-order-input');
        if (input) {
          input.value = text;
          this.parseWhatsAppOrderInput();
          this.showToast('⚡ WhatsApp order text parsed into SKU table!');
        }
      }
    }
  }

  /* ================= 5. RETAILER CREDIT CONTROL & EXPOSURE WARNING ================= */
  checkRetailerCreditExposure(retailerId) {
    let warningBox = document.getElementById('new-order-credit-alert');
    if (!warningBox) {
      const retailerEl = document.getElementById('new-order-retailer');
      const container = retailerEl ? retailerEl.closest('.grid') : null;
      if (container && container.parentElement) {
        warningBox = document.createElement('div');
        warningBox.id = 'new-order-credit-alert';
        warningBox.className = 'hidden mb-4 p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3 animate-in fade-in';
        container.parentElement.insertBefore(warningBox, container);
      }
    }
    if (!warningBox) return;

    if (!retailerId) {
      warningBox.classList.add('hidden');
      return;
    }

    const contact = (this.data.contacts || []).find(c => c.id === retailerId);
    if (!contact) {
      warningBox.classList.add('hidden');
      return;
    }

    const customerOrders = (this.data.orders || []).filter(o => 
      o.retailerId === retailerId || 
      (o.retailerName && o.retailerName.toLowerCase() === contact.name.toLowerCase())
    );

    const pendingOrders = customerOrders.filter(o => (o.customerBalanceDue || 0) > 0);
    const totalOverdue = pendingOrders.reduce((sum, o) => sum + (o.customerBalanceDue || 0), 0);

    if (totalOverdue > 0) {
      warningBox.innerHTML = `
        <div class="p-1 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
          <i data-lucide="shield-alert" class="w-4 h-4"></i>
        </div>
        <div class="flex-1">
          <div class="font-extrabold flex items-center justify-between">
            <span>Retailer Credit Exposure Warning: ${tfEscapeHtml(contact.name)}</span>
            <span class="font-mono text-rose-600 dark:text-rose-400 font-black">₹${tfEscapeHtml(totalOverdue.toLocaleString('en-IN'))} Outstanding</span>
          </div>
          <p class="text-xs mt-0.5 opacity-90">
            This customer currently has unpaid balances across <b>${tfEscapeHtml(pendingOrders.length)} previous order(s)</b>. 
            Credit control recommends collecting outstanding balances before booking additional dispatches.
          </p>
        </div>
      `;
      warningBox.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    } else {
      warningBox.classList.add('hidden');
    }
  }
});
