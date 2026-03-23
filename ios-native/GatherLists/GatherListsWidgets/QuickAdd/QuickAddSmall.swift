import SwiftUI
import WidgetKit

/// Small widget view showing list emoji, name, and a prominent "+" button.
struct QuickAddSmall: View {
    var entry: QuickAddEntry
    
    @Environment(\.colorScheme) private var colorScheme
    
    private var backgroundColor: Color {
        if let hex = entry.listColor {
            return Color(hex: hex).opacity(colorScheme == .dark ? 0.3 : 0.15)
        }
        return Color(.systemBackground)
    }
    
    private var accentColor: Color {
        if let hex = entry.listColor {
            return Color(hex: hex)
        }
        return .accentColor
    }
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Text(entry.listEmoji ?? "📝")
                    .font(.title3)
                
                Text(entry.listName)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(1)
                    .truncationMode(.tail)
                
                Spacer()
            }
            
            Spacer()
            
            Button(intent: QuickAddPromptIntent(listId: entry.listId.uuidString)) {
                HStack {
                    Image(systemName: "plus")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    Text("Add Item")
                        .font(.headline)
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(accentColor)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(backgroundColor, for: .widget)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }
}
