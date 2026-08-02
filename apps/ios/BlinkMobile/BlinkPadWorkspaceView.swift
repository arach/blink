import BlinkCore
import HudsonUI
import SwiftUI

/// Regular-width iPad surface. The portable `blink.slot` value supplies spatial
/// intent; exact Mac panel frames remain correctly local to the Mac.
struct BlinkPadWorkspaceView: View {
    @ObservedObject var model: BlinkMobileModel
    let notes: [BlinkSnapshotNote]
    let scopedNoteCount: Int
    @Binding var workspace: WorkspaceScope
    let workspaceIDs: [String]
    @Binding var query: String
    @Binding var selection: String?
    let onOpenSettings: () -> Void

    @State private var deskIndex = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var desks: [[BlinkPadSlot]] {
        BlinkPadSlot.makeDesks(notes: notes)
    }

    private var selectedNote: BlinkSnapshotNote? {
        guard let selection else { return nil }
        return model.notes.first { $0.id == selection }
    }

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                topBar

                if let lastSyncedAt = model.lastSyncedAt {
                    BlinkPadStatusStrip(
                        state: model.connectionState,
                        lastSyncedAt: lastSyncedAt,
                        isSyncing: model.isSyncing,
                        issueCount: model.snapshot?.issues.count ?? 0,
                        noteCount: scopedNoteCount
                    )
                }

