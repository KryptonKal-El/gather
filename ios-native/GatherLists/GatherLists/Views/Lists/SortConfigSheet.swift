import SwiftUI

/// Sheet for configuring sort levels with drag-to-reorder, add, and remove.
/// Split into "Group By" and "Sort By" sections.
struct SortConfigSheet: View {
    @Binding var activeSortConfig: [SortLevel]
    let hasOverride: Bool
    let onConfigChange: ([SortLevel]?) async -> Void
    var listType: String = "grocery"
    @Environment(\.dismiss) private var dismiss
    
    @State private var groupLevels: [SortLevel] = []
    @State private var sortOnlyLevels: [SortLevel] = []
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
    
    private var validLevels: [SortLevel] {
        let config = ListTypes.getConfig(listType)
        return config.sortLevels.compactMap { SortLevel(rawValue: $0) }
    }
    
    private var validGroupLevels: [SortLevel] {
        validLevels.filter { SortPipeline.isGroupingLevel($0) }
    }
    
    private var validSortOnlyLevels: [SortLevel] {
        validLevels.filter { !SortPipeline.isGroupingLevel($0) }
    }
    
    private var unusedGroupLevels: [SortLevel] {
        validGroupLevels.filter { !groupLevels.contains($0) }
    }
    
    private var unusedSortOnlyLevels: [SortLevel] {
        validSortOnlyLevels.filter { !sortOnlyLevels.contains($0) }
    }
    
    private var canAddMoreGroupLevels: Bool {
        groupLevels.count < SortPipeline.maxGroupLevels && !unusedGroupLevels.isEmpty
    }
    
    private var canAddMoreSortOnlyLevels: Bool {
        sortOnlyLevels.count < SortPipeline.maxSortOnlyLevels && !unusedSortOnlyLevels.isEmpty
    }
    
    private var hasGroupingLevelsAvailable: Bool {
        !validGroupLevels.isEmpty
    }
    
    var body: some View {
        NavigationStack {
            Form {
                if hasGroupingLevelsAvailable {
                    groupBySection
                }
                
                sortBySection
                
                if hasOverride {
                    Section {
                        Button {
                            Task {
                                let typeDefault = SortPipeline.getDefaultConfig(for: listType)
                                await onConfigChange(typeDefault)
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
            .navigationTitle("Organize")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                        .foregroundStyle(brandGreen)
                }
            }
            .onAppear {
                let partitioned = SortPipeline.partitionConfig(activeSortConfig)
                groupLevels = partitioned.groupLevels
                sortOnlyLevels = partitioned.sortOnlyLevels
            }
        }
    }
    
    // MARK: - Group By Section
    
    private var groupBySection: some View {
        Section {
            if groupLevels.isEmpty {
                Text("No grouping — items shown in a flat list")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .italic()
            } else {
                ForEach(groupLevels, id: \.self) { level in
                    HStack {
                        Button {
                            removeGroupLevel(level)
                        } label: {
                            Image(systemName: "minus.circle.fill")
                                .foregroundStyle(.red)
                                .font(.title3)
                        }
                        .buttonStyle(.plain)
                        
                        Text(Self.levelLabels[level] ?? level.rawValue)
                        
                        Spacer()
                    }
                }
                .onMove(perform: moveGroupLevel)
            }
            
            if canAddMoreGroupLevels {
                ForEach(unusedGroupLevels, id: \.self) { level in
                    Button {
                        addGroupLevel(level)
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
        } header: {
            Text("Group By")
        } footer: {
            Text("Items are grouped under these headings.")
        }
    }
    
    // MARK: - Sort By Section
    
    private var sortBySection: some View {
        Section {
            ForEach(sortOnlyLevels, id: \.self) { level in
                HStack {
                    if sortOnlyLevels.count > 1 {
                        Button {
                            removeSortOnlyLevel(level)
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
            .onMove(perform: moveSortOnlyLevel)
            
            if canAddMoreSortOnlyLevels {
                ForEach(unusedSortOnlyLevels, id: \.self) { level in
                    Button {
                        addSortOnlyLevel(level)
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
        } header: {
            Text("Sort By")
        } footer: {
            if groupLevels.isEmpty {
                Text("Items are sorted by these fields.")
            } else {
                Text("Items are sorted within groups by these fields.")
            }
        }
    }
    
    // MARK: - Group Level Actions
    
    private func moveGroupLevel(from source: IndexSet, to destination: Int) {
        groupLevels.move(fromOffsets: source, toOffset: destination)
        persistChange()
    }
    
    private func removeGroupLevel(_ level: SortLevel) {
        groupLevels.removeAll { $0 == level }
        formId = UUID()
        persistChange()
    }
    
    private func addGroupLevel(_ level: SortLevel) {
        guard groupLevels.count < SortPipeline.maxGroupLevels && !groupLevels.contains(level) else { return }
        groupLevels.append(level)
        formId = UUID()
        persistChange()
    }
    
    // MARK: - Sort Only Level Actions
    
    private func moveSortOnlyLevel(from source: IndexSet, to destination: Int) {
        sortOnlyLevels.move(fromOffsets: source, toOffset: destination)
        persistChange()
    }
    
    private func removeSortOnlyLevel(_ level: SortLevel) {
        guard sortOnlyLevels.count > 1 else { return }
        sortOnlyLevels.removeAll { $0 == level }
        formId = UUID()
        persistChange()
    }
    
    private func addSortOnlyLevel(_ level: SortLevel) {
        guard sortOnlyLevels.count < SortPipeline.maxSortOnlyLevels && !sortOnlyLevels.contains(level) else { return }
        sortOnlyLevels.append(level)
        formId = UUID()
        persistChange()
    }
    
    // MARK: - Persistence
    
    private func persistChange() {
        let combined = SortPipeline.combineConfig(groupLevels: groupLevels, sortOnlyLevels: sortOnlyLevels)
        activeSortConfig = combined
        Task {
            await onConfigChange(combined)
        }
    }
}
