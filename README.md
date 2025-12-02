# D&D Beyond Desktop

A desktop application version of D&D Beyond built with Tauri and React. This app provides a comprehensive character management system, dice roller, compendium browser, and campaign journal for Dungeons & Dragons players.

## Features

### Core Character Management
- **Advanced Character Creation Wizard**: Multi-tab character creation with:
  - Basic info (name, alignment)
  - Class selection with class-specific features (Bard fully implemented)
  - Background selection (Criminal fully implemented)
  - Species/Race selection (Human, Half-Elf, Tiefling, Half-Orc, Halfling, Gnome; other races to be added)
  - Three ability score selection methods: Standard Array, Point Buy, or Roll Stats (4d6 drop lowest)
- **Class-Specific Features**:
  - **Bard**: Skill selection (any 3), musical instrument proficiency (3 instruments), starting equipment choices, spell selection with expandable spell details
  - Automatic proficiency assignment (saving throws, skills, armor, weapons, tools)
  - Hit dice and HP calculation based on class
  - Level-up system with HP choice (roll or take average)
- **Character Sheet**: Complete character sheet with:
  - Editable stats, equipment, spells, and notes (spells not fully editable at present)
  - Death saves tracking (3 successes/failures)
  - Temporary HP display
  - Heroic Inspiration toggle
  - Proficiency display with visual indicators
  - Currency tracking (platinum, gold, silver, copper)
  - Spell slot tracking
- **Autosave**: Automatic saving of character data on any edit
- **Local Storage**: All characters are stored locally as JSON files

### Dice Roller
- **Dice Notation**: Support for standard D&D dice notation (e.g., `2d6+3`, `1d20`)
- **Quick Roll Buttons**: One-click rolling for common dice (d4, d6, d8, d10, d12, d20)
- **Advantage/Disadvantage**: Toggle to roll with advantage/disadvantage (roll 2 take highest/lowest)
- **Roll Animation**: Visual dice rolling animation
- **Roll History**: Log of all previous rolls with timestamps and breakdown

### Compendium Browser
- **SRD Content**: Browse Spells & Monsters from the D&D 5e API (item and feat rendering not functional at present)
- **Advanced Spell Filtering**: Filter spells by:
  - Class (Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard)
  - Level (Cantrip through 9th level)
  - School of Magic (Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation)
- **Search & Filters**: Search functionality across all content
- **Spell Indicators**: Visual badges for Concentration and Ritual spells
- **Favorites**: Bookmark your favorite spells & monsters
- **Detail Viewer**: Comprehensive detail panels showing:
  - Spell level, school, casting time, range, components, duration
  - Concentration and Ritual requirements
  - Full spell descriptions

### Notes
- **Markdown Support**: Write notes using a Markdown editor with live preview
- **Link to Characters**: Associate notes with specific characters
- **Filter**: Filter notes by associated character, or pin important notes to the top
- **Auto-save**: Automatic saving of all notes
- **Search**: Quick search across all campaign notes

### UI/UX Features
- **Dark/Light Mode**: Toggle between themes
- **Custom Accent Colors**: Choose from multiple accent colors
- **Responsive Layout**: Optimized for multiple screen sizes (in progress to further generalize)

## Project Structure

```
/dndbeyond/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx                # Main app component with routing
│   ├── index.css              # Global styles and Tailwind imports
│   ├── components/
│   │   ├── Layout/
│   │   │   └── Sidebar.tsx    # Navigation sidebar component
│   │   └── Settings.tsx        # Settings modal component
│   ├── pages/
│   │   ├── CharactersPage.tsx # Character list and creation
│   │   ├── CharacterSheet.tsx # Individual character sheet
│   │   ├── CompendiumPage.tsx # SRD content browser
│   │   ├── NotesPage.tsx      # Campaign journal
│   │   └── DiceRoller.tsx     # Dice rolling interface
│   ├── contexts/
│   │   └── ThemeContext.tsx   # Theme and color management
│   └── types/
│       └── character.ts       # TypeScript type definitions
├── src-tauri/
│   ├── src/
│   │   └── main.rs            # Tauri backend (Rust)
│   ├── Cargo.toml             # Rust dependencies
│   ├── tauri.conf.json        # Tauri configuration
│   └── build.rs               # Build script
├── package.json               # Node dependencies
├── vite.config.ts             # Vite configuration
├── tailwind.config.js         # Tailwind CSS configuration
└── tsconfig.json              # TypeScript configuration
```

