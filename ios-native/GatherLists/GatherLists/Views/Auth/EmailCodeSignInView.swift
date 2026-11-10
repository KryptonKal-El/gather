import Supabase
import SwiftUI

/// Two-step passwordless sign-in: request a code by email, then enter it.
/// Also creates an account when the email is new.
struct EmailCodeSignInView: View {
    @Environment(AuthViewModel.self) private var authViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var code = ""
    @State private var sentTo: String?
    @State private var isBusy = false
    @State private var errorMessage: String?
    @State private var resendAvailableAt: Date?
    @FocusState private var focusedField: Field?

    private enum Field { case email, code }

    private static let resendCooldown: TimeInterval = 60
    private static let minCodeLength = 6
    private static let maxCodeLength = 8

    private var isEmailValid: Bool {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        return trimmed.contains("@") && trimmed.contains(".")
    }

    var body: some View {
        NavigationStack {
            Form {
                if let sentTo {
                    codeStep(sentTo: sentTo)
                } else {
                    emailStep
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.quicksand(.footnote))
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Sign In with Email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear { focusedField = sentTo == nil ? .email : .code }
        }
    }

    private var emailStep: some View {
        Section {
            TextField("Email", text: $email)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($focusedField, equals: .email)
                .onSubmit { Task { await requestCode() } }
            Button {
                Task { await requestCode() }
            } label: {
                if isBusy { ProgressView() } else { Text("Email Me a Sign-In Code") }
            }
            .disabled(!isEmailValid || isBusy)
        } footer: {
            Text("We’ll email you a code. New to Gather? This creates your account.")
        }
    }

    private func codeStep(sentTo: String) -> some View {
        Section {
            TextField("Sign-in code", text: $code)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .font(.quicksand(.title3, weight: .semibold))
                .multilineTextAlignment(.center)
                .focused($focusedField, equals: .code)
                .onChange(of: code) { _, newValue in
                    let digits = String(newValue.filter(\.isNumber).prefix(Self.maxCodeLength))
                    if digits != newValue { code = digits }
                }
                .accessibilityIdentifier("emailCodeField")
            Button {
                Task { await verifyCode(email: sentTo) }
            } label: {
                if isBusy { ProgressView() } else { Text("Sign In").fontWeight(.semibold) }
            }
            .disabled(code.count < Self.minCodeLength || isBusy)
            TimelineView(.periodic(from: .now, by: 1)) { context in
                resendButton(sentTo: sentTo, now: context.date)
            }
            Button("Use a Different Email") {
                self.sentTo = nil
                code = ""
                errorMessage = nil
                focusedField = .email
            }
        } header: {
            Text("Enter the code sent to \(sentTo)")
                .textCase(nil)
        }
    }

    private func resendButton(sentTo: String, now: Date) -> some View {
        let remaining = Int(ceil((resendAvailableAt ?? now).timeIntervalSince(now)))
        return Button(remaining > 0 ? "Resend Code in \(remaining)s" : "Resend Code") {
            Task { await requestCode(for: sentTo) }
        }
        .disabled(remaining > 0 || isBusy)
    }

    private func requestCode(for address: String? = nil) async {
        let target = address ?? email.trimmingCharacters(in: .whitespaces)
        guard !target.isEmpty else { return }
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            try await authViewModel.sendEmailCode(to: target)
            sentTo = target
            code = ""
            resendAvailableAt = Date().addingTimeInterval(Self.resendCooldown)
            focusedField = .code
        } catch {
            print("[EmailCodeSignIn] send failed: \(error)")
            errorMessage = Self.message(for: error)
        }
    }

    private func verifyCode(email: String) async {
        errorMessage = nil
        isBusy = true
        defer { isBusy = false }
        do {
            try await authViewModel.verifyEmailCode(email: email, code: code)
        } catch {
            print("[EmailCodeSignIn] verify failed: \(error)")
            errorMessage = Self.message(for: error)
        }
    }

    private static func message(for error: Error) -> String {
        switch (error as? AuthError)?.errorCode.rawValue {
        case "otp_expired":
            "That code is incorrect or has expired. Check the latest email or request a new code."
        case "over_email_send_rate_limit", "over_request_rate_limit":
            "Too many codes requested. Please wait a minute and try again."
        case "email_address_invalid", "validation_failed":
            "Enter a valid email address."
        case "signup_disabled":
            "New accounts can’t be created right now."
        case "user_banned":
            "This account has been disabled."
        default:
            "Something went wrong. Please try again."
        }
    }
}
