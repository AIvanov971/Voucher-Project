const express = require('express');
const { loadConfig } = require('./config');
const { issueToken, requireAuth } = require('./auth');
const { openDatabase, applyPushOps, pullChanges } = require('./db');

const config = loadConfig();
const db = openDatabase(config.dbPath);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

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
