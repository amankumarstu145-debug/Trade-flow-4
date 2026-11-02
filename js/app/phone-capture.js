// TradeFlow: Phone capture (photos sent from a phone). Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ================= SUGGESTION 3: MOBILE CAMERA QR-SNAP ================= */
  /* ================= SUGGESTION 3: MOBILE CAMERA QR-SNAP & DIRECT INTAKE ================= */
  switchMobileSnapTab(tab) {
    const permBtn = document.getElementById('snap-tab-btn-permanent');
    const guestBtn = document.getElementById('snap-tab-btn-guest');
    const permContent = document.getElementById('snap-tab-content-permanent');
    const guestContent = document.getElementById('snap-tab-content-guest');
    if (!permBtn || !guestBtn || !permContent || !guestContent) return;

    if (tab === 'permanent') {
      permBtn.className = 'btn-tactile flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700';
      guestBtn.className = 'btn-tactile py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5';
      permContent.classList.remove('hidden');
      guestContent.classList.add('hidden');
    } else {
      guestBtn.className = 'btn-tactile flex-1 py-1.5 px-3 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700';
      permBtn.className = 'btn-tactile py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center gap-1.5';
      guestContent.classList.remove('hidden');
      permContent.classList.add('hidden');
    }
  }

  async openMobileSnapModal(targetContext = 'payment') {
    this.mobileSnapTarget = targetContext;
    const modal = document.getElementById('mobile-snap-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const badge = document.getElementById('mobile-snap-session-id');
    const waitingLabel = document.getElementById('mobile-snap-waiting-label');
    const qrImg = document.getElementById('mobile-snap-qr-img');
    const qrImgPermanent = document.getElementById('mobile-snap-qr-img-permanent');
    const urlInput = document.getElementById('mobile-snap-url-input');
    const permanentUrlInput = document.getElementById('mobile-snap-permanent-url-input');

    if (badge) badge.innerText = 'GENERATING...';
    if (waitingLabel) waitingLabel.innerText = 'Creating secure QR pairing...';

    try {
      const resp = await fetch('/api/mobile-snap/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetContext })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        this.currentMobileSnapSessionId = data.sessionId;
        this.currentMobileSnapUrl = data.mobileUrl;
        this.currentMobileSnapPermanentUrl = data.permanentUrl || `http://${data.localIp}:${data.port || 3000}/mobile-snap?mode=direct`;

        if (badge) badge.innerText = 'PAIRED-' + data.sessionId.slice(-6).toUpperCase();
        if (urlInput) urlInput.value = data.mobileUrl;
        if (permanentUrlInput) permanentUrlInput.value = this.currentMobileSnapPermanentUrl;
        if (waitingLabel) waitingLabel.innerText = 'Waiting for photo from phone...';

        if (qrImgPermanent) {
          qrImgPermanent.src = tfSafeUrl(this.createQrDataUrl(this.currentMobileSnapPermanentUrl));
        }

        if (qrImg) {
          qrImg.src = tfSafeUrl(this.createQrDataUrl(data.mobileUrl));
        }

        this.startMobileSnapPolling(data.sessionId);
      }
    } catch (err) {
      console.warn('Error starting mobile snap session:', err);
      if (waitingLabel) waitingLabel.innerText = 'Error connecting to mobile service: ' + err.message;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  closeMobileSnapModal() {
    if (this.mobileSnapPollInterval) {
      clearInterval(this.mobileSnapPollInterval);
      this.mobileSnapPollInterval = null;
    }
    const modal = document.getElementById('mobile-snap-modal');
    if (modal) modal.classList.add('hidden');
  }

  copyMobileSnapLink() {
    if (!this.currentMobileSnapUrl) return;
    navigator.clipboard.writeText(this.currentMobileSnapUrl).then(() => {
      this.showToast('Temporary mobile link copied to clipboard!');
    }).catch(() => {
      this.showToast('Link: ' + this.currentMobileSnapUrl);
    });
  }

  async revokeMobileSnapDevices() {
    const confirmed = await this.showModalConfirm({
      title: 'Unpair Saved Phones',
      subtitle: 'Phone access',
      message: 'Every phone that saved the permanent link will stop working. A new permanent QR code is created; scan it again on phones you still use.',
      confirmText: 'Unpair phones',
      confirmClass: 'bg-rose-600 hover:bg-rose-500',
      icon: 'smartphone'
    });
    if (!confirmed) return;
    try {
      const resp = await fetch('/api/mobile-snap/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!resp.ok) throw new Error('Server refused the request');
      this.showToast('Saved phones unpaired. Scan the new QR code to pair again.');
      await this.openMobileSnapModal(this.mobileSnapTarget || 'payment');
    } catch (err) {
      this.showToast('Could not unpair phones: ' + err.message);
    }
  }

  copyMobileSnapPermanentLink() {
    if (!this.currentMobileSnapPermanentUrl) return;
    navigator.clipboard.writeText(this.currentMobileSnapPermanentUrl).then(() => {
      this.showToast('Permanent phone shortcut link copied!');
    }).catch(() => {
      this.showToast('Link: ' + this.currentMobileSnapPermanentUrl);
    });
  }

  openMobileSnapInNewTab() {
    if (this.currentMobileSnapUrl) {
      window.open(this.currentMobileSnapUrl, '_blank');
    }
  }

  openMobileSnapPermanentInNewTab() {
    if (this.currentMobileSnapPermanentUrl) {
      window.open(this.currentMobileSnapPermanentUrl, '_blank');
    }
  }

  startMobileSnapPolling(sessionId) {
    if (this.mobileSnapPollInterval) clearInterval(this.mobileSnapPollInterval);
    this.mobileSnapPollInterval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/mobile-snap/status?session=${sessionId}`);
        if (resp.ok) {
          const res = await resp.json();
          if (res && res.session && res.session.status === 'uploaded') {
            clearInterval(this.mobileSnapPollInterval);
            this.mobileSnapPollInterval = null;
            this.onMobileSnapReceived({
              snapId: res.session.file?.snapId || `SNAP-${Date.now()}`,
              sessionId,
              targetContext: res.session.targetContext || this.mobileSnapTarget,
              fileUrl: res.session.file.fileUrl,
              fileName: res.session.file.fileName,
              fileType: res.session.file.fileType,
              base64: res.session.file.base64,
              tag: res.session.file.tag,
              note: res.session.file.note
            });
          }
        }
      } catch (e) {}
    }, 2000);
  }

  onMobileSnapReceived(snapData) {
    this.closeMobileSnapModal();

    // Prepare snap item data with stable ID
    const snapId = snapData.snapId || `SNAP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const tagDisplay = snapData.tag === 'bank_slip' ? 'Bank Deposit Slip' : (snapData.tag === 'bilty' ? 'Transport Bilty' : (snapData.tag === 'invoice' ? 'Vendor Invoice' : 'Document'));
    
    const snapRecord = {
      id: snapId,
      fileName: snapData.fileName || `snap_${Date.now()}.jpg`,
      fileUrl: snapData.fileUrl || '',
      fileType: snapData.fileType || 'image/jpeg',
      base64: snapData.base64 || '',
      tag: snapData.tag || 'bank_slip',
      tagDisplay,
      note: snapData.note || '',
      timestamp: snapData.timestamp || new Date().toISOString(),
      timeFormatted: this.formatTime(new Date()),
      targetContext: snapData.targetContext || this.mobileSnapTarget || 'auto',
      status: 'pending'
    };

    // Ensure pendingMobileSnaps collection exists and store permanently
    if (!this.data.pendingMobileSnaps) this.data.pendingMobileSnaps = [];
    if (!this.data.pendingMobileSnaps.some(s => s.id === snapId || (s.fileName === snapRecord.fileName && Math.abs(new Date(s.timestamp) - new Date(snapRecord.timestamp)) < 2000))) {
      this.data.pendingMobileSnaps.unshift(snapRecord);
      this.saveData();
    }

    // Play subtle audio chime
    this.playNotificationSound();

    // Display non-intrusive smooth right slide-in card (does not interrupt active work)
    this.showMobileSnapSlideInCard(snapRecord);
  }

  showMobileSnapSlideInCard(snapRecord) {
    const container = document.getElementById('mobile-snap-slidein-container');
    if (!container) return;

    // Remove any previous active card cleanly
    const existing = container.querySelector('.tf-slidein-card');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = `slidein-${snapRecord.id}`;
    card.className = 'tf-slidein-card w-full rounded-2xl bg-white dark:bg-[#111624] text-slate-900 dark:text-white shadow-2xl border-2 border-emerald-500/40 p-4 overflow-hidden flex flex-col gap-3 relative';

    const imgSrc = snapRecord.base64 || snapRecord.fileUrl || '';

    card.innerHTML = `
      <!-- Top Title Bar -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
          <span class="text-xs font-black tracking-tight text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1">
            <i data-lucide="smartphone" class="w-3.5 h-3.5"></i>
            <span>New Mobile Document Received</span>
          </span>
        </div>
        <button type="button" onclick="app.deferPendingMobileSnap('${tfEscapeHtml(tfEscapeJs(snapRecord.id))}', true)" class="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white" title="Move to Urgent section">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <!-- Thumbnail & Details Body -->
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 overflow-hidden flex items-center justify-center shadow-inner">
          ${imgSrc ? `<img src="${tfEscapeHtml(tfSafeUrl(imgSrc))}" alt="Thumbnail" class="w-full h-full object-cover">` : `<i data-lucide="file-text" class="w-6 h-6 text-slate-400"></i>`}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              ${tfEscapeHtml(snapRecord.tagDisplay)}
            </span>
            <span class="text-xs font-mono-num text-slate-400">${tfEscapeHtml(snapRecord.timeFormatted)}</span>
          </div>
          <div class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title="${tfEscapeHtml(snapRecord.fileName)}">
            ${tfEscapeHtml(snapRecord.fileName)}
          </div>
          ${snapRecord.note ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">"${tfEscapeHtml(snapRecord.note)}"</p>` : `<p class="text-xs text-slate-400 mt-0.5">Saved to server disk</p>`}
        </div>
      </div>

      <!-- Action Buttons: Start Work Now vs Later -->
      <div class="flex items-center gap-2 pt-1">
        <button type="button" onclick="app.deferPendingMobileSnap('${tfEscapeHtml(tfEscapeJs(snapRecord.id))}', true)" class="btn-tactile flex-1 py-2 px-3 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-lg text-center" title="Defer to Urgent section">
          Later
        </button>
        <button type="button" onclick="app.processPendingMobileSnap('${tfEscapeHtml(tfEscapeJs(snapRecord.id))}', true)" class="btn-tactile flex-1 py-2 px-3 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-500 hover:to-emerald-500 rounded-lg shadow-sm flex items-center justify-center gap-1.5" title="Start Smart Fill immediately">
          <i data-lucide="zap" class="w-3.5 h-3.5"></i>
          <span>Start Work Now →</span>
        </button>
      </div>

      <!-- 5-Second Auto-Moving Progress Bar -->
      <div class="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-1 overflow-hidden mt-0.5">
        <div id="slidein-progress-${tfEscapeHtml(snapRecord.id)}" class="bg-emerald-500 h-full w-full tf-countdown-bar"></div>
      </div>
      <div class="text-xs text-slate-400 text-right -mt-2">Moving to Urgent in 5s if unclicked</div>
    `;

    container.appendChild(card);
    if (window.lucide) lucide.createIcons();

    // Trigger smooth enter transition
    requestAnimationFrame(() => {
      card.classList.add('active');
    });

    // 5-second countdown timer for auto-deferral
    card._autoDeferTimer = setTimeout(() => {
      this.deferPendingMobileSnap(snapRecord.id, false);
    }, 5000);
  }

  deferPendingMobileSnap(snapId, userClicked = false) {
    const card = document.getElementById(`slidein-${snapId}`);
    if (card) {
      if (card._autoDeferTimer) clearTimeout(card._autoDeferTimer);
      card.classList.remove('active');
      card.classList.add('leaving');
      setTimeout(() => card.remove(), 400);
    }

    // Refresh urgent actions list and dashboard banner
    this.renderKPIs();
    this.renderUrgentActionsList();
    this.updateSidebarUI();

    if (userClicked) {
      this.showToast('Document moved to Urgent Section.');
    }
  }

  processPendingMobileSnap(snapId, fromCard = false) {
    if (fromCard) {
      const card = document.getElementById(`slidein-${snapId}`);
      if (card) {
        if (card._autoDeferTimer) clearTimeout(card._autoDeferTimer);
        card.remove();
      }
    }

    const snaps = this.data.pendingMobileSnaps || [];
    const idx = snaps.findIndex(s => s.id === snapId);
    let snap = null;
    if (idx !== -1) {
      snap = snaps[idx];
      this.lastProcessedMobileSnap = snap;
      this.currentPendingMobileSnapId = snap.id;
      // Remove from pending queue since we are processing it now
      snaps.splice(idx, 1);
      this.saveData();
      this.renderKPIs();
      this.renderUrgentActionsList();
      this.updateSidebarUI();
    }

    if (!snap) return;

    this.closeUrgentActionsModal();

    // Launch Smart Fill with document loaded
    if (window.TradeFlowSmartFill) {
      let sfContext = 'auto';
      if (snap.tag === 'bank_slip' || snap.targetContext === 'payment') sfContext = 'payment';
      else if (snap.tag === 'bilty' || snap.tag === 'invoice' || snap.targetContext === 'partner') sfContext = 'partner';
      TradeFlowSmartFill.open(sfContext);
      TradeFlowSmartFill.loadFromMobileSnap(snap);
      this.showToast(`Smart Fill launched for ${snap.fileName}`);
    } else {
      this.openPaymentModal();
      this.attachPaymentProofData(snap.base64 || snap.fileUrl, snap.fileName, snap.fileType);
      if (snap.note) {
        const notesInput = document.getElementById('pay-input-notes');
        if (notesInput && !notesInput.value) notesInput.value = snap.note;
      }
    }
  }

  discardPendingMobileSnap(snapId) {
    if (!this.data.pendingMobileSnaps) return;
    this.data.pendingMobileSnaps = this.data.pendingMobileSnaps.filter(s => s.id !== snapId);
    this.saveData();
    this.renderKPIs();
    this.renderUrgentActionsList();
    this.updateSidebarUI();
    this.showToast('Pending mobile document discarded.');
  }

  playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.36);
    } catch (e) {}
  }

  async uploadMobileSnapToVault(snapData) {
    try {
      this.showToast('Archiving mobile document into Vault...');
      const resp = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: 'general',
          category: snapData.tag || 'other_attachment',
          fileName: snapData.fileName,
          fileData: snapData.base64,
          metadata: { source: 'mobile_snap', note: snapData.note }
        })
      });
      if (resp.ok) {
        this.showToast('Mobile document saved to Vault!');
        this.reindexVaultFiles();
      }
    } catch (e) {
      console.warn('Error saving mobile snap to vault:', e);
    }
  }
});
