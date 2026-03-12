import SwiftUI

struct EditItemSheet: View {
    let item: Item
    let stores: [Store]
    let listType: String
    let onSave: (String, Int, Decimal?, UUID?, Bool, String?, String, String?, Bool) -> Void
    let onImageTap: () -> Void
    
    @Environment(\.dismiss) private var dismiss
    
    @State private var name: String
    @State private var quantity: Int
    @State private var priceText: String
    @State private var selectedStoreId: UUID?
    @State private var selectedCategory: String?
    @State private var selectedUnit: String
    @State private var selectedRsvpStatus: String?
    
    private var typeConfig: ListTypeConfig { ListTypes.getConfig(listType) }
    
    init(
        item: Item,
        stores: [Store],
        listType: String = "grocery",
        onSave: @escaping (String, Int, Decimal?, UUID?, Bool, String?, String, String?, Bool) -> Void,
        onImageTap: @escaping () -> Void
    ) {
        self.item = item
        self.stores = stores
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
    }
    
    private var availableCategories: [CategoryDef] {
        // Use type-specific categories if available
        if let typeCategories = typeConfig.categories {
            return typeCategories.map { CategoryDef(key: $0.key, name: $0.name, color: $0.color, keywords: $0.keywords) }
        }
        // Fall back to store categories or defaults
        if let storeId = selectedStoreId,
           let store = stores.first(where: { $0.id == storeId }),
           !store.categories.isEmpty {
            return store.categories
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
                            ForEach(["invited", "confirmed", "declined", "maybe"], id: \.self) { status in
                                Text(status.capitalized).tag(String?.some(status))
                            }
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
                        onSave(trimmedName, quantity, price, selectedStoreId, clearStoreId, selectedCategory, selectedUnit, selectedRsvpStatus, clearRsvp)
                        dismiss()
                    }
                    .disabled(isSaveDisabled)
                }
            }
        }
    }
}
