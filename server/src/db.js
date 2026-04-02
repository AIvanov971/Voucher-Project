const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const BOOKING_ENTITY_TYPES = new Set(['booking', 'bookings']);
const NON_BLOCKING_BOOKING_STATUSES = new Set(['cancelled', 'canceled']);

function generateId() {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function safeTrim(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEntityType(value) {
  return safeTrim(value).toLowerCase();
}

function normalizeDeletedAt(value) {
  const deletedAt = safeTrim(value);
  return deletedAt || null;
}

function parsePayload(rawPayload) {
  if (rawPayload == null) {
    return {};
  }
  if (typeof rawPayload === 'object' && !Array.isArray(rawPayload)) {
    return rawPayload;
  }
  if (typeof rawPayload === 'string' && rawPayload.trim()) {
    try {
      const parsed = JSON.parse(rawPayload);
      return typeof parsed === 'object' && parsed && !Array.isArray(parsed) ? parsed : {};
    } catch (_error) {
      return {};
    }
  }
  return {};
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function parseIsoMillis(value) {
  const text = safeTrim(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.valueOf())) return null;
  return date.valueOf();
}

function normalizeBookingRecord(raw, fallbackEntityId = '') {
  const booking = {
    id: safeTrim((raw && raw.id) || fallbackEntityId),
    resourceId: safeTrim(raw && raw.resourceId),
    startAt: safeTrim(raw && raw.startAt),
    endAt: safeTrim(raw && raw.endAt),
    status: normalizeEntityType(raw && raw.status) || 'confirmed',
    deletedAt: normalizeDeletedAt(raw && raw.deletedAt)
  };
  return booking;
}

function isBlockingBooking(booking) {
  if (!booking || booking.deletedAt || !booking.resourceId) return false;
  if (NON_BLOCKING_BOOKING_STATUSES.has(booking.status)) return false;

  const startMs = parseIsoMillis(booking.startAt);
  const endMs = parseIsoMillis(booking.endAt);
  if (startMs == null || endMs == null || endMs <= startMs) return false;
  return true;
}

function bookingIntervalsOverlap(a, b) {
  const aStart = parseIsoMillis(a.startAt);
  const aEnd = parseIsoMillis(a.endAt);
  const bStart = parseIsoMillis(b.startAt);
  const bEnd = parseIsoMillis(b.endAt);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
}

function createBookingConflict({ opId, entityType, entityId, incoming, existing }) {
  return {
    code: 'booking_overlap',
    message: 'Booking overlaps with an existing booking in the same resource and time range',
    opId: opId || null,
    entityType,
    entityId,
    resourceId: incoming.resourceId,
    startAt: incoming.startAt,
    endAt: incoming.endAt,
    conflictingBooking: {
      id: existing.id,
      resourceId: existing.resourceId,
      startAt: existing.startAt,
      endAt: existing.endAt,
      status: existing.status
    }
  };
}

function findBookingConflict(db, orgId, incoming) {
  if (!isBlockingBooking(incoming)) return null;

  const rows = db
    .prepare(
      `SELECT entityId, payloadJson, deletedAt
         FROM entity_state
        WHERE orgId = ?
          AND entityType IN ('bookings', 'booking')`
    )
    .all(orgId);

  for (const row of rows) {
    const payload = parsePayload(row && row.payloadJson);
    const existing = normalizeBookingRecord(payload, row && row.entityId);
    if (!existing.id || existing.id === incoming.id) continue;
    if (existing.resourceId !== incoming.resourceId) continue;
    if (normalizeDeletedAt(row && row.deletedAt)) {
      existing.deletedAt = normalizeDeletedAt(row && row.deletedAt);
    }
    if (!isBlockingBooking(existing)) continue;
    if (!bookingIntervalsOverlap(incoming, existing)) continue;
    return existing;
  }

  return null;
}

function ensureSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_changes (
      token INTEGER PRIMARY KEY AUTOINCREMENT,
      changeId TEXT NOT NULL UNIQUE,
      orgId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      op TEXT NOT NULL,
      payloadJson TEXT NOT NULL DEFAULT '{}',
      sourceOpId TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entity_state (
      orgId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      payloadJson TEXT NOT NULL DEFAULT '{}',
      deletedAt TEXT,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (orgId, entityType, entityId)
    );

    CREATE TABLE IF NOT EXISTS public_holds (
      id TEXT PRIMARY KEY,
      orgId TEXT NOT NULL,
      serviceId TEXT NOT NULL,
      resourceId TEXT NOT NULL,
      startAt TEXT NOT NULL,
      endAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'held',
      createdAt TEXT NOT NULL,
      consumedAt TEXT
    );
  `);

  db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_sync_changes_org_token ON sync_changes(orgId, token)'
    )
    .run();
  db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_sync_changes_org_entity ON sync_changes(orgId, entityType, entityId)'
    )
    .run();
  db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_entity_state_org_type ON entity_state(orgId, entityType)'
    )
    .run();
  db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_public_holds_org_resource ON public_holds(orgId, resourceId)'
    )
    .run();
  db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_public_holds_org_expires ON public_holds(orgId, expiresAt)'
    )
    .run();
  db
    .prepare(
      'CREATE INDEX IF NOT EXISTS idx_public_holds_org_status ON public_holds(orgId, status)'
    )
    .run();
}

function openDatabase(dbPath) {
  ensureDirectory(dbPath);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  ensureSchema(db);
  return db;
}

function getLatestToken(db, orgId) {
  const row = db
    .prepare('SELECT COALESCE(MAX(token), 0) AS token FROM sync_changes WHERE orgId = ?')
    .get(orgId);
  return Number(row && row.token ? row.token : 0);
}

function applyPushOps(db, { orgId, ops }) {
  const insertChange = db.prepare(`
    INSERT INTO sync_changes (
      changeId,
      orgId,
      entityType,
      entityId,
      op,
      payloadJson,
      sourceOpId,
      createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const upsertEntityState = db.prepare(`
    INSERT INTO entity_state (
      orgId,
      entityType,
      entityId,
      payloadJson,
      deletedAt,
      updatedAt
    )
    VALUES (
      @orgId,
      @entityType,
      @entityId,
      @payloadJson,
      @deletedAt,
      @updatedAt
    )
    ON CONFLICT(orgId, entityType, entityId)
    DO UPDATE SET
      payloadJson = excluded.payloadJson,
      deletedAt = excluded.deletedAt,
      updatedAt = excluded.updatedAt
  `);

  const ack = [];
  const conflicts = [];

  const tx = db.transaction((items) => {
    for (const rawOp of items) {
      const entityType = normalizeEntityType(rawOp && rawOp.entityType);
      const entityId = safeTrim(rawOp && rawOp.entityId);
      const op = normalizeEntityType(rawOp && rawOp.op);
      const sourceOpId = safeTrim((rawOp && (rawOp.opId || rawOp.id)) || '') || null;

      if (!entityType || !entityId) {
        throw new Error('Invalid op: entityType and entityId are required');
      }
      if (op !== 'upsert' && op !== 'delete') {
        throw new Error("Invalid op: op must be 'upsert' or 'delete'");
      }

      const now = new Date().toISOString();
      const payload =
        op === 'delete'
          ? {}
          : parsePayload(rawOp && (rawOp.payload ?? rawOp.payloadJson));

      if (BOOKING_ENTITY_TYPES.has(entityType) && op === 'upsert') {
        const incomingBooking = normalizeBookingRecord(payload, entityId);
        const conflictBooking = findBookingConflict(db, orgId, incomingBooking);
        if (conflictBooking) {
          conflicts.push(
            createBookingConflict({
              opId: sourceOpId,
              entityType,
              entityId,
              incoming: incomingBooking,
              existing: conflictBooking
            })
          );
          continue;
        }
      }

      const payloadJson = JSON.stringify(payload);
      const info = insertChange.run(
        generateId(),
        orgId,
        entityType,
        entityId,
        op,
        payloadJson,
        sourceOpId,
        now
      );
      const token = Number(info.lastInsertRowid);

      upsertEntityState.run({
        orgId,
        entityType,
        entityId,
        payloadJson,
        deletedAt: op === 'delete' ? now : normalizeDeletedAt(payload && payload.deletedAt),
        updatedAt: now
      });

      ack.push({
        opId: sourceOpId,
        entityType,
        entityId,
        op,
        token
      });
    }
  });

  tx(ops);

  return {
    ack,
    conflicts,
    latestToken: getLatestToken(db, orgId)
  };
}

function pullChanges(db, { orgId, sinceToken = 0, limit = 500 }) {
  const rows = db
    .prepare(
      `SELECT token, changeId, orgId, entityType, entityId, op, payloadJson, sourceOpId, createdAt
         FROM sync_changes
        WHERE orgId = ? AND token > ?
        ORDER BY token ASC
        LIMIT ?`
    )
    .all(orgId, sinceToken, limit);

  return {
    changes: rows.map((row) => ({
      token: Number(row.token),
      changeId: row.changeId,
      orgId: row.orgId,
      entityType: row.entityType,
      entityId: row.entityId,
      op: row.op,
      payload: parsePayload(row.payloadJson),
      opId: row.sourceOpId || null,
      createdAt: row.createdAt
    })),
    latestToken: getLatestToken(db, orgId)
  };
}


const DEFAULT_SLOT_STEP_MIN = 15;
const DEFAULT_WORK_START = '09:00';
const DEFAULT_WORK_END = '17:00';

function normalizeFlag(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === '0' || trimmed === 'false' || trimmed === 'no') return false;
    if (trimmed === '1' || trimmed === 'true' || trimmed === 'yes') return true;
  }
  return Boolean(value);
}

function normalizeDateText(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.valueOf())) return '';
  return parsed.toISOString().slice(0, 10);
}

