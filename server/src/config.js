const path = require('node:path');
const dotenv = require('dotenv');

const SERVER_ROOT = path.join(__dirname, '..');
dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

function parseIntSafe(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePathFromRoot(rawPath, fallbackRelativePath) {
  const effectivePath = (rawPath || fallbackRelativePath).trim();
  if (!effectivePath) {
    return path.join(SERVER_ROOT, fallbackRelativePath);
  }
  return path.isAbsolute(effectivePath)
    ? effectivePath
    : path.join(SERVER_ROOT, effectivePath);
}

function assertProductionSecret(name, value, insecureDefaults = []) {
  const text = String(value || '').trim();
  if (!text || insecureDefaults.includes(text)) {
    throw new Error(`[server] ${name} must be set to a production value when NODE_ENV=production.`);
  }
}

function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const config = {
    nodeEnv,
    isProduction,
    host: process.env.HOST || '127.0.0.1',
    port: parseIntSafe(process.env.PORT, 8787),
    dbPath: resolvePathFromRoot(process.env.DB_PATH, 'data/server.sqlite'),
    authEmail: process.env.AUTH_EMAIL || (isProduction ? '' : 'admin@example.com'),
    authPassword: process.env.AUTH_PASSWORD || (isProduction ? '' : 'change-me'),
    jwtSecret: process.env.JWT_SECRET || (isProduction ? '' : 'dev-only-change-me'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
    defaultOrgId: process.env.DEFAULT_ORG_ID || 'local',
    publicHoldTtlMinutes: parseIntSafe(process.env.PUBLIC_HOLD_TTL_MIN, 10) || 10
  };

  if (config.isProduction) {
    assertProductionSecret('AUTH_EMAIL', config.authEmail, ['admin@example.com', 'desktop-sync@example.com']);
    assertProductionSecret('AUTH_PASSWORD', config.authPassword, ['change-me', 'replace-with-a-strong-password']);
    assertProductionSecret('JWT_SECRET', config.jwtSecret, [
      'dev-only-change-me',
      'replace-with-at-least-32-random-characters'
    ]);
    if (config.jwtSecret.length < 32) {
      throw new Error('[server] JWT_SECRET must be at least 32 characters when NODE_ENV=production.');
    }
  }

  if (config.jwtSecret === 'dev-only-change-me') {
    console.warn('[server] JWT_SECRET is using a development default value.');
  }

  return config;
}

module.exports = {
  SERVER_ROOT,
  loadConfig
};
