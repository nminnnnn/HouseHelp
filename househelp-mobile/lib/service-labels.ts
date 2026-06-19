import type { AppLanguage } from './storage';

const englishLabels: Record<string, string> = {
  'Chăm sóc người già': 'Elder care',
  'Chăm sóc trẻ em': 'Child care',
  'Dọn dẹp': 'Cleaning',
  'Dọn dẹp nhà cửa': 'Home cleaning',
  'Giặt ủi': 'Laundry',
  'Giặt ủi quần áo': 'Laundry',
  'Làm vườn': 'Gardening',
  'Nấu ăn': 'Cooking',
  'Vệ sinh công nghiệp': 'Industrial cleaning',
  'Vệ sinh nhà cửa': 'Home cleaning',
};

export function serviceLabel(value: string, language: AppLanguage) {
  const service = String(value || '').trim();
  if (!service || language !== 'en') return service;

  const monthly = /\s+monthly$/i.test(service);
  const base = service.replace(/\s+monthly$/i, '');
  return `${englishLabels[base] || base}${monthly ? ' monthly' : ''}`;
}

export function serviceListLabel(value: string | undefined, language: AppLanguage, fallback = 'House cleaning') {
  if (!value) return fallback;
  return value.split(',').map((item) => serviceLabel(item, language)).join(', ');
}