## File Descriptions

### Frontend Files

#### `src/main.tsx`
Main entry point for the React application. Initializes the React root and renders the App component.

#### `src/App.tsx`
Main application component that sets up routing and layout. Uses React Router for navigation between pages. Includes theme management and settings integration.

**Key Functions:**
- `AppContent`: Manages routing and sidebar navigation
- Provides theme context to all child components

#### `src/components/Layout/Sidebar.tsx`
Navigation sidebar component providing links to all major sections of the app.

**Key Functions:**
- `Sidebar`: Renders navigation menu with active state highlighting
- Shows user their current location in the app

#### `src/components/Settings.tsx`
Settings modal for changing application preferences.

**Key Functions:**
- Theme switching between light and dark modes
- Accent color customization
- Persistent storage of user preferences

#### `src/pages/CharactersPage.tsx`
Character management page displaying list of all characters.

**Key Functions:**
- `CharactersPage`: Main component displaying character list
- `loadCharacters`: Loads all characters from backend
- `handleDelete`: Deletes a character after confirmation
- `CharacterCreationForm`: Advanced multi-tab wizard for creating new characters with:
  - **Basic Tab**: Name and alignment selection
  - **Class Tab**: Class selection with class-specific features:
    - Bard: Skill selection (any 3), musical instrument proficiency (3), equipment choices, spell selection with two sub-tabs (Equipment & Skills / Spells)
    - Automatic proficiency assignment for saving throws and armor/weapon proficiencies
  - **Background Tab**: Background selection
  - **Species Tab**: Race/species selection with subrace options (e.g., Half-Elf ability score choices, Halfling subraces, Gnome subraces)
  - **Abilities Tab**: Three methods for ability score generation:
    - Standard Array: Assign 15, 14, 13, 12, 10, 8 to abilities
    - Point Buy: 27 points to distribute (scores 8-15)
    - Roll Stats: Roll 4d6 drop lowest, assign to abilities
  - **Review Tab**: Final review before character creation
  - Initial HP calculation based on class hit dice and CON modifier
  - Comprehensive validation for each tab

#### `src/pages/CharacterSheet.tsx`
Individual character sheet with full stat display and editing.

**Key Functions:**
- `CharacterSheet`: Main component for character details
- `loadCharacter`: Loads specific character by ID
- `saveCharacter`: Saves character to backend
- `handleUpdate`: Updates character stats with autosave
- `handleAddItem`: Adds equipment or spells to inventory
- `handleRemoveItem`: Removes items from inventory
- `handleLevelUp`: Level up modal with class-specific HP choices:
  - Bard: Choose to take average (5 + CON) or roll 1d8 + CON
  - Automatic spell slot progression
  - Max HP tracking
- `EditableStat`: Reusable component for inline editing of numeric values
- **Death Saves**: Track successes and failures (3 each) with visual indicators
- **Temporary HP**: Display and track temporary hit points
- **Heroic Inspiration**: Toggle heroic inspiration status
- **Proficiency Display**: Visual proficiency levels (none, half, proficient, expertise)
- **Currency Management**: Track platinum, gold, silver, and copper coins

#### `src/pages/DiceRoller.tsx`
Dice rolling interface with animation and history.

**Key Functions:**
- `parseDiceExpression`: Parses dice notation strings (e.g., "2d6+3")
- `rollDice`: Rolls dice and returns individual rolls and total
- `handleRoll`: Executes dice roll with animation
- Supports standard D&D dice notation with modifiers

#### `src/pages/CompendiumPage.tsx`
SRD content browser with search and favorites.

**Key Functions:**
- `loadData`: Loads compendium data from D&D 5e API for selected category
- `toggleFavorite`: Adds/removes items from favorites list
- `filteredItems`: Advanced filtering for spells based on:
  - Search term
  - Spell class (Bard, Cleric, Druid, etc.)
  - Spell level (Cantrip through 9th)
  - School of magic (Abjuration, Conjuration, etc.)
- **Spell Details**: Displays concentration and ritual badges for applicable spells
- **API Integration**: Fetches spell data from https://www.dnd5eapi.co/api/spells/

#### `src/pages/NotesPage.tsx`
Campaign journal with markdown support.

