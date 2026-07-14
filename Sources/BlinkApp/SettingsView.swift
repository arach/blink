import AppKit
import HudsonUI
import SwiftUI

/// Blink's whole settings surface: three sections, one screen — built from
/// HudsonKit's settings primitives so it speaks the same design language as
/// Scout and the rest of the ecosystem.
struct SettingsView: View {
    @ObservedObject var config: ConfigStore
    let notesDirectory: URL

    private var tildePath: String {
        notesDirectory.path.replacingOccurrences(of: NSHomeDirectory(), with: "~")
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                HudSettingsSection("General") {
                    HudSettingsRow(
                        icon: "folder",
                        title: "Notes folder",
                        subtitle: tildePath,
                        badge: {
                            Button("Reveal") {
                                NSWorkspace.shared.activateFileViewerSelecting([notesDirectory])
                            }
                            .controlSize(.small)
                        }
                    )
                    HudSettingsControlRow(
                        title: "Restore panels at launch",
                        subtitle: "Reopen last session's notes where you left them",
                        icon: "macwindow.on.rectangle"
                    ) {
                        Toggle("", isOn: $config.restoreSession)
                            .toggleStyle(.switch)
                            .labelsHidden()
                            .controlSize(.small)
                    }
                }

                HudSettingsSection("Editor") {
                    HudSettingsControlRow(
                        title: "Open notes in",
                        subtitle: "New notes always open in edit",
                        icon: "book"
                    ) {
                        Picker("", selection: $config.defaultMode) {
                            Text("Read").tag("read")
                            Text("Edit").tag("edit")
                        }
                        .pickerStyle(.segmented)
                        .labelsHidden()
                        .frame(width: 130)
                    }
                }

                HudSettingsSection("Shortcuts") {
                    HudSettingsRow(icon: "plus.square", title: "New note", badge: { KeyCap("⌃⌥⇧⌘N") })
                    HudSettingsRow(
                        icon: "command",
                        title: "Command palette",
                        subtitle: "soon",
                        badge: { KeyCap("⌘K") }
                    )
                    HudSettingsRow(icon: "book.closed", title: "Flip read / edit", badge: { KeyCap("⌘⇧P") })
                }
            }
            .padding(HudSpacing.xl)
        }
        .frame(width: 440, height: 470)
    }
}

/// Small keycap chip for shortcut rows.
private struct KeyCap: View {
    let keys: String
    init(_ keys: String) { self.keys = keys }

    var body: some View {
        Text(keys)
            .font(.system(size: 11, design: .monospaced))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 4))
    }
}
