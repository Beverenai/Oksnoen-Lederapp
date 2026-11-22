//
//  LederWidgetBundle.swift
//  Samler widgetene og live-visningen «Denne økta».
//

import WidgetKit
import SwiftUI
import ActivityKit

/// Må være lik definisjonen i appen (NativePlugins.swift).
struct OktAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var activity: String
        var sessionLabel: String
        var extra: String
        var obs: String
    }
    var leaderName: String
}

/// Live-visning på låseskjermen og i Dynamic Island: oppdraget ditt denne økta.
struct OktLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: OktAttributes.self) { context in
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: "figure.run")
                    .font(.title2)
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .background(Circle().fill(oksRed))
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.state.sessionLabel.isEmpty ? "DENNE ØKTA" : context.state.sessionLabel.uppercased())
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(context.state.activity)
                        .font(.title3.weight(.bold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    if !context.state.obs.isEmpty {
                        Text(context.state.obs)
                            .font(.caption)
                            .foregroundStyle(.orange)
                            .lineLimit(2)
                    } else if !context.state.extra.isEmpty {
                        Text("Ekstra: \(context.state.extra)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(16)
            .activityBackgroundTint(Color(.systemBackground).opacity(0.9))
            .widgetURL(URL(string: "oksnoen://"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "figure.run").foregroundStyle(oksRed)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.activity).font(.headline).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.sessionLabel).font(.caption).foregroundStyle(.secondary)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !context.state.obs.isEmpty {
                        Text(context.state.obs).font(.caption).foregroundStyle(.orange).lineLimit(2)
                    } else if !context.state.extra.isEmpty {
                        Text("Ekstra: \(context.state.extra)").font(.caption).lineLimit(1)
                    }
                }
            } compactLeading: {
                Image(systemName: "figure.run").foregroundStyle(oksRed)
            } compactTrailing: {
                Text(context.state.activity).font(.caption2).lineLimit(1).frame(maxWidth: 72)
            } minimal: {
                Image(systemName: "figure.run").foregroundStyle(oksRed)
            }
            .widgetURL(URL(string: "oksnoen://"))
        }
    }
}

@main
struct LederWidgetBundle: WidgetBundle {
    var body: some Widget {
        LederWidget()
        OppgaverWidget()
        SkannWidget()
        OktLiveActivity()
    }
}
