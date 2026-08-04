import AppKit
import BlinkCore
import HudsonObservability

private enum SourceResolutionOutcome: Sendable {
    case document(SourceDocument)
    case failure(SourceReference, SourceFileError)
}

/// Owns source windows as a domain parallel to note windows. Source panels have
/// one canonical-path identity, local frame autosave, and no save pipeline.
@MainActor
final class SourcePanelManager: NSObject, NSWindowDelegate {
    private var panels: [String: SourcePanel] = [:]
    private var standalonePanelIDs: Set<String> = []
    private var companionPanelIDs: [String: Set<String>] = [:]
    private var activeCompanionNoteID: String?
    private var activationToken = UUID()
    private let log = HudLogger(category: "blink.sources")

    var hasOpenPanels: Bool { !panels.isEmpty }

    func chooseAndOpenFile() {
        let picker = NSOpenPanel()
        picker.title = "Open Source File"
        picker.message = "Choose a source, data, configuration, patch, or text file to inspect."
        picker.prompt = "Open"
        picker.canChooseFiles = true
        picker.canChooseDirectories = false
        picker.allowsMultipleSelection = false
        picker.resolvesAliases = true
        guard picker.runModal() == .OK, let url = picker.url else { return }
        openPickedFile(url)
    }

    func openPickedFile(_ url: URL) {
        let resolver = makeResolver()
        Task { [weak self] in
            let outcome = await Task.detached(priority: .userInitiated) {
                do { return Result<SourceDocument, SourceFileError>.success(try resolver.resolvePickedFile(url)) }
                catch let error as SourceFileError { return .failure(error) }
                catch { return .failure(.missingFile(url.path)) }
            }.value
            guard let self else { return }
            switch outcome {
            case .success(let document):
                self.show(document, frame: nil, activate: true, standalone: true)
            case .failure(let error): self.present(error)
            }
        }
    }

    func companionsVisible(for noteID: String) -> Bool {
        !UserDefaults.standard.bool(forKey: ConfigKeys.noteCompanionsHidden(noteID))
    }

    func toggleCompanions(for note: Note, relativeTo noteFrame: NSRect) {
        let visible = companionsVisible(for: note.id)
        UserDefaults.standard.set(visible, forKey: ConfigKeys.noteCompanionsHidden(note.id))
        if visible {
            dismissCompanions(for: note.id)
        } else {
            activateCompanions(for: note, relativeTo: noteFrame, force: true)
        }
    }

    func activateCompanions(for note: Note, relativeTo noteFrame: NSRect, force: Bool = false) {
        if let prior = activeCompanionNoteID, prior != note.id {
            dismissCompanions(for: prior)
        }
        guard let companions = note.presentation.companions,
              !companions.sources.isEmpty,
              (force || BlinkConfigStore.shared.config.sources.autoOpenCompanions),
              companionsVisible(for: note.id)
        else {
            dismissCompanions(for: note.id)
            return
        }

        activeCompanionNoteID = note.id
        activationToken = UUID()
        let token = activationToken
        let resolver = makeResolver()
        let references = Array(companions.sources.prefix(NoteCompanions.maximumSources))

        Task { [weak self] in
            let outcomes = await Task.detached(priority: .userInitiated) {
                references.map { reference -> SourceResolutionOutcome in
                    do { return .document(try resolver.resolve(reference)) }
                    catch let error as SourceFileError { return .failure(reference, error) }
                    catch { return .failure(reference, .missingFile(reference.path)) }
                }
            }.value
            guard let self, self.activationToken == token else { return }

            if let missingRoot = outcomes.compactMap({ outcome -> String? in
                guard case .failure(_, .unknownRoot(let root)) = outcome else { return nil }
                return root
            }).first {
                self.dismissCompanions(for: note.id)
                if self.locateRoot(named: missingRoot) {
                    self.activateCompanions(for: note, relativeTo: noteFrame, force: true)
                }
                return
            }

            let documents = outcomes.compactMap { outcome -> SourceDocument? in
                guard case .document(let document) = outcome else { return nil }
                return document
            }
            let nextIDs = Set(documents.map { $0.url.path })
            let staleIDs = (self.companionPanelIDs[note.id] ?? []).subtracting(nextIDs)
            self.releaseCompanionPanels(staleIDs, from: note.id)
            let frames = self.frames(
                count: documents.count,
                layout: companions.layout,
                relativeTo: noteFrame
            )
            var ids: Set<String> = []
            for (index, document) in documents.enumerated() {
                let id = document.url.path
                ids.insert(id)
                self.show(
                    document,
                    frame: frames.indices.contains(index) ? frames[index] : nil,
                    activate: false,
                    standalone: false
                )
            }
            self.companionPanelIDs[note.id] = ids

            if let failure = outcomes.compactMap({ outcome -> SourceFileError? in
                guard case .failure(_, let error) = outcome else { return nil }
                return error
            }).first {
                self.present(failure)
            }
        }
    }

    func dismissCompanions(for noteID: String) {
        if activeCompanionNoteID == noteID {
            activationToken = UUID()
            activeCompanionNoteID = nil
        }
        let ids = companionPanelIDs.removeValue(forKey: noteID) ?? []
        releaseCompanionPanels(ids, from: noteID)
    }

