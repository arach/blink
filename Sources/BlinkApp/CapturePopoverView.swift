import AppKit
import BlinkCore
import SwiftUI

/// The menubar popover is Blink's compact workspace: capture/search on top,
/// recents on the left, and a spatial overview of the same notes on the right.
/// Selecting is deliberately separate from opening so the canvas can act as a
/// quiet browser; Return or the preview card's Open action realizes the panel.
struct CapturePopoverView: View {
    static let contentSize = CGSize(width: 1_056, height: 700)

    @ObservedObject var model: AppModel
    var dismiss: () -> Void
    var openSettings: () -> Void
    var toggleBlink: () -> Void
    var showGrid: () -> Void
    var beginDictation: () -> Void

    @State private var query = ""
    @State private var selectedNoteID: String?
    @State private var canvasMode: CanvasMode = .constellation
    @State private var canvasExpanded = false
    @FocusState private var fieldFocused: Bool

    private let amber = Color(red: 0.96, green: 0.58, blue: 0.08)

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var filtered: [Note] {
        guard !trimmedQuery.isEmpty else { return Array(model.notes.prefix(12)) }
        let needle = trimmedQuery.lowercased()
        return Array(
            model.notes
                .filter {
                    $0.title.lowercased().contains(needle)
                        || $0.content.lowercased().contains(needle)
                        || $0.tags.contains { $0.lowercased().contains(needle) }
                }
                .prefix(18)
        )
    }

    private var selectedNote: Note? {
        guard let selectedNoteID else { return nil }
        return filtered.first(where: { $0.id == selectedNoteID })
    }

    var body: some View {
        VStack(spacing: 0) {
            searchHeader
            hairline
            HStack(spacing: 0) {
                if !canvasExpanded {
                    recentSidebar
                        .frame(width: 390)
                    verticalHairline
                }
                canvasPane
            }
            hairline
            footer
        }
        .frame(width: Self.contentSize.width, height: Self.contentSize.height)
        .background(popoverBackground)
        .preferredColorScheme(.dark)
        .background(
            Button("") { createFromQuery() }
                .keyboardShortcut(.return, modifiers: .command)
                .opacity(0)
        )
        .onAppear {
            fieldFocused = true
        }
        .onChange(of: filtered.map(\.id)) { _, ids in
            if let selectedNoteID, ids.contains(selectedNoteID) { return }
            selectedNoteID = nil
        }
    }

    private var popoverBackground: some View {
        ZStack {
            Color(red: 0.055, green: 0.065, blue: 0.082)
            LinearGradient(
                colors: [
                    Color(red: 0.16, green: 0.19, blue: 0.24).opacity(0.62),
                    Color(red: 0.07, green: 0.08, blue: 0.105).opacity(0.82),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    private var searchHeader: some View {
        HStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(.white.opacity(0.46))

            TextField("Search or capture…", text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 19, weight: .regular))
                .foregroundStyle(.white.opacity(0.88))
                .tint(amber)
                .focused($fieldFocused)
                .onSubmit { openFirstOrCreate() }

            Button(action: startSystemDictation) {
                Image(systemName: "mic")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(.white.opacity(0.42))
                    .frame(width: 30, height: 30)
            }
            .buttonStyle(.plain)
            .help("Dictate into capture")
        }
        .padding(.horizontal, 28)
        .frame(height: 74)
    }

    private var recentSidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(trimmedQuery.isEmpty ? "RECENT" : "MATCHES")
                .font(.system(size: 10, weight: .bold, design: .monospaced))
                .tracking(4)
                .foregroundStyle(.white.opacity(0.34))
                .padding(.horizontal, 28)
                .padding(.top, 23)
                .padding(.bottom, 14)

            if model.notes.isEmpty {
                emptyState("No notes yet — create your first thought.")
            } else if filtered.isEmpty {
                emptyState("No matches — Return creates “\(trimmedQuery)”.")
            } else {
                ScrollView(.vertical) {
                    LazyVStack(spacing: 2) {
                        ForEach(filtered, id: \.id) { note in
                            RecentNoteRow(
                                note: note,
                                accent: noteAccent(note),
                                selected: note.id == selectedNote?.id,
                                onSelect: { selectedNoteID = note.id },
                                onOpen: { open(note) },
                                onCopyMarkdown: { copyToPasteboard(note.content) },
                                onCopyPath: {
                                    copyToPasteboard(
                                        AppDelegate.notesDirectory()
                                            .appendingPathComponent("\(note.id).md").path
                                    )
                                },
                                onDelete: { delete(note) }
                            )
                        }
                    }
                    .padding(.horizontal, 12)
                }
                .background(SubtleScroller())
            }
        }
    }

