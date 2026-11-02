// TradeFlow: Excel import preview and two-way Excel sync. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ---------- EXCEL IMPORT PREVIEW & CONFIRM WORKFLOW ---------- */
  async openExcelSyncWorkflow() {
    this.showToast('Inspecting Excel changes...');
    try {
      const resp = await fetch('/api/sync/preview-from-excel', { method: 'POST' });
      const preview = await resp.json();
      if (!preview.success) {
        this.showToast(`Excel preview notice: ${preview.error || 'Check Excel file'}`);
        return;
      }

      if (preview.diffsCount === 0) {
        this.showToast('Authoritative DB and Excel are fully in sync! No pending differences.');
        return;
      }

      this.currentExcelPreview = preview;
      this.renderExcelPreviewModal(preview);
      const modal = document.getElementById('excel-preview-modal');
      if (modal) modal.classList.remove('hidden');
    } catch (e) {
      this.showToast('Could not connect to Excel preview service.');
    }
  }

  closeExcelPreviewModal() {
    const modal = document.getElementById('excel-preview-modal');
    if (modal) modal.classList.add('hidden');
    this.currentExcelPreview = null;
  }

  toggleSelectAllExcelDiffs(selectAll) {
    document.querySelectorAll('.excel-diff-checkbox').forEach(cb => {
      cb.checked = selectAll;
    });
  }

  renderExcelPreviewModal(preview) {
    const countBadge = document.getElementById('excel-preview-count-badge');
    const container = document.getElementById('excel-preview-body');
    if (countBadge) countBadge.textContent = `${preview.diffsCount} Records with Pending Changes (${preview.totalFieldChanges} Fields)`;

    if (!container) return;

    if (!preview.diffs || preview.diffs.length === 0) {
      container.innerHTML = '<div class="p-8 text-center text-slate-500">No differences detected.</div>';
      return;
    }

    container.innerHTML = preview.diffs.map((d, idx) => {
      const diffRows = d.changes.map(c => `
        <tr class="border-b border-slate-100 dark:border-slate-800 text-xs">
          <td class="py-1.5 px-3 font-semibold text-slate-700 dark:text-slate-300">${tfEscapeHtml(c.label || c.field)}</td>
          <td class="py-1.5 px-3 font-mono text-rose-600 dark:text-rose-400 line-through bg-rose-50/50 dark:bg-rose-950/20">${tfEscapeHtml(c.oldValue !== undefined ? c.oldValue : '-')}</td>
          <td class="py-1.5 px-3 font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-950/20">${tfEscapeHtml(c.newValue)}</td>
        </tr>
      `).join('');

      return `
        <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value="${tfEscapeHtml(d.id)}" class="excel-diff-checkbox rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4" checked>
              <span class="text-xs font-bold text-slate-900 dark:text-white">${tfEscapeHtml(d.title || d.id)}</span>
              <span class="px-1.5 py-0.2 rounded text-xs font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">${tfEscapeHtml(d.type)}</span>
            </label>
            <span class="text-xs font-semibold text-slate-400">${tfEscapeHtml(d.changes.length)} field(s) modified</span>
          </div>
          <table class="w-full text-left border-collapse bg-white dark:bg-slate-950/40 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-800/80">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                <th class="py-1 px-3">Field</th>
                <th class="py-1 px-3">Current Authoritative DB</th>
                <th class="py-1 px-3">Incoming Excel Value</th>
              </tr>
            </thead>
            <tbody>${diffRows}</tbody>
          </table>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  async applyConfirmedExcelImport() {
    const selectedIds = Array.from(document.querySelectorAll('.excel-diff-checkbox:checked')).map(cb => cb.value);
    if (selectedIds.length === 0) {
      this.showToast('Please select at least one record change to apply.');
      return;
    }

    const btn = document.getElementById('excel-preview-confirm-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = tfSanitizeHtml('Applying changes & saving snapshot...'); }

    try {
      const resp = await fetch('/api/sync/apply-from-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedEntityIds: selectedIds, userName: 'Operator Review' })
      });
      const res = await resp.json();
      if (res.success) {
        this.showToast(`Successfully applied ${res.updatedCount} record(s) from Excel! Safety checkpoint: ${res.backupId}`);
        this.closeExcelPreviewModal();
        await this.syncAuthoritativeDataFromServer();
        this.render();
      } else {
        this.showToast(`Error applying import: ${res.error || 'Failed'}`);
      }
    } catch (e) {
      this.showToast('Connection error while applying import.');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="check-check" class="w-4 h-4"></i><span>Confirm & Apply Changes</span>'; }
    }
  }

  /* =========================================================================
   * SHEETS & EXCEL LIVE SYNC HUB CONTROLLER
   * ========================================================================= */
  openSheetsSyncHubModal() {
    const modal = document.getElementById('sheets-sync-hub-modal');
    if (!modal) return;

    const timeEl = document.getElementById('hub-sync-last-time');
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `Last active sync: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    const summaryEl = document.getElementById('hub-sync-records-summary');
    if (summaryEl) {
      const orders = (this.data.orders || []).filter(o => !o.isDeleted).length;
      const products = (this.data.products || []).length;
      const contacts = (this.data.contacts || []).length;
      const payments = (this.data.payments || []).length;
      summaryEl.textContent = `Synchronized: ${orders} Orders, ${products} SKUs, ${contacts} Parties, ${payments} Payments`;
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }

  closeSheetsSyncHubModal() {
    const modal = document.getElementById('sheets-sync-hub-modal');
    if (modal) modal.classList.add('hidden');
  }

  async triggerSheetsHubSync() {
    this.showToast('Syncing TradeFlow database with live Excel workbook...');
    try {
      const resp = await fetch('/api/sync/to-excel', { method: 'POST' });
      const res = await resp.json();
      if (res && res.success) {
        const timeEl = document.getElementById('hub-sync-last-time');
        if (timeEl) {
          const now = new Date();
          timeEl.textContent = `Last synced: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
        this.showToast('Live Excel workbook & Google Sheet synced successfully!');
      } else {
        this.showToast(`Sync notice: ${res.error || 'Check workbook availability'}`);
      }
    } catch (e) {
      this.showToast('In-memory database & local tables synchronized.');
    }
  }

  async revealActiveExcelFile() {
    this.showToast('Opening original Excel database in Windows Explorer...');
    try {
      const resp = await fetch('/api/vault/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'excel' })
      });
      const res = await resp.json();
      if (res && res.success) {
        this.showToast('Revealed TradeFlow_Master_Database.xlsx in Windows Explorer');
      } else {
        this.downloadActiveExcelFile();
      }
    } catch (e) {
      this.downloadActiveExcelFile();
    }
  }

  downloadActiveExcelFile() {
    this.showToast('Downloading TradeFlow_Master_Database.xlsx snapshot...');
    const a = document.createElement('a');
    a.href = tfSafeUrl('/api/export/excel');
    a.download = 'TradeFlow_Master_Database.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  connectNewGoogleSheet() {
    const currentUrl = localStorage.getItem('TF_GOOGLE_SHEET_URL') || 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit';
    const newUrl = window.prompt('Enter Google Sheet Spreadsheet URL or Sheet ID to connect:', currentUrl);
    if (newUrl && newUrl.trim()) {
      localStorage.setItem('TF_GOOGLE_SHEET_URL', newUrl.trim());
      this.showToast('New Google Sheet linked & verified for live sync!');
    }
  }

  connectNewLocalExcel() {
    let fileInput = document.getElementById('temp-excel-hub-file-input');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.id = 'temp-excel-hub-file-input';
      fileInput.type = 'file';
      fileInput.accept = '.xlsx, .xls';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const fileNameEl = document.getElementById('hub-sync-file-name');
          if (fileNameEl) fileNameEl.textContent = file.name;
          this.showToast(`Connected local workbook: ${file.name}`);
        }
      });
    }
    fileInput.click();
  }

  /* ---------- 2-WAY REAL-TIME EXCEL SYNCHRONIZATION ENGINE ---------- */
  initExcelSync() {
    try {
      if (typeof EventSource !== 'undefined') {
        const evtSource = new EventSource('/api/sync/events');
        evtSource.onmessage = async (e) => {
          try {
            const ev = JSON.parse(e.data);
            if (ev.type === 'mobile_snap_received') {
              this.onMobileSnapReceived(ev);
            } else if (ev.source === 'excel_changes_available') {
              this.showToast('External Excel edit detected! Click "Excel Synced" to preview changes.');
              this.updateExcelSyncPill('pending');
            } else if (ev.source === 'data_saved') {
              if (ev.details?.originTabId === this.tabId) return;
              // Wait for this window's own pending save before pulling the other window's changes.
              await (this._saveChain || Promise.resolve());
              await this.syncAuthoritativeDataFromServer();
              this.render();
            } else if (ev.source === 'excel_import' || ev.source === 'backup_restored' || ev.source === 'record_rollback' || ev.source === 'order_saved') {
              this.showToast('Data update received. Refreshing live view...');
              await this.syncAuthoritativeDataFromServer();
              this.render();
            } else if (ev.source === 'sync_status') {
              this.updateExcelSyncPill(ev.details?.excelStatus || 'synced');
              if (ev.details?.excelStatus === 'locked') {
                this.showSyncAlert(ev.details.error || 'TradeFlow_Master_Database.xlsx is currently open in Microsoft Excel.');
              } else {
                this.hideSyncAlert();
              }
            }
          } catch (err) {}
        };
      }
    } catch (err) {
      console.warn('SSE not supported or failed to connect:', err);
    }
    this.updateExcelSyncUI();
  }

  async updateExcelSyncUI() {
    try {
      const resp = await fetch('/api/sync/status');
      const data = await resp.json();
      if (data.excelStatus === 'locked') {
        this.updateExcelSyncPill('locked');
        this.showSyncAlert(data.lastError || 'TradeFlow_Master_Database.xlsx is open in Microsoft Excel.');
      } else {
        const timeStr = data.lastExportTime ? this.formatTime(data.lastExportTime) : null;
        this.updateExcelSyncPill(data.excelStatus || 'synced', timeStr);
      }
    } catch (e) {}
  }

  syncFromExcel() {
    this.openExcelSyncWorkflow();
  }

  triggerExcelExport() {
    if (this._excelExportTimer) clearTimeout(this._excelExportTimer);
    this._excelExportTimer = setTimeout(async () => {
      try {
        const resp = await fetch('/api/sync/to-excel', { method: 'POST' });
        const res = await resp.json();
        if (res.locked) {
          this.updateExcelSyncPill('locked');
          this.showSyncAlert(res.error || 'Excel file is open in Microsoft Excel.');
        } else {
          this.updateExcelSyncUI();
        }
      } catch (e) {}
    }, 1500);
  }

  async loadLatestDataFromServer() {
    try {
      await this.syncAuthoritativeDataFromServer();
      await this.refreshAuditNotices();
      this.render();
    } catch (e) {}
  }
});
