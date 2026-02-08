
// renderer/renderer.js
const previewFrame = document.getElementById('previewFrame');
const templateCards = document.getElementById('templateCards'); // legacy ref
const templateList = document.getElementById('templateList');
const templateSelect = document.getElementById('templateSelect');
const btnCreateTemplate = document.getElementById('btnCreateTemplate');
const btnRenameTemplate = document.getElementById('btnRenameTemplate');
const statusMsg = document.getElementById('statusMsg');
const bannerStack = document.getElementById('bannerStack');
const savedList = document.getElementById('savedList');
const savedSearch = document.getElementById('savedSearch');
const btnNewVoucher = document.getElementById('btnNewVoucher');
const btnDeleteVoucher = document.getElementById('btnDeleteVoucher');
const btnClearVouchers = document.getElementById('btnClearVouchers');
const btnExportCsv = document.getElementById('btnExportCsv');
const valueModal = document.getElementById('valueModal');
const valueModalBackdrop = document.getElementById('valueModalBackdrop');
const valueModalInput = document.getElementById('valueModalInput');
const valueModalSave = document.getElementById('valueModalSave');
const valueModalCancel = document.getElementById('valueModalCancel');
const valueModalCancel2 = document.getElementById('valueModalCancel2');
const VALUE_FIELD_KEYS = ['Value', 'Стойност', 'стойност'];
const btnSaveVoucher = document.getElementById('btnSaveVoucher');
const btnSaveCopy = document.getElementById('btnSaveCopy');
const toggleTools = document.getElementById('toggleTools');
const toggleProps = document.getElementById('toggleProps');
const builderToolsCol = document.getElementById('builderToolsCol');
const builderPropsCol = document.getElementById('builderPropsCol');
const builderScaleIndicator = document.getElementById('builderScaleIndicator');
const exportBtn = document.getElementById('exportBtn');
const exportPngBtn = document.getElementById('exportPngBtn');
const voucherForm = document.getElementById('voucherForm');
const dynamicFields = document.getElementById('dynamicFields');
const imageFields = document.getElementById('imageFields');
const inputVoucherCode = document.getElementById('inputVoucherCode');
const inputInstagram = document.getElementById('inputInstagram');
const inputFacebook = document.getElementById('inputFacebook');
const tabButtons = document.querySelectorAll('[data-view-target]');
const views = document.querySelectorAll('[data-view]');
const navVouchers = document.getElementById('navVouchers');
const navBuilder = document.getElementById('navBuilder');
const sectionVouchers = document.getElementById('view-vouchers');
const sectionBuilder = document.getElementById('view-builder');
const themeToggle = document.getElementById('themeToggle');
const helpBtn = document.getElementById('helpBtn');
const helpModal = document.getElementById('helpModal');
const helpSearch = document.getElementById('helpSearch');
const helpBody = document.getElementById('helpBody');
const helpClose = document.getElementById('helpClose');
const helpVersion = document.getElementById('helpVersion');
const versionTag = document.getElementById('versionTag');
const versionNote = document.getElementById('versionNote');
const testBadge = document.getElementById('testBadge');
// Validate
const validateCodeInput = document.getElementById('validateCodeInput');
const validateBtn = document.getElementById('validateBtn');
const validateResult = document.getElementById('validateResult');
const validateRedeemBtn = document.getElementById('validateRedeemBtn');
const voucherStatusList = document.getElementById('voucherStatusList');
const voucherStatusFilter = document.getElementById('voucherStatusFilter');
const refreshVoucherList = document.getElementById('refreshVoucherList');

// Builder elements
const tplSelect = document.getElementById('tplSelect');
const btnNewTemplate = document.getElementById('btnNewTemplate');
const btnDuplicateTemplate = document.getElementById('btnDuplicateTemplate');
const btnSaveTemplate = document.getElementById('btnSaveTemplate');
const btnAddText = document.getElementById('btnAddText');
const btnAddQr = document.getElementById('btnAddQr');
const btnAddImage = document.getElementById('btnAddImage');
const btnAddSticker = document.getElementById('btnAddSticker');
const btnDeleteField = document.getElementById('btnDeleteField');
const btnSetBackground = document.getElementById('btnSetBackground');
const btnRefreshBackground = document.getElementById('btnRefreshBackground');
const btnSetLogo = document.getElementById('btnSetLogo');
const backgroundFitSelect = document.getElementById('backgroundFit');
const fieldsList = document.getElementById('fieldsList');
const canvas = document.getElementById('canvas');
const canvasInner = document.getElementById('canvasInner');
const propKey = document.getElementById('propKey');
const propLabel = document.getElementById('propLabel');
const propType = document.getElementById('propType');
const propX = document.getElementById('propX');
const propY = document.getElementById('propY');
const propW = document.getElementById('propW');
const propH = document.getElementById('propH');
const propFontFamily = document.getElementById('propFontFamily');
const propFont = document.getElementById('propFont');
const propWeight = document.getElementById('propWeight');
const propColor = document.getElementById('propColor');
const propAlign = document.getElementById('propAlign');
const builderStatus = document.getElementById('builderStatus');
const fontPresetButtons = document.querySelectorAll('.font-preset');
const colorSwatches = document.querySelectorAll('.color-swatch');

const FONT_OPTIONS = [
  'Arial, sans-serif',
  'Impact, Arial Black, sans-serif',
  'Montserrat, Arial, sans-serif',
  'Roboto, Arial, sans-serif',
  'Times New Roman, serif',
  'Poppins, Arial, sans-serif',
  'Open Sans, Arial, sans-serif',
  'Lato, Arial, sans-serif'
];

const state = {
  templates: [],
  templateMeta: new Map(),
  layouts: new Map(),
  currentTemplateId: null,
  vouchers: [],
  selectedVoucherId: null,
  searchText: '',
  currentVoucher: {
    id: null,
    templateId: null,
    data: {},
    images: {}
  },
  imageData: {},
  previewReady: false,
  validatedVoucher: null,
  validateFilter: 'all',
  validateList: [],
  builder: {
    templates: [],
    meta: null,
    layout: null,
    selectedField: null,
    cacheBust: 0
  },
  builderScale: 1,
  theme: 'dark',
  helpContent: '',
  testMode: false,
  version: '',
  valueOptions: []
};

function generateSerial() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sanitizeSerial(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  if (digits.length > 0) return digits.padStart(6, '0');
  return generateSerial();
}

function builderPageSize() {
  const page = state.builder.meta?.page || { widthPx: 794, heightPx: 1123 };
  return { width: page.widthPx || 794, height: page.heightPx || 1123 };
}

function applyBuilderScale() {
  if (!canvas || !canvasInner) return;
  const { width, height } = builderPageSize();
  const container = canvas.parentElement || canvas;
  const available = Math.max((container.clientWidth || width) - 24, 240);
  const scale = Math.min(1, available / width);
  state.builderScale = scale;
  canvas.style.width = '100%';
  canvasInner.style.width = `${width}px`;
  canvasInner.style.height = `${height}px`;
  canvasInner.style.transform = `scale(${scale})`;
  canvasInner.style.transformOrigin = 'top center';
  const scaledHeight = Math.ceil(height * scale);
  canvas.style.height = `${scaledHeight + 20}px`;
  if (builderScaleIndicator) {
    builderScaleIndicator.textContent = `${Math.round(scale * 100)}%`;
  }
}

function escapeHtml(value) {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showBanner(message, type = 'info') {
  if (!bannerStack || !message) return;
  const banner = document.createElement('div');
  banner.className = `banner ${type === 'error' ? 'error' : 'success'}`;
  const text = document.createElement('div');
  text.textContent = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.textContent = 'x';
  close.addEventListener('click', () => banner.remove());
  banner.appendChild(text);
  banner.appendChild(close);
  bannerStack.appendChild(banner);
  setTimeout(() => banner.remove(), 4000);
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.dataset.theme = 'light';
  } else {
    root.dataset.theme = 'dark';
  }
  state.theme = theme;
  if (themeToggle) themeToggle.textContent = theme === 'light' ? 'Dark' : 'Light';
}

function logTest(action, payload) {
  if (!state.testMode) return;
  console.log(`[TEST MODE] ${action}`, payload || '');
}

