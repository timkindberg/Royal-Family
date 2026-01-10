# Royal Family - Card Game

Two royal families race to destroy each other. A digital implementation of the open-source tabletop game.

## 🎮 Play the Game

Simply open `index.html` in your web browser to play!

```bash
# macOS
open index.html

# Linux
xdg-open index.html

# Or start a local server
python3 -m http.server 8000
# Then visit http://localhost:8000
```

## 📜 Game Overview

Royal Family is a two-player card game that uses a standard 52-card deck plus Jokers. Each player controls two castles and must destroy all of their opponent's active castles to win.

### The Families

- **The Starless** (Black) - Primary crest: ♠ Spade, Alliance: ♣ Club
- **The Scarlett** (Red) - Primary crest: ♥ Heart, Alliance: ♦ Diamond

### Card Designations

| Card | Role |
|------|------|
| Aces | Castles |
| K, Q, J | Royal Family Members |
| 3–10 | Soldiers (persuasion, defense, attack) |
| 2 | Assassin |
| Joker | Toggles the Age |

## ⚔️ How to Play

### Setup
- Each player starts with their primary castle (face up/active) and alliance castle (face down/inactive)
- The remaining deck is shuffled and placed in the center

### Round Structure
1. **Flop**: Deal 3 cards to the field
2. **Determine Age**: 
   - No Joker = Age of Uprising (lower color count goes first)
   - Joker present = Age of Oppression (higher color count goes first)
3. **Three Turns**: One player gets turns 1 & 3, the other gets turn 2

### Turn Actions
1. **Draw** - Take one card from the deck or any field pile
2. **Act** - Use the card or field it

### Available Actions

| Action | Description |
|--------|-------------|
| **Field** | Discard card to a field pile (always available) |
| **Persuade** | Add alliance-suit cards to activate your alliance castle (20 points needed) |
| **Threaten** | Use primary-suit cards to cancel opponent's persuasion |
| **Fortify** | Place matching-suit soldiers as castle defense |
| **Battle** | Attack opponent's fortifications |
| **Raid** | Deal permanent damage to undefended castles (20 to destroy) |
| **Bring to Power** | Place royal cards in their matching castles |
| **Assassinate** | Kill enemy royal (2 drawn from field) |

### Special Rules

- **Assassin (2)**: Drawing from the **deck** kills one of YOUR royals! Drawing from the **field** lets you assassinate an enemy.
- **Raids**: When raiding, you can also Kill, Kidnap, or Rescue royals if conditions are met.
- **Victory**: Destroy all opponent's active castles to win!

## 🛠️ Development

The game is built with vanilla HTML, CSS, and JavaScript:

- `index.html` - Game structure
- `styles.css` - Medieval-themed styling
- `game.js` - Core game logic and rules
- `ui.js` - UI controller and rendering

## 📖 Original Game

This is a digital adaptation of [Royal Family](https://github.com/timkindberg/Royal-Family), an open-source tabletop game designed by Tim Kindberg.

## License

MIT License - Feel free to use, modify, and distribute!
