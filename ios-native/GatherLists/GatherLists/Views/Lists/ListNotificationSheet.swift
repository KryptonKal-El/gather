import SwiftUI

struct ListNotificationSheet: View {
    let list: GatherList
    @Environment(\.dismiss) private var dismiss
    @Environment(NotificationService.self) private var notificationService
    
    @State private var itemAdded = false
    @State private var itemChecked = false
    @State private var rsvpChanged = false
    @State private var collaboratorJoined = false
    @State private var isLoading = true
    @State private var showPermissionDeniedMessage = false
    
    private var isGuestList: Bool { list.type == "guest_list" }
    
    private var hasAnyEnabled: Bool {
        itemAdded || itemChecked || rsvpChanged || collaboratorJoined
    }
    
    private var addedLabel: String {
        switch list.type {
        case "guest_list": return "Guest Added"
        case "todo": return "Task Added"
        default: return "Item Added"
        }
    }
    
    private var showCheckedToggle: Bool {
        list.type != "guest_list"
    }
    
    private var checkedLabel: String {
        list.type == "todo" ? "Task Completed" : "Item Checked Off"
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle(addedLabel, isOn: $itemAdded)
                    if showCheckedToggle {
                        Toggle(checkedLabel, isOn: $itemChecked)
                    }
                    if isGuestList {
                        Toggle("RSVP Changed", isOn: $rsvpChanged)
                    }
                    Toggle("Collaborator Joined", isOn: $collaboratorJoined)
                } header: {
                    Text("Notify me when...")
                }
                
                if showPermissionDeniedMessage {
                    Section {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Notifications are disabled for this app.")
                                .font(.subheadline)
                            Text("To enable, go to Settings > Gather Lists > Notifications.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Notifications")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .disabled(isLoading)
            .task { await loadPreferences() }
            .onChange(of: itemAdded) { _, _ in Task { await handleToggleChange() } }
            .onChange(of: itemChecked) { _, _ in Task { await handleToggleChange() } }
            .onChange(of: rsvpChanged) { _, _ in Task { await handleToggleChange() } }
            .onChange(of: collaboratorJoined) { _, _ in Task { await handleToggleChange() } }
        }
    }
    
    private func loadPreferences() async {
        do {
            if let prefs = try await NotificationPreferenceService.fetchPreferences(listId: list.id) {
                itemAdded = prefs.itemAdded
                itemChecked = prefs.itemChecked
                rsvpChanged = prefs.rsvpChanged
                collaboratorJoined = prefs.collaboratorJoined
            }
        } catch {
            print("[ListNotificationSheet] Failed to load preferences: \(error.localizedDescription)")
        }
        isLoading = false
    }
    
    private func handleToggleChange() async {
        guard !isLoading else { return }
        
        if hasAnyEnabled && !notificationService.permissionGranted {
            let granted = await notificationService.requestPermission()
            if !granted {
                itemAdded = false
                itemChecked = false
                rsvpChanged = false
                collaboratorJoined = false
                showPermissionDeniedMessage = true
                return
            }
        }
        
        showPermissionDeniedMessage = false
        
        if !hasAnyEnabled {
            do {
                try await NotificationPreferenceService.deletePreferences(listId: list.id)
            } catch {
                print("[ListNotificationSheet] Failed to delete preferences: \(error.localizedDescription)")
            }
            return
        }
        
        do {
            try await NotificationPreferenceService.upsertPreferences(
                listId: list.id,
                itemAdded: itemAdded,
                itemChecked: itemChecked,
                rsvpChanged: rsvpChanged,
                collaboratorJoined: collaboratorJoined
            )
        } catch {
            print("[ListNotificationSheet] Failed to save preferences: \(error.localizedDescription)")
        }
    }
}
