// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('voucherAPI', {
  getTemplates: () => ipcRenderer.invoke('get-templates'),
  getTemplatesDetailed: () => ipcRenderer.invoke('get-templates-detailed'),
  getTemplate: (templateId) => ipcRenderer.invoke('get-template', templateId),
  getLayout: (templateId) => ipcRenderer.invoke('get-layout', templateId),
  saveLayout: (templateId, layout) => ipcRenderer.invoke('save-layout', { templateId, layout }),
  exportPdf: (voucherData, templateId, images) => ipcRenderer.invoke('export-pdf', { data: voucherData, templateId, images }),
  exportPng: (voucherData, templateId, images) => ipcRenderer.invoke('export-png', { data: voucherData, templateId, images }),
  saveVoucher: (voucherData, templateId) => ipcRenderer.invoke('save-voucher', { data: voucherData, templateId }),
  listVouchers: (limit) => ipcRenderer.invoke('list-vouchers', limit),
  getVoucher: (id) => ipcRenderer.invoke('get-voucher', id),
  generateCode: () => ipcRenderer.invoke('generate-code'),
  getQr: (code) => ipcRenderer.invoke('get-qr', code),
  validateCode: (code) => ipcRenderer.invoke('validate-code', code),
  redeemVoucher: (id) => ipcRenderer.invoke('redeem-voucher', id)
});

contextBridge.exposeInMainWorld('api', {
  templates: {
    list: () => ipcRenderer.invoke('tpl:list'),
    readMeta: (id) => ipcRenderer.invoke('tpl:readMeta', id),
    readLayout: (id) => ipcRenderer.invoke('tpl:readLayout', id),
    saveLayout: (id, layout) => ipcRenderer.invoke('tpl:saveLayout', id, layout),
    create: (meta) => ipcRenderer.invoke('tpl:create', meta),
    duplicate: (sourceId, newId, newName) => ipcRenderer.invoke('tpl:duplicate', sourceId, newId, newName),
    saveMeta: (id, meta) => ipcRenderer.invoke('tpl:saveMeta', id, meta),
    saveAll: (id, meta, layout) => ipcRenderer.invoke('tpl:saveAll', id, meta, layout),
    setBackground: (id) => ipcRenderer.invoke('tpl:setBackground', id),
    setLogo: (id) => ipcRenderer.invoke('tpl:setLogo', id),
    addSticker: (id) => ipcRenderer.invoke('tpl:addSticker', id)
  },
  vouchers: {
    list: (limit = 30, searchText = '') => ipcRenderer.invoke('vouchers:list', limit, searchText),
    get: (id) => ipcRenderer.invoke('vouchers:get', id),
    save: (voucher) => ipcRenderer.invoke('vouchers:save', voucher),
    delete: (id) => ipcRenderer.invoke('vouchers:delete', id),
    duplicate: (id) => ipcRenderer.invoke('vouchers:duplicate', id),
    pickImage: (voucherId, imageKey) => ipcRenderer.invoke('vouchers:pickImage', voucherId, imageKey),
    clearImage: (voucherId, imageKey) => ipcRenderer.invoke('vouchers:clearImage', voucherId, imageKey),
    clearAll: () => ipcRenderer.invoke('vouchers:clearAll'),
    exportCsv: () => ipcRenderer.invoke('vouchers:exportCsv'),
    validateCode: (code) => ipcRenderer.invoke('vouchers:validateCode', code)
  },
  services: {
    list: (limit = 200, searchText = '') => ipcRenderer.invoke('services:list', limit, searchText),
    get: (id) => ipcRenderer.invoke('services:get', id),
    save: (service) => ipcRenderer.invoke('services:save', service),
    delete: (id) => ipcRenderer.invoke('services:delete', id)
  },
  resources: {
    list: (limit = 200, searchText = '') => ipcRenderer.invoke('resources:list', limit, searchText),
    get: (id) => ipcRenderer.invoke('resources:get', id),
    save: (resource) => ipcRenderer.invoke('resources:save', resource),
    delete: (id) => ipcRenderer.invoke('resources:delete', id),
    getServices: (resourceId) => ipcRenderer.invoke('resources:getServices', resourceId),
    setServices: (resourceId, serviceIds) => ipcRenderer.invoke('resources:setServices', resourceId, serviceIds)
  },
  availability: {
    listRules: (resourceId) => ipcRenderer.invoke('availability:listRules', resourceId),
    saveRule: (rule) => ipcRenderer.invoke('availability:saveRule', rule),
    deleteRule: (id) => ipcRenderer.invoke('availability:deleteRule', id),
    listExceptions: (resourceId, from, to) => ipcRenderer.invoke('availability:listExceptions', resourceId, from, to),
    saveException: (ex) => ipcRenderer.invoke('availability:saveException', ex),
    deleteException: (id) => ipcRenderer.invoke('availability:deleteException', id)
  },
  customers: {
    list: (limit = 200, searchText = '') => ipcRenderer.invoke('customers:list', limit, searchText),
    get: (id) => ipcRenderer.invoke('customers:get', id),
    save: (customer) => ipcRenderer.invoke('customers:save', customer),
    delete: (id) => ipcRenderer.invoke('customers:delete', id)
  },
  bookings: {
    list: (range = {}, resourceIds = []) => ipcRenderer.invoke('bookings:list', range, resourceIds),
    get: (id) => ipcRenderer.invoke('bookings:get', id),
    save: (booking) => ipcRenderer.invoke('bookings:save', booking),
    delete: (id) => ipcRenderer.invoke('bookings:delete', id),
    computeSlots: (payload) => ipcRenderer.invoke('bookings:computeSlots', payload)
  },
  sync: {
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    listOutbox: (limit = 200) => ipcRenderer.invoke('sync:listOutbox', limit),
    clearErrors: () => ipcRenderer.invoke('sync:clearErrors'),
    run: () => ipcRenderer.invoke('sync:run')
  },
  values: {
    list: () => ipcRenderer.invoke('values:list'),
    add: (value) => ipcRenderer.invoke('values:add', value),
    delete: (value) => ipcRenderer.invoke('values:delete', value)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (payload) => ipcRenderer.invoke('settings:set', payload)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  }
});
