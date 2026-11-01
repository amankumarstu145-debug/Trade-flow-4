const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const { fixture, seed, root } = require('./fixture');
const SyncManager = require('../sync_manager');
const BackupManager = require('../backup_manager');
const { assertWithin, createGuard } = require('../security');
let env;
before(async () => { env = await fixture(); });
after(async () => { if (env) await env.close(); });
async function post(route, value) {
  const response = await fetch(env.base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
  return { status: response.status, data: await response.json() };
}
test('security: backend, dependency, source and database files are private', async () => {
  for (const route of ['/server.js', '/security.js', '/package.json', '/package-lock.json', '/.git/config', '/data/tradeflow.db', '/data/.mobile-pairing.json', '/data/backups/manifest.json', '/tests/release.test.js', '/rapidocr/requirements.txt']) assert.equal((await fetch(env.base + route)).status, 403, route);
});
test('security: hostile website origins and DNS rebinding hosts are rejected', async () => {
  for (const headers of [{ Origin: 'https://evil.example' }, { Origin: 'null' }, { Host: 'evil.example:' + env.port }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => { const req = http.get(env.base + '/api/data', { headers }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
    assert.equal(status, 403, JSON.stringify(headers));
  }
  const response = await fetch(env.base + '/api/data');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
});
test('security: same-origin requests remain usable', async () => {
  assert.equal((await fetch(env.base + '/api/data', { headers: { Origin: env.base } })).status, 200);
});
test('security: malformed paths do not crash the server', async () => {
  assert.equal((await fetch(env.base + '/%E0%A4%A')).status, 400);
  assert.equal((await fetch(env.base + '/data/%2e%2e%5cserver.js')).status, 403);
  assert.equal((await fetch(env.base + '/api/sync/status')).status, 200);
});
test('security: invalid JSON, primitive roots, and unsafe object keys are rejected', async () => {
  for (const body of ['{', 'null', '[]', '"hello"', '{"__proto__":{"polluted":true}}']) {
    const response = await fetch(env.base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, 400, body);
  }
  assert.equal({}.polluted, undefined);
});
test('security: form-style requests are rejected', async () => {
  const response = await fetch(env.base + '/api/data', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(response.status, 415);
});
test('security: excessive declared request size is rejected', async () => {
  const status = await new Promise((resolve, reject) => {
    const request = http.request(env.base + '/api/data', { method: 'POST', headers: { 'Content-Length': 51 * 1024 * 1024 } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(status, 413);
});
test('security: arbitrary file previews and OCR disk reads are blocked', async () => {
  const response = await fetch(env.base + '/api/documents/preview?path=' + encodeURIComponent(path.join(root, 'server.js')));
  assert.equal(response.status, 404);
  const scan = await post('/api/ai/test-scan', { fileData: path.join(root, 'server.js') });
  assert(!JSON.stringify(scan.data).includes('const http = require'));
});
test('security: Excel preview traversal and native folder traversal fail safely', async () => {
  for (const [route, value] of [['/api/vault/excel-preview', { filePath: '../../package.json' }], ['/api/open-folder', { filePath: path.join(root, 'server.js') }]]) {
    const response = await post(route, value);
    assert.equal(response.data.success, route.includes('open-folder') ? undefined : false);
    assert(response.status >= 400);
  }
});
test('security: project sibling-prefix paths cannot escape the data root', () => {
  const dataRoot = path.join(env.directory, 'data');
  assert.throws(() => assertWithin(dataRoot, dataRoot + '-outside/file.pdf'));
  assert.throws(() => assertWithin(dataRoot, path.join(dataRoot, '..', 'server.js')));
});
test('security: unpaired and predictable mobile sessions cannot upload', async () => {
  for (const sessionId of [undefined, 'PERMANENT', 'DIRECT', 'DEV-1234', 'SNAP-1234']) assert.equal((await post('/api/mobile-snap/upload', { sessionId, fileData: 'data:image/png;base64,aGVsbG8=', fileName: 'test.png' })).status, 403);
});
test('security: paired phone upload and session polling work', async () => {
  const session = await post('/api/mobile-snap/session', {});
  assert.match(session.data.sessionId, /^SNAP-[a-f0-9]{48}$/);
  assert(new URL(session.data.permanentUrl).searchParams.get('session').length > 60);
  const upload = await post('/api/mobile-snap/upload', { sessionId: session.data.sessionId, fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRXsAAAAASUVORK5CYII=', fileName: 'test.png' });
  assert.equal(upload.status, 200); assert.equal(upload.data.success, true);
  assert.equal((await fetch(env.base + upload.data.fileUrl)).status, 200);
  const status = await (await fetch(env.base + '/api/mobile-snap/status?session=' + session.data.sessionId)).json();
  assert.equal(status.session.status, 'uploaded');
});
test('security: remote clients are restricted to capture resources', async () => {
  const guard = createGuard(env.directory, env.port);
  for (const route of ['/api/data', '/', '/data/mock-data.js', '/api/sync/events']) {
    let result;
    const response = { setHeader() {}, writeHead(status) { result = status; }, end() {} };
    await guard({ headers: { host: 'localhost:' + env.port }, socket: { remoteAddress: '192.168.1.9' }, method: 'GET', url: route }, response, () => { throw new Error('Remote handler must not run'); });
    assert.equal(result, 403, route);
  }
});
test('security: executable document uploads are rejected', async () => {
  const result = await post('/api/documents/upload', { fileName: 'attack.html', fileData: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' });
  assert.equal(result.data.success, undefined); assert(result.status >= 400);
});
test('full-state persistence saves products, settings, documents and removals', () => {
  const manager = new SyncManager(env.directory);
  try {
    const data = seed();
    data.products[0].mrp = 155; data.businessProfile.brandName = 'Changed'; data.recycleBin.push({ id: 'BIN-TEST' });
    data.documents.push({ id: 'DOC-TEST', fileName: 'test.pdf', orderId: 'ORD-TEST' });
    data.customPreference = 'preserved';
    manager.saveData(data);
    let saved = manager.loadData();
    assert.equal(saved.products[0].mrp, 155); assert.equal(saved.businessProfile.brandName, 'Changed');
    assert.equal(saved.documents.length, 1); assert.equal(saved.recycleBin.length, 1); assert.equal(saved.customPreference, 'preserved');
    data.orders = []; data.payments = []; manager.saveData(data);
    saved = manager.loadData(); assert.equal(saved.orders.length, 0); assert.equal(saved.payments.length, 0);
    assert.equal(manager.dbManager.isSeeded(), true);
    manager.saveData(seed());
  } finally { manager.dbManager.db.close(); }
});
test('fresh checkout preserves its immutable example when live records change', () => {
  const directory = fs.mkdtempSync(path.join(env.directory, 'example-init-'));
  let manager;
  try {
    fs.mkdirSync(path.join(directory, 'examples'));
    const examplePath = path.join(directory, 'examples', 'demo-data.js');
    const example = 'module.exports = ' + JSON.stringify(seed()) + ';';
    fs.writeFileSync(examplePath, example);
    manager = new SyncManager(directory);
    assert.equal(manager.loadData().orders.length, 1);
    const changed = manager.loadData(); changed.businessProfile.brandName = 'Private Business Name';
    manager.saveData(changed);
    assert.equal(fs.readFileSync(examplePath, 'utf8'), example);
    assert(fs.readFileSync(path.join(directory, 'data', 'mock-data.js'), 'utf8').includes('Private Business Name'));
  } finally {
    if (manager) manager.dbManager.db.close();
    assert(directory.startsWith(env.directory + path.sep));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('invalid or duplicate snapshot IDs do not partially overwrite the database', () => {
  const manager = new SyncManager(env.directory);
  try {
    const original = manager.loadData(); const invalid = seed(); invalid.contacts.push(invalid.contacts[0]);
    assert.throws(() => manager.saveData(invalid), /duplicate/i);
    assert.deepEqual(manager.loadData(), original);
    const broken = seed(); broken.orders[0].totalInvoiceAmount = 'not-a-number';
    assert.throws(() => manager.saveData(broken));
    assert.deepEqual(manager.loadData(), original);
  } finally { manager.dbManager.db.close(); }
});
test('unchanged snapshots do not flood the activity log', () => {
  const manager = new SyncManager(env.directory);
  try {
    const original = manager.loadData(); const before = manager.dbManager.db.prepare('SELECT COUNT(*) AS count FROM activity_log').get().count;
    manager.saveData(original); manager.saveData(original);
    assert.equal(manager.dbManager.db.prepare('SELECT COUNT(*) AS count FROM activity_log').get().count, before);
  } finally { manager.dbManager.db.close(); }
});
test('activity rollback restores the actual previous order', () => {
  const manager = new SyncManager(env.directory);
  try {
    const original = manager.dbManager.getOrder('ORD-TEST');
    manager.dbManager.saveOrder({ ...original, totalInvoiceAmount: 990 }, 'Release Test');
    const entry = manager.dbManager.getActivityLogs(10, 'ORDER', 'ORD-TEST').find(x => x.newState?.totalInvoiceAmount === 990);
    assert.equal(manager.dbManager.rollbackChange(entry.id, 'Release Test').success, true);
    assert.equal(manager.dbManager.getOrder('ORD-TEST').totalInvoiceAmount, original.totalInvoiceAmount);
  } finally { manager.dbManager.db.close(); }
});
test('WAL backup snapshots include the latest committed data and unique IDs', () => {
  const manager = new SyncManager(env.directory);
  try {
    const data = seed(); data.products[0].mrp = 321; manager.saveData(data);
    manager.dbManager.registerPaymentSlip({ utr: 'ORIGINAL-REGISTRY-UTR', orderId: 'ORD-TEST' });
    const first = manager.backupManager.createBackup('same'); const second = manager.backupManager.createBackup('same');
    assert(first.success && second.success); assert.notEqual(first.backup.id, second.backup.id);
    const db = new DatabaseSync(path.join(manager.backupManager.backupsDir, first.backup.sqliteFile), { readOnly: true });
    try { assert.equal(db.prepare('SELECT mrp FROM products WHERE id = ?').get('SKU-TEST').mrp, 321); assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); } finally { db.close(); }
    const changed = seed(); changed.products[0].mrp = 999; manager.saveData(changed);
    manager.dbManager.registerPaymentSlip({ utr: 'LATER-REGISTRY-UTR', orderId: 'ORD-TEST' });
    assert(manager.backupManager.restoreBackup(first.backup.id, manager).success);
    assert.equal(manager.loadData().products[0].mrp, 321);
    assert.equal(manager.dbManager.checkDuplicatePaymentSlip({ utr: 'ORIGINAL-REGISTRY-UTR' }).isDuplicate, true);
    assert.equal(manager.dbManager.checkDuplicatePaymentSlip({ utr: 'LATER-REGISTRY-UTR' }).isDuplicate, false);
    manager.saveData(seed());
  } finally { manager.dbManager.db.close(); }
});
test('restore reports database errors instead of false success', () => {
  const backup = new BackupManager(env.directory); const snapshot = backup.createBackup('restore-error');
  const result = backup.restoreBackup(snapshot.backup.id, { dbManager: { migrateFromData() { throw new Error('Simulated database failure'); } } });
  assert.equal(result.success, false); assert.match(result.error, /Simulated database failure/);
});
test('Excel export, preview, and import preserve a field edit', async () => {
  const manager = new SyncManager(env.directory);
  try {
    assert(manager.exportToExcel().success);
    const XLSX = require('xlsx'); const workbook = XLSX.readFile(manager.excelPath);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Orders_Master); rows[0]['Urgent Alert'] = 'RELEASE-ROUNDTRIP';
    workbook.Sheets.Orders_Master = XLSX.utils.json_to_sheet(rows); XLSX.writeFile(workbook, manager.excelPath);
    assert(manager.importFromExcel().success);
    assert.equal(manager.loadData().orders[0].urgentAlert, 'RELEASE-ROUNDTRIP');
    const preview = await post('/api/vault/excel-preview', { filePath: 'data/TradeFlow_Master_Database.xlsx' });
    assert.equal(preview.status, 200); assert(preview.data.sheets.Orders_Master.length);
  } finally { manager.dbManager.db.close(); }
});
test('security: every PDF.js call disables font evaluation', () => {
  for (const file of ['js/app.js', 'js/smart-fill.js']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of source.matchAll(/pdfjsLib\.getDocument\(([^\n]+)/g)) assert(match[1].includes('isEvalSupported: false'), file);
  }
});
test('security: launchers never kill a process to take over its port', () => {
  for (const file of ['server.js', 'start.server.bat']) assert(!/taskkill|Stop-Process|exec\(`/i.test(fs.readFileSync(path.join(root, file), 'utf8')), file);
});

// ---- Regression tests for the security and data-integrity fixes ----
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRXsAAAAASUVORK5CYII=';
const PDF = Buffer.from('%PDF-1.4\n%test\n').toString('base64');
const HTML = Buffer.from('<html><script>alert(1)</script></html>').toString('base64');
function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? filesUnder(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
test('security: the unused payment/order/partner write endpoints are gone (path traversal write)', async () => {
  for (const route of ['/api/payments', '/api/orders', '/api/partners']) {
    const response = await fetch(env.base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: '100', party: 'X', name: 'X', id: 'X', date: '/../../../../../../POC', proofFilename: 'x.bat', proofData: 'ZWNobyBQT0M=' }) });
    assert(response.status >= 400, route);
  }
  assert(!filesUnder(env.directory).some(file => /\.bat$|POC/i.test(file)), 'no file may be written');
});
test('security: payment proof archive refuses non-document bytes and executable names', async () => {
  const bad = await post('/api/vault/archive-payment-proof', { orderRef: 'ORD-TEST', fileData: 'data:application/octet-stream;base64,ZWNobyBQT0M=', originalName: 'run.bat', date: '/../../x' });
  assert.equal(bad.status, 415);
  const good = await post('/api/vault/archive-payment-proof', { orderRef: 'ORD-TEST', fileData: 'data:image/png;base64,' + PNG, originalName: 'slip.bat', date: '2026-10-30' });
  assert.equal(good.status, 200);
  assert(!filesUnder(path.join(env.directory, 'data')).some(file => file.endsWith('.bat')));
  assert(filesUnder(path.join(env.directory, 'data', 'orders')).some(file => file.endsWith('.png')));
});
test('security: document uploads check content, accept numeric order IDs and fix mislabelled images', async () => {
  const disguised = await post('/api/documents/upload', { orderId: 'ORD-TEST', fileName: 'invoice.pdf', fileData: 'data:application/pdf;base64,' + HTML });
  assert.equal(disguised.status, 415);
  const numeric = await post('/api/documents/upload', { orderId: 4242, fileName: 'invoice.pdf', fileData: 'data:application/pdf;base64,' + PDF });
  assert.equal(numeric.status, 200, JSON.stringify(numeric.data));
  const relabelled = await post('/api/documents/upload', { orderId: 'ORD-TEST', fileName: 'photo.jpg', fileData: 'data:image/jpeg;base64,' + PNG });
  assert.equal(relabelled.status, 200);
  assert.match(relabelled.data.doc.storedFileName, /\.png$/);
});
test('security: phone uploads must be real images/PDFs and saved phones can be unpaired', async () => {
  const session = await post('/api/mobile-snap/session', {});
  const html = await post('/api/mobile-snap/upload', { sessionId: session.data.sessionId, fileData: 'data:image/jpeg;base64,' + HTML, fileName: 'slip.jpg' });
  assert.equal(html.status, 415);
  const permanent = new URL(session.data.permanentUrl).searchParams.get('session');
  assert.equal((await post('/api/mobile-snap/upload', { sessionId: permanent, fileData: 'data:image/png;base64,' + PNG, fileName: 'a.png' })).status, 200);
  assert.equal((await post('/api/mobile-snap/revoke', {})).status, 200);
  assert.equal((await post('/api/mobile-snap/upload', { sessionId: permanent, fileData: 'data:image/png;base64,' + PNG, fileName: 'a.png' })).status, 403);
  assert(!fs.existsSync(path.join(env.directory, 'data', '.mobile-pairing.json')));
});
test('security: document preview errors do not reveal file-system paths', async () => {
  const body = await (await fetch(env.base + '/api/documents/preview?path=missing.pdf')).text();
  assert(!body.includes(env.directory) && !body.includes('candidates'), body);
});
test('data: purge only removes items that are already in the recycle bin', async () => {
  assert.equal((await post('/api/recycle-bin/purge', { entityType: 'order', id: 'ORD-TEST' })).status, 409);
  assert.equal((await post('/api/recycle-bin/purge', { type: 'order', id: 'ORD-TEST' })).status, 400);
  const current = (await (await fetch(env.base + '/api/data')).json()).data;
  assert(current.orders.some(order => order.id === 'ORD-TEST'), 'live order must survive');
});
test('data: a stale window cannot delete or overwrite records saved after it loaded', async () => {
  const windowA = await (await fetch(env.base + '/api/data')).json();
  const windowB = await (await fetch(env.base + '/api/data')).json();
  await new Promise(resolve => setTimeout(resolve, 5));
  // Window B adds a payment and edits the order.
  const b = structuredClone(windowB.data);
  b.payments.push({ id: 'PAY-WINDOW-B', partyName: 'B', direction: 'received', amount: 77, date: '2026-10-31' });
  b.orders[0].status = 'in_transit';
  const savedB = await post('/api/data', { data: b, baseTimestamp: windowB.timestamp });
  assert.equal(savedB.status, 200); assert.deepEqual(savedB.data.conflicts, []);
  // Window A saves its older copy with its own small change.
  const a = structuredClone(windowA.data);
  a.orders[0].status = 'settled';
  const savedA = await post('/api/data', { data: a, baseTimestamp: windowA.timestamp });
  assert.equal(savedA.status, 200);
  assert(savedA.data.conflicts.some(c => c.id === 'PAY-WINDOW-B'), 'reports the kept payment');
  assert(savedA.data.conflicts.some(c => c.id === a.orders[0].id), 'reports the kept order');
  const after = (await (await fetch(env.base + '/api/data')).json()).data;
  assert(after.payments.some(p => p.id === 'PAY-WINDOW-B'), 'payment from window B must survive');
  assert.equal(after.orders[0].status, 'in_transit', 'window B edit must survive');
  // A window deleting a record it has seen still works.
  const fresh = await (await fetch(env.base + '/api/data')).json();
  const c = structuredClone(fresh.data);
  c.payments = c.payments.filter(p => p.id !== 'PAY-WINDOW-B');
  const savedC = await post('/api/data', { data: c, baseTimestamp: fresh.timestamp });
  assert.deepEqual(savedC.data.conflicts, []);
  assert(!(await (await fetch(env.base + '/api/data')).json()).data.payments.some(p => p.id === 'PAY-WINDOW-B'));
});
test('security: upload content checks recognise each allowed type', () => {
  const { contentMatchesExtension, verifiedExtension } = require('../security');
  assert(contentMatchesExtension(Buffer.from('%PDF-1.7'), '.pdf'));
  assert(contentMatchesExtension(Buffer.from(PNG, 'base64'), '.png'));
  assert(contentMatchesExtension(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), '.jpg'));
  assert(!contentMatchesExtension(Buffer.from('<html>'), '.pdf'));
  assert(!contentMatchesExtension(Buffer.from('MZ\x90\x00'), '.exe'));
  assert.equal(verifiedExtension(Buffer.from(PNG, 'base64'), '.jpg'), '.png');
  assert.equal(verifiedExtension(Buffer.from('echo hi'), '.bat'), null);
});

// ---- Form guard: field rules used for live validation and demo data ----
function loadFormGuard() {
  const vm = require('vm');
  const noop = () => {};
  const element = () => ({ addEventListener: noop, appendChild: noop, setAttribute: noop, classList: { add: noop, remove: noop }, style: {} });
  const sandbox = { console, URL, Event: class {}, HTMLElement: class {}, HTMLInputElement: class {}, HTMLTextAreaElement: class {}, HTMLSelectElement: class {}, Node: {}, getComputedStyle: () => ({}),
    document: { readyState: 'complete', addEventListener: noop, getElementById: () => null, createElement: element, querySelectorAll: () => [], body: element() } };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'form-guard.js'), 'utf8'), sandbox);
  return sandbox.TFFormGuard;
}
test('validation: GSTIN check digit, state code and PAN structure are verified', () => {
  const { checks, gstinCheckChar, makeIdentity } = loadFormGuard();
  assert.equal(checks.gstin('27AAPFU0939F1ZV').level, 'ok');
  assert.equal(checks.gstin('27AAPFU0939F1ZW').level, 'error', 'wrong check digit');
  assert.equal(checks.gstin('25AAPFU0939F1ZV').level, 'error', 'not a state code');
  assert.equal(checks.gstin('27AAPFU0939F1Z').level, 'error', 'too short');
  for (let i = 0; i < 200; i++) {
    const id = makeIdentity();
    assert.equal(checks.gstin(id.gstin).level, 'ok', id.gstin);
    assert.equal(id.gstin.slice(2, 12), id.pan);
    assert.equal(checks.pan(id.pan).level, 'ok', id.pan);
    assert.equal(checks.ifsc(id.ifsc).level, 'ok', id.ifsc);
    assert.equal(checks.pincode(id.pincode).level, 'ok', id.pincode);
    assert.equal(checks.phone(id.phone, {}).level, 'ok', id.phone);
    assert.equal(checks.account(id.account).level, 'ok', id.account);
  }
  assert.equal(gstinCheckChar('27AAPFU0939F1Z'), 'V');
});
test('validation: Indian formats and number rules reject bad input with a reason', () => {
  const { checks } = loadFormGuard();
  const bad = [['pan', 'ABCDE1234F'], ['ifsc', 'HDFC1234567'], ['pincode', '012345'], ['email', 'abc@'], ['upi', 'shop@'], ['fssai', '1234'], ['hsn', '12345'],
    ['stateCode', '25'], ['account', '12ab'], ['utr', 'SHORT'], ['vehicle', 'MH12'], ['percent', '150'], ['quantity', '2.5'], ['days', '-1']];
  for (const [rule, value] of bad) {
    const result = checks[rule](value, {});
    assert.equal(result.level, 'error', `${rule} should reject ${value}`);
    assert(result.msg.length > 10, `${rule} explains why`);
  }
  assert.equal(checks.phone('12345', {}).level, 'error');
  assert.equal(checks.phone('+91 98765 43210', {}).level, 'ok');
  assert.equal(checks.phone('011-28345678', { landline: true }).level, 'ok');
  assert.equal(checks.money('-5', {}).level, 'error');
  assert.equal(checks.money('1,25,000.50', {}).level, 'ok');
  assert.equal(checks.money('1000+250', { allowExpression: true }).level, 'warn');
  assert.equal(checks.gstRate('18').level, 'ok');
  assert.equal(checks.gstRate('17').level, 'warn');
  assert.equal(checks.text('<script>alert(1)</script>').level, 'error');
});
test('ai scan: Anthropic and Gemini requests no longer crash on undefined variables', async () => {
  for (const [provider, apiKey] of [['anthropic', 'sk-ant-test'], ['gemini', 'AIzaSyTest']]) {
    // An unreachable base URL makes the provider call fail fast; the route must answer, not throw a ReferenceError.
    const result = await post('/api/ai/test-scan', { provider, apiKey, baseUrl: 'http://127.0.0.1:9/v1/messages', rawText: 'Invoice INV-1 total 100', mimeType: 'text/plain' });
    assert(!/is not defined/.test(JSON.stringify(result.data)), provider + ': ' + JSON.stringify(result.data));
  }
});

// ---- Partner pages: one contact person by default, money per partner type ----
function loadPartnerUI() {
  const vm = require('vm');
  const sandbox = { console, document: { addEventListener: () => {} } };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js', 'partner-ui.js'), 'utf8'), sandbox);
  return sandbox.TFPartnerUI;
}
test('partners: older contacts read as one contact person, and the primary person drives the card', () => {
  const ui = loadPartnerUI();
  const legacy = { id: 'RET-9', role: 'retailer', name: 'Old Buyer', contactPerson: 'Asha', phone: '9876543210', email: 'a@x.in' };
  const people = ui.peopleOf(legacy);
  assert.equal(people.length, 1);
  assert.equal(people[0].name, 'Asha');
  assert.equal(ui.primaryOf(legacy).phone, '9876543210');
  const two = { ...legacy, people: [{ id: 'p1', name: 'Asha', phone: '1' }, { id: 'p2', name: 'Ravi', phone: '2' }], primaryPersonId: 'p2' };
  assert.equal(ui.primaryOf(two).name, 'Ravi');
});
test('partners: balances follow each partner type and only open orders count as current', () => {
  const ui = loadPartnerUI();
  const app = { data: { orders: [
    { id: 'A', retailerId: 'R', manufacturerId: 'M', status: 'in_transit', date: '2026-10-01', dueDate: '2000-01-01', totalInvoiceAmount: 1000, customerBalanceDue: 400, manufacturerTotalCost: 600, manufacturerAdvancePaid: 200 },
    { id: 'B', retailerId: 'R', manufacturerId: 'M', status: 'settled', date: '2026-09-01', totalInvoiceAmount: 500, customerBalanceDue: 0, manufacturerTotalCost: 300, manufacturerAdvancePaid: 300 }
  ], payments: [], contacts: [] }, paymentsPaidToContact: () => 0 };
  const buyer = ui.summary(app, { id: 'R', role: 'retailer' });
  assert.equal(buyer.big, 400);
  assert.equal(buyer.of, 1500);
  assert.equal(buyer.done, 1100);
  assert.equal(buyer.overdue, 400);
  assert.equal(buyer.openCount, 1);
  const factory = ui.summary(app, { id: 'M', role: 'manufacturer' });
  assert.equal(factory.big, 400);
  assert.equal(factory.done, 500);
  assert.equal(ui.sections({ role: 'transporter' }).find(s => s.id === 'terms').fields.some(f => f.key === 'vehicles'), true);
});
