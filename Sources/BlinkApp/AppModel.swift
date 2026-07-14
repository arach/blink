import BlinkCore
import Foundation
import HudsonObservability
import SwiftUI

/// The single observable source of truth for every UI surface (popover, panels,
/// future palette). Mirrors the `NoteStore` actor into a @Published snapshot,
/// refreshed on every store notification — so any surface that mutates notes
/// automatically updates every other surface.
@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var notes: [Note] = []

    private let store: NoteStore
    private let panelManager: PanelManager
    private var observers: [NSObjectProtocol] = []
    private let log = HudLogger(category: "blink.model")

    init(store: NoteStore, panelManager: PanelManager) {
        self.store = store
        self.panelManager = panelManager
    }

    /// Register for store notifications and take the initial snapshot.
    /// Call after `PanelManager.restoreSession()` so the store is loaded.
    func start() async {
        let names: [Notification.Name] = [.blinkNoteCreated, .blinkNoteUpdated, .blinkNoteDeleted]
        for name in names {
            observers.append(
                NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) {
                    [weak self] _ in
                    Task { @MainActor in await self?.refresh() }
                }
            )
        }
        await refresh()
    }

    func refresh() async {
        notes = await store.all()
    }

    /// Create a note (optionally seeded with captured text) and open its panel.
    func createNote(content: String = "") async {
        do {
            let note = try await store.create(content: content)
            // New notes always open in edit — you just created it to type.
            panelManager.openPanel(for: note, initialMode: "edit")
        } catch {
            log.error("[BLINK] create failed", metadata: ["error": "\(error)"])
        }
    }

    /// Open (or focus) the panel for an existing note.
    func openNote(id: String) async {
        guard let note = await store.note(id: id) else { return }
        panelManager.openPanel(for: note)
    }

    /// Delete a note: close its panel (discarding pending edits for it) and
    /// remove the file.
    func deleteNote(id: String) async {
        panelManager.handleNoteDeleted(id: id)
        do {
            try await store.delete(id: id)
        } catch {
            log.error("[BLINK] delete failed", metadata: ["id": id, "error": "\(error)"])
        }
    }
}
