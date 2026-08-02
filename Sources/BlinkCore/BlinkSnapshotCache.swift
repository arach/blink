import Foundation

public enum BlinkSnapshotCacheError: Error, LocalizedError, Equatable, Sendable {
    case decodingFailed(String)
    case encodingFailed(String)

    public var errorDescription: String? {
        switch self {
        case .decodingFailed(let detail):
            return "Blink's offline notes could not be decoded: \(detail)"
        case .encodingFailed(let detail):
            return "Blink's offline notes could not be encoded: \(detail)"
        }
    }
}

/// A replaceable mobile cache for peer snapshots. The server's snapshot is
/// authoritative except for quarantined IDs: when a source file is unreadable
/// or identity-divergent, the last known-good note remains visible until the
/// source recovers or a durable tombstone explicitly deletes it.
public actor BlinkSnapshotCache {
    public let fileURL: URL

    public init(fileURL: URL) {
        self.fileURL = fileURL
    }

    public func load() throws -> BlinkSnapshot? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        do {
            let decoder = JSONDecoder()
            decoder.dateDecodingStrategy = .millisecondsSince1970
            return try decoder.decode(BlinkSnapshot.self, from: Data(contentsOf: fileURL))
        } catch {
            throw BlinkSnapshotCacheError.decodingFailed(error.localizedDescription)
        }
    }

    @discardableResult
    public func apply(_ incoming: BlinkSnapshot) throws -> BlinkSnapshot {
        let previous = try load()
        let deletedIDs = Set(incoming.tombstones.map(\.id))
        let quarantinedIDs = Set(incoming.issues.compactMap(\.expectedID))
        var notesByID = Dictionary(
            incoming.notes.map { ($0.id, $0) },
            uniquingKeysWith: { _, latest in latest }
        )

        if let previous {
            for note in previous.notes
                where quarantinedIDs.contains(note.id)
                    && !deletedIDs.contains(note.id)
                    && notesByID[note.id] == nil {
                notesByID[note.id] = note
            }
        }
        for id in deletedIDs {
            notesByID[id] = nil
        }

        var cached = incoming
        cached.notes = notesByID.values.sorted { $0.id < $1.id }
        try persist(cached)
        return cached
    }

    public func removeAll() throws {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        try FileManager.default.removeItem(at: fileURL)
    }

    private func persist(_ snapshot: BlinkSnapshot) throws {
        let data: Data
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .millisecondsSince1970
            encoder.outputFormatting = [.sortedKeys]
            data = try encoder.encode(snapshot)
        } catch {
            throw BlinkSnapshotCacheError.encodingFailed(error.localizedDescription)
        }

        let directory = fileURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let tempURL = directory.appendingPathComponent(
            ".\(fileURL.lastPathComponent).\(UUID().uuidString).tmp"
        )
        FileManager.default.createFile(atPath: tempURL.path, contents: nil)
        let handle = try FileHandle(forWritingTo: tempURL)
        do {
            try handle.write(contentsOf: data)
            try handle.synchronize()
            try handle.close()
        } catch {
            try? handle.close()
            try? FileManager.default.removeItem(at: tempURL)
            throw error
        }

        do {
            if FileManager.default.fileExists(atPath: fileURL.path) {
                _ = try FileManager.default.replaceItemAt(fileURL, withItemAt: tempURL)
            } else {
                try FileManager.default.moveItem(at: tempURL, to: fileURL)
            }
        } catch {
            try? FileManager.default.removeItem(at: tempURL)
            throw error
        }
    }
}
