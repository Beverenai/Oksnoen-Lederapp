//
//  LederWidgetEntryView.swift
//  Visningene til widgetene.
//

import SwiftUI
import WidgetKit

let oksRed = Color(red: 0.78, green: 0.06, blue: 0.18)

private struct EmptyHint: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "arrow.up.forward.app")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Åpne appen")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct SessionPill: View {
    let text: String
    var body: some View {
        Text(text.uppercased())
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Capsule().fill(oksRed.opacity(0.14)))
            .foregroundStyle(oksRed)
    }
}

struct NaaWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LeaderEntry

    var body: some View {
        switch family {
        case .accessoryInline:
            Text(entry.hasData ? "Nå: \(entry.activity)" : "Oksnøen")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.session.isEmpty ? "Nå" : entry.session)
                    .font(.caption2)
                    .widgetAccentable()
                Text(entry.hasData ? entry.activity : "Åpne appen")
                    .font(.headline)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                if !entry.note.isEmpty {
                    Text(entry.note)
                        .font(.caption2)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .systemMedium:
            if entry.hasData { medium } else { EmptyHint() }
        default:
            if entry.hasData { small } else { EmptyHint() }
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 6) {
            SessionPill(text: entry.session.isEmpty ? "Nå" : entry.session)
            Text(entry.activity)
                .font(.title3.weight(.bold))
                .lineLimit(2)
                .minimumScaleFactor(0.65)
            Spacer(minLength: 0)
            if !entry.note.isEmpty {
                Label(entry.note, systemImage: "exclamationmark.circle.fill")
                    .font(.caption2)
                    .foregroundStyle(.orange)
                    .lineLimit(2)
            } else if !entry.extra.isEmpty {
                Text("Ekstra: \(entry.extra)")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var medium: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                SessionPill(text: entry.session.isEmpty ? "Nå" : entry.session)
                Text(entry.activity)
                    .font(.title2.weight(.bold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.65)
                Spacer(minLength: 0)
                if !entry.cabins.isEmpty {
                    Label(entry.cabins.joined(separator: ", "), systemImage: "house.fill")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 8) {
                if !entry.extra.isEmpty {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("EKSTRA").font(.caption2).foregroundStyle(.secondary)
                        Text(entry.extra).font(.subheadline.weight(.semibold)).lineLimit(2)
                    }
                }
                if !entry.note.isEmpty {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("OBS").font(.caption2).foregroundStyle(.orange)
                        Text(entry.note).font(.caption).lineLimit(3)
                    }
                }
                if entry.extra.isEmpty && entry.note.isEmpty {
                    Text("Ingen beskjeder")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct OppgaverWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LeaderEntry

    private func icon(_ kind: String) -> String {
        kind == "tau" ? "figure.climbing" : "wrench.and.screwdriver.fill"
    }

    var body: some View {
        if !entry.hasData {
            EmptyHint()
        } else if entry.tasks.isEmpty {
            VStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title)
                    .foregroundStyle(.green)
                Text("Ingen oppgaver")
                    .font(.footnote.weight(.semibold))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if family == .systemSmall {
            VStack(alignment: .leading, spacing: 4) {
                Text("OPPGAVER").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                Text("\(entry.tasks.count)")
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .foregroundStyle(oksRed)
                Spacer(minLength: 0)
                Text(entry.tasks[0].title)
                    .font(.caption)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        } else {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("MINE OPPGAVER").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                    Spacer()
                    Text("\(entry.tasks.count)")
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(Capsule().fill(oksRed))
                        .foregroundStyle(.white)
                }
                ForEach(Array(entry.tasks.prefix(3).enumerated()), id: \.offset) { _, task in
                    Label(task.title, systemImage: icon(task.kind))
                        .font(.subheadline)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }
}

struct SkannWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: LeaderEntry

    var body: some View {
        if family == .accessoryCircular {
            ZStack {
                AccessoryWidgetBackground()
                Image(systemName: "qrcode.viewfinder")
                    .font(.title2)
                    .widgetAccentable()
            }
        } else {
            VStack(spacing: 8) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 46, weight: .medium))
                    .foregroundStyle(.white)
                Text("Skann armbånd")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
