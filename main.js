// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const os = require('os');
const QRCode = require('qrcode');
const exporter = require('./src/exporter');
const { computeAvailableSlots } = require('./src/domain/availability');

let Database;
function loadDbLib() {
  if (Database !== undefined) return Database;
  try {
    // Lazy-load to avoid crashing when native module is not rebuilt
    Database = require('better-sqlite3');
  } catch (err) {
    console.error('better-sqlite3 failed to load. Validation DB features disabled.', err);
    Database = null;
  }
  return Database;
}

const DEFAULT_PAGE = { widthPx: 794, heightPx: 1123 };
const DEFAULT_LAYOUT = {
  fields: [
    {
      key: 'RecipientName',
      label: 'Recipient Name',
      type: 'text',
      x: 40,
      y: 180,
      w: 500,
      h: 52,
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 26,
      fontWeight: '700',
      color: '#111111',
      align: 'center'
    },
    {
      key: 'Value',
      label: 'Voucher Value',
      type: 'text',
      x: 40,
      y: 240,
      w: 500,
      h: 46,
      fontFamily: 'Montserrat, Arial, sans-serif',
      fontSize: 22,
      fontWeight: '700',
      color: '#111111',
      align: 'center'
    },
    {
      key: 'IssueDate',
      label: 'Issue Date',
      type: 'text',
      x: 40,
      y: 300,
      w: 260,
      h: 36,
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: '600',
      color: '#222222',
      align: 'center'
    },
    {
      key: 'Validity',
      label: 'Valid Until',
      type: 'text',
      x: 40,
      y: 340,
      w: 260,
      h: 36,
      fontFamily: 'Arial, sans-serif',
      fontSize: 18,
      fontWeight: '600',
      color: '#222222',
      align: 'center'
    },
    { key: 'InstagramLink', label: 'Instagram Link', type: 'qr', x: 520, y: 300, w: 120, h: 120 },
    { key: 'FacebookLink', label: 'Facebook Link', type: 'qr', x: 650, y: 300, w: 120, h: 120 },
    { key: 'Logo', label: 'Logo', type: 'image', x: 560, y: 70, w: 160, h: 110 }
  ]
};

function resolveTemplatesRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'templates');
  }
  return path.join(__dirname, 'templates');
}

const templatesDir = resolveTemplatesRoot();
const templateCache = new Map();
const templateMetaCache = new Map();
const layoutCache = new Map();
const HIDDEN_TEMPLATES = new Set(['classic', 'minimal']);
const VALUE_TABLE = 'value_options';
const LOCAL_ORG_ID = 'local';
const SYNC_STATE_ID = 'local';

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

function reposFallbackFilePath() {
  return path.join(app.getPath('userData'), 'repos-fallback.json');
}

function normalizeReposFallbackState(state) {
  const syncState =
    state?.syncState && typeof state.syncState === 'object' && !Array.isArray(state.syncState)
      ? state.syncState
      : {};
  return {
    version: 1,
    services: Array.isArray(state?.services) ? state.services : [],
    resources: Array.isArray(state?.resources) ? state.resources : [],
    customers: Array.isArray(state?.customers) ? state.customers : [],
    bookings: Array.isArray(state?.bookings) ? state.bookings : [],
    voucherRedemptions: Array.isArray(state?.voucherRedemptions) ? state.voucherRedemptions : [],
    syncOutbox: Array.isArray(state?.syncOutbox) ? state.syncOutbox : [],
    syncState: {
      id: String(syncState.id || SYNC_STATE_ID).trim() || SYNC_STATE_ID,
      lastPullToken: String(syncState.lastPullToken || '').trim(),
      updatedAt: String(syncState.updatedAt || '').trim()
    },
    availabilityRules: Array.isArray(state?.availabilityRules) ? state.availabilityRules : [],
    availabilityExceptions: Array.isArray(state?.availabilityExceptions) ? state.availabilityExceptions : [],
    resourceServices:
      state?.resourceServices && typeof state.resourceServices === 'object' && !Array.isArray(state.resourceServices)
        ? state.resourceServices
        : {}
  };
}

function readReposFallbackState() {
  const file = reposFallbackFilePath();
  if (!fs.existsSync(file)) return normalizeReposFallbackState({});
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return normalizeReposFallbackState(raw);
  } catch {
    return normalizeReposFallbackState({});
  }
}

