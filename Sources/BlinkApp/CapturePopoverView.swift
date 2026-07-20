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

    // Design tokens from "Capture Window.dc.html" (Talkie capture refinement).
    // Sharp, thin-monospace terminal look; accent is Talkie's #ff5822.
    private let amber = Color(red: 1.0, green: 0.345, blue: 0.133)        // #ff5822
    private let amberBright = Color(red: 1.0, green: 0.478, blue: 0.302)  // #ff7a4d
    private let live = Color(red: 0.353, green: 0.820, blue: 0.608)       // #5ad19b

    /// The design is set in IBM Plex Mono weight 200. SF Mono at a light weight
    /// is the closest native match (bundling IBM Plex Mono would be exact).
    private func mono(_ size: CGFloat, _ weight: Font.Weight = .light) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }

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
                        .frame(width: 262)
                    verticalHairline
                }
                canvasPane
            }
            hairline
            footer
        }
        .frame(width: Self.contentSize.width, height: Self.contentSize.height)
        .background(popoverBackground)
        .overlay(PopoutCorners())
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
            Color(red: 0.039, green: 0.043, blue: 0.047)  // #0a0b0c panel base
            RadialGradient(
                colors: [
                    Color(red: 0.090, green: 0.098, blue: 0.110),  // #17191c
                    Color(red: 0.047, green: 0.055, blue: 0.063),  // #0c0e10
                    Color(red: 0.020, green: 0.024, blue: 0.027),  // #050607
                ],
                center: UnitPoint(x: 0.78, y: 0.0),
                startRadius: 0,
                endRadius: 820
            )
            TerminalGrid(step: 40, opacity: 0.02)
        }
    }

    private var searchHeader: some View {
        HStack(spacing: 13) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 15, weight: .light))
                .foregroundStyle(Color(red: 0.42, green: 0.44, blue: 0.45))  // #6b7072

            TextField("Search or capture…", text: $query)
                .textFieldStyle(.plain)
                .font(mono(15, .light))
                .foregroundStyle(Color(red: 0.902, green: 0.91, blue: 0.902))  // #e6e8e6
                .tint(amber)
                .focused($fieldFocused)
                .onSubmit { openFirstOrCreate() }

            HStack(spacing: 6) {
                Circle()
                    .fill(live)
                    .frame(width: 6, height: 6)
                    .shadow(color: live.opacity(0.8), radius: 4)
                Text("LIVE")
                    .font(mono(10.5))
                    .tracking(1.6)
                    .foregroundStyle(live)
            }
            .padding(.trailing, 4)

            KeyBadge(text: "⌘K")

            Button(action: startSystemDictation) {
                Image(systemName: "mic.fill")
                    .font(.system(size: 14, weight: .light))
                    .foregroundStyle(amberBright)
                    .frame(width: 30, height: 30)
                    .background(amber.opacity(0.18))
                    .overlay(Rectangle().stroke(amber.opacity(0.65), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .help("Dictate into capture")
        }
        .padding(.horizontal, 18)
        .frame(height: 56)
    }

    private var numberedNotes: [(index: Int, note: Note)] {
        filtered.enumerated().map { (index: $0.offset + 1, note: $0.element) }
    }
    private var todayItems: [(index: Int, note: Note)] {
        numberedNotes.filter { Calendar.current.isDateInToday($0.note.updatedAt) }
    }
    private var earlierItems: [(index: Int, note: Note)] {
        numberedNotes.filter { !Calendar.current.isDateInToday($0.note.updatedAt) }
    }

    private var recentSidebar: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(trimmedQuery.isEmpty ? "LOG" : "MATCHES")
                    .font(mono(10)).tracking(1.8).textCase(.uppercase)
                    .foregroundStyle(Color(red: 0.42, green: 0.44, blue: 0.45))
                Spacer()
                Text("\(filtered.count) REC")
                    .font(mono(10)).tracking(1)
                    .foregroundStyle(Color(red: 0.263, green: 0.282, blue: 0.294))
            }
            .padding(.horizontal, 18)
            .padding(.top, 15)
            .padding(.bottom, 10)

            if model.notes.isEmpty {
                emptyState("No notes yet — create your first thought.")
            } else if filtered.isEmpty {
                emptyState("No matches — Return creates “\(trimmedQuery)”.")
            } else {
                ScrollView(.vertical) {
                    LazyVStack(alignment: .leading, spacing: 1) {
                        if !todayItems.isEmpty {
                            sidebarSection("Today")
                            ForEach(todayItems, id: \.note.id) { sidebarRow($0, earlier: false) }
                        }
                        if !earlierItems.isEmpty {
                            sidebarSection("Earlier")
                            ForEach(earlierItems, id: \.note.id) { sidebarRow($0, earlier: true) }
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.bottom, 12)
                }
                .background(SubtleScroller())
            }
        }
    }

    private func sidebarSection(_ title: String) -> some View {
        Text(title)
            .font(mono(9)).tracking(2).textCase(.uppercase)
            .foregroundStyle(Color(red: 0.239, green: 0.255, blue: 0.263))
            .padding(.horizontal, 8)
            .padding(.top, 12)
            .padding(.bottom, 6)
    }

    @ViewBuilder
    private func sidebarRow(_ item: (index: Int, note: Note), earlier: Bool) -> some View {
        RecentNoteRow(
            index: item.index,
            note: item.note,
            amber: amber,
            selected: item.note.id == selectedNote?.id,
            earlier: earlier,
            onSelect: { selectedNoteID = item.note.id },
            onOpen: { open(item.note) },
            onCopyMarkdown: { copyToPasteboard(item.note.content) },
            onCopyPath: {
                copyToPasteboard(
                    AppDelegate.notesDirectory()
                        .appendingPathComponent("\(item.note.id).md").path
                )
            },
            onDelete: { delete(item.note) }
        )
    }

    private var canvasPane: some View {
        VStack(spacing: 0) {
            HStack {
                (
                    Text("CANVAS ")
                        .foregroundColor(Color(red: 0.498, green: 0.522, blue: 0.529))  // #7f8587
                    + Text("/ ")
                        .foregroundColor(Color(red: 0.239, green: 0.255, blue: 0.263))  // #3d4143
                    + Text("\(String(format: "%02d", filtered.count)) NODES")
                        .foregroundColor(amberBright)
                )
                .font(mono(10)).tracking(1.6)

                Spacer()

                CanvasModePicker(selection: $canvasMode, amber: amber)

                Rectangle().fill(.white.opacity(0.1)).frame(width: 1, height: 14).padding(.horizontal, 4)

                Button {
                    withAnimation(.easeInOut(duration: 0.18)) { canvasExpanded.toggle() }
                } label: {
                    Image(systemName: canvasExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right")
                        .font(.system(size: 13, weight: .light))
                        .foregroundStyle(Color(red: 0.769, green: 0.784, blue: 0.776))  // #c4c8c6
                        .frame(width: 26, height: 26)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(canvasExpanded ? "Show recents" : "Expand canvas")
                .accessibilityLabel(canvasExpanded ? "Show recents" : "Expand canvas")
            }
            .padding(.horizontal, 20)
            .frame(height: 42)

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
                            amber: amber,
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
        HStack(spacing: 7) {
            Button { createFromQuery() } label: {
                HStack(spacing: 7) {
                    KeyCap(symbol: "⌘")
                    KeyCap(symbol: "↩")
                    Text("New node")
                        .font(mono(10.5)).tracking(1).textCase(.uppercase)
                        .foregroundStyle(Color(red: 0.42, green: 0.44, blue: 0.45))
                }
            }
            .buttonStyle(.plain)
            .help(trimmedQuery.isEmpty ? "New note" : "Create “\(trimmedQuery)”")

            Spacer()

            Text("STATUS · READY")
                .font(mono(10.5)).tracking(1)
                .foregroundStyle(Color(red: 0.329, green: 0.349, blue: 0.357))

            Button(action: toggleBlink) {
                HStack(spacing: 6) {
                    Image(systemName: "eye")
                        .font(.system(size: 12, weight: .light))
                    Text("⌥Space")
                        .font(mono(10))
                        .padding(.horizontal, 5).padding(.vertical, 1)
                        .overlay(Rectangle().stroke(.white.opacity(0.1), lineWidth: 1))
                }
                .foregroundStyle(Color(red: 0.651, green: 0.675, blue: 0.682))  // #a6acae
            }
            .buttonStyle(.plain)
            .help("Blink notes (⌥Space)")
        }
        .padding(.horizontal, 18)
        .frame(height: 38)
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
        HStack(spacing: 5) {
            ForEach(CanvasMode.allCases) { mode in
                Button { selection = mode } label: {
                    Image(systemName: mode.icon)
                        .font(.system(size: 13, weight: .light))
                        .foregroundStyle(
                            selection == mode
                                ? Color(red: 1.0, green: 0.478, blue: 0.302)         // #ff7a4d
                                : Color(red: 0.769, green: 0.784, blue: 0.776)        // #c4c8c6
                        )
                        .frame(width: 24, height: 24)
                        .background(selection == mode ? amber.opacity(0.1) : .clear)  // sharp
                        .overlay {
                            if selection == mode {
                                Rectangle().stroke(amber.opacity(0.3), lineWidth: 1)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .help(mode.rawValue.capitalized)
                .accessibilityLabel("\(mode.rawValue.capitalized) view")
            }
        }
    }
}

private struct RecentNoteRow: View {
    let index: Int
    let note: Note
    let amber: Color
    let selected: Bool
    let earlier: Bool
    var onSelect: () -> Void
    var onOpen: () -> Void
    var onCopyMarkdown: () -> Void
    var onCopyPath: () -> Void
    var onDelete: () -> Void

    @State private var hovered = false

    // Tiered ink: the active row is warm, today rows read clear, earlier ones recede.
    private var numberColor: Color {
        if selected { return Color(red: 1.0, green: 0.478, blue: 0.302) }   // #ff7a4d
        return earlier ? Color(red: 0.239, green: 0.255, blue: 0.263)       // #3d4143
                       : Color(red: 0.329, green: 0.349, blue: 0.357)       // #54595b
    }
    private var titleColor: Color {
        if selected { return Color(red: 0.984, green: 0.933, blue: 0.910) } // #fbeee8
        return earlier ? Color(red: 0.498, green: 0.522, blue: 0.529)       // #7f8587
                       : Color(red: 0.824, green: 0.835, blue: 0.827)       // #d2d5d3
    }
    private var timeColor: Color {
        if selected { return Color(red: 0.784, green: 0.576, blue: 0.373) } // #c8935f
        return earlier ? Color(red: 0.329, green: 0.349, blue: 0.357)       // #54595b
                       : Color(red: 0.42, green: 0.44, blue: 0.45)          // #6b7072
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 10) {
                Text(String(format: "%02d", index))
                    .font(.system(size: 10.5, weight: .light, design: .monospaced))
                    .foregroundStyle(numberColor)

                Text(note.title)
                    .font(.system(size: 12, weight: .light, design: .monospaced))
                    .foregroundStyle(titleColor)
                    .lineLimit(1)
                    .truncationMode(.tail)

                Spacer(minLength: 8)

                Text(note.updatedAt.blinkCompactRelative)
                    .font(.system(size: 10.5, weight: .light, design: .monospaced))
                    .foregroundStyle(timeColor)
                    .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .frame(height: 32)
            .background(
                selected ? amber.opacity(0.08) : (hovered ? .white.opacity(0.04) : .clear)
            )
            .overlay(alignment: .leading) {
                if selected {
                    Rectangle().fill(amber).frame(width: 2)  // inset left bar
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
    let amber: Color
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
                            with: .color(.white.opacity(0.08)),
                            style: StrokeStyle(lineWidth: 1, dash: [5, 7])
                        )
                    }
                }
                .allowsHitTesting(false)

                ForEach(Array(notes.enumerated()), id: \.element.id) { offset, note in
                    if let point = points[note.id] {
                        ConstellationNode(
                            index: offset + 1,
                            note: note,
                            amber: amber,
                            selected: note.id == selectedNoteID,
                            onSelect: { onSelect(note) },
                            onOpen: { onOpen(note) }
                        )
                        .position(point)
                    }
                }
            }
            .clipShape(Rectangle())
        }
    }
}

private struct ConstellationNode: View {
    let index: Int
    let note: Note
    let amber: Color
    let selected: Bool
    let onSelect: () -> Void
    let onOpen: () -> Void

    @State private var hovered = false

    // Recency tier drives prominence: A (freshest) → B → C recede into the board.
    private var tier: Int { index <= 3 ? 0 : (index <= 6 ? 1 : 2) }

    private var bgColor: Color {
        if selected { return Color(red: 0.071, green: 0.063, blue: 0.067) }  // #121011
        switch tier {
        case 0: return Color(red: 0.055, green: 0.059, blue: 0.067)          // #0e0f11
        case 1: return Color(red: 0.039, green: 0.043, blue: 0.047)          // #0a0b0c
        default: return Color(red: 0.031, green: 0.035, blue: 0.039)         // #08090a
        }
    }
    private var borderColor: Color {
        if selected { return amber.opacity(0.55) }
        switch tier {
        case 0: return .white.opacity(hovered ? 0.25 : 0.11)
        case 1: return .white.opacity(hovered ? 0.18 : 0.08)
        default: return .white.opacity(hovered ? 0.12 : 0.05)
        }
    }
    private var titleColor: Color {
        if selected { return .white }
        switch tier {
        case 0: return Color(red: 0.902, green: 0.91, blue: 0.902)           // #e6e8e6
        case 1: return Color(red: 0.514, green: 0.537, blue: 0.545)          // #83898b
        default: return Color(red: 0.329, green: 0.349, blue: 0.357)         // #54595b
        }
    }
    private var numberColor: Color {
        if selected { return Color(red: 1.0, green: 0.478, blue: 0.302) }    // #ff7a4d
        switch tier {
        case 0: return Color(red: 0.329, green: 0.349, blue: 0.357)          // #54595b
        case 1: return Color(red: 0.263, green: 0.282, blue: 0.294)          // #43484b
        default: return Color(red: 0.2, green: 0.22, blue: 0.227)            // #33383a
        }
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 8) {
                Text(String(format: "%02d", index))
                    .font(.system(size: selected ? 10.5 : (tier == 0 ? 10 : 9.5), weight: .light, design: .monospaced))
                    .foregroundStyle(numberColor)
                Text(note.title)
                    .font(.system(size: selected ? 12 : (tier == 0 ? 11.5 : 11), weight: .light, design: .monospaced))
                    .foregroundStyle(titleColor)
                    .lineLimit(1)
                if selected {
                    Text(note.updatedAt.blinkCompactRelative)
                        .font(.system(size: 10, weight: .light, design: .monospaced))
                        .foregroundStyle(Color(red: 0.42, green: 0.44, blue: 0.45))
                }
            }
            .padding(.horizontal, selected ? 13 : (tier == 0 ? 12 : 11))
            .padding(.vertical, selected ? 8 : (tier == 0 ? 7 : 6))
            .background(bgColor)                                 // sharp corners
            .overlay(Rectangle().stroke(borderColor, lineWidth: 1))
            .overlay { if selected { CornerTicks(color: amber) } }
            .shadow(
                color: selected ? amber.opacity(0.35) : .black.opacity(0.2),
                radius: selected ? 14 : 4, x: 0, y: selected ? 6 : 2
            )
            .offset(y: hovered && !selected ? -2 : 0)
            .animation(.easeOut(duration: 0.12), value: hovered)
        }
        .buttonStyle(.plain)
        .onHover { hovered = $0 }
        .simultaneousGesture(TapGesture(count: 2).onEnded(onOpen))
        .help("Double-click to open \(note.title)")
    }
}