function updateBadges() {
  if (testBadge) testBadge.hidden = !state.testMode;
  const baseVersion = state.version || '1.0.0';
  const suffix = state.testMode ? '-test' : '';
  if (versionTag) {
    versionTag.textContent = `v${baseVersion}${suffix || ''}`;
  }
  if (versionNote) {
    versionNote.textContent = state.testMode ? 'Test version - feedback welcome' : 'Ready for use';
  }
}

async function loadTheme() {
  try {
    const res = await window.api.settings.get();
    const savedTheme = res?.settings?.theme;
    const savedTest = res?.settings?.testMode;
    state.testMode = typeof savedTest === 'boolean' ? savedTest : true;
    if (savedTheme) {
      applyTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
  } catch {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
  updateBadges();
}

async function loadValueOptions() {
  try {
    const res = await window.api.values.list();
    state.valueOptions = res?.values || [];
  } catch {
    state.valueOptions = [];
  }
}

async function addValueOption(newVal) {
  try {
    const res = await window.api.values.add(newVal);
    state.valueOptions = res?.values || state.valueOptions;
  } catch (err) {
    console.error(err);
  }
}

async function deleteValueOption(val) {
  try {
    const res = await window.api.values.delete(val);
    state.valueOptions = res?.values || state.valueOptions;
  } catch (err) {
    console.error(err);
  }
}

function openValueModal() {
  return new Promise((resolve) => {
    if (!valueModal || !valueModalInput) return resolve(null);
    valueModalInput.value = '';
    valueModal.classList.add('open');
    valueModal.setAttribute('aria-hidden', 'false');
    valueModalInput.focus();
    const cleanup = (result) => {
      valueModal.classList.remove('open');
      valueModal.setAttribute('aria-hidden', 'true');
      resolve(result);
    };
    const onSave = () => cleanup(valueModalInput.value.trim());
    const onCancel = () => cleanup(null);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        onSave();
      }
    };
    valueModalSave?.addEventListener('click', onSave, { once: true });
    valueModalCancel?.addEventListener('click', onCancel, { once: true });
    valueModalCancel2?.addEventListener('click', onCancel, { once: true });
    valueModalBackdrop?.addEventListener('click', onCancel, { once: true });
    valueModalInput?.addEventListener('keydown', onKey, { once: true });
  });
}

async function toggleTheme() {
  const next = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try {
    await window.api.settings.set({ theme: next });
  } catch (err) {
    console.error(err);
  }
}

function setStatus(message, isError = false) {
  if (!statusMsg) return;
  statusMsg.textContent = message || '';
  statusMsg.classList.toggle('error', isError);
  if (message) showBanner(message, isError ? 'error' : 'success');
}

function setBuilderStatus(message, isError = false) {
  if (builderStatus) {
    builderStatus.textContent = message || '';
    builderStatus.classList.toggle('error', isError);
  }
  if (message) showBanner(message, isError ? 'error' : 'success');
}

function renderTemplateCards() {
  if (templateList) {
    templateList.innerHTML = '';
    state.templates.forEach((tpl) => {
      const item = document.createElement('div');
      item.className = 'template-card' + (tpl.id === state.currentTemplateId ? ' selected' : '');
      item.dataset.id = tpl.id;
      const dot = document.createElement('div');
      dot.className = 'template-thumb';
      dot.textContent = (tpl.name || tpl.id || '?').slice(0, 2).toUpperCase();
      const name = document.createElement('div');
      name.className = 'template-name';
      name.textContent = tpl.name || tpl.id;
      item.appendChild(dot);
      item.appendChild(name);
      item.addEventListener('click', () => changeTemplate(tpl.id));
      templateList.appendChild(item);
    });
  }
  if (templateSelect && state.currentTemplateId) templateSelect.value = state.currentTemplateId;
}

async function ensureTemplateData(templateId) {
  if (!templateId) return null;
  if (!state.templateMeta.has(templateId)) {
    const meta = await window.api.templates.readMeta(templateId);
    state.templateMeta.set(templateId, meta || {});
  }
  if (!state.layouts.has(templateId)) {
    const layout = (await window.api.templates.readLayout(templateId)) || { fields: [] };
    state.layouts.set(templateId, layout);
  }
  return { meta: state.templateMeta.get(templateId), layout: state.layouts.get(templateId) };
}

async function loadTemplates() {
  const list = (await window.api.templates.list()) || [];
  state.templates = list;
  templateSelect.innerHTML = '';
  list.forEach((tpl) => {
    const opt = document.createElement('option');
    opt.value = tpl.id;
    opt.textContent = tpl.name || tpl.id;
    templateSelect.appendChild(opt);
  });
  if (!state.currentTemplateId && list.length) {
    state.currentTemplateId = list[0].id;
  }
  renderTemplateCards();
}

async function changeTemplate(templateId) {
  if (!templateId) return;
  state.currentTemplateId = templateId;
  state.currentVoucher.templateId = templateId;
  await ensureTemplateData(templateId);
  renderTemplateCards();
  renderDynamicForm();
  renderPreview();
}

async function fetchHelp() {
  try {
    const res = await fetch('help/help.md');
    const text = await res.text();
    state.helpContent = text;
    renderHelp();
  } catch (err) {
    helpBody.innerHTML = '<p>Failed to load help content.</p>';
    console.error(err);
  }
}

function mdToHtml(md) {
  const lines = md.split('\n');
  let html = '';
  lines.forEach((line) => {
    if (line.startsWith('### ')) {
      html += `<h3>${escapeHtml(line.replace('### ', '').trim())}</h3>`;
    } else if (line.startsWith('## ')) {
      html += `<h2>${escapeHtml(line.replace('## ', '').trim())}</h2>`;
    } else if (line.startsWith('# ')) {
      html += `<h1>${escapeHtml(line.replace('# ', '').trim())}</h1>`;
    } else if (line.startsWith('- ')) {
      if (!html.endsWith('</ul>')) {
        html += '<ul>';
      }
      html += `<li>${escapeHtml(line.replace('- ', '').trim())}</li>`;
    } else if (line.trim() === '') {
      if (html.endsWith('</li>')) {
        html += '</ul>';
      } else {
        html += '<p></p>';
      }
    } else {
      html += `<p>${escapeHtml(line.trim())}</p>`;
    }
  });
  if (html.endsWith('</li>')) html += '</ul>';
  return html;
}

function renderHelp(filter = '') {
  const content = state.helpContent || '';
  const html = mdToHtml(content);
  if (!filter) {
    helpBody.innerHTML = html;
    return;
  }
  const lower = filter.toLowerCase();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  wrapper.querySelectorAll('p, li, h1, h2, h3').forEach((node) => {
    const text = node.textContent || '';
    if (text.toLowerCase().includes(lower)) {
      const regex = new RegExp(`(${filter})`, 'ig');
      node.innerHTML = escapeHtml(text).replace(regex, '<mark>$1</mark>');
    }
  });
  helpBody.innerHTML = wrapper.innerHTML;
}

function openHelp() {
  if (!helpModal) return;
  helpModal.classList.add('open');
  helpModal.setAttribute('aria-hidden', 'false');
  helpSearch?.focus();
}

function closeHelp() {
  if (!helpModal) return;
  helpModal.classList.remove('open');
  helpModal.setAttribute('aria-hidden', 'true');
}

function clearDynamicFields() {
  dynamicFields.innerHTML = '';
  imageFields.innerHTML = '';
}

function normalizeDateValue(val) {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  const parsed = new Date(val);
  if (Number.isNaN(parsed.valueOf())) return '';
  return parsed.toISOString().slice(0, 10);
}

function isDateField(field) {
  const key = (field.key || '').toLowerCase();
  const label = (field.label || '').toLowerCase();
  return (
    key.includes('issuedate') ||
    key.includes('issue') ||
    key.includes('validity') ||
    key.includes('valid') ||
    label.includes('издаден') ||
    label.includes('валиден') ||
    label.includes('izdaden') ||
    label.includes('validen')
  );
}

