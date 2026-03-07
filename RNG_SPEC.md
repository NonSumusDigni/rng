# RNG - Project Spec

## Platform
- Static web application (HTML/CSS/JS), no backend
- Hosted via GitHub Pages
- PWA (Progressive Web App) — installable on mobile, works fully offline
  - Service worker caches all app assets for offline use
  - Web app manifest for install prompt and home screen icon
- Client-side storage via `localStorage` for persisting state (upgrade to IndexedDB if needs grow)
- Responsive design — usable on mobile, tablet, and desktop

## Core Concept
A random number generator app built around **sets** of configurable generators.

## Generator
A single random number generator, displayed as a card/box.

- **Range**: inclusive min–max (default: 1–20). Any integer allowed, including negatives. Only constraint: min <= max.
- **Name** (optional): user-defined label
- **Icon** (optional): emoji, displayed to the left of the name
- **Display rules**:
  - The rolled result is the prominent/large text in the card
  - If the generator has a name: show `[icon] name` as the label; range shown only on hover
  - If unnamed: the range (e.g. "1–20") serves as the label
  - Range always displayed in small text along the bottom when no name is set
- **Editing**: tap/click the generator card to edit its range, name, and icon
- **Deleting**: user can remove a generator from the current set
- **Reordering**: user can rearrange generators within a set

## Roll View (Main View)
- On first open: a single default generator (1–20, unnamed, no icon)
- Generators are displayed as a collection of cards
- A dice button at the bottom of the page re-rolls **all** generators in the set simultaneously
- User can add additional generators to the current set
- User can name the entire set and save it

## Saved Sets View
- Separate view to browse and load previously saved sets
- Loading a set replaces the current roll view with that set's generators
- **Save**: overwrites the existing saved set (by name)
- **Save As**: creates a new saved set with a new name
- **Delete**: user can delete saved sets
- Set names must be unique
- Generator names within a set do NOT need to be unique

## Sections
Generators within a set can be organized into sections.

- **Default state**: all generators are in a single implicit section with no visual section UI
- **Reordering**: drag generators to rearrange within a section
- **Creating a section**: while dragging a generator, a drop zone appears at the bottom of the current generators — a partition/skeleton indicating the user can drop the generator there to create a new section
- **Multi-section display**: once more than one section exists, sections become visually distinct
  - Each section is labeled with a number in the top-right corner by default (1, 2, 3...)
  - Tapping the section label opens options to:
    - **Name** the section (replaces the number)
    - **Set a background color** from a preset palette of lightly saturated, easy-on-the-eyes colors (faint green, faint blue, faint yellow, etc. — spreadsheet-cell style)
- Generators can be dragged between existing sections
- A section is automatically removed when all its generators are dragged out of it
- The re-roll button rolls all generators across all sections
- Sections are saved/loaded as part of the set

## Unsaved Changes
- If the current set is a loaded/named saved set and has been modified, warn before navigating away or loading a different set
- No warning for a fresh/unnamed set (the default starting state)

## Style
- Modern, clean, minimal — function over form
- No heavy theming or decorative elements
- Clear typography and spacing; easy to read and tap
- Respects OS/browser dark mode and light mode preference (`prefers-color-scheme`)