    func applyTheme(_ config: BlinkConfig) {
        for panel in panels.values { panel.applyTheme(config) }
    }

    func closeAll() {
        activationToken = UUID()
        for panel in Array(panels.values) { panel.close() }
        panels.removeAll()
        standalonePanelIDs.removeAll()
        companionPanelIDs.removeAll()
        activeCompanionNoteID = nil
    }

    func windowWillClose(_ notification: Notification) {
        guard let panel = notification.object as? SourcePanel else { return }
        panel.viewer.teardown()
        panels[panel.sourceIdentity] = nil
        standalonePanelIDs.remove(panel.sourceIdentity)
        for noteID in Array(companionPanelIDs.keys) {
            companionPanelIDs[noteID]?.remove(panel.sourceIdentity)
            if companionPanelIDs[noteID]?.isEmpty == true { companionPanelIDs[noteID] = nil }
        }
    }

    private func show(
        _ document: SourceDocument,
        frame: NSRect?,
        activate: Bool,
        standalone: Bool
    ) {
        let id = document.url.path
        if standalone { standalonePanelIDs.insert(id) }
        let panel: SourcePanel
        if let existing = panels[id] {
            panel = existing
            panel.update(document)
        } else {
            panel = SourcePanel(document: document)
            panel.delegate = self
            panels[id] = panel
            if !panel.restoredLocalFrame, let frame {
                panel.setFrame(frame, display: false)
                panel.saveFrame(usingName: panel.frameAutosaveName)
            }
        }
        panel.applyTheme(BlinkConfigStore.shared.config)
        if activate {
            NSApp.activate(ignoringOtherApps: true)
            panel.makeKeyAndOrderFront(nil)
            panel.makeFirstResponder(panel.viewer.webView)
            panel.viewer.focus()
        } else {
            panel.orderFront(nil)
        }
    }

    private func releaseCompanionPanels(_ ids: Set<String>, from noteID: String) {
        for id in ids {
            let ownedByAnotherNote = companionPanelIDs.contains { owner, panelIDs in
                owner != noteID && panelIDs.contains(id)
            }
            if !standalonePanelIDs.contains(id), !ownedByAnotherNote {
                panels[id]?.close()
            }
        }
    }

    private func makeResolver() -> SourceFileResolver {
        let config = BlinkConfigStore.shared.config.sources
        let roots = config.roots.compactMapValues { raw -> URL? in
            let expanded = (raw as NSString).expandingTildeInPath
            guard expanded.hasPrefix("/") else { return nil }
            return URL(fileURLWithPath: expanded, isDirectory: true)
        }
        return SourceFileResolver(roots: roots, maxByteSize: config.maxPreviewBytes)
    }

    private func locateRoot(named name: String) -> Bool {
        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = "Locate “\(name)”"
        alert.informativeText = "This note references files under the “\(name)” source root. Choose its folder on this Mac. Blink will only read files contained by that folder."
        alert.addButton(withTitle: "Choose Folder")
        alert.addButton(withTitle: "Not Now")
        guard alert.runModal() == .alertFirstButtonReturn else { return false }

        let picker = NSOpenPanel()
        picker.title = "Locate \(name)"
        picker.prompt = "Use This Folder"
        picker.canChooseFiles = false
        picker.canChooseDirectories = true
        picker.allowsMultipleSelection = false
        guard picker.runModal() == .OK, let url = picker.url else { return false }
        BlinkConfigStore.shared.update { config in
            config.sources.roots[name] = url.standardizedFileURL.path
        }
        return true
    }

    private func present(_ error: SourceFileError) {
        log.error("[BLINK] source preview failed", metadata: ["error": error.localizedDescription])
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Source unavailable"
        alert.informativeText = error.localizedDescription
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    private func frames(count: Int, layout: String?, relativeTo noteFrame: NSRect) -> [NSRect] {
        guard count > 0 else { return [] }
        let screen = NSScreen.screens.first(where: { $0.frame.intersects(noteFrame) })
            ?? NSScreen.main
            ?? NSScreen.screens[0]
        let visible = screen.visibleFrame

        if layout?.lowercased() == "review-bench" {
            let columns = count == 1 ? 1 : 2
            let rows = Int(ceil(Double(count) / Double(columns)))
            return (0..<count).map { index in
                BlinkGrid.frame(
                    for: GridPlacement(
                        columns: columns,
                        rows: rows,
                        col: index % columns,
                        row: index / columns
                    ),
                    in: visible
                )
            }
        }

        let size = NSSize(width: min(640, visible.width * 0.56), height: min(460, visible.height * 0.56))
        return (0..<count).map { index in
            let offset = CGFloat(index) * 28
            return NSRect(
                x: min(max(visible.minX + 36 + offset, visible.minX), visible.maxX - size.width),
                y: min(max(visible.maxY - size.height - 44 - offset, visible.minY), visible.maxY - size.height),
                width: size.width,
                height: size.height
            )
        }
    }
}
