
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
const btnImportCsv = document.getElementById('btnImportCsv');
const valueModal = document.getElementById('valueModal');
const valueModalBackdrop = document.getElementById('valueModalBackdrop');
const valueModalInput = document.getElementById('valueModalInput');
const valueModalSave = document.getElementById('valueModalSave');
const valueModalCancel = document.getElementById('valueModalCancel');
const valueModalCancel2 = document.getElementById('valueModalCancel2');
const importCsvModal = document.getElementById('importCsvModal');
const importCsvModalBackdrop = document.getElementById('importCsvModalBackdrop');
const importCsvClose = document.getElementById('importCsvClose');
const importCsvCancel = document.getElementById('importCsvCancel');
const importCsvConfirm = document.getElementById('importCsvConfirm');
const importCsvStatus = document.getElementById('importCsvStatus');
const importCsvBody = document.getElementById('importCsvBody');
const importCsvFilePath = document.getElementById('importCsvFilePath');
const VALUE_FIELD_KEYS = ['Value', 'Стойност', 'стойност'];
const FIXED_EUR_RATE = 1.95583;
const WEBSITE_SLOT_STEP_MIN = 7 * 60;
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
const inputRecipientPhone = document.getElementById('inputRecipientPhone');
const inputInstagram = document.getElementById('inputInstagram');
const inputFacebook = document.getElementById('inputFacebook');
const tabButtons = document.querySelectorAll('[data-view-target]');
const views = document.querySelectorAll('[data-view]');
const navVouchers = document.getElementById('navVouchers');
const navServices = document.getElementById('navServices');
const navResources = document.getElementById('navResources');
const navSchedule = document.getElementById('navSchedule');
const navReservations = document.getElementById('navReservations');
const navBuilder = document.getElementById('navBuilder');
const sectionVouchers = document.getElementById('view-vouchers');
const sectionServices = document.getElementById('view-services');
const sectionResources = document.getElementById('view-resources');
const sectionSchedule = document.getElementById('view-schedule');
const sectionReservations = document.getElementById('view-reservations');
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
const syncIndicator = document.getElementById('syncIndicator');
const btnSyncNow = document.getElementById('btnSyncNow');
// Validate
const validateCodeInput = document.getElementById('validateCodeInput');
const validateBtn = document.getElementById('validateBtn');
const validateResult = document.getElementById('validateResult');
const validateRedeemBtn = document.getElementById('validateRedeemBtn');
const voucherStatusList = document.getElementById('voucherStatusList');
const voucherStatusFilter = document.getElementById('voucherStatusFilter');
const refreshVoucherList = document.getElementById('refreshVoucherList');

// Services
const servicesSearch = document.getElementById('servicesSearch');
const btnServiceAdd = document.getElementById('btnServiceAdd');
const servicesStatus = document.getElementById('servicesStatus');
const servicesTableBody = document.getElementById('servicesTableBody');
const serviceModal = document.getElementById('serviceModal');
const serviceModalBackdrop = document.getElementById('serviceModalBackdrop');
const serviceModalClose = document.getElementById('serviceModalClose');
const serviceModalCancel = document.getElementById('serviceModalCancel');
const serviceModalSave = document.getElementById('serviceModalSave');
const serviceModalTitle = document.getElementById('serviceModalTitle');
const serviceModalStatus = document.getElementById('serviceModalStatus');
const serviceNameInput = document.getElementById('serviceNameInput');
const serviceDurationInput = document.getElementById('serviceDurationInput');
const servicePriceInput = document.getElementById('servicePriceInput');
const serviceCurrencyInput = document.getElementById('serviceCurrencyInput');
const serviceActiveInput = document.getElementById('serviceActiveInput');

// Resources
const resourcesSearch = document.getElementById('resourcesSearch');
const btnResourceAdd = document.getElementById('btnResourceAdd');
const resourcesStatus = document.getElementById('resourcesStatus');
const resourcesTableBody = document.getElementById('resourcesTableBody');
const resourceModal = document.getElementById('resourceModal');
const resourceModalBackdrop = document.getElementById('resourceModalBackdrop');
const resourceModalClose = document.getElementById('resourceModalClose');
const resourceModalCancel = document.getElementById('resourceModalCancel');
const resourceModalSave = document.getElementById('resourceModalSave');
const resourceModalTitle = document.getElementById('resourceModalTitle');
const resourceModalStatus = document.getElementById('resourceModalStatus');
const resourceNameInput = document.getElementById('resourceNameInput');
const resourceTypeInput = document.getElementById('resourceTypeInput');
const resourceActiveInput = document.getElementById('resourceActiveInput');
const resourceServicesList = document.getElementById('resourceServicesList');
const resourceRulesGrid = document.getElementById('resourceRulesGrid');
const exceptionDateInput = document.getElementById('exceptionDateInput');
const exceptionIsOffInput = document.getElementById('exceptionIsOffInput');
const exceptionStartInput = document.getElementById('exceptionStartInput');
const exceptionEndInput = document.getElementById('exceptionEndInput');
const exceptionNoteInput = document.getElementById('exceptionNoteInput');
const exceptionAddBtn = document.getElementById('exceptionAddBtn');
const resourceExceptionsList = document.getElementById('resourceExceptionsList');

// Schedule
const scheduleDateInput = document.getElementById('scheduleDateInput');
const scheduleServiceSelect = document.getElementById('scheduleServiceSelect');
const scheduleResourceSelect = document.getElementById('scheduleResourceSelect');
const scheduleRefreshBtn = document.getElementById('scheduleRefreshBtn');
const scheduleStatus = document.getElementById('scheduleStatus');
const scheduleDayTitle = document.getElementById('scheduleDayTitle');
const scheduleGrid = document.getElementById('scheduleGrid');
const bookingModal = document.getElementById('bookingModal');
const bookingModalBackdrop = document.getElementById('bookingModalBackdrop');
const bookingModalClose = document.getElementById('bookingModalClose');
const bookingModalCancel = document.getElementById('bookingModalCancel');
const bookingModalSave = document.getElementById('bookingModalSave');
const bookingModalCancelBooking = document.getElementById('bookingModalCancelBooking');
const bookingModalTitle = document.getElementById('bookingModalTitle');
const bookingModalStatus = document.getElementById('bookingModalStatus');
const bookingServiceSelect = document.getElementById('bookingServiceSelect');
const bookingResourceSelect = document.getElementById('bookingResourceSelect');
const bookingDateInput = document.getElementById('bookingDateInput');
const bookingStartSelect = document.getElementById('bookingStartSelect');
const bookingCustomerSelect = document.getElementById('bookingCustomerSelect');
const bookingCustomerNameInput = document.getElementById('bookingCustomerNameInput');
const bookingCustomerPhoneInput = document.getElementById('bookingCustomerPhoneInput');
const bookingCustomerEmailInput = document.getElementById('bookingCustomerEmailInput');
const bookingStatusSelect = document.getElementById('bookingStatusSelect');
const bookingNoteInput = document.getElementById('bookingNoteInput');
const bookingVoucherCodeInput = document.getElementById('bookingVoucherCodeInput');
const bookingVoucherValidateBtn = document.getElementById('bookingVoucherValidateBtn');
const bookingVoucherStatus = document.getElementById('bookingVoucherStatus');

// Reservations
const reservationsSearch = document.getElementById('reservationsSearch');
const reservationsSourceFilter = document.getElementById('reservationsSourceFilter');
const reservationsStatusFilter = document.getElementById('reservationsStatusFilter');
const reservationsRefreshBtn = document.getElementById('reservationsRefreshBtn');
const reservationsSyncBtn = document.getElementById('reservationsSyncBtn');
const reservationsStatus = document.getElementById('reservationsStatus');
const reservationsCount = document.getElementById('reservationsCount');
const reservationsHint = document.getElementById('reservationsHint');
const reservationsTableBody = document.getElementById('reservationsTableBody');

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

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SCHEDULE_START_MIN = 6 * 60;
const SCHEDULE_END_MIN = 22 * 60;
const SCHEDULE_STEP_MIN = 15;
const SCHEDULE_ROW_HEIGHT = 20;

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
  syncPendingCount: 0,
  syncErrorCount: 0,
  syncTimerId: null,
  syncRunning: false,
  valueOptions: [],
  services: [],
  resources: [],
  servicesSearch: '',
  resourcesSearch: '',
  editingServiceId: null,
  editingResourceId: null,
  resourceServiceOptions: [],
  resourceServiceIds: [],
  resourceRulesDraft: [],
  resourceExceptionsDraft: [],
  resourceExceptionDeletedIds: [],
  scheduleDate: '',
  scheduleServiceId: '',
  scheduleResourceId: '',
  scheduleServices: [],
  scheduleResources: [],
  scheduleCustomers: [],
  scheduleBookings: [],
  reservations: [],
  reservationsSearch: '',
  reservationsSource: 'public',
  reservationsStatus: 'active',
  reservationSlotChecks: {},
  reservationEmailConfirmations: {},
  reservationEmailSendingId: '',
  reservationApologyEmails: {},
  reservationApologySendingId: '',
  editingBookingId: null,
  bookingSlotHintIso: '',
  editingBookingSnapshot: null,
  editingBookingOriginalVoucherCode: '',
  editingBookingSource: '',
  bookingVoucherId: '',
  bookingVoucherCode: '',
  bookingVoucherState: '',
  csvImportPreview: null,
  csvImportBusy: false
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
    state.testMode = false;
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

function updateVoucherActionButtonsState() {
  const hasVoucher = Boolean(state.currentVoucher?.id);
  const canExport = hasVoucher && Boolean(state.currentTemplateId);
  if (btnSaveVoucher) btnSaveVoucher.disabled = !hasVoucher;
  if (btnSaveCopy) btnSaveCopy.disabled = !hasVoucher;
  if (exportBtn) exportBtn.disabled = !canExport;
  if (exportPngBtn) exportPngBtn.disabled = !canExport;
}

function setImportCsvStatus(message, isError = false) {
  if (!importCsvStatus) return;
  importCsvStatus.textContent = message || '';
  importCsvStatus.classList.toggle('error', isError);
}

function setImportCsvBusy(isBusy) {
  state.csvImportBusy = Boolean(isBusy);
  if (btnImportCsv) btnImportCsv.disabled = state.csvImportBusy;
  if (importCsvConfirm) importCsvConfirm.disabled = state.csvImportBusy || !state.csvImportPreview?.token;
  if (importCsvCancel) importCsvCancel.disabled = state.csvImportBusy;
  if (importCsvClose) importCsvClose.disabled = state.csvImportBusy;
}

function closeImportCsvModal() {
  if (!importCsvModal || state.csvImportBusy) return;
  importCsvModal.classList.remove('open');
  importCsvModal.setAttribute('aria-hidden', 'true');
}

function openImportCsvModal() {
  if (!importCsvModal) return;
  importCsvModal.classList.add('open');
  importCsvModal.setAttribute('aria-hidden', 'false');
}

function renderImportCsvPreview() {
  const preview = state.csvImportPreview;
  if (!importCsvBody) return;
  if (!preview) {
    if (importCsvFilePath) importCsvFilePath.textContent = '';
    importCsvBody.innerHTML = '<p>No import preview available.</p>';
    setImportCsvStatus('');
    setImportCsvBusy(false);
    return;
  }

  if (importCsvFilePath) importCsvFilePath.textContent = preview.filePath || '';
  const rows = Array.isArray(preview.rows) ? preview.rows : [];
  const invalidRows = Array.isArray(preview.invalidSamples)
    ? preview.invalidSamples
    : rows.filter((row) => row.status === 'invalid');
  const rowHtml = rows
    .map((row) => {
      const warnings = Array.isArray(row.warnings) ? row.warnings : [];
      const errors = Array.isArray(row.errors) ? row.errors : [];
      return `
        <tr>
          <td>${escapeHtml(String(row.rowNumber || ''))}</td>
          <td>${escapeHtml(row.id || '')}</td>
          <td class="mono">${escapeHtml(row.code || '')}</td>
          <td>${escapeHtml(row.recipientName || '')}</td>
          <td>${escapeHtml(row.templateId || '')}</td>
          <td>${escapeHtml(row.status || '')}</td>
          <td>${escapeHtml(errors.join('; ') || warnings.join('; ') || '')}</td>
        </tr>
      `;
    })
    .join('');

  const invalidDetails = invalidRows.length
    ? `
      <h4>Invalid Rows</h4>
      <ul>
        ${invalidRows
          .map(
            (row) =>
              `<li>Row ${escapeHtml(String(row.rowNumber || ''))}: ${escapeHtml(
                (Array.isArray(row.errors) ? row.errors.join('; ') : '') || 'Invalid data'
              )}</li>`
          )
          .join('')}
      </ul>
    `
    : '';

  importCsvBody.innerHTML = `
    <div class="saved-meta" style="margin-bottom:8px;">
      Total: ${Number(preview.totalRows || 0)} | Valid: ${Number(preview.validRows || 0)} | Invalid: ${Number(
    preview.invalidRows || 0
  )} | Empty: ${Number(preview.emptyRows || 0)} | Warnings: ${Number(preview.warningsCount || 0)}
    </div>
    <div class="table-wrap">
      <table class="saved-table">
        <thead>
          <tr>
            <th>Row</th>
            <th>ID</th>
            <th>Code</th>
            <th>Recipient</th>
            <th>Template</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rowHtml || '<tr><td colspan="7">No preview rows</td></tr>'}</tbody>
      </table>
    </div>
    ${invalidDetails}
  `;

  setImportCsvStatus('Review preview and click Import to continue.');
  setImportCsvBusy(false);
  if (importCsvConfirm) {
    const canImport = Boolean(preview.token) && Number(preview.validRows || 0) > 0;
    importCsvConfirm.disabled = !canImport;
  }
}

