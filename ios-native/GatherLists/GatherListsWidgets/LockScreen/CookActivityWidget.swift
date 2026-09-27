import ActivityKit
import SwiftUI
import WidgetKit

/// Live Activity for an in-progress cook: a Lock Screen card and Dynamic
/// Island presentation showing the recipe, the current step, and progress.
struct CookActivityWidget: Widget {
    private static let brandGreen = Color(hex: "3D7A63")

    /// Deep link that opens the recipe when the Live Activity is tapped.
    private func recipeURL(_ context: ActivityViewContext<CookActivityAttributes>) -> URL? {
        URL(string: "gatherlists://recipe/\(context.attributes.recipeId.uuidString)")
    }

    var body: some WidgetConfiguration {
        ActivityConfiguration(for: CookActivityAttributes.self) { context in
            lockScreenView(context)
                .widgetURL(recipeURL(context))
                .activityBackgroundTint(Color.black.opacity(0.6))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "frying.pan.fill")
                        .font(.title2)
                        .foregroundStyle(Self.brandGreen)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.currentStep)/\(context.state.totalSteps)")
                        .font(.headline)
                        .foregroundStyle(.white)
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.recipeName)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(context.state.instruction)
                            .font(.subheadline)
                            .lineLimit(2)
                        progressBar(context)
                    }
                    .padding(.horizontal, 4)
                    .widgetURL(recipeURL(context))
                }
            } compactLeading: {
                Image(systemName: "frying.pan.fill")
                    .foregroundStyle(Self.brandGreen)
            } compactTrailing: {
                Text("\(context.state.currentStep)/\(context.state.totalSteps)")
                    .font(.caption2)
                    .fontWeight(.semibold)
            } minimal: {
                Image(systemName: "frying.pan.fill")
                    .foregroundStyle(Self.brandGreen)
            }
        }
    }

    @ViewBuilder
    private func lockScreenView(_ context: ActivityViewContext<CookActivityAttributes>) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "frying.pan.fill")
                    .foregroundStyle(Self.brandGreen)
                Text(context.attributes.recipeName)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text("Step \(context.state.currentStep) of \(context.state.totalSteps)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Text(context.state.instruction)
                .font(.subheadline)
                .lineLimit(2)
            progressBar(context)
        }
        .padding(14)
    }

    @ViewBuilder
    private func progressBar(_ context: ActivityViewContext<CookActivityAttributes>) -> some View {
        ProgressView(
            value: Double(context.state.completedSteps),
            total: Double(max(context.state.totalSteps, 1))
        )
        .tint(Self.brandGreen)
    }
}
