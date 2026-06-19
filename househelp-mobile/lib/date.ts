const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function validDate(value?: string | Date | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateOnlyParts(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? { day: match[3], month: match[2], year: match[1] } : null;
}

function vietnamDateParts(value?: string | Date | null) {
  if (typeof value === 'string') {
    const exactDate = dateOnlyParts(value);
    if (exactDate) return exactDate;
  }

  const parsed = validDate(value);
  if (!parsed) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(parsed);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';

  return {
    day: valueFor('day'),
    month: valueFor('month'),
    year: valueFor('year'),
  };
}

export function formatVietnamDate(value?: string | Date | null, fallback = 'Chưa có ngày') {
  const parts = vietnamDateParts(value);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : fallback;
}

export function formatVietnamDateTime(value?: string | Date | null, fallback = 'Chưa có thời gian') {
  const parsed = validDate(value);
  if (!parsed) return fallback;

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
  }).format(parsed);
}

export function toVietnamDateInput(value?: string | Date | null) {
  const parts = vietnamDateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : undefined;
}
