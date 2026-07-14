import ArgumentParser
import BlinkCore
import Foundation

/// The agent surface, layer 2 (docs/notes-representation.md §3.4): a CLI over
/// the exact same files and codec the app uses. Writes are atomic and
/// slug-safe via BlinkCore; the running app reconciles the directory and picks
/// every change up live — no IPC, no daemon, no racing.
@main
struct BlinkCommand: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "blink",
        abstract: "Blink notes from the command line.",
        discussion: """
        Operates on the same files as the app: $BLINK_HOME/Notes when set, \
        else ~/Library/Application Support/Blink/Notes. Every command takes \
        --json for structured output.
        """,
        version: "0.1.0",
        subcommands: [Ls.self, Cat.self, New.self, Search.self, Rm.self, PathCommand.self]
    )
}

// MARK: - Commands

struct Ls: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "List notes, most recently updated first."
    )

    @Flag(help: "Structured output.") var json = false
    @Option(name: .shortAndLong, help: "Show at most this many notes.") var limit: Int?

    func run() async throws {
        var notes = try await loadedStore().all()
        if let limit { notes = Array(notes.prefix(limit)) }
        try output(notes, json: json)
    }
}

struct Cat: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Print a note's markdown content (frontmatter stripped)."
    )

    @Argument(help: "The note id (slug).") var id: String
    @Flag(help: "Full note as JSON — content plus all metadata.") var json = false

    func run() throws {
        let note = try existingNote(id: id)
        if json {
            try printJSON(NoteJSON(note, full: true))
        } else {
            // Exact bytes, like cat(1) — no added trailing newline.
            FileHandle.standardOutput.write(Data(note.content.utf8))
        }
    }
}

struct New: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Create a note from arguments or stdin; prints the assigned id.",
        discussion: "The first line becomes the title; the id is a unique slug derived from it."
    )

    @Argument(parsing: .remaining, help: "Note content (omit to read stdin).")
    var content: [String] = []
    @Flag(help: "Structured output.") var json = false

    func run() async throws {
        var text = content.joined(separator: " ")
        if text.isEmpty, isatty(0) == 0 {
            text = String(
                decoding: FileHandle.standardInput.readDataToEndOfFile(), as: UTF8.self
            )
        }
        let note = try await loadedStore().create(content: text)
        if json {
            try printJSON(NoteJSON(note, full: false))
        } else {
            print(note.id)
        }
    }
}

struct Search: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Find notes whose title or content contains a string (case-insensitive)."
    )

    @Argument(help: "The text to search for.") var query: String
    @Flag(help: "Structured output.") var json = false

    func run() async throws {
        let q = query.lowercased()
        let hits = try await loadedStore().all().filter {
            $0.title.lowercased().contains(q) || $0.content.lowercased().contains(q)
        }
        try output(hits, json: json)
    }
}

struct Rm: AsyncParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Delete a note by id."
    )

    @Argument(help: "The note id (slug).") var id: String
    @Flag(help: "Structured output.") var json = false

    func run() throws {
        _ = try existingNote(id: id)
        try fileStore().delete(id: id)
        if json {
            try printJSON(["deleted": id])
        } else {
            print("deleted \(id)")
        }
    }
}

struct PathCommand: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "path",
        abstract: "Print the notes directory, or a note's file path."
    )

    @Argument(help: "A note id (omit for the notes directory).") var id: String?

    func run() throws {
        if let id {
            _ = try existingNote(id: id)
            print(fileStore().url(for: id).path)
        } else {
            print(BlinkPaths.notes().path)
        }
    }
}

// MARK: - Shared plumbing

private func fileStore() -> NoteFileStore {
    NoteFileStore(directory: BlinkPaths.notes())
}

private func loadedStore() async throws -> NoteStore {
    let store = NoteStore(fileStore: fileStore())
    try await store.load()
    return store
}

struct NoteNotFound: Error, CustomStringConvertible {
    let id: String
    var description: String { "no note with id '\(id)' in \(BlinkPaths.notes().path)" }
}

private func existingNote(id: String) throws -> Note {
    do {
        return try fileStore().load(id: id)
    } catch {
        throw NoteNotFound(id: id)
    }
}

/// The JSON face of a note. `content`/`extraFrontmatter` only for full output.
struct NoteJSON: Encodable {
    let id: String
    let title: String
    let tags: [String]
    let pinned: Bool
    let created: Date
    let updated: Date
    let path: String
    let content: String?
    let extraFrontmatter: [String]?

    init(_ note: Note, full: Bool) {
        id = note.id
        title = note.title
        tags = note.tags
        pinned = note.pinned
        created = note.createdAt
        updated = note.updatedAt
        path = NoteFileStore(directory: BlinkPaths.notes()).url(for: note.id).path
        content = full ? note.content : nil
        extraFrontmatter = full ? note.extraFrontmatter : nil
    }
}

private func output(_ notes: [Note], json: Bool) throws {
    if json {
        try printJSON(notes.map { NoteJSON($0, full: false) })
    } else if notes.isEmpty {
        FileHandle.standardError.write(Data("no notes\n".utf8))
    } else {
        let idWidth = notes.map(\.id.count).max() ?? 0
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        for note in notes {
            let id = note.id.padding(toLength: idWidth, withPad: " ", startingAt: 0)
            print("\(id)  \(formatter.string(from: note.updatedAt))  \(note.title)")
        }
    }
}

private func printJSON(_ value: some Encodable) throws {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
    encoder.dateEncodingStrategy = .custom { date, encoder in
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var container = encoder.singleValueContainer()
        try container.encode(f.string(from: date))
    }
    let data = try encoder.encode(value)
    print(String(decoding: data, as: UTF8.self))
}
