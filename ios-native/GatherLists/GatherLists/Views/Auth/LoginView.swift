import SwiftUI
import AuthenticationServices
import CryptoKit

struct LoginView: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var currentNonce: String?
    @State private var isSigningIn = false
    @State private var isPasskeySigningIn = false
    @State private var isEmailCodeSheetPresented = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer().frame(height: 60)

                StackedLogoView()

                Spacer().frame(height: 20)

                passkeySignInButton

                appleSignInButton

                orDivider

                emailCodeButton

                if let error = authViewModel.error {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.quicksand(.caption))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer().frame(height: 40)
            }
            .padding()
        }
    }

    private var emailCodeButton: some View {
        VStack(spacing: 8) {
            Button {
                authViewModel.error = nil
                isEmailCodeSheetPresented = true
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "envelope.fill")
                    Text("Continue with Email")
                        .fontWeight(.semibold)
                }
                .font(.quicksand(.body))
                .foregroundColor(Color.brandGreen)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color.brandGreen, lineWidth: 1.5)
                )
            }
            .accessibilityIdentifier("emailCodeSignInButton")
            .sheet(isPresented: $isEmailCodeSheetPresented) {
                EmailCodeSignInView()
            }

            Text("New to Gather? Email sign-in creates your account.")
                .font(.quicksand(.caption))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: 360)
    }

    private var orDivider: some View {
        HStack {
            Rectangle()
                .fill(Color.secondary.opacity(0.3))
                .frame(height: 1)
            Text("or")
                .font(.quicksand(.subheadline))
                .foregroundColor(.secondary)
            Rectangle()
                .fill(Color.secondary.opacity(0.3))
                .frame(height: 1)
        }
        .frame(maxWidth: 360)
    }

    private var passkeySignInButton: some View {
        Button {
            handlePasskeySignIn()
        } label: {
            HStack(spacing: 8) {
                if isPasskeySigningIn {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "person.badge.key.fill")
                    Text("Sign in with a passkey")
                        .fontWeight(.semibold)
                }
            }
            .font(.quicksand(.body))
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
        }
        .background(Color.brandGreen)
        .cornerRadius(10)
        .frame(maxWidth: 360)
        .disabled(isPasskeySigningIn)
        .accessibilityIdentifier("passkeySignInButton")
    }

    private func handlePasskeySignIn() {
        isPasskeySigningIn = true
        Task {
            await authViewModel.signInWithPasskey()
            isPasskeySigningIn = false
        }
    }

    @ViewBuilder
    private var appleSignInButton: some View {
        SignInWithAppleButton(.signIn) { request in
            let nonce = randomNonceString()
            currentNonce = nonce
            request.requestedScopes = [.fullName, .email]
            request.nonce = sha256(nonce)
        } onCompletion: { result in
            handleAppleSignIn(result)
        }
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        .frame(height: 50)
        .frame(maxWidth: 360)

        if isSigningIn {
            ProgressView()
        }
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let identityTokenData = appleIDCredential.identityToken,
                  let idToken = String(data: identityTokenData, encoding: .utf8),
                  let nonce = currentNonce else {
                authViewModel.error = "Failed to get Apple ID credentials"
                return
            }
            
            isSigningIn = true
            
            Task {
                await authViewModel.signInWithApple(
                    idToken: idToken,
                    nonce: nonce,
                    fullName: appleIDCredential.fullName
                )
                isSigningIn = false
            }
            
        case .failure(let error):
            if (error as? ASAuthorizationError)?.code == .canceled {
                return
            }
            authViewModel.error = error.localizedDescription
        }
    }
    
    private func randomNonceString(length: Int = 32) -> String {
        precondition(length > 0)
        var randomBytes = [UInt8](repeating: 0, count: length)
        let errorCode = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        if errorCode != errSecSuccess {
            fatalError("Unable to generate nonce: \(errorCode)")
        }
        return randomBytes.map { String(format: "%02x", $0) }.joined()
    }
    
    private func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}
