import SwiftUI

/// One meal slot in the week: the meal name and what's planned for it.
struct MealSlotRow: View {
    let meal: MealType
    let entry: MealPlanEntry?
    let recipe: Recipe?
    var onToggleLock: (() -> Void)?
    var onSwap: (() -> Void)?

    private var isInactive: Bool {
        entry?.kind == .skip
    }

    var body: some View {
        HStack(spacing: 12) {
            thumbnail

            VStack(alignment: .leading, spacing: 2) {
                Text(meal.label.uppercased())
                    .font(.quicksand(.caption2, weight: .bold))
                    .foregroundStyle(.secondary)
                Text(entry?.displayTitle ?? "Add a meal")
                    .font(.quicksand(.body, weight: entry == nil ? .regular : .semibold))
                    .foregroundStyle(entry == nil ? Color.secondary : Color.primary)
                    .strikethrough(isInactive, color: .secondary)
                    .lineLimit(2)
                if let note = entry?.note, !note.isEmpty {
                    Text(note)
                        .font(.quicksand(.caption))
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                if let entry, entry.isSuggested, let reason = entry.suggestionReason {
                    Label(reason, systemImage: "sparkles")
                        .font(.quicksand(.caption))
                        .foregroundStyle(Color.brandGreen)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 0)

            if entry?.cookedAt != nil {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.brandGreen)
                    .accessibilityLabel("Cooked")
            } else if let entry, entry.isSuggested {
                suggestionControls(entry)
            }
        }
        .padding(.vertical, 2)
        .opacity(isInactive ? 0.6 : 1)
    }

    @ViewBuilder
    private func suggestionControls(_ entry: MealPlanEntry) -> some View {
        HStack(spacing: 4) {
            if let onToggleLock {
                Button(action: onToggleLock) {
                    Image(systemName: entry.isLocked ? "lock.fill" : "lock.open")
                        .foregroundStyle(entry.isLocked ? Color.brandGreen : Color.secondary)
                        .frame(width: 36, height: 36)
                }
                .accessibilityLabel(entry.isLocked ? "Unlock \(meal.label)" : "Keep \(meal.label)")
            }
            if let onSwap, !entry.isLocked {
                Button(action: onSwap) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .foregroundStyle(Color.secondary)
                        .frame(width: 36, height: 36)
                }
                .accessibilityLabel("Swap \(meal.label)")
            }
        }
        .buttonStyle(.borderless)
    }

    @ViewBuilder
    private var thumbnail: some View {
        let size: CGFloat = 44
        if let urlString = recipe?.imageUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                iconTile(systemImage: "book", size: size)
            }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        } else {
            iconTile(systemImage: entry?.kind.systemImage ?? meal.systemImage, size: size)
        }
    }

    private func iconTile(systemImage: String, size: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 10)
            .fill(entry == nil ? Color.secondary.opacity(0.08) : Color.brandGreen.opacity(0.15))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: entry == nil ? "plus" : systemImage)
                    .foregroundStyle(entry == nil ? Color.secondary : Color.brandGreen)
            }
    }
}
