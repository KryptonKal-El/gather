import SwiftUI

struct AvatarGroupView: View {
    let collaborators: [Profile]
    var maxDisplay: Int = 3
    var size: CGFloat = 24
    var color: Color = .blue
    
    private var displayedProfiles: [Profile] {
        Array(collaborators.prefix(maxDisplay))
    }
    
    private var overflowCount: Int {
        max(0, collaborators.count - maxDisplay)
    }
    
    private var overlapOffset: CGFloat {
        size * 0.65
    }
    
    private var totalWidth: CGFloat {
        let itemCount = displayedProfiles.count + (overflowCount > 0 ? 1 : 0)
        guard itemCount > 0 else { return 0 }
        return size + (CGFloat(itemCount - 1) * overlapOffset)
    }
    
    var body: some View {
        HStack {
            Spacer(minLength: 0)
            ZStack(alignment: .leading) {
                ForEach(Array(displayedProfiles.enumerated()), id: \.element.id) { index, profile in
                    avatarWithRing(for: profile)
                        .offset(x: CGFloat(index) * overlapOffset)
                }
                
                if overflowCount > 0 {
                    overflowCircle
                        .offset(x: CGFloat(displayedProfiles.count) * overlapOffset)
                }
            }
            .frame(width: totalWidth, height: size)
        }
    }
    
    private func avatarWithRing(for profile: Profile) -> some View {
        AvatarView(
            imageURL: profile.avatarUrl,
            displayName: profile.displayName ?? "?",
            color: color,
            size: size
        )
        .background(
            Circle()
                .fill(Color(uiColor: .systemBackground))
                .frame(width: size + 3, height: size + 3)
        )
    }
    
    private var overflowCircle: some View {
        Circle()
            .fill(Color.gray)
            .frame(width: size, height: size)
            .overlay(
                Text("+\(overflowCount)")
                    .font(.system(size: size * 0.4))
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
            )
            .background(
                Circle()
                    .fill(Color(uiColor: .systemBackground))
                    .frame(width: size + 3, height: size + 3)
            )
    }
}

#Preview {
    let profiles = [
        Profile(id: UUID(), avatarUrl: nil, displayName: "Alice"),
        Profile(id: UUID(), avatarUrl: nil, displayName: "Bob"),
        Profile(id: UUID(), avatarUrl: nil, displayName: "Charlie"),
        Profile(id: UUID(), avatarUrl: nil, displayName: "Diana"),
        Profile(id: UUID(), avatarUrl: nil, displayName: "Eve")
    ]
    
    VStack(spacing: 24) {
        Text("3 of 5 collaborators")
            .font(.caption)
        AvatarGroupView(collaborators: profiles)
        
        Text("Max 2 display")
            .font(.caption)
        AvatarGroupView(collaborators: profiles, maxDisplay: 2)
        
        Text("Larger size")
            .font(.caption)
        AvatarGroupView(collaborators: profiles, size: 36, color: .purple)
        
        Text("2 collaborators (no overflow)")
            .font(.caption)
        AvatarGroupView(collaborators: Array(profiles.prefix(2)))
        
        Text("Empty")
            .font(.caption)
        AvatarGroupView(collaborators: [])
    }
    .padding()
}
