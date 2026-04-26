// main.js
const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const os = require('os');
const QRCode = require('qrcode');
const exporter = require('./src/exporter');
const { computeAvailableSlots } = require('./src/domain/availability');
const { createVoucherExpiryService } = require('./src/services/voucherExpiryService');

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
const CSV_IMPORT_PREVIEW_TTL_MS = 15 * 60 * 1000;
const csvImportPreviewStore = new Map();
const VOUCHER_EXPIRY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const APP_PRODUCT_NAME = 'LN software';
const LEGACY_APP_NAME = 'LNvoucher-maker';
const FIXED_EUR_RATE = 1.95583;
const WEBSITE_SLOT_STEP_MIN = 7 * 60;
const WEBSITE_CATALOG_SEEDED_AT = '2026-04-22T00:00:00.000Z';

const WEBSITE_SERVICES = [
  {
    id: 'c54bc0ad-bdc6-46c1-b2ee-6d6dab1d32f0',
    name: 'ATV Старт край Калофер',
    durationMin: 75,
    priceCents: 12900,
    currency: 'BGN'
  },
  {
    id: 'b9fb6b49-ca8e-41ab-9ff1-d34708c670f2',
    name: 'Premium ATV Панорама',
    durationMin: 120,
    priceCents: 18900,
    currency: 'BGN'
  },
  {
    id: '13a347c1-d364-4cf9-bf95-7e7ce11cfdbd',
    name: 'UTV / Buggy Central Balkan',
    durationMin: 110,
    priceCents: 24900,
    currency: 'BGN'
  },
  {
    id: '5e19f77e-d1ef-46d2-a993-4f6632906a49',
    name: 'Paintball Forest Arena',
    durationMin: 90,
    priceCents: 22000,
    currency: 'BGN'
  },
  {
    id: 'aa8a3a3b-7c3d-42a7-a1fb-1c5f971edcde',
    name: 'Разходки с джип край Калофер',
    durationMin: 90,
    priceCents: 0,
    currency: 'BGN'
  },
  {
    id: 'website-kids-track',
    name: 'Детска писта',
    durationMin: 60,
    priceCents: 0,
    currency: 'BGN'
  }
];

const WEBSITE_RESOURCES = [
  {
    id: 'website-resource-atv-fleet',
    name: 'ATV Fleet - Kalofer Base',
    type: 'vehicle_fleet',
    serviceIds: ['c54bc0ad-bdc6-46c1-b2ee-6d6dab1d32f0', 'b9fb6b49-ca8e-41ab-9ff1-d34708c670f2']
  },
  {
    id: 'website-resource-utv-buggy',
    name: 'UTV / Buggy - Kalofer Base',
    type: 'vehicle',
    serviceIds: ['13a347c1-d364-4cf9-bf95-7e7ce11cfdbd']
  },
  {
    id: 'website-resource-jeep',
    name: 'Jeep - Kalofer Base',
    type: 'vehicle',
    serviceIds: ['aa8a3a3b-7c3d-42a7-a1fb-1c5f971edcde']
  },
  {
    id: 'website-resource-paintball-arena',
    name: 'Paintball Forest Arena - Kalofer',
    type: 'arena',
    serviceIds: ['5e19f77e-d1ef-46d2-a993-4f6632906a49']
  },
  {
    id: 'website-resource-kids-track',
    name: 'Kids Track - Kalofer',
    type: 'track',
    serviceIds: ['website-kids-track']
  }
];

let db;
let dbPath;
let voucherExpiryCheckTimer = null;

const settingsFilePath = () => path.join(app.getPath('userData'), 'settings.json');

function settingsFilePathForAppName(appName) {
  return path.join(app.getPath('appData'), appName, 'settings.json');
}

function alternateSettingsFilePaths() {
  const current = settingsFilePath();
  const candidates = [settingsFilePathForAppName(APP_PRODUCT_NAME), settingsFilePathForAppName(LEGACY_APP_NAME)];
  return candidates.filter((file, index) => file !== current && candidates.indexOf(file) === index);
}

