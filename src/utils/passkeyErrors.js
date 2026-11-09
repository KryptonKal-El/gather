/**
 * Helpers for interpreting errors from Supabase passkey (WebAuthn) calls.
 */

const CANCELLED_CODES = new Set(['ERROR_CEREMONY_ABORTED']);

/**
 * Whether the error means the user dismissed the passkey prompt.
 * Browsers report a dismissed prompt as a NotAllowedError, which supabase-js
 * wraps in a WebAuthnError with the original error as `cause`.
 * @param {unknown} error
 * @returns {boolean}
 */
export const isPasskeyCancelled = (error) => {
  if (!error) return false;
  if (CANCELLED_CODES.has(error.code)) return true;
  return error.name === 'NotAllowedError' || error.cause?.name === 'NotAllowedError';
};

/**
 * Maps a passkey error to a message suitable for showing the user.
 * @param {unknown} error
 * @returns {string}
 */
export const passkeyErrorMessage = (error) => {
  switch (error?.code) {
    case 'passkey_disabled':
      return 'Passkeys are not available right now. Please use another sign-in method.';
    case 'webauthn_credential_not_found':
      return 'That passkey is no longer linked to a Gather account.';
    case 'webauthn_credential_exists':
    case 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED':
      return 'This device already has a passkey for your account.';
    case 'too_many_passkeys':
      return 'You have reached the maximum number of passkeys. Remove one to add another.';
    case 'webauthn_challenge_expired':
    case 'webauthn_challenge_not_found':
      return 'The passkey request timed out. Please try again.';
    case 'webauthn_verification_failed':
      return "Your passkey couldn't be verified. If you use a third-party password manager, try saving the passkey to iCloud Keychain or Google Password Manager instead.";
    case 'email_not_confirmed':
      return 'Please confirm your email address before using a passkey.';
    case 'user_banned':
      return 'This account has been disabled.';
    default:
      return 'Passkey sign-in failed. Please try again.';
  }
};

/**
 * Whether the current browser can perform WebAuthn ceremonies.
 * @returns {boolean}
 */
export const isPasskeySupported = () =>
  typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function';
