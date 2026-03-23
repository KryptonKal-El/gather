import SwiftUI

struct EditItemSheet: View {
    let item: Item
    let stores: [Store]
    let listCategories: [CategoryDef]
    let listType: String
    let onSave: (String, Int, Decimal?, UUID?, Bool, String?, String, String?, Bool, Date?) -> Void
    let onImageTap: () -> Void
    
    @Environment(\.dismiss) private var dismiss
    
    @State private var name: String
    @State private var quantity: Int
    @State private var priceText: String
    @State private var selectedStoreId: UUID?
    @State private var selectedCategory: String?
    @State private var selectedUnit: String
    @State private var selectedRsvpStatus: String?
    @State private var selectedDueDate: Date?
    @State private var hasDueDate: Bool
    @State private var showingHistory = false
    
    private var typeConfig: ListTypeConfig { ListTypes.getConfig(listType) }
    
    init(
        item: Item,
        stores: [Store],
        listCategories: [CategoryDef],
        listType: String = "grocery",
        onSave: @escaping (String, Int, Decimal?, UUID?, Bool, String?, String, String?, Bool, Date?) -> Void,
        onImageTap: @escaping () -> Void
    ) {
        self.item = item
        self.stores = stores
        self.listCategories = listCategories
        self.listType = listType
        self.onSave = onSave
        self.onImageTap = onImageTap
        
        _name = State(initialValue: item.name)
        _quantity = State(initialValue: item.quantity)
        _priceText = State(initialValue: item.price.map { "\($0)" } ?? "")
        _selectedStoreId = State(initialValue: item.storeId)
        _selectedCategory = State(initialValue: item.category)
        _selectedUnit = State(initialValue: item.unit)
        _selectedRsvpStatus = State(initialValue: item.rsvpStatus)
        _selectedDueDate = State(initialValue: item.dueDate)
        _hasDueDate = State(initialValue: item.dueDate != nil)
    }
    
    private var availableCategories: [CategoryDef] {
        if !listCategories.isEmpty {
            return listCategories
        }
        return CategoryDefinitions.defaults
    }
    
    private var isSaveDisabled: Bool {
        name.trimmingCharacters(in: .whitespaces).isEmpty
    }
    
    var body: some View {
        NavigationStack {
            Form {
                // Name — always shown
                Section {
                    TextField("Item name", text: $name)
                }
                
                // Quantity & Unit & Price — conditional
                if typeConfig.fields.quantity || typeConfig.fields.price {
                    Section {
                        if typeConfig.fields.quantity {
                            Stepper("\(typeConfig.quantityLabel ?? "Quantity"): \(quantity)", value: $quantity, in: 1...99)
                        }
                        if typeConfig.fields.unit {
                            Picker("Unit", selection: $selectedUnit) {
                                ForEach(ItemUnit.allCases) { unit in
                                    Text(unit.displayName).tag(unit.rawValue)
                                }
                            }
                        }
                        if typeConfig.fields.price {
                            TextField("Price", text: $priceText)
                                .keyboardType(.decimalPad)
                        }
                    }
                }
                
                // Store — conditional
                if typeConfig.fields.store {
                    Section {
                        Picker("Store", selection: $selectedStoreId) {
                            Text("None").tag(UUID?.none)
                            ForEach(stores) { store in
                                Text(store.name).tag(UUID?.some(store.id))
                            }
                        }
                    }
                    .onChange(of: selectedStoreId) {
                        selectedCategory = nil
                    }
                }
                
                // Category — conditional
                if typeConfig.fields.category {
                    Section {
                        Picker("Category", selection: $selectedCategory) {
                            Text("None").tag(String?.none)
                            ForEach(availableCategories, id: \.key) { cat in
                                Text(cat.name).tag(String?.some(cat.key))
                            }
                        }
                    }
                }
                
                // RSVP — conditional (guest list only)
                if typeConfig.fields.rsvpStatus {
                    Section {
                        Picker("RSVP Status", selection: $selectedRsvpStatus) {
                            Text("None").tag(String?.none)
                            ForEach(["invited", "confirmed", "declined", "maybe", "not_invited"], id: \.self) { status in
                                Text(status == "not_invited" ? "Not Yet Invited" : status.capitalized).tag(String?.some(status))
                            }
                        }
                    }
                }
                
                // Due Date — conditional
                if typeConfig.fields.dueDate {
                    Section("Due Date") {
                        Toggle("Has Due Date", isOn: $hasDueDate)
                            .onChange(of: hasDueDate) { _, newValue in
                                if newValue && selectedDueDate == nil {
                                    selectedDueDate = Date()
                                } else if !newValue {
                                    selectedDueDate = nil
                                }
                            }
                        if hasDueDate {
                            DatePicker(
                                "Date",
                                selection: Binding(
                                    get: { selectedDueDate ?? Date() },
                                    set: { selectedDueDate = $0 }
                                ),
                                displayedComponents: .date
                            )
                        }
                    }
                }
                
                // Image — conditional
                if typeConfig.fields.image {
                    Section {
                        if let imageUrl = item.imageUrl, !imageUrl.isEmpty, let url = URL(string: imageUrl) {
                            HStack {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .scaledToFill()
                                    case .failure:
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color(.systemGray5))
                                            .overlay {
                                                Image(systemName: "exclamationmark.triangle")
                                                    .foregroundStyle(.secondary)
                                            }
                                    case .empty:
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color(.systemGray5))
                                    @unknown default:
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Color(.systemGray5))
                                    }
                                }
                                .frame(width: 60, height: 60)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                
                                Spacer()
                                
                                Button("Change Image") {
                                    onImageTap()
                                    dismiss()
                                }
                            }
                        } else {
                            Button("Add Image") {
                                onImageTap()
                                dismiss()
                            }
                        }
                    }
                }
                
                // Completion History — shown when item has recurrence or parent
                if item.recurrenceRule != nil || item.parentItemId != nil {
                    Section {
                        Button {
                            showingHistory = true
                        } label: {
                            Label("Completion History", systemImage: "clock.arrow.circlepath")
                        }
                    }
                }
            }
            .navigationTitle("Edit Item")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let trimmedName = name.trimmingCharacters(in: .whitespaces)
                        let price = Decimal(string: priceText)
                        let clearStoreId = item.storeId != nil && selectedStoreId == nil
                        let clearRsvp = item.rsvpStatus != nil && selectedRsvpStatus == nil
                        onSave(trimmedName, quantity, price, selectedStoreId, clearStoreId, selectedCategory, selectedUnit, selectedRsvpStatus, clearRsvp, selectedDueDate)
                        dismiss()
                    }
                    .disabled(isSaveDisabled)
                }
            }
            .sheet(isPresented: $showingHistory) {
                CompletionHistorySheet(listId: item.listId, itemName: item.name)
            }
        }
    }
}
