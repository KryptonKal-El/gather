import SwiftUI

/// Read-only sheet showing who has access to a shared list (for non-owners).
struct CollaboratorsInfoSheet: View {
    let list: GatherList
    
    @Environment(\.dismiss) private var dismiss
    
    @State private var ownerProfile: Profile?
    @State private var collaborators: [Profile] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    loadingView
                } else if let error = errorMessage {
                    errorView(error)
                } else {
                    collaboratorsList
                }
            }
            .navigationTitle("People")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await loadPeople() }
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Loading...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func errorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private var collaboratorsList: some View {
        List {
            Section("Owner") {
                if let owner = ownerProfile {
                    personRow(profile: owner, isOwner: true)
                } else {
                    Label("List Owner", systemImage: "crown.fill")
                        .foregroundStyle(.secondary)
                }
            }
            
            Section("Collaborators") {
                if collaborators.isEmpty {
                    Text("No other collaborators")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(collaborators) { profile in
                        personRow(profile: profile, isOwner: false)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
    }
    
    private func personRow(profile: Profile, isOwner: Bool) -> some View {
        HStack(spacing: 12) {
            AvatarView(
                imageURL: profile.avatarUrl,
                displayName: profile.displayName ?? "?",
                size: 36
            )
            
            Text(profile.displayName ?? "Unknown")
                .font(.body)
            
            Spacer()
            
            if isOwner {
                Image(systemName: "crown.fill")
                    .foregroundStyle(.orange)
                    .font(.subheadline)
            }
        }
    }
    
    private func loadPeople() async {
        isLoading = true
        errorMessage = nil
        
        do {
            let allPeople = try await ListService.fetchListCollaborators(listId: list.id)
            
            // RPC returns owner in results for non-owners, but not for owners viewing their own list
            ownerProfile = allPeople.first { $0.id == list.ownerId }
            collaborators = allPeople.filter { $0.id != list.ownerId }
        } catch {
            errorMessage = "Failed to load people"
            print("[CollaboratorsInfoSheet] Error: \(error.localizedDescription)")
        }
        
        isLoading = false
    }
}
