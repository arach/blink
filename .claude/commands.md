# Claude Custom Commands 🤖

## Quick Reference

- `/i [message]` - Add item to inbox quickly
- `/inbox` - Review and manage inbox items
- `/commit [message]` - Git commit with gitmoji and push

## Command Details

### `/i` - Quick Inbox Add
Quickly add an item to the inbox without opening the file.

**Usage:**
- `/i bug: cursor disappears in vim mode`
- `/i idea: add keyboard shortcut cheatsheet`
- `/i refactor: extract App.tsx logic`

**Type prefixes:**
- `bug:` → 🐛 Bug (default priority: medium)
- `idea:` → 💡 Idea (default priority: low)
- `feedback:` → 📝 Feedback (default priority: low)
- `refactor:` → 🔧 Refactor (default priority: medium)
- `research:` → 📚 Research (default priority: low)

If no prefix is provided, it defaults to "idea".

### `/inbox` - Inbox Review
Review all pending items and manage the backlog.

**Usage:**
- `/inbox` - See summary of all items
- `/inbox review` - Detailed review with suggestions
- `/inbox clean` - Archive completed items

### `/commit` - Smart Git Commit
Create gitmoji commits and push to remote.

**Usage:**
- `/commit` - Interactive commit
- `/commit fix: button alignment` - Quick commit with message