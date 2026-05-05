const trimValue = (value: string | undefined | null) => value?.trim() ?? '';

export const normalizeTaiwanMobilePhoneInput = (value: string | null | undefined) => {
  const digitsOnly = trimValue(value).replaceAll(/\D/g, '');

  if (!digitsOnly) {
    return null;
  }

  if (/^09\d{8}$/.test(digitsOnly)) {
    return digitsOnly;
  }

  if (/^8869\d{8}$/.test(digitsOnly)) {
    return `0${digitsOnly.slice(3)}`;
  }

  return null;
};
