import SwiftUI

/// Sheet for configuring sort levels with drag-to-reorder, add, and remove.
struct SortConfigSheet: View {
    @Binding var activeSortConfig: [SortLevel]
    let hasOverride: Bool
    let onConfigChange: ([SortLevel]?) async -> Void
    @Environment(\.dismiss) private var dismiss
    
    @State private var levels: [SortLevel] = []
    
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
            List {
                Section {
                    ForEach(levels, id: \.self) { level in
                        HStack {
                            Image(systemName: "line.3.horizontal")
                                .foregroundStyle(.secondary)
                            Text(Self.levelLabels[level] ?? level.rawValue)
                        }
                    }
                    .onMove(perform: moveLevel)
                    .onDelete(perform: deleteLevel)
                } header: {
                    Text("Sort Levels")
                } footer: {
                    Text("Drag to reorder. The first level creates top-level groups.")
                }
                
                if canAddMore {
                    Section {
                        ForEach(unusedLevels, id: \.self) { level in
                            Button {
                                addLevel(level)
                            } label: {
                                HStack {
                                    Image(systemName: "plus.circle.fill")
                                        .foregroundStyle(.green)
                                    Text(Self.levelLabels[level] ?? level.rawValue)
                                        .foregroundStyle(.primary)
                                }
                            }
                        }
                    } header: {
                        Text("Add Level")
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
                                    .foregroundStyle(.secondary)
                                Text("Use Default")
                            }
                        }
                    }
                }
            }
            .environment(\.editMode, .constant(.active))
            .navigationTitle("Sort Configuration")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                levels = activeSortConfig
            }
        }
        .presentationDetents([.medium, .large])
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