function createInputField(field, value) {
  const wrapper = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = field.label || field.key;
  wrapper.appendChild(span);
  const isValueField =
    VALUE_FIELD_KEYS.includes(field.key) ||
    (field.label && VALUE_FIELD_KEYS.includes(field.label.trim()));
  if (isValueField) {
    const row = document.createElement('div');
    row.className = 'value-select-row';
    const select = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '';
    select.appendChild(blank);
    (state.valueOptions || []).forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    });
    select.name = field.key;
    select.value = value || '';
    select.addEventListener('change', handleFieldInput);
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.title = 'Добави стойност';
    addBtn.addEventListener('click', async () => {
      const newVal = await openValueModal();
      if (!newVal) return;
      await addValueOption(newVal);
      select.value = newVal;
      updateVoucherData(field.key, newVal);
      renderPreview();
      renderDynamicForm();
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '−';
    delBtn.title = 'Изтрий избраната стойност';
    delBtn.addEventListener('click', async () => {
      const val = select.value;
      if (!val) return;
      await deleteValueOption(val);
      select.value = '';
      updateVoucherData(field.key, '');
      renderPreview();
      renderDynamicForm();
    });
    row.appendChild(select);
    row.appendChild(addBtn);
    row.appendChild(delBtn);
    wrapper.appendChild(row);
    return wrapper;
  }
  const useTextarea = (field.h || 0) > 80 || (field.key || '').toLowerCase().includes('note');
  if (useTextarea) {
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.name = field.key;
    textarea.value = value || '';
    textarea.addEventListener('input', handleFieldInput);
    wrapper.appendChild(textarea);
  } else {
    const input = document.createElement('input');
    input.type = isDateField(field) ? 'date' : field.type === 'qr' ? 'url' : 'text';
    input.name = field.key;
    input.value = isDateField(field) ? normalizeDateValue(value) : value || '';
    input.addEventListener('input', handleFieldInput);
    wrapper.appendChild(input);
  }
  return wrapper;
}

function createImageField(field, currentPath) {
  const container = document.createElement('div');
  container.className = 'image-field-row';
  const info = document.createElement('div');
  info.className = 'image-info';
  info.innerHTML = `<div class="image-label">${escapeHtml(field.label || field.key)}</div><div class="image-path">${currentPath ? escapeHtml(currentPath) : 'No image'}</div>`;
  const actions = document.createElement('div');
  actions.className = 'image-actions';
  const btnUpload = document.createElement('button');
  btnUpload.type = 'button';
  btnUpload.textContent = 'Upload Image';
  btnUpload.addEventListener('click', () => handleUploadImage(field.key));
  const btnClear = document.createElement('button');
  btnClear.type = 'button';
  btnClear.textContent = 'Clear';
  btnClear.addEventListener('click', () => handleClearImage(field.key));
  actions.appendChild(btnUpload);
  actions.appendChild(btnClear);
  container.appendChild(info);
  container.appendChild(actions);
  return container;
}
async function renderDynamicForm() {
  clearDynamicFields();
  const tpl = await ensureTemplateData(state.currentTemplateId);
  if (!tpl) return;
  const layoutFields = tpl.layout?.fields || [];
  const imageFieldDefs = [];
  layoutFields.forEach((field) => {
    if (field.type === 'image') {
      imageFieldDefs.push(field);
      return;
    }
    if (field.key === 'InstagramLink' || field.key === 'FacebookLink') {
      return;
    }
    const value = state.currentVoucher.data[field.key] || '';
    const inputEl = createInputField(field, value);
    dynamicFields.appendChild(inputEl);
  });

  const imagesHeading = document.createElement('h3');
  imagesHeading.textContent = 'Voucher Images';
  imageFields.appendChild(imagesHeading);
  if (!imageFieldDefs.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No image fields for this template.';
    imageFields.appendChild(empty);
  } else {
    imageFieldDefs.forEach((field) => {
      const row = createImageField(field, state.currentVoucher.images?.[field.key]);
      imageFields.appendChild(row);
    });
  }
}

function updateVoucherData(key, value) {
  const next = { ...(state.currentVoucher.data || {}), [key]: value };
  if (key === 'VoucherCode' || key === 'Code') {
    const serial = sanitizeSerial(value);
    next.VoucherCode = serial;
    next.Code = serial;
  }
  state.currentVoucher.data = next;
}

function handleFieldInput(event) {
  const key = event.target.name;
  const value = event.target.value;
  updateVoucherData(key, value);
  renderPreview();
}

function applyFormValues() {
  if (inputVoucherCode) {
    inputVoucherCode.value = state.currentVoucher.data?.VoucherCode || state.currentVoucher.data?.Code || '';
  }
  if (inputInstagram) inputInstagram.value = state.currentVoucher.data?.InstagramLink || '';
  if (inputFacebook) inputFacebook.value = state.currentVoucher.data?.FacebookLink || '';
  const values = state.currentVoucher.data || {};
  dynamicFields.querySelectorAll('input, textarea').forEach((input) => {
    const key = input.name;
    if (key && Object.prototype.hasOwnProperty.call(values, key)) {
      input.value = input.type === 'date' ? normalizeDateValue(values[key]) : values[key] || '';
    }
  });
  applyBuilderScale();
}

function validateVoucherForm() {
  let ok = true;
  const helper = document.querySelector('[data-helper-for="VoucherCode"]');
  const codeVal = inputVoucherCode?.value?.trim();
  const sanitized = sanitizeSerial(codeVal);
  if (!sanitized || sanitized.length !== 6) {
    ok = false;
    if (helper) helper.textContent = 'Enter 6 digits';
    inputVoucherCode?.classList.add('error');
  } else {
    inputVoucherCode.value = sanitized;
    updateVoucherData('VoucherCode', sanitized);
    if (helper) helper.textContent = '';
    inputVoucherCode?.classList.remove('error');
  }
  return ok;
}

async function loadSavedList() {
  const res = await window.api.vouchers.list(30, state.searchText || '');
  if (res?.ok) {
    state.vouchers = res.items || [];
    renderSavedList();
  }
}

function renderSavedList() {
  savedList.innerHTML = '';
  if (!state.vouchers.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No saved vouchers yet.';
    savedList.appendChild(empty);
    return;
  }
  state.vouchers.forEach((v) => {
    const item = document.createElement('div');
    item.className = 'saved-item' + (v.id === state.selectedVoucherId ? ' selected' : '');
    item.dataset.id = v.id;
    const title = v.data?.RecipientName || v.data?.Name || v.id;
    const code = v.data?.VoucherCode || v.data?.Code || v.id;
    item.innerHTML = `
      <div class="saved-title">${escapeHtml(title)}</div>
      <div class="saved-meta">${escapeHtml(code || '')}</div>
      <div class="saved-meta">${escapeHtml(v.templateId || '')}</div>
    `;
    item.addEventListener('click', () => loadVoucher(v.id));
    savedList.appendChild(item);
  });
}

async function loadVoucher(id) {
  const res = await window.api.vouchers.get(id);
  if (!res?.ok) {
    setStatus(res?.error || 'Failed to load voucher', true);
    return;
  }
  state.selectedVoucherId = id;
  state.currentVoucher = {
    id: res.item.id,
    templateId: res.item.templateId,
    data: res.item.data || {},
    images: res.item.images || {}
  };
  state.imageData = res.imagesData || {};
  if (state.currentVoucher.templateId) {
    await changeTemplate(state.currentVoucher.templateId);
  } else {
    renderDynamicForm();
  }
  applyFormValues();
  renderSavedList();
  renderPreview();
  setStatus('Voucher loaded');
}

function newVoucher() {
  const newId = `V-${Date.now()}`;
  const codeValue = generateSerial();
  state.currentVoucher = {
    id: newId,
    templateId: state.currentTemplateId || (state.templates[0]?.id || null),
    data: {
      VoucherCode: codeValue,
      Code: codeValue,
      IssueDate: new Date().toISOString().slice(0, 10),
      InstagramLink: 'https://www.instagram.com/actiondays.kalofer?igsh=MWxtYWJzMzg4c2Iy',
      FacebookLink: 'https://www.facebook.com/share/1AFAZSUgzW/'
    },
    images: {}
  };
  state.selectedVoucherId = null;
  state.imageData = {};
  applyFormValues();
  renderDynamicForm();
  renderSavedList();
  renderPreview();
  setStatus('New voucher started');
}

