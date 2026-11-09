/**
 * Normalizes a user-entered product link. Adds https:// when no scheme is
 * given and rejects anything that is not http(s), so values like
 * `javascript:` never reach an href.
 * @param {string|null|undefined} raw - Text the user typed
 * @returns {string|null} A safe absolute URL, or null when empty/invalid
 */
export const normalizeItemUrl = (raw) => {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.includes('.')) return null;
    return parsed.href;
  } catch {
    return null;
  }
};

/**
 * Returns a short display label for a product link (its host without "www.").
 * @param {string} url - An absolute URL
 * @returns {string} Host name, or the raw value if it cannot be parsed
 */
export const getUrlHostLabel = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
