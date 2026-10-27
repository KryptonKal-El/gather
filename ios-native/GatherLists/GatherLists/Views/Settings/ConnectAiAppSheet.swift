import SwiftUI
import UIKit

/// Walks the user through connecting an AI app (Claude) to Gather: copy the
/// MCP server address, add it as a custom connector on claude.ai, then approve.
/// The AI app starts the OAuth flow, so Gather can only hand off.
struct ConnectAiAppSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL
    @State private var isCopied = false

    private static let claudeConnectorsURL = URL(string: "https://claude.ai/settings/connectors")!

    @MainActor private var serverURL: String {
        SupabaseManager.shared.supabaseURL.appendingPathComponent("functions/v1/mcp").absoluteString
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Let Claude see and update your lists, recipes, and meal plans.")
                }

                Section {
                    Text(serverURL)
                        .font(.footnote.monospaced())
                        .textSelection(.enabled)
                    Button {
                        UIPasteboard.general.string = serverURL
                        isCopied = true
                    } label: {
                        Label(isCopied ? "Copied" : "Copy Address", systemImage: isCopied ? "checkmark" : "doc.on.doc")
                    }
                } header: {
                    Text("Server Address")
                }

                Section {
                    step(1, "Copy the server address above.")
                    step(2, "In Claude, open Settings → Connectors and choose “Add custom connector”.")
                    step(3, "Name it Gather Lists, paste the address, then sign in and approve.")
                } header: {
                    Text("Steps")
                } footer: {
                    Text("Add it on claude.ai. Once it’s added, the Claude app on your phone can use it too.")
                }

                Section {
                    Button {
                        openURL(Self.claudeConnectorsURL)
                    } label: {
                        Text("Open Claude Settings")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .navigationTitle("Connect an AI App")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text("\(number).")
                .foregroundStyle(.secondary)
                .monospacedDigit()
            Text(text)
        }
    }
}
