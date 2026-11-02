// TradeFlow: Products screen. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // View: Products Catalog
  renderProductsGrid() {
    const container = document.getElementById('products-grid');
    if (!container) return;

    if (window.TFComponents && typeof window.TFComponents.renderSkuGrid === 'function') {
      container.innerHTML = window.TFComponents.renderSkuGrid(this.data.products, this.data.orders);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = this.data.products.map(p => {
      const totalCost = p.baseMfgCost + p.packagingCost;
      const profitPerJar = p.standardSellingRate - totalCost;
      const marginPercent = ((profitPerJar / p.standardSellingRate) * 100).toFixed(1);

      return `
        <div class="tf-hcard p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <h4 class="font-bold text-slate-900 dark:text-slate-100 text-sm">${tfEscapeHtml(p.name)}</h4>
                <div class="inline-block px-2 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-xs font-semibold rounded mt-1">
                  ${tfEscapeHtml(p.variant)}
                </div>
              </div>
              <span class="font-mono-num text-xs text-slate-400">${tfEscapeHtml(p.sku)}</span>
            </div>

            <div class="grid grid-cols-2 gap-2 my-3.5 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs">
              <div>
                <span class="text-slate-400 block text-xs">Factory Mfg Cost</span>
                <span class="font-mono-num font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatCurrency(p.baseMfgCost))}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Jar & Label Pack</span>
                <span class="font-mono-num font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatCurrency(p.packagingCost))}</span>
              </div>
              <div class="col-span-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center">
                <span class="text-slate-600 dark:text-slate-400 font-medium">Total Base COGS:</span>
                <span class="font-mono-num font-bold text-slate-900 dark:text-slate-100">${tfEscapeHtml(this.formatCurrency(totalCost))}</span>
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span class="text-xs text-slate-400 block">Selling to Retailer</span>
              <span class="text-base font-bold font-mono-num text-slate-900 dark:text-slate-100">${tfEscapeHtml(this.formatCurrency(p.standardSellingRate))}</span>
              <span class="text-xs text-slate-400 block">MRP: ${tfEscapeHtml(this.formatCurrency(p.mrp))} (GST ${tfEscapeHtml(this.itemGstRate({ productId: p.id }))}%)</span>
            </div>
            <div class="text-right">
              <span class="text-xs text-emerald-600 dark:text-emerald-400 font-bold block">+${tfEscapeHtml(this.formatCurrency(profitPerJar))}/unit</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">${tfEscapeHtml(marginPercent)}% margin</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  /* ---------- SKU MASTER & PRICING CONTROLS ---------- */
  // Edit a product, or add a new one when no id is given.
  openSkuEditModal(skuId) {
    const existing = skuId ? (this.data.products || []).find(p => p.id === skuId) : null;
    if (skuId && !existing) {
      this.showToast('SKU not found.');
      return;
    }
    const cfg = this.config();
    const product = existing || { id: '', name: '', variant: '', casePack: cfg.defaultCasePack, hsn: cfg.defaultHsn, gstRate: cfg.defaultGstRate };
    this.editingSkuIsNew = !existing;
    const modal = document.getElementById('sku-edit-modal');
    if (!modal) return;

    // Populate inputs
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    setVal('sku-edit-id', product.id);
    setVal('sku-edit-name', product.name);
    setVal('sku-edit-variant', product.variant || '');
    setVal('sku-edit-casepack', product.casePack || cfg.defaultCasePack);
    setVal('sku-edit-hsn', product.hsn || this.config().defaultHsn);
    setVal('sku-edit-gst', this.itemGstRate({ productId: product.id, gstRate: product.gstRate ?? product.gst }));
    setVal('sku-edit-mfgcost', product.baseCostPerUnit ?? product.baseMfgCost ?? '');
    setVal('sku-edit-pkgcost', product.pkgCostPerUnit ?? product.pkgCost ?? product.packagingCost ?? '');
    setVal('sku-edit-price', product.defaultUnitRate ?? product.standardSellingRate ?? '');
    setVal('sku-edit-mrp', product.mrp ?? '');

    this.updateSkuEditPreview();

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeSkuEditModal() {
    const modal = document.getElementById('sku-edit-modal');
    if (modal) modal.classList.add('hidden');
  }

  updateSkuEditPreview() {
    const previewEl = document.getElementById('sku-edit-preview');
    if (!previewEl) return;

    const mfgCost = parseFloat(document.getElementById('sku-edit-mfgcost')?.value) || 0;
    const pkgCost = parseFloat(document.getElementById('sku-edit-pkgcost')?.value) || 0;
    const price = parseFloat(document.getElementById('sku-edit-price')?.value) || 0;
    const mrp = parseFloat(document.getElementById('sku-edit-mrp')?.value) || 0;
    const casePack = parseInt(document.getElementById('sku-edit-casepack')?.value) || this.config().defaultCasePack;

    const unitCogs = mfgCost + pkgCost;
    const profit = price - unitCogs;
    const marginPct = price > 0 ? ((profit / price) * 100).toFixed(1) : '0';
    const isHealthy = parseFloat(marginPct) >= 25;
    const caseProfit = profit * casePack;

    previewEl.className = `p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 ${
      isHealthy ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
    }`;

    previewEl.innerHTML = `
      <div>
        <span class="text-xs font-bold uppercase tracking-wider block opacity-70">Live Unit Profit &amp; Margin</span>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-base font-black font-mono-num">${tfEscapeHtml(profit >= 0 ? '+' : '')}${tfEscapeHtml(this.formatCurrency(profit))} / unit</span>
          <span class="px-2 py-0.5 rounded text-xs font-bold font-mono-num ${tfEscapeHtml(isHealthy ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950')}">
            ${tfEscapeHtml(marginPct)}% Margin
          </span>
        </div>
        <p class="text-xs opacity-75 mt-0.5">
          Total Unit COGS: ${tfEscapeHtml(this.formatCurrency(unitCogs))} (Mfg ${tfEscapeHtml(this.formatCurrency(mfgCost))} + Pkg ${tfEscapeHtml(this.formatCurrency(pkgCost))})
        </p>
      </div>

      <div class="text-right">
        <span class="text-xs font-bold uppercase tracking-wider block opacity-70">Per Case Economics (${tfEscapeHtml(casePack)} jars)</span>
        <span class="text-sm font-bold font-mono-num block mt-0.5">Case Profit: ${tfEscapeHtml(this.formatCurrency(caseProfit))}</span>
        <span class="text-xs opacity-75">Retailer Margin: ${tfEscapeHtml(this.formatCurrency(Math.max(0, mrp - price)))} / unit</span>
      </div>
    `;
  }

  handleSaveSku(event) {
    if (event) event.preventDefault();
    const id = document.getElementById('sku-edit-id')?.value;
    let product = id ? (this.data.products || []).find(p => p.id === id) : null;
    if (id && !product) {
      this.showToast('SKU not found to update.');
      return;
    }

    const name = (document.getElementById('sku-edit-name')?.value || '').trim();
    const variant = (document.getElementById('sku-edit-variant')?.value || '').trim();
    const casePack = parseInt(document.getElementById('sku-edit-casepack')?.value) || this.config().defaultCasePack;
    const hsn = (document.getElementById('sku-edit-hsn')?.value || this.config().defaultHsn || '').trim();
    const gstInput = document.getElementById('sku-edit-gst')?.value;
    const gst = gstInput === '' || gstInput === undefined || !Number.isFinite(Number(gstInput)) ? this.config().defaultGstRate : Number(gstInput);
    const mfgCost = parseFloat(document.getElementById('sku-edit-mfgcost')?.value) || 0;
    const pkgCost = parseFloat(document.getElementById('sku-edit-pkgcost')?.value) || 0;
    const price = parseFloat(document.getElementById('sku-edit-price')?.value) || 0;
    const mrp = parseFloat(document.getElementById('sku-edit-mrp')?.value) || 0;

    if (!name) {
      this.showToast('Product name is required.');
      return;
    }

    const isNew = !product;
    const duplicate = (this.data.products || []).find(p => p !== product && String(p.name || '').trim().toLowerCase() === name.toLowerCase() && String(p.variant || '').trim().toLowerCase() === variant.toLowerCase());
    if (duplicate) {
      this.showToast(`"${name}${variant ? ' – ' + variant : ''}" already exists (${duplicate.id}). Edit that product instead.`);
      return;
    }
    if (isNew) {
      product = { id: `PRD-${String(this.nextSequenceNumber('product', ['PRD'], this.data.products || [])).padStart(2, '0')}`, active: true, createdAt: new Date().toISOString() };
      this.data.products = this.data.products || [];
      this.data.products.push(product);
    }
    product.name = name;
    product.variant = variant;
    product.casePack = casePack;
    product.hsn = hsn;
    product.gstRate = gst;
    delete product.gst; // older records stored the rate here; invoices read gstRate
    product.baseMfgCost = mfgCost;
    product.baseCostPerUnit = mfgCost;
    product.packagingCost = pkgCost;
    product.pkgCostPerUnit = pkgCost;
    product.standardSellingRate = price;
    product.defaultUnitRate = price;
    product.mrp = mrp;

    this.saveData();
    this.closeSkuEditModal();
    this.renderProductsGrid();
    this.showToast(isNew ? `Product "${name}" added (${product.id}).` : `SKU "${name}" updated successfully! Standard Selling Rate: ${this.formatCurrency(price)}.`);
  }
});