async function readJsonObjectFile(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const content = await fsp.readFile(file, 'utf-8');
    const data = JSON.parse(content);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function hasRequiredSyncConnectionSettings(settings) {
  const config = extractSyncSettings(settings || {});
  return Boolean(config.baseUrl && config.email && config.password);
}

function mergeSettingsWithSyncFallback(primary, fallback) {
  const primarySync =
    primary?.sync && typeof primary.sync === 'object' && !Array.isArray(primary.sync) ? primary.sync : {};
  const fallbackSync =
    fallback?.sync && typeof fallback.sync === 'object' && !Array.isArray(fallback.sync) ? fallback.sync : {};
  const primaryConfig = extractSyncSettings(primary || {});
  return {
    ...(fallback || {}),
    ...(primary || {}),
    sync: {
      ...fallbackSync,
      ...primarySync,
      ...(primaryConfig.baseUrl ? { baseUrl: primaryConfig.baseUrl } : {}),
      ...(primaryConfig.email ? { email: primaryConfig.email } : {}),
      ...(primaryConfig.password ? { password: primaryConfig.password } : {}),
      ...(primaryConfig.orgId ? { orgId: primaryConfig.orgId } : {})
    }
  };
}

async function readSettings() {
  const file = settingsFilePath();
  const primary = await readJsonObjectFile(file);
  if (hasRequiredSyncConnectionSettings(primary)) {
    return primary;
  }

  for (const fallbackFile of alternateSettingsFilePaths()) {
    const fallback = await readJsonObjectFile(fallbackFile);
    if (hasRequiredSyncConnectionSettings(fallback)) {
      return mergeSettingsWithSyncFallback(primary, fallback);
    }
  }
  return primary;
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
    reservationEmailConfirmations: Array.isArray(state?.reservationEmailConfirmations)
      ? state.reservationEmailConfirmations
      : [],
    reservationApologyEmails: Array.isArray(state?.reservationApologyEmails) ? state.reservationApologyEmails : [],
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

function localDateKeyFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  if (normalized === 'website' || normalized === 'web' || normalized === 'public') return 'public';
  return normalized || fallback;
}

function websiteResourceIdForService(serviceId) {
  const id = normalizeId(serviceId);
  if (!id) return '';
  const resource = WEBSITE_RESOURCES.find((item) => uniqueIds(item.serviceIds).includes(id));
  return normalizeId(resource?.id);
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
    currency: normalizeCurrencyCode(service?.currency, 'BGN'),
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

function toResourceServicesSyncPayload(resourceId, serviceIds = [], updatedAt = '') {
  const rid = normalizeId(resourceId);
  return {
    id: rid,
    resourceId: rid,
    serviceIds: uniqueIds(serviceIds),
    updatedAt: normalizeText(updatedAt, new Date().toISOString())
  };
}

function toAvailabilityRuleSyncPayload(rule) {
  const breaks = parseBreaksJsonArray(rule?.breaksJson || rule?.breaks || '[]');
  return {
    id: normalizeId(rule?.id),
    resourceId: normalizeId(rule?.resourceId),
    weekday: normalizeWeekday(rule?.weekday, 0),
    startTime: normalizeTimeText(rule?.startTime, ''),
    endTime: normalizeTimeText(rule?.endTime, ''),
    breaks,
    breaksJson: JSON.stringify(breaks),
    updatedAt: normalizeText(rule?.updatedAt, ''),
    deletedAt: normalizeDeletedAt(rule?.deletedAt, null)
  };
}

function toAvailabilityExceptionSyncPayload(ex) {
  return {
    id: normalizeId(ex?.id),
    resourceId: normalizeId(ex?.resourceId),
    date: normalizeDateText(ex?.date, ''),
    isOff: normalizeFlag(ex?.isOff, 1),
    startTime: normalizeOptionalText(ex?.startTime, null),
    endTime: normalizeOptionalText(ex?.endTime, null),
    note: normalizeOptionalText(ex?.note, null),
    updatedAt: normalizeText(ex?.updatedAt, ''),
    deletedAt: normalizeDeletedAt(ex?.deletedAt, null)
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
    note: normalizeOptionalText(booking?.note, null),
    source: normalizeBookingSource(booking?.source, 'desktop'),
    voucherId: normalizeOptionalText(booking?.voucherId, null),
    voucherCode: normalizeOptionalText(booking?.voucherCode, null),
    createdAt: normalizeText(booking?.createdAt, ''),
    updatedAt: normalizeText(booking?.updatedAt, ''),
    deletedAt: normalizeDeletedAt(booking?.deletedAt, null)
  };
}

function toVoucherSyncPayload(voucher) {
  const code = normalizeText(voucher?.data?.VoucherCode || voucher?.data?.Code || voucher?.code, '');
  const phone = normalizeText(voucher?.phone ?? voucher?.data?.phone, '');
  return {
    id: normalizeId(voucher?.id),
    templateId: normalizeText(voucher?.templateId, ''),
    code,
    phone,
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidText(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

function deterministicUuidFromText(value) {
  const hash = crypto.createHash('sha1').update(String(value || '')).digest('hex');
  const bytes = Buffer.from(hash.slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function toVoucherSyncEntityId(value) {
  const normalized = normalizeText(value, '');
  if (!normalized) return '';
  if (isUuidText(normalized)) return normalized.toLowerCase();
  return deterministicUuidFromText(`voucher:${normalizeOrgId()}:${normalized}`);
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

function normalizeNumericCodeOrEmpty(code) {
  const digits = String(code || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length >= 6) return digits.slice(0, 6);
  return digits.padStart(6, '0');
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
  return filtered.slice(0, limit).map((item) => {
    const phone = normalizeText(item?.phone ?? item?.data?.phone, '');
    return {
      ...item,
      phone,
      data: { ...(item?.data || {}), phone }
    };
  });
}

async function getVoucherFile(id) {
  const state = readVoucherState();
  const item = (state.items || []).find((entry) => entry.id === id) || null;
  if (!item) return null;
  const phone = normalizeText(item?.phone ?? item?.data?.phone, '');
  return {
    ...item,
    phone,
    data: { ...(item?.data || {}), phone }
  };
}

async function saveVoucherFile(voucher) {
  const state = readVoucherState();
  const now = new Date().toISOString();
  const id = voucher.id || generateVoucherId();
  const existingIndex = (state.items || []).findIndex((item) => item.id === id);
  const existingPhone =
    existingIndex >= 0
      ? normalizeText(state.items?.[existingIndex]?.phone ?? state.items?.[existingIndex]?.data?.phone, '')
      : '';
  const existingRedeemedAt =
    existingIndex >= 0 ? normalizeDeletedAt(state.items?.[existingIndex]?.redeemedAt, null) : null;
  const phone = normalizeText(voucher?.phone ?? voucher?.data?.phone, existingPhone);
  const redeemedAt = normalizeDeletedAt(voucher?.redeemedAt, existingRedeemedAt);
  const code = normalizeNumericCode(voucher.data?.VoucherCode || voucher.data?.Code);
  const base = {
    id,
    templateId: voucher.templateId || (state.items?.[0]?.templateId || ''),
    createdAt: voucher.createdAt || now,
    updatedAt: now,
    redeemedAt,
    phone,
    data: { ...(voucher.data || {}), phone, VoucherCode: code, Code: code },
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
  const existing = (state.items || []).find((item) => item.id === id) || null;
  const remaining = (state.items || []).filter((item) => item.id !== id);
  if (remaining.length === state.items.length) return false;
  state.items = remaining;
  await writeVoucherState(state);
  const targetAssets = path.join(vouchersAssetsRoot(), id);
  if (fs.existsSync(targetAssets)) {
    await fsp.rm(targetAssets, { recursive: true, force: true });
  }
  appendSyncOutboxRecord('vouchers', id, 'delete', {
    id: String(id || ''),
    code: normalizeText(existing?.data?.VoucherCode || existing?.data?.Code, ''),
    deletedAt: new Date().toISOString()
  });
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

function listFileVoucherExpiryCandidates() {
  const state = readVoucherState();
  const items = Array.isArray(state.items) ? state.items : [];
  return items
    .filter((item) => {
      const redeemedAt = normalizeDeletedAt(item?.redeemedAt, null);
      if (redeemedAt) return false;
      const notifiedAt = normalizeDeletedAt(
        item?.expiryNotificationSentAt ?? item?.data?.expiryNotificationSentAt ?? item?.data?.ExpiryNotificationSentAt,
        null
      );
      if (notifiedAt) return false;
      const expiryDate = normalizeText(item?.data?.Validity || item?.data?.Expires || item?.expires, '');
      return Boolean(expiryDate);
    })
    .map((item) => ({
      source: 'file',
      id: normalizeId(item?.id),
      code: normalizeText(item?.data?.VoucherCode || item?.data?.Code || item?.code, ''),
      expiryDate: normalizeText(item?.data?.Validity || item?.data?.Expires || item?.expires, '')
    }))
    .filter((item) => item.id && item.expiryDate);
}

async function markFileVoucherExpiryNotificationSent(voucherId, sentAt) {
  const id = normalizeId(voucherId);
  const timestamp = normalizeText(sentAt, '');
  if (!id || !timestamp) return false;

  const state = readVoucherState();
  const items = Array.isArray(state.items) ? state.items : [];
  const index = items.findIndex((item) => normalizeId(item?.id) === id);
  if (index < 0) return false;

  const current = items[index] || {};
  const nextData = {
    ...(current.data || {}),
    expiryNotificationSentAt: timestamp,
    ExpiryNotificationSentAt: timestamp
  };
  items[index] = {
    ...current,
    updatedAt: timestamp,
    expiryNotificationSentAt: timestamp,
    data: nextData
  };
  state.items = items;
  await writeVoucherState(state);
  return true;
}

function listDbVoucherExpiryCandidates() {
  const dbInstance = getDb();
  if (!dbInstance) return [];
  return dbInstance
    .prepare(
      `SELECT id, code, expires, redeemedAt, expiryNotificationSentAt
         FROM vouchers
        WHERE (redeemedAt IS NULL OR TRIM(redeemedAt) = '')
          AND (expiryNotificationSentAt IS NULL OR TRIM(expiryNotificationSentAt) = '')
          AND expires IS NOT NULL
          AND TRIM(expires) <> ''`
    )
    .all()
    .map((row) => ({
      source: 'db',
      id: normalizeId(row?.id),
      code: normalizeText(row?.code, ''),
      expiryDate: normalizeText(row?.expires, '')
    }))
    .filter((item) => item.id && item.expiryDate);
}

function markDbVoucherExpiryNotificationSent(voucherId, sentAt) {
  const dbInstance = getDb();
  if (!dbInstance) return false;
  const id = normalizeId(voucherId);
  const timestamp = normalizeText(sentAt, '');
  if (!id || !timestamp) return false;

  const info = dbInstance
    .prepare(
      `UPDATE vouchers
          SET expiryNotificationSentAt = ?
        WHERE id = ?
          AND (expiryNotificationSentAt IS NULL OR TRIM(expiryNotificationSentAt) = '')`
    )
    .run(timestamp, id);
  return info.changes > 0;
}

async function areExpiryNotificationsEnabled() {
  try {
    const settings = await readSettings();
    return settings?.expiryNotificationsEnabled !== false;
  } catch {
    return true;
  }
}

async function notifyVoucherExpiry({ code, expiryDate }) {
  const voucherCode = normalizeText(code, 'unknown');
  const expiryText = normalizeText(expiryDate, 'unknown');
  const title = 'Voucher expiring soon';
  const body = `Voucher ${voucherCode} expires in 10 days (${expiryText})`;
  let shown = false;

  try {
    const supported = typeof Notification?.isSupported === 'function' ? Notification.isSupported() : Boolean(Notification);
    if (supported) {
      const notification = new Notification({ title, body });
      notification.show();
      shown = true;
    }
  } catch (err) {
    console.error('Failed to show voucher expiry notification', err);
  }

  if (!shown) {
    const options = {
      type: 'info',
      title,
      message: title,
      detail: body,
      buttons: ['OK']
    };
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win) {
      await dialog.showMessageBox(win, options);
    } else {
      await dialog.showMessageBox(options);
    }
  }
}

const voucherExpiryService = createVoucherExpiryService({
  isEnabled: areExpiryNotificationsEnabled,
  getFileCandidates: listFileVoucherExpiryCandidates,
  getDbCandidates: listDbVoucherExpiryCandidates,
  markFileNotified: markFileVoucherExpiryNotificationSent,
  markDbNotified: markDbVoucherExpiryNotificationSent,
  notify: notifyVoucherExpiry
});

async function checkExpiringVouchers() {
  return voucherExpiryService.checkExpiringVouchers();
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

function normalizeCurrencyCode(value, fallback = 'BGN') {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

function moneyMinorLabel(cents, currency = 'BGN') {
  const amount = Math.max(0, normalizeInteger(cents, 0)) / 100;
  const code = normalizeCurrencyCode(currency, 'BGN');
  return `${amount.toFixed(2)} ${code}`;
}

function dualMoneyMinorLabel(cents, currency = 'BGN') {
  const amountCents = normalizeInteger(cents, 0);
  const code = normalizeCurrencyCode(currency, 'BGN');
  if (amountCents <= 0) return 'on request';
  if (code !== 'BGN') return moneyMinorLabel(amountCents, code);
  const eurAmount = amountCents / 100 / FIXED_EUR_RATE;
  return `${moneyMinorLabel(amountCents, 'BGN')} / ${eurAmount.toFixed(2)} EUR`;
}

function websiteValueOptionForService(service) {
  const name = normalizeText(service?.name, 'Service');
  const price = dualMoneyMinorLabel(service?.priceCents, service?.currency);
  return `${name} - ${price}`;
}

function seedRowStamp(index = 0) {
  const base = new Date(WEBSITE_CATALOG_SEEDED_AT).getTime();
  return new Date(base + Number(index || 0) * 1000).toISOString();
}

function websiteRuleId(resourceId, weekday) {
  return `website-rule-${resourceId}-${weekday}`;
}

function websiteAvailabilityRules(resourceId, index = 0) {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: websiteRuleId(resourceId, weekday),
    orgId: normalizeOrgId(),
    resourceId,
    weekday,
    startTime: '08:00',
    endTime: '17:00',
    breaksJson: '[]',
    createdAt: seedRowStamp(index * 10 + weekday),
    updatedAt: seedRowStamp(index * 10 + weekday),
    deletedAt: null
  }));
}

function serviceMatchesSeed(existing, service) {
  if (!existing) return false;
  return (
    normalizeText(existing.name, '') === normalizeText(service.name, '') &&
    normalizePositiveInteger(existing.durationMin, 30) === normalizePositiveInteger(service.durationMin, 30) &&
    normalizeInteger(existing.priceCents, 0) === normalizeInteger(service.priceCents, 0) &&
    normalizeCurrencyCode(existing.currency, 'BGN') === normalizeCurrencyCode(service.currency, 'BGN') &&
    normalizeFlag(existing.isActive, 1) === 1 &&
    !normalizeDeletedAt(existing.deletedAt, null)
  );
}

function resourceMatchesSeed(existing, resource) {
  if (!existing) return false;
  return (
    normalizeText(existing.name, '') === normalizeText(resource.name, '') &&
    normalizeText(existing.type, 'employee') === normalizeText(resource.type, 'employee') &&
    normalizeFlag(existing.isActive, 1) === 1 &&
    !normalizeDeletedAt(existing.deletedAt, null)
  );
}

function availabilityRuleMatchesSeed(existing, rule) {
  if (!existing) return false;
  return (
    normalizeId(existing.resourceId) === normalizeId(rule.resourceId) &&
    normalizeWeekday(existing.weekday, -1) === normalizeWeekday(rule.weekday, -1) &&
    normalizeTimeText(existing.startTime, '') === normalizeTimeText(rule.startTime, '') &&
    normalizeTimeText(existing.endTime, '') === normalizeTimeText(rule.endTime, '') &&
    JSON.stringify(parseBreaksJsonArray(existing.breaksJson || '[]')) === JSON.stringify(parseBreaksJsonArray(rule.breaksJson || '[]')) &&
    !normalizeDeletedAt(existing.deletedAt, null)
  );
}

function sortedIds(values = []) {
  return uniqueIds(values).sort((a, b) => a.localeCompare(b));
}

function upsertWebsiteServiceSeed(dbInstance, service, index) {
  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, name, durationMin, priceCents, currency, isActive, createdAt, updatedAt, deletedAt
         FROM services
         WHERE id = ?
         LIMIT 1`
      )
      .get(service.id) || null;
  if (serviceMatchesSeed(existing, service)) return false;

  const stamp = seedRowStamp(index);
  const row = {
    id: service.id,
    orgId: normalizeOrgId(),
    name: service.name,
    durationMin: service.durationMin,
    priceCents: service.priceCents,
    currency: normalizeCurrencyCode(service.currency, 'BGN'),
    isActive: 1,
    createdAt: normalizeText(existing?.createdAt, stamp),
    updatedAt: stamp,
    deletedAt: null
  };

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
      row.id,
      row.orgId,
      row.name,
      row.durationMin,
      row.priceCents,
      row.currency,
      row.isActive,
      row.createdAt,
      row.updatedAt,
      row.deletedAt
    );
  appendSyncOutboxRecord('services', row.id, 'upsert', toServiceSyncPayload(row), dbInstance);
  return true;
}

function upsertWebsiteResourceSeed(dbInstance, resource, index) {
  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, name, type, isActive, createdAt, updatedAt, deletedAt
         FROM resources
         WHERE id = ?
         LIMIT 1`
      )
      .get(resource.id) || null;
  if (resourceMatchesSeed(existing, resource)) return false;

  const stamp = seedRowStamp(100 + index);
  const row = {
    id: resource.id,
    orgId: normalizeOrgId(),
    name: resource.name,
    type: resource.type,
    isActive: 1,
    createdAt: normalizeText(existing?.createdAt, stamp),
    updatedAt: stamp,
    deletedAt: null
  };

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
    .run(row.id, row.orgId, row.name, row.type, row.isActive, row.createdAt, row.updatedAt, row.deletedAt);
  appendSyncOutboxRecord('resources', row.id, 'upsert', toResourceSyncPayload(row), dbInstance);
  return true;
}

function upsertWebsiteResourceServicesSeed(dbInstance, resource) {
  const desired = sortedIds(resource.serviceIds);
  const existing = sortedIds(
    dbInstance
      .prepare('SELECT serviceId FROM resource_services WHERE resourceId = ? ORDER BY serviceId')
      .all(resource.id)
      .map((row) => row.serviceId)
  );
  if (JSON.stringify(existing) === JSON.stringify(desired)) return false;

  dbInstance.prepare('DELETE FROM resource_services WHERE resourceId = ?').run(resource.id);
  const insert = dbInstance.prepare('INSERT INTO resource_services (resourceId, serviceId) VALUES (?, ?)');
  desired.forEach((serviceId) => insert.run(resource.id, serviceId));
  appendSyncOutboxRecord(
    'resource_services',
    resource.id,
    'upsert',
    toResourceServicesSyncPayload(resource.id, desired, seedRowStamp(200)),
    dbInstance
  );
  return true;
}

function upsertWebsiteAvailabilityRuleSeed(dbInstance, rule) {
  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, resourceId, weekday, startTime, endTime, breaksJson, createdAt, updatedAt, deletedAt
         FROM availability_rules
         WHERE id = ?
         LIMIT 1`
      )
      .get(rule.id) || null;
  if (availabilityRuleMatchesSeed(existing, rule)) return false;

  const createdAt = normalizeText(existing?.createdAt, rule.createdAt);
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
      rule.id,
      rule.orgId,
      rule.resourceId,
      rule.weekday,
      rule.startTime,
      rule.endTime,
      rule.breaksJson,
      createdAt,
      rule.updatedAt,
      rule.deletedAt
    );
  appendSyncOutboxRecord('availability_rules', rule.id, 'upsert', toAvailabilityRuleSyncPayload(rule), dbInstance);
  return true;
}

function seedWebsiteValueOptions(dbInstance) {
  const insert = dbInstance.prepare(`INSERT OR IGNORE INTO ${VALUE_TABLE} (value) VALUES (?)`);
  WEBSITE_SERVICES.map(websiteValueOptionForService).forEach((value) => insert.run(value));
}

function seedWebsiteCatalog(dbInstance) {
  if (!dbInstance) return;
  const apply = dbInstance.transaction(() => {
    WEBSITE_SERVICES.forEach((service, index) => upsertWebsiteServiceSeed(dbInstance, service, index));
    WEBSITE_RESOURCES.forEach((resource, index) => {
      upsertWebsiteResourceSeed(dbInstance, resource, index);
      upsertWebsiteResourceServicesSeed(dbInstance, resource);
      websiteAvailabilityRules(resource.id, index).forEach((rule) => upsertWebsiteAvailabilityRuleSeed(dbInstance, rule));
    });
    seedWebsiteValueOptions(dbInstance);
  });
  apply();
}

function websiteCatalogSummary(dbInstance) {
  if (!dbInstance) return { services: 0, resources: 0, availabilityRules: 0, valueOptions: 0, pendingSync: 0 };
  return {
    services: Number(dbInstance.prepare('SELECT COUNT(*) AS count FROM services WHERE id IN (' + WEBSITE_SERVICES.map(() => '?').join(',') + ')').get(...WEBSITE_SERVICES.map((item) => item.id))?.count || 0),
    resources: Number(dbInstance.prepare('SELECT COUNT(*) AS count FROM resources WHERE id IN (' + WEBSITE_RESOURCES.map(() => '?').join(',') + ')').get(...WEBSITE_RESOURCES.map((item) => item.id))?.count || 0),
    availabilityRules: Number(
      dbInstance
        .prepare('SELECT COUNT(*) AS count FROM availability_rules WHERE id LIKE ?')
        .get('website-rule-%')?.count || 0
    ),
    valueOptions: Number(
      dbInstance
        .prepare(`SELECT COUNT(*) AS count FROM ${VALUE_TABLE} WHERE value IN (${WEBSITE_SERVICES.map(() => '?').join(',')})`)
        .get(...WEBSITE_SERVICES.map(websiteValueOptionForService))?.count || 0
    ),
    pendingSync: Number(
      dbInstance
        .prepare('SELECT COUNT(*) AS count FROM sync_outbox WHERE ackAt IS NULL')
        .get()?.count || 0
    )
  };
}

function ensureSchema(dbInstance) {
  dbInstance.prepare(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      expires TEXT,
      note TEXT,
      phone TEXT,
      expiryNotificationSentAt TEXT,
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
  if (!columns.has('phone')) {
    dbInstance.prepare('ALTER TABLE vouchers ADD COLUMN phone TEXT').run();
  }
  if (!columns.has('expiryNotificationSentAt')) {
    dbInstance.prepare('ALTER TABLE vouchers ADD COLUMN expiryNotificationSentAt TEXT').run();
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
      `CREATE TABLE IF NOT EXISTS reservation_email_confirmations (
        bookingId TEXT PRIMARY KEY,
        customerEmail TEXT,
        slotState TEXT,
        sentAt TEXT NOT NULL,
        responseJson TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`
    )
    .run();

  dbInstance
    .prepare(
      `CREATE TABLE IF NOT EXISTS reservation_apology_emails (
        bookingId TEXT PRIMARY KEY,
        customerEmail TEXT,
        slotState TEXT,
        alternativesJson TEXT,
        sentAt TEXT NOT NULL,
        responseJson TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
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
    .prepare('CREATE INDEX IF NOT EXISTS idx_reservation_email_confirmations_sent ON reservation_email_confirmations(sentAt)')
    .run();
  dbInstance
    .prepare('CREATE INDEX IF NOT EXISTS idx_reservation_apology_emails_sent ON reservation_apology_emails(sentAt)')
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
      "UPDATE services SET currency = 'BGN' WHERE currency IS NULL OR TRIM(currency) = ''"
    )
    .run();
  seedWebsiteCatalog(dbInstance);
}

function normalizeServiceInput(service, existing = null) {
  const now = new Date().toISOString();
  const id = normalizeId(service?.id) || existing?.id || generateUuid();
  const createdAt = normalizeText(service?.createdAt, existing?.createdAt || now);
  const updatedAt = now;
  const name = normalizeText(service?.name, existing?.name || '');
  const durationMin = normalizePositiveInteger(service?.durationMin, existing?.durationMin ?? 30);
  const priceCents = normalizeInteger(service?.priceCents, existing?.priceCents ?? 0);
  const currency = normalizeCurrencyCode(service?.currency || existing?.currency, 'BGN');
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
      const now = new Date().toISOString();
      const apply = dbInstance.transaction((targetResourceId, ids) => {
        dbInstance.prepare('DELETE FROM resource_services WHERE resourceId = ?').run(targetResourceId);
        const insert = dbInstance.prepare('INSERT INTO resource_services (resourceId, serviceId) VALUES (?, ?)');
        ids.forEach((serviceId) => {
          insert.run(targetResourceId, serviceId);
        });
      });
      apply(rid, normalizedServiceIds);
      appendSyncOutboxRecord(
        'resource_services',
        rid,
        'upsert',
        toResourceServicesSyncPayload(rid, normalizedServiceIds, now),
        dbInstance
      );
      return normalizedServiceIds;
    }

    const now = new Date().toISOString();
    const state = readReposFallbackState();
    state.resourceServices[rid] = normalizedServiceIds;
    writeReposFallbackState(state);
    appendSyncOutboxRecord(
      'resource_services',
      rid,
      'upsert',
      toResourceServicesSyncPayload(rid, normalizedServiceIds, now),
      null
    );
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
      const mapped = mapAvailabilityRuleRow(saved);
      appendSyncOutboxRecord(
        'availability_rules',
        mapped.id,
        'upsert',
        toAvailabilityRuleSyncPayload(mapped),
        dbInstance
      );
      return mapped;
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
    const mapped = mapAvailabilityRuleRow(normalized);
    appendSyncOutboxRecord('availability_rules', mapped.id, 'upsert', toAvailabilityRuleSyncPayload(mapped), null);
    return mapped;
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
      const deleted = info.changes > 0;
      if (deleted) {
        appendSyncOutboxRecord('availability_rules', targetId, 'delete', { id: targetId, deletedAt: now }, dbInstance);
      }
      return deleted;
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
    appendSyncOutboxRecord('availability_rules', targetId, 'delete', { id: targetId, deletedAt: now }, null);
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

      const saved = dbInstance
        .prepare(
          `SELECT id, orgId, resourceId, date, isOff, startTime, endTime, note, createdAt, updatedAt, deletedAt
           FROM availability_exceptions
           WHERE id = ?
           LIMIT 1`
        )
        .get(normalized.id);
      appendSyncOutboxRecord(
        'availability_exceptions',
        saved.id,
        'upsert',
        toAvailabilityExceptionSyncPayload(saved),
        dbInstance
      );
      return saved;
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
    appendSyncOutboxRecord(
      'availability_exceptions',
      normalized.id,
      'upsert',
      toAvailabilityExceptionSyncPayload(normalized),
      null
    );
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
      const deleted = info.changes > 0;
      if (deleted) {
        appendSyncOutboxRecord('availability_exceptions', targetId, 'delete', { id: targetId, deletedAt: now }, dbInstance);
      }
      return deleted;
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
    appendSyncOutboxRecord('availability_exceptions', targetId, 'delete', { id: targetId, deletedAt: now }, null);
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

  checkSlot(id) {
    return checkBookingSlotStatus(this.get(id));
  },

  checkSlots(ids = []) {
    const wanted = new Set(uniqueIds(ids));
    const rows = wanted.size > 0 ? uniqueIds(ids).map((id) => this.get(id)).filter(Boolean) : this.list({}, []);
    return rows.map((booking) => checkBookingSlotStatus(booking));
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

function isNonBlockingBookingStatus(status) {
  const normalized = normalizeBookingStatus(status, '').toLowerCase();
  return normalized === 'cancelled' || normalized === 'canceled';
}

function bookingConflictSummary(booking) {
  if (!booking) return null;
  const customer = customers.get(booking.customerId);
  return {
    id: booking.id,
    startAt: booking.startAt,
    endAt: booking.endAt,
    status: booking.status,
    customerName: customer?.name || booking.customerId || ''
  };
}

function localDayRangeIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) return { from: '', to: '' };
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, 0);
  return {
    from: start.toISOString(),
    to: end.toISOString()
  };
}

function checkBookingSlotStatus(booking) {
  if (!booking) {
    return {
      bookingId: '',
      state: 'missing',
      isFree: false,
      reason: 'Reservation was not found',
      conflicts: []
    };
  }

  const bookingId = normalizeId(booking.id);
  const serviceId = normalizeId(booking.serviceId);
  const resourceId = normalizeId(booking.resourceId);
  const startAt = normalizeIsoDateTime(booking.startAt, '');
  const endAt = normalizeIsoDateTime(booking.endAt, '');
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (!serviceId || !resourceId || !startAt || !endAt || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return {
      bookingId,
      state: 'invalid',
      isFree: false,
      reason: 'Reservation is missing service, resource, start, or end data',
      conflicts: []
    };
  }

  if (end <= start) {
    return {
      bookingId,
      state: 'invalid',
      isFree: false,
      reason: 'Reservation end time must be after start time',
      conflicts: []
    };
  }

  if (!services.get(serviceId)) {
    return {
      bookingId,
      state: 'invalid',
      isFree: false,
      reason: 'Reservation service was not found locally',
      conflicts: []
    };
  }

  if (!resources.get(resourceId)) {
    return {
      bookingId,
      state: 'invalid',
      isFree: false,
      reason: 'Reservation resource was not found locally',
      conflicts: []
    };
  }

  const conflicts = bookings
    .list({ from: startAt, to: endAt }, [resourceId])
    .filter((item) => item.id !== bookingId && !isNonBlockingBookingStatus(item.status))
    .map(bookingConflictSummary)
    .filter(Boolean);

  if (conflicts.length > 0) {
    return {
      bookingId,
      state: 'conflict',
      isFree: false,
      reason: `${conflicts.length} overlapping reservation(s) found`,
      conflicts
    };
  }

  const dateKey = localDateKeyFromDate(start);
  const dayRange = localDayRangeIso(start);
  let rules = availability.listRules(resourceId);
  if (!Array.isArray(rules) || rules.length === 0) {
    rules = buildDefaultAvailabilityRules(resourceId);
  }
  const exceptions = availability.listExceptions(resourceId, dateKey, dateKey);
  const sameDayBookings = bookings
    .list(dayRange, [resourceId])
    .filter((item) => item.id !== bookingId && !isNonBlockingBookingStatus(item.status));
  const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  const slots = computeAvailableSlots({
    rules,
    exceptions,
    bookings: sameDayBookings,
    serviceDurationMin: durationMin,
    dateRange: { from: dateKey, to: dateKey },
    slotStepMin: 1,
    includeEndAt: true
  });
  const requestedSlotExists = slots.some(
    (slot) => normalizeIsoDateTime(slot?.startAt, '') === startAt && normalizeIsoDateTime(slot?.endAt, '') === endAt
  );

  if (!requestedSlotExists) {
    return {
      bookingId,
      state: 'unavailable',
      isFree: false,
      reason: 'The requested time is outside the local availability calendar',
      conflicts: []
    };
  }

  return {
    bookingId,
    state: 'free',
    isFree: true,
    reason: 'Slot is free in the local calendar',
    conflicts: []
  };
}

function normalizeAlternativeSlots(slots = []) {
  return (Array.isArray(slots) ? slots : [])
    .map((slot) => {
      const startAt = normalizeIsoDateTime(slot?.startAt, '');
      const endAt = normalizeIsoDateTime(slot?.endAt, '');
      if (!startAt || !endAt || startAt >= endAt) return null;
      return {
        startAt,
        endAt,
        serviceName: normalizeOptionalText(slot?.serviceName, null),
        resourceName: normalizeOptionalText(slot?.resourceName, null)
      };
    })
    .filter(Boolean);
}

function findAlternativeSlotsForBooking(booking, limit = 4) {
  if (!booking) return [];
  const serviceId = normalizeId(booking.serviceId);
  const resourceId = normalizeId(booking.resourceId);
  const startAt = normalizeIsoDateTime(booking.startAt, '');
  const endAt = normalizeIsoDateTime(booking.endAt, '');
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (!serviceId || !resourceId || !startAt || !endAt || Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) {
    return [];
  }

  const service = services.get(serviceId);
  const resource = resources.get(resourceId);
  if (!service || !resource) return [];

  const requestedDate = localDateKeyFromDate(start);
  const today = localDateKeyFromDate(new Date());
  const fromDate = requestedDate && requestedDate > today ? requestedDate : today;
  const toDate = addDaysToDateText(fromDate, 21);
  if (!fromDate || !toDate) return [];

  let rules = availability.listRules(resourceId);
  if (!Array.isArray(rules) || rules.length === 0) {
    rules = buildDefaultAvailabilityRules(resourceId);
  }
  const exceptions = availability.listExceptions(resourceId, fromDate, toDate);
  const rangeEndDate = addDaysToDateText(toDate, 1);
  const existingBookings = bookings
    .list({ from: `${fromDate}T00:00:00.000Z`, to: `${rangeEndDate}T00:00:00.000Z` }, [resourceId])
    .filter((item) => item.id !== booking.id && !isNonBlockingBookingStatus(item.status));
  const durationMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  const rawSlots = computeAvailableSlots({
    rules,
    exceptions,
    bookings: existingBookings,
    serviceDurationMin: durationMin,
    dateRange: { from: fromDate, to: toDate },
    slotStepMin: WEBSITE_SLOT_STEP_MIN,
    includeEndAt: true
  });

  return normalizeAlternativeSlots(rawSlots)
    .filter((slot) => slot.startAt !== startAt)
    .slice(0, Math.max(1, normalizeLimit(limit, 4)))
    .map((slot) => ({
      ...slot,
      serviceName: service.name,
      resourceName: resource.name
    }));
}

const reservationEmailConfirmations = {
  list(ids = []) {
    const wanted = uniqueIds(ids);
    const dbInstance = getDb();
    if (dbInstance) {
      let query = `SELECT bookingId, customerEmail, slotState, sentAt, responseJson, createdAt, updatedAt
                   FROM reservation_email_confirmations`;
      const params = [];
      if (wanted.length > 0) {
        query += ` WHERE bookingId IN (${wanted.map(() => '?').join(',')})`;
        params.push(...wanted);
      }
      query += ' ORDER BY sentAt DESC';
      return dbInstance.prepare(query).all(...params).map((row) => ({
        ...row,
        response: parseSyncPayloadJson(row.responseJson)
      }));
    }

    const state = readReposFallbackState();
    const rows = Array.isArray(state.reservationEmailConfirmations) ? state.reservationEmailConfirmations : [];
    return rows
      .filter((row) => wanted.length === 0 || wanted.includes(row.bookingId))
      .map((row) => ({ ...row, response: parseSyncPayloadJson(row.responseJson) }));
  },

  save({ bookingId, customerEmail, slotState, sentAt, response } = {}) {
    const id = normalizeId(bookingId);
    if (!id) throw new Error('bookingId is required');
    const now = new Date().toISOString();
    const row = {
      bookingId: id,
      customerEmail: normalizeOptionalText(customerEmail, null),
      slotState: normalizeText(slotState, 'free'),
      sentAt: normalizeIsoDateTime(sentAt, now),
      responseJson: toSyncPayloadJson(response || {}),
      createdAt: now,
      updatedAt: now
    };
    const dbInstance = getDb();
    if (dbInstance) {
      const existing =
        dbInstance
          .prepare('SELECT createdAt FROM reservation_email_confirmations WHERE bookingId = ? LIMIT 1')
          .get(row.bookingId) || null;
      dbInstance
        .prepare(
          `INSERT INTO reservation_email_confirmations (bookingId, customerEmail, slotState, sentAt, responseJson, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(bookingId) DO UPDATE SET
             customerEmail = excluded.customerEmail,
             slotState = excluded.slotState,
             sentAt = excluded.sentAt,
             responseJson = excluded.responseJson,
             updatedAt = excluded.updatedAt`
        )
        .run(
          row.bookingId,
          row.customerEmail,
          row.slotState,
          row.sentAt,
          row.responseJson,
          existing?.createdAt || row.createdAt,
          row.updatedAt
        );
      return {
        ...row,
        createdAt: existing?.createdAt || row.createdAt,
        response: response || {}
      };
    }

    const state = readReposFallbackState();
    const rows = Array.isArray(state.reservationEmailConfirmations) ? state.reservationEmailConfirmations : [];
    const index = rows.findIndex((item) => item.bookingId === row.bookingId);
    if (index >= 0) {
      row.createdAt = rows[index].createdAt || row.createdAt;
      rows[index] = row;
    } else {
      rows.unshift(row);
    }
    state.reservationEmailConfirmations = rows;
    writeReposFallbackState(state);
    return { ...row, response: response || {} };
  }
};

const reservationApologyEmails = {
  list(ids = []) {
    const wanted = uniqueIds(ids);
    const dbInstance = getDb();
    if (dbInstance) {
      let query = `SELECT bookingId, customerEmail, slotState, alternativesJson, sentAt, responseJson, createdAt, updatedAt
                   FROM reservation_apology_emails`;
      const params = [];
      if (wanted.length > 0) {
        query += ` WHERE bookingId IN (${wanted.map(() => '?').join(',')})`;
        params.push(...wanted);
      }
      query += ' ORDER BY sentAt DESC';
      return dbInstance.prepare(query).all(...params).map((row) => ({
        ...row,
        alternatives: normalizeAlternativeSlots(parseSyncPayloadJson(row.alternativesJson)?.items),
        response: parseSyncPayloadJson(row.responseJson)
      }));
    }

    const state = readReposFallbackState();
    const rows = Array.isArray(state.reservationApologyEmails) ? state.reservationApologyEmails : [];
    return rows
      .filter((row) => wanted.length === 0 || wanted.includes(row.bookingId))
      .map((row) => ({
        ...row,
        alternatives: normalizeAlternativeSlots(parseSyncPayloadJson(row.alternativesJson)?.items),
        response: parseSyncPayloadJson(row.responseJson)
      }));
  },

  save({ bookingId, customerEmail, slotState, alternatives = [], sentAt, response } = {}) {
    const id = normalizeId(bookingId);
    if (!id) throw new Error('bookingId is required');
    const now = new Date().toISOString();
    const row = {
      bookingId: id,
      customerEmail: normalizeOptionalText(customerEmail, null),
      slotState: normalizeText(slotState, 'conflict'),
      alternativesJson: toSyncPayloadJson({ items: normalizeAlternativeSlots(alternatives) }),
      sentAt: normalizeIsoDateTime(sentAt, now),
      responseJson: toSyncPayloadJson(response || {}),
      createdAt: now,
      updatedAt: now
    };
    const dbInstance = getDb();
    if (dbInstance) {
      const existing =
        dbInstance
          .prepare('SELECT createdAt FROM reservation_apology_emails WHERE bookingId = ? LIMIT 1')
          .get(row.bookingId) || null;
      dbInstance
        .prepare(
          `INSERT INTO reservation_apology_emails (bookingId, customerEmail, slotState, alternativesJson, sentAt, responseJson, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(bookingId) DO UPDATE SET
             customerEmail = excluded.customerEmail,
             slotState = excluded.slotState,
             alternativesJson = excluded.alternativesJson,
             sentAt = excluded.sentAt,
             responseJson = excluded.responseJson,
             updatedAt = excluded.updatedAt`
        )
        .run(
          row.bookingId,
          row.customerEmail,
          row.slotState,
          row.alternativesJson,
          row.sentAt,
          row.responseJson,
          existing?.createdAt || row.createdAt,
          row.updatedAt
        );
      return {
        ...row,
        createdAt: existing?.createdAt || row.createdAt,
        alternatives: normalizeAlternativeSlots(alternatives),
        response: response || {}
      };
    }

    const state = readReposFallbackState();
    const rows = Array.isArray(state.reservationApologyEmails) ? state.reservationApologyEmails : [];
    const index = rows.findIndex((item) => item.bookingId === row.bookingId);
    if (index >= 0) {
      row.createdAt = rows[index].createdAt || row.createdAt;
      rows[index] = row;
    } else {
      rows.unshift(row);
    }
    state.reservationApologyEmails = rows;
    writeReposFallbackState(state);
    return { ...row, alternatives: normalizeAlternativeSlots(alternatives), response: response || {} };
  }
};

function prepareReservationApologyEmail(bookingId) {
  const id = normalizeId(bookingId);
  if (!id) throw new Error('bookingId is required');
  const booking = bookings.get(id);
  if (!booking) throw new Error('Reservation was not found locally');
  const customer = customers.get(booking.customerId);
  if (!customer?.email) throw new Error('Customer email is required before sending apology email');
  const slot = checkBookingSlotStatus(booking);
  if (slot.isFree) {
    throw new Error('Slot is free. Use Confirm & Email instead.');
  }
  const alternatives = findAlternativeSlotsForBooking(booking, 4);
  if (!alternatives.length) {
    throw new Error('No alternative free slots found in the next 21 days.');
  }
  return {
    bookingId: id,
    customerEmail: customer.email,
    customerName: customer.name || '',
    slot,
    alternatives
  };
}

async function confirmReservationEmail(bookingId) {
  const id = normalizeId(bookingId);
  if (!id) throw new Error('bookingId is required');
  const booking = bookings.get(id);
  if (!booking) throw new Error('Reservation was not found locally');
  const customer = customers.get(booking.customerId);
  if (!customer?.email) throw new Error('Customer email is required before sending confirmation');

  const slot = checkBookingSlotStatus(booking);
  if (!slot.isFree) {
    throw new Error(slot.reason || 'Slot is not free');
  }

  const settings = await readSettings();
  const config = extractSyncSettings(settings || {});
  if (!config.baseUrl) throw new Error('sync.baseUrl is required in settings.json');
  if (!config.email || !config.password) throw new Error('sync.email and sync.password are required in settings.json');

  const auth = await syncLoginRequest(config.baseUrl, {
    email: config.email,
    password: config.password,
    orgId: config.orgId
  });

  const response = await requestJson(buildSyncUrl(config.baseUrl, `/reservations/${encodeURIComponent(id)}/confirm-email`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  if (!response?.ok) {
    throw new Error(response?.error || 'Customer confirmation email was not sent');
  }

  const data = response.data || {};
  const saved = reservationEmailConfirmations.save({
    bookingId: id,
    customerEmail: customer.email,
    slotState: slot.state,
    sentAt: data.sentAt || new Date().toISOString(),
    response: data
  });

  return {
    bookingId: id,
    customerEmail: customer.email,
    slot,
    confirmation: saved,
    response: data
  };
}

async function sendReservationApologyEmail(bookingId, alternativesInput = []) {
  const id = normalizeId(bookingId);
  if (!id) throw new Error('bookingId is required');
  const booking = bookings.get(id);
  if (!booking) throw new Error('Reservation was not found locally');
  const customer = customers.get(booking.customerId);
  if (!customer?.email) throw new Error('Customer email is required before sending apology email');

  const prepared = prepareReservationApologyEmail(id);
  const providedAlternatives = normalizeAlternativeSlots(alternativesInput);
  const alternatives = providedAlternatives.length > 0 ? providedAlternatives : prepared.alternatives;
  if (!alternatives.length) {
    throw new Error('At least one alternative free slot is required before sending apology email');
  }

  const settings = await readSettings();
  const config = extractSyncSettings(settings || {});
  if (!config.baseUrl) throw new Error('sync.baseUrl is required in settings.json');
  if (!config.email || !config.password) throw new Error('sync.email and sync.password are required in settings.json');

  const auth = await syncLoginRequest(config.baseUrl, {
    email: config.email,
    password: config.password,
    orgId: config.orgId
  });

  const response = await requestJson(buildSyncUrl(config.baseUrl, `/reservations/${encodeURIComponent(id)}/apology-email`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.token}` },
    body: { alternatives }
  });
  if (!response?.ok) {
    throw new Error(response?.error || 'Customer apology email was not sent');
  }

  const data = response.data || {};
  const saved = reservationApologyEmails.save({
    bookingId: id,
    customerEmail: customer.email,
    slotState: prepared.slot.state,
    alternatives,
    sentAt: data.sentAt || new Date().toISOString(),
    response: data
  });

  return {
    bookingId: id,
    customerEmail: customer.email,
    slot: prepared.slot,
    alternatives,
    apology: saved,
    response: data
  };
}

function normalizeSyncBaseUrl(value) {
  const raw = normalizeText(value, '');
  if (!raw) return '';
  const trimmed = raw.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

function extractSyncSettings(settings) {
  const syncSettings =
    settings?.sync && typeof settings.sync === 'object' && !Array.isArray(settings.sync) ? settings.sync : {};
  const baseUrl = normalizeSyncBaseUrl(
    syncSettings.baseUrl || settings?.syncBaseUrl || settings?.serverBaseUrl || settings?.baseUrl || ''
  );
  const email = normalizeText(syncSettings.email || settings?.syncEmail || settings?.email || '', '');
  const password = normalizeText(syncSettings.password || settings?.syncPassword || settings?.password || '', '');
  const orgId = normalizeText(syncSettings.orgId || settings?.syncOrgId || settings?.orgId || '', '');
  return { baseUrl, email, password, orgId };
}

function buildSyncUrl(baseUrl, pathname, searchParams = null) {
  const url = new URL(pathname, baseUrl);
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.set(key, String(value));
    });
  }
  return url.toString();
}

function summarizeSyncDetails(details) {
  if (!details || typeof details !== 'object') return '';
  const provider = normalizeText(details.provider, '');
  const reason = normalizeText(details.reason, '');
  const failedKinds = Array.isArray(details.failedKinds)
    ? details.failedKinds.map((item) => normalizeText(item, '')).filter(Boolean)
    : [];
  const errors = Array.isArray(details.errors)
    ? details.errors
        .map((item) => normalizeText(item?.message || item, ''))
        .filter(Boolean)
    : [];

  if (provider || failedKinds.length || errors.length || reason) {
    const providerText = provider ? provider.toUpperCase() : 'email provider';
    const kindText = failedKinds.length ? ` (${failedKinds.join(', ')})` : '';
    const uniqueErrors = Array.from(new Set(errors));
    const connectionRefused = uniqueErrors.find((message) => /ECONNREFUSED/i.test(message));
    if (connectionRefused) {
      return `Email delivery failed via ${providerText}${kindText}: SMTP connection was refused. Start a local SMTP catcher on port 1025 for testing, or configure real SMTP/Resend credentials in the AdventureWebsite API.`;
    }
    const errorText = uniqueErrors.length ? uniqueErrors.join('; ') : reason;
    return `Email delivery failed via ${providerText}${kindText}${errorText ? `: ${errorText}` : ''}`;
  }

  return '';
}

function buildSyncErrorMessage(response, data, fallback = '') {
  const parts = [];
  const status = Number(response?.status || 0);
  if (status > 0) {
    parts.push(`HTTP ${status}`);
  }

  const errorCode = normalizeText(data?.error, '');
  const message = normalizeText(data?.message, '');
  if (message) {
    parts.push(message);
  } else if (errorCode) {
    parts.push(errorCode);
  }

  if (Array.isArray(data?.issues) && data.issues.length > 0) {
    const issues = data.issues
      .map((issue) => {
        const path = normalizeText(issue?.path, '');
        const issueMessage = normalizeText(issue?.message, '');
        if (path && issueMessage) return `${path}: ${issueMessage}`;
        return issueMessage || path;
      })
      .filter(Boolean);
    if (issues.length > 0) {
      parts.push(issues.join('; '));
    }
  }

  if (data?.details && typeof data.details === 'object') {
    const summary = summarizeSyncDetails(data.details);
    if (summary) {
      parts.push(summary);
      const combined = parts.filter(Boolean).join(' | ');
      return combined || fallback || 'Request failed';
    }
    try {
      const details = JSON.stringify(data.details);
      if (details && details !== '{}') {
        parts.push(details);
      }
    } catch {}
  }

  const combined = parts.filter(Boolean).join(' | ');
  return combined || fallback || 'Request failed';
}

function describeSyncNetworkError(url, error) {
  let target = String(url || '');
  try {
    const parsed = new URL(target);
    target = `${parsed.origin}${parsed.pathname}`;
  } catch {}

  const code = normalizeText(error?.cause?.code || error?.code || '', '');
  const causeMessage = normalizeText(error?.cause?.message || error?.message || '', '');
  const codeText = code ? ` ${code}` : '';
  const messageText = causeMessage ? `: ${causeMessage}` : '';
  let hint = 'Check sync.baseUrl and make sure the AdventureWebsite API is running.';

  if (code === 'ECONNREFUSED') {
    hint = 'Nothing is listening at that address. Start the AdventureWebsite API or update sync.baseUrl.';
  } else if (code === 'ENOTFOUND') {
    hint = 'The host name could not be resolved. Check sync.baseUrl.';
  } else if (code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'SELF_SIGNED_CERT_IN_CHAIN') {
    hint = 'The HTTPS certificate is not trusted by Electron.';
  }

  return `Network error${codeText} while connecting to ${target}${messageText}. ${hint}`;
}

async function requestJson(url, { method = 'GET', headers = {}, body } = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch is not available in this runtime');
  }
  const options = {
    method,
    headers: {
      Accept: 'application/json',
      ...headers
    }
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error(describeSyncNetworkError(url, err));
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = buildSyncErrorMessage(response, data, `Request failed (${response.status})`);
    throw new Error(message);
  }
  return data;
}

async function syncLoginRequest(baseUrl, { email, password, orgId }) {
  const url = buildSyncUrl(baseUrl, '/auth/login');
  const payload = { email, password };
  if (orgId) payload.orgId = orgId;
  const data = await requestJson(url, { method: 'POST', body: payload });
  if (!data?.token) {
    throw new Error(data?.error || 'Sync login failed');
  }
  return data;
}

function getSyncStateRow(dbInstance) {
  if (dbInstance) {
    const row = ensureSyncStateRowDb(dbInstance, '');
    return {
      lastPullToken: normalizeText(row?.lastPullToken, ''),
      updatedAt: normalizeText(row?.updatedAt, '')
    };
  }
  const state = readReposFallbackState();
  return {
    lastPullToken: normalizeText(state?.syncState?.lastPullToken, ''),
    updatedAt: normalizeText(state?.syncState?.updatedAt, '')
  };
}

function updateSyncStateRow(dbInstance, { lastPullToken = '', updatedAt = '' } = {}) {
  const stamp = normalizeText(updatedAt, new Date().toISOString());
  const tokenText = normalizeText(lastPullToken, '');
  if (dbInstance) {
    ensureSyncStateRowDb(dbInstance, stamp);
    dbInstance
      .prepare(
        `UPDATE sync_state
         SET lastPullToken = ?, updatedAt = ?
         WHERE id = ?`
      )
      .run(tokenText, stamp, SYNC_STATE_ID);
    return;
  }

  const state = readReposFallbackState();
  state.syncState = {
    id: SYNC_STATE_ID,
    lastPullToken: tokenText,
    updatedAt: stamp
  };
  writeReposFallbackState(state);
}

function countLocalActiveBookings(dbInstance) {
  if (dbInstance) {
    return Number(
      dbInstance
        .prepare(
          `SELECT COUNT(1) AS count
           FROM bookings
           WHERE orgId = ?
             AND COALESCE(TRIM(deletedAt), '') = ''`
        )
        .get(normalizeOrgId())?.count || 0
    );
  }

  const state = readReposFallbackState();
  return (Array.isArray(state.bookings) ? state.bookings : []).filter(
    (item) => item?.orgId === normalizeOrgId() && !normalizeDeletedAt(item?.deletedAt, null)
  ).length;
}

function listPendingOutboxRows(dbInstance, limit = 200) {
  const safeLimit = normalizeLimit(limit, 200);
  if (dbInstance) {
    const rows = dbInstance
      .prepare(
        `SELECT id, entityType, entityId, op, payloadJson, createdAt, sentAt, ackAt, error
         FROM sync_outbox
         WHERE ackAt IS NULL
           AND COALESCE(TRIM(error), '') = ''
         ORDER BY createdAt ASC
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
    .filter((row) => !row?.ackAt && String(row?.error || '').trim() === '')
    .sort((a, b) => String(a?.createdAt || '').localeCompare(String(b?.createdAt || '')))
    .slice(0, safeLimit);
  return rows.map((row) => ({
    ...row,
    payload: parseSyncPayloadJson(row.payloadJson)
  }));
}

function markOutboxSent(dbInstance, ids, sentAt = '') {
  const stamp = normalizeText(sentAt, new Date().toISOString());
  const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (targetIds.length === 0) return;

  if (dbInstance) {
    const stmt = dbInstance.prepare('UPDATE sync_outbox SET sentAt = ? WHERE id = ?');
    const tx = dbInstance.transaction((items) => {
      items.forEach((id) => {
        stmt.run(stamp, id);
      });
    });
    tx(targetIds);
    return;
  }

  const state = readReposFallbackState();
  state.syncOutbox = (Array.isArray(state.syncOutbox) ? state.syncOutbox : []).map((row) => {
    if (!targetIds.includes(row?.id)) return row;
    return { ...row, sentAt: stamp };
  });
  state.syncState = {
    id: SYNC_STATE_ID,
    lastPullToken: normalizeText(state?.syncState?.lastPullToken, ''),
    updatedAt: stamp
  };
  writeReposFallbackState(state);
}

function markOutboxAck(dbInstance, ids, ackAt = '') {
  const stamp = normalizeText(ackAt, new Date().toISOString());
  const targetIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (targetIds.length === 0) return;

  if (dbInstance) {
    const stmt = dbInstance.prepare('UPDATE sync_outbox SET ackAt = ?, error = NULL WHERE id = ?');
    const tx = dbInstance.transaction((items) => {
      items.forEach((id) => {
        stmt.run(stamp, id);
      });
    });
    tx(targetIds);
    return;
  }

  const state = readReposFallbackState();
  state.syncOutbox = (Array.isArray(state.syncOutbox) ? state.syncOutbox : []).map((row) => {
    if (!targetIds.includes(row?.id)) return row;
    return { ...row, ackAt: stamp, error: null };
  });
  state.syncState = {
    id: SYNC_STATE_ID,
    lastPullToken: normalizeText(state?.syncState?.lastPullToken, ''),
    updatedAt: stamp
  };
  writeReposFallbackState(state);
}

function markOutboxErrors(dbInstance, entries, updatedAt = '') {
  const stamp = normalizeText(updatedAt, new Date().toISOString());
  const list = Array.isArray(entries) ? entries.filter((entry) => entry && entry.id) : [];
  if (list.length === 0) return;

  if (dbInstance) {
    const stmt = dbInstance.prepare('UPDATE sync_outbox SET error = ?, sentAt = ? WHERE id = ?');
    const tx = dbInstance.transaction((items) => {
      items.forEach((entry) => {
        const message = normalizeText(entry.error, 'Sync error');
        stmt.run(message, stamp, entry.id);
      });
    });
    tx(list);
    return;
  }

  const state = readReposFallbackState();
  state.syncOutbox = (Array.isArray(state.syncOutbox) ? state.syncOutbox : []).map((row) => {
    const match = list.find((entry) => entry.id === row?.id);
    if (!match) return row;
    return { ...row, error: normalizeText(match.error, 'Sync error'), sentAt: stamp };
  });
  state.syncState = {
    id: SYNC_STATE_ID,
    lastPullToken: normalizeText(state?.syncState?.lastPullToken, ''),
    updatedAt: stamp
  };
  writeReposFallbackState(state);
}

function toLegacySyncOperation(row) {
  const entityType = normalizeText(row?.entityType, '');
  const payload = row?.payload && typeof row.payload === 'object' ? { ...row.payload } : {};
  let entityId = normalizeId(row?.entityId);

  if (entityType === 'vouchers' || entityType === 'voucher') {
    const syncVoucherId = toVoucherSyncEntityId(payload.id || entityId);
    if (syncVoucherId) {
      entityId = syncVoucherId;
      payload.id = syncVoucherId;
    }

    const code = normalizeText(payload.code || payload.VoucherCode || payload.Code, '');
    if (code) {
      payload.code = code;
    }
  }

  return {
    // AdventureWebsite currently validates legacy outbox ids under `id`.
    id: row.id,
    // Keep the original desktop field too for easier debugging and future compatibility.
    opId: row.id,
    entityType,
    entityId,
    op: row.op,
    payload
  };
}

function stringifyConflict(conflict) {
  if (!conflict || typeof conflict !== 'object') return 'Booking conflict';
  const reason = normalizeText(conflict.reason, '');
  const entityType = normalizeText(conflict.entityType, '');
  const entityId = normalizeText(conflict.entityId, '');
  const serverVersion = normalizeText(conflict.serverVersion, '');
  const parts = [];
  if (reason) parts.push(reason);
  if (entityType) parts.push(`entityType=${entityType}`);
  if (entityId) parts.push(`entityId=${entityId}`);
  if (serverVersion) parts.push(`serverVersion=${serverVersion}`);
  if (parts.length > 0) return parts.join(' | ');
  return normalizeText(conflict.message, 'Booking conflict');
}

function describeRemoteChangeWarning(change, entityType, payload, entityId) {
  if (entityType === 'booking' || entityType === 'bookings') {
    if (!normalizeId(payload?.serviceId)) {
      return `Skipped booking ${entityId || normalizeText(payload?.id, 'unknown')}: missing serviceId`;
    }
    if (!normalizeId(payload?.resourceId)) {
      return `Skipped booking ${entityId || normalizeText(payload?.id, 'unknown')}: missing resourceId`;
    }
    if (!normalizeId(payload?.customerId)) {
      return `Skipped booking ${entityId || normalizeText(payload?.id, 'unknown')}: missing customerId`;
    }
  }

  if (entityType === 'customer' || entityType === 'customers') {
    if (!normalizeText(payload?.name, '')) {
      return `Skipped customer ${entityId || normalizeText(payload?.id, 'unknown')}: missing name`;
    }
  }

  if (entityType === 'voucher' || entityType === 'vouchers') {
    if (!normalizeText(payload?.code || payload?.VoucherCode || payload?.Code, '')) {
      return `Skipped voucher ${entityId || normalizeText(payload?.id, 'unknown')}: missing code`;
    }
  }

  return `Skipped remote ${entityType || 'entity'} ${entityId || normalizeText(payload?.id, 'unknown')}`;
}

function applyRemoteServiceChangeDb(dbInstance, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();

  if (normalizedOp === 'delete') {
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    const info = dbInstance.prepare('UPDATE services SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(deletedAt, updatedAt, id);
    return info.changes > 0;
  }

  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, name, durationMin, priceCents, currency, isActive, createdAt, updatedAt, deletedAt
         FROM services
         WHERE id = ?
         LIMIT 1`
      )
      .get(id) || null;
  const merged = {
    id,
    orgId: normalizeOrgId(),
    name: normalizeText(payload?.name, existing?.name || ''),
    durationMin: normalizePositiveInteger(payload?.durationMin, existing?.durationMin ?? 30),
    priceCents: normalizeInteger(payload?.priceCents, existing?.priceCents ?? 0),
    currency: normalizeCurrencyCode(payload?.currency || existing?.currency, 'BGN'),
    isActive: normalizeFlag(payload?.isActive, existing?.isActive ?? 1),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };
  if (!merged.name) return false;

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
      merged.id,
      merged.orgId,
      merged.name,
      merged.durationMin,
      merged.priceCents,
      merged.currency,
      merged.isActive,
      merged.createdAt,
      merged.updatedAt,
      merged.deletedAt
    );
  return true;
}

function applyRemoteServiceChangeState(state, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const items = Array.isArray(state.services) ? state.services : [];
  const index = items.findIndex((item) => item.id === id);
  const existing = index >= 0 ? items[index] : null;

  if (normalizedOp === 'delete') {
    if (!existing) return false;
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    items[index] = { ...existing, deletedAt, updatedAt };
    state.services = items;
    return true;
  }

  const record = {
    id,
    orgId: normalizeOrgId(),
    name: normalizeText(payload?.name, existing?.name || ''),
    durationMin: normalizePositiveInteger(payload?.durationMin, existing?.durationMin ?? 30),
    priceCents: normalizeInteger(payload?.priceCents, existing?.priceCents ?? 0),
    currency: normalizeCurrencyCode(payload?.currency || existing?.currency, 'BGN'),
    isActive: normalizeFlag(payload?.isActive, existing?.isActive ?? 1),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };
  if (!record.name) return false;
  if (index >= 0) {
    items[index] = record;
  } else {
    items.unshift(record);
  }
  state.services = items;
  return true;
}

function applyRemoteResourceChangeDb(dbInstance, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();

  if (normalizedOp === 'delete') {
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    const info = dbInstance.prepare('UPDATE resources SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(deletedAt, updatedAt, id);
    return info.changes > 0;
  }

  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, name, type, isActive, createdAt, updatedAt, deletedAt
         FROM resources
         WHERE id = ?
         LIMIT 1`
      )
      .get(id) || null;
  const merged = {
    id,
    orgId: normalizeOrgId(),
    name: normalizeText(payload?.name, existing?.name || ''),
    type: normalizeText(payload?.type, existing?.type || 'employee'),
    isActive: normalizeFlag(payload?.isActive, existing?.isActive ?? 1),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };
  if (!merged.name) return false;

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
      merged.id,
      merged.orgId,
      merged.name,
      merged.type,
      merged.isActive,
      merged.createdAt,
      merged.updatedAt,
      merged.deletedAt
    );
  return true;
}

function applyRemoteResourceChangeState(state, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const items = Array.isArray(state.resources) ? state.resources : [];
  const index = items.findIndex((item) => item.id === id);
  const existing = index >= 0 ? items[index] : null;

  if (normalizedOp === 'delete') {
    if (!existing) return false;
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    items[index] = { ...existing, deletedAt, updatedAt };
    state.resources = items;
    return true;
  }

  const record = {
    id,
    orgId: normalizeOrgId(),
    name: normalizeText(payload?.name, existing?.name || ''),
    type: normalizeText(payload?.type, existing?.type || 'employee'),
    isActive: normalizeFlag(payload?.isActive, existing?.isActive ?? 1),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };
  if (!record.name) return false;
  if (index >= 0) {
    items[index] = record;
  } else {
    items.unshift(record);
  }
  state.resources = items;
  return true;
}

function applyRemoteResourceServicesChangeDb(dbInstance, op, payload, entityId) {
  const resourceId = normalizeId(payload?.resourceId || payload?.id || entityId);
  if (!resourceId) return false;
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const serviceIds = uniqueIds(
    Array.isArray(payload?.serviceIds)
      ? payload.serviceIds
      : Array.isArray(payload?.services)
        ? payload.services
        : payload?.serviceId
          ? [payload.serviceId]
          : []
  );

  const apply = dbInstance.transaction((rid, ids) => {
    dbInstance.prepare('DELETE FROM resource_services WHERE resourceId = ?').run(rid);
    if (normalizedOp === 'delete') return;
    const insert = dbInstance.prepare('INSERT INTO resource_services (resourceId, serviceId) VALUES (?, ?)');
    ids.forEach((serviceId) => {
      insert.run(rid, serviceId);
    });
  });
  apply(resourceId, serviceIds);
  return true;
}

function applyRemoteResourceServicesChangeState(state, op, payload, entityId) {
  const resourceId = normalizeId(payload?.resourceId || payload?.id || entityId);
  if (!resourceId) return false;
  const normalizedOp = normalizeText(op, '').toLowerCase();
  if (!state.resourceServices || typeof state.resourceServices !== 'object' || Array.isArray(state.resourceServices)) {
    state.resourceServices = {};
  }
  if (normalizedOp === 'delete') {
    delete state.resourceServices[resourceId];
    return true;
  }
  state.resourceServices[resourceId] = uniqueIds(
    Array.isArray(payload?.serviceIds)
      ? payload.serviceIds
      : Array.isArray(payload?.services)
        ? payload.services
        : payload?.serviceId
          ? [payload.serviceId]
          : []
  );
  return true;
}

function normalizeRemoteAvailabilityRule(payload, entityId, existing = null) {
  const now = new Date().toISOString();
  const id = normalizeId(payload?.id || entityId || existing?.id);
  const resourceId = normalizeId(payload?.resourceId || existing?.resourceId);
  const weekday = normalizeWeekday(payload?.weekday ?? existing?.weekday, -1);
  const startTime = normalizeTimeText(payload?.startTime ?? existing?.startTime, '');
  const endTime = normalizeTimeText(payload?.endTime ?? existing?.endTime, '');
  if (!id || !resourceId || weekday < 0 || !startTime || !endTime || startTime >= endTime) return null;
  const breaks = parseBreaksJsonArray(payload?.breaks ?? payload?.breaksJson ?? existing?.breaksJson ?? '[]')
    .map((item) => ({
      startTime: normalizeTimeText(item?.startTime ?? item?.start ?? '', ''),
      endTime: normalizeTimeText(item?.endTime ?? item?.end ?? '', '')
    }))
    .filter((item) => item.startTime && item.endTime);

  return {
    id,
    orgId: normalizeOrgId(),
    resourceId,
    weekday,
    startTime,
    endTime,
    breaksJson: JSON.stringify(breaks),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };
}

function applyRemoteAvailabilityRuleChangeDb(dbInstance, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();

  if (normalizedOp === 'delete') {
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    const info = dbInstance.prepare('UPDATE availability_rules SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(deletedAt, updatedAt, id);
    return info.changes > 0;
  }

  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, resourceId, weekday, startTime, endTime, breaksJson, createdAt, updatedAt, deletedAt
         FROM availability_rules
         WHERE id = ?
         LIMIT 1`
      )
      .get(id) || null;
  const record = normalizeRemoteAvailabilityRule(payload, id, existing);
  if (!record) return false;
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
      record.id,
      record.orgId,
      record.resourceId,
      record.weekday,
      record.startTime,
      record.endTime,
      record.breaksJson,
      record.createdAt,
      record.updatedAt,
      record.deletedAt
    );
  return true;
}

function applyRemoteAvailabilityRuleChangeState(state, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const items = Array.isArray(state.availabilityRules) ? state.availabilityRules : [];
  const index = items.findIndex((item) => item.id === id);
  const existing = index >= 0 ? items[index] : null;

  if (normalizedOp === 'delete') {
    if (!existing) return false;
    items[index] = { ...existing, updatedAt: normalizeText(payload?.updatedAt, now), deletedAt: normalizeDeletedAt(payload?.deletedAt, now) };
    state.availabilityRules = items;
    return true;
  }

  const record = normalizeRemoteAvailabilityRule(payload, id, existing);
  if (!record) return false;
  if (index >= 0) {
    items[index] = record;
  } else {
    items.unshift(record);
  }
  state.availabilityRules = items;
  return true;
}

function normalizeRemoteAvailabilityException(payload, entityId, existing = null) {
  const now = new Date().toISOString();
  const id = normalizeId(payload?.id || entityId || existing?.id);
  const resourceId = normalizeId(payload?.resourceId || existing?.resourceId);
  const date = normalizeDateText(payload?.date ?? existing?.date, '');
  const isOff = normalizeFlag(payload?.isOff ?? existing?.isOff, 1);
  const startTime = isOff ? null : normalizeTimeText(payload?.startTime ?? existing?.startTime, '');
  const endTime = isOff ? null : normalizeTimeText(payload?.endTime ?? existing?.endTime, '');
  if (!id || !resourceId || !date) return null;
  if (!isOff && (!startTime || !endTime || startTime >= endTime)) return null;

  return {
    id,
    orgId: normalizeOrgId(),
    resourceId,
    date,
    isOff,
    startTime,
    endTime,
    note: normalizeOptionalText(payload?.note, existing?.note || null),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };
}

function applyRemoteAvailabilityExceptionChangeDb(dbInstance, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();

  if (normalizedOp === 'delete') {
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    const info = dbInstance.prepare('UPDATE availability_exceptions SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(deletedAt, updatedAt, id);
    return info.changes > 0;
  }

  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, resourceId, date, isOff, startTime, endTime, note, createdAt, updatedAt, deletedAt
         FROM availability_exceptions
         WHERE id = ?
         LIMIT 1`
      )
      .get(id) || null;
  const record = normalizeRemoteAvailabilityException(payload, id, existing);
  if (!record) return false;
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
      record.id,
      record.orgId,
      record.resourceId,
      record.date,
      record.isOff,
      record.startTime,
      record.endTime,
      record.note,
      record.createdAt,
      record.updatedAt,
      record.deletedAt
    );
  return true;
}

function applyRemoteAvailabilityExceptionChangeState(state, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const items = Array.isArray(state.availabilityExceptions) ? state.availabilityExceptions : [];
  const index = items.findIndex((item) => item.id === id);
  const existing = index >= 0 ? items[index] : null;

  if (normalizedOp === 'delete') {
    if (!existing) return false;
    items[index] = { ...existing, updatedAt: normalizeText(payload?.updatedAt, now), deletedAt: normalizeDeletedAt(payload?.deletedAt, now) };
    state.availabilityExceptions = items;
    return true;
  }

  const record = normalizeRemoteAvailabilityException(payload, id, existing);
  if (!record) return false;
  if (index >= 0) {
    items[index] = record;
  } else {
    items.unshift(record);
  }
  state.availabilityExceptions = items;
  return true;
}

function applyRemoteCustomerChangeDb(dbInstance, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();

  if (normalizedOp === 'delete') {
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    const info = dbInstance.prepare('UPDATE customers SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(deletedAt, updatedAt, id);
    return info.changes > 0;
  }

  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, name, phone, email, notes, createdAt, updatedAt, deletedAt
         FROM customers
         WHERE id = ?
         LIMIT 1`
      )
      .get(id) || null;
  const merged = {
    id,
    orgId: normalizeOrgId(),
    name: normalizeText(payload?.name, existing?.name || ''),
    phone: normalizeOptionalText(payload?.phone, existing?.phone || null),
    email: normalizeOptionalText(payload?.email, existing?.email || null),
    notes: normalizeOptionalText(payload?.notes, existing?.notes || null),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };
  if (!merged.name) return false;

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
      merged.id,
      merged.orgId,
      merged.name,
      merged.phone,
      merged.email,
      merged.notes,
      merged.createdAt,
      merged.updatedAt,
      merged.deletedAt
    );
  return true;
}

function applyRemoteCustomerChangeState(state, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const items = Array.isArray(state.customers) ? state.customers : [];
  const index = items.findIndex((item) => item.id === id);
  const existing = index >= 0 ? items[index] : null;

  if (normalizedOp === 'delete') {
    if (!existing) return false;
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    items[index] = { ...existing, deletedAt, updatedAt };
    state.customers = items;
    return true;
  }

  const record = {
    id,
    orgId: normalizeOrgId(),
    name: normalizeText(payload?.name, existing?.name || ''),
    phone: normalizeOptionalText(payload?.phone, existing?.phone || null),
    email: normalizeOptionalText(payload?.email, existing?.email || null),
    notes: normalizeOptionalText(payload?.notes, existing?.notes || null),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };
  if (!record.name) return false;
  if (index >= 0) {
    items[index] = record;
  } else {
    items.unshift(record);
  }
  state.customers = items;
  return true;
}

function applyRemoteBookingChangeDb(dbInstance, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const existing =
    dbInstance
      .prepare(
        `SELECT id, orgId, serviceId, resourceId, customerId, startAt, endAt, status, note, source, voucherId, voucherCode, createdAt, updatedAt, deletedAt
         FROM bookings
         WHERE id = ?
         LIMIT 1`
      )
      .get(id) || null;

  if (normalizedOp === 'delete') {
    if (!existing) return false;
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    const info = dbInstance.prepare('UPDATE bookings SET deletedAt = ?, updatedAt = ? WHERE id = ?').run(deletedAt, updatedAt, id);
    return info.changes > 0;
  }

  const serviceId = normalizeId(payload?.serviceId || existing?.serviceId);
  const resourceId = normalizeId(payload?.resourceId || existing?.resourceId) || websiteResourceIdForService(serviceId);
  const merged = {
    id,
    orgId: normalizeOrgId(),
    serviceId,
    resourceId,
    customerId: normalizeId(payload?.customerId || existing?.customerId),
    startAt: normalizeIsoDateTime(payload?.startAt ?? existing?.startAt, ''),
    endAt: normalizeIsoDateTime(payload?.endAt ?? existing?.endAt, ''),
    status: normalizeBookingStatus(payload?.status, normalizeBookingStatus(existing?.status, 'confirmed')),
    note: normalizeOptionalText(payload?.note, existing?.note || null),
    source: normalizeBookingSource(payload?.source, existing?.source || 'sync'),
    voucherId: normalizeOptionalText(payload?.voucherId, existing?.voucherId || null),
    voucherCode: normalizeOptionalText(payload?.voucherCode, existing?.voucherCode || null),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };

  if (!merged.serviceId || !merged.resourceId || !merged.customerId || !merged.startAt || !merged.endAt) {
    return false;
  }
  if (merged.startAt >= merged.endAt) return false;

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
      merged.id,
      merged.orgId,
      merged.serviceId,
      merged.resourceId,
      merged.customerId,
      merged.startAt,
      merged.endAt,
      merged.status,
      merged.note,
      merged.source,
      merged.voucherId,
      merged.voucherCode,
      merged.createdAt,
      merged.updatedAt,
      merged.deletedAt
    );

  const saved =
    dbInstance
      .prepare(
        `SELECT id, orgId, serviceId, resourceId, customerId, startAt, endAt, status, note, source, voucherId, voucherCode, createdAt, updatedAt, deletedAt
         FROM bookings
         WHERE id = ?
         LIMIT 1`
      )
      .get(id) || null;
  if (saved) {
    maybeCreateBookingRedemption(existing, saved);
  }
  return true;
}

function applyRemoteBookingChangeState(state, op, payload, entityId) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const now = new Date().toISOString();
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const items = Array.isArray(state.bookings) ? state.bookings : [];
  const index = items.findIndex((item) => item.id === id);
  const existing = index >= 0 ? items[index] : null;

  if (normalizedOp === 'delete') {
    if (!existing) return false;
    const deletedAt = normalizeDeletedAt(payload?.deletedAt, now);
    const updatedAt = normalizeText(payload?.updatedAt, deletedAt);
    items[index] = { ...existing, deletedAt, updatedAt };
    state.bookings = items;
    return true;
  }

  const serviceId = normalizeId(payload?.serviceId || existing?.serviceId);
  const resourceId = normalizeId(payload?.resourceId || existing?.resourceId) || websiteResourceIdForService(serviceId);
  const record = {
    id,
    orgId: normalizeOrgId(),
    serviceId,
    resourceId,
    customerId: normalizeId(payload?.customerId || existing?.customerId),
    startAt: normalizeIsoDateTime(payload?.startAt ?? existing?.startAt, ''),
    endAt: normalizeIsoDateTime(payload?.endAt ?? existing?.endAt, ''),
    status: normalizeBookingStatus(payload?.status, normalizeBookingStatus(existing?.status, 'confirmed')),
    note: normalizeOptionalText(payload?.note, existing?.note || null),
    source: normalizeBookingSource(payload?.source, existing?.source || 'sync'),
    voucherId: normalizeOptionalText(payload?.voucherId, existing?.voucherId || null),
    voucherCode: normalizeOptionalText(payload?.voucherCode, existing?.voucherCode || null),
    createdAt: normalizeText(payload?.createdAt, existing?.createdAt || now),
    updatedAt: normalizeText(payload?.updatedAt, now),
    deletedAt: normalizeDeletedAt(payload?.deletedAt, existing?.deletedAt || null)
  };

  if (!record.serviceId || !record.resourceId || !record.customerId || !record.startAt || !record.endAt) {
    return false;
  }
  if (record.startAt >= record.endAt) return false;

  if (index >= 0) {
    items[index] = record;
  } else {
    items.unshift(record);
  }
  state.bookings = items;
  maybeCreateBookingRedemption(existing, record);
  return true;
}

function findVoucherStateIndexBySyncPayload(items, id, code) {
  const normalizedId = normalizeText(id, '');
  const normalizedCode = normalizeCode(code);
  return items.findIndex((item) => {
    if (normalizedId && String(item?.id || '') === normalizedId) return true;
    if (!normalizedCode) return false;
    const itemCode = normalizeCode(item?.data?.VoucherCode || item?.data?.Code || '');
    return itemCode === normalizedCode;
  });
}

async function applyRemoteVoucherChange({ op, payload, entityId } = {}, dbInstance) {
  const id = normalizeId(payload?.id || entityId);
  if (!id) return false;
  const normalizedOp = normalizeText(op, '').toLowerCase();
  const now = new Date().toISOString();
  const payloadCode = normalizeText(payload?.code, '');
  const normalizedPayloadCode = payloadCode ? normalizeNumericCode(payloadCode) : '';

  if (normalizedOp === 'delete') {
    const state = readVoucherState();
    const before = Array.isArray(state.items) ? state.items : [];
    const matchedItem =
      before.find((item) => {
        if (String(item?.id || '') === String(id)) return true;
        if (!normalizedPayloadCode) return false;
        const itemCode = normalizeCode(item?.data?.VoucherCode || item?.data?.Code || '');
        return itemCode === normalizeCode(normalizedPayloadCode);
      }) || null;
    const remaining = before.filter((item) => {
      if (String(item?.id || '') === String(id)) return false;
      if (!normalizedPayloadCode) return true;
      const itemCode = normalizeCode(item?.data?.VoucherCode || item?.data?.Code || '');
      return itemCode !== normalizeCode(normalizedPayloadCode);
    });
    if (remaining.length === before.length) return false;
    state.items = remaining;
    await writeVoucherState(state);
    const targetAssets = path.join(vouchersAssetsRoot(), matchedItem?.id || id);
    if (fs.existsSync(targetAssets)) {
      await fsp.rm(targetAssets, { recursive: true, force: true });
    }
    if (dbInstance) {
      if (normalizedPayloadCode) {
        dbInstance.prepare('DELETE FROM vouchers WHERE id = ? OR code = ?').run(id, normalizeCode(normalizedPayloadCode));
      } else {
        dbInstance.prepare('DELETE FROM vouchers WHERE id = ?').run(id);
      }
    }
    return true;
  }

  const state = readVoucherState();
  const items = Array.isArray(state.items) ? state.items : [];
  const normalizedCode = normalizedPayloadCode;
  const index = findVoucherStateIndexBySyncPayload(items, id, normalizedCode);
  const existing = index >= 0 ? items[index] : null;
  const code = normalizedCode || normalizeNumericCode(existing?.data?.VoucherCode || existing?.data?.Code || '');
  const templateId = normalizeText(payload?.templateId, existing?.templateId || '');
  const createdAt = normalizeText(payload?.createdAt, existing?.createdAt || now);
  const updatedAt = normalizeText(payload?.updatedAt, now);
  const redeemedAt = normalizeDeletedAt(payload?.redeemedAt, existing?.redeemedAt || null);
  const phone = normalizeText(payload?.phone ?? existing?.phone ?? existing?.data?.phone, '');

  const next = {
    id: existing?.id || id,
    templateId,
    createdAt,
    updatedAt,
    redeemedAt,
    phone,
    data: { ...(existing?.data || {}), phone, VoucherCode: code, Code: code },
    images: existing?.images || {}
  };

  if (index >= 0) {
    items[index] = next;
  } else {
    items.unshift(next);
  }
  state.items = items;
  await writeVoucherState(state);

  if (dbInstance) {
    const existingDb =
      dbInstance.prepare('SELECT id FROM vouchers WHERE id = ? LIMIT 1').get(id) ||
      dbInstance.prepare('SELECT id FROM vouchers WHERE code = ? LIMIT 1').get(normalizeCode(code));
    if (existingDb) {
      dbInstance
        .prepare('UPDATE vouchers SET code = ?, templateId = ?, phone = ?, redeemedAt = COALESCE(redeemedAt, ?) WHERE id = ?')
        .run(normalizeCode(code), templateId || null, phone || null, redeemedAt, existingDb.id);
    }
  }
  return true;
}

async function applyRemoteChanges(changes, dbInstance) {
  let applied = 0;
  let lastToken = 0;
  const warnings = [];
  let state = null;
  let stateDirty = false;
  if (!dbInstance) {
    state = readReposFallbackState();
  }

  for (const change of Array.isArray(changes) ? changes : []) {
    const tokenValue = Number(change?.token || 0);
    if (Number.isFinite(tokenValue) && tokenValue > lastToken) {
      lastToken = tokenValue;
    }
    const entityType = normalizeText(change?.entityType, '').toLowerCase();
    const op = normalizeText(change?.op, '').toLowerCase();
    if (!entityType || !op) continue;
    const payload = change?.payload && typeof change.payload === 'object' ? change.payload : {};
    const entityId = normalizeId(change?.entityId || payload?.id);

    let didApply = false;
    if (entityType === 'vouchers' || entityType === 'voucher') {
      didApply = await applyRemoteVoucherChange({ op, payload, entityId }, dbInstance);
    } else if (dbInstance) {
      if (entityType === 'services' || entityType === 'service') {
        didApply = applyRemoteServiceChangeDb(dbInstance, op, payload, entityId);
      } else if (entityType === 'resources' || entityType === 'resource') {
        didApply = applyRemoteResourceChangeDb(dbInstance, op, payload, entityId);
      } else if (entityType === 'resource_services' || entityType === 'resource_service') {
        didApply = applyRemoteResourceServicesChangeDb(dbInstance, op, payload, entityId);
      } else if (entityType === 'availability_rules' || entityType === 'availability_rule') {
        didApply = applyRemoteAvailabilityRuleChangeDb(dbInstance, op, payload, entityId);
      } else if (entityType === 'availability_exceptions' || entityType === 'availability_exception') {
        didApply = applyRemoteAvailabilityExceptionChangeDb(dbInstance, op, payload, entityId);
      } else if (entityType === 'customers' || entityType === 'customer') {
        didApply = applyRemoteCustomerChangeDb(dbInstance, op, payload, entityId);
      } else if (entityType === 'bookings' || entityType === 'booking') {
        didApply = applyRemoteBookingChangeDb(dbInstance, op, payload, entityId);
      }
    } else if (state) {
      if (entityType === 'services' || entityType === 'service') {
        didApply = applyRemoteServiceChangeState(state, op, payload, entityId);
      } else if (entityType === 'resources' || entityType === 'resource') {
        didApply = applyRemoteResourceChangeState(state, op, payload, entityId);
      } else if (entityType === 'resource_services' || entityType === 'resource_service') {
        didApply = applyRemoteResourceServicesChangeState(state, op, payload, entityId);
      } else if (entityType === 'availability_rules' || entityType === 'availability_rule') {
        didApply = applyRemoteAvailabilityRuleChangeState(state, op, payload, entityId);
      } else if (entityType === 'availability_exceptions' || entityType === 'availability_exception') {
        didApply = applyRemoteAvailabilityExceptionChangeState(state, op, payload, entityId);
      } else if (entityType === 'customers' || entityType === 'customer') {
        didApply = applyRemoteCustomerChangeState(state, op, payload, entityId);
      } else if (entityType === 'bookings' || entityType === 'booking') {
        didApply = applyRemoteBookingChangeState(state, op, payload, entityId);
      }
      if (didApply) stateDirty = true;
    }

    if (didApply) {
      applied += 1;
    } else {
      warnings.push({
        token: tokenValue || null,
        entityType,
        entityId,
        reason: describeRemoteChangeWarning(change, entityType, payload, entityId)
      });
    }
  }

  if (state && stateDirty) {
    writeReposFallbackState(state);
  }

  return { appliedCount: applied, lastToken, warnings };
}

let syncRunInProgress = false;

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
  },

  async run() {
    if (syncRunInProgress) {
      return { ok: false, error: 'Sync already running' };
    }
    syncRunInProgress = true;
    const startedAt = new Date().toISOString();
    try {
      const settings = await readSettings();
      const config = extractSyncSettings(settings || {});
      if (!config.baseUrl) {
        return { ok: false, error: 'sync.baseUrl is required in settings.json' };
      }
      if (!config.email || !config.password) {
        return { ok: false, error: 'sync.email and sync.password are required in settings.json' };
      }

      const auth = await syncLoginRequest(config.baseUrl, {
        email: config.email,
        password: config.password,
        orgId: config.orgId
      });
      const token = auth.token;

      const dbInstance = getDb();
      const syncState = getSyncStateRow(dbInstance);
      let sinceToken = Number.parseInt(syncState.lastPullToken || '0', 10);
      if (!Number.isFinite(sinceToken) || sinceToken < 0) sinceToken = 0;
      const storedSinceToken = sinceToken;

      const pending = listPendingOutboxRows(dbInstance, 200);
      const pendingIds = pending.map((row) => row.id).filter(Boolean);
      if (pendingIds.length) {
        markOutboxSent(dbInstance, pendingIds, startedAt);
      }

      const summary = {
        pushed: { total: pendingIds.length, acked: 0, conflicts: 0, errors: 0 },
        pulled: { count: 0, latestToken: String(sinceToken), warnings: 0 },
        conflicts: [],
        warnings: []
      };

      if (pendingIds.length) {
        const ops = pending.map((row) => toLegacySyncOperation(row));

        let pushResponse = null;
        try {
          pushResponse = await requestJson(buildSyncUrl(config.baseUrl, '/sync/push'), {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: { ops }
          });
        } catch (err) {
          markOutboxErrors(
            dbInstance,
            pendingIds.map((id) => ({ id, error: err.message || 'Sync push failed' })),
            startedAt
          );
          updateSyncStateRow(dbInstance, { lastPullToken: String(sinceToken), updatedAt: startedAt });
          return { ok: false, error: err.message || 'Sync push failed' };
        }

        if (!pushResponse?.ok) {
          const message = pushResponse?.error || 'Sync push failed';
          markOutboxErrors(
            dbInstance,
            pendingIds.map((id) => ({ id, error: message })),
            startedAt
          );
          updateSyncStateRow(dbInstance, { lastPullToken: String(sinceToken), updatedAt: startedAt });
          return { ok: false, error: message };
        }

        const ack = Array.isArray(pushResponse.ack) ? pushResponse.ack : [];
        const conflicts = Array.isArray(pushResponse.conflicts) ? pushResponse.conflicts : [];
        summary.conflicts = conflicts;

        const ackIds = ack.map((item) => item?.opId).filter(Boolean);
        if (ackIds.length) {
          summary.pushed.acked = ackIds.length;
          markOutboxAck(dbInstance, ackIds, new Date().toISOString());
        }

        const conflictIds = conflicts.map((item) => item?.opId).filter(Boolean);
        if (conflictIds.length) {
          summary.pushed.conflicts = conflictIds.length;
          markOutboxErrors(
            dbInstance,
            conflicts.map((conflict) => ({
              id: conflict?.opId,
              error: stringifyConflict(conflict)
            })),
            new Date().toISOString()
          );
        }

        const pendingSet = new Set(pendingIds);
        const ackSet = new Set(ackIds);
        const conflictSet = new Set(conflictIds);
        const unacked = Array.from(pendingSet).filter((id) => !ackSet.has(id) && !conflictSet.has(id));
        if (unacked.length) {
          summary.pushed.errors = unacked.length;
          markOutboxErrors(
            dbInstance,
            unacked.map((id) => ({ id, error: 'Not acknowledged by server' })),
            new Date().toISOString()
          );
        }
      }

      const pullLimit = 500;
      let pullSinceToken = sinceToken;
      if (storedSinceToken > 0 && countLocalActiveBookings(dbInstance) === 0) {
        pullSinceToken = 0;
        summary.pulled.backfilledFromToken = String(storedSinceToken);
      }

      let latestToken = storedSinceToken;
      let totalApplied = 0;
      let guard = 0;
      while (guard < 20) {
        const pullResponse = await requestJson(
          buildSyncUrl(config.baseUrl, '/sync/pull', { since: pullSinceToken, limit: pullLimit }),
          { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
        );
        if (!pullResponse?.ok) {
          throw new Error(pullResponse?.error || 'Sync pull failed');
        }
        const changes = Array.isArray(pullResponse.changes) ? pullResponse.changes : [];
        const { appliedCount, lastToken, warnings } = await applyRemoteChanges(changes, dbInstance);
        totalApplied += appliedCount;
        if (Array.isArray(warnings) && warnings.length > 0) {
          summary.pulled.warnings += warnings.length;
          summary.warnings.push(...warnings);
        }
        if (lastToken > latestToken) {
          latestToken = lastToken;
        }
        if (!changes.length || changes.length < pullLimit) {
          const serverLatest = Number(pullResponse.latestToken || 0);
          if (Number.isFinite(serverLatest) && serverLatest > latestToken) {
            latestToken = serverLatest;
          }
          break;
        }
        pullSinceToken = lastToken || pullSinceToken;
        guard += 1;
      }

      updateSyncStateRow(dbInstance, { lastPullToken: String(latestToken), updatedAt: new Date().toISOString() });

      summary.pulled.count = totalApplied;
      summary.pulled.latestToken = String(latestToken);
      if (summary.warnings.length > 50) {
        summary.warnings = summary.warnings.slice(0, 50);
      }
      return { ok: true, data: summary };
    } catch (err) {
      return { ok: false, error: err?.message || 'Sync failed' };
    } finally {
      syncRunInProgress = false;
    }
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

const CSV_IMPORT_HEADER_ALIASES = {
  id: ['id', 'voucherid'],
  template: ['templateid', 'template', 'design'],
  code: ['vouchercode', 'code', 'vouchercode', 'voucher_code', 'serial', 'serialnumber'],
  recipient: ['recipientname', 'name', 'customer', 'client'],
  value: ['value', 'amount', 'price'],
  issueDate: ['issuedate', 'issued', 'date'],
  validity: ['validity', 'expires', 'validuntil', 'expirydate'],
  note: ['note', 'notes', 'comment'],
  phone: ['phone', 'phonenumber', 'tel', 'telephone'],
  redeemedAt: ['redeemedat', 'redeemed', 'usedat'],
  createdAt: ['createdat', 'created'],
  updatedAt: ['updatedat', 'updated', 'modifiedat'],
  dataJson: ['datajson']
};

const CSV_IMPORT_KNOWN_HEADERS = new Set(
  Object.values(CSV_IMPORT_HEADER_ALIASES)
    .flat()
    .map((name) => normalizeCsvHeaderName(name))
);

function normalizeCsvHeaderName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseCsvRows(csvText) {
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  while (index < text.length) {
    const ch = text[index];
    if (inQuotes) {
      if (ch === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += ch;
      index += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }
    if (ch === '\r') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
      if (text[index] === '\n') index += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += 1;
      continue;
    }
    field += ch;
    index += 1;
  }

  row.push(field);
  const hasAnyRowContent = row.some((value) => String(value || '').trim() !== '');
  if (hasAnyRowContent || rows.length === 0) {
    rows.push(row);
  }
  return rows;
}

function pickCsvValue(rowMap, aliases = []) {
  for (const alias of aliases) {
    const normalized = normalizeCsvHeaderName(alias);
    const value = normalizeText(rowMap.get(normalized), '');
    if (value) return value;
  }
  return '';
}

function parseCsvDataJson(rawValue) {
  const text = normalizeText(rawValue, '');
  if (!text) return { data: {}, warning: '' };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed, warning: '' };
    }
    return { data: {}, warning: 'data_json is not an object and was ignored' };
  } catch {
    return { data: {}, warning: 'data_json is not valid JSON and was ignored' };
  }
}

function resolveImportTemplateId(rawTemplateId, templateLookup) {
  const raw = normalizeText(rawTemplateId, '');
  if (!raw) return '';
  if (templateLookup.has(raw)) return templateLookup.get(raw);
  const lower = raw.toLowerCase();
  if (templateLookup.has(lower)) return templateLookup.get(lower);
  const compact = lower.replace(/[\s_]+/g, '');
  if (templateLookup.has(compact)) return templateLookup.get(compact);
  return '';
}

function generateUniqueVoucherIdForImport(usedIds) {
  for (let i = 0; i < 1000; i += 1) {
    const id = i === 0 ? generateVoucherId() : `${generateVoucherId()}-${Math.floor(Math.random() * 1000)}`;
    if (!usedIds.has(id)) return id;
  }
  return `${generateVoucherId()}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function chooseUniqueImportCode(rawCode, usedCodes) {
  const normalized = normalizeNumericCodeOrEmpty(rawCode);
  if (!normalized) {
    let generated = normalizeNumericCode('');
    while (usedCodes.has(generated)) {
      generated = normalizeNumericCode('');
    }
    return { code: generated, missing: true, duplicate: false };
  }
  if (usedCodes.has(normalized)) {
    let generated = normalizeNumericCode('');
    while (usedCodes.has(generated)) {
      generated = normalizeNumericCode('');
    }
    return { code: generated, missing: false, duplicate: true };
  }
  return { code: normalized, missing: false, duplicate: false };
}

function cleanupCsvImportPreviewStore() {
  const now = Date.now();
  for (const [token, entry] of csvImportPreviewStore.entries()) {
    if (!entry || now - Number(entry.createdAt || 0) > CSV_IMPORT_PREVIEW_TTL_MS) {
      csvImportPreviewStore.delete(token);
    }
  }
}

function buildVoucherImportPreview(csvText, filePath) {
  cleanupCsvImportPreviewStore();
  const parsedRows = parseCsvRows(csvText);
  if (!parsedRows.length) {
    throw new Error('CSV file is empty');
  }

  const headerCells = parsedRows[0] || [];
  const headers = headerCells.map((value, index) => {
    const raw = normalizeText(value, '') || `column_${index + 1}`;
    return { raw, normalized: normalizeCsvHeaderName(raw) };
  });
  if (!headers.length) {
    throw new Error('CSV header row is missing');
  }

  const templateIds = getTemplateIds();
  const defaultTemplateId = templateIds[0] || '';
  const templateSet = new Set(templateIds);
  const templateLookup = new Map();
  templateIds.forEach((id) => {
    const raw = normalizeText(id, '');
    if (!raw) return;
    templateLookup.set(raw, raw);
    templateLookup.set(raw.toLowerCase(), raw);
    templateLookup.set(raw.toLowerCase().replace(/[\s_]+/g, ''), raw);
  });

  const state = readVoucherState();
  const existingItems = Array.isArray(state.items) ? state.items : [];
  const usedIds = new Set(existingItems.map((item) => normalizeId(item?.id)).filter(Boolean));
  const usedCodes = new Set(
    existingItems
      .map((item) => normalizeNumericCodeOrEmpty(item?.data?.VoucherCode || item?.data?.Code))
      .filter(Boolean)
  );

  const allRows = parsedRows.slice(1);
  if (!allRows.length) {
    throw new Error('CSV contains no data rows');
  }

  const validRows = [];
  const previewRows = [];
  const invalidSamples = [];
  let validCount = 0;
  let invalidCount = 0;
  let emptyCount = 0;
  let warningsCount = 0;

  allRows.forEach((rawRow, idx) => {
    const rowNumber = idx + 2;
    const rowValues = new Map();
    let hasContent = false;
    headers.forEach((header, colIndex) => {
      const value = normalizeText(rawRow?.[colIndex], '');
      if (value) hasContent = true;
      if (!rowValues.has(header.normalized) || !rowValues.get(header.normalized)) {
        rowValues.set(header.normalized, value);
      }
    });
    if (!hasContent) {
      emptyCount += 1;
      return;
    }

    const warnings = [];
    const errors = [];
    const parsedJson = parseCsvDataJson(pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.dataJson));
    if (parsedJson.warning) warnings.push(parsedJson.warning);
    const data = { ...(parsedJson.data || {}) };

    headers.forEach((header, colIndex) => {
      const value = normalizeText(rawRow?.[colIndex], '');
      if (!value) return;
      if (CSV_IMPORT_KNOWN_HEADERS.has(header.normalized)) return;
      if (!Object.prototype.hasOwnProperty.call(data, header.raw)) {
        data[header.raw] = value;
      }
    });

    const rawTemplateId =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.template) ||
      normalizeText(data.templateId || data.template || data.design, '');
    const rawId = pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.id) || normalizeText(data.id, '');
    const rawCode =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.code) ||
      normalizeText(data.VoucherCode || data.Code || data.voucher_code || data.serial, '');
    const rawRecipient =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.recipient) ||
      normalizeText(data.RecipientName || data.Name || data.recipientName, '');
    const rawValue = pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.value) || normalizeText(data.Value, '');
    const rawIssueDate =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.issueDate) || normalizeText(data.IssueDate, '');
    const rawValidity =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.validity) ||
      normalizeText(data.Validity || data.Expires, '');
    const rawNote =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.note) || normalizeText(data.Note || data.note, '');
    const rawPhone =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.phone) ||
      normalizeText(data.phone || data.Phone, '');
    const rawRedeemedAt =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.redeemedAt) ||
      normalizeText(data.RedeemedAt || data.redeemedAt, '');
    const rawCreatedAt =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.createdAt) || normalizeText(data.createdAt, '');
    const rawUpdatedAt =
      pickCsvValue(rowValues, CSV_IMPORT_HEADER_ALIASES.updatedAt) || normalizeText(data.updatedAt, '');

    let templateId = '';
    if (rawTemplateId) {
      templateId = resolveImportTemplateId(rawTemplateId, templateLookup);
      if (!templateId || !templateSet.has(templateId)) {
        errors.push('Unknown templateId');
      }
    } else if (defaultTemplateId) {
      templateId = defaultTemplateId;
      warnings.push(`Template missing; defaulted to "${defaultTemplateId}"`);
    } else {
      errors.push('Unknown templateId');
    }

    let id = normalizeId(rawId);
    if (!id) {
      id = generateUniqueVoucherIdForImport(usedIds);
    } else if (usedIds.has(id)) {
      id = generateUniqueVoucherIdForImport(usedIds);
      warnings.push('Duplicate id found; generated new id');
    }

    const codeChoice = chooseUniqueImportCode(rawCode, usedCodes);
    const code = codeChoice.code;
    if (codeChoice.missing) warnings.push('Voucher code missing; generated a new code');
    if (codeChoice.duplicate) warnings.push('Duplicate voucher code found; generated a new code');

    const phone = normalizeText(rawPhone, '');
    if (rawRecipient) data.RecipientName = rawRecipient;
    if (rawValue) data.Value = rawValue;
    if (rawIssueDate) data.IssueDate = rawIssueDate;
    if (rawValidity) {
      data.Validity = rawValidity;
      if (!data.Expires) data.Expires = rawValidity;
    }
    if (rawNote) data.Note = rawNote;
    if (phone) data.phone = phone;
    data.VoucherCode = code;
    data.Code = code;

    const redeemedAt = normalizeDeletedAt(rawRedeemedAt, null);
    if (redeemedAt) data.RedeemedAt = redeemedAt;

    const voucher = {
      id,
      templateId: templateId || '',
      phone,
      data,
      images: {}
    };
    if (rawCreatedAt) voucher.createdAt = rawCreatedAt;
    if (rawUpdatedAt) voucher.updatedAt = rawUpdatedAt;
    if (redeemedAt) voucher.redeemedAt = redeemedAt;

    const previewItem = {
      rowNumber,
      id: voucher.id,
      code,
      recipientName: normalizeText(voucher.data?.RecipientName, ''),
      templateId: voucher.templateId,
      warnings,
      errors
    };

    if (errors.length) {
      invalidCount += 1;
      if (invalidSamples.length < 20) {
        invalidSamples.push({ ...previewItem, status: 'invalid' });
      }
      if (previewRows.length < 20) {
        previewRows.push({ ...previewItem, status: 'invalid' });
      }
      return;
    }

    validCount += 1;
    warningsCount += warnings.length;
    usedIds.add(voucher.id);
    usedCodes.add(code);
    validRows.push({ rowNumber, voucher, warnings });
    if (previewRows.length < 20) {
      previewRows.push({ ...previewItem, status: 'valid' });
    }
  });

  const token = generateUuid();
  csvImportPreviewStore.set(token, {
    createdAt: Date.now(),
    validRows
  });

  return {
    token,
    filePath,
    totalRows: allRows.length,
    validRows: validCount,
    invalidRows: invalidCount,
    emptyRows: emptyCount,
    warningsCount,
    rows: previewRows,
    invalidSamples
  };
}

