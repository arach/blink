# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Blink is an AI-native spatial note-taking application built with Tauri v2, React, and TypeScript. It features a unique multi-window architecture that allows notes to be detached into independent floating windows, creating a spatial knowledge management system.

## Technology Stack

- **Frontend**: React 18 + TypeScript + TailwindCSS + Vite
- **Backend**: Rust (Tauri v2) for native desktop capabilities
- **State Management**: Zustand for React state management
- **UI Components**: Custom glass-morphism design with Radix UI primitives
- **Markdown**: react-markdown with GitHub Flavored Markdown support

## Development Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm run dev          # Start Vite dev server only
pnpm run tauri:dev    # Start full Tauri development mode

# Type checking and linting
pnpm run type-check   # Run TypeScript type checking
pnpm run lint         # Run ESLint

# Building
pnpm run build        # Build frontend for production
pnpm run tauri:build  # Build complete desktop application

# Platform-specific builds
pnpm run tauri:build -- --target universal-apple-darwin  # macOS Universal
```

## Architecture

### Frontend Structure
- `/src/App.tsx` - Main application component with multi-window support
- `/src/components/` - Reusable UI components
  - `CustomTitleBar.tsx` - Custom window chrome with drag controls
  - `DetachedNoteWindow.tsx` - Standalone note window component
  - `NoteEditor.tsx` - Main markdown editor interface
  - `SettingsPanel.tsx` - Application settings UI
- `/src/stores/` - Zustand state management
  - `notes-store.ts` - Note CRUD operations and state
  - `config-store.ts` - User preferences and settings
  - `detached-windows-store.ts` - Multi-window tracking
- `/src/hooks/` - Custom React hooks
  - `use-drag-to-detach.tsx` - Drag-to-detach window functionality
  - `use-window-transparency.tsx` - Dynamic opacity control
  - `use-command-palette.tsx` - Command palette logic (⌘K)

### Backend Structure
- `/src-tauri/src/lib.rs` - Core Rust application logic
- `/src-tauri/tauri.conf.json` - Tauri configuration
- Key features:
  - Thread-safe state management with Mutex-wrapped HashMaps
  - Custom window management with different capability sets
  - Platform-specific integrations (macOS Cocoa bindings)
  - Global shortcut handling (Hyperkey+N)

### Window Architecture
The app uses a sophisticated multi-window system with different permission sets:
- **main** - Primary application window
- **note-*** - Detached note windows with full editing capabilities
- **drag-ghost-*** - Temporary windows for drag preview
- **hybrid-drag-*** - Windows used during drag-to-detach operations

### State Synchronization
- Real-time sync across windows via Tauri's event system
- Events: `note-updated`, `note-created`, `note-deleted`, `config-updated`
- Cross-window state consistency maintained through event listeners

## Key Features to Understand

1. **Drag-to-Detach**: Notes can be dragged from the sidebar to create floating windows
2. **Spatial Positioning**: Window positions are persisted and restored
3. **Command Palette**: Fuzzy search for notes and commands (⌘K)
4. **Live Preview**: Toggle between edit and preview modes (⌘⇧P)
5. **Global Shortcuts**: System-wide hotkeys (requires accessibility permissions on macOS)
6. **Typewriter Mode**: Centered typing experience for focused writing

## Testing Notes

- No automated tests currently exist
- Manual testing focuses on multi-window synchronization
- Debug scripts available: `check-logs.sh`, `debug-shortcuts.sh`
- Console logging uses `[BLINK]` prefix for filtering

## Common Development Tasks

### Adding a New Feature
1. Check existing patterns in similar components
2. Update relevant Zustand store if state management needed
3. Add Tauri command in `lib.rs` if backend integration required
4. Update window capabilities in `tauri.conf.json` if new permissions needed

### Debugging
- Use browser DevTools in development mode
- Check Tauri console output for Rust-side logs
- Use Settings panel's "Test Event" buttons for event system debugging
- Run `./check-logs.sh` for macOS system log monitoring

## Important Conventions

- All user-visible text should reference "Blink" not "Notes App"
- Console logs should use `[BLINK]` prefix
- Follow existing TypeScript patterns - avoid `any` types
- Maintain window transparency and glass-morphism aesthetic
- Preserve spatial metaphors in UI/UX decisions

## Process and Workflow Learnings

- Process killing and server restarts require precision
  - Avoid killing processes by app name to prevent unintended consequences
  - Be more precise when restarting servers (e.g., kill by port number)
  - Be cautious about killing processes in directories with similar names to avoid disrupting active work environments