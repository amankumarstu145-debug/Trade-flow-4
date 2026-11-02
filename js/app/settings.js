// TradeFlow: Settings window. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ---------- SYSTEM & ENGINE SETTINGS (5-TAB CONTROL CENTER) ---------- */
  openSettingsModal(initialTab = 'profile') {
    const modal = document.getElementById('system-settings-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      this.switchSettingsTab(initialTab);
      this.populateSettingsForm();
      if (window.lucide) window.lucide.createIcons();
    }
  }

  closeSettingsModal() {
    const modal = document.getElementById('system-settings-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  }

  switchSettingsTab(tabId) {
    this.activeSettingsTab = tabId;
    const allTabs = ['profile', 'ai', 'data', 'appearance', 'role'];

    allTabs.forEach(t => {
      const btn = document.getElementById(`settings-nav-btn-${t}`);
      const panel = document.getElementById(`settings-panel-${t}`);
      const isActive = t === tabId;

      if (btn) {
        if (isActive) {
          btn.className = 'w-full text-left p-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer bg-emerald-600 text-white shadow-xs';
          const iconWrap = btn.querySelector('div:first-child');
          if (iconWrap) iconWrap.className = 'w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0 text-white';
        } else {
          btn.className = 'w-full text-left p-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all flex items-center gap-2.5 cursor-pointer';
          const iconWrap = btn.querySelector('div:first-child');
          if (iconWrap) {
            const colorMap = {
              profile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              ai: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
              data: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              appearance: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              role: 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            };
            iconWrap.className = `w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${colorMap[t] || 'bg-slate-500/10 text-slate-500'}`;
          }
        }
      }

      if (panel) {
        panel.classList.toggle('hidden', !isActive);
      }
    });

    if (window.lucide) window.lucide.createIcons();
  }

  populateSettingsForm() {
    const p = this.data.businessProfile || {};
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined && val !== null ? val : '';
    };

    // Tab 1: Business Profile Fields
    setVal('settings-prof-brand', p.brandName);
    setVal('settings-prof-legal', p.legalName);
    setVal('settings-prof-tagline', p.tagline);
    setVal('settings-prof-gstin', p.gstin);
    setVal('settings-prof-pan', p.pan);
    setVal('settings-prof-fssai', p.fssai);
    setVal('settings-prof-phone', p.phone);
    setVal('settings-prof-email', p.email);
    setVal('settings-prof-address', p.address);
    setVal('settings-prof-city', p.city);
    setVal('settings-prof-state', p.state);
    setVal('settings-prof-state-code', p.stateCode);
    setVal('settings-prof-pin', p.pincode);
    setVal('settings-prof-bank', p.bankName);
    setVal('settings-prof-acc-holder', p.accountHolder);
    setVal('settings-prof-acc-no', p.accountNumber);
    setVal('settings-prof-ifsc', p.ifsc);
    setVal('settings-prof-branch', p.branch);
    setVal('settings-prof-upi', p.upiId);
    setVal('settings-prof-inv-notes', p.invoiceNotes);
    setVal('settings-prof-udyam', p.udyam);
    setVal('settings-prof-cin', p.cin);
    setVal('settings-prof-trademarks', p.trademarks);
    setVal('settings-prof-bank2-name', p.secondaryBankName);
    setVal('settings-prof-bank2-acc', p.secondaryAccountNumber);
    setVal('settings-prof-bank2-ifsc', p.secondaryIfsc);
    setVal('settings-prof-bank2-branch', p.secondaryBranch);
    setVal('settings-prof-iec', p.iec);
    // Business defaults: show saved values; empty fields show the built-in default as a hint.
    const cfg = this.config();
    const defaultFields = {
      'settings-def-gst-rate': ['defaultGstRate', cfg.defaultGstRate], 'settings-def-hsn': ['defaultHsn', cfg.defaultHsn],
      'settings-def-payment-terms': ['defaultPaymentTerms', cfg.defaultPaymentTerms], 'settings-def-commission': ['defaultCommissionRate', cfg.defaultCommissionRate],
      'settings-def-mfg-advance': ['manufacturerAdvancePct', cfg.manufacturerAdvancePct], 'settings-def-booking-advance': ['bookingAdvancePct', cfg.bookingAdvancePct], 'settings-def-jurisdiction': ['jurisdiction', cfg.jurisdiction],
      'settings-def-freight-terms': ['defaultFreightTerms', cfg.defaultFreightTerms], 'settings-def-calc-transport': ['calcTransportPct', cfg.calcTransportPct],
      'settings-def-calc-profit': ['calcProfitPct', cfg.calcProfitPct], 'settings-def-calc-marketeer': ['calcMarketeerPct', cfg.calcMarketeerPct]
    };
    for (const [id, [key, effective]] of Object.entries(defaultFields)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.value = p[key] ?? '';
      if (effective !== '' && effective !== undefined) el.placeholder = String(effective);
    }
    const demoToggle = document.getElementById('settings-def-show-demo');
    if (demoToggle) demoToggle.checked = p.showDemoTools !== false;

    // Tab 2: AI & Gemini Settings
    const isAi = !!this.isAIEnabled;
    const aiBadge = document.getElementById('settings-ai-status-badge');
    const aiMasterBtn = document.getElementById('settings-ai-master-btn');
    if (aiBadge) {
      aiBadge.innerText = isAi ? 'VISION AI ACTIVE' : 'OFFLINE ENGINE ACTIVE';
      aiBadge.className = isAi 
        ? 'px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30'
        : 'px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
    }
    if (aiMasterBtn) {
      aiMasterBtn.innerText = isAi ? 'AI ON (Active)' : 'AI OFF (Deterministic)';
      aiMasterBtn.className = isAi
        ? 'btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 bg-purple-600 hover:bg-purple-500 text-white shadow-xs'
        : 'btn-tactile px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700';
    }

    const savedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('tradeflow_gemini_api_key') : '';
    setVal('settings-ai-gemini-key', savedKey);
    const keyBadge = document.getElementById('settings-ai-key-badge');
    if (keyBadge) {
      if (savedKey) {
        keyBadge.innerText = 'Key Active in Storage';
        keyBadge.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30';
      } else {
        keyBadge.innerText = 'Not Configured';
        keyBadge.className = 'px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      }
    }

    const savedModel = (typeof localStorage !== 'undefined' && localStorage.getItem('tradeflow_gemini_model')) || 'gemini-2.5-flash';
    const modelRadios = document.querySelectorAll('input[name="settings_gemini_model"]');
    modelRadios.forEach(r => { r.checked = (r.value === savedModel); });

    // Tab 3: Data & Sync Settings
    const savedSheetUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('TF_GOOGLE_SHEET_URL')) || 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
    setVal('settings-data-sheets-url', savedSheetUrl);

    // Tab 4: Appearance Settings
    const isDark = document.documentElement.classList.contains('dark');
    const darkCard = document.getElementById('settings-theme-card-dark');
    const lightCard = document.getElementById('settings-theme-card-light');
    const darkBadge = document.getElementById('settings-theme-badge-dark');
    const lightBadge = document.getElementById('settings-theme-badge-light');

    if (darkCard && lightCard) {
      if (isDark) {
        darkCard.className = 'p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between bg-slate-900 text-white border-emerald-500 shadow-xs';
        lightCard.className = 'p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between bg-white text-slate-900 border-slate-200 shadow-2xs hover:border-slate-300';
        if (darkBadge) darkBadge.classList.remove('hidden');
        if (lightBadge) lightBadge.classList.add('hidden');
      } else {
        lightCard.className = 'p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between bg-white text-slate-900 border-emerald-500 shadow-xs';
        darkCard.className = 'p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between bg-slate-900 text-white border-slate-700 shadow-2xs hover:border-slate-600';
        if (lightBadge) lightBadge.classList.remove('hidden');
        if (darkBadge) darkBadge.classList.add('hidden');
      }
    }

    setVal('settings-app-inv-prefix', p.invoicePrefix || 'INV-');
    setVal('settings-app-inv-start', p.startingNumber || 1001);

    // Tab 5: Role & Privacy Mode
    const currentMode = this.currentRoleMode || (typeof localStorage !== 'undefined' && localStorage.getItem('tradeflow_role_mode')) || 'operator';
    const roleBadge = document.getElementById('settings-role-current-badge');
    const roleBtn = document.getElementById('settings-role-toggle-btn');
    const roleDesc = document.getElementById('settings-role-desc');

    if (currentMode === 'operator') {
      if (roleBadge) {
        roleBadge.innerText = 'Operator Mode Active';
        roleBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 shrink-0';
      }
      if (roleBtn) roleBtn.innerText = 'Switch to Owner Mode';
      if (roleDesc) roleDesc.innerText = 'Operator Mode: Trade margins, vendor purchase costs, and raw profits are shielded from screen.';
    } else {
      if (roleBadge) {
        roleBadge.innerText = 'Owner Mode Active';
        roleBadge.className = 'px-2.5 py-1 rounded-full text-xs font-bold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0';
      }
      if (roleBtn) roleBtn.innerText = 'Switch to Operator Mode';
      if (roleDesc) roleDesc.innerText = 'Owner Mode: Full commercial financial visibility, margins, debt aging, and net profit unlocked.';
    }
  }

  saveSettingsProfile() {
    if (!this.data.businessProfile) this.data.businessProfile = {};
    const p = this.data.businessProfile;

    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    p.brandName = getVal('settings-prof-brand');
    p.legalName = getVal('settings-prof-legal') || '';
    p.tagline = getVal('settings-prof-tagline');
    p.gstin = getVal('settings-prof-gstin');
    p.pan = getVal('settings-prof-pan');
    p.fssai = getVal('settings-prof-fssai');
    p.phone = getVal('settings-prof-phone');
    p.email = getVal('settings-prof-email');
    p.address = getVal('settings-prof-address');
    p.city = getVal('settings-prof-city');
    p.state = getVal('settings-prof-state');
    p.stateCode = getVal('settings-prof-state-code');
    p.pincode = getVal('settings-prof-pin');
    p.bankName = getVal('settings-prof-bank');
    p.accountHolder = getVal('settings-prof-acc-holder');
    p.accountNumber = getVal('settings-prof-acc-no');
    p.ifsc = getVal('settings-prof-ifsc');
    p.branch = getVal('settings-prof-branch');
    p.upiId = getVal('settings-prof-upi');
    p.invoiceNotes = getVal('settings-prof-inv-notes');
    p.udyam = getVal('settings-prof-udyam').toUpperCase();
    p.cin = getVal('settings-prof-cin').toUpperCase();
    p.trademarks = getVal('settings-prof-trademarks');
    p.secondaryBankName = getVal('settings-prof-bank2-name');
    p.secondaryAccountNumber = getVal('settings-prof-bank2-acc').replace(/\s/g, '');
    p.secondaryIfsc = getVal('settings-prof-bank2-ifsc').toUpperCase();
    p.secondaryBranch = getVal('settings-prof-bank2-branch');
    p.iec = getVal('settings-prof-iec').toUpperCase();
    // Business defaults: numbers are stored as numbers; an empty field removes the override.
    const numberOrUnset = (key, id) => { const v = getVal(id); if (v === '') delete p[key]; else if (Number.isFinite(Number(v))) p[key] = Number(v); };
    const textOrUnset = (key, id) => { const v = getVal(id); if (v === '') delete p[key]; else p[key] = v; };
    numberOrUnset('defaultGstRate', 'settings-def-gst-rate');
    textOrUnset('defaultHsn', 'settings-def-hsn');
    textOrUnset('defaultPaymentTerms', 'settings-def-payment-terms');
    numberOrUnset('defaultCommissionRate', 'settings-def-commission');
    numberOrUnset('manufacturerAdvancePct', 'settings-def-mfg-advance');
    numberOrUnset('bookingAdvancePct', 'settings-def-booking-advance');
    textOrUnset('jurisdiction', 'settings-def-jurisdiction');
    textOrUnset('defaultFreightTerms', 'settings-def-freight-terms');
    numberOrUnset('calcTransportPct', 'settings-def-calc-transport');
    numberOrUnset('calcProfitPct', 'settings-def-calc-profit');
    numberOrUnset('calcMarketeerPct', 'settings-def-calc-marketeer');
    const demoToggle = document.getElementById('settings-def-show-demo');
    if (demoToggle) p.showDemoTools = demoToggle.checked;
    window.TFFormGuard?.refreshDemoButton();

    this.saveData();
    this.populateSettingsForm();

    const brandHeader = document.getElementById('sidebar-brand-name');
    if (brandHeader) brandHeader.innerText = this.config().brand;

    this.showToast('Business Profile & GST Tax Master saved successfully!');
  }

  toggleSettingsApiKeyVisibility() {
    const input = document.getElementById('settings-ai-gemini-key');
    const eye = document.getElementById('settings-ai-key-eye');
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (eye) eye.setAttribute('data-lucide', 'eye-off');
    } else {
      input.type = 'password';
      if (eye) eye.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) window.lucide.createIcons();
  }

  saveSettingsGeminiKey() {
    const input = document.getElementById('settings-ai-gemini-key');
    const val = input ? input.value.trim() : '';
    if (val) {
      localStorage.setItem('tradeflow_gemini_api_key', val);
      this.showToast('Gemini Vision API key saved successfully!');
    } else {
      localStorage.removeItem('tradeflow_gemini_api_key');
      this.showToast('Gemini API key removed.');
    }
    this.populateSettingsForm();
  }

  clearSettingsGeminiKey() {
    const input = document.getElementById('settings-ai-gemini-key');
    if (input) input.value = '';
    localStorage.removeItem('tradeflow_gemini_api_key');
    this.showToast('Gemini API key cleared.');
    this.populateSettingsForm();
  }

  async testGeminiConnection() {
    const input = document.getElementById('settings-ai-gemini-key');
    const key = (input ? input.value.trim() : '') || localStorage.getItem('tradeflow_gemini_api_key');
    const resultEl = document.getElementById('settings-ai-test-result');

    if (!resultEl) return;
    resultEl.classList.remove('hidden');

    if (!key) {
      resultEl.className = 'p-2.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      resultEl.innerHTML = tfSanitizeHtml('Please enter or save a Gemini API key first.');
      return;
    }

    resultEl.className = 'p-2.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
    resultEl.innerHTML = tfSanitizeHtml('Testing connection to Google Generative Language API...');

    try {
      const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': key } });
      const data = await resp.json();
      if (resp.ok && data.models) {
        resultEl.className = 'p-2.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
        resultEl.innerHTML = tfSanitizeHtml(`API Key verified! Gemini connection is active (${data.models.length} models accessible).`);
      } else {
        resultEl.className = 'p-2.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
        resultEl.innerHTML = tfSanitizeHtml(`Connection error: ${data.error?.message || 'Invalid API key or network restricted'}`);
      }
    } catch (e) {
      resultEl.className = 'p-2.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
      resultEl.innerHTML = tfSanitizeHtml(`Connection test failed: ${e.message || 'Network unreachable'}`);
    }
  }

  onSettingsModelChange(val) {
    localStorage.setItem('tradeflow_gemini_model', val);
    this.showToast(`Active vision model set to ${val}`);
  }

  saveSettingsGoogleSheetUrl() {
    const input = document.getElementById('settings-data-sheets-url');
    const val = input ? input.value.trim() : '';
    if (val) {
      localStorage.setItem('TF_GOOGLE_SHEET_URL', val);
      this.showToast('Google Sheet connection URL updated!');
    }
  }

  openConnectedGoogleSheet() {
    const url = localStorage.getItem('TF_GOOGLE_SHEET_URL') || 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
    window.open(url, '_blank');
  }

  setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tradeflow_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tradeflow_theme', 'light');
    }
    this.updateThemeButton();
    this.populateSettingsForm();
    this.showToast(`Switched to ${theme === 'dark' ? 'Dark' : 'Light'} theme`);
  }

  saveSettingsAppearance() {
    if (!this.data.businessProfile) this.data.businessProfile = {};
    const prefixInput = document.getElementById('settings-app-inv-prefix');
    const startInput = document.getElementById('settings-app-inv-start');
    if (prefixInput) this.data.businessProfile.invoicePrefix = prefixInput.value.trim() || 'INV-';
    if (startInput) this.data.businessProfile.startingNumber = parseInt(startInput.value, 10) || 1001;

    const dateRadio = document.querySelector('input[name="settings_date_format"]:checked');
    if (dateRadio) {
      localStorage.setItem('tradeflow_date_format', dateRadio.value);
    }

    this.saveData();
    this.showToast('Appearance & invoice preferences saved!');
  }

  updateSettingsModalUI() {
    this.populateSettingsForm();
  }
});
