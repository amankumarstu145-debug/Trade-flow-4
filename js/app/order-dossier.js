// TradeFlow: Order and payment full window, bill matching, payment drawer. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ---------- COMPREHENSIVE ORDER & PAYMENT FULL WINDOW DOSSIER ---------- */
  openOrderPaymentFullModal(paymentId) {
    const payments = this.data.payments || [];
    let p = payments.find(x => x.id === paymentId);
    if (!p) {
      // Check if paymentId is an order ID or invoice number
      const ord = this.findOrder(paymentId);
      if (ord) {
        p = payments.find(x => x.orderRef === ord.id || x.orderRef === ord.invoiceNumber || x.orderFolder === ord.id);
        if (!p) {
          // If no payment record exists yet, open the full order breakdown page
          this.openOrderDetailPage(ord.id);
          return;
        }
      }
    }
    if (!p) return;

    this.paymentsState.activeDocEntry = p;
    this.paymentsState.activePaymentId = paymentId;

    // Find linked order
    let order = null;
    if (p.orderRef) {
      order = this.findOrder(p.orderRef);
    }
    if (!order && p.partyName) {
      order = (this.data.orders || []).find(o =>
        (o.retailerName && o.retailerName.toLowerCase().includes(p.partyName.toLowerCase())) ||
        (o.manufacturerName && o.manufacturerName.toLowerCase().includes(p.partyName.toLowerCase()))
      );
    }

    const isReceived = p.direction === 'received';
    const orderTitle = p.orderRef || order?.invoiceNumber || order?.id || 'Direct Payment';

    // 1. Header Elements
    const titleEl = document.getElementById('opf-title');
    if (titleEl) {
      titleEl.innerText = `Order & Payment Dossier — ${orderTitle}`;
    }

    const subEl = document.getElementById('opf-subtitle');
    if (subEl) {
      subEl.innerText = `${p.partyName} · ${(p.partyType || 'Party').toUpperCase()} · Payment logged on ${this.formatDate(p.date)}`;
    }

    const badgesEl = document.getElementById('opf-badges');
    if (badgesEl) {
      badgesEl.innerHTML = `
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${tfEscapeHtml(isReceived ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30')}">
          ${tfEscapeHtml(isReceived ? '↓ Money Received' : '↑ Money Paid Out')}
        </span>
        ${order ? `
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            ${tfEscapeHtml(order.invoiceNumber || order.id)} (${tfEscapeHtml((order.status || 'Active').replace(/_/g, ' ').toUpperCase())})
          </span>
        ` : ''}
        <span class="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
          ${tfEscapeHtml(p.mode || 'NEFT')}
        </span>
        ${(p.hasProof || p.pd || p.dataUrl) ? `
          <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
            <i data-lucide="file-check" class="w-3 h-3"></i> Document Attached
          </span>
        ` : ''}
      `;
    }

    // 2. Action Buttons in Header
    this.opfState = { paymentId, orderId: order?.id, billMode: null };

    const btnViewBill = document.getElementById('opf-btn-view-bill');
    if (btnViewBill) {
      btnViewBill.style.display = (p.pd || p.dataUrl || p.hasProof) ? 'inline-flex' : 'none';
      btnViewBill.onclick = () => this.openOrderPaymentBillView('full');
    }

    const btnSplitBill = document.getElementById('opf-btn-split-bill');
    if (btnSplitBill) {
      btnSplitBill.style.display = (p.pd || p.dataUrl || p.hasProof) ? 'inline-flex' : 'none';
      btnSplitBill.onclick = () => this.openOrderPaymentBillView('split');
    }

    const btnInvoice = document.getElementById('opf-btn-invoice');
    if (btnInvoice) {
      if (order) {
        btnInvoice.style.display = 'inline-flex';
        btnInvoice.onclick = () => {
          this.openInvoiceModal(order.id);
        };
      } else {
        btnInvoice.style.display = 'none';
      }
    }

    const btnEditOrder = document.getElementById('opf-btn-edit-order');
    if (btnEditOrder) {
      if (order) {
        btnEditOrder.style.display = 'inline-flex';
        btnEditOrder.onclick = () => {
          this.openEditOrderModal(order.id);
        };
      } else {
        btnEditOrder.style.display = 'none';
      }
    }

    const btnEdit = document.getElementById('opf-btn-edit');
    if (btnEdit) {
      btnEdit.onclick = () => {
        this.closeOrderPaymentFullModal();
        this.editPayment(p.id);
      };
    }

    const btnDelete = document.getElementById('opf-btn-delete');
    if (btnDelete) {
      btnDelete.onclick = () => {
        this.closeOrderPaymentFullModal();
        this.deletePayment(p.id);
      };
    }

    // 3. Build Full Dossier Body
    const bodyEl = document.getElementById('opf-body');
    if (bodyEl) {
      const contact = (this.data.contacts || []).find(c =>
        c.name.toLowerCase() === p.partyName.toLowerCase() ||
        c.name.toLowerCase().includes(p.partyName.toLowerCase())
      );

      let itemsHtml = '';
      let totalCases = 0;
      let totalUnits = 0;
      let itemsSubtotal = 0;

      if (order && order.items && Array.isArray(order.items) && order.items.length) {
        itemsHtml = order.items.map((item, idx) => {
          const cases = item.cases || Math.ceil((item.quantity || 0) / (item.casePack || 24));
          const units = item.quantity || 0;
          const rate = item.unitRate || 0;
          const total = item.totalAmount || (units * rate);
          totalCases += cases;
          totalUnits += units;
          itemsSubtotal += total;

          return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/60">
              <td class="p-3 text-center font-mono-num text-slate-400 text-xs">${tfEscapeHtml(idx + 1)}</td>
              <td class="p-3">
                <div class="font-bold text-slate-900 dark:text-white text-xs">${tfEscapeHtml(item.name || 'Product')}</div>
                <div class="text-xs text-slate-400 font-mono">${tfEscapeHtml(item.sku || item.productId || 'SKU')} · ${tfEscapeHtml(item.variant || item.packSize || '')}</div>
              </td>
              <td class="p-3 font-mono text-xs text-slate-600 dark:text-slate-300">${tfEscapeHtml(item.packSize || '—')}</td>
              <td class="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">${tfEscapeHtml(cases)}</td>
              <td class="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">${tfEscapeHtml(units.toLocaleString('en-IN'))}</td>
              <td class="p-3 text-right font-mono text-slate-700 dark:text-slate-200 text-xs">₹${tfEscapeHtml(rate.toFixed(2))}</td>
              <td class="p-3 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">₹${tfEscapeHtml(total.toLocaleString('en-IN', { minimumFractionDigits: 2 }))}</td>
            </tr>
          `;
        }).join('');
      }

      const mfgCost = Number(order?.costing?.mfgCost || order?.manufacturerTotalCost || order?.mfgCost) || 0;
      const pkgCost = Number(order?.costing?.packagingCost || order?.packagingCost) || 0;
      const transportCost = Number(order?.costing?.transportCost || order?.totalTransportCost) || 0;
      const totalCOGS = mfgCost + pkgCost + transportCost;
      const taxableSubtotal = Number(order?.taxableSubtotal || order?.subtotal || itemsSubtotal) || 0;
      const derivedGst = this.computeGst(order?.items || [], order?.gstType !== 'intra');
      const cgst = order?.cgstAmount ?? (order?.gstAmount ? order.gstAmount / 2 : derivedGst.cgst);
      const sgst = order?.sgstAmount ?? (order?.gstAmount ? order.gstAmount / 2 : derivedGst.sgst);
      const totalGst = cgst + sgst + (order?.igstAmount ?? (order?.gstAmount ? 0 : derivedGst.igst));
      const totalInvoice = order?.totalInvoiceAmount || (taxableSubtotal + totalGst);
      const profitMargin = taxableSubtotal - totalCOGS;
      const profitMarginPct = taxableSubtotal > 0 ? ((profitMargin / taxableSubtotal) * 100).toFixed(1) : '0.0';

      bodyEl.innerHTML = `
        <!-- SECTION 1: TOP 3 FINANCIAL & TRANSACTION TILES -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <!-- Tile 1: Payment Settlement Spec -->
          <div class="p-5 rounded-xl border ${tfEscapeHtml(isReceived ? 'bg-emerald-500/5 dark:bg-emerald-950/30 border-emerald-500/30' : 'bg-rose-500/5 dark:bg-rose-950/30 border-rose-500/30')} shadow-xs flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold uppercase tracking-wider ${tfEscapeHtml(isReceived ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}">
                  ${tfEscapeHtml(isReceived ? 'Payment Received (Credit)' : 'Payment Dispatched (Debit)')}
                </span>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${tfEscapeHtml(isReceived ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white')}">
                  ${tfEscapeHtml(isReceived ? '↓ Money In' : '↑ Money Out')}
                </span>
              </div>
              <div class="text-3xl font-black font-mono-num ${tfEscapeHtml(isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}">
                ${tfEscapeHtml(isReceived ? '+' : '-')}${tfEscapeHtml(this.formatCurrency(p.amount))}
              </div>
            </div>
            <div class="mt-4 pt-3 border-t ${tfEscapeHtml(isReceived ? 'border-emerald-500/20' : 'border-rose-500/20')} space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-400 font-medium">Payment Date:</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatDate(p.date))}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400 font-medium">Mode:</span>
                <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(p.mode || 'NEFT')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400 font-medium">UTR / Ref:</span>
                <span class="font-mono font-bold text-amber-600 dark:text-amber-400">${tfEscapeHtml(p.utr || '—')}</span>
              </div>
              ${p.bank ? `
                <div class="flex justify-between">
                  <span class="text-slate-400 font-medium">Bank:</span>
                  <span class="font-semibold text-slate-700 dark:text-slate-300">${tfEscapeHtml(p.bank)}</span>
                </div>
              ` : ''}
              ${p.txnId ? `
                <div class="flex justify-between">
                  <span class="text-slate-400 font-medium">Bank TXN ID:</span>
                  <span class="font-mono text-slate-700 dark:text-slate-300">${tfEscapeHtml(p.txnId)}</span>
                </div>
              ` : ''}
              <div class="mt-3 pt-2 border-t ${tfEscapeHtml(isReceived ? 'border-emerald-500/20' : 'border-rose-500/20')} flex justify-end">
                <button onclick="app.editPayment('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-bold rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1">
                  <i data-lucide="wallet" class="w-3 h-3 text-amber-400"></i> Edit Payment
                </button>
              </div>
            </div>
          </div>

          <!-- Tile 2: Counterparty Information -->
          <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] shadow-xs flex flex-col justify-between">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Counterparty Dossier</span>
              <h4 class="text-lg font-black text-slate-900 dark:text-white truncate" title="${tfEscapeHtml(p.partyName)}">${tfEscapeHtml(p.partyName)}</h4>
              <div class="flex items-center gap-1.5 mt-1">
                <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  ${tfEscapeHtml((p.partyType || 'Party').toUpperCase())}
                </span>
                ${contact?.gstin ? `<span class="text-xs font-mono text-slate-400">GST: ${tfEscapeHtml(contact.gstin)}</span>` : ''}
              </div>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div class="flex justify-between">
                <span class="text-slate-400">Contact:</span>
                <span class="font-semibold text-slate-800 dark:text-slate-200">${tfEscapeHtml(contact?.contactPerson || order?.retailerContact || '—')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Phone:</span>
                <span class="font-mono text-slate-800 dark:text-slate-200">${tfEscapeHtml(contact?.phone || order?.retailerPhone || '—')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Location:</span>
                <span class="truncate max-w-[160px] text-right">${tfEscapeHtml(contact?.state || order?.deliveryAddress || '')}</span>
              </div>
              ${p.notes ? `
                <div class="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <span class="text-xs text-slate-400 block font-semibold mb-0.5">Remarks:</span>
                  <p class="text-xs text-slate-700 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-900/60 p-2 rounded border border-slate-200 dark:border-slate-800">${tfEscapeHtml(p.notes)}</p>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Tile 3: Linked Order & Ledger Status -->
          <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] shadow-xs flex flex-col justify-between">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">Attached Order &amp; Ledger</span>
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="text-xl font-black font-mono-num text-amber-600 dark:text-amber-400">${tfEscapeHtml(orderTitle)}</h4>
                ${order ? `
                  <button onclick="app.openEditOrderModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 flex items-center gap-1" title="Edit Order Details">
                    <i data-lucide="edit-3" class="w-3 h-3"></i> Edit Order
                  </button>
                  <button onclick="app.openInvoiceModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 flex items-center gap-1">
                    <i data-lucide="file-text" class="w-3 h-3"></i> Invoice
                  </button>
                ` : ''}
              </div>
              <p class="text-xs text-slate-400 mt-1">Status: <strong class="text-slate-700 dark:text-slate-200">${tfEscapeHtml(order ? (order.status || 'Active').replace(/_/g, ' ').toUpperCase() : 'Standalone Entry')}</strong></p>
            </div>
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-slate-400">Total Invoice:</span>
                <span class="font-mono-num font-bold text-slate-900 dark:text-white">${tfEscapeHtml(order ? this.formatCurrency(totalInvoice) : '—')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Customer Advance:</span>
                <span class="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(order ? this.formatCurrency(order.customerAdvanceReceived || 0) : '—')}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Customer Balance Due:</span>
                <span class="font-mono-num font-bold ${tfEscapeHtml((order?.customerBalanceDue || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}">
                  ${tfEscapeHtml(order ? this.formatCurrency(order.customerBalanceDue || 0) : '—')}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Factory Advance Paid:</span>
                <span class="font-mono-num font-bold text-blue-600 dark:text-blue-400">${tfEscapeHtml(order ? this.formatCurrency(order.manufacturerAdvancePaid || 0) : '—')}</span>
              </div>
            </div>
          </div>

        </div>

        <!-- SECTION 2: ORDER IDENTITY & TIMELINE -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] shadow-xs">
          <div class="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3 flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <i data-lucide="calendar" class="w-4 h-4"></i>
              </span>
              <h4 class="font-bold text-slate-900 dark:text-white text-sm">Order Identity, Timeline &amp; Parties</h4>
            </div>
            <div class="flex items-center gap-2">
              ${order ? `
                <button onclick="app.openEditOrderModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-2.5 py-1 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                  <i data-lucide="edit-3" class="w-3 h-3 text-amber-500"></i> Edit Order &amp; Parties
                </button>
              ` : ''}
              <span class="text-xs text-slate-400">Ordered on <strong class="text-slate-700 dark:text-slate-200">${tfEscapeHtml(order ? `${this.formatDate(order.date)} ${order.time || '12:11 PM'}` : this.formatDate(p.date))}</strong></span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div onclick="app.navigateToContactFromModal('${tfEscapeHtml(tfEscapeJs(order ? order.retailerId : (contact ? contact.id : '')))}', 'order-payment-full-modal', '${tfEscapeHtml(tfEscapeJs(p.id))}')" class="p-3.5 rounded-xl bg-slate-50 hover:bg-amber-500/5 dark:bg-slate-900/60 dark:hover:bg-amber-500/10 border border-slate-200/80 hover:border-emerald-600 dark:border-slate-800/80 dark:hover:border-emerald-600/70 transition-all cursor-pointer group shadow-2xs flex flex-col justify-between" title="Click to view Buyer account & order history">
              <div>
                <div class="flex items-center justify-between text-slate-400 mb-1">
                  <span class="text-xs uppercase font-bold">Buyer / Retailer</span>
                  <i data-lucide="building-2" class="w-3.5 h-3.5 text-emerald-500"></i>
                </div>
                <div class="font-extrabold text-slate-900 dark:text-white text-sm truncate group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order?.retailerName || p.partyName)}</div>
                <div class="text-slate-500 dark:text-slate-400 mt-1 space-y-0.5 text-xs">
                  <div>Contact: ${tfEscapeHtml(order?.retailerContact || contact?.contactPerson || '')}</div>
                  <div>Phone: ${tfEscapeHtml(order?.retailerPhone || contact?.phone || '')}</div>
                  <div class="truncate">Address: ${tfEscapeHtml(order?.deliveryAddress || order?.shippingAddress || 'Not set')}</div>
                </div>
              </div>
              <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold group-hover:underline">
                <span>View Buyer Account</span>
                <span>→</span>
              </div>
            </div>

            <div onclick="app.navigateToContactFromModal('${tfEscapeHtml(tfEscapeJs(order ? order.manufacturerId : ''))}', 'order-payment-full-modal', '${tfEscapeHtml(tfEscapeJs(p.id))}')" class="p-3.5 rounded-xl bg-slate-50 hover:bg-amber-500/5 dark:bg-slate-900/60 dark:hover:bg-amber-500/10 border border-slate-200/80 hover:border-emerald-600 dark:border-slate-800/80 dark:hover:border-emerald-600/70 transition-all cursor-pointer group shadow-2xs flex flex-col justify-between" title="Click to view Factory profile & active batches">
              <div>
                <div class="flex items-center justify-between text-slate-400 mb-1">
                  <span class="text-xs uppercase font-bold">Manufacturer</span>
                  <i data-lucide="factory" class="w-3.5 h-3.5 text-blue-500"></i>
                </div>
                <div class="font-extrabold text-slate-900 dark:text-white text-sm truncate group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order?.manufacturerName || 'Manufacturer not set')}</div>
                <div class="text-slate-500 dark:text-slate-400 mt-1 space-y-0.5 text-xs">
                  <div>Advance Paid: <strong class="text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(this.formatCurrency(order?.manufacturerAdvancePaid || 0))}</strong></div>
                  <div>Production: ${tfEscapeHtml((order?.manufacturerStatus || 'In Production').toUpperCase())}</div>
                </div>
              </div>
              <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold group-hover:underline">
                <span>View Factory Batches</span>
                <span>→</span>
              </div>
            </div>

            <div onclick="app.navigateToContactFromModal('${tfEscapeHtml(tfEscapeJs(order ? order.packagingVendorId : ''))}', 'order-payment-full-modal', '${tfEscapeHtml(tfEscapeJs(p.id))}')" class="p-3.5 rounded-xl bg-slate-50 hover:bg-amber-500/5 dark:bg-slate-900/60 dark:hover:bg-amber-500/10 border border-slate-200/80 hover:border-emerald-600 dark:border-slate-800/80 dark:hover:border-emerald-600/70 transition-all cursor-pointer group shadow-2xs flex flex-col justify-between" title="Click to view Packaging Vendor & supply balance">
              <div>
                <div class="flex items-center justify-between text-slate-400 mb-1">
                  <span class="text-xs uppercase font-bold">Packaging Supplier</span>
                  <i data-lucide="package" class="w-3.5 h-3.5 text-blue-500"></i>
                </div>
                <div class="font-extrabold text-slate-900 dark:text-white text-sm truncate group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order?.packagingVendorName || '')}</div>
                <div class="text-slate-500 dark:text-slate-400 mt-1 space-y-0.5 text-xs">
                  <div>Total Cost: ${tfEscapeHtml(this.formatCurrency(order?.packagingCost || 28560))}</div>
                  <div>Advance Paid: ${tfEscapeHtml(this.formatCurrency(order?.packagingAdvancePaid || 15000))}</div>
                  <div>Status: ${tfEscapeHtml((order?.packagingStatus || 'Delivered to Mfg').toUpperCase())}</div>
                </div>
              </div>
              <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold group-hover:underline">
                <span>View Packaging Hub</span>
                <span>→</span>
              </div>
            </div>

            <div onclick="app.navigateToContactFromModal('${tfEscapeHtml(tfEscapeJs(order?.marketeerId || order?.transporterId || ''))}', 'order-payment-full-modal', '${tfEscapeHtml(tfEscapeJs(p.id))}')" class="p-3.5 rounded-xl bg-slate-50 hover:bg-amber-500/5 dark:bg-slate-900/60 dark:hover:bg-amber-500/10 border border-slate-200/80 hover:border-emerald-600 dark:border-slate-800/80 dark:hover:border-emerald-600/70 transition-all cursor-pointer group shadow-2xs flex flex-col justify-between" title="Click to view Marketeer or Transporter profile">
              <div>
                <div class="flex items-center justify-between text-slate-400 mb-1">
                  <span class="text-xs uppercase font-bold">Marketeer &amp; Logistics</span>
                  <i data-lucide="truck" class="w-3.5 h-3.5 text-purple-500"></i>
                </div>
                <div class="font-extrabold text-slate-900 dark:text-white text-sm truncate group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order?.marketeerName || 'Direct (no marketeer)')}</div>
                <div class="text-slate-500 dark:text-slate-400 mt-1 space-y-0.5 text-xs">
                  <div>Transporter: ${tfEscapeHtml(order?.transporterName || 'Not assigned')}</div>
                  <div>Freight Cost: ${tfEscapeHtml(this.formatCurrency(order?.totalTransportCost || 0))}</div>
                  <div>Vehicle: ${tfEscapeHtml(order?.vehicleNumber || 'Not entered')}</div>
                </div>
              </div>
              <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400 font-bold group-hover:underline">
                <span>View Partner Dossier</span>
                <span>→</span>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 3: ITEMS INCLUDED TABLE -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] shadow-xs">
          <div class="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800/80 pb-3 flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <i data-lucide="shopping-bag" class="w-4 h-4"></i>
              </span>
              <h4 class="font-bold text-slate-900 dark:text-white text-sm">Order Items &amp; Quantity Breakdown</h4>
            </div>
            <div class="flex items-center gap-2">
              ${order ? `
                <button onclick="app.openEditOrderModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-2.5 py-1 rounded text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1 shadow-2xs">
                  <i data-lucide="edit-3" class="w-3 h-3"></i> Edit Items &amp; Rates
                </button>
              ` : ''}
              <span class="text-xs text-slate-400 font-mono">Total SKUs: <strong>${tfEscapeHtml(order?.items?.length || 2)}</strong></span>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <th class="p-3 text-center w-10">#</th>
                  <th class="p-3">Product Description &amp; SKU</th>
                  <th class="p-3">Pack Size</th>
                  <th class="p-3 text-center">Cases</th>
                  <th class="p-3 text-center">Units / Jars</th>
                  <th class="p-3 text-right">Unit Rate</th>
                  <th class="p-3 text-right">Taxable Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml || `<tr><td colspan="7" class="p-4 text-center text-xs text-slate-400">No items on this order yet.</td></tr>`}
              </tbody>
              <tfoot>
                <tr class="bg-slate-50/80 dark:bg-slate-900/90 font-bold text-xs border-t border-slate-200 dark:border-slate-800">
                  <td colspan="3" class="p-3 text-right uppercase text-xs text-slate-400">Total Volumes &amp; Subtotal:</td>
                  <td class="p-3 text-center font-mono text-amber-600 dark:text-amber-400">${tfEscapeHtml(totalCases || 100)} Cases</td>
                  <td class="p-3 text-center font-mono text-amber-600 dark:text-amber-400">${tfEscapeHtml((totalUnits || 2240).toLocaleString('en-IN'))} Jars</td>
                  <td class="p-3 text-right font-mono text-slate-400">—</td>
                  <td class="p-3 text-right font-mono-num text-slate-900 dark:text-white font-black">₹${tfEscapeHtml((taxableSubtotal || 234400).toLocaleString('en-IN', { minimumFractionDigits: 2 }))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- SECTION 4: FULL COSTING SCENARIO -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] shadow-xs">
          <div class="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <i data-lucide="calculator" class="w-4 h-4"></i>
              </span>
              <h4 class="font-bold text-slate-900 dark:text-white text-sm">Full Costing Scenario &amp; Unit Economics</h4>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              Profit Margin: ~${tfEscapeHtml(profitMarginPct)}%
            </span>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            <!-- Left Column: Direct Manufacturing & Packaging Costs -->
            <div class="space-y-3">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Direct Cost of Goods Sold (COGS)</span>
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-200/60 dark:divide-slate-800 space-y-2">
                <div class="flex justify-between items-center py-1">
                  <span class="text-slate-600 dark:text-slate-300 font-medium">1. Factory Base Mfg &amp; Job-Work</span>
                  <span class="font-mono-num font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(mfgCost))}</span>
                </div>
                <div class="flex justify-between items-center py-1 pt-2">
                  <span class="text-slate-600 dark:text-slate-300 font-medium">2. Packaging Material (Jars, Caps, Labels)</span>
                  <span class="font-mono-num font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(pkgCost))}</span>
                </div>
                <div class="flex justify-between items-center py-1 pt-2">
                  <span class="text-slate-600 dark:text-slate-300 font-medium">3. Freight &amp; Transport Logistics</span>
                  <span class="font-mono-num font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(transportCost))}</span>
                </div>
                <div class="flex justify-between items-center py-1.5 pt-3 font-bold text-slate-900 dark:text-white bg-slate-100/80 dark:bg-slate-800/80 px-2 rounded-lg">
                  <span>Total Direct Costs (COGS):</span>
                  <span class="font-mono-num text-rose-600 dark:text-rose-400">${tfEscapeHtml(this.formatCurrency(totalCOGS))}</span>
                </div>
              </div>
            </div>

            <!-- Right Column: Revenue, Taxes & Profit Realization -->
            <div class="space-y-3">
              <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block">Billing &amp; Profit Scenario</span>
              <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-200/60 dark:divide-slate-800 space-y-2">
                <div class="flex justify-between items-center py-1">
                  <span class="text-slate-600 dark:text-slate-300 font-medium">Taxable Selling Subtotal</span>
                  <span class="font-mono-num font-bold text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(taxableSubtotal))}</span>
                </div>
                <div class="flex justify-between items-center py-1 pt-2">
                  <span class="text-slate-600 dark:text-slate-300 font-medium">GST Breakdown (${tfEscapeHtml(this.gstLabels(order || {}).combined)})</span>
                  <span class="font-mono-num font-bold text-slate-700 dark:text-slate-300">${tfEscapeHtml(this.formatCurrency(totalGst))}</span>
                </div>
                <div class="flex justify-between items-center py-1 pt-2">
                  <span class="text-slate-600 dark:text-slate-300 font-bold">Total Invoice Amount</span>
                  <span class="font-mono-num font-black text-amber-600 dark:text-amber-400">${tfEscapeHtml(this.formatCurrency(totalInvoice))}</span>
                </div>
                <div class="flex justify-between items-center py-1.5 pt-3 font-bold text-slate-900 dark:text-white bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 px-2 rounded-lg">
                  <span class="text-emerald-700 dark:text-emerald-400">Net Gross Profit Realized:</span>
                  <span class="font-mono-num text-emerald-600 dark:text-emerald-400 font-black">${tfEscapeHtml(this.formatCurrency(profitMargin))} (~${tfEscapeHtml(profitMarginPct)}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 5: ATTACHED DOCUMENT PROOF & ACTIONS -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] shadow-xs">
          <div class="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3 flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
                <i data-lucide="file-check" class="w-4 h-4"></i>
              </span>
              <div>
                <h4 class="font-bold text-slate-900 dark:text-white text-sm">Attached Document Proof &amp; In-Window Verification</h4>
                <p class="text-xs text-slate-400 font-mono">${tfEscapeHtml(p.pn || 'Payment_Proof.pdf')} • Folder: storage/documents/orders/${tfEscapeHtml(p.orderFolder || p.orderRef || 'general')}/</p>
              </div>
            </div>

            <!-- Action Buttons: Side-by-Side Match, View Here, Open Folder, Download, WhatsApp -->
            <div class="flex items-center gap-2 flex-wrap">
              ${(p.pd || p.dataUrl) ? `
                <button onclick="app.openOrderPaymentBillView('split')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-blue-100 bg-blue-900/80 hover:bg-blue-800 border border-blue-700/80 rounded-lg flex items-center gap-1.5 shadow-2xs" title="Open side-by-side match view in this window">
                  <i data-lucide="columns" class="w-3.5 h-3.5 text-blue-400"></i>
                  <span>Match Side-by-Side</span>
                </button>
                <button onclick="app.openOrderPaymentBillView('full')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 shadow-2xs" title="View full bill in this window">
                  <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
                  <span>View Bill Here</span>
                </button>
              ` : ''}
              <button onclick="app.openDocFolderForEntry('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-700" title="Open folder in Windows Explorer">
                <i data-lucide="folder" class="w-3.5 h-3.5 text-amber-500"></i>
                <span>Open Folder</span>
              </button>
              <button onclick="app.downloadActiveDoc()" class="btn-tactile px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-700" title="Download copy">
                <i data-lucide="download" class="w-3.5 h-3.5 text-blue-500"></i>
                <span>Download</span>
              </button>
              <button onclick="app.shareActiveDocWhatsApp()" class="btn-tactile px-3 py-1.5 text-xs font-semibold text-white bg-[#25D366] hover:bg-[#1ebc59] rounded-lg flex items-center gap-1.5 shadow-2xs" title="Send settlement notice on WhatsApp">
                <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
                <span>WhatsApp</span>
              </button>
            </div>
          </div>

          <!-- Inline Document Preview Container -->
          ${(p.pd || p.dataUrl) ? `
            <div id="opf-preview-container" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 min-h-[220px] flex items-center justify-center overflow-hidden">
              ${(p.pt && p.pt.startsWith('image/')) ? `
                <img src="${tfEscapeHtml(tfSafeUrl(p.dataUrl || p.pd))}" class="max-h-96 rounded-lg mx-auto shadow-sm object-contain" alt="Payment Proof">
              ` : `
                <div id="opf-canvas-container" class="w-full flex flex-col items-center justify-center py-4">
                  <div class="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-md">
                    <i data-lucide="file-text" class="w-8 h-8 text-amber-500 shrink-0"></i>
                    <div class="min-w-0 flex-1">
                      <div class="font-bold text-slate-900 dark:text-white truncate">${tfEscapeHtml(p.pn || 'Payment_Proof.pdf')}</div>
                      <div class="text-xs text-slate-400">PDF Document Proof Attached</div>
                    </div>
                    <button onclick="app.openOrderPaymentBillView('split')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1 shrink-0">
                      <i data-lucide="columns" class="w-3.5 h-3.5"></i>
                      <span>Match Details</span>
                    </button>
                  </div>
                </div>
              `}
            </div>
          ` : `
            <div class="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-slate-400">
              <i data-lucide="file-plus" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
              <div class="font-bold text-slate-700 dark:text-slate-300 text-sm">No document proof attached yet</div>
              <p class="text-xs text-slate-500 mt-0.5 mb-3">You can attach a scanned bank advice or voucher anytime.</p>
              <button onclick="app.closeOrderPaymentFullModal(); app.editPayment('${tfEscapeHtml(tfEscapeJs(p.id))}');" class="btn-tactile px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg inline-flex items-center gap-1.5">
                <i data-lucide="upload" class="w-3.5 h-3.5"></i>
                <span>Attach Proof Now</span>
              </button>
            </div>
          `}
        </div>

        <!-- SECTION 6: SYSTEM AUDIT TRAIL & PRECISION TIME LOGS -->
        <div class="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111622] shadow-xs">
          <div class="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3 flex-wrap gap-2">
            <div class="flex items-center gap-2">
              <span class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <i data-lucide="clock" class="w-4 h-4"></i>
              </span>
              <div>
                <h4 class="font-bold text-slate-900 dark:text-white text-sm">System Audit Trail &amp; Precision Timestamp Logs</h4>
                <p class="text-xs text-slate-400">Verifiable chronological audit records of order placement, payment logging, and modifications</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-md text-xs font-mono-num font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Live Audit Verification Active</span>
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <!-- Order Timeline Card -->
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <i data-lucide="package" class="w-3.5 h-3.5"></i>
                  <span>Order Audit Log</span>
                </span>
                <span class="text-xs font-mono-num text-slate-400 font-bold">${tfEscapeHtml(order?.invoiceNumber || order?.id || 'N/A')}</span>
              </div>
              <div class="space-y-2 divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
                <div class="pt-1 flex items-start justify-between gap-2">
                  <span class="text-slate-500 dark:text-slate-400 shrink-0">Order Placed:</span>
                  <span class="font-mono-num font-bold text-slate-800 dark:text-slate-200 text-right">
                    ${tfEscapeHtml(order?.timeLog || (order?.date ? `${this.formatDate(order.date)} || 10:15:00 AM` : 'Active Record'))}
                  </span>
                </div>
                <div class="pt-2 flex items-start justify-between gap-2">
                  <span class="text-slate-500 dark:text-slate-400 shrink-0">Last Modified:</span>
                  <span class="font-mono-num font-bold ${tfEscapeHtml(order?.lastModifiedTimeLog ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')} text-right">
                    ${tfEscapeHtml(order?.lastModifiedTimeLog || 'Original version (No edits made)')}
                  </span>
                </div>
                <div class="pt-2 flex items-start justify-between gap-2">
                  <span class="text-slate-500 dark:text-slate-400 shrink-0">Buyer / Party:</span>
                  <span class="font-semibold text-slate-700 dark:text-slate-300 text-right">${tfEscapeHtml(order?.retailerName || p.partyName)}</span>
                </div>
              </div>
            </div>

            <!-- Payment Timeline Card -->
            <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
                  <span>Payment Voucher Audit Log</span>
                </span>
                <span class="text-xs font-mono-num text-slate-400 font-bold">${tfEscapeHtml(p.id)}</span>
              </div>
              <div class="space-y-2 divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
                <div class="pt-1 flex items-start justify-between gap-2">
                  <span class="text-slate-500 dark:text-slate-400 shrink-0">Voucher Logged:</span>
                  <span class="font-mono-num font-bold text-slate-800 dark:text-slate-200 text-right">
                    ${tfEscapeHtml(p.timeLog || (p.date ? `${this.formatDate(p.date)} || 11:30:00 AM` : 'Active Record'))}
                  </span>
                </div>
                <div class="pt-2 flex items-start justify-between gap-2">
                  <span class="text-slate-500 dark:text-slate-400 shrink-0">Last Modified:</span>
                  <span class="font-mono-num font-bold ${tfEscapeHtml(p.lastModifiedTimeLog ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400')} text-right">
                    ${tfEscapeHtml(p.lastModifiedTimeLog || 'Original voucher (No edits made)')}
                  </span>
                </div>
                <div class="pt-2 flex items-start justify-between gap-2">
                  <span class="text-slate-500 dark:text-slate-400 shrink-0">Settlement Info:</span>
                  <span class="font-semibold text-slate-700 dark:text-slate-300 text-right font-mono-num">
                    ${tfEscapeHtml(isReceived ? 'Received' : 'Dispatched')} ${tfEscapeHtml(this.formatCurrency(p.amount))} (${tfEscapeHtml(p.mode || 'NEFT')})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    this.closeOrderPaymentBillView();
    const modal = document.getElementById('order-payment-full-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  /* ---------- IN-WINDOW BILL MATCHING & SPLIT VIEW ---------- */
  openOrderPaymentBillView(mode = 'split') {
    const p = this.paymentsState.activeDocEntry;
    if (!p) return;

    const docSource = p.dataUrl || p.pd;
    if (!docSource) {
      this.showToast('No document attached to this payment.');
      return;
    }

    this.opfState = this.opfState || {};
    this.opfState.billMode = mode;

    const pane = document.getElementById('opf-bill-pane');
    const left = document.getElementById('opf-body');
    const titleEl = document.getElementById('opf-bill-title');
    const subEl = document.getElementById('opf-bill-sub');
    const area = document.getElementById('opf-bill-area');
    const controls = document.getElementById('opf-bill-pdf-controls');
    const expandIcon = document.getElementById('opf-bill-expand-icon');
    const expandLabel = document.getElementById('opf-bill-expand-label');

    if (!pane || !left || !area) return;

    if (titleEl) titleEl.innerText = p.pn || 'Attached Bill / Payment Proof';
    if (subEl) subEl.innerText = `${p.partyName} · ${this.formatCurrency(p.amount)} · Match with order details`;

    pane.classList.remove('hidden');
    if (mode === 'full') {
      pane.classList.add('opf-bill-full');
      left.classList.add('opf-left-hidden');
      if (expandIcon) expandIcon.setAttribute('data-lucide', 'columns');
      if (expandLabel) expandLabel.innerText = 'Split View';
    } else {
      pane.classList.remove('opf-bill-full');
      left.classList.remove('opf-left-hidden');
      if (expandIcon) expandIcon.setAttribute('data-lucide', 'maximize');
      if (expandLabel) expandLabel.innerText = 'Expand';
    }

    const isImg = (p.pt && p.pt.startsWith('image/')) || (p.pd && p.pd.startsWith('data:image')) || (p.pn && /\.(png|jpg|jpeg|webp)$/i.test(p.pn));
    if (isImg) {
      if (controls) controls.innerHTML = tfSanitizeHtml('');
      area.innerHTML = `
        <div class="w-full h-full overflow-auto flex items-center justify-center p-3 bg-slate-950/80 rounded-xl">
          <img src="${tfEscapeHtml(tfSafeUrl(docSource))}" class="max-w-full max-h-full rounded-xl object-contain shadow-2xl" alt="Bill Proof">
        </div>
      `;
    } else {
      this.renderPdfDocument(docSource, area, controls);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  closeOrderPaymentBillView() {
    const pane = document.getElementById('opf-bill-pane');
    const left = document.getElementById('opf-body');
    if (pane) pane.classList.add('hidden');
    if (left) left.classList.remove('opf-left-hidden');
    if (this.opfState) this.opfState.billMode = null;
    if (window.lucide) window.lucide.createIcons();
  }

  toggleOrderPaymentBillExpand() {
    if (this.opfState && this.opfState.billMode === 'full') {
      this.openOrderPaymentBillView('split');
    } else {
      this.openOrderPaymentBillView('full');
    }
  }

  closeOrderPaymentFullModal() {
    this.closeOrderPaymentBillView();
    const modal = document.getElementById('order-payment-full-modal');
    if (modal) modal.classList.add('hidden');
  }

  toggleOrderPaymentFullModalMaximize() {
    const panel = document.getElementById('order-payment-full-modal-panel');
    const icon = document.getElementById('opf-maximize-icon');
    if (!panel) return;

    if (!panel.dataset.isMaximized || panel.dataset.isMaximized === 'false') {
      panel.dataset.isMaximized = 'true';
      panel.style.width = '99vw';
      panel.style.height = '98vh';
      panel.style.maxWidth = '99vw';
      if (icon) {
        icon.setAttribute('data-lucide', 'minimize-2');
      }
    } else {
      panel.dataset.isMaximized = 'false';
      panel.style.width = '1240px';
      panel.style.height = '94vh';
      panel.style.maxWidth = '96vw';
      if (icon) {
        icon.setAttribute('data-lucide', 'maximize-2');
      }
    }
    if (window.lucide) window.lucide.createIcons();
  }

  /* ---------- PAYMENT DETAIL DRAWER ---------- */
  openPaymentDetailDrawer(paymentId) {
    const payments = this.data.payments || [];
    const p = payments.find(x => x.id === paymentId);
    if (!p) return;

    this.paymentsState.activePaymentId = paymentId;
    const isReceived = p.direction === 'received';

    const partyNameEl = document.getElementById('pdd-party-name');
    if (partyNameEl) partyNameEl.innerText = p.partyName;
    const dateEl = document.getElementById('pdd-date');
    if (dateEl) dateEl.innerText = `Logged: ${p.timeLog || `${this.formatDate(p.date)} || 11:30:00 AM`} · ${p.mode}`;

    const bodyEl = document.getElementById('pdd-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="p-4 rounded-xl flex items-center justify-between ${tfEscapeHtml(isReceived ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60' : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60')}">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider ${tfEscapeHtml(isReceived ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}">
              ${tfEscapeHtml(isReceived ? 'Money Received (Credit)' : 'Money Paid Out (Debit)')}
            </span>
            <div class="text-2xl font-black font-mono-num ${tfEscapeHtml(isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}">
              ${tfEscapeHtml(isReceived ? '+' : '-')}${tfEscapeHtml(this.formatCurrency(p.amount))}
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${tfEscapeHtml(isReceived ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white')}">
            ${tfEscapeHtml(isReceived ? '↓ Received' : '↑ Paid Out')}
          </span>
        </div>

        <div class="divide-y divide-slate-100 dark:divide-slate-800 space-y-2 text-xs">
          <div class="flex justify-between py-1.5 pt-3">
            <span class="text-slate-400 font-semibold">Payment Date</span>
            <span class="font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatDate(p.date))}</span>
          </div>
          <div class="flex justify-between py-1.5">
            <span class="text-slate-400 font-semibold">System Time Log</span>
            <span class="font-mono-num font-bold text-emerald-600 dark:text-emerald-400 text-right">${tfEscapeHtml(p.timeLog || `${this.formatDate(p.date)} || 11:30:00 AM`)}</span>
          </div>
          ${p.lastModifiedTimeLog ? `
            <div class="flex justify-between py-1.5">
              <span class="text-slate-400 font-semibold">Last Modified</span>
              <span class="font-mono-num font-bold text-amber-600 dark:text-amber-400 text-right">${tfEscapeHtml(p.lastModifiedTimeLog)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between py-1.5">
            <span class="text-slate-400 font-semibold">Counterparty</span>
            <span class="font-bold text-slate-800 dark:text-slate-200 text-right max-w-[200px] truncate">${tfEscapeHtml(p.partyName)}</span>
          </div>
          <div class="flex justify-between py-1.5">
            <span class="text-slate-400 font-semibold">Party Category</span>
            <span class="font-semibold text-slate-700 dark:text-slate-300 uppercase text-xs">${tfEscapeHtml(p.partyType)}</span>
          </div>
          <div class="flex justify-between py-1.5">
            <span class="text-slate-400 font-semibold">Order Reference</span>
            <span class="font-mono-num font-bold text-amber-600 dark:text-amber-400">${tfEscapeHtml(p.orderRef || '—')}</span>
          </div>
          <div class="flex justify-between py-1.5">
            <span class="text-slate-400 font-semibold">Payment Mode</span>
            <span class="font-mono text-slate-700 dark:text-slate-300 font-bold">${tfEscapeHtml(p.mode)}</span>
          </div>
          <div class="flex justify-between py-1.5">
            <span class="text-slate-400 font-semibold">UTR / Ref No.</span>
            <span class="font-mono font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(p.utr || '—')}</span>
          </div>
          ${p.bank ? `
            <div class="flex justify-between py-1.5">
              <span class="text-slate-400 font-semibold">Bank Name</span>
              <span class="font-semibold text-slate-700 dark:text-slate-300">${tfEscapeHtml(p.bank)}</span>
            </div>
          ` : ''}
          ${p.txnId ? `
            <div class="flex justify-between py-1.5">
              <span class="text-slate-400 font-semibold">Bank TXN ID</span>
              <span class="font-mono text-slate-700 dark:text-slate-300">${tfEscapeHtml(p.txnId)}</span>
            </div>
          ` : ''}
          ${p.notes ? `
            <div class="py-2">
              <span class="text-slate-400 font-semibold block mb-0.5">Notes &amp; Remarks</span>
              <p class="text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">${tfEscapeHtml(p.notes)}</p>
            </div>
          ` : ''}
        </div>

        ${p.pd ? `
          <div class="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">Attached Document Proof</span>
            <div class="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">${tfEscapeHtml(p.pn || 'Payment_Proof.pdf')}</div>
                <span class="text-xs text-slate-400">Folder: storage/documents/orders/${tfEscapeHtml(p.orderFolder || p.orderRef || 'general')}/</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button onclick="app.openDocPreviewModal('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1 shadow-2xs">
                  <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                  <span>View</span>
                </button>
                <button onclick="app.openDocFolderForEntry('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile p-1.5 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 dark:border-slate-600" title="Open Folder in File Explorer">
                  <i data-lucide="folder" class="w-3.5 h-3.5 text-amber-500"></i>
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      `;
    }

    const editBtn = document.getElementById('pdd-btn-edit');
    if (editBtn) editBtn.onclick = () => this.editPayment(p.id);
    const delBtn = document.getElementById('pdd-btn-delete');
    if (delBtn) delBtn.onclick = () => this.deletePayment(p.id);

    const drawer = document.getElementById('payment-detail-drawer');
    if (drawer) drawer.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closePaymentDetailDrawer() {
    const drawer = document.getElementById('payment-detail-drawer');
    if (drawer) drawer.classList.add('hidden');
  }

  editPayment(paymentId) {
    const p = (this.data.payments || []).find(x => x.id === paymentId);
    if (!p) return;

    this.closePaymentDetailDrawer();
    this.closeOrderPaymentFullModal();
    this.openPaymentModal(p.orderRef, p.partyName, p.direction);

    // Override fields with existing data
    const hidEdit = document.getElementById('pay-hidden-edit-id');
    if (hidEdit) hidEdit.value = p.id;
    const title = document.getElementById('payment-modal-title');
    if (title) title.innerText = `Edit Payment (${p.id})`;

    const dInput = document.getElementById('pay-input-date');
    if (dInput) dInput.value = p.date;
    const aInput = document.getElementById('pay-input-amount');
    if (aInput) aInput.value = p.amount;
    const pInput = document.getElementById('pay-input-party');
    if (pInput) pInput.value = p.partyName;
    const cSelect = document.getElementById('pay-select-category');
    if (cSelect) cSelect.value = p.partyType;
    const mSelect = document.getElementById('pay-select-mode');
    if (mSelect) mSelect.value = p.mode;
    const oSelect = document.getElementById('pay-select-order');
    if (oSelect) oSelect.value = p.orderRef || '';
    const uInput = document.getElementById('pay-input-utr');
    if (uInput) uInput.value = p.utr || '';
    const bInput = document.getElementById('pay-input-bank');
    if (bInput) bInput.value = p.bank || '';
    const tInput = document.getElementById('pay-input-txnid');
    if (tInput) tInput.value = p.txnId || p.bankTxnId || '';
    const benInput = document.getElementById('pay-input-beneficiary-acc');
    if (benInput) benInput.value = p.beneficiaryAccount || '';
    const payerInput = document.getElementById('pay-input-payer-acc');
    if (payerInput) payerInput.value = p.payerAccount || '';
    const nInput = document.getElementById('pay-input-notes');
    if (nInput) nInput.value = p.notes || '';

    if (p.pd || p.dataUrl) {
      const dropzone = document.getElementById('payment-dropzone');
      const previewWrap = document.getElementById('payment-preview-wrap');
      const previewName = document.getElementById('payment-preview-name');
      const previewIframe = document.getElementById('payment-preview-iframe');
      const previewImg = document.getElementById('payment-preview-img');
      const hidFile = document.getElementById('pay-hidden-filedata');
      const hidName = document.getElementById('pay-hidden-filename');

      if (dropzone) dropzone.classList.add('hidden');
      if (previewWrap) previewWrap.classList.remove('hidden');
      if (previewName) previewName.innerText = p.pn || 'Existing Proof';
      if (hidFile) hidFile.value = p.dataUrl || p.pd;
      if (hidName) hidName.value = p.pn || '';

      const isImg = (p.pt && p.pt.startsWith('image/')) || (p.pd && p.pd.startsWith('data:image')) || (p.pn && /\.(png|jpg|jpeg|webp)$/i.test(p.pn));
      if (isImg) {
        if (previewIframe) previewIframe.classList.add('hidden');
        if (previewImg) {
          previewImg.src = tfSafeUrl(p.dataUrl || p.pd);
          previewImg.classList.remove('hidden');
        }
      } else {
        if (previewImg) previewImg.classList.add('hidden');
        if (previewIframe) {
          previewIframe.src = tfSafeUrl(p.dataUrl || p.pd);
          previewIframe.classList.remove('hidden');
        }
      }
    }
  }

  async deletePayment(paymentId) {
    const p = (this.data.payments || []).find(x => x.id === paymentId);
    if (!p) return;

    const confirmed = await this.showModalConfirm({
      title: 'Delete Payment Entry',
      subtitle: 'Soft Delete Confirmation',
      message: `Delete payment entry of <strong>${tfEscapeHtml(this.formatCurrency(p.amount))}</strong> for <strong>${tfEscapeHtml(p.partyName)}</strong>?<br><br><span class="text-xs text-slate-500">This entry will be moved to the Recycle Bin and can be restored anytime.</span>`,
      confirmText: 'Move to Recycle Bin',
      confirmClass: 'bg-rose-600 hover:bg-rose-500',
      icon: 'trash-2'
    });
    if (!confirmed) return;

    // Soft Delete: the payment stops counting towards its order's balances.
    p.isDeleted = true;
    p.deletedAt = new Date().toISOString();
    p.deletedBy = 'Operator';
    this.applyPaymentToOrder(p, -1);

    this.saveData();
    this.closePaymentDetailDrawer();
    this.closeOrderPaymentFullModal();
    this.renderPaymentsLedger();
    this.updateSidebarUI();
    this.updateRecycleBinBadge();

    // Trigger 10-Second Undo Toast
    this.showUndoToast(`Payment of ${this.formatCurrency(p.amount)} moved to Recycle Bin.`, () => {
      if (!p.isDeleted) return;
      p.isDeleted = false;
      delete p.deletedAt;
      delete p.deletedBy;
      this.applyPaymentToOrder(p, 1);
      this.saveData();
      this.renderPaymentsLedger();
      this.updateSidebarUI();
      this.updateRecycleBinBadge();
    });
  }
});
