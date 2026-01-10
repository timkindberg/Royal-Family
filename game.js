// Royal Family Card Game - Core Game Logic
// Version: 2.1 - Fixed royal card actions + field pile selection + cancel button
console.log('Royal Family Game v2.1 loaded');

// Card suits and values
const SUITS = {
  SPADE: '♠',
  CLUB: '♣',
  HEART: '♥',
  DIAMOND: '♦'
};

const SUIT_NAMES = {
  '♠': 'spade',
  '♣': 'club',
  '♥': 'heart',
  '♦': 'diamond'
};

const SUIT_COLORS = {
  '♠': 'black',
  '♣': 'black',
  '♥': 'red',
  '♦': 'red'
};

const FACE_VALUES = {
  'A': 1,
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13
};

const ROYAL_HIERARCHY = { 'K': 3, 'Q': 2, 'J': 1 };

// Card class
class Card {
  constructor(value, suit, isJoker = false) {
    this.value = value;
    this.suit = suit;
    this.isJoker = isJoker;
    this.id = isJoker ? `joker-${Math.random()}` : `${value}-${suit}`;
  }

  get numericValue() {
    return FACE_VALUES[this.value] || 0;
  }

  get color() {
    return this.isJoker ? 'wild' : SUIT_COLORS[this.suit];
  }

  get suitName() {
    return this.isJoker ? 'joker' : SUIT_NAMES[this.suit];
  }

  get isRoyal() {
    return ['K', 'Q', 'J'].includes(this.value);
  }

  get isCastle() {
    return this.value === 'A';
  }

  get isAssassin() {
    return this.value === '2';
  }

  get isSoldier() {
    return !this.isJoker && !this.isCastle && !this.isRoyal && !this.isAssassin;
  }

  get displayValue() {
    if (this.isJoker) return '🃏';
    return this.value;
  }

  canKill(targetRoyal) {
    if (!this.isRoyal || !targetRoyal.isRoyal) return false;
    return ROYAL_HIERARCHY[this.value] >= ROYAL_HIERARCHY[targetRoyal.value];
  }
}

// Create a standard deck
function createDeck(includeJokers = true) {
  const deck = [];
  const suits = [SUITS.SPADE, SUITS.CLUB, SUITS.HEART, SUITS.DIAMOND];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  for (const suit of suits) {
    for (const value of values) {
      deck.push(new Card(value, suit));
    }
  }

  if (includeJokers) {
    deck.push(new Card(null, null, true));
    deck.push(new Card(null, null, true));
  }

  return deck;
}

// Shuffle array in place
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Castle class - represents a player's castle
class Castle {
  constructor(suit, isActive = false) {
    this.suit = suit;
    this.isActive = isActive;
    this.aceCard = new Card('A', suit);
    this.royalFamily = []; // K, Q, J cards living here
    this.fortification = null; // Defense card
    this.fortificationDamage = []; // Attack cards on fortification
    this.permanentDamage = []; // Damage cards (need 20 to destroy)
    this.prisoner = null; // Kidnapped royal
    this.persuasionCards = []; // Cards used to persuade alliance
    this.threatCards = []; // Cards used to threaten
    this.destroyed = false;
  }

  get totalPersuasion() {
    return this.persuasionCards.reduce((sum, card) => sum + card.numericValue, 0);
  }

  get totalThreats() {
    return this.threatCards.reduce((sum, card) => sum + card.numericValue, 0);
  }

  get netPersuasion() {
    return this.totalPersuasion - this.totalThreats;
  }

  get totalDamage() {
    return this.permanentDamage.reduce((sum, card) => sum + card.numericValue, 0);
  }

  get fortificationStrength() {
    if (!this.fortification) return 0;
    const damage = this.fortificationDamage.reduce((sum, card) => sum + card.numericValue, 0);
    return this.fortification.numericValue - damage;
  }

  get hasRoyalFamily() {
    return this.royalFamily.length > 0;
  }

  get highestRoyal() {
    if (!this.hasRoyalFamily) return null;
    return this.royalFamily.reduce((highest, card) => {
      if (!highest || ROYAL_HIERARCHY[card.value] > ROYAL_HIERARCHY[highest.value]) {
        return card;
      }
      return highest;
    }, null);
  }

  addPersuasion(card) {
    this.persuasionCards.push(card);
    this.squareUpPoints();
  }

  addThreat(card) {
    this.threatCards.push(card);
    this.squareUpPoints();
  }

  squareUpPoints() {
    // If threats >= persuasion, cancel out
    if (this.totalThreats >= this.totalPersuasion) {
      const discarded = [...this.persuasionCards, ...this.threatCards];
      this.persuasionCards = [];
      this.threatCards = [];
      return discarded;
    }
    return [];
  }

  checkActivation() {
    if (!this.isActive && this.netPersuasion >= 20) {
      this.isActive = true;
      const discarded = [...this.persuasionCards, ...this.threatCards];
      this.persuasionCards = [];
      this.threatCards = [];
      return discarded;
    }
    return [];
  }

  addFortification(card) {
    const discarded = [];
    if (this.fortification) {
      discarded.push(this.fortification, ...this.fortificationDamage);
    }
    this.fortification = card;
    this.fortificationDamage = [];
    return discarded;
  }

  attackFortification(card) {
    this.fortificationDamage.push(card);
    if (this.fortificationStrength <= 0) {
      const discarded = [this.fortification, ...this.fortificationDamage];
      this.fortification = null;
      this.fortificationDamage = [];
      return discarded;
    }
    return [];
  }

  addPermanentDamage(card) {
    this.permanentDamage.push(card);
    if (this.totalDamage >= 20) {
      this.destroyed = true;
      return true;
    }
    return false;
  }

  addRoyal(card) {
    if (card.isRoyal && card.suit === this.suit) {
      this.royalFamily.push(card);
      return true;
    }
    return false;
  }

  removeRoyal(card) {
    const index = this.royalFamily.findIndex(r => r.id === card.id);
    if (index !== -1) {
      return this.royalFamily.splice(index, 1)[0];
    }
    return null;
  }

  kidnap(royal) {
    const released = this.prisoner;
    this.prisoner = royal;
    return released;
  }

  rescuePrisoner() {
    const rescued = this.prisoner;
    this.prisoner = null;
    return rescued;
  }
}

// Player class
class Player {
  constructor(id, color, primarySuit, allianceSuit) {
    this.id = id;
    this.color = color;
    this.primarySuit = primarySuit;
    this.allianceSuit = allianceSuit;
    this.primaryCastle = new Castle(primarySuit, true);
    this.allianceCastle = new Castle(allianceSuit, false);
    this.hand = null; // Current drawn card
  }

  get name() {
    return this._customName || (this.color === 'black' ? 'The Starless' : 'The Scarlett');
  }

  set name(value) {
    this._customName = value;
  }

  get activeCastles() {
    const castles = [];
    if (!this.primaryCastle.destroyed && this.primaryCastle.isActive) {
      castles.push(this.primaryCastle);
    }
    if (!this.allianceCastle.destroyed && this.allianceCastle.isActive) {
      castles.push(this.allianceCastle);
    }
    return castles;
  }

  // Castles whose soldiers can still fight (once activated, soldiers fight even if castle destroyed)
  get castlesThatCanAttack() {
    const castles = [];
    // Primary castle is always active from the start
    if (this.primaryCastle.isActive) {
      castles.push(this.primaryCastle);
    }
    // Alliance castle soldiers can fight once persuaded, even if castle is later destroyed
    if (this.allianceCastle.isActive) {
      castles.push(this.allianceCastle);
    }
    return castles;
  }

  get allCastles() {
    const castles = [];
    if (!this.primaryCastle.destroyed) castles.push(this.primaryCastle);
    if (!this.allianceCastle.destroyed) castles.push(this.allianceCastle);
    return castles;
  }