function parseTimeToMinutes(value) {
  const trimmed = safeTrim(value);
  if (!trimmed) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function dateTextToUtcDayStartMillis(dateText) {
  const normalized = normalizeDateText(dateText);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map((part) => Number(part));
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

function buildIsoFromDayMinutes(dateText, minutes) {
  const dayStart = dateTextToUtcDayStartMillis(dateText);
  if (dayStart == null) return '';
  const ms = dayStart + minutes * 60000;
  return new Date(ms).toISOString();
}

function parseBreaksJson(value) {
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

function getEntityStateRows(db, orgId, entityTypes) {
  const types = Array.isArray(entityTypes) ? entityTypes.filter(Boolean) : [];
  if (!types.length) return [];
  const placeholders = types.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT entityId, entityType, payloadJson, deletedAt, updatedAt
         FROM entity_state
        WHERE orgId = ?
          AND entityType IN (${placeholders})`
    )
    .all(orgId, ...types);
}

function isEntityDeleted(row, payload) {
  return Boolean(normalizeDeletedAt(row?.deletedAt) || normalizeDeletedAt(payload?.deletedAt));
}

function isEntityActive(payload) {
  if (payload?.isActive === undefined) return true;
  return normalizeFlag(payload.isActive, true);
}

function listPublicServices(db, orgId) {
  const rows = getEntityStateRows(db, orgId, ['services', 'service']);
  return rows
    .map((row) => {
      const payload = parsePayload(row?.payloadJson);
      const id = safeTrim(payload?.id || row?.entityId);
      return {
        id,
        name: safeTrim(payload?.name),
        durationMin: Number(payload?.durationMin || 0),
        priceCents: Number(payload?.priceCents || 0),
        currency: safeTrim(payload?.currency) || 'EUR',
        isActive: normalizeFlag(payload?.isActive, true),
        deletedAt: normalizeDeletedAt(payload?.deletedAt) || normalizeDeletedAt(row?.deletedAt)
      };
    })
    .filter((service) => service.id && service.name && !service.deletedAt && service.isActive);
}

function buildResourceServiceMap(db, orgId) {
  const rows = getEntityStateRows(db, orgId, ['resource_services', 'resource_service']);
  const map = new Map();
  rows.forEach((row) => {
    const payload = parsePayload(row?.payloadJson);
    const resourceId = safeTrim(payload?.resourceId || row?.entityId);
    if (!resourceId) return;
    const serviceIds = [];
    if (Array.isArray(payload?.serviceIds)) {
      serviceIds.push(...payload.serviceIds);
    } else if (Array.isArray(payload?.services)) {
      serviceIds.push(...payload.services);
    } else if (payload?.serviceId) {
      serviceIds.push(payload.serviceId);
    }
    const normalized = serviceIds.map((id) => safeTrim(id)).filter(Boolean);
    if (!normalized.length) return;
    const existing = map.get(resourceId) || new Set();
    normalized.forEach((id) => existing.add(id));
    map.set(resourceId, existing);
  });
  return map;
}

function listPublicResources(db, orgId, serviceId = '') {
  const rows = getEntityStateRows(db, orgId, ['resources', 'resource']);
  const resources = rows
    .map((row) => {
      const payload = parsePayload(row?.payloadJson);
      const id = safeTrim(payload?.id || row?.entityId);
      return {
        id,
        name: safeTrim(payload?.name),
        type: safeTrim(payload?.type) || 'resource',
        isActive: normalizeFlag(payload?.isActive, true),
        deletedAt: normalizeDeletedAt(payload?.deletedAt) || normalizeDeletedAt(row?.deletedAt)
      };
    })
    .filter((resource) => resource.id && resource.name && !resource.deletedAt && resource.isActive);

  const targetServiceId = safeTrim(serviceId);
  if (!targetServiceId) return resources;

  const map = buildResourceServiceMap(db, orgId);
  if (map.size === 0) return resources;
  return resources.filter((resource) => {
    const allowed = map.get(resource.id);
    if (!allowed) return false;
    return allowed.has(targetServiceId);
  });
}

function listAvailabilityRules(db, orgId, resourceId) {
  const rows = getEntityStateRows(db, orgId, ['availability_rules', 'availability_rule']);
  const targetId = safeTrim(resourceId);
  return rows
    .map((row) => {
      const payload = parsePayload(row?.payloadJson);
      return {
        id: safeTrim(payload?.id || row?.entityId),
        resourceId: safeTrim(payload?.resourceId),
        weekday: Number(payload?.weekday),
        startTime: safeTrim(payload?.startTime),
        endTime: safeTrim(payload?.endTime),
        breaks: parseBreaksJson(payload?.breaksJson || payload?.breaks || '[]'),
        deletedAt: normalizeDeletedAt(payload?.deletedAt) || normalizeDeletedAt(row?.deletedAt)
      };
    })
    .filter((rule) => rule.resourceId === targetId && !rule.deletedAt);
}

function listAvailabilityExceptions(db, orgId, resourceId, fromDate, toDate) {
  const rows = getEntityStateRows(db, orgId, ['availability_exceptions', 'availability_exception']);
  const targetId = safeTrim(resourceId);
  const fromText = normalizeDateText(fromDate);
  const toText = normalizeDateText(toDate);
  return rows
    .map((row) => {
      const payload = parsePayload(row?.payloadJson);
      return {
        id: safeTrim(payload?.id || row?.entityId),
        resourceId: safeTrim(payload?.resourceId),
        date: normalizeDateText(payload?.date),
        isOff: normalizeFlag(payload?.isOff, true),
        startTime: safeTrim(payload?.startTime),
        endTime: safeTrim(payload?.endTime),
        deletedAt: normalizeDeletedAt(payload?.deletedAt) || normalizeDeletedAt(row?.deletedAt)
      };
    })
    .filter((ex) => ex.resourceId === targetId && ex.date && !ex.deletedAt)
    .filter((ex) => {
      if (fromText && ex.date < fromText) return false;
      if (toText && ex.date > toText) return false;
      return true;
    });
}

function listBookingsForOrg(db, orgId) {
  const rows = getEntityStateRows(db, orgId, ['bookings', 'booking']);
  return rows
    .map((row) => {
      const payload = parsePayload(row?.payloadJson);
      const booking = normalizeBookingRecord(payload, row?.entityId);
      booking.deletedAt = normalizeDeletedAt(payload?.deletedAt) || normalizeDeletedAt(row?.deletedAt);
      return booking;
    })
    .filter((booking) => booking.id);
}

function listActiveHolds(db, orgId, nowIso) {
  return db
    .prepare(
      `SELECT id, resourceId, startAt, endAt, expiresAt, status
         FROM public_holds
        WHERE orgId = ?
          AND status = 'held'
          AND expiresAt > ?`
    )
    .all(orgId, nowIso);
}

function cleanupExpiredHolds(db, orgId, nowIso) {
  db
    .prepare(
      `UPDATE public_holds
          SET status = 'expired'
        WHERE orgId = ?
          AND status = 'held'
          AND expiresAt <= ?`
    )
    .run(orgId, nowIso);
}

function findHoldConflict(db, orgId, incoming, excludeHoldId = null, nowIso = new Date().toISOString()) {
  if (!incoming?.resourceId) return null;
  const rows = db
    .prepare(
      `SELECT id, resourceId, startAt, endAt, expiresAt
         FROM public_holds
        WHERE orgId = ?
          AND resourceId = ?
          AND status = 'held'
          AND expiresAt > ?`
    )
    .all(orgId, incoming.resourceId, nowIso);

  for (const row of rows) {
    if (excludeHoldId && row.id === excludeHoldId) continue;
    if (bookingIntervalsOverlap(incoming, row)) return row;
  }
  return null;
}

function createConflictError(message, conflict) {
  const err = new Error(message);
  err.code = 'CONFLICT';
  if (conflict) err.conflict = conflict;
  return err;
}

function createBadRequestError(message) {
  const err = new Error(message);
  err.code = 'BAD_REQUEST';
  return err;
}

function createNotFoundError(message) {
  const err = new Error(message);
  err.code = 'NOT_FOUND';
  return err;
}

function createHoldConflict({ resourceId, startAt, endAt, hold }) {
  return {
    code: 'hold_overlap',
    message: 'Requested time is already held',
    resourceId,
    startAt,
    endAt,
    conflictingHold: {
      id: hold?.id || null,
      expiresAt: hold?.expiresAt || null
    }
  };
}

function insertChangeAndState(db, { orgId, entityType, entityId, op, payload, sourceOpId = null }) {
  const now = new Date().toISOString();
  const payloadJson = JSON.stringify(payload || {});
  const changeId = generateId();
  const info = db
    .prepare(
      `INSERT INTO sync_changes (
        changeId,
        orgId,
        entityType,
        entityId,
        op,
        payloadJson,
        sourceOpId,
        createdAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(changeId, orgId, entityType, entityId, op, payloadJson, sourceOpId, now);

  db
    .prepare(
      `INSERT INTO entity_state (
        orgId,
        entityType,
        entityId,
        payloadJson,
        deletedAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(orgId, entityType, entityId)
      DO UPDATE SET
        payloadJson = excluded.payloadJson,
        deletedAt = excluded.deletedAt,
        updatedAt = excluded.updatedAt`
    )
    .run(
      orgId,
      entityType,
      entityId,
      payloadJson,
      op === 'delete' ? now : normalizeDeletedAt(payload?.deletedAt),
      now
    );

  return Number(info.lastInsertRowid);
}

function createPublicHold(db, { orgId, serviceId, resourceId, startAt, ttlMinutes = 10 }) {
  const targetServiceId = safeTrim(serviceId);
  const targetResourceId = safeTrim(resourceId);
  const startIso = safeTrim(startAt);
  if (!targetServiceId || !startIso) {
    throw createBadRequestError('serviceId and startAt are required');
  }

  const services = listPublicServices(db, orgId);
  const service = services.find((item) => item.id === targetServiceId) || null;
  if (!service) {
    throw createBadRequestError('serviceId not found');
  }
  const durationMin = Number(service.durationMin || 30);
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    throw createBadRequestError('service duration is invalid');
  }

  const startMs = parseIsoMillis(startIso);
  if (startMs == null) {
    throw createBadRequestError('startAt must be a valid ISO datetime');
  }
  const endMs = startMs + durationMin * 60000;
  const endIso = new Date(endMs).toISOString();

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + Number(ttlMinutes || 10) * 60000).toISOString();

  const tx = db.transaction(() => {
    cleanupExpiredHolds(db, orgId, nowIso);

    const resources = listPublicResources(db, orgId, targetServiceId);
    const candidates = targetResourceId
      ? resources.filter((resource) => resource.id === targetResourceId)
      : resources;

    if (!candidates.length) {
      throw createBadRequestError('resourceId not found');
    }

    let chosen = null;
    for (const resource of candidates) {
      const incoming = {
        id: 'hold',
        resourceId: resource.id,
        startAt: startIso,
        endAt: endIso,
        status: 'confirmed',
        deletedAt: null
      };
      const bookingConflict = findBookingConflict(db, orgId, incoming);
      if (bookingConflict) {
        continue;
      }
      const holdConflict = findHoldConflict(db, orgId, incoming, null, nowIso);
      if (holdConflict) {
        continue;
      }
      chosen = resource;
      break;
    }

    if (!chosen) {
      throw createConflictError('Requested slot is not available');
    }

    const holdId = generateId();
    db
      .prepare(
        `INSERT INTO public_holds (
          id,
          orgId,
          serviceId,
          resourceId,
          startAt,
          endAt,
          expiresAt,
          status,
          createdAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'held', ?)`
      )
      .run(holdId, orgId, targetServiceId, chosen.id, startIso, endIso, expiresAt, nowIso);

    return {
      holdId,
      resourceId: chosen.id,
      serviceId: targetServiceId,
      startAt: startIso,
      endAt: endIso,
      expiresAt
    };
  });

  return tx();
}

function createPublicBooking(db, { orgId, holdId, customer, note, voucherCode }) {
  const holdKey = safeTrim(holdId);
  if (!holdKey) {
    throw createBadRequestError('holdId is required');
  }
  const customerName = safeTrim(customer?.name);
  if (!customerName) {
    throw createBadRequestError('customer.name is required');
  }

  const nowIso = new Date().toISOString();

  const tx = db.transaction(() => {
    cleanupExpiredHolds(db, orgId, nowIso);
    const hold = db
      .prepare(
        `SELECT id, serviceId, resourceId, startAt, endAt, expiresAt
           FROM public_holds
          WHERE id = ?
            AND orgId = ?
            AND status = 'held'
            AND expiresAt > ?
          LIMIT 1`
      )
      .get(holdKey, orgId, nowIso);

    if (!hold) {
      throw createNotFoundError('Hold not found or expired');
    }

    const incoming = {
      id: 'public-booking',
      resourceId: hold.resourceId,
      startAt: hold.startAt,
      endAt: hold.endAt,
      status: 'confirmed',
      deletedAt: null
    };

    const bookingConflict = findBookingConflict(db, orgId, incoming);
    if (bookingConflict) {
      throw createConflictError('Booking overlaps existing booking', createBookingConflict({
        opId: hold.id,
        entityType: 'bookings',
        entityId: hold.id,
        incoming,
        existing: bookingConflict
      }));
    }

    const holdConflict = findHoldConflict(db, orgId, incoming, hold.id, nowIso);
    if (holdConflict) {
      throw createConflictError('Slot is already held', createHoldConflict({
        resourceId: hold.resourceId,
        startAt: hold.startAt,
        endAt: hold.endAt,
        hold: holdConflict
      }));
    }

    const customerId = generateId();
    const bookingId = generateId();

    const customerPayload = {
      id: customerId,
      name: customerName,
      phone: safeTrim(customer?.phone) || null,
      email: safeTrim(customer?.email) || null,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null
    };

    const bookingPayload = {
      id: bookingId,
      serviceId: hold.serviceId,
      resourceId: hold.resourceId,
      customerId,
      startAt: hold.startAt,
      endAt: hold.endAt,
      status: 'confirmed',
      note: safeTrim(note) || null,
      source: 'public',
      voucherCode: safeTrim(voucherCode) || null,
      createdAt: nowIso,
      updatedAt: nowIso,
      deletedAt: null
    };

    insertChangeAndState(db, {
      orgId,
      entityType: 'customers',
      entityId: customerId,
      op: 'upsert',
      payload: customerPayload
    });

    insertChangeAndState(db, {
      orgId,
      entityType: 'bookings',
      entityId: bookingId,
      op: 'upsert',
      payload: bookingPayload
    });

    db
      .prepare(
        `UPDATE public_holds
            SET status = 'consumed',
                consumedAt = ?
          WHERE id = ?`
      )
      .run(nowIso, hold.id);

    return {
      bookingId,
      customerId,
      holdId: hold.id,
      startAt: hold.startAt,
      endAt: hold.endAt,
      resourceId: hold.resourceId,
      serviceId: hold.serviceId
    };
  });

  return tx();
}

function computeDayIntervals(rules, weekday) {
  const dayRules = Array.isArray(rules) ? rules.filter((rule) => Number(rule.weekday) === weekday) : [];
  if (!dayRules.length) return [];
  const intervals = [];
  for (const rule of dayRules) {
    const startMin = parseTimeToMinutes(rule.startTime);
    const endMin = parseTimeToMinutes(rule.endTime);
    if (startMin == null || endMin == null || endMin <= startMin) continue;
    let spans = [[startMin, endMin]];
    const breaks = parseBreaksJson(rule.breaksJson || rule.breaks || '[]');
    for (const brk of breaks) {
      const brkStart = parseTimeToMinutes(brk?.startTime || brk?.start);
      const brkEnd = parseTimeToMinutes(brk?.endTime || brk?.end);
      if (brkStart == null || brkEnd == null || brkEnd <= brkStart) continue;
      spans = spans.flatMap(([spanStart, spanEnd]) => {
        if (brkEnd <= spanStart || brkStart >= spanEnd) return [[spanStart, spanEnd]];
        const next = [];
        if (brkStart > spanStart) next.push([spanStart, brkStart]);
        if (brkEnd < spanEnd) next.push([brkEnd, spanEnd]);
        return next;
      });
    }
    spans.forEach((span) => intervals.push(span));
  }
  return intervals;
}

function buildDefaultRules(resourceId) {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    id: `default-${resourceId}-${weekday}`,
    resourceId,
    weekday,
    startTime: DEFAULT_WORK_START,
    endTime: DEFAULT_WORK_END,
    breaksJson: '[]'
  }));
}

