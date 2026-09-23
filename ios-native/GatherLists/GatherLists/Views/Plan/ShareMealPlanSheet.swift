import SwiftUI

/// Sheet for managing who shares the meal plan. Owners add and remove people; members see who's on it.
struct ShareMealPlanSheet: View {
    @Environment(\.dismiss) private var dismiss

    let viewModel: MealPlanViewModel

    @State private var emailInput = ""
    @State private var shares: [MealPlanShare] = []
    @State private var isLoading = false
    @State private var isAdding = false
    @State private var removingEmail: String?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                if viewModel.isOwner {
                    addSection
                }
                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    }
                }
                membersSection
            }
            .navigationTitle(viewModel.isOwner ? "Share Meal Plan" : "Plan Members")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                }
            }
            .task { await loadShares() }
        }
    }

    private var addSection: some View {
        Section {
            HStack(spacing: 12) {
                TextField("Email address", text: $emailInput)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .submitLabel(.send)
                    .onSubmit { Task { await addMember() } }

                Button {
                    Task { await addMember() }
                } label: {
                    if isAdding {
                        ProgressView()
                    } else {
                        Text("Add")
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.brandGreen)
                    }
                }
                .buttonStyle(.plain)
                .disabled(emailInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isAdding)
            }
        } footer: {
            Text("Everyone you add sees and edits the same weekly plan.")
        }
    }

    @ViewBuilder
    private var membersSection: some View {
        if isLoading && shares.isEmpty {
            Section {
                ProgressView()
                    .frame(maxWidth: .infinity)
            }
        } else if shares.isEmpty {
            Section {
                Text(viewModel.isOwner ? "Only you can see this plan so far." : "No other members.")
                    .foregroundStyle(.secondary)
            }
        } else {
            Section("Members") {
                ForEach(shares) { share in
                    memberRow(share)
                }
            }
        }
    }

    private func memberRow(_ share: MealPlanShare) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(share.sharedWithEmail)
                Text("Added \(share.addedAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.quicksand(.caption))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if viewModel.isOwner {
                if removingEmail == share.sharedWithEmail {
                    ProgressView()
                } else {
                    Button {
                        Task { await removeMember(email: share.sharedWithEmail) }
                    } label: {
                        Image(systemName: "trash")
                            .foregroundStyle(.red)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Remove \(share.sharedWithEmail)")
                }
            }
        }
    }

    // MARK: - Actions

    private func loadShares() async {
        guard let planId = viewModel.activePlanId else { return }
        isLoading = true
        do {
            shares = try await MealPlanService.fetchShares(planId: planId)
        } catch {
            errorMessage = "Couldn't load members."
            print("[ShareMealPlanSheet] Failed to load shares: \(error.localizedDescription)")
        }
        isLoading = false
    }

    private func addMember() async {
        let email = emailInput.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        errorMessage = nil
        guard email.contains("@"), email.contains(".") else {
            errorMessage = "Enter a valid email address"
            return
        }
        guard email != viewModel.userEmail.lowercased() else {
            errorMessage = "You're already on this plan"
            return
        }
        guard !shares.contains(where: { $0.sharedWithEmail == email }) else {
            errorMessage = "This person already has access"
            return
        }

        isAdding = true
        do {
            try await viewModel.share(email: email)
            emailInput = ""
            await loadShares()
        } catch {
            let message = error.localizedDescription
            errorMessage = message.contains("duplicate") || message.contains("unique")
                ? "This person already has access"
                : "Couldn't add that person"
            print("[ShareMealPlanSheet] Failed to share: \(message)")
        }
        isAdding = false
    }

    private func removeMember(email: String) async {
        errorMessage = nil
        removingEmail = email
        do {
            try await viewModel.unshare(email: email)
            await loadShares()
        } catch {
            errorMessage = "Couldn't remove that person"
            print("[ShareMealPlanSheet] Failed to unshare: \(error.localizedDescription)")
        }
        removingEmail = nil
    }
}
