import SwiftUI

struct EditItemSheet: View {
    let item: Item
    let stores: [Store]
    let listCategories: [CategoryDef]
    let listType: String
    let onSave: (String, Int, Decimal?, UUID?, Bool, String?, String, String?, Bool, Date?, RecurrenceRule?, Int?) -> Void
    let onImageTap: () -> Void
    
    @Environment(\.dismiss) private var dismiss
    @Environment(NotificationService.self) private var notificationService
    
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
    @State private var selectedRecurrenceType: String
    @State private var customInterval: Int
    @State private var customFrequency: String
    @State private var selectedDaysOfWeek: Set<Int>
    @State private var selectedReminderDays: Int?
    @State private var showPermissionDenied = false
    
    private var typeConfig: ListTypeConfig { ListTypes.getConfig(listType) }
    
    private let recurrenceTypes = [
        ("none", "None"),
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("biweekly", "Biweekly"),
        ("monthly", "Monthly"),
        ("yearly", "Yearly"),
        ("custom", "Custom")
    ]
    
    private let frequencyOptions = [
        ("day", "Day"),
        ("week", "Week"),
        ("month", "Month"),
        ("year", "Year")
    ]
    
    private let daysOfWeek = [
        (0, "S", "Sunday"),
        (1, "M", "Monday"),
        (2, "T", "Tuesday"),
        (3, "W", "Wednesday"),
        (4, "T", "Thursday"),
        (5, "F", "Friday"),
        (6, "S", "Saturday")
    ]
    
    private let reminderOptions: [(Int?, String)] = [
        (nil, "No reminder"),
        (0, "Same day"),
        (1, "1 day before"),
        (2, "2 days before"),
        (3, "3 days before"),
        (7, "1 week before")
    ]
    
    init(
        item: Item,
        stores: [Store],
        listCategories: [CategoryDef],
        listType: String = "grocery",
        onSave: @escaping (String, Int, Decimal?, UUID?, Bool, String?, String, String?, Bool, Date?, RecurrenceRule?, Int?) -> Void,
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
        _selectedReminderDays = State(initialValue: item.reminderDaysBefore)
        
        // Initialize recurrence state from existing rule
        if let rule = item.recurrenceRule {
            _selectedRecurrenceType = State(initialValue: rule.type)
            _customInterval = State(initialValue: rule.interval ?? 1)
            _customFrequency = State(initialValue: rule.frequency ?? "week")
            _selectedDaysOfWeek = State(initialValue: Set(rule.daysOfWeek ?? []))
        } else {
            _selectedRecurrenceType = State(initialValue: "none")
            _customInterval = State(initialValue: 1)
            _customFrequency = State(initialValue: "week")
            _selectedDaysOfWeek = State(initialValue: [])
        }
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
    
    private func buildRecurrenceRule() -> RecurrenceRule? {
        guard hasDueDate else { return nil }
        
        switch selectedRecurrenceType {
        case "none":
            return nil
        case "custom":
            return RecurrenceRule(
                type: "custom",
                interval: customInterval,
                frequency: customFrequency,
                daysOfWeek: customFrequency == "week" ? Array(selectedDaysOfWeek).sorted() : nil
            )
        default:
            return RecurrenceRule(type: selectedRecurrenceType, interval: nil, frequency: nil, daysOfWeek: nil)
        }
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
                                    selectedRecurrenceType = "none"
                                    selectedReminderDays = nil
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
                
                // Recurrence — conditional (shown only when due date is set and recurrence is supported)
                if typeConfig.fields.dueDate && typeConfig.fields.recurrence && hasDueDate {
                    Section("Repeat") {
                        Picker("Recurrence", selection: $selectedRecurrenceType) {
                            ForEach(recurrenceTypes, id: \.0) { type in
                                Text(type.1).tag(type.0)
                            }
                        }
                        
                        if selectedRecurrenceType == "custom" {
                            Stepper("Every \(customInterval) \(customFrequency)\(customInterval > 1 ? "s" : "")", value: $customInterval, in: 1...99)
                            
                            Picker("Frequency", selection: $customFrequency) {
                                ForEach(frequencyOptions, id: \.0) { option in
                                    Text(option.1).tag(option.0)
                                }
                            }
                            
                            if customFrequency == "week" {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("On days")
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                    HStack(spacing: 8) {
                                        ForEach(daysOfWeek, id: \.0) { day in
                                            Button {
                                                if selectedDaysOfWeek.contains(day.0) {
                                                    selectedDaysOfWeek.remove(day.0)
                                                } else {
                                                    selectedDaysOfWeek.insert(day.0)
                                                }
                                            } label: {
                                                Text(day.1)
                                                    .font(.caption.bold())
                                                    .frame(width: 32, height: 32)
                                                    .background(selectedDaysOfWeek.contains(day.0) ? Color.accentColor : Color(.systemGray5))
                                                    .foregroundStyle(selectedDaysOfWeek.contains(day.0) ? .white : .primary)
                                                    .clipShape(Circle())
                                            }
                                            .buttonStyle(.plain)
                                            .accessibilityLabel(day.2)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // Reminder — conditional (shown only when due date is set and reminder is supported)
                if typeConfig.fields.dueDate && typeConfig.fields.reminder && hasDueDate {
                    Section("Reminder") {
                        Picker("Remind me", selection: $selectedReminderDays) {
                            ForEach(reminderOptions, id: \.0) { option in
                                Text(option.1).tag(option.0)
                            }
                        }
                        .onChange(of: selectedReminderDays) { _, newValue in
                            if newValue != nil && !notificationService.permissionGranted {
                                Task {
                                    let granted = await notificationService.requestPermission()
                                    if !granted {
                                        selectedReminderDays = nil
                                        showPermissionDenied = true
                                    }
                                }
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
                        let recurrenceRule = buildRecurrenceRule()
                        let reminderDays = hasDueDate ? selectedReminderDays : nil
                        onSave(trimmedName, quantity, price, selectedStoreId, clearStoreId, selectedCategory, selectedUnit, selectedRsvpStatus, clearRsvp, selectedDueDate, recurrenceRule, reminderDays)
                        dismiss()
                    }
                    .disabled(isSaveDisabled)
                }
            }
            .sheet(isPresented: $showingHistory) {
                CompletionHistorySheet(listId: item.listId, itemName: item.name)
            }
            .alert("Notifications Disabled", isPresented: $showPermissionDenied) {
                Button("OK", role: .cancel) { }
            } message: {
                Text("To receive reminders, enable notifications in Settings > Gather Lists > Notifications.")
            }
        }
    }
}
