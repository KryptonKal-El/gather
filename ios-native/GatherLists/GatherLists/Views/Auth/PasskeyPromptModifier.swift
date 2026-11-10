import SwiftUI

/// Shows a one-time suggestion for email sign-in users to add a passkey.
/// Skipped once dismissed (per user), once a passkey exists, or while passkeys
/// are off for the project.
struct PasskeyPromptModifier: ViewModifier {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(ToastController.self) private var toastController
    @State private var isPresented = false
    @State private var errorMessage: String?

    func body(content: Content) -> some View {
        content
            .task(id: authViewModel.currentUser?.id) { await checkEligibility() }
            .alert("Sign in faster next time", isPresented: $isPresented) {
                Button("Not Now", role: .cancel) { markDismissed() }
                Button("Add Passkey") { Task { await addPasskey() } }
            } message: {
                Text("Add a passkey to sign in with Face ID, Touch ID, or your device passcode.")
            }
            .alert(
                "Couldn’t Add Passkey",
                isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
    }

    private var dismissedKey: String? {
        authViewModel.currentUser.map { "gather.passkeyPromptDismissed.\($0.id.uuidString)" }
    }

    private func checkEligibility() async {
        guard let dismissedKey,
              authViewModel.usesEmailSignIn,
              !UserDefaults.standard.bool(forKey: dismissedKey) else { return }
        do {
            if try await PasskeyService.list().isEmpty {
                isPresented = true
            }
        } catch {
            if !PasskeyService.isDisabledOnServer(error) {
                print("[PasskeyPrompt] could not check passkeys: \(error)")
            }
        }
    }

    private func markDismissed() {
        guard let dismissedKey else { return }
        UserDefaults.standard.set(true, forKey: dismissedKey)
    }

    private func addPasskey() async {
        markDismissed()
        do {
            try await PasskeyService.register()
            toastController.show("Passkey added")
        } catch {
            if !PasskeyService.isCancelled(error) {
                errorMessage = PasskeyService.message(for: error)
            }
        }
    }
}

extension View {
    /// Offers email sign-in users a one-time prompt to add a passkey.
    func passkeyPrompt() -> some View {
        modifier(PasskeyPromptModifier())
    }
}
