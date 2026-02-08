// src/domain/availability.js
'use strict';

const NON_BLOCKING_STATUSES = new Set(['cancelled', 'canceled']);

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return toDateKey(date);
}

function normalizeDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return toDateKey(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return toDateKey(date);
  }
  return parseDateKey(value);
}

function parseTimeToMinutes(value) {
  const text = String(value || '').trim();
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function asPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeBreakIntervals(rule) {
  const breaks = Array.isArray(rule?.breaks) ? rule.breaks : parseJsonArray(rule?.breaksJson);
  const out = [];

  breaks.forEach((item) => {
    const start = parseTimeToMinutes(item?.startTime ?? item?.start);
    const end = parseTimeToMinutes(item?.endTime ?? item?.end);
    if (start === null || end === null || start >= end) return;
    out.push([start, end]);
  });

  const oneBreakStart = parseTimeToMinutes(rule?.breakStartTime ?? rule?.breakStart);
  const oneBreakEnd = parseTimeToMinutes(rule?.breakEndTime ?? rule?.breakEnd);
  if (oneBreakStart !== null && oneBreakEnd !== null && oneBreakStart < oneBreakEnd) {
    out.push([oneBreakStart, oneBreakEnd]);
  }

  return mergeIntervals(out);
}

function mergeIntervals(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];
  const sorted = intervals
    .filter((item) => Array.isArray(item) && item.length === 2 && Number.isFinite(item[0]) && Number.isFinite(item[1]) && item[1] > item[0])
    .map((item) => [item[0], item[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (!sorted.length) return [];

  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

function subtractIntervals(baseIntervals, excludeIntervals) {
  const base = mergeIntervals(baseIntervals);
  const excludes = mergeIntervals(excludeIntervals);
  if (!base.length || !excludes.length) return base;

  const out = [];
  base.forEach(([baseStart, baseEnd]) => {
    let cursor = baseStart;
    excludes.forEach(([exStart, exEnd]) => {
      if (exEnd <= cursor || exStart >= baseEnd) return;
      if (exStart > cursor) out.push([cursor, Math.min(exStart, baseEnd)]);
      cursor = Math.max(cursor, exEnd);
    });
    if (cursor < baseEnd) out.push([cursor, baseEnd]);
  });
  return out;
}

function dateKeyToDate(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return null;
  const parts = parsed.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays(dateKey, delta) {
  const date = dateKeyToDate(dateKey);
  if (!date) return null;
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

function dateKeyAt(dateRange, key, fallback = '') {
  if (!dateRange || typeof dateRange !== 'object') return fallback;
  return normalizeDateKey(dateRange[key]) || fallback;
}

function normalizeDateRange(dateRange) {
  if (!dateRange) return { from: '', to: '' };
  if (Array.isArray(dateRange) && dateRange.length >= 2) {
    const from = normalizeDateKey(dateRange[0]) || '';
    const to = normalizeDateKey(dateRange[1]) || '';
    return { from, to };
  }
  if (typeof dateRange === 'object') {
    const from =
      dateKeyAt(dateRange, 'from') ||
      dateKeyAt(dateRange, 'start') ||
      dateKeyAt(dateRange, 'startDate') ||
      '';
    const to =
      dateKeyAt(dateRange, 'to') ||
      dateKeyAt(dateRange, 'end') ||
      dateKeyAt(dateRange, 'endDate') ||
      '';
    return { from, to };
  }
  const single = normalizeDateKey(dateRange) || '';
  return { from: single, to: single };
}

function dateAtMinutes(dateKey, minutes) {
  const parts = String(dateKey).split('-').map((part) => Number.parseInt(part, 10));
  const totalMinutes = Math.max(0, Number(minutes) || 0);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return new Date(parts[0], parts[1] - 1, parts[2], h, m, 0, 0);
}

function timestampForCompare(value) {
  return String(value?.updatedAt || value?.createdAt || '').trim();
}

function isNewerEntry(candidate, current) {
  const candidateStamp = timestampForCompare(candidate);
  const currentStamp = timestampForCompare(current);
  if (!candidateStamp) return false;
  if (!currentStamp) return true;
  return candidateStamp > currentStamp;
}

function buildExceptionByDate(exceptions) {
  const byDate = new Map();
  (Array.isArray(exceptions) ? exceptions : []).forEach((ex) => {
    if (ex?.deletedAt) return;
    const date = normalizeDateKey(ex?.date);
    if (!date) return;
    const current = byDate.get(date);
    if (!current) {
      byDate.set(date, ex);
      return;
    }
    if (isNewerEntry(ex, current)) byDate.set(date, ex);
  });
  return byDate;
}

function windowsFromRules(rules, weekday) {
  const windows = [];
  (Array.isArray(rules) ? rules : []).forEach((rule) => {
    if (rule?.deletedAt) return;
    const ruleDay = Number.parseInt(rule?.weekday, 10);
    if (!Number.isInteger(ruleDay) || ruleDay !== weekday) return;
    const start = parseTimeToMinutes(rule?.startTime);
    const end = parseTimeToMinutes(rule?.endTime);
    if (start === null || end === null || start >= end) return;
    const breaks = normalizeBreakIntervals(rule).map(([bStart, bEnd]) => [
      Math.max(start, bStart),
      Math.min(end, bEnd)
    ]);
    const working = subtractIntervals([[start, end]], breaks);
    working.forEach(([s, e]) => {
      if (e > s) windows.push([s, e]);
    });
  });
  return mergeIntervals(windows);
}

function windowsFromException(exception) {
  if (!exception || exception.deletedAt) return null;
  if (Number(exception.isOff) === 1) return [];
  const start = parseTimeToMinutes(exception.startTime);
  const end = parseTimeToMinutes(exception.endTime);
  if (start === null || end === null || start >= end) return [];
  return [[start, end]];
}

function shouldBlockBooking(booking) {
  if (!booking || booking.deletedAt) return false;
  const status = String(booking.status || '').trim().toLowerCase();
  if (NON_BLOCKING_STATUSES.has(status)) return false;
  return true;
}

function buildBlockedByDate(bookings) {
  const blocked = new Map();
  const pushInterval = (dateKey, startMin, endMin) => {
    if (endMin <= startMin) return;
    const list = blocked.get(dateKey) || [];
    list.push([startMin, endMin]);
    blocked.set(dateKey, list);
  };

  (Array.isArray(bookings) ? bookings : []).forEach((booking) => {
    if (!shouldBlockBooking(booking)) return;
    const start = new Date(booking.startAt);
    const end = new Date(booking.endAt);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return;
    if (end <= start) return;

    const firstDate = toDateKey(start);
    const lastDate = toDateKey(end);
    let cursor = firstDate;
    while (cursor) {
      const dayStart = dateAtMinutes(cursor, 0).getTime();
      const dayEnd = dateAtMinutes(cursor, 24 * 60).getTime();
      const clipStart = Math.max(start.getTime(), dayStart);
      const clipEnd = Math.min(end.getTime(), dayEnd);
      if (clipEnd > clipStart) {
        const startMin = (clipStart - dayStart) / 60000;
        const endMin = (clipEnd - dayStart) / 60000;
        pushInterval(cursor, startMin, endMin);
      }
      if (cursor === lastDate) break;
      cursor = addDays(cursor, 1);
    }
  });

  const merged = new Map();
  blocked.forEach((intervals, dateKey) => {
    merged.set(dateKey, mergeIntervals(intervals));
  });
  return merged;
}

function overlapsAny(startMin, endMin, intervals) {
  for (let i = 0; i < intervals.length; i += 1) {
    const [aStart, aEnd] = intervals[i];
    if (endMin > aStart && startMin < aEnd) return true;
    if (aStart >= endMin) break;
  }
  return false;
}

function computeAvailableSlots({
  rules = [],
  exceptions = [],
  bookings = [],
  serviceDurationMin,
  dateRange,
  slotStepMin = 15,
  includeEndAt = false
} = {}) {
  const durationMin = asPositiveInt(serviceDurationMin, 0);
  if (!durationMin) return [];
  const stepMin = asPositiveInt(slotStepMin, 15);
  const { from, to } = normalizeDateRange(dateRange);
  if (!from || !to) return [];
  if (from > to) return [];

  const exceptionByDate = buildExceptionByDate(exceptions);
  const blockedByDate = buildBlockedByDate(bookings);
  const slots = [];
  let dateKey = from;

  while (dateKey && dateKey <= to) {
    const dayDate = dateKeyToDate(dateKey);
    if (!dayDate) break;
    const weekday = dayDate.getDay();
    const exception = exceptionByDate.get(dateKey);
    const dayWindows = exception ? windowsFromException(exception) : windowsFromRules(rules, weekday);
    const blockedIntervals = blockedByDate.get(dateKey) || [];

    (dayWindows || []).forEach(([windowStart, windowEnd]) => {
      let slotStart = windowStart;
      while (slotStart + durationMin <= windowEnd) {
        const slotEnd = slotStart + durationMin;
        if (!overlapsAny(slotStart, slotEnd, blockedIntervals)) {
          const startAt = dateAtMinutes(dateKey, slotStart).toISOString();
          if (includeEndAt) {
            slots.push({
              startAt,
              endAt: dateAtMinutes(dateKey, slotEnd).toISOString()
            });
          } else {
            slots.push(startAt);
          }
        }
        slotStart += stepMin;
      }
    });

    dateKey = addDays(dateKey, 1);
  }

  return slots;
}

function toLocalMinuteKey(isoText) {
  const date = new Date(isoText);
  return `${toDateKey(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function selfCheckAvailabilityEngine() {
  const rules = [
    { weekday: 1, startTime: '09:00', endTime: '17:00', breaks: [{ startTime: '12:00', endTime: '13:00' }] },
    { weekday: 2, startTime: '09:00', endTime: '17:00', breaksJson: '[{"startTime":"12:00","endTime":"13:00"}]' }
  ];

  const exceptions = [
    { date: '2026-02-10', isOff: 1, createdAt: '2026-02-01T09:00:00.000Z', updatedAt: '2026-02-01T09:00:00.000Z' },
    { date: '2026-02-10', isOff: 0, startTime: '14:00', endTime: '16:00', createdAt: '2026-02-02T09:00:00.000Z', updatedAt: '2026-02-02T09:00:00.000Z' }
  ];

  const bookings = [
    { startAt: '2026-02-09T10:00:00', endAt: '2026-02-09T11:00:00', status: 'confirmed' },
    { startAt: '2026-02-09T11:00:00', endAt: '2026-02-09T12:00:00', status: 'cancelled' },
    { startAt: '2026-02-10T15:00:00', endAt: '2026-02-10T16:00:00', status: 'confirmed' },
    { startAt: '2026-02-10T14:00:00', endAt: '2026-02-10T15:00:00', status: 'confirmed', deletedAt: '2026-02-01T00:00:00.000Z' }
  ];

  const slots = computeAvailableSlots({
    rules,
    exceptions,
    bookings,
    serviceDurationMin: 60,
    slotStepMin: 60,
    dateRange: { from: '2026-02-09', to: '2026-02-10' }
  });
  const localKeys = slots.map(toLocalMinuteKey);
  const expected = [
    '2026-02-09 09:00',
    '2026-02-09 11:00',
    '2026-02-09 13:00',
    '2026-02-09 14:00',
    '2026-02-09 15:00',
    '2026-02-09 16:00',
    '2026-02-10 14:00'
  ];

  const missing = expected.filter((item) => !localKeys.includes(item));
  const unexpected = localKeys.filter((item) => !expected.includes(item));

  const withEndAt = computeAvailableSlots({
    rules,
    exceptions,
    bookings,
    serviceDurationMin: 60,
    slotStepMin: 60,
    dateRange: { from: '2026-02-09', to: '2026-02-10' },
    includeEndAt: true
  });

  const errors = [];
  if (missing.length) errors.push(`Missing slots: ${missing.join(', ')}`);
  if (unexpected.length) errors.push(`Unexpected slots: ${unexpected.join(', ')}`);
  if (!withEndAt.length || typeof withEndAt[0] !== 'object' || !withEndAt[0].startAt || !withEndAt[0].endAt) {
    errors.push('includeEndAt mode did not produce {startAt,endAt} objects');
  }

  return {
    ok: errors.length === 0,
    errors,
    slotCount: slots.length,
    sample: withEndAt.slice(0, 3)
  };
}

module.exports = {
  computeAvailableSlots,
  selfCheckAvailabilityEngine
};
