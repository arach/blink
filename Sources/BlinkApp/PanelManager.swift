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
    /// What each open panel currently displays — the tell between "our own
    /// save came back around" and a genuine external edit to push in.
    private var panelContent: [String: String] = [:]
    private var observers: [NSObjectProtocol] = []
    private var saveTasks: [String: Task<Void, Never>] = [:]
    private var isTerminating = false
    private var blinkHidden = false
    private lazy var focusOverlay = FocusOverlay()
    private var gridOverlay: GridOverlay?
    private var mostRecentKeyPanelID: String?
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
        guard BlinkConfigStore.shared.config.behavior.restoreSession else {
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

    /// React to store notifications so *external* writers (the blink CLI, an
    /// agent editing files) reach open panels live. In-app mutations flow
    /// through here too but no-op: our own save leaves panelContent equal to
    /// the store, and in-app deletes already closed the panel.
    func startObservingStore() {
        observers.append(
            NotificationCenter.default.addObserver(
                forName: .blinkNoteUpdated, object: nil, queue: .main
            ) { [weak self] notification in
                guard let id = notification.userInfo?["id"] as? String else { return }
                Task { @MainActor in await self?.applyExternalUpdate(id: id) }
            }
        )
        observers.append(
            NotificationCenter.default.addObserver(
                forName: .blinkNoteDeleted, object: nil, queue: .main
            ) { [weak self] notification in
                guard let id = notification.userInfo?["id"] as? String else { return }
                Task { @MainActor in self?.handleNoteDeleted(id: id) }
            }
        )
    }

    /// Push an externally changed note into its open panel — unless the user
    /// has unsaved edits in flight, in which case the user wins (their next
    /// flush merges metadata from disk either way).
    private func applyExternalUpdate(id: String) async {
        guard let panel = panels[id], pendingText[id] == nil else { return }
        guard let note = await store.note(id: id), note.content != panelContent[id] else { return }
        panelContent[id] = note.content
        panel.editor.setContent(note.content)  // programmatic — never echoes
        if panel.title != note.title { panel.title = note.title }
        log.info("[BLINK] external edit applied to open panel", metadata: ["id": id])
    }

    /// One panel per note: if it's already open, focus it.
    /// `initialMode` overrides mode resolution (new notes pass "edit").
    func openPanel(for note: Note, initialMode: String? = nil) {
        // Opening a note while blinked-away: the new panel is visible, so the
        // next Hyper+B should hide everything again.
        blinkHidden = false
        if let existing = panels[note.id] {
            mostRecentKeyPanelID = note.id
            existing.makeKeyAndOrderFront(nil)
            return
        }

        // Sheet: per-note frontmatter override > config default.
        let sheetOverride = note.extraFrontmatterValue(for: "sheet")
        let panel = NotePanel(
            noteID: note.id,
            initialContent: note.content,
            title: note.title,
            sheet: sheetOverride ?? BlinkConfigStore.shared.config.panel.sheet,
            sheetIsPerNote: sheetOverride != nil
        )
        panel.delegate = self
        panels[note.id] = panel
        panelContent[note.id] = note.content

        panel.editor.onContentChanged = { [weak self] text in
            self?.panelContent[note.id] = text
            self?.scheduleSave(noteID: note.id, text: text)
        }
        panel.editor.onSaveRequested = { [weak self] in
            Task { await self?.flush(noteID: note.id) }
        }

        // Mode: explicit (new notes open in edit) > per-note memory > default.
        let mode = initialMode
            ?? UserDefaults.standard.string(forKey: ConfigKeys.noteMode(note.id))
            ?? BlinkConfigStore.shared.config.behavior.defaultMode
        panel.editor.setMode(mode)
        panel.editor.setTheme(BlinkConfigStore.shared.config.editorThemeVars)
        panel.reflectMode(mode)
        panel.editor.onReady = { [weak panel] in
            if mode == "edit" { panel?.editor.focus() }
        }
        let persistMode = { (newMode: String) in
            UserDefaults.standard.set(newMode, forKey: ConfigKeys.noteMode(note.id))
        }
        // Flips from the webview (double-click): update the toggle + persist.
        panel.editor.onModeChanged = { [weak self, weak panel] newMode in
            panel?.reflectMode(newMode)
            persistMode(newMode)
            self?.updateFocusOverlay()
        }
        // Flips from native chrome (toggle click, ⌘⇧P): persist.
        panel.onUserModeChange = { [weak self] newMode in
            persistMode(newMode)
            self?.updateFocusOverlay()
        }
        panel.onFocusModeChange = { [weak self] in
            self?.updateFocusOverlay()
        }

        panel.makeKeyAndOrderFront(nil)
        mostRecentKeyPanelID = note.id
        if mode == "edit" {
            // Give the webview native key focus so typing and shortcuts work
            // immediately (JS focus alone doesn't set the first responder).
            panel.makeFirstResponder(panel.editor.webView)
        }
        persistOpenList()
        updateFocusOverlay()
        gridOverlay?.refresh()
    }

    /// Focus overlay is active exactly when the key window is a panel with
    /// focus mode on (edit or read) and the blink hasn't hidden everything.
    private func updateFocusOverlay() {
        if gridOverlay?.isVisible != true,
           !blinkHidden,
           let keyPanel = panels.values.first(where: { $0.isKeyWindow }),
           keyPanel.focusEnabled {
            focusOverlay.show(behind: keyPanel)
        } else {
            focusOverlay.hide()
        }
    }

    func windowDidBecomeKey(_ notification: Notification) {
        if let panel = notification.object as? NotePanel {
            mostRecentKeyPanelID = panel.noteID
        }
        updateFocusOverlay()
    }

    func windowDidResignKey(_ notification: Notification) {
        updateFocusOverlay()
    }

    // MARK: - Read surface for overlays (grid, constellation)

    /// Snapshot of open panels by note id.
    var openPanelsByID: [String: NotePanel] { panels }

    /// The panel that currently has key focus, if any.
    var keyNotePanel: NotePanel? { panels.values.first { $0.isKeyWindow } }

    /// Turn the desk into one drawn page. The overlay owns its scoped key
    /// registrations; this manager supplies the live panel set and remembers
    /// which panel should move after Blink (or another app) takes key focus.
    func toggleGridOverlay() {
        if gridOverlay == nil {
            gridOverlay = GridOverlay(
                store: store,
                panels: { [weak self] in self?.openPanelsByID ?? [:] },
                placementPanel: { [weak self] in self?.placementPanel },
                onHide: { [weak self] in self?.updateFocusOverlay() }
            )
        }
        if gridOverlay?.isVisible == false {
            focusOverlay.hide()
        }
        gridOverlay?.toggle()
        log.info(
            "[BLINK] grid overlay toggled",
            metadata: ["visible": "\(gridOverlay?.isVisible == true)"]
        )
    }

    private var placementPanel: NotePanel? {
        keyNotePanel
            ?? mostRecentKeyPanelID.flatMap { panels[$0] }
            ?? NSApp.orderedWindows.compactMap { $0 as? NotePanel }.first { panel in
                panels[panel.noteID] === panel
            }
    }

    /// Hot-apply a config change to every live surface.
    func applyTheme(_ config: BlinkConfig) {
        for panel in panels.values {
            panel.applyTheme(config)
        }
        focusOverlay.applyTheme(dim: config.focus.dim)
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
        updateFocusOverlay()
    }

    /// Quit is imminent: stop treating window closes as the user closing notes.
    /// Without this, termination teardown fires windowWillClose for every panel
    /// and persists an EMPTY open-notes list — killing session restore.
    func prepareForTermination() {
        isTerminating = true
        gridOverlay?.hide()
        focusOverlay.hide()
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
        panelContent[id] = nil
        if mostRecentKeyPanelID == id {
            mostRecentKeyPanelID = nil
        }
        gridOverlay?.refresh()
        if !isTerminating {
            persistOpenList()
            Task { await flush(noteID: id) }
            updateFocusOverlay()
        }
    }

    private func persistOpenList() {
        UserDefaults.standard.set(Array(panels.keys).sorted(), forKey: Self.openNotesKey)
    }
}