  get hasActiveCastle() {
    return this.activeCastles.length > 0;
  }

  get isDefeated() {
    return !this.hasActiveCastle;
  }

  getCastleBySuit(suit) {
    if (this.primaryCastle.suit === suit) return this.primaryCastle;
    if (this.allianceCastle.suit === suit) return this.allianceCastle;
    return null;
  }

  ownsCard(card) {
    return card.suit === this.primarySuit || card.suit === this.allianceSuit;
  }
}

// Game state
class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    // Create players
    this.player1 = new Player(1, 'black', SUITS.SPADE, SUITS.CLUB);
    this.player2 = new Player(2, 'red', SUITS.HEART, SUITS.DIAMOND);

    // Create and setup deck
    this.deck = createDeck(true);
    
    // Remove the aces (castles) from deck
    this.deck = this.deck.filter(card => !card.isCastle);
    
    shuffle(this.deck);

    // Field piles (3 piles)
    this.fieldPiles = [[], [], []];
    
    // Discard pile
    this.discardPile = [];

    // Joker in play (determines Age)
    this.jokerInPlay = null;
    this.secondJoker = null; // Tracks if we've seen one joker

    // Game state
    this.currentPlayer = null;
    this.turnOrder = []; // Array of player ids for this round
    this.currentTurnIndex = 0;
    this.phase = 'setup'; // setup, flop, draw, action, gameOver
    this.roundNumber = 0;
    this.turnNumber = 0;

    // Action state
    this.drawnCard = null;
    this.drawnFromDeck = false;
    this.drawnFromPileIndex = null;
    this.selectedAction = null;
    this.selectedTarget = null;

    // Message log
    this.messages = [];
    this.lastAction = null;
  }

  get currentAge() {
    return this.jokerInPlay ? 'oppression' : 'uprising';
  }

  get currentPlayerObj() {
    if (this.currentPlayer === 1) return this.player1;
    if (this.currentPlayer === 2) return this.player2;
    return null;
  }

  get opponentObj() {
    if (this.currentPlayer === 1) return this.player2;
    if (this.currentPlayer === 2) return this.player1;
    return null;
  }

  getPlayer(id) {
    return id === 1 ? this.player1 : this.player2;
  }

  log(message) {
    this.messages.push({ text: message, time: Date.now() });
    if (this.messages.length > 50) this.messages.shift();
  }

  // Count cards of each color in field
  countFieldColors() {
    let black = 0;
    let red = 0;
    
    for (const pile of this.fieldPiles) {
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        if (!topCard.isJoker) {
          if (topCard.color === 'black') black++;
          else if (topCard.color === 'red') red++;
        }
      }
    }
    
    return { black, red };
  }

  // Determine turn order based on field colors and age
  determineTurnOrder() {
    const colors = this.countFieldColors();
    
    // Player 1 is black, Player 2 is red
    let firstPlayer;
    
    if (this.currentAge === 'uprising') {
      // Lower count goes first
      firstPlayer = colors.black <= colors.red ? 1 : 2;
    } else {
      // Higher count goes first (oppression)
      firstPlayer = colors.black >= colors.red ? 1 : 2;
    }
    
    const secondPlayer = firstPlayer === 1 ? 2 : 1;
    this.turnOrder = [firstPlayer, secondPlayer, firstPlayer];
    this.currentTurnIndex = 0;
    this.currentPlayer = this.turnOrder[0];
    
    this.log(`Turn order: ${this.getPlayer(firstPlayer).name} → ${this.getPlayer(secondPlayer).name} → ${this.getPlayer(firstPlayer).name}`);
  }

  // Deal the flop
  dealFlop() {
    this.roundNumber++;
    this.log(`═══ Round ${this.roundNumber} ═══`);
    
    // Check if we need to reshuffle
    if (this.deck.length < 3) {
      this.reshuffleDeck();
    }

    // Deal 3 cards to field
    for (let i = 0; i < 3; i++) {
      if (this.deck.length > 0) {
        let card = this.deck.pop();
        
        // Handle jokers
        while (card.isJoker) {
          this.handleJoker(card);
          if (this.deck.length === 0) {
            this.reshuffleDeck();
          }
          card = this.deck.pop();
        }
        
        this.fieldPiles[i].push(card);
      }
    }

    this.log(`Age of ${this.currentAge === 'uprising' ? 'Uprising' : 'Oppression'}`);
    this.determineTurnOrder();
    this.phase = 'draw';
  }

  handleJoker(joker) {
    if (this.jokerInPlay) {
      // Second joker - discard both, return to Age of Uprising
      this.log('Second Joker appears! Both Jokers discarded. Age of Uprising returns!');
      this.discardPile.push(this.jokerInPlay, joker);
      this.jokerInPlay = null;
    } else {
      // First joker - put in play, enter Age of Oppression
      this.log('Joker appears! Age of Oppression begins!');
      this.jokerInPlay = joker;
    }
  }

  reshuffleDeck() {
    // Collect field piles and discard pile
    const cards = [...this.discardPile];
    for (const pile of this.fieldPiles) {
      cards.push(...pile);
    }
    
    // Keep jokers separate
    this.discardPile = [];
    this.fieldPiles = [[], [], []];
    
    // Filter out jokers and shuffle
    this.deck = cards.filter(c => !c.isJoker);
    shuffle(this.deck);
    
    this.log('Deck reshuffled!');
  }

  // Draw a card
  drawFromDeck() {
    if (this.phase !== 'draw') return false;
    if (this.deck.length === 0) {
      this.reshuffleDeck();
    }
    
    let card = this.deck.pop();
    
    // Handle joker - doesn't count as a turn, player draws again
    if (card.isJoker) {
      this.handleJoker(card);
      this.log(`${this.currentPlayerObj.name} drew a Joker! Draw again.`);
      // Stay in draw phase - player gets to draw again
      return true;
    }
    
    this.drawnCard = card;
    this.drawnFromDeck = true;
    this.drawnFromPileIndex = null;
    this.currentPlayerObj.hand = card;
    
    // Check for assassin from deck - bad luck!
    if (card.isAssassin) {
      this.log(`${this.currentPlayerObj.name} drew an Assassin from the deck! SURPRISE! One of your royals must die.`);
      this.phase = 'assassin-surprise';
      return true;
    }
    
    this.log(`${this.currentPlayerObj.name} drew from the deck`);
    this.phase = 'action';
    return true;
  }

  drawFromField(pileIndex) {
    if (this.phase !== 'draw') return false;
    if (pileIndex < 0 || pileIndex > 2) return false;
    if (this.fieldPiles[pileIndex].length === 0) return false;
    
    const card = this.fieldPiles[pileIndex].pop();
    
    // Handle joker - doesn't count as a turn, player draws again
    if (card.isJoker) {
      this.handleJoker(card);
      this.log(`${this.currentPlayerObj.name} drew a Joker from the field! Draw again.`);
      // Stay in draw phase - player gets to draw again
      return true;
    }
    
    this.drawnCard = card;
    this.drawnFromDeck = false;
    this.drawnFromPileIndex = pileIndex;
    this.currentPlayerObj.hand = card;
    
    // Assassin from field can be used to assassinate
    if (card.isAssassin) {
      this.log(`${this.currentPlayerObj.name} drew an Assassin! Can assassinate an enemy royal.`);
    } else {
      this.log(`${this.currentPlayerObj.name} drew ${card.displayValue}${card.suit}`);
    }
    
    this.phase = 'action';
    return true;
  }

  // Cancel a draw (only for field draws)
  cancelDraw() {
    if (this.drawnFromDeck || this.drawnFromPileIndex === null) return false;
    
    // Return card to the pile it came from
    this.fieldPiles[this.drawnFromPileIndex].push(this.drawnCard);
    this.drawnCard = null;
    this.drawnFromPileIndex = null;
    this.currentPlayerObj.hand = null;
    this.phase = 'draw';
    
    // Remove the last log message about drawing
    if (this.messages.length > 0) {
      this.messages.pop();
    }
    
    return true;
  }

  // Check if current draw can be cancelled
  canCancelDraw() {
    return !this.drawnFromDeck && this.drawnFromPileIndex !== null && this.phase === 'action';
  }

  // Get available actions for current drawn card
  getAvailableActions() {
    const actions = [];
    const card = this.drawnCard;
    const player = this.currentPlayerObj;
    const opponent = this.opponentObj;
    
    if (!card) return actions;

    // Field action is always available - requires choosing a pile
    actions.push({ type: 'field', label: 'Field this card', enabled: true });

    if (card.isJoker) {
      // Jokers are handled automatically
      return actions;
    }

    if (card.isAssassin) {
      // Assassin from field - can assassinate
      const enemyRoyals = [];
      for (const castle of opponent.allCastles) {
        for (const royal of castle.royalFamily) {
          enemyRoyals.push({ castle, royal });
        }
      }
      if (enemyRoyals.length > 0) {
        actions.push({ type: 'assassinate', label: 'Assassinate enemy royal', targets: enemyRoyals, enabled: true });
      } else {
        actions.push({ 
          type: 'assassinate', 
          label: 'Assassinate enemy royal', 
          enabled: false, 
          reason: 'No enemy royals in play to assassinate' 
        });
      }
    }

    if (card.isSoldier) {
      // Persuade alliance
      if (!player.allianceCastle.isActive && !player.allianceCastle.destroyed) {
        if (card.suit === player.allianceSuit) {
          actions.push({ type: 'persuade', label: `Persuade alliance (+${card.numericValue})`, enabled: true });
        } else {
          actions.push({ 
            type: 'persuade', 
            label: `Persuade alliance`, 
            enabled: false, 
            reason: `Requires ${SUIT_NAMES[player.allianceSuit]} card (your alliance suit)` 
          });
        }
      }

      // Threaten opponent's alliance
      if (!opponent.allianceCastle.isActive && !opponent.allianceCastle.destroyed) {
        if (card.suit === player.primarySuit) {
          actions.push({ type: 'threaten', label: `Threaten enemy alliance (+${card.numericValue} threat)`, enabled: true });
        } else {
          actions.push({ 
            type: 'threaten', 
            label: `Threaten enemy alliance`, 
            enabled: false, 
            reason: `Requires ${SUIT_NAMES[player.primarySuit]} card (your primary suit)` 
          });
        }
      }

      // Fortify own castles
      for (const castle of player.activeCastles) {
        if (card.suit === castle.suit) {
          if (!castle.fortification) {
            actions.push({ type: 'fortify', label: `Fortify ${SUIT_NAMES[castle.suit]} castle (+${card.numericValue} defense)`, castle, enabled: true });
          } else if (card.numericValue > castle.fortification.numericValue) {
            actions.push({ type: 'upgrade-fortification', label: `Upgrade ${SUIT_NAMES[castle.suit]} fortification (+${card.numericValue} defense)`, castle, enabled: true });
          } else if (castle.fortificationDamage.length > 0) {
            actions.push({ type: 'repair-fortification', label: `Repair ${SUIT_NAMES[castle.suit]} fortification (+${card.numericValue} repair)`, castle, enabled: true });
          } else {
            actions.push({ 
              type: 'fortify', 
              label: `Fortify ${SUIT_NAMES[castle.suit]} castle`, 
              enabled: false, 
              reason: `Current fortification (${castle.fortification.numericValue}) is equal or stronger` 
            });
          }
        }
      }

      // Attack options - show disabled ones too
      // Once a castle is activated (persuaded to join war), its soldiers can fight even if castle is destroyed
      const matchingAttackCastle = player.castlesThatCanAttack.find(c => c.suit === card.suit);
      const canAttackWithSuit = matchingAttackCastle !== undefined;
      const inactiveMatchingCastle = player.allCastles.find(c => c.suit === card.suit && !c.isActive);

      for (const castle of opponent.allCastles) {
        if (!castle.destroyed && castle.isActive) {
          if (canAttackWithSuit) {
            if (castle.fortification) {
              actions.push({ type: 'battle', label: `Battle ${SUIT_NAMES[castle.suit]} fortification`, castle, enabled: true });
            } else {
              // Can do permanent damage if attacking castle has royals (even if castle is destroyed)
              if (matchingAttackCastle.hasRoyalFamily) {
                actions.push({ type: 'raid', label: `Raid ${SUIT_NAMES[castle.suit]} castle`, castle, attackingCastle: matchingAttackCastle, enabled: true });
              } else {
                actions.push({ type: 'raid-no-damage', label: `Raid ${SUIT_NAMES[castle.suit]} castle (no permanent damage)`, castle, enabled: true });
              }
            }
          } else if (inactiveMatchingCastle) {
            // Show disabled with reason about needing to persuade alliance first
            actions.push({ 
              type: 'battle', 
              label: `Attack ${SUIT_NAMES[castle.suit]} castle`, 
              enabled: false, 
              reason: `You must first persuade ${SUIT_NAMES[card.suit]} castle to join your war` 
            });
          }
        }
      }
    }

    if (card.isRoyal) {
      // Bring to power - show for all matching castles with reasons if disabled
      const matchingCastle = player.getCastleBySuit(card.suit);
      if (matchingCastle) {
        if (matchingCastle.destroyed) {
          actions.push({ 
            type: 'bring-to-power', 
            label: `Bring ${card.value} to ${SUIT_NAMES[card.suit]} castle`, 
            enabled: false, 
            reason: `${SUIT_NAMES[card.suit]} castle has been destroyed` 
          });
        } else if (!matchingCastle.isActive) {
          actions.push({ 
            type: 'bring-to-power', 
            label: `Bring ${card.value} to ${SUIT_NAMES[card.suit]} castle`, 
            enabled: false, 
            reason: `You must first persuade ${SUIT_NAMES[card.suit]} castle to join your war (20 persuasion needed)` 
          });
        } else {
          actions.push({ type: 'bring-to-power', label: `Bring ${card.value} to power in ${SUIT_NAMES[card.suit]} castle`, castle: matchingCastle, enabled: true });
        }
      } else {
        // Card belongs to opponent
        actions.push({ 
          type: 'bring-to-power', 
          label: `Bring ${card.value} to power`, 
          enabled: false, 
          reason: `This ${SUIT_NAMES[card.suit]} royal belongs to your enemy` 
        });
      }
    }

    return actions;
  }

  // Execute an action
  executeAction(actionType, target = null, additionalTarget = null) {
    const card = this.drawnCard;
    const player = this.currentPlayerObj;
    const opponent = this.opponentObj;

    switch (actionType) {
      case 'field':
        // target is the pile index (0, 1, or 2)
        const pileIndex = typeof target === 'number' ? target : 0;
        const coveredCard = this.fieldPiles[pileIndex].length > 0 
          ? this.fieldPiles[pileIndex][this.fieldPiles[pileIndex].length - 1] 
          : null;
        this.fieldPiles[pileIndex].push(card);
        if (coveredCard) {
          this.log(`${player.name} fielded ${card.displayValue}${card.suit || ''} (covered ${coveredCard.displayValue}${coveredCard.suit || ''})`);
        } else {
          this.log(`${player.name} fielded ${card.displayValue}${card.suit || ''}`);
        }
        break;

      case 'persuade':
        player.allianceCastle.addPersuasion(card);
        this.log(`${player.name} persuaded alliance (+${card.numericValue}, total: ${player.allianceCastle.netPersuasion}/20)`);
        const activated1 = player.allianceCastle.checkActivation();
        if (activated1.length > 0) {
          this.discardPile.push(...activated1);
          this.log(`🏰 ${player.name}'s alliance castle is now ACTIVE!`);
        }
        break;

      case 'threaten':
        opponent.allianceCastle.addThreat(card);
        this.log(`${player.name} threatened enemy alliance (+${card.numericValue} threat)`);
        break;

      case 'fortify':
      case 'upgrade-fortification':
      case 'repair-fortification':
        const discarded = target.addFortification(card);
        this.discardPile.push(...discarded);
        this.log(`${player.name} fortified ${SUIT_NAMES[target.suit]} castle (strength: ${card.numericValue})`);
        break;

      case 'battle':
        const battleDiscarded = target.attackFortification(card);
        if (battleDiscarded.length > 0) {
          this.discardPile.push(...battleDiscarded);
          this.log(`${player.name} destroyed ${SUIT_NAMES[target.suit]} fortification!`);
        } else {
          this.log(`${player.name} attacked ${SUIT_NAMES[target.suit]} fortification (remaining: ${target.fortificationStrength})`);
        }
        break;

      case 'raid':
        // With permanent damage
        const destroyed = target.addPermanentDamage(card);
        this.log(`${player.name} raided ${SUIT_NAMES[target.suit]} castle (+${card.numericValue} damage, total: ${target.totalDamage}/20)`);
        if (destroyed) {
          this.handleCastleDestroyed(target, opponent);
        } else {
          // Check for kill/kidnap/rescue options
          this.phase = 'raid-choice';
          this.raidTarget = target;
          this.raidAttackingCastle = additionalTarget;
          return; // Don't end turn yet
        }
        break;

      case 'raid-no-damage':
        this.discardPile.push(card);
        this.log(`${player.name} raided ${SUIT_NAMES[target.suit]} castle (no damage - no royal in attacking castle)`);
        break;

      case 'bring-to-power':
        target.addRoyal(card);
        this.log(`${player.name} brought ${card.value}${card.suit} to power!`);
        break;

      case 'assassinate':
        // target is { castle, royal }
        const killedRoyal = target.castle.removeRoyal(target.royal);
        this.discardPile.push(killedRoyal, card);
        this.log(`${player.name} assassinated ${killedRoyal.value}${killedRoyal.suit}!`);
        break;
    }

    this.drawnCard = null;
    player.hand = null;
    this.lastAction = actionType;
    this.endTurn();
  }

  // Handle raid choices (kill, kidnap, rescue)
  executeRaidChoice(choice, target = null) {
    const player = this.currentPlayerObj;
    const opponent = this.opponentObj;
    const raidedCastle = this.raidTarget;
    const attackingCastle = this.raidAttackingCastle;

    switch (choice) {
      case 'kill':
        if (target && attackingCastle.highestRoyal?.canKill(target)) {
          const killed = raidedCastle.removeRoyal(target);
          this.discardPile.push(killed);
          this.log(`${player.name} killed ${killed.value}${killed.suit}!`);
        }
        break;

      case 'kidnap':
        if (target && attackingCastle.highestRoyal?.canKill(target)) {
          const kidnapped = raidedCastle.removeRoyal(target);
          const released = attackingCastle.kidnap(kidnapped);
          if (released) {
            // Released prisoner goes to field
            this.fieldPiles[0].push(released);
            this.log(`${player.name} kidnapped ${kidnapped.value}${kidnapped.suit}, releasing ${released.value}${released.suit}!`);
          } else {
            this.log(`${player.name} kidnapped ${kidnapped.value}${kidnapped.suit}!`);
          }
        }
        break;

      case 'rescue':
        if (raidedCastle.prisoner && player.ownsCard(raidedCastle.prisoner)) {
          const rescued = raidedCastle.rescuePrisoner();
          const homeCastle = player.getCastleBySuit(rescued.suit);
          if (homeCastle && !homeCastle.destroyed) {
            homeCastle.addRoyal(rescued);
            this.log(`${player.name} rescued ${rescued.value}${rescued.suit}!`);
          }
        }
        break;

      case 'skip':
        this.log(`${player.name} chose not to take additional raid action.`);
        break;
    }

    this.raidTarget = null;
    this.raidAttackingCastle = null;
    this.drawnCard = null;
    player.hand = null;
    this.endTurn();
  }

  // Handle assassin surprise (drawn from deck)
  executeAssassinSurprise(targetRoyal, targetCastle) {
    const player = this.currentPlayerObj;
    
    if (targetRoyal && targetCastle) {
      const killed = targetCastle.removeRoyal(targetRoyal);
      this.discardPile.push(killed, this.drawnCard);
      this.log(`Assassin killed ${killed.value}${killed.suit}!`);
    } else {
      // No royals to kill
      this.discardPile.push(this.drawnCard);
      this.log(`Assassin found no royals to kill.`);
    }

    this.drawnCard = null;
    player.hand = null;
    this.endTurn();
  }

  handleCastleDestroyed(castle, owner) {
    this.log(`💀 ${SUIT_NAMES[castle.suit].toUpperCase()} CASTLE DESTROYED!`);
    
    // Discard castle, royals, and damage
    this.discardPile.push(castle.aceCard);
    this.discardPile.push(...castle.royalFamily);
    this.discardPile.push(...castle.permanentDamage);
    if (castle.fortification) {
      this.discardPile.push(castle.fortification);
      this.discardPile.push(...castle.fortificationDamage);
    }
    if (castle.prisoner) {
      this.discardPile.push(castle.prisoner);
    }

    // Check for game over
    if (owner.isDefeated) {
      this.phase = 'gameOver';
      this.winner = this.currentPlayer;
      this.log(`🏆 ${this.currentPlayerObj.name} WINS!`);
    }
  }

  endTurn() {
    // Don't continue if game is already over!
    if (this.phase === 'gameOver') return;
    
    this.turnNumber++;
    this.currentTurnIndex++;

    // Check if round is over
    if (this.currentTurnIndex >= 3) {
      // End of round, start new flop
      this.phase = 'flop';
    } else {
      this.currentPlayer = this.turnOrder[this.currentTurnIndex];
      this.phase = 'draw';
      this.log(`--- ${this.currentPlayerObj.name}'s turn ---`);
    }
  }

  // Get raid action options
  getRaidOptions() {
    const player = this.currentPlayerObj;
    const raidedCastle = this.raidTarget;
    const attackingCastle = this.raidAttackingCastle;
    const options = [];

    // Always can skip
    options.push({ type: 'skip', label: 'Skip additional action' });

    // Check for rescue
    if (raidedCastle.prisoner && player.ownsCard(raidedCastle.prisoner)) {
      options.push({ type: 'rescue', label: `Rescue ${raidedCastle.prisoner.value}${raidedCastle.prisoner.suit}` });
    }

    // Check for kill/kidnap
    const highestRoyal = attackingCastle.highestRoyal;
    if (highestRoyal) {
      for (const royal of raidedCastle.royalFamily) {
        if (highestRoyal.canKill(royal)) {
          options.push({ type: 'kill', label: `Kill ${royal.value}${royal.suit}`, target: royal });
          options.push({ type: 'kidnap', label: `Kidnap ${royal.value}${royal.suit}`, target: royal });
        }
      }
    }

    return options;
  }

  // Get player's own royals for assassin surprise
  getOwnRoyals() {
    const player = this.currentPlayerObj;
    const royals = [];
    
    for (const castle of player.allCastles) {
      for (const royal of castle.royalFamily) {
        royals.push({ castle, royal });
      }
    }
    
    return royals;
  }

  // Start the game
  startGame() {
    this.phase = 'flop';
    this.log('⚔️ Royal Family - Game Started! ⚔️');
    this.log(`${this.player1.name} (Black) vs ${this.player2.name} (Red)`);
    this.dealFlop();
  }

  // Continue to next flop
  nextRound() {
    if (this.phase === 'flop') {
      this.dealFlop();
    }
  }
}

