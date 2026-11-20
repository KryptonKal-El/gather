import AuthenticationServices
import UIKit

/// Asks the user to confirm with Sign in with Apple and returns a fresh
/// authorization code, which the server needs to revoke their Apple tokens
/// when the account is deleted.
@MainActor
final class AppleReauthorizationService: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    enum Outcome {
        case code(String)
        case cancelled
        case unavailable
    }

    private var continuation: CheckedContinuation<Outcome, Never>?
    private var anchor: ASPresentationAnchor?

    /// Presents Apple's confirmation sheet.
    /// - Returns: `.cancelled` when the user backed out, `.unavailable` when no code could be obtained.
    func requestAuthorizationCode() async -> Outcome {
        guard let window = Self.keyWindow() else { return .unavailable }
        anchor = window

        let request = ASAuthorizationAppleIDProvider().createRequest()
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self

        return await withCheckedContinuation { continuation in
            self.continuation = continuation
            controller.performRequests()
        }
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        anchor ?? ASPresentationAnchor()
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let codeData = credential.authorizationCode,
              let code = String(data: codeData, encoding: .utf8) else {
            finish(.unavailable)
            return
        }
        finish(.code(code))
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if (error as? ASAuthorizationError)?.code == .canceled {
            finish(.cancelled)
        } else {
            print("[AppleReauthorizationService] Authorization failed: \(error.localizedDescription)")
            finish(.unavailable)
        }
    }

    private func finish(_ outcome: Outcome) {
        continuation?.resume(returning: outcome)
        continuation = nil
    }

    private static func keyWindow() -> UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
    }
}
