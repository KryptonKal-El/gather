import SwiftUI

/// Custom pastel icons for list types, matching the Gather brand style.
struct ListTypeIconView: View {
    let typeId: String
    var size: CGFloat = 36
    
    // Brand palette
    private let mint = Color(hex: "#B5E8C8")
    private let sky = Color(hex: "#A8D8EA")
    private let forest = Color(hex: "#3D7A63")
    private let sage = Color(hex: "#85BFA8")
    private let blush = Color(hex: "#F9A8C9")
    
    var body: some View {
        switch typeId {
        case "grocery": groceryIcon
        case "todo": todoIcon
        case "basic": basicIcon
        case "packing": packingIcon
        case "guest_list": guestListIcon
        case "project": projectIcon
        default: groceryIcon
        }
    }
    
    // MARK: - Grocery Icon (Shopping bag with leaf)
    
    private var groceryIcon: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 36
            
            // Bag body
            var bagPath = Path()
            bagPath.move(to: CGPoint(x: 8 * scale, y: 12 * scale))
            bagPath.addLine(to: CGPoint(x: 10 * scale, y: 30 * scale))
            bagPath.addLine(to: CGPoint(x: 26 * scale, y: 30 * scale))
            bagPath.addLine(to: CGPoint(x: 28 * scale, y: 12 * scale))
            bagPath.closeSubpath()
            context.fill(bagPath, with: .color(mint))
            
            // Bag handle (arch)
            var handlePath = Path()
            handlePath.addArc(
                center: CGPoint(x: 18 * scale, y: 12 * scale),
                radius: 6 * scale,
                startAngle: .degrees(180),
                endAngle: .degrees(0),
                clockwise: false
            )
            context.stroke(handlePath, with: .color(forest), lineWidth: 2.5 * scale)
            
