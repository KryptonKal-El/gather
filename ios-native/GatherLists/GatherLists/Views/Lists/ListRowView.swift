import SwiftUI

/// A row displaying a single list with emoji, name, item count, and optional shared badge.
struct ListRowView: View {
    let list: GatherList
    let isShared: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(Color(hex: list.color))
                .frame(width: 12, height: 12)
            
            if let emoji = list.emoji, !emoji.isEmpty {
                Text(emoji)
                    .font(.title2)
            } else {
                Image(systemName: "list.bullet")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(list.name)
                        .font(.body)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    if isShared {
                        Text("Shared")
                            .font(.caption)
                            .fontWeight(.medium)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.blue.opacity(0.15))
                            .foregroundStyle(.blue)
                            .clipShape(Capsule())
                    }
                }
                
                HStack(spacing: 6) {
                    Text("\(list.itemCount) items")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text("·")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    Text(ListTypes.getConfig(list.type).label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .alignmentGuide(.listRowSeparatorLeading) { d in d[.leading] }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }
}