async function saveCurrentVoucher(asCopy = false) {
  if (!validateVoucherForm()) {
    setStatus('Please fill required fields', true);
    return;
  }
  if (!state.currentTemplateId) {
    setStatus('Select a template first', true);
    return;
  }
  const payload = {
    ...state.currentVoucher,
    templateId: state.currentTemplateId
  };
  if (!payload.data) payload.data = {};
  const serial = sanitizeSerial(payload.data.VoucherCode || payload.data.Code);
  payload.data.VoucherCode = serial;
  payload.data.Code = serial;
  if (payload.data.VoucherCode && !payload.data.Code) {
    payload.data.Code = payload.data.VoucherCode;
  }
  if (payload.data.Code && !payload.data.VoucherCode) {
    payload.data.VoucherCode = payload.data.Code;
  }
  if (asCopy || !payload.id) {
    delete payload.id;
    if (!payload.data) payload.data = {};
    payload.data.VoucherCode = payload.data.VoucherCode || generateSerial();
    payload.data.Code = payload.data.VoucherCode;
  }
  const res = await window.api.vouchers.save(payload);
  if (res?.ok) {
    state.currentVoucher = {
      id: res.item.id,
      templateId: res.item.templateId,
      data: res.item.data || {},
      images: res.item.images || {}
    };
    state.imageData = res.imagesData || {};
    state.selectedVoucherId = res.item.id;
    await loadSavedList();
    renderSavedList();
    applyFormValues();
    renderPreview();
    setStatus('Voucher saved');
    logTest('save_voucher', payload);
    await loadVoucherStatusList();
  } else {
    setStatus(res?.error || 'Save failed', true);
  }
}

async function saveCopyCurrent() {
  if (state.currentVoucher.id) {
    const res = await window.api.vouchers.duplicate(state.currentVoucher.id);
    if (res?.ok) {
      state.currentVoucher = {
        id: res.item.id,
        templateId: res.item.templateId,
        data: res.item.data || {},
        images: res.item.images || {}
      };
      state.imageData = res.imagesData || {};
      state.selectedVoucherId = res.item.id;
      await loadSavedList();
      renderDynamicForm();
      applyFormValues();
      renderPreview();
      setStatus('Saved as copy');
      logTest('save_copy', res.item);
      await loadVoucherStatusList();
      return;
    }
  }
  await saveCurrentVoucher(true);
}

async function deleteCurrentVoucher() {
  if (!state.selectedVoucherId) return;
  const confirmed = window.confirm('Delete this voucher?');
  if (!confirmed) return;
  const res = await window.api.vouchers.delete(state.selectedVoucherId);
  if (res?.ok) {
    state.selectedVoucherId = null;
    await loadSavedList();
    newVoucher();
    setStatus('Voucher deleted');
    logTest('delete_voucher', state.selectedVoucherId);
    await loadVoucherStatusList();
  } else {
    setStatus(res?.error || 'Delete failed', true);
  }
}

async function clearAllVouchers() {
  const confirmed = window.confirm('Clear all saved vouchers? This removes records and images.');
  if (!confirmed) return;
  const res = await window.api.vouchers.clearAll();
  if (res?.ok) {
    state.selectedVoucherId = null;
    state.vouchers = [];
    state.imageData = {};
    newVoucher();
    renderSavedList();
    renderPreview();
    setStatus('All vouchers cleared');
    await loadVoucherStatusList();
  } else {
    setStatus(res?.error || 'Clear failed', true);
  }
}

async function handleUploadImage(imageKey) {
  const res = await window.api.vouchers.pickImage(state.currentVoucher.id, imageKey);
  if (res?.ok && res.voucher) {
    state.currentVoucher = {
      id: res.voucher.id,
      templateId: res.voucher.templateId,
      data: res.voucher.data || state.currentVoucher.data,
      images: res.voucher.images || {}
    };
    state.imageData = res.imagesData || state.imageData;
    state.selectedVoucherId = res.voucher.id;
    await loadSavedList();
    renderDynamicForm();
    applyFormValues();
    renderPreview();
    setStatus('Image attached');
  } else if (res?.ok) {
    if (res.id && !state.currentVoucher.id) state.currentVoucher.id = res.id;
    state.currentVoucher.images = { ...(state.currentVoucher.images || {}), [imageKey]: res.path };
    if (res.dataUrl) {
      state.imageData = { ...(state.imageData || {}), [imageKey]: res.dataUrl };
    }
    renderDynamicForm();
    renderPreview();
    setStatus('Image attached');
  } else if (res?.canceled) {
    setStatus('Image selection canceled');
  } else {
    setStatus(res?.error || 'Image upload failed', true);
  }
}

async function handleClearImage(imageKey) {
  if (!state.currentVoucher.id) return;
  const res = await window.api.vouchers.clearImage(state.currentVoucher.id, imageKey);
  if (res?.ok) {
    if (res.voucher) {
      state.currentVoucher.images = res.voucher?.images || {};
    } else {
      state.currentVoucher.images = { ...(state.currentVoucher.images || {}) };
      delete state.currentVoucher.images[imageKey];
    }
    delete state.imageData?.[imageKey];
    await loadSavedList();
    renderDynamicForm();
    applyFormValues();
    renderPreview();
    setStatus('Image cleared');
  } else {
    setStatus(res?.error || 'Clear failed', true);
  }
}

function buildPreviewData() {
  const data = { ...(state.currentVoucher.data || {}) };
  Object.entries(state.imageData || {}).forEach(([key, val]) => {
    data[key] = val;
  });
  return data;
}

async function renderPreview() {
  if (!state.previewReady || !state.currentTemplateId) return;
  const tpl = await ensureTemplateData(state.currentTemplateId);
  if (!tpl) return;
  const data = buildPreviewData();
  const metaForPreview = { ...(tpl.meta || {}) };
  if (state.builder.cacheBust && metaForPreview.id === state.builder.meta?.id) {
    if (metaForPreview.backgroundUrl) {
      const sep = metaForPreview.backgroundUrl.includes('?') ? '&' : '?';
      metaForPreview.backgroundUrl = `${metaForPreview.backgroundUrl}${sep}cb=${state.builder.cacheBust}`;
    }
  }
  const frameWin = previewFrame.contentWindow;
  if (frameWin && typeof frameWin.renderVoucher === 'function') {
    frameWin.renderVoucher(data, metaForPreview, tpl.layout);
    applyPreviewScale(metaForPreview);
  } else {
    previewFrame.contentWindow?.addEventListener('DOMContentLoaded', () => {
      previewFrame.contentWindow?.renderVoucher?.(data, metaForPreview, tpl.layout);
      applyPreviewScale(metaForPreview);
    });
  }
}

  function applyPreviewScale(meta) {
    try {
      const frameWin = previewFrame?.contentWindow;
      const doc = frameWin?.document;
      const pageEl = doc?.getElementById('page');
      if (!pageEl || !doc) return;
      const width = meta?.page?.widthPx || 1200;
      const height = meta?.page?.heightPx || 566;
      const containerWidth = previewFrame.parentElement?.clientWidth || previewFrame.clientWidth || width;
      const available = Math.max(containerWidth - 12, 200);
      const scale = Math.min(available / width, 1);
      previewFrame.style.width = '100%';
      previewFrame.style.maxWidth = '100%';
      // Use zoom so the layout box also shrinks (avoids clipping/scrollbars)
      pageEl.style.transform = 'none';
      pageEl.style.transformOrigin = 'top left';
      pageEl.style.zoom = String(scale);
      // Keep the iframe tall enough for the zoomed content
      const scaledHeight = Math.ceil(height * scale);
      previewFrame.style.height = `${scaledHeight + 24}px`;
      // Ensure the inner document doesn't add extra margins/scrollbars
      doc.documentElement.style.overflow = 'hidden';
      doc.body.style.margin = '0';
      doc.body.style.padding = '0';
      doc.body.style.display = 'flex';
      doc.body.style.justifyContent = 'center';
      doc.body.style.alignItems = 'flex-start';
      doc.body.style.background = 'transparent';
    } catch (err) {
      console.error(err);
    }
  }

