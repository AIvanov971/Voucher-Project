(function () {
  const params = new URLSearchParams(window.location.search);

  const state = {
    orgId: params.get('org') || 'local',
    service: null,
    resource: null,
    slot: null,
    customer: null,
    booking: null,
    isSubmitting: false
  };

  const elements = {
    orgInput: document.getElementById('orgInput'),
    alert: document.getElementById('alert'),
    steps: Array.from(document.querySelectorAll('.step')),
    panels: {
      1: document.getElementById('step-1'),
      2: document.getElementById('step-2'),
      3: document.getElementById('step-3'),
      4: document.getElementById('step-4'),
      5: document.getElementById('step-5')
    },
    servicesList: document.getElementById('servicesList'),
    resourcesList: document.getElementById('resourcesList'),
    slotsList: document.getElementById('slotsList'),
    fromDateInput: document.getElementById('fromDateInput'),
    toDateInput: document.getElementById('toDateInput'),
    refreshSlotsBtn: document.getElementById('refreshSlotsBtn'),
    customerForm: document.getElementById('customerForm'),
    nameInput: document.getElementById('nameInput'),
    phoneInput: document.getElementById('phoneInput'),
    emailInput: document.getElementById('emailInput'),
    voucherInput: document.getElementById('voucherInput'),
    noteInput: document.getElementById('noteInput'),
    summary: document.getElementById('summary'),
    confirmBtn: document.getElementById('confirmBtn'),
    result: document.getElementById('result'),
    bookingRefText: document.getElementById('bookingRefText'),
    qrCanvas: document.getElementById('qrCanvas')
  };

  function setAlert(message, kind) {
    if (!message) {
      elements.alert.hidden = true;
      elements.alert.textContent = '';
      elements.alert.className = 'alert';
      return;
    }
    elements.alert.hidden = false;
    elements.alert.className = `alert ${kind || 'error'}`;
    elements.alert.textContent = message;
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.valueOf())) return iso;
    return date.toLocaleString();
  }

  function todayText() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function plusDays(dateText, days) {
    const date = new Date(`${dateText}T00:00:00.000Z`);
    if (Number.isNaN(date.valueOf())) return dateText;
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function showStep(stepNumber) {
    elements.steps.forEach((step) => {
      step.classList.toggle('active', Number(step.dataset.step) === stepNumber);
    });

    Object.keys(elements.panels).forEach((key) => {
      const panel = elements.panels[key];
      panel.hidden = Number(key) !== stepNumber;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function apiRequest(path, options) {
    const response = await fetch(path, {
      method: options && options.method ? options.method : 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      body: options && options.body ? JSON.stringify(options.body) : undefined
    });

    const data = await response.json().catch(function () {
      return { ok: false, error: 'Invalid server response' };
    });

    if (!response.ok || !data.ok) {
      const error = new Error((data && data.error) || 'Request failed');
      error.data = data;
      throw error;
    }

    return data;
  }

  function renderServices(services) {
    elements.servicesList.innerHTML = '';
    if (!services.length) {
      elements.servicesList.innerHTML = '<p class="muted">No services available.</p>';
      return;
    }

    services.forEach((service) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-card';
      const duration = Number(service.durationMin || 0);
      const price = Number(service.priceCents || 0) / 100;
      button.innerHTML = `
        <strong>${service.name}</strong>
        <span>${duration} min</span>
        <span>${price.toFixed(2)} ${service.currency || 'EUR'}</span>
      `;
      button.addEventListener('click', async function () {
        state.service = service;
        state.resource = null;
        state.slot = null;
        setAlert('');
        try {
          const resources = await loadResources();
          if (!resources.length) {
            setAlert('No resources found for selected service.', 'error');
            return;
          }
          showStep(2);
        } catch (error) {
          setAlert(error.message, 'error');
        }
      });
      elements.servicesList.appendChild(button);
    });
  }

  function renderResources(resources) {
    elements.resourcesList.innerHTML = '';

    const anyButton = document.createElement('button');
    anyButton.type = 'button';
    anyButton.className = 'choice-card';
    anyButton.innerHTML = '<strong>Any available</strong><span>Let the system pick one</span>';
    anyButton.addEventListener('click', async function () {
      state.resource = null;
      setAlert('');
      await loadSlots();
      showStep(3);
    });
    elements.resourcesList.appendChild(anyButton);

    resources.forEach((resource) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-card';
      button.innerHTML = `<strong>${resource.name}</strong><span>${resource.type || 'resource'}</span>`;
      button.addEventListener('click', async function () {
        state.resource = resource;
        setAlert('');
        await loadSlots();
        showStep(3);
      });
      elements.resourcesList.appendChild(button);
    });
  }

  function renderSlots(slots) {
    elements.slotsList.innerHTML = '';
    if (!slots.length) {
      elements.slotsList.innerHTML = '<p class="muted">No free slots in this range.</p>';
      return;
    }

    slots.forEach((slot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot-button';
      button.textContent = `${formatDateTime(slot.startAt)} (${slot.resourceId})`;
      button.addEventListener('click', function () {
        state.slot = slot;
        showStep(4);
      });
      elements.slotsList.appendChild(button);
    });
  }

  function buildSummary() {
    const resourceText = state.resource ? `${state.resource.name} (${state.resource.id})` : 'Any available';
    const customer = state.customer || {};
    elements.summary.innerHTML = `
      <div><strong>Service:</strong> ${state.service ? state.service.name : ''}</div>
      <div><strong>Resource:</strong> ${resourceText}</div>
      <div><strong>Start:</strong> ${state.slot ? formatDateTime(state.slot.startAt) : ''}</div>
      <div><strong>Name:</strong> ${customer.name || ''}</div>
      <div><strong>Phone:</strong> ${customer.phone || '-'}</div>
      <div><strong>Email:</strong> ${customer.email || '-'}</div>
      <div><strong>Voucher:</strong> ${customer.voucherCode || '-'}</div>
      <div><strong>Note:</strong> ${customer.note || '-'}</div>
    `;
  }

  async function loadServices() {
    const orgId = encodeURIComponent(state.orgId);
    const data = await apiRequest(`/public/${orgId}/services`);
    const services = Array.isArray(data.services) ? data.services : [];
    renderServices(services);
    return services;
  }

  async function loadResources() {
    if (!state.service) return [];
    const orgId = encodeURIComponent(state.orgId);
    const serviceId = encodeURIComponent(state.service.id);
    const data = await apiRequest(`/public/${orgId}/resources?serviceId=${serviceId}`);
    const resources = Array.isArray(data.resources) ? data.resources : [];
    renderResources(resources);
    return resources;
  }

  async function loadSlots() {
    if (!state.service) return [];

    const orgId = encodeURIComponent(state.orgId);
    const query = new URLSearchParams();
    query.set('serviceId', state.service.id);
    query.set('from', elements.fromDateInput.value);
    query.set('to', elements.toDateInput.value);
    if (state.resource && state.resource.id) {
      query.set('resourceId', state.resource.id);
    }

    const data = await apiRequest(`/public/${orgId}/availability?${query.toString()}`);
    const slots = Array.isArray(data.slots) ? data.slots : [];
    renderSlots(slots);
    return slots;
  }

  async function confirmBooking() {
    if (state.isSubmitting || !state.service || !state.slot || !state.customer) return;

    state.isSubmitting = true;
    elements.confirmBtn.disabled = true;
    setAlert('Creating booking...', 'info');

    try {
      const orgId = encodeURIComponent(state.orgId);
      const holdPayload = {
        serviceId: state.service.id,
        startAt: state.slot.startAt
      };
      if (state.resource && state.resource.id) {
        holdPayload.resourceId = state.resource.id;
      }

      const hold = await apiRequest(`/public/${orgId}/holds`, {
        method: 'POST',
        body: holdPayload
      });

      const booking = await apiRequest(`/public/${orgId}/bookings`, {
        method: 'POST',
        body: {
          holdId: hold.holdId,
          customer: {
            name: state.customer.name,
            phone: state.customer.phone,
            email: state.customer.email
          },
          note: state.customer.note,
          voucherCode: state.customer.voucherCode
        }
      });

      state.booking = booking;
      elements.bookingRefText.textContent = `Reference: ${booking.bookingId}`;
      elements.result.hidden = false;
      setAlert('Booking confirmed.', 'success');

      const qrPayload = JSON.stringify({
        bookingId: booking.bookingId,
        orgId: state.orgId,
        serviceId: booking.serviceId,
        resourceId: booking.resourceId,
        startAt: booking.startAt,
        endAt: booking.endAt
      });

      if (window.QRCode && typeof window.QRCode.toCanvas === 'function') {
        window.QRCode.toCanvas(elements.qrCanvas, qrPayload, {
          width: 220,
          margin: 1,
          color: {
            dark: '#111827',
            light: '#ffffff'
          }
        });
      } else {
        const ctx = elements.qrCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, elements.qrCanvas.width, elements.qrCanvas.height);
          ctx.fillStyle = '#111827';
          ctx.font = '14px sans-serif';
          ctx.fillText('QR library unavailable', 20, 110);
        }
      }
    } catch (error) {
      const detail = error && error.data && error.data.conflict ? ` (${JSON.stringify(error.data.conflict)})` : '';
      setAlert(`${error.message}${detail}`, 'error');
      elements.result.hidden = true;
    } finally {
      state.isSubmitting = false;
      elements.confirmBtn.disabled = false;
    }
  }

  function bindEvents() {
    elements.orgInput.addEventListener('change', async function () {
      const next = elements.orgInput.value.trim() || 'local';
      if (next === state.orgId) return;
      state.orgId = next;
      state.service = null;
      state.resource = null;
      state.slot = null;
      state.customer = null;
      state.booking = null;
      showStep(1);
      setAlert('');
      elements.result.hidden = true;
      await loadServices();
    });

    elements.refreshSlotsBtn.addEventListener('click', async function () {
      try {
        setAlert('');
        await loadSlots();
      } catch (error) {
        setAlert(error.message, 'error');
      }
    });

    elements.customerForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const name = elements.nameInput.value.trim();
      if (!name) {
        setAlert('Name is required.', 'error');
        return;
      }
      state.customer = {
        name,
        phone: elements.phoneInput.value.trim(),
        email: elements.emailInput.value.trim(),
        voucherCode: elements.voucherInput.value.trim(),
        note: elements.noteInput.value.trim()
      };
      buildSummary();
      setAlert('');
      elements.result.hidden = true;
      showStep(5);
    });

    elements.confirmBtn.addEventListener('click', confirmBooking);

    elements.steps.forEach((stepButton) => {
      stepButton.addEventListener('click', function () {
        const step = Number(stepButton.dataset.step);
        if (step < 1 || step > 5) return;
        if (step === 2 && !state.service) return;
        if (step === 3 && !state.service) return;
        if (step === 4 && !state.slot) return;
        if (step === 5 && !state.customer) return;
        showStep(step);
      });
    });
  }

  async function init() {
    const today = todayText();
    elements.fromDateInput.value = today;
    elements.toDateInput.value = plusDays(today, 6);
    elements.orgInput.value = state.orgId;
    bindEvents();

    try {
      await loadServices();
      showStep(1);
    } catch (error) {
      setAlert(error.message, 'error');
    }
  }

  init();
})();