async function handleImportCsv() {
  if (state.csvImportBusy) return;
  setImportCsvBusy(true);
  setStatus('Preparing CSV import preview...');
  try {
    const res = await window.api.vouchers.importCsv();
    if (res?.canceled) {
      setStatus('CSV import canceled');
      setImportCsvBusy(false);
      return;
    }
    if (!res?.ok || !res.preview) {
      setStatus(res?.error || 'Failed to prepare CSV import', true);
      setImportCsvBusy(false);
      return;
    }
    state.csvImportPreview = res.preview;
    renderImportCsvPreview();
    openImportCsvModal();
  } catch (err) {
    setStatus(err?.message || 'Failed to prepare CSV import', true);
    setImportCsvBusy(false);
  }
}

async function confirmImportCsv() {
  const token = String(state.csvImportPreview?.token || '').trim();
  if (!token || state.csvImportBusy) return;
  setImportCsvBusy(true);
  setImportCsvStatus('Importing...');
  try {
    const res = await window.api.vouchers.confirmImportCsv({ token });
    if (!res?.ok) {
      setImportCsvStatus(res?.error || 'Import failed', true);
      setStatus(res?.error || 'Import failed', true);
      setImportCsvBusy(false);
      return;
    }
    const summary = res.summary || {};
    const importedCount = Number(summary.importedCount || 0);
    const skippedCount = Number(summary.skippedCount || 0);
    const warningsCount = Number(summary.warningsCount || 0);
    const errorCount = Number(summary.errorCount || 0);
    const message = `CSV import complete: ${importedCount} imported, ${skippedCount} skipped, ${warningsCount} warnings, ${errorCount} errors`;
    setStatus(message, errorCount > 0);

    state.csvImportPreview = null;
    await loadSavedList();
    renderSavedList();
    await loadVoucherStatusList();
    await refreshSyncIndicator();
    setImportCsvBusy(false);
    closeImportCsvModal();
  } catch (err) {
    setImportCsvStatus(err?.message || 'Import failed', true);
    setStatus(err?.message || 'Import failed', true);
    setImportCsvBusy(false);
  }
}

function setBuilderStatus(message, isError = false) {
  if (builderStatus) {
    builderStatus.textContent = message || '';
    builderStatus.classList.toggle('error', isError);
  }
  if (message) showBanner(message, isError ? 'error' : 'success');
}

function setInlineStatus(element, message, isError = false, showToast = true) {
  if (element) {
    element.textContent = message || '';
    element.classList.toggle('error', isError);
  }
  if (message && showToast) {
    showBanner(message, isError ? 'error' : 'success');
  }
}

function setServicesStatus(message, isError = false) {
  setInlineStatus(servicesStatus, message, isError, true);
}

function setResourcesStatus(message, isError = false) {
  setInlineStatus(resourcesStatus, message, isError, true);
}

function setServiceModalStatus(message, isError = false) {
  setInlineStatus(serviceModalStatus, message, isError, false);
}

function setResourceModalStatus(message, isError = false) {
  setInlineStatus(resourceModalStatus, message, isError, false);
}

function setScheduleStatus(message, isError = false) {
  setInlineStatus(scheduleStatus, message, isError, false);
}

function setReservationsStatus(message, isError = false) {
  setInlineStatus(reservationsStatus, message, isError, false);
}

function setBookingModalStatus(message, isError = false) {
  setInlineStatus(bookingModalStatus, message, isError, false);
}

function setBookingVoucherStatus(message, isError = false) {
  setInlineStatus(bookingVoucherStatus, message, isError, false);
}

function renderSyncIndicator({ pendingCount = 0, errorCount = 0, unavailable = false } = {}) {
  if (!syncIndicator) return;
  const pending = Math.max(0, Number(pendingCount) || 0);
  const errors = Math.max(0, Number(errorCount) || 0);
  state.syncPendingCount = pending;
  state.syncErrorCount = errors;

  syncIndicator.classList.remove('pending', 'error');
  if (unavailable) {
    syncIndicator.textContent = 'Sync: unavailable';
    syncIndicator.classList.add('error');
    return;
  }

  if (errors > 0) {
    syncIndicator.classList.add('error');
  } else if (pending > 0) {
    syncIndicator.classList.add('pending');
  }

  if (pending > 0) {
    syncIndicator.textContent = `Sync: ${pending} pending`;
    return;
  }
  if (errors > 0) {
    syncIndicator.textContent = `Sync: ${errors} errors`;
    return;
  }
  syncIndicator.textContent = 'Sync: up to date';
}

async function refreshSyncIndicator() {
  if (!window.api?.sync?.getStatus) return;
  if (state.syncRunning) return;
  try {
    const res = await window.api.sync.getStatus();
    if (!res?.ok) {
      renderSyncIndicator({ unavailable: true });
      return;
    }
    renderSyncIndicator(res.data || {});
  } catch (err) {
    console.error(err);
    renderSyncIndicator({ unavailable: true });
  }
}

function setSyncRunning(isRunning) {
  state.syncRunning = isRunning;
  if (btnSyncNow) {
    btnSyncNow.disabled = isRunning;
  }
  if (!syncIndicator) return;
  if (isRunning) {
    syncIndicator.classList.remove('error');
    syncIndicator.classList.add('pending');
    syncIndicator.textContent = 'Sync: running...';
  }
}

function formatSyncConflict(conflict) {
  if (!conflict || typeof conflict !== 'object') return 'Booking conflict';
  const resourceId = conflict.resourceId || conflict?.conflictingBooking?.resourceId;
  const startAt = conflict.startAt || '';
  const endAt = conflict.endAt || '';
  const parts = ['Booking conflict'];
  if (resourceId) {
    parts.push(`Resource ${resourceId}`);
  }
  if (startAt && endAt) {
    const startText = new Date(startAt).toLocaleString();
    const endText = new Date(endAt).toLocaleTimeString();
    parts.push(`${startText} - ${endText}`);
  } else if (startAt) {
    parts.push(new Date(startAt).toLocaleString());
  }
  return parts.join(' · ');
}

async function refreshDataAfterSync() {
  await loadServices();
  await loadResources();
  await loadSavedList();
  await loadVoucherStatusList();
  if (sectionSchedule?.style.display !== 'none') {
    await initScheduleSection();
  }
  if (sectionReservations?.style.display !== 'none') {
    await loadReservations();
  }
}

async function runSyncNow() {
  if (!window.api?.sync?.run) return;
  if (state.syncRunning) return;
  setSyncRunning(true);
  try {
    const res = await window.api.sync.run();
    if (!res?.ok) {
      showBanner(res?.error || 'Sync failed', 'error');
      return;
    }
    const data = res.data || {};
    const conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];
    const pushedCount = Number(data?.pushed?.acked || 0);
    const pulledCount = Number(data?.pulled?.count || 0);

    if (conflicts.length) {
      showBanner(`${conflicts.length} booking conflict(s) detected`, 'error');
      showBanner(formatSyncConflict(conflicts[0]), 'error');
    } else if (pushedCount || pulledCount) {
      showBanner(`Sync complete: ${pushedCount} pushed, ${pulledCount} pulled`, 'success');
    } else {
      showBanner('Sync complete', 'success');
    }
    await refreshDataAfterSync();
  } catch (err) {
    showBanner(err?.message || 'Sync failed', 'error');
  } finally {
    setSyncRunning(false);
    await refreshSyncIndicator();
  }
}

function resetBookingVoucherLink() {
  state.bookingVoucherId = '';
  state.bookingVoucherCode = '';
  state.bookingVoucherState = '';
  setBookingVoucherStatus('');
}

async function validateVoucherForBookingModal() {
  const rawCode = (bookingVoucherCodeInput?.value || '').trim();
  if (!rawCode) {
    resetBookingVoucherLink();
    return { ok: true, valid: false, empty: true };
  }

  try {
    const res = await window.api.vouchers.validateCode(rawCode);
    if (!res?.ok) {
      resetBookingVoucherLink();
      setBookingVoucherStatus(res?.error || 'Failed to validate voucher', true);
      return { ok: false, valid: false };
    }

    const data = res.data || {};
    state.bookingVoucherState = String(data.status || '').trim().toLowerCase();
    state.bookingVoucherCode = String(data.code || rawCode).trim();
    state.bookingVoucherId = data.voucherId ? String(data.voucherId).trim() : '';

    if (data.valid) {
      const valueText = data.value ? ` (${data.value})` : '';
      setBookingVoucherStatus(`Voucher ${state.bookingVoucherCode} is valid${valueText}`);
      return { ok: true, valid: true };
    }

    if (state.bookingVoucherState === 'redeemed') {
      setBookingVoucherStatus('Voucher has already been redeemed', true);
    } else if (state.bookingVoucherState === 'expired') {
      setBookingVoucherStatus('Voucher is expired', true);
    } else {
      setBookingVoucherStatus('Voucher not found', true);
    }
    return { ok: true, valid: false };
  } catch (err) {
    console.error(err);
    resetBookingVoucherLink();
    setBookingVoucherStatus(err.message || 'Failed to validate voucher', true);
    return { ok: false, valid: false };
  }
}

function formatCentsForInput(cents) {
  const parsed = Number.parseInt(cents, 10);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  return (safe / 100).toFixed(2);
}

