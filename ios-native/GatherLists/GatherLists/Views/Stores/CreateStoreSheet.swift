import SwiftUI
import UIKit

/// Sheet for creating a new store with name and color selection.
struct CreateStoreSheet: View {
    let viewModel: StoreViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var name = ""
    @State private var selectedPresetColor: String? = "#1565c0"
    @State private var customColor: Color = .blue
    @State private var isCreating = false
    
    private let presetColors = [
        "#1565c0", "#6a1b9a", "#00838f", "#2e7d32", "#ef6c00",
        "#c62828", "#4527a0", "#00695c", "#ad1457", "#37474f",
        "#f9a825", "#4e342e", "#1b5e20", "#283593", "#bf360c",
        "#0277bd", "#558b2f", "#7b1fa2"
    ]
    
    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isCreating
    }
    
    private var effectiveColor: String {
        if let preset = selectedPresetColor {
            return preset
        }
        return colorToHex(customColor)
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Store name", text: $name)
                        .textInputAutocapitalization(.words)
                }
                
                Section("Color") {
                    presetColorGrid
                    
                    ColorPicker("Custom Color", selection: $customColor)
                        .onChange(of: customColor) {
                            selectedPresetColor = nil
                        }
                }
            }
            .navigationTitle("New Store")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(isCreating)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        createStore()
                    }
                    .fontWeight(.semibold)
                    .disabled(!canCreate)
                }
            }
        }
        .interactiveDismissDisabled(isCreating)
    }
    
    private var presetColorGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 36))], spacing: 12) {
            ForEach(presetColors, id: \.self) { colorHex in
                Button {
                    selectedPresetColor = colorHex
                } label: {
                    Circle()
                        .fill(Color(hex: colorHex))
                        .frame(width: 36, height: 36)
                        .overlay {
                            if selectedPresetColor == colorHex {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 14, weight: .bold))
                                    .foregroundStyle(.white)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func createStore() {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        
        isCreating = true
        Task {
            await viewModel.addStore(name: trimmedName, color: effectiveColor)
            dismiss()
        }
    }
    
    private func colorToHex(_ color: Color) -> String {
        let uiColor = UIColor(color)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        return String(format: "#%02x%02x%02x", Int(r * 255), Int(g * 255), Int(b * 255))
    }
}
