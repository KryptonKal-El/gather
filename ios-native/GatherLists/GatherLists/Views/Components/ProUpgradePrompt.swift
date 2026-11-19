import SwiftUI

/// An inline notice that something needs Gather Lists Pro, with a button that
/// opens the paywall. Owns the paywall sheet so callers don't grow their own
/// modifier chains.
struct ProUpgradePrompt: View {
    let title: String
    let message: String
    /// False where the viewer can't fix it by subscribing, e.g. someone else's plan.
    var showsUpgradeButton = true

    @State private var isPaywallPresented = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: "lock.fill")
                .font(.quicksand(.subheadline, weight: .semibold))
            Text(message)
                .font(.quicksand(.footnote))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            if showsUpgradeButton {
                Button("See Plans") { isPaywallPresented = true }
                    .font(.quicksand(.subheadline, weight: .semibold))
                    .buttonStyle(.borderedProminent)
                    .tint(.brandGreen)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .sheet(isPresented: $isPaywallPresented) {
            ProPaywallView()
        }
    }
}
