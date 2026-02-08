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

function loadConfig() {
  const config = {
    host: process.env.HOST || '127.0.0.1',
    port: parseIntSafe(process.env.PORT, 8787),
    dbPath: resolvePathFromRoot(process.env.DB_PATH, 'data/server.sqlite'),
    authEmail: process.env.AUTH_EMAIL || 'admin@example.com',
    authPassword: process.env.AUTH_PASSWORD || 'change-me',
    jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
    defaultOrgId: process.env.DEFAULT_ORG_ID || 'local'
  };

  if (config.jwtSecret === 'dev-only-change-me') {
    console.warn('[server] JWT_SECRET is using a development default value.');
  }

  return config;
}

module.exports = {
  SERVER_ROOT,
  loadConfig
};