async function handleExport(format = 'pdf') {
  if (!state.currentTemplateId) return;
  const data = { ...(state.currentVoucher.data || {}) };
  const res =
    format === 'png'
      ? await window.voucherAPI.exportPng(data, state.currentTemplateId, state.currentVoucher.images || {})
      : await window.voucherAPI.exportPdf(data, state.currentTemplateId, state.currentVoucher.images || {});
  if (res?.ok) {
    setStatus(`Exported to ${res.outPath || 'Downloads'}`);
    logTest(`export_${format}`, res.outPath || '');
  } else {
    setStatus(res?.error || 'Export failed', true);
  }
}

function switchView(viewName) {
  views.forEach((view) => view.classList.toggle('active', view.dataset.view === viewName));
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.viewTarget === viewName));
}

function switchMainSection(target) {
  if (target === 'builder') {
    sectionVouchers.style.display = 'none';
    sectionBuilder.style.display = 'block';
    navVouchers.classList.remove('active');
    navBuilder.classList.add('active');
    initBuilder();
    updateBuilderResponsive();
  } else {
    sectionVouchers.style.display = 'block';
    sectionBuilder.style.display = 'none';
    navVouchers.classList.add('active');
    navBuilder.classList.remove('active');
  }
}
function renderValidateDetails(voucher, status) {
  if (!voucher) return 'Not found.';
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.valueOf())) return dateStr;
    return parsed.toLocaleDateString();
  };
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.valueOf())) return dateStr;
    return parsed.toLocaleString();
  };
  return `
    <div class="validate-row">
      <span class="label">Name</span>
      <span>${escapeHtml(voucher.name || '')}</span>
    </div>
    <div class="validate-row">
      <span class="label">Value</span>
      <span>${escapeHtml(voucher.value || '')}</span>
    </div>
    <div class="validate-row">
      <span class="label">Code</span>
      <span class="mono">${escapeHtml(voucher.code || '')}</span>
    </div>
    <div class="validate-row">
      <span class="label">Template</span>
      <span>${escapeHtml(voucher.templateId || '')}</span>
    </div>
    <div class="validate-row">
      <span class="label">Expires</span>
      <span>${escapeHtml(formatDate(voucher.expires))}</span>
    </div>
    <div class="validate-row">
      <span class="label">Saved</span>
      <span>${escapeHtml(formatDateTime(voucher.createdAt))}</span>
    </div>
    <div class="validate-row">
      <span class="label">Redeemed</span>
      <span>${voucher.redeemedAt ? escapeHtml(formatDateTime(voucher.redeemedAt)) : 'Not redeemed'}</span>
    </div>
    <div class="validate-row">
      <span class="label">Status</span>
      <span><span class="badge ${status}">${status}</span></span>
    </div>
  `;
}

function renderValidateResult(status, voucher) {
  let message = '';
  switch (status) {
    case 'valid':
      message = 'Voucher is valid.';
      break;
    case 'expired':
      message = 'Voucher is expired.';
      break;
    case 'redeemed':
      message = 'Voucher has already been redeemed.';
      break;
    default:
      message = 'Voucher not found.';
  }

  validateResult.innerHTML = `
    <div class="validate-status">
      <span class="badge ${status}">${status}</span>
      <span>${message}</span>
    </div>
    ${voucher ? `<div class="validate-details">${renderValidateDetails(voucher, status)}</div>` : ''}
  `;
}

async function handleValidate() {
  const code = validateCodeInput.value.trim();
  validateBtn.disabled = true;
  validateRedeemBtn.disabled = true;
  validateResult.textContent = 'Validating...';

  try {
    const res = await window.voucherAPI.validateCode(code);
    if (!res?.ok) {
      validateResult.textContent = `Validation failed${res?.error ? `: ${res.error}` : ''}`;
      return;
    }
    state.validatedVoucher = res.voucher || null;
    renderValidateResult(res.status, state.validatedVoucher);
    validateRedeemBtn.disabled = !(state.validatedVoucher && res.status === 'valid');
  } catch (err) {
    console.error(err);
    validateResult.textContent = `Validation failed: ${err.message}`;
  } finally {
    validateBtn.disabled = false;
  }
}

async function handleRedeem() {
  validateRedeemBtn.disabled = true;
  validateResult.textContent = 'Marking redeemed...';
  try {
    const res = await window.voucherAPI.redeemVoucher(state.validatedVoucher?.id);
    if (res?.ok) {
      renderValidateResult('redeemed', res.row);
      validateRedeemBtn.disabled = true;
      await loadVoucherStatusList();
    } else {
      validateResult.textContent = `Redeem failed${res?.error ? `: ${res.error}` : ''}`;
    }
  } catch (err) {
    console.error(err);
    validateResult.textContent = `Redeem failed: ${err.message}`;
  }
}

function computeVoucherStatus(row) {
  if (!row) return 'not_found';
  const now = new Date();
  if (row.redeemedAt) return 'redeemed';
  if (row.expires) {
    const exp = new Date(row.expires);
    if (!Number.isNaN(exp.valueOf()) && exp < now) return 'expired';
  }
  return 'valid';
}

function renderVoucherStatusList() {
  if (!voucherStatusList) return;
  voucherStatusList.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'voucher-status-item header';
  header.innerHTML = '<div>Name</div><div>Code</div><div>Status</div><div>Expires</div>';
  voucherStatusList.appendChild(header);
  const filtered = (state.validateList || []).filter((row) => {
    const status = computeVoucherStatus(row);
    if (state.validateFilter === 'all') return true;
    if (state.validateFilter === 'redeemed') return status === 'redeemed';
    if (state.validateFilter === 'valid') return status !== 'redeemed';
    return true;
  });
  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'voucher-status-item';
    empty.textContent = 'No vouchers found.';
    voucherStatusList.appendChild(empty);
    return;
  }
  filtered.forEach((row) => {
    const status = computeVoucherStatus(row);
    const expires =
      row.expires && !Number.isNaN(new Date(row.expires).valueOf())
        ? new Date(row.expires).toLocaleDateString()
        : '';
    const item = document.createElement('div');
    item.className = 'voucher-status-item';
    item.innerHTML = `
      <div>${escapeHtml(row.name || '')}</div>
      <div class="mono">${escapeHtml(row.code || '')}</div>
      <div><span class="badge ${status}">${status}</span></div>
      <div>${escapeHtml(expires)}</div>
    `;
    voucherStatusList.appendChild(item);
  });
}

async function loadVoucherStatusList() {
  try {
    const res = await window.voucherAPI.listVouchers(100);
    let rows = res?.ok ? res.rows || [] : [];
    const seenCodes = new Set(rows.map((r) => r.code));
    (state.vouchers || []).forEach((v) => {
      const code = v.data?.VoucherCode || v.data?.Code || v.id;
      if (!seenCodes.has(code)) {
        rows.push({
          name: v.data?.RecipientName || v.data?.Name || '',
          code,
          templateId: v.templateId,
          expires: v.data?.Validity || '',
          redeemedAt: null
        });
      }
    });
    state.validateList = rows;
    renderVoucherStatusList();
  } catch (err) {
    console.error(err);
  }
}

// Builder helpers
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function renderBuilderBackground() {
  if (!canvasInner || !state.builder.meta) return;
  const page = state.builder.meta.page || { widthPx: 794, heightPx: 1123 };
  const bg = state.builder.meta.backgroundUrl || state.builder.meta.background;
  const fit = state.builder.meta.backgroundFit || 'cover';
  const sep = bg && bg.includes('?') ? '&' : '?';
  const cacheBust = state.builder.cacheBust || 0;
  const bgUrl = bg ? `${bg}${sep}cb=${cacheBust}` : '';
  canvasInner.style.backgroundImage = bgUrl ? `url(${bgUrl})` : 'none';
  let size = 'cover';
  if (fit === 'contain') size = 'contain';
  else if (fit === 'stretch') size = '100% 100%';
  else if (fit === 'none') size = 'auto';
  canvasInner.style.backgroundSize = size;
  canvasInner.style.backgroundRepeat = 'no-repeat';
  canvasInner.style.backgroundPosition = 'center';
  applyBuilderScale();
}

