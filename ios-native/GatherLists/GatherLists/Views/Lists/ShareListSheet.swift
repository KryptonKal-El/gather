import SwiftUI

/// Sheet for managing list sharing — add and remove collaborators.
struct ShareListSheet: View {
    @Environment(\.dismiss) private var dismiss
    
    let list: GatherList
    let viewModel: ListViewModel
    let ownerEmail: String
    
    @State private var emailInput = ""
    @State private var collaborators: [ListShare] = []
    @State private var isLoading = false
    @State private var isAddingCollaborator = false
    @State private var removingEmail: String?
    @State private var errorMessage: String?
    @State private var userPreferences: UserPreferences?
    @State private var emailHistory: [String] = []
    @State private var isEmailFieldFocused = false
    @FocusState private var emailFieldFocus: Bool
    
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    private static let emailHistoryKey = "share_email_history"
    private static let maxEmailHistory = 20
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                addCollaboratorSection
                
                if let error = errorMessage {
                    errorBanner(error)
                }
                
                collaboratorsList
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Share \"\(list.name)\"")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                    .fontWeight(.semibold)
                    .foregroundStyle(brandGreen)
                }
            }
            .task {
                loadEmailHistory()
                await loadCollaborators()
                do {
                    userPreferences = try await PreferenceService.fetchUserPreferences()
                } catch {
                    print("[ShareListSheet] Failed to load preferences: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private var filteredSuggestions: [String] {
        let lowercasedInput = emailInput.lowercased().trimmingCharacters(in: .whitespaces)
        let currentEmails = Set(collaborators.map { $0.sharedWithEmail.lowercased() })
        let normalizedOwner = ownerEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        return emailHistory
            .filter { email in
                let lowered = email.lowercased()
                return lowered != normalizedOwner &&
                       !currentEmails.contains(lowered) &&
                       (lowercasedInput.isEmpty || lowered.contains(lowercasedInput))
            }
            .prefix(5)
            .map { $0 }
    }
    
    private var addCollaboratorSection: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                TextField("Email address", text: $emailInput)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textFieldStyle(.roundedBorder)
                    .focused($emailFieldFocus)
                    .onChange(of: emailFieldFocus) { _, focused in
                        isEmailFieldFocused = focused
                    }
                
                Button {
                    Task {
                        await addCollaborator()
                    }
                } label: {
                    if isAddingCollaborator {
                        ProgressView()
                            .tint(.white)
                            .frame(width: 20, height: 20)
                    } else {
                        Text("Add")
                            .foregroundStyle(.white)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(
                    emailInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isAddingCollaborator
                        ? Color.gray.opacity(0.3)
                        : brandGreen
                )
                .cornerRadius(8)
                .disabled(emailInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isAddingCollaborator)
            }
            
            if isEmailFieldFocused && !filteredSuggestions.isEmpty {
                VStack(spacing: 0) {
                    ForEach(filteredSuggestions, id: \.self) { suggestion in
                        Button {
                            emailInput = suggestion
                            emailFieldFocus = false
                        } label: {
                            HStack {
                                Image(systemName: "clock.arrow.circlepath")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(suggestion)
                                    .foregroundStyle(.primary)
                                Spacer()
                            }
                            .padding(.vertical, 10)
                            .padding(.horizontal, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        
                        if suggestion != filteredSuggestions.last {
                            Divider()
                                .padding(.leading, 36)
                        }
                    }
                }
                .background(Color(.secondarySystemBackground))
                .cornerRadius(8)
            }
        }
        .padding()
        .background(Color(.systemGroupedBackground))
    }
    
    private func errorBanner(_ message: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(message)
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color.orange.opacity(0.1))
    }
    
    @ViewBuilder
    private var collaboratorsList: some View {
        if isLoading && collaborators.isEmpty {
            VStack {
                Spacer()
                ProgressView()
                Text("Loading collaborators...")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
            }
        } else if collaborators.isEmpty {
            VStack(spacing: 12) {
                Spacer()
                Image(systemName: "person.2.slash")
                    .font(.system(size: 40))
                    .foregroundStyle(.secondary)
                Text("No collaborators yet")
                    .font(.headline)
                Text("Add people by email to share this list.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding()
        } else {
            List {
                Section("Collaborators") {
                    ForEach(collaborators) { share in
                        collaboratorRow(share: share)
                    }
                    .onDelete { indexSet in
                        Task {
                            await removeCollaborators(at: indexSet)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
        }
    }
    
    private func collaboratorRow(share: ListShare) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(share.sharedWithEmail)
                    .font(.body)
                Text("Added \(share.addedAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            if removingEmail == share.sharedWithEmail {
                ProgressView()
            } else {
                Button {
                    Task {
                        await removeCollaborator(email: share.sharedWithEmail)
                    }
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(.red)
                }
                .buttonStyle(.borderless)
            }
        }
    }
    
    private func loadCollaborators() async {
        isLoading = true
        do {
            collaborators = try await ListService.fetchSharesForList(listId: list.id)
        } catch {
            errorMessage = "Failed to load collaborators"
            print("[ShareListSheet] Failed to load collaborators: \(error.localizedDescription)")
        }
        isLoading = false
    }
    
    private func addCollaborator() async {
        let email = emailInput.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        errorMessage = nil
        
        guard !email.isEmpty else {
            errorMessage = "Enter an email address"
            return
        }
        
        guard email.contains("@") && email.contains(".") else {
            errorMessage = "Enter a valid email address"
            return
        }
        
        let normalizedOwner = ownerEmail.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard email != normalizedOwner else {
            errorMessage = "You already own this list"
            return
        }
        
        let alreadyShared = collaborators.contains { $0.sharedWithEmail == email }
        guard !alreadyShared else {
            errorMessage = "This person already has access"
            return
        }
        
        isAddingCollaborator = true
        
        do {
            let effectiveConfig = PreferenceService.effectiveSortConfig(for: list, userPreferences: userPreferences)
            let configStrings = effectiveConfig.map { $0.rawValue }
            try await viewModel.shareList(id: list.id, email: email, sortConfig: configStrings)
            saveEmailToHistory(email)
            emailInput = ""
            await loadCollaborators()
        } catch let error as NSError {
            if error.localizedDescription.contains("duplicate") || error.localizedDescription.contains("UNIQUE") {
                errorMessage = "This person already has access"
            } else {
                errorMessage = "Failed to add collaborator"
            }
            print("[ShareListSheet] Failed to share: \(error.localizedDescription)")
        }
        
        isAddingCollaborator = false
    }
    
    private func removeCollaborator(email: String) async {
        errorMessage = nil
        removingEmail = email
        
        do {
            try await viewModel.unshareList(id: list.id, email: email)
            await loadCollaborators()
        } catch {
            errorMessage = "Failed to remove collaborator"
            print("[ShareListSheet] Failed to unshare: \(error.localizedDescription)")
        }
        
        removingEmail = nil
    }
    
    private func removeCollaborators(at offsets: IndexSet) async {
        for index in offsets {
            let share = collaborators[index]
            await removeCollaborator(email: share.sharedWithEmail)
        }
    }
    
    // MARK: - Email History
    
    private func loadEmailHistory() {
        emailHistory = UserDefaults.standard.stringArray(forKey: Self.emailHistoryKey) ?? []
    }
    
    private func saveEmailToHistory(_ email: String) {
        var history = UserDefaults.standard.stringArray(forKey: Self.emailHistoryKey) ?? []
        
        // Remove if already exists (to move to front)
        history.removeAll { $0.lowercased() == email.lowercased() }
        
        // Insert at front
        history.insert(email, at: 0)
        
        // Trim to max size
        if history.count > Self.maxEmailHistory {
            history = Array(history.prefix(Self.maxEmailHistory))
        }
        
        UserDefaults.standard.set(history, forKey: Self.emailHistoryKey)
        emailHistory = history
    }
}
