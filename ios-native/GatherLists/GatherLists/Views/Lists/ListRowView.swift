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
            
            Text("\(list.itemCount)")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color(.systemGray5))
                .clipShape(Capsule())
            
            if list.type != "grocery" {
                Text(ListTypes.getConfig(list.type).label)
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(.systemGray5))
                    .clipShape(Capsule())
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 12)
        .background(Color(.systemBackground))
        .contentShape(Rectangle())
    }
}
