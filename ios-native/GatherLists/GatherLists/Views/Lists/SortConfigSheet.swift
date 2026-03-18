import SwiftUI

/// Sheet for configuring sort levels with drag-to-reorder, add, and remove.
struct SortConfigSheet: View {
    @Binding var activeSortConfig: [SortLevel]
    let hasOverride: Bool
    let onConfigChange: ([SortLevel]?) async -> Void
    var listType: String = "grocery"
    @Environment(\.dismiss) private var dismiss
    
    @State private var levels: [SortLevel] = []
    @State private var formId = UUID()
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    private static let levelLabels: [SortLevel: String] = [
        .store: "Store",
        .category: "Category",
        .rsvp: "RSVP Status",
        .name: "Name",
        .date: "Date Added",
        .price: "Price"
    ]
    
    private var unusedLevels: [SortLevel] {
        let config = ListTypes.getConfig(listType)
        let validLevels = config.sortLevels.compactMap { SortLevel(rawValue: $0) }
        return validLevels.filter { !levels.contains($0) }
    }
    
    private var canAddMore: Bool {
        levels.count < 3 && !unusedLevels.isEmpty
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(levels, id: \.self) { level in
                        HStack {
                            if levels.count > 1 {
                                Button {
                                    removeLevel(level)
                                } label: {
                                    Image(systemName: "minus.circle.fill")
                                        .foregroundStyle(.red)
                                        .font(.title3)
                                }
                                .buttonStyle(.plain)
                            }
                            
                            Text(Self.levelLabels[level] ?? level.rawValue)
                            
                            Spacer()
                        }
                    }
                    .onMove(perform: moveLevel)
                } header: {
                    Text("Sort Levels")
                } footer: {
                    Text("Drag to reorder. The first level creates top-level groups.")
                }
                
                if canAddMore {
                    Section("Add Level") {
                        ForEach(unusedLevels, id: \.self) { level in
                            Button {
                                addLevel(level)
                            } label: {
                                HStack {
                                    Image(systemName: "plus.circle.fill")
                                        .foregroundStyle(.green)
                                    Text(Self.levelLabels[level] ?? level.rawValue)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                
                if hasOverride {
                    Section {
                        Button {
                            Task {
                                await onConfigChange(nil)
                                dismiss()
                            }
                        } label: {
                            HStack {
                                Image(systemName: "arrow.uturn.backward")
                                Text("Use Default")
                            }
                            .foregroundStyle(brandGreen)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .id(formId)
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Sort Configuration")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                        .foregroundStyle(brandGreen)
                }
            }
            .onAppear {
                levels = activeSortConfig
            }
        }
    }
    
    private func moveLevel(from source: IndexSet, to destination: Int) {
        levels.move(fromOffsets: source, toOffset: destination)
        persistChange()
    }
    
    private func removeLevel(_ level: SortLevel) {
        guard levels.count > 1 else { return }
        levels.removeAll { $0 == level }
        formId = UUID()
        persistChange()
    }
    
    private func addLevel(_ level: SortLevel) {
        guard levels.count < 3 && !levels.contains(level) else { return }
        levels.append(level)
        formId = UUID()
        persistChange()
    }
    
    private func persistChange() {
        activeSortConfig = levels
        Task {
            await onConfigChange(levels)
        }
    }
}