/// Amber L-brackets just outside a node's four corners — the "locked/active"
/// framing from the design.
private struct CornerTicks: View {
    let color: Color
    var len: CGFloat = 7
    var lineWidth: CGFloat = 1.5
    var out: CGFloat = 3

    var body: some View {
        GeometryReader { g in
            let w = g.size.width, h = g.size.height
            Path { p in
                p.move(to: CGPoint(x: -out, y: -out + len)); p.addLine(to: CGPoint(x: -out, y: -out)); p.addLine(to: CGPoint(x: -out + len, y: -out))
                p.move(to: CGPoint(x: w + out - len, y: -out)); p.addLine(to: CGPoint(x: w + out, y: -out)); p.addLine(to: CGPoint(x: w + out, y: -out + len))
                p.move(to: CGPoint(x: -out, y: h + out - len)); p.addLine(to: CGPoint(x: -out, y: h + out)); p.addLine(to: CGPoint(x: -out + len, y: h + out))
                p.move(to: CGPoint(x: w + out - len, y: h + out)); p.addLine(to: CGPoint(x: w + out, y: h + out)); p.addLine(to: CGPoint(x: w + out, y: h + out - len))
            }
            .stroke(color, lineWidth: lineWidth)
        }
        .allowsHitTesting(false)
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

/// The faint 1px line grid that underlays the whole popout.
private struct TerminalGrid: View {
    var step: CGFloat = 40
    var opacity: Double = 0.02

    var body: some View {
        Canvas { context, size in
            let color = Color.white.opacity(opacity)
            var x: CGFloat = 0
            while x < size.width {
                context.stroke(Path { $0.move(to: CGPoint(x: x, y: 0)); $0.addLine(to: CGPoint(x: x, y: size.height)) }, with: .color(color), lineWidth: 1)
                x += step
            }
            var y: CGFloat = 0
            while y < size.height {
                context.stroke(Path { $0.move(to: CGPoint(x: 0, y: y)); $0.addLine(to: CGPoint(x: size.width, y: y)) }, with: .color(color), lineWidth: 1)
                y += step
            }
        }
        .allowsHitTesting(false)
    }
}

/// The four L-brackets framing the popout, per the design's terminal chrome.
private struct PopoutCorners: View {
    var len: CGFloat = 13
    var body: some View {
        let color = Color(red: 0.353, green: 0.376, blue: 0.388)  // #5a6063
        GeometryReader { g in
            let w = g.size.width, h = g.size.height
            Path { p in
                p.move(to: CGPoint(x: 0, y: len)); p.addLine(to: CGPoint(x: 0, y: 0)); p.addLine(to: CGPoint(x: len, y: 0))
                p.move(to: CGPoint(x: w - len, y: 0)); p.addLine(to: CGPoint(x: w, y: 0)); p.addLine(to: CGPoint(x: w, y: len))
                p.move(to: CGPoint(x: 0, y: h - len)); p.addLine(to: CGPoint(x: 0, y: h)); p.addLine(to: CGPoint(x: len, y: h))
                p.move(to: CGPoint(x: w - len, y: h)); p.addLine(to: CGPoint(x: w, y: h)); p.addLine(to: CGPoint(x: w, y: h - len))
            }
            .stroke(color, lineWidth: 1)
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
            .font(.system(size: 11, weight: .light, design: .monospaced))
            .foregroundStyle(Color(red: 0.824, green: 0.835, blue: 0.827))  // #d2d5d3
            .frame(minWidth: 20, minHeight: 20)
            .overlay(Rectangle().stroke(.white.opacity(0.1), lineWidth: 1))   // sharp
    }
}

/// A bordered inline key hint (e.g. ⌘K) — sharp, thin, per the design.
private struct KeyBadge: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 10.5, weight: .light, design: .monospaced))
            .foregroundStyle(Color(red: 0.42, green: 0.44, blue: 0.45))  // #6b7072
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .overlay(Rectangle().stroke(.white.opacity(0.1), lineWidth: 1))
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
