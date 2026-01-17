// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const Database = require('better-sqlite3');
const QRCode = require('qrcode');
const exporter = require('./src/exporter');

const DEFAULT_PAGE = { widthPx: 1200, heightPx: 566 };
const DEFAULT_LAYOUT = {
  fields: [
    {
      key: 'RecipientName',
      label: 'Recipient Name',
      type: 'text',
      x: 55,
      y: 210,
      w: 520,
      h: 52,
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 26,
      fontWeight: '700',
      color: '#111111',
      align: 'left'
    },
    {
      key: 'Value',
      label: 'Voucher Value',
      type: 'text',
      x: 55,
      y: 265,
      w: 520,
      h: 46,
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: 22,
      fontWeight: '700',
      color: '#111111',
      align: 'left'
    },
    {
      key: 'IssueDate',
      label: 'Issue Date',
      type: 'text',
      x: 55,
      y: 322,
      w: 260,
      h: 36,
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: '600',
      color: '#222222',
      align: 'left'
    },
    {
      key: 'Validity',
      label: 'Valid Until',
      type: 'text',
      x: 55,
      y: 360,
      w: 260,
      h: 36,
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: '600',
      color: '#222222',
      align: 'left'
    },
    { key: 'InstagramLink', label: 'Instagram Link', type: 'qr', x: 690, y: 370, w: 130, h: 130 },
    { key: 'FacebookLink', label: 'Facebook Link', type: 'qr', x: 840, y: 370, w: 130, h: 130 },
    { key: 'Logo', label: 'Logo', type: 'image', x: 930, y: 70, w: 190, h: 120 }
  ]
};

const resolveTemplatesRoot = exporter.resolveTemplatesRoot;
const templatesDir = resolveTemplatesRoot();
const templateCache = new Map();
const templateMetaCache = new Map();
const layoutCache = new Map();

let db;
let dbPath;

const settingsFilePath = () => path.join(app.getPath('userData'), 'settings.json');

