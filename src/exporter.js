// src/exporter.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { pathToFileURL } = require('url');
const QRCode = require('qrcode');

const DEFAULT_PAGE = { widthPx: 794, heightPx: 1123 };
const metaCache = new Map();
const layoutCache = new Map();

function clearTemplateCache(templateId, templatesRoot) {
  const root = resolveTemplatesRoot(templatesRoot);
  if (templateId) {
    metaCache.delete(`${root}:${templateId}`);
    layoutCache.delete(`${root}:${templateId}`);
    return;
  }
  metaCache.clear();
  layoutCache.clear();
}

function sanitizeTemplateId(id) {
  return String(id || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
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

function resolveTemplatesRoot(customRoot) {
  if (customRoot) return customRoot;
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'templates');
  }
  return path.join(__dirname, '..', 'templates');
}

function resolveVouchersRoot(customRoot) {
  if (customRoot) return customRoot;
  return path.join(app.getPath('userData'), 'vouchers');
}

function templatePaths(templateId, templatesRoot) {
  const base = path.join(templatesRoot, templateId);
  return {
    base,
    meta: path.join(base, 'template.json'),
    layout: path.join(base, 'layout.json'),
    assets: path.join(base, 'assets')
  };
}

function resolveAssetUrl(templateId, relativePath, templatesRoot) {
  if (!relativePath) return null;
  const full = path.join(templatesRoot, templateId, relativePath);
  if (!fs.existsSync(full)) return null;
  return pathToFileURL(full).toString();
}

function getTemplateIds(templatesRoot = resolveTemplatesRoot()) {
  if (!fs.existsSync(templatesRoot)) return [];
  return fs
    .readdirSync(templatesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name);
}

function readTemplateMeta(templateId, options = {}) {
  const templatesRoot = resolveTemplatesRoot(options.templatesRoot);
  const cacheKey = `${templatesRoot}:${templateId}`;
  if (!options.noCache && metaCache.has(cacheKey)) return metaCache.get(cacheKey);

  const paths = templatePaths(templateId, templatesRoot);
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
    backgroundUrl: resolveAssetUrl(templateId, normalized.background, templatesRoot),
    logoUrl: resolveAssetUrl(templateId, normalized.logo, templatesRoot)
  };

  if (!options.noCache) {
    metaCache.set(cacheKey, withUrls);
  }
  return withUrls;
}

async function readTemplateLayout(templateId, options = {}) {
  const templatesRoot = resolveTemplatesRoot(options.templatesRoot);
  const cacheKey = `${templatesRoot}:${templateId}`;
  if (!options.noCache && layoutCache.has(cacheKey)) return layoutCache.get(cacheKey);

  const paths = templatePaths(templateId, templatesRoot);
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
  if (!options.noCache) {
    layoutCache.set(cacheKey, layout);
  }
  return layout;
}

