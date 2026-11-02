// TradeFlow: WhatsApp messages. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ================= SUGGESTION 4: 1-CLICK FORMATTED WHATSAPP DISPATCHES ================= */
  openWhatsAppDispatchModal(config = {}) {
    this.activeWhatsAppConfig = config;
    const modal = document.getElementById('whatsapp-dispatch-modal');
    if (!modal) return;

    const partyInput = document.getElementById('wa-party-name');
    const phoneInput = document.getElementById('wa-phone-number');

    if (partyInput) partyInput.value = config.partyName || '';
    if (phoneInput) phoneInput.value = config.phone || '';

    this.switchWhatsAppTemplate(config.type || 'receipt');
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeWhatsAppDispatchModal() {
    const modal = document.getElementById('whatsapp-dispatch-modal');
    if (modal) modal.classList.add('hidden');
  }

  switchWhatsAppTemplate(type) {
    this.currentWhatsAppTemplateType = type;
    document.querySelectorAll('.wa-tpl-btn').forEach(b => {
      b.className = 'wa-tpl-btn py-1.5 px-2 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300';
    });

    const activeBtn = document.getElementById(`wa-tpl-btn-${type}`);
    if (activeBtn) {
      activeBtn.className = 'wa-tpl-btn py-1.5 px-2 rounded-lg text-xs font-bold border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300';
    }

    const textarea = document.getElementById('wa-message-textarea');
    if (!textarea) return;

    const partyName = document.getElementById('wa-party-name')?.value || 'Valued Partner';
    const cfg = this.activeWhatsAppConfig || {};
    const d = cfg.data || {};

    let msg = '';
    if (type === 'receipt') {
      const amt = Number(d.amount) || 0;
      const words = this.convertNumberToIndianWords(amt);
      msg = `*PAID PAYMENT RECEIPT*\n` +
            `🏢 *${this.data.businessProfile?.brandName || this.data.businessProfile?.legalName || 'TradeFlow'}*\n` +
            `----------------------------------------\n` +
            `👤 *Party*: ${partyName}\n` +
            `💰 *Amount*: ${this.formatCurrency(amt)} (${words.english})\n` +
            `💳 *Payment Mode*: ${d.mode || 'Bank Transfer / NEFT'}\n` +
            `🔢 *Ref / UTR*: ${d.utr || '—'}\n` +
            `📅 *Date*: ${this.formatDate(d.date || new Date())}\n` +
            `📦 *Order Ref*: ${d.orderRef || 'Consignment Account'}\n` +
            `----------------------------------------\n` +
            `_This is a verified computer-generated receipt._\n` +
            `_Thank you for your business!_`;
    } else if (type === 'dispatch') {
      msg = `*CONSIGNMENT DISPATCH NOTICE*\n` +
            `🏢 *${this.data.businessProfile?.brandName || this.data.businessProfile?.legalName || 'TradeFlow'}*\n` +
            `----------------------------------------\n` +
            `📦 *Order No*: ${d.orderId || '—'}\n` +
            `👤 *Buyer*: ${partyName}\n` +
            `🚚 *Vehicle No*: ${d.vehicleNo || ''}\n` +
            `👨‍✈️ *Driver*: ${[d.driverName, d.driverPhone].filter(Boolean).join(' · ') || '—'}\n` +
            `📄 *Bilty / LR No*: ${d.lrNumber || ''}\n` +
            `📦 *Consignment*: ${d.items || '—'}\n` +
            `----------------------------------------\n` +
            `_Consignment in transit. Please arrange unloading upon arrival._`;
    } else if (type === 'reminder') {
      const bal = Number(d.balance) || 0;
      const bp = this.data.businessProfile || {};
      msg = `*PAYMENT STATEMENT REMINDER*\n` +
            `🏢 *${this.data.businessProfile?.brandName || this.data.businessProfile?.legalName || 'TradeFlow'}*\n` +
            `----------------------------------------\n` +
            `👤 *Party*: ${partyName}\n` +
            `⚖️ *Pending Balance*: ${this.formatCurrency(bal)} (${this.convertNumberToIndianWords(bal).english})\n` +
            `📅 *As of*: ${this.formatDate(new Date())}\n` +
            `🏦 *Bank Account for Transfer*:\n` +
            `   A/c: ${bp.accountNumber || 'Not set in Business Profile'}${bp.bankName ? ` (${bp.bankName})` : ''}\n` +
            `   IFSC: ${bp.ifsc || 'Not set'}\n` +
            (bp.upiId ? `   UPI: ${bp.upiId}\n` : '') +
            `----------------------------------------\n` +
            `_Kindly arrange the remittance at your earliest convenience._`;
    }

    textarea.value = msg;
  }

  launchWhatsApp() {
    const phoneInput = document.getElementById('wa-phone-number');
    const textarea = document.getElementById('wa-message-textarea');
    let phone = (phoneInput?.value || '').replace(/[^0-9]/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const text = textarea?.value || '';

    if (!text) {
      this.showToast('Message text cannot be empty.');
      return;
    }

    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}`;
    window.open(url, '_blank');
    this.closeWhatsAppDispatchModal();
    this.showToast('📱 WhatsApp opened successfully.');
  }

  copyWhatsAppText() {
    const textarea = document.getElementById('wa-message-textarea');
    if (!textarea || !textarea.value) return;
    navigator.clipboard.writeText(textarea.value).then(() => {
      this.showToast('📋 WhatsApp message copied to clipboard!');
    }).catch(() => {
      this.showToast('Copied text!');
    });
  }

  // Payment receipt/disbursement message to the partner's own WhatsApp number (matched by id, else exact name).
  findPaymentContact(payment) {
    const name = String(payment.partyName || '').trim().toLowerCase();
    return (this.data.contacts || []).find(c => (payment.partyId && c.id === payment.partyId) || (name && String(c.name || '').trim().toLowerCase() === name)) || null;
  }

  sendPaymentWhatsApp(payment) {
    if (!payment) return;
    const contact = this.findPaymentContact(payment);
    this.openWhatsAppDispatchModal({
      partyName: payment.partyName,
      phone: (contact && (contact.whatsappPhone || contact.phone)) || '',
      type: 'receipt',
      data: {
        amount: payment.amount,
        mode: payment.mode,
        utr: payment.utr,
        date: payment.date,
        orderRef: payment.orderRef
      }
    });
  }
});