                board
            }
            .background(BlinkBackdrop())
            .overlay(alignment: .trailing) {
                if let selectedNote {
                    BlinkPadReader(
                        note: selectedNote,
                        index: model.notes.firstIndex(where: { $0.id == selectedNote.id }).map { $0 + 1 } ?? 1,
                        onClose: { selection = nil }
                    )
                    .frame(
                        width: min(540, max(430, geometry.size.width * 0.48)),
                        height: min(720, geometry.size.height - 48)
                    )
                    .padding(24)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
        }
        .tint(BlinkMobileTheme.signal)
        .animation(
            reduceMotion ? nil : .snappy(duration: 0.28, extraBounce: 0),
            value: selection
        )
        .onChange(of: desks.count) { _, count in
            deskIndex = min(deskIndex, max(0, count - 1))
        }
    }

    private var topBar: some View {
        HStack(spacing: 18) {
            Menu {
                Button("All Notes") { workspace = .all }
                Button("Unfiled") { workspace = .unfiled }
                if !workspaceIDs.isEmpty { Divider() }
                ForEach(workspaceIDs, id: \.self) { id in
                    Button(id) { workspace = .workspace(id) }
                }
            } label: {
                HStack(spacing: 12) {
                    BlinkMark(size: 30)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("WORKSPACE")
                            .font(.caption2.monospaced().weight(.semibold))
                            .tracking(1.2)
                            .foregroundStyle(BlinkMobileTheme.faintInk)
                        HStack(spacing: 7) {
                            Text(workspace.title)
                                .font(.title2.weight(.semibold))
                                .foregroundStyle(BlinkMobileTheme.ink)
                                .lineLimit(1)
                            Image(systemName: "chevron.down")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(BlinkMobileTheme.faintInk)
                        }
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Workspace: \(workspace.title)")

            Spacer(minLength: 12)

            BlinkPadSearchField(
                query: $query,
                prompt: "Search \(workspace.title)"
            )
            .frame(minWidth: 220, idealWidth: 280, maxWidth: 340)

            if model.connectionState.host != nil {
                Button {
                    Task { await model.refresh() }
                } label: {
                    if model.isSyncing {
                        ProgressView()
                            .frame(width: 20, height: 20)
                    } else {
                        Image(systemName: "arrow.clockwise")
                    }
                }
                .buttonStyle(.bordered)
                .buttonBorderShape(.circle)
                .disabled(model.isSyncing)
                .accessibilityLabel("Sync now")
            }

            Button(action: onOpenSettings) {
                Image(systemName: "gearshape")
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.circle)
            .accessibilityLabel("Settings")
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 14)
        .background(BlinkMobileTheme.canvas)
    }

    @ViewBuilder
    private var board: some View {
        switch model.cacheState {
        case .loading:
            ContentUnavailableView {
                ProgressView()
            } description: {
                Text("Loading notes…")
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            ContentUnavailableView {
                Label("Notes unavailable", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("Try Again") { model.retryCacheLoad() }
                    .buttonStyle(.borderedProminent)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .ready:
            if notes.isEmpty {
                emptyBoard
            } else {
                deskBoard
            }
        }
    }

    private var deskBoard: some View {
        VStack(spacing: 0) {
            TabView(selection: $deskIndex) {
                ForEach(desks.indices, id: \.self) { index in
                    BlinkPadDesk(
                        slots: desks[index],
                        selectedID: selection,
                        onSelect: { note in selection = note.id }
                    )
                    .padding(.horizontal, 24)
                    .padding(.vertical, 18)
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            deskFooter
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var deskFooter: some View {
        HStack(spacing: 12) {
            Text("DESK \(deskIndex + 1) / \(desks.count)")
                .font(.caption.monospaced().weight(.semibold))
                .tracking(0.8)

            Text("·")
                .foregroundStyle(BlinkMobileTheme.hairline)

            Text("9 SLOTS")
                .font(.caption.monospaced())

            Spacer()

            if desks.count > 1 {
                Button {
                    deskIndex = max(0, deskIndex - 1)
                } label: {
                    Image(systemName: "chevron.left")
                }
                .disabled(deskIndex == 0)
                .accessibilityLabel("Previous desk")

                Button {
                    deskIndex = min(desks.count - 1, deskIndex + 1)
                } label: {
                    Image(systemName: "chevron.right")
                }
                .disabled(deskIndex == desks.count - 1)
                .accessibilityLabel("Next desk")
            }
        }
        .foregroundStyle(BlinkMobileTheme.faintInk)
        .padding(.horizontal, 28)
        .frame(height: 44)
        .background(BlinkMobileTheme.rail)
        .overlay(alignment: .top) {
            BlinkMobileTheme.hairline.frame(height: 1)
        }
    }

    private var emptyBoard: some View {
        ContentUnavailableView {
            Label(emptyTitle, systemImage: emptySymbol)
        } description: {
            Text(emptyDescription)
        } actions: {
            if model.notes.isEmpty {
                Button(model.connectionState.host == nil ? "Open Settings" : "Sync Now") {
                    if model.connectionState.host == nil {
                        onOpenSettings()
                    } else {
                        Task { await model.refresh() }
                    }
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyTitle: String {
        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return "No matches" }
        if model.notes.isEmpty { return "Connect to your Mac" }
        return "No notes here"
    }

    private var emptySymbol: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "square.grid.3x3" : "magnifyingglass"
    }

    private var emptyDescription: String {
        if !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Try another search."
        }
        if model.notes.isEmpty { return "Open Settings to choose a nearby Mac." }
        return "Choose another workspace."
    }
}

private struct BlinkPadSearchField: View {
    @Binding var query: String
    let prompt: String

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(BlinkMobileTheme.faintInk)

            TextField(prompt, text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .symbolRenderingMode(.hierarchical)
                }
                .foregroundStyle(BlinkMobileTheme.faintInk)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, 13)
        .frame(height: 42)
        .background(BlinkMobileTheme.surface)
        .overlay {
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(BlinkMobileTheme.hairline, lineWidth: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct BlinkPadStatusStrip: View {
    let state: BlinkMobileModel.ConnectionState
    let lastSyncedAt: Date
    let isSyncing: Bool
    let issueCount: Int
    let noteCount: Int

    private var isStale: Bool {
        Date().timeIntervalSince(lastSyncedAt) > 7 * 24 * 60 * 60
    }

    private var isDegraded: Bool { issueCount > 0 || isStale }

    var body: some View {
        HStack(spacing: 10) {
            Rectangle()
                .fill(isDegraded ? BlinkMobileTheme.amber : state.host == nil ? BlinkMobileTheme.faintInk : BlinkMobileTheme.signal)
                .frame(width: 7, height: 7)
                .accessibilityHidden(true)

            Text(statusLine)
                .font(.caption.monospaced().weight(.medium))
                .tracking(0.45)
                .foregroundStyle(isDegraded ? BlinkMobileTheme.amber : BlinkMobileTheme.secondaryInk)

            Spacer()

            Text("\(noteCount) NOTE\(noteCount == 1 ? "" : "S")")
                .font(.caption.monospaced().weight(.medium))
                .tracking(0.8)
                .foregroundStyle(BlinkMobileTheme.faintInk)
        }
        .padding(.horizontal, 26)
        .frame(height: 36)
        .background(BlinkMobileTheme.canvas)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(isDegraded ? BlinkMobileTheme.amber : BlinkMobileTheme.signal.opacity(0.55))
                .frame(height: 2)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(statusLine.capitalized), \(noteCount) notes")
    }

    private var statusLine: String {
        let age = conciseAge(since: lastSyncedAt)
        if issueCount > 0 {
            return "\(issueCount) SYNC ISSUE\(issueCount == 1 ? "" : "S") · UPDATED \(age)"
        }
        if isSyncing { return "SYNCING" }
        switch state {
        case .disconnected:
            return isStale ? "SYNC DUE · UPDATED \(age)" : "UPDATED \(age)"
        case .requestingAccess(let name):
            return "APPROVAL NEEDED · \(name.uppercased())"
        case .connected(let host):
            return "\(host.name.uppercased()) · UPDATED \(age)"
        }
    }
}

private struct BlinkPadDesk: View {
    let slots: [BlinkPadSlot]
    let selectedID: String?
    let onSelect: (BlinkSnapshotNote) -> Void

    var body: some View {
        HudTiling(
            items: slots,
            constraints: TilingConstraints(
                maxColumns: 3,
                maxRows: 3,
                gap: 14,
                minItemWidth: 150,
                minItemHeight: 110,
                maxFill: 1,
                fillStrategy: .maximize,
                alignLastRow: .start
            )
        ) { slot in
            if let note = slot.note {
                BlinkPadNoteTile(
                    note: note,
                    slot: slot.number,
                    isPlaced: note.presentation.slot == slot.number,
                    isSelected: note.id == selectedID,
                    action: { onSelect(note) }
                )
            } else {
                BlinkPadEmptySlot(number: slot.number)
            }
        }
    }
}

private struct BlinkPadNoteTile: View {
    let note: BlinkSnapshotNote
    let slot: Int
    let isPlaced: Bool
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 0) {
                VStack(alignment: .trailing, spacing: 7) {
                    if note.pinned {
                        Rectangle()
                            .fill(BlinkMobileTheme.ink)
                            .frame(width: 7, height: 7)
                    } else {
                        Text(String(format: "%02d", slot))
                            .font(.caption2.monospaced().weight(.semibold))
                    }

                    Text(indexTapeStamp(for: note.updatedAt))
                        .font(.caption2.monospaced())

                    Spacer(minLength: 0)

                    if isPlaced {
                        Rectangle()
                            .fill(BlinkMobileTheme.signal)
                            .frame(width: 7, height: 7)
                    }
                }
                .foregroundStyle(BlinkMobileTheme.faintInk)
                .padding(.vertical, 14)
                .padding(.trailing, 8)
                .frame(width: 44, alignment: .trailing)
                .frame(maxHeight: .infinity)
                .background(BlinkMobileTheme.rail)

                VStack(alignment: .leading, spacing: 8) {
                    Text(note.title)
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(BlinkMobileTheme.ink)
                        .lineLimit(2)

                    let excerpt = noteExcerpt(note)
                    if !excerpt.isEmpty {
                        Text(excerpt)
                            .font(.subheadline)
                            .foregroundStyle(BlinkMobileTheme.secondaryInk)
                            .lineLimit(4)
                            .lineSpacing(2)
                    }

                    Spacer(minLength: 2)

                    HStack(spacing: 7) {
                        if let noteWorkspace = note.presentation.workspace {
                            Text(noteWorkspace)
                        }
                        if let tag = note.tags.first {
                            Text("#\(tag)")
                        }
                    }
                    .font(.caption.monospaced())
                    .foregroundStyle(BlinkMobileTheme.faintInk)
                    .lineLimit(1)
                }
                .padding(14)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(isSelected ? BlinkMobileTheme.signal.opacity(0.10) : BlinkMobileTheme.surface)
            }
            .contentShape(Rectangle())
            .overlay {
                RoundedRectangle(cornerRadius: 6)
                    .stroke(isSelected ? BlinkMobileTheme.signal : BlinkMobileTheme.hairline, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .hoverEffect(.highlight)
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("Slot \(slot), \(note.title), \(noteExcerpt(note))")
        .accessibilityValue(isSelected ? "Selected" : "")
    }
}

private struct BlinkPadEmptySlot: View {
    let number: Int

    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 6)
                .stroke(BlinkMobileTheme.hairline.opacity(0.72), style: StrokeStyle(lineWidth: 1, dash: [5, 7]))

            Text(String(format: "%02d", number))
                .font(.caption2.monospaced())
                .foregroundStyle(BlinkMobileTheme.faintInk.opacity(0.62))
                .padding(12)
        }
        .accessibilityHidden(true)
    }
}

private struct BlinkPadReader: View {
    let note: BlinkSnapshotNote
    let index: Int
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                BlinkMark(size: 18)
                Text("ENTRY \(String(format: "%02d", index))")
                    .font(.caption.monospaced().weight(.medium))
                    .tracking(0.8)
                    .foregroundStyle(BlinkMobileTheme.faintInk)

                Spacer()

                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.subheadline.weight(.semibold))
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
                .foregroundStyle(BlinkMobileTheme.secondaryInk)
                .accessibilityLabel("Close note")
                .keyboardShortcut(.cancelAction)
            }
            .padding(.horizontal, 20)
            .frame(height: 52)
            .background(BlinkMobileTheme.rail)
            .overlay(alignment: .bottom) {
                BlinkMobileTheme.hairline.frame(height: 1)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(note.title)
                            .font(.system(.largeTitle, design: .serif, weight: .semibold))
                            .foregroundStyle(BlinkMobileTheme.ink)
                            .accessibilityAddTraits(.isHeader)

                        HStack(spacing: 8) {
                            Text(note.updatedAt.formatted(date: .abbreviated, time: .shortened).uppercased())
                            if let noteWorkspace = note.presentation.workspace {
                                Text("·")
                                Text(noteWorkspace.uppercased())
                            }
                        }
                        .font(.caption.monospaced())
                        .foregroundStyle(BlinkMobileTheme.faintInk)
                    }

                    BlinkMobileTheme.hairline.frame(height: 1)

                    MarkdownDocumentView(markdown: noteContent(note), noteTitle: note.title)
                }
                .padding(24)
                .frame(maxWidth: 680, alignment: .leading)
            }
        }
        .background(BlinkMobileTheme.raisedSurface)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(color: .black.opacity(0.30), radius: 24, y: 14)
        .accessibilityElement(children: .contain)
    }
}

private struct BlinkPadSlot: Identifiable, Sendable {
    let desk: Int
    let number: Int
    let note: BlinkSnapshotNote?

    var id: String { "desk-\(desk)-slot-\(number)" }

    static func makeDesks(notes: [BlinkSnapshotNote]) -> [[BlinkPadSlot]] {
        guard !notes.isEmpty else { return [] }

        var firstDesk = [BlinkSnapshotNote?](repeating: nil, count: 9)
        var deferred: [BlinkSnapshotNote] = []

        for note in notes {
            if let slot = note.presentation.slot,
               (1...9).contains(slot),
               firstDesk[slot - 1] == nil {
                firstDesk[slot - 1] = note
            } else {
                deferred.append(note)
            }
        }

        for index in firstDesk.indices where firstDesk[index] == nil && !deferred.isEmpty {
            firstDesk[index] = deferred.removeFirst()
        }

        var desks: [[BlinkSnapshotNote?]] = [firstDesk]
        while !deferred.isEmpty {
            var next = [BlinkSnapshotNote?](repeating: nil, count: 9)
            for index in next.indices where !deferred.isEmpty {
                next[index] = deferred.removeFirst()
            }
            desks.append(next)
        }

        return desks.enumerated().map { deskIndex, notes in
            notes.enumerated().map { slotIndex, note in
                BlinkPadSlot(desk: deskIndex, number: slotIndex + 1, note: note)
            }
        }
    }
}
