import AppKit
import BlinkCore
import HudsonObservability

/// Owns every floating note panel: one panel per note (opening an open note
/// focuses it), debounced saves with mandatory flushes on close and quit, and
/// reopening the last session's panels on launch.
@MainActor
final class PanelManager: NSObject, NSWindowDelegate {
    private let store: NoteStore
    private var panels: [String: NotePanel] = [:]
    private var pendingText: [String: String] = [:]
    private var saveTasks: [String: Task<Void, Never>] = [:]
    private var isTerminating = false
    private var blinkHidden = false
    private let log = HudLogger(category: "blink.panels")

    private static let openNotesKey = "blink.openNotes"
    private static let saveDebounce: Duration = .seconds(1)

    init(store: NoteStore) {
        self.store = store
    }

    // MARK: - Lifecycle

    /// Load the store and reopen the panels that were open last session.
    func restoreSession() async {
        do {
            _ = try await store.load()
        } catch {
            log.error("[BLINK] failed to load notes", metadata: ["error": "\(error)"])
            return
        }
        guard ConfigStore.shared.restoreSession else {
            log.info("[BLINK] session restore disabled in settings")
            return
        }
        let openIDs = UserDefaults.standard.stringArray(forKey: Self.openNotesKey) ?? []
        for id in openIDs {
            if let note = await store.note(id: id) {
                openPanel(for: note)
            }
        }
        log.info("[BLINK] session restored", metadata: ["panels": "\(panels.count)"])
    }

    /// A note is being deleted: drop any pending edits for it (so the close
    /// flush doesn't resurrect them against a missing id) and close its panel.
    func handleNoteDeleted(id: String) {
        saveTasks[id]?.cancel()
        saveTasks[id] = nil
        pendingText[id] = nil
        panels[id]?.close()
    }

    /// One panel per note: if it's already open, focus it.
    /// `initialMode` overrides mode resolution (new notes pass "edit").
    func openPanel(for note: Note, initialMode: String? = nil) {
        // Opening a note while blinked-away: the new panel is visible, so the
        // next Hyper+B should hide everything again.
        blinkHidden = false
        if let existing = panels[note.id] {
            existing.makeKeyAndOrderFront(nil)
            return
        }

        let panel = NotePanel(noteID: note.id, initialContent: note.content, title: note.title)
        panel.delegate = self
        panels[note.id] = panel

        panel.editor.onContentChanged = { [weak self] text in
            self?.scheduleSave(noteID: note.id, text: text)
        }
        panel.editor.onSaveRequested = { [weak self] in
            Task { await self?.flush(noteID: note.id) }
        }

        // Mode: explicit (new notes open in edit) > per-note memory > default.
        let mode = initialMode
            ?? UserDefaults.standard.string(forKey: ConfigKeys.noteMode(note.id))
            ?? ConfigStore.shared.defaultMode
        panel.editor.setMode(mode)
        panel.reflectMode(mode)
        panel.editor.onReady = { [weak panel] in
            if mode == "edit" { panel?.editor.focus() }
        }
        let persistMode = { (newMode: String) in
            UserDefaults.standard.set(newMode, forKey: ConfigKeys.noteMode(note.id))
        }
        // Flips from the webview (double-click, ⌘⇧P): update the toggle + persist.
        panel.editor.onModeChanged = { [weak panel] newMode in
            panel?.reflectMode(newMode)
            persistMode(newMode)
        }
        // Flips from the titlebar toggle: persist (panel already reflected it).
        panel.onUserModeChange = persistMode

        panel.makeKeyAndOrderFront(nil)
        if mode == "edit" {
            // Give the webview native key focus so typing and shortcuts work
            // immediately (JS focus alone doesn't set the first responder).
            panel.makeFirstResponder(panel.editor.webView)
        }
        persistOpenList()
    }

    /// The blink: see every note, then none. Hides/shows all open panels
    /// without closing them — the open list and pending saves are untouched.
    func toggleBlink() {
        guard !panels.isEmpty else { return }
        blinkHidden.toggle()
        for panel in panels.values {
            if blinkHidden {
                panel.orderOut(nil)
            } else {
                panel.orderFrontRegardless()
            }
        }
        log.info("[BLINK] blink toggled", metadata: ["hidden": "\(blinkHidden)"])
    }

    /// Quit is imminent: stop treating window closes as the user closing notes.
    /// Without this, termination teardown fires windowWillClose for every panel
    /// and persists an EMPTY open-notes list — killing session restore.
    func prepareForTermination() {
        isTerminating = true
    }

    /// Flush every pending save. Called before quit.
    func flushAll() async {
        for id in Array(pendingText.keys) {
            await flush(noteID: id)
        }
    }

    // MARK: - Save policy: debounce, but NEVER drop (v1's data-loss lesson)

    private func scheduleSave(noteID: String, text: String) {
        pendingText[noteID] = text
        saveTasks[noteID]?.cancel()
        saveTasks[noteID] = Task { [weak self] in
            try? await Task.sleep(for: Self.saveDebounce)
            guard !Task.isCancelled else { return }
            await self?.flush(noteID: noteID)
        }
    }

    private func flush(noteID: String) async {
        saveTasks[noteID]?.cancel()
        saveTasks[noteID] = nil
        guard let text = pendingText.removeValue(forKey: noteID) else { return }
        do {
            let updated = try await store.update(id: noteID, content: text)
            if let panel = panels[noteID], panel.title != updated.title {
                panel.title = updated.title
            }
        } catch {
            // Keep the text pending so a later flush can retry — never drop edits.
            pendingText[noteID] = text
            log.error("[BLINK] save failed", metadata: ["id": noteID, "error": "\(error)"])
        }
    }

    // MARK: - NSWindowDelegate

    func windowWillClose(_ notification: Notification) {
        guard let panel = notification.object as? NotePanel else { return }
        let id = panel.noteID
        panel.editor.teardown()
        panels[id] = nil
        if !isTerminating {
            persistOpenList()
            Task { await flush(noteID: id) }
        }
    }

    private func persistOpenList() {
        UserDefaults.standard.set(Array(panels.keys).sorted(), forKey: Self.openNotesKey)
    }
}