function resolveImportRowsFromPayload(payload = {}) {
  cleanupCsvImportPreviewStore();
  const token = normalizeText(payload?.token, '');
  if (token) {
    const entry = csvImportPreviewStore.get(token);
    if (!entry) {
      throw new Error('Import preview expired or invalid');
    }
    return { token, rows: Array.isArray(entry.validRows) ? entry.validRows : [] };
  }

  const rowsInput = Array.isArray(payload?.rows) ? payload.rows : [];
  const rows = rowsInput
    .map((entry, index) => {
      if (entry && typeof entry === 'object' && entry.voucher && typeof entry.voucher === 'object') {
        return { rowNumber: normalizeInteger(entry.rowNumber, index + 1), voucher: entry.voucher, warnings: [] };
      }
      if (entry && typeof entry === 'object' && entry.data && typeof entry.data === 'object') {
        return { rowNumber: normalizeInteger(entry.rowNumber, index + 1), voucher: entry, warnings: [] };
      }
      return null;
    })
    .filter(Boolean);
  return { token: '', rows };
}

async function importVouchersCsvPreview() {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win, {
    title: 'Import vouchers from CSV',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths?.length) {
    return { ok: false, canceled: true };
  }
  const filePath = result.filePaths[0];
  const content = await fsp.readFile(filePath, 'utf-8');
  const preview = buildVoucherImportPreview(content, filePath);
  return { ok: true, preview };
}

