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
        }
        isLoading = false
    }
    
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
            try await SupabaseManager.shared.client.auth.signOut()
            isAuthenticated = false
            currentUser = nil
            profile = nil
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
                }
            }
            
            print("[AuthViewModel] Apple Sign-In successful")
        } catch {
            self.error = error.localizedDescription
            print("[AuthViewModel] Apple Sign-In failed: \(error.localizedDescription)")
        }
    }
    
    func signInWithEmail(email: String, password: String) async {
        error = nil
        do {
            try await SupabaseManager.shared.client.auth.signIn(
                email: email,
                password: password
            )
            print("[AuthViewModel] Email sign-in successful")
        } catch {
            self.error = error.localizedDescription
            print("[AuthViewModel] Email sign-in failed: \(error.localizedDescription)")
        }
    }
    
    func signUpWithEmail(email: String, password: String) async {
        error = nil
        do {
            try await SupabaseManager.shared.client.auth.signUp(
                email: email,
                password: password
            )
            print("[AuthViewModel] Email sign-up successful")
        } catch {
            self.error = error.localizedDescription
            print("[AuthViewModel] Email sign-up failed: \(error.localizedDescription)")
        }
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
    
    deinit {
        authStateTask?.cancel()
    }
}
