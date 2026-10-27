import SwiftUI

/// Settings section listing apps connected to the account (such as Claude via
/// the Gather MCP server), with a confirmed Disconnect for each.
struct ConnectedAppsSection: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var apps: [ConnectedApp] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var actionError: String?
    @State private var pendingApp: ConnectedApp?
    @State private var disconnectingId: String?
    @State private var isConnectSheetPresented = false

    var body: some View {
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
                }
            } else if apps.isEmpty {
                Text("No apps connected. Apps like Claude appear here after you approve them.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(apps) { app in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(app.name)
                                .lineLimit(1)
                            Text("Connected \(app.grantedAt.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if disconnectingId == app.clientId {
                            ProgressView()
                        } else {
                            Button("Disconnect") { pendingApp = app }
                                .foregroundStyle(.red)
                                .buttonStyle(.borderless)
                        }
                    }
                }
            }
            if let actionError {
                Text(actionError)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
            // Section modifiers are copied onto every row, so the section's
            // lifecycle and presentations hang off this always-present row.
            Button("Connect an AI App") { isConnectSheetPresented = true }
                .task { await load() }
                // Pick up an app approved outside Gather (e.g. after adding it on claude.ai).
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { Task { await load(isSilent: true) } }
                }
                .sheet(isPresented: $isConnectSheetPresented, onDismiss: {
                    Task { await load(isSilent: true) }
                }) {
                    ConnectAiAppSheet()
                }
                .alert(
                    "Disconnect \(pendingApp?.name ?? "app")?",
                    isPresented: Binding(
                        get: { pendingApp != nil },
                        set: { if !$0 { pendingApp = nil } }
                    ),
                    presenting: pendingApp
                ) { app in
                    Button("Cancel", role: .cancel) {}
                    Button("Disconnect", role: .destructive) {
                        Task { await disconnect(app) }
                    }
                } message: { app in
                    Text("\(app.name) will no longer be able to see or change your lists, recipes, and meal plans. You can reconnect it later.")
                }
        } header: {
            Text("Connected Apps")
        }
    }

    private func load(isSilent: Bool = false) async {
        if !isSilent {
            isLoading = true
            loadError = nil
        }
        do {
            apps = try await ConnectedAppService.fetchConnectedApps()
            loadError = nil
        } catch {
            print("[ConnectedAppsSection] load failed: \(error)")
            if !isSilent { loadError = "Couldn’t load connected apps." }
        }
        isLoading = false
    }

    private func disconnect(_ app: ConnectedApp) async {
        actionError = nil
        disconnectingId = app.clientId
        do {
            try await ConnectedAppService.disconnect(clientId: app.clientId)
            apps.removeAll { $0.clientId == app.clientId }
        } catch {
            print("[ConnectedAppsSection] disconnect failed: \(error)")
            actionError = "Couldn’t disconnect \(app.name). Please try again."
        }
        disconnectingId = nil
    }
}