function writeReposFallbackState(state) {
  const file = reposFallbackFilePath();
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(normalizeReposFallbackState(state), null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function normalizeOrgId() {
  return LOCAL_ORG_ID;
}

function normalizeLimit(limit, fallback = 200) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 1000);
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function normalizePositiveInteger(value, fallback = 1) {
  const parsed = normalizeInteger(value, fallback);
  if (parsed <= 0) return fallback;
  return parsed;
}

function normalizeFlag(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback ? 1 : 0;
  if (typeof value === 'string') {
    const low = value.trim().toLowerCase();
    if (low === '0' || low === 'false' || low === 'no') return 0;
    if (low === '1' || low === 'true' || low === 'yes') return 1;
  }
  if (typeof value === 'number') return value === 0 ? 0 : 1;
  return value ? 1 : 0;
}

function normalizeId(value) {
  return String(value || '').trim();
}

function normalizeText(value, fallback = '') {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function normalizeSearchText(searchText) {
  return String(searchText || '').trim().toLowerCase();
}

function normalizeDeletedAt(value, fallback = null) {
  if (value === undefined) return fallback;
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeWeekday(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0 || parsed > 6) return fallback;
  return parsed;
}

function normalizeTimeText(value, fallback = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalized);
  if (!match) return fallback;
  return `${match[1]}:${match[2]}`;
}

function normalizeDateText(value, fallback = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return fallback;
  return normalized;
}

function normalizeDateFromAny(value, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text) return fallback;
  const direct = normalizeDateText(text, '');
  if (direct) return direct;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

function normalizeIsoDateTime(value, fallback = '') {
  if (value === undefined || value === null || value === '') return fallback;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString();
  const parsed = new Date(String(value).trim());
  if (Number.isNaN(parsed.valueOf())) return fallback;
  return parsed.toISOString();
}

function normalizeOptionalText(value, fallback = null) {
  if (value === undefined) return fallback;
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeBookingStatus(value, fallback = 'confirmed') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || fallback;
}

function normalizeBookingSource(value, fallback = 'desktop') {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || fallback;
}

function normalizeDateRangeInput(range) {
  if (!range) return { from: '', to: '' };
  if (Array.isArray(range)) {
    return {
      from: normalizeIsoDateTime(range[0], ''),
      to: normalizeIsoDateTime(range[1], '')
    };
  }
  if (typeof range === 'object') {
    return {
      from: normalizeIsoDateTime(range.from ?? range.start ?? range.startAt, ''),
      to: normalizeIsoDateTime(range.to ?? range.end ?? range.endAt, '')
    };
  }
  const single = normalizeIsoDateTime(range, '');
  return { from: single, to: single };
}

function addDaysToDateText(dateText, days) {
  const normalized = normalizeDateText(dateText, '');
  if (!normalized) return '';
  const [yearText, monthText, dayText] = normalized.split('-');
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)));
  if (Number.isNaN(date.valueOf())) return '';
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function uniqueIds(values) {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const id = normalizeId(value);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function toSyncPayloadJson(payload) {
  try {
    return JSON.stringify(payload || {});
  } catch {
    return '{}';
  }
}

function parseSyncPayloadJson(payloadJson) {
  if (!payloadJson || typeof payloadJson !== 'string') return {};
  try {
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function ensureSyncStateRowDb(dbInstance, updatedAt = '') {
  if (!dbInstance) return null;
  const stamp = normalizeText(updatedAt, new Date().toISOString());
  dbInstance
    .prepare(
      `INSERT INTO sync_state (id, lastPullToken, updatedAt)
       VALUES (?, '', ?)
       ON CONFLICT(id) DO NOTHING`
    )
    .run(SYNC_STATE_ID, stamp);
  return (
    dbInstance
      .prepare(
        `SELECT id, lastPullToken, updatedAt
         FROM sync_state
         WHERE id = ?
         LIMIT 1`
      )
      .get(SYNC_STATE_ID) || null
  );
}

function touchSyncStateDb(dbInstance, updatedAt = '') {
  if (!dbInstance) return;
  const stamp = normalizeText(updatedAt, new Date().toISOString());
  ensureSyncStateRowDb(dbInstance, stamp);
  dbInstance
    .prepare(
      `UPDATE sync_state
       SET updatedAt = ?
       WHERE id = ?`
    )
    .run(stamp, SYNC_STATE_ID);
}

function appendSyncOutboxRecord(entityType, entityId, op = 'upsert', payload = {}, dbInstanceOverride) {
  const type = normalizeText(entityType, '');
  const id = normalizeId(entityId);
  if (!type || !id) return null;

  const normalizedOp = String(op || '').trim().toLowerCase() === 'delete' ? 'delete' : 'upsert';
  const createdAt = new Date().toISOString();
  const row = {
    id: generateUuid(),
    entityType: type,
    entityId: id,
    op: normalizedOp,
    payloadJson: toSyncPayloadJson(payload),
    createdAt,
    sentAt: null,
    ackAt: null,
    error: null
  };

  const dbInstance = dbInstanceOverride === undefined ? getDb() : dbInstanceOverride;
  if (dbInstance) {
    dbInstance
      .prepare(
        `INSERT INTO sync_outbox (id, entityType, entityId, op, payloadJson, createdAt, sentAt, ackAt, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.id,
        row.entityType,
        row.entityId,
        row.op,
        row.payloadJson,
        row.createdAt,
        row.sentAt,
        row.ackAt,
        row.error
      );
    touchSyncStateDb(dbInstance, createdAt);
    return row;
  }

  const state = readReposFallbackState();
  state.syncOutbox.unshift(row);
  state.syncState = {
    id: SYNC_STATE_ID,
    lastPullToken: normalizeText(state?.syncState?.lastPullToken, ''),
    updatedAt: createdAt
  };
  writeReposFallbackState(state);
  return row;
}

function toServiceSyncPayload(service) {
  return {
    id: normalizeId(service?.id),
    name: normalizeText(service?.name, ''),
    durationMin: normalizePositiveInteger(service?.durationMin, 30),
    priceCents: normalizeInteger(service?.priceCents, 0),
    currency: normalizeText(service?.currency, 'EUR'),
    isActive: normalizeFlag(service?.isActive, 1),
    updatedAt: normalizeText(service?.updatedAt, ''),
    deletedAt: normalizeDeletedAt(service?.deletedAt, null)
  };
}

function toResourceSyncPayload(resource) {
  return {
    id: normalizeId(resource?.id),
    name: normalizeText(resource?.name, ''),
    type: normalizeText(resource?.type, 'employee'),
    isActive: normalizeFlag(resource?.isActive, 1),
    updatedAt: normalizeText(resource?.updatedAt, ''),
    deletedAt: normalizeDeletedAt(resource?.deletedAt, null)
  };
}

function toCustomerSyncPayload(customer) {
  return {
    id: normalizeId(customer?.id),
    name: normalizeText(customer?.name, ''),
    phone: normalizeOptionalText(customer?.phone, null),
    email: normalizeOptionalText(customer?.email, null),
    updatedAt: normalizeText(customer?.updatedAt, ''),
    deletedAt: normalizeDeletedAt(customer?.deletedAt, null)
  };
}

function toBookingSyncPayload(booking) {
  return {
    id: normalizeId(booking?.id),
    serviceId: normalizeId(booking?.serviceId),
    resourceId: normalizeId(booking?.resourceId),
    customerId: normalizeId(booking?.customerId),
    startAt: normalizeIsoDateTime(booking?.startAt, ''),
    endAt: normalizeIsoDateTime(booking?.endAt, ''),
    status: normalizeBookingStatus(booking?.status, 'confirmed'),
    voucherId: normalizeOptionalText(booking?.voucherId, null),
    voucherCode: normalizeOptionalText(booking?.voucherCode, null),
    updatedAt: normalizeText(booking?.updatedAt, ''),
    deletedAt: normalizeDeletedAt(booking?.deletedAt, null)
  };
}

function toVoucherSyncPayload(voucher) {
  const code = normalizeText(voucher?.data?.VoucherCode || voucher?.data?.Code || voucher?.code, '');
  return {
    id: normalizeId(voucher?.id),
    templateId: normalizeText(voucher?.templateId, ''),
    code,
    updatedAt: normalizeText(voucher?.updatedAt, ''),
    redeemedAt: normalizeDeletedAt(voucher?.redeemedAt, null)
  };
}

function sanitizeTemplateId(id) {
  return String(id || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function ensureTemplatesRoot() {
  if (!app.isPackaged) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
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
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !HIDDEN_TEMPLATES.has(entry.name))
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

function writeVoucherStateSync(state) {
  const root = vouchersRoot();
  fs.mkdirSync(root, { recursive: true });
  const file = vouchersFilePath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function generateVoucherId() {
  return `V-${Date.now()}`;
}

function generateUuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function newVoucherCode() {
  // 6-digit numeric-only serial
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeNumericCode(code) {
  const digits = String(code || '').replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  if (digits.length > 0) return digits.padStart(6, '0');
  return newVoucherCode();
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
  const code = normalizeNumericCode(voucher.data?.VoucherCode || voucher.data?.Code);
  const base = {
    id,
    templateId: voucher.templateId || (state.items?.[0]?.templateId || ''),
    createdAt: voucher.createdAt || now,
    updatedAt: now,
    data: { ...(voucher.data || {}), VoucherCode: code, Code: code },
    images: voucher.images || {}
  };
  if (existingIndex >= 0) {
    state.items[existingIndex] = { ...state.items[existingIndex], ...base, updatedAt: now };
  } else {
    state.items.unshift(base);
  }
  await writeVoucherState(state);
  const saved = existingIndex >= 0 ? state.items[existingIndex] : base;
  appendSyncOutboxRecord('vouchers', saved.id, 'upsert', toVoucherSyncPayload(saved));
  return saved;
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
  appendSyncOutboxRecord('vouchers', id, 'delete', { id: String(id || ''), deletedAt: new Date().toISOString() });
  return true;
}

async function clearAllVouchersFile() {
  const file = vouchersFilePath();
  if (fs.existsSync(file)) {
    await fsp.rm(file, { force: true });
  }
  const assetsDir = vouchersAssetsRoot();
  if (fs.existsSync(assetsDir)) {
    await fsp.rm(assetsDir, { recursive: true, force: true });
  }
  await writeVoucherState({ version: 1, items: [] });
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
    data: { ...original.data, VoucherCode: newCode, Code: newCode },
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
  // 6-digit numeric-only code to avoid letters in serial numbers
  return String(Math.floor(100000 + Math.random() * 900000));
}

function codeExists(dbInstance, code) {
  if (!code) return false;
  if (!dbInstance) return false;
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
  const Lib = loadDbLib();
  if (!Lib) return null;
  if (db) return db;
  const userDataDir = app.getPath('userData');
  dbPath = path.join(userDataDir, 'vouchers.db');
  fs.mkdirSync(userDataDir, { recursive: true });
  db = new Lib(dbPath);
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

  // Value options table
  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS ${VALUE_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        value TEXT UNIQUE NOT NULL
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        orgId TEXT,
        name TEXT NOT NULL,
        durationMin INTEGER NOT NULL DEFAULT 30,
        priceCents INTEGER DEFAULT 0,
        currency TEXT DEFAULT 'EUR',
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS resources (
        id TEXT PRIMARY KEY,
        orgId TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'employee',
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS resource_services (
        resourceId TEXT NOT NULL,
        serviceId TEXT NOT NULL,
        PRIMARY KEY (resourceId, serviceId)
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS availability_rules (
        id TEXT PRIMARY KEY,
        orgId TEXT,
        resourceId TEXT NOT NULL,
        weekday INTEGER NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        breaksJson TEXT DEFAULT '[]',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS availability_exceptions (
        id TEXT PRIMARY KEY,
        orgId TEXT,
        resourceId TEXT NOT NULL,
        date TEXT NOT NULL,
        isOff INTEGER NOT NULL DEFAULT 1,
        startTime TEXT,
        endTime TEXT,
        note TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        orgId TEXT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        orgId TEXT,
        serviceId TEXT NOT NULL,
        resourceId TEXT NOT NULL,
        customerId TEXT NOT NULL,
        startAt TEXT NOT NULL,
        endAt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed',
        note TEXT,
        source TEXT NOT NULL DEFAULT 'desktop',
        voucherId TEXT,
        voucherCode TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        deletedAt TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS voucher_redemptions (
        id TEXT PRIMARY KEY,
        voucherCode TEXT NOT NULL,
        bookingId TEXT,
        redeemedAt TEXT NOT NULL,
        amountCents INTEGER DEFAULT 0,
        note TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY,
        entityType TEXT,
        entityId TEXT,
        op TEXT,
        payloadJson TEXT,
        createdAt TEXT,
        sentAt TEXT,
        ackAt TEXT,
        error TEXT
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS sync_state (
        id TEXT PRIMARY KEY,
        lastPullToken TEXT,
        updatedAt TEXT
      )`
    )
    .run();

  const bookingColumns = new Set(
    dbInstance
      .prepare('PRAGMA table_info(bookings)')
      .all()
      .map((c) => c.name)
  );
  if (!bookingColumns.has('voucherCode')) {
    dbInstance.prepare('ALTER TABLE bookings ADD COLUMN voucherCode TEXT').run();
  }

  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_services_org_active ON services(orgId, isActive)')
    .run();
  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_resources_org_active ON resources(orgId, isActive)')
    .run();
  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_availability_rules_resource_weekday ON availability_rules(resourceId, weekday)')
    .run();
  dbInstance
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_availability_exceptions_resource_date ON availability_exceptions(resourceId, date)'
    )
    .run();
  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_customers_org_name ON customers(orgId, name)')
    .run();
  dbInstance
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_bookings_resource_start_end_status ON bookings(resourceId, startAt, endAt, status)'
    )
    .run();
  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_booking ON voucher_redemptions(bookingId)')
    .run();
  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_code ON voucher_redemptions(voucherCode)')
    .run();
  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_sync_outbox_ack_created ON sync_outbox(ackAt, createdAt)')
    .run();
  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_sync_outbox_entity ON sync_outbox(entityType, entityId)')
    .run();
  ensureSyncStateRowDb(dbInstance, new Date().toISOString());
  dbInstance
    .prepare(
      "UPDATE services SET currency = 'EUR' WHERE currency IS NULL OR TRIM(currency) = '' OR UPPER(TRIM(currency)) = 'BGN'"
    )
    .run();
}

function normalizeServiceInput(service, existing = null) {
  const now = new Date().toISOString();
  const id = normalizeId(service?.id) || existing?.id || generateUuid();
  const createdAt = normalizeText(service?.createdAt, existing?.createdAt || now);
  const updatedAt = now;
  const name = normalizeText(service?.name, existing?.name || '');
  const durationMin = normalizePositiveInteger(service?.durationMin, existing?.durationMin ?? 30);
  const priceCents = normalizeInteger(service?.priceCents, existing?.priceCents ?? 0);
  const currency = 'EUR';
  const isActive =
    service?.isActive === undefined
      ? normalizeFlag(existing?.isActive, 1)
      : normalizeFlag(service?.isActive, normalizeFlag(existing?.isActive, 1));
  const deletedAt = normalizeDeletedAt(service?.deletedAt, existing?.deletedAt || null);
  return {
    id,
    orgId: normalizeOrgId(),
    name,
    durationMin,
    priceCents,
    currency,
    isActive,
    createdAt,
    updatedAt,
    deletedAt
  };
}

function normalizeResourceInput(resource, existing = null) {
  const now = new Date().toISOString();
  const id = normalizeId(resource?.id) || existing?.id || generateUuid();
  const createdAt = normalizeText(resource?.createdAt, existing?.createdAt || now);
  const updatedAt = now;
  const name = normalizeText(resource?.name, existing?.name || '');
  const type = normalizeText(resource?.type, existing?.type || 'employee');
  const isActive =
    resource?.isActive === undefined
      ? normalizeFlag(existing?.isActive, 1)
      : normalizeFlag(resource?.isActive, normalizeFlag(existing?.isActive, 1));
  const deletedAt = normalizeDeletedAt(resource?.deletedAt, existing?.deletedAt || null);
  return {
    id,
    orgId: normalizeOrgId(),
    name,
    type,
    isActive,
    createdAt,
    updatedAt,
    deletedAt
  };
}

function parseBreaksJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeRuleBreaks(rule, existing = null) {
  const existingBreaks = parseBreaksJsonArray(existing?.breaksJson || existing?.breaks || '[]');
  const fallbackBreak = existingBreaks[0] || {};
  const breakStart = normalizeTimeText(
    rule?.breakStartTime ?? rule?.breakStart ?? fallbackBreak.startTime ?? fallbackBreak.start ?? '',
    ''
  );
  const breakEnd = normalizeTimeText(rule?.breakEndTime ?? rule?.breakEnd ?? fallbackBreak.endTime ?? fallbackBreak.end ?? '', '');

  if (!breakStart && !breakEnd) return [];
  if (!breakStart || !breakEnd) throw new Error('Break start and end are required');
  if (breakStart >= breakEnd) throw new Error('Break start must be before break end');
  return [{ startTime: breakStart, endTime: breakEnd }];
}

function normalizeAvailabilityRuleInput(rule, existing = null) {
  const now = new Date().toISOString();
  const resourceId = normalizeId(rule?.resourceId || existing?.resourceId);
  if (!resourceId) throw new Error('resourceId is required');
  const weekday = normalizeWeekday(rule?.weekday ?? existing?.weekday, -1);
  if (weekday < 0 || weekday > 6) throw new Error('weekday must be between 0 and 6');
  const startTime = normalizeTimeText(rule?.startTime ?? existing?.startTime, '');
  const endTime = normalizeTimeText(rule?.endTime ?? existing?.endTime, '');
  if (!startTime || !endTime) throw new Error('startTime and endTime are required');
  if (startTime >= endTime) throw new Error('startTime must be before endTime');
  const breaks = normalizeRuleBreaks(rule, existing);
  if (breaks.length) {
    const first = breaks[0];
    if (first.startTime <= startTime || first.endTime >= endTime) {
      throw new Error('Break must be inside working hours');
    }
  }

  return {
    id: normalizeId(rule?.id || existing?.id || generateUuid()),
    orgId: normalizeOrgId(),
    resourceId,
    weekday,
    startTime,
    endTime,
    breaksJson: JSON.stringify(breaks),
    createdAt: normalizeText(rule?.createdAt, existing?.createdAt || now),
    updatedAt: now,
    deletedAt: normalizeDeletedAt(rule?.deletedAt, existing?.deletedAt || null)
  };
}

function mapAvailabilityRuleRow(row) {
  const breaks = parseBreaksJsonArray(row?.breaksJson || '[]')
    .map((item) => ({
      startTime: normalizeTimeText(item?.startTime ?? item?.start ?? '', ''),
      endTime: normalizeTimeText(item?.endTime ?? item?.end ?? '', '')
    }))
    .filter((item) => item.startTime && item.endTime);
  const first = breaks[0] || {};
  return {
    ...row,
    breaks,
    breakStartTime: first.startTime || '',
    breakEndTime: first.endTime || ''
  };
}

function normalizeAvailabilityExceptionInput(ex, existing = null) {
  const now = new Date().toISOString();
  const resourceId = normalizeId(ex?.resourceId || existing?.resourceId);
  if (!resourceId) throw new Error('resourceId is required');
  const date = normalizeDateText(ex?.date ?? existing?.date, '');
  if (!date) throw new Error('date is required (YYYY-MM-DD)');
  const isOff = normalizeFlag(ex?.isOff ?? existing?.isOff, 1);
  const startTime = isOff ? null : normalizeTimeText(ex?.startTime ?? existing?.startTime, '');
  const endTime = isOff ? null : normalizeTimeText(ex?.endTime ?? existing?.endTime, '');
  if (!isOff) {
    if (!startTime || !endTime) throw new Error('startTime and endTime are required for custom hours');
    if (startTime >= endTime) throw new Error('startTime must be before endTime');
  }

  return {
    id: normalizeId(ex?.id || existing?.id || generateUuid()),
    orgId: normalizeOrgId(),
    resourceId,
    date,
    isOff,
    startTime: isOff ? null : startTime,
    endTime: isOff ? null : endTime,
    note: normalizeText(ex?.note, existing?.note || ''),
    createdAt: normalizeText(ex?.createdAt, existing?.createdAt || now),
    updatedAt: now,
    deletedAt: normalizeDeletedAt(ex?.deletedAt, existing?.deletedAt || null)
  };
}

function normalizeCustomerInput(customer, existing = null) {
  const now = new Date().toISOString();
  const id = normalizeId(customer?.id) || existing?.id || generateUuid();
  const createdAt = normalizeText(customer?.createdAt, existing?.createdAt || now);
  const updatedAt = now;
  const name = normalizeText(customer?.name, existing?.name || '');
  const phone = normalizeOptionalText(customer?.phone, existing?.phone || null);
  const email = normalizeOptionalText(customer?.email, existing?.email || null);
  const notes = normalizeOptionalText(customer?.notes, existing?.notes || null);
  const deletedAt = normalizeDeletedAt(customer?.deletedAt, existing?.deletedAt || null);
  return {
    id,
    orgId: normalizeOrgId(),
    name,
    phone,
    email,
    notes,
    createdAt,
    updatedAt,
    deletedAt
  };
}

function normalizeBookingInput(booking, existing = null) {
  const now = new Date().toISOString();
  const id = normalizeId(booking?.id) || existing?.id || generateUuid();
  const serviceId = normalizeId(booking?.serviceId || existing?.serviceId);
  const resourceId = normalizeId(booking?.resourceId || existing?.resourceId);
  const customerId = normalizeId(booking?.customerId || existing?.customerId);
  if (!serviceId) throw new Error('serviceId is required');
  if (!resourceId) throw new Error('resourceId is required');
  if (!customerId) throw new Error('customerId is required');

  const startAt = normalizeIsoDateTime(booking?.startAt ?? existing?.startAt, '');
  const endAt = normalizeIsoDateTime(booking?.endAt ?? existing?.endAt, '');
  if (!startAt || !endAt) throw new Error('startAt and endAt are required');
  if (startAt >= endAt) throw new Error('startAt must be before endAt');

  const createdAt = normalizeText(booking?.createdAt, existing?.createdAt || now);
  const updatedAt = now;
  const status = normalizeBookingStatus(booking?.status, normalizeBookingStatus(existing?.status, 'confirmed'));
  const note = normalizeOptionalText(booking?.note, existing?.note || null);
  const source = normalizeBookingSource(booking?.source, normalizeBookingSource(existing?.source, 'desktop'));
  const voucherId = normalizeOptionalText(booking?.voucherId, existing?.voucherId || null);
  const voucherCode = normalizeOptionalText(booking?.voucherCode, existing?.voucherCode || null);
  const deletedAt = normalizeDeletedAt(booking?.deletedAt, existing?.deletedAt || null);

  return {
    id,
    orgId: normalizeOrgId(),
    serviceId,
    resourceId,
    customerId,
    startAt,
    endAt,
    status,
    note,
    source,
    voucherId,
    voucherCode,
    createdAt,
    updatedAt,
    deletedAt
  };
}

function buildDefaultAvailabilityRules(resourceId) {
  const rid = normalizeId(resourceId);
  if (!rid) return [];
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `default-${rid}-${weekday}`,
    orgId: normalizeOrgId(),
    resourceId: rid,
    weekday,
    startTime: '09:00',
    endTime: '17:00',
    breaksJson: '[]',
    createdAt: '',
    updatedAt: '',
    deletedAt: null
  }));
}

