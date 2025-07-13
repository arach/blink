# Claude Inbox 📥

This file contains ideas, feedback, and bugs that don't need immediate attention.
Claude will periodically review these when prompted with `/inbox`.

## Format Guide

Each entry should follow this format:
```
## [TYPE] Brief Title
Date: YYYY-MM-DD
Priority: low|medium|high
Status: new|acknowledged|in-progress|done

Description of the idea/bug/feedback

### Notes (optional)
Any additional context or thoughts
```

---

## 🐛 Bug: Example Bug Entry
Date: 2024-01-12
Priority: low
Status: new

This is an example of how to format a bug report.

---

## 💡 Idea: Example Feature Idea
Date: 2024-01-12
Priority: medium
Status: new

This shows how to format a feature idea.

---

## 📝 Feedback: Example Feedback
Date: 2024-01-12
Priority: low
Status: new

This demonstrates feedback formatting.

---

<!-- Add new entries below this line -->

## 🐛 Bug: Font size config (editor) doesn't appear to be saved appropriately
Date: 2025-01-12
Priority: high
Status: new

Editor font size changes in settings don't persist after closing/reopening the app. Need to investigate if this is a config save issue or a UI state synchronization problem.

---

## 🐛 Bug: Copy doesn't work in vim normal mode
Date: 2025-01-12
Priority: medium
Status: new

Cmd+C (system copy) doesn't work in vim normal mode. The vim yank commands work fine, but the standard OS copy shortcut is not functioning. This is likely because the text selection isn't active in normal mode.

---

## 💡 Idea: Alt click on notes folder icon to launch Finder
Date: 2025-01-12
Priority: low
Status: done

Add functionality to alt-click (Option-click on macOS) the notes folder icon to open the notes directory in Finder. This would provide quick access to the file system for power users.

### Implementation (2025-01-13)
- Made the notes icon clickable with a button wrapper
- Added Alt/Option key detection in onClick handler
- Calls `get_current_notes_directory` and `open_directory_in_finder` backend commands
- Added hover effect and helpful tooltip

---

## 🐛 Bug: Notes nav is wobbly - notes jump to top when edited
Date: 2025-01-12
Priority: high
Status: new

Notes are sorted by updated_at timestamp in the backend (commands.rs:16), causing them to jump to the top of the list whenever they're edited. This creates a "wobbly" experience where the list constantly reorders while typing.

### Potential Solutions:
1. Sort by created_at instead of updated_at
2. Add a "pinned" position or manual ordering
3. Only update the sort order on save, not on every keystroke
4. Add a user preference for sort order (newest/oldest/alphabetical/manual)

---