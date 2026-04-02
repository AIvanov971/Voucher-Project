const path = require('node:path');
const express = require('express');
const { loadConfig } = require('./config');
const { issueToken, requireAuth } = require('./auth');
const {
  openDatabase,
  applyPushOps,
  pullChanges,
  listPublicServices,
  listPublicResources,
  listPublicAvailability,
  createPublicHold,
  createPublicBooking
} = require('./db');

const config = loadConfig();
const db = openDatabase(config.dbPath);
const app = express();
const publicWebRoot = path.join(__dirname, '..', 'public-web');

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use('/public-web', express.static(publicWebRoot));
app.get('/public-web', (_req, res) => {
  res.sendFile(path.join(publicWebRoot, 'index.html'));
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'voucher-maker-sync-server',
    now: new Date().toISOString()
  });
});

app.post('/auth/login', (req, res) => {
  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const requestedOrgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'email and password are required' });
  }

  if (email !== config.authEmail.toLowerCase() || password !== config.authPassword) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  const orgId = requestedOrgId || config.defaultOrgId;
  const token = issueToken({
    email,
    orgId,
    secret: config.jwtSecret,
    expiresIn: config.jwtExpiresIn
  });

  return res.json({
    ok: true,
    token,
    orgId,
    expiresIn: config.jwtExpiresIn
  });
});

const auth = requireAuth(config);

app.post('/sync/push', auth, (req, res) => {
  const ops = Array.isArray(req.body && req.body.ops) ? req.body.ops : null;
  if (!ops) {
    return res.status(400).json({ ok: false, error: 'ops must be an array' });
  }

  try {
    const result = applyPushOps(db, { orgId: req.auth.orgId, ops });
    return res.json({
      ok: true,
      ack: result.ack,
      latestToken: result.latestToken,
      conflicts: Array.isArray(result.conflicts) ? result.conflicts : []
    });
  } catch (error) {
    const message = error && error.message ? error.message : 'push failed';
    const statusCode = message.startsWith('Invalid op:') ? 400 : 500;
    return res.status(statusCode).json({ ok: false, error: message });
  }
});

app.get('/sync/pull', auth, (req, res) => {
  const sinceValue = Number.parseInt(String(req.query.since ?? '0'), 10);
  const limitValue = Number.parseInt(String(req.query.limit ?? '500'), 10);
  const sinceToken = Number.isFinite(sinceValue) && sinceValue > 0 ? sinceValue : 0;
  const limit = Number.isFinite(limitValue)
    ? Math.min(Math.max(limitValue, 1), 1000)
    : 500;

  try {
    const result = pullChanges(db, { orgId: req.auth.orgId, sinceToken, limit });
    return res.json({
      ok: true,
      changes: result.changes,
      latestToken: result.latestToken
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error && error.message ? error.message : 'pull failed'
    });
  }
});

app.get('/public/:org/services', (req, res) => {
  const orgId = typeof req.params.org === 'string' ? req.params.org.trim() : '';
  if (!orgId) {
    return res.status(400).json({ ok: false, error: 'org is required' });
  }
  try {
    const services = listPublicServices(db, orgId);
    return res.json({ ok: true, services });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Failed to list services' });
  }
});

app.get('/public/:org/resources', (req, res) => {
  const orgId = typeof req.params.org === 'string' ? req.params.org.trim() : '';
  if (!orgId) {
    return res.status(400).json({ ok: false, error: 'org is required' });
  }
  const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId.trim() : '';
  try {
    const resources = listPublicResources(db, orgId, serviceId);
    return res.json({ ok: true, resources });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || 'Failed to list resources' });
  }
});

app.get('/public/:org/availability', (req, res) => {
  const orgId = typeof req.params.org === 'string' ? req.params.org.trim() : '';
  if (!orgId) {
    return res.status(400).json({ ok: false, error: 'org is required' });
  }
  const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId.trim() : '';
  const resourceId = typeof req.query.resourceId === 'string' ? req.query.resourceId.trim() : '';
  const from = typeof req.query.from === 'string' ? req.query.from.trim() : '';
  const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
  const slotStepMin = Number.parseInt(String(req.query.slotStepMin ?? req.query.step ?? ''), 10);

  try {
    const result = listPublicAvailability(db, {
      orgId,
      serviceId,
      resourceId: resourceId || null,
      from,
      to,
      slotStepMin: Number.isFinite(slotStepMin) ? slotStepMin : undefined
    });
    return res.json({ ok: true, slots: result.slots || [] });
  } catch (error) {
    const status = error?.code === 'BAD_REQUEST' ? 400 : 500;
    return res.status(status).json({ ok: false, error: error?.message || 'Failed to load availability' });
  }
});

app.post('/public/:org/holds', (req, res) => {
  const orgId = typeof req.params.org === 'string' ? req.params.org.trim() : '';
  if (!orgId) {
    return res.status(400).json({ ok: false, error: 'org is required' });
  }
  const body = req.body || {};
  const serviceId = typeof body.serviceId === 'string' ? body.serviceId.trim() : '';
  const resourceId = typeof body.resourceId === 'string' ? body.resourceId.trim() : '';
  const startAt = typeof body.startAt === 'string' ? body.startAt.trim() : '';

  try {
    const hold = createPublicHold(db, {
      orgId,
      serviceId,
      resourceId: resourceId || null,
      startAt,
      ttlMinutes: config.publicHoldTtlMinutes
    });
    return res.json({ ok: true, ...hold });
  } catch (error) {
    if (error?.code === 'CONFLICT') {
      return res.status(409).json({ ok: false, error: error.message, conflict: error.conflict || null });
    }
    const status = error?.code === 'BAD_REQUEST' ? 400 : 500;
    return res.status(status).json({ ok: false, error: error?.message || 'Failed to create hold' });
  }
});

app.post('/public/:org/bookings', (req, res) => {
  const orgId = typeof req.params.org === 'string' ? req.params.org.trim() : '';
  if (!orgId) {
    return res.status(400).json({ ok: false, error: 'org is required' });
  }
  const body = req.body || {};
  const holdId = typeof body.holdId === 'string' ? body.holdId.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const voucherCode = typeof body.voucherCode === 'string' ? body.voucherCode.trim() : '';
  const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};

  try {
    const booking = createPublicBooking(db, {
      orgId,
      holdId,
      customer,
      note,
      voucherCode
    });
    return res.json({ ok: true, ...booking });
  } catch (error) {
    if (error?.code === 'CONFLICT') {
      return res.status(409).json({ ok: false, error: error.message, conflict: error.conflict || null });
    }
    if (error?.code === 'NOT_FOUND') {
      return res.status(404).json({ ok: false, error: error.message });
    }
    const status = error?.code === 'BAD_REQUEST' ? 400 : 500;
    return res.status(status).json({ ok: false, error: error?.message || 'Failed to create booking' });
  }
});

app.use((error, _req, res, _next) => {
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }
  console.error('[server] unhandled error', error);
  return res.status(500).json({ ok: false, error: 'Internal server error' });
});

app.listen(config.port, config.host, () => {
  console.log(`[server] listening on http://${config.host}:${config.port}`);
  console.log(`[server] sqlite db: ${config.dbPath}`);
});
