/**
 * Detect the user's likely currency from their locale.
 * Maps common locale regions to currencies.
 */
const getUserCurrency = () => {
  try {
    const locale = navigator.language || 'en-US';
    const region = locale.split('-')[1]?.toUpperCase() || 'US';
    const regionCurrencyMap = {
      US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD',
      EU: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', PT: 'EUR', AT: 'EUR', BE: 'EUR', FI: 'EUR', IE: 'EUR', GR: 'EUR',
      JP: 'JPY', CN: 'CNY', KR: 'KRW', IN: 'INR', BR: 'BRL', MX: 'MXN',
      CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK',
      ZA: 'ZAR', SG: 'SGD', HK: 'HKD', TW: 'TWD', TH: 'THB',
      AE: 'AED', SA: 'SAR', IL: 'ILS', TR: 'TRY', RU: 'RUB',
      AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN',
      PH: 'PHP', MY: 'MYR', ID: 'IDR', VN: 'VND',
      NG: 'NGN', KE: 'KES', EG: 'EGP', PK: 'PKR',
    };
    return regionCurrencyMap[region] || 'USD';
  } catch {
    return 'USD';
  }
};

/**
 * Format a numeric price value for display using the browser's locale.
 * Falls back to 'en-US' / 'USD' if locale detection fails.
 * @param {number} value - The numeric price value
 * @returns {string} Formatted price string with currency symbol
 */
export const formatPrice = (value) => {
  if (value == null || !Number.isFinite(value)) return '';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: getUserCurrency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
};

/**
 * Get the currency symbol for the user's locale.
 * @returns {string} Currency symbol (e.g., '$', '€', '£')
 */
export const getCurrencySymbol = () => {
  try {
    const currency = getUserCurrency();
    return new Intl.NumberFormat(undefined, { style: 'currency', currency })
      .formatToParts(0)
      .find(p => p.type === 'currency')?.value || '$';
  } catch {
    return '$';
  }
};