async function readSettings() {
  const file = settingsFilePath();
  if (!fs.existsSync(file)) return {};
  try {
    const content = await fsp.readFile(file, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function writeSettings(data) {
  const file = settingsFilePath();
  const tmp = `${file}.tmp`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(data || {}, null, 2), 'utf-8');
  await fsp.rename(tmp, file);
}

function vouchersRoot() {
  return path.join(app.getPath('userData'), 'vouchers');
}

function vouchersFilePath() {
  return path.join(vouchersRoot(), 'vouchers.json');
}

function vouchersAssetsRoot() {
  return path.join(vouchersRoot(), 'assets');
}

function sanitizeTemplateId(id) {
  return String(id || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function ensureTemplatesRoot() {
  fs.mkdirSync(templatesDir, { recursive: true });
}

function numberFromPage(value) {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) return null;
    if (value.includes('mm')) {
      return Math.round(parsed * 3.7795275591);
    }
    return parsed;
  }
  return null;
}

function normalizePage(page) {
  const width = numberFromPage(page?.widthPx ?? page?.width);
  const height = numberFromPage(page?.heightPx ?? page?.height);
  if (width && height) return { widthPx: width, heightPx: height };
  return { ...DEFAULT_PAGE };
}

function templatePaths(templateId) {
  const base = path.join(templatesDir, templateId);
  return {
    base,
    meta: path.join(base, 'template.json'),
    layout: path.join(base, 'layout.json'),
    assets: path.join(base, 'assets')
  };
}

function resolveAssetUrl(templateId, relativePath) {
  if (!relativePath) return null;
  const full = path.join(templatesDir, templateId, relativePath);
  if (!fs.existsSync(full)) return null;
  return pathToFileURL(full).toString();
}

function getTemplateIds() {
  ensureTemplatesRoot();
  return fs
    .readdirSync(templatesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name);
}

function readTemplateMeta(templateId) {
  if (templateMetaCache.has(templateId)) return templateMetaCache.get(templateId);
  const paths = templatePaths(templateId);
  let meta = {};
  if (fs.existsSync(paths.meta)) {
    try {
      meta = JSON.parse(fs.readFileSync(paths.meta, 'utf-8'));
    } catch {
      meta = {};
    }
  }

  const normalized = {
    id: meta.id || templateId,
    name: meta.name || templateId,
    description: meta.description || '',
    page: normalizePage(meta.page),
    background: meta.background || '',
    backgroundFit: meta.backgroundFit || 'cover',
    logo: meta.logo || ''
  };
  const withUrls = {
    ...normalized,
    backgroundUrl: resolveAssetUrl(templateId, normalized.background),
    logoUrl: resolveAssetUrl(templateId, normalized.logo)
  };
  templateMetaCache.set(templateId, withUrls);
  return withUrls;
}

async function readTemplateLayout(templateId) {
  if (layoutCache.has(templateId)) return layoutCache.get(templateId);
  const paths = templatePaths(templateId);
  let layout = null;
  if (fs.existsSync(paths.layout)) {
    try {
      layout = JSON.parse(await fsp.readFile(paths.layout, 'utf-8'));
    } catch {
      layout = null;
    }
  }
  if (!layout || !Array.isArray(layout.fields)) {
    layout = { fields: [] };
  }
  layoutCache.set(templateId, layout);
  return layout;
}

async function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fsp.rename(tmp, filePath);
}

async function saveTemplateMeta(templateId, meta) {
  const id = sanitizeTemplateId(templateId);
  if (!id) throw new Error('Invalid template id');
  const paths = templatePaths(id);
  const existing = fs.existsSync(paths.meta) ? JSON.parse(await fsp.readFile(paths.meta, 'utf-8')) : {};
  const merged = { ...existing, ...meta, id, page: normalizePage(meta.page || existing.page) };
  await writeJsonAtomic(paths.meta, merged);
  templateMetaCache.delete(id);
  templateCache.delete(id);
  exporter.clearTemplateCache(id, resolveTemplatesRoot());
  return readTemplateMeta(id);
}

async function saveTemplateLayout(templateId, layout) {
  const id = sanitizeTemplateId(templateId);
  if (!id) throw new Error('Invalid template id');
  const paths = templatePaths(id);
  await writeJsonAtomic(paths.layout, layout || { fields: [] });
  layoutCache.set(id, layout || { fields: [] });
  templateCache.delete(id);
  exporter.clearTemplateCache(id, resolveTemplatesRoot());
}

async function saveTemplateAll(templateId, meta, layout) {
  const savedMeta = await saveTemplateMeta(templateId, meta || {});
  await saveTemplateLayout(templateId, layout || { fields: [] });
  return savedMeta;
}

async function createTemplateScaffold(metaInput) {
  const id = sanitizeTemplateId(metaInput?.id) || `template-${Date.now()}`;
  const name = metaInput?.name || id;
  const paths = templatePaths(id);
  await fsp.mkdir(paths.assets, { recursive: true });
  const templateJson = {
    id,
    name,
    page: { ...DEFAULT_PAGE },
    background: '',
    backgroundFit: 'cover',
    logo: ''
  };
  await writeJsonAtomic(paths.meta, templateJson);
  await saveTemplateLayout(id, JSON.parse(JSON.stringify(DEFAULT_LAYOUT)));
  templateCache.delete(id);
  templateMetaCache.delete(id);
  layoutCache.delete(id);
  exporter.clearTemplateCache(id, resolveTemplatesRoot());
  return { id, name };
}

async function duplicateTemplate(sourceId, targetId, targetName) {
  const src = sanitizeTemplateId(sourceId);
  const dest = sanitizeTemplateId(targetId);
  if (!src || !dest) throw new Error('Invalid template id');
  const srcPaths = templatePaths(src);
  const destPaths = templatePaths(dest);
  if (!fs.existsSync(srcPaths.base)) throw new Error('Source template not found');
  if (fs.existsSync(destPaths.base)) throw new Error('Target template already exists');

  await fsp.cp(srcPaths.base, destPaths.base, { recursive: true });
  const meta = readTemplateMeta(src);
  const layout = await readTemplateLayout(src);
  const updatedMeta = { ...meta, id: dest, name: targetName || `${meta.name} Copy` };
  await saveTemplateMeta(dest, updatedMeta);
  await saveTemplateLayout(dest, layout || { fields: [] });
  return { id: dest, name: updatedMeta.name };
}

async function listTemplatesMinimal() {
  const ids = getTemplateIds();
  return ids.map((id) => {
    const meta = readTemplateMeta(id);
    return { id, name: meta.name || id };
  });
}

function getTemplatesDetailed() {
  return getTemplateIds().map((id) => readTemplateMeta(id));
}

async function getTemplatePayload(templateId) {
  const meta = readTemplateMeta(templateId);
  const layout = await readTemplateLayout(templateId);
  return { meta, layout };
}

function normalizeCode(code) {
  return (code || '').trim().toLowerCase();
}

function readVoucherState() {
  const file = vouchersFilePath();
  if (!fs.existsSync(file)) {
    return { version: 1, items: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!parsed.items || !Array.isArray(parsed.items)) return { version: 1, items: [] };
    return parsed;
  } catch {
    return { version: 1, items: [] };
  }
}

async function writeVoucherState(state) {
  const root = vouchersRoot();
  await fsp.mkdir(root, { recursive: true });
  const file = vouchersFilePath();
  const tmp = `${file}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8');
  await fsp.rename(tmp, file);
}

function generateVoucherId() {
  return `V-${Date.now()}`;
}

function newVoucherCode() {
  return `VC-${Date.now()}`;
}

function filterVouchers(items, searchText) {
  if (!searchText) return items;
  const needle = searchText.toLowerCase();
  return items.filter((item) => {
    if (item.id?.toLowerCase().includes(needle)) return true;
    if (item.templateId?.toLowerCase().includes(needle)) return true;
    if (item.data) {
      return Object.values(item.data).some((val) => String(val || '').toLowerCase().includes(needle));
    }
    return false;
  });
}

async function listVouchersFile(limit = 30, searchText = '') {
  const state = readVoucherState();
  const filtered = filterVouchers(state.items || [], searchText);
  return filtered.slice(0, limit);
}

async function getVoucherFile(id) {
  const state = readVoucherState();
  return (state.items || []).find((item) => item.id === id) || null;
}

async function saveVoucherFile(voucher) {
  const state = readVoucherState();
  const now = new Date().toISOString();
  const id = voucher.id || generateVoucherId();
  const existingIndex = (state.items || []).findIndex((item) => item.id === id);
  const base = {
    id,
    templateId: voucher.templateId || (state.items?.[0]?.templateId || ''),
    createdAt: voucher.createdAt || now,
    updatedAt: now,
    data: voucher.data || {},
    images: voucher.images || {}
  };
  if (existingIndex >= 0) {
    state.items[existingIndex] = { ...state.items[existingIndex], ...base, updatedAt: now };
  } else {
    state.items.unshift(base);
  }
  await writeVoucherState(state);
  return base;
}

async function deleteVoucherFile(id) {
  const state = readVoucherState();
  const remaining = (state.items || []).filter((item) => item.id !== id);
  if (remaining.length === state.items.length) return false;
  state.items = remaining;
  await writeVoucherState(state);
  const targetAssets = path.join(vouchersAssetsRoot(), id);
  if (fs.existsSync(targetAssets)) {
    await fsp.rm(targetAssets, { recursive: true, force: true });
  }
  return true;
}

async function duplicateVoucherFile(id) {
  const original = await getVoucherFile(id);
  if (!original) throw new Error('Voucher not found');
  const newId = generateVoucherId();
  const newCode = newVoucherCode();
  const newImages = {};
  const srcDir = path.join(vouchersAssetsRoot(), id);
  const destDir = path.join(vouchersAssetsRoot(), newId);
  if (fs.existsSync(srcDir)) {
    await fsp.mkdir(destDir, { recursive: true });
    const files = await fsp.readdir(srcDir);
    for (const file of files) {
      const srcFile = path.join(srcDir, file);
      const destFile = path.join(destDir, file);
      await fsp.copyFile(srcFile, destFile);
    }
    Object.entries(original.images || {}).forEach(([key, rel]) => {
      const fileName = path.basename(rel || '');
      newImages[key] = `assets/${newId}/${fileName}`;
    });
  }
  const newVoucher = {
    ...original,
    id: newId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data: { ...original.data, VoucherCode: original.data?.VoucherCode ? `${original.data.VoucherCode}-copy` : newCode },
    images: newImages
  };
  await saveVoucherFile(newVoucher);
  return newVoucher;
}

async function pickVoucherImage(voucherId, imageKey) {
  const id = voucherId || generateVoucherId();
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Select image',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths?.length) {
    return { canceled: true };
  }
  const src = result.filePaths[0];
  const ext = path.extname(src) || '.png';
  const destDir = path.join(vouchersAssetsRoot(), id);
  await fsp.mkdir(destDir, { recursive: true });
  const dest = path.join(destDir, `${imageKey || 'image'}${ext}`);
  const tmp = `${dest}.tmp`;
  await fsp.copyFile(src, tmp);
  await fsp.rename(tmp, dest);
  const rel = `assets/${id}/${path.basename(dest)}`;
  const dataUrl = await fileToDataUrl(rel);
  return { ok: true, id, imageKey, path: rel, dataUrl };
}

async function clearVoucherImage(voucherId, imageKey) {
  const voucher = await getVoucherFile(voucherId);
  if (voucher) {
    const existingPath = voucher.images?.[imageKey];
    if (existingPath) {
      const full = path.join(vouchersRoot(), existingPath);
      if (fs.existsSync(full)) {
        await fsp.rm(full, { force: true });
      }
    }
    const updatedImages = { ...(voucher.images || {}) };
    delete updatedImages[imageKey];
    const updated = await saveVoucherFile({ ...voucher, images: updatedImages });
    return { ok: true, voucher: updated };
  }
  return { ok: true };
}

async function resolveImageDataMap(images) {
  return exporter.resolveImageDataMap(images, vouchersRoot());
}

async function fileToDataUrl(relPath) {
  return exporter.fileToDataUrl(relPath, vouchersRoot());
}

function generateCode() {
  return crypto.randomBytes(6).toString('hex');
}

function codeExists(dbInstance, code) {
  if (!code) return false;
  const stmt = dbInstance.prepare('SELECT id FROM vouchers WHERE code = ? LIMIT 1');
  const row = stmt.get(code);
  return Boolean(row);
}

function generateUniqueCode(dbInstance = getDb()) {
  let code;
  do {
    code = generateCode();
  } while (codeExists(dbInstance, code));
  return code;
}

async function exportVoucher(format, payload) {
  return exporter.exportVoucher(format, payload, {
    templatesRoot: resolveTemplatesRoot(),
    vouchersRoot: vouchersRoot()
  });
}

function getDb() {
  if (db) return db;
  const userDataDir = app.getPath('userData');
  dbPath = path.join(userDataDir, 'vouchers.db');
  fs.mkdirSync(userDataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  ensureSchema(db);
  return db;
}

function ensureSchema(dbInstance) {
  dbInstance.prepare(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      expires TEXT,
      note TEXT,
      templateId TEXT,
      createdAt TEXT NOT NULL,
      code TEXT UNIQUE,
      redeemedAt TEXT
    )
  `).run();

  const columns = new Set(
    dbInstance
      .prepare('PRAGMA table_info(vouchers)')
      .all()
      .map((c) => c.name)
  );
  if (!columns.has('code')) {
    dbInstance.prepare('ALTER TABLE vouchers ADD COLUMN code TEXT').run();
  }
  if (!columns.has('redeemedAt')) {
    dbInstance.prepare('ALTER TABLE vouchers ADD COLUMN redeemedAt TEXT').run();
  }

  const indexes = dbInstance.prepare('PRAGMA index_list(vouchers)').all();
  if (!indexes.some((idx) => idx.name === 'idx_vouchers_code')) {
    dbInstance.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code)').run();
  }

  const needsCode = dbInstance
    .prepare("SELECT id FROM vouchers WHERE code IS NULL OR code = ''")
    .all();
  const update = dbInstance.prepare('UPDATE vouchers SET code = ? WHERE id = ?');
  needsCode.forEach((row) => {
    update.run(generateUniqueCode(dbInstance), row.id);
  });
}