    private var canvasPane: some View {
        VStack(spacing: 0) {
            HStack {
                Text("CANVAS  \(filtered.count) \(filtered.count == 1 ? "NOTE" : "NOTES")")
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .tracking(4)
                    .foregroundStyle(.white.opacity(0.32))

                Spacer()

                CanvasModePicker(selection: $canvasMode, amber: amber)

                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { canvasExpanded.toggle() }
                } label: {
                    Image(systemName: canvasExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.48))
                        .frame(width: 38, height: 38)
                        .background(.white.opacity(0.045), in: RoundedRectangle(cornerRadius: 11))
                        .overlay(
                            RoundedRectangle(cornerRadius: 11)
                                .stroke(.white.opacity(0.08), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .help(canvasExpanded ? "Show recents" : "Expand canvas")
                .accessibilityLabel(canvasExpanded ? "Show recents" : "Expand canvas")
            }
            .padding(.horizontal, 24)
            .frame(height: 78)

            Group {
                if filtered.isEmpty {
                    emptyCanvas
                } else {
                    switch canvasMode {
                    case .grid:
                        NoteCardGrid(
                            notes: filtered,
                            selectedNoteID: selectedNote?.id,
                            accent: noteAccent,
                            onSelect: { selectedNoteID = $0.id },
                            onOpen: open
                        )
                    case .constellation:
                        NoteConstellation(
                            notes: filtered,
                            selectedNoteID: selectedNote?.id,
                            accent: noteAccent,
                            onSelect: { selectedNoteID = $0.id },
                            onOpen: open
                        )
                    case .list:
                        CanvasNoteList(
                            notes: filtered,
                            selectedNoteID: selectedNote?.id,
                            accent: noteAccent,
                            onSelect: { selectedNoteID = $0.id },
                            onOpen: open
                        )
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.bottom, 22)
        }
    }

    private var emptyCanvas: some View {
        VStack(spacing: 10) {
            Image(systemName: "point.3.connected.trianglepath.dotted")
                .font(.system(size: 30, weight: .light))
                .foregroundStyle(.white.opacity(0.18))
            Text(trimmedQuery.isEmpty ? "Your notes will gather here" : "No notes on this canvas")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.36))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CanvasSurface())
    }

    private var footer: some View {
        HStack(spacing: 10) {
            Button { createFromQuery() } label: {
                HStack(spacing: 10) {
                    KeyCap(symbol: "⌘")
                    KeyCap(symbol: "↵")
                    Text("new note")
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                        .foregroundStyle(.white.opacity(0.64))
                }
            }
            .buttonStyle(.plain)
            .help(trimmedQuery.isEmpty ? "New note" : "Create “\(trimmedQuery)”")

            Spacer()

            FooterAction(systemName: "house", label: "⌘H", help: "Settings", action: openSettings)
            footerDivider
            FooterAction(systemName: "eye", label: "⌥Space", help: "Blink notes", action: toggleBlink)
            footerDivider
            FooterAction(
                systemName: "point.3.connected.trianglepath.dotted",
                label: nil,
                help: "Show spatial grid",
                action: showGrid
            )
        }
        .padding(.horizontal, 22)
        .frame(height: 58)
    }

    private var footerDivider: some View {
        Rectangle()
            .fill(.white.opacity(0.10))
            .frame(width: 1, height: 26)
            .padding(.horizontal, 4)
    }

    private var hairline: some View {
        Rectangle().fill(.white.opacity(0.09)).frame(height: 1)
    }

    private var verticalHairline: some View {
        Rectangle().fill(.white.opacity(0.09)).frame(width: 1)
    }

    private func emptyState(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 11))
            .foregroundStyle(.white.opacity(0.38))
            .padding(.horizontal, 28)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Actions