async function confirmVouchersCsvImport(payload = {}) {
  const { token, rows } = resolveImportRowsFromPayload(payload);
  if (!rows.length) {
    return { ok: false, error: 'No valid rows to import' };
  }

  const templateIds = getTemplateIds();
  const templateSet = new Set(templateIds);
  const templateLookup = new Map();
  templateIds.forEach((id) => {
    const raw = normalizeText(id, '');
    if (!raw) return;
    templateLookup.set(raw, raw);
    templateLookup.set(raw.toLowerCase(), raw);
    templateLookup.set(raw.toLowerCase().replace(/[\s_]+/g, ''), raw);
  });
  const defaultTemplateId = templateIds[0] || '';

  const state = readVoucherState();
  const existingItems = Array.isArray(state.items) ? state.items : [];
  const usedIds = new Set(existingItems.map((item) => normalizeId(item?.id)).filter(Boolean));
  const usedCodes = new Set(
    existingItems
      .map((item) => normalizeNumericCodeOrEmpty(item?.data?.VoucherCode || item?.data?.Code))
      .filter(Boolean)
  );

  let importedCount = 0;
  let skippedCount = 0;
  let warningsCount = 0;
  const errors = [];

  for (const row of rows) {
    const rowNumber = normalizeInteger(row?.rowNumber, importedCount + skippedCount + 1);
    const sourceVoucher = row?.voucher && typeof row.voucher === 'object' ? row.voucher : null;
    if (!sourceVoucher) {
      skippedCount += 1;
      errors.push({ rowNumber, error: 'Invalid row payload' });
      continue;
    }

    const data = { ...(sourceVoucher.data || {}) };
    let templateId = resolveImportTemplateId(sourceVoucher.templateId, templateLookup);
    if (!templateId && defaultTemplateId) {
      templateId = defaultTemplateId;
      warningsCount += 1;
    }
    if (!templateId || !templateSet.has(templateId)) {
      skippedCount += 1;
      errors.push({ rowNumber, error: 'Unknown templateId' });
      continue;
    }

    let id = normalizeId(sourceVoucher.id);
    if (!id || usedIds.has(id)) {
      if (id && usedIds.has(id)) warningsCount += 1;
      id = generateUniqueVoucherIdForImport(usedIds);
    }

    const codeChoice = chooseUniqueImportCode(data.VoucherCode || data.Code || sourceVoucher.code, usedCodes);
    if (codeChoice.missing || codeChoice.duplicate) warningsCount += 1;
    data.VoucherCode = codeChoice.code;
    data.Code = codeChoice.code;

    const phone = normalizeText(sourceVoucher.phone ?? data.phone ?? data.Phone, '');
    if (phone) data.phone = phone;

    const voucher = {
      id,
      templateId,
      phone,
      data,
      images: sourceVoucher.images && typeof sourceVoucher.images === 'object' ? sourceVoucher.images : {}
    };
    if (sourceVoucher.createdAt) voucher.createdAt = sourceVoucher.createdAt;
    if (sourceVoucher.redeemedAt) voucher.redeemedAt = normalizeDeletedAt(sourceVoucher.redeemedAt, null);

    try {
      await saveVoucherFile(voucher);
      importedCount += 1;
      usedIds.add(voucher.id);
      usedCodes.add(codeChoice.code);
    } catch (err) {
      skippedCount += 1;
      errors.push({ rowNumber, error: err?.message || 'Failed to import row' });
    }
  }

  if (token) {
    csvImportPreviewStore.delete(token);
  }

  return {
    ok: true,
    summary: {
      totalValidRows: rows.length,
      importedCount,
      skippedCount,
      warningsCount,
      errorCount: errors.length,
      errors: errors.slice(0, 50)
    }
  };
}

