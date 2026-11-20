import Foundation
import Observation
import Supabase
import Auth

/// Manages authentication state and session persistence.
@Observable
@MainActor
final class AuthViewModel {
    var isLoading = true
    var isAuthenticated = false
    var currentUser: User?
    var profile: Profile?
    var error: String?
    var notificationService: NotificationService?
    
    var displayName: String {
        profile?.displayName
            ?? currentUser?.userMetadata["full_name"]?.stringValue
            ?? "User"
    }
    
    var avatarUrl: String? {
        profile?.avatarUrl ?? currentUser?.userMetadata["avatar_url"]?.stringValue
    }
    
    var email: String? {
        currentUser?.email
    }
    
    nonisolated(unsafe) private var authStateTask: Task<Void, Never>?
    
    init() {
        Task {
            await checkSession()
        }
        listenToAuthChanges()
    }
    
    func checkSession() async {
        isLoading = true
        do {
            let session = try await SupabaseManager.shared.client.auth.session
            isAuthenticated = true
            currentUser = session.user
            print("[AuthViewModel] Existing session found for user: \(session.user.id)")
            Task { await fetchProfile() }
        } catch {
            isAuthenticated = false
            currentUser = nil
            print("[AuthViewModel] No existing session: \(error.localizedDescription)")
            #if DEBUG
            await signInForUITestsIfRequested()
            #endif
        }
        isLoading = false
    }

    #if DEBUG
    /// UI tests can't receive an emailed code, so debug builds sign in with the
    /// test account's password when the test runner passes one. The server still
    /// accepts passwords; only the app's sign-in screen dropped them.
    private func signInForUITestsIfRequested() async {
        let environment = ProcessInfo.processInfo.environment
        guard let email = environment["TEST_USER_EMAIL"],
              let password = environment["TEST_USER_PASSWORD"] else { return }
        do {
            try await SupabaseManager.shared.client.auth.signIn(email: email, password: password)
            print("[AuthViewModel] Signed in the UI test account")
        } catch {
            print("[AuthViewModel] UI test sign-in failed: \(error)")
        }
    }
    #endif
    
    func listenToAuthChanges() {
        authStateTask = Task {
            for await (event, session) in SupabaseManager.shared.client.auth.authStateChanges {
                print("[AuthViewModel] Auth state changed: \(event)")
                switch event {
                case .signedIn, .tokenRefreshed, .userUpdated:
                    isAuthenticated = true
                    currentUser = session?.user
                    Task { await fetchProfile() }
                case .signedOut:
                    isAuthenticated = false
                    currentUser = nil
                    profile = nil
                case .initialSession:
                    if let session {
                        isAuthenticated = true
                        currentUser = session.user
                        Task { await fetchProfile() }
                    } else {
                        isAuthenticated = false
                        currentUser = nil
                    }
                    isLoading = false
                default:
                    break
                }
            }
        }
    }
    
    func signOut() async {
        do {
            await notificationService?.cleanupOnSignOut()
            try await SupabaseManager.shared.client.auth.signOut()
            isAuthenticated = false
            currentUser = nil
            profile = nil
            
            // Clear shared container data for widgets
            SharedDefaults.clearAuthSession()
            await SharedDataStore.shared.clearAll()
            
            print("[AuthViewModel] User signed out successfully")
        } catch {
            self.error = error.localizedDescription
            print("[AuthViewModel] Sign out failed: \(error.localizedDescription)")
        }
    }
    
    /// Permanently deletes the account on the server, then clears the local session.
    /// - Returns: `true` when the account was deleted.
    func deleteAccount() async -> Bool {
        do {
            let manager = SupabaseManager.shared
            let session = try await manager.client.auth.session
            var request = URLRequest(
                url: manager.supabaseURL.appendingPathComponent("functions/v1/delete-account")
            )
            request.httpMethod = "POST"
            request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(["confirm": true])

            let (_, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(status) else {
                print("[AuthViewModel] Account deletion refused with status \(status)")
                return false
            }
        } catch {
            print("[AuthViewModel] Account deletion failed: \(error.localizedDescription)")
            return false
        }

        // The server session and device tokens are already gone with the account, so only the local one needs clearing.
        try? await SupabaseManager.shared.client.auth.signOut(scope: .local)
        isAuthenticated = false
        currentUser = nil
        profile = nil
        SharedDefaults.clearAuthSession()
        await SharedDataStore.shared.clearAll()
        return true
    }

    func signInWithApple(idToken: String, nonce: String, fullName: PersonNameComponents?) async {
        error = nil
        do {
            try await SupabaseManager.shared.client.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(
                    provider: .apple,
                    idToken: idToken,
                    nonce: nonce
                )
            )
            
            if fullName?.givenName != nil || fullName?.familyName != nil {
                let name = [fullName?.givenName, fullName?.familyName]
                    .compactMap { $0 }
                    .joined(separator: " ")
                if !name.isEmpty {
                    try await SupabaseManager.shared.client.auth.update(
                        user: UserAttributes(data: ["full_name": .string(name)])
                    )
                    if let userId = try? await SupabaseManager.shared.client.auth.session.user.id {
                        try? await ProfileService.updateDisplayName(userId: userId, name: name)
                    }
                }
            }
            
            print("[AuthViewModel] Apple Sign-In successful")
        } catch {
            self.error = error.localizedDescription
            print("[AuthViewModel] Apple Sign-In failed: \(error.localizedDescription)")
        }
    }
    