    private func openFirstOrCreate() {
        if let selectedNote {
            open(selectedNote)
        } else if let first = filtered.first {
            open(first)
        } else if !trimmedQuery.isEmpty {
            createFromQuery()
        }
    }

    private func createFromQuery() {
        let text = trimmedQuery
        Task { await model.createNote(content: text) }
        dismiss()
    }

    /// Route macOS's standard dictation command to the capture field. The OS
    /// owns permissions, language, audio, and its dictation HUD; Blink only
    /// restores field focus and invokes the responder-chain action.
    private func startSystemDictation() {
        fieldFocused = true
        DispatchQueue.main.async {
            beginDictation()
        }
    }

    private func open(_ note: Note) {
        Task { await model.openNote(id: note.id) }
        dismiss()
    }

    private func delete(_ note: Note) {
        Task { await model.deleteNote(id: note.id) }
    }

    private func copyToPasteboard(_ string: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(string, forType: .string)
    }

    private func noteAccent(_ note: Note) -> Color {
        let resolved = BlinkConfigStore.shared.config.resolved(for: note.presentation)
        if let raw = resolved.editor.accentColor, let color = Color(blinkHex: raw) {
            return color
        }
        switch resolved.panel.sheet.lowercased() {
        case "card": return Color(red: 0.35, green: 0.82, blue: 0.61)
        case "glass", "dotted": return amber
        default: return Color(red: 0.48, green: 0.52, blue: 0.59)
        }
    }
}

private enum CanvasMode: String, CaseIterable, Identifiable {
    case grid
    case constellation
    case list

    var id: String { rawValue }
    var icon: String {
        switch self {
        case .grid: "square.grid.2x2"
        case .constellation: "point.3.connected.trianglepath.dotted"
        case .list: "line.3.horizontal"
        }
    }
}

private struct CanvasModePicker: View {
    @Binding var selection: CanvasMode
    let amber: Color

    var body: some View {
        HStack(spacing: 2) {
            ForEach(CanvasMode.allCases) { mode in
                Button { selection = mode } label: {
                    Image(systemName: mode.icon)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(selection == mode ? amber : .white.opacity(0.42))
                        .frame(width: 40, height: 34)
                        .background(
                            selection == mode ? amber.opacity(0.12) : Color.clear,
                            in: RoundedRectangle(cornerRadius: 9)
                        )
                        .overlay {
                            if selection == mode {
                                RoundedRectangle(cornerRadius: 9)
                                    .stroke(amber.opacity(0.55), lineWidth: 1)
                            }
                        }
                }
                .buttonStyle(.plain)
                .help(mode.rawValue.capitalized)
                .accessibilityLabel("\(mode.rawValue.capitalized) view")
            }
        }
        .padding(3)
        .background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(.white.opacity(0.08), lineWidth: 1))
    }
}

private struct RecentNoteRow: View {
    let note: Note
    let accent: Color
    let selected: Bool
    var onSelect: () -> Void
    var onOpen: () -> Void
    var onCopyMarkdown: () -> Void
    var onCopyPath: () -> Void
    var onDelete: () -> Void