function parseMoneyInputToCents(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function normalizeCurrencyCode(value, fallback = 'BGN') {
  const normalized = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

function formatMoneyFromCents(cents, currency = 'BGN') {
  const parsed = Number.parseInt(cents, 10);
  const safe = Number.isFinite(parsed) ? parsed : 0;
  const code = normalizeCurrencyCode(currency, 'BGN');
  if (safe <= 0 && code === 'BGN') return 'по запитване';
  const primary = `${(safe / 100).toFixed(2)} ${code}`;
  if (code !== 'BGN' || safe <= 0) return primary;
  return `${primary} / ${(safe / 100 / FIXED_EUR_RATE).toFixed(2)} EUR`;
}

function schedulePad2(value) {
  return String(value).padStart(2, '0');
}

function todayDateText() {
  const now = new Date();
  return `${now.getFullYear()}-${schedulePad2(now.getMonth() + 1)}-${schedulePad2(now.getDate())}`;
}

function dateFromDateText(dateText) {
  const normalized = normalizeDateValue(dateText);
  if (!normalized) return null;
  const parts = normalized.split('-').map((part) => Number.parseInt(part, 10));
  const date = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  if (Number.isNaN(date.valueOf())) return null;
  return date;
}

function addDaysDateText(dateText, days = 0) {
  const date = dateFromDateText(dateText);
  if (!date) return '';
  date.setDate(date.getDate() + Number(days || 0));
  return `${date.getFullYear()}-${schedulePad2(date.getMonth() + 1)}-${schedulePad2(date.getDate())}`;
}

function minutesToTimeText(minutes) {
  const safe = Math.max(0, Number.parseInt(minutes, 10) || 0);
  const hh = Math.floor(safe / 60);
  const mm = safe % 60;
  return `${schedulePad2(hh)}:${schedulePad2(mm)}`;
}

function timeTextToMinutes(value) {
  const normalized = normalizeTimeInputValue(value);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map((part) => Number.parseInt(part, 10));
  return h * 60 + m;
}

function localDateTimeToIso(dateText, timeText) {
  const base = dateFromDateText(dateText);
  const minutes = timeTextToMinutes(timeText);
  if (!base || minutes === null) return '';
  const date = new Date(base.getTime());
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toISOString();
}

function dateTextRangeToIso(dateText) {
  const start = dateFromDateText(dateText);
  if (!start) return { from: '', to: '' };
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function isoToLocalDateText(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return '';
  return `${parsed.getFullYear()}-${schedulePad2(parsed.getMonth() + 1)}-${schedulePad2(parsed.getDate())}`;
}

function isoToLocalTimeText(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return '';
  return `${schedulePad2(parsed.getHours())}:${schedulePad2(parsed.getMinutes())}`;
}

function isoToMinutesInLocalDay(value, dateText) {
  const parsed = new Date(value);
  const base = dateFromDateText(dateText);
  if (Number.isNaN(parsed.valueOf()) || !base) return null;
  return Math.round((parsed.getTime() - base.getTime()) / 60000);
}

function formatScheduleDateLabel(dateText) {
  const date = dateFromDateText(dateText);
  if (!date) return dateText || '';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function serviceById(serviceId) {
  return state.scheduleServices.find((item) => item.id === serviceId) || state.services.find((item) => item.id === serviceId) || null;
}

function resourceById(resourceId) {
  return state.scheduleResources.find((item) => item.id === resourceId) || state.resources.find((item) => item.id === resourceId) || null;
}

function customerById(customerId) {
  return state.scheduleCustomers.find((item) => item.id === customerId) || null;
}

function serviceNameById(serviceId) {
  return serviceById(serviceId)?.name || serviceId || '';
}

function resourceNameById(resourceId) {
  return resourceById(resourceId)?.name || resourceId || '';
}

function customerNameById(customerId) {
  return customerById(customerId)?.name || customerId || '';
}

function renderScheduleFilters() {
  if (scheduleDateInput) {
    scheduleDateInput.value = state.scheduleDate || todayDateText();
  }

  if (scheduleServiceSelect) {
    const previous = state.scheduleServiceId || '';
    scheduleServiceSelect.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'All services';
    scheduleServiceSelect.appendChild(allOption);
    state.scheduleServices.forEach((service) => {
      const option = document.createElement('option');
      option.value = service.id;
      option.textContent = service.name;
      scheduleServiceSelect.appendChild(option);
    });
    scheduleServiceSelect.value = previous;
  }

  if (scheduleResourceSelect) {
    const previous = state.scheduleResourceId || '';
    scheduleResourceSelect.innerHTML = '';
    state.scheduleResources.forEach((resource) => {
      const option = document.createElement('option');
      option.value = resource.id;
      option.textContent = resource.name;
      scheduleResourceSelect.appendChild(option);
    });
    if (previous && state.scheduleResources.some((item) => item.id === previous)) {
      scheduleResourceSelect.value = previous;
    } else if (state.scheduleResources.length > 0) {
      scheduleResourceSelect.value = state.scheduleResources[0].id;
      state.scheduleResourceId = state.scheduleResources[0].id;
    } else {
      state.scheduleResourceId = '';
    }
  }
}

function renderBookingServiceSelect(selectedId = '') {
  if (!bookingServiceSelect) return;
  bookingServiceSelect.innerHTML = '';
  state.scheduleServices.forEach((service) => {
    const option = document.createElement('option');
    option.value = service.id;
    option.textContent = `${service.name} (${service.durationMin || 30} min)`;
    bookingServiceSelect.appendChild(option);
  });
  if (selectedId && !state.scheduleServices.some((item) => item.id === selectedId)) {
    const fallback = document.createElement('option');
    fallback.value = selectedId;
    fallback.textContent = selectedId;
    bookingServiceSelect.appendChild(fallback);
  }
  if (selectedId && state.scheduleServices.some((item) => item.id === selectedId)) {
    bookingServiceSelect.value = selectedId;
  } else if (selectedId) {
    bookingServiceSelect.value = selectedId;
  } else if (state.scheduleServiceId && state.scheduleServices.some((item) => item.id === state.scheduleServiceId)) {
    bookingServiceSelect.value = state.scheduleServiceId;
  } else if (state.scheduleServices.length > 0) {
    bookingServiceSelect.value = state.scheduleServices[0].id;
  }
}

function renderBookingResourceSelect(selectedId = '') {
  if (!bookingResourceSelect) return;
  bookingResourceSelect.innerHTML = '';
  state.scheduleResources.forEach((resource) => {
    const option = document.createElement('option');
    option.value = resource.id;
    option.textContent = resource.name;
    bookingResourceSelect.appendChild(option);
  });
  if (selectedId && !state.scheduleResources.some((item) => item.id === selectedId)) {
    const fallback = document.createElement('option');
    fallback.value = selectedId;
    fallback.textContent = selectedId;
    bookingResourceSelect.appendChild(fallback);
  }
  if (selectedId && state.scheduleResources.some((item) => item.id === selectedId)) {
    bookingResourceSelect.value = selectedId;
  } else if (selectedId) {
    bookingResourceSelect.value = selectedId;
  } else if (state.scheduleResourceId && state.scheduleResources.some((item) => item.id === state.scheduleResourceId)) {
    bookingResourceSelect.value = state.scheduleResourceId;
  } else if (state.scheduleResources.length > 0) {
    bookingResourceSelect.value = state.scheduleResources[0].id;
  }
}

function renderBookingCustomerSelect(selectedId = '') {
  if (!bookingCustomerSelect) return;
  bookingCustomerSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select customer';
  bookingCustomerSelect.appendChild(placeholder);
  state.scheduleCustomers.forEach((customer) => {
    const option = document.createElement('option');
    option.value = customer.id;
    option.textContent = customer.name;
    bookingCustomerSelect.appendChild(option);
  });
  if (selectedId && !state.scheduleCustomers.some((item) => item.id === selectedId)) {
    const fallback = document.createElement('option');
    fallback.value = selectedId;
    fallback.textContent = selectedId;
    bookingCustomerSelect.appendChild(fallback);
  }
  if (selectedId && state.scheduleCustomers.some((item) => item.id === selectedId)) {
    bookingCustomerSelect.value = selectedId;
  } else if (selectedId) {
    bookingCustomerSelect.value = selectedId;
  } else {
    bookingCustomerSelect.value = '';
  }
}

async function loadScheduleLookups() {
  if (!state.scheduleDate) state.scheduleDate = todayDateText();

  try {
    const [servicesRes, resourcesRes, customersRes] = await Promise.all([
      window.api.services.list(500, ''),
      window.api.resources.list(500, ''),
      window.api.customers.list(500, '')
    ]);

    if (!servicesRes?.ok) throw new Error(servicesRes?.error || 'Failed to load services');
    if (!resourcesRes?.ok) throw new Error(resourcesRes?.error || 'Failed to load resources');
    if (!customersRes?.ok) throw new Error(customersRes?.error || 'Failed to load customers');

    state.scheduleServices = Array.isArray(servicesRes.data) ? servicesRes.data : [];
    state.scheduleResources = Array.isArray(resourcesRes.data) ? resourcesRes.data : [];
    state.scheduleCustomers = Array.isArray(customersRes.data) ? customersRes.data : [];

    if (state.scheduleServiceId && !state.scheduleServices.some((item) => item.id === state.scheduleServiceId)) {
      state.scheduleServiceId = '';
    }
    if (state.scheduleResourceId && !state.scheduleResources.some((item) => item.id === state.scheduleResourceId)) {
      state.scheduleResourceId = '';
    }

    renderScheduleFilters();
    setScheduleStatus('');
    return true;
  } catch (err) {
    console.error(err);
    setScheduleStatus(err.message || 'Failed to load schedule lookups', true);
    return false;
  }
}

function normalizeReservationStatus(value) {
  const status = String(value || 'confirmed').trim().toLowerCase();
  if (status === 'canceled') return 'cancelled';
  return status || 'confirmed';
}

function normalizeReservationSource(value) {
  const source = String(value || 'sync').trim().toLowerCase();
  if (source === 'website' || source === 'web' || source === 'public') return 'public';
  return source || 'sync';
}

function sourceLabel(source) {
  const normalized = normalizeReservationSource(source);
  if (normalized === 'public') return 'Website';
  if (normalized === 'desktop') return 'Desktop';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function cssToken(value, fallback = 'item') {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-') || fallback;
}

function formatReservationDateTime(booking) {
  const start = new Date(booking?.startAt || '');
  const end = new Date(booking?.endAt || '');
  if (Number.isNaN(start.valueOf())) return '';
  const dateText = start.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const startText = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const endText = Number.isNaN(end.valueOf())
    ? ''
    : end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return endText ? `${dateText} · ${startText} - ${endText}` : `${dateText} · ${startText}`;
}

function reservationSearchText(booking) {
  const customer = customerById(booking.customerId) || {};
  const parts = [
    booking.id,
    booking.status,
    booking.source,
    booking.voucherCode,
    booking.note,
    serviceNameById(booking.serviceId),
    resourceNameById(booking.resourceId),
    customer.name,
    customer.phone,
    customer.email
  ];
  return parts.join(' ').toLowerCase();
}

function slotCheckForBooking(booking) {
  const id = String(booking?.id || '');
  return state.reservationSlotChecks[id] || {
    bookingId: id,
    state: 'checking',
    isFree: false,
    reason: 'Checking slot availability...',
    conflicts: []
  };
}

function slotCheckLabel(check) {
  const stateName = String(check?.state || 'checking').toLowerCase();
  if (stateName === 'free') return 'Free';
  if (stateName === 'conflict') return 'Conflict';
  if (stateName === 'unavailable') return 'Closed';
  if (stateName === 'invalid') return 'Needs data';
  if (stateName === 'missing') return 'Missing';
  return 'Checking';
}

function slotCheckClass(check) {
  return cssToken(check?.state || 'checking', 'checking');
}

function reservationEmailConfirmationForBooking(booking) {
  return state.reservationEmailConfirmations[String(booking?.id || '')] || null;
}

function reservationApologyEmailForBooking(booking) {
  return state.reservationApologyEmails[String(booking?.id || '')] || null;
}

function formatShortDateTime(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatAlternativeSlot(slot) {
  const start = new Date(slot?.startAt || '');
  const end = new Date(slot?.endAt || '');
  if (Number.isNaN(start.valueOf())) return '';
  const dateText = start.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const startText = start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const endText = Number.isNaN(end.valueOf())
    ? ''
    : end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const resourceText = slot?.resourceName ? `, ${slot.resourceName}` : '';
  return `${dateText} ${startText}${endText ? ` - ${endText}` : ''}${resourceText}`;
}

async function loadReservationSlotChecks(ids = []) {
  if (!window.api?.bookings?.checkSlots) return;
  const wanted = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!wanted.length) {
    state.reservationSlotChecks = {};
    renderReservations();
    return;
  }
  try {
    const res = await window.api.bookings.checkSlots(wanted);
    if (!res?.ok) {
      setReservationsStatus(res?.error || 'Failed to check reservation slots', true);
      return;
    }
    const next = { ...state.reservationSlotChecks };
    (Array.isArray(res.data) ? res.data : []).forEach((item) => {
      if (item?.bookingId) next[item.bookingId] = item;
    });
    state.reservationSlotChecks = next;
    renderReservations();
  } catch (err) {
    console.error(err);
    setReservationsStatus(err.message || 'Failed to check reservation slots', true);
  }
}

async function loadReservationEmailConfirmations(ids = []) {
  if (!window.api?.reservations?.listEmailConfirmations) return;
  const wanted = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!wanted.length) {
    state.reservationEmailConfirmations = {};
    renderReservations();
    return;
  }
  try {
    const res = await window.api.reservations.listEmailConfirmations(wanted);
    if (!res?.ok) {
      setReservationsStatus(res?.error || 'Failed to load email confirmations', true);
      return;
    }
    const next = { ...state.reservationEmailConfirmations };
    (Array.isArray(res.data) ? res.data : []).forEach((item) => {
      if (item?.bookingId) next[item.bookingId] = item;
    });
    state.reservationEmailConfirmations = next;
    renderReservations();
  } catch (err) {
    console.error(err);
    setReservationsStatus(err.message || 'Failed to load email confirmations', true);
  }
}

async function loadReservationApologyEmails(ids = []) {
  if (!window.api?.reservations?.listApologyEmails) return;
  const wanted = (Array.isArray(ids) ? ids : []).filter(Boolean);
  if (!wanted.length) {
    state.reservationApologyEmails = {};
    renderReservations();
    return;
  }
  try {
    const res = await window.api.reservations.listApologyEmails(wanted);
    if (!res?.ok) {
      setReservationsStatus(res?.error || 'Failed to load apology emails', true);
      return;
    }
    const next = { ...state.reservationApologyEmails };
    (Array.isArray(res.data) ? res.data : []).forEach((item) => {
      if (item?.bookingId) next[item.bookingId] = item;
    });
    state.reservationApologyEmails = next;
    renderReservations();
  } catch (err) {
    console.error(err);
    setReservationsStatus(err.message || 'Failed to load apology emails', true);
  }
}

async function confirmReservationEmail(booking) {
  const id = String(booking?.id || '');
  if (!id || !window.api?.reservations?.confirmEmail) return;
  const customer = customerById(booking.customerId) || {};
  const slot = slotCheckForBooking(booking);
  const existingConfirmation = reservationEmailConfirmationForBooking(booking);
  if (existingConfirmation?.sentAt) {
    showBanner('Confirmation email was already sent for this reservation.', 'success');
    return;
  }
  if (!customer.email) {
    showBanner('Customer email is missing. Add an email before sending confirmation.', 'error');
    return;
  }
  if (!slot.isFree) {
    showBanner(slot.reason || 'Slot is not free. Resolve the conflict before sending confirmation.', 'error');
    return;
  }

  const confirmed = window.confirm(`Confirm this reservation and send email to ${customer.email}?`);
  if (!confirmed) return;

  state.reservationEmailSendingId = id;
  renderReservations();
  setReservationsStatus('Sending confirmation email...');
  try {
    const res = await window.api.reservations.confirmEmail(id);
    if (!res?.ok) {
      showBanner(res?.error || 'Confirmation email was not sent', 'error');
      return;
    }
    showBanner(`Confirmation email sent to ${customer.email}`, 'success');
    await loadReservationEmailConfirmations([id]);
    await loadReservationSlotChecks([id]);
    setReservationsStatus('');
  } catch (err) {
    console.error(err);
    showBanner(err.message || 'Confirmation email was not sent', 'error');
  } finally {
    state.reservationEmailSendingId = '';
    renderReservations();
  }
}

async function sendReservationApologyEmail(booking) {
  const id = String(booking?.id || '');
  if (!id || !window.api?.reservations?.prepareApologyEmail || !window.api?.reservations?.sendApologyEmail) return;
  const customer = customerById(booking.customerId) || {};
  const slot = slotCheckForBooking(booking);
  const existingApology = reservationApologyEmailForBooking(booking);
  if (existingApology?.sentAt) {
    showBanner('Apology email was already sent for this reservation.', 'success');
    return;
  }
  if (!customer.email) {
    showBanner('Customer email is missing. Add an email before sending apology.', 'error');
    return;
  }
  if (slot.isFree) {
    showBanner('Slot is free. Use Confirm & Email instead.', 'error');
    return;
  }

  setReservationsStatus('Preparing alternative dates...');
  let alternatives = [];
  try {
    const prepared = await window.api.reservations.prepareApologyEmail(id);
    if (!prepared?.ok) {
      showBanner(prepared?.error || 'Could not prepare alternative dates', 'error');
      setReservationsStatus('');
      return;
    }
    alternatives = Array.isArray(prepared.data?.alternatives) ? prepared.data.alternatives : [];
  } catch (err) {
    console.error(err);
    showBanner(err.message || 'Could not prepare alternative dates', 'error');
    setReservationsStatus('');
    return;
  }

  if (!alternatives.length) {
    showBanner('No alternative free slots found for this reservation.', 'error');
    setReservationsStatus('');
    return;
  }

  const optionsText = alternatives
    .map((alternative, index) => `${index + 1}. ${formatAlternativeSlot(alternative)}`)
    .join('\n');
  const confirmed = window.confirm(
    `Send apology email to ${customer.email} with these alternative dates?\n\n${optionsText}`
  );
  if (!confirmed) {
    setReservationsStatus('');
    return;
  }

  state.reservationApologySendingId = id;
  renderReservations();
  setReservationsStatus('Sending apology email...');
  try {
    const res = await window.api.reservations.sendApologyEmail(id, alternatives);
    if (!res?.ok) {
      showBanner(res?.error || 'Apology email was not sent', 'error');
      return;
    }
    showBanner(`Apology email sent to ${customer.email}`, 'success');
    await loadReservationApologyEmails([id]);
    await loadReservationSlotChecks([id]);
    setReservationsStatus('');
  } catch (err) {
    console.error(err);
    showBanner(err.message || 'Apology email was not sent', 'error');
  } finally {
    state.reservationApologySendingId = '';
    renderReservations();
  }
}

function filteredReservations() {
  const sourceFilter = state.reservationsSource || 'public';
  const statusFilter = state.reservationsStatus || 'active';
  const needle = String(state.reservationsSearch || '').trim().toLowerCase();
  return (Array.isArray(state.reservations) ? state.reservations : [])
    .filter((booking) => {
      const source = normalizeReservationSource(booking.source);
      if (sourceFilter !== 'all' && source !== sourceFilter) return false;

      const status = normalizeReservationStatus(booking.status);
      if (statusFilter === 'active') {
        if (status === 'cancelled') return false;
      } else if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (needle && !reservationSearchText(booking).includes(needle)) return false;
      return true;
    })
    .sort((a, b) => String(b.startAt || '').localeCompare(String(a.startAt || '')));
}

function renderReservations() {
  if (!reservationsTableBody) return;
  const rows = filteredReservations();
  const total = Array.isArray(state.reservations) ? state.reservations.length : 0;
  const websiteTotal = state.reservations.filter((booking) => normalizeReservationSource(booking.source) === 'public').length;
  reservationsTableBody.innerHTML = '';

  if (reservationsCount) {
    reservationsCount.textContent = `${rows.length} of ${total} reservations`;
  }
  if (reservationsHint) {
    reservationsHint.textContent =
      state.reservationsSource === 'public'
        ? `${websiteTotal} website reservation(s) available locally after sync.`
        : 'Showing reservations from the local synced database.';
  }

  if (!rows.length) {
    const emptyRow = document.createElement('tr');
    const emptyText =
      state.reservationsSource === 'public'
        ? 'No website reservations found. Run Sync Now after the website receives bookings.'
        : 'No reservations match the current filters.';
    emptyRow.innerHTML = `<td colspan="10" class="empty-state">${escapeHtml(emptyText)}</td>`;
    reservationsTableBody.appendChild(emptyRow);
    return;
  }

  rows.forEach((booking) => {
    const row = document.createElement('tr');
    const customer = customerById(booking.customerId) || {};
    const customerMeta = [customer.phone, customer.email].filter(Boolean).join(' · ');
    const status = normalizeReservationStatus(booking.status);
    const source = normalizeReservationSource(booking.source);
    const statusClass = cssToken(status, 'confirmed');
    const sourceClass = cssToken(source, 'sync');
    const slot = slotCheckForBooking(booking);
    const slotClass = slotCheckClass(slot);
    const confirmation = reservationEmailConfirmationForBooking(booking);
    const apology = reservationApologyEmailForBooking(booking);
    const emailSent = Boolean(confirmation?.sentAt);
    const apologySent = Boolean(apology?.sentAt);
    const isSendingEmail = state.reservationEmailSendingId === booking.id;
    const isSendingApology = state.reservationApologySendingId === booking.id;
    const canSendEmail =
      slot.isFree && customer.email && !emailSent && status !== 'cancelled' && !isSendingEmail && !isSendingApology;
    const emailButtonLabel = emailSent ? 'Email Sent' : isSendingEmail ? 'Sending...' : 'Confirm & Email';
    const canShowApology = !slot.isFree && slot.state !== 'checking';
    const canSendApology =
      canShowApology && customer.email && !apologySent && status !== 'cancelled' && !isSendingEmail && !isSendingApology;
    const apologyButtonLabel = apologySent ? 'Apology Sent' : isSendingApology ? 'Sending...' : 'Apology & Options';
    const emailMeta = emailSent
      ? `<div class="saved-meta">Sent ${escapeHtml(formatShortDateTime(confirmation.sentAt))}</div>`
      : '';
    const apologyMeta = apologySent
      ? `<div class="saved-meta">Apology ${escapeHtml(formatShortDateTime(apology.sentAt))}</div>`
      : '';
    row.innerHTML = `
      <td>${escapeHtml(formatReservationDateTime(booking))}</td>
      <td>
        <div class="reservation-primary">${escapeHtml(customer.name || booking.customerId || '')}</div>
        ${customerMeta ? `<div class="saved-meta">${escapeHtml(customerMeta)}</div>` : ''}
      </td>
      <td>${escapeHtml(serviceNameById(booking.serviceId))}</td>
      <td>${escapeHtml(resourceNameById(booking.resourceId))}</td>
      <td>
        <span class="slot-pill slot-${slotClass}" title="${escapeHtml(slot.reason || '')}">${escapeHtml(slotCheckLabel(slot))}</span>
        ${slot.reason ? `<div class="saved-meta">${escapeHtml(slot.reason)}</div>` : ''}
      </td>
      <td><span class="badge ${statusClass}">${escapeHtml(status)}</span></td>
      <td><span class="source-pill source-${sourceClass}">${escapeHtml(sourceLabel(source))}</span></td>
      <td class="mono">${escapeHtml(booking.voucherCode || '')}</td>
      <td>${escapeHtml(booking.note || '')}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="confirm-email" data-id="${escapeHtml(booking.id || '')}" ${canSendEmail ? '' : 'disabled'}>${escapeHtml(emailButtonLabel)}</button>
          ${
            canShowApology || apologySent || isSendingApology
              ? `<button type="button" data-action="apology-email" data-id="${escapeHtml(booking.id || '')}" ${canSendApology ? '' : 'disabled'}>${escapeHtml(apologyButtonLabel)}</button>`
              : ''
          }
          <button type="button" data-action="open" data-id="${escapeHtml(booking.id || '')}">Open</button>
        </div>
        ${emailMeta}${apologyMeta}
      </td>
    `;
    row.querySelector('[data-action="open"]')?.addEventListener('click', () => openBookingModal(booking));
    row.querySelector('[data-action="confirm-email"]')?.addEventListener('click', () => confirmReservationEmail(booking));
    row.querySelector('[data-action="apology-email"]')?.addEventListener('click', () => sendReservationApologyEmail(booking));
    reservationsTableBody.appendChild(row);
  });
}

async function loadReservations() {
  setReservationsStatus('Loading reservations...');
  try {
    const ready = await loadScheduleLookups();
    if (!ready) return;
    const res = await window.api.bookings.list({}, []);
    if (!res?.ok) {
      setReservationsStatus(res?.error || 'Failed to load reservations', true);
      return;
    }
    state.reservations = Array.isArray(res.data) ? res.data : [];
    const ids = state.reservations.map((booking) => booking.id).filter(Boolean);
    state.reservationSlotChecks = {};
    state.reservationEmailConfirmations = {};
    state.reservationApologyEmails = {};
    renderReservations();
    await Promise.all([
      loadReservationSlotChecks(ids),
      loadReservationEmailConfirmations(ids),
      loadReservationApologyEmails(ids)
    ]);
    setReservationsStatus('');
  } catch (err) {
    console.error(err);
    setReservationsStatus(err.message || 'Failed to load reservations', true);
  }
}

function renderScheduleDayHeader() {
  if (!scheduleDayTitle) return;
  const dateLabel = formatScheduleDateLabel(state.scheduleDate);
  const resourceLabel = state.scheduleResourceId ? resourceNameById(state.scheduleResourceId) : '';
  const serviceLabel = state.scheduleServiceId ? serviceNameById(state.scheduleServiceId) : '';
  let text = dateLabel || 'Day';
  if (resourceLabel) text += ` - ${resourceLabel}`;
  if (serviceLabel) text += ` (${serviceLabel})`;
  scheduleDayTitle.textContent = text;
}

function renderScheduleGrid() {
  if (!scheduleGrid) return;
  scheduleGrid.innerHTML = '';
  const rowsCount = Math.floor((SCHEDULE_END_MIN - SCHEDULE_START_MIN) / SCHEDULE_STEP_MIN);
  const timelineHeight = rowsCount * SCHEDULE_ROW_HEIGHT;

  const times = document.createElement('div');
  times.className = 'schedule-times';
  for (let i = 0; i < rowsCount; i += 1) {
    const rowMinutes = SCHEDULE_START_MIN + i * SCHEDULE_STEP_MIN;
    const cell = document.createElement('div');
    cell.className = 'schedule-time-cell';
    cell.textContent = rowMinutes % 60 === 0 ? minutesToTimeText(rowMinutes) : '';
    times.appendChild(cell);
  }

  const canvas = document.createElement('div');
  canvas.className = 'schedule-canvas';
  canvas.style.height = `${timelineHeight}px`;
  canvas.addEventListener('click', (event) => {
    if (event.target.closest('.schedule-booking-block')) return;
    if (!state.scheduleResourceId) {
      setScheduleStatus('Select a resource first', true);
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const offsetY = Math.max(0, Math.min(rect.height - 1, event.clientY - rect.top));
    const rowIndex = Math.floor(offsetY / SCHEDULE_ROW_HEIGHT);
    const startMin = SCHEDULE_START_MIN + rowIndex * SCHEDULE_STEP_MIN;
    openBookingModal(null, { date: state.scheduleDate, startMin });
  });

  let rendered = 0;
  state.scheduleBookings.forEach((booking) => {
    const startAt = new Date(booking.startAt);
    const endAt = new Date(booking.endAt);
    const dayStart = dateFromDateText(state.scheduleDate);
    if (!dayStart || Number.isNaN(startAt.valueOf()) || Number.isNaN(endAt.valueOf()) || endAt <= startAt) return;
    const dayEnd = new Date(dayStart.getTime());
    dayEnd.setDate(dayEnd.getDate() + 1);

    const clipStart = Math.max(startAt.getTime(), dayStart.getTime());
    const clipEnd = Math.min(endAt.getTime(), dayEnd.getTime());
    if (clipEnd <= clipStart) return;

    const startMin = Math.round((clipStart - dayStart.getTime()) / 60000);
    const endMin = Math.round((clipEnd - dayStart.getTime()) / 60000);
    const visibleStart = Math.max(startMin, SCHEDULE_START_MIN);
    const visibleEnd = Math.min(endMin, SCHEDULE_END_MIN);
    if (visibleEnd <= visibleStart) return;

    const top = ((visibleStart - SCHEDULE_START_MIN) / SCHEDULE_STEP_MIN) * SCHEDULE_ROW_HEIGHT;
    const height = Math.max(18, ((visibleEnd - visibleStart) / SCHEDULE_STEP_MIN) * SCHEDULE_ROW_HEIGHT - 2);
    const status = String(booking.status || 'confirmed').trim().toLowerCase();

    const block = document.createElement('div');
    block.className = `schedule-booking-block status-${status}`;
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.innerHTML = `
      <div class="schedule-booking-time">${escapeHtml(isoToLocalTimeText(booking.startAt))} - ${escapeHtml(isoToLocalTimeText(booking.endAt))}</div>
      <div>${escapeHtml(serviceNameById(booking.serviceId))}</div>
      <div>${escapeHtml(customerNameById(booking.customerId))}</div>
    `;
    block.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openBookingModal(booking);
    });
    canvas.appendChild(block);
    rendered += 1;
  });

  if (rendered === 0) {
    const empty = document.createElement('div');
    empty.className = 'schedule-grid-empty';
    empty.textContent = 'No bookings for selected day.';
    canvas.appendChild(empty);
  }

  scheduleGrid.appendChild(times);
  scheduleGrid.appendChild(canvas);
}

async function loadScheduleBookings() {
  if (!state.scheduleDate) state.scheduleDate = todayDateText();
  if (!state.scheduleResourceId) {
    renderScheduleDayHeader();
    state.scheduleBookings = [];
    renderScheduleGrid();
    if (!state.scheduleResources.length) {
      setScheduleStatus('No active resources. Add one in Resources.', true);
    } else {
      setScheduleStatus('Select a resource to view schedule.', true);
    }
    return;
  }

  const range = dateTextRangeToIso(state.scheduleDate);
  if (!range.from || !range.to) {
    setScheduleStatus('Invalid schedule date', true);
    return;
  }

  try {
    const res = await window.api.bookings.list(range, [state.scheduleResourceId]);
    if (!res?.ok) {
      setScheduleStatus(res?.error || 'Failed to load bookings', true);
      return;
    }

    const allBookings = Array.isArray(res.data) ? res.data : [];
    state.scheduleBookings = state.scheduleServiceId
      ? allBookings.filter((item) => item.serviceId === state.scheduleServiceId)
      : allBookings;
    renderScheduleDayHeader();
    renderScheduleGrid();
    setScheduleStatus('');
  } catch (err) {
    console.error(err);
    setScheduleStatus(err.message || 'Failed to load bookings', true);
  }
}

async function openBookingModal(booking = null, seed = {}) {
  const ready = await loadScheduleLookups();
  if (!ready) return;
  if (!state.scheduleResources.length) {
    setScheduleStatus('No active resources. Add one in Resources.', true);
    return;
  }
  if (!state.scheduleServices.length) {
    setScheduleStatus('No active services. Add one in Services.', true);
    return;
  }

  state.editingBookingId = booking?.id || null;
  state.bookingSlotHintIso = booking?.startAt || '';
  state.editingBookingSnapshot = booking
    ? {
        serviceId: booking.serviceId || '',
        resourceId: booking.resourceId || '',
        startAt: booking.startAt || '',
        date: isoToLocalDateText(booking.startAt || '')
      }
    : null;
  state.editingBookingOriginalVoucherCode = String(booking?.voucherCode || '').trim();
  state.editingBookingSource = String(booking?.source || '').trim();
  const dateValue = normalizeDateValue(seed.date || booking?.startAt || state.scheduleDate || todayDateText());
  if (seed.startMin !== undefined && seed.startMin !== null) {
    const slotHint = localDateTimeToIso(dateValue, minutesToTimeText(seed.startMin));
    if (slotHint) state.bookingSlotHintIso = slotHint;
  }

  if (bookingModalTitle) {
    bookingModalTitle.textContent = state.editingBookingId ? 'Edit Booking' : 'Create Booking';
  }
  if (bookingModalCancelBooking) {
    bookingModalCancelBooking.style.display = state.editingBookingId ? 'inline-flex' : 'none';
  }

  renderBookingServiceSelect(booking?.serviceId || state.scheduleServiceId);
  renderBookingResourceSelect(booking?.resourceId || state.scheduleResourceId);
  renderBookingCustomerSelect(booking?.customerId || '');

  if (bookingDateInput) bookingDateInput.value = dateValue;
  if (bookingStatusSelect) bookingStatusSelect.value = String(booking?.status || 'confirmed').toLowerCase();
  if (bookingNoteInput) bookingNoteInput.value = booking?.note || '';
  if (bookingCustomerNameInput) bookingCustomerNameInput.value = '';
  if (bookingCustomerPhoneInput) bookingCustomerPhoneInput.value = '';
  if (bookingCustomerEmailInput) bookingCustomerEmailInput.value = '';
  if (bookingVoucherCodeInput) bookingVoucherCodeInput.value = booking?.voucherCode || '';
  state.bookingVoucherId = String(booking?.voucherId || '').trim();
  state.bookingVoucherCode = String(booking?.voucherCode || '').trim();
  state.bookingVoucherState = '';
  setBookingVoucherStatus('');

  bookingModal?.classList.add('open');
  bookingModal?.setAttribute('aria-hidden', 'false');
  setBookingModalStatus('');
  if (booking?.voucherCode) {
    await validateVoucherForBookingModal();
  } else if (booking?.voucherId) {
    setBookingVoucherStatus(`Linked voucher id: ${booking.voucherId}`);
  }
  await refreshBookingStartSlots(state.bookingSlotHintIso);
}

function closeBookingModal() {
  state.editingBookingId = null;
  state.bookingSlotHintIso = '';
  state.editingBookingSnapshot = null;
  state.editingBookingOriginalVoucherCode = '';
  state.editingBookingSource = '';
  resetBookingVoucherLink();
  if (bookingVoucherCodeInput) bookingVoucherCodeInput.value = '';
  bookingModal?.classList.remove('open');
  bookingModal?.setAttribute('aria-hidden', 'true');
  setBookingModalStatus('');
}

function bookingDurationForService(serviceId) {
  const service = serviceById(serviceId);
  return Math.max(1, Number.parseInt(service?.durationMin, 10) || 30);
}

function normalizeSlotItems(slotItems, serviceId) {
  const durationMin = bookingDurationForService(serviceId);
  const normalized = [];
  (Array.isArray(slotItems) ? slotItems : []).forEach((item) => {
    if (typeof item === 'string') {
      const startAt = item;
      const start = new Date(startAt);
      if (Number.isNaN(start.valueOf())) return;
      const endAt = new Date(start.getTime() + durationMin * 60000).toISOString();
      normalized.push({ startAt, endAt });
      return;
    }
    if (item && typeof item === 'object') {
      const startAt = item.startAt;
      if (!startAt) return;
      let endAt = item.endAt;
      if (!endAt) {
        const start = new Date(startAt);
        if (Number.isNaN(start.valueOf())) return;
        endAt = new Date(start.getTime() + durationMin * 60000).toISOString();
      }
      normalized.push({ startAt, endAt });
    }
  });
  return normalized;
}

async function refreshBookingStartSlots(preferredIso = '') {
  const serviceId = bookingServiceSelect?.value || '';
  const resourceId = bookingResourceSelect?.value || '';
  const date = normalizeDateValue(bookingDateInput?.value || '');
  if (!bookingStartSelect) return;

  bookingStartSelect.innerHTML = '';

  if (!serviceId || !resourceId || !date) {
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select service/resource/date';
    bookingStartSelect.appendChild(placeholder);
    return;
  }

  try {
    const res = await window.api.bookings.computeSlots({
      serviceId,
      resourceId,
      from: date,
      to: date,
      slotStepMin: WEBSITE_SLOT_STEP_MIN,
      includeEndAt: true
    });

    if (!res?.ok) {
      setBookingModalStatus(res?.error || 'Failed to compute slots', true);
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No available slots';
      bookingStartSelect.appendChild(empty);
      return;
    }

    const slots = normalizeSlotItems(res.data, serviceId);
    const canKeepOriginalSlot =
      Boolean(state.editingBookingId) &&
      preferredIso &&
      preferredIso === state.editingBookingSnapshot?.startAt &&
      serviceId === state.editingBookingSnapshot?.serviceId &&
      resourceId === state.editingBookingSnapshot?.resourceId &&
      date === state.editingBookingSnapshot?.date;

    if (canKeepOriginalSlot && !slots.some((slot) => slot.startAt === preferredIso)) {
      const preferredStart = new Date(preferredIso);
      if (!Number.isNaN(preferredStart.valueOf())) {
        const duration = bookingDurationForService(serviceId);
        slots.push({
          startAt: preferredIso,
          endAt: new Date(preferredStart.getTime() + duration * 60000).toISOString()
        });
      }
    }
    slots.sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || '')));

    if (!slots.length) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No available slots';
      bookingStartSelect.appendChild(empty);
      return;
    }

    slots.forEach((slot) => {
      const option = document.createElement('option');
      option.value = slot.startAt;
      option.dataset.endAt = slot.endAt;
      option.textContent = `${isoToLocalTimeText(slot.startAt)} - ${isoToLocalTimeText(slot.endAt)}`;
      bookingStartSelect.appendChild(option);
    });

    let selectedValue = preferredIso || bookingStartSelect.value || '';
    if (!selectedValue || !slots.some((slot) => slot.startAt === selectedValue)) {
      selectedValue = slots[0].startAt;
    }
    bookingStartSelect.value = selectedValue;
    state.bookingSlotHintIso = selectedValue;
    setBookingModalStatus('');
  } catch (err) {
    console.error(err);
    setBookingModalStatus(err.message || 'Failed to compute slots', true);
  }
}