// AI Player class
class AIPlayer {
  // Mood constants
  static MOODS = {
    AGGRESSIVE: 'aggressive',   // 🔥 Prioritizes attacks
    DEFENSIVE: 'defensive',     // 🛡️ Prioritizes protection
    OPPORTUNISTIC: 'opportunistic', // 🎯 Balanced, optimal plays
    AMBITIOUS: 'ambitious'      // 👑 Prioritizes building power
  };

  static MOOD_EMOJIS = {
    aggressive: '🔥',
    defensive: '🛡️',
    opportunistic: '🎯',
    ambitious: '👑'
  };

  constructor(game, playerNumber = 2) {
    this.game = game;
    this.playerNumber = playerNumber;
    this.thinkingDelay = 800;
    
    // Mood system
    this.mood = this.randomMood();
    this.turnsSinceMoodChange = 0;
    this.turnsSinceAttack = 0;
    this.lastAction = null;
    
    // Personality variance (how much randomness in decisions)
    this.variance = 3; // ±3 points random variance
    this.similarThreshold = 5; // Actions within 5 points are "similar"
  }

  randomMood() {
    const moods = Object.values(AIPlayer.MOODS);
    return moods[Math.floor(Math.random() * moods.length)];
  }

  get moodEmoji() {
    return AIPlayer.MOOD_EMOJIS[this.mood] || '🎯';
  }

