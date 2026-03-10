import SwiftUI

struct StackedLogoView: View {
    var scale: CGFloat = 1.0
    
    private let iconSize: CGFloat = 120
    private let iconCornerRadius: CGFloat = 28
    
    private let gradientStart = Color(hex: "#B5E8C8")
    private let gradientEnd = Color(hex: "#A8D8EA")
    private let shadowColor = Color(hex: "#5BA08A")
    
    private let primaryTextColor = Color(hex: "#3D7A63")
    private let secondaryTextColor = Color(hex: "#85BFA8")
    private let heartColor = Color(hex: "#F9A8C9")
    
    var body: some View {
        VStack(spacing: 12 * scale) {
            iconView
            titleText
            taglineText
        }
    }
    
    private var iconView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: iconCornerRadius * scale)
                .fill(
                    LinearGradient(
                        colors: [gradientStart, gradientEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: iconSize * scale, height: iconSize * scale)
                .shadow(
                    color: shadowColor.opacity(0.15),
                    radius: 8 * scale,
                    x: 0,
                    y: 4 * scale
                )
            
            checklistItems
            
            heartShape
                .fill(heartColor.opacity(0.92))
                .frame(width: 32 * scale, height: 31 * scale)
                .offset(x: 41 * scale, y: -42 * scale)
        }
    }
    
    private var checklistItems: some View {
        VStack(spacing: 10 * scale) {
            checklistRow(barWidth: 52)
            checklistRow(barWidth: 40)
            checklistRow(barWidth: 48)
        }
    }
    
    private func checklistRow(barWidth: CGFloat) -> some View {
        HStack(spacing: 7 * scale) {
            Circle()
                .fill(Color.white.opacity(0.95))
                .frame(width: 12 * scale, height: 12 * scale)
            
            RoundedRectangle(cornerRadius: 5 * scale)
                .fill(Color.white.opacity(0.95))
                .frame(width: barWidth * scale, height: 10 * scale)
        }
    }
    
    private var heartShape: some Shape {
        HeartShape()
    }
    
    private var titleText: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("Gather ")
                .font(.system(size: 52 * scale, weight: .heavy, design: .rounded))
                .foregroundColor(primaryTextColor)
                .tracking(-1 * scale)
            
            Text("Lists")
                .font(.system(size: 28 * scale, weight: .semibold, design: .rounded))
                .foregroundColor(secondaryTextColor)
                .tracking(-1 * scale)
        }
    }
    
    private var taglineText: some View {
        Text("Gather your lists, meals, and more.")
            .font(.system(size: 13.5 * scale, weight: .semibold, design: .rounded))
            .foregroundColor(secondaryTextColor)
            .tracking(0.4 * scale)
    }
}

private struct HeartShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        
        let w = rect.width
        let h = rect.height
        
        // Heart path normalized from SVG coordinates
        // Original path: M491,442 C491,442 475,431 475,421 C475,415 479,411 483,411 C486,411 489,414 491,416 C493,414 496,411 499,411 C503,411 507,415 507,421 C507,431 491,442 491,442 Z
        // Normalized to 32x31 box (width 507-475=32, height 442-411=31)
        
        let scaleX = w / 32
        let scaleY = h / 31
        
        path.move(to: CGPoint(x: 16 * scaleX, y: 31 * scaleY))
        
        path.addCurve(
            to: CGPoint(x: 0 * scaleX, y: 10 * scaleY),
            control1: CGPoint(x: 16 * scaleX, y: 31 * scaleY),
            control2: CGPoint(x: 0 * scaleX, y: 20 * scaleY)
        )
        
        path.addCurve(
            to: CGPoint(x: 8 * scaleX, y: 0 * scaleY),
            control1: CGPoint(x: 0 * scaleX, y: 4 * scaleY),
            control2: CGPoint(x: 4 * scaleX, y: 0 * scaleY)
        )
        
        path.addCurve(
            to: CGPoint(x: 16 * scaleX, y: 5 * scaleY),
            control1: CGPoint(x: 11 * scaleX, y: 0 * scaleY),
            control2: CGPoint(x: 14 * scaleX, y: 3 * scaleY)
        )
        
        path.addCurve(
            to: CGPoint(x: 24 * scaleX, y: 0 * scaleY),
            control1: CGPoint(x: 18 * scaleX, y: 3 * scaleY),
            control2: CGPoint(x: 21 * scaleX, y: 0 * scaleY)
        )
        
        path.addCurve(
            to: CGPoint(x: 32 * scaleX, y: 10 * scaleY),
            control1: CGPoint(x: 28 * scaleX, y: 0 * scaleY),
            control2: CGPoint(x: 32 * scaleX, y: 4 * scaleY)
        )
        
        path.addCurve(
            to: CGPoint(x: 16 * scaleX, y: 31 * scaleY),
            control1: CGPoint(x: 32 * scaleX, y: 20 * scaleY),
            control2: CGPoint(x: 16 * scaleX, y: 31 * scaleY)
        )
        
        path.closeSubpath()
        
        return path
    }
}

#Preview {
    VStack(spacing: 40) {
        StackedLogoView()
        StackedLogoView(scale: 0.5)
    }
    .padding()
}

#Preview("Dark Mode") {
    VStack(spacing: 40) {
        StackedLogoView()
        StackedLogoView(scale: 0.5)
    }
    .padding()
    .preferredColorScheme(.dark)
}
