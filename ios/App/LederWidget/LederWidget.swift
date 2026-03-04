//
//  LederWidget.swift
//  LederWidget
//
//  Created by August Raae Frisvold on 04/03/2026.
//

import WidgetKit
import SwiftUI

struct LeaderEntry: TimelineEntry {
    let date: Date
    let currentActivity: String
    let extraActivity: String
    let obsMessage: String
}

struct LeaderTimelineProvider: TimelineProvider {
    private let appGroupId = "group.com.oksnoen.lederapp"

    func placeholder(in context: Context) -> LeaderEntry {
        LeaderEntry(
            date: Date(),
            currentActivity: "Aktivitet",
            extraActivity: "",
            obsMessage: ""
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (LeaderEntry) -> Void) {
        completion(readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LeaderEntry>) -> Void) {
        let entry = readEntry()
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func readEntry() -> LeaderEntry {
        let defaults = UserDefaults(suiteName: appGroupId)
        let currentActivity = defaults?.string(forKey: "widget_current_activity") ?? ""
        let extraActivity = defaults?.string(forKey: "widget_extra_activity") ?? ""
        let obsMessage = defaults?.string(forKey: "widget_obs_message") ?? ""

        return LeaderEntry(
            date: Date(),
            currentActivity: currentActivity.isEmpty ? "Ingen aktivitet" : currentActivity,
            extraActivity: extraActivity,
            obsMessage: obsMessage
        )
    }
}

struct LederWidget: Widget {
    let kind: String = "LederWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LeaderTimelineProvider()) { entry in
            WidgetEntryView(entry: entry)
                .containerBackground(.background, for: .widget)
        }
        .configurationDisplayName("Din Aktivitet")
        .description("Se din nåværende aktivitet fra Oksnøen LederApp")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

#Preview(as: .systemSmall) {
    LederWidget()
} timeline: {
    LeaderEntry(date: .now, currentActivity: "Klatring", extraActivity: "", obsMessage: "")
    LeaderEntry(date: .now, currentActivity: "Taubane", extraActivity: "Vannski", obsMessage: "Husk hjelm!")
}

#Preview(as: .systemMedium) {
    LederWidget()
} timeline: {
    LeaderEntry(date: .now, currentActivity: "Klatring", extraActivity: "Rappis", obsMessage: "Husk sikkerhetsutstyr")
}