  get player() {
    return this.game.getPlayer(this.playerNumber);
  }

  get opponent() {
    return this.game.getPlayer(this.playerNumber === 1 ? 2 : 1);
  }

  isMyTurn() {
    return this.game.currentPlayer === this.playerNumber;
  }

  // Check if mood should change based on game state
  updateMood() {
    this.turnsSinceMoodChange++;
    
    const myRoyals = this.countMyRoyals();
    const enemyRoyals = this.countEnemyRoyals();
    const myDamage = this.getTotalDamage(this.player);
    const enemyDamage = this.getTotalDamage(this.opponent);
    const hasUnprotectedRoyals = this.hasUnprotectedRoyals();
    const allianceProgress = this.player.allianceCastle.netPersuasion;
    
    // Strong triggers that override current mood
    
    // DEFENSIVE triggers
    if (hasUnprotectedRoyals && myRoyals > 0) {
      // My royals are exposed!
      if (this.mood !== AIPlayer.MOODS.DEFENSIVE && Math.random() < 0.7) {
        this.setMood(AIPlayer.MOODS.DEFENSIVE, 'royals exposed');
        return;
      }
    }
    
    if (myDamage >= 15) {
      // Castle almost destroyed - panic defense!
      if (Math.random() < 0.8) {
        this.setMood(AIPlayer.MOODS.DEFENSIVE, 'castle critical');
        return;
      }
    }
    
    // AGGRESSIVE triggers
    if (enemyDamage >= 12 && this.mood !== AIPlayer.MOODS.AGGRESSIVE) {
      // Smell blood - enemy is weak
      if (Math.random() < 0.6) {
        this.setMood(AIPlayer.MOODS.AGGRESSIVE, 'enemy weakened');
        return;
      }
    }
    
    if (this.turnsSinceAttack >= 3 && myRoyals > 0) {
      // Getting antsy, haven't attacked in a while
      if (Math.random() < 0.5) {
        this.setMood(AIPlayer.MOODS.AGGRESSIVE, 'antsy');
        return;
      }
    }
    
    // AMBITIOUS triggers
    if (allianceProgress >= 12 && !this.player.allianceCastle.isActive) {
      // Close to activating alliance!
      if (Math.random() < 0.6) {
        this.setMood(AIPlayer.MOODS.AMBITIOUS, 'alliance close');
        return;
      }
    }
    
    if (myRoyals === 0 && enemyRoyals > 0) {
      // Need to catch up on royals
      if (Math.random() < 0.5) {
        this.setMood(AIPlayer.MOODS.AMBITIOUS, 'need royals');
        return;
      }
    }
    
    // OPPORTUNISTIC triggers (return to balanced)
    if (this.turnsSinceMoodChange >= 4 && Math.random() < 0.3) {
      // Been in same mood too long, reconsider
      this.setMood(AIPlayer.MOODS.OPPORTUNISTIC, 'reassessing');
      return;
    }
    
    // Post-action mood shifts
    if (this.lastAction) {
      if (['fortify', 'repair-fortification'].includes(this.lastAction)) {
        // Just fortified - feeling secure, might go aggressive
        if (Math.random() < 0.4) {
          this.setMood(AIPlayer.MOODS.AGGRESSIVE, 'feeling secure');
        }
      }
      
      if (['raid', 'battle', 'assassinate'].includes(this.lastAction)) {
        // Just attacked - might feel satisfied and go opportunistic
        if (Math.random() < 0.3) {
          this.setMood(AIPlayer.MOODS.OPPORTUNISTIC, 'satisfied');
        }
      }
    }
  }

