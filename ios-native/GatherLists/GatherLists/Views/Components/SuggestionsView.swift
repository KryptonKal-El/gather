import SwiftUI

/// Displays AI-powered item suggestions as tappable chips with category-colored dots.
struct SuggestionsView: View {
    let suggestions: [ItemSuggestion]
    let onAdd: (String) -> Void
    
    private let collapsedLimit = 4
    @State private var isExpanded = false
    
    var body: some View {
        if suggestions.isEmpty { EmptyView() }
        else {
            VStack(alignment: .leading, spacing: 8) {
                Text("AI Suggestions")
                    .font(.headline)
                Text("Based on your shopping habits")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                let visible = shouldCollapse && !isExpanded
                    ? Array(suggestions.prefix(collapsedLimit))
                    : suggestions
                
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
                    ForEach(visible) { suggestion in
                        Button {
                            onAdd(suggestion.name)
                        } label: {
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(categoryColor(for: suggestion.category))
                                    .frame(width: 8, height: 8)
                                
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(suggestion.name)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(.primary)
                                    Text(suggestion.reason)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                                
                                Spacer(minLength: 0)
                                
                                Image(systemName: "plus")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .strokeBorder(.quaternary, lineWidth: 0.5)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                
                if shouldCollapse {
                    Button {
                        withAnimation { isExpanded.toggle() }
                    } label: {
                        Text(isExpanded ? "Show less" : "Show \(suggestions.count - collapsedLimit) more")
                            .font(.caption)
                            .foregroundStyle(.blue)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
    }
    
    private var shouldCollapse: Bool {
        suggestions.count > collapsedLimit
    }
    
    private func categoryColor(for key: String) -> Color {
        if let hex = CategoryDefinitions.category(forKey: key)?.color {
            return Color(hex: hex)
        }
        return Color.gray
    }
}