function selectedBookingEndAt() {
  const option = bookingStartSelect?.options?.[bookingStartSelect.selectedIndex];
  return option?.dataset?.endAt || '';
}

async function ensureBookingCustomerId() {
  const existingCustomerId = bookingCustomerSelect?.value || '';
  const newCustomerName = (bookingCustomerNameInput?.value || '').trim();
  if (!newCustomerName) {
    if (existingCustomerId) return existingCustomerId;
    throw new Error('Customer is required');
  }

  const payload = {
    name: newCustomerName,
    phone: (bookingCustomerPhoneInput?.value || '').trim() || null,
    email: (bookingCustomerEmailInput?.value || '').trim() || null
  };
  const saveRes = await window.api.customers.save(payload);
  if (!saveRes?.ok || !saveRes?.data?.id) {
    throw new Error(saveRes?.error || 'Failed to create customer');
  }

  await loadScheduleLookups();
  renderBookingCustomerSelect(saveRes.data.id);
  return saveRes.data.id;
}

async function saveBookingFromModal() {
  const serviceId = bookingServiceSelect?.value || '';
  const resourceId = bookingResourceSelect?.value || '';
  const date = normalizeDateValue(bookingDateInput?.value || '');
  const startAt = bookingStartSelect?.value || '';
  const status = String(bookingStatusSelect?.value || 'confirmed').trim().toLowerCase() || 'confirmed';
  const note = (bookingNoteInput?.value || '').trim();
  const voucherCodeInput = (bookingVoucherCodeInput?.value || '').trim();

  if (!serviceId) {
    setBookingModalStatus('Service is required', true);
    return;
  }
  if (!resourceId) {
    setBookingModalStatus('Resource is required', true);
    return;
  }
  if (!date) {
    setBookingModalStatus('Date is required', true);
    return;
  }
  if (!startAt) {
    setBookingModalStatus('Start time is required', true);
    return;
  }

  try {
    let voucherId = null;
    let voucherCode = null;
    if (voucherCodeInput) {
      const voucherValidation = await validateVoucherForBookingModal();
      if (!voucherValidation.ok) {
        setBookingModalStatus('Voucher validation failed', true);
        return;
      }
      if (!voucherValidation.valid) {
        const canKeepExistingVoucherLink =
          Boolean(state.editingBookingId) &&
          voucherCodeInput === state.editingBookingOriginalVoucherCode;
        if (!canKeepExistingVoucherLink) {
          setBookingModalStatus('Voucher code is not valid', true);
          return;
        }
      }
      voucherId = state.bookingVoucherId || null;
      voucherCode = state.bookingVoucherCode || voucherCodeInput;
      if (!voucherCode) {
        setBookingModalStatus('Voucher code is not valid', true);
        return;
      }
    } else {
      resetBookingVoucherLink();
    }

    const customerId = await ensureBookingCustomerId();
    let endAt = selectedBookingEndAt();
    if (!endAt) {
      const durationMin = bookingDurationForService(serviceId);
      const start = new Date(startAt);
      if (Number.isNaN(start.valueOf())) throw new Error('Invalid selected start time');
      endAt = new Date(start.getTime() + durationMin * 60000).toISOString();
    }

    const payload = {
      id: state.editingBookingId || undefined,
      serviceId,
      resourceId,
      customerId,
      startAt,
      endAt,
      status,
      note,
      source: state.editingBookingId ? state.editingBookingSource || 'desktop' : 'desktop',
      voucherId,
      voucherCode
    };

    const saveRes = await window.api.bookings.save(payload);
    if (!saveRes?.ok) {
      setBookingModalStatus(saveRes?.error || 'Failed to save booking', true);
      return;
    }

    closeBookingModal();
    state.scheduleDate = date;
    state.scheduleResourceId = resourceId;
    state.scheduleServiceId = scheduleServiceSelect?.value || state.scheduleServiceId;
    renderScheduleFilters();
    await loadScheduleBookings();
    if (sectionReservations?.style.display !== 'none') {
      await loadReservations();
      setReservationsStatus('Reservation saved');
    }
    await refreshSyncIndicator();
    setScheduleStatus('Booking saved');
  } catch (err) {
    console.error(err);
    setBookingModalStatus(err.message || 'Failed to save booking', true);
  }
}

