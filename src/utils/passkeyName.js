const MAX_NAME_LENGTH = 120;

/**
 * Names the kind of device the browser is running on, for labelling a passkey.
 * @param {{ userAgent?: string, maxTouchPoints?: number }} [nav] - Defaults to the browser's `navigator`
 * @returns {string} e.g. 'iPhone', 'Mac', 'Windows', or 'Web' when unknown
 */
export const deviceTypeLabel = (nav = globalThis.navigator ?? {}) => {
  const userAgent = nav.userAgent ?? '';
  if (/iPhone|iPod/.test(userAgent)) return 'iPhone';
  // iPadOS Safari identifies itself as a Mac; touch support tells them apart.
  if (/iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && (nav.maxTouchPoints ?? 0) > 1)) return 'iPad';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Macintosh/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/CrOS/.test(userAgent)) return 'Chromebook';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Web';
};

/**
 * Builds a passkey's default name: where it is stored, then the device type it
 * was added from, e.g. "Apple Passwords (iPhone)".
 * @param {string|undefined} providerName - The name the server assigned, if any
 * @param {string} deviceType
 * @returns {string}
 */
export const passkeyNameWithDevice = (providerName, deviceType) => {
  const suffix = ` (${deviceType})`;
  const base = (providerName?.trim() || 'Passkey').slice(0, MAX_NAME_LENGTH - suffix.length);
  return `${base}${suffix}`;
};
