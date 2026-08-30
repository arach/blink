import BlinkCore
import BlinkPeer
import Foundation

private let indexTapeClockFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = .autoupdatingCurrent
    formatter.setLocalizedDateFormatFromTemplate("HHmm")
    return formatter
}()

private let indexTapeOldDateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.locale = .autoupdatingCurrent
    formatter.dateFormat = "M·yy"
    return formatter
}()

func indexTapeStamp(for date: Date, now: Date = Date()) -> String {
    let calendar = Calendar.autoupdatingCurrent
    if calendar.isDate(date, inSameDayAs: now) {
        return indexTapeClockFormatter.string(from: date)
    }

    let days = calendar.dateComponents(
        [.day],
        from: calendar.startOfDay(for: date),
        to: calendar.startOfDay(for: now)
    ).day ?? 0
    if days >= 0, days < 7 {
        return date.formatted(.dateTime.weekday(.abbreviated)).uppercased()
    }
    if calendar.component(.year, from: date) == calendar.component(.year, from: now) {
        return date.formatted(.dateTime.day().month(.abbreviated)).uppercased()
    }
    return indexTapeOldDateFormatter.string(from: date).uppercased()
}

func conciseAge(since date: Date, now: Date = Date()) -> String {
    let interval = max(0, now.timeIntervalSince(date))
    if interval < 60 { return "JUST NOW" }
    if interval < 3_600 { return "\(Int(interval / 60))M AGO" }
    if interval < 86_400 { return "\(Int(interval / 3_600))H AGO" }
    if interval < 30 * 86_400 { return "\(Int(interval / 86_400))D AGO" }
    return date.formatted(date: .abbreviated, time: .omitted).uppercased()
}

func syncStatusIsStale(_ date: Date, now: Date = Date()) -> Bool {
    now.timeIntervalSince(date) > 7 * 24 * 60 * 60
}

func syncStatusLine(
    state: BlinkMobileModel.ConnectionState,
    lastSyncedAt: Date,
    issueCount: Int,
    isSyncing: Bool,
    now: Date = Date()
) -> String {
    let age = conciseAge(since: lastSyncedAt, now: now)
    if issueCount > 0 {
        return "\(issueCount) SYNC ISSUE\(issueCount == 1 ? "" : "S") · UPDATED \(age)"
    }
    if isSyncing {
        if let host = state.host {
            return "SYNCING · \(host.name.uppercased())"
        }
        return "SYNCING"
    }
    switch state {
    case .disconnected:
        return syncStatusIsStale(lastSyncedAt, now: now)
            ? "SYNC DUE · UPDATED \(age)"
            : "UPDATED \(age)"
    case .requestingAccess(let name):
        return "APPROVAL NEEDED · \(name.uppercased())"
    case .connected(let host):
        return "\(host.name.uppercased()) · UPDATED \(age)"
    }
}

func noteContent(_ note: BlinkSnapshotNote) -> String {
    (try? Frontmatter.decode(note.markdown).content) ?? note.markdown
}

func noteExcerpt(_ note: BlinkSnapshotNote) -> String {
    var lines = noteContent(note)
        .split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init)
    if let firstContentIndex = lines.firstIndex(where: {
        !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }) {
        let first = lines[firstContentIndex]
            .trimmingCharacters(in: CharacterSet(charactersIn: "# "))
        if first.caseInsensitiveCompare(note.title) == .orderedSame {
            lines.remove(at: firstContentIndex)
        }
    }
    return lines.joined(separator: " ")
        .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}
