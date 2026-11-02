// TradeFlow: Margin and profit calculator. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ---------- TRADE MARGIN & ORDER PROFIT CALCULATOR ENGINE ---------- */
  // One calculator row built from a catalogue product and the Business Defaults percentages.
  calcRowFromProduct(product, index = 0) {
    const cfg = this.config();
    const p = product || {};
    const packSize = p.defaultPackSize || p.packSize || '';
    return {
      id: `adv-prod-${index + 1}`,
      name: p.name || `Product ${index + 1}`,
      packSize,
      casePack: Number(p.casePack) || this.casePackConfig[packSize] || cfg.defaultCasePack,
      cases: Number(p.defaultCases) || 1,
      mfgPrice: Number(p.baseCostPerUnit ?? p.baseMfgCost) || 0,
      gstRate: this.itemGstRate({ productId: p.id }),
      transportPct: cfg.calcTransportPct,
      labelCost: Number(p.labelCost) || 0,
      profitPct: cfg.calcProfitPct,
      marketeerPct: cfg.calcMarketeerPct,
      mrp: Number(p.mrp) || 0
    };
  }

  // Calculator presets come from your active products; with no products the rows start blank.
  getInitialSimpleCalc() {
    const products = ((this.data && this.data.products) || []).filter(p => p.active !== false);
    const row = this.calcRowFromProduct(products[0], 0);
    delete row.id;
    return row;
  }

  getInitialAdvancedCalc() {
    const products = ((this.data && this.data.products) || []).filter(p => p.active !== false).slice(0, 3);
    return (products.length ? products : [null]).map((product, index) => this.calcRowFromProduct(product, index));
  }

  openProfitCalculatorModal(skuId) {
    const modal = document.getElementById('profit-calculator-modal') || document.getElementById('sku-calculator-modal');
    if (!modal) return;

    if (!this.simpleCalcData) {
      this.simpleCalcData = this.getInitialSimpleCalc();
    }
    if (!this.advancedCalcProducts || !this.advancedCalcProducts.length) {
      this.advancedCalcProducts = this.getInitialAdvancedCalc();
    }

    // Configure modal panel width and hug content snugly without extra bottom white space
    const savedW = localStorage.getItem('tradeflow_calc_modal_w');
    const panel = document.getElementById('profit-calculator-modal-panel');
    if (panel) {
      if (savedW && window.innerWidth >= 1200) {
        panel.style.width = Math.min(window.innerWidth * 0.98, parseInt(savedW)) + 'px';
      } else {
        panel.style.width = Math.min(window.innerWidth * 0.96, 1320) + 'px';
      }
      if (!this.isCalcMaximized) {
        panel.style.height = 'auto';
        panel.style.maxHeight = '94vh';
      }
    }

    // Presets made before the data loaded are rebuilt from the catalogue on first open.
    if (!this._calcPresetsFromCatalog && this.data && (this.data.products || []).length) {
      this.simpleCalcData = this.getInitialSimpleCalc();
      this.advancedCalcProducts = this.getInitialAdvancedCalc();
      this._calcPresetsFromCatalog = true;
    }

    if (skuId) {
      const product = (this.data.products || []).find(p => p.id === skuId);
      if (product) {
        const row = this.calcRowFromProduct(product, 0);
        delete row.id;
        this.simpleCalcData = row;
      }
    }

    this.renderCalcPresetButtons();
    this.setCalcMode(this.calcMode || 'simple');
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeProfitCalculatorModal() {
    const modal = document.getElementById('profit-calculator-modal') || document.getElementById('sku-calculator-modal');
    if (modal) modal.classList.add('hidden');
  }

  openSkuCalculatorModal(skuId) {
    this.openProfitCalculatorModal(skuId);
  }

  closeSkuCalculatorModal() {
    this.closeProfitCalculatorModal();
  }

  setCalcMode(mode) {
    this.calcMode = mode;
    const simpleBtn = document.getElementById('calc-mode-simple-btn');
    const advBtn = document.getElementById('calc-mode-advanced-btn');
    const simpleView = document.getElementById('calc-simple-view');
    const advView = document.getElementById('calc-advanced-view');
    const badge = document.getElementById('calc-view-badge');

    if (mode === 'simple') {
      if (simpleBtn) {
        simpleBtn.className = 'btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs';
      }
      if (advBtn) {
        advBtn.className = 'btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      }
      if (simpleView) simpleView.classList.remove('hidden');
      if (advView) advView.classList.add('hidden');
      if (badge) badge.innerText = '1-Row Simple';
      this.syncSimpleInputs();
    } else {
      if (advBtn) {
        advBtn.className = 'btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs';
      }
      if (simpleBtn) {
        simpleBtn.className = 'btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      }
      if (simpleView) simpleView.classList.add('hidden');
      if (advView) advView.classList.remove('hidden');
      if (badge) badge.innerText = 'Multi-Product Order';
      this.renderAdvancedRows();
    }
    const panel = document.getElementById('profit-calculator-modal-panel');
    if (panel && !this.isCalcMaximized) {
      panel.style.height = 'auto';
      panel.style.maxHeight = '94vh';
    }
    this.updateProfitCalculator();
    if (window.lucide) window.lucide.createIcons();
  }

  // Preset buttons and pack sizes come from the product catalogue.
  renderCalcPresetButtons() {
    const products = (this.data.products || []).filter(p => p.active !== false).slice(0, 8);
    const button = (onclick, label, title) => `<button type="button" onclick="${tfEscapeHtml(onclick)}" title="${tfEscapeHtml(title)}" class="btn-tactile px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">${tfEscapeHtml(label)}</button>`;
    const label = p => `${p.shortName || p.name}${p.defaultPackSize || p.packSize ? ` (${p.defaultPackSize || p.packSize})` : ''}`;
    const simple = document.getElementById('calc-simple-presets');
    if (simple) simple.innerHTML = products.map(p => button(`app.loadSimplePreset('${tfEscapeJs(p.id)}')`, label(p), `Load ${p.name}`)).join('') || '<span class="text-xs text-slate-400">Add products in the Products tab to get presets</span>';
    const advanced = document.getElementById('calc-adv-presets');
    if (advanced) advanced.innerHTML = products.map(p => button(`app.addAdvancedProduct('${tfEscapeJs(p.id)}')`, '+ ' + label(p), `Add ${p.name}`)).join('');
    const packSelect = document.getElementById('calc-simple-pack-size');
    if (packSelect) {
      const sizes = [...new Set([...products.map(p => p.defaultPackSize || p.packSize), ...Object.keys(this.casePackConfig), this.simpleCalcData && this.simpleCalcData.packSize].filter(Boolean))];
      packSelect.innerHTML = sizes.map(size => `<option value="${tfEscapeHtml(size)}">${tfEscapeHtml(size)}</option>`).join('') + '<option value="custom">Custom</option>';
      packSelect.value = (this.simpleCalcData && this.simpleCalcData.packSize) || 'custom';
    }
  }

  loadSimplePreset(key) {
    const product = (this.data.products || []).find(p => p.id === key);
    if (product) {
      this.simpleCalcData = this.calcRowFromProduct(product, 0);
      delete this.simpleCalcData.id;
    } else {
      this.simpleCalcData = { ...this.calcRowFromProduct(null, 0), name: 'Custom Product', cases: 1 };
      delete this.simpleCalcData.id;
    }
    this.renderCalcPresetButtons();
    this.syncSimpleInputs();
    this.updateProfitCalculator();
    this.showToast(`Loaded preset: ${this.simpleCalcData.name}`);
  }

  handleSimplePackSizeChange(size) {
    if (!this.simpleCalcData) this.simpleCalcData = this.getInitialSimpleCalc();
    this.simpleCalcData.packSize = size;
    const product = (this.data.products || []).find(p => (p.defaultPackSize || p.packSize) === size && p.casePack);
    const casePack = this.casePackConfig[size] || (product && Number(product.casePack));
    if (casePack) this.simpleCalcData.casePack = casePack;
    const cpEl = document.getElementById('calc-simple-case-pack');
    if (cpEl) cpEl.value = this.simpleCalcData.casePack;
    this.updateProfitCalculator();
  }

  handleSimpleInput(field, val) {
    if (!this.simpleCalcData) this.simpleCalcData = this.getInitialSimpleCalc();
    this.simpleCalcData[field] = val;
    this.updateProfitCalculator();
  }

  syncSimpleInputs() {
    if (!this.simpleCalcData) this.simpleCalcData = this.getInitialSimpleCalc();
    const d = this.simpleCalcData;
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v !== undefined && v !== null ? v : '';
    };

    setVal('calc-simple-name', d.name || '');
    setVal('calc-simple-pack-size', d.packSize || '15ml');
    setVal('calc-simple-case-pack', d.casePack || 72);
    setVal('calc-simple-cases', d.cases || 100);
    setVal('calc-simple-mfg-price', d.mfgPrice !== undefined ? d.mfgPrice : '');
    setVal('calc-simple-gst-rate', d.gstRate !== undefined ? d.gstRate : 18);
    setVal('calc-simple-transport-pct', d.transportPct !== undefined ? d.transportPct : 5.0);
    setVal('calc-simple-label-cost', d.labelCost !== undefined ? d.labelCost : 0.00);
    setVal('calc-simple-profit-pct', d.profitPct !== undefined ? d.profitPct : 20.0);
    setVal('calc-simple-marketeer-pct', d.marketeerPct !== undefined ? d.marketeerPct : 30.0);
    setVal('calc-simple-mrp', d.mrp !== undefined ? d.mrp : '');
  }

  renderAdvancedRows() {
    const tbody = document.getElementById('calc-advanced-tbody');
    if (!tbody) return;

    if (!this.advancedCalcProducts || !this.advancedCalcProducts.length) {
      this.advancedCalcProducts = this.getInitialAdvancedCalc();
    }

    tbody.innerHTML = this.advancedCalcProducts.map((p, idx) => {
      const mfg = parseFloat(p.mfgPrice) || 0;
      const gst = parseFloat(p.gstRate) || 0;
      const trans = parseFloat(p.transportPct) || 0;
      const labelCost = parseFloat(p.labelCost) || 0;
      const profit = parseFloat(p.profitPct) || 0;
      const mkt = parseFloat(p.marketeerPct) || 0;
      const cases = parseInt(p.cases) || 0;
      const cp = parseInt(p.casePack) || 1;
      const totalUnits = cases * cp;

      // Mathematical formula: Landed Cost = Mfg + GST + Transport + Label
      // Magic Roots Profit & Marketeer Profit are BOTH on Landed Cost!
      const gstAmt = mfg * (gst / 100);
      const transAmt = (mfg + gstAmt) * (trans / 100);
      const landed = mfg + gstAmt + transAmt + labelCost;
      const ourCut = landed * (profit / 100);
      const mktCut = landed * (mkt / 100);
      const ssPrice = landed + ourCut + mktCut;
      const rowOutflow = totalUnits * landed;
      const rowProfit = totalUnits * ourCut;

      return `
        <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors" id="adv-calc-row-${tfEscapeHtml(idx)}">
          <td class="py-2 px-3 text-slate-400 font-bold">${tfEscapeHtml(idx + 1)}</td>
          <td class="py-2 px-2">
            <input id="adv-input-name-${tfEscapeHtml(idx)}" type="text" value="${tfEscapeHtml(p.name || '')}" class="w-full p-1.5 font-bold text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-700 rounded text-xs" placeholder="Product name" oninput="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'name', this.value)">
          </td>
          <td class="py-2 px-2">
            <select id="adv-input-packsize-${tfEscapeHtml(idx)}" class="w-full p-1.5 font-bold text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-700 rounded text-xs" onchange="app.handleAdvancedPackSizeChange(${tfEscapeHtml(idx)}, this.value)">
              <option value="15ml" ${tfEscapeHtml(p.packSize === '15ml' ? 'selected' : '')}>15ML</option>
              <option value="500g" ${tfEscapeHtml(p.packSize === '500g' ? 'selected' : '')}>500g</option>
              <option value="1kg" ${tfEscapeHtml(p.packSize === '1kg' ? 'selected' : '')}>1KG (8/cs)</option>
              <option value="5kg" ${tfEscapeHtml(p.packSize === '5kg' ? 'selected' : '')}>5KG (4/cs)</option>
              <option value="custom" ${tfEscapeHtml(p.packSize === 'custom' ? 'selected' : '')}>Custom</option>
            </select>
          </td>
          <td class="py-2 px-2 text-center">
            <input id="adv-input-casepack-${tfEscapeHtml(idx)}" type="number" min="1" value="${tfEscapeHtml(p.casePack !== undefined ? p.casePack : cp)}" class="w-12 p-1.5 text-center font-bold text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-700 rounded text-xs" oninput="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'casePack', this.value)">
          </td>
          <td class="py-2 px-2 text-center">
            <input id="adv-input-cases-${tfEscapeHtml(idx)}" type="number" min="1" value="${tfEscapeHtml(p.cases !== undefined ? p.cases : cases)}" class="w-14 p-1.5 text-center font-black text-emerald-900 dark:text-emerald-200 bg-emerald-500/10 border-2 border-emerald-500 rounded text-xs" oninput="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'cases', this.value)">
          </td>
          <td id="adv-row-units-${tfEscapeHtml(idx)}" class="py-2 px-2 text-right font-bold text-slate-700 dark:text-slate-300">
            ${tfEscapeHtml(totalUnits.toLocaleString('en-IN'))}
          </td>
          <td class="py-2 px-2 text-right">
            <input id="adv-input-mfg-${tfEscapeHtml(idx)}" type="number" step="0.01" min="0" value="${tfEscapeHtml(p.mfgPrice !== undefined ? p.mfgPrice : mfg)}" class="w-14 p-1.5 text-right font-bold text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-700 rounded text-xs" oninput="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'mfgPrice', this.value)">
          </td>
          <td class="py-2 px-2 text-center">
            <select id="adv-input-gst-${tfEscapeHtml(idx)}" class="w-12 p-1.5 font-bold text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-700 rounded text-xs" onchange="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'gstRate', this.value)">
              <option value="0" ${tfEscapeHtml(gst === 0 ? 'selected' : '')}>0%</option>
              <option value="5" ${tfEscapeHtml(gst === 5 ? 'selected' : '')}>5%</option>
              <option value="12" ${tfEscapeHtml(gst === 12 ? 'selected' : '')}>12%</option>
              <option value="18" ${tfEscapeHtml(gst === 18 ? 'selected' : '')}>18%</option>
              <option value="28" ${tfEscapeHtml(gst === 28 ? 'selected' : '')}>28%</option>
            </select>
          </td>
          <td class="py-2 px-2 text-center">
            <input id="adv-input-trans-${tfEscapeHtml(idx)}" type="number" step="0.5" min="0" value="${tfEscapeHtml(p.transportPct !== undefined ? p.transportPct : trans)}" class="w-12 p-1.5 text-center font-bold text-slate-900 dark:text-white bg-transparent border border-slate-200 dark:border-slate-700 rounded text-xs" oninput="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'transportPct', this.value)">
          </td>
          <td class="py-2 px-2 text-center">
            <input id="adv-input-label-${tfEscapeHtml(idx)}" type="number" step="0.05" min="0" value="${tfEscapeHtml(p.labelCost !== undefined ? p.labelCost : labelCost)}" class="w-12 p-1.5 text-center font-bold text-blue-700 dark:text-blue-300 bg-transparent border border-blue-200 dark:border-blue-800 rounded text-xs" placeholder="0.00" oninput="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'labelCost', this.value)">
          </td>
          <td id="adv-row-landed-${tfEscapeHtml(idx)}" class="py-2 px-2 text-right font-bold text-rose-600 dark:text-rose-400">
            ₹${tfEscapeHtml(landed.toFixed(2))}
          </td>
          <td class="py-2 px-2 text-center">
            <input id="adv-input-profit-${tfEscapeHtml(idx)}" type="number" step="0.5" min="0" value="${tfEscapeHtml(p.profitPct !== undefined ? p.profitPct : profit)}" class="w-12 p-1.5 text-center font-bold text-emerald-600 bg-transparent border border-emerald-300 dark:border-emerald-700 rounded text-xs" oninput="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'profitPct', this.value)">
          </td>
          <td class="py-2 px-2 text-center">
            <input id="adv-input-mkt-${tfEscapeHtml(idx)}" type="number" step="0.5" min="0" value="${tfEscapeHtml(p.marketeerPct !== undefined ? p.marketeerPct : mkt)}" class="w-12 p-1.5 text-center font-bold text-amber-600 bg-transparent border border-amber-300 dark:border-amber-700 rounded text-xs" oninput="app.handleAdvancedRowInput(${tfEscapeHtml(idx)}, 'marketeerPct', this.value)">
          </td>
          <td id="adv-row-ss-${tfEscapeHtml(idx)}" class="py-2 px-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
            ₹${tfEscapeHtml(ssPrice.toFixed(2))}
          </td>
          <td id="adv-row-outflow-${tfEscapeHtml(idx)}" class="py-2 px-2 text-right font-bold text-rose-600 dark:text-rose-400">
            ₹${tfEscapeHtml(rowOutflow.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
          </td>
          <td id="adv-row-profit-${tfEscapeHtml(idx)}" class="py-2 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
            ₹${tfEscapeHtml(rowProfit.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2}))}
          </td>
          <td class="py-2 px-2 text-center">
            <button onclick="app.removeAdvancedProduct(${tfEscapeHtml(idx)})" class="p-1 text-slate-400 hover:text-rose-500 rounded" title="Remove product row">&times;</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Update calculated row cells in-place without re-rendering tbody or losing input focus
  updateAdvancedRowDisplay(idx) {
    const p = this.advancedCalcProducts[idx];
    if (!p) return;

    const mfg = parseFloat(p.mfgPrice) || 0;
    const gst = parseFloat(p.gstRate) || 0;
    const trans = parseFloat(p.transportPct) || 0;
    const labelCost = parseFloat(p.labelCost) || 0;
    const profit = parseFloat(p.profitPct) || 0;
    const mkt = parseFloat(p.marketeerPct) || 0;
    const cases = parseInt(p.cases) || 0;
    const cp = parseInt(p.casePack) || 1;
    const totalUnits = cases * cp;

    const gstAmt = mfg * (gst / 100);
    const transAmt = (mfg + gstAmt) * (trans / 100);
    const landed = mfg + gstAmt + transAmt + labelCost;
    const ourCut = landed * (profit / 100);
    const mktCut = landed * (mkt / 100);
    const ssPrice = landed + ourCut + mktCut;
    const rowOutflow = totalUnits * landed;
    const rowProfit = totalUnits * ourCut;

    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.innerText = txt;
    };

    setTxt(`adv-row-units-${idx}`, totalUnits.toLocaleString('en-IN'));
    setTxt(`adv-row-landed-${idx}`, `₹${landed.toFixed(2)}`);
    setTxt(`adv-row-ss-${idx}`, `₹${ssPrice.toFixed(2)}`);
    setTxt(`adv-row-outflow-${idx}`, `₹${rowOutflow.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    setTxt(`adv-row-profit-${idx}`, `₹${rowProfit.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  }

  addAdvancedProduct(preset) {
    const product = (this.data.products || []).find(p => p.id === preset);
    const newProd = { ...this.calcRowFromProduct(product, this.advancedCalcProducts.length), id: 'adv-prod-' + Date.now() };
    if (!product) newProd.name = `Product ${this.advancedCalcProducts.length + 1}`;
    this.advancedCalcProducts.push(newProd);
    this.renderAdvancedRows();
    this.updateProfitCalculator();
    this.showToast(`Added "${newProd.name}" to order calculation`);
  }

  removeAdvancedProduct(idx) {
    if (this.advancedCalcProducts.length <= 1) {
      this.showToast('Must keep at least one product in order.');
      return;
    }
    this.advancedCalcProducts.splice(idx, 1);
    this.renderAdvancedRows();
    this.updateProfitCalculator();
  }

  handleAdvancedRowInput(idx, field, val) {
    if (!this.advancedCalcProducts[idx]) return;
    this.advancedCalcProducts[idx][field] = val;
    // In-place update to preserve input cursor & focus!
    this.updateAdvancedRowDisplay(idx);
    this.updateProfitCalculator();
  }

  handleAdvancedPackSizeChange(idx, size) {
    if (!this.advancedCalcProducts[idx]) return;
    this.advancedCalcProducts[idx].packSize = size;
    let cp = this.advancedCalcProducts[idx].casePack || 24;
    if (size === '15ml') {
      cp = 72;
    } else if (size === '500g' || size === '500ml') {
      cp = 24;
    } else if (size === '1kg') {
      cp = 8;
    } else if (size === '5kg') {
      cp = 4;
    }
    this.advancedCalcProducts[idx].casePack = cp;

    const cpInput = document.getElementById(`adv-input-casepack-${idx}`);
    if (cpInput) cpInput.value = cp;

    this.updateAdvancedRowDisplay(idx);
    this.updateProfitCalculator();
  }

  // Per-unit pricing chain: GST and freight on the factory price give the landed cost; our margin and
  // the marketeer's cut are percentages of the landed cost; their sum is the price to the super stockist.
  calcUnitPricing({ mfg, gst, trans, labelCost, profit, mkt }) {
    const gstAmt = mfg * (gst / 100);
    const transAmt = (mfg + gstAmt) * (trans / 100);
    const landed = mfg + gstAmt + transAmt + labelCost;
    const ourCut = landed * (profit / 100);
    const mktCut = landed * (mkt / 100);
    return { gstAmt, transAmt, landed, ourCut, mktCut, ssPrice: landed + ourCut + mktCut };
  }

  updateProfitCalculator() {
    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.innerText = txt;
    };
    const setHtml = (id, html) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };

    if (this.calcMode === 'simple') {
      if (!this.simpleCalcData) this.simpleCalcData = this.getInitialSimpleCalc();
      const d = this.simpleCalcData;
      const mfg = parseFloat(d.mfgPrice) || 0;
      const gst = parseFloat(d.gstRate) || 0;
      const trans = parseFloat(d.transportPct) || 0;
      const labelCost = parseFloat(d.labelCost) || 0;
      const profit = parseFloat(d.profitPct) || 0;
      const mkt = parseFloat(d.marketeerPct) || 0;
      const mrp = parseFloat(d.mrp) || 0;
      const cases = parseInt(d.cases) || 0;
      const cp = parseInt(d.casePack) || 1;
      const totalUnits = cases * cp;

      // Same maths as advanced mode; values are rounded only when displayed, never before multiplying.
      const pricing = this.calcUnitPricing({ mfg, gst, trans, labelCost, profit, mkt });
      const { gstAmt, transAmt, landed, ourCut, mktCut, ssPrice } = pricing;
      const spread = mrp > 0 ? (mrp - ssPrice) : 0;
      const spreadPct = mrp > 0 ? ((spread / mrp) * 100).toFixed(1) : '0';

      // BATCH ROLLUPS
      const batchNetProfit = totalUnits * ourCut;    // OUR PROFIT (INTO MY POCKET)
      const batchLanded = totalUnits * landed;       // TOTAL OUTFLOW (PAY FROM MY POCKET)
      const batchMkt = totalUnits * mktCut;          // MARKETEER COMMISSION
      const batchSsInvoice = totalUnits * ssPrice;   // INVOICED TO SUPER STOCKIST
      const batchMrp = totalUnits * mrp;             // RETAIL MRP TOTAL

      setTxt('calc-simple-units-badge', `${totalUnits.toLocaleString('en-IN')} pcs`);

      // Update Live Step-by-Step Commercial Pipeline Strip (Full Width, Prominent Typography & Icons)
      setHtml('calc-simple-breadcrumb', `
        <div class="flex items-center justify-between gap-1 sm:gap-1.5 w-full flex-wrap 2xl:flex-nowrap">
          
          <!-- 1. Mfg Base -->
          <div class="flex-1 min-w-[70px] sm:min-w-[80px] p-1.5 sm:p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
            <span class="text-xs sm:text-xs font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 truncate">1. Mfg Base</span>
            <span class="text-xs sm:text-sm lg:text-base font-black font-mono-num text-slate-900 dark:text-white mt-0.5 truncate">₹${tfEscapeHtml(mfg.toFixed(2))}</span>
          </div>

          <span class="text-slate-400 dark:text-slate-500 font-black text-xs shrink-0 px-0.5">+</span>

          <!-- 2. GST -->
          <div class="flex-1 min-w-[70px] sm:min-w-[80px] p-1.5 sm:p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
            <div class="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 w-full min-w-0">
              <span class="text-xs sm:text-xs font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 truncate">2. GST</span>
              <span class="text-xs sm:text-xs font-bold font-mono-num text-slate-400 dark:text-slate-500 shrink-0">(${tfEscapeHtml(gst)}%)</span>
            </div>
            <span class="text-xs sm:text-sm lg:text-base font-black font-mono-num text-slate-900 dark:text-white mt-0.5 truncate">+₹${tfEscapeHtml(gstAmt.toFixed(2))}</span>
          </div>

          <span class="text-slate-400 dark:text-slate-500 font-black text-xs shrink-0 px-0.5">+</span>

          <!-- 3. Freight -->
          <div class="flex-1 min-w-[70px] sm:min-w-[80px] p-1.5 sm:p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
            <div class="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 w-full min-w-0">
              <span class="text-xs sm:text-xs font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 truncate">3. Freight</span>
              <span class="text-xs sm:text-xs font-bold font-mono-num text-slate-400 dark:text-slate-500 shrink-0">(${tfEscapeHtml(trans)}%)</span>
            </div>
            <span class="text-xs sm:text-sm lg:text-base font-black font-mono-num text-slate-900 dark:text-white mt-0.5 truncate">+₹${tfEscapeHtml(transAmt.toFixed(2))}</span>
          </div>

          ${labelCost > 0 ? `
            <span class="text-slate-400 dark:text-slate-500 font-black text-xs shrink-0 px-0.5">+</span>
            <!-- 4. Label / Print -->
            <div class="flex-1 min-w-[75px] sm:min-w-[85px] p-1.5 sm:p-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-2xs flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
              <span class="text-xs sm:text-xs font-bold uppercase tracking-tight text-blue-600 dark:text-blue-400 truncate">4. Print/Label</span>
              <span class="text-xs sm:text-sm lg:text-base font-black font-mono-num text-blue-700 dark:text-blue-300 mt-0.5 truncate">+₹${tfEscapeHtml(labelCost.toFixed(2))}</span>
            </div>
          ` : ''}

          <span class="text-slate-400 dark:text-slate-500 font-black text-xs shrink-0 px-0.5">=</span>

          <!-- 5. Landed Cost -->
          <div class="flex-1 min-w-[95px] sm:min-w-[110px] p-1.5 sm:p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 shadow-xs flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
            <div class="flex items-center justify-center gap-1 w-full min-w-0 px-0.5">
              <span class="text-xs sm:text-sm shrink-0"><i data-lucide="credit-card" class="w-4 h-4 inline-block"></i></span>
              <span class="text-xs sm:text-xs font-black uppercase tracking-tight text-rose-700 dark:text-rose-300 truncate">Landed Cost</span>
            </div>
            <span class="text-xs sm:text-sm lg:text-base font-black font-mono-num text-rose-800 dark:text-rose-200 mt-0.5 truncate">₹${tfEscapeHtml(landed.toFixed(2))} <span class="text-xs font-bold text-rose-600 dark:text-rose-400">/pc</span></span>
            <span class="text-xs sm:text-xs font-semibold text-rose-600 dark:text-rose-400 opacity-90 truncate">Pay from Pocket</span>
          </div>

          <span class="text-slate-400 dark:text-slate-500 font-black text-xs shrink-0 px-0.5">→</span>

          <!-- 6. Magic Roots -->
          <div class="flex-1 min-w-[95px] sm:min-w-[110px] p-1.5 sm:p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200 shadow-xs flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
            <div class="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 w-full min-w-0 px-0.5">
              <div class="flex items-center gap-0.5 shrink-0">
                <span class="text-xs shrink-0"><i data-lucide="leaf" class="w-4 h-4 inline-block"></i></span>
                <span class="text-xs sm:text-xs font-black uppercase tracking-tight text-emerald-700 dark:text-emerald-300 truncate" title="${tfEscapeHtml(this.config().brand)} (${tfEscapeHtml(profit)}%)">${tfEscapeHtml(this.config().brand)}</span>
              </div>
              <span class="text-xs sm:text-xs font-black font-mono-num px-1 py-0.2 rounded bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0">(${tfEscapeHtml(profit)}%)</span>
            </div>
            <span class="text-xs sm:text-sm lg:text-base font-black font-mono-num text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">+₹${tfEscapeHtml(ourCut.toFixed(2))} <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400">/unit</span></span>
            <span class="text-xs sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 opacity-90 truncate">Into My Pocket</span>
          </div>

          <span class="text-slate-400 dark:text-slate-500 font-black text-xs shrink-0 px-0.5">→</span>

          <!-- 7. Marketeer -->
          <div class="flex-1 min-w-[95px] sm:min-w-[110px] p-1.5 sm:p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-600 text-amber-900 dark:text-amber-200 shadow-xs flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
            <div class="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 w-full min-w-0 px-0.5">
              <div class="flex items-center gap-0.5 shrink-0">
                <span class="text-xs shrink-0"><i data-lucide="handshake" class="w-4 h-4 inline-block"></i></span>
                <span class="text-xs sm:text-xs font-black uppercase tracking-tight text-amber-700 dark:text-amber-300 truncate" title="Marketeer (${tfEscapeHtml(mkt)}%)">Marketeer</span>
              </div>
              <span class="text-xs sm:text-xs font-black font-mono-num px-1 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 shrink-0">(${tfEscapeHtml(mkt)}%)</span>
            </div>
            <span class="text-xs sm:text-sm lg:text-base font-black font-mono-num text-amber-700 dark:text-amber-300 mt-0.5 truncate">+₹${tfEscapeHtml(mktCut.toFixed(2))} <span class="text-xs font-bold text-amber-600 dark:text-amber-400">/unit</span></span>
            <span class="text-xs sm:text-xs font-semibold text-amber-600 dark:text-amber-400 opacity-90 truncate">Landed × ${tfEscapeHtml(mkt)}%</span>
          </div>

          <span class="text-slate-400 dark:text-slate-500 font-black text-xs shrink-0 px-0.5">→</span>

          <!-- 8. Price to SS -->
          <div class="flex-1 min-w-[95px] sm:min-w-[110px] p-1.5 sm:p-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-sm border border-emerald-500 flex flex-col items-center justify-center text-center min-w-0 overflow-hidden">
            <div class="flex items-center justify-center gap-1 w-full min-w-0 px-0.5">
              <span class="text-xs sm:text-sm shrink-0"><i data-lucide="truck" class="w-4 h-4 inline-block"></i></span>
              <span class="text-xs sm:text-xs font-black uppercase tracking-tight text-emerald-100 truncate">Price to SS</span>
            </div>
            <span class="text-xs sm:text-sm lg:text-base font-black font-mono-num text-white mt-0.5 truncate">₹${tfEscapeHtml(ssPrice.toFixed(2))} <span class="text-xs font-bold text-emerald-200">/ unit</span></span>
            <span class="text-xs sm:text-xs font-semibold text-emerald-100 opacity-90 truncate">Billing Rate</span>
          </div>

        </div>
      `);

      // Update TWO PRIMARY BOLD HERO TILES
      setTxt('big-tile-our-profit', `₹${batchNetProfit.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-profit-pct-badge', `${profit.toFixed(1)}% on Landed Cost`);
      setTxt('big-tile-units-display', `${totalUnits.toLocaleString('en-IN')} pcs (${cases} cs)`);
      setTxt('big-tile-unit-profit-display', `+₹${ourCut.toFixed(2)} / unit`);

      setTxt('big-tile-landed-outflow', `₹${batchLanded.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-landed-rate', `₹${landed.toFixed(2)} / pc`);
      setTxt('big-tile-landed-badge', `Mfg + GST + Freight${labelCost > 0 ? ' + Label' : ''}`);

      // Update 3 SUMMARY TILES
      setTxt('big-tile-ss-invoice', `₹${batchSsInvoice.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-ss-rate', `₹${ssPrice.toFixed(2)}/pc`);

      setTxt('big-tile-marketeer-cut', `₹${batchMkt.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-marketeer-rate', `${mkt.toFixed(1)}% on Landed (+₹${mktCut.toFixed(2)}/pc)`);

      setTxt('big-tile-mrp-total', `₹${batchMrp.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-spread-pct', `${spreadPct}%`);
    } else {
      // ADVANCED MULTI-PRODUCT AGGREGATION
      if (!this.advancedCalcProducts || !this.advancedCalcProducts.length) {
        this.advancedCalcProducts = this.getInitialAdvancedCalc();
      }

      let totalCombinedUnits = 0;
      let totalCombinedCases = 0;
      let totalCombinedProfit = 0;
      let totalCombinedLanded = 0;
      let totalCombinedMkt = 0;
      let totalCombinedSs = 0;
      let totalCombinedMrp = 0;
      const mktRates = new Set();

      this.advancedCalcProducts.forEach(p => {
        const mfg = parseFloat(p.mfgPrice) || 0;
        const gst = parseFloat(p.gstRate) || 0;
        const trans = parseFloat(p.transportPct) || 0;
        const labelCost = parseFloat(p.labelCost) || 0;
        const profit = parseFloat(p.profitPct) || 0;
        const mkt = parseFloat(p.marketeerPct) || 0;
        const mrp = parseFloat(p.mrp) || 0;
        const cases = parseInt(p.cases) || 0;
        const cp = parseInt(p.casePack) || 1;
        const totalUnits = cases * cp;

        const { landed, ourCut, mktCut, ssPrice } = this.calcUnitPricing({ mfg, gst, trans, labelCost, profit, mkt });
        mktRates.add(mkt);

        totalCombinedUnits += totalUnits;
        totalCombinedCases += cases;
        totalCombinedProfit += (totalUnits * ourCut);
        totalCombinedLanded += (totalUnits * landed);
        totalCombinedMkt += (totalUnits * mktCut);
        totalCombinedSs += (totalUnits * ssPrice);
        totalCombinedMrp += (totalUnits * mrp);
      });

      const avgProfitPerUnit = totalCombinedUnits > 0 ? (totalCombinedProfit / totalCombinedUnits) : 0;
      const avgSsRate = totalCombinedUnits > 0 ? (totalCombinedSs / totalCombinedUnits) : 0;
      const avgLandedRate = totalCombinedUnits > 0 ? (totalCombinedLanded / totalCombinedUnits) : 0;
      const spreadPct = totalCombinedMrp > 0 ? (((totalCombinedMrp - totalCombinedSs) / totalCombinedMrp) * 100).toFixed(1) : '0';

      // Update TWO PRIMARY BOLD HERO TILES (Multi-Product Aggregate)
      setTxt('big-tile-our-profit', `₹${totalCombinedProfit.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-profit-pct-badge', `${this.advancedCalcProducts.length} Combined Products`);
      setTxt('big-tile-units-display', `${totalCombinedUnits.toLocaleString('en-IN')} pcs (${totalCombinedCases} cs total)`);
      setTxt('big-tile-unit-profit-display', `Avg +₹${avgProfitPerUnit.toFixed(2)} / unit`);

      setTxt('big-tile-landed-outflow', `₹${totalCombinedLanded.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-landed-rate', `Avg ₹${avgLandedRate.toFixed(2)} / pc`);
      setTxt('big-tile-landed-badge', `Combined Out-of-Pocket Outflow`);

      // Update 3 SUMMARY TILES
      setTxt('big-tile-ss-invoice', `₹${totalCombinedSs.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-ss-rate', `Avg ₹${avgSsRate.toFixed(2)}/pc`);

      setTxt('big-tile-marketeer-cut', `₹${totalCombinedMkt.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-marketeer-rate', mktRates.size === 1 ? `${[...mktRates][0].toFixed(1)}% on Landed Outflows` : 'Mixed % on Landed Outflows');

      setTxt('big-tile-mrp-total', `₹${totalCombinedMrp.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
      setTxt('big-tile-spread-pct', `${spreadPct}%`);
    }
  }

  resetProfitCalculator() {
    this.simpleCalcData = this.getInitialSimpleCalc();
    this.advancedCalcProducts = this.getInitialAdvancedCalc();
    this.syncSimpleInputs();
    if (this.calcMode === 'advanced') {
      this.renderAdvancedRows();
    }
    this.updateProfitCalculator();
    this.showToast('↺ Calculator reset to standard trade presets');
  }

  copyCalcQuoteSummary() {
    let quote = '';
    if (this.calcMode === 'simple') {
      const d = this.simpleCalcData;
      const mfg = parseFloat(d.mfgPrice) || 0;
      const gst = parseFloat(d.gstRate) || 0;
      const trans = parseFloat(d.transportPct) || 0;
      const labelCost = parseFloat(d.labelCost) || 0;
      const profit = parseFloat(d.profitPct) || 0;
      const mkt = parseFloat(d.marketeerPct) || 0;
      const mrp = parseFloat(d.mrp) || 0;
      const cases = parseInt(d.cases) || 0;
      const cp = parseInt(d.casePack) || 1;
      const units = cases * cp;

      const gstAmt = mfg * (gst / 100);
      const transAmt = (mfg + gstAmt) * (trans / 100);
      const landed = mfg + gstAmt + transAmt + labelCost;
      const ourCut = landed * (profit / 100);
      const mktCut = landed * (mkt / 100);
      const ssPrice = landed + ourCut + mktCut;
      const spread = mrp > 0 ? (mrp - ssPrice) : 0;
      const spreadPct = mrp > 0 ? ((spread / mrp) * 100).toFixed(1) : '0';

      quote = [
        `================================================`,
        `  TRADEFLOW COMMERCIAL QUOTE - ${d.name.toUpperCase()}`,
        `  Pack Size: ${d.packSize} | Case Pack: ${cp} units/case`,
        `================================================`,
        `1. Mfg Base Cost:             ₹${mfg.toFixed(2)}`,
        `2. GST (${gst}%):                 +₹${gstAmt.toFixed(2)}`,
        `3. Transport Freight (${trans}%):    +₹${transAmt.toFixed(2)}`,
        labelCost > 0 ? `4. Extra Label / Print Cost:  +₹${labelCost.toFixed(2)}` : null,
        `------------------------------------------------`,
        `   TOTAL LANDED COST (OUTFLOW): ₹${landed.toFixed(2)} / unit`,
        `------------------------------------------------`,
        `5. ${this.config().brand} Margin (${profit}% on Landed): +₹${ourCut.toFixed(2)}`,
        `6. Marketeer Margin (${mkt}% on Landed):   +₹${mktCut.toFixed(2)}`,
        `================================================`,
        `   PRICE TO SUPER STOCKIST:    ₹${ssPrice.toFixed(2)} / unit`,
        `   MRP (Retail Reference):     ₹${mrp.toFixed(2)} / unit`,
        `   Stockist/Retail Spread:     ₹${spread.toFixed(2)} (${spreadPct}%)`,
        `================================================`,
        `BATCH ORDER ROLLUP (${cases} Cases / ${units.toLocaleString('en-IN')} Units):`,
        `• TOTAL TO PAY FROM POCKET:    ₹${(units * landed).toLocaleString('en-IN', {minimumFractionDigits: 2})}`,
        `• OUR NET PROFIT (IN POCKET):  ₹${(units * ourCut).toLocaleString('en-IN', {minimumFractionDigits: 2})}`,
        `• Marketeer Commission:        ₹${(units * mktCut).toLocaleString('en-IN', {minimumFractionDigits: 2})}`,
        `• Total Invoiced to SS:        ₹${(units * ssPrice).toLocaleString('en-IN', {minimumFractionDigits: 2})}`,
        `• Total Retail MRP Value:      ₹${(units * mrp).toLocaleString('en-IN', {minimumFractionDigits: 2})}`,
        `================================================`
      ].filter(Boolean).join('\n');
    } else {
      let lines = [
        `================================================`,
        `  TRADEFLOW MULTI-PRODUCT ORDER QUOTATION`,
        `  Combined Products: ${this.advancedCalcProducts.length}`,
        `================================================`
      ];
      let totalUnitsAll = 0;
      let totalProfitAll = 0;
      let totalLandedAll = 0;
      let totalSsAll = 0;

      this.advancedCalcProducts.forEach((p, idx) => {
        const mfg = parseFloat(p.mfgPrice) || 0;
        const gst = parseFloat(p.gstRate) || 0;
        const trans = parseFloat(p.transportPct) || 0;
        const labelCost = parseFloat(p.labelCost) || 0;
        const profit = parseFloat(p.profitPct) || 0;
        const mkt = parseFloat(p.marketeerPct) || 0;
        const cases = parseInt(p.cases) || 0;
        const cp = parseInt(p.casePack) || 1;
        const units = cases * cp;

        const gstAmt = mfg * (gst / 100);
        const transAmt = (mfg + gstAmt) * (trans / 100);
        const landed = mfg + gstAmt + transAmt + labelCost;
        const ourCut = landed * (profit / 100);
        const mktCut = landed * (mkt / 100);
        const ssPrice = landed + ourCut + mktCut;
        const netRowProfit = units * ourCut;
        const rowOutflow = units * landed;

        totalUnitsAll += units;
        totalProfitAll += netRowProfit;
        totalLandedAll += rowOutflow;
        totalSsAll += (units * ssPrice);

        lines.push(`${idx + 1}. ${p.name} (${p.packSize}): ${cases} cs (${units} pcs) @ ₹${ssPrice.toFixed(2)}/pc | Outflow: ₹${rowOutflow.toLocaleString('en-IN')} | Profit: ₹${netRowProfit.toLocaleString('en-IN')}`);
      });

      lines.push(`================================================`);
      lines.push(`OVERALL ORDER TOTALS:`);
      lines.push(`• Total Order Units:           ${totalUnitsAll.toLocaleString('en-IN')} pcs`);
      lines.push(`• TOTAL TO PAY FROM POCKET:    ₹${totalLandedAll.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
      lines.push(`• OUR TOTAL NET PROFIT:        ₹${totalProfitAll.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
      lines.push(`• Total Invoiced to SS:        ₹${totalSsAll.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
      lines.push(`================================================`);
      quote = lines.join('\n');
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(quote).then(() => {
        this.showToast('Order quote breakdown copied to clipboard!');
      }).catch(() => {
        this.showToast('Order quote generated!');
      });
    } else {
      this.showToast('Order quote ready!');
    }
  }

  applyCalcToNewOrder() {
    this.closeProfitCalculatorModal();
    this.openNewOrderModal();

    setTimeout(() => {
      if (this.calcMode === 'simple') {
        const d = this.simpleCalcData;
        const mfg = parseFloat(d.mfgPrice) || 0;
        const gst = parseFloat(d.gstRate) || 0;
        const trans = parseFloat(d.transportPct) || 0;
        const labelCost = parseFloat(d.labelCost) || 0;
        const profit = parseFloat(d.profitPct) || 0;
        const mkt = parseFloat(d.marketeerPct) || 0;
        const cases = parseInt(d.cases) || 100;
        const cp = parseInt(d.casePack) || 24;
        const units = cases * cp;

        const gstAmt = mfg * (gst / 100);
        const transAmt = (mfg + gstAmt) * (trans / 100);
        const landed = mfg + gstAmt + transAmt + labelCost;
        const ourCut = landed * (profit / 100);
        const mktCut = landed * (mkt / 100);
        const ssPrice = landed + ourCut + mktCut;

        const item = {
          productId: 'PROD-' + Date.now(),
          name: d.name,
          shortName: d.name.slice(0, 6).toUpperCase(),
          variant: `${d.packSize} Pack`,
          packSize: d.packSize,
          casePack: cp,
          cases: cases,
          quantity: units,
          unitRate: parseFloat(ssPrice.toFixed(2)),
          totalAmount: parseFloat((units * ssPrice).toFixed(2)),
          baseCostPerUnit: parseFloat(landed.toFixed(2)),
          pkgCostPerUnit: parseFloat(labelCost.toFixed(2)),
          profitPerUnit: parseFloat(ourCut.toFixed(2))
        };
        this.orderSkuItems = [item];
      } else {
        // Multi-product order creation
        this.orderSkuItems = this.advancedCalcProducts.map((p, idx) => {
          const mfg = parseFloat(p.mfgPrice) || 0;
          const gst = parseFloat(p.gstRate) || 0;
          const trans = parseFloat(p.transportPct) || 0;
          const labelCost = parseFloat(p.labelCost) || 0;
          const profit = parseFloat(p.profitPct) || 0;
          const mkt = parseFloat(p.marketeerPct) || 0;
          const cases = parseInt(p.cases) || 10;
          const cp = parseInt(p.casePack) || 24;
          const units = cases * cp;

          const gstAmt = mfg * (gst / 100);
          const transAmt = (mfg + gstAmt) * (trans / 100);
          const landed = mfg + gstAmt + transAmt + labelCost;
          const ourCut = landed * (profit / 100);
          const mktCut = landed * (mkt / 100);
          const ssPrice = landed + ourCut + mktCut;

          return {
            productId: p.id || ('PROD-' + idx),
            name: p.name,
            shortName: p.name.slice(0, 6).toUpperCase(),
            variant: `${p.packSize} Pack`,
            packSize: p.packSize,
            casePack: cp,
            cases: cases,
            quantity: units,
            unitRate: parseFloat(ssPrice.toFixed(2)),
            totalAmount: parseFloat((units * ssPrice).toFixed(2)),
            baseCostPerUnit: parseFloat(landed.toFixed(2)),
            pkgCostPerUnit: parseFloat(labelCost.toFixed(2)),
            profitPerUnit: parseFloat(ourCut.toFixed(2))
          };
        });
      }
      this.renderOrderSkuTable();
      this.recomputeOrderTotals();
      this.showToast(`New order populated with calculated products!`);
    }, 60);
  }
});
