#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(REPO_ROOT, 'build');
const OUTPUT_FILE = path.join(BUILD_DIR, 'settings.json');
const PRODUCTION_SYNC_BASE_URL = 'https://adventure-website-api.vercel.app';
const DEFAULT_SYNC_ORG_ID = 'action-days-kalofer';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeSyncBaseUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const trimmed = raw.replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const result = {};
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2] || '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function readJsonObject(file) {
  if (!fs.existsSync(file)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

function readTextSetting(source, names = []) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return '';
  const keys = Object.keys(source);
  const keyByLowerName = new Map(keys.map((key) => [key.toLowerCase(), key]));
  for (const name of names) {
    const exactValue = source[name];
    if (exactValue !== undefined && exactValue !== null && exactValue !== '') {
      return normalizeText(exactValue);
    }
    const realKey = keyByLowerName.get(String(name).toLowerCase());
    if (!realKey) continue;
    const value = source[realKey];
    if (value !== undefined && value !== null && value !== '') {
      return normalizeText(value);
    }
  }
  return '';
}

function extractSyncSettings(settings) {
  const syncSettings =
    settings?.sync && typeof settings.sync === 'object' && !Array.isArray(settings.sync) ? settings.sync : {};
  return {
    baseUrl: normalizeSyncBaseUrl(
      readTextSetting(syncSettings, ['baseUrl', 'baseURL', 'url', 'URL', 'apiUrl', 'apiURL', 'serverUrl', 'serverURL']) ||
        readTextSetting(settings, [
          'syncBaseUrl',
          'syncBaseURL',
          'syncUrl',
          'syncURL',
          'serverBaseUrl',
          'serverBaseURL',
          'baseUrl',
          'baseURL',
          'url',
          'URL'
        ])
    ),
    email:
      readTextSetting(syncSettings, ['email', 'Email', 'user', 'username']) ||
      readTextSetting(settings, ['syncEmail', 'email', 'Email', 'user', 'username']),
    password:
      readTextSetting(syncSettings, ['password', 'Password', 'pass']) ||
      readTextSetting(settings, ['syncPassword', 'password', 'Password', 'pass']),
    orgId:
      readTextSetting(syncSettings, ['orgId', 'orgID', 'organizationId', 'organizationID']) ||
      readTextSetting(settings, ['syncOrgId', 'syncOrgID', 'orgId', 'orgID', 'organizationId', 'organizationID'])
  };
}

function fromEnvironment(env = process.env) {
  return {
    source: 'environment variables',
    sync: {
      baseUrl: normalizeSyncBaseUrl(
        env.DESKTOP_SYNC_BASE_URL || env.DESKTOP_SYNC_URL || env.SYNC_BASE_URL || env.SYNC_URL || ''
      ),
      email: normalizeText(env.DESKTOP_SYNC_EMAIL || env.SYNC_EMAIL),
      password: normalizeText(env.DESKTOP_SYNC_PASSWORD || env.SYNC_PASSWORD),
      orgId: normalizeText(env.DESKTOP_SYNC_ORG_ID || env.SYNC_ORG_ID || env.DEFAULT_ORG_ID)
    }
  };
}

function fromEnvFile(file) {
  const env = parseEnvFile(file);
  return {
    source: file,
    sync: {
      baseUrl: normalizeSyncBaseUrl(
        env.DESKTOP_SYNC_BASE_URL ||
          env.DESKTOP_SYNC_URL ||
          env.ADVENTURE_API_BASE_URL ||
          env.NEXT_PUBLIC_API_BASE_URL ||
          ''
      ),
      email: normalizeText(env.DESKTOP_SYNC_EMAIL),
      password: normalizeText(env.DESKTOP_SYNC_PASSWORD),
      orgId: normalizeText(env.DESKTOP_SYNC_ORG_ID || env.DEFAULT_ORG_ID)
    }
  };
}

function userSettingsFiles() {
  const home = os.homedir();
  const files = [];
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    files.push(path.join(appData, 'LN software', 'settings.json'));
    files.push(path.join(appData, 'LNvoucher-maker', 'settings.json'));
  } else if (process.platform === 'darwin') {
    files.push(path.join(home, 'Library', 'Application Support', 'LN software', 'settings.json'));
    files.push(path.join(home, 'Library', 'Application Support', 'LNvoucher-maker', 'settings.json'));
  } else {
    const configHome = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    files.push(path.join(configHome, 'LN software', 'settings.json'));
    files.push(path.join(configHome, 'LNvoucher-maker', 'settings.json'));
  }
  return files;
}

function candidates() {
  return [
    fromEnvironment(),
    ...userSettingsFiles().map((file) => ({ source: file, sync: extractSyncSettings(readJsonObject(file)) })),
    fromEnvFile(path.resolve(REPO_ROOT, '..', '..', 'AdventureWebsite', '.env')),
    { source: OUTPUT_FILE, sync: extractSyncSettings(readJsonObject(OUTPUT_FILE)) }
  ];
}

function hasCredentials(sync) {
  return Boolean(sync?.email && sync?.password);
}

function redactEmail(email) {
  const text = normalizeText(email);
  const [name, domain] = text.split('@');
  if (!name || !domain) return text ? '[set]' : '[missing]';
  const first = name.slice(0, 1);
  return `${first}${name.length > 1 ? '***' : ''}@${domain}`;
}

function main() {
  const selected = candidates().find((candidate) => hasCredentials(candidate.sync));
  const sync = {
    baseUrl: normalizeSyncBaseUrl(selected?.sync?.baseUrl) || PRODUCTION_SYNC_BASE_URL,
    email: normalizeText(selected?.sync?.email),
    password: normalizeText(selected?.sync?.password),
    orgId: normalizeText(selected?.sync?.orgId) || DEFAULT_SYNC_ORG_ID
  };

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify({ sync }, null, 2)}\n`, 'utf8');

  if (hasCredentials(sync)) {
    console.log(`[bundle-settings] Wrote ${path.relative(REPO_ROOT, OUTPUT_FILE)} from ${selected.source}`);
    console.log(`[bundle-settings] Sync URL: ${sync.baseUrl}`);
    console.log(`[bundle-settings] Sync email: ${redactEmail(sync.email)}`);
    console.log(`[bundle-settings] Sync org: ${sync.orgId}`);
  } else {
    console.warn(
      '[bundle-settings] No sync credentials found. The build will run offline until settings.json is configured.'
    );
  }
}

main();
