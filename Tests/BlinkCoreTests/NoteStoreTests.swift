import Testing
import Foundation
@testable import BlinkCore

@Suite("NoteStore")
struct NoteStoreTests {
    private func tempStore() -> (NoteStore, URL) {
        let (store, dir, _) = tempStoreWithCenter()
        return (store, dir)
    }

    /// Each store gets a private NotificationCenter so parallel tests can't
    /// observe each other's notifications (the app injects `.default`).
    private func tempStoreWithCenter() -> (NoteStore, URL, NotificationCenter) {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("BlinkCoreStoreTests-\(UUID().uuidString)", isDirectory: true)
        let center = NotificationCenter()
        let store = NoteStore(fileStore: NoteFileStore(directory: dir), notificationCenter: center)
        return (store, dir, center)
    }

    @Test("create assigns unique slugs for duplicate titles")
    func duplicateTitles() async throws {
        let (store, dir) = tempStore()
        defer { try? FileManager.default.removeItem(at: dir) }

        let a = try await store.create(content: "# Meeting Notes\nfirst")
        let b = try await store.create(content: "# Meeting Notes\nsecond")
        let c = try await store.create(content: "# Meeting Notes\nthird")

        #expect(a.id == "meeting-notes")
        #expect(b.id == "meeting-notes-2")
        #expect(c.id == "meeting-notes-3")
    }

    @Test("update bumps updatedAt and persists")
    func updatePersists() async throws {
        let (store, dir) = tempStore()
        defer { try? FileManager.default.removeItem(at: dir) }

        let created = try await store.create(content: "# Doc\noriginal")
        // Ensure a measurable time delta.
        try await Task.sleep(nanoseconds: 5_000_000)
        let updated = try await store.update(id: created.id, content: "# Doc\nchanged")

        #expect(updated.updatedAt > created.updatedAt)
        #expect(updated.content == "# Doc\nchanged")

        // Reload from disk in a fresh store to prove persistence.
        let fresh = NoteStore(fileStore: NoteFileStore(directory: dir))
        let all = try await fresh.load()
        #expect(all.first { $0.id == created.id }?.content == "# Doc\nchanged")
    }

    @Test("update of unknown id throws")
    func updateUnknownThrows() async throws {
        let (store, dir) = tempStore()
        defer { try? FileManager.default.removeItem(at: dir) }
        await #expect(throws: NoteFileStoreError.self) {
            _ = try await store.update(id: "nonexistent", content: "x")
        }
    }

    @Test("delete removes the file and the in-memory entry")
    func deleteRemoves() async throws {
        let (store, dir) = tempStore()
        defer { try? FileManager.default.removeItem(at: dir) }

        let note = try await store.create(content: "# Trash\nbye")
        let fileStore = NoteFileStore(directory: dir)
        #expect(FileManager.default.fileExists(atPath: fileStore.url(for: note.id).path))

        try await store.delete(id: note.id)
        #expect(await store.note(id: note.id) == nil)
        #expect(!FileManager.default.fileExists(atPath: fileStore.url(for: note.id).path))
    }

    @Test("all() is sorted by updatedAt descending")
    func sortedDescending() async throws {
        let (store, dir) = tempStore()
        defer { try? FileManager.default.removeItem(at: dir) }

        let a = try await store.create(content: "# Alpha")
        try await Task.sleep(nanoseconds: 2_000_000)
        let b = try await store.create(content: "# Beta")
        try await Task.sleep(nanoseconds: 2_000_000)
        _ = try await store.update(id: a.id, content: "# Alpha\nedited")

        let all = await store.all()
        // a was updated most recently, so it should sort first; b second.
        #expect(all.map(\.id) == [a.id, b.id])
    }

    @Test("load reads existing files from disk")
    func loadFromDisk() async throws {
        let (store, dir) = tempStore()
        defer { try? FileManager.default.removeItem(at: dir) }
        _ = try await store.create(content: "# Persisted\nhi")

        let fresh = NoteStore(fileStore: NoteFileStore(directory: dir))
        let loaded = try await fresh.load()
        #expect(loaded.contains { $0.content == "# Persisted\nhi" })
    }

    @Test("create posts blinkNoteCreated with correct id")
    func createNotification() async throws {
        let (store, dir, center) = tempStoreWithCenter()
        defer { try? FileManager.default.removeItem(at: dir) }

        let received = NotificationBox()
        let token = center.addObserver(
            forName: .blinkNoteCreated, object: nil, queue: nil
        ) { note in
            received.set(note.userInfo?["id"] as? String)
        }
        defer { center.removeObserver(token) }

        let created = try await store.create(content: "# Notify\nx")
        #expect(received.value == created.id)
    }

    @Test("update and delete post notifications with correct id")
    func updateDeleteNotifications() async throws {
        let (store, dir, center) = tempStoreWithCenter()
        defer { try? FileManager.default.removeItem(at: dir) }
        let created = try await store.create(content: "# N\n1")

        let updatedBox = NotificationBox()
        let deletedBox = NotificationBox()
        let t1 = center.addObserver(forName: .blinkNoteUpdated, object: nil, queue: nil) {
            updatedBox.set($0.userInfo?["id"] as? String)
        }
        let t2 = center.addObserver(forName: .blinkNoteDeleted, object: nil, queue: nil) {
            deletedBox.set($0.userInfo?["id"] as? String)
        }
        defer {
            center.removeObserver(t1)
            center.removeObserver(t2)
        }

        _ = try await store.update(id: created.id, content: "# N\n2")
        #expect(updatedBox.value == created.id)

        try await store.delete(id: created.id)
        #expect(deletedBox.value == created.id)
    }
}

/// Thread-safe holder so notification observers can hand a value back to the test.
final class NotificationBox: @unchecked Sendable {
    private let lock = NSLock()
    private var _value: String?
    func set(_ v: String?) {
        lock.lock(); defer { lock.unlock() }
        _value = v
    }
    var value: String? {
        lock.lock(); defer { lock.unlock() }
        return _value
    }
}