async function cancelBookingFromModal() {
  if (!state.editingBookingId) {
    closeBookingModal();
    return;
  }

  try {
    let booking = state.scheduleBookings.find((item) => item.id === state.editingBookingId) || null;
    if (!booking) {
      const getRes = await window.api.bookings.get(state.editingBookingId);
      if (!getRes?.ok || !getRes?.data) throw new Error(getRes?.error || 'Booking not found');
      booking = getRes.data;
    }

    const payload = {
      id: booking.id,
      serviceId: booking.serviceId,
      resourceId: booking.resourceId,
      customerId: booking.customerId,
      startAt: booking.startAt,
      endAt: booking.endAt,
      status: 'cancelled',
      note: booking.note || '',
      source: booking.source || 'desktop',
      voucherId: booking.voucherId || null,
      voucherCode: booking.voucherCode || null
    };

    const saveRes = await window.api.bookings.save(payload);
    if (!saveRes?.ok) {
      setBookingModalStatus(saveRes?.error || 'Failed to cancel booking', true);
      return;
    }

    closeBookingModal();
    await loadScheduleBookings();
    if (sectionReservations?.style.display !== 'none') {
      await loadReservations();
      setReservationsStatus('Reservation cancelled');
    }
    await refreshSyncIndicator();
    setScheduleStatus('Booking cancelled');
  } catch (err) {
    console.error(err);
    setBookingModalStatus(err.message || 'Failed to cancel booking', true);
  }
}