**Key Functions:**
- `saveNotes`: Saves notes to localStorage
- `handleCreateNote`: Creates a new note
- `handleUpdateNote`: Updates note content with autosave
- `handleDeleteNote`: Deletes a note after confirmation
- Uses ReactMarkdown for rendering markdown preview

#### `src/contexts/ThemeContext.tsx`
Context provider for theme and accent color management.

**Key Functions:**
- `ThemeProvider`: Provides theme state to entire app
- `setTheme`: Changes theme and persists to localStorage
- `setAccentColor`: Changes accent color
- `useTheme`: Hook to access theme context from any component

#### `src/types/character.ts`
TypeScript type definitions for character data.

**Key Interfaces:**
- `Character`: Complete character data structure with:
  - Basic info (id, name, race, class, background, alignment, level)
  - Ability scores, HP (current, max, temp), AC, initiative
  - Equipment (supports both string and InventoryItem types)
  - Spells and spell slots
  - Proficiencies (skills, saving throws, armor, weapons, tools, languages)
  - Death saves (success/failure arrays)
  - Currency (platinum, gold, silver, copper)
  - UI flags (heroic inspiration, used abilities)
- `AbilityScores`: Six ability scores (STR, DEX, CON, INT, WIS, CHA)
- `InventoryItem`: Equipment with name, description, and cost

**Key Functions:**
- `getAbilityModifier`: Calculates ability score modifier using formula: floor((score - 10) / 2)
- `getProficiencyBonus`: Calculates proficiency bonus based on level using formula: floor((level - 1) / 4) + 2

### Backend Files (Rust)

#### `src-tauri/src/main.rs`
Tauri backend handling file operations for character storage.

**Key Structs:**
- `Character`: Rust representation of character data with:
  - All character fields matching TypeScript interface
  - Serde serialization/deserialization support
  - Optional fields for backward compatibility (subrace, max_hit_points, currency)
  - Default values for new fields (alignment defaults to "Neutral")
  - Proficiency maps and arrays (saving throws, skills, armor, weapons, tools, languages)
- `Currency`: Platinum, gold, silver, copper tracking
- `AbilityScores`: Six ability scores

**Key Functions:**
- `get_characters_dir`: Returns path to characters directory in app data folder
- `ensure_characters_dir`: Creates characters directory if it doesn't exist
- `load_characters`: Loads all character JSON files from storage
- `save_character`: Saves character data to JSON file with pretty printing
- `delete_character`: Deletes a character file
- `get_characters_directory`: Returns the characters directory path for export

#### `src-tauri/Cargo.toml`
Rust dependencies for the Tauri backend.

#### `src-tauri/tauri.conf.json`
Tauri configuration including window settings and build commands.

## Getting Started

### Prerequisites

1. **Node.js** (version 16 or higher)
   - Check: `node --version`
   - Install from: https://nodejs.org/

2. **Rust** (latest stable version)
   - Check: `rustc --version`
   - Install from: https://www.rust-lang.org/tools/install

### Quick Start

Navigate to the project directory and run:
```bash
cd /Users/[name]/Downloads/dndbeyond
npm install              # First time only
./start-app.sh
```

**Note**: First run may take a few minutes while Rust compiles dependencies. Subsequent runs are much faster.

### Building for Production

```bash
npm run tauri build
```

Built applications will be in:
- **macOS**: `src-tauri/target/release/bundle/macos/`
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **Linux**: `src-tauri/target/release/bundle/appimage/`

## Usage

### Creating Characters
1. Navigate to the Characters page
2. Click "New Character"
3. Follow the multi-tab wizard:
   - **Basic**: Enter character name and select alignment
   - **Class**: Choose class and complete class-specific selections (only bard fully implemented)
   - **Background**: Select character background (only criminal fully implemented)
   - **Species**: Choose species and subrace if applicable (dragonborn, dwarf, elf not fully implemented)
   - **Abilities**: Choose ability score method (Standard Array, Point Buy, or Roll Stats) and assign scores
   - **Review**: Review all selections and create character
4. Each tab validates your choices before allowing you to proceed
5. Click "Create Character" on the Review tab to finalize

### Editing Characters
1. All changes are automatically saved
2. Use number toggles below health bar to edit Current, Max, & Temp HP
3. Notes tab on each character sheet can be edited with any text and automatically saves
4. Currency can be added on inventory tab using number toggles
5. Items can be added/removed from inventory by clicking add item/remove item
6. Track death saves by clicking the success/failure circles
7. Toggle heroic inspiration with the inspiration checkbox
8. Level up using the "Level Up" button (choose to roll HP or take average)
Stats are currently not editable from character sheet

