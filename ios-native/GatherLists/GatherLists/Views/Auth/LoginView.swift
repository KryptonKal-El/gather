import SwiftUI
import AuthenticationServices
import CryptoKit

struct LoginView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @State private var currentNonce: String?
    @State private var isSigningIn = false
    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    @State private var isEmailSigningIn = false
    @FocusState private var focusedField: Field?
    
    private enum Field {
        case email, password
    }
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    private var isEmailValid: Bool {
        email.contains("@") && email.contains(".")
    }
    
    private var isPasswordValid: Bool {
        password.count >= 6
    }
    
    private var isFormValid: Bool {
        isEmailValid && isPasswordValid
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer().frame(height: 60)
                
                StackedLogoView()
                
                Spacer().frame(height: 20)
                
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
                
                if isSigningIn {
                    ProgressView()
                }
                
                HStack {
                    Rectangle()
                        .fill(Color.secondary.opacity(0.3))
                        .frame(height: 1)
                    Text("or")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Rectangle()
                        .fill(Color.secondary.opacity(0.3))
                        .frame(height: 1)
                }
                .frame(maxWidth: 360)
                
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        TextField("Email", text: $email)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .email)
                            .onSubmit { focusedField = .password }
                        
                        if !email.isEmpty && !isEmailValid {
                            Text("Enter a valid email address")
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        SecureField("Password", text: $password)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(isSignUp ? .newPassword : .password)
                            .focused($focusedField, equals: .password)
                            .onSubmit { handleEmailAuth() }
                        
                        if !password.isEmpty && !isPasswordValid {
                            Text("Password must be at least 6 characters")
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                    
                    Button {
                        handleEmailAuth()
                    } label: {
                        if isEmailSigningIn {
                            ProgressView()
                                .tint(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                        } else {
                            Text(isSignUp ? "Sign Up" : "Sign In")
                                .fontWeight(.semibold)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 50)
                        }
                    }
                    .background(isFormValid ? brandGreen : brandGreen.opacity(0.5))
                    .cornerRadius(10)
                    .disabled(!isFormValid || isEmailSigningIn)
                    
                    Button {
                        withAnimation {
                            isSignUp.toggle()
                            authViewModel.error = nil
                        }
                    } label: {
                        Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up")
                            .font(.subheadline)
                            .foregroundColor(brandGreen)
                    }
                }
                .frame(maxWidth: 360)
                
                if let error = authViewModel.error {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                
                Spacer().frame(height: 40)
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .onTapGesture {
            focusedField = nil
        }
    }
    
    private func handleEmailAuth() {
        guard isFormValid else { return }
        focusedField = nil
        isEmailSigningIn = true
        
        Task {
            if isSignUp {
                await authViewModel.signUpWithEmail(email: email, password: password)
            } else {
                await authViewModel.signInWithEmail(email: email, password: password)
            }
            isEmailSigningIn = false
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
