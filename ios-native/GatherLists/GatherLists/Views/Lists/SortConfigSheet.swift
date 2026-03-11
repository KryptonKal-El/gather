import SwiftUI

/// Sheet for configuring sort levels with drag-to-reorder, add, and remove.
struct SortConfigSheet: View {
    @Binding var activeSortConfig: [SortLevel]
    let hasOverride: Bool
    let onConfigChange: ([SortLevel]?) async -> Void
    @Environment(\.dismiss) private var dismiss
    
    @State private var levels: [SortLevel] = []
    private let brandGreen = Color(red: 0x3D/255, green: 0x7A/255, blue: 0x63/255)
    
    private static let levelLabels: [SortLevel: String] = [
        .store: "Store",
        .category: "Category",
        .name: "Name",
        .date: "Date Added"
    ]
    
    private var unusedLevels: [SortLevel] {
        SortLevel.allCases.filter { !levels.contains($0) }
    }
    
    private var canAddMore: Bool {
        levels.count < 3 && !unusedLevels.isEmpty
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(levels, id: \.self) { level in
                        Text(Self.levelLabels[level] ?? level.rawValue)
                    }
                    .onMove(perform: moveLevel)
                    .onDelete(perform: deleteLevel)
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
    
    private func deleteLevel(at offsets: IndexSet) {
        guard levels.count > 1 else { return }
        levels.remove(atOffsets: offsets)
        persistChange()
    }
    
    private func addLevel(_ level: SortLevel) {
        guard levels.count < 3 && !levels.contains(level) else { return }
        levels.append(level)
        persistChange()
    }
    
    private func persistChange() {
        activeSortConfig = levels
        Task {
            await onConfigChange(levels)
        }
    }
}