    @State private var hovered = false

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 13) {
                Circle()
                    .fill(accent)
                    .frame(width: 10, height: 10)
                    .shadow(color: accent.opacity(selected ? 0.75 : 0), radius: 7)

                Text(note.title)
                    .font(.system(size: 14, weight: selected ? .semibold : .regular))
                    .foregroundStyle(.white.opacity(selected ? 0.94 : 0.72))
                    .lineLimit(1)

                Spacer(minLength: 10)

                Text(note.updatedAt.blinkCompactRelative)
                    .font(.system(size: 11, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.30))
                    .lineLimit(1)
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            .background(
                selected ? accent.opacity(0.15) : (hovered ? .white.opacity(0.05) : .clear),
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(alignment: .leading) {
                if selected {
                    RoundedRectangle(cornerRadius: 1.5)
                        .fill(accent)
                        .frame(width: 3, height: 32)
                        .offset(x: -1)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovered = $0 }
        .simultaneousGesture(TapGesture(count: 2).onEnded(onOpen))
        .contextMenu {
            Button("Open as Panel", action: onOpen)
            Divider()
            Button("Copy as Markdown", action: onCopyMarkdown)
            Button("Copy Path", action: onCopyPath)
            Divider()
            Button("Delete", role: .destructive, action: onDelete)
        }
    }
}

private struct NoteConstellation: View {
    let notes: [Note]
    let selectedNoteID: String?
    let accent: (Note) -> Color
    let onSelect: (Note) -> Void
    let onOpen: (Note) -> Void

    var body: some View {
        GeometryReader { geometry in
            let points = ConstellationLayout.points(for: notes, in: geometry.size)
            ZStack(alignment: .topLeading) {
                CanvasSurface()

                Canvas { context, _ in
                    for edge in ConstellationLayout.edges(for: notes) {
                        guard let start = points[edge.0], let end = points[edge.1] else { continue }
                        var path = Path()
                        path.move(to: start)
                        path.addLine(to: end)
                        context.stroke(
                            path,
                            with: .color(.white.opacity(0.105)),
                            style: StrokeStyle(lineWidth: 1, dash: [5, 7])
                        )
                    }
                }
                .allowsHitTesting(false)

                ForEach(notes, id: \.id) { note in
                    if let point = points[note.id] {
                        ConstellationNode(
                            note: note,
                            accent: accent(note),
                            selected: note.id == selectedNoteID,
                            onSelect: { onSelect(note) },
                            onOpen: { onOpen(note) }
                        )
                        .position(point)
                    }
                }

                if let note = notes.first(where: { $0.id == selectedNoteID }),
                   let point = points[note.id] {
                    NotePreviewCard(
                        note: note,
                        accent: accent(note),
                        coordinate: ConstellationLayout.label(for: point, in: geometry.size),
                        onOpen: { onOpen(note) }
                    )
                    .frame(width: min(330, geometry.size.width * 0.54))
                    .padding(16)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 15))
        }
    }
}

private struct ConstellationNode: View {
    let note: Note
    let accent: Color
    let selected: Bool
    let onSelect: () -> Void
    let onOpen: () -> Void

    @State private var hovered = false

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 8) {
                Circle().fill(accent).frame(width: 9, height: 9)
                Text(note.title)
                    .font(.system(size: 13, weight: selected ? .semibold : .medium))
                    .foregroundStyle(.white.opacity(selected ? 0.94 : 0.73))
                    .lineLimit(1)
            }
            .padding(.horizontal, 13)
            .frame(height: 33)
            .background(
                selected ? accent.opacity(0.16) : Color(red: 0.11, green: 0.12, blue: 0.15).opacity(0.92),
                in: RoundedRectangle(cornerRadius: 11)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 11)
                    .stroke(selected ? accent.opacity(0.82) : .white.opacity(hovered ? 0.18 : 0.10), lineWidth: selected ? 1.5 : 1)
            )
            .shadow(color: selected ? accent.opacity(0.30) : .black.opacity(0.18), radius: selected ? 18 : 5)
        }
        .buttonStyle(.plain)
        .onHover { hovered = $0 }
        .simultaneousGesture(TapGesture(count: 2).onEnded(onOpen))
        .help("Double-click to open \(note.title)")
    }
}