  setMood(newMood, reason) {
    if (this.mood !== newMood) {
      const oldMood = this.mood;
      this.mood = newMood;
      this.turnsSinceMoodChange = 0;
      this.game.log(`The Crown's mood shifts: ${AIPlayer.MOOD_EMOJIS[oldMood]} → ${AIPlayer.MOOD_EMOJIS[newMood]} (${reason})`);
    }
  }

  getTotalDamage(player) {
    let damage = 0;
    for (const castle of player.allCastles) {
      damage += castle.damage || 0;
    }
    return damage;
  }

  hasUnprotectedRoyals() {
    for (const castle of this.player.allCastles) {
      if (castle.royalFamily.length > 0 && !castle.fortification) {
        return true;
      }
    }
    return false;
  }

  // Apply mood modifiers to action score
  applyMoodModifier(actionType, baseScore) {
    let modifier = 0;
    
    switch (this.mood) {
      case AIPlayer.MOODS.AGGRESSIVE:
        if (['raid', 'battle', 'assassinate', 'threaten'].includes(actionType)) {
          modifier = 6;
        } else if (['fortify', 'repair-fortification'].includes(actionType)) {
          modifier = -3;
        }
        break;
        
      case AIPlayer.MOODS.DEFENSIVE:
        if (['fortify', 'repair-fortification', 'upgrade-fortification'].includes(actionType)) {
          modifier = 6;
        } else if (['raid', 'battle'].includes(actionType)) {
          modifier = -4;
        }
        break;
        
      case AIPlayer.MOODS.AMBITIOUS:
        if (['bring-to-power', 'persuade'].includes(actionType)) {
          modifier = 5;
        } else if (['field'].includes(actionType)) {
          modifier = -2;
        }
        break;
        
      case AIPlayer.MOODS.OPPORTUNISTIC:
      default:
        // No modifier - play optimally
        break;
    }
    
    return baseScore + modifier;
  }

  // Add random variance to score
  addVariance(score) {
    const variance = (Math.random() - 0.5) * 2 * this.variance;
    return score + variance;
  }

