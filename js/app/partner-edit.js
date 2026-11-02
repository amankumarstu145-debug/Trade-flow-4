// TradeFlow: Partner edit window and smart fill from cards and text. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // ================= COMPANY & PARTNER PROFILE EDITING SYSTEM =================
  openEditContactModal(contactId = null, defaultRole = 'retailer') {
    const modal = document.getElementById('contact-edit-modal');
    if (!modal) return;

    const roleLabels = {
      manufacturer: 'Manufacturer (Contract Manufacturing)',
      packaging: 'Packaging & Labels Supplier',
      transporter: 'Freight & Logistics Partner',
      retailer: 'Retailer / Buyer Account',
      marketeer: 'Sales Marketeer (Trade Broker)'
    };

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    // Reset smart input and previous highlights
    this.clearContactSmartInput();
    this.clearContactAutofillHighlights();

    // Check if editing existing or adding new partner
    const isNew = !contactId || contactId === 'new';
    let contact = isNew ? null : this.data.contacts.find(c => c.id === contactId);

    const titleEl = document.getElementById('edit-contact-modal-title');
    const subtitleEl = document.getElementById('edit-contact-modal-subtitle');
    const idDisp = document.getElementById('edit-contact-id-display');
    const roleSelect = document.getElementById('edit-contact-role-select');
    const ordersCountEl = document.getElementById('profile-modal-orders-count');

    this.currentProfileContactId = contact ? contact.id : null;

    if (isNew) {
      const newId = this.nextContactId();
      setVal('edit-contact-id', newId);
      if (idDisp) idDisp.innerText = newId;

      if (titleEl) titleEl.innerText = 'Add New Partner / Company Profile';
      if (subtitleEl) subtitleEl.innerText = 'Use AI Smart Scan above to auto-populate from cards/screenshots, or fill details below.';

      if (roleSelect) {
        roleSelect.value = defaultRole;
        roleSelect.classList.remove('hidden');
      }
      this.updateContactRoleBadge(defaultRole);

      // Clear all form inputs for new partner
      ['edit-contact-name', 'edit-contact-brand-name', 'edit-contact-person', 'edit-contact-designation',
       'edit-contact-phone', 'edit-contact-alt-phone', 'edit-contact-email', 'edit-contact-billing-email',
       'edit-contact-secondary-person', 'edit-contact-website', 'edit-contact-business-nature',
       'edit-contact-logo-url', 'edit-contact-logo-data', 'edit-contact-bio',
       'edit-contact-gstin', 'edit-contact-pan', 'edit-contact-fssai', 'edit-contact-cin', 'edit-contact-msme',
       'edit-contact-factory-license', 'edit-contact-billing', 'edit-contact-shipping', 'edit-contact-city',
       'edit-contact-state', 'edit-contact-pincode', 'edit-contact-landmark',
       'edit-contact-bank-name', 'edit-contact-beneficiary-name', 'edit-contact-ifsc', 'edit-contact-acc-no',
       'edit-contact-confirm-acc-no', 'edit-contact-branch', 'edit-contact-upi', 'edit-contact-terms',
       'edit-contact-credit-limit', 'edit-contact-credit-period', 'edit-contact-trade-discount',
       'edit-contact-specialties', 'edit-contact-capacity',
       'edit-contact-rate-500g', 'edit-contact-rate-1kg', 'edit-contact-rate-5kg'].forEach(id => setVal(id, ''));

      setVal('edit-contact-status', 'active');
      this.updateProfileLogoPreview('', 'New Partner');

      this.editingAltPhones = [];
      this.editingAltEmails = [];
      this.editingAltContacts = [];
      setVal('edit-contact-card-notes', '');
      this.renderContactAltPills();

      if (ordersCountEl) ordersCountEl.innerText = '0';

      const ratesSec = document.getElementById('edit-contact-rates-section');
      if (ratesSec) {
        if (defaultRole === 'retailer') ratesSec.classList.remove('hidden');
        else ratesSec.classList.add('hidden');
      }
    } else {
      setVal('edit-contact-id', contact.id);
      if (idDisp) idDisp.innerText = contact.id;

      if (titleEl) titleEl.innerText = `${contact.name} - Profile Dossier`;
      if (subtitleEl) subtitleEl.innerText = 'Complete commercial identity, verified bank payout coordinates, tax registrations & terms.';

      if (roleSelect) {
        roleSelect.value = contact.role || 'retailer';
      }
      this.updateContactRoleBadge(contact.role || 'retailer');

      // 1. Identity & Branding
      setVal('edit-contact-name', contact.name);
      setVal('edit-contact-brand-name', contact.brandName || '');
      setVal('edit-contact-status', contact.status || 'active');
      setVal('edit-contact-business-nature', contact.businessNature || '');
      setVal('edit-contact-logo-url', contact.logoUrl || '');
      setVal('edit-contact-logo-data', contact.logo || contact.logoUrl || '');
      setVal('edit-contact-bio', contact.bio || '');

      // 2. Key Personnel & Telephony
      setVal('edit-contact-person', contact.contactPerson || contact.name);
      setVal('edit-contact-designation', contact.designation || '');
      setVal('edit-contact-phone', contact.phone || '');
      setVal('edit-contact-alt-phone', contact.altPhone || '');
      setVal('edit-contact-email', contact.email || '');
      setVal('edit-contact-billing-email', contact.billingEmail || '');
      setVal('edit-contact-secondary-person', contact.secondaryContactPerson || '');
      setVal('edit-contact-website', contact.website || '');

      // 3. Statutory & Tax Registration
      setVal('edit-contact-gstin', contact.gstin || '');
      setVal('edit-contact-pan', contact.pan || '');
      setVal('edit-contact-fssai', contact.fssai || contact.fssaiNumber || '');
      setVal('edit-contact-cin', contact.cin || '');
      setVal('edit-contact-msme', contact.msme || '');
      setVal('edit-contact-factory-license', contact.factoryLicense || '');

      // 4. Operating Facilities & Addresses
      setVal('edit-contact-billing', contact.billingAddress || contact.address || '');
      setVal('edit-contact-shipping', contact.shippingAddress || contact.address || '');
      setVal('edit-contact-city', contact.city || '');
      setVal('edit-contact-state', contact.state || '');
      setVal('edit-contact-pincode', contact.pincode || '');
      setVal('edit-contact-landmark', contact.landmark || '');

      // 5. Banking & Payout Coordinates
      setVal('edit-contact-bank-name', contact.bankDetails?.bankName || contact.bankName || '');
      setVal('edit-contact-beneficiary-name', contact.bankDetails?.beneficiaryName || contact.beneficiaryName || contact.contactPerson || contact.name || '');
      setVal('edit-contact-ifsc', contact.bankDetails?.ifsc || contact.ifsc || '');
      setVal('edit-contact-acc-no', contact.bankDetails?.accountNumber || contact.accountNumber || '');
      setVal('edit-contact-confirm-acc-no', contact.bankDetails?.accountNumber || contact.accountNumber || '');
      setVal('edit-contact-branch', contact.bankDetails?.branch || contact.branch || '');
      setVal('edit-contact-upi', contact.bankDetails?.upiId || contact.upiId || '');
      setVal('edit-contact-terms', contact.paymentTerms || '');

      // 6. Commercial Terms, Capacity & Notes
      setVal('edit-contact-credit-limit', contact.creditLimit || '');
      setVal('edit-contact-credit-period', contact.creditPeriod || '');
      setVal('edit-contact-trade-discount', contact.tradeDiscount || '');
      setVal('edit-contact-specialties', contact.specialties || '');
      setVal('edit-contact-capacity', contact.capacity || '');

      // Logo Avatar Preview
      this.updateProfileLogoPreview(contact.logo || contact.logoUrl || '', contact.name);

      // Related Orders Count
      const linkedOrders = (this.data.orders || []).filter(o =>
        o.retailerId === contact.id || o.manufacturerId === contact.id ||
        o.packagingVendorId === contact.id || o.marketeerId === contact.id ||
        o.transporterId === contact.id
      );
      if (ordersCountEl) ordersCountEl.innerText = linkedOrders.length;

      this.editingAltPhones = contact.altPhones ? [...contact.altPhones] : [];
      this.editingAltEmails = contact.altEmails ? [...contact.altEmails] : [];
      this.editingAltContacts = contact.altContacts ? [...contact.altContacts] : [];
      setVal('edit-contact-card-notes', contact.cardNotes || '');
      this.renderContactAltPills();

      const ratesSec = document.getElementById('edit-contact-rates-section');
      if (ratesSec) {
        if (contact.role === 'retailer') {
          ratesSec.classList.remove('hidden');
          setVal('edit-contact-rate-500g', contact.agreedRates?.['500g'] || '');
          setVal('edit-contact-rate-1kg', contact.agreedRates?.['1kg'] || '');
          setVal('edit-contact-rate-5kg', contact.agreedRates?.['5kg'] || '');
        } else {
          ratesSec.classList.add('hidden');
        }
      }

      // Configure Header Quick Contact Actions: WhatsApp & Email
      const waBtn = document.getElementById('btn-profile-whatsapp');
      const emailBtn = document.getElementById('btn-profile-email');
      const phoneDigits = (contact.phone || '').replace(/[^0-9]/g, '');
      const waDigits = phoneDigits.length === 10 ? '91' + phoneDigits : phoneDigits;
      if (waBtn) {
        if (waDigits) {
          waBtn.href = tfSafeUrl(`https://api.whatsapp.com/send?phone=${waDigits}`);
          waBtn.classList.remove('hidden');
        } else {
          waBtn.classList.add('hidden');
        }
      }
      if (emailBtn) {
        const mailTarget = contact.email || contact.billingEmail;
        if (mailTarget && mailTarget.trim()) {
          emailBtn.href = tfSafeUrl(`mailto:${mailTarget.trim()}`);
          emailBtn.classList.remove('hidden');
        } else {
          emailBtn.classList.add('hidden');
        }
      }
    }

    if (isNew) {
      const waBtn = document.getElementById('btn-profile-whatsapp');
      const emailBtn = document.getElementById('btn-profile-email');
      if (waBtn) waBtn.classList.add('hidden');
      if (emailBtn) emailBtn.classList.add('hidden');
    }

    // Toggle state: open smart studio if adding new partner; collapse when editing so profile is clean
    this.toggleSmartFillerStudio(isNew);

    // Initialize Gemini key status label
    const savedKey = localStorage.getItem('tradeflow_gemini_api_key');
    const keyLabel = document.getElementById('smart-key-status-label');
    const keyInput = document.getElementById('smart-gemini-api-key');
    if (savedKey) {
      if (keyLabel) keyLabel.innerText = 'AI Vision Key Active';
      if (keyInput) keyInput.value = savedKey;
    } else {
      if (keyLabel) keyLabel.innerText = 'AI Vision Key (Optional)';
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    const smartInput = document.getElementById('smart-contact-text-input');
    if (smartInput && isNew) smartInput.focus();
  }

  toggleSmartFillerStudio(forceState) {
    const container = document.getElementById('ai-smart-filler-studio-container');
    const label = document.getElementById('label-toggle-smart-studio');
    const icon = document.getElementById('icon-toggle-smart-studio');
    if (!container) return;

    const isHidden = container.classList.contains('hidden');
    const shouldOpen = forceState !== undefined ? forceState : isHidden;

    if (shouldOpen) {
      container.classList.remove('hidden');
      if (label) label.innerText = 'Close AI Smart Filler Studio';
      if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
      container.classList.add('hidden');
      if (label) label.innerText = 'Open AI Smart Filler Studio';
      if (icon) icon.style.transform = 'rotate(0deg)';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  updateProfileLogoPreview(logoSrc, name = '') {
    const previewEl = document.getElementById('edit-contact-logo-preview');
    const dataInput = document.getElementById('edit-contact-logo-data');
    const urlInput = document.getElementById('edit-contact-logo-url');
    if (!previewEl) return;

    if (logoSrc && String(logoSrc).trim()) {
      const cleanSrc = String(logoSrc).trim();
      previewEl.innerHTML = `<img src="${tfEscapeHtml(tfSafeUrl(cleanSrc))}" alt="Logo" class="w-full h-full object-contain bg-white dark:bg-slate-900 p-1 rounded-2xl" onerror="this.onerror=null; if (this.parentElement) this.parentElement.innerHTML='<span class=\\'font-black text-xl text-amber-500\\'>${tfEscapeHtml(tfEscapeJs((name||'CO').substring(0,2).toUpperCase()))}</span>';">`;
      if (dataInput) dataInput.value = cleanSrc;
      if (urlInput && !cleanSrc.startsWith('data:')) urlInput.value = cleanSrc;
    } else {
      const initials = (name || 'CO').trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'CO';
      previewEl.innerHTML = `<span id="edit-contact-logo-initials" class="font-black text-xl text-amber-500 dark:text-amber-400">${tfEscapeHtml(initials)}</span>`;
      if (dataInput) dataInput.value = '';
    }
  }

  handleProfileLogoFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.showToast('Please select a valid image file (PNG, JPG, WebP, SVG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      const compName = document.getElementById('edit-contact-name')?.value || 'Company';
      this.updateProfileLogoPreview(base64Data, compName);
      this.showToast('Company logo loaded! Click "Save Profile" to apply.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  onProfileLogoUrlChange(url) {
    const compName = document.getElementById('edit-contact-name')?.value || 'Company';
    this.updateProfileLogoPreview(url, compName);
  }

  removeProfileLogo() {
    const compName = document.getElementById('edit-contact-name')?.value || 'Company';
    const urlInput = document.getElementById('edit-contact-logo-url');
    if (urlInput) urlInput.value = '';
    this.updateProfileLogoPreview('', compName);
    this.showToast('Company logo cleared.');
  }

  viewRelatedOrdersFromProfile() {
    const contactId = this.currentProfileContactId || document.getElementById('edit-contact-id')?.value;
    if (!contactId) {
      this.showToast('No company selected.');
      return;
    }
    this.closeEditContactModal();
    this.openPartnerSpotlightModal(contactId);
  }

  updateContactRoleBadge(role) {
    const roleBadge = document.getElementById('edit-contact-role-badge');
    if (!roleBadge) return;
    const roleLabels = {
      manufacturer: 'Manufacturer (Contract Manufacturing)',
      packaging: 'Packaging & Labels Supplier',
      transporter: 'Freight & Logistics Partner',
      retailer: 'Retailer / Buyer Account',
      marketeer: 'Sales Marketeer (Trade Broker)'
    };
    roleBadge.innerText = roleLabels[role] || role;
    if (role === 'manufacturer') {
      roleBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    } else if (role === 'retailer') {
      roleBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
    } else if (role === 'packaging') {
      roleBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
    } else if (role === 'marketeer') {
      roleBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    } else {
      roleBadge.className = 'px-2.5 py-0.5 text-xs font-bold rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
    }
  }

  onContactRoleSelectChange(role) {
    this.updateContactRoleBadge(role);
    const ratesSec = document.getElementById('edit-contact-rates-section');
    if (ratesSec) {
      if (role === 'retailer') ratesSec.classList.remove('hidden');
      else ratesSec.classList.add('hidden');
    }
  }

  closeEditContactModal() {
    const modal = document.getElementById('contact-edit-modal');
    if (modal) modal.classList.add('hidden');
    window.TradeFlowSmartFill?.discardPendingPartnerArchive?.();
    this.clearContactAutofillHighlights();
  }

  /* ---------- SMART AUTOFILL & DOCUMENT SCANNER CONTROLS ---------- */
  switchSmartInputTab(tab) {
    const btnText = document.getElementById('tab-smart-paste-text');
    const btnFile = document.getElementById('tab-smart-paste-file');
    const panelText = document.getElementById('smart-text-panel');
    const panelFile = document.getElementById('smart-file-panel');

    if (tab === 'text') {
      if (btnText) {
        btnText.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-2xs flex items-center gap-1.5 transition-all';
      }
      if (btnFile) {
        btnFile.className = 'px-3 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all';
      }
      if (panelText) panelText.classList.remove('hidden');
      if (panelFile) panelFile.classList.add('hidden');
      document.getElementById('smart-contact-text-input')?.focus();
    } else {
      if (btnFile) {
        btnFile.className = 'px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-2xs flex items-center gap-1.5 transition-all';
      }
      if (btnText) {
        btnText.className = 'px-3 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all';
      }
      if (panelFile) panelFile.classList.remove('hidden');
      if (panelText) panelText.classList.add('hidden');
    }
  }

  loadSampleContactText() {
    this.toggleSmartFillerStudio(true);
    this.switchSmartInputTab('text');
    const input = document.getElementById('smart-contact-text-input');
    if (input) {
      input.value = `Shree Ganesh Traders
Contact: Rajesh Gupta
Phone: +91 98200 12345
Email: ganesh.traders@gmail.com
GSTIN: 27AABCG1234F1Z9
FSSAI: 11521018000342
Address: Shop 14, APMC Market, Sector 19, Vashi, Navi Mumbai, Maharashtra 400703
Bank: HDFC Bank
Account No: 50200045678912
IFSC: HDFC0000060
Payment Terms: Net 15 Days`;
      this.processSmartContactAutofill();
    }
  }

  clearContactSmartInput() {
    const input = document.getElementById('smart-contact-text-input');
    if (input) input.value = '';
    this.clearSmartFile();
    this.clearContactAutofillHighlights();
  }

  toggleSmartApiKeyInput() {
    const drawer = document.getElementById('smart-key-drawer');
    if (drawer) drawer.classList.toggle('hidden');
  }

  saveSmartGeminiApiKey() {
    const input = document.getElementById('smart-gemini-api-key');
    const val = input ? input.value.trim() : '';
    if (val) {
      localStorage.setItem('tradeflow_gemini_api_key', val);
      const keyLabel = document.getElementById('smart-key-status-label');
      if (keyLabel) keyLabel.innerText = 'AI Vision Key Active';
      this.showToast('Gemini Vision API key saved successfully!');
      this.toggleSmartApiKeyInput();
    } else {
      localStorage.removeItem('tradeflow_gemini_api_key');
      const keyLabel = document.getElementById('smart-key-status-label');
      if (keyLabel) keyLabel.innerText = 'AI Vision Key (Optional)';
      this.showToast('Gemini API key removed.');
    }
  }

  handleSmartDragOver(event) {
    event.preventDefault();
    const zone = document.getElementById('smart-dropzone');
    if (zone) zone.classList.add('border-emerald-500', 'bg-emerald-50/50', 'dark:bg-emerald-950/40');
  }

  handleSmartDragLeave(event) {
    event.preventDefault();
    const zone = document.getElementById('smart-dropzone');
    if (zone) zone.classList.remove('border-emerald-500', 'bg-emerald-50/50', 'dark:bg-emerald-950/40');
  }

  handleSmartDrop(event) {
    event.preventDefault();
    this.handleSmartDragLeave(event);
    const files = event.dataTransfer && event.dataTransfer.files;
    if (files && files.length > 0) {
      this.processSmartUploadFile(files[0]);
    }
  }

  handleSmartFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      this.processSmartUploadFile(file);
    }
  }

  clearSmartFile() {
    const previewContainer = document.getElementById('smart-file-preview-container');
    const fileInput = document.getElementById('smart-file-input');
    const thumb = document.getElementById('smart-file-thumb');
    if (previewContainer) previewContainer.classList.add('hidden');
    if (thumb) { thumb.src = tfSafeUrl(''); thumb.classList.add('hidden'); }
    if (fileInput) fileInput.value = '';
  }

  async processSmartUploadFile(file) {
    if (!file) return;
    this.toggleSmartFillerStudio(true);
    const previewContainer = document.getElementById('smart-file-preview-container');
    const fileNameEl = document.getElementById('smart-file-name');
    const fileSizeEl = document.getElementById('smart-file-size');
    const thumb = document.getElementById('smart-file-thumb');
    const statusEl = document.getElementById('smart-autofill-status');

    if (previewContainer) previewContainer.classList.remove('hidden');
    if (fileNameEl) fileNameEl.innerText = file.name;
    if (fileSizeEl) fileSizeEl.innerText = `${(file.size / 1024).toFixed(1)} KB`;

    // 1. If PDF: Extract text client-side via pdf.js
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      if (statusEl) {
        statusEl.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> <span>Extracting PDF text client-side...</span>`;
      }
      try {
        const ab = await file.arrayBuffer();
        const extractedText = await this.extractPdfText(ab);
        if (extractedText && extractedText.trim()) {
          const textInput = document.getElementById('smart-contact-text-input');
          if (textInput) textInput.value = extractedText;
          const extracted = this.parseContactText(extractedText);
          this.applyExtractedContact(extracted);
          this.showToast(`Extracted text and populated profile from PDF: ${file.name}`);
        } else {
          if (statusEl) statusEl.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> <span>PDF has no selectable text (scanned image). Use screenshot or paste text.</span>`;
        }
      } catch (err) {
        console.warn('PDF extraction failed:', err);
        if (statusEl) statusEl.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span> <span>Failed to read PDF.</span>`;
      }
      return;
    }

    // 2. If Image: Thumbnail preview + AI Vision scan & profile logo candidate
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        if (thumb) {
          thumb.src = tfSafeUrl(dataUrl);
          thumb.classList.remove('hidden');
        }

        // Set image as logo preview if no custom logo is set yet
        const currentLogo = document.getElementById('edit-contact-logo-data')?.value;
        if (!currentLogo) {
          const compName = document.getElementById('edit-contact-name')?.value || 'Company';
          this.updateProfileLogoPreview(dataUrl, compName);
        }

        if (statusEl) {
          statusEl.innerHTML = `<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span> <span>AI Scanning image for company profile details...</span>`;
        }

        // Try backend AI scan
        try {
          const resp = await fetch('/api/ai/test-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData: dataUrl,
              context: 'partner',
              apiKey: localStorage.getItem('tradeflow_gemini_api_key') || ''
            })
          });

          if (resp.ok) {
            const resJson = await resp.json();
            if (resJson.data && Object.keys(resJson.data).length > 0) {
              this.applyExtractedContact(resJson.data);
              this.showToast('AI Vision extracted company details successfully!');
              return;
            }
          }
        } catch (apiErr) {
          console.warn('Backend AI test-scan error:', apiErr);
        }

        // Direct Gemini API key fallback
        const apiKey = localStorage.getItem('tradeflow_gemini_api_key');
        if (apiKey) {
          try {
            const base64Data = dataUrl.split(',')[1];
            const mimeType = file.type || 'image/jpeg';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
            const prompt = `Extract all commercial business information from this visiting card, invoice header, or WhatsApp screenshot.
Return valid raw JSON only (no markdown, no quotes around json block) with keys:
{
  "name": "Company / Store / Trade Name",
  "brandName": "Brand / Trademark Name",
  "contactPerson": "Contact Person Name",
  "designation": "Designation / Role",
  "phone": "Phone number with +91 format if Indian",
  "altPhone": "Alternate Phone",
  "email": "Primary Email address",
  "billingEmail": "Billing Email address",
  "gstin": "15 character GSTIN",
  "pan": "10 character PAN",
  "fssai": "14 digit FSSAI license",
  "cin": "21 digit CIN",
  "msme": "MSME / Udyam Number",
  "address": "Full street and registered address",
  "city": "City",
  "state": "State",
  "pincode": "PIN Code",
  "bankName": "Bank Name",
  "beneficiaryName": "Beneficiary Account Name",
  "accountNumber": "Bank Account Number",
  "ifsc": "Bank IFSC Code",
  "branch": "Branch Name",
  "upiId": "UPI ID",
  "paymentTerms": "Payment Terms, e.g. Net 15 Days"
}`;
            const gResp = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: prompt },
                    { inline_data: { mime_type: mimeType, data: base64Data } }
                  ]
                }]
              })
            });

            if (gResp.ok) {
              const resJson = await gResp.json();
              const rawReply = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const cleanJsonStr = rawReply.replace(/```json/gi, '').replace(/```/g, '').trim();
              const parsedData = JSON.parse(cleanJsonStr);
              this.applyExtractedContact(parsedData);
              this.showToast('Gemini Vision extracted profile details successfully!');
              return;
            }
          } catch (aiErr) {
            console.warn('Gemini extraction error:', aiErr);
          }
        }

        // Informative guidance fallback
        if (statusEl) {
          statusEl.innerHTML = `
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Image loaded as company logo! Paste text in Tab 2 or click [Try Sample Text] for instant AI populating.</span>
          `;
        }
      };
      reader.readAsDataURL(file);
    }
  }

  // Multi-pass Intelligent Indian Commercial Text Parser
  parseContactText(rawText) {
    if (!rawText || !rawText.trim()) return {};
    const text = rawText.trim();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const result = {};

    // 1. Phone Numbers: Match all 10-digit Indian phones
    const phoneMatches = text.match(/(?:(?:\+?91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}|(?:\+?91[\-\s]?)?[6-9]\d{9})/g) || [];
    const uniquePhones = [];
    phoneMatches.forEach(m => {
      const digits = m.replace(/\D/g, '').slice(-10);
      if (digits.length === 10) {
        const formatted = `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
        if (!uniquePhones.includes(formatted)) uniquePhones.push(formatted);
      }
    });
    if (uniquePhones.length > 0) {
      result.phone = uniquePhones[0];
      if (uniquePhones.length > 1) {
        result.altPhone = uniquePhones[1];
        result.altPhones = uniquePhones.slice(1);
      }
    }

    // 2. Email Addresses: Match all emails
    const emailMatches = text.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) || [];
    const uniqueEmails = [];
    emailMatches.forEach(em => {
      const cleanEm = em.toLowerCase().trim();
      if (!uniqueEmails.includes(cleanEm)) uniqueEmails.push(cleanEm);
    });
    if (uniqueEmails.length > 0) {
      result.email = uniqueEmails[0];
      if (uniqueEmails.length > 1) {
        result.billingEmail = uniqueEmails[1];
        result.altEmails = uniqueEmails.slice(1);
      }
    }

    // 3. GSTIN (15 characters: 2 state + 5 pan letters + 4 pan digits + 1 pan letter + 1 entity + Z + 1 check)
    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
    if (gstinMatch) {
      result.gstin = gstinMatch[1].toUpperCase();
      result.pan = result.gstin.substring(2, 12);

      const stateCode = result.gstin.substring(0, 2);
      const gstStateMap = {
        '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
        '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
        '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
        '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
        '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
        '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
        '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka',
        '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
        '34': 'Puducherry', '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh'
      };
      if (gstStateMap[stateCode]) {
        result.state = gstStateMap[stateCode];
      }
    }

    // 4. Standalone PAN (if not already found via GSTIN)
    if (!result.pan) {
      const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/i);
      if (panMatch) {
        result.pan = panMatch[1].toUpperCase();
      }
    }

    // 5. FSSAI License Number (14 digits)
    const fssaiMatch = text.match(/(?:fssai(?:\s*(?:lic(?:ense)?|no|number|#))?[:\s]*)(\d{14})\b/i) ||
                       text.match(/\b([12]\d{13})\b/);
    if (fssaiMatch) {
      result.fssai = fssaiMatch[1];
    }

    // 6. CIN (21 characters)
    const cinMatch = text.match(/\b([UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6})\b/i);
    if (cinMatch) {
      result.cin = cinMatch[1].toUpperCase();
    }

    // 7. MSME / Udyam Number
    const msmeMatch = text.match(/\b(UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7})\b/i);
    if (msmeMatch) {
      result.msme = msmeMatch[1].toUpperCase();
    }

    // 8. Bank Details: IFSC, Account Number, Bank Name, Branch, UPI
    const ifscMatch = text.match(/\b([A-Z]{4}0[A-Z0-9]{6})\b/i);
    if (ifscMatch) {
      result.ifsc = ifscMatch[1].toUpperCase();
    }

    const accMatch = text.match(/(?:a\/c|acc(?:ount)?(?:\s*(?:no|number|num))?)[:\s]*(\d{9,18})\b/i) ||
                     text.match(/\baccount\s*[:\-]?\s*(\d{9,18})\b/i);
    if (accMatch) {
      result.accountNumber = accMatch[1];
    }

    const bankNameMatch = text.match(/\b(HDFC(?:\s*Bank)?|ICICI(?:\s*Bank)?|SBI|State\s*Bank\s*of\s*India|Axis(?:\s*Bank)?|Kotak(?:\s*Mahindra)?(?:\s*Bank)?|Bank\s*of\s*Baroda|Punjab\s*National\s*Bank|PNB|Canara\s*Bank|IndusInd(?:\s*Bank)?|Federal\s*Bank|IDFC\s*(?:FIRST)?(?:\s*Bank)?|Yes\s*Bank|Union\s*Bank\s*of\s*India)\b/i);
    if (bankNameMatch) {
      result.bankName = bankNameMatch[1].trim();
    }

    const branchMatch = text.match(/(?:branch|br\.)[:\s]*([^\n,;]+)/i);
    if (branchMatch) {
      result.branch = branchMatch[1].trim();
    }

    const upiMatch = text.match(/\b([a-zA-Z0-9.\-_]{2,64}@(?!gmail|yahoo|outlook|hotmail|icloud)[a-zA-Z]{2,64})\b/i);
    if (upiMatch) {
      result.upiId = upiMatch[1].toLowerCase().trim();
    }

    // 9. Payment Terms
    const termsMatch = text.match(/(?:payment\s*terms|terms)[:\s]*([^\n,;]+)/i) ||
                       text.match(/\b(Net\s*\d+\s*(?:Days)?|100%\s*Advance|\d+%\s*Advance|Advance\s*on\s*Delivery|Cash\s*on\s*Delivery|Immediate|COD)\b/i);
    if (termsMatch) {
      result.paymentTerms = termsMatch[1].trim();
    }

    // 10. Credit Limit, Period, Discount
    const credLimitMatch = text.match(/(?:credit\s*limit)[:\s]*(?:₹|rs\.?)?\s*([\d,]+)/i);
    if (credLimitMatch) {
      result.creditLimit = credLimitMatch[1].replace(/,/g, '');
    }
    const credDaysMatch = text.match(/(?:credit\s*(?:period|days))[:\s]*(\d+)/i);
    if (credDaysMatch) {
      result.creditPeriod = credDaysMatch[1];
    }
    const discMatch = text.match(/(?:trade\s*discount|discount)[:\s]*(\d+(?:\.\d+)?)\s*%/i);
    if (discMatch) {
      result.tradeDiscount = discMatch[1];
    }

    // 11. Contact Person & Designation
    const personMatch = text.match(/(?:contact(?:\s*person)?|person|prop(?:rietor)?|owner|manager|attn|attention|mr\.?|ms\.?)[:\s]+([A-Za-z\s.]{3,35})(?=\n|$|,)/i);
    if (personMatch) {
      result.contactPerson = personMatch[1].trim();
    }

    const desigMatch = text.match(/(?:designation|role|title)[:\s]+([A-Za-z\s.]{3,35})(?=\n|$|,)/i);
    if (desigMatch) {
      result.designation = desigMatch[1].trim();
    }

    // 12. Brand Name
    const brandMatch = text.match(/(?:brand(?:\s*name)?|trade\s*mark)[:\s]+([^\n,]+)/i);
    if (brandMatch) {
      result.brandName = brandMatch[1].trim();
    }

    // 13. Company / Trade Name
    const companyPrefixMatch = text.match(/(?:company(?:\s*name)?|firm(?:\s*name)?|m\/s\.?|business(?:\s*name)?)[:\s]+([^\n,]+)/i);
    if (companyPrefixMatch) {
      result.name = companyPrefixMatch[1].replace(/^[*\s]+|[*\s]+$/g, '').trim();
    } else {
      for (const line of lines) {
        const cleanLine = line.replace(/^[*_~#\-\s]+|[*_~#\-\s]+$/g, '').trim();
        if (cleanLine.includes('@') || /(?:phone|mobile|gst|fssai|bank|ifsc|account|terms)/i.test(cleanLine)) continue;
        if (/(?:pvt\s*ltd|ltd|limited|enterprises|traders|trading|foods|industries|spices|products|agency|stores|mart|supermarket|bazaar)/i.test(cleanLine)) {
          result.name = cleanLine;
          break;
        }
      }
    }

    // Fallbacks for name & contactPerson if still missing
    if (!result.name && lines.length > 0) {
      const candidate0 = lines[0].replace(/^[*_~#\-\s]+|[*_~#\-\s]+$/g, '').trim();
      if (!candidate0.includes('@') && !/(?:phone|mobile|gst|fssai|bank|ifsc|a\/c|address)/i.test(candidate0)) {
        result.name = candidate0;
      }
    }
    if (!result.contactPerson && lines.length > 1) {
      const candidate1 = lines[1].replace(/^[*_~#\-\s]+|[*_~#\-\s]+$/g, '').trim();
      if (!candidate1.includes('@') && !/(?:phone|mobile|gst|fssai|bank|ifsc|a\/c|address)/i.test(candidate1) && candidate1.split(' ').length <= 4) {
        result.contactPerson = candidate1;
      }
    }

    // 14. Address & PIN Code Extraction
    const pinMatch = text.match(/\b([1-9][0-9]{5})\b/);
    if (pinMatch) {
      result.pincode = pinMatch[1];
    }

    const addrPrefixMatch = text.match(/(?:billing\s*)?address[:\s]+([\s\S]+?)(?=(?:\n\s*(?:shipping|bank|ifsc|a\/c|gst|fssai|phone|email|terms|contact)|$))/i);
    if (addrPrefixMatch) {
      result.address = addrPrefixMatch[1].replace(/\n+/g, ', ').trim();
    } else {
      const addrLines = [];
      for (const line of lines) {
        if (/(?:plot|shop|gala|road|street|sector|midc|gidc|estate|lane|nagar|phase|near|opp|behind|dist|pincode|pin\s*\d|mumbai|delhi|pune|ahmedabad|jaipur|bengaluru|kolkata|hyderabad|chennai|\b\d{6}\b)/i.test(line)) {
          if (!/(?:gst|fssai|bank|ifsc|a\/c|account\s*no|phone|mobile|email)/i.test(line)) {
            addrLines.push(line.replace(/^address[:\s]*/i, '').trim());
          }
        }
      }
      if (addrLines.length > 0) {
        result.address = addrLines.join(', ');
      }
    }

    // Detect City from address or text
    const cities = ['Navi Mumbai', 'Mumbai', 'Sonipat', 'Ahmedabad', 'Delhi', 'Pune', 'Rajkot', 'Surat', 'Jaipur', 'Indore', 'Bhopal', 'Vadodara', 'Thane', 'Nagpur', 'Hyderabad', 'Bengaluru', 'Chennai', 'Kolkata'];
    for (const city of cities) {
      if (new RegExp(`\\b${city}\\b`, 'i').test(text)) {
        result.city = city;
        break;
      }
    }

    return result;
  }

  processSmartContactAutofill() {
    const input = document.getElementById('smart-contact-text-input');
    const rawText = input ? input.value.trim() : '';
    if (!rawText) {
      this.showToast('Please paste text or drop a file in the box first.');
      return;
    }

    const extracted = this.parseContactText(rawText);
    this.applyExtractedContact(extracted);
  }

  applyExtractedContact(extracted) {
    if (!extracted || typeof extracted !== 'object') return;
    let autoFilledCount = 0;

    const setAndHighlight = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && String(val).trim() !== '') {
        el.value = String(val).trim();
        this.markFieldAutofilled(el);
        autoFilledCount++;
        return true;
      }
      return false;
    };

    // 1. Identity & Branding
    if (extracted.name) setAndHighlight('edit-contact-name', extracted.name);
    if (extracted.brandName) setAndHighlight('edit-contact-brand-name', extracted.brandName);
    if (extracted.businessNature) setAndHighlight('edit-contact-business-nature', extracted.businessNature);
    if (extracted.bio) setAndHighlight('edit-contact-bio', extracted.bio);

    // 2. Key Personnel & Telephony
    if (extracted.contactPerson) setAndHighlight('edit-contact-person', extracted.contactPerson);
    if (extracted.designation) setAndHighlight('edit-contact-designation', extracted.designation);
    if (extracted.phone) setAndHighlight('edit-contact-phone', extracted.phone);
    if (extracted.altPhone || (extracted.altPhones && extracted.altPhones[0])) {
      setAndHighlight('edit-contact-alt-phone', extracted.altPhone || extracted.altPhones[0]);
    }
    if (extracted.email) setAndHighlight('edit-contact-email', extracted.email);
    if (extracted.billingEmail || (extracted.altEmails && extracted.altEmails[0])) {
      setAndHighlight('edit-contact-billing-email', extracted.billingEmail || extracted.altEmails[0]);
    }
    if (extracted.secondaryContactPerson || (extracted.altContacts && extracted.altContacts[0])) {
      setAndHighlight('edit-contact-secondary-person', extracted.secondaryContactPerson || extracted.altContacts[0]);
    }
    if (extracted.website) setAndHighlight('edit-contact-website', extracted.website);

    // 3. Statutory & Tax Registration
    if (extracted.gstin) setAndHighlight('edit-contact-gstin', extracted.gstin);
    if (extracted.pan) setAndHighlight('edit-contact-pan', extracted.pan);
    if (extracted.fssai) setAndHighlight('edit-contact-fssai', extracted.fssai);
    if (extracted.cin) setAndHighlight('edit-contact-cin', extracted.cin);
    if (extracted.msme) setAndHighlight('edit-contact-msme', extracted.msme);
    if (extracted.factoryLicense) setAndHighlight('edit-contact-factory-license', extracted.factoryLicense);

    // 4. Operating Facilities & Addresses
    if (extracted.address || extracted.billingAddress) {
      setAndHighlight('edit-contact-billing', extracted.address || extracted.billingAddress);
    }
    if (extracted.shippingAddress || extracted.address) {
      setAndHighlight('edit-contact-shipping', extracted.shippingAddress || extracted.address);
    }
    if (extracted.city) setAndHighlight('edit-contact-city', extracted.city);
    if (extracted.state) setAndHighlight('edit-contact-state', extracted.state);
    if (extracted.pincode) setAndHighlight('edit-contact-pincode', extracted.pincode);
    if (extracted.landmark) setAndHighlight('edit-contact-landmark', extracted.landmark);

    // 5. Banking & Payout Coordinates
    if (extracted.bankName) setAndHighlight('edit-contact-bank-name', extracted.bankName);
    if (extracted.beneficiaryName || extracted.contactPerson || extracted.name) {
      setAndHighlight('edit-contact-beneficiary-name', extracted.beneficiaryName || extracted.contactPerson || extracted.name);
    }
    if (extracted.accountNumber) {
      setAndHighlight('edit-contact-acc-no', extracted.accountNumber);
      setAndHighlight('edit-contact-confirm-acc-no', extracted.accountNumber);
    }
    if (extracted.ifsc) setAndHighlight('edit-contact-ifsc', extracted.ifsc);
    if (extracted.branch) setAndHighlight('edit-contact-branch', extracted.branch);
    if (extracted.upiId) setAndHighlight('edit-contact-upi', extracted.upiId);
    if (extracted.paymentTerms) setAndHighlight('edit-contact-terms', extracted.paymentTerms);

    // 6. Commercial Terms & Offerings
    if (extracted.creditLimit) setAndHighlight('edit-contact-credit-limit', extracted.creditLimit);
    if (extracted.creditPeriod) setAndHighlight('edit-contact-credit-period', extracted.creditPeriod);
    if (extracted.tradeDiscount) setAndHighlight('edit-contact-trade-discount', extracted.tradeDiscount);
    if (extracted.specialties) setAndHighlight('edit-contact-specialties', extracted.specialties);
    if (extracted.capacity) setAndHighlight('edit-contact-capacity', extracted.capacity);

    if (extracted.altPhones && Array.isArray(extracted.altPhones)) {
      this.editingAltPhones = extracted.altPhones;
    }
    if (extracted.altEmails && Array.isArray(extracted.altEmails)) {
      this.editingAltEmails = extracted.altEmails;
    }
    if (extracted.altContacts && Array.isArray(extracted.altContacts)) {
      this.editingAltContacts = extracted.altContacts;
    }
    if (extracted.cardNotes) {
      const notesEl = document.getElementById('edit-contact-card-notes');
      if (notesEl) {
        notesEl.value = extracted.cardNotes;
        this.markFieldAutofilled(notesEl);
        autoFilledCount++;
      }
    }
    this.renderContactAltPills();

    // Set logo if present
    if (extracted.logo || extracted.logoUrl) {
      this.updateProfileLogoPreview(extracted.logo || extracted.logoUrl, extracted.name || 'Company');
    }

    const statusEl = document.getElementById('smart-autofill-status');
    if (statusEl) {
      if (autoFilledCount > 0) {
        statusEl.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="font-bold text-emerald-700 dark:text-emerald-300">${tfEscapeHtml(autoFilledCount)} profile fields automatically populated in light green!</span>
          <span class="text-slate-500 dark:text-slate-400">Review or adjust any field below.</span>
        `;
      } else {
        statusEl.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span class="font-medium text-amber-700 dark:text-amber-300">No matching fields detected. Please check the text format.</span>
        `;
      }
    }

    if (autoFilledCount > 0) {
      this.showToast(`Smart Auto-Fill: Populated ${autoFilledCount} fields in light green!`);
    }
  }

  markFieldAutofilled(el) {
    if (!el) return;
    el.classList.add('autofill-highlight', 'autofill-pop');
    el.dataset.autofilled = 'true';

    // Add visual badge to label if available
    const parent = el.closest('div');
    const label = parent ? parent.querySelector('label') : null;
    if (label && !label.querySelector('.autofill-badge')) {
      const badge = document.createElement('span');
      badge.className = 'autofill-badge';
      badge.innerHTML = `<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> Auto-filled`;
      label.appendChild(badge);
    }

    // Attach listener to smoothly remove highlight when user manually modifies the field
    const clearOnEdit = () => {
      el.classList.remove('autofill-highlight');
      delete el.dataset.autofilled;
      const b = label ? label.querySelector('.autofill-badge') : null;
      if (b) b.remove();
      el.removeEventListener('input', clearOnEdit);
    };
    el.addEventListener('input', clearOnEdit, { once: true });
  }

  clearContactAutofillHighlights() {
    const modal = document.getElementById('contact-edit-modal');
    if (!modal) return;
    modal.querySelectorAll('.autofill-highlight').forEach(el => {
      el.classList.remove('autofill-highlight', 'autofill-pop');
      delete el.dataset.autofilled;
    });
    modal.querySelectorAll('.autofill-badge').forEach(b => b.remove());
    const statusEl = document.getElementById('smart-autofill-status');
    if (statusEl) {
      statusEl.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-slate-400"></span>
        <span>Highlights cleared. Ready to extract or edit manually.</span>
      `;
    }
  }

  handleSaveContact(e) {
    if (e && e.preventDefault) e.preventDefault();
    const contactId = document.getElementById('edit-contact-id')?.value;
    let contact = (this.data.contacts || []).find(c => c.id === contactId);

    const isNew = !contact;
    const roleSelect = document.getElementById('edit-contact-role-select');
    const selectedRole = roleSelect ? roleSelect.value : 'retailer';

    const newName = (document.getElementById('edit-contact-name')?.value || '').trim();
    const newPhone = (document.getElementById('edit-contact-phone')?.value || '').trim();
    const newPerson = (document.getElementById('edit-contact-person')?.value || '').trim();
    const newEmail = (document.getElementById('edit-contact-email')?.value || '').trim();
    const newWebsite = (document.getElementById('edit-contact-website')?.value || '').trim();
    const newGstin = (document.getElementById('edit-contact-gstin')?.value || '').trim().toUpperCase();
    const newPan = (document.getElementById('edit-contact-pan')?.value || '').trim().toUpperCase();
    const newFssai = (document.getElementById('edit-contact-fssai')?.value || '').trim();
    const newTerms = (document.getElementById('edit-contact-terms')?.value || '').trim();
    const newBilling = (document.getElementById('edit-contact-billing')?.value || '').trim();
    const newShipping = (document.getElementById('edit-contact-shipping')?.value || '').trim();
    const newBankName = (document.getElementById('edit-contact-bank-name')?.value || '').trim();
    const newAccNo = (document.getElementById('edit-contact-acc-no')?.value || '').trim();
    const newIfsc = (document.getElementById('edit-contact-ifsc')?.value || '').trim().toUpperCase();

    // Additional Dossier Fields
    const newBrandName = (document.getElementById('edit-contact-brand-name')?.value || '').trim();
    const newStatus = (document.getElementById('edit-contact-status')?.value || 'active').trim();
    const newBusinessNature = (document.getElementById('edit-contact-business-nature')?.value || '').trim();
    const newLogoData = (document.getElementById('edit-contact-logo-data')?.value || '').trim();
    const newLogoUrl = (document.getElementById('edit-contact-logo-url')?.value || '').trim();
    const newBio = (document.getElementById('edit-contact-bio')?.value || '').trim();
    const newDesignation = (document.getElementById('edit-contact-designation')?.value || '').trim();
    const newAltPhone = (document.getElementById('edit-contact-alt-phone')?.value || '').trim();
    const newBillingEmail = (document.getElementById('edit-contact-billing-email')?.value || '').trim();
    const newSecondaryPerson = (document.getElementById('edit-contact-secondary-person')?.value || '').trim();
    const newCin = (document.getElementById('edit-contact-cin')?.value || '').trim().toUpperCase();
    const newMsme = (document.getElementById('edit-contact-msme')?.value || '').trim().toUpperCase();
    const newFactoryLicense = (document.getElementById('edit-contact-factory-license')?.value || '').trim();
    const newCity = (document.getElementById('edit-contact-city')?.value || '').trim();
    const newState = (document.getElementById('edit-contact-state')?.value || '').trim();
    const newPincode = (document.getElementById('edit-contact-pincode')?.value || '').trim();
    const newLandmark = (document.getElementById('edit-contact-landmark')?.value || '').trim();
    const newBeneficiaryName = (document.getElementById('edit-contact-beneficiary-name')?.value || '').trim();
    const newBranch = (document.getElementById('edit-contact-branch')?.value || '').trim();
    const newUpi = (document.getElementById('edit-contact-upi')?.value || '').trim();
    const newCreditLimit = parseFloat(document.getElementById('edit-contact-credit-limit')?.value) || 0;
    const newCreditPeriod = parseInt(document.getElementById('edit-contact-credit-period')?.value) || 0;
    const newTradeDiscount = parseFloat(document.getElementById('edit-contact-trade-discount')?.value) || 0;
    const newSpecialties = (document.getElementById('edit-contact-specialties')?.value || '').trim();
    const newCapacity = (document.getElementById('edit-contact-capacity')?.value || '').trim();

    if (!newName) {
      this.showToast('Company / Trade Name is required.');
      return;
    }
    if (!newPhone) {
      this.showToast('Phone Number is required.');
      return;
    }

    // Bank Detail Protection Guard Check: If editing existing contact, detect any altered bank credentials
    if (!isNew && !this.isBankProtectionBypassed) {
      const oldBank = contact.bankDetails || {};
      const oldBankName = (contact.bankName || oldBank.bankName || '').trim();
      const oldAccNo = (contact.accountNumber || oldBank.accountNumber || '').trim();
      const oldIfsc = (contact.ifsc || oldBank.ifsc || '').trim().toUpperCase();
      const oldBeneficiary = (contact.beneficiaryName || oldBank.beneficiaryName || '').trim();
      const oldUpi = (contact.upiId || oldBank.upiId || '').trim();

      const diffs = [];
      if (oldBankName && newBankName && oldBankName.toLowerCase() !== newBankName.toLowerCase()) {
        diffs.push({ label: 'Bank Name', old: oldBankName, new: newBankName });
      }
      if (oldAccNo && newAccNo && oldAccNo !== newAccNo) {
        diffs.push({ label: 'Account Number', old: oldAccNo, new: newAccNo });
      }
      if (oldIfsc && newIfsc && oldIfsc.toUpperCase() !== newIfsc.toUpperCase()) {
        diffs.push({ label: 'IFSC Code', old: oldIfsc, new: newIfsc });
      }
      if (oldBeneficiary && newBeneficiaryName && oldBeneficiary.toLowerCase() !== newBeneficiaryName.toLowerCase()) {
        diffs.push({ label: 'Beneficiary Name', old: oldBeneficiary, new: newBeneficiaryName });
      }
      if (oldUpi && newUpi && oldUpi.toLowerCase() !== newUpi.toLowerCase()) {
        diffs.push({ label: 'UPI Handle', old: oldUpi, new: newUpi });
      }

      if (diffs.length > 0) {
        this.promptBankProtectionChange(contact, diffs);
        return;
      }
    }

    if (isNew) {
      contact = {
        id: contactId || this.nextContactId(),
        role: selectedRole,
        currentBalanceDue: 0,
        totalOrders: 0
      };
      if (!this.data.contacts) this.data.contacts = [];
      this.data.contacts.push(contact);
    }

    const oldName = contact.name;
    contact.name = newName;
    contact.role = selectedRole;
    contact.phone = newPhone;
    
    // Strict Non-Destructive Cumulative Merge: empty fields never wipe out existing data
    const mergeField = (key, val) => {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        contact[key] = val;
      }
    };

    mergeField('brandName', newBrandName);
    mergeField('status', newStatus);
    mergeField('businessNature', newBusinessNature);
    if (newLogoData || newLogoUrl) {
      contact.logo = newLogoData || newLogoUrl;
      contact.logoUrl = newLogoUrl;
    }
    mergeField('bio', newBio);

    mergeField('altPhone', newAltPhone);
    if (newPerson) contact.contactPerson = newPerson;
    mergeField('designation', newDesignation);
    mergeField('email', newEmail);
    mergeField('billingEmail', newBillingEmail);
    mergeField('secondaryContactPerson', newSecondaryPerson);
    mergeField('website', newWebsite);

    mergeField('gstin', newGstin);
    mergeField('pan', newPan);
    if (newFssai) {
      contact.fssai = newFssai;
      contact.fssaiNumber = newFssai;
    }
    mergeField('cin', newCin);
    mergeField('msme', newMsme);
    mergeField('factoryLicense', newFactoryLicense);

    mergeField('paymentTerms', newTerms);
    mergeField('billingAddress', newBilling);
    mergeField('shippingAddress', newShipping);
    if (newBilling || newShipping) {
      contact.address = newBilling || newShipping;
    }
    mergeField('city', newCity);
    mergeField('state', newState);
    // GST state code follows the GSTIN (it decides CGST+SGST versus IGST on invoices).
    if (/^[0-9]{2}/.test(contact.gstin || '')) contact.stateCode = String(contact.gstin).slice(0, 2);
    mergeField('pincode', newPincode);
    mergeField('landmark', newLandmark);

    if (this.editingAltPhones && this.editingAltPhones.length > 0) contact.altPhones = this.editingAltPhones;
    if (this.editingAltEmails && this.editingAltEmails.length > 0) contact.altEmails = this.editingAltEmails;
    if (this.editingAltContacts && this.editingAltContacts.length > 0) contact.altContacts = this.editingAltContacts;
    mergeField('cardNotes', (document.getElementById('edit-contact-card-notes')?.value || '').trim());

    if (!contact.bankDetails) contact.bankDetails = {};
    if (newBankName) { contact.bankDetails.bankName = newBankName; contact.bankName = newBankName; }
    if (newBeneficiaryName) { contact.bankDetails.beneficiaryName = newBeneficiaryName; contact.beneficiaryName = newBeneficiaryName; }
    if (newAccNo) { contact.bankDetails.accountNumber = newAccNo; contact.accountNumber = newAccNo; }
    if (newIfsc) { contact.bankDetails.ifsc = newIfsc; contact.ifsc = newIfsc; }
    if (newBranch) { contact.bankDetails.branch = newBranch; contact.branch = newBranch; }
    if (newUpi) { contact.bankDetails.upiId = newUpi; contact.upiId = newUpi; }

    if (newCreditLimit > 0) contact.creditLimit = newCreditLimit;
    if (newCreditPeriod > 0) contact.creditPeriod = newCreditPeriod;
    if (newTradeDiscount > 0) contact.tradeDiscount = newTradeDiscount;
    mergeField('specialties', newSpecialties);
    mergeField('capacity', newCapacity);

    if (contact.role === 'retailer') {
      if (!contact.agreedRates) contact.agreedRates = {};
      const r500 = parseFloat(document.getElementById('edit-contact-rate-500g')?.value);
      const r1k = parseFloat(document.getElementById('edit-contact-rate-1kg')?.value);
      const r5k = parseFloat(document.getElementById('edit-contact-rate-5kg')?.value);
      if (!isNaN(r500)) contact.agreedRates['500g'] = r500;
      if (!isNaN(r1k)) contact.agreedRates['1kg'] = r1k;
      if (!isNaN(r5k)) contact.agreedRates['5kg'] = r5k;
    }

    // Cascade name changes to orders for consistency
    if (oldName && oldName !== newName) {
      (this.data.orders || []).forEach(o => {
        if (contact.role === 'retailer' && o.retailerId === contact.id) o.retailerName = newName;
        if (contact.role === 'manufacturer' && o.manufacturerId === contact.id) o.manufacturerName = newName;
        if (contact.role === 'transporter' && o.transporterId === contact.id) o.transporterName = newName;
        if (contact.role === 'marketeer' && o.marketeerId === contact.id) o.marketeerName = newName;
      });
    }

    // Sync any open workspace tab title
    const openTab = (this.openTabs || []).find(t => t.id === `tab-contact-${contact.id}`);
    if (openTab) {
      openTab.title = newName;
      this.renderWorkspaceTabs();
    }

    this.saveData();
    void window.TradeFlowSmartFill?.archivePendingPartnerDocument?.(contact);
    window.TradeFlowSmartFill?.markSaved?.();
    this.closeEditContactModal();
    this.showToast(isNew ? `Added new partner ${newName} successfully!` : `Updated profile for ${newName} successfully!`);

    // Re-render active views
    this.renderActiveView();

    // If in-modal order details was currently visible, refresh it
    const kpiModal = document.getElementById('kpi-breakdown-modal');
    if (kpiModal && !kpiModal.classList.contains('hidden') && this.currentModalOrderId) {
      this.openInModalOrderDetail(this.currentModalOrderId, this.currentModalOriginMetric || 'in_flight');
    }
  }

  // ================= PARTNER ALTERNATE CONTACTS SWAP SYSTEM =================
  renderContactAltPills() {
    const renderPillGroup = (wrapId, items, fieldType) => {
      const wrap = document.getElementById(wrapId);
      if (!wrap) return;
      if (!items || items.length === 0) {
        wrap.innerHTML = `<span class="text-xs text-slate-400 italic">No secondary ${tfEscapeHtml(fieldType)}s (click + to add)</span>
          <button type="button" onclick="app.promptAddAltContact('${tfEscapeHtml(tfEscapeJs(fieldType))}')" class="px-1.5 py-0.2 rounded text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60">+ Add</button>`;
        return;
      }
      wrap.innerHTML = items.map((val, idx) => `
        <span class="tf-contact-pill inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 transition-all hover:shadow-2xs">
          <span>${tfEscapeHtml(val)}</span>
          <button type="button" onclick="app.swapContactField('${tfEscapeHtml(tfEscapeJs(fieldType))}', ${tfEscapeHtml(idx)})" class="pill-swap-icon hover:text-emerald-950 dark:hover:text-white p-0.5" title="Swap with primary ${tfEscapeHtml(fieldType)}">
            ⇄
          </button>
          <button type="button" onclick="app.removeAltContactField('${tfEscapeHtml(tfEscapeJs(fieldType))}', ${tfEscapeHtml(idx)})" class="hover:text-rose-500 p-0.5" title="Remove">
            ×
          </button>
        </span>
      `).join('') + `
        <button type="button" onclick="app.promptAddAltContact('${tfEscapeHtml(tfEscapeJs(fieldType))}')" class="px-1.5 py-0.2 rounded text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60">+ Add</button>
      `;
    };

    renderPillGroup('edit-contact-alt-phones-wrap', this.editingAltPhones, 'phone');
    renderPillGroup('edit-contact-alt-emails-wrap', this.editingAltEmails, 'email');
    renderPillGroup('edit-contact-alt-contacts-wrap', this.editingAltContacts, 'contact');
  }

  swapContactField(type, idx) {
    if (type === 'phone') {
      const input = document.getElementById('edit-contact-phone');
      if (!input) return;
      const currentPrimary = input.value.trim();
      const newPrimary = this.editingAltPhones[idx];
      input.value = newPrimary;
      if (currentPrimary) {
        this.editingAltPhones[idx] = currentPrimary;
      } else {
        this.editingAltPhones.splice(idx, 1);
      }
      this.renderContactAltPills();
      this.markFieldAutofilled(input);
      this.showToast(`⇄ Swapped primary phone to ${newPrimary}`);
    } else if (type === 'email') {
      const input = document.getElementById('edit-contact-email');
      if (!input) return;
      const currentPrimary = input.value.trim();
      const newPrimary = this.editingAltEmails[idx];
      input.value = newPrimary;
      if (currentPrimary) {
        this.editingAltEmails[idx] = currentPrimary;
      } else {
        this.editingAltEmails.splice(idx, 1);
      }
      this.renderContactAltPills();
      this.markFieldAutofilled(input);
      this.showToast(`⇄ Swapped primary email to ${newPrimary}`);
    } else if (type === 'contact') {
      const input = document.getElementById('edit-contact-person');
      if (!input) return;
      const currentPrimary = input.value.trim();
      const newPrimary = this.editingAltContacts[idx];
      input.value = newPrimary;
      if (currentPrimary) {
        this.editingAltContacts[idx] = currentPrimary;
      } else {
        this.editingAltContacts.splice(idx, 1);
      }
      this.renderContactAltPills();
      this.markFieldAutofilled(input);
      this.showToast(`⇄ Swapped primary contact person to ${newPrimary}`);
    }
  }

  removeAltContactField(type, idx) {
    if (type === 'phone') this.editingAltPhones.splice(idx, 1);
    if (type === 'email') this.editingAltEmails.splice(idx, 1);
    if (type === 'contact') this.editingAltContacts.splice(idx, 1);
    this.renderContactAltPills();
  }

  async promptAddAltContact(type) {
    const label = type === 'phone' ? 'Phone Number' : (type === 'email' ? 'Email Address' : 'Contact Person');
    const val = await this.showModalPrompt({
      title: `Add Alternative ${label}`,
      subtitle: `Partner Secondary Coordinates`,
      message: `Enter alternative ${label.toLowerCase()}:`,
      placeholder: type === 'phone' ? '+91 98765 43210' : (type === 'email' ? 'accounts@company.com' : 'Full Name & Designation'),
      confirmText: 'Add'
    });
    if (val && val.trim()) {
      if (type === 'phone') {
        if (!this.editingAltPhones) this.editingAltPhones = [];
        this.editingAltPhones.push(val.trim());
      } else if (type === 'email') {
        if (!this.editingAltEmails) this.editingAltEmails = [];
        this.editingAltEmails.push(val.trim());
      } else if (type === 'contact') {
        if (!this.editingAltContacts) this.editingAltContacts = [];
        this.editingAltContacts.push(val.trim());
      }
      this.renderContactAltPills();
    }
  }

  /* ================= 4. BANK DETAIL PROTECTION GUARD ================= */
  promptBankProtectionChange(contact, diffData) {
    this.pendingBankProtectionContact = contact;
    const diffContainer = document.getElementById('bank-protection-diff-content');
    if (diffContainer) {
      diffContainer.innerHTML = `
        <div class="font-bold text-xs text-slate-800 dark:text-slate-200 mb-2 flex items-center justify-between">
          <span>Partner: ${tfEscapeHtml(contact.name)} (${tfEscapeHtml(contact.role)})</span>
          <span class="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 font-mono font-bold">CRITICAL COORDINATES</span>
        </div>
        <div class="space-y-2">
          ${diffData.map(d => `
            <div class="p-2.5 rounded-lg bg-white dark:bg-[#11141d] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <span class="font-bold text-slate-600 dark:text-slate-400">${tfEscapeHtml(d.label)}:</span>
              <div class="flex items-center gap-2 font-mono text-xs">
                <span class="line-through text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded">${tfEscapeHtml(d.old || '(Blank)')}</span>
                <span class="text-slate-400">→</span>
                <span class="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">${tfEscapeHtml(d.new)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    const modal = document.getElementById('bank-protection-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeBankProtectionModal() {
    const modal = document.getElementById('bank-protection-modal');
    if (modal) modal.classList.add('hidden');
    this.pendingBankProtectionContact = null;
  }

  confirmBankProtectionChange() {
    this.isBankProtectionBypassed = true;
    this.closeBankProtectionModal();
    this.handleSaveContact();
    this.isBankProtectionBypassed = false;
    this.showToast('Bank coordinates authorized and updated securely.');
  }
});