private struct NotePreviewCard: View {
    let note: Note
    let accent: Color
    let coordinate: String
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .firstTextBaseline) {
                Text(note.title)
                    .font(.system(size: 20, weight: .semibold, design: .serif).italic())
                    .foregroundStyle(.white.opacity(0.94))
                    .lineLimit(1)
                Spacer(minLength: 12)
                Text(coordinate)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(accent.opacity(0.86))
            }

            Text(note.blinkExcerpt)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(.white.opacity(0.59))
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack {
                Text(note.updatedAt.blinkLongRelative)
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white.opacity(0.30))
                Spacer()
                Button(action: onOpen) {
                    HStack(spacing: 8) {
                        KeyCap(symbol: "↵")
                        Text("open")
                            .font(.system(size: 10, weight: .semibold, design: .monospaced))
                    }
                    .foregroundStyle(.white.opacity(0.72))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(
            LinearGradient(
                colors: [Color(red: 0.12, green: 0.125, blue: 0.15), Color(red: 0.085, green: 0.09, blue: 0.11)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 15)
        )
        .overlay(RoundedRectangle(cornerRadius: 15).stroke(accent.opacity(0.34), lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 18, y: 7)
    }
}

private struct NoteCardGrid: View {
    let notes: [Note]
    let selectedNoteID: String?
    let accent: (Note) -> Color
    let onSelect: (Note) -> Void
    let onOpen: (Note) -> Void

    private let columns = [GridItem(.adaptive(minimum: 170), spacing: 10)]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(notes, id: \.id) { note in
                    Button { onSelect(note) } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Circle().fill(accent(note)).frame(width: 9, height: 9)
                                Text(note.title)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.84))
                                    .lineLimit(1)
                                Spacer()
                                Text(note.updatedAt.blinkCompactRelative)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundStyle(.white.opacity(0.28))
                            }
                            Text(note.blinkExcerpt)
                                .font(.system(size: 11))
                                .foregroundStyle(.white.opacity(0.43))
                                .lineLimit(3)
                                .frame(maxWidth: .infinity, minHeight: 46, alignment: .topLeading)
                        }
                        .padding(14)
                        .background(.white.opacity(note.id == selectedNoteID ? 0.075 : 0.035), in: RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(note.id == selectedNoteID ? accent(note).opacity(0.55) : .white.opacity(0.07), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .simultaneousGesture(TapGesture(count: 2).onEnded { onOpen(note) })
                }
            }
            .padding(14)
        }
        .scrollIndicators(.hidden)
        .background(CanvasSurface())
    }
}

private struct CanvasNoteList: View {
    let notes: [Note]
    let selectedNoteID: String?
    let accent: (Note) -> Color
    let onSelect: (Note) -> Void
    let onOpen: (Note) -> Void

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 6) {
                ForEach(notes, id: \.id) { note in
                    Button { onSelect(note) } label: {
                        HStack(spacing: 12) {
                            Circle().fill(accent(note)).frame(width: 9, height: 9)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(note.title)
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(.white.opacity(0.82))
                                    .lineLimit(1)
                                Text(note.blinkExcerpt)
                                    .font(.system(size: 10))
                                    .foregroundStyle(.white.opacity(0.35))
                                    .lineLimit(1)
                            }
                            Spacer()
                            Text(note.updatedAt.blinkCompactRelative)
                                .font(.system(size: 11, design: .monospaced))
                                .foregroundStyle(.white.opacity(0.28))
                            Image(systemName: "arrow.up.forward.app")
                                .font(.system(size: 11))
                                .foregroundStyle(.white.opacity(0.28))
                        }
                        .padding(.horizontal, 14)
                        .frame(height: 50)
                        .background(.white.opacity(note.id == selectedNoteID ? 0.07 : 0.025), in: RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .simultaneousGesture(TapGesture(count: 2).onEnded { onOpen(note) })
                }
            }
            .padding(14)
        }
        .scrollIndicators(.hidden)
        .background(CanvasSurface())
    }
}

/// SwiftUI follows the user's global "always show scroll bars" preference,
/// which makes this narrow recents rail visually dominate the notes. The rail
/// remains fully wheel/trackpad-scrollable, but drops that heavy fixed chrome.
private struct SubtleScroller: NSViewRepresentable {
    func makeNSView(context: Context) -> SubtleScrollerProbe {
        SubtleScrollerProbe()
    }

