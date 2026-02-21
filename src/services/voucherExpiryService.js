const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value) {
  return String(value || '').trim();
}

function parseExpiryDate(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnlyMatch) {
    const year = Number.parseInt(dateOnlyMatch[1], 10);
    const month = Number.parseInt(dateOnlyMatch[2], 10);
    const day = Number.parseInt(dateOnlyMatch[3], 10);
    const utcMs = Date.UTC(year, month - 1, day);
    const date = new Date(utcMs);
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function toUtcEpochDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor(utcMidnight / DAY_MS);
}

function buildNotificationDedupKey(candidate, expiryDate) {
  const code = normalizeText(candidate?.code).toLowerCase();
  const id = normalizeText(candidate?.id).toLowerCase();
  const expiry = expiryDate.toISOString().slice(0, 10);
  if (code) return `code:${code}|expiry:${expiry}`;
  return `id:${id}|expiry:${expiry}`;
}

function createVoucherExpiryService(options = {}) {
  const {
    isEnabled = async () => true,
    getFileCandidates = async () => [],
    getDbCandidates = async () => [],
    markFileNotified = async () => false,
    markDbNotified = async () => false,
    notify = async () => {},
    nowProvider = () => new Date()
  } = options;

  async function checkExpiringVouchers() {
    const enabled = await Promise.resolve(isEnabled());
    if (!enabled) {
      return {
        ok: true,
        skipped: true,
        reason: 'disabled',
        checked: 0,
        due: 0,
        notified: 0,
        invalidDate: 0,
        failed: 0
      };
    }

    const todayEpoch = toUtcEpochDay(nowProvider());
    if (todayEpoch == null) {
      return {
        ok: false,
        error: 'Invalid current date',
        checked: 0,
        due: 0,
        notified: 0,
        invalidDate: 0,
        failed: 0
      };
    }

    const dedupe = new Set();
    const errors = [];
    let checked = 0;
    let due = 0;
    let notified = 0;
    let invalidDate = 0;
    let failed = 0;

    const processCandidate = async (candidate, markFn) => {
      checked += 1;
      const expiryDate = parseExpiryDate(candidate?.expiryDate);
      if (!expiryDate) {
        invalidDate += 1;
        return;
      }
      const expiryDay = toUtcEpochDay(expiryDate);
      if (expiryDay == null) {
        invalidDate += 1;
        return;
      }

      const daysUntilExpiry = expiryDay - todayEpoch;
      if (daysUntilExpiry < 0) return;
      if (daysUntilExpiry !== 10) return;

      due += 1;
      const dedupeKey = buildNotificationDedupKey(candidate, expiryDate);
      if (dedupe.has(dedupeKey)) return;

      const sentAt = new Date().toISOString();
      try {
        await Promise.resolve(
          notify({
            source: candidate?.source || '',
            id: normalizeText(candidate?.id),
            code: normalizeText(candidate?.code),
            expiryDate: expiryDate.toISOString().slice(0, 10),
            sentAt
          })
        );
        await Promise.resolve(markFn(candidate?.id, sentAt));
        dedupe.add(dedupeKey);
        notified += 1;
      } catch (err) {
        failed += 1;
        errors.push({
          id: normalizeText(candidate?.id),
          source: normalizeText(candidate?.source),
          error: err?.message || 'Notification failed'
        });
      }
    };

    const fileCandidates = await Promise.resolve(getFileCandidates());
    for (const candidate of Array.isArray(fileCandidates) ? fileCandidates : []) {
      await processCandidate(candidate, markFileNotified);
    }

    const dbCandidates = await Promise.resolve(getDbCandidates());
    for (const candidate of Array.isArray(dbCandidates) ? dbCandidates : []) {
      await processCandidate(candidate, markDbNotified);
    }

    return {
      ok: true,
      checked,
      due,
      notified,
      invalidDate,
      failed,
      errors
    };
  }

  return {
    checkExpiringVouchers
  };
}

module.exports = {
  createVoucherExpiryService,
  parseExpiryDate
};