async function initScheduleSection() {
  if (!state.scheduleDate) state.scheduleDate = todayDateText();
  const ready = await loadScheduleLookups();
  if (!ready) return;
  await loadScheduleBookings();
}

function normalizeTimeInputValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  return '';
}

function createResourceRuleDraft(weekday) {
  return {
    id: '',
    weekday,
    startTime: '',
    endTime: '',
    breakStartTime: '',
    breakEndTime: ''
  };
}

function createDefaultResourceRulesDraft() {
  return WEEKDAY_LABELS.map((_label, weekday) => createResourceRuleDraft(weekday));
}

function mapRuleToDraft(rule = {}) {
  const breaks = Array.isArray(rule.breaks) ? rule.breaks : [];
  const firstBreak = breaks[0] || {};
  return {
    id: String(rule.id || '').trim(),
    weekday: Number.parseInt(rule.weekday, 10),
    startTime: normalizeTimeInputValue(rule.startTime),
    endTime: normalizeTimeInputValue(rule.endTime),
    breakStartTime: normalizeTimeInputValue(rule.breakStartTime || firstBreak.startTime || ''),
    breakEndTime: normalizeTimeInputValue(rule.breakEndTime || firstBreak.endTime || '')
  };
}

function mapExceptionToDraft(ex = {}) {
  return {
    id: String(ex.id || '').trim(),
    date: normalizeDateValue(ex.date),
    isOff: Number(ex.isOff) ? 1 : 0,
    startTime: normalizeTimeInputValue(ex.startTime),
    endTime: normalizeTimeInputValue(ex.endTime),
    note: String(ex.note || '').trim()
  };
}

function sortResourceExceptionsDraft() {
  state.resourceExceptionsDraft.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function syncExceptionEditorInputs() {
  const isOff = Boolean(exceptionIsOffInput?.checked);
  if (exceptionStartInput) {
    exceptionStartInput.disabled = isOff;
    if (isOff) exceptionStartInput.value = '';
  }
  if (exceptionEndInput) {
    exceptionEndInput.disabled = isOff;
    if (isOff) exceptionEndInput.value = '';
  }
}

function clearExceptionEditorInputs() {
  if (exceptionDateInput) exceptionDateInput.value = '';
  if (exceptionIsOffInput) exceptionIsOffInput.checked = true;
  if (exceptionStartInput) exceptionStartInput.value = '';
  if (exceptionEndInput) exceptionEndInput.value = '';
  if (exceptionNoteInput) exceptionNoteInput.value = '';
  syncExceptionEditorInputs();
}

function renderResourceRulesGrid() {
  if (!resourceRulesGrid) return;
  resourceRulesGrid.innerHTML = '';

  state.resourceRulesDraft.forEach((rule, weekday) => {
    const row = document.createElement('div');
    row.className = 'rule-row';

    const day = document.createElement('div');
    day.className = 'rule-day';
    day.textContent = WEEKDAY_LABELS[weekday] || `Day ${weekday}`;

    const startInput = document.createElement('input');
    startInput.type = 'time';
    startInput.value = rule.startTime || '';
    startInput.placeholder = 'Start';
    startInput.addEventListener('input', (e) => {
      state.resourceRulesDraft[weekday].startTime = normalizeTimeInputValue(e.target.value);
    });

    const endInput = document.createElement('input');
    endInput.type = 'time';
    endInput.value = rule.endTime || '';
    endInput.placeholder = 'End';
    endInput.addEventListener('input', (e) => {
      state.resourceRulesDraft[weekday].endTime = normalizeTimeInputValue(e.target.value);
    });

    const breakStartInput = document.createElement('input');
    breakStartInput.type = 'time';
    breakStartInput.value = rule.breakStartTime || '';
    breakStartInput.placeholder = 'Break start';
    breakStartInput.addEventListener('input', (e) => {
      state.resourceRulesDraft[weekday].breakStartTime = normalizeTimeInputValue(e.target.value);
    });

    const breakEndInput = document.createElement('input');
    breakEndInput.type = 'time';
    breakEndInput.value = rule.breakEndTime || '';
    breakEndInput.placeholder = 'Break end';
    breakEndInput.addEventListener('input', (e) => {
      state.resourceRulesDraft[weekday].breakEndTime = normalizeTimeInputValue(e.target.value);
    });

    row.appendChild(day);
    row.appendChild(startInput);
    row.appendChild(endInput);
    row.appendChild(breakStartInput);
    row.appendChild(breakEndInput);
    resourceRulesGrid.appendChild(row);
  });
}

function renderResourceExceptionsList() {
  if (!resourceExceptionsList) return;
  resourceExceptionsList.innerHTML = '';

  if (!state.resourceExceptionsDraft.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No exceptions added.';
    resourceExceptionsList.appendChild(empty);
    return;
  }

  state.resourceExceptionsDraft.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'exception-item';
    const safeDate = normalizeDateValue(item.date);
    const isOff = Number(item.isOff) === 1;
    const hoursText = isOff ? 'Off day' : `${item.startTime || '--:--'} - ${item.endTime || '--:--'}`;

    const dateEl = document.createElement('div');
    dateEl.className = 'exception-date';
    dateEl.textContent = safeDate || '-';

    const hoursEl = document.createElement('div');
    hoursEl.className = 'exception-hours';
    hoursEl.textContent = hoursText;

    const noteEl = document.createElement('div');
    noteEl.className = 'exception-note';
    noteEl.textContent = item.note || '';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'danger exception-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      const removed = state.resourceExceptionsDraft[index];
      if (removed?.id) {
        state.resourceExceptionDeletedIds.push(removed.id);
        state.resourceExceptionDeletedIds = Array.from(new Set(state.resourceExceptionDeletedIds));
      }
      state.resourceExceptionsDraft.splice(index, 1);
      renderResourceExceptionsList();
    });

    row.appendChild(dateEl);
    row.appendChild(hoursEl);
    row.appendChild(noteEl);
    row.appendChild(deleteBtn);
    resourceExceptionsList.appendChild(row);
  });
}

function resetResourceAvailabilityDraft() {
  state.resourceRulesDraft = createDefaultResourceRulesDraft();
  state.resourceExceptionsDraft = [];
  state.resourceExceptionDeletedIds = [];
  renderResourceRulesGrid();
  renderResourceExceptionsList();
  clearExceptionEditorInputs();
}

function addOrUpdateResourceExceptionFromEditor() {
  const date = normalizeDateValue(exceptionDateInput?.value || '');
  if (!date) {
    setResourceModalStatus('Exception date is required', true);
    return;
  }

  const isOff = exceptionIsOffInput?.checked ? 1 : 0;
  const startTime = normalizeTimeInputValue(exceptionStartInput?.value || '');
  const endTime = normalizeTimeInputValue(exceptionEndInput?.value || '');
  const note = String(exceptionNoteInput?.value || '').trim();

  if (!isOff) {
    if (!startTime || !endTime) {
      setResourceModalStatus('Custom hours require start and end time', true);
      return;
    }
    if (startTime >= endTime) {
      setResourceModalStatus('Exception start time must be before end time', true);
      return;
    }
  }

  const existingIndex = state.resourceExceptionsDraft.findIndex((item) => item.date === date);
  const existing = existingIndex >= 0 ? state.resourceExceptionsDraft[existingIndex] : null;
  const draft = {
    id: existing?.id || '',
    date,
    isOff,
    startTime: isOff ? '' : startTime,
    endTime: isOff ? '' : endTime,
    note
  };

  if (existingIndex >= 0) {
    state.resourceExceptionsDraft[existingIndex] = draft;
  } else {
    state.resourceExceptionsDraft.push(draft);
  }
  sortResourceExceptionsDraft();
  renderResourceExceptionsList();
  clearExceptionEditorInputs();
  setResourceModalStatus('');
}

async function loadResourceAvailabilityForModal(resourceId) {
  resetResourceAvailabilityDraft();
  if (!resourceId) return;

  try {
    const [rulesRes, exceptionsRes] = await Promise.all([
      window.api.availability.listRules(resourceId),
      window.api.availability.listExceptions(resourceId, '', '')
    ]);

    if (!rulesRes?.ok) {
      setResourceModalStatus(rulesRes?.error || 'Failed to load working hours', true);
      return;
    }
    if (!exceptionsRes?.ok) {
      setResourceModalStatus(exceptionsRes?.error || 'Failed to load exceptions', true);
      return;
    }

    const nextRules = createDefaultResourceRulesDraft();
    const incomingRules = Array.isArray(rulesRes.data) ? rulesRes.data : [];
    incomingRules.forEach((rule) => {
      const mapped = mapRuleToDraft(rule);
      const weekday = Number.parseInt(mapped.weekday, 10);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return;
      nextRules[weekday] = {
        ...nextRules[weekday],
        ...mapped,
        weekday
      };
    });
    state.resourceRulesDraft = nextRules;
    state.resourceExceptionsDraft = Array.isArray(exceptionsRes.data)
      ? exceptionsRes.data.map(mapExceptionToDraft).filter((item) => item.date)
      : [];
    sortResourceExceptionsDraft();
    state.resourceExceptionDeletedIds = [];
    renderResourceRulesGrid();
    renderResourceExceptionsList();
  } catch (err) {
    console.error(err);
    setResourceModalStatus(err.message || 'Failed to load availability', true);
  }
}