function highlightBuilderSelection() {
  const items = fieldsList.querySelectorAll('.field-item');
  items.forEach((el) => {
    el.classList.toggle('selected', el.dataset.key === (state.builder.selectedField?.key || ''));
  });
  const boxes = canvasInner.querySelectorAll('.field-box');
  boxes.forEach((el) => {
    el.classList.toggle('selected', el.dataset.key === (state.builder.selectedField?.key || ''));
  });
}

function updatePropsPanel() {
  const f = state.builder.selectedField;
  propKey.value = f?.key || '';
  propLabel.value = f?.label || '';
  propType.value = f?.type || 'text';
  propX.value = f?.x ?? '';
  propY.value = f?.y ?? '';
  propW.value = f?.w ?? '';
  propH.value = f?.h ?? '';
  propFontFamily.value = f?.fontFamily || FONT_OPTIONS[0];
  propFont.value = f?.fontSize ?? '';
  propWeight.value = f?.fontWeight ?? '';
  propColor.value = f?.color || '#111111';
  propAlign.value = (f?.align || 'center').toLowerCase();
  const textControlsDisabled = !f || f.type !== 'text';
  [propFontFamily, propFont, propWeight, propColor, propAlign].forEach((el) => {
    el.disabled = textControlsDisabled;
  });
}

function setDrawerState(col, collapsed) {
  if (!col) return;
  if (collapsed) {
    col.classList.add('collapsed');
    col.classList.remove('drawer-open');
    col.style.display = 'none';
  } else {
    col.classList.remove('collapsed');
    col.style.display = 'block';
  }
  applyBuilderScale();
}

function toggleDrawer(col, side = 'left') {
  if (!col) return;
  if (window.innerWidth <= 900) {
    const open = !col.classList.contains('drawer-open');
    document.querySelectorAll('.builder-col').forEach((c) => c.classList.remove('drawer-open'));
    if (open) {
      col.classList.add('drawer-open');
      col.style.display = 'block';
    } else {
      col.classList.remove('drawer-open');
      col.style.display = 'none';
    }
  } else {
    const collapsed = col.classList.toggle('collapsed');
    col.style.display = collapsed ? 'none' : 'block';
  }
  applyBuilderScale();
}

function updateBuilderResponsive() {
  if (window.innerWidth <= 900) {
    builderToolsCol?.classList.add('collapsed');
    builderPropsCol?.classList.add('collapsed');
    builderToolsCol && (builderToolsCol.style.display = 'none');
    builderPropsCol && (builderPropsCol.style.display = 'none');
  } else {
    builderToolsCol?.classList.remove('collapsed', 'drawer-open');
    builderPropsCol?.classList.remove('collapsed', 'drawer-open');
    builderToolsCol && (builderToolsCol.style.display = 'block');
    builderPropsCol && (builderPropsCol.style.display = 'block');
  }
  applyBuilderScale();
}

function selectBuilderField(field) {
  state.builder.selectedField = field;
  highlightBuilderSelection();
  updatePropsPanel();
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function startDragField(field, box, event) {
  const canvasRect = canvasInner.getBoundingClientRect();
  const scale = state.builderScale || 1;
  const startX = event.clientX;
  const startY = event.clientY;
  const boxRect = box.getBoundingClientRect();
  const offsetX = (startX - boxRect.left) / scale;
  const offsetY = (startY - boxRect.top) / scale;
  box.setPointerCapture(event.pointerId);

  const onMove = (ev) => {
    const x = clamp((ev.clientX - canvasRect.left) / scale - offsetX, 0, canvasRect.width / scale - (field.w || 0));
    const y = clamp((ev.clientY - canvasRect.top) / scale - offsetY, 0, canvasRect.height / scale - (field.h || 0));
    field.x = Math.round(x);
    field.y = Math.round(y);
    box.style.left = `${field.x}px`;
    box.style.top = `${field.y}px`;
    updatePropsPanel();
    highlightBuilderSelection();
  };

  const onUp = (ev) => {
    box.releasePointerCapture(ev.pointerId);
    canvasInner.removeEventListener('pointermove', onMove);
    canvasInner.removeEventListener('pointerup', onUp);
  };

  canvasInner.addEventListener('pointermove', onMove);
  canvasInner.addEventListener('pointerup', onUp);
}

function startResizeField(field, box, event) {
  const canvasRect = canvasInner.getBoundingClientRect();
  const scale = state.builderScale || 1;
  const startX = event.clientX;
  const startY = event.clientY;
  const startW = field.w || 0;
  const startH = field.h || 0;
  box.setPointerCapture(event.pointerId);

  const onMove = (ev) => {
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    field.w = clamp(Math.round(startW + dx), 10, canvasRect.width / scale - (field.x || 0));
    field.h = clamp(Math.round(startH + dy), 10, canvasRect.height / scale - (field.y || 0));
    box.style.width = `${field.w}px`;
    box.style.height = `${field.h}px`;
    updatePropsPanel();
  };

  const onUp = (ev) => {
    box.releasePointerCapture(ev.pointerId);
    canvasInner.removeEventListener('pointermove', onMove);
    canvasInner.removeEventListener('pointerup', onUp);
  };

  canvasInner.addEventListener('pointermove', onMove);
  canvasInner.addEventListener('pointerup', onUp);
}
function renderBuilderFields() {
  if (!state.builder.layout) {
    fieldsList.innerHTML = '<div class="empty-state">No layout loaded.</div>';
    canvasInner.innerHTML = '';
    state.builder.selectedField = null;
    updatePropsPanel();
    return;
  }

  fieldsList.innerHTML = '';
  canvasInner.innerHTML = '';

  (state.builder.layout.fields || []).forEach((field) => {
    const item = document.createElement('div');
    item.className = 'field-item';
    item.dataset.key = field.key || '';
    const title = document.createElement('div');
    title.className = 'field-title';
    const titleText = document.createElement('span');
    titleText.textContent = field.label || field.key || 'Field';
    const typeBadge = document.createElement('span');
    typeBadge.className = 'field-type-badge';
    typeBadge.textContent = field.type || 'text';
    title.appendChild(titleText);
    title.appendChild(typeBadge);

    const controls = document.createElement('div');
    controls.className = 'field-inline-controls';
    const labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.value = field.label || '';
    labelInput.placeholder = 'Label';
    labelInput.addEventListener('input', () => {
      field.label = labelInput.value;
      titleText.textContent = field.label || field.key || 'Field';
      renderBuilderFields();
      selectBuilderField(field);
    });

    const typeSelect = document.createElement('select');
    ['text', 'qr', 'image'].forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t.toUpperCase();
      if (t === (field.type || 'text')) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('change', () => {
      field.type = typeSelect.value;
      renderBuilderFields();
      selectBuilderField(field);
    });

    const fontSelect = document.createElement('select');
    FONT_OPTIONS.forEach((f) => {
      const opt = document.createElement('option');
      opt.value = f;
      opt.textContent = f.split(',')[0];
      if (f === (field.fontFamily || FONT_OPTIONS[0])) opt.selected = true;
      fontSelect.appendChild(opt);
    });
    fontSelect.disabled = field.type !== 'text';
    fontSelect.addEventListener('change', () => {
      field.fontFamily = fontSelect.value;
      renderBuilderFields();
      selectBuilderField(field);
    });

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = field.color || '#111111';
    colorInput.disabled = field.type !== 'text';
    colorInput.addEventListener('input', () => {
      field.color = colorInput.value;
      renderBuilderFields();
      selectBuilderField(field);
    });

    const alignSelect = document.createElement('select');
    ['left', 'center', 'right'].forEach((pos) => {
      const opt = document.createElement('option');
      opt.value = pos;
      opt.textContent = pos.toUpperCase();
      if (pos === (field.align || 'center').toLowerCase()) opt.selected = true;
      alignSelect.appendChild(opt);
    });
    alignSelect.disabled = field.type !== 'text';
    alignSelect.addEventListener('change', () => {
      field.align = alignSelect.value;
      renderBuilderFields();
      selectBuilderField(field);
    });

    controls.appendChild(labelInput);
    controls.appendChild(typeSelect);
    controls.appendChild(fontSelect);
    controls.appendChild(colorInput);
    controls.appendChild(alignSelect);

    item.appendChild(title);
    item.appendChild(controls);
    item.addEventListener('click', () => selectBuilderField(field));
    fieldsList.appendChild(item);

    const box = document.createElement('div');
    box.className = 'field-box';
    box.dataset.key = field.key || '';
    box.style.left = `${field.x || 0}px`;
    box.style.top = `${field.y || 0}px`;
    box.style.width = `${field.w || 120}px`;
    box.style.height = `${field.h || 40}px`;
    const align = (field.align || 'center').toLowerCase();
    box.style.textAlign = align;
    box.style.justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    box.innerHTML = `
      <div class="field-box-name">${escapeHtml(field.label || field.key || '')}</div>
      <div class="field-box-type">${field.type || 'text'}</div>
    `;
    if (field.type === 'image') {
      let assetUrl = '';
      if (field.asset) {
        const tplId = tplSelect.value;
        assetUrl = `../templates/${tplId}/${field.asset}`;
      } else if (state.builder.meta?.logoUrl) {
        assetUrl = state.builder.meta.logoUrl;
      }
      if (assetUrl) {
        box.style.backgroundImage = `url(${assetUrl})`;
        box.style.backgroundSize = 'contain';
        box.style.backgroundRepeat = 'no-repeat';
        box.style.backgroundPosition = 'center';
      }
    }
    box.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectBuilderField(field);
      startDragField(field, box, e);
    });
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      selectBuilderField(field);
    });
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectBuilderField(field);
      startResizeField(field, box, e);
    });
    box.appendChild(resizeHandle);
    canvasInner.appendChild(box);
  });

  highlightBuilderSelection();
}

