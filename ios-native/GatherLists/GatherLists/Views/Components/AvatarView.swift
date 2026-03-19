import SwiftUI

struct AvatarView: View {
    let imageURL: String?
    let displayName: String
    var color: Color = .blue
    var size: CGFloat = 24
    
    var body: some View {
        if let urlString = imageURL, !urlString.isEmpty, let url = URL(string: urlString) {
            AsyncImage(url: url) { image in
                image
                    .resizable()
                    .scaledToFill()
            } placeholder: {
                initialsCircle
            }
            .frame(width: size, height: size)
            .clipShape(Circle())
        } else {
            initialsCircle
        }
    }
    
    private var initialsCircle: some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .overlay(
                Text(initial)
                    .font(.system(size: size * 0.5))
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
            )
    }
    
    private var initial: String {
        String(displayName.prefix(1)).uppercased()
    }
}

#Preview {
    VStack(spacing: 16) {
        AvatarView(imageURL: nil, displayName: "Alice")
        AvatarView(imageURL: nil, displayName: "Bob", color: .orange, size: 36)
        AvatarView(imageURL: nil, displayName: "Charlie", color: .purple, size: 48)
        AvatarView(imageURL: "https://example.com/avatar.jpg", displayName: "Dan", size: 48)
    }
    .padding()
}