const services = {
  list(limit = 200, searchText = '') {
    const dbInstance = getDb();
    const safeLimit = normalizeLimit(limit, 200);
    const needle = normalizeSearchText(searchText);

    if (dbInstance) {
      if (needle) {
        const rows = dbInstance
          .prepare(
            `SELECT id, orgId, name, durationMin, priceCents, currency, isActive, createdAt, updatedAt, deletedAt
             FROM services
             WHERE orgId = ?
               AND isActive = 1
               AND deletedAt IS NULL
               AND (LOWER(name) LIKE ? OR LOWER(id) LIKE ?)
             ORDER BY createdAt DESC
             LIMIT ?`
          )
          .all(normalizeOrgId(), `%${needle}%`, `%${needle}%`, safeLimit);
        return rows;
      }

      return dbInstance
        .prepare(
          `SELECT id, orgId, name, durationMin, priceCents, currency, isActive, createdAt, updatedAt, deletedAt
           FROM services
           WHERE orgId = ?
             AND isActive = 1
             AND deletedAt IS NULL
           ORDER BY createdAt DESC
           LIMIT ?`
        )
        .all(normalizeOrgId(), safeLimit);
    }

    const state = readReposFallbackState();
    const items = (state.services || [])
      .filter((item) => item.orgId === normalizeOrgId() && item.isActive === 1 && !item.deletedAt)
      .filter((item) => {
        if (!needle) return true;
        return item.name?.toLowerCase().includes(needle) || item.id?.toLowerCase().includes(needle);
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return items.slice(0, safeLimit);
  },

  get(id) {
    const targetId = normalizeId(id);
    if (!targetId) return null;
    const dbInstance = getDb();

    if (dbInstance) {
      return (
        dbInstance
          .prepare(
            `SELECT id, orgId, name, durationMin, priceCents, currency, isActive, createdAt, updatedAt, deletedAt
             FROM services
             WHERE id = ?
               AND orgId = ?
               AND deletedAt IS NULL
             LIMIT 1`
          )
          .get(targetId, normalizeOrgId()) || null
      );
    }

    const state = readReposFallbackState();
    return state.services.find((item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt) || null;
  },

  save(service) {
    const dbInstance = getDb();
    const targetId = normalizeId(service?.id);

    if (dbInstance) {
      const existing =
        (targetId &&
          dbInstance
            .prepare(
              `SELECT id, orgId, name, durationMin, priceCents, currency, isActive, createdAt, updatedAt, deletedAt
               FROM services
               WHERE id = ?
               LIMIT 1`
            )
            .get(targetId)) ||
        null;

      const normalized = normalizeServiceInput(service || {}, existing);
      if (!normalized.name) throw new Error('Service name is required');

      dbInstance
        .prepare(
          `INSERT INTO services (id, orgId, name, durationMin, priceCents, currency, isActive, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             orgId = excluded.orgId,
             name = excluded.name,
             durationMin = excluded.durationMin,
             priceCents = excluded.priceCents,
             currency = excluded.currency,
             isActive = excluded.isActive,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`
        )
        .run(
          normalized.id,
          normalized.orgId,
          normalized.name,
          normalized.durationMin,
          normalized.priceCents,
          normalized.currency,
          normalized.isActive,
          normalized.createdAt,
          normalized.updatedAt,
          normalized.deletedAt
        );

      const saved = dbInstance
        .prepare(
          `SELECT id, orgId, name, durationMin, priceCents, currency, isActive, createdAt, updatedAt, deletedAt
           FROM services
           WHERE id = ?
           LIMIT 1`
        )
        .get(normalized.id);
      appendSyncOutboxRecord('services', saved.id, 'upsert', toServiceSyncPayload(saved), dbInstance);
      return saved;
    }

    const state = readReposFallbackState();
    const existingIndex = state.services.findIndex((item) => item.id === targetId);
    const existing = existingIndex >= 0 ? state.services[existingIndex] : null;
    const normalized = normalizeServiceInput(service || {}, existing);
    if (!normalized.name) throw new Error('Service name is required');
    if (existingIndex >= 0) {
      state.services[existingIndex] = normalized;
    } else {
      state.services.unshift(normalized);
    }
    writeReposFallbackState(state);
    appendSyncOutboxRecord('services', normalized.id, 'upsert', toServiceSyncPayload(normalized), null);
    return normalized;
  },

  delete(id) {
    const targetId = normalizeId(id);
    if (!targetId) return false;
    const now = new Date().toISOString();
    const dbInstance = getDb();

    if (dbInstance) {
      const info = dbInstance
        .prepare(
          `UPDATE services
           SET deletedAt = ?, isActive = 0, updatedAt = ?
           WHERE id = ?
             AND orgId = ?
             AND deletedAt IS NULL`
        )
        .run(now, now, targetId, normalizeOrgId());
      const deleted = info.changes > 0;
      if (deleted) {
        appendSyncOutboxRecord('services', targetId, 'delete', { id: targetId, deletedAt: now }, dbInstance);
      }
      return deleted;
    }

    const state = readReposFallbackState();
    const index = state.services.findIndex((item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt);
    if (index < 0) return false;
    state.services[index] = {
      ...state.services[index],
      isActive: 0,
      updatedAt: now,
      deletedAt: now
    };
    writeReposFallbackState(state);
    appendSyncOutboxRecord('services', targetId, 'delete', { id: targetId, deletedAt: now }, null);
    return true;
  }
};

const resources = {
  list(limit = 200, searchText = '') {
    const dbInstance = getDb();
    const safeLimit = normalizeLimit(limit, 200);
    const needle = normalizeSearchText(searchText);

    if (dbInstance) {
      if (needle) {
        const rows = dbInstance
          .prepare(
            `SELECT id, orgId, name, type, isActive, createdAt, updatedAt, deletedAt
             FROM resources
             WHERE orgId = ?
               AND isActive = 1
               AND deletedAt IS NULL
               AND (LOWER(name) LIKE ? OR LOWER(type) LIKE ? OR LOWER(id) LIKE ?)
             ORDER BY createdAt DESC
             LIMIT ?`
          )
          .all(normalizeOrgId(), `%${needle}%`, `%${needle}%`, `%${needle}%`, safeLimit);
        return rows;
      }

      return dbInstance
        .prepare(
          `SELECT id, orgId, name, type, isActive, createdAt, updatedAt, deletedAt
           FROM resources
           WHERE orgId = ?
             AND isActive = 1
             AND deletedAt IS NULL
           ORDER BY createdAt DESC
           LIMIT ?`
        )
        .all(normalizeOrgId(), safeLimit);
    }

    const state = readReposFallbackState();
    const items = (state.resources || [])
      .filter((item) => item.orgId === normalizeOrgId() && item.isActive === 1 && !item.deletedAt)
      .filter((item) => {
        if (!needle) return true;
        return (
          item.name?.toLowerCase().includes(needle) ||
          item.type?.toLowerCase().includes(needle) ||
          item.id?.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return items.slice(0, safeLimit);
  },

  get(id) {
    const targetId = normalizeId(id);
    if (!targetId) return null;
    const dbInstance = getDb();

    if (dbInstance) {
      return (
        dbInstance
          .prepare(
            `SELECT id, orgId, name, type, isActive, createdAt, updatedAt, deletedAt
             FROM resources
             WHERE id = ?
               AND orgId = ?
               AND deletedAt IS NULL
             LIMIT 1`
          )
          .get(targetId, normalizeOrgId()) || null
      );
    }

    const state = readReposFallbackState();
    return state.resources.find((item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt) || null;
  },

  save(resource) {
    const dbInstance = getDb();
    const targetId = normalizeId(resource?.id);

    if (dbInstance) {
      const existing =
        (targetId &&
          dbInstance
            .prepare(
              `SELECT id, orgId, name, type, isActive, createdAt, updatedAt, deletedAt
               FROM resources
               WHERE id = ?
               LIMIT 1`
            )
            .get(targetId)) ||
        null;

      const normalized = normalizeResourceInput(resource || {}, existing);
      if (!normalized.name) throw new Error('Resource name is required');

      dbInstance
        .prepare(
          `INSERT INTO resources (id, orgId, name, type, isActive, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             orgId = excluded.orgId,
             name = excluded.name,
             type = excluded.type,
             isActive = excluded.isActive,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`
        )
        .run(
          normalized.id,
          normalized.orgId,
          normalized.name,
          normalized.type,
          normalized.isActive,
          normalized.createdAt,
          normalized.updatedAt,
          normalized.deletedAt
        );

      const saved = dbInstance
        .prepare(
          `SELECT id, orgId, name, type, isActive, createdAt, updatedAt, deletedAt
           FROM resources
           WHERE id = ?
           LIMIT 1`
        )
        .get(normalized.id);
      appendSyncOutboxRecord('resources', saved.id, 'upsert', toResourceSyncPayload(saved), dbInstance);
      return saved;
    }

    const state = readReposFallbackState();
    const existingIndex = state.resources.findIndex((item) => item.id === targetId);
    const existing = existingIndex >= 0 ? state.resources[existingIndex] : null;
    const normalized = normalizeResourceInput(resource || {}, existing);
    if (!normalized.name) throw new Error('Resource name is required');
    if (existingIndex >= 0) {
      state.resources[existingIndex] = normalized;
    } else {
      state.resources.unshift(normalized);
    }
    writeReposFallbackState(state);
    appendSyncOutboxRecord('resources', normalized.id, 'upsert', toResourceSyncPayload(normalized), null);
    return normalized;
  },

  delete(id) {
    const targetId = normalizeId(id);
    if (!targetId) return false;
    const now = new Date().toISOString();
    const dbInstance = getDb();

    if (dbInstance) {
      const info = dbInstance
        .prepare(
          `UPDATE resources
           SET deletedAt = ?, isActive = 0, updatedAt = ?
           WHERE id = ?
             AND orgId = ?
             AND deletedAt IS NULL`
        )
        .run(now, now, targetId, normalizeOrgId());
      const deleted = info.changes > 0;
      if (deleted) {
        appendSyncOutboxRecord('resources', targetId, 'delete', { id: targetId, deletedAt: now }, dbInstance);
      }
      return deleted;
    }

    const state = readReposFallbackState();
    const index = state.resources.findIndex((item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt);
    if (index < 0) return false;
    state.resources[index] = {
      ...state.resources[index],
      isActive: 0,
      updatedAt: now,
      deletedAt: now
    };
    writeReposFallbackState(state);
    appendSyncOutboxRecord('resources', targetId, 'delete', { id: targetId, deletedAt: now }, null);
    return true;
  }
};

const resource_services = {
  set(resourceId, serviceIds = []) {
    const rid = normalizeId(resourceId);
    if (!rid) throw new Error('resourceId is required');
    const normalizedServiceIds = uniqueIds(serviceIds);
    const dbInstance = getDb();

    if (dbInstance) {
      const apply = dbInstance.transaction((targetResourceId, ids) => {
        dbInstance.prepare('DELETE FROM resource_services WHERE resourceId = ?').run(targetResourceId);
        const insert = dbInstance.prepare('INSERT INTO resource_services (resourceId, serviceId) VALUES (?, ?)');
        ids.forEach((serviceId) => {
          insert.run(targetResourceId, serviceId);
        });
      });
      apply(rid, normalizedServiceIds);
      return normalizedServiceIds;
    }

    const state = readReposFallbackState();
    state.resourceServices[rid] = normalizedServiceIds;
    writeReposFallbackState(state);
    return normalizedServiceIds;
  },

  get(resourceId) {
    const rid = normalizeId(resourceId);
    if (!rid) return [];
    const dbInstance = getDb();

    if (dbInstance) {
      const rows = dbInstance
        .prepare(
          `SELECT serviceId
           FROM resource_services
           WHERE resourceId = ?
           ORDER BY serviceId`
        )
        .all(rid);
      return rows.map((row) => row.serviceId);
    }

    const state = readReposFallbackState();
    return uniqueIds(state.resourceServices[rid] || []);
  }
};

const availability = {
  listRules(resourceId) {
    const rid = normalizeId(resourceId);
    if (!rid) return [];
    const dbInstance = getDb();

    if (dbInstance) {
      const rows = dbInstance
        .prepare(
          `SELECT id, orgId, resourceId, weekday, startTime, endTime, breaksJson, createdAt, updatedAt, deletedAt
           FROM availability_rules
           WHERE resourceId = ?
             AND orgId = ?
             AND deletedAt IS NULL
           ORDER BY weekday ASC, startTime ASC`
        )
        .all(rid, normalizeOrgId());
      return rows.map((row) => mapAvailabilityRuleRow(row));
    }

    const state = readReposFallbackState();
    const rows = (state.availabilityRules || [])
      .filter((item) => item.resourceId === rid && item.orgId === normalizeOrgId() && !item.deletedAt)
      .sort((a, b) => Number(a.weekday || 0) - Number(b.weekday || 0) || String(a.startTime || '').localeCompare(String(b.startTime || '')));
    return rows.map((row) => mapAvailabilityRuleRow(row));
  },

  saveRule(rule) {
    const dbInstance = getDb();
    const targetId = normalizeId(rule?.id);
    const rid = normalizeId(rule?.resourceId);
    const weekday = normalizeWeekday(rule?.weekday, -1);

    if (dbInstance) {
      let existing =
        (targetId &&
          dbInstance
            .prepare(
              `SELECT id, orgId, resourceId, weekday, startTime, endTime, breaksJson, createdAt, updatedAt, deletedAt
               FROM availability_rules
               WHERE id = ?
               LIMIT 1`
            )
            .get(targetId)) ||
        null;

      if (!existing && rid && weekday >= 0) {
        existing =
          dbInstance
            .prepare(
              `SELECT id, orgId, resourceId, weekday, startTime, endTime, breaksJson, createdAt, updatedAt, deletedAt
               FROM availability_rules
               WHERE resourceId = ?
                 AND orgId = ?
                 AND weekday = ?
                 AND deletedAt IS NULL
               ORDER BY createdAt DESC
               LIMIT 1`
            )
            .get(rid, normalizeOrgId(), weekday) || null;
      }

      const normalized = normalizeAvailabilityRuleInput(rule || {}, existing);

      dbInstance
        .prepare(
          `INSERT INTO availability_rules (id, orgId, resourceId, weekday, startTime, endTime, breaksJson, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             orgId = excluded.orgId,
             resourceId = excluded.resourceId,
             weekday = excluded.weekday,
             startTime = excluded.startTime,
             endTime = excluded.endTime,
             breaksJson = excluded.breaksJson,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`
        )
        .run(
          normalized.id,
          normalized.orgId,
          normalized.resourceId,
          normalized.weekday,
          normalized.startTime,
          normalized.endTime,
          normalized.breaksJson,
          normalized.createdAt,
          normalized.updatedAt,
          normalized.deletedAt
        );

      const saved = dbInstance
        .prepare(
          `SELECT id, orgId, resourceId, weekday, startTime, endTime, breaksJson, createdAt, updatedAt, deletedAt
           FROM availability_rules
           WHERE id = ?
           LIMIT 1`
        )
        .get(normalized.id);
      return mapAvailabilityRuleRow(saved);
    }

    const state = readReposFallbackState();
    let existingIndex = targetId ? state.availabilityRules.findIndex((item) => item.id === targetId) : -1;
    if (existingIndex < 0 && rid && weekday >= 0) {
      existingIndex = state.availabilityRules.findIndex(
        (item) =>
          item.resourceId === rid &&
          item.orgId === normalizeOrgId() &&
          Number(item.weekday) === weekday &&
          !item.deletedAt
      );
    }
    const existing = existingIndex >= 0 ? state.availabilityRules[existingIndex] : null;
    const normalized = normalizeAvailabilityRuleInput(rule || {}, existing);
    if (existingIndex >= 0) {
      state.availabilityRules[existingIndex] = normalized;
    } else {
      state.availabilityRules.unshift(normalized);
    }
    writeReposFallbackState(state);
    return mapAvailabilityRuleRow(normalized);
  },

  deleteRule(id) {
    const targetId = normalizeId(id);
    if (!targetId) return false;
    const now = new Date().toISOString();
    const dbInstance = getDb();

    if (dbInstance) {
      const info = dbInstance
        .prepare(
          `UPDATE availability_rules
           SET deletedAt = ?, updatedAt = ?
           WHERE id = ?
             AND orgId = ?
             AND deletedAt IS NULL`
        )
        .run(now, now, targetId, normalizeOrgId());
      return info.changes > 0;
    }

    const state = readReposFallbackState();
    const index = state.availabilityRules.findIndex(
      (item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt
    );
    if (index < 0) return false;
    state.availabilityRules[index] = {
      ...state.availabilityRules[index],
      updatedAt: now,
      deletedAt: now
    };
    writeReposFallbackState(state);
    return true;
  },

  listExceptions(resourceId, from = '', to = '') {
    const rid = normalizeId(resourceId);
    if (!rid) return [];
    const fromDate = normalizeDateText(from, '');
    const toDate = normalizeDateText(to, '');
    const dbInstance = getDb();

    if (dbInstance) {
      let query = `SELECT id, orgId, resourceId, date, isOff, startTime, endTime, note, createdAt, updatedAt, deletedAt
                   FROM availability_exceptions
                   WHERE resourceId = ?
                     AND orgId = ?
                     AND deletedAt IS NULL`;
      const params = [rid, normalizeOrgId()];
      if (fromDate) {
        query += ' AND date >= ?';
        params.push(fromDate);
      }
      if (toDate) {
        query += ' AND date <= ?';
        params.push(toDate);
      }
      query += ' ORDER BY date DESC, createdAt DESC';
      return dbInstance.prepare(query).all(...params);
    }

    const state = readReposFallbackState();
    return (state.availabilityExceptions || [])
      .filter((item) => item.resourceId === rid && item.orgId === normalizeOrgId() && !item.deletedAt)
      .filter((item) => {
        if (fromDate && item.date < fromDate) return false;
        if (toDate && item.date > toDate) return false;
        return true;
      })
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },

  saveException(ex) {
    const dbInstance = getDb();
    const targetId = normalizeId(ex?.id);
    const rid = normalizeId(ex?.resourceId);
    const date = normalizeDateText(ex?.date, '');

    if (dbInstance) {
      let existing =
        (targetId &&
          dbInstance
            .prepare(
              `SELECT id, orgId, resourceId, date, isOff, startTime, endTime, note, createdAt, updatedAt, deletedAt
               FROM availability_exceptions
               WHERE id = ?
               LIMIT 1`
            )
            .get(targetId)) ||
        null;

      if (!existing && rid && date) {
        existing =
          dbInstance
            .prepare(
              `SELECT id, orgId, resourceId, date, isOff, startTime, endTime, note, createdAt, updatedAt, deletedAt
               FROM availability_exceptions
               WHERE resourceId = ?
                 AND orgId = ?
                 AND date = ?
                 AND deletedAt IS NULL
               ORDER BY createdAt DESC
               LIMIT 1`
            )
            .get(rid, normalizeOrgId(), date) || null;
      }

      const normalized = normalizeAvailabilityExceptionInput(ex || {}, existing);

      dbInstance
        .prepare(
          `INSERT INTO availability_exceptions (id, orgId, resourceId, date, isOff, startTime, endTime, note, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             orgId = excluded.orgId,
             resourceId = excluded.resourceId,
             date = excluded.date,
             isOff = excluded.isOff,
             startTime = excluded.startTime,
             endTime = excluded.endTime,
             note = excluded.note,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`
        )
        .run(
          normalized.id,
          normalized.orgId,
          normalized.resourceId,
          normalized.date,
          normalized.isOff,
          normalized.startTime,
          normalized.endTime,
          normalized.note,
          normalized.createdAt,
          normalized.updatedAt,
          normalized.deletedAt
        );

      return dbInstance
        .prepare(
          `SELECT id, orgId, resourceId, date, isOff, startTime, endTime, note, createdAt, updatedAt, deletedAt
           FROM availability_exceptions
           WHERE id = ?
           LIMIT 1`
        )
        .get(normalized.id);
    }

    const state = readReposFallbackState();
    let existingIndex = targetId ? state.availabilityExceptions.findIndex((item) => item.id === targetId) : -1;
    if (existingIndex < 0 && rid && date) {
      existingIndex = state.availabilityExceptions.findIndex(
        (item) =>
          item.resourceId === rid &&
          item.orgId === normalizeOrgId() &&
          item.date === date &&
          !item.deletedAt
      );
    }
    const existing = existingIndex >= 0 ? state.availabilityExceptions[existingIndex] : null;
    const normalized = normalizeAvailabilityExceptionInput(ex || {}, existing);
    if (existingIndex >= 0) {
      state.availabilityExceptions[existingIndex] = normalized;
    } else {
      state.availabilityExceptions.unshift(normalized);
    }
    writeReposFallbackState(state);
    return normalized;
  },

  deleteException(id) {
    const targetId = normalizeId(id);
    if (!targetId) return false;
    const now = new Date().toISOString();
    const dbInstance = getDb();

    if (dbInstance) {
      const info = dbInstance
        .prepare(
          `UPDATE availability_exceptions
           SET deletedAt = ?, updatedAt = ?
           WHERE id = ?
             AND orgId = ?
             AND deletedAt IS NULL`
        )
        .run(now, now, targetId, normalizeOrgId());
      return info.changes > 0;
    }

    const state = readReposFallbackState();
    const index = state.availabilityExceptions.findIndex(
      (item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt
    );
    if (index < 0) return false;
    state.availabilityExceptions[index] = {
      ...state.availabilityExceptions[index],
      updatedAt: now,
      deletedAt: now
    };
    writeReposFallbackState(state);
    return true;
  }
};

const customers = {
  list(limit = 200, searchText = '') {
    const dbInstance = getDb();
    const safeLimit = normalizeLimit(limit, 200);
    const needle = normalizeSearchText(searchText);

    if (dbInstance) {
      if (needle) {
        return dbInstance
          .prepare(
            `SELECT id, orgId, name, phone, email, notes, createdAt, updatedAt, deletedAt
             FROM customers
             WHERE orgId = ?
               AND deletedAt IS NULL
               AND (
                 LOWER(name) LIKE ?
                 OR LOWER(COALESCE(phone, '')) LIKE ?
                 OR LOWER(COALESCE(email, '')) LIKE ?
                 OR LOWER(id) LIKE ?
               )
             ORDER BY name COLLATE NOCASE ASC, createdAt DESC
             LIMIT ?`
          )
          .all(normalizeOrgId(), `%${needle}%`, `%${needle}%`, `%${needle}%`, `%${needle}%`, safeLimit);
      }

      return dbInstance
        .prepare(
          `SELECT id, orgId, name, phone, email, notes, createdAt, updatedAt, deletedAt
           FROM customers
           WHERE orgId = ?
             AND deletedAt IS NULL
           ORDER BY name COLLATE NOCASE ASC, createdAt DESC
           LIMIT ?`
        )
        .all(normalizeOrgId(), safeLimit);
    }

    const state = readReposFallbackState();
    const items = (state.customers || [])
      .filter((item) => item.orgId === normalizeOrgId() && !item.deletedAt)
      .filter((item) => {
        if (!needle) return true;
        return (
          String(item.name || '').toLowerCase().includes(needle) ||
          String(item.phone || '').toLowerCase().includes(needle) ||
          String(item.email || '').toLowerCase().includes(needle) ||
          String(item.id || '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const byName = String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
        if (byName !== 0) return byName;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
    return items.slice(0, safeLimit);
  },

  get(id) {
    const targetId = normalizeId(id);
    if (!targetId) return null;
    const dbInstance = getDb();

    if (dbInstance) {
      return (
        dbInstance
          .prepare(
            `SELECT id, orgId, name, phone, email, notes, createdAt, updatedAt, deletedAt
             FROM customers
             WHERE id = ?
               AND orgId = ?
               AND deletedAt IS NULL
             LIMIT 1`
          )
          .get(targetId, normalizeOrgId()) || null
      );
    }

    const state = readReposFallbackState();
    return state.customers.find((item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt) || null;
  },

  save(customer) {
    const dbInstance = getDb();
    const targetId = normalizeId(customer?.id);

    if (dbInstance) {
      const existing =
        (targetId &&
          dbInstance
            .prepare(
              `SELECT id, orgId, name, phone, email, notes, createdAt, updatedAt, deletedAt
               FROM customers
               WHERE id = ?
               LIMIT 1`
            )
            .get(targetId)) ||
        null;

      const normalized = normalizeCustomerInput(customer || {}, existing);
      if (!normalized.name) throw new Error('Customer name is required');

      dbInstance
        .prepare(
          `INSERT INTO customers (id, orgId, name, phone, email, notes, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             orgId = excluded.orgId,
             name = excluded.name,
             phone = excluded.phone,
             email = excluded.email,
             notes = excluded.notes,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`
        )
        .run(
          normalized.id,
          normalized.orgId,
          normalized.name,
          normalized.phone,
          normalized.email,
          normalized.notes,
          normalized.createdAt,
          normalized.updatedAt,
          normalized.deletedAt
        );

      const saved = dbInstance
        .prepare(
          `SELECT id, orgId, name, phone, email, notes, createdAt, updatedAt, deletedAt
           FROM customers
           WHERE id = ?
           LIMIT 1`
        )
        .get(normalized.id);
      appendSyncOutboxRecord('customers', saved.id, 'upsert', toCustomerSyncPayload(saved), dbInstance);
      return saved;
    }

    const state = readReposFallbackState();
    const existingIndex = state.customers.findIndex((item) => item.id === targetId);
    const existing = existingIndex >= 0 ? state.customers[existingIndex] : null;
    const normalized = normalizeCustomerInput(customer || {}, existing);
    if (!normalized.name) throw new Error('Customer name is required');
    if (existingIndex >= 0) {
      state.customers[existingIndex] = normalized;
    } else {
      state.customers.unshift(normalized);
    }
    writeReposFallbackState(state);
    appendSyncOutboxRecord('customers', normalized.id, 'upsert', toCustomerSyncPayload(normalized), null);
    return normalized;
  },

  delete(id) {
    const targetId = normalizeId(id);
    if (!targetId) return false;
    const now = new Date().toISOString();
    const dbInstance = getDb();

    if (dbInstance) {
      const info = dbInstance
        .prepare(
          `UPDATE customers
           SET deletedAt = ?, updatedAt = ?
           WHERE id = ?
             AND orgId = ?
             AND deletedAt IS NULL`
        )
        .run(now, now, targetId, normalizeOrgId());
      const deleted = info.changes > 0;
      if (deleted) {
        appendSyncOutboxRecord('customers', targetId, 'delete', { id: targetId, deletedAt: now }, dbInstance);
      }
      return deleted;
    }

    const state = readReposFallbackState();
    const index = state.customers.findIndex((item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt);
    if (index < 0) return false;
    state.customers[index] = {
      ...state.customers[index],
      updatedAt: now,
      deletedAt: now
    };
    writeReposFallbackState(state);
    appendSyncOutboxRecord('customers', targetId, 'delete', { id: targetId, deletedAt: now }, null);
    return true;
  }
};

const bookings = {
  list(range = {}, resourceIds = []) {
    const dbInstance = getDb();
    const { from, to } = normalizeDateRangeInput(range);
    const ids = uniqueIds(resourceIds);

    if (from && to && from >= to) return [];

    if (dbInstance) {
      let query = `SELECT id, orgId, serviceId, resourceId, customerId, startAt, endAt, status, note, source, voucherId, voucherCode, createdAt, updatedAt, deletedAt
                   FROM bookings
                   WHERE orgId = ?
                     AND deletedAt IS NULL`;
      const params = [normalizeOrgId()];

      if (from && to) {
        query += ' AND endAt > ? AND startAt < ?';
        params.push(from, to);
      } else if (from) {
        query += ' AND endAt > ?';
        params.push(from);
      } else if (to) {
        query += ' AND startAt < ?';
        params.push(to);
      }

      if (ids.length > 0) {
        query += ` AND resourceId IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }

      query += ' ORDER BY startAt ASC, createdAt DESC';
      return dbInstance.prepare(query).all(...params);
    }

    const state = readReposFallbackState();
    return (state.bookings || [])
      .filter((item) => item.orgId === normalizeOrgId() && !item.deletedAt)
      .filter((item) => {
        if (ids.length > 0 && !ids.includes(item.resourceId)) return false;
        if (from && to) {
          return String(item.endAt || '') > from && String(item.startAt || '') < to;
        }
        if (from) return String(item.endAt || '') > from;
        if (to) return String(item.startAt || '') < to;
        return true;
      })
      .sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  },

  get(id) {
    const targetId = normalizeId(id);
    if (!targetId) return null;
    const dbInstance = getDb();

    if (dbInstance) {
      return (
        dbInstance
          .prepare(
            `SELECT id, orgId, serviceId, resourceId, customerId, startAt, endAt, status, note, source, voucherId, voucherCode, createdAt, updatedAt, deletedAt
             FROM bookings
             WHERE id = ?
               AND orgId = ?
               AND deletedAt IS NULL
             LIMIT 1`
          )
          .get(targetId, normalizeOrgId()) || null
      );
    }

    const state = readReposFallbackState();
    return state.bookings.find((item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt) || null;
  },

  save(booking) {
    const dbInstance = getDb();
    const targetId = normalizeId(booking?.id);

    if (dbInstance) {
      const existing =
        (targetId &&
          dbInstance
            .prepare(
              `SELECT id, orgId, serviceId, resourceId, customerId, startAt, endAt, status, note, source, voucherId, voucherCode, createdAt, updatedAt, deletedAt
               FROM bookings
               WHERE id = ?
               LIMIT 1`
            )
            .get(targetId)) ||
        null;

      const normalized = normalizeBookingInput(booking || {}, existing);
      if (!services.get(normalized.serviceId)) throw new Error('serviceId not found');
      if (!resources.get(normalized.resourceId)) throw new Error('resourceId not found');
      if (!customers.get(normalized.customerId)) throw new Error('customerId not found');

      dbInstance
        .prepare(
          `INSERT INTO bookings (id, orgId, serviceId, resourceId, customerId, startAt, endAt, status, note, source, voucherId, voucherCode, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             orgId = excluded.orgId,
             serviceId = excluded.serviceId,
             resourceId = excluded.resourceId,
             customerId = excluded.customerId,
             startAt = excluded.startAt,
             endAt = excluded.endAt,
             status = excluded.status,
             note = excluded.note,
             source = excluded.source,
             voucherId = excluded.voucherId,
             voucherCode = excluded.voucherCode,
             updatedAt = excluded.updatedAt,
             deletedAt = excluded.deletedAt`
        )
        .run(
          normalized.id,
          normalized.orgId,
          normalized.serviceId,
          normalized.resourceId,
          normalized.customerId,
          normalized.startAt,
          normalized.endAt,
          normalized.status,
          normalized.note,
          normalized.source,
          normalized.voucherId,
          normalized.voucherCode,
          normalized.createdAt,
          normalized.updatedAt,
          normalized.deletedAt
        );

      const saved = dbInstance
        .prepare(
          `SELECT id, orgId, serviceId, resourceId, customerId, startAt, endAt, status, note, source, voucherId, voucherCode, createdAt, updatedAt, deletedAt
             FROM bookings
           WHERE id = ?
           LIMIT 1`
        )
        .get(normalized.id);
      maybeCreateBookingRedemption(existing, saved);
      appendSyncOutboxRecord('bookings', saved.id, 'upsert', toBookingSyncPayload(saved), dbInstance);
      return saved;
    }

    const state = readReposFallbackState();
    const existingIndex = state.bookings.findIndex((item) => item.id === targetId);
    const existing = existingIndex >= 0 ? state.bookings[existingIndex] : null;
    const normalized = normalizeBookingInput(booking || {}, existing);
    if (!services.get(normalized.serviceId)) throw new Error('serviceId not found');
    if (!resources.get(normalized.resourceId)) throw new Error('resourceId not found');
    if (!customers.get(normalized.customerId)) throw new Error('customerId not found');
    if (existingIndex >= 0) {
      state.bookings[existingIndex] = normalized;
    } else {
      state.bookings.unshift(normalized);
    }
    writeReposFallbackState(state);
    maybeCreateBookingRedemption(existing, normalized);
    appendSyncOutboxRecord('bookings', normalized.id, 'upsert', toBookingSyncPayload(normalized), null);
    return normalized;
  },

  delete(id) {
    const targetId = normalizeId(id);
    if (!targetId) return false;
    const now = new Date().toISOString();
    const dbInstance = getDb();

    if (dbInstance) {
      const info = dbInstance
        .prepare(
          `UPDATE bookings
           SET deletedAt = ?, updatedAt = ?
           WHERE id = ?
             AND orgId = ?
             AND deletedAt IS NULL`
        )
        .run(now, now, targetId, normalizeOrgId());
      const deleted = info.changes > 0;
      if (deleted) {
        appendSyncOutboxRecord('bookings', targetId, 'delete', { id: targetId, deletedAt: now }, dbInstance);
      }
      return deleted;
    }

    const state = readReposFallbackState();
    const index = state.bookings.findIndex((item) => item.id === targetId && item.orgId === normalizeOrgId() && !item.deletedAt);
    if (index < 0) return false;
    state.bookings[index] = {
      ...state.bookings[index],
      updatedAt: now,
      deletedAt: now
    };
    writeReposFallbackState(state);
    appendSyncOutboxRecord('bookings', targetId, 'delete', { id: targetId, deletedAt: now }, null);
    return true;
  },

  computeSlots({ serviceId, resourceId, from, to, slotStepMin = 15, includeEndAt = false } = {}) {
    const sid = normalizeId(serviceId);
    const rid = normalizeId(resourceId);
    if (!sid) throw new Error('serviceId is required');
    if (!rid) throw new Error('resourceId is required');

    const fromDate = normalizeDateFromAny(from, '');
    const toDate = normalizeDateFromAny(to, '');
    if (!fromDate || !toDate) throw new Error('from and to are required (date or datetime)');
    if (fromDate > toDate) throw new Error('from must be before or equal to to');

    const service = services.get(sid);
    if (!service) throw new Error('serviceId not found');
    if (!resources.get(rid)) throw new Error('resourceId not found');

    const rangeStartIso = `${fromDate}T00:00:00.000Z`;
    const rangeEndDate = addDaysToDateText(toDate, 1);
    if (!rangeEndDate) throw new Error('Invalid to date');
    const rangeEndIso = `${rangeEndDate}T00:00:00.000Z`;

    let rules = availability.listRules(rid);
    if (!Array.isArray(rules) || rules.length === 0) {
      rules = buildDefaultAvailabilityRules(rid);
    }
    const exceptions = availability.listExceptions(rid, fromDate, toDate);
    const existingBookings = bookings.list({ from: rangeStartIso, to: rangeEndIso }, [rid]);

    return computeAvailableSlots({
      rules,
      exceptions,
      bookings: existingBookings,
      serviceDurationMin: normalizePositiveInteger(service.durationMin, 30),
      dateRange: { from: fromDate, to: toDate },
      slotStepMin: normalizePositiveInteger(slotStepMin, 15),
      includeEndAt: normalizeFlag(includeEndAt, 0) === 1
    });
  }
};

const sync = {
  getStatus() {
    const dbInstance = getDb();
    if (dbInstance) {
      ensureSyncStateRowDb(dbInstance, '');
      const pending = dbInstance
        .prepare(
          `SELECT COUNT(1) AS count
           FROM sync_outbox
           WHERE ackAt IS NULL`
        )
        .get();
      const errors = dbInstance
        .prepare(
          `SELECT COUNT(1) AS count
           FROM sync_outbox
           WHERE COALESCE(TRIM(error), '') <> ''
             AND ackAt IS NULL`
        )
        .get();
      const stateRow = ensureSyncStateRowDb(dbInstance, '');
      return {
        pendingCount: Number(pending?.count || 0),
        errorCount: Number(errors?.count || 0),
        lastPullToken: normalizeText(stateRow?.lastPullToken, ''),
        updatedAt: normalizeText(stateRow?.updatedAt, '')
      };
    }

    const state = readReposFallbackState();
    const rows = Array.isArray(state.syncOutbox) ? state.syncOutbox : [];
    const pendingCount = rows.filter((row) => !row?.ackAt).length;
    const errorCount = rows.filter((row) => !row?.ackAt && String(row?.error || '').trim() !== '').length;
    return {
      pendingCount,
      errorCount,
      lastPullToken: normalizeText(state?.syncState?.lastPullToken, ''),
      updatedAt: normalizeText(state?.syncState?.updatedAt, '')
    };
  },

  listOutbox(limit = 200) {
    const safeLimit = normalizeLimit(limit, 200);
    const dbInstance = getDb();
    if (dbInstance) {
      const rows = dbInstance
        .prepare(
          `SELECT id, entityType, entityId, op, payloadJson, createdAt, sentAt, ackAt, error
           FROM sync_outbox
           ORDER BY createdAt DESC
           LIMIT ?`
        )
        .all(safeLimit);
      return rows.map((row) => ({
        ...row,
        payload: parseSyncPayloadJson(row.payloadJson)
      }));
    }

    const state = readReposFallbackState();
    const rows = (Array.isArray(state.syncOutbox) ? state.syncOutbox : [])
      .slice()
      .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
      .slice(0, safeLimit);
    return rows.map((row) => ({
      ...row,
      payload: parseSyncPayloadJson(row.payloadJson)
    }));
  },

  clearErrors() {
    const now = new Date().toISOString();
    const dbInstance = getDb();
    if (dbInstance) {
      const info = dbInstance
        .prepare(
          `UPDATE sync_outbox
           SET error = NULL
           WHERE COALESCE(TRIM(error), '') <> ''`
        )
        .run();
      touchSyncStateDb(dbInstance, now);
      return { cleared: Number(info?.changes || 0) };
    }

    const state = readReposFallbackState();
    let cleared = 0;
    state.syncOutbox = (Array.isArray(state.syncOutbox) ? state.syncOutbox : []).map((row) => {
      if (String(row?.error || '').trim() === '') return row;
      cleared += 1;
      return { ...row, error: null };
    });
    state.syncState = {
      id: SYNC_STATE_ID,
      lastPullToken: normalizeText(state?.syncState?.lastPullToken, ''),
      updatedAt: now
    };
    writeReposFallbackState(state);
    return { cleared };
  }
};

function clearVoucherDb() {
  const dbInstance = getDb();
  if (!dbInstance) return;
  dbInstance.prepare('DELETE FROM vouchers').run();
}

function listValueOptions() {
  const dbInstance = getDb();
  if (!dbInstance) return [];
  const rows = dbInstance.prepare(`SELECT value FROM ${VALUE_TABLE} ORDER BY value COLLATE NOCASE`).all();
  return rows.map((r) => r.value);
}

function addValueOption(val) {
  const value = String(val || '').trim();
  if (!value) return listValueOptions();
  const dbInstance = getDb();
  if (!dbInstance) return [];
  dbInstance.prepare(`INSERT OR IGNORE INTO ${VALUE_TABLE} (value) VALUES (?)`).run(value);
  return listValueOptions();
}

function deleteValueOption(val) {
  const value = String(val || '').trim();
  if (!value) return listValueOptions();
  const dbInstance = getDb();
  if (!dbInstance) return [];
  dbInstance.prepare(`DELETE FROM ${VALUE_TABLE} WHERE value = ?`).run(value);
  return listValueOptions();
}

async function exportVouchersCsv() {
  const state = readVoucherState();
  const items = state.items || [];
  if (!items.length) {
    return { ok: false, error: 'No vouchers to export' };
  }
  const defaultPath = path.join(app.getPath('documents'), `vouchers-${Date.now()}.csv`);
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(win, {
    title: 'Export vouchers as CSV',
    defaultPath,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  const headers = ['id', 'templateId', 'voucherCode', 'createdAt', 'updatedAt', 'redeemedAt', 'data_json'];
  const lines = [headers.join(',')];
  items.forEach((item) => {
    const code = item.data?.VoucherCode || item.data?.Code || '';
    const line = [
      `"${item.id || ''}"`,
      `"${item.templateId || ''}"`,
      `"${code}"`,
      `"${item.createdAt || ''}"`,
      `"${item.updatedAt || ''}"`,
      `"${item.redeemedAt || ''}"`,
      `"${JSON.stringify(item.data || {}).replace(/"/g, '""')}"`
    ];
    lines.push(line.join(','));
  });
  await fsp.writeFile(result.filePath, lines.join(os.EOL), 'utf-8');
  return { ok: true, path: result.filePath };
}

function saveVoucher(data, templateId) {
  const dbInstance = getDb();
  if (!dbInstance) throw new Error('Database unavailable (better-sqlite3 not loaded)');
  const now = new Date().toISOString();
  let codeToUse = normalizeNumericCode(data.code);
  if (codeExists(dbInstance, codeToUse)) {
    codeToUse = generateUniqueCode(dbInstance);
  }
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
  appendSyncOutboxRecord(
    'vouchers',
    String(info.lastInsertRowid),
    'upsert',
    {
      id: String(info.lastInsertRowid),
      templateId: templateId || '',
      code: codeToUse,
      updatedAt: now,
      redeemedAt: null
    },
    dbInstance
  );
  return { id: info.lastInsertRowid, code: codeToUse };
}

function listVouchers(limit = 20) {
  const dbInstance = getDb();
  const fallbackList = () => {
    const state = readVoucherState();
    return (state.items || [])
      .slice(0, limit)
      .map((v) => ({
        id: v.id,
        name: v.data?.RecipientName || v.data?.Name || '',
        value: v.data?.Value || '',
        expires: v.data?.Validity || '',
        note: v.data?.Note || '',
        templateId: v.templateId,
        createdAt: v.createdAt,
        code: v.data?.VoucherCode || v.data?.Code || '',
        redeemedAt: v.redeemedAt || null
      }));
  };

  if (!dbInstance) {
    return fallbackList();
  }
  const stmt = dbInstance.prepare(
    'SELECT id, name, value, expires, note, templateId, createdAt, code, redeemedAt FROM vouchers ORDER BY createdAt DESC LIMIT ?'
  );
  const rows = stmt.all(limit);
  if (rows.length === 0) return fallbackList();
  return rows;
}

function getVoucherById(id) {
  const fallback = () => {
    const state = readVoucherState();
    const found = (state.items || []).find((v) => String(v.id) === String(id));
    if (!found) return null;
    return {
      id: found.id,
      name: found.data?.RecipientName || found.data?.Name || '',
      value: found.data?.Value || '',
      expires: found.data?.Validity || '',
      note: found.data?.Note || '',
      templateId: found.templateId,
      createdAt: found.createdAt,
      code: found.data?.VoucherCode || found.data?.Code || '',
      redeemedAt: found.redeemedAt || null
    };
  };

  const dbInstance = getDb();
  if (!dbInstance) return fallback();

  const stmt = dbInstance.prepare(
    'SELECT id, name, value, expires, note, templateId, createdAt, code, redeemedAt FROM vouchers WHERE id = ?'
  );
  const row = stmt.get(id);
  return row || fallback();
}

function getVoucherByCode(code) {
  const dbInstance = getDb();
  const fallback = () => {
    const state = readVoucherState();
    const needle = normalizeCode(code);
    const found = (state.items || []).find((v) => normalizeCode(v.data?.VoucherCode || v.data?.Code) === needle);
    if (!found) return null;
    return {
      id: found.id,
      name: found.data?.RecipientName || found.data?.Name || '',
      value: found.data?.Value || '',
      expires: found.data?.Validity || '',
      note: found.data?.Note || '',
      templateId: found.templateId,
      createdAt: found.createdAt,
      code: found.data?.VoucherCode || found.data?.Code || '',
      redeemedAt: found.redeemedAt || null
    };
  };

  if (!dbInstance) {
    return fallback();
  }
  const stmt = dbInstance.prepare(
    'SELECT id, name, value, expires, note, templateId, createdAt, code, redeemedAt FROM vouchers WHERE code = ?'
  );
  const row = stmt.get(normalizeCode(code));
  if (row) return row;
  return fallback();
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

function parseVoucherAmountCents(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  const match = text.replace(/\s+/g, '').match(/-?\d+(?:[.,]\d{1,2})?/);
  if (!match) return 0;
  const normalized = match[0].replace(',', '.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount * 100));
}

function saveVoucherRedemption({ voucherCode, bookingId = null, redeemedAt = '', amountCents = 0, note = null } = {}) {
  const code = normalizeText(voucherCode, '');
  if (!code) return null;
  const normalizedBookingId = normalizeOptionalText(bookingId, null);
  const normalizedRedeemedAt = normalizeIsoDateTime(redeemedAt, new Date().toISOString());
  const normalizedAmountCents = Math.max(0, normalizeInteger(amountCents, 0));
  const normalizedNote = normalizeOptionalText(note, null);
  const dbInstance = getDb();

  if (dbInstance) {
    if (normalizedBookingId) {
      const existing = dbInstance
        .prepare(
          `SELECT id, voucherCode, bookingId, redeemedAt, amountCents, note
           FROM voucher_redemptions
           WHERE bookingId = ?
           LIMIT 1`
        )
        .get(normalizedBookingId);
      if (existing) return existing;
    }

    const id = generateUuid();
    dbInstance
      .prepare(
        `INSERT INTO voucher_redemptions (id, voucherCode, bookingId, redeemedAt, amountCents, note)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, code, normalizedBookingId, normalizedRedeemedAt, normalizedAmountCents, normalizedNote);

    return dbInstance
      .prepare(
        `SELECT id, voucherCode, bookingId, redeemedAt, amountCents, note
         FROM voucher_redemptions
         WHERE id = ?
         LIMIT 1`
      )
      .get(id);
  }

  const state = readReposFallbackState();
  if (normalizedBookingId) {
    const existing = (state.voucherRedemptions || []).find((item) => item.bookingId === normalizedBookingId);
    if (existing) return existing;
  }
  const row = {
    id: generateUuid(),
    voucherCode: code,
    bookingId: normalizedBookingId,
    redeemedAt: normalizedRedeemedAt,
    amountCents: normalizedAmountCents,
    note: normalizedNote
  };
  state.voucherRedemptions.unshift(row);
  writeReposFallbackState(state);
  return row;
}

function markVoucherRedeemedByRef({ voucherId = null, voucherCode = null, redeemedAt = '' } = {}) {
  const normalizedVoucherId = normalizeOptionalText(voucherId, null);
  const normalizedVoucherCode = normalizeOptionalText(voucherCode, null);
  if (!normalizedVoucherId && !normalizedVoucherCode) return false;

  const when = normalizeIsoDateTime(redeemedAt, new Date().toISOString());
  let updated = false;
  const dbInstance = getDb();

  if (dbInstance) {
    if (normalizedVoucherId) {
      const infoById = dbInstance
        .prepare('UPDATE vouchers SET redeemedAt = COALESCE(redeemedAt, ?) WHERE id = ?')
        .run(when, normalizedVoucherId);
      if (infoById.changes > 0) updated = true;
    }
    if (normalizedVoucherCode) {
      const infoByCode = dbInstance
        .prepare('UPDATE vouchers SET redeemedAt = COALESCE(redeemedAt, ?) WHERE code = ?')
        .run(when, normalizeCode(normalizedVoucherCode));
      if (infoByCode.changes > 0) updated = true;
    }
  }

  const state = readVoucherState();
  const items = Array.isArray(state.items) ? state.items : [];
  const targetIndex = items.findIndex((item) => {
    if (normalizedVoucherId && String(item.id) === String(normalizedVoucherId)) return true;
    if (!normalizedVoucherCode) return false;
    const itemCode = item.data?.VoucherCode || item.data?.Code || '';
    return normalizeCode(itemCode) === normalizeCode(normalizedVoucherCode);
  });

  if (targetIndex >= 0) {
    const existing = items[targetIndex];
    items[targetIndex] = {
      ...existing,
      redeemedAt: existing.redeemedAt || when,
      updatedAt: when
    };
    writeVoucherStateSync(state);
    updated = true;
  }

  return updated;
}

function getVoucherForBookingLink({ voucherId = null, voucherCode = null } = {}) {
  const normalizedVoucherId = normalizeOptionalText(voucherId, null);
  if (normalizedVoucherId) {
    const byId = getVoucherById(normalizedVoucherId);
    if (byId) return byId;
  }

  const normalizedVoucherCode = normalizeOptionalText(voucherCode, null);
  if (normalizedVoucherCode) {
    return getVoucherByCode(normalizeCode(normalizedVoucherCode));
  }
  return null;
}

function maybeCreateBookingRedemption(previousBooking, currentBooking) {
  const currentStatus = normalizeBookingStatus(currentBooking?.status, '');
  if (currentStatus !== 'completed') return;

  const voucherRefId = normalizeOptionalText(currentBooking?.voucherId, null);
  const voucherRefCode = normalizeOptionalText(currentBooking?.voucherCode, null);
  if (!voucherRefId && !voucherRefCode) return;

  const voucher = getVoucherForBookingLink({ voucherId: voucherRefId, voucherCode: voucherRefCode });
  const resolvedCode = normalizeOptionalText(voucher?.code, voucherRefCode);
  if (!resolvedCode) return;

  const redeemedAt = normalizeIsoDateTime(currentBooking?.updatedAt, new Date().toISOString());
  const amountCents = parseVoucherAmountCents(voucher?.value);
  saveVoucherRedemption({
    voucherCode: resolvedCode,
    bookingId: currentBooking?.id || null,
    redeemedAt,
    amountCents,
    note: normalizeOptionalText(currentBooking?.note, null)
  });
  markVoucherRedeemedByRef({
    voucherId: normalizeOptionalText(voucher?.id, voucherRefId),
    voucherCode: resolvedCode,
    redeemedAt
  });
}

function validateVoucherCodePayload(code) {
  const providedCode = String(code || '').trim();
  if (!providedCode) {
    return {
      valid: false,
      code: '',
      status: 'not_found',
      redeemedAt: null,
      expires: null,
      value: null,
      voucherId: null
    };
  }

  const voucher = getVoucherByCode(normalizeCode(providedCode));
  if (!voucher) {
    return {
      valid: false,
      code: providedCode,
      status: 'not_found',
      redeemedAt: null,
      expires: null,
      value: null,
      voucherId: null
    };
  }

  const status = voucherStatus(voucher);
  return {
    valid: status === 'valid',
    code: voucher.code || providedCode,
    status,
    redeemedAt: voucher.redeemedAt || null,
    expires: voucher.expires || null,
    value: voucher.value || null,
    voucherId: voucher.id != null ? String(voucher.id) : null
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 720,
    title: 'LN software',
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

ipcMain.handle('services:list', async (_event, limit = 200, searchText = '') => {
  try {
    const data = services.list(limit, searchText);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('services:get', async (_event, id) => {
  try {
    const data = services.get(id);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('services:save', async (_event, service) => {
  try {
    const data = services.save(service || {});
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('services:delete', async (_event, id) => {
  try {
    const deleted = services.delete(id);
    return { ok: true, data: { deleted } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('resources:list', async (_event, limit = 200, searchText = '') => {
  try {
    const data = resources.list(limit, searchText);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('resources:get', async (_event, id) => {
  try {
    const data = resources.get(id);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('resources:save', async (_event, resource) => {
  try {
    const data = resources.save(resource || {});
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('resources:delete', async (_event, id) => {
  try {
    const deleted = resources.delete(id);
    return { ok: true, data: { deleted } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('resources:setServices', async (_event, resourceId, serviceIds = []) => {
  try {
    const data = resource_services.set(resourceId, serviceIds);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('resources:getServices', async (_event, resourceId) => {
  try {
    const data = resource_services.get(resourceId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('availability:listRules', async (_event, resourceId) => {
  try {
    const data = availability.listRules(resourceId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('availability:saveRule', async (_event, rule) => {
  try {
    const data = availability.saveRule(rule || {});
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('availability:deleteRule', async (_event, id) => {
  try {
    const deleted = availability.deleteRule(id);
    return { ok: true, data: { deleted } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('availability:listExceptions', async (_event, resourceId, from, to) => {
  try {
    const data = availability.listExceptions(resourceId, from, to);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('availability:saveException', async (_event, ex) => {
  try {
    const data = availability.saveException(ex || {});
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('availability:deleteException', async (_event, id) => {
  try {
    const deleted = availability.deleteException(id);
    return { ok: true, data: { deleted } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('customers:list', async (_event, limit = 200, searchText = '') => {
  try {
    const data = customers.list(limit, searchText);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('customers:get', async (_event, id) => {
  try {
    const data = customers.get(id);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('customers:save', async (_event, customer) => {
  try {
    const data = customers.save(customer || {});
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('customers:delete', async (_event, id) => {
  try {
    const deleted = customers.delete(id);
    return { ok: true, data: { deleted } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('bookings:list', async (_event, range = {}, resourceIds = []) => {
  try {
    const data = bookings.list(range || {}, resourceIds || []);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('bookings:get', async (_event, id) => {
  try {
    const data = bookings.get(id);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('bookings:save', async (_event, booking) => {
  try {
    const data = bookings.save(booking || {});
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('bookings:delete', async (_event, id) => {
  try {
    const deleted = bookings.delete(id);
    return { ok: true, data: { deleted } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('bookings:computeSlots', async (_event, payload = {}) => {
  try {
    const data = bookings.computeSlots(payload || {});
    return { ok: true, data };
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

ipcMain.handle('vouchers:clearAll', async () => {
  try {
    await clearAllVouchersFile();
    clearVoucherDb();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:exportCsv', async () => {
  try {
    return await exportVouchersCsv();
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:validateCode', async (_event, code) => {
  try {
    const data = validateVoucherCodePayload(code);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('sync:getStatus', async () => {
  try {
    const data = sync.getStatus();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('sync:listOutbox', async (_event, limit = 200) => {
  try {
    const data = sync.listOutbox(limit);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('sync:clearErrors', async () => {
  try {
    const data = sync.clearErrors();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('values:list', () => {
  try {
    return { ok: true, values: listValueOptions() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('values:add', (_event, value) => {
  try {
    const values = addValueOption(value);
    return { ok: true, values };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('values:delete', (_event, value) => {
  try {
    const values = deleteValueOption(value);
    return { ok: true, values };
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
  const now = new Date().toISOString();

  const redeemInFile = () => {
    const state = readVoucherState();
    const items = state.items || [];
    const idx = items.findIndex((v) => String(v.id) === String(id));
    if (idx === -1) return null;
    items[idx].redeemedAt = now;
    writeVoucherStateSync(state);
    const item = items[idx];
    return {
      id: item.id,
      name: item.data?.RecipientName || item.data?.Name || '',
      value: item.data?.Value || '',
      expires: item.data?.Validity || '',
      note: item.data?.Note || '',
      templateId: item.templateId,
      createdAt: item.createdAt,
      code: item.data?.VoucherCode || item.data?.Code || '',
      redeemedAt: item.redeemedAt || now
    };
  };

  const dbInstance = getDb();
  if (!dbInstance) {
    const row = redeemInFile();
    return row ? { ok: true, row } : { ok: false, error: 'Voucher not found' };
  }

  const stmt = dbInstance.prepare('UPDATE vouchers SET redeemedAt = ? WHERE id = ?');
  try {
    const info = stmt.run(now, id);
    if (info.changes > 0) {
      const row = getVoucherById(id);
      return { ok: true, row };
    }
  } catch (err) {
    const row = redeemInFile();
    if (row) return { ok: true, row };
    return { ok: false, error: err.message };
  }

  // Not in DB? fall back to file-based vouchers (or any cached rows)
  const row = redeemInFile() || getVoucherById(id);
  return row ? { ok: true, row } : { ok: false, error: 'Voucher not found' };
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