function applyPropChanges() {
  if (!state.builder.selectedField) return;
  const f = state.builder.selectedField;
  const fields = state.builder.layout?.fields || [];
  const newKey = propKey.value.trim() || f.key;
  const keyConflict = fields.some((fld) => fld !== f && fld.key === newKey);
  if (!keyConflict) {
    f.key = newKey;
  }
  f.label = propLabel.value.trim() || f.label || f.key;
  f.type = propType.value || f.type || 'text';
  f.x = Math.max(0, parseFloat(propX.value) || 0);
  f.y = Math.max(0, parseFloat(propY.value) || 0);
  f.w = Math.max(10, parseFloat(propW.value) || 10);
  f.h = Math.max(10, parseFloat(propH.value) || 10);
  f.fontFamily = propFontFamily.value || FONT_OPTIONS[0];
  f.fontSize = parseFloat(propFont.value) || f.fontSize || 14;
  f.fontWeight = propWeight.value || f.fontWeight || '400';
  f.color = propColor.value || f.color || '#111111';
  f.align = (propAlign.value || f.align || 'center').toLowerCase();

  renderBuilderFields();
  selectBuilderField(f);
}

async function handleAddSticker() {
  const id = tplSelect.value;
  if (!id) return;
  const res = await window.api.templates.addSticker(id);
  if (res?.ok && res.path) {
    if (!state.builder.layout) state.builder.layout = { fields: [] };
    const field = {
      key: `Sticker${state.builder.layout.fields.length + 1}`,
      label: 'Sticker',
      type: 'image',
      x: 40,
      y: 40,
      w: 140,
      h: 140,
      asset: res.path
    };
    state.builder.layout.fields.push(field);
    renderBuilderFields();
    selectBuilderField(field);
    setBuilderStatus('Sticker added');
  } else if (res?.canceled) {
    setBuilderStatus('Sticker selection canceled');
  } else {
    setBuilderStatus(res?.error || 'Failed to add sticker', true);
  }
}

function addField(type) {
  if (!state.builder.layout) state.builder.layout = { fields: [] };
const defaults = {
    key: `Field${state.builder.layout.fields.length + 1}`,
    label: 'Field',
    type,
    x: 50,
    y: 50,
    w: type === 'qr' ? 120 : 200,
    h: type === 'qr' ? 120 : 40,
    fontFamily: FONT_OPTIONS[0],
    fontSize: 16,
    fontWeight: '600',
    color: '#111111',
    align: 'center'
  };
  const field = { ...defaults };
  state.builder.layout.fields.push(field);
  renderBuilderFields();
  selectBuilderField(field);
}

async function saveBuilderTemplate() {
  const id = tplSelect.value;
  if (!id || !state.builder.layout || !state.builder.meta) return;
  try {
    const res = await window.api.templates.saveAll(id, state.builder.meta, state.builder.layout);
    if (res?.ok) {
      setBuilderStatus('Template saved');
      state.templateMeta.set(id, res.meta);
      state.layouts.set(id, JSON.parse(JSON.stringify(state.builder.layout)));
      if (state.currentTemplateId === id) {
        renderPreview();
      }
      logTest('save_template', id);
    } else {
      setBuilderStatus(res?.error || 'Save failed', true);
    }
  } catch (err) {
    console.error(err);
    setBuilderStatus(err.message, true);
  }
}