    /// Accounts that sign in with a fixed code, which the server stores as the account's
    /// password: the App Review demo account (reviewers can't receive an emailed code)
    /// and the e2e test account.
    static let fixedCodeAccountEmails: Set<String> = ["review@gatherlists.com", "e2e-test@gatherlists.com"]

    private static func normalized(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespaces).lowercased()
    }

    /// Whether `email` signs in with a fixed code instead of an emailed one.
    static func isReviewAccount(_ email: String) -> Bool {
        fixedCodeAccountEmails.contains(normalized(email))
    }

    /// Emails a one-time sign-in code, creating the account if the email is new.
    /// Fixed-code accounts get nothing sent.
    func sendEmailCode(to email: String) async throws {
        guard !Self.isReviewAccount(email) else { return }
        try await SupabaseManager.shared.client.auth.signInWithOTP(email: email, shouldCreateUser: true)
    }

    /// Signs in with a code from `sendEmailCode(to:)`.
    func verifyEmailCode(email: String, code: String) async throws {
        if Self.isReviewAccount(email) {
            try await SupabaseManager.shared.client.auth.signIn(email: Self.normalized(email), password: code)
            print("[AuthViewModel] Review account sign-in successful")
            return
        }
        try await SupabaseManager.shared.client.auth.verifyOTP(email: email, token: code, type: .email)
        print("[AuthViewModel] Email code sign-in successful")
    }

    /// Signs in with a saved passkey. A dismissed system sheet is not treated as an error.
    func signInWithPasskey() async {
        error = nil
        do {
            try await PasskeyService.signIn()
            print("[AuthViewModel] Passkey sign-in successful")
        } catch {
            if PasskeyService.isCancelled(error) { return }
            self.error = PasskeyService.message(for: error)
            print("[AuthViewModel] Passkey sign-in failed: \(error)")
        }
    }

    /// Whether the signed-in user signs in by email (code or legacy password),
    /// and so could benefit from adding a passkey.
    var usesEmailSignIn: Bool {
        currentUser?.identities?.contains { $0.provider == "email" } ?? false
    }

    /// Handle deep link URL for auth callbacks (OAuth, email confirmation).
    func handleDeepLink(url: URL) async {
        print("[AuthViewModel] Deep link received: \(url)")
        
        let urlString = url.absoluteString
        let isAuthCallback = urlString.contains("auth/callback") || urlString.contains("#access_token")
        
        guard isAuthCallback else {
            print("[AuthViewModel] URL is not an auth callback, ignoring: \(url)")
            return
        }
        
        do {
            try await SupabaseManager.shared.client.auth.session(from: url)
            print("[AuthViewModel] Session restored from deep link")
        } catch {
            print("[AuthViewModel] Failed to restore session from deep link: \(error.localizedDescription)")
        }
    }
    
    func refreshProfile() async {
        await fetchProfile()
    }
    
    private func fetchProfile() async {
        guard let userId = currentUser?.id else { return }
        do {
            profile = try await ProfileService.fetchProfile(userId: userId)
        } catch {
            print("[AuthViewModel] Failed to fetch profile: \(error.localizedDescription)")
        }
    }
    
    /// Updates image search settings, with optimistic updates and rollback on error.
    func updateImageSearchSettings(_ settings: ImageSearchSettings) async throws {
        guard let userId = currentUser?.id else { return }
        let previous = profile?.imageSearchSettings
        profile?.imageSearchSettings = settings
        do {
            try await ProfileService.updateImageSearchSettings(settings, userId: userId)
        } catch {
            profile?.imageSearchSettings = previous ?? ImageSearchSettings.defaultSettings
            throw error
        }
    }
    
    deinit {
        authStateTask?.cancel()
    }
}
