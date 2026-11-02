// TradeFlow: Backups and change history. Methods of the app (TradeFlowApp); see js/app.js.
TradeFlowApp.addMethods(class {

  /* ---------- BACKUP & DISASTER RECOVERY CENTER ---------- */
  async openBackupModal() {
    const modal = document.getElementById('backup-recovery-modal');
    if (modal) modal.classList.remove('hidden');
    await this.refreshBackupList();
  }

  closeBackupModal() {
    const modal = document.getElementById('backup-recovery-modal');
    if (modal) modal.classList.add('hidden');
  }

  async refreshBackupList() {
    const container = document.getElementById('backup-list-container');
    const badge = document.getElementById('backup-count-badge');
    if (container) container.innerHTML = '<div class="p-6 text-center text-xs text-slate-500">Loading backup snapshots...</div>';

    try {
      const resp = await fetch('/api/backup/list');
      const res = await resp.json();
      if (!res.success) throw new Error(res.error);

      const backups = res.backups || [];
      if (badge) badge.textContent = backups.length;

      if (backups.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-xs text-slate-500">No backup snapshots recorded yet. Create one now!</div>';
        return;
      }

      container.innerHTML = backups.map(b => {
        const timeStr = this.formatDateTime(b.timestamp, true);
        const kbSize = (b.sizeBytes / 1024).toFixed(1);
        const ordersCount = b.recordCounts ? b.recordCounts.orders : '-';
        const paymentsCount = b.recordCounts ? b.recordCounts.payments : '-';

        let reasonBadge = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        if (b.reason.includes('pre-restore')) reasonBadge = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
        else if (b.reason.includes('excel')) reasonBadge = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
        else if (b.reason.includes('migration')) reasonBadge = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
        else if (b.reason.includes('manual')) reasonBadge = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';

        return `
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 flex items-center justify-between gap-4">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold font-mono text-slate-900 dark:text-white truncate">${tfEscapeHtml(b.id)}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${tfEscapeHtml(reasonBadge)}">${tfEscapeHtml(b.reason)}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                <span>${tfEscapeHtml(timeStr)}</span>
                <span>${tfEscapeHtml(ordersCount)} Orders, ${tfEscapeHtml(paymentsCount)} Payments</span>
                <span>${tfEscapeHtml(kbSize)} KB</span>
                ${b.hasSqliteSnapshot ? '<span class="text-emerald-600 font-bold">SQLite .db</span>' : ''}
                ${b.hasExcelSnapshot ? '<span class="text-emerald-600 font-bold">Excel .xlsx</span>' : ''}
              </div>
            </div>
            <button type="button" onclick="app.restoreBackup('${tfEscapeHtml(tfEscapeJs(b.id))}')" class="btn-tactile px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-2xs flex items-center gap-1.5 shrink-0 transition-all">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Restore</span>
            </button>
          </div>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      if (container) container.innerHTML = `<div class="p-6 text-center text-xs text-rose-500">Error loading backups: ${tfEscapeHtml(e.message)}</div>`;
    }
  }

  async createManualBackup() {
    const reason = await this.showModalPrompt({
      title: 'Create Point-in-Time Snapshot',
      subtitle: 'System Database Checkpoint',
      message: 'Enter a tag or reference note for this manual backup snapshot:',
      defaultValue: 'manual_checkpoint',
      suggestions: ['Pre-Delivery Audit', 'Month-End Closing', 'Pre-Bulk Update', 'manual_checkpoint'],
      confirmText: 'Create Snapshot'
    });
    if (reason === null || reason === undefined || reason === '') return;

    this.showToast('Creating point-in-time snapshot...');
    try {
      const resp = await fetch('/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'manual' })
      });
      const res = await resp.json();
      if (res.success) {
        this.showToast(`Backup created successfully: ${res.backup.id}`);
        await this.refreshBackupList();
      } else {
        this.showToast(`Failed to create backup: ${res.error}`);
      }
    } catch (e) {
      this.showToast('Connection error while creating backup.');
    }
  }

  async restoreBackup(backupId) {
    const confirmed = await this.showModalConfirm({
      title: 'Restore Database Snapshot',
      subtitle: 'State Rollback Warning',
      message: `Are you sure you want to restore snapshot <strong>"${tfEscapeHtml(backupId)}"</strong>?<br><br><span class="text-xs text-slate-500">TradeFlow will automatically generate a pre-restore safety checkpoint of your current state first.</span>`,
      confirmText: 'Restore Snapshot',
      confirmClass: 'bg-rose-600 hover:bg-rose-500',
      icon: 'database'
    });
    if (!confirmed) return;

    this.showToast('Restoring snapshot and rebuilding state...');
    try {
      const resp = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      });
      const res = await resp.json();
      if (res.success) {
        this.showToast(`Successfully restored backup ${backupId}!`);
        await this.syncAuthoritativeDataFromServer();
        this.render();
        this.closeBackupModal();
      } else {
        this.showToast(`Failed to restore backup: ${res.error}`);
      }
    } catch (e) {
      this.showToast(`Network error during restore: ${e.message}`);
    }
  }

  /* ---------- CHANGE HISTORY & AUDIT TRAIL ---------- */
  async openChangeHistoryModal(entityType = null, entityId = null) {
    const modal = document.getElementById('change-history-modal');
    if (modal) modal.classList.remove('hidden');
    if (entityType) {
      const select = document.getElementById('history-filter-entity');
      if (select) select.value = entityType;
    }
    await this.refreshChangeHistory(entityType, entityId);
  }

  closeChangeHistoryModal() {
    const modal = document.getElementById('change-history-modal');
    if (modal) modal.classList.add('hidden');
  }

  async filterChangeHistory() {
    const select = document.getElementById('history-filter-entity');
    const entityType = select ? select.value : null;
    await this.refreshChangeHistory(entityType);
  }

  async refreshChangeHistory(entityType = null, entityId = null) {
    const container = document.getElementById('change-history-container');
    const countLabel = document.getElementById('history-total-count');
    if (container) container.innerHTML = '<div class="p-6 text-center text-xs text-slate-500">Loading audit trail...</div>';

    let url = '/api/history?limit=60';
    if (entityType) url += `&entityType=${encodeURIComponent(entityType)}`;
    if (entityId) url += `&entityId=${encodeURIComponent(entityId)}`;

    try {
      const resp = await fetch(url);
      const res = await resp.json();
      if (!res.success) throw new Error(res.error);

      const logs = res.logs || [];
      if (countLabel) countLabel.textContent = `${logs.length} activity records logged`;

      if (logs.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-xs text-slate-500">No activity recorded for this criteria.</div>';
        return;
      }

      container.innerHTML = logs.map(l => {
        const timeStr = this.formatDateTime(l.timestamp, true);
        const canRollback = !!l.previousState;

        let actionBadge = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        if (l.actionType === 'ROLLBACK') actionBadge = 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold';
        else if (l.actionType === 'CREATE') actionBadge = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold';
        else if (l.actionType === 'EXCEL_IMPORT') actionBadge = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold';
        else if (l.actionType === 'MIGRATION') actionBadge = 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold';

        return `
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-3 flex items-start justify-between gap-4">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-xs font-bold ${tfEscapeHtml(actionBadge)}">${tfEscapeHtml(l.actionType)}</span>
                <span class="text-xs font-bold text-slate-900 dark:text-white">${tfEscapeHtml(l.summary)}</span>
              </div>
              <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                <span>${tfEscapeHtml(timeStr)}</span>
                <span>By: <strong>${tfEscapeHtml(l.userName)}</strong></span>
                <span>${tfEscapeHtml(l.entityType)} ${tfEscapeHtml(l.entityId || '')}</span>
              </div>
            </div>
            ${canRollback ? `
              <button type="button" onclick="app.rollbackChange('${tfEscapeHtml(tfEscapeJs(l.id))}')" class="btn-tactile px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0 transition-all" title="Rollback this edit and restore previous state">
                <i data-lucide="undo-2" class="w-3.5 h-3.5"></i>
                <span>Rollback</span>
              </button>
            ` : ''}
          </div>
        `;
      }).join('');

      if (window.lucide) window.lucide.createIcons();
    } catch (e) {
      if (container) container.innerHTML = `<div class="p-6 text-center text-xs text-rose-500">Error loading history: ${tfEscapeHtml(e.message)}</div>`;
    }
  }

  async rollbackChange(logId) {
    const confirmed = await this.showModalConfirm({
      title: 'Rollback Database Change',
      subtitle: 'Audit Trail Reversion',
      message: 'Are you sure you want to rollback this change and restore the record to its previous snapshot?',
      confirmText: 'Confirm Rollback',
      confirmClass: 'bg-amber-600 hover:bg-amber-500',
      icon: 'rotate-ccw'
    });
    if (!confirmed) return;

    this.showToast('Rolling back change...');
    try {
      const resp = await fetch('/api/history/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, userName: 'Operator' })
      });
      const res = await resp.json();
      if (res.success) {
        this.showToast(`Change successfully rolled back! Restored ${res.entityType} ${res.entityId}`);
        await this.syncAuthoritativeDataFromServer();
        this.render();
        await this.refreshChangeHistory();
      } else {
        this.showToast(`Rollback failed: ${res.error}`);
      }
    } catch (e) {
      this.showToast(`Network error during rollback: ${e.message}`);
    }
  }
});