### Rolling Dice
1. Go to the Dice Roller page
2. Enter a dice expression (e.g., `2d6+3`, `1d20`) and click roll or hit enter
3. Use a quick roll button, toggle advantage/disadvantage on or off
4. View the roll history below
5. Clear roll history or delete specific rolls if desired

### Using the Compendium
1. Navigate to the Compendium page
2. Switch between Spells & Monsters (Items & Feats disabled temporarily)
3. Use the search bar to find specific content
4. For spells, use additional filters:
   - Filter by class (Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard)
   - Filter by level (Cantrip through 9th level)
   - Filter by school (Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation)
5. Click the star icon to favorite items
6. Click on an item to view detailed information
7. Spell details include concentration and ritual badges when applicable

### Taking Notes
1. Go to the Notes page
2. Click the "+ New" button to create a new note
3. Enter edit mode by clicking the "Edit" button
4. Enter notes, use tools at the top to augment text
5. Common keyboard shortcuts are also available (e.g. Cmd+B for bold, Cmd+I for italics, etc.)
6. Click "Preview" to exit edit mode
7. Notes auto-save with changes

### Customizing Appearance
1. Click the Settings icon at the bottom of the sidebar
2. Toggle between Light and Dark mode
3. Choose an accent color
4. Changes are saved automatically
Custom theme is not currently functional

## Troubleshooting

### Port 1420 Already in Use
```bash
lsof -ti :1420 | xargs kill -9
```

### "Cannot find module" Errors
```bash
npm install
```

### Rust Compilation Errors
```bash
cd src-tauri
cargo clean
cd ..
npm run tauri dev
```

### "Cargo not found"
```bash
source "$HOME/.cargo/env"
```

## Data Storage

Character data is stored locally as JSON files in platform-specific locations:
- **macOS**: `~/Library/Application Support/dnd-beyond-desktop/characters/`
- **Windows**: `C:\Users\<user>\AppData\Roaming\dnd-beyond-desktop\characters\`
- **Linux**: `~/.local/share/dnd-beyond-desktop/characters/`

Notes and settings are stored in browser localStorage.

## Development

### Project Structure
The project uses a standard Tauri + React setup with:
- **Frontend**: React with TypeScript, Tailwind CSS, React Router
- **Backend**: Rust with Tauri
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom theme variables

### Adding New Features
1. Create new components in `src/components/`
2. Add new pages in `src/pages/`
3. Define types in `src/types/`
4. Add backend commands in `src-tauri/src/main.rs`
5. Update routing in `src/App.tsx`

### Keyboard Shortcuts
- `Ctrl/Cmd + S`: Save (context-dependent)
- `Ctrl/Cmd + K`: Focus search (in various contexts)
- `Ctrl/Cmd + /`: Toggle between edit/preview in notes

## Technologies Used

- **Tauri**: Desktop framework
- **React**: UI framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **React Router**: Navigation
- **Framer Motion**: Animations
- **React Markdown**: Markdown rendering
- **Lucide React**: Icons
- **Rust**: Backend language

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Recently Implemented Features

- [x] Multi-tab character creation wizard with validation
- [x] Bard class with full implementation (skills, instruments, equipment, spells)
- [x] Advanced spell filtering by class, level, and school
- [x] Spell concentration and ritual indicators
- [x] Heroic inspiration toggle
- [x] Currency tracking (platinum, gold, silver, copper)
- [x] Level up system with HP choice (roll or average)
- [x] Three ability score generation methods (Standard Array, Point Buy, Roll Stats)
- [x] Expandable spell details in character creation

## Future Enhancements

- [ ] Additional class implementations (Fighter, Wizard, Cleric, Rogue, etc.)
- [ ] Subclass selection and features
- [ ] Export/import character sheets (JSON not PDF)
- [ ] Equipment weight and encumbrance
- [ ] Character portraits/tokens (option to upload image or AI generate)
- [ ] Audio feedback for dice rolls
- [ ] Print-friendly character sheet view (current PDF export is ugly)
- [ ] Spell slot usage tracking per level
- [ ] Class features by level
- [ ] Feats and ASI selection on level up
