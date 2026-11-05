# Changelog

## 0.5.0 — A Living Research Workspace

Vision OS 0.5 turns the 0.4 toolset into one calm, reactive and continuous research workspace: the environment responds to what you do, the tools stay connected, and every time you come back your work continues where it stopped.

### Home and identity
- Home is built around the work in progress instead of a big clock: a **current session** card shows the paper or video you were on (page, saved notes, board cards) with *Resume*, *With board* and *Focus*, and switches to a running focus session or an item that is about to start when those matter more.
- One visual language across the shell: shared surface, accent and motion tokens; the reader chrome now matches the rest of the interface. The default theme matches the default night greenhouse scene.
- A focus session ends with a short **summary** (minutes, pages, highlights, board cards) and a button straight back to the page.

### Persistent workspace
- Reader, knowledge board and video stay open in the background, so switching never loses a scroll position or a playing video.
- Put a second tool **beside** the current one behind a draggable splitter (mouse, arrow keys or a pinch); a started video keeps playing in a small **floating player** while you work elsewhere.
- **Title-bar tabs** for the open tools, with live previews on hover.
- **Research spaces** save and restore the layout, the paper and video positions, the scene and the sound mix (title bar or `Ctrl+K`).
- Local PDFs are kept on this computer so they reopen after a restart.
- Only the pane you last touched takes keyboard shortcuts, the hand menu and voice commands.

### Knowledge board
- Drag, or pinch-carry with the hand, highlights, text selections, AI answers, video bookmarks and images straight onto the board; every card keeps its source page or second.
- Frames that group and carry cards, coloured notes, labelled connections (supports, contradicts…).
- **Paper map**: clips gathered around their papers, related papers linked to each other.

### Discovery
- Related papers are found on this computer from titles, highlights and board clips, always with the shared terms as evidence; an optional local Ollama embedding model deepens the match.
- Threads of light join related papers in the garden; new papers in the library come with a suggestion of how they connect to earlier work.

### A garden that lives with your work
- The scene follows the time of day and the real weather, quiets down during focus and blooms when a session is completed.
- It calms under work screens and pauses completely when the window is hidden or the battery is low.
- The paper you are reading is ringed and labelled with its page; finished papers open into small blooms.
- **Research journey**: the garden grows through five stages from meaningful progress only (finished, annotated and mapped papers, named connections, focused hours), never from clicks or elapsed time. Each project remembers its progress and can carry its own mood. Fireflies multiply as the garden matures.

### Companion and dock
- The bird blinks, wanders, pecks, sleeps when nobody is at the computer, rests during focus, stretches when a break is due, greets you after a long absence and is happy when petted. It remembers, never speaks, and can be turned off.
- The dock is more compact, magnifies under the mouse or hand cursor, bounces when a tool opens and marks tools that hold live state. Reader has a dock slot; Stats moved to the Planner tabs.
- One app registry builds the dock, the command bar and the hand menu.

### Learning hand control
- A seven-step **gesture practice** on a small research task opens the first time hand control turns on (and from the calibration screen), and explains mistakes.
- The hand cursor shows a ring while a pinch is held (release before it closes to click, keep holding to drag) and a confirmation for every recognised command.
- A first-session checklist on Home ticks itself off as you open a paper, put a quote on the board, focus and save a space.

### Evaluation
- **Usability study** recorder in Settings: times, warnings, navigation and back-and-forth per task, exportable as CSV; protocol in `docs/usability-test.md`.

### Notes
- New dependency: [Motion](https://motion.dev) (MIT) for interface springs.
- Ideas were adapted from daedalOS, MewoOS, AFFiNE, tldraw, Lively Wallpaper, Reor, Motion Primitives, React Bits and Puter; see *Design inspirations* in the README.
- Tested with the automated suite (121 tests) and in a browser with replayed gestures; please report anything that behaves differently with a real camera on Windows.

## 0.4.0

First public release: gesture-controlled research workspace for Windows with a PDF reader, knowledge board, focus studio, YouTube player with timed notes, voice and typed commands, face lock, local AI assistant and the greenhouse garden.
