//
//  LederWidget.swift
//  Data og widget-definisjoner for Oksnøen Ledere.
//
//  Appen skriver et øyeblikksbilde (JSON) til app-gruppen hver gang forsiden lastes.
//  Widgetene leser bare derfra. Uten data vises «Åpne appen».
//

import WidgetKit
import SwiftUI

let oksAppGroupId = "group.com.oksnoen.ledere.shared"

struct OksTask: Codable, Hashable {
    var kind: String
    var title: String
}

struct OksSnapshot: Codable {
    var leaderName: String?
    var sessionLabel: String?
    var currentActivity: String?
    var extraActivity: String?
    var obsMessage: String?
    var sessionReminder: String?
    var cabins: [String]?
    var tasks: [OksTask]?
    var unread: Int?

    static func read() -> (snapshot: OksSnapshot?, updated: Date?) {
        let defaults = UserDefaults(suiteName: oksAppGroupId)
        let stamp = defaults?.double(forKey: "widget_last_updated") ?? 0
        let updated = stamp > 0 ? Date(timeIntervalSince1970: stamp) : nil
        if let json = defaults?.string(forKey: "widget_snapshot"), let data = json.data(using: .utf8),
           let snapshot = try? JSONDecoder().decode(OksSnapshot.self, from: data) {
            return (snapshot, updated)
        }
        // Eldre app-versjon: bare de tre tekstene.
        let activity = defaults?.string(forKey: "widget_current_activity") ?? ""
        if activity.isEmpty { return (nil, updated) }
        return (OksSnapshot(currentActivity: activity,
                            extraActivity: defaults?.string(forKey: "widget_extra_activity"),
                            obsMessage: defaults?.string(forKey: "widget_obs_message")), updated)
    }
}

struct LeaderEntry: TimelineEntry {
    let date: Date
    let snapshot: OksSnapshot?
    let updated: Date?

    var hasData: Bool { snapshot != nil }
    var activity: String {
        let a = (snapshot?.currentActivity ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return a.isEmpty ? "Ingen oppdrag" : a
    }
    var extra: String { (snapshot?.extraActivity ?? "").trimmingCharacters(in: .whitespacesAndNewlines) }
    /// Personlig OBS først, ellers leirsjefens påminnelse for økta.
    var note: String {
        let obs = (snapshot?.obsMessage ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !obs.isEmpty { return obs }
        return (snapshot?.sessionReminder ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }
    var session: String { snapshot?.sessionLabel ?? "" }
    var tasks: [OksTask] { snapshot?.tasks ?? [] }
    var cabins: [String] { snapshot?.cabins ?? [] }

    static let preview = LeaderEntry(
        date: .now,
        snapshot: OksSnapshot(leaderName: "August", sessionLabel: "2. økt", currentActivity: "Klatring",
                              extraActivity: "Badevakt", obsMessage: "Husk hjelm på alle",
                              sessionReminder: nil, cabins: ["Snoopy"],
                              tasks: [OksTask(kind: "fix", title: "Løs planke på brygga"), OksTask(kind: "tau", title: "Taukontroll: Klatring")],
                              unread: 0),
        updated: .now)
}

struct LeaderTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> LeaderEntry { .preview }

    func getSnapshot(in context: Context, completion: @escaping (LeaderEntry) -> Void) {
        completion(context.isPreview ? .preview : readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LeaderEntry>) -> Void) {
        // Appen laster widgetene på nytt når data endres. Dette er bare en reserve.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [readEntry()], policy: .after(next)))
    }

    private func readEntry() -> LeaderEntry {
        let (snapshot, updated) = OksSnapshot.read()
        return LeaderEntry(date: Date(), snapshot: snapshot, updated: updated)
    }
}

/// «Nå»: oppdraget ditt denne økta. Hjem-skjerm og låseskjerm.
struct LederWidget: Widget {
    let kind: String = "LederWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LeaderTimelineProvider()) { entry in
            NaaWidgetView(entry: entry)
                .containerBackground(.background, for: .widget)
                .widgetURL(URL(string: "oksnoen://"))
        }
        .configurationDisplayName("Nå")
        .description("Oppdraget ditt denne økta, med OBS-beskjed.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

/// «Mine oppgaver»: FIX og taukontroll som venter på deg.
struct OppgaverWidget: Widget {
    let kind: String = "OppgaverWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LeaderTimelineProvider()) { entry in
            OppgaverWidgetView(entry: entry)
                .containerBackground(.background, for: .widget)
                .widgetURL(URL(string: "oksnoen://fix"))
        }
        .configurationDisplayName("Mine oppgaver")
        .description("FIX-oppgaver og taukontroller som venter på deg.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

/// «Skann»: åpner QR-skanneren med ett trykk. Hjem-skjerm og låseskjerm.
struct SkannWidget: Widget {
    let kind: String = "SkannWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LeaderTimelineProvider()) { entry in
            SkannWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color(red: 0.12, green: 0.16, blue: 0.27) }
                .widgetURL(URL(string: "oksnoen://skann"))
        }
        .configurationDisplayName("Skann armbånd")
        .description("Åpner skanneren med ett trykk.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}

#Preview(as: .systemSmall) {
    LederWidget()
} timeline: {
    LeaderEntry.preview
}

#Preview(as: .systemMedium) {
    OppgaverWidget()
} timeline: {
    LeaderEntry.preview
}