function buildFilename(data, templateId, ext = 'pdf') {
  const safeName =
    (data.userName || data.RecipientName || data.Name || 'voucher')
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'voucher';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${safeName}-${templateId}-${stamp}.${ext}`;
}

function mimeFromExt(p) {
  const ext = (path.extname(p).toLowerCase() || '').replace('.', '');
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  return 'application/octet-stream';
}

async function fileToDataUrl(relPath, baseDir) {
  if (!relPath) return null;
  if (String(relPath).startsWith('data:')) return relPath;
  const root = resolveVouchersRoot(baseDir);
  const full = path.isAbsolute(relPath) ? relPath : path.join(root, relPath);
  if (!fs.existsSync(full)) return null;
  const buffer = await fsp.readFile(full);
  const mime = mimeFromExt(full);
  const b64 = buffer.toString('base64');
  return `data:${mime};base64,${b64}`;
}

function normalizeVoucherData(data = {}) {
  const code = (data.VoucherCode || data.code || '').trim();
  const voucherCode = code || `VC-${Date.now()}`;
  const issueDate = data.IssueDate || data.issueDate || new Date().toISOString().slice(0, 10);
  const validity = data.Validity || data.validity || data.expiration || data.expires || '';
  const recipient = data.RecipientName || data.userName || data.UserName || data.name || 'Recipient';
  const value = data.Value || data.value || data.service || data.amount || '';
  const note = data.Note || data.note || '';

  return {
    ...data,
    RecipientName: recipient,
    Name: recipient,
    userName: recipient,
    Value: value,
    value,
    IssueDate: issueDate,
    Validity: validity,
    Expires: validity,
    expiration: validity,
    Note: note,
    note,
    code: voucherCode,
    Code: voucherCode,
    InstagramLink: data.InstagramLink || '',
    FacebookLink: data.FacebookLink || '',
    VoucherCode: voucherCode
  };
}

async function attachQrData(layout, data) {
  const result = { ...data };
  const fields = layout?.fields || [];
  for (const field of fields) {
    if (field.type !== 'qr') continue;
    const key = field.key;
    const qrKey = `${key}QR`;
    if (result[qrKey]) continue;
    const value = result[key];
    if (!value) continue;
    try {
      result[qrKey] = await QRCode.toDataURL(String(value), { margin: 1, scale: 6 });
    } catch {
      // ignore QR errors to avoid blocking export
    }
  }
  if (!result.qrDataUrl && result.code) {
    try {
      result.qrDataUrl = await QRCode.toDataURL(result.code, { margin: 1, scale: 6 });
    } catch {
      result.qrDataUrl = '';
    }
  }
  return result;
}

async function attachImagesData(data, imagesMapping, baseDir) {
  if (!imagesMapping) return data;
  const result = { ...data };
  for (const [key, rel] of Object.entries(imagesMapping)) {
    const url = await fileToDataUrl(rel, baseDir);
    if (url) {
      result[key] = url;
    }
  }
  return result;
}

async function resolveImageDataMap(images, baseDir) {
  const out = {};
  if (!images) return out;
  for (const [key, rel] of Object.entries(images)) {
    const dataUrl = await fileToDataUrl(rel, baseDir);
    if (dataUrl) out[key] = dataUrl;
  }
  return out;
}

async function buildRenderPayload(templateId, rawData, imagesMapping, options = {}) {
  const templatesRoot = resolveTemplatesRoot(options.templatesRoot);
  const vouchersRoot = resolveVouchersRoot(options.vouchersRoot);
  const layout = await readTemplateLayout(templateId, { templatesRoot });
  const meta = readTemplateMeta(templateId, { templatesRoot });
  const normalized = normalizeVoucherData(rawData || {});
  const withImages = await attachImagesData(normalized, imagesMapping, vouchersRoot);
  const data = await attachQrData(layout, withImages);
  return { meta, layout, data };
}

async function renderGeneric(templateId, voucherData, targetWindow, providedMeta, providedLayout, options = {}) {
  const templatesRoot = resolveTemplatesRoot(options.templatesRoot);
  const meta = providedMeta || readTemplateMeta(templateId, { templatesRoot });
  const layout = providedLayout || (await readTemplateLayout(templateId, { templatesRoot }));
  const data = await attachQrData(layout, normalizeVoucherData(voucherData || {}));
  const script = `
    window.renderVoucher(${JSON.stringify(data)}, ${JSON.stringify(meta)}, ${JSON.stringify(layout)});
  `;
  await targetWindow.webContents.executeJavaScript(script);
}

async function ensureAppReady() {
  if (app.isReady()) return;
  await app.whenReady();
}

async function exportVoucher(format, payload, options = {}) {
  const { data, templateId, images } = payload || {};
  const templatesRoot = resolveTemplatesRoot(options.templatesRoot);
  const vouchersRoot = resolveVouchersRoot(options.vouchersRoot);
  const selectedTemplateId = sanitizeTemplateId(templateId) || getTemplateIds(templatesRoot)[0];
  if (!selectedTemplateId) return { ok: false, error: 'No template available' };

  await ensureAppReady();
  const { meta, layout, data: renderData } = await buildRenderPayload(
    selectedTemplateId,
    data || {},
    images || {},
    { templatesRoot, vouchersRoot }
  );
  const baseRenderer = path.join(templatesRoot, '_base', 'template.html');
  const win = new BrowserWindow({
    show: false,
    width: meta.page.widthPx || DEFAULT_PAGE.widthPx,
    height: meta.page.heightPx || DEFAULT_PAGE.heightPx,
    webPreferences: {
      offscreen: true,
      contextIsolation: true
    }
  });

  try {
    await win.loadFile(baseRenderer);
    await renderGeneric(selectedTemplateId, renderData, win, meta, layout, { templatesRoot });
    await win.webContents.executeJavaScript('new Promise((resolve) => requestAnimationFrame(() => resolve()));');

    const outputDir = options.outputDir || app.getPath('downloads');
    await fsp.mkdir(outputDir, { recursive: true });

    if (format === 'pdf') {
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: 'none' }
      });
      const outPath = path.join(outputDir, buildFilename(renderData, selectedTemplateId, 'pdf'));
      await fsp.writeFile(outPath, pdf);
      return { ok: true, outPath };
    }

    const image = await win.webContents.capturePage();
    const buffer = image.toPNG();
    const outPath = path.join(outputDir, buildFilename(renderData, selectedTemplateId, 'png'));
    await fsp.writeFile(outPath, buffer);
    return { ok: true, outPath };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    win.destroy();
  }
}

module.exports = {
  DEFAULT_PAGE,
  resolveTemplatesRoot,
  resolveVouchersRoot,
  readTemplateMeta,
  readTemplateLayout,
  fileToDataUrl,
  resolveImageDataMap,
  normalizeVoucherData,
  attachQrData,
  attachImagesData,
  buildRenderPayload,
  renderGeneric,
  exportVoucher,
  buildFilename,
  getTemplateIds,
  clearTemplateCache
};