function saveVoucher(data, templateId) {
  const dbInstance = getDb();
  const now = new Date().toISOString();
  const codeToUse = normalizeCode(data.code) || generateUniqueCode(dbInstance);
  const stmt = dbInstance.prepare(
    'INSERT INTO vouchers (name, value, expires, note, templateId, createdAt, code) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(
    data.userName,
    data.value,
    data.expiration || null,
    data.note || null,
    templateId || null,
    now,
    codeToUse
  );
  return { id: info.lastInsertRowid, code: codeToUse };
}

function listVouchers(limit = 20) {
  const dbInstance = getDb();
  const stmt = dbInstance.prepare(
    'SELECT id, name, value, expires, note, templateId, createdAt, code, redeemedAt FROM vouchers ORDER BY createdAt DESC LIMIT ?'
  );
  return stmt.all(limit);
}

function getVoucherById(id) {
  const dbInstance = getDb();
  const stmt = dbInstance.prepare(
    'SELECT id, name, value, expires, note, templateId, createdAt, code, redeemedAt FROM vouchers WHERE id = ?'
  );
  return stmt.get(id);
}

function getVoucherByCode(code) {
  const dbInstance = getDb();
  const stmt = dbInstance.prepare(
    'SELECT id, name, value, expires, note, templateId, createdAt, code, redeemedAt FROM vouchers WHERE code = ?'
  );
  return stmt.get(normalizeCode(code));
}