  // Pick from similar options with some randomness
  pickFromSimilarOptions(scoredOptions) {
    if (scoredOptions.length === 0) return null;
    if (scoredOptions.length === 1) return scoredOptions[0];
    
    // Sort by score descending
    scoredOptions.sort((a, b) => b.score - a.score);
    
    const topScore = scoredOptions[0].score;
    
    // Find all options within the similarity threshold
    const similarOptions = scoredOptions.filter(
      opt => topScore - opt.score <= this.similarThreshold
    );
    
    // Weighted random selection favoring higher scores
    const weights = similarOptions.map(opt => Math.pow(opt.score, 1.5));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < similarOptions.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return similarOptions[i];
      }
    }
    
    return similarOptions[0];
  }

  // Main AI decision loop
  async takeTurn() {
    if (!this.isMyTurn()) return;
    if (this.game.phase === 'gameOver') return; // Don't play if game is over

    // Update mood at start of turn
    if (this.game.phase === 'draw') {
      this.updateMood();
    }

    await this.delay(this.thinkingDelay);

    // Double-check game isn't over after delay
    if (this.game.phase === 'gameOver') return;

    switch (this.game.phase) {
      case 'draw':
        await this.decideDraw();
        break;
      case 'action':
        await this.decideAction();
        break;
      case 'raid-choice':
        await this.decideRaidChoice();
        break;
      case 'assassin-surprise':
        await this.decideAssassinSurprise();
        break;
      case 'field-select':
        await this.decideFieldPile();
        break;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Decide where to draw from
  async decideDraw() {
    // Evaluate field cards with variance
    const fieldOptions = [];
    
    for (let i = 0; i < 3; i++) {
      const pile = this.game.fieldPiles[i];
      if (pile.length > 0) {
        const card = pile[pile.length - 1];
        let score = this.evaluateCard(card);
        
        // DENIAL BONUS: Add value for denying opponent a useful card
        const denialValue = this.evaluateCardForOpponent(card);
        if (denialValue >= 15) {
          // This card would be GREAT for opponent - take it to deny them!
          score += denialValue * 0.5; // Add 50% of opponent's value as denial bonus
        }
        
        // UNCOVER AWARENESS: Consider what's underneath this card
        // Turn position matters! After turn 3/3, new flop covers everything.
        // - Turn 1/3: Might grab it turn 3/3, but opponent might cover it turn 2/3
        // - Turn 2/3 or 3/3: Flop will bury it, need to re-uncover next round
        if (pile.length > 1) {
          const cardUnderneath = pile[pile.length - 2];
          const uncoverValueForOpponent = this.evaluateCardForOpponent(cardUnderneath);
          const uncoverValueForMe = this.evaluateCard(cardUnderneath);
          
          const turnIndex = this.game.currentTurnIndex; // 0, 1, or 2
          
          // Penalize if we'd uncover something good for opponent
          if (uncoverValueForOpponent >= 12) {
            // Turn 1: They'll likely grab it immediately on turn 2
            // Turns 2-3: Flop coming, less impactful
            const penaltyMultiplier = turnIndex === 0 ? 0.5 : 0.2;
            score -= uncoverValueForOpponent * 0.4 * penaltyMultiplier;
          }
          
          // Bonus if we'd uncover something good for us
          if (uncoverValueForMe >= 15) {
            // Turn 1/3: ~40% chance we get it (opponent might cover to deny, or be distracted)
            // Turns 2-3/3: ~10% chance (flop coming, need perfect next round)
            const multiplier = turnIndex === 0 ? 0.4 : 0.1;
            score += uncoverValueForMe * multiplier;
          }
        }
        
        score = this.addVariance(score); // Add randomness
        fieldOptions.push({ index: i, card, score });
      }
    }

    // Add "deck" as an option with base score
    // Deck is a gamble - might get something great or useless
    const deckScore = this.addVariance(10); // Base deck score with variance
    
    // Use weighted random selection from similar options
    const allOptions = [
      ...fieldOptions.map(opt => ({ type: 'field', ...opt })),
      { type: 'deck', score: deckScore }
    ];
    
    // Filter to only decent options
    const decentOptions = allOptions.filter(opt => opt.score >= 6);
    
    if (decentOptions.length === 0) {
      // Nothing good - just draw from deck
      this.game.drawFromDeck();
      return;
    }
    
    const chosen = this.pickFromSimilarOptions(decentOptions);
    
    if (chosen.type === 'deck') {
      this.game.drawFromDeck();
    } else {
      this.game.drawFromField(chosen.index);
    }
  }

  // Evaluate how good a card is for AI to USE - considers ACTION PRIORITY not just "can use"
  evaluateCard(card) {
    if (card.isJoker) return 0; // Jokers are neutral - just draw again

    const myRoyals = this.countMyRoyals();
    const enemyRoyals = this.countEnemyRoyals();
    const value = card.numericValue || 0;

    if (card.isAssassin) {
      // Assassin only valuable if opponent has royals I can kill
      if (enemyRoyals > 0) {
        // Could be game-winning if they're low on royals
        if (enemyRoyals === 1) return 35;
        if (enemyRoyals === 2) return 28;
        return 22;
      }
      return 1; // Can't use it
    }

    if (card.isRoyal) {
      const myCastle = this.player.getCastleBySuit(card.suit);
      
      if (myCastle && myCastle.isActive && !myCastle.destroyed) {
        const existingRoyals = myCastle.royalFamily.length;
        if (existingRoyals === 0) {
          return 20; // First royal - high priority
        } else if (existingRoyals === 1) {
          return 10; // Second royal - medium priority (other actions likely better)
        } else {
          return 5; // Already have 2+ royals - low priority
        }
      }
      return 2; // Can't use it
    }

    // Soldier cards - evaluate based on action PRIORITY
    let score = 0;

    // Check for URGENT actions first
    
    // Fortify castle that has royals but no fortification - URGENT
    const primaryHasRoyals = this.player.primaryCastle.royalFamily.length > 0;
    const allianceHasRoyals = this.player.allianceCastle.isActive && this.player.allianceCastle.royalFamily.length > 0;
    
    if (card.suit === this.player.primarySuit && primaryHasRoyals && !this.player.primaryCastle.fortification) {
      score = Math.max(score, 25 + value * 0.3); // URGENT: protect royals!
    }
    if (card.suit === this.player.allianceSuit && allianceHasRoyals && !this.player.allianceCastle.fortification) {
      score = Math.max(score, 25 + value * 0.3); // URGENT: protect royals!
    }
    
    // Repair damaged fortification on castle with royals - URGENT
    if (card.suit === this.player.primarySuit && primaryHasRoyals && 
        this.player.primaryCastle.fortificationDamage?.length > 0) {
      score = Math.max(score, 24);
    }
    if (card.suit === this.player.allianceSuit && allianceHasRoyals &&
        this.player.allianceCastle.fortificationDamage?.length > 0) {
      score = Math.max(score, 24);
    }

    // Persuade to activate alliance - very good
    if (card.suit === this.player.allianceSuit && !this.player.allianceCastle.isActive) {
      const currentPersuasion = this.player.allianceCastle.netPersuasion;
      if (currentPersuasion + value >= 20) {
        score = Math.max(score, 30); // Would activate alliance!
      } else {
        score = Math.max(score, 14 + value * 0.5);
      }
    }

    // Fortify castle without royals - prepares for safe royal placement
    // Should beat deck gamble (base 10) for reasonable cards
    if (card.suit === this.player.primarySuit && !primaryHasRoyals) {
      score = Math.max(score, 11 + value * 0.3);
    }
    if (card.suit === this.player.allianceSuit && this.player.allianceCastle.isActive && !allianceHasRoyals) {
      score = Math.max(score, 11 + value * 0.3);
    }

    // Attack/raid potential - check if we can do PERMANENT DAMAGE
    // Once a castle is activated, its soldiers can fight even if castle is destroyed
    const attackingCastle = this.player.getCastleBySuit(card.suit);
    if (attackingCastle && attackingCastle.isActive) {
      const hasRoyalsToAttack = attackingCastle.royalFamily.length > 0;
      
      // Check enemy castles we could attack with this suit
      for (const enemyCastle of this.opponent.allCastles) {
        if (enemyCastle.destroyed || !enemyCastle.isActive) continue;
        
        if (!enemyCastle.fortification) {
          // Unfortified enemy castle - RAID potential!
          if (hasRoyalsToAttack) {
            // We can do PERMANENT DAMAGE - very high priority!
            const enemyHasRoyals = enemyCastle.royalFamily.length > 0;
            if (enemyHasRoyals) {
              // Can raid AND potentially kill/capture their royal
              score = Math.max(score, 28);
            } else {
              // Can raid for permanent damage
              score = Math.max(score, 26);
            }
          } else {
            // Raid without permanent damage - can still harass
            score = Math.max(score, 12);
          }
        } else {
          // Has fortification - battle potential
          const fortStrength = enemyCastle.fortificationStrength || 0;
          if (value >= fortStrength) {
            // Can break their fortification!
            score = Math.max(score, 18);
          } else {
            // Chip damage
            score = Math.max(score, 6);
          }
        }
      }
    }

    return Math.max(score, 1);
  }
  
  // Evaluate how valuable a card is FOR THE OPPONENT (used for covering decisions)
  evaluateCardForOpponent(card) {
    if (card.isJoker) return 0;
    
    const myRoyals = this.countMyRoyals();
    const enemyRoyals = this.countEnemyRoyals();
    
    if (card.isAssassin) {
      // Dangerous if opponent could kill MY royals
      if (myRoyals > 0) {
        return 20 + (myRoyals * 5); // Very dangerous!
      }
      return 1; // Can't hurt me
    }
    
    if (card.isRoyal) {
      // Check if opponent has matching active castle
      const enemyCastle = this.opponent.getCastleBySuit(card.suit);
      if (enemyCastle && enemyCastle.isActive && !enemyCastle.destroyed) {
        return 15; // They could place this royal
      }
      return 2;
    }
    
    // Soldier cards
    const value = card.numericValue;
    let score = 0;
    
    // Check opponent's persuasion progress
    if (card.suit === this.opponent.allianceSuit && !this.opponent.allianceCastle.isActive) {
      const enemyPersuasion = this.opponent.allianceCastle.netPersuasion;
      if (enemyPersuasion + value >= 20) {
        return 25; // Would let them activate alliance!
      }
      score = Math.max(score, value + 10);
    }
    
    // Good for their primary suit actions
    if (card.suit === this.opponent.primarySuit) {
      score = Math.max(score, value + 6);
    }
    
    // Good for their active alliance
    if (card.suit === this.opponent.allianceSuit && this.opponent.allianceCastle.isActive) {
      score = Math.max(score, value + 4);
    }
    
    return Math.max(score, 1);
  }

  countMyRoyals() {
    let count = 0;
    for (const castle of this.player.allCastles) {
      count += castle.royalFamily.length;
    }
    return count;
  }

  countEnemyRoyals() {
    let count = 0;
    for (const castle of this.opponent.allCastles) {
      count += castle.royalFamily.length;
    }
    return count;
  }

  // Decide which action to take
  async decideAction() {
    await this.delay(this.thinkingDelay / 2);

    const actions = this.game.getAvailableActions();
    const enabledActions = actions.filter(a => a.enabled !== false);

    if (enabledActions.length === 0) return;

    // Score each action with mood modifiers and variance
    const scoredActions = enabledActions.map(action => {
      let score = this.scoreAction(action);
      score = this.applyMoodModifier(action.type, score); // Apply mood
      score = this.addVariance(score); // Add randomness
      return { action, score };
    });

    // Use weighted random selection from similar options
    const chosen = this.pickFromSimilarOptions(scoredActions);
    
    if (!chosen || chosen.score <= 0) {
      // Field the card if nothing good to do
      const fieldAction = enabledActions.find(a => a.type === 'field');
      if (fieldAction) {
        this.executeAction(fieldAction);
        return;
      }
    }

    // Track for mood system
    this.lastAction = chosen.action.type;
    if (['raid', 'battle', 'assassinate'].includes(chosen.action.type)) {
      this.turnsSinceAttack = 0;
    } else {
      this.turnsSinceAttack++;
    }

    this.executeAction(chosen.action);
  }

  scoreAction(action) {
    const card = this.game.drawnCard;
    const isLastTurn = this.game.currentTurnIndex >= this.game.turnsPerRound;

    switch (action.type) {
      case 'field': {
        // Field is fallback, but might have strategic cover value
        let bestCoverValue = 0;
        let hasAssassinOnField = false;
        let hasDesirableRoyalOnField = false;
        
        for (let i = 0; i < 3; i++) {
          const pile = this.game.fieldPiles[i];
          if (pile.length > 0) {
            const topCard = pile[pile.length - 1];
            const coverVal = this.evaluateCardForOpponent(topCard);
            bestCoverValue = Math.max(bestCoverValue, coverVal);
            
            // Track if there's an assassin we could cover
            if (topCard.value === '2') {
              hasAssassinOnField = true;
            }
            
            // Track if there's a royal we'd want for ourselves
            if (topCard.isRoyal) {
              const ourCastle = this.player.getCastleBySuit(topCard.suit);
              if (ourCastle && ourCastle.isActive && !ourCastle.destroyed) {
                hasDesirableRoyalOnField = true;
              }
            }
          }
        }
        
        let score = 1 + bestCoverValue * 0.3;
        
        // STRATEGIC PLAY: If there's both an assassin AND a royal we want on the field,
        // covering the assassin first is smart - makes it safe to grab the royal next turn!
        if (hasAssassinOnField && hasDesirableRoyalOnField) {
          score += 12; // Boost field action to set up the safe royal grab
        }
        
        if (isLastTurn) score *= 0.1;
        return Math.min(score, 20); // Cap raised to allow strategic plays
      }

      case 'bring-to-power': {
        const castle = action.castle;
        const existingRoyals = castle ? castle.royalFamily.length : 0;
        const hasFortification = castle?.fortification !== null;
        
        // Base score depends on how many royals already in castle
        let score;
        if (existingRoyals === 0) {
          // FIRST royal in this castle - high priority to establish presence
          score = 22;
        } else if (existingRoyals === 1) {
          // Second royal - medium priority
          score = 12;
        } else {
          // Already have 2+ royals - low priority, do other things first
          score = 6;
        }
        
        // BONUS for placing in fortified castle - royal is protected!
        if (hasFortification) {
          score += 8;
        }
        // HEAVY PENALTY for placing in unfortified castle when assassin is visible
        // (Opponent could grab the assassin and kill the royal immediately!)
        else {
          const fieldHasAssassin = this.game.fieldPiles.some(pile => 
            pile.length > 0 && pile[pile.length - 1].value === '2'
          );
          if (fieldHasAssassin) {
            // Reduce score dramatically - should fortify first if possible!
            // First royal: 22 - 18 = 4, Second: 12 - 18 = -6, Third: 6 - 18 = -12
            score -= 18;
          }
        }
        
        return score;
      }

      case 'assassinate': {
        // Check how devastating this would be
        const targetCastle = action.targets?.[0]?.castle;
        const enemyTotalRoyals = this.countEnemyRoyals();
        
        if (enemyTotalRoyals === 1) {
          // This could WIN THE GAME if it's their last royal in a key castle!
          return 50;
        } else if (enemyTotalRoyals === 2) {
          return 35;
        }
        // Still good, but not game-ending
        return 28;
      }

      case 'persuade': {
        const currentPersuasion = this.player.allianceCastle.netPersuasion;
        if (currentPersuasion + card.numericValue >= 20) {
          // Will ACTIVATE alliance - huge!
          return 40;
        }
        // Progress toward activation - medium priority
        return 14 + (card.numericValue * 0.5);
      }

      case 'threaten': {
        const enemyPersuasion = this.opponent.allianceCastle.netPersuasion;
        if (enemyPersuasion >= 15) {
          // They're close to activating - disrupt them!
          return 20;
        } else if (enemyPersuasion >= 10) {
          return 12;
        }
        // Low priority if they're not close
        return 5;
      }

      case 'fortify': {
        const castle = action.castle;
        const hasRoyals = castle && castle.royalFamily.length > 0;
        
        if (hasRoyals) {
          // URGENT: Protect our royals!
          return 25 + (card.numericValue * 0.3);
        }
        // No royals yet - lower priority
        return 10 + (card.numericValue * 0.2);
      }

      case 'upgrade-fortification': {
        const castle = action.castle;
        const hasRoyals = castle && castle.royalFamily.length > 0;
        
        if (hasRoyals) {
          return 18 + (card.numericValue * 0.2);
        }
        return 8;
      }

      case 'repair-fortification': {
        const castle = action.castle;
        const hasRoyals = castle && castle.royalFamily.length > 0;
        const damageCount = castle ? castle.fortificationDamage.length : 0;
        
        if (hasRoyals && damageCount > 0) {
          // URGENT: Our royals are vulnerable!
          return 26 + (damageCount * 2);
        }
        return 10;
      }

      case 'battle': {
        const targetCastle = action.castle;
        const fortStrength = targetCastle?.fortificationStrength || 0;
        const willBreak = card.numericValue >= fortStrength;
        const enemyHasRoyals = targetCastle?.royalFamily.length > 0;
        
        if (willBreak && enemyHasRoyals) {
          // Breaking their defense when they have royals = very good
          return 24;
        } else if (willBreak) {
          return 18;
        }
        // Chip damage - meh
        return 6;
      }

      case 'raid': {
        // Raid with damage potential (we have royals in attacking castle)
        const targetCastle = action.castle;
        const attackingCastle = action.attackingCastle;
        const enemyHasRoyals = targetCastle?.royalFamily.length > 0;
        const ourRoyals = attackingCastle?.royalFamily.length || 0;
        
        // Base high priority - we can deal permanent damage
        let score = 30;
        
        // Even better if we can capture/kill their royals
        if (enemyHasRoyals) {
          score += 8;
        }
        
        // Slightly less valuable if we might lose our royal in the raid
        if (ourRoyals === 1) {
          score -= 5; // Risk of losing our only royal
        }
        
        return score;
      }

      case 'raid-no-damage': {
        // Raid without permanent damage means we have NO royals in attacking castle
        // Without our own royals, we CANNOT kidnap/kill enemy royals either!
        // This action is completely useless - just discards our card
        // It should NEVER be chosen over 'field' which at least can cover opponent's cards
        return -10;
      }

      default:
        return 0;
    }
  }

  executeAction(action) {
    switch (action.type) {
      case 'field':
        // Will trigger field-select phase
        this.game.phase = 'field-select';
        break;
      case 'assassinate':
        // Pick the highest value royal to kill
        if (action.targets && action.targets.length > 0) {
          const target = action.targets.reduce((best, t) => 
            ROYAL_HIERARCHY[t.royal.value] > ROYAL_HIERARCHY[best.royal.value] ? t : best
          );
          this.game.executeAction('assassinate', target);
        }
        break;
      case 'bring-to-power':
        this.game.executeAction('bring-to-power', action.castle);
        break;
      case 'persuade':
      case 'threaten':
        this.game.executeAction(action.type);
        break;
      case 'fortify':
      case 'upgrade-fortification':
      case 'repair-fortification':
      case 'battle':
        this.game.executeAction(action.type, action.castle);
        break;
      case 'raid':
        this.game.executeAction('raid', action.castle, action.attackingCastle);
        break;
      case 'raid-no-damage':
        this.game.executeAction('raid-no-damage', action.castle);
        break;
    }
  }

  // Decide which field pile to place card on
  async decideFieldPile() {
    await this.delay(this.thinkingDelay / 2);
    
    // Check if it's the last turn of the round - covering is less valuable
    // because the next flop will cover everything anyway
    const isLastTurn = this.game.currentTurnIndex >= this.game.turnsPerRound;
    
    // Check for strategic situation: assassin + desirable royal both on field
    let hasDesirableRoyal = false;
    let assassinPileIndex = -1;
    
    for (let i = 0; i < 3; i++) {
      const pile = this.game.fieldPiles[i];
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        if (topCard.value === '2') {
          assassinPileIndex = i;
        }
        if (topCard.isRoyal) {
          const ourCastle = this.player.getCastleBySuit(topCard.suit);
          if (ourCastle && ourCastle.isActive && !ourCastle.destroyed) {
            hasDesirableRoyal = true;
          }
        }
      }
    }
    
    // STRATEGIC: If there's a royal we want AND an assassin, cover the assassin!
    if (hasDesirableRoyal && assassinPileIndex >= 0 && !isLastTurn) {
      this.game.phase = 'action';
      this.game.executeAction('field', assassinPileIndex);
      return;
    }
    
    // Evaluate each pile for "cover value" - how much we hurt opponent by covering it
    const pileOptions = [];
    
    for (let i = 0; i < 3; i++) {
      const pile = this.game.fieldPiles[i];
      let coverValue = 0;
      
      if (pile.length > 0) {
        const topCard = pile[pile.length - 1];
        // How valuable is this card to our opponent?
        coverValue = this.evaluateCardForOpponent(topCard);
      }
      
      // If it's the last turn, covering is nearly pointless
      if (isLastTurn) {
        coverValue *= 0.1; // Drastically reduce cover value
      }
      
      pileOptions.push({ index: i, coverValue, size: pile.length });
    }
    
    // Sort by cover value (highest = best pile to cover)
    pileOptions.sort((a, b) => {
      // Primary: cover value
      if (b.coverValue !== a.coverValue) {
        return b.coverValue - a.coverValue;
      }
      // Tiebreaker: prefer piles with more cards (bury our card deeper)
      return b.size - a.size;
    });
    
    const targetPile = pileOptions[0].index;
    
    this.game.phase = 'action';
    this.game.executeAction('field', targetPile);
  }

  // Decide raid choice (damage is already applied when raid starts)
  async decideRaidChoice() {
    await this.delay(this.thinkingDelay / 2);

    const options = this.game.getRaidOptions();
    if (options.length === 0) return;

    // Priority: kill > kidnap > rescue > skip
    // (Killing is better than kidnapping since killed royals are permanently gone)
    const killOption = options.find(o => o.type === 'kill');
    const kidnapOption = options.find(o => o.type === 'kidnap');
    const rescueOption = options.find(o => o.type === 'rescue');

    if (killOption) {
      // Kill the highest rank royal
      const killOptions = options.filter(o => o.type === 'kill');
      const best = killOptions.reduce((a, b) => 
        ROYAL_HIERARCHY[a.target.value] > ROYAL_HIERARCHY[b.target.value] ? a : b
      );
      this.game.executeRaidChoice('kill', best.target);
    } else if (rescueOption) {
      // Rescue our imprisoned royal!
      this.game.executeRaidChoice('rescue');
    } else if (kidnapOption) {
      // Kidnap the highest rank royal (less preferred than kill)
      const kidnapOptions = options.filter(o => o.type === 'kidnap');
      const best = kidnapOptions.reduce((a, b) => 
        ROYAL_HIERARCHY[a.target.value] > ROYAL_HIERARCHY[b.target.value] ? a : b
      );
      this.game.executeRaidChoice('kidnap', best.target);
    } else {
      // Skip if no beneficial action
      this.game.executeRaidChoice('skip');
    }
  }

  // Decide which royal to sacrifice to assassin
  async decideAssassinSurprise() {
    await this.delay(this.thinkingDelay / 2);

    const royals = this.game.getOwnRoyals();
    
    if (royals.length === 0) {
      this.game.executeAssassinSurprise(null, null);
      return;
    }

    // Sacrifice the lowest rank royal
    const lowest = royals.reduce((a, b) => 
      ROYAL_HIERARCHY[a.royal.value] < ROYAL_HIERARCHY[b.royal.value] ? a : b
    );

    this.game.executeAssassinSurprise(lowest.royal, lowest.castle);
  }
}

// Export for use in UI
window.GameState = GameState;
window.Card = Card;
window.AIPlayer = AIPlayer;
window.SUITS = SUITS;
window.SUIT_NAMES = SUIT_NAMES;
window.SUIT_COLORS = SUIT_COLORS;
