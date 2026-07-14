import BlinkCore
import SwiftUI

/// The menubar popover — home base. One field does everything: type to filter,
/// ↵ opens the first hit (or creates from the text when nothing matches),
/// ⌘↵ always creates a new note seeded with the text.
struct CapturePopoverView: View {
    @ObservedObject var model: AppModel
    var dismiss: () -> Void
    var openSettings: () -> Void

    @State private var query = ""
    @FocusState private var fieldFocused: Bool

    private var trimmedQuery: String {
        query.trimmingCharacters(in: .whitespaces)
    }

    private var filtered: [Note] {
        guard !trimmedQuery.isEmpty else { return Array(model.notes.prefix(6)) }
        let q = trimmedQuery.lowercased()
        return Array(
            model.notes
                .filter { $0.title.lowercased().contains(q) || $0.content.lowercased().contains(q) }
                .prefix(8)
        )
    }

    var body: some View {
        VStack(spacing: 0) {
            captureField
            Divider().opacity(0.4)
            notesList
            Divider().opacity(0.4)
            footer
        }
        .frame(width: 312)
        // Invisible ⌘↵ target: always "create note from the field text".
        .background(
            Button("") { createFromQuery() }
                .keyboardShortcut(.return, modifiers: .command)
                .opacity(0)
        )
    }

    private var captureField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 12))
                .foregroundStyle(.tertiary)
            TextField("Search or capture…", text: $query)
                .textFieldStyle(.plain)
                .font(.system(size: 13))
                .focused($fieldFocused)
                .onSubmit { openFirstOrCreate() }
            Image(systemName: "mic")
                .font(.system(size: 12))
                .foregroundStyle(.quaternary)
                .help("Dictation — coming in M4")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .onAppear { fieldFocused = true }
    }

    private var notesList: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(trimmedQuery.isEmpty ? "RECENT" : "MATCHES")
                .font(.system(size: 9, weight: .medium).monospaced())
                .tracking(2)
                .foregroundStyle(.tertiary)
                .padding(.horizontal, 8)
                .padding(.bottom, 4)

            if model.notes.isEmpty {
                emptyState("No notes yet — Hyper+N from anywhere.")
            } else if filtered.isEmpty {
                emptyState("No matches — ↵ to create “\(trimmedQuery)”.")
            } else {
                ForEach(filtered, id: \.id) { note in
                    NoteRow(note: note) {
                        open(note)
                    } onDelete: {
                        delete(note)
                    }
                }
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 10)
    }

    private var footer: some View {
        HStack {
            Text("⌘↵ new note")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
            Spacer()
            Button(action: openSettings) {
                Image(systemName: "gearshape")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
            .buttonStyle(.plain)
            .help("Settings")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private func emptyState(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .center)
    }

    // MARK: - Actions

    private func openFirstOrCreate() {
        if let first = filtered.first, !trimmedQuery.isEmpty {
            open(first)
        } else if !trimmedQuery.isEmpty {
            createFromQuery()
        } else if let first = filtered.first {
            open(first)
        }
    }

    private func createFromQuery() {
        let text = trimmedQuery
        Task { await model.createNote(content: text) }
        dismiss()
    }

    private func open(_ note: Note) {
        Task { await model.openNote(id: note.id) }
        dismiss()
    }

    private func delete(_ note: Note) {
        Task { await model.deleteNote(id: note.id) }
    }
}

private struct NoteRow: View {
    let note: Note
    var onOpen: () -> Void
    var onDelete: () -> Void

    @State private var hovered = false

    var body: some View {
        HStack(spacing: 8) {
            Text("▸")
                .font(.system(size: 11))
                .foregroundStyle(.quaternary)
            Text(note.title)
                .font(.system(size: 13))
                .lineLimit(1)
            Spacer(minLength: 8)
            Text(note.updatedAt, format: .relative(presentation: .named))
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(hovered ? Color.white.opacity(0.07) : .clear, in: RoundedRectangle(cornerRadius: 6))
        .contentShape(Rectangle())
        .onHover { hovered = $0 }
        .onTapGesture { onOpen() }
        .contextMenu {
            Button("Open as Panel") { onOpen() }
            Divider()
            Button("Delete", role: .destructive) { onDelete() }
        }
    }
}
