// TradeFlow form guard: live validation for every input, save blocking while a form has errors,
// and a "Fill demo data" button that fills the open form with valid, generated test data.
// Rules are inferred from each field's type, id, name, label and the app property it writes to,
// so fields drawn later (modals, studio editors, calculator rows) are covered automatically.
(function () {
  'use strict';

  /* ---------------------------------------------------------------- reference data */
  // GST state codes (first two digits of a GSTIN) with the short codes used in Udyam/CIN/vehicle numbers.
  const STATES = {
    '01': ['Jammu and Kashmir', 'JK'], '02': ['Himachal Pradesh', 'HP'], '03': ['Punjab', 'PB'], '04': ['Chandigarh', 'CH'],
    '05': ['Uttarakhand', 'UK'], '06': ['Haryana', 'HR'], '07': ['Delhi', 'DL'], '08': ['Rajasthan', 'RJ'],
    '09': ['Uttar Pradesh', 'UP'], '10': ['Bihar', 'BR'], '11': ['Sikkim', 'SK'], '12': ['Arunachal Pradesh', 'AR'],
    '13': ['Nagaland', 'NL'], '14': ['Manipur', 'MN'], '15': ['Mizoram', 'MZ'], '16': ['Tripura', 'TR'],
    '17': ['Meghalaya', 'ML'], '18': ['Assam', 'AS'], '19': ['West Bengal', 'WB'], '20': ['Jharkhand', 'JH'],
    '21': ['Odisha', 'OD'], '22': ['Chhattisgarh', 'CG'], '23': ['Madhya Pradesh', 'MP'], '24': ['Gujarat', 'GJ'],
    '26': ['Dadra and Nagar Haveli and Daman and Diu', 'DD'], '27': ['Maharashtra', 'MH'], '29': ['Karnataka', 'KA'],
    '30': ['Goa', 'GA'], '31': ['Lakshadweep', 'LD'], '32': ['Kerala', 'KL'], '33': ['Tamil Nadu', 'TN'],
    '34': ['Puducherry', 'PY'], '35': ['Andaman and Nicobar Islands', 'AN'], '36': ['Telangana', 'TS'],
    '37': ['Andhra Pradesh', 'AP'], '38': ['Ladakh', 'LA'], '97': ['Other Territory', 'OT'], '99': ['Centre Jurisdiction', 'CJ']
  };
  const GST_SLABS = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40];
  const PAN_ENTITY = 'PCHFATBLJG';
  const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /* ---------------------------------------------------------------- format checks */
  function gstinCheckChar(first14) {
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      const product = GSTIN_CHARS.indexOf(first14[i]) * (i % 2 ? 2 : 1);
      sum += Math.floor(product / 36) + (product % 36);
    }
    return GSTIN_CHARS[(36 - (sum % 36)) % 36];
  }
  function checkGstin(v) {
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) return err('GSTIN must be 15 characters, e.g. 27ABCDE1234F1Z5');
    if (!STATES[v.slice(0, 2)]) return err(`"${v.slice(0, 2)}" is not a GST state code`);
    if (!PAN_ENTITY.includes(v[5])) return err('Characters 3–12 must be a valid PAN');
    if (gstinCheckChar(v.slice(0, 14)) !== v[14]) return err('Check digit does not match: re-check the GSTIN for a typing mistake');
    return ok(`Valid GSTIN · ${STATES[v.slice(0, 2)][0]}`);
  }
  const checks = {
    gstin: v => checkGstin(v.toUpperCase()),
    pan: v => /^[A-Z]{3}[PCHFATBLJG][A-Z][0-9]{4}[A-Z]$/.test(v.toUpperCase()) ? ok('Valid PAN') : err('PAN must be 10 characters, e.g. ABCPE1234F'),
    ifsc: v => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()) ? ok('Valid IFSC') : err('IFSC must be 11 characters: 4 letters, 0, then 6 letters/digits (e.g. HDFC0001234)'),
    cin: v => /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(v.toUpperCase()) ? ok('Valid CIN') : err('CIN must be 21 characters, e.g. U15400MH2024PTC123456'),
    fssai: v => /^[0-9]{14}$/.test(v) ? ok('Valid FSSAI licence number') : err('FSSAI licence number must be exactly 14 digits'),
    udyam: v => /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/.test(v.toUpperCase()) ? ok('Valid Udyam number') : err('Udyam number format: UDYAM-MH-01-1234567'),
    iec: v => /^[A-Z0-9]{10}$/.test(v.toUpperCase()) ? ok('Valid IEC') : err('IEC must be 10 letters/digits'),
    upi: v => /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/.test(v) ? ok('Valid UPI ID') : err('UPI ID format: name@bank (e.g. shop@okhdfcbank)'),
    email: v => /^[^\s@<>()]+@[^\s@<>()]+\.[a-zA-Z]{2,}$/.test(v) ? none() : err('Enter a valid email address, e.g. accounts@company.com'),
    website: v => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? none() : err('Website must start with http:// or https://'); } catch { return err('Website must be a full address, e.g. https://example.com'); } },
    stateCode: v => STATES[v.padStart(2, '0')] && /^[0-9]{1,2}$/.test(v) ? ok(STATES[v.padStart(2, '0')][0]) : err('GST state code is 2 digits, 01–38 (e.g. 27 for Maharashtra)'),
    pincode: v => /^[1-9][0-9]{5}$/.test(v) ? none() : err('PIN code must be 6 digits and cannot start with 0'),
    phone: (v, field) => {
      const digits = v.replace(/[\s()-]/g, '').replace(/^\+?91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
      if (/^[6-9][0-9]{9}$/.test(digits)) return none();
      if (field.landline && /^0?[1-9][0-9]{9}$/.test(v.replace(/[\s()-]/g, '').replace(/^\+?91/, ''))) return none();
      return err(field.landline ? 'Enter a 10-digit mobile or a landline with STD code' : 'Mobile number must be 10 digits starting with 6–9 (+91 optional)');
    },
    account: v => /^[0-9]{9,18}$/.test(v.replace(/\s/g, '')) ? none() : err('Bank account number must be 9–18 digits'),
    utr: v => /^[A-Za-z0-9]{12,22}$/.test(v.replace(/\s/g, '')) ? none() : err('UTR / reference must be 12–22 letters or digits (NEFT 16, IMPS 12, RTGS 22)'),
    txn: v => /^[A-Za-z0-9/_-]{4,40}$/.test(v.trim()) ? none() : err('Use 4–40 letters, digits, / _ or -'),
    hsn: v => /^([0-9]{4}|[0-9]{6}|[0-9]{8})$/.test(v) ? none() : err('HSN code must be 4, 6 or 8 digits'),
    vehicle: v => /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{0,3}[ -]?[0-9]{4}$|^[0-9]{2}[ -]?BH[ -]?[0-9]{4}[ -]?[A-Z]{1,2}$/.test(v.toUpperCase()) ? none() : err('Vehicle number format: MH-12-AB-1234'),
    ewaybill: v => /^[0-9]{12}$/.test(v) ? none() : err('E-way bill number must be 12 digits'),
    invoicePrefix: v => /^[A-Za-z0-9/_-]{0,12}$/.test(v) ? none() : err('Prefix: up to 12 letters, digits, / - or _ (GST allows 16 characters in total)'),
    gstRate: v => { const n = Number(v); if (!Number.isFinite(n) || n < 0 || n > 100) return err('GST rate must be a percentage from 0 to 100'); return GST_SLABS.includes(n) ? none() : warn(`${n}% is not a standard GST rate (${GST_SLABS.join(', ')})`); },
    percent: v => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 100 ? none() : err('Enter a percentage from 0 to 100'); },
    days: v => /^[0-9]{1,4}$/.test(v) && Number(v) <= 3650 ? none() : err('Enter whole days (0–3650)'),
    quantity: v => { const n = Number(v); if (!Number.isFinite(n) || n < 0) return err('Quantity cannot be negative'); return Number.isInteger(n) ? none() : err('Quantity must be a whole number'); },
    money: (v, field) => {
      const clean = v.replace(/[,₹\s]/g, '');
      if (field.allowExpression && /[+*/]/.test(clean) && /^[0-9.+\-*/()]+$/.test(clean)) return warn('Press Enter to calculate this amount');
      if (!/^-?[0-9]*\.?[0-9]*$/.test(clean) || clean === '' || clean === '.' || clean === '-') return err('Enter an amount using digits only, e.g. 12500.50');
      const n = Number(clean);
      if (n < 0) return err('Amount cannot be negative');
      if (n > 1e10) return err('Amount is too large: check for extra zeros');
      if ((clean.split('.')[1] || '').length > 2) return warn('Amounts are rounded to 2 decimal places (paise)');
      return none();
    },
    number: v => { const n = Number(v); return Number.isFinite(n) ? (n < 0 ? err('Value cannot be negative') : none()) : err('Enter a number'); },
    date: (v, field) => {
      const d = new Date(v + 'T00:00:00');
      if (Number.isNaN(d.getTime())) return err('Enter a valid date');
      if (d.getFullYear() < 2000) return err('Date is before the year 2000: check the year');
      const days = (d - new Date(new Date().toDateString())) / 86400000;
      if (field.pastOnly && days > 0) return warn('This date is in the future');
      if (days > 400) return warn('Date is more than a year ahead: check the year');
      return none();
    },
    personName: v => /\p{L}/u.test(v) && !/[0-9<>{}]/.test(v) ? none() : err('Name should contain letters only'),
    name: v => /[\p{L}\p{N}]/u.test(v) && !/[<>{}]/.test(v) ? (v.length > 150 ? err('Keep the name under 150 characters') : none()) : err('Enter a name (letters or digits; < > { } not allowed)'),
    text: v => /[<>]/.test(v) && /<\s*\/?\s*(script|iframe|img|svg|a)\b/i.test(v) ? err('HTML tags are not allowed here') : (v.length > 2000 ? warn('Text is very long (over 2000 characters)') : none())
  };
  function err(msg) { return { level: 'error', msg }; }
  function warn(msg) { return { level: 'warn', msg }; }
  function ok(msg) { return { level: 'ok', msg }; }
  function none() { return { level: 'ok', msg: '' }; }

  /* ---------------------------------------------------------------- field typing */
  const SKIP_TYPES = new Set(['hidden', 'file', 'checkbox', 'radio', 'range', 'color', 'button', 'submit', 'reset', 'image', 'password']);
  const REQUIRED_IDS = new Set(['edit-contact-name', 'pay-input-amount', 'pay-input-party', 'pay-input-date', 'sku-edit-name']);
  // Upper-case these as the user types.
  const UPPERCASE = new Set(['gstin', 'pan', 'ifsc', 'cin', 'udyam', 'iec', 'vehicle', 'utr']);

  function words(text) {
    return String(text || '').replace(/\$\{[^}]*\}/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase();
  }
  function labelText(el) {
    if (el.labels && el.labels[0]) return el.labels[0].textContent;
    const wrap = el.closest('div, label, td');
    const label = wrap && wrap.querySelector('label, span.block, span.text-\\[10px\\], span.text-\\[11px\\]');
    return label && label !== el && label.textContent.length < 60 ? label.textContent : '';
  }
  // Properties an inline handler writes to, e.g. "app.studioDraftData.retailerGstin = this.value" -> "retailerGstin".
  // ...and the app function it calls with the value, e.g. "app.updateSkuRowCases(0, this.value)" -> "updateSkuRowCases".
  function handlerProps(el) {
    const code = (el.getAttribute('oninput') || '') + ' ' + (el.getAttribute('onchange') || '');
    const props = [...code.matchAll(/\.(\w+)\s*=\s*(?:Math\.\w+\([^)]*)?(?:parseFloat|parseInt|Number)?\(?\s*this\.value/g)].map(m => m[1]);
    const calls = [...code.matchAll(/app\.(\w+)\([^)]*this\.value/g)].map(m => m[1].replace(/^(update|set|handle|on)/, ''));
    return props.concat(calls).join(' ');
  }
  function fieldKey(el) {
    if (!el.__tfKey) el.__tfKey = words([el.id, el.name, el.dataset.field, handlerProps(el), labelText(el)].join(' '));
    return el.__tfKey;
  }
  function classify(el) {
    const tag = el.tagName;
    const type = (el.getAttribute('type') || (tag === 'TEXTAREA' ? 'textarea' : tag === 'SELECT' ? 'select' : 'text')).toLowerCase();
    if (SKIP_TYPES.has(type) || el.readOnly || el.disabled || el.dataset.noValidate !== undefined) return null;
    const k = fieldKey(el);
    const placeholder = words(el.getAttribute('placeholder'));
    if (/\b(search|filter)\b/.test(k + ' ' + placeholder) || /\burl input\b|\bapi key\b|\bnvidia\b|\bkey input\b/.test(k)) return null;
    const isNumber = type === 'number';
    const percentLabel = /%/.test(labelText(el));
    const f = { type: 'text', required: el.required || REQUIRED_IDS.has(el.id) };
    const is = re => re.test(k);
    if (tag === 'SELECT') f.type = 'select';
    else if (type === 'date') { f.type = 'date'; f.pastOnly = is(/\b(pay|payment|doc|receipt|paid|received|diary)\b/); }
    else if (is(/\bconfirm acc/)) f.type = 'confirmAccount';
    else if (is(/\bgstin\b|\bgst no\b|\bgst number\b/)) f.type = 'gstin';
    else if (is(/\bgst\b/) && (isNumber || is(/\brate\b/))) f.type = 'gstRate';
    else if (is(/\bpan\b/)) f.type = 'pan';
    else if (is(/\bifsc\b/)) f.type = 'ifsc';
    else if (is(/\bcin\b/)) f.type = 'cin';
    else if (is(/\bfssai\b/)) f.type = 'fssai';
    else if (is(/\budyam\b|\bmsme\b/)) f.type = 'udyam';
    else if (is(/\biec\b/)) f.type = 'iec';
    else if (is(/\bupi\b/)) f.type = 'upi';
    else if (type === 'email' || is(/\bemail\b/)) f.type = 'email';
    else if (type === 'url' || is(/\bwebsite\b|\blogo url\b/)) f.type = 'website';
    else if (is(/\bstate code\b/)) f.type = 'stateCode';
    else if (is(/\bpin ?code\b|\bpin\b|\bzip\b/)) f.type = 'pincode';
    else if (tag === 'INPUT' && (type === 'tel' || (is(/\bphone\b|\bmobile\b|\bwhatsapp\b/) && !is(/\bmessage\b|\border input\b|\btext\b/)))) { f.type = 'phone'; f.landline = is(/\balt\b|\blandline\b/); }
    else if (is(/\bacc no\b|\baccount number\b|\baccount no\b|\bbeneficiary acc\b|\bpayer acc\b|\bacc number\b/)) f.type = 'account';
    else if (is(/\butr\b/)) f.type = 'utr';
    else if (is(/\btxn ?id\b|\btxnid\b|\btransaction id\b/)) f.type = 'txn';
    else if (is(/\bhsn\b/)) f.type = 'hsn';
    else if (is(/\bvehicle\b/)) f.type = 'vehicle';
    else if (is(/\beway\b|\be way\b/)) f.type = 'ewaybill';
    else if (is(/\binv prefix\b|\binvoice prefix\b/)) f.type = 'invoicePrefix';
    else if (is(/\bdays\b|\bvalidity\b|\bcredit period\b/)) f.type = 'days';
    else if (percentLabel || ((isNumber || is(/\bpct\b/)) && is(/\bpct\b|\bpercent\b|\bdiscount\b|\bcommission\b|\bmkt\b|\bprofit\b|\btrans\b|\bmargin\b/))) f.type = 'percent';
    else if (is(/\bqty\b|\bquantity\b|\bcases\b|\bcase ?pack\b|\bcasepack\b|\bjars\b|\bunits\b|\binv start\b|\bstarting number\b|\bmaster pack\b|\brow pack\b|\bpcs\b/)) f.type = 'quantity';
    else if (isNumber || is(/\bamount\b|\bprice\b|\bmrp\b|\badvance\b|\bcredit limit\b|\bcgst\b|\bsgst\b|\bigst\b|\btaxable\b|\bcost\b/)) { f.type = isNumber && !is(/\bamount\b|\bprice\b|\brate\b|\bcost\b|\bmrp\b|\badvance\b|\blimit\b|\bcgst\b|\bsgst\b|\bigst\b|\btaxable\b|\btotal\b|\bmfg\b|\blabel\b|\bdamage\b/) ? 'number' : 'money'; f.allowExpression = el.id === 'pay-input-amount'; }
    else if (is(/\bjurisdiction\b/)) f.type = 'city';
    else if (is(/\bperson\b|\bholder\b|\bbeneficiary name\b|\bdriver name\b|\bsecondary contact\b/)) f.type = 'personName';
    else if (is(/\bname\b|\blegal\b|\bbrand\b|\bparty\b|\bcounterparty\b/) && tag !== 'TEXTAREA') f.type = 'name';
    else if (is(/\bcity\b/)) f.type = 'city';
    else if (is(/\bstate\b/)) f.type = 'state';
    else if (is(/\baddress\b|\blandmark\b/)) f.type = 'address';
    return f;
  }

  /* ---------------------------------------------------------------- live messages */
  let uid = 0;
  function messageNode(el) {
    if (el.__tfMsg && el.__tfMsg.isConnected) return el.__tfMsg;
    const msg = document.createElement('div');
    msg.className = 'tf-field-msg';
    msg.id = 'tf-msg-' + (++uid);
    msg.setAttribute('aria-live', 'polite');
    // Put the message under the whole row when the input sits beside buttons.
    const parent = el.parentElement;
    const style = parent && getComputedStyle(parent);
    const inRow = style && style.display.includes('flex') && !style.flexDirection.startsWith('column') && parent.children.length > 1;
    (inRow ? parent : el).insertAdjacentElement('afterend', msg);
    el.__tfMsg = msg;
    el.setAttribute('aria-describedby', [el.getAttribute('aria-describedby'), msg.id].filter(Boolean).join(' '));
    return msg;
  }
  function show(el, result) {
    el.classList.remove('tf-invalid', 'tf-warn', 'tf-valid');
    const hasMsg = result && result.msg;
    if (!hasMsg && !el.__tfMsg) { el.removeAttribute('aria-invalid'); return; }
    const msg = messageNode(el);
    msg.textContent = hasMsg ? result.msg : '';
    msg.className = 'tf-field-msg' + (hasMsg ? ' tf-msg-' + result.level : '');
    if (hasMsg) el.classList.add(result.level === 'error' ? 'tf-invalid' : result.level === 'warn' ? 'tf-warn' : 'tf-valid');
    if (result && result.level === 'error') el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  function scopeOf(el) {
    return el.closest('form, [id^="settings-panel-"], [data-form], [id$="-modal"], [role="dialog"], [id^="tab-"], section') || document.body;
  }
  function validate(el, { quiet = false } = {}) {
    const field = classify(el);
    if (!field) return null;
    const value = String(el.value ?? '').trim();
    let result;
    if (!value) result = field.required ? err('This field is required') : none();
    else if (field.type === 'confirmAccount') {
      const account = [...scopeOf(el).querySelectorAll('input')].find(other => other !== el && classify(other)?.type === 'account');
      result = /^[0-9]{9,18}$/.test(value) ? (account && account.value.trim() && account.value.trim() !== value ? err('Account numbers do not match') : ok('Account numbers match')) : err('Bank account number must be 9–18 digits');
    } else if (checks[field.type]) result = checks[field.type](value, field);
    else result = field.type === 'select' ? none() : checks.text(value);
    // Cross-checks: GSTIN against PAN and state code typed in the same form.
    if (field.type === 'gstin' && result.level === 'ok' && value.length === 15) {
      const scope = scopeOf(el);
      const others = [...scope.querySelectorAll('input')].filter(other => other !== el);
      const pan = others.find(other => classify(other)?.type === 'pan' && other.value.trim());
      const code = others.find(other => classify(other)?.type === 'stateCode' && other.value.trim());
      if (pan && pan.value.trim().toUpperCase() !== value.toUpperCase().slice(2, 12)) result = warn('PAN inside this GSTIN differs from the PAN entered in this form');
      else if (code && code.value.trim().padStart(2, '0') !== value.slice(0, 2)) result = warn(`GSTIN state (${value.slice(0, 2)}) differs from the state code entered (${code.value.trim()})`);
    }
    // The field's own HTML limits (step, min, max, pattern, required) are reported the same way.
    try { el.setCustomValidity(''); } catch (_) {}
    if (result.level !== 'error' && el.willValidate && !el.checkValidity()) result = err(nativeMessage(el));
    if (!quiet) show(el, result);
    try { el.setCustomValidity(result.level === 'error' ? result.msg : ''); } catch (_) {}
    return result;
  }
  function nativeMessage(el) {
    const v = el.validity;
    if (v.valueMissing) return 'This field is required';
    if (v.rangeUnderflow) return `Minimum allowed is ${el.min}`;
    if (v.rangeOverflow) return `Maximum allowed is ${el.max}`;
    if (v.stepMismatch) {
      const step = Number(el.step) || 1, base = Number(el.min) || 0, n = Number(el.value);
      const lower = base + Math.floor((n - base) / step) * step;
      const fmt = x => String(Math.round(x * 1e6) / 1e6);
      return `Use steps of ${el.step}: try ${fmt(lower)} or ${fmt(lower + step)}`;
    }
    if (v.patternMismatch) return el.title || 'This format is not accepted';
    if (v.tooLong) return `Use at most ${el.maxLength} characters`;
    if (v.tooShort) return `Use at least ${el.minLength} characters`;
    if (v.badInput) return 'Enter a number';
    return el.validationMessage || 'Check this value';
  }
  // Fits a generated number to the field's min, max and step.
  function fitNumber(el, value) {
    let n = Number(value);
    if (!Number.isFinite(n)) return value;
    if (el.min !== '' && Number.isFinite(Number(el.min))) n = Math.max(n, Number(el.min));
    if (el.max !== '' && Number.isFinite(Number(el.max))) n = Math.min(n, Number(el.max));
    const step = el.step && el.step !== 'any' ? Number(el.step) : (el.type === 'number' ? 1 : 0);
    if (step > 0) {
      const base = el.min !== '' && Number.isFinite(Number(el.min)) ? Number(el.min) : 0;
      n = base + Math.round((n - base) / step) * step;
      const decimals = (String(step).split('.')[1] || '').length;
      return n.toFixed(decimals);
    }
    return String(n);
  }
  function eligibleFields(root) {
    return [...root.querySelectorAll('input, textarea, select')].filter(el => el.offsetParent !== null && classify(el));
  }
  function validateScope(root) {
    const failures = [];
    for (const el of eligibleFields(root)) {
      const result = validate(el);
      if (result && result.level === 'error') failures.push({ el, result });
    }
    return failures;
  }

  /* ---------------------------------------------------------------- events */
  function upperCaseInPlace(el, field) {
    if (!UPPERCASE.has(field.type) || el.value === el.value.toUpperCase()) return;
    const start = el.selectionStart, end = el.selectionEnd;
    el.value = el.value.toUpperCase();
    try { el.setSelectionRange(start, end); } catch (_) {}
  }
  document.addEventListener('input', event => {
    const el = event.target;
    if (!(el instanceof HTMLElement) || !el.matches('input, textarea')) return;
    const field = classify(el);
    if (!field) return;
    upperCaseInPlace(el, field);
    validate(el);
  }, true);
  document.addEventListener('change', event => { if (event.target.matches && event.target.matches('input, textarea, select')) validate(event.target); }, true);
  document.addEventListener('focusout', event => {
    const el = event.target;
    if (!el.matches || !el.matches('input, textarea')) return;
    const field = classify(el);
    if (!field) return;
    if (el.value !== el.value.trim() && field.type !== 'text' && field.type !== 'address') el.value = el.value.trim();
    validate(el);
  }, true);

  // Commit buttons (Save, Create, Record ...) do nothing while their form has errors.
  const COMMIT = /\b(save|submit|create|record|confirm|update|apply changes|register|add (partner|product|contact|sku|payment)|book|finali[sz]e|issue|generate order)\b/i;
  const NOT_COMMIT = /\b(cancel|close|discard|delete|remove|purge|search|demo|preview|back|clear|reset|copy|open|view|test|switch|toggle|sort|filter|download|print|share|whatsapp|scan|upload|retry|undo|zoom)\b/i;
  document.addEventListener('click', event => {
    const button = event.target.closest && event.target.closest('button, [role="button"], input[type="submit"]');
    if (!button || button.disabled) return;
    const label = (button.textContent || button.value || '') + ' ' + (button.getAttribute('title') || '') + ' ' + (button.getAttribute('onclick') || '');
    if (!COMMIT.test(label) || NOT_COMMIT.test(button.textContent || '')) return;
    const scope = button.closest('form, [id^="settings-panel-"], [data-form], [id$="-modal"], [role="dialog"], [id^="tab-"]');
    if (!scope) return;
    const failures = validateScope(scope);
    if (!failures.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    failures[0].el.focus({ preventScroll: false });
    failures[0].el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    toast(`Fix ${failures.length} field${failures.length > 1 ? 's' : ''} before saving: ${failures[0].result.msg}`);
  }, true);
  document.addEventListener('submit', event => {
    const failures = validateScope(event.target);
    if (failures.length) { event.preventDefault(); event.stopImmediatePropagation(); failures[0].el.focus(); toast(failures[0].result.msg); }
  }, true);
  function toast(message) {
    if (window.app && typeof window.app.showToast === 'function') window.app.showToast(message);
    else console.warn(message);
  }

  /* ---------------------------------------------------------------- demo data */
  const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const digits = n => Array.from({ length: n }, (_, i) => (i === 0 ? rnd(1, 9) : rnd(0, 9))).join('');
  const letters = n => Array.from({ length: n }, () => String.fromCharCode(65 + rnd(0, 25))).join('');
  const PLACES = [['Pune', '27', '411'], ['Nashik', '27', '422'], ['Ahmedabad', '24', '380'], ['Rajkot', '24', '360'], ['Jaipur', '08', '302'], ['Indore', '23', '452'],
    ['Sonipat', '06', '131'], ['Karnal', '06', '132'], ['Delhi', '07', '110'], ['Lucknow', '09', '226'], ['Bengaluru', '29', '560'], ['Chennai', '33', '600'], ['Hyderabad', '36', '500'], ['Kolkata', '19', '700']];
  const BANKS = [['HDFC Bank', 'HDFC', 'okhdfcbank'], ['ICICI Bank', 'ICIC', 'okicici'], ['State Bank of India', 'SBIN', 'oksbi'], ['Axis Bank', 'UTIB', 'okaxis'], ['Kotak Mahindra Bank', 'KKBK', 'kotak']];
  const FIRST = ['Aarav', 'Priya', 'Rohan', 'Neha', 'Vikram', 'Anjali', 'Karan', 'Meera', 'Suresh', 'Kavita', 'Arjun', 'Pooja'];
  const LAST = ['Sharma', 'Patel', 'Verma', 'Gupta', 'Reddy', 'Iyer', 'Mehta', 'Singh', 'Joshi', 'Nair', 'Kulkarni', 'Agarwal'];
  const BIZ_A = ['Sunrise', 'Green Valley', 'Shree Ganesh', 'Royal', 'Golden Leaf', 'Navrang', 'Silver Oak', 'Krishna', 'Evergreen', 'Prime'];
  const BIZ_B = ['Foods', 'Traders', 'Agro Industries', 'Enterprises', 'Distributors', 'Packaging', 'Logistics', 'Supermart'];

  function makeIdentity() {
    const [city, code, pin] = pick(PLACES);
    const [stateName, abbr] = STATES[code];
    const company = `${pick(BIZ_A)} ${pick(BIZ_B)}`;
    const person = `${pick(FIRST)} ${pick(LAST)}`;
    const pan = letters(3) + pick(['C', 'F', 'P']) + company[0].toUpperCase() + digits(4) + letters(1);
    const first14 = code + pan + rnd(1, 9) + 'Z';
    const bank = pick(BANKS);
    const slug = company.toLowerCase().replace(/[^a-z]+/g, '');
    const taxable = rnd(50, 2500) * 100;
    const gst = Math.round(taxable * 0.09 * 100) / 100;
    return {
      company, person, city, code, stateName, abbr, slug, bank, pan,
      gstin: first14 + gstinCheckChar(first14),
      pincode: pin + digits(3).replace(/^./, String(rnd(0, 9))),
      phone: `+91 ${rnd(6, 9)}${digits(4).slice(0, 4)} ${digits(5)}`,
      account: digits(rnd(11, 14)),
      ifsc: bank[1] + '0' + digits(6),
      taxable, gst, total: Math.round((taxable + 2 * gst) * 100) / 100,
      year: new Date().getFullYear()
    };
  }
  function demoValue(el, f, id) {
    const k = fieldKey(el);
    const today = new Date().toISOString().slice(0, 10);
    const contacts = (window.app && window.app.data && window.app.data.contacts) || [];
    switch (f.type) {
      case 'gstin': return id.gstin;
      case 'pan': case 'iec': return id.pan;
      case 'ifsc': return id.ifsc;
      case 'cin': return `U15400${id.abbr}${id.year - rnd(1, 15)}PTC${digits(6)}`;
      case 'fssai': return '1' + digits(13);
      case 'udyam': return `UDYAM-${id.abbr}-${String(rnd(1, 40)).padStart(2, '0')}-${digits(7)}`;
      case 'upi': return `${id.slug.slice(0, 12)}@${id.bank[2]}`;
      case 'email': return `accounts@${id.slug}.example.com`;
      case 'website': return /logo|image|photo/.test(k) ? null : `https://${id.slug}.example.com`; // images would fail to load
      case 'stateCode': return id.code;
      case 'state': return id.stateName;
      case 'city': return id.city;
      case 'pincode': return id.pincode;
      case 'address': return /landmark/.test(k) ? `Near ${pick(['Bus Stand', 'Railway Station', 'Main Market', 'Highway Gate'])}` : `Plot ${rnd(1, 250)}, ${pick(['Industrial Area Phase 2', 'Market Yard', 'MIDC', 'Sector ' + rnd(1, 60)])}, ${id.city} - ${id.pincode}`;
      case 'phone': return f.landline ? `0${rnd(11, 99)}-${digits(8)}` : id.phone;
      case 'account': case 'confirmAccount': return id.account;
      case 'utr': return 'DEMO' + digits(12);
      case 'txn': return 'TXN' + digits(9);
      case 'hsn': return String((window.app && window.app.config && window.app.config().defaultHsn) || '2001' + digits(4));
      case 'vehicle': return `${id.abbr}-${String(rnd(1, 50)).padStart(2, '0')}-${letters(2)}-${digits(4)}`;
      case 'ewaybill': return digits(12);
      case 'invoicePrefix': return `INV/${String(id.year).slice(-2)}-${String(id.year + 1).slice(-2)}/`;
      case 'gstRate': return String(pick([5, 12, 18]));
      case 'percent': return String(/discount/.test(k) ? rnd(2, 8) : /commission|mkt/.test(k) ? rnd(2, 10) : /trans/.test(k) ? rnd(2, 6) : rnd(8, 25));
      case 'days': return String(pick([15, 30, 45]));
      case 'quantity': return String(/case ?pack|casepack/.test(k) ? pick([6, 12, 24, 48]) : /\bcases\b/.test(k) ? rnd(5, 60) : /start|starting/.test(k) ? 1001 : rnd(10, 500));
      case 'money':
        if (/\bcgst\b|\bsgst\b/.test(k)) return id.gst.toFixed(2);
        if (/\bigst\b/.test(k)) return '0.00';
        if (/taxable/.test(k)) return id.taxable.toFixed(2);
        if (/\btotal\b/.test(k)) return id.total.toFixed(2);
        if (/mrp/.test(k)) return String(rnd(5, 50) * 10);
        if (/limit/.test(k)) return String(rnd(1, 10) * 100000);
        if (/advance/.test(k)) return String(rnd(1, 10) * 1000); // kept small so it never exceeds an order total
        if (/\brate\b|price|cost|mfg|label|pkg/.test(k)) return (rnd(500, 25000) / 100).toFixed(2);
        return String(rnd(10, 2500) * 100);
      case 'number': return String(rnd(1, 100));
      case 'date': return today;
      case 'personName': return /beneficiary|holder/.test(k) ? id.company : id.person;
      case 'name':
        if (/party|counterparty|retailer|buyer/.test(k) && contacts.length) return pick(contacts).name;
        if (/brand/.test(k)) return id.company.split(' ')[0] + ' ' + pick(['Naturals', 'Fresh', 'Gold', 'Select']);
        if (/legal/.test(k)) return `${id.company} Private Limited`;
        if (/sku|product/.test(k)) return `${pick(['Mango', 'Lime', 'Mixed', 'Garlic', 'Green Chilli'])} Pickle ${pick(['500g', '1kg', '200g'])}`;
        if (/bank/.test(k)) return id.bank[0];
        return /\b(person|contact)\b/.test(k) && !/\bcompany\b/.test(k) ? id.person : id.company;
      case 'select': return null;
      default:
        if (/bank name|\bbank\b/.test(k)) return id.bank[0];
        if (/branch/.test(k)) return `${id.city} Main Branch`;
        if (/designation/.test(k)) return pick(['Proprietor', 'Accounts Manager', 'Purchase Head', 'Plant Manager']);
        if (/terms/.test(k)) return pick(['Net 15 Days', 'Net 30 Days', '50% Advance, balance on delivery']);
        if (/nature|business/.test(k)) return pick(['Food processing and bottling', 'Wholesale grocery distribution', 'Transport and logistics', 'PET jar and label printing']);
        if (/capacity/.test(k)) return `${rnd(2, 20) * 1000} jars/month`;
        if (/specialt/.test(k)) return 'Mango pickle, lime pickle, mixed pickle';
        if (/licen/.test(k)) return `FL/${id.year}/${digits(4)}`;
        if (/\blr\b|bilty/.test(k)) return 'LR-' + digits(6);
        if (/batch/.test(k)) return `B-${digits(4)}`;
        if (/doc number|invoice no|bill no/.test(k)) return 'DEMO-' + digits(4);
        if (/driver/.test(k)) return id.person;
        if (/tagline/.test(k)) return 'Quality foods, delivered on time';
        if (/place of supply/.test(k)) return `${id.stateName} (${id.code})`;
        if (/freight/.test(k)) return 'Freight paid by buyer';
        if (/jurisdiction/.test(k)) return id.city;
        if (/note|remark|reason|bio|purpose|description|comment/.test(k)) return 'Demo entry created for testing.';
        return el.tagName === 'TEXTAREA' ? 'Demo entry created for testing.' : 'Demo ' + letters(3);
    }
  }
  // Order ids, invoice numbers and document numbers belong to real records: never invent them.
  const NEVER_FILL = /\border id\b|\binvoice number\b|\binvoice no\b|\boriginal invoice\b/;
  function topContainer() {
    const open = [...document.querySelectorAll('[id$="-modal"]:not(.hidden), [role="dialog"]:not(.hidden)')]
      .filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
      .filter(el => eligibleFields(el).length);
    if (open.length) return open.sort((a, b) => (Number(getComputedStyle(b).zIndex) || 0) - (Number(getComputedStyle(a).zIndex) || 0) || (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 1 : -1))[0];
    return document.querySelector('main') || document.body;
  }
  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function fillDemo(root = topContainer()) {
    const id = makeIdentity();
    let filled = 0;
    // Choose list options first (they may redraw the form), then type into the fields.
    for (const select of [...root.querySelectorAll('select')].filter(s => s.offsetParent !== null && !s.disabled)) {
      // Leave selectors that change the view rather than the record (theme, sorting, tabs, document type ...).
      if (/switch|theme|sort|filter|lang|doctype|template|role.?mode|calc.?mode|view|tab\b/i.test((select.getAttribute('onchange') || '') + ' ' + select.id)) continue;
      const options = [...select.options].filter(o => o.value && !o.disabled);
      if (!options.length || (select.value && options.some(o => o.value === select.value))) continue;
      setValue(select, pick(options).value); filled++;
    }
    await new Promise(resolve => setTimeout(resolve, 60));
    for (const el of eligibleFields(root)) {
      const f = classify(el);
      if (!f || f.type === 'select' || NEVER_FILL.test(fieldKey(el))) continue;
      let value = demoValue(el, f, id);
      if (value === null || value === undefined) continue;
      if (el.type === 'number') value = fitNumber(el, value);
      setValue(el, value); filled++;
    }
    await new Promise(resolve => setTimeout(resolve, 30));
    const failures = validateScope(root);
    toast(failures.length ? `Filled ${filled} fields with demo data · ${failures.length} still need attention` : `Filled ${filled} fields with valid demo data`);
    return { filled, failures: failures.length };
  }

  /* ---------------------------------------------------------------- demo button */
  function demoToolsEnabled() {
    const profile = window.app && window.app.data && window.app.data.businessProfile;
    return !(profile && profile.showDemoTools === false);
  }
  function mountDemoButton() {
    if (document.getElementById('tf-demo-fill-btn')) return refreshDemoButton();
    const button = document.createElement('button');
    button.id = 'tf-demo-fill-btn';
    button.type = 'button';
    button.className = 'tf-demo-fill-btn no-print';
    button.title = 'Fill the open form with valid demo data (Alt+Shift+D). Turn off in Settings > Appearance > Business Defaults.';
    button.textContent = '🧪 Fill demo data';
    button.addEventListener('click', () => fillDemo());
    document.body.appendChild(button);
    refreshDemoButton();
  }
  function refreshDemoButton() {
    const button = document.getElementById('tf-demo-fill-btn');
    if (button) button.hidden = !demoToolsEnabled();
  }
  document.addEventListener('keydown', event => {
    if (event.altKey && event.shiftKey && (event.key === 'D' || event.key === 'd') && demoToolsEnabled()) { event.preventDefault(); fillDemo(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountDemoButton); else mountDemoButton();

  window.TFFormGuard = { validate, validateScope, classify, fillDemo, refreshDemoButton, checks, gstinCheckChar, makeIdentity };
})();
