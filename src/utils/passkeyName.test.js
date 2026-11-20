import { describe, expect, it } from 'vitest';

import { deviceTypeLabel, passkeyNameWithDevice } from './passkeyName.js';

describe('deviceTypeLabel', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15', 0, 'iPhone'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5, 'iPad'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0, 'Mac'],
    ['Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36', 5, 'Android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 0, 'Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', 0, 'Linux'],
    ['', 0, 'Web'],
  ])('reads %s as %s', (userAgent, maxTouchPoints, expected) => {
    expect(deviceTypeLabel({ userAgent, maxTouchPoints })).toBe(expected);
  });
});

describe('passkeyNameWithDevice', () => {
  it('appends the device type to the provider name', () => {
    expect(passkeyNameWithDevice('Apple Passwords', 'iPhone')).toBe('Apple Passwords (iPhone)');
  });

  it('falls back to "Passkey" when the server gave no name', () => {
    expect(passkeyNameWithDevice(undefined, 'Mac')).toBe('Passkey (Mac)');
  });

  it('keeps the result within the 120 character limit', () => {
    const name = passkeyNameWithDevice('x'.repeat(200), 'Windows');
    expect(name).toHaveLength(120);
    expect(name.endsWith(' (Windows)')).toBe(true);
  });
});
