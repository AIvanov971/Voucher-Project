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

module.exports = {
  openDatabase,
  applyPushOps,
  pullChanges,
  getLatestToken
};
