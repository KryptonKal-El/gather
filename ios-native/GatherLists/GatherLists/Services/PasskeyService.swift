import AuthenticationServices
import Foundation
@_spi(Experimental) import Supabase
import UIKit

/// Wraps Supabase Auth's passkey (WebAuthn) API: sign-in, registration, and
/// management of the signed-in user's passkeys.
@MainActor
enum PasskeyService {
    /// Signs in with a passkey saved on this device or synced via iCloud Keychain.
    static func signIn() async throws {
        try await SupabaseManager.shared.client.auth.signInWithPasskey(
            presentationAnchor: try presentationAnchor()
        )
    }

    /// Registers a new passkey for the signed-in user.
    @discardableResult
    static func register() async throws -> PasskeyListItem {
        try await SupabaseManager.shared.client.auth.registerPasskey(
            presentationAnchor: try presentationAnchor()
        )
    }

    /// Lists the signed-in user's passkeys, most recently added first.
    static func list() async throws -> [PasskeyListItem] {
        try await SupabaseManager.shared.client.auth.listPasskeys()
            .sorted { $0.createdAt > $1.createdAt }
    }

    /// Renames one of the signed-in user's passkeys (at most 120 characters).
    @discardableResult
    static func rename(id: UUID, to friendlyName: String) async throws -> PasskeyListItem {
        try await SupabaseManager.shared.client.auth.renamePasskey(id: id, friendlyName: friendlyName)
    }

    /// Removes one of the signed-in user's passkeys.
    static func delete(id: UUID) async throws {
        try await SupabaseManager.shared.client.auth.deletePasskey(id: id)
    }

    /// Whether the error means the user dismissed the system passkey sheet.
    nonisolated static func isCancelled(_ error: Error) -> Bool {
        (error as? ASAuthorizationError)?.code == .canceled
    }

    /// Whether the error means passkeys are switched off for the Supabase project.
    nonisolated static func isDisabledOnServer(_ error: Error) -> Bool {
        errorCode(error) == "passkey_disabled"
    }

    /// A message suitable for showing the user.
    nonisolated static func message(for error: Error) -> String {
        switch errorCode(error) {
        case "passkey_disabled":
            "Passkeys are not available right now. Please use another sign-in method."
        case "webauthn_credential_not_found":
            "That passkey is no longer linked to a Gather account."
        case "webauthn_credential_exists":
            "This device already has a passkey for your account."
        case "too_many_passkeys":
            "You have reached the maximum number of passkeys. Remove one to add another."
        case "webauthn_challenge_expired", "webauthn_challenge_not_found":
            "The passkey request timed out. Please try again."
        case "webauthn_verification_failed":
            "Your passkey couldn’t be verified. If you use a third-party password manager, try saving the passkey to iCloud Keychain instead."
        case "email_not_confirmed":
            "Please confirm your email address before using a passkey."
        case "user_banned":
            "This account has been disabled."
        default:
            isExcludedCredential(error)
                ? "This device already has a passkey for your account."
                : "Passkey sign-in failed. Please try again."
        }
    }

    private nonisolated static func isExcludedCredential(_ error: Error) -> Bool {
        guard #available(iOS 18.0, *) else { return false }
        return (error as? ASAuthorizationError)?.code == .matchedExcludedCredential
    }

    private nonisolated static func errorCode(_ error: Error) -> String? {
        (error as? AuthError)?.errorCode.rawValue
    }

    private static func presentationAnchor() throws -> ASPresentationAnchor {
        let windows = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
        guard let window = windows.first(where: \.isKeyWindow) ?? windows.first else {
            throw PasskeyServiceError.noWindow
        }
        return window
    }
}

/// Failures raised by `PasskeyService` before the system passkey sheet is shown.
enum PasskeyServiceError: LocalizedError {
    case noWindow

    var errorDescription: String? {
        switch self {
        case .noWindow: "Couldn’t show the passkey prompt."
        }
    }
}
