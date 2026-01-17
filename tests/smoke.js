// tests/smoke.js
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const { app } = require('electron');
const exporter = require('../src/exporter');

const userDataDir = path.join(os.tmpdir(), 'voucher-electron-smoke');
app.setPath('userData', userDataDir);

const templateId = 'actiondays';

async function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp`;
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
  await fsp.rename(tmp, filePath);
}

async function ensurePlaceholderImage(destPath) {
  if (fs.existsSync(destPath)) return;
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVQYV2NkYGD4z0ACwDiqYBQjGkQmkikYBFA3A1EBAOzND9e+bxZOAAAAAElFTkSuQmCC';
  await fsp.mkdir(path.dirname(destPath), { recursive: true });
  await fsp.writeFile(destPath, Buffer.from(pngBase64, 'base64'));
}

function sampleLayout() {
  return {
    fields: [
      {
        key: 'RecipientName',
        label: 'Recipient Name',
        type: 'text',
        x: 55,
        y: 200,
        w: 520,
        h: 52,
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 26,
        fontWeight: '700',
        color: '#111111',
        align: 'left'
      },
      {
        key: 'IssueDate',
        label: 'Issue Date',
        type: 'text',
        x: 55,
        y: 260,
        w: 240,
        h: 36,
        fontFamily: 'Arial, sans-serif',
        fontSize: 18,
        fontWeight: '600',
        color: '#222222',
        align: 'left'
      },
      {
        key: 'Validity',
        label: 'Validity',
        type: 'text',
        x: 55,
        y: 300,
        w: 240,
        h: 36,
        fontFamily: 'Arial, sans-serif',
        fontSize: 18,
        fontWeight: '600',
        color: '#222222',
        align: 'left'
      },
      {
        key: 'VoucherCode',
        label: 'Voucher Code',
        type: 'text',
        x: 55,
        y: 340,
        w: 260,
        h: 36,
        fontFamily: 'Roboto, Arial, sans-serif',
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        align: 'left'
      },
      {
        key: 'InstagramLink',
        label: 'Instagram Link',
        type: 'qr',
        x: 700,
        y: 340,
        w: 120,
        h: 120
      },
      {
        key: 'FacebookLink',
        label: 'Facebook Link',
        type: 'qr',
        x: 840,
        y: 340,
        w: 120,
        h: 120
      },
      {
        key: 'Logo',
        label: 'Logo',
        type: 'image',
        x: 920,
        y: 60,
        w: 200,
        h: 130
      },
      {
        key: 'Photo1',
        label: 'Photo 1',
        type: 'image',
        x: 700,
        y: 120,
        w: 180,
        h: 120
      }
    ]
  };
}

async function ensureTemplate() {
  const templatesRoot = exporter.resolveTemplatesRoot();
  const baseDir = path.join(templatesRoot, templateId);
  const assetsDir = path.join(baseDir, 'assets');
  await ensurePlaceholderImage(path.join(assetsDir, 'bg.png'));
  await ensurePlaceholderImage(path.join(assetsDir, 'logo.png'));
  const metaPath = path.join(baseDir, 'template.json');
  const layoutPath = path.join(baseDir, 'layout.json');
  const meta = {
    id: templateId,
    name: 'Action Days Smoke',
    page: { widthPx: 1200, heightPx: 566 },
    background: 'assets/bg.png',
    backgroundFit: 'cover',
    logo: 'assets/logo.png'
  };
  await writeJsonAtomic(metaPath, meta);
  await writeJsonAtomic(layoutPath, sampleLayout());
  return { templatesRoot };
}

async function ensureVoucherImage(voucherId) {
  const vouchersRoot = path.join(app.getPath('userData'), 'vouchers');
  const dest = path.join(vouchersRoot, 'assets', voucherId, 'photo1.png');
  await ensurePlaceholderImage(dest);
  return dest;
}

async function verifyFile(outPath) {
  if (!outPath) throw new Error('Missing output path');
  const stats = await fsp.stat(outPath);
  if (!stats.isFile()) throw new Error(`Not a file: ${outPath}`);
  if (stats.size < 1024) throw new Error(`File too small: ${outPath} (${stats.size} bytes)`);
  return stats.size;
}

async function run() {
  const { templatesRoot } = await ensureTemplate();
  await app.whenReady();

  const voucherId = `V-SMOKE-${Date.now()}`;
  const voucherData = {
    RecipientName: 'Smoke Tester',
    IssueDate: new Date().toISOString().slice(0, 10),
    Validity: '30 days',
    InstagramLink: 'https://instagram.com/voucher.smoke',
    FacebookLink: 'https://facebook.com/voucher.smoke',
    VoucherCode: `SMOKE-${Date.now()}`
  };

  await ensureVoucherImage(voucherId);
  const images = { Photo1: `assets/${voucherId}/photo1.png` };

  const outputDir = path.join(app.getPath('userData'), 'smoke-outputs');
  const options = { outputDir, vouchersRoot: path.join(app.getPath('userData'), 'vouchers'), templatesRoot };

  const pdfResult = await exporter.exportVoucher('pdf', { data: voucherData, templateId, images }, options);
  if (!pdfResult.ok) throw new Error(`PDF export failed: ${pdfResult.error || 'unknown error'}`);
  const pdfSize = await verifyFile(pdfResult.outPath);

  const pngResult = await exporter.exportVoucher('png', { data: voucherData, templateId, images }, options);
  if (!pngResult.ok) throw new Error(`PNG export failed: ${pngResult.error || 'unknown error'}`);
  const pngSize = await verifyFile(pngResult.outPath);

  console.log(`PASS: PDF exported to ${pdfResult.outPath} (${pdfSize} bytes)`);
  console.log(`PASS: PNG exported to ${pngResult.outPath} (${pngSize} bytes)`);
  app.quit();
  process.exit(0);
}

run().catch((err) => {
  console.error('FAIL:', err.message || err);
  app.quit();
  process.exit(1);
});
