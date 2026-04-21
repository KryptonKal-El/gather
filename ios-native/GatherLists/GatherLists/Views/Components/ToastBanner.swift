import SwiftUI
import Observation

/// Visual variants for transient toast feedback.
enum ToastVariant {
    case success
    case error

    var duration: Duration {
        switch self {
        case .success:
            return .seconds(3)
        case .error:
            return .seconds(4)
        }
    }

    var tint: Color {
        switch self {
        case .success:
            return Color(hex: "#3D7A63")
        case .error:
            return .red
        }
    }

    var symbolName: String {
        switch self {
        case .success:
            return "checkmark.circle.fill"
        case .error:
            return "exclamationmark.circle.fill"
        }
    }
}

/// Coordinates app-wide toast presentation and dismissal timing.
@Observable
@MainActor
final class ToastController {
    var message: String?
    var variant: ToastVariant = .success

    @ObservationIgnored private var dismissTask: Task<Void, Never>?

    /// Presents a toast message for the variant's default duration.
    func show(_ message: String, variant: ToastVariant = .success) {
        dismissTask?.cancel()

        withAnimation(.easeInOut(duration: 0.22)) {
            self.message = message
            self.variant = variant
        }

        dismissTask = Task { [weak self] in
            try? await Task.sleep(for: variant.duration)
            guard !Task.isCancelled else { return }
            await self?.dismiss()
        }
    }

    /// Hides the active toast, if present.
    func dismiss() {
        dismissTask?.cancel()
        dismissTask = nil

        withAnimation(.easeInOut(duration: 0.22)) {
            message = nil
        }
    }

    deinit {
        dismissTask?.cancel()
    }
}

/// Bottom banner used for transient success and error feedback.
struct ToastBanner: View {
    let message: String
    let variant: ToastVariant

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: variant.symbolName)
                .font(.subheadline.weight(.semibold))

            Text(message)
                .font(.subheadline.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(variant.tint)
        )
        .shadow(color: .black.opacity(0.16), radius: 12, y: 6)
    }
}
