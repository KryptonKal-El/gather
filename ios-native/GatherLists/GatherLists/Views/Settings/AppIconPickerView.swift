import SwiftUI
import UIKit

/// Lets the user choose which app icon appears on their Home Screen.
struct AppIconPickerView: View {
    @Binding var selection: AppIconOption

    @State private var isChanging = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                ForEach(AppIconOption.allCases) { option in
                    Button {
                        handleSelect(option)
                    } label: {
                        row(for: option)
                    }
                    .buttonStyle(.plain)
                    .disabled(isChanging)
                }
            } footer: {
                if !UIApplication.shared.supportsAlternateIcons {
                    Text("This device doesn't support changing the app icon.")
                }
            }
        }
        .navigationTitle("App Icon")
        .navigationBarTitleDisplayMode(.inline)
        .alert(
            "Couldn't Change Icon",
            isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func row(for option: AppIconOption) -> some View {
        HStack(spacing: 14) {
            Image(option.previewImageName)
                .resizable()
                .frame(width: 60, height: 60)
                .clipShape(RoundedRectangle(cornerRadius: 13.5, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 13.5, style: .continuous)
                        .strokeBorder(.quaternary, lineWidth: 0.5)
                }
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(option.displayName)
                    .font(.quicksand(.body, weight: .semibold))
                Text(option.subtitle)
                    .font(.quicksand(.footnote))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if option == selection {
                Image(systemName: "checkmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.tint)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(option == selection ? .isSelected : [])
    }

    private func handleSelect(_ option: AppIconOption) {
        guard option != selection, UIApplication.shared.supportsAlternateIcons else { return }
        isChanging = true
        Task {
            defer { isChanging = false }
            do {
                try await UIApplication.shared.setAlternateIconName(option.iconName)
                selection = option
            } catch {
                errorMessage = "Please try again. (\(error.localizedDescription))"
            }
        }
    }
}
