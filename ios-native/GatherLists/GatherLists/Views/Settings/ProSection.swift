import StoreKit
import SwiftUI

/// Settings section showing Gather Lists Pro status, with the paywall for free
/// users and subscription management for subscribers.
struct ProSection: View {
    @Environment(ProSubscriptionManager.self) private var proSubscription
    @State private var isPaywallPresented = false
    @State private var isManagingSubscription = false

    var body: some View {
        Section("Gather Lists Pro") {
            if proSubscription.isPro {
                subscriberRows
            } else {
                upgradeRow
            }
        }
    }

    @ViewBuilder
    private var subscriberRows: some View {
        if let proUntil = proSubscription.proUntil {
            LabeledContent("Active until", value: proUntil.formatted(date: .abbreviated, time: .omitted))
        }
        Button("Manage Subscription") { isManagingSubscription = true }
            .manageSubscriptionsSheet(isPresented: $isManagingSubscription)
    }

    private var upgradeRow: some View {
        Button {
            isPaywallPresented = true
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Upgrade to Pro")
                    Text("Meal plans and recipe tools")
                        .font(.quicksand(.caption))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.quicksand(.caption))
                    .foregroundStyle(.tertiary)
            }
        }
        .foregroundStyle(.primary)
        .sheet(isPresented: $isPaywallPresented) {
            ProPaywallView()
        }
    }
}