function saveVoucher(data, templateId) {
  const dbInstance = getDb();
  if (!dbInstance) throw new Error('Database unavailable (better-sqlite3 not loaded)');
  const now = new Date().toISOString();
  const phone = normalizeText(data?.phone, '');
  let codeToUse = normalizeNumericCode(data.code);
  if (codeExists(dbInstance, codeToUse)) {
    codeToUse = generateUniqueCode(dbInstance);
  }
  const stmt = dbInstance.prepare(
    'INSERT INTO vouchers (name, value, expires, note, phone, templateId, createdAt, code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(
    data.userName,
    data.value,
    data.expiration || null,
    data.note || null,
    phone || null,
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
      phone,
      updatedAt: now,
      redeemedAt: null
    },
    dbInstance
  );
  return { id: info.lastInsertRowid, code: codeToUse };
}

function mapVoucherStateItemToRow(item) {
  return {
    id: item.id,
    name: item.data?.RecipientName || item.data?.Name || '',
    value: item.data?.Value || '',
    expires: item.data?.Validity || '',
    note: item.data?.Note || '',
    phone: item.phone || item.data?.phone || '',
    templateId: item.templateId,
    createdAt: item.createdAt,
    code: item.data?.VoucherCode || item.data?.Code || '',
    redeemedAt: item.redeemedAt || null
  };
}