            // Leaf/carrot peeking out
            var leafPath = Path()
            leafPath.move(to: CGPoint(x: 18 * scale, y: 14 * scale))
            leafPath.addQuadCurve(
                to: CGPoint(x: 22 * scale, y: 6 * scale),
                control: CGPoint(x: 24 * scale, y: 12 * scale)
            )
            leafPath.addQuadCurve(
                to: CGPoint(x: 18 * scale, y: 14 * scale),
                control: CGPoint(x: 18 * scale, y: 8 * scale)
            )
            context.fill(leafPath, with: .color(forest))
        }
        .frame(width: size, height: size)
    }
    
    // MARK: - Todo Icon (Checkbox with checkmark)
    
    private var todoIcon: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 36
            
            // Rounded checkbox background
            let checkboxRect = CGRect(
                x: 6 * scale,
                y: 6 * scale,
                width: 24 * scale,
                height: 24 * scale
            )
            let checkboxPath = Path(roundedRect: checkboxRect, cornerRadius: 5 * scale)
            context.fill(checkboxPath, with: .color(sky))
            
            // Mint highlight (inner glow effect)
            let highlightRect = CGRect(
                x: 8 * scale,
                y: 8 * scale,
                width: 12 * scale,
                height: 12 * scale
            )
            let highlightPath = Path(roundedRect: highlightRect, cornerRadius: 3 * scale)
            context.fill(highlightPath, with: .color(mint.opacity(0.5)))
            
            // Checkmark
            var checkPath = Path()
            checkPath.move(to: CGPoint(x: 11 * scale, y: 18 * scale))
            checkPath.addLine(to: CGPoint(x: 16 * scale, y: 23 * scale))
            checkPath.addLine(to: CGPoint(x: 25 * scale, y: 12 * scale))
            context.stroke(checkPath, with: .color(forest), lineWidth: 3 * scale)
        }
        .frame(width: size, height: size)
    }
    
    // MARK: - Basic Icon (Lines in a card)
    
    private var basicIcon: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 36
            
            // Card background
            let cardRect = CGRect(
                x: 6 * scale,
                y: 4 * scale,
                width: 24 * scale,
                height: 28 * scale
            )
            let cardPath = Path(roundedRect: cardRect, cornerRadius: 4 * scale)
            context.fill(cardPath, with: .color(sage))
            
            // Three horizontal lines (white)
            for i in 0..<3 {
                let y = (12 + i * 7) * scale
                var linePath = Path()
                linePath.move(to: CGPoint(x: 10 * scale, y: y))
                linePath.addLine(to: CGPoint(x: 26 * scale, y: y))
                context.stroke(linePath, with: .color(.white), lineWidth: 2.5 * scale)
            }
        }
        .frame(width: size, height: size)
    }
    
    // MARK: - Packing Icon (Suitcase)
    
    private var packingIcon: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 36
            
            // Suitcase body
            let bodyRect = CGRect(
                x: 6 * scale,
                y: 10 * scale,
                width: 24 * scale,
                height: 20 * scale
            )
            let bodyPath = Path(roundedRect: bodyRect, cornerRadius: 4 * scale)
            context.fill(bodyPath, with: .color(sky))
            
            // Handle on top
            var handlePath = Path()
            handlePath.addRoundedRect(
                in: CGRect(x: 14 * scale, y: 5 * scale, width: 8 * scale, height: 7 * scale),
                cornerSize: CGSize(width: 2 * scale, height: 2 * scale)
            )
            context.fill(handlePath, with: .color(mint))
            
            // Horizontal straps
            var strap1 = Path()
            strap1.move(to: CGPoint(x: 6 * scale, y: 17 * scale))
            strap1.addLine(to: CGPoint(x: 30 * scale, y: 17 * scale))
            context.stroke(strap1, with: .color(mint), lineWidth: 2 * scale)
            
            var strap2 = Path()
            strap2.move(to: CGPoint(x: 6 * scale, y: 23 * scale))
            strap2.addLine(to: CGPoint(x: 30 * scale, y: 23 * scale))
            context.stroke(strap2, with: .color(mint), lineWidth: 2 * scale)
        }
        .frame(width: size, height: size)
    }
    
    // MARK: - Guest List Icon (Two people silhouettes)
    
    private var guestListIcon: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 36
            
            // Back person (mint, slightly offset)
            // Head
            let backHeadCenter = CGPoint(x: 20 * scale, y: 11 * scale)
            var backHead = Path()
            backHead.addEllipse(in: CGRect(
                x: backHeadCenter.x - 5 * scale,
                y: backHeadCenter.y - 5 * scale,
                width: 10 * scale,
                height: 10 * scale
            ))
            context.fill(backHead, with: .color(mint))
            
            // Body
            var backBody = Path()
            backBody.addEllipse(in: CGRect(
                x: 12 * scale,
                y: 18 * scale,
                width: 16 * scale,
                height: 14 * scale
            ))
            context.fill(backBody, with: .color(mint))
            
            // Front person (blush)
            // Head
            let frontHeadCenter = CGPoint(x: 14 * scale, y: 13 * scale)
            var frontHead = Path()
            frontHead.addEllipse(in: CGRect(
                x: frontHeadCenter.x - 5 * scale,
                y: frontHeadCenter.y - 5 * scale,
                width: 10 * scale,
                height: 10 * scale
            ))
            context.fill(frontHead, with: .color(blush))
            
            // Body
            var frontBody = Path()
            frontBody.addEllipse(in: CGRect(
                x: 6 * scale,
                y: 20 * scale,
                width: 16 * scale,
                height: 14 * scale
            ))
            context.fill(frontBody, with: .color(blush))
        }
        .frame(width: size, height: size)
    }
    
    // MARK: - Project Icon (Clipboard with progress bar)
    
    private var projectIcon: some View {
        Canvas { context, canvasSize in
            let scale = min(canvasSize.width, canvasSize.height) / 36
            
            // Clipboard body
            let clipboardRect = CGRect(
                x: 6 * scale,
                y: 6 * scale,
                width: 24 * scale,
                height: 26 * scale
            )
            let clipboardPath = Path(roundedRect: clipboardRect, cornerRadius: 3 * scale)
            context.fill(clipboardPath, with: .color(sage))
            
            // Clip at top
            let clipRect = CGRect(
                x: 12 * scale,
                y: 3 * scale,
                width: 12 * scale,
                height: 6 * scale
            )
            let clipPath = Path(roundedRect: clipRect, cornerRadius: 2 * scale)
            context.fill(clipPath, with: .color(forest))
            
            // Progress bar background
            let progressBgRect = CGRect(
                x: 10 * scale,
                y: 15 * scale,
                width: 16 * scale,
                height: 4 * scale
            )
            let progressBgPath = Path(roundedRect: progressBgRect, cornerRadius: 2 * scale)
            context.fill(progressBgPath, with: .color(.white.opacity(0.5)))
            
            // Progress bar fill (60% complete)
            let progressFillRect = CGRect(
                x: 10 * scale,
                y: 15 * scale,
                width: 10 * scale,
                height: 4 * scale
            )
            let progressFillPath = Path(roundedRect: progressFillRect, cornerRadius: 2 * scale)
            context.fill(progressFillPath, with: .color(mint))
            
            // Check marks (two completed tasks)
            for i in 0..<2 {
                let y = (22 + i * 5) * scale
                var checkPath = Path()
                checkPath.move(to: CGPoint(x: 10 * scale, y: y))
                checkPath.addLine(to: CGPoint(x: 12 * scale, y: (y + 2 * scale)))
                checkPath.addLine(to: CGPoint(x: 16 * scale, y: (y - 1 * scale)))
                context.stroke(checkPath, with: .color(forest), lineWidth: 1.5 * scale)
                
                // Line after check
                var linePath = Path()
                linePath.move(to: CGPoint(x: 18 * scale, y: y))
                linePath.addLine(to: CGPoint(x: 26 * scale, y: y))
                context.stroke(linePath, with: .color(.white), lineWidth: 1.5 * scale)
            }
        }
        .frame(width: size, height: size)
    }
}

#Preview {
    VStack(spacing: 20) {
        ForEach(LIST_TYPE_IDS, id: \.self) { typeId in
            HStack {
                ListTypeIconView(typeId: typeId, size: 36)
                Text(typeId)
            }
        }
    }
    .padding()
}