async function saveResourceAvailability(resourceId) {
  if (!resourceId) throw new Error('resourceId is required for availability');

  for (const rule of state.resourceRulesDraft) {
    const startTime = normalizeTimeInputValue(rule.startTime);
    const endTime = normalizeTimeInputValue(rule.endTime);
    const breakStartTime = normalizeTimeInputValue(rule.breakStartTime);
    const breakEndTime = normalizeTimeInputValue(rule.breakEndTime);

    if (!startTime && !endTime) {
      if (rule.id) {
        const deleteRes = await window.api.availability.deleteRule(rule.id);
        if (!deleteRes?.ok) throw new Error(deleteRes?.error || `Failed to delete rule for ${WEEKDAY_LABELS[rule.weekday]}`);
      }
      continue;
    }
    if (!startTime || !endTime) {
      throw new Error(`${WEEKDAY_LABELS[rule.weekday]} requires both start and end time`);
    }
    if (startTime >= endTime) {
      throw new Error(`${WEEKDAY_LABELS[rule.weekday]} start time must be before end time`);
    }
    if ((breakStartTime && !breakEndTime) || (!breakStartTime && breakEndTime)) {
      throw new Error(`${WEEKDAY_LABELS[rule.weekday]} break requires start and end time`);
    }
    if (breakStartTime && breakEndTime) {
      if (breakStartTime >= breakEndTime) {
        throw new Error(`${WEEKDAY_LABELS[rule.weekday]} break start must be before break end`);
      }
      if (breakStartTime <= startTime || breakEndTime >= endTime) {
        throw new Error(`${WEEKDAY_LABELS[rule.weekday]} break must be inside working hours`);
      }
    }

    const payload = {
      id: rule.id || undefined,
      resourceId,
      weekday: rule.weekday,
      startTime,
      endTime,
      breakStartTime: breakStartTime || undefined,
      breakEndTime: breakEndTime || undefined
    };
    const saveRes = await window.api.availability.saveRule(payload);
    if (!saveRes?.ok) throw new Error(saveRes?.error || `Failed to save rule for ${WEEKDAY_LABELS[rule.weekday]}`);
    if (saveRes?.data?.id) {
      rule.id = String(saveRes.data.id);
    }
  }

  for (const exceptionId of state.resourceExceptionDeletedIds) {
    const deleteRes = await window.api.availability.deleteException(exceptionId);
    if (!deleteRes?.ok) throw new Error(deleteRes?.error || 'Failed to delete exception');
  }
  state.resourceExceptionDeletedIds = [];

  for (const ex of state.resourceExceptionsDraft) {
    const date = normalizeDateValue(ex.date);
    if (!date) throw new Error('Exception date is required');
    const isOff = Number(ex.isOff) ? 1 : 0;
    const startTime = isOff ? '' : normalizeTimeInputValue(ex.startTime);
    const endTime = isOff ? '' : normalizeTimeInputValue(ex.endTime);
    if (!isOff) {
      if (!startTime || !endTime) throw new Error(`Exception ${date} requires start and end time`);
      if (startTime >= endTime) throw new Error(`Exception ${date} start time must be before end time`);
    }

    const payload = {
      id: ex.id || undefined,
      resourceId,
      date,
      isOff,
      startTime: isOff ? undefined : startTime,
      endTime: isOff ? undefined : endTime,
      note: String(ex.note || '').trim()
    };
    const saveRes = await window.api.availability.saveException(payload);
    if (!saveRes?.ok) throw new Error(saveRes?.error || `Failed to save exception for ${date}`);
    if (saveRes?.data?.id) {
      ex.id = String(saveRes.data.id);
    }
  }
}

function renderServicesTable() {
  if (!servicesTableBody) return;
  servicesTableBody.innerHTML = '';

  if (!state.services.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="5" class="empty-state">No services found.</td>';
    servicesTableBody.appendChild(emptyRow);
    return;
  }

  state.services.forEach((service) => {
    const row = document.createElement('tr');
    const activeBadge = Number(service.isActive) ? '<span class="badge valid">Yes</span>' : '<span class="badge not_found">No</span>';
    row.innerHTML = `
      <td>${escapeHtml(service.name || '')}</td>
      <td>${escapeHtml(String(service.durationMin || 30))} min</td>
      <td>${escapeHtml(formatMoneyFromCents(service.priceCents, service.currency || 'BGN'))}</td>
      <td>${activeBadge}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${escapeHtml(service.id || '')}">Edit</button>
          <button type="button" class="danger" data-action="delete" data-id="${escapeHtml(service.id || '')}">Delete</button>
        </div>
      </td>
    `;

    row.querySelector('[data-action="edit"]')?.addEventListener('click', () => openServiceModal(service));
    row.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteService(service.id));
    servicesTableBody.appendChild(row);
  });
}

async function loadServices() {
  try {
    const res = await window.api.services.list(200, state.servicesSearch || '');
    if (!res?.ok) {
      setServicesStatus(res?.error || 'Failed to load services', true);
      return;
    }
    state.services = Array.isArray(res.data) ? res.data : [];
    renderServicesTable();
  } catch (err) {
    console.error(err);
    setServicesStatus(err.message || 'Failed to load services', true);
  }
}

function openServiceModal(service = null) {
  state.editingServiceId = service?.id || null;
  if (serviceModalTitle) {
    serviceModalTitle.textContent = state.editingServiceId ? 'Edit Service' : 'Add Service';
  }
  if (serviceNameInput) serviceNameInput.value = service?.name || '';
  if (serviceDurationInput) serviceDurationInput.value = String(service?.durationMin || 30);
  if (servicePriceInput) servicePriceInput.value = formatCentsForInput(service?.priceCents || 0);
  if (serviceCurrencyInput) serviceCurrencyInput.value = normalizeCurrencyCode(service?.currency, 'BGN');
  if (serviceActiveInput) serviceActiveInput.checked = Number(service?.isActive ?? 1) !== 0;
  setServiceModalStatus('');
  serviceModal?.classList.add('open');
  serviceModal?.setAttribute('aria-hidden', 'false');
  serviceNameInput?.focus();
}

function closeServiceModal() {
  state.editingServiceId = null;
  serviceModal?.classList.remove('open');
  serviceModal?.setAttribute('aria-hidden', 'true');
  setServiceModalStatus('');
}

async function saveServiceFromModal() {
  const name = (serviceNameInput?.value || '').trim();
  if (!name) {
    setServiceModalStatus('Name is required', true);
    return;
  }
  const priceCents = parseMoneyInputToCents(servicePriceInput?.value);
  if (priceCents === null) {
    setServiceModalStatus('Price must be a valid amount like 12.50 or 12,50', true);
    return;
  }
  const isEdit = Boolean(state.editingServiceId);
  const payload = {
    id: state.editingServiceId || undefined,
    name,
    durationMin: Math.max(1, Number.parseInt(serviceDurationInput?.value || '30', 10) || 30),
    priceCents,
    currency: normalizeCurrencyCode(serviceCurrencyInput?.value, 'BGN'),
    isActive: serviceActiveInput?.checked ? 1 : 0
  };

  try {
    const res = await window.api.services.save(payload);
    if (!res?.ok) {
      setServiceModalStatus(res?.error || 'Failed to save service', true);
      return;
    }
    closeServiceModal();
    await loadServices();
    await refreshSyncIndicator();
    setServicesStatus(isEdit ? 'Service updated' : 'Service created');
  } catch (err) {
    console.error(err);
    setServiceModalStatus(err.message || 'Failed to save service', true);
  }
}

async function deleteService(id) {
  if (!id) return;
  const confirmed = window.confirm('Delete this service?');
  if (!confirmed) return;

  try {
    const res = await window.api.services.delete(id);
    if (!res?.ok) {
      setServicesStatus(res?.error || 'Failed to delete service', true);
      return;
    }
    if (!res?.data?.deleted) {
      setServicesStatus('Service not found', true);
      return;
    }
    await loadServices();
    await refreshSyncIndicator();
    setServicesStatus('Service deleted');
  } catch (err) {
    console.error(err);
    setServicesStatus(err.message || 'Failed to delete service', true);
  }
}

function renderResourcesTable() {
  if (!resourcesTableBody) return;
  resourcesTableBody.innerHTML = '';

  if (!state.resources.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = '<td colspan="4" class="empty-state">No resources found.</td>';
    resourcesTableBody.appendChild(emptyRow);
    return;
  }

  state.resources.forEach((resource) => {
    const row = document.createElement('tr');
    const activeBadge = Number(resource.isActive) ? '<span class="badge valid">Yes</span>' : '<span class="badge not_found">No</span>';
    row.innerHTML = `
      <td>${escapeHtml(resource.name || '')}</td>
      <td>${escapeHtml(resource.type || 'employee')}</td>
      <td>${activeBadge}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${escapeHtml(resource.id || '')}">Edit</button>
          <button type="button" class="danger" data-action="delete" data-id="${escapeHtml(resource.id || '')}">Delete</button>
        </div>
      </td>
    `;

    row.querySelector('[data-action="edit"]')?.addEventListener('click', () => openResourceModal(resource));
    row.querySelector('[data-action="delete"]')?.addEventListener('click', () => deleteResource(resource.id));
    resourcesTableBody.appendChild(row);
  });
}

async function loadResources() {
  try {
    const res = await window.api.resources.list(200, state.resourcesSearch || '');
    if (!res?.ok) {
      setResourcesStatus(res?.error || 'Failed to load resources', true);
      return;
    }
    state.resources = Array.isArray(res.data) ? res.data : [];
    renderResourcesTable();
  } catch (err) {
    console.error(err);
    setResourcesStatus(err.message || 'Failed to load resources', true);
  }
}

function renderResourceServicesChecklist() {
  if (!resourceServicesList) return;
  resourceServicesList.innerHTML = '';

  if (!state.resourceServiceOptions.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No active services available.';
    resourceServicesList.appendChild(empty);
    return;
  }

  state.resourceServiceOptions.forEach((service) => {
    const serviceId = String(service.id || '').trim();
    if (!serviceId) return;
    const item = document.createElement('label');
    item.className = 'checklist-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = serviceId;
    input.checked = state.resourceServiceIds.includes(serviceId);
    const text = document.createElement('span');
    const duration = Number.parseInt(service.durationMin, 10) || 30;
    text.textContent = `${service.name} (${duration} min)`;
    item.appendChild(input);
    item.appendChild(text);
    resourceServicesList.appendChild(item);
  });
}

async function loadResourceServicesForModal(resourceId) {
  try {
    const [servicesRes, selectedRes] = await Promise.all([
      window.api.services.list(500, ''),
      resourceId ? window.api.resources.getServices(resourceId) : Promise.resolve({ ok: true, data: [] })
    ]);

    if (!servicesRes?.ok) {
      setResourceModalStatus(servicesRes?.error || 'Failed to load services', true);
      state.resourceServiceOptions = [];
      state.resourceServiceIds = [];
      renderResourceServicesChecklist();
      return;
    }
    if (resourceId && !selectedRes?.ok) {
      setResourceModalStatus(selectedRes?.error || 'Failed to load allowed services', true);
      state.resourceServiceOptions = Array.isArray(servicesRes.data) ? servicesRes.data : [];
      state.resourceServiceIds = [];
      renderResourceServicesChecklist();
      return;
    }

    state.resourceServiceOptions = Array.isArray(servicesRes.data) ? servicesRes.data : [];
    state.resourceServiceIds = Array.isArray(selectedRes?.data)
      ? selectedRes.data.map((id) => String(id || '').trim()).filter(Boolean)
      : [];
    renderResourceServicesChecklist();
  } catch (err) {
    console.error(err);
    setResourceModalStatus(err.message || 'Failed to load allowed services', true);
    state.resourceServiceOptions = [];
    state.resourceServiceIds = [];
    renderResourceServicesChecklist();
  }
}

function getSelectedResourceServiceIds() {
  if (!resourceServicesList) return [];
  return Array.from(resourceServicesList.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => String(input.value || '').trim())
    .filter(Boolean);
}

async function openResourceModal(resource = null) {
  state.editingResourceId = resource?.id || null;
  if (resourceModalTitle) {
    resourceModalTitle.textContent = state.editingResourceId ? 'Edit Resource' : 'Add Resource';
  }
  if (resourceNameInput) resourceNameInput.value = resource?.name || '';
  if (resourceTypeInput) resourceTypeInput.value = resource?.type || 'employee';
  if (resourceActiveInput) resourceActiveInput.checked = Number(resource?.isActive ?? 1) !== 0;
  setResourceModalStatus('');
  resourceModal?.classList.add('open');
  resourceModal?.setAttribute('aria-hidden', 'false');
  await Promise.all([loadResourceServicesForModal(state.editingResourceId), loadResourceAvailabilityForModal(state.editingResourceId)]);
  resourceNameInput?.focus();
}

function closeResourceModal() {
  state.editingResourceId = null;
  state.resourceServiceOptions = [];
  state.resourceServiceIds = [];
  state.resourceRulesDraft = [];
  state.resourceExceptionsDraft = [];
  state.resourceExceptionDeletedIds = [];
  if (resourceServicesList) {
    resourceServicesList.innerHTML = '';
  }
  if (resourceRulesGrid) {
    resourceRulesGrid.innerHTML = '';
  }
  if (resourceExceptionsList) {
    resourceExceptionsList.innerHTML = '';
  }
  clearExceptionEditorInputs();
  resourceModal?.classList.remove('open');
  resourceModal?.setAttribute('aria-hidden', 'true');
  setResourceModalStatus('');
}

