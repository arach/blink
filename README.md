# Blink: AI-Native Spatial Notes

From static documents to intelligent, spatially aware notes.

---

## Vision

Blink reimagines note-taking as AI-native knowledge management. Notes aren’t static text but autonomous agents that can think, update, and contribute on their own.

### Core Principles
- **Spatial context**: where a note lives matters  
- **Asynchronous work**: AI processes notes even when you’re not active  
- **Conversational notes**: interact with each note as an ongoing dialogue  
- **Emergent organization**: structure comes from AI understanding, not manual sorting  
- **Multimodal inputs**: notes handle text, images, voice, and more  

---

## Current Features

### Multi-Window Spatial Notes
- Detach notes into frameless, floating windows  
- Spatial arrangement saved and restored  
- Real-time sync between main app and detached windows  
- Global shortcuts, focus mode, command palette  

### Customization
- Markdown-first editor with preview  
- Font, spacing, and theme controls  
- Window transparency, always-on-top, typewriter mode  
- Syntax highlighting for code  

### Core Management
- Instant search with fuzzy matching  
- Auto-save with backups  
- Smart title extraction  
- Cross-platform support  

---

## Tech Stack
- **Frontend**: React, TypeScript, TailwindCSS, Zustand  
- **Backend**: Rust (Tauri v2)  
- **Storage**: JSON file-based, migratable to databases  
- **Build**: Vite for dev and cross-platform desktop builds  

---

## Roadmap

### Phase 1 (Done)
- Multi-window spatial foundation  
- Command palette, focus mode, customization  

### Phase 2 (Next)
- AI service integration (Claude, OpenAI)  
- Per-note AI context and multimodal inputs  
- Background processing  

### Phase 3
- Conversational notes with history  
- Cross-note awareness  
- Spatial context in reasoning  

### Phase 4
- Self-updating notes  
- AI-generated insights and briefings  
- Pattern recognition across notes  

### Phase 5
- Note-to-note AI conversations  
- Ecosystem-level intelligence  
- Collaborative knowledge evolution  

---

## Architecture

- **Spatial-first**: window positions as metadata, clustering for related notes  
- **AI-native**: each note has its own AI context and memory  
- **Local-first**: encrypted storage, optional sync  
- **Rust backend** for performance and security  

---

## Contributing

Areas for contribution:
- AI integration  
- Spatial clustering and intelligence  
- Multimodal processing (voice, images, docs)  
- Rust optimizations  

Principles:
- AI-native design  
- Spatial awareness  
- User empowerment  
- Simple interactions → emergent behaviors  

---

## License

MIT

---

Blink is building toward a world where your notes don’t just store your thoughts—they actively think with you, make connections, and evolve your understanding.
