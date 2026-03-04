//
//  LederWidgetEntryView.swift
//  LederWidget
//
//  Created by August Raae Frisvold on 04/03/2026.
//

import SwiftUI
import WidgetKit

struct SmallWidgetView: View {
    let entry: LeaderEntry

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "figure.run")
                .font(.title2)
                .foregroundColor(.blue)

            Text(entry.currentActivity)
                .font(.headline)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)
                .minimumScaleFactor(0.6)
                .lineLimit(3)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct MediumWidgetView: View {
    let entry: LeaderEntry

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Label {
                    Text("Aktivitet")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .textCase(.uppercase)
                } icon: {
                    Image(systemName: "figure.run")
                        .font(.caption2)
                        .foregroundColor(.blue)
                }

                Text(entry.currentActivity)
                    .font(.title3)
                    .fontWeight(.bold)
                    .lineLimit(2)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 6) {
                if !entry.extraActivity.isEmpty {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Ekstra")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                        Text(entry.extraActivity)
                            .font(.caption)
                            .fontWeight(.medium)
                            .lineLimit(2)
                    }
                }

                if !entry.obsMessage.isEmpty {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("OBS")
                            .font(.caption2)
                            .foregroundColor(.orange)
                            .textCase(.uppercase)
                        Text(entry.obsMessage)
                            .font(.caption)
                            .fontWeight(.medium)
                            .lineLimit(2)
                            .foregroundColor(.orange)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct WidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: LeaderEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}