async function loadBuilderTemplates() {
  try {
    state.builder.templates = (await window.api.templates.list()) || [];
    tplSelect.innerHTML = '';
    state.builder.templates.forEach((tpl) => {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name || tpl.id;
      tplSelect.appendChild(opt);
    });
    if (state.builder.templates.length && !tplSelect.value) {
      tplSelect.value = state.builder.templates[0].id;
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadBuilderLayout() {
  const id = tplSelect.value;
  if (!id) return;
  try {
    const layout = await window.api.templates.readLayout(id);
    const meta = await window.api.templates.readMeta(id);
    state.builder.layout = JSON.parse(JSON.stringify(layout || { fields: [] }));
    state.builder.meta = { ...(meta || {}) };
    state.builder.cacheBust = Date.now();
    state.builder.selectedField = null;
    backgroundFitSelect.value = state.builder.meta.backgroundFit || 'cover';
    renderBuilderBackground();
    renderBuilderFields();
    updatePropsPanel();
  } catch (err) {
    console.error(err);
  }
}

async function handleSetBackground() {
  const id = tplSelect.value;
  if (!id) return;
  const res = await window.api.templates.setBackground(id);
  if (res?.ok && res.meta) {
    state.builder.meta = res.meta;
    state.builder.cacheBust = Date.now();
    backgroundFitSelect.value = state.builder.meta.backgroundFit || 'cover';
    renderBuilderBackground();
    setBuilderStatus('Background updated');
  } else if (res?.canceled) {
    setBuilderStatus('Background selection canceled');
  } else {
    setBuilderStatus(res?.error || 'Failed to set background', true);
  }
}

async function handleSetLogo() {
  const id = tplSelect.value;
  if (!id) return;
  const res = await window.api.templates.setLogo(id);
  if (res?.ok && res.meta) {
    state.builder.meta = res.meta;
    renderBuilderBackground();
    renderBuilderFields();
    setBuilderStatus('Logo updated');
  } else if (res?.canceled) {
    setBuilderStatus('Logo selection canceled');
  } else {
    setBuilderStatus(res?.error || 'Failed to set logo', true);
  }
}

async function handleRefreshBackground() {
  const id = tplSelect.value;
  if (!id) return;
  try {
    const meta = await window.api.templates.readMeta(id);
    state.builder.meta = meta || state.builder.meta || {};
    state.builder.cacheBust = Date.now();
    renderBuilderBackground();
    if (state.currentTemplateId === id) {
      await ensureTemplateData(id);
      state.templateMeta.set(id, meta || {});
      renderPreview();
    }
    setBuilderStatus('Background refreshed');
  } catch (err) {
    console.error(err);
    setBuilderStatus(err.message, true);
  }
}

async function createBuilderTemplate() {
  const id = prompt('New template id (folder name):');
  if (!id) return;
  const name = prompt('Template display name:', id) || id;
  try {
    const res = await window.api.templates.create({ id, name });
    if (res?.id) {
      await loadBuilderTemplates();
      tplSelect.value = res.id;
      await loadBuilderLayout();
      await loadTemplates();
      setBuilderStatus('Template created');
    } else {
      setBuilderStatus(res?.error || 'Create failed', true);
    }
  } catch (err) {
    console.error(err);
    setBuilderStatus(err.message, true);
  }
}

async function duplicateBuilderTemplate() {
  const source = tplSelect.value;
  if (!source) return;
  const newId = prompt('New template id (folder name):');
  if (!newId) return;
  const newName = prompt('Template display name:', newId) || newId;
  try {
    const res = await window.api.templates.duplicate(source, newId, newName);
    if (res?.ok) {
      await loadBuilderTemplates();
      tplSelect.value = res.id;
      await loadBuilderLayout();
      await loadTemplates();
      setBuilderStatus('Template duplicated');
    } else {
      setBuilderStatus(res?.error || 'Duplicate failed', true);
    }
  } catch (err) {
    console.error(err);
    setBuilderStatus(err.message, true);
  }
}

function handleBackgroundFitChange() {
  if (!state.builder.meta) state.builder.meta = {};
  state.builder.meta.backgroundFit = backgroundFitSelect.value || 'cover';
  renderBuilderBackground();
}

function deleteSelectedField() {
  if (!state.builder.selectedField || !state.builder.layout?.fields) return;
  state.builder.layout.fields = state.builder.layout.fields.filter((f) => f !== state.builder.selectedField);
  state.builder.selectedField = null;
  renderBuilderFields();
  updatePropsPanel();
}

async function initBuilder() {
  await loadBuilderTemplates();
  await loadBuilderLayout();
}

async function init() {
  await loadTheme();
  await loadValueOptions();
  fetchHelp();
  try {
    const v = await window.api.app.getVersion();
    if (v?.ok) {
      state.version = v.version;
    }
  } catch (err) {
    console.error(err);
  }
  const versionText = state.version || '1.0.0';
  if (helpVersion) {
    helpVersion.textContent = `LN Voucher - Version ${versionText}${state.testMode ? ' - Test version - feedback welcome' : ''}`;
  }
  updateBadges();
  previewFrame.src = '../templates/_base/template.html';
  previewFrame.addEventListener('load', () => {
    state.previewReady = true;
    renderPreview();
  });

  await loadTemplates();
  await changeTemplate(state.currentTemplateId);
  await loadSavedList();
  await loadVoucherStatusList();
  newVoucher();

  tabButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      switchView(btn.dataset.viewTarget);
    })
  );
  navVouchers.addEventListener('click', () => switchMainSection('vouchers'));
  navBuilder.addEventListener('click', () => switchMainSection('builder'));
  themeToggle?.addEventListener('click', toggleTheme);
  helpBtn?.addEventListener('click', openHelp);
  helpClose?.addEventListener('click', closeHelp);
  helpSearch?.addEventListener('input', (e) => {
    renderHelp(e.target.value || '');
  });
  helpModal?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeHelp();
    }
  });
  templateSelect.addEventListener('change', (e) => changeTemplate(e.target.value));
  savedSearch?.addEventListener('input', async (e) => {
    state.searchText = e.target.value || '';
    await loadSavedList();
  });
  btnNewVoucher?.addEventListener('click', newVoucher);
  btnDeleteVoucher?.addEventListener('click', deleteCurrentVoucher);
  btnClearVouchers?.addEventListener('click', clearAllVouchers);
  btnExportCsv?.addEventListener('click', async () => {
    const res = await window.api.vouchers.exportCsv();
    if (res?.ok) {
      setStatus(`Exported CSV to ${res.path}`);
    } else if (!res?.canceled) {
      setStatus(res?.error || 'Export failed', true);
    }
  });
  btnSaveVoucher?.addEventListener('click', () => saveCurrentVoucher(false));
  btnSaveCopy?.addEventListener('click', () => saveCopyCurrent());
  btnCreateTemplate?.addEventListener('click', async () => {
    const name = prompt('Template name?');
    if (!name) return;
    const meta = { name, id: name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || undefined };
    const res = await window.api.templates.create(meta);
    if (res?.id) {
      await loadTemplates();
      await changeTemplate(res.id);
      setStatus('Template created');
    }
  });
  btnRenameTemplate?.addEventListener('click', async () => {
    const tplId = state.currentTemplateId;
    if (!tplId) return;
    const currentName = state.templates.find((t) => t.id === tplId)?.name || tplId;
    const newName = prompt('Rename template to:', currentName);
    if (!newName || newName === currentName) return;
    const res = await window.api.templates.saveMeta(tplId, { name: newName });
    if (res?.ok) {
      await loadTemplates();
      await changeTemplate(tplId);
      setStatus('Template renamed');
    } else {
      setStatus(res?.error || 'Rename failed', true);
    }
  });
  toggleTools?.addEventListener('click', () => toggleDrawer(builderToolsCol, 'left'));
  toggleProps?.addEventListener('click', () => toggleDrawer(builderPropsCol, 'right'));
  exportBtn?.addEventListener('click', () => handleExport('pdf'));
  exportPngBtn?.addEventListener('click', () => handleExport('png'));
  inputVoucherCode?.addEventListener('input', (e) => {
    updateVoucherData('VoucherCode', e.target.value);
    const helper = document.querySelector('[data-helper-for="VoucherCode"]');
    if (helper) helper.textContent = '';
    e.target.classList.remove('error');
    renderPreview();
  });
  inputInstagram?.addEventListener('input', (e) => {
    updateVoucherData('InstagramLink', e.target.value);
    renderPreview();
  });
  inputFacebook?.addEventListener('input', (e) => {
    updateVoucherData('FacebookLink', e.target.value);
    renderPreview();
  });
  validateBtn?.addEventListener('click', handleValidate);
  validateRedeemBtn?.addEventListener('click', handleRedeem);
  voucherStatusFilter?.addEventListener('change', (e) => {
    state.validateFilter = e.target.value;
    renderVoucherStatusList();
  });
  refreshVoucherList?.addEventListener('click', loadVoucherStatusList);

  tplSelect?.addEventListener('change', loadBuilderLayout);
  btnNewTemplate?.addEventListener('click', createBuilderTemplate);
  btnDuplicateTemplate?.addEventListener('click', duplicateBuilderTemplate);
  btnSaveTemplate?.addEventListener('click', saveBuilderTemplate);
  btnAddText?.addEventListener('click', () => addField('text'));
  btnAddQr?.addEventListener('click', () => addField('qr'));
  btnAddImage?.addEventListener('click', () => addField('image'));
  btnAddSticker?.addEventListener('click', handleAddSticker);
  btnDeleteField?.addEventListener('click', deleteSelectedField);
  btnSetBackground?.addEventListener('click', handleSetBackground);
  btnRefreshBackground?.addEventListener('click', handleRefreshBackground);
  btnSetLogo?.addEventListener('click', handleSetLogo);
  backgroundFitSelect?.addEventListener('change', handleBackgroundFitChange);
  canvas?.addEventListener('click', () => {
    state.builder.selectedField = null;
    highlightBuilderSelection();
    updatePropsPanel();
  });
  fontPresetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!state.builder.selectedField || state.builder.selectedField.type !== 'text') return;
      propFontFamily.value = btn.dataset.font;
      propFont.value = btn.dataset.size || propFont.value;
      propWeight.value = btn.dataset.weight || propWeight.value;
      applyPropChanges();
    });
  });
  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      if (!state.builder.selectedField || state.builder.selectedField.type !== 'text') return;
      propColor.value = swatch.dataset.color;
      applyPropChanges();
    });
  });
  [propKey, propLabel, propType, propX, propY, propW, propH, propFontFamily, propFont, propWeight, propColor, propAlign].forEach((el) => {
    el?.addEventListener('input', applyPropChanges);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      openHelp();
    }
    if (e.key === 'Escape' && helpModal?.classList.contains('open')) {
      closeHelp();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveCurrentVoucher(false);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      handleExport('pdf');
    }
  });

  window.addEventListener('resize', () => {
    if (state.previewReady) {
      renderPreview();
    }
    updateBuilderResponsive();
  });

  updateBuilderResponsive();
}

document.addEventListener('DOMContentLoaded', init);

