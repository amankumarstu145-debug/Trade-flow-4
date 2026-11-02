// TradeFlow: Factory and packaging purchase orders. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // ================= PICKLE FACTORY PO & JOB WORK ENGINE =================

  openFactoryPOModal(orderId) {
    const modal = document.getElementById('factory-po-modal');
    if (!modal) return;

    let order = null;
    if (orderId) {
      order = this.data.orders.find(o => o.id === orderId);
    }
    if (!order && this.selectedOrder) {
      order = this.selectedOrder;
    }
    if (!order && this.data.orders.length > 0) {
      order = this.data.orders[0];
    }

    if (!order) {
      this.showToast('No order selected to generate factory PO.');
      return;
    }

    this.currentFactoryPOOrder = order;
    this.renderFactoryPO(order);

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeFactoryPOModal() {
    const modal = document.getElementById('factory-po-modal');
    if (modal) modal.classList.add('hidden');
  }

  renderFactoryPO(order) {
    const container = document.getElementById('factory-po-content-container');
    if (!container) return;

    // Only the manufacturer chosen on this order; never substitute another factory.
    const mfg = this.data.contacts.find(c => c.id === order.manufacturerId) || { name: order.manufacturerName || 'Manufacturer not set', contactPerson: '', phone: '', billingAddress: '', gstin: '' };

    const retailer = this.data.contacts.find(c => c.id === order.retailerId) || {
      name: order.retailerName,
      brandName: order.retailerName || ''
    };

    const brandLabel = retailer.brandName || retailer.name;
    const poNumber = `JOB-PO-${order.invoiceNumber.replace('INV-', '')}`;
    const batchCode = `LOT-${order.date.replace(/-/g, '')}-A`;

    let totalCases = 0;
    let totalJars = 0;
    let totalWeightKg = 0;

    const itemsRows = (order.items || []).map((item, idx) => {
      const cases = item.cases || Math.ceil(item.quantity / (item.casePack || 24));
      const casePack = item.casePack || this.casePackConfig[item.packSize] || this.config().defaultCasePack;
      const jars = item.quantity;
      const weightPerUnit = (item.variant || '').includes('1kg') ? 1.0 : ((item.variant || '').includes('5kg') ? 5.0 : 0.5);
      const lineWeight = jars * weightPerUnit;

      totalCases += cases;
      totalJars += jars;
      totalWeightKg += lineWeight;

      return `
        <tr class="border-b border-slate-200">
          <td class="py-2.5 px-3 text-center font-mono-num text-slate-500">${tfEscapeHtml(idx + 1)}</td>
          <td class="py-2.5 px-3">
            <span class="font-bold text-slate-900 block">${tfEscapeHtml(item.shortName || item.name)}</span>
            <span class="text-xs text-slate-500">${tfEscapeHtml(item.name)}</span>
          </td>
          <td class="py-2.5 px-3 font-semibold text-slate-700">${tfEscapeHtml(item.variant)}</td>
          <td class="py-2.5 px-3 text-right font-mono-num font-bold text-amber-700">${tfEscapeHtml(cases)} cs</td>
          <td class="py-2.5 px-3 text-center font-mono-num text-slate-600">${tfEscapeHtml(casePack)}</td>
          <td class="py-2.5 px-3 text-right font-mono-num font-black text-slate-900">${tfEscapeHtml(jars.toLocaleString('en-IN'))}</td>
          <td class="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-700">${tfEscapeHtml(jars.toLocaleString('en-IN'))} pcs</td>
          <td class="py-2.5 px-3 text-right font-mono-num font-semibold text-slate-700">${tfEscapeHtml(jars.toLocaleString('en-IN'))} sets</td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div id="factory-po-print-area" class="max-w-4xl mx-auto bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-slate-300 text-slate-900 text-xs font-sans">
        
        <!-- Header Banner -->
        <div class="flex items-start justify-between border-b-2 border-slate-900 pb-5 mb-5">
          <div>
            <span class="px-2.5 py-1 text-xs font-black uppercase tracking-wider bg-slate-900 text-amber-400 rounded">
              Rule 55 CGST Rules • Job Work Production Order
            </span>
            <h1 class="text-2xl font-black tracking-tight text-slate-900 mt-2">${tfEscapeHtml(this.data.businessProfile.legalName)}</h1>
            <p class="text-xs text-slate-600">${tfEscapeHtml(this.data.businessProfile.address)}, ${tfEscapeHtml(this.data.businessProfile.city)} - ${tfEscapeHtml(this.data.businessProfile.pincode)}</p>
            <p class="text-xs text-slate-600 font-mono-num mt-0.5">GSTIN: <span class="font-bold text-slate-900">${tfEscapeHtml(this.data.businessProfile.gstin)}</span> | FSSAI: ${tfEscapeHtml(this.data.businessProfile.fssai)}</p>
          </div>
          <div class="text-right">
            <div class="px-3 py-1 bg-amber-100 border border-amber-300 rounded-lg inline-block text-right mb-2">
              <span class="text-xs uppercase font-bold text-amber-800 block">Private Label Brand:</span>
              <span class="text-base font-black text-amber-950 uppercase">${tfEscapeHtml(brandLabel)}</span>
            </div>
            <p class="text-xs font-bold text-slate-700">Job PO #: <span class="font-mono-num text-slate-950 font-black">${tfEscapeHtml(poNumber)}</span></p>
            <p class="text-xs text-slate-500">Date: <span class="font-mono-num font-semibold">${tfEscapeHtml(order.date)}</span></p>
            <p class="text-xs text-slate-500">Batch Code: <span class="font-mono-num font-bold text-emerald-700">${tfEscapeHtml(batchCode)}</span></p>
          </div>
        </div>

        <!-- Stakeholders Grid -->
        <div class="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200 mb-6">
          <div>
            <span class="text-xs uppercase font-bold tracking-wider text-slate-500 block mb-1">Manufacturing Unit (Processor):</span>
            <h4 class="text-sm font-bold text-slate-900">${tfEscapeHtml(mfg.name)}</h4>
            <p class="text-xs text-slate-700 mt-0.5">Attn: <span class="font-bold">${tfEscapeHtml(mfg.contactPerson || '')}</span> (${tfEscapeHtml(mfg.phone)})</p>
            <p class="text-xs text-slate-600 mt-0.5">${tfEscapeHtml(mfg.billingAddress)}</p>
            <p class="text-xs font-mono-num text-slate-700 mt-0.5">GSTIN: <strong>${tfEscapeHtml(mfg.gstin)}</strong></p>
          </div>
          <div>
            <span class="text-xs uppercase font-bold tracking-wider text-slate-500 block mb-1">Contract Principal & Dispatched To:</span>
            <h4 class="text-sm font-bold text-slate-900">${tfEscapeHtml(retailer.name)}</h4>
            <p class="text-xs text-slate-700 mt-0.5">Brand Identity: <span class="font-bold text-amber-900">${tfEscapeHtml(brandLabel)}</span></p>
            <p class="text-xs text-slate-600 mt-0.5">${tfEscapeHtml(retailer.billingAddress || retailer.shippingAddress || 'Direct Factory Dispatch')}</p>
            <p class="text-xs font-mono-num text-slate-700 mt-0.5">Order Ref: <strong>${tfEscapeHtml(order.invoiceNumber)}</strong></p>
          </div>
        </div>

        <!-- Items Table -->
        <div class="overflow-hidden border border-slate-300 rounded-xl mb-6">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-900 text-white font-bold uppercase tracking-wider text-xs">
                <th class="py-2.5 px-3 text-center w-10">#</th>
                <th class="py-2.5 px-3 min-w-[180px]">Product</th>
                <th class="py-2.5 px-3 w-28">Pack Spec</th>
                <th class="py-2.5 px-3 text-right w-24">Cases</th>
                <th class="py-2.5 px-3 text-center w-20">Pack</th>
                <th class="py-2.5 px-3 text-right w-28">Total Jars</th>
                <th class="py-2.5 px-3 text-right w-28">Caps & Wads</th>
                <th class="py-2.5 px-3 text-right w-28">Labels Req.</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${itemsRows}
            </tbody>
            <tfoot>
              <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <td colspan="3" class="py-3 px-3 uppercase text-right">Batch Lot Totals:</td>
                <td class="py-3 px-3 text-right font-mono-num text-amber-800 font-black">${tfEscapeHtml(totalCases)} Cases</td>
                <td class="py-3 px-3 text-center text-slate-400">—</td>
                <td class="py-3 px-3 text-right font-mono-num text-slate-950 font-black">${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} Jars</td>
                <td class="py-3 px-3 text-right font-mono-num">${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} pcs</td>
                <td class="py-3 px-3 text-right font-mono-num">${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} sets</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Compounding & Production Lot Instructions -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div class="p-4 bg-amber-50/60 rounded-xl border border-amber-200">
            <h5 class="text-xs font-bold uppercase tracking-wider text-amber-900 mb-2 flex items-center gap-1.5">
              <i data-lucide="shield-alert" class="w-4 h-4 text-amber-700"></i>
              <span>Processing & Quality Directives:</span>
            </h5>
            <ul class="list-disc list-inside space-y-1 text-slate-700 text-xs leading-relaxed">
              <li><strong>Mustard Oil Compounding:</strong> 100% Pure Kachi Ghani Mustard Oil. Minimum 18% oil ratio in all jars.</li>
              <li><strong>Hermetic Sealing:</strong> Induction wad seal must be applied airtight on each PET and Glass jar prior to capping.</li>
              <li><strong>Batch Printing:</strong> Inkjet print Batch: <code class="font-mono font-bold">${tfEscapeHtml(batchCode)}</code>, Mfg Date: ${tfEscapeHtml(order.date)}, and Retail MRP on closure edge.</li>
              <li><strong>Master Packing:</strong> 5-ply export quality corrugated cartons with heavy-duty PVC strapping.</li>
            </ul>
          </div>

          <div class="p-4 bg-blue-50/60 rounded-xl border border-blue-200">
            <h5 class="text-xs font-bold uppercase tracking-wider text-blue-900 mb-2 flex items-center gap-1.5">
              <i data-lucide="package" class="w-4 h-4 text-blue-700"></i>
              <span>Packaging Materials Dispatch:</span>
            </h5>
            <p class="text-slate-700 text-xs leading-relaxed mb-2">
              Packaging supplier <strong>Apex Polymer & Flexo-Pack Ltd</strong> (Vapi/Daman) is dispatching the following materials directly to your Rajkot unit:
            </p>
            <ul class="list-disc list-inside space-y-0.5 text-slate-700 text-xs">
              <li><strong>PET Jars (500g):</strong> ${tfEscapeHtml((order.items.filter(i => (i.packSize||'').includes('500g')).reduce((s,i)=>s+i.quantity,0)).toLocaleString('en-IN'))} units + gold caps & wads.</li>
              <li><strong>Glass Jars (1kg):</strong> ${tfEscapeHtml((order.items.filter(i => (i.packSize||'').includes('1kg')).reduce((s,i)=>s+i.quantity,0)).toLocaleString('en-IN'))} units + metal lug closures.</li>
              <li><strong>Printed Labels:</strong> '${tfEscapeHtml(brandLabel)}' brand front & back metallic stickers.</li>
            </ul>
          </div>
        </div>

        <!-- Signatures & Authorization -->
        <div class="pt-6 border-t-2 border-slate-200 flex justify-between items-end text-center">
          <div class="w-48">
            <div class="border-b border-slate-400 mb-1 pb-8"></div>
            <p class="text-xs font-bold text-slate-800">Job Worker Acceptance</p>
            <p class="text-xs text-slate-500">For ${tfEscapeHtml(mfg.name)}</p>
          </div>
          <div class="text-xs text-slate-400 italic">
            Computer generated Job Work Challan under Rule 55 • Goods in Job Work Transit
          </div>
          <div class="w-52">
            <div class="border-b border-slate-400 mb-1 pb-8"></div>
            <p class="text-xs font-bold text-slate-800">Authorized Signatory</p>
            <p class="text-xs text-slate-500">For ${tfEscapeHtml(this.data.businessProfile.legalName)}</p>
          </div>
        </div>

      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  sendFactoryPOWhatsApp() {
    const order = this.currentFactoryPOOrder;
    if (!order) {
      this.showToast('Please select an order first.');
      return;
    }

    const mfg = this.data.contacts.find(c => c.id === order.manufacturerId) || { name: order.manufacturerName || 'Manufacturer not set', phone: '' };

    const retailer = this.data.contacts.find(c => c.id === order.retailerId) || {
      name: order.retailerName,
      brandName: order.retailerName || ''
    };

    const brandLabel = retailer.brandName || retailer.name;
    const poNumber = `JOB-PO-${order.invoiceNumber.replace('INV-', '')}`;
    const batchCode = `LOT-${order.date.replace(/-/g, '')}-A`;

    let totalCases = 0;
    let totalJars = 0;

    const itemsText = (order.items || []).map(i => {
      const cases = i.cases || Math.ceil(i.quantity / (i.casePack || 24));
      totalCases += cases;
      totalJars += i.quantity;
      return `• ${i.shortName || i.name} (${i.packSize || i.variant}): ${cases} Cases (${i.quantity.toLocaleString('en-IN')} Jars)`;
    }).join('\n');

    let msg = `*JOB WORK PRODUCTION ORDER (PO)*\n`;
    msg += `To: ${mfg.contactPerson || mfg.name || 'Sir/Madam'} (${mfg.name})\n`;
    msg += `From: ${this.data.businessProfile.brandName} (${this.data.businessProfile.legalName})\n`;
    msg += `PO Ref: *${poNumber}* | Date: ${order.date}\n`;
    msg += `Brand / Label: *${brandLabel}*\n\n`;
    msg += `Dear ${mfg.contactPerson || mfg.name || 'Sir/Madam'}, please schedule bottling for the following production batch:\n\n`;
    msg += `*VARIETY & CASE BREAKDOWN:*\n`;
    msg += `${itemsText}\n\n`;
    msg += `*TOTAL BATCH:* *${totalCases} Master Cases* | *${totalJars.toLocaleString('en-IN')} Jars*\n`;
    msg += `*BATCH CODE:* ${batchCode}\n\n`;
    msg += `*KEY SPECIFICATIONS:*\n`;
    msg += `1. 100% Kachi Ghani Mustard Oil compounding (min 18% oil ratio).\n`;
    msg += `2. Firm induction wad sealing on all jars before capping.\n`;
    msg += `3. Jars, printed '${brandLabel}' labels, and closures are being dispatched directly to your unit by Apex Polymer.\n`;
    msg += `4. Target Dispatch: Ready within 7-10 days.\n\n`;
    msg += `Kindly confirm batch acceptance. Advance processing payment initiated via NEFT.`;

    const cleanPhone = (mfg.phone || '').replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  sendPackagingPOWhatsApp() {
    const order = this.currentFactoryPOOrder;
    if (!order) return;

    const retailer = this.data.contacts.find(c => c.id === order.retailerId) || {
      name: order.retailerName,
      brandName: order.retailerName || ''
    };
    const brandLabel = retailer.brandName || retailer.name;

    // Addressed to this order's packaging vendor, delivering to this order's manufacturer.
    const vendor = this.data.contacts.find(c => c.id === order.packagingVendorId) || { name: order.packagingVendorName || '', contactPerson: '', phone: '' };
    const factory = this.data.contacts.find(c => c.id === order.manufacturerId) || { name: order.manufacturerName || '', billingAddress: '' };
    const phone = String(vendor.phone || '').replace(/\D/g, '').replace(/^0/, '');
    if (!vendor.name || !phone) {
      this.showToast('Add a packaging vendor with a phone number to this order first.');
      return;
    }
    let msg = `*PACKAGING SUPPLY ORDER*\n`;
    msg += `To: ${[vendor.contactPerson, vendor.name].filter(Boolean).join(' – ')}\n`;
    msg += `From: ${this.config().brand}\n`;
    msg += `For Brand: *${brandLabel}*\n\n`;
    msg += `Please dispatch packaging for the following to ${factory.name || 'our manufacturer'}:\n\n`;
    (order.items || []).forEach(item => {
      msg += `• ${item.name}${item.packSize || item.variant ? ` (${item.packSize || item.variant})` : ''}: *${Number(item.quantity || 0).toLocaleString('en-IN')} units* with closures and labels\n`;
    });
    if (factory.billingAddress || factory.shippingAddress) msg += `\nDispatch to: ${factory.name}, ${factory.shippingAddress || factory.billingAddress}.\n`;
    msg += `Kindly share the LR copy once loaded.`;

    const url = `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  printFactoryPO() {
    const sheet = document.getElementById('factory-po-print-area');
    if (!sheet) {
      window.print();
      return;
    }

    let printFrame = document.getElementById('factory-po-print-iframe');
    if (printFrame) printFrame.remove();

    printFrame = document.createElement('iframe');
    printFrame.id = 'factory-po-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    const poHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Manufacturer Production PO & Job Work Slip</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page {
            size: A4 portrait;
            margin: 4mm 5mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          }
          #factory-po-print-area {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 4mm 5mm !important;
            border: 1px solid #1e293b !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
          }
        </style>
      </head>
      <body class="bg-white">
        ${tfEscapeHtml(sheet.outerHTML)}
      </body>
      </html>
    `;

    printFrame.srcdoc = poHtml;
    document.body.appendChild(printFrame);

    const triggerPrint = () => {
      try {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
      } catch (e) {
        console.warn('Iframe print failed, falling back to window.print()', e);
        window.print();
      }
    };

    printFrame.onload = () => {
      setTimeout(triggerPrint, 250);
    };
    // Fallback if onload already fired
    setTimeout(triggerPrint, 450);
  }
});