function listPublicAvailability(db, { orgId, serviceId, resourceId, from, to, slotStepMin = DEFAULT_SLOT_STEP_MIN }) {
  const targetServiceId = safeTrim(serviceId);
  if (!targetServiceId) {
    throw createBadRequestError('serviceId is required');
  }
  const fromDate = normalizeDateText(from);
  const toDate = normalizeDateText(to);
  if (!fromDate || !toDate) {
    throw createBadRequestError('from and to dates are required (YYYY-MM-DD)');
  }
  if (fromDate > toDate) {
    throw createBadRequestError('from must be before or equal to to');
  }

  const services = listPublicServices(db, orgId);
  const service = services.find((item) => item.id === targetServiceId) || null;
  if (!service) {
    throw createBadRequestError('serviceId not found');
  }
  const durationMin = Number(service.durationMin || 30);
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    throw createBadRequestError('service duration is invalid');
  }

  const resources = listPublicResources(db, orgId, targetServiceId);
  const targetResources = resourceId
    ? resources.filter((item) => item.id === safeTrim(resourceId))
    : resources;
  if (!targetResources.length) return { slots: [] };

  const bookings = listBookingsForOrg(db, orgId).filter((booking) => isBlockingBooking(booking));
  const nowIso = new Date().toISOString();
  const holds = listActiveHolds(db, orgId, nowIso);

  const durationMs = durationMin * 60000;
  const step = Math.max(5, Number(slotStepMin || DEFAULT_SLOT_STEP_MIN));
  const stepMs = step * 60000;

  const slots = [];

  targetResources.forEach((resource) => {
    const resourceIdValue = resource.id;
    const rules = listAvailabilityRules(db, orgId, resourceIdValue);
    const normalizedRules = rules.length ? rules : buildDefaultRules(resourceIdValue);
    const exceptions = listAvailabilityExceptions(db, orgId, resourceIdValue, fromDate, toDate);
    const exceptionMap = new Map();
    exceptions.forEach((ex) => {
      exceptionMap.set(ex.date, ex);
    });

    const resourceBookings = bookings.filter((booking) => booking.resourceId === resourceIdValue);
    const resourceHolds = holds.filter((hold) => hold.resourceId === resourceIdValue);
    const blocked = [...resourceBookings, ...resourceHolds]
      .map((item) => ({
        startMs: parseIsoMillis(item.startAt),
        endMs: parseIsoMillis(item.endAt)
      }))
      .filter((item) => item.startMs != null && item.endMs != null && item.endMs > item.startMs);

    let cursorDate = fromDate;
    while (cursorDate && cursorDate <= toDate) {
      const dayStartMs = dateTextToUtcDayStartMillis(cursorDate);
      if (dayStartMs == null) break;
      const dayEndMs = dayStartMs + 24 * 60 * 60000;
      const weekday = new Date(dayStartMs).getUTCDay();

      let intervals = computeDayIntervals(normalizedRules, weekday);
      const exception = exceptionMap.get(cursorDate);
      if (exception) {
        if (exception.isOff) {
          intervals = [];
        } else {
          const exStart = parseTimeToMinutes(exception.startTime);
          const exEnd = parseTimeToMinutes(exception.endTime);
          if (exStart != null && exEnd != null && exEnd > exStart) {
            intervals = [[exStart, exEnd]];
          }
        }
      }

      intervals.forEach(([startMin, endMin]) => {
        const intervalStartMs = dayStartMs + startMin * 60000;
        const intervalEndMs = dayStartMs + endMin * 60000;
        for (let slotStart = intervalStartMs; slotStart + durationMs <= intervalEndMs; slotStart += stepMs) {
          const slotEnd = slotStart + durationMs;
          if (slotEnd <= dayStartMs || slotStart >= dayEndMs) continue;
          const conflict = blocked.some((item) => slotStart < item.endMs && item.startMs < slotEnd);
          if (!conflict) {
            slots.push({
              resourceId: resourceIdValue,
              startAt: new Date(slotStart).toISOString(),
              endAt: new Date(slotEnd).toISOString()
            });
          }
        }
      });

      const nextDay = new Date(dayStartMs + 24 * 60 * 60000);
      cursorDate = nextDay.toISOString().slice(0, 10);
      if (cursorDate > toDate) break;
    }
  });

  return { slots };
}

module.exports = {
  openDatabase,
  applyPushOps,
  pullChanges,
  getLatestToken,
  listPublicServices,
  listPublicResources,
  listPublicAvailability,
  createPublicHold,
  createPublicBooking
};
