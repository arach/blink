import Foundation

/// Errors thrown by `NoteFileStore`.
public enum NoteFileStoreError: Error, Equatable, Sendable {
    case noteNotFound(id: String)
}

/// Persists notes as `<id>.md` files in a directory, one file per note, using the
/// frontmatter codec. All writes are atomic: v1 lost data to bare writes, so we
/// write to a temp file in the *same* directory, `fsync`, then rename over the
/// destination.
public struct NoteFileStore: Sendable {
    public let directory: URL

    public init(directory: URL) {
        self.directory = directory
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    /// `<directory>/<id>.md`
    public func url(for id: String) -> URL {
        directory.appendingPathComponent("\(id).md", isDirectory: false)
    }

    private func tempURL(for id: String) -> URL {
        directory.appendingPathComponent(".\(id).md.tmp", isDirectory: false)
    }

    /// Atomically write a note to disk: temp file + fsync + rename.
    public func save(_ note: Note) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        let destination = url(for: note.id)
        let temp = tempURL(for: note.id)
        let data = Data(Frontmatter.encode(note).utf8)

        // Remove any stale temp file first.
        if FileManager.default.fileExists(atPath: temp.path) {
            try FileManager.default.removeItem(at: temp)
        }
        FileManager.default.createFile(atPath: temp.path, contents: nil)

        let handle = try FileHandle(forWritingTo: temp)
        do {
            try handle.write(contentsOf: data)
            try handle.synchronize() // fsync before rename
            try handle.close()
        } catch {
            try? handle.close()
            try? FileManager.default.removeItem(at: temp)
            throw error
        }

        // Atomic replace of destination.
        _ = try FileManager.default.replaceItemAt(destination, withItemAt: temp)
    }

    /// Load every `*.md` file in the directory (skipping dotfiles and `.tmp`).
    public func loadAll() throws -> [Note] {
        guard FileManager.default.fileExists(atPath: directory.path) else { return [] }

        let entries = try FileManager.default.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        )

        var notes: [Note] = []
        for url in entries {
            let name = url.lastPathComponent
            guard name.hasSuffix(".md"), !name.hasPrefix(".") else { continue }
            let contents = try String(contentsOf: url, encoding: .utf8)
            let note = try Frontmatter.decode(contents)
            notes.append(note)
        }
        return notes
    }

    /// Load a single note by id.
    public func load(id: String) throws -> Note {
        let target = url(for: id)
        guard FileManager.default.fileExists(atPath: target.path) else {
            throw NoteFileStoreError.noteNotFound(id: id)
        }
        let contents = try String(contentsOf: target, encoding: .utf8)
        return try Frontmatter.decode(contents)
    }

    /// Delete a note's file by id.
    public func delete(id: String) throws {
        let target = url(for: id)
        guard FileManager.default.fileExists(atPath: target.path) else {
            throw NoteFileStoreError.noteNotFound(id: id)
        }
        try FileManager.default.removeItem(at: target)
    }
}