    func updateNSView(_ nsView: SubtleScrollerProbe, context: Context) {
        nsView.configureEnclosingScrollView()
    }
}

private final class SubtleScrollerProbe: NSView {
    override func viewDidMoveToSuperview() {
        super.viewDidMoveToSuperview()
        configureEnclosingScrollView()
    }

    func configureEnclosingScrollView() {
        DispatchQueue.main.async { [weak self] in
            var ancestor = self?.superview
            while let view = ancestor, !(view is NSScrollView) {
                ancestor = view.superview
            }
            guard let scrollView = ancestor as? NSScrollView else { return }
            scrollView.scrollerStyle = .overlay
            scrollView.hasVerticalScroller = false
        }
    }
}

private struct CanvasSurface: View {
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 15)
                .fill(Color(red: 0.025, green: 0.031, blue: 0.041).opacity(0.93))
            DotGrid()
                .clipShape(RoundedRectangle(cornerRadius: 15))
            RoundedRectangle(cornerRadius: 15)
                .stroke(.white.opacity(0.065), lineWidth: 1)
        }
    }
}

private struct DotGrid: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 28
            var x: CGFloat = 14
            while x < size.width {
                var y: CGFloat = 14
                while y < size.height {
                    context.fill(
                        Path(ellipseIn: CGRect(x: x - 1, y: y - 1, width: 2, height: 2)),
                        with: .color(.white.opacity(0.055))
                    )
                    y += step
                }
                x += step
            }
        }
        .allowsHitTesting(false)
    }
}

private struct FooterAction: View {
    let systemName: String
    let label: String?
    let help: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: systemName)
                    .font(.system(size: 15, weight: .medium))
                if let label {
                    Text(label)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                        .padding(.horizontal, 8)
                        .frame(height: 25)
                        .background(.white.opacity(0.065), in: RoundedRectangle(cornerRadius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(.white.opacity(0.08), lineWidth: 1))
                }
            }
            .foregroundStyle(.white.opacity(0.48))
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

private struct KeyCap: View {
    let symbol: String

    var body: some View {
        Text(symbol)
            .font(.system(size: 11, weight: .semibold, design: .monospaced))
            .foregroundStyle(.white.opacity(0.62))
            .frame(minWidth: 23, minHeight: 23)
            .background(.white.opacity(0.07), in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(.white.opacity(0.09), lineWidth: 1))
    }
}

private enum ConstellationLayout {
    private static let candidates: [CGPoint] = [
        CGPoint(x: 0.16, y: 0.20), CGPoint(x: 0.57, y: 0.13),
        CGPoint(x: 0.83, y: 0.32), CGPoint(x: 0.42, y: 0.43),
        CGPoint(x: 0.19, y: 0.62), CGPoint(x: 0.52, y: 0.78),
        CGPoint(x: 0.78, y: 0.65), CGPoint(x: 0.12, y: 0.39),
        CGPoint(x: 0.86, y: 0.13), CGPoint(x: 0.34, y: 0.18),
        CGPoint(x: 0.67, y: 0.42), CGPoint(x: 0.30, y: 0.82),
        CGPoint(x: 0.70, y: 0.84), CGPoint(x: 0.90, y: 0.52),
        CGPoint(x: 0.10, y: 0.81), CGPoint(x: 0.49, y: 0.61),
        CGPoint(x: 0.25, y: 0.45), CGPoint(x: 0.72, y: 0.22),
    ]

    static func points(for notes: [Note], in size: CGSize) -> [String: CGPoint] {
        var result: [String: CGPoint] = [:]
        var occupied = Set<Int>()

        for note in notes.sorted(by: { $0.id < $1.id }) {
            let index: Int
            if let slot = note.presentation.slot, (1...9).contains(slot) {
                let row = (slot - 1) / 3
                let column = (slot - 1) % 3
                let slotPoint = CGPoint(
                    x: 0.18 + CGFloat(column) * 0.32,
                    y: 0.18 + CGFloat(row) * 0.30
                )
                index = nearestCandidate(to: slotPoint, excluding: occupied)
            } else {
                let seed = stableHash(note.id)
                let start = Int(seed % UInt64(candidates.count))
                index = (0..<candidates.count)
                    .map { (start + $0) % candidates.count }
                    .first { !occupied.contains($0) } ?? start
            }
            occupied.insert(index)
            let normalized = candidates[index]
            result[note.id] = CGPoint(x: normalized.x * size.width, y: normalized.y * size.height)
        }
        return result
    }