async function saveResourceFromModal() {
  const name = (resourceNameInput?.value || '').trim();
  if (!name) {
    setResourceModalStatus('Name is required', true);
    return;
  }

  const isEdit = Boolean(state.editingResourceId);
  const payload = {
    id: state.editingResourceId || undefined,
    name,
    type: (resourceTypeInput?.value || 'employee').trim() || 'employee',
    isActive: resourceActiveInput?.checked ? 1 : 0
  };
  const selectedServiceIds = getSelectedResourceServiceIds();

  try {
    const res = await window.api.resources.save(payload);
    if (!res?.ok) {
      setResourceModalStatus(res?.error || 'Failed to save resource', true);
      return;
    }
    const resourceId = res?.data?.id || state.editingResourceId;
    if (!resourceId) {
      setResourceModalStatus('Saved resource is missing id', true);
      return;
    }

    const mapRes = await window.api.resources.setServices(resourceId, selectedServiceIds);
    if (!mapRes?.ok) {
      state.editingResourceId = resourceId;
      setResourceModalStatus(mapRes?.error || 'Resource saved, but failed to update allowed services', true);
      return;
    }

    await saveResourceAvailability(resourceId);

    closeResourceModal();
    await loadResources();
    await refreshSyncIndicator();
    setResourcesStatus(isEdit ? 'Resource updated' : 'Resource created');
  } catch (err) {
    console.error(err);
    setResourceModalStatus(err.message || 'Failed to save resource', true);
  }
}

async function deleteResource(id) {
  if (!id) return;
  const confirmed = window.confirm('Delete this resource?');
  if (!confirmed) return;

  try {
    const res = await window.api.resources.delete(id);
    if (!res?.ok) {
      setResourcesStatus(res?.error || 'Failed to delete resource', true);
      return;
    }
    if (!res?.data?.deleted) {
      setResourcesStatus('Resource not found', true);
      return;
    }
    await loadResources();
    await refreshSyncIndicator();
    setResourcesStatus('Resource deleted');
  } catch (err) {
    console.error(err);
    setResourcesStatus(err.message || 'Failed to delete resource', true);
  }
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
  updateVoucherActionButtonsState();
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
  if (key === 'phone') {
    state.currentVoucher.phone = String(value || '').trim();
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
  if (inputRecipientPhone) {
    inputRecipientPhone.value = (state.currentVoucher.data?.phone || state.currentVoucher.phone || '').trim();
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
  updateVoucherActionButtonsState();
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
    const phone = (v.phone || v.data?.phone || '').trim();
    item.innerHTML = `
      <div class="saved-title">${escapeHtml(title)}</div>
      <div class="saved-meta">${escapeHtml(code || '')}</div>
      ${phone ? `<div class="saved-meta">${escapeHtml(phone)}</div>` : ''}
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
  const phone = (res.item?.phone || res.item?.data?.phone || '').trim();
  state.currentVoucher = {
    id: res.item.id,
    templateId: res.item.templateId,
    phone,
    data: { ...(res.item.data || {}), phone },
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
    phone: '',
    data: {
      VoucherCode: codeValue,
      Code: codeValue,
      phone: '',
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
  const trimmedPhone = String(payload.data.phone ?? payload.phone ?? '').trim();
  payload.phone = trimmedPhone;
  payload.data.phone = trimmedPhone;
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
    const phone = String(res.item?.phone ?? res.item?.data?.phone ?? '').trim();
    state.currentVoucher = {
      id: res.item.id,
      templateId: res.item.templateId,
      phone,
      data: { ...(res.item.data || {}), phone },
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
    await refreshSyncIndicator();
  } else {
    setStatus(res?.error || 'Save failed', true);
  }
}

async function saveCopyCurrent() {
  if (state.currentVoucher.id) {
    const res = await window.api.vouchers.duplicate(state.currentVoucher.id);
    if (res?.ok) {
      const phone = String(res.item?.phone ?? res.item?.data?.phone ?? '').trim();
      state.currentVoucher = {
        id: res.item.id,
        templateId: res.item.templateId,
        phone,
        data: { ...(res.item.data || {}), phone },
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
      await refreshSyncIndicator();
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
    await refreshSyncIndicator();
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
    await refreshSyncIndicator();
  } else {
    setStatus(res?.error || 'Clear failed', true);
  }
}

async function handleUploadImage(imageKey) {
  const res = await window.api.vouchers.pickImage(state.currentVoucher.id, imageKey);
  if (res?.ok && res.voucher) {
    const phone = String(res.voucher?.phone ?? res.voucher?.data?.phone ?? state.currentVoucher.phone ?? '').trim();
    state.currentVoucher = {
      id: res.voucher.id,
      templateId: res.voucher.templateId,
      phone,
      data: { ...(res.voucher.data || state.currentVoucher.data || {}), phone },
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
  if (!state.currentVoucher?.id) {
    setStatus('Select or create a voucher first', true);
    return;
  }
  if (!state.currentTemplateId) {
    setStatus('Select a template first', true);
    return;
  }
  try {
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
  } catch (err) {
    setStatus(err?.message || 'Export failed', true);
  }
}

function switchView(viewName) {
  views.forEach((view) => view.classList.toggle('active', view.dataset.view === viewName));
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.viewTarget === viewName));
}

function switchMainSection(target) {
  sectionVouchers.style.display = target === 'vouchers' ? 'block' : 'none';
  sectionServices.style.display = target === 'services' ? 'block' : 'none';
  sectionResources.style.display = target === 'resources' ? 'block' : 'none';
  sectionSchedule.style.display = target === 'schedule' ? 'block' : 'none';
  if (sectionReservations) sectionReservations.style.display = target === 'reservations' ? 'block' : 'none';
  sectionBuilder.style.display = target === 'builder' ? 'block' : 'none';

  navVouchers.classList.toggle('active', target === 'vouchers');
  navServices.classList.toggle('active', target === 'services');
  navResources.classList.toggle('active', target === 'resources');
  navSchedule.classList.toggle('active', target === 'schedule');
  navReservations?.classList.toggle('active', target === 'reservations');
  navBuilder.classList.toggle('active', target === 'builder');

  if (target === 'builder') {
    initBuilder();
    updateBuilderResponsive();
  }
  if (target === 'services') {
    loadServices();
  }
  if (target === 'resources') {
    loadResources();
  }
  if (target === 'schedule') {
    initScheduleSection();
  }
  if (target === 'reservations') {
    loadReservations();
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
      <span class="label">Phone</span>
      <span>${escapeHtml(voucher.phone || '')}</span>
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
          phone: v.phone || v.data?.phone || '',
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
  updateVoucherActionButtonsState();
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
    helpVersion.textContent = `LN software - Version ${versionText}${state.testMode ? ' - Test version - feedback welcome' : ''}`;
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
  await loadServices();
  await loadResources();
  await refreshSyncIndicator();
  newVoucher();
  if (state.syncTimerId) {
    clearInterval(state.syncTimerId);
  }
  state.syncTimerId = window.setInterval(() => {
    refreshSyncIndicator();
  }, 5000);

  tabButtons.forEach((btn) =>
    btn.addEventListener('click', () => {
      switchView(btn.dataset.viewTarget);
    })
  );
  navVouchers.addEventListener('click', () => switchMainSection('vouchers'));
  navServices.addEventListener('click', () => switchMainSection('services'));
  navResources.addEventListener('click', () => switchMainSection('resources'));
  navSchedule.addEventListener('click', () => switchMainSection('schedule'));
  navReservations?.addEventListener('click', () => switchMainSection('reservations'));
  navBuilder.addEventListener('click', () => switchMainSection('builder'));
  themeToggle?.addEventListener('click', toggleTheme);
  btnSyncNow?.addEventListener('click', runSyncNow);
  syncIndicator?.addEventListener('click', runSyncNow);
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
  btnImportCsv?.addEventListener('click', handleImportCsv);
  importCsvConfirm?.addEventListener('click', confirmImportCsv);
  importCsvCancel?.addEventListener('click', closeImportCsvModal);
  importCsvClose?.addEventListener('click', closeImportCsvModal);
  importCsvModalBackdrop?.addEventListener('click', closeImportCsvModal);
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
  inputRecipientPhone?.addEventListener('input', (e) => {
    updateVoucherData('phone', e.target.value);
  });
  inputRecipientPhone?.addEventListener('blur', (e) => {
    const trimmed = String(e.target.value || '').trim();
    e.target.value = trimmed;
    updateVoucherData('phone', trimmed);
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
  servicesSearch?.addEventListener('input', async (e) => {
    state.servicesSearch = e.target.value || '';
    await loadServices();
  });
  resourcesSearch?.addEventListener('input', async (e) => {
    state.resourcesSearch = e.target.value || '';
    await loadResources();
  });
  scheduleDateInput?.addEventListener('change', async (e) => {
    state.scheduleDate = normalizeDateValue(e.target.value) || todayDateText();
    await loadScheduleBookings();
  });
  scheduleServiceSelect?.addEventListener('change', async (e) => {
    state.scheduleServiceId = e.target.value || '';
    await loadScheduleBookings();
  });
  scheduleResourceSelect?.addEventListener('change', async (e) => {
    state.scheduleResourceId = e.target.value || '';
    await loadScheduleBookings();
  });
  scheduleRefreshBtn?.addEventListener('click', async () => {
    await initScheduleSection();
  });
  reservationsSearch?.addEventListener('input', (e) => {
    state.reservationsSearch = e.target.value || '';
    renderReservations();
  });
  reservationsSourceFilter?.addEventListener('change', (e) => {
    state.reservationsSource = e.target.value || 'public';
    renderReservations();
  });
  reservationsStatusFilter?.addEventListener('change', (e) => {
    state.reservationsStatus = e.target.value || 'active';
    renderReservations();
  });
  reservationsRefreshBtn?.addEventListener('click', loadReservations);
  reservationsSyncBtn?.addEventListener('click', runSyncNow);
  btnServiceAdd?.addEventListener('click', () => openServiceModal());
  btnResourceAdd?.addEventListener('click', () => openResourceModal());

  serviceModalSave?.addEventListener('click', saveServiceFromModal);
  serviceModalCancel?.addEventListener('click', closeServiceModal);
  serviceModalClose?.addEventListener('click', closeServiceModal);
  serviceModalBackdrop?.addEventListener('click', closeServiceModal);

  resourceModalSave?.addEventListener('click', saveResourceFromModal);
  resourceModalCancel?.addEventListener('click', closeResourceModal);
  resourceModalClose?.addEventListener('click', closeResourceModal);
  resourceModalBackdrop?.addEventListener('click', closeResourceModal);
  exceptionIsOffInput?.addEventListener('change', syncExceptionEditorInputs);
  exceptionAddBtn?.addEventListener('click', addOrUpdateResourceExceptionFromEditor);

  bookingModalSave?.addEventListener('click', saveBookingFromModal);
  bookingModalCancel?.addEventListener('click', closeBookingModal);
  bookingModalClose?.addEventListener('click', closeBookingModal);
  bookingModalBackdrop?.addEventListener('click', closeBookingModal);
  bookingModalCancelBooking?.addEventListener('click', cancelBookingFromModal);
  bookingServiceSelect?.addEventListener('change', async () => {
    const preferred = bookingStartSelect?.value || state.bookingSlotHintIso || '';
    await refreshBookingStartSlots(preferred);
  });
  bookingResourceSelect?.addEventListener('change', async () => {
    const preferred = bookingStartSelect?.value || state.bookingSlotHintIso || '';
    await refreshBookingStartSlots(preferred);
  });
  bookingDateInput?.addEventListener('change', async () => {
    const preferred = bookingStartSelect?.value || state.bookingSlotHintIso || '';
    await refreshBookingStartSlots(preferred);
  });
  bookingStartSelect?.addEventListener('change', (e) => {
    state.bookingSlotHintIso = e.target.value || '';
  });
  bookingVoucherValidateBtn?.addEventListener('click', async () => {
    await validateVoucherForBookingModal();
  });
  bookingVoucherCodeInput?.addEventListener('input', (e) => {
    const value = String(e.target.value || '').trim();
    if (!value) {
      resetBookingVoucherLink();
      return;
    }
    if (value !== state.bookingVoucherCode) {
      state.bookingVoucherId = '';
      state.bookingVoucherCode = value;
      state.bookingVoucherState = '';
      setBookingVoucherStatus('');
    }
  });
  bookingVoucherCodeInput?.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    await validateVoucherForBookingModal();
  });

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
    if (e.key === 'Escape' && serviceModal?.classList.contains('open')) {
      closeServiceModal();
    }
    if (e.key === 'Escape' && resourceModal?.classList.contains('open')) {
      closeResourceModal();
    }
    if (e.key === 'Escape' && bookingModal?.classList.contains('open')) {
      closeBookingModal();
    }
    if (e.key === 'Escape' && importCsvModal?.classList.contains('open')) {
      closeImportCsvModal();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshSyncIndicator();
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
