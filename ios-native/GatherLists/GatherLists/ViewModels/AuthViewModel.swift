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
    var error: String?
    
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
                case .signedOut:
                    isAuthenticated = false
                    currentUser = nil
                case .initialSession:
                    if let session {
                        isAuthenticated = true
                        currentUser = session.user
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
    
    deinit {
        authStateTask?.cancel()
    }
}
