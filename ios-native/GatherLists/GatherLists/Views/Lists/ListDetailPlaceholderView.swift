import SwiftUI

/// Placeholder view for list detail — will be replaced with full implementation in Phase 3.
struct ListDetailPlaceholderView: View {
    let list: GatherList
    
    var body: some View {
        VStack(spacing: 16) {
            if let emoji = list.emoji, !emoji.isEmpty {
                Text(emoji)
                    .font(.system(size: 64))
            } else {
                Image(systemName: "list.bullet")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
            }
            
            Text(list.name)
                .font(.title)
                .fontWeight(.semibold)
            
            Text("\(list.itemCount) items")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            
            Text("Items view coming in Phase 3")
                .font(.caption)
                .foregroundStyle(.tertiary)
                .padding(.top, 24)
        }
        .navigationTitle(list.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
