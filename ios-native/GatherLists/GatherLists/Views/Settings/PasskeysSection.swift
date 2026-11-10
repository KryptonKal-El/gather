@_spi(Experimental) import Supabase
import SwiftUI

/// Settings section listing the user's passkeys, with add, rename, and a
/// confirmed remove for each. Hidden while passkeys are off for the project.
struct PasskeysSection: View {
    @State private var passkeys: [PasskeyListItem] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var actionError: String?
    @State private var isAdding = false
    @State private var isDisabledOnServer = false
    @State private var busyId: UUID?
    @State private var renaming: PasskeyListItem?
    @State private var draftName = ""
    @State private var pendingRemoval: PasskeyListItem?

    private static let maxNameLength = 120

    var body: some View {
        if isDisabledOnServer {
            EmptyView()
        } else {
            content
        }
    }

    private var content: some View {
        Section {
            if isLoading {
                HStack {
                    ProgressView()
                    Text("Loading…")
                        .foregroundStyle(.secondary)
                }
            } else if let loadError {
                HStack {
                    Text(loadError)
                        .foregroundStyle(.red)
                    Spacer()
                    Button("Retry") { Task { await load() } }
                        .buttonStyle(.borderless)
                }
            } else if passkeys.isEmpty {
                Text("Sign in with Face ID, Touch ID, or your device passcode instead of waiting for an email code.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(passkeys) { passkey in
                    row(for: passkey)
                }
            }
            if let actionError {
                Text(actionError)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
            // Section modifiers are copied onto every row, so the section's
            // lifecycle and presentations hang off this always-present row.
            Button {
                Task { await add() }
            } label: {
                if isAdding {
                    ProgressView()
                } else {
                    Text("Add a Passkey")
                }
            }
            .disabled(isAdding || isLoading)
            .task { await load() }
            .alert("Rename Passkey", isPresented: isRenamingBinding, presenting: renaming) { passkey in
                TextField("Name", text: $draftName)
                Button("Cancel", role: .cancel) {}
                Button("Save") { Task { await rename(passkey) } }
                    .disabled(draftName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .alert(
                "Remove \(displayName(pendingRemoval))?",
                isPresented: isRemovingBinding,
                presenting: pendingRemoval
            ) { passkey in
                Button("Cancel", role: .cancel) {}
                Button("Remove", role: .destructive) { Task { await remove(passkey) } }
            } message: { _ in
                Text("You won’t be able to sign in with this passkey anymore. It may still appear in your password manager until you delete it there.")
            }
        } header: {
            Text("Passkeys")
        }
    }

    private func row(for passkey: PasskeyListItem) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(displayName(passkey))
                    .lineLimit(1)
                Text(detail(for: passkey))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if busyId == passkey.id {
                ProgressView()
            } else {
                Menu {
                    Button("Rename", systemImage: "pencil") {
                        draftName = passkey.friendlyName ?? ""
                        renaming = passkey
                    }
                    Button("Remove", systemImage: "trash", role: .destructive) {
                        pendingRemoval = passkey
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                        .accessibilityLabel("Options for \(displayName(passkey))")
                }
                .buttonStyle(.borderless)
            }
        }
    }

    private var isRenamingBinding: Binding<Bool> {
        Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })
    }

    private var isRemovingBinding: Binding<Bool> {
        Binding(get: { pendingRemoval != nil }, set: { if !$0 { pendingRemoval = nil } })
    }

    private func displayName(_ passkey: PasskeyListItem?) -> String {
        guard let name = passkey?.friendlyName, !name.isEmpty else { return "Passkey" }
        return name
    }

    private func detail(for passkey: PasskeyListItem) -> String {
        let added = "Added \(passkey.createdAt.formatted(date: .abbreviated, time: .omitted))"
        guard let lastUsed = passkey.lastUsedAt else { return added }
        return "\(added) · Last used \(lastUsed.formatted(date: .abbreviated, time: .omitted))"
    }

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            passkeys = try await PasskeyService.list()
        } catch {
            if PasskeyService.isDisabledOnServer(error) {
                isDisabledOnServer = true
            } else {
                print("[PasskeysSection] load failed: \(error)")
                loadError = "Couldn’t load passkeys."
            }
        }
        isLoading = false
    }

    private func add() async {
        actionError = nil
        isAdding = true
        defer { isAdding = false }
        do {
            try await PasskeyService.register()
            passkeys = try await PasskeyService.list()
        } catch {
            if !PasskeyService.isCancelled(error) {
                print("[PasskeysSection] add failed: \(error)")
                actionError = PasskeyService.message(for: error)
            }
        }
    }

    private func rename(_ passkey: PasskeyListItem) async {
        let name = String(draftName.trimmingCharacters(in: .whitespaces).prefix(Self.maxNameLength))
        guard !name.isEmpty else { return }
        actionError = nil
        busyId = passkey.id
        defer { busyId = nil }
        do {
            let updated = try await PasskeyService.rename(id: passkey.id, to: name)
            if let index = passkeys.firstIndex(where: { $0.id == passkey.id }) {
                passkeys[index] = updated
            }
        } catch {
            print("[PasskeysSection] rename failed: \(error)")
            actionError = "Couldn’t rename the passkey. Please try again."
        }
    }

    private func remove(_ passkey: PasskeyListItem) async {
        actionError = nil
        busyId = passkey.id
        defer { busyId = nil }
        do {
            try await PasskeyService.delete(id: passkey.id)
            passkeys.removeAll { $0.id == passkey.id }
        } catch {
            print("[PasskeysSection] remove failed: \(error)")
            actionError = "Couldn’t remove \(displayName(passkey)). Please try again."
        }
    }
}
