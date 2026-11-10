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
    
    /// Emails a one-time sign-in code, creating the account if the email is new.
    func sendEmailCode(to email: String) async throws {
        try await SupabaseManager.shared.client.auth.signInWithOTP(email: email, shouldCreateUser: true)
    }

    /// Signs in with a code from `sendEmailCode(to:)`.
    func verifyEmailCode(email: String, code: String) async throws {
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