function voucherStatus(voucher) {
  if (!voucher) return 'not_found';
  if (voucher.redeemedAt) return 'redeemed';
  if (voucher.expires) {
    const expiresDate = new Date(voucher.expires);
    if (!Number.isNaN(expiresDate.valueOf()) && expiresDate < new Date()) {
      return 'expired';
    }
  }
  return 'valid';
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 720,
    title: 'Voucher Maker',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('get-templates', () => getTemplateIds());

ipcMain.handle('get-templates-detailed', () => getTemplatesDetailed());

ipcMain.handle('get-template', async (_event, templateId) => getTemplatePayload(templateId));

ipcMain.handle('get-layout', async (_event, templateId) => readTemplateLayout(templateId));

ipcMain.handle('save-layout', async (_event, payload) => {
  const { templateId, layout } = payload || {};
  if (!templateId || !layout) return { ok: false, error: 'Missing data' };
  try {
    await saveTemplateLayout(templateId, layout);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tpl:list', async () => {
  try {
    return await listTemplatesMinimal();
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('tpl:readMeta', async (_event, id) => {
  try {
    const meta = readTemplateMeta(id);
    return meta || null;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('tpl:readLayout', async (_event, id) => {
  try {
    return await readTemplateLayout(id);
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('tpl:saveLayout', async (_event, id, layout) => {
  try {
    await saveTemplateLayout(id, layout);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tpl:create', async (_event, meta) => {
  try {
    return await createTemplateScaffold(meta || {});
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tpl:duplicate', async (_event, sourceId, newId, newName) => {
  try {
    const created = await duplicateTemplate(sourceId, newId, newName);
    return { ok: true, ...created };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tpl:saveMeta', async (_event, templateId, meta) => {
  try {
    const updated = await saveTemplateMeta(templateId, meta || {});
    return { ok: true, meta: updated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tpl:saveAll', async (_event, templateId, meta, layout) => {
  try {
    const updated = await saveTemplateAll(templateId, meta || {}, layout || { fields: [] });
    return { ok: true, meta: updated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tpl:setBackground', async (_event, templateId) => {
  try {
    const id = sanitizeTemplateId(templateId);
    if (!id) return { ok: false, error: 'Missing template id' };
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'Select background image',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths?.length) {
      return { ok: false, canceled: true };
    }
    const src = result.filePaths[0];
    const paths = templatePaths(id);
    await fsp.mkdir(paths.assets, { recursive: true });
    const dest = path.join(paths.assets, 'bg.png');
    const tmp = `${dest}.tmp`;
    await fsp.copyFile(src, tmp);
    await fsp.rename(tmp, dest);
    const updated = await saveTemplateMeta(id, { background: 'assets/bg.png', backgroundFit: 'cover' });
    return { ok: true, meta: updated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('tpl:setLogo', async (_event, templateId) => {
  try {
    const id = sanitizeTemplateId(templateId);
    if (!id) return { ok: false, error: 'Missing template id' };
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      title: 'Select logo image',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    if (result.canceled || !result.filePaths?.length) {
      return { ok: false, canceled: true };
    }
    const src = result.filePaths[0];
    const paths = templatePaths(id);
    await fsp.mkdir(paths.assets, { recursive: true });
    const dest = path.join(paths.assets, 'logo.png');
    const tmp = `${dest}.tmp`;
    await fsp.copyFile(src, tmp);
    await fsp.rename(tmp, dest);
    const updated = await saveTemplateMeta(id, { logo: 'assets/logo.png' });
    return { ok: true, meta: updated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

async function addStickerAsset(templateId) {
  const id = sanitizeTemplateId(templateId);
  if (!id) throw new Error('Missing template id');
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Select sticker image',
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePaths?.length) {
    return { ok: false, canceled: true };
  }
  const src = result.filePaths[0];
  const paths = templatePaths(id);
  const stickersDir = path.join(paths.assets, 'stickers');
  await fsp.mkdir(stickersDir, { recursive: true });
  const ext = path.extname(src) || '.png';
  const dest = path.join(stickersDir, `sticker-${Date.now()}${ext}`);
  const tmp = `${dest}.tmp`;
  await fsp.copyFile(src, tmp);
  await fsp.rename(tmp, dest);
  const rel = path.relative(paths.base, dest).replace(/\\/g, '/');
  return { ok: true, path: rel };
}

ipcMain.handle('tpl:addSticker', async (_event, templateId) => {
  try {
    return await addStickerAsset(templateId);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:list', async (_event, limit = 30, searchText = '') => {
  try {
    const items = await listVouchersFile(limit || 30, searchText || '');
    return { ok: true, items };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:get', async (_event, id) => {
  try {
    const item = await getVoucherFile(id);
    if (!item) return { ok: false, error: 'Not found' };
    const imagesData = await resolveImageDataMap(item.images || {});
    return { ok: true, item, imagesData };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:save', async (_event, voucher) => {
  try {
    const saved = await saveVoucherFile(voucher || {});
    const imagesData = await resolveImageDataMap(saved.images || {});
    return { ok: true, item: saved, imagesData };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:delete', async (_event, id) => {
  try {
    const ok = await deleteVoucherFile(id);
    return ok ? { ok: true } : { ok: false, error: 'Not found' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:duplicate', async (_event, id) => {
  try {
    const item = await duplicateVoucherFile(id);
    const imagesData = await resolveImageDataMap(item.images || {});
    return { ok: true, item, imagesData };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:pickImage', async (_event, voucherId, imageKey) => {
  try {
    const res = await pickVoucherImage(voucherId, imageKey);
    if (res.canceled) return { ok: false, canceled: true };
    const existing = await getVoucherFile(res.id);
    if (existing) {
      const images = { ...(existing.images || {}), [imageKey]: res.path };
      const updated = await saveVoucherFile({ ...existing, images });
      const imagesData = await resolveImageDataMap(updated.images || {});
      return { ok: true, path: res.path, voucher: updated, imagesData };
    }
    return { ok: true, path: res.path, id: res.id, imageKey: res.imageKey, dataUrl: res.dataUrl };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:clearImage', async (_event, voucherId, imageKey) => {
  try {
    return await clearVoucherImage(voucherId, imageKey);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('export-pdf', async (_event, payload) => exportVoucher('pdf', payload));

ipcMain.handle('export-png', async (_event, payload) => exportVoucher('png', payload));

ipcMain.handle('save-voucher', (_event, payload) => {
  const { data, templateId } = payload || {};
  if (!data) return { ok: false, error: 'Missing data' };
  try {
    const result = saveVoucher(data, templateId);
    return { ok: true, id: result.id, code: result.code };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('list-vouchers', (_event, limit = 20) => {
  try {
    const rows = listVouchers(limit || 20);
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-voucher', (_event, id) => {
  try {
    const row = getVoucherById(id);
    return { ok: true, row };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('generate-code', () => generateUniqueCode());

ipcMain.handle('get-qr', async (_event, code) => {
  try {
    const qr = await QRCode.toDataURL(code, { margin: 1, scale: 6 });
    return { ok: true, qr };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('validate-code', (_event, code) => {
  if (!code) return { ok: true, status: 'not_found' };
  const voucher = getVoucherByCode(normalizeCode(code));
  const status = voucherStatus(voucher);
  return { ok: true, status, voucher };
});

ipcMain.handle('redeem-voucher', (_event, id) => {
  const dbInstance = getDb();
  const stmt = dbInstance.prepare('UPDATE vouchers SET redeemedAt = ? WHERE id = ?');
  try {
    const now = new Date().toISOString();
    const info = stmt.run(now, id);
    if (info.changes === 0) return { ok: false, error: 'Voucher not found' };
    const row = getVoucherById(id);
    return { ok: true, row };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('settings:get', async () => {
  try {
    const settings = await readSettings();
    return { ok: true, settings };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('settings:set', async (_event, payload) => {
  try {
    const current = await readSettings();
    const merged = { ...(current || {}), ...(payload || {}) };
    await writeSettings(merged);
    return { ok: true, settings: merged };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('app:getVersion', () => {
  try {
    return { ok: true, version: app.getVersion() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

app.whenReady().then(() => {
  getTemplateIds();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
