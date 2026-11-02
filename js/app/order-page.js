// TradeFlow: Workspace tabs, order page and contact page. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // ================= WORKSPACE TABS & NEVER-GET-LOST NAVIGATION ENGINE =================

  renderWorkspaceTabs() {
    const bar = document.getElementById('workspace-tabs-bar');
    if (!bar) return;

    const tabsHtml = this.openTabs.map(tab => {
      const isActive = tab.id === this.activeWorkspaceTab;
      return `
        <div 
          onclick="app.activateWorkspaceTab('${tfEscapeHtml(tfEscapeJs(tab.id))}')"
          class="workspace-tab-item ${tfEscapeHtml(isActive ? 'active' : '')} group"
          title="${tfEscapeHtml(tab.title)}"
        >
          <i data-lucide="${tfEscapeHtml(tab.icon || 'file-text')}" class="w-3.5 h-3.5 ${tfEscapeHtml(isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300')}"></i>
          <span class="truncate max-w-[170px] text-xs font-semibold">${tfEscapeHtml(tab.title)}</span>
          ${tab.closeable ? `
            <button 
              type="button" 
              onclick="event.stopPropagation(); app.closeWorkspaceTab('${tfEscapeHtml(tfEscapeJs(tab.id))}', event)" 
              class="workspace-tab-close" 
              title="Close Tab"
            >
              <i data-lucide="x" class="w-3 h-3"></i>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    const rightControls = `
      <div class="flex-1 min-w-[16px]"></div>
      <div class="flex items-center gap-2 pb-1 shrink-0">
        <button 
          id="workspace-tab-whatsapp-templates-btn"
          type="button" 
          onclick="app.openStudioMagicDrawer()" 
          class="btn-tactile h-8 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/80 shadow-2xs flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-0.5 group cursor-pointer"
          title="WhatsApp Quick Messenger & Live Templates"
        >
          <i data-lucide="message-square" class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform"></i>
          <span>WhatsApp</span>
        </button>

        <button 
          id="workspace-tab-profit-calc-btn"
          type="button" 
          onclick="app.openProfitCalculatorModal()" 
          class="btn-tactile h-8 px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800/80 shadow-2xs flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-0.5 group cursor-pointer"
          title="Smart Trade Margin & Profit Calculator"
        >
          <i data-lucide="calculator" class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform"></i>
          <span>Calculator</span>
        </button>

        <button 
          id="workspace-tab-invoice-studio-btn"
          type="button" 
          onclick="app.openInvoiceStudioModal()" 
          class="btn-tactile h-8 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 shadow-2xs flex items-center gap-1.5 transition-all duration-150 hover:-translate-y-0.5 group cursor-pointer"
          title="Smart GST Invoice & Billing Studio"
        >
          <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform"></i>
          <span>Invoice Studio</span>
        </button>

        ${this.openTabs.length > 1 ? `
          <button 
            type="button" 
            onclick="app.closeAllAuxTabs()" 
            class="text-xs font-medium text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 px-2 py-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            title="Close all inspection tabs"
          >
            Close tabs
          </button>
        ` : ''}
      </div>
    `;

    bar.innerHTML = tabsHtml + rightControls;
    if (window.lucide) window.lucide.createIcons();
  }

  closeAllAuxTabs() {
    this.openTabs = this.openTabs.filter(t => !t.closeable);
    this.navigationStack = [];
    this.activateWorkspaceTab('tab-orders');
  }

  activateWorkspaceTab(tabId) {
    const tab = this.openTabs.find(t => t.id === tabId);
    if (!tab) return;

    this.activeWorkspaceTab = tab.id;

    if (tab.type === 'orders') {
      this.activeTab = 'orders';
      this.activeOrderId = null;
      this.activeContactId = null;
    } else if (tab.type === 'order') {
      this.activeTab = 'order-detail';
      this.activeOrderId = tab.orderId;
    } else if (tab.type === 'contact') {
      this.activeTab = 'contact-detail';
      this.activeContactId = tab.contactId;
    } else if (tab.type === 'order-edit') {
      this.activeTab = 'order-edit';
      this.activeEditOrderId = tab.orderId;
    } else {
      this.activeTab = tab.type;
    }

    this.renderWorkspaceTabs();
    this.updateSidebarUI();
    this.renderActiveView();

    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;
  }

  closeWorkspaceTab(tabId, event) {
    if (event) event.stopPropagation();
    const tabIndex = this.openTabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tabToClose = this.openTabs[tabIndex];
    if (!tabToClose.closeable) return;

    if (tabToClose.type === 'order-edit') {
      this.unmountOrderEditCockpit();
      this.editingOrderId = null;
      this.activeEditOrderId = null;
    }

    this.openTabs.splice(tabIndex, 1);

    if (this.activeWorkspaceTab === tabId) {
      const nextTab = this.openTabs[Math.max(0, tabIndex - 1)] || this.openTabs[0];
      this.activateWorkspaceTab(nextTab.id);
    } else {
      this.renderWorkspaceTabs();
    }
  }

  getCurrentViewLabel() {
    if (this.activeTab === 'orders') return 'Orders Pipeline';
    if (this.activeTab === 'order-detail' && this.activeOrderId) {
      const o = this.data.orders.find(x => x.id === this.activeOrderId);
      return o ? `Order ${o.invoiceNumber}` : 'Order Detail';
    }
    if (this.activeTab === 'contact-detail' && this.activeContactId) {
      const c = this.data.contacts.find(x => x.id === this.activeContactId);
      return c ? c.name : 'Partner Hub';
    }
    if (this.activeTab === 'manufacturers') return 'Manufacturers';
    if (this.activeTab === 'packaging') return 'Packaging & Labels';
    if (this.activeTab === 'transport') return 'Logistics & Transport';
    if (this.activeTab === 'retailers') return 'Retailers & Buyers';
    if (this.activeTab === 'marketeers') return 'Sales Marketeers';
    if (this.activeTab === 'products') return 'Products Master';
    if (this.activeTab === 'profile') return 'Business Profile';
    return 'Dashboard';
  }

  navigateToOrderDetail(orderId) {
    this.openOrderDetailPage(orderId);
  }

  openOrderFormModal(prefill = null) {
    this.openNewOrderModal(prefill);
  }

  openOrderDetailPage(orderId, event) {
    if (event) {
      const target = event.target;
      if (target && (target.closest('a') || target.closest('input') || target.closest('select'))) {
        return;
      }
      const btn = target ? target.closest('button') : null;
      if (btn && !btn.innerText.includes('Inspect') && !btn.getAttribute('title')?.includes('Order') && !btn.classList.contains('btn-tactile')) {
        return;
      }
    }

    const order = this.findOrder(orderId);
    if (!order) return;

    const resolvedOrderId = order.id;

    if (this.activeTab !== 'order-detail' || this.activeOrderId !== resolvedOrderId) {
      this.navigationStack.push({
        tab: this.activeTab,
        workspaceTabId: this.activeWorkspaceTab,
        orderId: this.activeOrderId,
        contactId: this.activeContactId,
        title: this.getCurrentViewLabel()
      });
    }

    this.activeOrderId = resolvedOrderId;
    this.activeTab = 'order-detail';

    const tabId = `tab-order-${resolvedOrderId}`;
    let existingTab = this.openTabs.find(t => t.id === tabId);
    if (!existingTab) {
      existingTab = {
        id: tabId,
        type: 'order',
        orderId: orderId,
        title: `${order.invoiceNumber} (${order.retailerName})`,
        icon: 'file-text',
        closeable: true
      };
      this.openTabs.push(existingTab);
    }
    this.activeWorkspaceTab = tabId;

    this.renderWorkspaceTabs();
    this.updateSidebarUI();
    this.renderActiveView();

    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollTop = 0;
  }

  navigateToContactFromModal(contactId, fromModalId, refId) {
    if (!contactId) return;

    // 1. Close source modal so it doesn't float over the partner view
    if (fromModalId === 'order-payment-full-modal') {
      this.closeOrderPaymentFullModal();
    } else if (fromModalId === 'kpi-breakdown-modal') {
      this.closeKpiBreakdownModal();
    } else if (fromModalId === 'invoice-modal') {
      this.closeInvoiceModal();
    } else if (fromModalId === 'factory-po-modal') {
      this.closeFactoryPOModal();
    } else if (fromModalId === 'payment-modal') {
      this.closePaymentModal();
    }

    // 2. Track breadcrumb and modal state in navigation stack
    let title = 'Previous Window';
    if (fromModalId === 'order-payment-full-modal') {
      title = 'Order Inspection';
    } else if (fromModalId === 'kpi-breakdown-modal') {
      title = 'KPI Breakdown';
    }

    this.navigationStack.push({
      modal: fromModalId,
      refId: refId,
      tab: this.activeTab,
      workspaceTabId: this.activeWorkspaceTab,
      orderId: this.activeOrderId,
      contactId: this.activeContactId,
      title: title
    });

    // 3. Navigate cleanly to the partner dossier
    this.navigateToContact(contactId);
  }

  navigateToContact(contactId, viewMode = 'hub', targetSection = null) {
    if (!contactId) return;
    const contact = this.data.contacts.find(c => c.id === contactId);
    if (!contact) return;

    this.activeContactViewMode = viewMode || 'hub';
    this.activeContactTargetSection = targetSection;
    this.isDossierEditMode = false;

    if (this.activeTab !== 'contact-detail' || this.activeContactId !== contactId) {
      this.navigationStack.push({
        tab: this.activeTab,
        workspaceTabId: this.activeWorkspaceTab,
        orderId: this.activeOrderId,
        contactId: this.activeContactId,
        title: this.getCurrentViewLabel()
      });
    }

    this.activeContactId = contactId;
    this.activeTab = 'contact-detail';

    let icon = 'user';
    if (contact.role === 'manufacturer') icon = 'factory';
    else if (contact.role === 'packaging') icon = 'package';
    else if (contact.role === 'transporter') icon = 'truck';
    else if (contact.role === 'retailer') icon = 'building-2';
    else if (contact.role === 'marketeer') icon = 'user-check';

    const tabId = `tab-contact-${contactId}`;
    let existingTab = this.openTabs.find(t => t.id === tabId);
    if (!existingTab) {
      existingTab = {
        id: tabId,
        type: 'contact',
        contactId: contactId,
        title: contact.name,
        icon: icon,
        closeable: true
      };
      this.openTabs.push(existingTab);
    }
    this.activeWorkspaceTab = tabId;

    this.renderWorkspaceTabs();
    this.updateSidebarUI();
    this.renderActiveView();

    // Deep-link smooth scroll and temporary pulse highlight
    if (this.activeContactViewMode === 'hub' && targetSection && targetSection !== 'all') {
      setTimeout(() => {
        const secEl = document.getElementById(`hub-${targetSection}-section`);
        if (secEl) {
          secEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          secEl.classList.add('tf-section-highlight');
          setTimeout(() => secEl.classList.remove('tf-section-highlight'), 2500);
        }
      }, 120);
    } else {
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTop = 0;
    }
  }

  switchContactViewMode(mode) {
    this.activeContactViewMode = mode;
    this.isDossierEditMode = false;
    this.renderContactDetailView(this.activeContactId);
  }

  toggleDossierEditMode(show) {
    if (typeof show === 'boolean') {
      this.isDossierEditMode = show;
    } else {
      this.isDossierEditMode = !this.isDossierEditMode;
    }
    this.renderContactDetailView(this.activeContactId);
  }

  toggleDossierAiDrawer() {
    const drawer = document.getElementById('dossier-ai-filler-drawer');
    if (!drawer) return;
    drawer.classList.toggle('hidden');
    if (!drawer.classList.contains('hidden')) {
      const textInput = document.getElementById('dossier-ai-text-input');
      if (textInput) textInput.focus();
    }
    if (window.lucide) window.lucide.createIcons();
  }

  saveDossierForm(contactId) {
    const contact = (this.data.contacts || []).find(c => c.id === contactId);
    if (!contact) return;

    const nameVal = (document.getElementById('dossier-name')?.value || '').trim();
    const phoneVal = (document.getElementById('dossier-phone')?.value || '').trim();
    if (!nameVal || !phoneVal) {
      this.showToast('Company Name and Primary Phone are required.');
      return;
    }

    const mergeProp = (fieldId, propName) => {
      const el = document.getElementById(fieldId);
      if (el) {
        const val = el.value.trim();
        if (val) {
          contact[propName] = val;
        }
      }
    };

    contact.name = nameVal;
    contact.phone = phoneVal;

    mergeProp('dossier-brandName', 'brandName');
    mergeProp('dossier-contactPerson', 'contactPerson');
    mergeProp('dossier-designation', 'designation');
    mergeProp('dossier-altPhone', 'altPhone');
    mergeProp('dossier-email', 'email');
    mergeProp('dossier-paymentTerms', 'paymentTerms');
    mergeProp('dossier-gstin', 'gstin');
    mergeProp('dossier-pan', 'pan');
    mergeProp('dossier-fssai', 'fssai');
    if (contact.fssai) contact.fssaiNumber = contact.fssai;
    mergeProp('dossier-msme', 'msme');
    mergeProp('dossier-billingAddress', 'billingAddress');
    mergeProp('dossier-shippingAddress', 'shippingAddress');
    if (contact.billingAddress && !contact.address) contact.address = contact.billingAddress;

    // Bank coordinates
    if (!contact.bankDetails) contact.bankDetails = {};
    const mergeBank = (fieldId, propName) => {
      const el = document.getElementById(fieldId);
      if (el) {
        const val = el.value.trim();
        if (val) {
          contact.bankDetails[propName] = val;
          contact[propName] = val;
        }
      }
    };
    mergeBank('dossier-bankName', 'bankName');
    mergeBank('dossier-beneficiaryName', 'beneficiaryName');
    mergeBank('dossier-accountNumber', 'accountNumber');
    mergeBank('dossier-ifsc', 'ifsc');
    mergeBank('dossier-branch', 'branch');
    mergeBank('dossier-upiId', 'upiId');

    this.saveData();
    this.isDossierEditMode = false;
    this.showToast('Partner Dossier updated & cumulatively merged!');
    this.renderContactDetailView(contactId);
    this.renderActiveView();
  }

  async promptAddCustomTag(contactId) {
    const key = await this.showModalPrompt({
      title: 'Add Custom Specification',
      subtitle: 'Partner Specification Attribute',
      message: 'Enter specification attribute name:',
      placeholder: 'e.g. FSSAI Category, Shelf Life, Preferred Carrier, Dispatch Hub',
      suggestions: ['FSSAI Category', 'Preferred Transporter', 'Dispatch Hub', 'Credit Days', 'Shelf Life Requirement'],
      confirmText: 'Next'
    });
    if (!key || !key.trim()) return;

    const val = await this.showModalPrompt({
      title: `Value for "${key.trim()}"`,
      subtitle: 'Partner Specification Value',
      message: `Enter value for specification <strong>${tfEscapeHtml(key.trim())}</strong>:`,
      placeholder: 'Enter attribute value...',
      confirmText: 'Add Specification'
    });
    if (!val || !val.trim()) return;

    const contact = (this.data.contacts || []).find(c => c.id === contactId);
    if (!contact) return;

    if (!Array.isArray(contact.customSections)) {
      contact.customSections = Array.isArray(contact.customTags) ? [...contact.customTags] : [];
    }
    contact.customSections.push({ key: key.trim(), val: val.trim() });
    contact.customTags = contact.customSections;
    this.saveData();
    this.showToast(`Added custom spec: ${key.trim()}`);
    this.renderContactDetailView(contactId);
  }

  removeContactCustomTag(contactId, idx) {
    const contact = (this.data.contacts || []).find(c => c.id === contactId);
    if (!contact) return;
    if (Array.isArray(contact.customSections) && contact.customSections[idx] !== undefined) {
      const removed = contact.customSections.splice(idx, 1)[0];
      contact.customTags = contact.customSections;
      this.saveData();
      this.showToast(`Removed custom spec: ${removed.key}`);
      this.renderContactDetailView(contactId);
    }
  }

  runDossierTextExtraction() {
    const textEl = document.getElementById('dossier-ai-text-input');
    const text = textEl ? textEl.value.trim() : '';
    if (!text) {
      this.showToast('Please paste some text, GSTIN, visiting card details, or trade message first.');
      return;
    }

    const contactId = this.activeContactId;
    const contact = (this.data.contacts || []).find(c => c.id === contactId);
    if (!contact) return;

    let extractedCount = 0;

    // GSTIN & PAN
    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
    if (gstinMatch) {
      contact.gstin = gstinMatch[1].toUpperCase();
      contact.pan = gstinMatch[1].substring(2, 12).toUpperCase();
      extractedCount++;
    } else {
      const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/i);
      if (panMatch) {
        contact.pan = panMatch[1].toUpperCase();
        extractedCount++;
      }
    }

    // FSSAI
    const fssaiMatch = text.match(/\b(1\d{13}|2\d{13})\b/);
    if (fssaiMatch) {
      contact.fssai = fssaiMatch[1];
      contact.fssaiNumber = fssaiMatch[1];
      extractedCount++;
    }

    // Phone
    const phoneMatches = text.match(/(?:\+91[\-\s]?)?[6-9]\d{9}\b/g);
    if (phoneMatches && phoneMatches.length > 0) {
      if (!contact.phone) contact.phone = phoneMatches[0];
      else if (phoneMatches.length > 1 && !contact.altPhone) contact.altPhone = phoneMatches[1];
      extractedCount++;
    }

    // Email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      contact.email = emailMatch[0];
      extractedCount++;
    }

    // IFSC
    const ifscMatch = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
    if (ifscMatch) {
      if (!contact.bankDetails) contact.bankDetails = {};
      contact.bankDetails.ifsc = ifscMatch[1].toUpperCase();
      contact.ifsc = ifscMatch[1].toUpperCase();
      extractedCount++;
    }

    // Udyam / MSME
    const msmeMatch = text.match(/\b(UDYAM-[A-Z]{2}-\d{2}-\d{7})\b/i);
    if (msmeMatch) {
      contact.msme = msmeMatch[1].toUpperCase();
      extractedCount++;
    }

    // Address
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const addrLine = lines.find(l => /sector|market|road|street|nagar|gidc|industrial|plot|building|floor|mumbai|ahmedabad|delhi|rajkot/i.test(l));
    if (addrLine && (!contact.billingAddress || contact.billingAddress.length < 15)) {
      contact.billingAddress = addrLine;
      extractedCount++;
    }

    this.saveData();
    this.showToast(`AI extracted ${extractedCount} credentials and cumulatively merged!`);
    if (textEl) textEl.value = '';
    this.renderContactDetailView(contactId);
  }

  // Reads a visiting card / letterhead with the real Smart Fill OCR so values are reviewed before saving.
  handleDossierImageUpload(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    if (window.TradeFlowSmartFill) window.TradeFlowSmartFill.open('partner', file);
    else this.showToast('Smart Fill is not available to read this image.');
    input.value = '';
  }

  navigateBack() {
    if (this.navigationStack.length > 0) {
      const prev = this.navigationStack.pop();
      if (prev.modal) {
        if (prev.modal === 'order-payment-full-modal') {
          this.openOrderPaymentFullModal(prev.refId);
          return;
        } else if (prev.modal === 'kpi-breakdown-modal') {
          this.openKpiBreakdownModal(prev.refId);
          return;
        } else if (prev.modal === 'invoice-modal') {
          this.openInvoiceModal(prev.refId);
          return;
        } else if (prev.modal === 'factory-po-modal') {
          this.openFactoryPOModal(prev.refId);
          return;
        } else if (prev.modal === 'payment-modal') {
          this.openPaymentModal(prev.refId);
          return;
        }
      }
      if (prev.workspaceTabId && this.openTabs.some(t => t.id === prev.workspaceTabId)) {
        this.activateWorkspaceTab(prev.workspaceTabId);
      } else if (prev.tab === 'order-detail' && prev.orderId) {
        this.openOrderDetailPage(prev.orderId);
      } else if (prev.tab === 'contact-detail' && prev.contactId) {
        this.navigateToContact(prev.contactId);
      } else {
        this.activeTab = prev.tab || 'orders';
        this.activeWorkspaceTab = 'tab-orders';
        this.renderWorkspaceTabs();
        this.updateSidebarUI();
        this.renderActiveView();
      }
    } else {
      this.activateWorkspaceTab('tab-orders');
    }
  }

  sendContactWhatsApp(contactId) {
    const contact = this.data.contacts.find(c => c.id === contactId);
    if (!contact) return;
    const phoneClean = (contact.phone || '').replace(/[^0-9]/g, '');
    let msg = '';
    if (contact.role === 'manufacturer') {
      msg = `Namaste ${contact.contactPerson || contact.name},\nReaching out from ${this.data.businessProfile?.brandName || this.data.businessProfile?.legalName || 'our team'} regarding active pickle production lots and delivery schedule. Please share current dispatch status. Dhanyawad!`;
    } else if (contact.role === 'retailer') {
      msg = `Dear ${contact.name},\nGreetings from ${this.data.businessProfile?.brandName || this.data.businessProfile?.legalName || 'our team'}! Sharing your account statement and latest consignment updates. Please let us know if any new replenishment is needed. Thank you!`;
    } else if (contact.role === 'marketeer') {
      msg = `Namaste ${contact.name},\nRegarding recent retail bookings and commission settlement from ${this.data.businessProfile?.brandName || this.data.businessProfile?.legalName || 'our team'}. Let us connect.`;
    } else {
      msg = `Hello ${contact.contactPerson || contact.name},\nGreetings from ${this.data.businessProfile?.brandName || this.data.businessProfile?.legalName || 'our team'} regarding pending consignment logistics and packaging delivery.`;
    }
    const url = `https://wa.me/${phoneClean}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  // Toggle the collapsible manufacturing PO placement alert drawer
  toggleOrderPoAlert() {
    const drawer = document.getElementById('order-po-alert-drawer');
    const btn = document.getElementById('order-po-alert-btn');
    if (!drawer) return;
    drawer.classList.toggle('hidden');
    if (btn && btn.classList.contains('border-amber-500')) {
      if (drawer.classList.contains('hidden')) {
        btn.classList.add('animate-pulse');
      } else {
        btn.classList.remove('animate-pulse');
      }
    }
  }

  // Render Full Dedicated Order Inspection Page
  renderOrderDetailView(orderId) {
    const container = document.getElementById('order-detail-content');
    if (!container) return;

    const view = document.getElementById('view-order-detail');
    if (view && view.style) {
      if (typeof view.style.setProperty === 'function') view.style.setProperty('margin-top', '-24px', 'important');
      else view.style.marginTop = '-24px';
    }

    const currentId = orderId || this.activeOrderId;
    const order = this.findOrder(currentId);

    if (!order) {
      container.innerHTML = `
        <div class="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <i data-lucide="package-x" class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3"></i>
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Order Not Found</h3>
          <p class="text-xs text-slate-500 mt-1">The requested order does not exist or has been removed.</p>
          <button onclick="app.activateWorkspaceTab('tab-orders')" class="mt-4 btn-tactile px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
            ← Return to Orders Pipeline
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const retailer = this.data.contacts.find(c => c.id === order.retailerId);
    const mfg = this.data.contacts.find(c => c.id === order.manufacturerId);
    const pkg = this.data.contacts.find(c => c.id === order.packagingVendorId);
    const transporter = this.data.contacts.find(c => c.id === order.transporterId);
    const marketeer = this.data.contacts.find(c => c.id === order.marketeerId);

    const totalCases = (order.items || []).reduce((sum, i) => sum + (i.cases || 0), 0);
    const totalJars = (order.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0);
    const advancePercent = Math.round((order.customerAdvanceReceived / order.totalInvoiceAmount) * 100);

    let statusBadge = '';
    if (order.status === 'action_needed') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
        <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Action Needed (Advance in Hand)
      </span>`;
    } else if (order.status === 'in_production') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
        <span class="w-2 h-2 rounded-full bg-blue-500"></span> In Factory Production
      </span>`;
    } else if (order.status === 'in_transit') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
        <span class="w-2 h-2 rounded-full bg-purple-500"></span> In Transit
      </span>`;
    } else if (order.status === 'delivered_overdue') {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
        <span class="w-2 h-2 rounded-full bg-rose-500"></span> Overdue Balance
      </span>`;
    } else {
      statusBadge = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Settled & Closed
      </span>`;
    }

    const orderIssues = (this.auditData && this.auditData.issues || []).filter(i => 
      i.orderId === order.id || i.orderRef === order.invoiceNumber || i.orderRef === order.id
    );

    const prevCrumb = this.navigationStack.length > 0 ? this.navigationStack[this.navigationStack.length - 1] : null;
    const backLabel = prevCrumb ? `Back to ${prevCrumb.title}` : 'Back to Orders Pipeline';

    container.innerHTML = `
      <!-- ===== STICKY TOP ACTION & ORDER HEADER ROW ===== -->
      <div class="sticky top-[-24px] z-30 -mx-6 px-6 py-2.5 bg-white dark:bg-[#0c0e14] border-b border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between flex-wrap gap-2.5">
        <!-- Left Side: Back button + Order Number + GST Type Badge + Status Badge -->
        <div class="flex items-center gap-2.5 flex-wrap">
          <button onclick="app.navigateBack()" class="btn-tactile px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1 shadow-2xs" title="${tfEscapeHtml(backLabel)}">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5 text-slate-500"></i>
            <span class="hidden sm:inline">Back</span>
          </button>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-black font-mono-num text-slate-900 dark:text-white tracking-tight">${tfEscapeHtml(order.invoiceNumber)}</h2>
            <span class="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-mono-num whitespace-nowrap">
              ${tfEscapeHtml(order.gstType === 'intra' ? 'Intrastate (CGST+SGST)' : `Interstate (${this.gstLabels(order, true).combined})`)}
            </span>
          </div>
          ${statusBadge}
        </div>

        <!-- Right Side: The 6 Action Buttons (Alert + 5 Main Actions) in ONE Row -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- 1. Manufacturing PO Placement Alert Button (Persistent Across All Orders) -->
          <button onclick="app.toggleOrderPoAlert()" id="order-po-alert-btn" class="btn-tactile px-3 py-1.5 text-xs font-bold ${tfEscapeHtml(order.urgentAlert ? 'text-amber-950 dark:text-amber-100 bg-amber-400 hover:bg-amber-300 dark:bg-amber-500 dark:hover:bg-amber-400 border border-amber-500 shadow-xs ring-2 ring-amber-300/70 dark:ring-amber-400/40' : 'text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 shadow-2xs')} rounded-lg flex items-center gap-1.5 transition-all" title="${tfEscapeHtml(order.urgentAlert ? 'Click to view urgent Manufacturing PO placement alert' : 'Click to view Manufacturing PO production status')}">
            <i data-lucide="alert-triangle" class="w-3.5 h-3.5 ${tfEscapeHtml(order.urgentAlert ? 'text-amber-900 dark:text-amber-950' : 'text-slate-400 dark:text-slate-400')}"></i>
            <span>PO Alert</span>
          </button>

          <!-- 2. Edit Order -->
          <button onclick="app.openEditOrderModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 border border-emerald-700 rounded-lg flex items-center gap-1.5 shadow-xs" title="Edit this order, quantities, and rates">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Edit Order</span>
          </button>

          <!-- Delete (moves to Recycle Bin) -->
          <button onclick="app.deleteOrder('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-lg flex items-center gap-1.5" title="Move this order to the Recycle Bin">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            <span>Delete</span>
          </button>

          <!-- 3. GST Invoice -->
          <button onclick="app.openInvoiceModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs" title="View & Edit GST Tax Invoice">
            <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>GST Invoice</span>
          </button>

          <!-- 4. Factory PO -->
          <button onclick="app.openFactoryPOModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700/60 rounded-lg flex items-center gap-1.5 shadow-2xs" title="Open Rule 55 Delivery Challan & Factory Production Requisition">
            <i data-lucide="factory" class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"></i>
            <span>Factory PO</span>
          </button>

          <!-- 5. Order Documents Folder -->
          <button onclick="app.openOrderFolder('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs" title="Open ${tfEscapeHtml(order.invoiceNumber)} documents folder in Windows Explorer">
            <i data-lucide="folder" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Order Folder</span>
          </button>

          <!-- 5. WhatsApp Dispatch ▾ -->
          <div class="relative inline-block text-left" id="dispatch-pack-wrap-${tfEscapeHtml(order.id)}">
            <button type="button" onclick="app.toggleDispatchPackMenu('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg flex items-center gap-1.5 shadow-xs" title="WhatsApp Multi-Party Dispatch Pack">
              <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
              <span>WhatsApp Dispatch ▾</span>
            </button>
            <div id="dispatch-pack-menu-${tfEscapeHtml(order.id)}" class="hidden absolute right-0 top-full mt-1.5 w-60 rounded-xl shadow-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 z-50 py-1.5 text-xs">
              <button onclick="app.dispatchWhatsAppBuyer('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.toggleDispatchPackMenu('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <i data-lucide="building-2" class="w-4 h-4 text-emerald-600"></i>
                <span>Buyer Order Confirmation</span>
              </button>
              <button onclick="app.dispatchWhatsAppFactory('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.toggleDispatchPackMenu('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <i data-lucide="factory" class="w-4 h-4 text-amber-600"></i>
                <span>Factory Production PO</span>
              </button>
              <button onclick="app.dispatchWhatsAppTransporter('${tfEscapeHtml(tfEscapeJs(order.id))}'); app.toggleDispatchPackMenu('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <i data-lucide="truck" class="w-4 h-4 text-blue-600"></i>
                <span>Transporter Dispatch Instructions</span>
              </button>
            </div>
          </div>

          <!-- 6. Log Payment -->
          <button onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-800 dark:text-white rounded-lg flex items-center gap-1.5 shadow-xs">
            <i data-lucide="receipt" class="w-3.5 h-3.5"></i>
            <span>Log Payment</span>
          </button>
        </div>
      </div>

      <!-- Manufacturing PO Placement Alert Drawer (Collapsible) -->
      <div id="order-po-alert-drawer" class="hidden p-3 ${tfEscapeHtml(order.urgentAlert ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700')} rounded-xl flex items-center justify-between gap-3 animate-fadeIn">
        <div class="flex items-center gap-2.5">
          <span class="p-1.5 ${tfEscapeHtml(order.urgentAlert ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400')} rounded-lg">
            <i data-lucide="${tfEscapeHtml(order.urgentAlert ? 'alert-triangle' : 'check-circle-2')}" class="w-4 h-4"></i>
          </span>
          <div>
            <h4 class="font-bold text-xs ${tfEscapeHtml(order.urgentAlert ? 'text-amber-900 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100')} uppercase tracking-wider">${tfEscapeHtml(order.urgentAlert ? 'Manufacturer PO Placement Alert' : 'Manufacturing PO Status: On Schedule')}</h4>
            <p class="text-xs ${tfEscapeHtml(order.urgentAlert ? 'text-amber-800 dark:text-amber-200' : 'text-slate-500 dark:text-slate-400')} mt-0.5">${tfEscapeHtml(order.urgentAlert || ('No pending production bottlenecks or placement alerts for this order. Current stage: ' + (order.status ? order.status.replace(/_/g, ' ') : 'In Progress') + '.'))}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="app.openFactoryPOModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold ${tfEscapeHtml(order.urgentAlert ? 'text-slate-950 bg-amber-400 hover:bg-amber-300 border border-amber-500 shadow-sm' : 'text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 shadow-2xs')} rounded-lg whitespace-nowrap">
            ${tfEscapeHtml(order.urgentAlert ? 'Forward PO to Factory →' : 'View Factory PO →')}
          </button>
          <button onclick="app.toggleOrderPoAlert()" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Collapse Alert">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- Compact Order Metadata Bar -->
      <div class="tf-card py-2 px-4 flex items-center justify-between flex-wrap gap-2 text-xs">
        <div class="flex items-center gap-2.5 flex-wrap text-slate-600 dark:text-slate-300">
          <span>Buyer: <strong class="text-slate-900 dark:text-white font-semibold">${tfEscapeHtml(order.retailerName)}</strong></span>
          <span>•</span>
          <span>Order Placed: <strong class="font-mono-num">${tfEscapeHtml(order.timeLog || (order.time ? `${this.formatDate(order.date)} • ${this.formatTime(order.time)}` : this.formatDate(order.date)))}</strong></span>
          <span>•</span>
          <span>Terms: <strong class="font-semibold">${tfEscapeHtml(order.paymentTerms)}</strong></span>
          <span>•</span>
          <span>Due: <strong class="font-mono-num">${tfEscapeHtml(this.formatDate(order.dueDate))}</strong></span>
          ${order.lastModifiedTimeLog ? `
            <span>•</span>
            <span class="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono-num font-semibold text-xs">
              Edited: ${tfEscapeHtml(order.lastModifiedTimeLog)}
            </span>
          ` : ''}
        </div>
        <div class="text-xs text-slate-400 font-mono-num">
          System ID: <strong class="text-slate-600 dark:text-slate-300">${tfEscapeHtml(order.id)}</strong>
        </div>
      </div>

      ${orderIssues.length > 0 ? `
        <!-- Order Missing Documents & Audit Checklist Banner -->
        <div class="p-3.5 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent border-2 border-amber-500/40 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs shadow-xs animate-fadeIn">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="p-2 rounded-xl bg-amber-500 text-slate-950 font-black shadow-xs shrink-0 flex items-center justify-center">
              <i data-lucide="alert-triangle" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-black text-amber-950 dark:text-amber-200 uppercase tracking-wide">Attention: ${tfEscapeHtml(orderIssues.length)} Missing Document(s) Detected</span>
                <span class="px-2 py-0.5 rounded text-xs font-black bg-rose-500 text-white font-mono-num">Audit Action Needed</span>
              </div>
              <div class="flex items-center gap-1.5 flex-wrap mt-1">
                ${orderIssues.map(iss => `
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-700/60 text-amber-900 dark:text-amber-300">
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    ${tfEscapeHtml(iss.title || iss.type.replace(/_/g, ' '))}
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="app.triggerUploadForOrder('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center gap-1.5">
              <i data-lucide="upload" class="w-3.5 h-3.5"></i>
              <span>Upload Missing Files →</span>
            </button>
            <button onclick="app.openOrderFolder('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-2xs flex items-center gap-1">
              <i data-lucide="folder" class="w-3.5 h-3.5 text-amber-500"></i>
              <span>Open Vault</span>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Visual 6-Stage Lifecycle Milestone Tracker -->
      <div class="tf-card p-3 space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <i data-lucide="git-commit" class="w-4 h-4"></i>
            </span>
            <h4 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Order Lifecycle Milestone Progress</h4>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500 dark:text-slate-400">Current Stage: <strong class="text-slate-900 dark:text-white capitalize">${tfEscapeHtml(order.status.replace(/_/g, ' '))}</strong></span>
            <button onclick="app.advanceOrderLifecycleStage('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm flex items-center gap-1.5 transition-all">
              <span>Advance Stage →</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
          ${this.renderMilestoneSteps(order)}
        </div>
      </div>

      <!-- Financial Metric Cards Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div class="tf-kpi-block py-2">
          <span class="tf-kpi-label text-xs">Master Cases</span>
          <span class="tf-kpi-value text-base font-black text-amber-500">${tfEscapeHtml(totalCases)}</span>
          <span class="tf-kpi-sub text-xs">Shipper Cartons</span>
        </div>

        <div class="tf-kpi-block py-2">
          <span class="tf-kpi-label text-xs">Total Production</span>
          <span class="tf-kpi-value text-base font-black text-slate-900 dark:text-white">${tfEscapeHtml(totalJars.toLocaleString('en-IN'))}</span>
          <span class="tf-kpi-sub text-xs">Jars to Bottle</span>
        </div>

        <div class="tf-kpi-block py-2">
          <span class="tf-kpi-label text-xs">Taxable Subtotal</span>
          <span class="tf-kpi-value text-base font-black text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatCurrency(order.taxableSubtotal))}</span>
          <span class="tf-kpi-sub text-xs">Before GST</span>
        </div>

        <div class="tf-kpi-block py-2">
          <span class="tf-kpi-label text-xs">Customer Bill (GST)</span>
          <span class="tf-kpi-value text-base font-black text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(this.formatCurrency(order.totalInvoiceAmount))}</span>
          <span class="tf-kpi-sub text-xs text-emerald-600 dark:text-emerald-400 font-semibold">${tfEscapeHtml(this.gstLabels(order).total)} Included</span>
        </div>

        <div class="tf-kpi-block py-2">
          <span class="tf-kpi-label text-xs">Advance Received</span>
          <span class="tf-kpi-value text-base font-black text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))}</span>
          <span class="tf-kpi-sub text-xs text-emerald-600 dark:text-emerald-400 font-bold">${tfEscapeHtml(advancePercent)}% of Invoice</span>
        </div>

        <div class="tf-kpi-block py-2">
          <span class="tf-kpi-label text-xs">Balance Due</span>
          <span class="tf-kpi-value text-base font-black ${tfEscapeHtml(order.customerBalanceDue > 0 ? 'text-amber-500' : 'text-emerald-500')}">${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</span>
          <span class="tf-kpi-sub text-xs">Receivable Post Delivery</span>
        </div>
      </div>

      <!-- Production SKU Table -->
      <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div class="p-4 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">Product Line Breakdown</h3>
            <span class="px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400 font-mono-num">
              ${tfEscapeHtml((order.items || []).length)} SKUs
            </span>
          </div>
          <span class="text-xs text-slate-500 font-medium">HSN: ${tfEscapeHtml([...new Set((order.items || []).map(i => this.itemHsn(i)))].join(', ') || '—')} • ${tfEscapeHtml(this.gstLabels(order).total)}</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th class="py-3 px-4 w-10 text-center">#</th>
                <th class="py-3 px-4 min-w-[200px]">Product</th>
                <th class="py-3 px-4 w-32">Pack Size</th>
                <th class="py-3 px-4 w-24 text-right">Cases</th>
                <th class="py-3 px-4 w-28 text-center">Pack Math</th>
                <th class="py-3 px-4 w-28 text-right font-black">Total Jars</th>
                <th class="py-3 px-4 w-28 text-right">Selling Rate</th>
                <th class="py-3 px-4 w-32 text-right">Taxable Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
              ${(order.items || []).map((item, idx) => `
                <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="py-3 px-4 text-center text-slate-400 font-mono-num">${tfEscapeHtml(idx + 1)}</td>
                  <td class="py-3 px-4">
                    <span class="font-bold text-slate-900 dark:text-white">${tfEscapeHtml(item.name || item.shortName)}</span>
                    <span class="block text-xs text-slate-400">${tfEscapeHtml(item.variant)}</span>
                  </td>
                  <td class="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">${tfEscapeHtml(item.packSize || '500g')}</td>
                  <td class="py-3 px-4 text-right font-mono-num font-bold text-amber-600 dark:text-amber-400">${tfEscapeHtml(item.cases || 0)}</td>
                  <td class="py-3 px-4 text-center">
                    <span class="px-2 py-0.5 text-xs font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      ${tfEscapeHtml(item.casePack || 24)} / cs
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right font-mono-num font-black text-slate-900 dark:text-white">
                    ${tfEscapeHtml((item.quantity || 0).toLocaleString('en-IN'))}
                  </td>
                  <td class="py-3 px-4 text-right font-mono-num text-slate-700 dark:text-slate-300">
                    ${tfEscapeHtml(this.formatCurrency(item.unitRate))}
                  </td>
                  <td class="py-3 px-4 text-right font-mono-num font-black text-slate-900 dark:text-white">
                    ${tfEscapeHtml(this.formatCurrency(item.totalAmount))}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-slate-50 dark:bg-slate-900/90 font-black border-t-2 border-slate-200 dark:border-slate-700">
                <td colspan="3" class="py-3 px-4 text-right uppercase tracking-wider text-slate-500">Totals:</td>
                <td class="py-3 px-4 text-right font-mono-num text-amber-600 dark:text-amber-400">${tfEscapeHtml(totalCases)} cs</td>
                <td></td>
                <td class="py-3 px-4 text-right font-mono-num text-slate-900 dark:text-white">${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} Jars</td>
                <td></td>
                <td class="py-3 px-4 text-right font-mono-num text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(order.taxableSubtotal))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <!-- ================= INTERACTIVE ORDER SUPPLY CHAIN & CASHFLOW PIPELINE ================= -->
      ${this.renderConnectedSupplyChainPipeline(order, mfg, retailer, marketeer, pkg, transporter, totalCases, totalJars)}

      <!-- Document Vault Section -->
      ${this.renderDocumentVaultHTML(order.id)}


    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // Render Connected Supply Chain Pipeline with Boxes, Directional Arrows & Real-Time Cashflow Slips
  renderConnectedSupplyChainPipeline(order, mfg, retailer, marketeer, pkg, transporter, totalCases, totalJars) {
    const orderRef = order.invoiceNumber || order.id;
    const allPayments = (this.data.payments || []).filter(p => !p.isDeleted && (
      p.orderRef === order.invoiceNumber ||
      p.orderRef === order.id ||
      p.orderFolder === order.invoiceNumber ||
      p.orderFolder === order.id
    ));

    // Separate outward payments (to manufacturer, packaging, transport) vs inward payments (from buyer)
    const mfgPayments = allPayments.filter(p => 
      p.direction === 'paid' && (
        p.partyType === 'manufacturer' || 
        (mfg && p.partyName && p.partyName.toLowerCase().includes(mfg.name.toLowerCase().slice(0, 8))) ||
        (p.partyName && (p.partyName.toLowerCase().includes('saurashtra') || p.partyName.toLowerCase().includes('agro') || p.partyName.toLowerCase().includes('factory')))
      )
    );

    const buyerPayments = allPayments.filter(p => 
      p.direction === 'received' && (
        p.partyType === 'retailer' || 
        (retailer && p.partyName && p.partyName.toLowerCase().includes(retailer.name.toLowerCase().slice(0, 8))) ||
        (p.partyName && (p.partyName.toLowerCase().includes('sandesh') || p.partyName.toLowerCase().includes('buyer') || p.partyName.toLowerCase().includes('supermarket')))
      )
    );

    // 2. Compute Manufacturer Costs & Disbursed Totals
    const mfgTotalCost = Number(order.manufacturerTotalCost) || 0;
    const mfgPaidFromLedger = mfgPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const mfgPaid = Math.max(mfgPaidFromLedger, Number(order.manufacturerAdvancePaid) || 0);
    const mfgRemaining = Math.max(0, mfgTotalCost - mfgPaid);
    const mfgPercent = mfgTotalCost > 0 ? Math.min(100, Math.round((mfgPaid / mfgTotalCost) * 100)) : 0;
    const isMfgFullyPaid = mfgPaid >= mfgTotalCost && mfgTotalCost > 0;

    // 3. Compute Buyer Receivables & Collections
    const buyerTotal = Number(order.totalInvoiceAmount) || 0;
    const buyerPaidFromLedger = buyerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const buyerPaid = Math.max(buyerPaidFromLedger, Number(order.customerAdvanceReceived) || 0);
    const buyerRemaining = Math.max(0, buyerTotal - buyerPaid);
    const buyerPercent = buyerTotal > 0 ? Math.min(100, Math.round((buyerPaid / buyerTotal) * 100)) : 0;
    const isBuyerFullyPaid = buyerRemaining === 0 && buyerTotal > 0;

    // 4. Logistics & Transit status
    const isDispatched = !!(order.lrNumber && order.lrNumber !== 'PENDING') || order.status === 'in_transit' || order.status === 'delivered_overdue' || order.status === 'settled';

    // 5. Celebration Banner / Milestone Alert
    let celebrationBanner = '';
    if (isMfgFullyPaid) {
      celebrationBanner = `
        <div id="pipeline-flow-banner" class="p-3 sm:p-3.5 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent border border-emerald-500/30 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs mb-3 animate-fadeIn">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="p-1.5 rounded-lg bg-emerald-500 text-white shrink-0 shadow-xs">
              <i data-lucide="check-check" class="w-4 h-4"></i>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-black text-emerald-950 dark:text-emerald-200 uppercase tracking-wide">Full Factory PO Payment Complete!</span>
                <span class="px-2 py-0.5 rounded text-xs font-black bg-emerald-500 text-white">100% Settled</span>
              </div>
              <p class="text-emerald-800 dark:text-emerald-300 text-xs mt-0.5">
                Total ${tfEscapeHtml(this.formatCurrency(mfgPaid))} disbursed in full to ${tfEscapeHtml(mfg ? mfg.name : 'Manufacturer')}${tfEscapeHtml(mfgPayments.length > 0 ? ' across ' + mfgPayments.length + ' logged installment(s)' : '')}. Production and job-work fully funded!
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="app.openFactoryPOModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="btn-tactile px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs flex items-center gap-1">
              <i data-lucide="factory" class="w-3.5 h-3.5 text-emerald-600"></i>
              <span>View Factory PO</span>
            </button>
          </div>
        </div>
      `;
    } else if (mfgPaid > 0) {
      celebrationBanner = `
        <div id="pipeline-flow-banner" class="p-3 sm:p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs mb-3 animate-fadeIn">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="p-1.5 rounded-lg bg-amber-500 text-slate-950 shrink-0 shadow-xs">
              <i data-lucide="pie-chart" class="w-4 h-4"></i>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-black text-amber-950 dark:text-amber-200 uppercase tracking-wide">Factory PO Installment In Progress</span>
                <span class="px-2 py-0.5 rounded text-xs font-black bg-amber-400 text-slate-950">${tfEscapeHtml(mfgPercent)}% Paid</span>
              </div>
              <p class="text-amber-900 dark:text-amber-300 text-xs mt-0.5">
                Paid ${tfEscapeHtml(this.formatCurrency(mfgPaid))} in advance${tfEscapeHtml(mfgPayments.length > 1 ? ' (' + mfgPayments.length + ' installments)' : '')}. Remaining payable of <strong class="font-bold text-rose-600 dark:text-rose-400">${tfEscapeHtml(this.formatCurrency(mfgRemaining))}</strong> left to clear with factory.
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}', '${tfEscapeHtml(tfEscapeJs(mfg ? mfg.name : ''))}', 'paid')" class="btn-tactile px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-700 shadow-xs flex items-center gap-1">
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
              <span>Pay Remaining ${tfEscapeHtml(this.formatCurrency(mfgRemaining))} →</span>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <!-- Connected Supply Chain Pipeline Container -->
      <div class="space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <i data-lucide="git-merge" class="w-4 h-4"></i>
            </span>
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Interactive Supply Chain & Cashflow Flowchart
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Live consignment lifecycle tracking factory batch compounding, freight transit, marketeer booking, and customer inward settlement
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}', '${tfEscapeHtml(tfEscapeJs(mfg ? mfg.name : ''))}', 'paid')" class="btn-tactile px-2.5 py-1 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1 shadow-2xs">
              <i data-lucide="upload" class="w-3 h-3 text-amber-500"></i>
              <span>Attach Payment Slip</span>
            </button>
          </div>
        </div>

        ${celebrationBanner}

        <!-- 4-Box Directional Flow (Responsive: Single Horizontal Row on Desktop, Vertical Stack on Mobile) -->
        <div class="flex flex-col xl:flex-row items-stretch gap-2.5">
          
          <!-- ================= BOX 1: PICKLE FACTORY ================= -->
          <div id="flow-box-factory" class="flex-1 min-w-[220px] bg-white dark:bg-slate-900 border ${tfEscapeHtml(isMfgFullyPaid ? 'border-emerald-300 dark:border-emerald-800/80 shadow-xs' : 'border-slate-200 dark:border-slate-800 shadow-xs')} rounded-xl p-3.5 flex flex-col justify-between transition-all hover:border-blue-400 dark:hover:border-blue-500">
            <div>
              <div class="flex items-center justify-between gap-1 mb-2">
                <span class="text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">1. Factory PO</span>
                ${isMfgFullyPaid 
                  ? '<span class="px-2 py-0.5 rounded text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">100% Settled</span>'
                  : '<span class="px-2 py-0.5 rounded text-xs font-bold ' + (mfgPaid > 0 ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500') + ' font-mono-num">' + mfgPercent + '% Paid</span>'
                }
              </div>
              <div class="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer group" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.manufacturerId))}')" title="Click to view Pickle Factory profile">
                <i data-lucide="factory" class="w-4 h-4 text-blue-500 shrink-0"></i>
                <span class="group-hover:text-blue-600 transition-colors">${tfEscapeHtml(mfg ? mfg.name : 'Manufacturer')}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ${tfEscapeHtml(mfg ? mfg.contactPerson + ' · ' + mfg.phone : 'Gondal Factory')}
              </div>

              <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Batch Order:</span>
                  <strong class="font-mono-num text-slate-800 dark:text-slate-200">${tfEscapeHtml(totalCases)} Cases (${tfEscapeHtml(totalJars)} Jars)</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">PO Cost:</span>
                  <strong class="font-mono-num text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatCurrency(mfgTotalCost))}</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Paid to Date:</span>
                  <strong class="font-mono-num text-emerald-600 dark:text-emerald-400 font-bold">${tfEscapeHtml(this.formatCurrency(mfgPaid))}</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Payable Left:</span>
                  <strong class="font-mono-num ${tfEscapeHtml(mfgRemaining > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600 dark:text-emerald-400')}">${tfEscapeHtml(this.formatCurrency(mfgRemaining))}</strong>
                </div>
              </div>

              <!-- Payment Slips Pill Strip -->
              <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                  <span>Attached Payment Slips (${tfEscapeHtml(mfgPayments.length)}):</span>
                  ${mfgRemaining > 0 ? `
                    <button type="button" onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}', '${tfEscapeHtml(tfEscapeJs(mfg ? mfg.name : ''))}', 'paid')" class="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline">+ Add Slip</button>
                  ` : ''}
                </div>
                <div class="flex flex-wrap gap-1">
                  ${mfgPayments.length > 0 ? mfgPayments.map((p, idx) => `
                    <button 
                      type="button" 
                      onclick="app.openDocPreviewModal('${tfEscapeHtml(tfEscapeJs(p.id))}')" 
                      class="btn-tactile px-2 py-0.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1 shadow-2xs" 
                      title="Inspect voucher: ${tfEscapeHtml(this.formatCurrency(p.amount))} (${tfEscapeHtml(this.formatDate(p.date))})"
                    >
                      <i data-lucide="file-text" class="w-3 h-3 text-blue-500"></i>
                      <span>Slip #${tfEscapeHtml(idx + 1)}: ${tfEscapeHtml(this.formatCurrency(p.amount))}</span>
                    </button>
                  `).join('') : `
                    <span class="text-xs text-slate-400 italic">No slips attached yet</span>
                  `}
                </div>
              </div>
            </div>

            <div class="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button onclick="app.openFactoryPOModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                <span>Rule 55 Slip</span>
                <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
              </button>
              ${mfgRemaining > 0 ? `
                <button onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}', '${tfEscapeHtml(tfEscapeJs(mfg ? mfg.name : ''))}', 'paid')" class="btn-tactile px-2 py-1 rounded text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs flex items-center gap-1">
                  <i data-lucide="plus" class="w-3 h-3"></i> Pay Next
                </button>
              ` : `
                <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <i data-lucide="check" class="w-3 h-3"></i> Fully Funded
                </span>
              `}
            </div>
          </div>

          <!-- ================= ARROW 1: FACTORY TO LOGISTICS ================= -->
          <div id="flow-arrow-1" class="shrink-0 flex flex-col items-center justify-center py-2 xl:py-0 text-slate-400 dark:text-slate-500 self-center">
            <span class="text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${tfEscapeHtml(isMfgFullyPaid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700')} text-center whitespace-nowrap mb-1">
              ${tfEscapeHtml(isMfgFullyPaid ? 'Cleared & Ready' : (order.status === 'in_production' ? 'Compounding' : 'Production'))}
            </span>
            <div class="hidden xl:flex items-center text-amber-500 animate-pulse">
              <div class="w-5 h-0.5 bg-amber-400"></div>
              <i data-lucide="chevron-right" class="w-4 h-4 -ml-1"></i>
            </div>
            <div class="flex xl:hidden text-amber-500">
              <i data-lucide="chevron-down" class="w-4 h-4"></i>
            </div>
          </div>

          <!-- ================= BOX 2: LOGISTICS & TRANSPORT ================= -->
          <div id="flow-box-transport" class="flex-1 min-w-[200px] bg-white dark:bg-slate-900 border ${tfEscapeHtml(isDispatched ? 'border-purple-300 dark:border-purple-800/80 shadow-xs' : 'border-slate-200 dark:border-slate-800 shadow-xs')} rounded-xl p-3.5 flex flex-col justify-between transition-all hover:border-purple-400 dark:hover:border-purple-500">
            <div>
              <div class="flex items-center justify-between gap-1 mb-2">
                <span class="text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">2. Transport</span>
                <span class="px-2 py-0.5 rounded text-xs font-bold ${tfEscapeHtml(isDispatched ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500')}">${tfEscapeHtml(isDispatched ? 'On Road' : 'Loading')}</span>
              </div>
              <div class="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer group" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.transporterId))}')" title="Click to view Transporter profile">
                <i data-lucide="truck" class="w-4 h-4 text-purple-500 shrink-0"></i>
                <span class="group-hover:text-purple-600 transition-colors">${tfEscapeHtml(transporter ? transporter.name : 'Logistics')}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ${order.lrNumber ? 'LR: <strong class="font-mono-num text-slate-800 dark:text-slate-200">' + order.lrNumber + '</strong>' : 'LR: Pending Departure'}
              </div>

              <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Vehicle:</span>
                  <strong class="font-mono-num text-slate-800 dark:text-slate-200">${tfEscapeHtml(order.vehicleNumber || '')}</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Consignment:</span>
                  <span class="text-slate-700 dark:text-slate-300 font-semibold">${tfEscapeHtml(totalCases)} Cases</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Freight Cost:</span>
                  <strong class="font-mono-num text-slate-800 dark:text-slate-200">₹4,200</strong>
                </div>
              </div>
            </div>

            <div class="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button onclick="app.dispatchWhatsAppTransporter('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1" title="Send WhatsApp LR instructions">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                <span>LR Dispatch</span>
              </button>
              <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.transporterId))}')" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <!-- ================= ARROW 2: LOGISTICS TO MARKETEER ================= -->
          <div id="flow-arrow-2" class="shrink-0 flex flex-col items-center justify-center py-2 xl:py-0 text-slate-400 dark:text-slate-500 self-center">
            <span class="text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-center whitespace-nowrap mb-1">
              Shipped
            </span>
            <div class="hidden xl:flex items-center text-amber-500 animate-pulse">
              <div class="w-5 h-0.5 bg-amber-400"></div>
              <i data-lucide="chevron-right" class="w-4 h-4 -ml-1"></i>
            </div>
            <div class="flex xl:hidden text-amber-500">
              <i data-lucide="chevron-down" class="w-4 h-4"></i>
            </div>
          </div>

          <!-- ================= BOX 3: SALES MARKETEER ================= -->
          <div id="flow-box-marketeer" class="flex-1 min-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs rounded-xl p-3.5 flex flex-col justify-between transition-all hover:border-emerald-600 dark:hover:border-emerald-600">
            <div>
              <div class="flex items-center justify-between gap-1 mb-2">
                <span class="text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">3. Marketeer</span>
                <span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">3.0% Cut</span>
              </div>
              <div class="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer group" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.marketeerId))}')" title="Click to view Marketeer profile">
                <i data-lucide="user-check" class="w-4 h-4 text-amber-500 shrink-0"></i>
                <span class="group-hover:text-emerald-700 transition-colors">${tfEscapeHtml(order.marketeerName || 'Direct Booking')}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ${tfEscapeHtml(marketeer ? marketeer.phone : 'Direct Phone')}
              </div>

              <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Order Source:</span>
                  <span class="text-slate-700 dark:text-slate-300 font-semibold">WhatsApp Booking</span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Commission:</span>
                  <strong class="font-mono-num text-amber-600 dark:text-amber-400">${tfEscapeHtml(this.formatCurrency(Math.round(Number(order.marketeerCommissionAmount) || (order.taxableSubtotal || 0) * (Number(order.marketeerCommissionRate ?? this.config().defaultCommissionRate) || 0) / 100)))}</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Brokerage Status:</span>
                  <span class="text-emerald-600 dark:text-emerald-400 font-bold">Confirmed</span>
                </div>
              </div>
            </div>

            <div class="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button onclick="app.dispatchWhatsAppBuyer('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1" title="Share WhatsApp Dispatch Pack">
                <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                <span>Dispatch Pack</span>
              </button>
              <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.marketeerId))}')" class="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <!-- ================= ARROW 3: MARKETEER TO RETAILER ================= -->
          <div id="flow-arrow-3" class="shrink-0 flex flex-col items-center justify-center py-2 xl:py-0 text-slate-400 dark:text-slate-500 self-center">
            <span class="text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${tfEscapeHtml(isBuyerFullyPaid ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700')} text-center whitespace-nowrap mb-1">
              ${tfEscapeHtml(isBuyerFullyPaid ? 'Delivered & Paid' : 'Delivery & Recv')}
            </span>
            <div class="hidden xl:flex items-center text-amber-500 animate-pulse">
              <div class="w-5 h-0.5 bg-amber-400"></div>
              <i data-lucide="chevron-right" class="w-4 h-4 -ml-1"></i>
            </div>
            <div class="flex xl:hidden text-amber-500">
              <i data-lucide="chevron-down" class="w-4 h-4"></i>
            </div>
          </div>

          <!-- ================= BOX 4: RETAILER / BUYER ================= -->
          <div id="flow-box-retailer" class="flex-1 min-w-[220px] bg-white dark:bg-slate-900 border ${tfEscapeHtml(isBuyerFullyPaid ? 'border-emerald-300 dark:border-emerald-800/80 shadow-xs' : 'border-slate-200 dark:border-slate-800 shadow-xs')} rounded-xl p-3.5 flex flex-col justify-between transition-all hover:border-emerald-400 dark:hover:border-emerald-500">
            <div>
              <div class="flex items-center justify-between gap-1 mb-2">
                <span class="text-xs font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">4. Retailer Inward</span>
                ${isBuyerFullyPaid
                  ? '<span class="px-2 py-0.5 rounded text-xs font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">100% Settled</span>'
                  : '<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-mono-num">' + buyerPercent + '% Collected</span>'
                }
              </div>
              <div class="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer group" onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.retailerId))}')" title="Click to view Buyer account">
                <i data-lucide="building-2" class="w-4 h-4 text-emerald-500 shrink-0"></i>
                <span class="group-hover:text-emerald-600 transition-colors">${tfEscapeHtml(order.retailerName)}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                ${tfEscapeHtml(retailer ? retailer.contactPerson + ' · ' + retailer.phone : 'Customer Contact')}
              </div>

              <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Total Customer Bill:</span>
                  <strong class="font-mono-num text-slate-900 dark:text-white">${tfEscapeHtml(this.formatCurrency(buyerTotal))}</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Advance Collected:</span>
                  <strong class="font-mono-num text-emerald-600 dark:text-emerald-400 font-bold">${tfEscapeHtml(this.formatCurrency(buyerPaid))}</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Balance Receivable:</span>
                  <strong class="font-mono-num ${tfEscapeHtml(buyerRemaining > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600 dark:text-emerald-400')}">${tfEscapeHtml(this.formatCurrency(buyerRemaining))}</strong>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-slate-500 dark:text-slate-400">Payment Terms:</span>
                  <span class="text-slate-700 dark:text-slate-300 font-semibold">${tfEscapeHtml(order.paymentTerms || this.config().defaultPaymentTerms)}</span>
                </div>
              </div>

              <!-- Buyer Receipts Pill Strip -->
              <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                  <span>Buyer Collection Receipts (${tfEscapeHtml(buyerPayments.length)}):</span>
                  ${buyerRemaining > 0 ? `
                    <button type="button" onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}', '${tfEscapeHtml(tfEscapeJs(order.retailerName))}', 'received')" class="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline">+ Log Receipt</button>
                  ` : ''}
                </div>
                <div class="flex flex-wrap gap-1">
                  ${buyerPayments.length > 0 ? buyerPayments.map((p, idx) => `
                    <button 
                      type="button" 
                      onclick="app.openDocPreviewModal('${tfEscapeHtml(tfEscapeJs(p.id))}')" 
                      class="btn-tactile px-2 py-0.5 rounded text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1 shadow-2xs" 
                      title="Inspect receipt: ${tfEscapeHtml(this.formatCurrency(p.amount))} (${tfEscapeHtml(this.formatDate(p.date))})"
                    >
                      <i data-lucide="file-check-2" class="w-3 h-3 text-emerald-600"></i>
                      <span>Receipt #${tfEscapeHtml(idx + 1)}: ${tfEscapeHtml(this.formatCurrency(p.amount))}</span>
                    </button>
                  `).join('') : `
                    <span class="text-xs text-slate-400 italic">Advance of ${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived || 0))} recorded</span>
                  `}
                </div>
              </div>
            </div>

            <div class="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <button onclick="app.openInvoiceModal('${tfEscapeHtml(tfEscapeJs(order.id))}')" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                <span>View Tax Invoice</span>
                <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
              </button>
              ${buyerRemaining > 0 ? `
                <button onclick="app.openPaymentModal('${tfEscapeHtml(tfEscapeJs(order.id))}', '${tfEscapeHtml(tfEscapeJs(order.retailerName))}', 'received')" class="btn-tactile px-2 py-1 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs flex items-center gap-1">
                  <i data-lucide="plus" class="w-3 h-3"></i> Collect ${tfEscapeHtml(this.formatCurrency(buyerRemaining))}
                </button>
              ` : `
                <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <i data-lucide="check" class="w-3 h-3"></i> Invoice Cleared
                </span>
              `}
            </div>
          </div>

        </div>

        <!-- Packaging Supplier Card (Bottom Accessory Strip) -->
        <div class="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
          <div class="flex items-center gap-2.5">
            <span class="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <i data-lucide="package" class="w-4 h-4"></i>
            </span>
            <div>
              <span class="font-bold text-slate-800 dark:text-slate-200">Packaging Vendor: </span>
              <span class="text-slate-600 dark:text-slate-300">${tfEscapeHtml(pkg ? pkg.name : 'Not assigned')}</span>
              <span class="text-slate-400 dark:text-slate-500 text-xs ml-2">(${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} PET Jars, Caps & Hologram Labels Supplied)</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="app.navigateToContact('${tfEscapeHtml(tfEscapeJs(order.packagingVendorId))}')" class="btn-tactile px-2.5 py-1 rounded text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-2xs">
              View Packaging Account →
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Mount the complete FMCG Multi-SKU Order Editing Cockpit into the Full-Window Workspace Tab
  mountOrderEditCockpit(orderId) {
    const container = document.getElementById('order-edit-content');
    const panel = document.getElementById('new-order-modal-panel');
    if (!container || !panel) return;

    const currentId = orderId || this.activeEditOrderId || this.editingOrderId;
    const order = (this.data.orders || []).find(o => o.id === currentId);
    if (!order) {
      container.innerHTML = `
        <div class="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <i data-lucide="package-x" class="w-12 h-12 mx-auto text-slate-300 mb-3"></i>
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Order Not Found</h3>
          <button onclick="app.activateWorkspaceTab('tab-orders')" class="mt-4 btn-tactile px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
            ← Return to Orders Pipeline
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Move panel to full-window workspace container if not already there
    if (panel.parentElement !== container) {
      container.innerHTML = tfSanitizeHtml('');
      container.appendChild(panel);
    }

    // Set editing state
    this.editingOrderId = order.id;
    this.activeEditOrderId = order.id;

    // Apply full-window workspace styling
    panel.style.width = '100%';
    panel.style.height = 'auto';
    panel.style.maxWidth = '100%';
    panel.classList.remove('shadow-2xl', 'resizable-modal-panel');
    panel.classList.add('shadow-sm');

    // Hide modal-only window controls & resize handles
    const maxBtn = document.getElementById('order-modal-maximize-btn');
    if (maxBtn) maxBtn.style.display = 'none';
    const winControls = panel.querySelector('.modal-window-controls');
    if (winControls) winControls.style.setProperty('display', 'none', 'important');
    const header = panel.querySelector('.modal-header-with-corner-controls');
    if (header) header.style.setProperty('padding-right', '1.5rem', 'important');
    ['br', 'bl', 'r', 'b'].forEach(h => {
      const handle = document.getElementById(`order-resize-handle-${h}`);
      if (handle) handle.style.display = 'none';
    });

    this.populateNewOrderSelects();

    // Set header title & buttons for edit mode
    const titleEl = document.getElementById('order-modal-title');
    if (titleEl) {
      titleEl.innerText = `Edit Order — ${order.invoiceNumber || order.id} (${order.retailerName || 'Retailer'})`;
    }
    const draftBtn = document.getElementById('order-modal-submit-draft');
    if (draftBtn) draftBtn.innerText = 'Save Changes';
    const mainLabel = document.getElementById('order-modal-submit-label');
    if (mainLabel) mainLabel.innerText = 'Save & Open Factory PO';

    // Wire back & cancel buttons to tab cancellation
    const backBtn = panel.querySelector('.modal-header-with-corner-controls button[title="Go back to previous view"]');
    if (backBtn) backBtn.onclick = () => this.cancelOrderEdit();
    const closeBtn = panel.querySelector('.modal-header-with-corner-controls .btn-close');
    if (closeBtn) closeBtn.onclick = () => this.cancelOrderEdit();
    const cancelBtn = panel.querySelector('#order-modal-submit-draft')?.previousElementSibling;
    if (cancelBtn) cancelBtn.onclick = () => this.cancelOrderEdit();

    // Populate selects & inputs with order details
    const retSel = document.getElementById('new-order-retailer');
    if (retSel && order.retailerId) retSel.value = order.retailerId;

    const mktSel = document.getElementById('new-order-marketeer');
    if (mktSel) mktSel.value = order.marketeerId || '';

    const mfgSel = document.getElementById('new-order-mfg');
    if (mfgSel) mfgSel.value = order.manufacturerId || '';

    const pkgSel = document.getElementById('new-order-pkg');
    if (pkgSel) pkgSel.value = order.packagingVendorId || '';

    const trnSel = document.getElementById('new-order-transporter');
    if (trnSel) trnSel.value = order.transporterId || '';

    const termSel = document.getElementById('new-order-payment-terms');
    if (termSel) termSel.value = order.paymentTerms || this.config().defaultPaymentTerms;

    const dateInp = document.getElementById('new-order-date');
    if (dateInp) dateInp.value = order.date || new Date().toISOString().split('T')[0];

    const advInp = document.getElementById('new-order-advance');
    if (advInp) advInp.value = order.customerAdvanceReceived || 0;

    const advModeSel = document.getElementById('new-order-advance-mode');
    if (advModeSel) advModeSel.value = order.customerAdvanceMode || 'NEFT / Bank Transfer';

    // Sync carton packaging config inputs
    ['500g', '1kg', '5kg'].forEach(ps => {
      const el = document.getElementById(`master-pack-${ps}`);
      if (el) el.value = this.casePackConfig[ps] || this.config().defaultCasePack;
    });

    // Populate SKU items
    if (order.items && Array.isArray(order.items) && order.items.length) {
      this.orderSkuItems = order.items.map(it => ({ ...it }));
    }

    this.renderOrderSkuTable();
    this.recomputeOrderTotals();

    if (window.lucide) window.lucide.createIcons();
  }

  // Restore the panel back into the floating modal container if needed
  unmountOrderEditCockpit() {
    const panel = document.getElementById('new-order-modal-panel');
    const modal = document.getElementById('new-order-modal');
    if (panel && modal && panel.parentElement !== modal) {
      modal.appendChild(panel);
      panel.style.width = '1080px';
      panel.style.height = '92vh';
      panel.style.maxWidth = '96vw';
      panel.classList.add('shadow-2xl', 'resizable-modal-panel');
      panel.classList.remove('shadow-sm');

      const maxBtn = document.getElementById('order-modal-maximize-btn');
      if (maxBtn) maxBtn.style.display = '';
      const winControls = panel.querySelector('.modal-window-controls');
      if (winControls) winControls.style.display = '';
      const header = panel.querySelector('.modal-header-with-corner-controls');
      if (header) header.style.paddingRight = '';
      ['br', 'bl', 'r', 'b'].forEach(h => {
        const handle = document.getElementById(`order-resize-handle-${h}`);
        if (handle) handle.style.display = '';
      });

      const backBtn = panel.querySelector('.modal-header-with-corner-controls button[title="Go back to previous view"]');
      if (backBtn) backBtn.onclick = () => this.closeNewOrderModal();
      const closeBtn = panel.querySelector('.modal-header-with-corner-controls .btn-close');
      if (closeBtn) closeBtn.onclick = () => this.closeNewOrderModal();
      const cancelBtn = panel.querySelector('#order-modal-submit-draft')?.previousElementSibling;
      if (cancelBtn) cancelBtn.onclick = () => this.closeNewOrderModal();
    }
  }

  cancelOrderEdit() {
    const orderId = this.editingOrderId;
    const tabId = `tab-edit-order-${orderId}`;
    const tabIdx = this.openTabs.findIndex(t => t.id === tabId);
    if (tabIdx !== -1) {
      this.openTabs.splice(tabIdx, 1);
    }
    this.editingOrderId = null;
    this.activeEditOrderId = null;

    this.unmountOrderEditCockpit();

    if (orderId) {
      this.openOrderDetailPage(orderId);
    } else {
      this.activateWorkspaceTab('tab-orders');
    }
  }

  renderOrderEditView(orderId) {
    this.mountOrderEditCockpit(orderId);
  }

  // Render Full Dedicated Contact / Partner Page (Pickle Factory, Buyer, Broker, Packaging, Transporter)
  openContactDetail(contactId) {
    this.navigateToContact(contactId);
  }

  renderContactDetailView(contactId) {
    const container = document.getElementById('contact-detail-content');
    if (!container) return;

    const currentId = contactId || this.activeContactId;
    const contact = this.data.contacts.find(c => c.id === currentId);

    if (!contact) {
      container.innerHTML = `
        <div class="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <i data-lucide="user-x" class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3"></i>
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-200">Partner Profile Not Found</h3>
          <p class="text-xs text-slate-500 mt-1">The requested contact does not exist.</p>
          <button onclick="app.activateWorkspaceTab('tab-orders')" class="mt-4 btn-tactile px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg">
            ← Return to Orders Pipeline
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (window.TFPartnerUI) {
      container.innerHTML = window.TFPartnerUI.renderPage(this, contact);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (window.TFComponents && typeof window.TFComponents.renderPartnerDossier === 'function') {
      container.innerHTML = window.TFComponents.renderPartnerDossier(contact, this.data.orders, this.data.payments, {
        viewMode: this.activeContactViewMode || 'hub'
      });
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // Find all orders linked to this contact
    let linkedOrders = [];
    if (contact.role === 'manufacturer') {
      linkedOrders = this.data.orders.filter(o => o.manufacturerId === contact.id);
    } else if (contact.role === 'retailer') {
      linkedOrders = this.data.orders.filter(o => o.retailerId === contact.id);
    } else if (contact.role === 'marketeer') {
      linkedOrders = this.data.orders.filter(o => o.marketeerId === contact.id);
    } else if (contact.role === 'packaging') {
      linkedOrders = this.data.orders.filter(o => o.packagingVendorId === contact.id);
    } else if (contact.role === 'transporter') {
      linkedOrders = this.data.orders.filter(o => o.transporterId === contact.id);
    }

    // Financial calculations
    const totalCases = linkedOrders.reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + (i.cases || 0), 0), 0);
    const totalJars = linkedOrders.reduce((sum, o) => sum + (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0), 0);
    
    let totalBilled = 0;
    let totalPaid = 0;
    let balanceDue = 0;

    if (contact.role === 'manufacturer') {
      totalBilled = linkedOrders.reduce((s, o) => s + o.manufacturerTotalCost, 0);
      totalPaid = linkedOrders.reduce((s, o) => s + o.manufacturerAdvancePaid, 0);
      balanceDue = Math.max(0, totalBilled - totalPaid);
    } else if (contact.role === 'retailer') {
      totalBilled = linkedOrders.reduce((s, o) => s + o.totalInvoiceAmount, 0);
      totalPaid = linkedOrders.reduce((s, o) => s + o.customerAdvanceReceived, 0);
      balanceDue = Math.max(0, totalBilled - totalPaid);
    } else if (contact.role === 'marketeer') {
      // Commission earned on each order (its own rate), and what the payments ledger shows as paid to this partner.
      totalBilled = linkedOrders.reduce((s, o) => s + (Number(o.marketeerCommissionAmount) || (Number(o.taxableSubtotal) || 0) * (Number(o.marketeerCommissionRate ?? contact.commissionRate ?? this.config().defaultCommissionRate) || 0) / 100), 0);
      totalPaid = this.paymentsPaidToContact(contact);
      balanceDue = Math.max(0, totalBilled - totalPaid);
    } else if (contact.role === 'packaging') {
      totalBilled = linkedOrders.reduce((s, o) => s + o.packagingCost, 0);
      totalPaid = linkedOrders.reduce((s, o) => s + o.packagingAdvancePaid, 0);
      balanceDue = Math.max(0, totalBilled - totalPaid);
    } else if (contact.role === 'transporter') {
      totalBilled = linkedOrders.reduce((s, o) => s + (Number(o.totalTransportCost ?? o.transportationCost) || 0), 0);
      totalPaid = this.paymentsPaidToContact(contact);
      balanceDue = Math.max(0, totalBilled - totalPaid);
    }

    const prevCrumb = this.navigationStack.length > 0 ? this.navigationStack[this.navigationStack.length - 1] : null;
    const backLabel = prevCrumb ? `Back to ${prevCrumb.title}` : 'Back to Orders Pipeline';

    let roleBadge = '';
    if (contact.role === 'manufacturer') {
      roleBadge = '<span class="px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Primary Pickle Factory (Contract Mfg)</span>';
    } else if (contact.role === 'retailer') {
      roleBadge = '<span class="px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Retailer / Supermarket Account</span>';
    } else if (contact.role === 'marketeer') {
      roleBadge = '<span class="px-2.5 py-0.5 text-xs font-bold rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Sales Marketeer (3% Trade Broker)</span>';
    } else if (contact.role === 'packaging') {
      roleBadge = '<span class="px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Packaging, Jars & Labels Supplier</span>';
    } else {
      roleBadge = '<span class="px-2.5 py-0.5 text-xs font-bold rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">Freight & Logistics Partner</span>';
    }

    container.innerHTML = `
      <!-- Top Navigation Bar & Dynamic Breadcrumb -->
      <div class="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
        <div class="flex items-center gap-3">
          <button onclick="app.navigateBack()" class="btn-tactile px-3.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs">
            <i data-lucide="arrow-left" class="w-4 h-4 text-slate-500"></i>
            <span>${tfEscapeHtml(backLabel)}</span>
          </button>
          <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <button onclick="app.activateWorkspaceTab('tab-orders')" class="breadcrumb-item">Orders Pipeline</button>
            <span>/</span>
            <span class="text-slate-400 uppercase tracking-wider text-xs font-bold">${tfEscapeHtml(contact.role)}</span>
            <span>/</span>
            <span class="font-bold text-slate-900 dark:text-white">${tfEscapeHtml(contact.name)}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${roleBadge}
        </div>
      </div>

      <!-- Partner Hero Profile Card -->
      <div class="tf-card p-6 space-y-5">
        <div class="flex items-start justify-between flex-wrap gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">${tfEscapeHtml(contact.name)}</h2>
              <span class="font-mono-num text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                ID: ${tfEscapeHtml(contact.id)}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>Contact Person: <strong class="text-slate-900 dark:text-white">${tfEscapeHtml(contact.contactPerson || contact.name)}</strong></span>
              <span>•</span>
              <a href="tel:${tfEscapeHtml((contact.phone || '').replace(/[^0-9+]/g, ''))}" class="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold hover:underline" title="Call directly">
                <i data-lucide="phone-call" class="w-3.5 h-3.5"></i>
                <span>${tfEscapeHtml(contact.phone || 'No Phone')}</span>
              </a>
              <span>•</span>
              <span>Email: <strong class="text-slate-800 dark:text-slate-200">${tfEscapeHtml(contact.email || '—')}</strong></span>
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Address: ${tfEscapeHtml(contact.billingAddress || '')}
            </p>
          </div>

          <!-- Quick Actions -->
          <div class="flex items-center gap-2 flex-wrap">
            <a href="tel:${tfEscapeHtml((contact.phone || '').replace(/[^0-9+]/g, ''))}" class="btn-tactile px-3.5 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 bg-slate-100 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-2 shadow-2xs group" title="Click to call ${tfEscapeHtml(contact.name)}">
              <i data-lucide="phone" class="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform"></i>
              <span>${tfEscapeHtml(contact.phone || 'No Phone')}</span>
            </a>
            <button onclick="app.openEditContactModal('${tfEscapeHtml(tfEscapeJs(contact.id))}')" class="btn-tactile px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs" title="Edit Company Details">
              <i data-lucide="edit-3" class="w-4 h-4 text-amber-500"></i>
              <span>Edit Details</span>
            </button>
            <button onclick="app.sendContactWhatsApp('${tfEscapeHtml(tfEscapeJs(contact.id))}')" class="btn-tactile px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 rounded-lg flex items-center gap-1.5 shadow-sm">
              <i data-lucide="message-square" class="w-4 h-4"></i>
              <span>WhatsApp Message</span>
            </button>
            <button onclick="app.openPaymentModal(null)" class="btn-tactile px-4 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5 shadow-2xs">
              <i data-lucide="receipt" class="w-4 h-4 text-emerald-500"></i>
              <span>Record Transaction</span>
            </button>
          </div>
        </div>

        <!-- Statutory & Bank Details Strip (ZERO GLARE in Dark Mode) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          <div class="tf-tile">
            <span class="tf-tile-label">GSTIN Number</span>
            <span class="tf-tile-value">${tfEscapeHtml(contact.gstin || 'UNREGISTERED')}</span>
          </div>
          <div class="tf-tile">
            <span class="tf-tile-label">FSSAI License</span>
            <span class="tf-tile-value">${tfEscapeHtml(contact.fssaiNumber || '')}</span>
          </div>
          <div class="tf-tile">
            <span class="tf-tile-label">Bank Account & IFSC</span>
            <span class="tf-tile-value text-xs truncate block" title="${tfEscapeHtml(contact.bankDetails ? contact.bankDetails.bankName + ' • ' + contact.bankDetails.accountNumber + ' • ' + contact.bankDetails.ifsc : 'Bank details not set')}">
              ${tfEscapeHtml(contact.bankDetails ? contact.bankDetails.bankName + ' • ' + contact.bankDetails.ifsc : 'Bank details not set')}
            </span>
          </div>
          <div class="tf-tile">
            <span class="tf-tile-label">Payment Terms</span>
            <span class="tf-tile-value text-amber-500">${tfEscapeHtml(contact.paymentTerms || this.config().defaultPaymentTerms)}</span>
          </div>
        </div>

        <!-- Buyer Agreed Rate Card (if retailer) -->
        ${contact.agreedRates ? `
          <div class="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <div class="flex items-center justify-between mb-2.5">
              <span class="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="tag" class="w-3.5 h-3.5 text-amber-500"></i> Pre-Agreed Contract Rate Card
              </span>
              <span class="text-xs text-slate-500 dark:text-slate-400">Locked Contract Rates</span>
            </div>
            <div class="grid grid-cols-3 gap-3 text-xs">
              <div class="tf-rate-card">
                <span class="tf-rate-card-label">500g PET Jar</span>
                <span class="tf-rate-card-price">₹${tfEscapeHtml(contact.agreedRates['500g'] || 85)}.00</span>
              </div>
              <div class="tf-rate-card">
                <span class="tf-rate-card-label">1kg Glass Jar</span>
                <span class="tf-rate-card-price">₹${tfEscapeHtml(contact.agreedRates['1kg'] || 155)}.00</span>
              </div>
              <div class="tf-rate-card">
                <span class="tf-rate-card-label">5kg Bulk Bucket</span>
                <span class="tf-rate-card-price">₹${tfEscapeHtml(contact.agreedRates['5kg'] || 590)}.00</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Financial Balance Ledger Metric Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div class="tf-kpi-block">
          <span class="tf-kpi-label">Total Batches / Orders</span>
          <span class="tf-kpi-value">${tfEscapeHtml(linkedOrders.length)}</span>
          <span class="tf-kpi-sub">${tfEscapeHtml(totalCases)} Cases • ${tfEscapeHtml(totalJars.toLocaleString('en-IN'))} Jars</span>
        </div>

        <div class="tf-kpi-block">
          <span class="tf-kpi-label">Total Billed / Job Work</span>
          <span class="tf-kpi-value text-slate-800 dark:text-slate-200">${tfEscapeHtml(this.formatCurrency(totalBilled))}</span>
          <span class="tf-kpi-sub">All Time Volume</span>
        </div>

        <div class="tf-kpi-block">
          <span class="tf-kpi-label">Total Settled / Paid</span>
          <span class="tf-kpi-value text-emerald-600 dark:text-emerald-400">${tfEscapeHtml(this.formatCurrency(totalPaid))}</span>
          <span class="tf-kpi-sub text-emerald-600 dark:text-emerald-400 font-semibold">Disbursed / Cleared</span>
        </div>

        <div class="tf-kpi-block">
          <span class="tf-kpi-label">
            ${tfEscapeHtml(contact.role === 'retailer' ? 'Outstanding Receivable' : 'Current Payable Due')}
          </span>
          <span class="tf-kpi-value ${tfEscapeHtml(balanceDue > 0 ? (contact.role === 'retailer' ? 'text-amber-500' : 'text-rose-500') : 'text-emerald-500')}">
            ${tfEscapeHtml(this.formatCurrency(balanceDue))}
          </span>
          <span class="tf-kpi-sub">${tfEscapeHtml(balanceDue > 0 ? 'Action Pending' : 'Fully Settled')}</span>
        </div>
      </div>

      <!-- Complete Previous Orders Table (Click any row to open!) -->
      <div class="tf-card overflow-hidden">
        <div class="p-4 px-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 class="text-sm font-bold text-slate-900 dark:text-white">All Previous Orders & Batches Connected to ${tfEscapeHtml(contact.name)}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Click any order row to open its full production breakdown tab.</p>
          </div>
          <span class="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono-num">
            ${tfEscapeHtml(linkedOrders.length)} Linked Orders
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th class="py-3 px-4">Order / Invoice</th>
                <th class="py-3 px-4">Date</th>
                <th class="py-3 px-4">Counterparty</th>
                <th class="py-3 px-4">Flavours & Quantity</th>
                <th class="py-3 px-4 text-right">Job Work / Amount</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
              ${linkedOrders.length === 0 ? `
                <tr>
                  <td colspan="7" class="text-center py-10 text-slate-400 italic">
                    No orders linked to this partner yet.
                  </td>
                </tr>
              ` : linkedOrders.map(o => {
                const totalOcases = (o.items || []).reduce((s, i) => s + (i.cases || 0), 0);
                const totalOjars = (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
                const varietiesPreview = o.items.map(i => i.shortName || i.name).slice(0, 3).join(', ') + (o.items.length > 3 ? '...' : '');

                let oBadge = '';
                if (o.status === 'action_needed') {
                  oBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Action Needed</span>';
                } else if (o.status === 'in_production') {
                  oBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">In Production</span>';
                } else if (o.status === 'in_transit') {
                  oBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">In Transit</span>';
                } else {
                  oBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">Settled</span>';
                }

                return `
                  <tr onclick="app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}', event)" class="hover:bg-amber-500/5 dark:hover:bg-amber-500/10 cursor-pointer transition-colors group">
                    <td class="py-3 px-4">
                      <div class="font-mono-num font-bold text-emerald-700 dark:text-emerald-400 group-hover:underline">${tfEscapeHtml(o.invoiceNumber)}</div>
                      <div class="text-xs text-slate-400 font-mono-num">${tfEscapeHtml(o.id)}</div>
                    </td>
                    <td class="py-3 px-4 font-mono-num text-slate-600 dark:text-slate-400">
                      ${tfEscapeHtml(this.formatDate(o.date))}
                    </td>
                    <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      ${tfEscapeHtml(contact.role === 'manufacturer' ? o.retailerName : (o.marketeerName ? 'Marketeer: ' + o.marketeerName : 'Direct'))}
                    </td>
                    <td class="py-3 px-4">
                      <div class="font-bold text-slate-800 dark:text-slate-200">${tfEscapeHtml(totalOcases)} ${tfEscapeHtml(totalOcases === 1 ? 'Case' : 'Cases')} (${tfEscapeHtml(totalOjars.toLocaleString('en-IN'))} jars)</div>
                      <div class="text-xs text-slate-400 truncate max-w-[220px]" title="${tfEscapeHtml(o.items.map(i => i.name).join(', '))}">${tfEscapeHtml(varietiesPreview)}</div>
                    </td>
                    <td class="py-3 px-4 text-right font-mono-num font-black text-slate-900 dark:text-white">
                      ${tfEscapeHtml(contact.role === 'manufacturer' ? this.formatCurrency(o.manufacturerTotalCost) : this.formatCurrency(o.totalInvoiceAmount))}
                    </td>
                    <td class="py-3 px-4 text-center">
                      ${oBadge}
                    </td>
                    <td class="py-3 px-4 text-right">
                      <button onclick="event.stopPropagation(); app.openOrderDetailPage('${tfEscapeHtml(tfEscapeJs(o.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700/60 rounded-lg inline-flex items-center gap-1">
                        <span>Inspect</span>
                        <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
  }

  // 360° Order Drawer
  openOrderDrawer(orderId) {
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return;
    this.selectedOrder = order;

    const drawer = document.getElementById('order-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const panel = document.getElementById('drawer-panel');
    if (!drawer || !backdrop || !panel) return;

    document.getElementById('drawer-order-id').innerText = `${order.invoiceNumber} (${order.id})`;
    document.getElementById('drawer-order-date').innerText = `Created on ${this.formatDate(order.date)} • Payment: ${order.paymentTerms}`;

    const alertEl = document.getElementById('drawer-urgent-alert');
    if (order.status === 'action_needed') {
      alertEl.classList.remove('hidden');
      alertEl.innerHTML = `
        <div class="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <span class="text-base"><i data-lucide="triangle-alert" class="w-4 h-4 inline-block"></i></span>
          <div>
            <strong>Advance in Hand:</strong> Customer paid ${tfEscapeHtml(this.formatCurrency(order.customerAdvanceReceived))}.
            The manufacturer and packaging vendor have not received advances yet. Initiate payments below to start bottling.
          </div>
        </div>
      `;
    } else if (order.status === 'delivered_overdue') {
      alertEl.classList.remove('hidden');
      alertEl.innerHTML = `
        <div class="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
          <span class="text-base"><i data-lucide="octagon-alert" class="w-4 h-4 inline-block"></i></span>
          <div>
            <strong>Payment Overdue:</strong> Due date was ${tfEscapeHtml(this.formatDate(order.dueDate))}.
            Remaining balance: <strong>${tfEscapeHtml(this.formatCurrency(order.customerBalanceDue))}</strong>.
          </div>
        </div>
      `;
    } else {
      alertEl.classList.add('hidden');
    }

    document.getElementById('drawer-retailer-name').innerText = order.retailerName;
    document.getElementById('drawer-total-bill').innerText = this.formatCurrency(order.totalInvoiceAmount);
    document.getElementById('drawer-advance-recv').innerText = `${this.formatCurrency(order.customerAdvanceReceived)} (${order.customerAdvanceMode})`;
    document.getElementById('drawer-balance-due').innerText = this.formatCurrency(order.customerBalanceDue);

    document.getElementById('drawer-pkg-vendor').innerText = order.packagingVendorName;
    document.getElementById('drawer-pkg-cost').innerText = this.formatCurrency(order.packagingCost);
    document.getElementById('drawer-pkg-paid').innerText = this.formatCurrency(order.packagingAdvancePaid);
    document.getElementById('drawer-pkg-status').innerText = order.packagingStatus.replace(/_/g, ' ').toUpperCase();

    document.getElementById('drawer-mfg-name').innerText = order.manufacturerName;
    document.getElementById('drawer-mfg-cost').innerText = this.formatCurrency(order.manufacturerTotalCost);
    document.getElementById('drawer-mfg-paid').innerText = this.formatCurrency(order.manufacturerAdvancePaid);
    document.getElementById('drawer-mfg-status').innerText = order.manufacturerStatus.replace(/_/g, ' ').toUpperCase();

    document.getElementById('drawer-transporter').innerText = order.transporterName;
    document.getElementById('drawer-transport-costs').innerText = `${this.formatCurrency(order.transportLeg1Cost)} (Labels to Factory) + ${this.formatCurrency(order.transportLeg2Cost)} (Factory to Customer) = ${this.formatCurrency(order.totalTransportCost)}`;
    document.getElementById('drawer-lr-no').innerText = `${order.lrNumber} (Vehicle: ${order.vehicleNumber})`;

    const damageAmountInput = document.getElementById('drawer-damage-amount');
    const damageDeductedSelect = document.getElementById('drawer-damage-deducted');
    const damageNoteInput = document.getElementById('drawer-damage-note');

    if (damageAmountInput) damageAmountInput.value = order.damageAmount || 0;
    if (damageDeductedSelect) damageDeductedSelect.value = order.damageDeductedFrom || 'none';
    if (damageNoteInput) damageNoteInput.value = order.damageNote || '';

    // Working Capital & Float Analysis
    const custAdv = order.customerAdvanceReceived || 0;
    const pkgNeed = order.packagingCost || 0;
    const mfgNeed = order.manufacturerAdvanceRequired || (order.manufacturerTotalCost * 0.4) || 0;
    const leg1Need = order.transportLeg1Cost || 0;
    const totalUpfrontNeeded = pkgNeed + mfgNeed + leg1Need;
    const netFloatBuffer = custAdv - totalUpfrontNeeded;

    const custAdvEl = document.getElementById('drawer-float-cust-adv');
    const pkgNeedEl = document.getElementById('drawer-float-pkg-need');
    const mfgNeedEl = document.getElementById('drawer-float-mfg-need');
    const leg1NeedEl = document.getElementById('drawer-float-leg1-need');
    const netFloatEl = document.getElementById('drawer-float-net');
    const floatBadgeEl = document.getElementById('drawer-float-badge');
    const floatAdviceEl = document.getElementById('drawer-float-advice');

    if (custAdvEl) custAdvEl.innerText = `+${this.formatCurrency(custAdv)}`;
    if (pkgNeedEl) pkgNeedEl.innerText = `-${this.formatCurrency(pkgNeed)}`;
    if (mfgNeedEl) mfgNeedEl.innerText = `-${this.formatCurrency(mfgNeed)}`;
    if (leg1NeedEl) leg1NeedEl.innerText = `-${this.formatCurrency(leg1Need)}`;
    
    if (netFloatEl) {
      if (netFloatBuffer >= 0) {
        netFloatEl.className = 'font-mono-num font-black text-sm text-emerald-600 dark:text-emerald-400';
        netFloatEl.innerText = `+${this.formatCurrency(netFloatBuffer)}`;
      } else {
        netFloatEl.className = 'font-mono-num font-black text-sm text-rose-600 dark:text-rose-400';
        netFloatEl.innerText = `-${this.formatCurrency(Math.abs(netFloatBuffer))}`;
      }
    }

    if (floatBadgeEl) {
      if (netFloatBuffer >= 0) {
        floatBadgeEl.className = 'px-2 py-0.5 text-xs font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300';
        floatBadgeEl.innerText = 'Positive Buffer (Safe)';
      } else {
        floatBadgeEl.className = 'px-2 py-0.5 text-xs font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300';
        floatBadgeEl.innerText = 'Negative Float Deficit!';
      }
    }

    if (floatAdviceEl) {
      if (netFloatBuffer >= 0) {
        floatAdviceEl.innerText = `Advance in hand covers all upfront production liabilities with ${this.formatCurrency(netFloatBuffer)} buffer reserve.`;
      } else {
        floatAdviceEl.innerText = `Float Trap: Customer advance falls short by ${this.formatCurrency(Math.abs(netFloatBuffer))} of required supplier payouts. You must inject working capital or demand higher booking advance.`;
      }
    }

    this.updateDrawerProfitCard(order);

    drawer.classList.remove('hidden');
    setTimeout(() => {
      backdrop.classList.remove('opacity-0');
      panel.classList.remove('translate-x-full');
    }, 10);

    if (window.lucide) window.lucide.createIcons();
  }

  updateDrawerProfitCard(order) {
    const profitEl = document.getElementById('drawer-net-profit');
    const marginEl = document.getElementById('drawer-profit-margin');
    const cogsEl = document.getElementById('drawer-cogs-breakdown');

    if (profitEl) profitEl.innerText = this.formatCurrency(order.netProfit);
    if (marginEl) marginEl.innerText = `${order.profitMarginPercent.toFixed(1)}% Net Margin`;
    if (cogsEl) {
      cogsEl.innerText = `COGS: Factory ${this.formatCurrency(order.manufacturerTotalCost)} + Pkg ${this.formatCurrency(order.packagingCost)} + Freight ${this.formatCurrency(order.totalTransportCost)} + Comm ${this.formatCurrency(order.marketeerCommissionAmount)}`;
    }
  }

  saveDamageAdjustments() {
    if (!this.selectedOrder) return;
    const order = this.selectedOrder;
    const damageAmount = parseFloat(document.getElementById('drawer-damage-amount').value) || 0;
    const damageDeducted = document.getElementById('drawer-damage-deducted').value;
    const damageNote = document.getElementById('drawer-damage-note').value;

    order.damageAmount = damageAmount;
    order.damageDeductedFrom = damageDeducted;
    order.damageNote = damageNote;

    let effectiveMfgCost = order.manufacturerTotalCost;
    if (damageDeducted === 'manufacturer') {
      effectiveMfgCost -= damageAmount;
    }
    order.totalDirectCosts = order.packagingCost + effectiveMfgCost + order.totalTransportCost + order.marketeerCommissionAmount;
    order.netProfit = order.taxableSubtotal - order.totalDirectCosts;
    order.profitMarginPercent = (order.netProfit / order.taxableSubtotal) * 100;

    this.saveData();
    this.renderKPIs();
    this.renderOrdersTable();
    this.updateDrawerProfitCard(order);
    this.showToast('Damage adjustments and margins updated successfully!');
  }

  closeOrderDrawer() {
    const drawer = document.getElementById('order-drawer');
    const backdrop = document.getElementById('drawer-backdrop');
    const panel = document.getElementById('drawer-panel');

    if (!drawer || !backdrop || !panel) return;

    backdrop.classList.add('opacity-0');
    panel.classList.add('translate-x-full');
    setTimeout(() => {
      drawer.classList.add('hidden');
      this.selectedOrder = null;
    }, 280);
  }
});
