import SwiftUI
import AuthenticationServices
import CryptoKit

struct LoginView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var currentNonce: String?
    @State private var isSigningIn = false
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            
            VStack(spacing: 12) {
                Image(systemName: "leaf.fill")
                    .font(.system(size: 60))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                Color(red: 0xB5/255, green: 0xE8/255, blue: 0xC8/255),
                                Color(red: 0xA8/255, green: 0xD8/255, blue: 0xEA/255)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                
                Text("Gather Lists")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(brandGreen)
                
                Text("Gather your lists, meals, and more.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            SignInWithAppleButton(.signIn) { request in
                let nonce = randomNonceString()
                currentNonce = nonce
                request.requestedScopes = [.fullName, .email]
                request.nonce = sha256(nonce)
            } onCompletion: { result in
                handleAppleSignIn(result)
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 50)
            .frame(maxWidth: 360)
            
            if let error = authViewModel.error {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
            
            if isSigningIn {
                ProgressView()
            }
            
            Spacer()
        }
        .padding()
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