function mergeVoucherRows(primaryRows, secondaryRows, limit = 20) {
  const seenIds = new Set();
  const seenCodes = new Set();
  const merged = [];

  const pushRow = (row) => {
    if (!row) return;
    const idKey = normalizeText(row.id, '');
    const codeKey = normalizeCode(row.code);
    if (idKey && seenIds.has(idKey)) return;
    if (codeKey && seenCodes.has(codeKey)) return;
    if (idKey) seenIds.add(idKey);
    if (codeKey) seenCodes.add(codeKey);
    merged.push(row);
  };

  (Array.isArray(primaryRows) ? primaryRows : []).forEach(pushRow);
  (Array.isArray(secondaryRows) ? secondaryRows : []).forEach(pushRow);

  return merged
    .sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')))
    .slice(0, normalizeLimit(limit, 20));
}

function listVouchers(limit = 20) {
  const dbInstance = getDb();
  const fallbackList = () => {
    const state = readVoucherState();
    return (state.items || []).map(mapVoucherStateItemToRow);
  };

  if (!dbInstance) {
    return mergeVoucherRows([], fallbackList(), limit);
  }
  const stmt = dbInstance.prepare(
    'SELECT id, name, value, expires, note, phone, templateId, createdAt, code, redeemedAt FROM vouchers ORDER BY createdAt DESC LIMIT ?'
  );
  const rows = stmt.all(limit);
  return mergeVoucherRows(rows, fallbackList(), limit);
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
      phone: found.phone || found.data?.phone || '',
      templateId: found.templateId,
      createdAt: found.createdAt,
      code: found.data?.VoucherCode || found.data?.Code || '',
      redeemedAt: found.redeemedAt || null
    };
  };

  const dbInstance = getDb();
  if (!dbInstance) return fallback();

  const stmt = dbInstance.prepare(
    'SELECT id, name, value, expires, note, phone, templateId, createdAt, code, redeemedAt FROM vouchers WHERE id = ?'
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
      phone: found.phone || found.data?.phone || '',
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
    'SELECT id, name, value, expires, note, phone, templateId, createdAt, code, redeemedAt FROM vouchers WHERE code = ?'
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
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    title: 'LN software',
    backgroundColor: '#0f172a',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
  });
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

