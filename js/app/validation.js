// TradeFlow: Order, invoice and payment checks. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ---------- STANDARDIZED STATUTORY VALIDATION ---------- */
  validateOrder(order) {
    const issues = [];
    const warnings = [];

    if (!order) {
      issues.push('Order object is missing.');
      return { isValid: false, issues, warnings };
    }

    if (!order.id && !order.invoiceNumber) issues.push('Order ID or Invoice Number is required.');
    if (!order.retailerName && !order.buyerName) issues.push('Retailer / Buyer name is required.');

    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      issues.push('At least one product line item is required.');
    } else {
      order.items.forEach((item, idx) => {
        if (!item.name && !item.shortName) issues.push(`Item #${idx + 1}: Product name is required.`);
        if (!item.quantity || Number(item.quantity) <= 0) issues.push(`Item #${idx + 1}: Quantity must be greater than 0.`);
        if (!item.unitRate || Number(item.unitRate) <= 0) issues.push(`Item #${idx + 1}: Unit selling rate must be greater than ₹0.`);
      });
    }

    if (order.totalInvoiceAmount !== undefined && Number(order.totalInvoiceAmount) < 0) {
      issues.push('Total invoice amount cannot be negative.');
    }

    if (order.customerAdvanceReceived && Number(order.customerAdvanceReceived) > Number(order.totalInvoiceAmount || 0)) {
      issues.push('Advance received cannot exceed the total invoice amount.');
    }

    if (order.status === 'dispatched' && !order.lrNumber) {
      warnings.push('Order is marked dispatched but lacks a Lorry Receipt (LR) number.');
    }

    if (order.customerAdvanceReceived > 0 && !(order.advancePaymentMode || order.customerAdvanceMode)) {
      warnings.push('Advance received recorded without specifying payment mode.');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  validateInvoice(order) {
    const issues = [];
    const warnings = [];

    if (!order) {
      issues.push('Invoice / Order document data is missing.');
      return { isValid: false, issues, warnings };
    }

    const profile = this.data.businessProfile || {};
    const sellerStateCode = profile.stateCode || (profile.gstin ? profile.gstin.substring(0, 2) : '');
    const sellerGstin = (profile.gstin || '').trim();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

    // 1. Seller statutory verification
    if (!profile.tradeName && !profile.legalName) {
      issues.push('Seller legal/trade name is missing in Business Profile.');
    }
    if (!sellerGstin) {
      issues.push('Seller GSTIN is not set. Add it in Business Profile before issuing a tax invoice.');
    } else if (!gstinRegex.test(sellerGstin)) {
      warnings.push(`Seller GSTIN "${sellerGstin}" does not match standard 15-character GSTIN format.`);
    }

    // 2. Invoice identifiers & date
    if (!order.invoiceNumber && !order.id) {
      issues.push('Document identifier (Invoice Number / Order ID) is required.');
    }
    if (!order.date) {
      issues.push('Document date is missing.');
    }

    // 3. Buyer / Consignee verification
    const retailer = (this.data.contacts || []).find(c => c.id === order.retailerId) || {};
    const buyerName = order.retailerName || retailer.name;
    if (!buyerName) {
      issues.push('Buyer / Consignee party name is missing.');
    }
    const buyerGstin = (retailer.gstin || order.retailerGstin || '').trim();
    if (buyerGstin) {
      if (!gstinRegex.test(buyerGstin)) {
        warnings.push(`Buyer GSTIN "${buyerGstin}" does not conform to the 15-digit GSTIN standard.`);
      }
    } else if (Number(order.totalInvoiceAmount || 0) > 50000 && (order.documentType === 'TAX INVOICE' || !order.documentType)) {
      warnings.push('Buyer GSTIN is missing for an invoice exceeding ₹50,000 (Statutory requirement for B2B e-invoicing).');
    }

    // 4. Line Items verification
    const items = order.items || [];
    if (!Array.isArray(items) || items.length === 0) {
      issues.push('At least one product line item is required.');
    } else {
      items.forEach((item, idx) => {
        const lineNum = idx + 1;
        const itemName = item.name || item.shortName || `Item #${lineNum}`;
        if (!item.name && !item.shortName) {
          issues.push(`Line #${lineNum}: Product description is missing.`);
        }
        if (!item.quantity || Number(item.quantity) <= 0) {
          issues.push(`Line #${lineNum} (${itemName}): Quantity must be greater than 0.`);
        }
        if (item.unitRate === undefined || item.unitRate === null || Number(item.unitRate) <= 0) {
          issues.push(`Line #${lineNum} (${itemName}): Unit rate must be greater than ₹0.`);
        }
        const hsn = item.hsn || item.hsnCode;
        if (!hsn) {
          warnings.push(`Line #${lineNum} (${itemName}): Missing HSN / SAC code (mandatory on GST tax invoices).`);
        }
      });
    }

    // 5. Place of Supply (POS) and Tax Rules
    const buyerStateCode = retailer.stateCode || order.retailerStateCode || (buyerGstin ? buyerGstin.substring(0, 2) : '');
    if (sellerStateCode && buyerStateCode) {
      const isInterstate = String(sellerStateCode) !== String(buyerStateCode);
      const hasIgst = Number(order.igstAmount || 0) > 0 || Number(order.igstRate || 0) > 0;
      const hasCgstSgst = Number(order.cgstAmount || 0) > 0 || Number(order.sgstAmount || 0) > 0;

      if (isInterstate && hasCgstSgst && !hasIgst) {
        issues.push(`Place of Supply mismatch: Seller state code (${sellerStateCode}) vs Buyer state code (${buyerStateCode}) is Inter-State, but CGST/SGST was applied instead of IGST.`);
      } else if (!isInterstate && hasIgst && !hasCgstSgst) {
        issues.push(`Place of Supply mismatch: Seller state code (${sellerStateCode}) vs Buyer state code (${buyerStateCode}) is Intra-State, but IGST was applied instead of CGST + SGST.`);
      }

      if (hasCgstSgst) {
        const cgstAmt = Number(order.cgstAmount || 0);
        const sgstAmt = Number(order.sgstAmount || 0);
        if (Math.abs(cgstAmt - sgstAmt) > 0.05) {
          issues.push(`CGST amount (₹${cgstAmt.toFixed(2)}) and SGST amount (₹${sgstAmt.toFixed(2)}) must be equal for intra-state supply.`);
        }
      }
    }

    // 6. Mathematical Consistency
    if (order.totalInvoiceAmount !== undefined && Number(order.totalInvoiceAmount) < 0) {
      issues.push('Total invoice amount cannot be negative.');
    }
    if (Number(order.customerAdvanceReceived || 0) > Number(order.totalInvoiceAmount || 0)) {
      issues.push(`Customer advance received (₹${order.customerAdvanceReceived}) exceeds total invoice amount (₹${order.totalInvoiceAmount}).`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  validateCurrentInvoice(forceModal = false, onProceed = null) {
    const order = this.currentInvoiceOrder || this.invoiceDraftData;
    if (!order) {
      this.showToast('No active invoice selected to validate.');
      return false;
    }

    const validation = this.validateInvoice(order);
    if (!validation.isValid || validation.warnings.length > 0 || forceModal) {
      this.openValidationModal(
        `Statutory Pre-Flight Checklist: ${order.invoiceNumber || order.id || 'Invoice'}`,
        validation,
        onProceed
      );
      return validation.isValid;
    }

    if (typeof onProceed === 'function') {
      onProceed();
    }
    return true;
  }

  validatePayment(payment) {
    const issues = [];
    const warnings = [];

    if (!payment) {
      issues.push('Payment object is missing.');
      return { isValid: false, issues, warnings };
    }

    if (!payment.amount || Number(payment.amount) <= 0) issues.push('Payment amount must be greater than ₹0.');
    if (!payment.partyName) issues.push('Party Name / Counterparty is required.');
    if (!payment.mode) issues.push('Payment mode is required (e.g. UPI, NEFT, Cheque, Cash).');

    if (['NEFT', 'RTGS', 'UPI'].includes(payment.mode) && payment.amount >= 25000 && !payment.utr) {
      warnings.push('Electronic transfer over ₹25,000 without a recorded UTR / Reference Number.');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  openValidationModal(title, { issues = [], warnings = [] }, onProceed = null) {
    const modal = document.getElementById('document-validation-modal');
    const titleEl = document.getElementById('validation-modal-title');
    const body = document.getElementById('validation-checklist-body');
    const proceedBtn = document.getElementById('validation-proceed-btn');

    if (titleEl) titleEl.textContent = title;

    if (body) {
      let html = '';
      if (issues.length > 0) {
        html += `
          <div class="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/30 p-4 space-y-2">
            <div class="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-xs uppercase tracking-wider">
              <i data-lucide="alert-octagon" class="w-4 h-4"></i>
              <span>${tfEscapeHtml(issues.length)} Critical Issue(s) Blocking Document Issuance</span>
            </div>
            <ul class="list-disc list-inside space-y-1 text-xs text-rose-800 dark:text-rose-300">
              ${issues.map(i => `<li>${tfEscapeHtml(i)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      if (warnings.length > 0) {
        html += `
          <div class="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-2">
            <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
              <i data-lucide="alert-triangle" class="w-4 h-4"></i>
              <span>${tfEscapeHtml(warnings.length)} Compliance Warning(s)</span>
            </div>
            <ul class="list-disc list-inside space-y-1 text-xs text-amber-800 dark:text-amber-300">
              ${warnings.map(w => `<li>${tfEscapeHtml(w)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      if (issues.length === 0 && warnings.length === 0) {
        html += `
          <div class="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 p-6 text-center space-y-2">
            <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto"></i>
            <div class="font-bold text-sm text-emerald-800 dark:text-emerald-300">All Statutory & Math Validations Passed!</div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Document complies with GST rules, HSN standards, and commercial ledger tolerances.</p>
          </div>
        `;
      }
      body.innerHTML = html;
    }

    if (proceedBtn) {
      if (issues.length > 0) {
        proceedBtn.disabled = true;
        proceedBtn.className = 'btn-tactile px-5 py-2 text-xs font-extrabold rounded-lg bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed';
      } else {
        proceedBtn.disabled = false;
        proceedBtn.className = 'btn-tactile px-5 py-2 text-xs font-extrabold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2';
        proceedBtn.onclick = () => {
          this.closeValidationModal();
          if (typeof onProceed === 'function') onProceed();
        };
      }
    }

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeValidationModal() {
    const modal = document.getElementById('document-validation-modal');
    if (modal) modal.classList.add('hidden');
  }
});