    static func edges(for notes: [Note]) -> [(String, String)] {
        let lookup = Dictionary(
            notes.flatMap { note in
                [(note.id.lowercased(), note.id), (note.title.lowercased(), note.id)]
            },
            uniquingKeysWith: { first, _ in first }
        )
        var seen = Set<String>()
        var result: [(String, String)] = []
        let pattern = #"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        for note in notes {
            let range = NSRange(note.content.startIndex..<note.content.endIndex, in: note.content)
            for match in regex.matches(in: note.content, range: range) {
                guard let targetRange = Range(match.range(at: 1), in: note.content) else { continue }
                let reference = note.content[targetRange].trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                guard let target = lookup[reference], target != note.id else { continue }
                let key = [note.id, target].sorted().joined(separator: "→")
                if seen.insert(key).inserted { result.append((note.id, target)) }
            }
        }
        return result
    }

    static func label(for point: CGPoint, in size: CGSize) -> String {
        guard size.width > 0, size.height > 0 else { return "x0 · y0" }
        return "x\(Int(point.x / size.width * 100)) · y\(Int(point.y / size.height * 100))"
    }

    private static func nearestCandidate(to point: CGPoint, excluding occupied: Set<Int>) -> Int {
        candidates.indices
            .filter { !occupied.contains($0) }
            .min {
                squaredDistance(candidates[$0], point) < squaredDistance(candidates[$1], point)
            } ?? 0
    }

    private static func squaredDistance(_ lhs: CGPoint, _ rhs: CGPoint) -> CGFloat {
        let dx = lhs.x - rhs.x
        let dy = lhs.y - rhs.y
        return dx * dx + dy * dy
    }

    private static func stableHash(_ string: String) -> UInt64 {
        string.utf8.reduce(14_695_981_039_346_656_037) { value, byte in
            (value ^ UInt64(byte)) &* 1_099_511_628_211
        }
    }
}

private extension Note {
    var blinkExcerpt: String {
        var lines = content
            .split(separator: "\n", omittingEmptySubsequences: true)
            .map { String($0).trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
        if lines.first.map({ Note.extractTitle(from: $0) == title }) == true {
            lines.removeFirst()
        }
        let value = lines.joined(separator: " ")
            .replacingOccurrences(of: #"[#>*_`]"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? "No additional text yet." : value
    }
}

private extension Date {
    var blinkCompactRelative: String {
        let seconds = max(0, Date().timeIntervalSince(self))
        if seconds < 60 { return "now" }
        if seconds < 3_600 { return "\(Int(seconds / 60))m" }
        if seconds < 86_400 { return "\(Int(seconds / 3_600))h" }
        if seconds < 604_800 { return "\(Int(seconds / 86_400))d" }
        if seconds < 2_592_000 { return "\(Int(seconds / 604_800))w" }
        return "\(Int(seconds / 2_592_000))mo"
    }

    var blinkLongRelative: String {
        let seconds = max(0, Date().timeIntervalSince(self))
        if seconds < 60 { return "just now" }
        if seconds < 3_600 { return "\(Int(seconds / 60)) minutes ago" }
        if seconds < 86_400 { return "\(Int(seconds / 3_600)) hours ago" }
        if seconds < 172_800 { return "yesterday" }
        return "\(Int(seconds / 86_400)) days ago"
    }
}

private extension Color {
    init?(blinkHex raw: String) {
        var value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let number = UInt64(value, radix: 16) else { return nil }
        self.init(
            red: Double((number >> 16) & 0xff) / 255,
            green: Double((number >> 8) & 0xff) / 255,
            blue: Double(number & 0xff) / 255
        )
    }
}
