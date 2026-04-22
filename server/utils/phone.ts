export const normalizeTaiwanMobilePhone = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const digits = value.replace(/\D/g, '');

  if (/^09\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^8869\d{8}$/.test(digits)) {
    return `0${digits.slice(3)}`;
  }

  return null;
};