ipcMain.handle('bookings:checkSlots', async (_event, ids = []) => {
  try {
    const data = bookings.checkSlots(ids || []);
    return { ok: true, data };
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

ipcMain.handle('reservations:listEmailConfirmations', async (_event, ids = []) => {
  try {
    const data = reservationEmailConfirmations.list(ids || []);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('reservations:listApologyEmails', async (_event, ids = []) => {
  try {
    const data = reservationApologyEmails.list(ids || []);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('reservations:prepareApologyEmail', async (_event, bookingId) => {
  try {
    const data = prepareReservationApologyEmail(bookingId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('reservations:confirmEmail', async (_event, bookingId) => {
  try {
    const data = await confirmReservationEmail(bookingId);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('reservations:sendApologyEmail', async (_event, bookingId, alternatives = []) => {
  try {
    const data = await sendReservationApologyEmail(bookingId, alternatives || []);
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

ipcMain.handle('vouchers:importCsv', async () => {
  try {
    return await importVouchersCsvPreview();
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:confirmImportCsv', async (_event, payload = {}) => {
  try {
    return await confirmVouchersCsvImport(payload || {});
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vouchers:checkExpiryNow', async () => {
  try {
    const summary = await checkExpiringVouchers();
    return { ok: true, summary };
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

ipcMain.handle('sync:run', async () => {
  try {
    return await sync.run();
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

async function runVoucherExpiryCheckSafely() {
  try {
    await checkExpiringVouchers();
  } catch (err) {
    console.error('Voucher expiry check failed', err);
  }
}

app.whenReady().then(async () => {
  if (process.argv.includes('--seed-website-catalog')) {
    const dbInstance = getDb();
    console.log(JSON.stringify(websiteCatalogSummary(dbInstance), null, 2));
    app.quit();
    return;
  }

  if (process.argv.includes('--sync-now')) {
    getDb();
    const result = await sync.run();
    console.log(JSON.stringify(result, null, 2));
    app.quit();
    return;
  }

  getTemplateIds();
  createWindow();
  runVoucherExpiryCheckSafely();
  if (voucherExpiryCheckTimer) {
    clearInterval(voucherExpiryCheckTimer);
  }
  voucherExpiryCheckTimer = setInterval(() => {
    runVoucherExpiryCheckSafely();
  }, VOUCHER_EXPIRY_CHECK_INTERVAL_MS);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (voucherExpiryCheckTimer) {
    clearInterval(voucherExpiryCheckTimer);
    voucherExpiryCheckTimer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
