// TradeFlow: Payments: ledger, payment window, slip reading and duplicate checks. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  // ====================== DUAL-MODE PAYMENT COCKPIT & LEDGER ENGINE ======================

  /* ---------- PDF CANVAS RENDERER ---------- */
  async renderPdfDocument(source, containerEl, controlsEl) {
    if (!containerEl) return;
    containerEl.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-slate-400 gap-3 bg-slate-900 rounded-xl">
        <div class="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-xs font-semibold">Rendering document preview...</span>
      </div>
    `;

    try {
      if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js library not loaded');

      let pdfData = null;
      if (source instanceof Uint8Array) {
        pdfData = source;
      } else if (source instanceof ArrayBuffer) {
        pdfData = new Uint8Array(source);
      } else if (typeof source === 'string') {
        if (source.startsWith('data:')) {
          const base64 = source.split(',')[1];
          const binary = atob(base64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          pdfData = bytes;
        } else {
          // Request JSON base64 format to bypass third-party browser download interceptors (like IDM)
          const fetchUrl = source.includes('?') ? `${source}&format=base64` : `${source}?format=base64`;
          try {
            const jsonResp = await fetch(fetchUrl, { headers: { 'Accept': 'application/json' } });
            if (jsonResp.ok) {
              const resJson = await jsonResp.json();
              if (resJson.data) {
                const binary = atob(resJson.data);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                pdfData = bytes;
              }
            }
          } catch (_) {}

          if (!pdfData) {
            const resp = await fetch(source);
            if (!resp.ok) throw new Error('Server returned ' + resp.status + ' for document');
            const ab = await resp.arrayBuffer();
            pdfData = new Uint8Array(ab);
          }
        }
      }

      if (!pdfData || !pdfData.length) throw new Error('Empty PDF payload');

      const loadingTask = pdfjsLib.getDocument({ isEvalSupported: false, data: pdfData });
      const pdf = await loadingTask.promise;

      let currentPage = 1;
      let currentScale = 1.0;
      let scaleInitialized = false;

      const drawPage = async (pageNumber) => {
        const page = await pdf.getPage(pageNumber);
        if (!scaleInitialized) {
          const availW = (containerEl.clientWidth || 800) - 48;
          const unscaled = page.getViewport({ scale: 1.0 });
          currentScale = Math.min(1.15, Math.max(0.45, availW / unscaled.width));
          scaleInitialized = true;
        }
        containerEl.innerHTML = tfSanitizeHtml('');

        const scroller = document.createElement('div');
        scroller.className = 'w-full h-full overflow-auto flex justify-center items-start p-4 bg-slate-900/90 rounded-xl';

        const canvas = document.createElement('canvas');
        canvas.className = 'shadow-2xl rounded-lg bg-white max-w-full';
        canvas.style.height = 'auto';

        const viewport = page.getViewport({ scale: currentScale });
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: ctx, viewport }).promise;
        scroller.appendChild(canvas);
        containerEl.appendChild(scroller);

        if (controlsEl) {
          controlsEl.innerHTML = `
            <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              ${pdf.numPages > 1 ? `
                <button id="pdf-prev" class="btn-tactile px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold" ${tfEscapeHtml(currentPage <= 1 ? 'disabled' : '')}>◀</button>
                <span class="px-1 font-mono-num font-semibold text-xs text-slate-600 dark:text-slate-400">${tfEscapeHtml(currentPage)} / ${tfEscapeHtml(pdf.numPages)}</span>
                <button id="pdf-next" class="btn-tactile px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold" ${tfEscapeHtml(currentPage >= pdf.numPages ? 'disabled' : '')}>▶</button>
                <span class="text-slate-300 dark:text-slate-600">|</span>
              ` : ''}
              <button id="pdf-zm-out" class="btn-tactile px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold" title="Zoom Out">−</button>
              <span class="font-mono-num font-semibold text-xs min-w-[36px] text-center text-slate-700 dark:text-slate-300">${tfEscapeHtml(Math.round(currentScale * 100))}%</span>
              <button id="pdf-zm-in" class="btn-tactile px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold" title="Zoom In">+</button>
              <button id="pdf-zm-fit" class="btn-tactile px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs" title="Fit Width">Fit</button>
            </div>
          `;
          const pBtn = controlsEl.querySelector('#pdf-prev');
          if (pBtn) pBtn.onclick = () => { if (currentPage > 1) { currentPage--; drawPage(currentPage); } };
          const nBtn = controlsEl.querySelector('#pdf-next');
          if (nBtn) nBtn.onclick = () => { if (currentPage < pdf.numPages) { currentPage++; drawPage(currentPage); } };
          const zIn = controlsEl.querySelector('#pdf-zm-in');
          if (zIn) zIn.onclick = () => { currentScale = Math.min(2.5, currentScale + 0.2); drawPage(currentPage); };
          const zOut = controlsEl.querySelector('#pdf-zm-out');
          if (zOut) zOut.onclick = () => { currentScale = Math.max(0.5, currentScale - 0.2); drawPage(currentPage); };
          const zFit = controlsEl.querySelector('#pdf-zm-fit');
          if (zFit) zFit.onclick = () => {
            const availW = (containerEl.clientWidth || 800) - 48;
            const unscaled = page.getViewport({ scale: 1.0 });
            currentScale = Math.max(0.5, Math.min(2.0, availW / unscaled.width));
            drawPage(currentPage);
          };
        }
      };

      await drawPage(currentPage);

    } catch (err) {
      console.warn('Canvas render fallback:', err);
      containerEl.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-6 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
          <div class="text-4xl mb-2"><i data-lucide="file-text" class="w-6 h-6 inline-block"></i></div>
          <div class="font-bold text-sm text-slate-900 dark:text-white mb-1">Document Saved on Disk</div>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">The file is stored safely in your local documents directory. You can open it in Windows Explorer or download a copy.</p>
          <div class="flex items-center gap-2">
            <button onclick="app.openActiveDocFolder()" class="btn-tactile px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 shadow-sm">
              <i data-lucide="folder" class="w-3.5 h-3.5"></i>
              <span>Open in File Explorer</span>
            </button>
            <button onclick="app.downloadActiveDoc()" class="btn-tactile px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center gap-1.5">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Download File</span>
            </button>
          </div>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  /* ---------- PDF TEXT EXTRACTOR ---------- */
  async extractPdfText(arrayBuffer) {
    if (typeof pdfjsLib === 'undefined') return '';
    try {
      const pdf = await pdfjsLib.getDocument({ isEvalSupported: false, data: arrayBuffer }).promise;
      let text = '';
      const maxPages = Math.min(pdf.numPages, 3);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      return text;
    } catch (e) {
      console.warn('PDF extract failed:', e);
      return '';
    }
  }

  /* ---------- INTELLIGENT PAYMENT DOCUMENT ANALYZER ---------- */
  analyzePaymentDocument(text, filename) {
    const t = text || '';
    const fn = filename || '';
    const clean = str => str ? str.replace(/\s+/g, ' ').trim() : '';

    const tryPatterns = (str, patterns) => {
      for (const p of patterns) {
        const m = str.match(p);
        if (m && m[1]) return clean(m[1]);
      }
      return null;
    };

    // 1. UTR / Ref Number
    const utr = tryPatterns(t, [
      /UTR\s*(?:No\.?|Number|#)?[\s:]*([A-Z]{2,6}[A-Z0-9]{8,18})/i,
      /Ref(?:erence)?\s*(?:No\.?|Number|#)?[\s:]*([A-Z]{3,6}[0-9]{8,16})/i,
      /Transaction\s*(?:ID|Ref|No\.?)[\s:]*([A-Z0-9]{10,22})/i,
      /(?:^|\s)([A-Z]{3,6}N\d{9,15})(?:\s|$)/i,
      /NEFT\s*Ref[\s:]*([A-Z0-9]{10,22})/i,
      /IMPS\s*Ref[\s:]*([A-Z0-9]{10,22})/i,
    ]) || tryPatterns(fn.replace(/[_\-\.]/g, ' '), [
      /(?:^|\s)([A-Z]{3,6}[A-Z0-9]{8,18})(?:\s|$)/i
    ]);

    // 2. Amount
    let rawAmount = tryPatterns(t, [
      /Amount\s*[\|:]\s*INR\s*([\d,]+(?:\.\d{1,2})?)/i,
      /INR\s*([\d,]+(?:\.\d{1,2})?)\s*(?:\n|\r|$)/im,
      /(?:Total\s*Amount|Credited\s*Amount|Debit(?:ed)?\s*Amount|Remittance\s*Amount)\s*[\|:]\s*(?:INR|Rs\.?|[\u20B9])?\s*([\d,]+(?:\.\d{1,2})?)/i,
      /[\u20B9]\s*([\d,]+(?:\.\d{1,2})?)/,
      /Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i,
    ]);
    if (!rawAmount) {
      const lakhMatch = t.match(/([\d]{1,2},[\d]{2},[\d]{3}(?:\.\d{1,2})?|[\d]{2},[\d]{3}(?:\.\d{1,2})?)/);
      if (lakhMatch) rawAmount = lakhMatch[1];
    }
    let amount = null;
    if (rawAmount) {
      const parsed = parseFloat(rawAmount.replace(/,/g, ''));
      if (parsed > 0 && parsed < 100000000) amount = parsed;
    }

    // 3. Date (prevent timezone shift)
    const toISO = (d, m, y) => {
      const year = parseInt(y), month = parseInt(m), day = parseInt(d);
      if (year < 2000 || year > 2040 || month < 1 || month > 12 || day < 1 || day > 31) return null;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    const monthIdx = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    let date = null;
    const labelDateMatch = t.match(/(?:Payment\s*Date|Transaction\s*Date|Date\s*of\s*(?:Payment|Transfer)|Value\s*Date|Txn\s*Date)\s*[\(dd\/MM\/yyyy\)]*\s*[:\|]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i);
    if (labelDateMatch && labelDateMatch[1]) {
      const p = labelDateMatch[1].match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (p) date = toISO(p[1], p[2], p[3]);
    }
    if (!date) {
      const dmy = t.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
      if (dmy) date = toISO(dmy[1], dmy[2], dmy[3]);
    }
    if (!date) {
      const wordy = t.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})/i);
      if (wordy) {
        const mn = monthIdx[wordy[2].slice(0, 3).toLowerCase()];
        if (mn) date = toISO(wordy[1], mn, wordy[3]);
      }
    }

    // 4. Remitter & Beneficiary
    const stopPattern = '(?=\\s*(?:Beneficiary\\s*Account\\s*Number|Beneficiary\\s*Account|Beneficiary\\s*Name|\\bBeneficiary\\b|Pay\\s*From|Pay\\s*To|\\bRemitter\\b|Account\\s*Number|Acc\\s*No|A\\/c\\s*No|\\bIFSC\\b|\\bAmount\\b|\\bINR\\b|\\bRs\\.?\\b|\\bRemarks\\b|\\bNarration\\b|\\bPurpose\\b|\\bUTR\\b|\\bTxn\\b|\\bRef\\b|\\bDate\\b|\\n|\\r|$))';

    const isInvalidPartyName = (name) => {
      if (!name || typeof name !== 'string') return true;
      const s = name.trim().toLowerCase();
      if (s.length < 3) return true;
      const banned = [
        'account', 'beneficiary', 'remitter', 'number', 'name',
        'account number', 'acc no', 'a/c no', 'pay from', 'pay to',
        'credit', 'debit', 'txn', 'transaction', 'inr', 'rs',
        'amount', 'success', 'neft', 'rtgs', 'imps', 'upi',
        'fund transfer', 'general transaction', 'other bank account'
      ];
      return banned.includes(s) || /^\d+$/.test(s);
    };

    let beneficiary = null;
    const benRegex = new RegExp('(?:Beneficiary\\s*(?:Account\\s*Name|Account\\s*Holder|Account|Name|A\\/c\\s*Name|A\\/c)?|Pay\\s*To(?:\\s*(?:Account\\s*Name|Account|Name|A\\/c))?|Payee(?:\\s*Name)?|Credit\\s*Party)\\s*[:\\|]?\\s*([A-Za-z0-9\\s\\.\\-\\/&]+?)' + stopPattern, 'i');
    const benMatch = t.match(benRegex);
    if (benMatch && benMatch[1]) {
      let bVal = clean(benMatch[1].replace(/[:\|].*$/, ''));
      if (!isInvalidPartyName(bVal)) {
        beneficiary = bVal;
      }
    }
    if (!beneficiary) {
      const bAlt = tryPatterns(t, [
        /Beneficiary\s*(?:Account\s*Name|Name|Account\s*Holder)?[\s:]+([A-Za-z][A-Za-z0-9\s\.\-\/&]{2,60})/i,
        /(?:Payee|Paid\s*to|Remittance\s*to|Transfer\s*to|Credit\s*Party)\s*[:\|]?\s*([A-Za-z][A-Za-z0-9\s\.\-\/&]{2,60})/i,
      ]);
      if (bAlt && !isInvalidPartyName(bAlt)) beneficiary = bAlt;
    }

    let remitter = null;
    const remRegex = new RegExp('(?:Pay(?:ment)?\\s*From(?:\\s*(?:Account\\s*Name|Account\\s*Holder|Account|Name|A\\/c\\s*Name|A\\/c))?|Paid\\s*by|Remitter(?:\\s*Name)?|Debit(?:ed)?\\s*(?:from|Account(?:\\s*Holder)?)|Sender|Account\\s*Holder)\\s*[:\\|]?\\s*([A-Za-z0-9\\s\\.\\-\\/&]+?)' + stopPattern, 'i');
    const remMatch = t.match(remRegex);
    if (remMatch && remMatch[1]) {
      let rVal = clean(remMatch[1].replace(/[:\|].*$/, ''));
      if (!isInvalidPartyName(rVal)) {
        remitter = rVal;
      }
    }
    if (!remitter) {
      const rAlt = tryPatterns(t, [
        /(?:Payment\s*from|Paid\s*by|Debit(?:ed)?\s*from|Remitter|Sender|Account\s*Holder)\s*[:\|]?\s*([A-Za-z][A-Za-z0-9\s\.\-\/&]{2,60})/i,
      ]);
      if (rAlt && !isInvalidPartyName(rAlt)) remitter = rAlt;
    }

    // 5. Brand recognition & Direction
    const OUR_BRANDS = ['magic root', 'magic roots', 'magic roots enterprises', 'amrit ras', 'amrit ras foods', 's3m venture'];
    const isBrand = str => {
      if (!str) return false;
      const s = str.toLowerCase().replace(/[^a-z0-9]/g, ' ');
      return OUR_BRANDS.some(b => s.includes(b));
    };

    let direction = 'received';
    let party = '';
    let isBrandPayer = false;

    if (remitter && isBrand(remitter)) {
      direction = 'paid';
      party = beneficiary || '';
      isBrandPayer = true;
    } else if (beneficiary && isBrand(beneficiary)) {
      direction = 'received';
      party = remitter || '';
    } else if (beneficiary) {
      party = beneficiary;
    } else if (remitter) {
      party = remitter;
    }

    // Fallback contact cross-matching: if party is empty or invalid, search known contacts in text or filename
    if ((!party || isInvalidPartyName(party)) && Array.isArray(this.data?.contacts)) {
      for (const c of this.data.contacts) {
        if (c.name && c.name.length > 3) {
          const cLower = c.name.toLowerCase();
          if (t.toLowerCase().includes(cLower) || fn.toLowerCase().includes(cLower)) {
            party = c.name;
            if (['manufacturer', 'packaging', 'transporter'].includes(c.role)) {
              direction = 'paid';
            }
            break;
          }
        }
      }
    }

    // 6. Mode & Bank
    const modeMatch = t.match(/\b(NEFT|RTGS|IMPS|UPI|CHEQUE|CHQ|CASH)\b/i);
    const mode = modeMatch ? (modeMatch[1].toUpperCase() === 'CHQ' ? 'Cheque' : modeMatch[1].toUpperCase()) : 'NEFT';

    const UTR_BANK_MAP = {
      'HDFC':'HDFC Bank','SBIN':'State Bank of India','ICIC':'ICICI Bank',
      'UTIB':'Axis Bank','KKBK':'Kotak Mahindra Bank','PUNB':'Punjab National Bank',
      'BARB':'Bank of Baroda','BARBR':'Bank of Baroda','BKID':'Bank of India',
      'CNRB':'Canara Bank','UBIN':'Union Bank of India','IDFB':'IDFC First Bank',
      'YESB':'Yes Bank','PYTM':'Paytm Payments Bank','CITI':'Citibank',
      'INDB':'IndusInd Bank','FDRL':'Federal Bank'
    };
    let bank = tryPatterns(t, [
      /\b(HDFC\s*Bank|State\s*Bank\s*of\s*India|SBI|Axis\s*Bank|ICICI\s*Bank|Kotak\s*(?:Mahindra\s*)?Bank|Punjab\s*National\s*Bank|PNB|Bank\s*of\s*Baroda|BOB|Canara\s*Bank|IDFC\s*(?:First\s*)?Bank|Yes\s*Bank|Union\s*Bank|Indian\s*Bank|IndusInd\s*Bank)\b/i
    ]);
    if (!bank && utr) {
      for (const [prefix, bName] of Object.entries(UTR_BANK_MAP)) {
        if (utr.toUpperCase().startsWith(prefix)) { bank = bName; break; }
      }
    }

    // 7. Order Reference — ZERO hallucination! Match if explicitly in text/filename, or match unique order by item keywords
    let orderRef = tryPatterns(t + ' ' + fn, [
      /(?:Invoice|Inv|Bill|Order|PO)[\s\-#\.]*(?:No\.?|Number|#)?[\s:]*((?:INV|ORD|PO|TF)[\-\s]?\d{3,8})/i,
      /\b(INV[\-]\d{3,8})\b/i,
      /\b(ORD[\-]\d{3,8})\b/i,
    ]);

    // If orderRef not found by explicit ID, cross-match order items with remarks or filename keywords
    if (!orderRef && Array.isArray(this.data?.orders)) {
      const searchBlob = (t + ' ' + fn).toLowerCase();
      for (const ord of this.data.orders) {
        if (ord.items && Array.isArray(ord.items)) {
          const hasKeywordMatch = ord.items.some(item => {
            const iname = (item.name || '').toLowerCase();
            return (iname.includes('onion') && searchBlob.includes('onion')) ||
                   (iname.includes('root') && searchBlob.includes('root')) ||
                   (iname.includes('garlic') && searchBlob.includes('garlic'));
          });
          if (hasKeywordMatch) {
            orderRef = ord.invoiceNumber || ord.id;
            break;
          }
        }
      }
    }

    // 8. Bank TXN ID & Remarks
    const txnId = tryPatterns(t, [
      /(?:Reference\s*(?:ID|No\.?|Number)|Txn\s*(?:ID|No\.?)|Transaction\s*(?:Number|ID))\s*[\|:]\s*([0-9]{8,20})/i
    ]);
    const remarks = tryPatterns(t, [
      /(?:Remarks|Payment\s*Remarks|Purpose|Narration|Description)\s*[:\|]\s*([^\n\r]{4,120})/i
    ]);

    return {
      utr,
      amount,
      date,
      party,
      remitter,
      beneficiary,
      direction,
      isBrandPayer,
      mode,
      bank,
      orderRef,
      txnId,
      remarks,
      rawText: t.slice(0, 1500)
    };
  }

  /* ---------- PAYMENT LEDGER VIEW RENDERING ---------- */
  renderPaymentsLedger() {
    const payments = (this.data.payments || []).filter(p => !p.isDeleted);
    const state = this.paymentsState;

    // 1. Calculate Metrics
    const totalReceived = payments.filter(p => p.direction === 'received').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalPaid = payments.filter(p => p.direction === 'paid').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const netBalance = totalReceived - totalPaid;
    const curMonth = new Date().toISOString().slice(0, 7);
    const thisMonthIn = payments.filter(p => p.direction === 'received' && (p.date || '').startsWith(curMonth)).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const proofsCount = payments.filter(p => p.hasProof || p.pd).length;

    // 2. Render KPI Metric Tiles
    const kpiGrid = document.getElementById('payments-kpi-grid');
    if (kpiGrid) {
      // Each tile filters the ledger below; the tile that matches the current filter is marked.
      const monthStart = curMonth + '-01';
      const active = state.proof === 'missing' ? 'proofs'
        : (state.dateFrom === monthStart && state.direction === 'received' && !state.dateTo) ? 'month'
        : (!state.dateFrom && !state.dateTo && state.category === 'all' && !state.query) ? ({ received: 'received', paid: 'paid', all: 'net' }[state.direction] || '') : '';
      const tile = (key, label, value, valueClass, hint, title) => `
        <button type="button" class="tf-hcard tf-ledger-tile${active === key ? ' is-active' : ''}" aria-pressed="${active === key}" onclick="app.ledgerTileFilter('${key}')" title="${tfEscapeHtml(title)}">
          <span class="tf-ledger-tile__label">${tfEscapeHtml(label)}</span>
          <span class="tf-ledger-tile__value ${valueClass}">${tfEscapeHtml(value)}</span>
          <span class="tf-ledger-tile__hint">${tfEscapeHtml(hint)}</span>
        </button>`;
      kpiGrid.innerHTML =
        tile('received', 'Total received', this.formatCurrency(totalReceived), 'is-in', `${payments.filter(p => p.direction === 'received').length} receipts`, 'Show money received') +
        tile('paid', 'Total paid out', this.formatCurrency(totalPaid), 'is-out', `${payments.filter(p => p.direction === 'paid').length} payments`, 'Show money paid out') +
        tile('net', 'Net balance', this.formatCurrency(Math.abs(netBalance)), netBalance >= 0 ? 'is-in' : 'is-out', netBalance >= 0 ? 'More in than out' : 'More out than in', 'Show all entries') +
        tile('month', 'This month in', this.formatCurrency(thisMonthIn), 'is-warn', this.formatMonthYear(new Date()), 'Show money received this month') +
        tile('proofs', 'Proofs filed', `${proofsCount} of ${payments.length}`, 'is-info', `${payments.length - proofsCount} without proof`, 'Show entries without a proof');
    }

    // 3. Filter Payments
    let list = [...payments];
    if (state.query) {
      const q = state.query.toLowerCase();
      list = list.filter(p =>
        (p.partyName || '').toLowerCase().includes(q) ||
        (p.orderRef || '').toLowerCase().includes(q) ||
        (p.utr || '').toLowerCase().includes(q) ||
        (p.beneficiaryAccount || '').toLowerCase().includes(q) ||
        (p.payerAccount || '').toLowerCase().includes(q) ||
        (p.bankTxnId || '').toLowerCase().includes(q) ||
        (p.bank || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q) ||
        (p.mode || '').toLowerCase().includes(q)
      );
    }
    if (state.direction !== 'all') {
      list = list.filter(p => p.direction === state.direction);
    }
    if (state.category !== 'all') {
      list = list.filter(p => p.partyType === state.category);
    }
    if (state.dateFrom) {
      list = list.filter(p => (p.date || '') >= state.dateFrom);
    }
    if (state.dateTo) {
      list = list.filter(p => (p.date || '') <= state.dateTo);
    }
    if (state.proof === 'missing') {
      list = list.filter(p => !(p.hasProof || p.pd));
    }

    // 4. Sort
    list.sort((a, b) => {
      let av = a[state.sortField] || '';
      let bv = b[state.sortField] || '';
      if (state.sortField === 'amount') {
        av = Number(av);
        bv = Number(bv);
      } else {
        av = String(av).toLowerCase();
        bv = String(bv).toLowerCase();
      }
      if (av < bv) return state.sortDirection === 'asc' ? -1 : 1;
      if (av > bv) return state.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // 5. Compute Running Balances (chronological order)
    const chronological = [...list].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const balanceMap = {};
    let runningBal = 0;
    for (const item of chronological) {
      runningBal += item.direction === 'received' ? (Number(item.amount) || 0) : -(Number(item.amount) || 0);
      balanceMap[item.id] = runningBal;
    }

    // 6. Pagination Slice
    const totalEntries = list.length;
    this.paymentsState.totalPages = Math.ceil(totalEntries / state.perPage) || 1;
    const startIdx = (state.page - 1) * state.perPage;
    const endIdx = Math.min(startIdx + state.perPage, totalEntries);
    const paginated = list.slice(startIdx, endIdx);

    // Update count badges
    const countBadge = document.getElementById('payments-count-badge');
    if (countBadge) countBadge.innerText = `${totalEntries} Entries`;
    const sidebarBadge = document.getElementById('sidebar-payments-badge');
    if (sidebarBadge) sidebarBadge.innerText = payments.length;

    // 7. Render Table Rows
    const tbody = document.getElementById('payments-table-body');
    if (tbody) {
      if (!paginated.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="11" class="p-8 text-center text-slate-400">
              <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
              <div class="font-bold text-sm text-slate-700 dark:text-slate-300">No payment entries found</div>
              <p class="text-xs text-slate-500 mt-0.5">Try adjusting your search filters or click 'Log Payment' to record one.</p>
            </td>
          </tr>
        `;
      } else {
        const categoryLabels = {
          retailer: 'Buyer / Retailer',
          manufacturer: 'Manufacturer',
          packaging: 'Packaging',
          transporter: 'Transporter',
          other: 'Other'
        };
        const categoryBadgeClasses = {
          retailer: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60',
          manufacturer: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60',
          packaging: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60',
          transporter: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60',
          other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
        };

        let lastMonth = '';
        let rowsHtml = '';
        let rowIdx = startIdx;

        for (const p of paginated) {
          rowIdx++;
          const monthKey = (p.date || '').slice(0, 7);
          if (monthKey && monthKey !== lastMonth) {
            const monthTitle = this.formatMonthYear(monthKey);
            rowsHtml += `
              <tr class="bg-slate-100/70 dark:bg-slate-900/80">
                <td colspan="11" class="px-4 py-1.5 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  ${tfEscapeHtml(monthTitle)}
                </td>
              </tr>
            `;
            lastMonth = monthKey;
          }

          const isReceived = p.direction === 'received';
          const bal = balanceMap[p.id] || 0;
          const hasProof = !!(p.hasProof || p.pd);

          rowsHtml += `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors" onclick="app.openOrderPaymentFullModal('${tfEscapeHtml(tfEscapeJs(p.id))}')">
              <td class="px-4 py-3 text-center font-mono-num text-xs text-slate-400">${tfEscapeHtml(rowIdx)}</td>
              <td class="px-4 py-3 font-mono-num whitespace-nowrap text-slate-700 dark:text-slate-300">${tfEscapeHtml(this.formatDate(p.date))}</td>
              <td class="px-4 py-3">
                ${p.orderRef ? `
                  <button type="button" class="font-mono-num font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors inline-flex items-center gap-1 group" onclick="event.stopPropagation(); app.openOrderFromDiary('${tfEscapeHtml(tfEscapeJs(p.orderRef || ''))}')" title="Click to inspect order dossier">
                    <span>${tfEscapeHtml(p.orderRef)}</span>
                    <i data-lucide="external-link" class="w-3 h-3 opacity-60 group-hover:opacity-100"></i>
                  </button>
                ` : '<span class="tf-on-account" title="Not linked to an order; counted in the party\'s account">On account</span>'}
              </td>
              <td class="px-4 py-3">
                <button type="button" class="font-bold text-slate-900 dark:text-white truncate max-w-[200px] text-left hover:text-emerald-700 dark:hover:text-emerald-400 hover:underline inline-flex items-center gap-1 group" onclick="event.stopPropagation(); app.openPartyProfile('${tfEscapeHtml(tfEscapeJs(p.partyName || ''))}')" title="Click to view partner profile & coordinates">
                  <span class="truncate">${tfEscapeHtml(p.partyName)}</span>
                  <i data-lucide="arrow-up-right" class="w-3 h-3 opacity-60 group-hover:opacity-100 text-amber-500 shrink-0"></i>
                </button>
                ${p.utr ? `<div class="text-xs font-mono text-slate-400">UTR: ${tfEscapeHtml(p.utr)}</div>` : ''}
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${tfEscapeHtml(categoryBadgeClasses[p.partyType] || categoryBadgeClasses.other)}">
                  ${tfEscapeHtml(categoryLabels[p.partyType] || p.partyType)}
                </span>
              </td>
              <td class="px-4 py-3">
                <span class="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  ${tfEscapeHtml(p.mode || 'NEFT')}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${tfEscapeHtml(isReceived ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800')}">
                  ${tfEscapeHtml(isReceived ? '↓ Received' : '↑ Paid Out')}
                </span>
              </td>
              <td class="px-4 py-3 text-right font-mono-num font-bold text-xs whitespace-nowrap ${tfEscapeHtml(isReceived ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}">
                ${tfEscapeHtml(isReceived ? '+' : '-')}${tfEscapeHtml(this.formatCurrency(p.amount))}
              </td>
              <td class="px-4 py-3 text-right font-mono-num text-xs font-semibold whitespace-nowrap ${tfEscapeHtml(bal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}">
                ${tfEscapeHtml(this.formatCurrency(Math.abs(bal)))}
              </td>
              <td class="px-4 py-3 text-center" onclick="event.stopPropagation();">
                ${hasProof ? `
                  <button onclick="event.stopPropagation(); app.openOrderPaymentFullModal('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile w-6 h-6 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center" title="View Order & Payment Dossier with proof">
                    <i data-lucide="file-check" class="w-3.5 h-3.5"></i>
                  </button>
                ` : '<span class="text-slate-300 dark:text-slate-700">—</span>'}
              </td>
              <td class="px-4 py-3 text-right" onclick="event.stopPropagation();">
                <div class="flex items-center justify-end gap-1">
                  <button onclick="app.editPayment('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded" title="Edit">
                    <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="app.deletePayment('${tfEscapeHtml(tfEscapeJs(p.id))}')" class="btn-tactile p-1 text-rose-400 hover:text-rose-600 rounded" title="Delete">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }

        tbody.innerHTML = rowsHtml;
      }
    }

    // 8. Render Pagination
    const paginationEl = document.getElementById('payments-pagination');
    if (paginationEl) {
      const totalPages = Math.ceil(totalEntries / state.perPage) || 1;
      let pagesHtml = '';
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - state.page) <= 1) {
          pagesHtml += `
            <button onclick="app.goToPaymentPage(${tfEscapeHtml(i)})" class="w-7 h-7 rounded text-xs font-semibold ${tfEscapeHtml(i === state.page ? 'bg-amber-500 text-white dark:text-slate-950 font-bold' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400')}">
              ${tfEscapeHtml(i)}
            </button>
          `;
        } else if (Math.abs(i - state.page) === 2) {
          pagesHtml += `<span class="text-slate-400 px-1">…</span>`;
        }
      }

      paginationEl.innerHTML = `
        <div class="text-slate-500 text-xs">
          Showing <strong>${tfEscapeHtml(totalEntries > 0 ? startIdx + 1 : 0)}–${tfEscapeHtml(endIdx)}</strong> of <strong>${tfEscapeHtml(totalEntries)}</strong> payments
        </div>
        <div class="flex items-center gap-1">
          <button onclick="app.goToPaymentPage(${tfEscapeHtml(state.page - 1)})" ${tfEscapeHtml(state.page <= 1 ? 'disabled' : '')} class="px-2 py-1 rounded text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
            Prev
          </button>
          ${pagesHtml}
          <button onclick="app.goToPaymentPage(${tfEscapeHtml(state.page + 1)})" ${tfEscapeHtml(state.page >= totalPages ? 'disabled' : '')} class="px-2 py-1 rounded text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40">
            Next
          </button>
        </div>
      `;
    }

    if (window.lucide) window.lucide.createIcons();
    this.enableTableResizing('payments-ledger-table');
  }

  searchPayments(query) {
    this.paymentsState.query = query;
    this.paymentsState.page = 1;
    this.renderPaymentsLedger();
  }

  setPaymentDirectionFilter(direction) {
    this.paymentsState.direction = direction;
    this.paymentsState.page = 1;
    document.querySelectorAll('[data-pay-dir]').forEach(btn => {
      const isCurrent = btn.getAttribute('data-pay-dir') === direction;
      btn.className = isCurrent
        ? 'px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
        : 'px-2.5 py-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium';
    });
    this.renderPaymentsLedger();
  }

  setPaymentCategoryFilter(category) {
    this.paymentsState.category = category;
    this.paymentsState.page = 1;
    this.renderPaymentsLedger();
  }

  setPaymentDateFilter() {
    this.paymentsState.dateFrom = document.getElementById('payments-date-from')?.value || '';
    this.paymentsState.dateTo = document.getElementById('payments-date-to')?.value || '';
    this.paymentsState.page = 1;
    this.renderPaymentsLedger();
  }

  // Payment Ledger summary tiles: one click filters the list below.
  ledgerTileFilter(kind) {
    this.clearPaymentFilters();
    const st = this.paymentsState;
    if (kind === 'received' || kind === 'paid') { this.setPaymentDirectionFilter(kind); return; }
    if (kind === 'month') {
      const from = new Date().toISOString().slice(0, 7) + '-01';
      const df = document.getElementById('payments-date-from');
      if (df) df.value = from;
      st.dateFrom = from;
      this.setPaymentDirectionFilter('received');
      return;
    }
    if (kind === 'proofs') st.proof = 'missing';
    this.renderPaymentsLedger();
  }

  clearPaymentFilters() {
    this.paymentsState.proof = '';
    this.paymentsState.query = '';
    this.paymentsState.direction = 'all';
    this.paymentsState.category = 'all';
    this.paymentsState.dateFrom = '';
    this.paymentsState.dateTo = '';
    this.paymentsState.page = 1;

    const s = document.getElementById('payments-search-input');
    if (s) s.value = '';
    const c = document.getElementById('payments-category-filter');
    if (c) c.value = 'all';
    const df = document.getElementById('payments-date-from');
    if (df) df.value = '';
    const dt = document.getElementById('payments-date-to');
    if (dt) dt.value = '';

    document.querySelectorAll('[data-pay-dir]').forEach(btn => {
      const isCurrent = btn.getAttribute('data-pay-dir') === 'all';
      btn.className = isCurrent
        ? 'px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs font-bold'
        : 'px-2.5 py-1.5 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium';
    });

    this.renderPaymentsLedger();
  }

  sortPayments(field) {
    if (this.paymentsState.sortField === field) {
      this.paymentsState.sortDirection = this.paymentsState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.paymentsState.sortField = field;
      this.paymentsState.sortDirection = 'desc';
    }
    this.renderPaymentsLedger();
  }

  sortOrders(field) {
    if (this.ordersSortField === field) {
      this.ordersSortDirection = this.ordersSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.ordersSortField = field;
      this.ordersSortDirection = (field === 'retailer' || field === 'invoice') ? 'asc' : 'desc';
    }
    this.ordersPage = 1;
    this.renderOrdersTable();
  }

  goToPaymentPage(page) {
    const totalPages = this.paymentsState.totalPages || Math.ceil((this.data.payments?.length || 0) / this.paymentsState.perPage) || 1;
    if (page < 1 || page > totalPages) return;
    this.paymentsState.page = page;
    this.renderPaymentsLedger();
  }

  exportPaymentsCsv() {
    const payments = this.data.payments || [];
    const rows = [
      ['ID', 'Date', 'Direction', 'Party Name', 'Party Category', 'Mode', 'Order Ref', 'UTR Number', 'Bank Name', 'Amount (INR)', 'Has Proof', 'Notes']
    ];
    payments.forEach(p => {
      rows.push([
        p.id,
        p.date,
        p.direction,
        p.partyName,
        p.partyType,
        p.mode,
        p.orderRef || '',
        p.utr || '',
        p.bank || '',
        p.amount,
        (p.hasProof || p.pd) ? 'Yes' : 'No',
        p.notes || ''
      ]);
    });

    const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = tfSafeUrl(URL.createObjectURL(blob));
    link.download = `TradeFlow_PaymentLedger_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    this.showToast('Payment Ledger exported to CSV!');
  }

  /* ---------- PAYMENT MODAL COCKPIT ---------- */
  resetPaymentFormStyles() {
    const fields = [
      { id: 'pay-input-date', tag: 'pay-tag-date' },
      { id: 'pay-input-amount', tag: 'pay-tag-amount' },
      { id: 'pay-input-party', tag: 'pay-tag-party' },
      { id: 'pay-select-category', tag: 'pay-tag-category' },
      { id: 'pay-select-order', tag: 'pay-tag-order' },
      { id: 'pay-select-mode', tag: 'pay-tag-mode' },
      { id: 'pay-input-utr', tag: 'pay-tag-utr' },
      { id: 'pay-input-bank', tag: 'pay-tag-bank' },
      { id: 'pay-input-txnid', tag: 'pay-tag-txnid' },
      { id: 'pay-input-beneficiary-acc', tag: 'pay-tag-beneficiary-acc' },
      { id: 'pay-input-payer-acc', tag: 'pay-tag-payer-acc' },
      { id: 'pay-input-notes', tag: 'pay-tag-notes' }
    ];

    const greenClasses = ['border-emerald-500', 'bg-emerald-50/70', 'dark:bg-emerald-950/30', 'ring-1', 'ring-emerald-500/50'];
    const redClasses = ['border-rose-500', 'bg-rose-50/70', 'dark:bg-rose-950/40', 'ring-1', 'ring-rose-500'];

    fields.forEach(f => {
      const el = document.getElementById(f.id);
      if (el) {
        el.classList.remove(...greenClasses, ...redClasses);
      }
      const tag = document.getElementById(f.tag);
      if (tag) {
        tag.classList.add('hidden');
      }
    });

    const orderErr = document.getElementById('pay-order-error');
    if (orderErr) orderErr.classList.add('hidden');
  }

  setFieldHighlight(id, tagId, isExtracted, isError = false) {
    const el = document.getElementById(id);
    // Details filled in by Smart Fill (or with an error) must be visible, so open "More details" for them.
    if ((isExtracted || isError) && el && el.closest('#pay-more-details')) el.closest('#pay-more-details').open = true;
    const tag = tagId ? document.getElementById(tagId) : null;
    const greenClasses = ['border-emerald-500', 'bg-emerald-50/70', 'dark:bg-emerald-950/30', 'ring-1', 'ring-emerald-500/50'];
    const redClasses = ['border-rose-500', 'bg-rose-50/70', 'dark:bg-rose-950/40', 'ring-1', 'ring-rose-500'];

    if (el) {
      el.classList.remove(...greenClasses, ...redClasses);
      if (isError) {
        el.classList.add(...redClasses);
      } else if (isExtracted) {
        el.classList.add(...greenClasses);
      }
    }
    if (tag) {
      if (isExtracted && !isError) {
        tag.classList.remove('hidden');
      } else {
        tag.classList.add('hidden');
      }
    }
  }

  openPaymentModal(orderId = null, partyName = null, direction = 'received') {
    const modal = document.getElementById('payment-modal');
    if (!modal) return;

    // Reset hidden fields
    const hidFile = document.getElementById('pay-hidden-filedata');
    const hidName = document.getElementById('pay-hidden-filename');
    const hidType = document.getElementById('pay-hidden-filetype');
    const hidEdit = document.getElementById('pay-hidden-edit-id');
    if (hidFile) hidFile.value = '';
    if (hidName) hidName.value = '';
    if (hidType) hidType.value = '';
    if (hidEdit) hidEdit.value = '';

    // Clear dropzone & preview
    this.clearPaymentProofAttachment();
    this.resetPaymentFormStyles();

    // Reset Title
    const title = document.getElementById('payment-modal-title');
    if (title) title.innerText = 'Record payment';
    const sub = document.getElementById('payment-modal-sub');
    if (sub) sub.innerText = 'Attach a bank slip, or type the details';

    // Order list (optional: a payment can be on account, without an order)
    const orderSelect = document.getElementById('pay-select-order');
    if (orderSelect) {
      orderSelect.innerHTML = '<option value="">No order (on account)</option>' +
        this.data.orders.filter(o => !o.isDeleted).map(o => {
          const inv = o.invoiceNumber || o.id;
          const label = `${inv} · ${o.retailerName || 'Order'} (Bal: ${this.formatCurrency(o.customerBalanceDue)})`;
          return `<option value="${tfEscapeHtml(inv)}" data-orderid="${tfEscapeHtml(o.id)}">${tfEscapeHtml(label)}</option>`;
        }).join('');

      if (!orderSelect.dataset.hasListener) {
        orderSelect.dataset.hasListener = 'true';
        orderSelect.addEventListener('change', () => {
          this.onPaymentOrderChanged(orderSelect.value);
        });
      }
    }

    // Party search list: every partner, so typing shows matches (picking one fills party type and bank details).
    const partyList = document.getElementById('pay-party-list');
    if (partyList) {
      const roleLabel = { retailer: 'Buyer', manufacturer: 'Manufacturer', packaging: 'Packaging', transporter: 'Transport', marketeer: 'Marketeer' };
      partyList.innerHTML = (this.data.contacts || []).filter(c => !c.isDeleted && c.name)
        .map(c => `<option value="${tfEscapeHtml(c.name)}">${tfEscapeHtml([roleLabel[c.role] || 'Partner', c.city].filter(Boolean).join(' · '))}</option>`).join('');
    }
    const more = document.getElementById('pay-more-details');
    if (more) more.open = false;

    // Attach real-time input error-clearing listeners
    ['pay-input-date', 'pay-input-amount', 'pay-input-party'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.dataset.hasListener) {
        el.dataset.hasListener = 'true';
        el.addEventListener('input', () => {
          el.classList.remove('border-rose-500', 'bg-rose-50/70', 'dark:bg-rose-950/40', 'ring-1', 'ring-rose-500');
        });
      }
    });

    // Populate Category & Party Dropdowns
    const catSelect = document.getElementById('pay-select-category');
    if (catSelect) catSelect.value = 'retailer';
    this.onPaymentCategoryChanged('retailer');

    // Default Date to Today for manual entry
    const dateInput = document.getElementById('pay-input-date');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);

    const amountInput = document.getElementById('pay-input-amount');
    if (amountInput) amountInput.value = '';
    const partyInput = document.getElementById('pay-input-party');
    if (partyInput) partyInput.value = partyName || '';
    const utrInput = document.getElementById('pay-input-utr');
    if (utrInput) utrInput.value = '';
    const bankInput = document.getElementById('pay-input-bank');
    if (bankInput) bankInput.value = '';
    const txnidInput = document.getElementById('pay-input-txnid');
    if (txnidInput) txnidInput.value = '';
    const benAccInput = document.getElementById('pay-input-beneficiary-acc');
    if (benAccInput) benAccInput.value = '';
    const payerAccInput = document.getElementById('pay-input-payer-acc');
    if (payerAccInput) payerAccInput.value = '';
    const notesInput = document.getElementById('pay-input-notes');
    if (notesInput) notesInput.value = '';

    // Context-Aware Pre-selection if orderId provided
    const badge = document.getElementById('payment-modal-order-badge');
    if (orderId) {
      const order = this.findOrder(orderId);
      if (order) {
        if (orderSelect) orderSelect.value = order.invoiceNumber || order.id;
        if (badge) {
          badge.innerText = order.invoiceNumber || order.id;
          badge.classList.remove('hidden');
        }
        if (!partyName) {
          if (order.customerBalanceDue > 0) {
            if (partyInput) partyInput.value = order.retailerName || '';
            if (catSelect) catSelect.value = 'retailer';
            this.onPaymentCategoryChanged('retailer');
            if (amountInput) amountInput.value = order.customerBalanceDue;
            direction = 'received';
          } else {
            if (partyInput) partyInput.value = order.manufacturerName || '';
            if (catSelect) catSelect.value = 'manufacturer';
            this.onPaymentCategoryChanged('manufacturer');
            direction = 'paid';
          }
        } else {
          if (partyInput) partyInput.value = partyName;
          if (direction === 'paid') {
            if (catSelect) catSelect.value = 'manufacturer';
            this.onPaymentCategoryChanged('manufacturer');
            const mfgTotal = Number(order.manufacturerTotalCost) || 0;
            const mfgPaid = order.manufacturerAdvancePaid || 0;
            const mfgRem = Math.max(0, mfgTotal - mfgPaid);
            if (amountInput && mfgRem > 0) amountInput.value = mfgRem;
          } else {
            if (catSelect) catSelect.value = 'retailer';
            this.onPaymentCategoryChanged('retailer');
            if (amountInput && order.customerBalanceDue > 0) amountInput.value = order.customerBalanceDue;
          }
        }
      }
    } else {
      if (badge) badge.classList.add('hidden');
    }

    // Attach UTR listener for real-time duplicate checks
    if (utrInput && !utrInput.dataset.hasDupListener) {
      utrInput.dataset.hasDupListener = 'true';
      utrInput.addEventListener('blur', () => this.checkDuplicatePaymentOnInput());
      utrInput.addEventListener('change', () => this.checkDuplicatePaymentOnInput());
    }

    // Attach amount listener for real-time live balance calculation
    if (amountInput && !amountInput.dataset.hasBalListener) {
      amountInput.dataset.hasBalListener = 'true';
      amountInput.addEventListener('input', () => this.recalcPaymentLiveBalance());
    }

    // Set Direction
    this.setPaymentFormDirection(direction);

    // Initial Live Balance Recalculation
    this.recalcPaymentLiveBalance();

    // Show modal
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
    setTimeout(() => {
      if (partyInput) partyInput.focus();
    }, 150);
  }

  handlePaymentModalBack() {
    const fromSmartFill = this.paymentModalOpenedFrom === 'smart-fill' || Boolean(localStorage.getItem('tradeflow_pending_intake_draft'));
    this.closePaymentModal();
    if (fromSmartFill) {
      this.paymentModalOpenedFrom = null;
      if (window.TradeFlowSmartFill) {
        const draftStr = localStorage.getItem('tradeflow_pending_intake_draft');
        if (draftStr && window.TradeFlowSmartFill.restoreFromDraft) {
          try {
            const draft = JSON.parse(draftStr);
            window.TradeFlowSmartFill.restoreFromDraft(draft);
            return;
          } catch (_) {}
        }
        window.TradeFlowSmartFill.open?.('payment', null, '', true);
      }
    }
  }

  closePaymentModal(isSaved = false) {
    const modal = document.getElementById('payment-modal');
    if (modal) modal.classList.add('hidden');

    // If user entered details or attached proof and closed without saving, persist draft
    if (!isSaved) {
      const party = document.getElementById('pay-input-party')?.value?.trim();
      const amount = document.getElementById('pay-input-amount')?.value?.trim();
      const utr = document.getElementById('pay-input-utr')?.value?.trim();
      const fileData = document.getElementById('pay-hidden-filedata')?.value;
      const fileType = document.getElementById('pay-hidden-filetype')?.value;
      const fileName = document.getElementById('pay-hidden-filename')?.value || '';
      if ((party || amount || fileData) && !localStorage.getItem('tradeflow_pending_intake_draft')) {
        try {
          const isPdf = fileType === 'application/pdf' || (fileName || '').toLowerCase().endsWith('.pdf') || (typeof fileData === 'string' && fileData.startsWith('data:application/pdf'));
          const draft = {
            context: 'payment',
            targetView: 'payment_modal',
            fileName: fileName || (isPdf ? 'payment_proof.pdf' : 'payment_proof.jpg'),
            fileType: isPdf ? 'application/pdf' : (fileType || 'image/jpeg'),
            isPdf,
            originalDataUrl: fileData && fileData.length < 2000000 ? fileData : null,
            visionDataUrl: fileData && fileData.length < 2000000 ? fileData : null,
            extracted: {
              party,
              amount: Number(amount || 0),
              date: document.getElementById('pay-input-date')?.value || '',
              utr,
              orderRef: document.getElementById('pay-select-order')?.value || '',
              direction: this.paymentsState?.paymentFormDirection || 'received',
              category: document.getElementById('pay-select-category')?.value || 'other'
            },
            reviewValues: {
              party,
              amount,
              date: document.getElementById('pay-input-date')?.value || '',
              utr,
              orderRef: document.getElementById('pay-select-order')?.value || '',
              direction: this.paymentsState?.paymentFormDirection || 'received'
            },
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem('tradeflow_pending_intake_draft', JSON.stringify(draft));
          this.updateSidebarUI();
        } catch (e) {
          console.warn('Draft save on payment modal close error:', e);
        }
      }
    } else {
      if (document.getElementById('pay-input-party')) document.getElementById('pay-input-party').value = '';
      if (document.getElementById('pay-input-amount')) document.getElementById('pay-input-amount').value = '';
      if (document.getElementById('pay-input-utr')) document.getElementById('pay-input-utr').value = '';
    }

    this.togglePaymentSidePreview(false);
    this.clearPaymentProofAttachment();
    this.resetPaymentFormStyles();
    document.getElementById('payment-duplicate-banner')?.classList.add('hidden');
  }

  restorePaymentModalFromSnapshot(snapshot) {
    if (!snapshot) return;

    // 1. Open the modal (clean state initialized)
    this.openPaymentModal(snapshot.orderRef, snapshot.partyName, snapshot.direction);

    // 2. Explicitly apply direction
    this.setPaymentFormDirection(snapshot.direction || 'received');

    // 3. Category, Mode, and Order dropdowns
    const catEl = document.getElementById('pay-select-category');
    if (catEl && snapshot.partyType) {
      catEl.value = snapshot.partyType;
      this.onPaymentCategoryChanged(snapshot.partyType);
    }
    const modeEl = document.getElementById('pay-select-mode');
    if (modeEl && snapshot.mode) {
      modeEl.value = snapshot.mode;
    }
    const orderEl = document.getElementById('pay-select-order');
    if (orderEl && snapshot.orderRef) {
      orderEl.value = snapshot.orderRef;
    }

    // 4. Fill text inputs
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = val !== undefined && val !== null ? val : '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    setVal('pay-input-party', snapshot.partyName);
    setVal('pay-input-amount', snapshot.amount);
    setVal('pay-input-date', snapshot.date);
    setVal('pay-input-utr', snapshot.utr);
    setVal('pay-input-bank', snapshot.bank);
    setVal('pay-input-txnid', snapshot.txnId);
    setVal('pay-input-beneficiary-acc', snapshot.beneficiaryAccount);
    setVal('pay-input-payer-acc', snapshot.payerAccount);
    setVal('pay-input-notes', snapshot.notes);

    // 5. Restore attached proof
    if (snapshot.fileData) {
      this.attachPaymentProofData(snapshot.fileData, snapshot.fileName || 'restored_slip.png', snapshot.fileType || 'image/png');
    }

    // 6. Restore mobile snap context
    if (snapshot.pendingMobileSnapId) {
      this.currentPendingMobileSnapId = snapshot.pendingMobileSnapId;
    }
    if (snapshot.pendingMobileSnap) {
      this.lastProcessedMobileSnap = snapshot.pendingMobileSnap;
    }

    // 7. Recalculate live balance
    this.recalcPaymentLiveBalance();

    // 8. Focus amount or party
    setTimeout(() => {
      const amtEl = document.getElementById('pay-input-amount');
      if (amtEl) amtEl.focus();
    }, 100);
  }

  setPaymentFormDirection(direction) {
    this.paymentsState.paymentFormDirection = direction;
    const btnRecv = document.getElementById('pay-btn-received');
    const btnPaid = document.getElementById('pay-btn-paid');

    if (btnRecv && btnPaid) {
      if (direction === 'received') {
        btnRecv.className = 'py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all bg-emerald-600 text-white shadow-xs';
        btnPaid.className = 'py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      } else {
        btnPaid.className = 'py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all bg-rose-600 text-white shadow-xs';
        btnRecv.className = 'py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
      }
    }

    // Dynamic adaptation when an order is selected
    const orderSelect = document.getElementById('pay-select-order');
    if (orderSelect && orderSelect.value) {
      const order = this.findOrder(orderSelect.value);
      if (order) {
        const partyInput = document.getElementById('pay-input-party');
        const catSelect = document.getElementById('pay-select-category');
        if (direction === 'paid') {
          if (partyInput && (!partyInput.value || partyInput.value === order.retailerName)) {
            partyInput.value = order.manufacturerName || '';
            this.setFieldHighlight('pay-input-party', 'pay-tag-party', true);
          }
          if (catSelect) {
            catSelect.value = 'manufacturer';
            this.onPaymentCategoryChanged('manufacturer');
            this.setFieldHighlight('pay-select-category', 'pay-tag-category', true);
          }
        } else {
          if (partyInput && (!partyInput.value || partyInput.value === order.manufacturerName)) {
            partyInput.value = order.retailerName || '';
            this.setFieldHighlight('pay-input-party', 'pay-tag-party', true);
          }
          if (catSelect) {
            catSelect.value = 'retailer';
            this.onPaymentCategoryChanged('retailer');
            this.setFieldHighlight('pay-select-category', 'pay-tag-category', true);
          }
        }
      }
    }
    this.recalcPaymentLiveBalance();
  }

  onPaymentCategoryChanged(category) {
    const contacts = (this.data.contacts || []).filter(c => !category || category === 'other' || c.role === category);
    const select = document.getElementById('pay-select-party');
    if (select) {
      select.innerHTML = `<option value="">-- Match Known Party (${tfEscapeHtml(contacts.length)}) --</option>` +
        contacts.map(c => `<option value="${tfEscapeHtml(c.name)}">${tfEscapeHtml(c.name)}</option>`).join('');
    }
    this.recalcPaymentLiveBalance();
  }

  /* ---------- SMART CASCADING PAYMENT FORM HANDLERS ---------- */
  onPaymentOrderChanged(orderRef) {
    if (!orderRef) {
      document.getElementById('pay-order-error')?.classList.remove('hidden');
      this.setFieldHighlight('pay-select-order', 'pay-tag-order', false, true);
      this.recalcPaymentLiveBalance();
      return;
    }

    document.getElementById('pay-order-error')?.classList.add('hidden');
    this.setFieldHighlight('pay-select-order', 'pay-tag-order', true);

    const badge = document.getElementById('payment-modal-order-badge');
    if (badge) {
      badge.innerText = orderRef;
      badge.classList.remove('hidden');
    }

    const order = this.findOrder(orderRef);
    if (!order) return;

    const currentDirection = this.paymentsState.paymentFormDirection || 'received';
    const partyInput = document.getElementById('pay-input-party');
    const catSelect = document.getElementById('pay-select-category');
    const partySelect = document.getElementById('pay-select-party');
    const amountInput = document.getElementById('pay-input-amount');

    let autoFilledCount = 1; // order itself

    if (currentDirection === 'paid') {
      const targetParty = order.manufacturerName || '';
      if (partyInput) {
        partyInput.value = targetParty;
        this.setFieldHighlight('pay-input-party', 'pay-tag-party', true);
        autoFilledCount++;
      }
      if (catSelect) {
        catSelect.value = 'manufacturer';
        this.onPaymentCategoryChanged('manufacturer');
        this.setFieldHighlight('pay-select-category', 'pay-tag-category', true);
        autoFilledCount++;
      }
      if (partySelect) partySelect.value = targetParty;

      // Suggest manufacturer advance or balance if blank
      if (amountInput && (!amountInput.value || Number(amountInput.value) === 0)) {
        const mfgAmt = order.manufacturerAdvancePaid > 0 ? order.manufacturerAdvancePaid : (Number(order.manufacturerTotalCost) || 0);
        if (mfgAmt > 0) {
          amountInput.value = mfgAmt;
          this.setFieldHighlight('pay-input-amount', 'pay-tag-amount', true);
          autoFilledCount++;
        }
      }
    } else {
      const targetParty = order.retailerName || '';
      if (partyInput) {
        partyInput.value = targetParty;
        this.setFieldHighlight('pay-input-party', 'pay-tag-party', true);
        autoFilledCount++;
      }
      if (catSelect) {
        catSelect.value = 'retailer';
        this.onPaymentCategoryChanged('retailer');
        this.setFieldHighlight('pay-select-category', 'pay-tag-category', true);
        autoFilledCount++;
      }
      if (partySelect) partySelect.value = targetParty;

      // Suggest customer balance due or invoice total if blank
      if (amountInput && (!amountInput.value || Number(amountInput.value) === 0)) {
        const balDue = order.customerBalanceDue > 0 ? order.customerBalanceDue : order.totalInvoiceAmount;
        if (balDue > 0) {
          amountInput.value = balDue;
          this.setFieldHighlight('pay-input-amount', 'pay-tag-amount', true);
          autoFilledCount++;
        }
      }
    }

    this.recalcPaymentLiveBalance();
    this.showToast(`Smart Auto-Fill: Cascaded ${autoFilledCount} fields from Order ${order.invoiceNumber || order.id}!`);
  }

  onPaymentPartyInput(partyName) {
    if (!partyName || partyName.length < 2) return;
    this.cascadeAutoFillFromParty(partyName);
  }

  onPaymentPartySelected(partyName) {
    if (!partyName) return;
    const input = document.getElementById('pay-input-party');
    if (input) input.value = partyName;
    this.cascadeAutoFillFromParty(partyName);
  }

  cascadeAutoFillFromParty(partyName) {
    if (!partyName) return;
    const q = partyName.toLowerCase().trim();
    const contact = (this.data.contacts || []).find(c =>
      c.name.toLowerCase() === q ||
      c.name.toLowerCase().includes(q) ||
      q.includes(c.name.toLowerCase())
    );

    let fieldsMatched = 1; // party itself
    this.setFieldHighlight('pay-input-party', 'pay-tag-party', true);

    if (contact) {
      // 1. Auto-fill Category
      const catSelect = document.getElementById('pay-select-category');
      if (catSelect) {
        catSelect.value = contact.role;
        this.onPaymentCategoryChanged(contact.role);
        this.setFieldHighlight('pay-select-category', 'pay-tag-category', true);
        fieldsMatched++;
      }

      // 2. Auto-set Direction based on role
      if (['manufacturer', 'packaging', 'transporter'].includes(contact.role)) {
        this.setPaymentFormDirection('paid');
      } else if (contact.role === 'retailer') {
        this.setPaymentFormDirection('received');
      }

      // 3. Auto-match Order
      const orderSelect = document.getElementById('pay-select-order');
      if (orderSelect && (!orderSelect.value || orderSelect.value === '')) {
        const matchingOrder = (this.data.orders || []).find(o =>
          (o.retailerName && o.retailerName.toLowerCase().includes(contact.name.toLowerCase())) ||
          (contact.name.toLowerCase().includes((o.retailerName || '').toLowerCase()) && o.retailerName.length > 3) ||
          (o.manufacturerName && o.manufacturerName.toLowerCase().includes(contact.name.toLowerCase())) ||
          (contact.name.toLowerCase().includes((o.manufacturerName || '').toLowerCase()) && o.manufacturerName.length > 3)
        );

        if (matchingOrder) {
          const ref = matchingOrder.invoiceNumber || matchingOrder.id;
          orderSelect.value = ref;
          this.setFieldHighlight('pay-select-order', 'pay-tag-order', true);
          document.getElementById('pay-order-error')?.classList.add('hidden');
          const badge = document.getElementById('payment-modal-order-badge');
          if (badge) {
            badge.innerText = ref;
            badge.classList.remove('hidden');
          }
          fieldsMatched++;

          // 4. Auto-fill Amount if blank
          const amountInput = document.getElementById('pay-input-amount');
          if (amountInput && (!amountInput.value || Number(amountInput.value) === 0)) {
            const amt = contact.role === 'retailer' ? matchingOrder.customerBalanceDue : (matchingOrder.manufacturerAdvancePaid || matchingOrder.manufacturerTotalCost || 100000);
            if (amt > 0) {
              amountInput.value = amt;
              this.setFieldHighlight('pay-input-amount', 'pay-tag-amount', true);
              fieldsMatched++;
            }
          }
        }
      }

      if (fieldsMatched > 1) {
        this.showToast(`Smart Auto-Fill: Matched ${fieldsMatched} fields for ${contact.name}!`);
      }
    }
  }

  handlePaymentProofSelected(event) {
    return this.handlePaymentDocumentSelected(event);
  }

  async handlePaymentDocumentSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (window.TradeFlowSmartFill) {
      event.target.value = '';
      window.TradeFlowSmartFill.open('payment', file);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileData = e.target.result;
      const fileName = file.name;
      const fileType = file.type;

      // Store in hidden fields
      const hidFile = document.getElementById('pay-hidden-filedata');
      const hidName = document.getElementById('pay-hidden-filename');
      const hidType = document.getElementById('pay-hidden-filetype');
      if (hidFile) hidFile.value = fileData;
      if (hidName) hidName.value = fileName;
      if (hidType) hidType.value = fileType;

      // Update dropzone & preview
      const dropzone = document.getElementById('payment-dropzone');
      const previewWrap = document.getElementById('payment-preview-wrap');
      const previewName = document.getElementById('payment-preview-name');
      const previewIframe = document.getElementById('payment-preview-iframe');
      const previewImg = document.getElementById('payment-preview-img');
      const statusBadge = document.getElementById('payment-doc-status-badge');

      if (dropzone) dropzone.classList.add('hidden');
      if (previewWrap) previewWrap.classList.remove('hidden');
      if (previewName) previewName.innerText = fileName;
      if (statusBadge) statusBadge.innerText = 'Document attached';

      if (fileType.startsWith('image/')) {
        if (previewIframe) previewIframe.classList.add('hidden');
        if (previewImg) {
          previewImg.src = tfSafeUrl(fileData);
          previewImg.classList.remove('hidden');
        }
      } else {
        if (previewImg) previewImg.classList.add('hidden');
        if (previewIframe) {
          previewIframe.src = tfSafeUrl(fileData);
          previewIframe.classList.remove('hidden');
        }
      }

      // Extract text and analyze
      let text = '';
      if (fileType === 'application/pdf') {
        const ab = await file.arrayBuffer();
        text = await this.extractPdfText(ab);
      }

      const analyzed = this.analyzePaymentDocument(text, fileName);

      // Reset form styles first so previous highlights/errors don't linger
      this.resetPaymentFormStyles();

      // Auto-set Direction
      if (analyzed.direction === 'paid') {
        this.setPaymentFormDirection('paid');
      } else {
        this.setPaymentFormDirection('received');
      }

      // Brand Payer Badge
      const brandBadge = document.getElementById('pay-brand-payer-badge');
      if (brandBadge) {
        if (analyzed.isBrandPayer) {
          brandBadge.innerText = `Payer: ${analyzed.remitter || 'Our Brand'}`;
          brandBadge.classList.remove('hidden');
        } else {
          brandBadge.classList.add('hidden');
        }
      }

      // --- 1. Date: Auto-fill in GREEN if extracted, else leave completely BLANK ---
      const dInput = document.getElementById('pay-input-date');
      if (dInput) {
        if (analyzed.date) {
          dInput.value = analyzed.date;
          this.setFieldHighlight('pay-input-date', 'pay-tag-date', true);
        } else {
          dInput.value = '';
          this.setFieldHighlight('pay-input-date', 'pay-tag-date', false);
        }
      }

      // --- 2. Amount: Auto-fill in GREEN if extracted, else leave completely BLANK ---
      const aInput = document.getElementById('pay-input-amount');
      if (aInput) {
        if (analyzed.amount) {
          aInput.value = analyzed.amount;
          this.setFieldHighlight('pay-input-amount', 'pay-tag-amount', true);
        } else {
          aInput.value = '';
          this.setFieldHighlight('pay-input-amount', 'pay-tag-amount', false);
        }
      }

      // --- 3. Party Name & Category: Auto-fill in GREEN if extracted, else leave BLANK ---
      const pInput = document.getElementById('pay-input-party');
      const cSelect = document.getElementById('pay-select-category');
      const pSelect = document.getElementById('pay-select-party');
      if (pInput) {
        if (analyzed.party) {
          pInput.value = analyzed.party;
          this.setFieldHighlight('pay-input-party', 'pay-tag-party', true);

          // Try matching contact
          const contact = (this.data.contacts || []).find(c =>
            c.name.toLowerCase().includes(analyzed.party.toLowerCase()) ||
            analyzed.party.toLowerCase().includes(c.name.toLowerCase())
          );
          if (contact) {
            if (cSelect) {
              cSelect.value = contact.role;
              this.onPaymentCategoryChanged(contact.role);
              this.setFieldHighlight('pay-select-category', 'pay-tag-category', true);
            }
            if (pSelect) pSelect.value = contact.name;
          }
        } else {
          pInput.value = '';
          this.setFieldHighlight('pay-input-party', 'pay-tag-party', false);
        }
      }

      // --- 4. Order Attachment: Auto-fill in GREEN if extracted, else leave unselected ---
      const oSelect = document.getElementById('pay-select-order');
      if (oSelect) {
        if (analyzed.orderRef) {
          oSelect.value = analyzed.orderRef;
          this.setFieldHighlight('pay-select-order', 'pay-tag-order', true);
          const badge = document.getElementById('payment-modal-order-badge');
          if (badge) {
            badge.innerText = analyzed.orderRef;
            badge.classList.remove('hidden');
          }
        } else {
          // If modal was already opened for a specific order, keep it; otherwise leave blank so user chooses
          if (!oSelect.value) {
            oSelect.value = '';
            this.setFieldHighlight('pay-select-order', 'pay-tag-order', false);
          }
        }
      }

      // --- 5. Mode: Auto-fill in GREEN if extracted ---
      const mSelect = document.getElementById('pay-select-mode');
      if (mSelect) {
        if (analyzed.mode) {
          mSelect.value = analyzed.mode;
          this.setFieldHighlight('pay-select-mode', 'pay-tag-mode', true);
        } else {
          this.setFieldHighlight('pay-select-mode', 'pay-tag-mode', false);
        }
      }

      // --- 6. UTR: Auto-fill in GREEN if extracted, else leave BLANK ---
      const uInput = document.getElementById('pay-input-utr');
      if (uInput) {
        if (analyzed.utr) {
          uInput.value = analyzed.utr;
          this.setFieldHighlight('pay-input-utr', 'pay-tag-utr', true);
        } else {
          uInput.value = '';
          this.setFieldHighlight('pay-input-utr', 'pay-tag-utr', false);
        }
      }

      // --- 7. Bank Name: Auto-fill in GREEN if extracted, else leave BLANK ---
      const bInput = document.getElementById('pay-input-bank');
      if (bInput) {
        if (analyzed.bank) {
          bInput.value = analyzed.bank;
          this.setFieldHighlight('pay-input-bank', 'pay-tag-bank', true);
        } else {
          bInput.value = '';
          this.setFieldHighlight('pay-input-bank', 'pay-tag-bank', false);
        }
      }

      // --- 8. Bank TXN ID: Auto-fill in GREEN if extracted, else leave BLANK ---
      const tInput = document.getElementById('pay-input-txnid');
      if (tInput) {
        if (analyzed.txnId) {
          tInput.value = analyzed.txnId;
          this.setFieldHighlight('pay-input-txnid', 'pay-tag-txnid', true);
        } else {
          tInput.value = '';
          this.setFieldHighlight('pay-input-txnid', 'pay-tag-txnid', false);
        }
      }

      // --- 9. Notes: Auto-fill in GREEN if remarks present, else leave BLANK ---
      const noteParts = [];
      if (analyzed.remarks) noteParts.push(analyzed.remarks);
      if (analyzed.remitter && !analyzed.isBrandPayer) noteParts.push('From: ' + analyzed.remitter);
      if (analyzed.bank && !analyzed.remarks) noteParts.push('Via ' + analyzed.bank);
      const nInput = document.getElementById('pay-input-notes');
      if (nInput) {
        if (noteParts.length) {
          nInput.value = noteParts.join(' | ');
          this.setFieldHighlight('pay-input-notes', 'pay-tag-notes', true);
        } else {
          nInput.value = '';
          this.setFieldHighlight('pay-input-notes', 'pay-tag-notes', false);
        }
      }

      // Banner Status
      const banner = document.getElementById('payment-ai-banner');
      const statusText = document.getElementById('payment-ai-status-text');
      const extractedCount = [analyzed.date, analyzed.amount, analyzed.party, analyzed.utr, analyzed.mode, analyzed.orderRef, analyzed.bank].filter(Boolean).length;
      if (banner && statusText) {
        statusText.innerText = `Auto-filled ${extractedCount} fields from ${fileName} (Direction: ${analyzed.direction === 'paid' ? 'Paid Out' : 'Received'}). Green fields were extracted; blank fields must be filled manually.`;
      }

      this.showToast(`Document analyzed: ${extractedCount} fields auto-filled in green!`);
      if (window.lucide) window.lucide.createIcons();
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  }

  clearPaymentProofAttachment() {
    const dropzone = document.getElementById('payment-dropzone');
    const previewWrap = document.getElementById('payment-preview-wrap');
    const previewIframe = document.getElementById('payment-preview-iframe');
    const previewImg = document.getElementById('payment-preview-img');
    const statusBadge = document.getElementById('payment-doc-status-badge');
    const fileInput = document.getElementById('payment-doc-file-input');

    if (dropzone) dropzone.classList.remove('hidden');
    if (previewWrap) previewWrap.classList.add('hidden');
    if (previewIframe) { previewIframe.src = tfSafeUrl('about:blank'); previewIframe.classList.add('hidden'); }
    if (previewImg) { previewImg.src = tfSafeUrl(''); previewImg.classList.add('hidden'); }
    if (statusBadge) statusBadge.innerText = 'Optional attachment';
    if (fileInput) fileInput.value = '';

    const hidFile = document.getElementById('pay-hidden-filedata');
    const hidName = document.getElementById('pay-hidden-filename');
    const hidType = document.getElementById('pay-hidden-filetype');
    if (hidFile) hidFile.value = '';
    if (hidName) hidName.value = '';
    if (hidType) hidType.value = '';

    this.renderPaymentPreview('', '', '');
    this.togglePaymentSidePreview(false);
  }

  /* ---------- PAYMENT DUAL-PANE PREVIEW CONTROLLER ---------- */
  togglePaymentSidePreview(forceState) {
    if (typeof forceState === 'boolean') {
      this.paymentPreviewOpen = forceState;
    } else {
      this.paymentPreviewOpen = !this.paymentPreviewOpen;
    }

    const pane = document.getElementById('payment-preview-pane');
    const panel = document.getElementById('payment-modal-panel');
    const splitControls = document.getElementById('pay-split-controls');
    const toggleText = document.getElementById('pay-preview-toggle-text');

    if (this.paymentPreviewOpen) {
      if (pane) {
        pane.classList.remove('hidden');
        pane.classList.add('flex');
      }
      if (panel) {
        panel.style.width = '1260px';
        panel.classList.remove('max-w-4xl');
        panel.classList.add('max-w-7xl', 'w-[96vw]');
      }
      if (splitControls) splitControls.classList.remove('hidden');
      if (toggleText) toggleText.textContent = 'Hide Preview';
      
      const fileData = document.getElementById('pay-hidden-filedata')?.value;
      const fileName = document.getElementById('pay-hidden-filename')?.value;
      const fileType = document.getElementById('pay-hidden-filetype')?.value;
      if (fileData) {
        this.renderPaymentPreview(fileName, fileData, fileType);
      }
    } else {
      if (pane) {
        pane.classList.add('hidden');
        pane.classList.remove('flex');
      }
      if (panel) {
        panel.style.width = '860px';
        panel.classList.remove('max-w-7xl', 'w-[96vw]');
      }
      if (splitControls) splitControls.classList.add('hidden');
      if (toggleText) toggleText.textContent = 'Toggle Preview';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  setPaymentSplitRatio(ratio) {
    const formPane = document.getElementById('payment-form-pane');
    const previewPane = document.getElementById('payment-preview-pane');
    document.querySelectorAll('.pay-split-btn').forEach(btn => {
      const match = btn.textContent.includes(ratio === '50-50' ? '50:50' : '40:60');
      btn.className = `pay-split-btn px-2 py-0.5 text-xs font-bold rounded ${match ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`;
    });

    if (ratio === '40-60') {
      if (formPane) { formPane.style.width = '40%'; formPane.style.flex = '0 0 40%'; }
      if (previewPane) { previewPane.style.width = '60%'; previewPane.style.flex = '0 0 60%'; }
    } else {
      if (formPane) { formPane.style.width = '50%'; formPane.style.flex = '1 1 50%'; }
      if (previewPane) { previewPane.style.width = '50%'; previewPane.style.flex = '1 1 50%'; }
    }
  }

  zoomPaymentPreview(delta) {
    this.paymentPreviewZoom = Math.max(0.4, Math.min(3.0, (this.paymentPreviewZoom || 1.0) + delta));
    const target = document.getElementById('payment-canvas-wrapper');
    if (target) target.style.transform = `scale(${this.paymentPreviewZoom})`;
    const lbl = document.getElementById('payment-preview-zoom-val');
    if (lbl) lbl.textContent = `${Math.round(this.paymentPreviewZoom * 100)}%`;
  }

  resetPaymentPreviewZoom() {
    this.paymentPreviewZoom = 1.0;
    const target = document.getElementById('payment-canvas-wrapper');
    if (target) target.style.transform = 'scale(1)';
    const lbl = document.getElementById('payment-preview-zoom-val');
    if (lbl) lbl.textContent = '100%';
  }

  openPaymentPreviewNewTab() {
    const fileData = document.getElementById('pay-hidden-filedata')?.value;
    const fileName = document.getElementById('pay-hidden-filename')?.value || 'payment_proof.pdf';
    if (!fileData) {
      this.showToast('No receipt file attached.');
      return;
    }
    const win = window.open();
    if (win) {
      const isPdf = (typeof fileData === 'string' && fileData.startsWith('data:application/pdf')) || (fileName || '').toLowerCase().endsWith('.pdf');
      if (isPdf) {
        win.document.write(`<!DOCTYPE html><html><head><title>${tfEscapeHtml(fileName.replace(/[&<>"']/g, ''))}</title><style>body,html{margin:0;padding:0;height:100%;overflow:hidden;background:#0f172a;}</style></head><body><iframe src="${tfEscapeHtml(tfSafeUrl(fileData))}" frameborder="0" style="width:100%;height:100%;border:none;" allowfullscreen></iframe></body></html>`);
      } else {
        win.document.write(`<!DOCTYPE html><html><head><title>${tfEscapeHtml(fileName.replace(/[&<>"']/g, ''))}</title><style>body,html{margin:0;padding:0;min-height:100%;display:flex;align-items:center;justify-content:center;background:#0f172a;}</style></head><body><img src="${tfEscapeHtml(tfSafeUrl(fileData))}" style="max-width:100%;max-height:100vh;box-shadow:0 10px 25px rgba(0,0,0,0.5);border-radius:8px;"></body></html>`);
      }
    }
  }

  downloadPaymentPreviewFile() {
    const fileData = document.getElementById('pay-hidden-filedata')?.value;
    const fileName = document.getElementById('pay-hidden-filename')?.value || 'payment_proof.pdf';
    if (!fileData) {
      this.showToast('No receipt file attached.');
      return;
    }
    const a = document.createElement('a');
    a.href = tfSafeUrl(fileData);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    this.showToast(`Downloaded ${fileName}`);
  }

  renderPaymentPreview(fileName, fileData, fileType) {
    const emptyState = document.getElementById('payment-preview-empty-state');
    const wrapper = document.getElementById('payment-canvas-wrapper');
    const nameLabel = document.getElementById('payment-preview-pane-filename');

    if (nameLabel) nameLabel.textContent = fileName || 'Attachment';

    if (!fileData) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (wrapper) wrapper.classList.add('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (wrapper) {
      wrapper.classList.remove('hidden');
      const isPdf = (fileType === 'application/pdf' || /\.(pdf)$/i.test(fileName || '') || (typeof fileData === 'string' && fileData.startsWith('data:application/pdf')));
      if (isPdf) {
        this.renderPdfDocument(fileData, wrapper, null);
      } else if ((fileType || '').startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(fileName || '')) {
        wrapper.innerHTML = `<img src="${tfEscapeHtml(tfSafeUrl(fileData))}" class="max-w-full h-auto rounded shadow-lg border border-slate-700 pointer-events-auto" alt="Proof">`;
      } else {
        wrapper.innerHTML = `<iframe src="${tfEscapeHtml(tfSafeUrl(fileData))}" class="w-full h-[75vh] rounded shadow border border-slate-700 bg-white" frameborder="0"></iframe>`;
      }
    }
    this.resetPaymentPreviewZoom();
    if (window.lucide) window.lucide.createIcons();
  }

  /* ---------- LIVE BALANCE CALCULATION PILL ---------- */
  recalcPaymentLiveBalance() {
    // Amount in words follows the amount however it was filled (typed, preset, order balance, auto-fill).
    this.updatePaymentAmountWords(this.parseAmount(document.getElementById('pay-input-amount')?.value));
    const pill = document.getElementById('payment-live-balance-pill');
    if (!pill) return;

    const orderRef = document.getElementById('pay-select-order')?.value;
    if (!orderRef) {
      pill.classList.add('hidden');
      return;
    }

    const order = this.findOrder(orderRef);
    if (!order) {
      pill.classList.add('hidden');
      return;
    }

    const direction = this.paymentsState.paymentFormDirection || 'received';
    const thisAmount = Math.max(0, this.parseAmount(document.getElementById('pay-input-amount')?.value));

    let total = 0;
    let paid = 0;
    let rem = 0;
    let title = '';

    if (direction === 'received') {
      title = `Retailer Settlement: ${order.retailerName || 'Customer'} (${order.invoiceNumber || order.id})`;
      total = order.totalInvoiceAmount || 0;
      paid = order.customerAdvanceReceived || 0;
      rem = Math.max(0, total - (paid + thisAmount));
    } else {
      const category = document.getElementById('pay-select-category')?.value || 'manufacturer';
      if (category === 'packaging') {
        title = `Packaging Vendor PO: ${order.packagingVendor || 'Vendor'} (${order.invoiceNumber || order.id})`;
        total = Number(order.packagingTotalCost ?? order.packagingCost) || 0;
        paid = order.packagingAdvancePaid || 0;
        rem = Math.max(0, total - (paid + thisAmount));
      } else {
        title = `Manufacturer Advance: ${order.manufacturerName || 'Factory'} (${order.invoiceNumber || order.id})`;
        total = Number(order.manufacturerTotalCost) || 0;
        paid = order.manufacturerAdvancePaid || 0;
        rem = Math.max(0, total - (paid + thisAmount));
      }
    }

    const nameEl = document.getElementById('plb-order-name');
    const totEl = document.getElementById('plb-order-total');
    const paidEl = document.getElementById('plb-order-paid');
    const thisEl = document.getElementById('plb-order-this');
    const remEl = document.getElementById('plb-order-rem');

    if (nameEl) nameEl.textContent = title;
    if (totEl) totEl.textContent = this.formatCurrency(total);
    if (paidEl) paidEl.textContent = this.formatCurrency(paid);
    if (thisEl) thisEl.textContent = this.formatCurrency(thisAmount);
    if (remEl) {
      remEl.textContent = this.formatCurrency(rem);
      remEl.className = rem === 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold';
    }

    pill.classList.remove('hidden');
  }

  /* ---------- SYSTEM-WIDE DUPLICATE CHECK & DUAL-SLIP INSPECTOR ---------- */
  async checkDuplicatePaymentOnInput() {
    const utr = document.getElementById('pay-input-utr')?.value?.trim().toUpperCase();
    const amount = document.getElementById('pay-input-amount')?.value;
    const date = document.getElementById('pay-input-date')?.value;
    const party = document.getElementById('pay-input-party')?.value;
    const fileData = document.getElementById('pay-hidden-filedata')?.value;

    if (!utr && !fileData && (!amount || !party)) return;

    try {
      const resp = await fetch('/api/payments/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr, amount, date, party, fileData })
      });
      const data = await resp.json();
      const banner = document.getElementById('payment-duplicate-banner');
      const title = document.getElementById('payment-dup-title');
      const desc = document.getElementById('payment-dup-desc');

      if (data && data.isDuplicate) {
        this.lastDuplicateConflict = data;
        if (title) title.textContent = `Potential Duplicate Payment / File Detected (${data.matchedBy.toUpperCase()})!`;
        if (desc) desc.textContent = `Already recorded in Order ${data.duplicate?.order_id || data.duplicate?.orderRef || 'Existing'} (${data.duplicate?.party_name || data.duplicate?.partyName || ''}, ₹${data.duplicate?.amount || ''}).`;
        if (banner) banner.classList.remove('hidden');
      } else {
        this.lastDuplicateConflict = null;
        if (banner) banner.classList.add('hidden');
      }
    } catch (e) {
      console.warn('Payment duplicate check failed:', e);
    }
  }

  openDualSlipComparison(existingRecord = null, incomingRecord = null) {
    const modal = document.getElementById('dual-slip-comparison-modal');
    if (!modal) return;

    const existing = existingRecord || this.lastDuplicateConflict?.duplicate || this.lastDuplicateConflict?.existing;
    const incoming = incomingRecord || {
      partyName: document.getElementById('pay-input-party')?.value || 'Current Form',
      amount: document.getElementById('pay-input-amount')?.value || '',
      date: document.getElementById('pay-input-date')?.value || '',
      utr: document.getElementById('pay-input-utr')?.value || '',
      orderRef: document.getElementById('pay-select-order')?.value || '',
      dataUrl: document.getElementById('pay-hidden-filedata')?.value,
      fileName: document.getElementById('pay-hidden-filename')?.value
    };

    this.dualSlipExisting = existing;
    this.dualSlipIncoming = incoming;
    this.dualSlipZoom = 1.0;

    const matchInfo = document.getElementById('dsc-match-info');
    if (matchInfo) {
      matchInfo.textContent = `Collision detected: UTR / Reference "${existing?.utr || incoming?.utr || 'MATCH'}" matches an already registered payment!`;
    }

    // Left pane (Previous record)
    const lTitle = document.getElementById('dsc-left-title');
    const lDate = document.getElementById('dsc-left-date');
    const lViewport = document.getElementById('dsc-left-viewport');
    const lOpenBtn = document.getElementById('dsc-left-open-btn');
    const rOpenBtn = document.getElementById('dsc-right-open-btn');
    const viewOrderBtn = document.getElementById('dsc-btn-view-order');
    const viewOrderIdText = document.getElementById('dsc-view-order-id');

    const resolvedOrderId = existing?.order_id || existing?.orderRef || 'Registered Record';
    if (viewOrderIdText) viewOrderIdText.textContent = resolvedOrderId;
    if (viewOrderBtn) viewOrderBtn.classList.remove('hidden');

    if (lTitle) lTitle.textContent = `${resolvedOrderId} · ${existing?.party_name || existing?.partyName || 'Party'} (₹${Number(existing?.amount || 0).toLocaleString('en-IN')})`;
    if (lDate) lDate.textContent = this.formatDate(existing?.payment_date || existing?.date) || 'Recorded';
    if (lViewport) {
      const prevUrl = existing?.file_path ? `/api/documents/preview?path=${encodeURIComponent(existing.file_path)}` : (existing?.dataUrl || existing?.fileUrl || existing?.url || '');
      if (lOpenBtn) {
        if (prevUrl) {
          lOpenBtn.href = tfSafeUrl(prevUrl);
          lOpenBtn.classList.remove('hidden');
        } else {
          lOpenBtn.classList.add('hidden');
        }
      }
      if (prevUrl) {
        if (prevUrl.toLowerCase().endsWith('.pdf') || prevUrl.startsWith('data:application/pdf')) {
          lViewport.innerHTML = `
            <div id="dsc-left-zoom" class="w-full h-full flex flex-col origin-top transition-transform duration-150">
              <iframe src="${tfEscapeHtml(tfSafeUrl(prevUrl))}#toolbar=0&navpanes=0" class="w-full flex-1 rounded-t border border-slate-700 bg-white" style="min-height: 68vh;"></iframe>
              <div class="px-3 py-1.5 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs text-slate-300">
                <span class="truncate">${tfEscapeHtml(existing?.fileName || 'Registered Bank Slip (PDF)')}</span>
                <a href="${tfEscapeHtml(tfSafeUrl(prevUrl))}" target="_blank" class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold hover:bg-amber-500/30 flex items-center gap-1 shrink-0">
                  <span>Open Full PDF ↗</span>
                </a>
              </div>
            </div>
          `;
        } else {
          lViewport.innerHTML = `
            <div id="dsc-left-zoom" class="w-full h-full flex flex-col items-center justify-center origin-top transition-transform duration-150">
              <img src="${tfEscapeHtml(tfSafeUrl(prevUrl))}" class="max-w-full max-h-[68vh] rounded shadow object-contain">
              <div class="w-full px-3 py-1.5 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs text-slate-300 mt-2">
                <span class="truncate">${tfEscapeHtml(existing?.fileName || 'Registered Bank Slip')}</span>
                <a href="${tfEscapeHtml(tfSafeUrl(prevUrl))}" target="_blank" class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold hover:bg-amber-500/30 flex items-center gap-1 shrink-0">
                  <span>Open Image ↗</span>
                </a>
              </div>
            </div>
          `;
        }
      } else {
        lViewport.innerHTML = `
          <div class="p-6 text-center text-slate-300">
            <i data-lucide="receipt" class="w-12 h-12 mx-auto mb-2 text-amber-400"></i>
            <h4 class="font-bold text-sm text-white">Registered Payment Record</h4>
            <p class="text-xs text-slate-400 mt-1">Order: <b>${tfEscapeHtml(existing?.order_id || existing?.orderRef || '—')}</b></p>
            <p class="text-xs text-slate-400">Party: <b>${tfEscapeHtml(existing?.party_name || existing?.partyName || '—')}</b></p>
            <p class="text-xs text-slate-400">Amount: <b>₹${tfEscapeHtml(Number(existing?.amount || 0).toLocaleString('en-IN'))}</b></p>
            <p class="text-xs text-slate-400">UTR: <b class="font-mono text-amber-300">${tfEscapeHtml(existing?.utr || '—')}</b></p>
          </div>
        `;
      }
    }

    // Right pane (Incoming record)
    const rTitle = document.getElementById('dsc-right-title');
    const rDate = document.getElementById('dsc-right-date');
    const rViewport = document.getElementById('dsc-right-viewport');
    if (rTitle) rTitle.textContent = `${incoming?.orderRef || 'Current Form Intake'} · ${incoming?.partyName || 'Party'} (₹${Number(incoming?.amount || 0).toLocaleString('en-IN')})`;
    if (rDate) rDate.textContent = this.formatDate(incoming?.date) || 'Today';
    if (rViewport) {
      const inUrl = incoming?.dataUrl || incoming?.fileDataUrl || incoming?.fileUrl || incoming?.url || (incoming?.file_path ? `/api/documents/preview?path=${encodeURIComponent(incoming.file_path)}` : '');
      if (rOpenBtn) {
        if (inUrl) {
          rOpenBtn.href = tfSafeUrl(inUrl);
          rOpenBtn.classList.remove('hidden');
        } else {
          rOpenBtn.classList.add('hidden');
        }
      }
      if (inUrl) {
        if (inUrl.toLowerCase().endsWith('.pdf') || inUrl.startsWith('data:application/pdf')) {
          rViewport.innerHTML = `
            <div id="dsc-right-zoom" class="w-full h-full flex flex-col origin-top transition-transform duration-150">
              <iframe src="${tfEscapeHtml(tfSafeUrl(inUrl))}#toolbar=0&navpanes=0" class="w-full flex-1 rounded-t border border-slate-700 bg-white" style="min-height: 68vh;"></iframe>
              <div class="px-3 py-1.5 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs text-slate-300">
                <span class="truncate">${tfEscapeHtml(incoming?.fileName || 'Incoming Bank Slip (PDF)')}</span>
                <a href="${tfEscapeHtml(tfSafeUrl(inUrl))}" target="_blank" class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold hover:bg-purple-500/30 flex items-center gap-1 shrink-0">
                  <span>Open Full PDF ↗</span>
                </a>
              </div>
            </div>
          `;
        } else {
          rViewport.innerHTML = `
            <div id="dsc-right-zoom" class="w-full h-full flex flex-col items-center justify-center origin-top transition-transform duration-150">
              <img src="${tfEscapeHtml(tfSafeUrl(inUrl))}" class="max-w-full max-h-[68vh] rounded shadow object-contain">
              <div class="w-full px-3 py-1.5 bg-slate-800 border-t border-slate-700 flex items-center justify-between text-xs text-slate-300 mt-2">
                <span class="truncate">${tfEscapeHtml(incoming?.fileName || 'Incoming Scanned Slip')}</span>
                <a href="${tfEscapeHtml(tfSafeUrl(inUrl))}" target="_blank" class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold hover:bg-purple-500/30 flex items-center gap-1 shrink-0">
                  <span>Open Image ↗</span>
                </a>
              </div>
            </div>
          `;
        }
      } else {
        rViewport.innerHTML = `
          <div class="p-6 text-center text-slate-300">
            <i data-lucide="file-question" class="w-12 h-12 mx-auto mb-2 text-purple-400"></i>
            <h4 class="font-bold text-sm text-white">Incoming Payment Draft</h4>
            <p class="text-xs text-slate-400 mt-1">Party: <b>${tfEscapeHtml(incoming?.partyName || '—')}</b></p>
            <p class="text-xs text-slate-400">Amount: <b>₹${tfEscapeHtml(Number(incoming?.amount || 0).toLocaleString('en-IN'))}</b></p>
            <p class="text-xs text-slate-400">UTR: <b class="font-mono text-purple-300">${tfEscapeHtml(incoming?.utr || '—')}</b></p>
          </div>
        `;
      }
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeDualSlipComparison() {
    const modal = document.getElementById('dual-slip-comparison-modal');
    if (modal) modal.classList.add('hidden');
    this.closeDualSlipOrderDossier();
  }

  zoomDualSlips(delta) {
    this.dualSlipZoom = Math.max(0.4, Math.min(3.0, (this.dualSlipZoom || 1.0) + delta));
    const left = document.getElementById('dsc-left-zoom');
    const right = document.getElementById('dsc-right-zoom');
    if (left) left.style.transform = `scale(${this.dualSlipZoom})`;
    if (right) right.style.transform = `scale(${this.dualSlipZoom})`;
  }

  resetDualSlipsZoom() {
    this.dualSlipZoom = 1.0;
    const left = document.getElementById('dsc-left-zoom');
    const right = document.getElementById('dsc-right-zoom');
    if (left) left.style.transform = 'scale(1)';
    if (right) right.style.transform = 'scale(1)';
  }

  async viewRelatedOrderFromDualSlip() {
    const existing = this.dualSlipExisting;
    if (!existing) return;
    const orderRef = existing.order_id || existing.orderRef;
    const order = this.findOrder(orderRef);
    const modal = document.getElementById('dual-slip-order-dossier-modal');
    const body = document.getElementById('dsod-body');
    const titleEl = document.getElementById('dsod-order-title');
    const badgeEl = document.getElementById('dsod-order-status-badge');
    const subEl = document.getElementById('dsod-subtitle');
    if (!modal || !body) return;

    const matchedUtr = (existing.utr || '').trim().toUpperCase();

    if (order) {
      if (titleEl) titleEl.textContent = `Order Dossier: ${order.invoiceNumber} (${order.id})`;
      if (badgeEl) {
        badgeEl.textContent = (order.status || 'Active').toUpperCase();
        badgeEl.className = order.status === 'paid' ? 'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30';
      }
      if (subEl) subEl.textContent = `Buyer: ${order.retailerName} · Supplier: ${order.manufacturerName || 'Factory'}`;

      // Payments associated with this order
      const relatedPayments = (this.data.payments || []).filter(p => 
        (p.orderRef && (p.orderRef === order.id || p.orderRef === order.invoiceNumber)) ||
        (p.orderFolder && (p.orderFolder === order.id || p.orderFolder === order.invoiceNumber)) ||
        (p.utr && matchedUtr && p.utr.trim().toUpperCase() === matchedUtr)
      );

      // Fetch documents for this order
      let orderDocs = [];
      try {
        const docRes = await fetch(`/api/documents/orders/${encodeURIComponent(order.id)}`);
        const docJson = await docRes.json();
        if (docJson.success) orderDocs = docJson.documents || [];
      } catch (_) {}

      body.innerHTML = `
        <!-- Top Conflict Warning Banner -->
        <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-950 dark:text-rose-100 flex items-start gap-3">
          <span class="p-1 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0"><i data-lucide="triangle-alert" class="w-4 h-4 inline-block"></i></span>
          <div class="text-xs leading-relaxed">
            <strong class="font-black text-rose-800 dark:text-rose-300">Collision Detection Context:</strong>
            The incoming bank slip carries UTR <code class="font-mono bg-white dark:bg-rose-950/80 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100 font-black shadow-2xs">${tfEscapeHtml(matchedUtr || '—')}</code> for ₹${tfEscapeHtml(Number(existing.amount || 0).toLocaleString('en-IN'))}.
            Review the registered order details and payments ledger below to decide whether to merge or separate.
          </div>
        </div>

        <!-- 3-Column Financial & Stakeholder Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Buyer / Customer</span>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white mt-1">${tfEscapeHtml(order.retailerName)}</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Contact: ${tfEscapeHtml(order.retailerId || '—')}</p>
          </div>
          <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Manufacturer / Supplier</span>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white mt-1">${tfEscapeHtml(order.manufacturerName || 'Manufacturer not set')}</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Supplier: ${tfEscapeHtml(order.manufacturerId || '—')}</p>
          </div>
          <div class="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Value & Balances</span>
            <div class="flex items-baseline justify-between mt-1">
              <span class="text-xs font-bold text-slate-900 dark:text-white">Total: ₹${tfEscapeHtml(Number(order.totalInvoiceAmount || 0).toLocaleString('en-IN'))}</span>
              <span class="text-xs font-bold ${tfEscapeHtml(order.customerBalanceDue > 0 ? 'text-amber-400' : 'text-emerald-400')}">Due: ₹${tfEscapeHtml(Number(order.customerBalanceDue || 0).toLocaleString('en-IN'))}</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Terms: ${tfEscapeHtml(order.paymentTerms || 'Standard')}</p>
          </div>
        </div>

        <!-- Order Items -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          <div class="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Order Batch Items</span>
            <span class="text-xs text-slate-400 font-mono">${tfEscapeHtml((order.items || []).length)} Item(s)</span>
          </div>
          <div class="p-3">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-1">
                  <th class="py-1">Product</th>
                  <th class="py-1">Pack Size</th>
                  <th class="py-1 text-center">Cases</th>
                  <th class="py-1 text-right">Unit Rate</th>
                  <th class="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/40">
                ${(order.items || []).map(item => `
                  <tr>
                    <td class="py-1.5 font-medium text-slate-900 dark:text-white">${tfEscapeHtml(item.name || item.shortName)}</td>
                    <td class="py-1.5 text-slate-400">${tfEscapeHtml(item.packSize || 'Standard')}</td>
                    <td class="py-1.5 text-center font-mono">${tfEscapeHtml(item.cases || item.quantity || 1)}</td>
                    <td class="py-1.5 text-right font-mono">₹${tfEscapeHtml(Number(item.unitRate || 0).toLocaleString('en-IN'))}</td>
                    <td class="py-1.5 text-right font-mono font-bold">₹${tfEscapeHtml(Number(item.totalAmount || 0).toLocaleString('en-IN'))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Registered Payments on this Order -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          <div class="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Payments Registered on Order (${tfEscapeHtml(relatedPayments.length)})</span>
              <span class="text-xs text-amber-500 font-bold">Inspect matching UTRs below</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 dark:bg-slate-950/40 text-xs font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th class="p-2.5">Date</th>
                  <th class="p-2.5">Direction</th>
                  <th class="p-2.5">Party</th>
                  <th class="p-2.5">Amount</th>
                  <th class="p-2.5">Mode</th>
                  <th class="p-2.5">UTR / Reference</th>
                  <th class="p-2.5 text-right">Proof</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                ${relatedPayments.length === 0 ? `
                  <tr>
                    <td colspan="7" class="p-4 text-center text-slate-400">No payment records found in ledger for this order.</td>
                  </tr>
                ` : relatedPayments.map(p => {
                  const isConflict = matchedUtr && (p.utr || '').trim().toUpperCase() === matchedUtr;
                  const isPaid = p.direction === 'paid';
                  const proofUrl = p.pd || p.fileUrl || (p.file_path ? `/api/documents/preview?path=${encodeURIComponent(p.file_path)}` : '');
                  return `
                    <tr class="${tfEscapeHtml(isConflict ? 'bg-rose-500/10 dark:bg-rose-950/30 font-semibold' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30')}">
                      <td class="p-2.5 whitespace-nowrap">${tfEscapeHtml(p.date || '—')}</td>
                      <td class="p-2.5 whitespace-nowrap">
                        <span class="px-1.5 py-0.5 rounded text-xs font-bold ${tfEscapeHtml(isPaid ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300')}">
                          ${tfEscapeHtml(isPaid ? 'Money Out (Paid)' : 'Money In (Recv)')}
                        </span>
                      </td>
                      <td class="p-2.5 font-medium text-slate-800 dark:text-slate-200">${tfEscapeHtml(p.partyName || '—')}</td>
                      <td class="p-2.5 font-mono font-bold text-slate-900 dark:text-white">₹${tfEscapeHtml(Number(p.amount || 0).toLocaleString('en-IN'))}</td>
                      <td class="p-2.5 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">${tfEscapeHtml(p.mode || 'NEFT')}</td>
                      <td class="p-2.5">
                        <div class="flex items-center gap-2">
                          <code class="font-mono text-xs font-black text-slate-950 dark:text-slate-50 bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 select-all tracking-wide shadow-2xs">${tfEscapeHtml(p.utr || '—')}</code>
                          ${isConflict ? `
                            <span class="px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider bg-rose-600 text-white shadow-xs flex items-center gap-1 shrink-0 border border-rose-700">MATCHED</span>
                          ` : ''}
                        </div>
                      </td>
                      <td class="p-2.5 text-right whitespace-nowrap">
                        ${proofUrl ? `
                          <a href="${tfEscapeHtml(tfSafeUrl(proofUrl))}" target="_blank" class="btn-tactile px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1 border border-slate-700">
                            <span>View Slip ↗</span>
                          </a>
                        ` : `
                          <span class="text-slate-400 text-xs">No proof</span>
                        `}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Attached Documents in Order Folder -->
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
          <div class="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-800 dark:text-slate-200">Document Vault Files (${tfEscapeHtml(orderDocs.length)})</span>
            <span class="text-xs text-slate-400 font-mono">/data/orders/${tfEscapeHtml(order.id)}</span>
          </div>
          <div class="p-3">
            ${orderDocs.length === 0 ? `
              <p class="text-xs text-slate-400 text-center py-2">No documents currently registered in this order folder.</p>
            ` : `
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${orderDocs.map(doc => {
                  const docUrl = doc.fileUrl || doc.url || doc.path || '';
                  const docName = doc.fileName || doc.originalName || doc.storedFileName || 'Document';
                  const docSize = doc.sizeFormatted || (doc.fileSize ? `${(doc.fileSize / 1024).toFixed(1)} KB` : '—');
                  return `
                    <div class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between gap-2">
                      <div class="min-w-0">
                        <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title="${tfEscapeHtml(docName)}">${tfEscapeHtml(docName)}</p>
                        <p class="text-xs text-slate-400 font-mono">${tfEscapeHtml(docSize)} • ${tfEscapeHtml(doc.category || 'Receipt')}</p>
                      </div>
                      ${docUrl ? `
                        <a href="${tfEscapeHtml(tfSafeUrl(docUrl))}" target="_blank" class="btn-tactile px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 border border-slate-700 inline-flex items-center gap-1">
                          <span>Preview ↗</span>
                        </a>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      `;
    } else {
      if (titleEl) titleEl.textContent = `Order Record: ${orderRef || 'Registered Record'}`;
      if (badgeEl) {
        badgeEl.textContent = 'REGISTERED';
        badgeEl.className = 'px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30';
      }
      if (subEl) subEl.textContent = `Counterparty: ${existing.party_name || existing.partyName || 'Party'}`;
      body.innerHTML = `
        <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs leading-relaxed">
          <strong class="font-bold text-amber-900 dark:text-amber-300">Registered Collision Record:</strong><br>
          Order Reference: <b class="text-slate-900 dark:text-white font-bold">${tfEscapeHtml(orderRef || '—')}</b><br>
          Counterparty: <b class="text-slate-900 dark:text-white font-bold">${tfEscapeHtml(existing.party_name || existing.partyName || '—')}</b><br>
          Amount: <b class="text-slate-900 dark:text-white font-bold">₹${tfEscapeHtml(Number(existing.amount || 0).toLocaleString('en-IN'))}</b><br>
          Recorded Date: <b class="text-slate-900 dark:text-white font-bold">${tfEscapeHtml(existing.date || existing.payment_date || '—')}</b><br>
          Matched UTR: <b class="font-mono text-rose-700 dark:text-rose-300 font-black">${tfEscapeHtml(matchedUtr || '—')}</b>
        </div>
      `;
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeDualSlipOrderDossier() {
    const modal = document.getElementById('dual-slip-order-dossier-modal');
    if (modal) modal.classList.add('hidden');
  }

  async mergeDuplicateSlipToOrder() {
    const existing = this.dualSlipExisting;
    const incoming = this.dualSlipIncoming;
    const orderId = existing?.order_id || existing?.orderRef || 'general';
    const partyName = existing?.party_name || existing?.partyName || incoming?.partyName || 'Counterparty';
    const utr = existing?.utr || incoming?.utr || '';

    this.showToast('Attaching slip to order documents...');
    try {
      const fileData = incoming?.dataUrl || incoming?.fileDataUrl || incoming?.fileUrl;
      if (fileData) {
        await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderId,
            category: 'receipt',
            fileName: incoming.fileName || `Verification_Slip_${Date.now()}.png`,
            fileData: fileData,
            metadata: {
              partyName: partyName,
              direction: 'paid',
              utr: utr,
              date: incoming.date || new Date().toISOString().split('T')[0],
              customFileName: `${orderId}_${partyName.replace(/[^a-zA-Z0-9]/g, '_')}_MergedSlip_${Date.now()}.png`
            }
          })
        });
      }

      // Update matching payment in app.data.payments
      const matchingPay = (this.data.payments || []).find(p => p.utr && p.utr.toUpperCase() === utr.toUpperCase());
      if (matchingPay) {
        matchingPay.hasProof = true;
      }

      // Clean pending mobile snaps if active
      if (this.currentPendingMobileSnapId) {
        this.data.pendingMobileSnaps = (this.data.pendingMobileSnaps || []).filter(s => s.id !== this.currentPendingMobileSnapId);
        this.currentPendingMobileSnapId = null;
        this.saveData();
      }

      // Close Smart Fill if open
      if (window.TradeFlowSmartFill?.close) {
        window.TradeFlowSmartFill.close();
      }

      this.closeDualSlipOrderDossier();
      this.closeDualSlipComparison();
      this.closePaymentModal();
      this.renderOrders();
      this.renderPayments();
      this.updateUrgentCounter();
      this.showToast(`Successfully merged! Slip attached to Order ${orderId} (${partyName}).`);
    } catch (e) {
      console.error('Failed to merge slip:', e);
      this.showToast('Failed to merge slip: ' + e.message, 'error');
    }
  }

  rejectDuplicateSlip() {
    this.closeDualSlipOrderDossier();
    this.closeDualSlipComparison();
    this.clearPaymentProofAttachment();
    const banner = document.getElementById('payment-duplicate-banner');
    if (banner) banner.classList.add('hidden');
    this.lastDuplicateConflict = null;

    if (this.currentPendingMobileSnapId) {
      this.data.pendingMobileSnaps = (this.data.pendingMobileSnaps || []).filter(s => s.id !== this.currentPendingMobileSnapId);
      this.currentPendingMobileSnapId = null;
      this.saveData();
      this.updateUrgentCounter();
    }

    if (window.TradeFlowSmartFill) {
      window.TradeFlowSmartFill.duplicateConflict = null;
      window.TradeFlowSmartFill.hideDuplicateWarning();
      window.TradeFlowSmartFill.discardCurrentDraft?.();
    }

    this.showToast('Discarded duplicate payment slip. No duplicated entry was recorded.');
  }

  linkToExistingPayment() {
    // Alias to mergeDuplicateSlipToOrder
    this.mergeDuplicateSlipToOrder();
  }

  overrideAndProceedPayment() {
    this.closeDualSlipOrderDossier();
    this.closeDualSlipComparison();
    const banner = document.getElementById('payment-duplicate-banner');
    if (banner) banner.classList.add('hidden');
    this.lastDuplicateConflict = null;

    if (window.TradeFlowSmartFill) {
      window.TradeFlowSmartFill.duplicateOverride = true;
      window.TradeFlowSmartFill.hideDuplicateWarning();
    }

    this.showToast('Proceeding with separate transaction under manual override.');
  }

  async submitPaymentCockpit() {
    const dateInput = document.getElementById('pay-input-date');
    const amountInput = document.getElementById('pay-input-amount');
    const partyInput = document.getElementById('pay-input-party');
    const orderSelect = document.getElementById('pay-select-order');
    const orderErr = document.getElementById('pay-order-error');

    const date = dateInput?.value;
    const amount = this.parseAmount(amountInput?.value);
    const partyName = partyInput?.value?.trim();
    const partyType = document.getElementById('pay-select-category')?.value || 'other';
    const mode = document.getElementById('pay-select-mode')?.value || 'NEFT';
    const orderRef = orderSelect?.value?.trim() || '';
    const utr = document.getElementById('pay-input-utr')?.value?.trim().toUpperCase() || '';
    const bank = document.getElementById('pay-input-bank')?.value?.trim() || '';
    const txnId = document.getElementById('pay-input-txnid')?.value?.trim() || '';
    const beneficiaryAccount = document.getElementById('pay-input-beneficiary-acc')?.value?.trim() || '';
    const payerAccount = document.getElementById('pay-input-payer-acc')?.value?.trim() || '';
    const notes = document.getElementById('pay-input-notes')?.value?.trim() || '';
    const direction = this.paymentsState.paymentFormDirection || 'received';

    const fileData = document.getElementById('pay-hidden-filedata')?.value;
    const fileName = document.getElementById('pay-hidden-filename')?.value;
    const fileType = document.getElementById('pay-hidden-filetype')?.value;
    const editId = document.getElementById('pay-hidden-edit-id')?.value;

    // --- MANDATORY VALIDATIONS ---
    // An order is optional: without one the payment is kept "on account" against the party.
    if (orderErr) orderErr.classList.add('hidden');

    // 2. Date is mandatory
    if (!date) {
      this.setFieldHighlight('pay-input-date', null, false, true);
      if (dateInput) dateInput.focus();
      this.showToast('Date is required.');
      return;
    }

    // 3. Amount is mandatory and must be > 0
    if (!amount || isNaN(amount) || amount <= 0) {
      this.setFieldHighlight('pay-input-amount', null, false, true);
      if (amountInput) amountInput.focus();
      this.showToast('Valid payment amount (> 0) is required.');
      return;
    }

    // 4. Party / Company name is mandatory
    if (!partyName) {
      this.setFieldHighlight('pay-input-party', null, false, true);
      if (partyInput) partyInput.focus();
      this.showToast('Party / Company name is required.');
      return;
    }

    // 5. Possible duplicate: same UTR, or same party, amount, date and direction, already in the ledger.
    const sameUtr = utr.length >= 6 ? (this.data.payments || []).find(p => !p.isDeleted && p.id !== editId && String(p.utr || '').trim().toUpperCase() === utr) : null;
    const sameEntry = (this.data.payments || []).find(p => !p.isDeleted && p.id !== editId && p.direction === direction && Number(p.amount) === amount && p.date === date && String(p.partyName || '').trim().toLowerCase() === partyName.toLowerCase());
    const duplicate = sameUtr || sameEntry;
    if (duplicate && !this._paymentDuplicateConfirmed) {
      const recordAnyway = await this.showModalConfirm({
        title: 'Possible Duplicate Payment',
        subtitle: sameUtr ? 'Same UTR / reference' : 'Same party, amount and date',
        message: `This looks like payment <b>${tfEscapeHtml(duplicate.id)}</b>: ${tfEscapeHtml(this.formatCurrency(duplicate.amount))} · ${tfEscapeHtml(duplicate.partyName || '')} · ${tfEscapeHtml(duplicate.date || '')}${duplicate.utr ? ` · UTR ${tfEscapeHtml(duplicate.utr)}` : ''}.<br><br>Recording it again would count the money twice.`,
        confirmText: 'Record anyway',
        confirmClass: 'bg-amber-600 hover:bg-amber-500',
        icon: 'alert-triangle'
      });
      if (!recordAnyway) {
        this.showToast('Not recorded: possible duplicate payment.');
        return;
      }
    }

    // Smart file renaming
    const cleanParty = partyName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const prefix = direction === 'paid' ? 'PaidTo' : 'RecvFrom';
    const dateStr = date.replace(/[^0-9-]/g, '');
    const ext = (fileName && fileName.includes('.')) ? '.' + fileName.split('.').pop() : '.pdf';
    const safeOrderFolder = (orderRef || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const renamedFileName = `${safeOrderFolder}_${prefix}_${cleanParty}_INR${Math.round(amount)}_${dateStr}${utr ? '_' + utr : ''}${ext}`;

    let savedDocUrl = fileData;
    let isSavedToServer = false;

    // Standardized Order Archiving & System-Wide Slip Registration
    if (fileData) {
      try {
        const archResp = await fetch('/api/vault/archive-payment-proof', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: safeOrderFolder,
            partyName: partyName,
            paymentType: direction === 'paid' ? 'PaidTo' : 'RecvFrom',
            date: date,
            fileData: fileData,
            fileName: fileName || renamedFileName,
            mimeType: fileType,
            utr: utr,
            bankTxnId: txnId,
            beneficiaryAccount: beneficiaryAccount,
            payerAccount: payerAccount,
            amount: amount,
            notes: notes
          })
        });
        if (archResp.ok) {
          const archData = await archResp.json();
          if (archData && archData.success) {
            savedDocUrl = archData.fileUrl || archData.url || savedDocUrl; // web link, not the server's disk path
            isSavedToServer = true;
          }
        } else {
          // Fallback to general documents endpoint
          const resp = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: safeOrderFolder,
              category: direction === 'paid' ? 'bank_receipt' : 'payment_received',
              fileName: fileName || renamedFileName,
              fileData,
              metadata: {
                customFileName: renamedFileName,
                direction,
                partyName,
                partyType,
                amount,
                date,
                utrNumber: utr,
                bankName: bank,
                txnId,
                notes,
                orderRef
              }
            })
          });
          if (resp.ok) {
            const resData = await resp.json();
            if (resData && resData.doc && resData.doc.fileUrl) {
              savedDocUrl = resData.doc.fileUrl;
              isSavedToServer = true;
              if (!this.data.documents) this.data.documents = [];
              this.data.documents.unshift(resData.doc);
            }
          }
        }
      } catch (err) {
        console.warn('Standardized archiving error, keeping in-memory preview:', err);
      }
    }

    // Update order balances: when editing, first reverse the payment as it was saved, then apply the new values.
    if (editId) {
      const previous = (this.data.payments || []).find(p => p.id === editId);
      if (previous && !previous.isDeleted) this.applyPaymentToOrder(previous, -1);
    }
    this.applyPaymentToOrder({ orderRef, amount, direction, partyType }, 1);

    if (!this.data.payments) this.data.payments = [];

    if (editId) {
      const idx = this.data.payments.findIndex(p => p.id === editId);
      if (idx !== -1) {
        this.data.payments[idx] = {
          ...this.data.payments[idx],
          date,
          amount,
          partyName,
          partyType,
          mode,
          orderRef,
          utr,
          bank,
          txnId,
          bankTxnId: txnId,
          beneficiaryAccount,
          payerAccount,
          notes,
          direction,
          hasProof: !!(fileData || this.data.payments[idx].pd),
          pd: savedDocUrl || this.data.payments[idx].pd,
          dataUrl: isSavedToServer ? undefined : (fileData || this.data.payments[idx].dataUrl),
          pn: renamedFileName || this.data.payments[idx].pn,
          pt: fileType || this.data.payments[idx].pt,
          orderFolder: safeOrderFolder,
          lastModifiedTimeLog: this.getLiveFormattedDateTime()
        };
      }
      this.showToast(`Payment updated: ${this.formatCurrency(amount)} · ${partyName}`);
    } else {
      const newEntry = {
        id: 'PAY-' + Date.now(),
        date,
        amount,
        partyName,
        partyType,
        mode,
        orderRef,
        utr,
        bank,
        txnId,
        bankTxnId: txnId,
        beneficiaryAccount,
        payerAccount,
        notes,
        direction,
        hasProof: !!fileData,
        pd: savedDocUrl,
        dataUrl: isSavedToServer ? undefined : fileData, // keep the file inline only if it could not be saved to disk
        pn: renamedFileName,
        pt: fileType,
        orderFolder: safeOrderFolder,
        savedToDisk: isSavedToServer,
        time: this.formatTime(new Date(), true),
        timeLog: this.getLiveFormattedDateTime(),
        createdAt: new Date().toISOString()
      };
      this.data.payments.unshift(newEntry);
      this.showToast(`Payment logged: ${direction === 'received' ? '+' : '-'}${this.formatCurrency(amount)} · ${partyName}`);

      // 10-Second Floating Undo Banner with Form State Snapshot
      const paymentSnapshot = {
        date,
        amount,
        partyName,
        partyType,
        mode,
        orderRef,
        utr,
        bank,
        txnId,
        beneficiaryAccount,
        payerAccount,
        notes,
        direction,
        fileData,
        fileName: fileName || renamedFileName,
        fileType,
        pendingMobileSnap: this.lastProcessedMobileSnap || null,
        pendingMobileSnapId: this.currentPendingMobileSnapId || null
      };

      this.showUndoToast(`Payment logged: ${direction === 'received' ? '+' : '-'}${this.formatCurrency(amount)} · ${partyName}`, () => {
        const idx = this.data.payments.findIndex(x => x.id === newEntry.id);
        if (idx !== -1) {
          this.data.payments.splice(idx, 1);

          // Revert order balance updates if attached
          this.applyPaymentToOrder({ orderRef, amount, direction, partyType }, -1);

          // Restore mobile snap to pending queue if it came from one
          if (paymentSnapshot.pendingMobileSnap) {
            if (!this.data.pendingMobileSnaps) this.data.pendingMobileSnaps = [];
            if (!this.data.pendingMobileSnaps.some(s => s.id === paymentSnapshot.pendingMobileSnap.id)) {
              this.data.pendingMobileSnaps.unshift(paymentSnapshot.pendingMobileSnap);
            }
          }

          this.saveData();
          this.renderPaymentsLedger();
          this.updateSidebarUI();
          this.renderKPIs();
          this.renderActiveView();

          // Re-open Payment Modal and restore all fields & attachments!
          this.restorePaymentModalFromSnapshot(paymentSnapshot);
          this.showToast('Payment undone! Reopened details in form so you can make changes.');
        }
      });
    }

    this.saveData();
    window.TradeFlowSmartFill?.markSaved?.();
    this.closePaymentModal(true);
    this.updateSidebarUI();
    this.renderKPIs();
    this.renderActiveView();

    const diaryDate = document.getElementById('daily-diary-date')?.value || this.dailyDiaryWorkspaceDate;
    if (diaryDate) {
      this.renderDailyDiary(diaryDate);
      if (this.activeTab === 'daily-diary') this.renderDailyDiaryWorkspaceView(diaryDate);
    }

    if (this.opfState && this.opfState.paymentId) {
      const pExists = (this.data.payments || []).find(x => x.id === this.opfState.paymentId);
      if (pExists) {
        this.openOrderPaymentFullModal(this.opfState.paymentId);
      }
    }
  }

  handlePaymentClipboardPaste(event) {
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
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        this.attachPaymentProofData(dataUrl, `clipboard_receipt_${Date.now()}.png`, imageFile.type || 'image/png');
        this.showToast('Attached payment receipt screenshot from clipboard!');
      };
      reader.readAsDataURL(imageFile);
      return;
    }

    const text = event.clipboardData?.getData('text');
    if (text) {
      // Look for amount: Rs 15,000 or ₹15000 or 15000.00
      const amtMatch = text.match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d+)?)/i) || text.match(/\b([\d,]+(?:\.\d{2}))\b/);
      if (amtMatch) {
        const amt = parseFloat(amtMatch[1].replace(/,/g, ''));
        if (!isNaN(amt) && amt > 0) {
          const amtInp = document.getElementById('pay-input-amount');
          if (amtInp) { amtInp.value = amt; amtInp.classList.add('autofill-highlight'); }
        }
      }
      // Look for UTR / txn id:
      const utrMatch = text.match(/(?:utr|txn|rrn|ref)[:\s#]*([a-zA-Z0-9]{8,22})/i);
      if (utrMatch) {
        const utrInp = document.getElementById('pay-input-utr');
        if (utrInp) { utrInp.value = utrMatch[1].toUpperCase(); utrInp.classList.add('autofill-highlight'); }
      }
      // Look for date:
      const dateMatch = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/);
      if (dateMatch) {
        const d = dateMatch[1].padStart(2, '0');
        const m = dateMatch[2].padStart(2, '0');
        const y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
        const dateInp = document.getElementById('pay-input-date');
        if (dateInp) { dateInp.value = `${y}-${m}-${d}`; dateInp.classList.add('autofill-highlight'); }
      }
    }
  }

  attachPaymentProofData(dataUrl, fileName, mimeType) {
    const hidFile = document.getElementById('pay-hidden-filedata');
    const hidName = document.getElementById('pay-hidden-filename');
    const hidType = document.getElementById('pay-hidden-filetype');
    if (hidFile) hidFile.value = dataUrl;
    if (hidName) hidName.value = fileName;
    if (hidType) hidType.value = mimeType;

    const dropzone = document.getElementById('payment-dropzone');
    const previewWrap = document.getElementById('payment-preview-wrap');
    const previewName = document.getElementById('payment-preview-name');
    const previewImg = document.getElementById('payment-preview-img');
    const previewIframe = document.getElementById('payment-preview-iframe');
    const statusBadge = document.getElementById('payment-doc-status-badge');

    if (dropzone) dropzone.classList.add('hidden');
    if (previewWrap) previewWrap.classList.remove('hidden');
    if (previewName) previewName.innerText = fileName;
    if (statusBadge) statusBadge.innerText = 'Attached';

    if (mimeType.startsWith('image/')) {
      if (previewImg) { previewImg.src = tfSafeUrl(dataUrl); previewImg.classList.remove('hidden'); }
      if (previewIframe) previewIframe.classList.add('hidden');
    } else {
      if (previewIframe) { previewIframe.src = tfSafeUrl(dataUrl); previewIframe.classList.remove('hidden'); }
      if (previewImg) previewImg.classList.add('hidden');
    }
  }

  // Compatibility aliases
  recalculateProfit() {
    this.updateProfitCalculator();
  }

  runBatchSimulation() {
    this.updateProfitCalculator();
  }

  onPaymentAmountInput(val) {
    const rawVal = String(val || '').trim();
    if (/[+*\/]/.test(rawVal)) {
      const hint = document.getElementById('pay-math-hint');
      if (hint) {
        hint.innerText = '⌨️ Math expression: press Enter/Tab to calculate';
        hint.classList.remove('hidden');
      }
      return;
    }

    const num = this.parseAmount(rawVal);
    this.updatePaymentAmountWords(num);
    this.checkFatFingerZeroWarning(num);
    this.recalcPaymentLiveBalance();
  }

  updatePaymentAmountWords(amount) {
    const words = this.convertNumberToIndianWords(amount);
    const enEl = document.getElementById('pay-words-en');
    if (enEl) enEl.innerText = words.english;
  }

  evaluateAmountMath(inputEl) {
    if (!inputEl) return;
    const raw = String(inputEl.value || '').trim();
    if (!raw) return;

    if (/[+\-*\/]/.test(raw)) {
      try {
        const cleanExpr = raw.replace(/[^0-9+\-*\/().]/g, '');
        if (cleanExpr) {
          const result = Function(`'use strict'; return (${cleanExpr})`)();
          if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
            const rounded = Math.round(result * 100) / 100;
            inputEl.value = rounded;
            const hint = document.getElementById('pay-math-hint');
            if (hint) {
              hint.innerText = `${cleanExpr} = ${this.formatCurrency(rounded)}`;
              hint.classList.remove('hidden');
              setTimeout(() => hint.classList.add('hidden'), 4000);
            }
            this.updatePaymentAmountWords(rounded);
            this.checkFatFingerZeroWarning(rounded);
            this.recalcPaymentLiveBalance();
          }
        }
      } catch (e) {
        console.warn('Math evaluation error:', e);
      }
    } else {
      const num = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
      this.updatePaymentAmountWords(num);
      this.checkFatFingerZeroWarning(num);
      this.recalcPaymentLiveBalance();
    }
  }

  checkFatFingerZeroWarning(amount) {
    const alertBox = document.getElementById('pay-fat-finger-alert');
    const textEl = document.getElementById('pay-fat-finger-text');
    const subEl = document.getElementById('pay-fat-finger-sub');
    const fixBtn = document.getElementById('pay-btn-fix-zero');
    if (!alertBox) return;

    if (!amount || amount < 100000) {
      alertBox.classList.add('hidden');
      return;
    }

    let referenceAmount = 50000;
    const orderSelect = document.getElementById('pay-select-order');
    if (orderSelect && orderSelect.value) {
      const ord = this.findOrder(orderSelect.value);
      if (ord) {
        referenceAmount = ord.customerBalanceDue || ord.totalInvoiceAmount || referenceAmount;
      }
    }

    if (amount >= referenceAmount * 4 && amount >= 200000) {
      const fixedAmount = Math.round(amount / 10);
      alertBox.classList.remove('hidden');
      if (textEl) {
        textEl.innerText = `High Zero Alert: Entered ${this.formatCurrency(amount)} (${this.convertNumberToIndianWords(amount).english})`;
      }
      if (subEl) {
        subEl.innerText = `This is significantly higher than usual (approx ${this.formatCurrency(referenceAmount)}). Did you type an extra zero?`;
      }
      if (fixBtn) {
        fixBtn.innerText = `Fix: ${this.formatCurrency(fixedAmount)}`;
        fixBtn.dataset.suggested = fixedAmount;
      }
    } else {
      alertBox.classList.add('hidden');
    }
  }

  applyFatFingerFix() {
    const fixBtn = document.getElementById('pay-btn-fix-zero');
    const input = document.getElementById('pay-input-amount');
    if (!fixBtn || !input) return;
    const suggested = parseFloat(fixBtn.dataset.suggested);
    if (suggested > 0) {
      input.value = suggested;
      this.updatePaymentAmountWords(suggested);
      this.checkFatFingerZeroWarning(suggested);
      this.recalcPaymentLiveBalance();
      this.showToast(`Amount corrected to ${this.formatCurrency(suggested)}`);
    }
  }

  setPaymentAmountPreset(presetVal) {
    const input = document.getElementById('pay-input-amount');
    if (input) {
      input.value = presetVal;
      this.updatePaymentAmountWords(presetVal);
      this.checkFatFingerZeroWarning(presetVal);
      this.recalcPaymentLiveBalance();
    }
  }

  setPaymentAmountFullBalance() {
    const orderSelect = document.getElementById('pay-select-order');
    let balance = 50000;
    if (orderSelect && orderSelect.value) {
      const ord = this.findOrder(orderSelect.value);
      if (ord) balance = ord.customerBalanceDue || ord.totalInvoiceAmount || 50000;
    }
    const input = document.getElementById('pay-input-amount');
    if (input) {
      input.value = balance;
      this.updatePaymentAmountWords(balance);
      this.checkFatFingerZeroWarning(balance);
      this.recalcPaymentLiveBalance();
    }
  }
});
