// Royal Family Card Game - UI Controller

class GameUI {
  constructor() {
    this.game = new GameState();
    this.ai = null;
    this.vsAI = false;
    this.aiTurnInProgress = false;
    this.bindElements();
    this.bindEvents();
    this.showScreen('title-screen');
  }

  bindElements() {
    // Screens
    this.screens = {
      title: document.getElementById('title-screen'),
      rules: document.getElementById('rules-screen'),
      game: document.getElementById('game-screen')
    };

    // Title screen - mode selection
    this.vsAIBtn = document.getElementById('vs-ai-btn');
    this.vsPlayerBtn = document.getElementById('vs-player-btn');
    this.rulesBtn = document.getElementById('rules-btn');
    this.backToTitleBtn = document.getElementById('back-to-title');

    // Game elements
    this.deckEl = document.getElementById('deck');
    this.deckCountEl = document.getElementById('deck-count');
    this.fieldPiles = [
      document.getElementById('field-pile-0'),
      document.getElementById('field-pile-1'),
      document.getElementById('field-pile-2')
    ];
    this.jokerSlot = document.getElementById('joker-slot');
    this.ageIndicator = document.getElementById('age-indicator');
    this.roundNumber = document.getElementById('round-number');
    this.turnInfo = document.getElementById('turn-info');

    // Player areas
    this.player1Area = document.getElementById('player1-area');
    this.player2Area = document.getElementById('player2-area');
    this.player1Indicator = document.getElementById('player1-indicator');
    this.player2Indicator = document.getElementById('player2-indicator');

    // Action area
    this.drawnCardSlot = document.getElementById('drawn-card-slot');
    this.actionsPanel = document.getElementById('actions-panel');
    this.actionsList = document.getElementById('actions-list');

    // Log
    this.logContent = document.getElementById('log-content');

    // Game over
    this.gameOverOverlay = document.getElementById('game-over-overlay');
    this.winnerText = document.getElementById('winner-text');
    this.winnerName = document.getElementById('winner-name');
    this.playAgainBtn = document.getElementById('play-again-btn');
    this.returnTitleBtn = document.getElementById('return-title-btn');
  }

  bindEvents() {
    // Title screen - mode selection
    if (this.vsAIBtn) this.vsAIBtn.addEventListener('click', () => this.startGame(true));
    if (this.vsPlayerBtn) this.vsPlayerBtn.addEventListener('click', () => this.startGame(false));
    if (this.rulesBtn) this.rulesBtn.addEventListener('click', () => this.showScreen('rules-screen'));
    if (this.backToTitleBtn) this.backToTitleBtn.addEventListener('click', () => this.showScreen('title-screen'));

    // Deck click
    this.deckEl.addEventListener('click', () => this.handleDeckClick());

    // Field pile clicks
    this.fieldPiles.forEach((pile, index) => {
      pile.addEventListener('click', () => this.handleFieldClick(index));
    });

    // Game over buttons
    this.playAgainBtn.addEventListener('click', () => this.startGame(this.vsAI));
    this.returnTitleBtn.addEventListener('click', () => {
      this.gameOverOverlay.classList.remove('active');
      this.showScreen('title-screen');
    });
  }

  showScreen(screenId) {
    Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  startGame(vsAI = false) {
    this.game.reset();
    this.vsAI = vsAI;
    this.aiTurnInProgress = false;

    if (vsAI) {
      // AI controls player 2 (The Scarlett - Red)
      this.ai = new AIPlayer(this.game, 2);
      this.game.player2.name = 'The Crown'; // AI name
    } else {
      this.ai = null;
    }

    this.gameOverOverlay.classList.remove('active');
    this.showScreen('game-screen');
    this.game.startGame();
    this.render();

    // Check if AI should take first turn
    this.checkAITurn();
  }

  // Card rendering
  createCardElement(card, options = {}) {
    const cardEl = document.createElement('div');
    cardEl.className = `card ${card.color || ''}`;
    
    if (options.faceDown) {
      cardEl.classList.add('face-down');
      cardEl.innerHTML = `
        <div class="card-back">
          <div class="card-back-pattern"></div>
        </div>
      `;
      return cardEl;
    }

    if (card.isJoker) {
      cardEl.innerHTML = `
        <div class="card-corner">
          <span class="card-value">🃏</span>
        </div>
        <div class="card-center">🃏</div>
        <div class="card-corner bottom">
          <span class="card-value">🃏</span>
        </div>
      `;
      cardEl.style.background = 'linear-gradient(135deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)';
      cardEl.style.color = '#fff';
      return cardEl;
    }

    // Assassin cards (2s) - deadly inverted foil look
    if (card.isAssassin) {
      cardEl.classList.add('assassin');
      cardEl.classList.remove('red', 'black'); // Remove color class
      cardEl.innerHTML = `
        <div class="card-corner">
          <span class="card-value">2</span>
          <span class="card-suit">${card.suit}</span>
        </div>
        <div class="card-center">
          <span class="assassin-icon">🗡️</span>
        </div>
        <div class="card-corner bottom">
          <span class="card-value">2</span>
          <span class="card-suit">${card.suit}</span>
        </div>
      `;
      return cardEl;
    }

    if (options.inactive) {
      cardEl.classList.add('inactive');
    }

    if (options.clickable) {
      cardEl.classList.add('clickable');
    }

    cardEl.innerHTML = `
      <div class="card-corner">
        <span class="card-value">${card.displayValue}</span>
        <span class="card-suit">${card.suit}</span>
      </div>
      <div class="card-center">${card.suit}</div>
      <div class="card-corner bottom">
        <span class="card-value">${card.displayValue}</span>
        <span class="card-suit">${card.suit}</span>
      </div>
    `;

    return cardEl;
  }

  createMiniCard(card, type = 'normal') {
    const mini = document.createElement('div');
    mini.className = `mini-card ${card.color} ${type}`;
    mini.textContent = `${card.displayValue}`;
    mini.title = `${card.displayValue}${card.suit}`;
    return mini;
  }

  // Main render function
  render() {
    this.renderField();
    this.renderPlayers();
    this.renderGameInfo();
    this.renderActionArea();
    this.renderLog();
    this.updatePhaseClass();

    // Check for game over
    if (this.game.phase === 'gameOver') {
      this.showGameOver();
      return;
    }

    // Check if AI should take a turn
    this.checkAITurn();
  }

  // Check if it's the AI's turn and trigger it
  async checkAITurn() {
    if (!this.vsAI || !this.ai) return;
    if (this.aiTurnInProgress) return;
    if (this.game.phase === 'gameOver') return;
    if (this.game.phase === 'flop') return; // Wait for human to click next round
    
    if (this.ai.isMyTurn()) {
      this.aiTurnInProgress = true;
      
      // Show thinking indicator
      this.showAIThinking(true);
      
      await this.ai.takeTurn();
      
      this.showAIThinking(false);
      this.aiTurnInProgress = false;
      
      // Re-render after AI action
      this.render();
    }
  }

  showAIThinking(isThinking) {
    const indicator = document.getElementById('player2-indicator');
    if (indicator) {
      indicator.classList.toggle('thinking', isThinking);
    }
  }

  updatePhaseClass() {
    const gameScreen = document.getElementById('game-screen');
    gameScreen.className = `screen active phase-${this.game.phase}`;
  }

  renderField() {
    // Deck
    this.deckCountEl.textContent = this.game.deck.length;
    this.deckEl.style.opacity = this.game.deck.length > 0 ? 1 : 0.3;

    // Field piles
    this.fieldPiles.forEach((pileEl, index) => {
      const pileCards = pileEl.querySelector('.pile-cards');
      pileCards.innerHTML = '';
      
      const pile = this.game.fieldPiles[index];
      if (pile.length > 0) {
        // Show top card
        const topCard = pile[pile.length - 1];
        const cardEl = this.createCardElement(topCard, {
          clickable: this.game.phase === 'draw'
        });
        
        // Show pile count if > 1
        if (pile.length > 1) {
          const countBadge = document.createElement('div');
          countBadge.className = 'pile-count';
          countBadge.textContent = pile.length;
          countBadge.style.cssText = `
            position: absolute;
            bottom: -8px;
            right: -8px;
            background: var(--gold);
            color: var(--bg-dark);
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 0.7rem;
            font-weight: bold;
          `;
          cardEl.appendChild(countBadge);
        }
        
        pileCards.appendChild(cardEl);
      }
    });

    // Joker
    this.jokerSlot.innerHTML = '';
    if (this.game.jokerInPlay) {
      const jokerEl = this.createCardElement(this.game.jokerInPlay);
      this.jokerSlot.appendChild(jokerEl);
    }
  }

  renderPlayers() {
    this.renderPlayerCastles(this.game.player1, 'p1');
    this.renderPlayerCastles(this.game.player2, 'p2');

    // Update player names
    const p1Name = this.player1Area.querySelector('.player-name');
    const p2Name = this.player2Area.querySelector('.player-name');
    if (p1Name) p1Name.textContent = this.game.player1.name;
    if (p2Name) {
      // Show AI name with mood indicator
      if (this.vsAI && this.ai) {
        const moodEmoji = this.ai.moodEmoji;
        p2Name.innerHTML = `${this.game.player2.name} <span class="ai-badge">🤖</span> <span class="ai-mood" title="Current mood: ${this.ai.mood}">${moodEmoji}</span>`;
      } else {
        p2Name.textContent = this.game.player2.name;
      }
    }

    // Active player indicators
    const isP1Active = this.game.currentPlayer === 1;
    this.player1Area.classList.toggle('active', isP1Active);
    this.player2Area.classList.toggle('active', !isP1Active && this.game.currentPlayer === 2);
    this.player1Indicator.classList.toggle('active', isP1Active);
    this.player2Indicator.classList.toggle('active', !isP1Active && this.game.currentPlayer === 2);
  }

  renderPlayerCastles(player, prefix) {
    // Primary castle
    this.renderCastle(player.primaryCastle, `${prefix}-primary`, false);
    
    // Alliance castle
    this.renderCastle(player.allianceCastle, `${prefix}-alliance`, true);
  }

  renderCastle(castle, prefix, isAlliance) {
    const container = document.getElementById(`${prefix}-castle`);
    const aceSlot = document.getElementById(`${prefix}-ace`);
    const royalsSlot = document.getElementById(`${prefix}-royals`);
    const fortSlot = document.getElementById(`${prefix}-fort`);
    const dungeonSlot = document.getElementById(`${prefix}-dungeon`);
    const damageTrack = document.getElementById(`${prefix}-damage`);
    const statsEl = document.getElementById(`${prefix}-stats`);

    // Handle destroyed castles
    if (castle.destroyed) {
      container.classList.add('destroyed');
      aceSlot.innerHTML = '<div class="card" style="opacity:0.3;background:#333;"></div>';
      royalsSlot.innerHTML = '';
      fortSlot.innerHTML = '';
      dungeonSlot.innerHTML = '';
      damageTrack.innerHTML = '';
      statsEl.textContent = 'DESTROYED';
      return;
    }

    container.classList.remove('destroyed');

    // Ace card
    aceSlot.innerHTML = '';
    const aceEl = this.createCardElement(castle.aceCard, {
      faceDown: !castle.isActive,
      inactive: !castle.isActive
    });
    aceSlot.appendChild(aceEl);

    // Royal family
    royalsSlot.innerHTML = '';
    castle.royalFamily.forEach(royal => {
      const royalEl = this.createCardElement(royal);
      royalsSlot.appendChild(royalEl);
    });

    // Fortification
    fortSlot.innerHTML = '';
    if (castle.fortification) {
      const fortEl = this.createCardElement(castle.fortification);
      fortEl.style.transform = 'rotate(90deg)';
      fortEl.title = `Fortification: ${castle.fortificationStrength}/${castle.fortification.numericValue}`;
      fortSlot.appendChild(fortEl);
      
      // Show damage on fortification
      if (castle.fortificationDamage.length > 0) {
        const dmgBadge = document.createElement('div');
        dmgBadge.style.cssText = `
          position: absolute;
          top: -10px;
          right: -10px;
          background: #cc0000;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 0.7rem;
        `;
        const totalDmg = castle.fortificationDamage.reduce((sum, c) => sum + c.numericValue, 0);
        dmgBadge.textContent = `-${totalDmg}`;
        fortSlot.appendChild(dmgBadge);
      }
    }

    // Dungeon (prisoner)
    dungeonSlot.innerHTML = '';
    if (castle.prisoner) {
      const prisonerEl = this.createCardElement(castle.prisoner);
      prisonerEl.style.opacity = '0.7';
      prisonerEl.title = `Prisoner: ${castle.prisoner.value}${castle.prisoner.suit}`;
      dungeonSlot.appendChild(prisonerEl);
    }

    // Damage track
    damageTrack.innerHTML = '';
    if (castle.isActive && castle.permanentDamage.length > 0) {
      castle.permanentDamage.forEach(card => {
        damageTrack.appendChild(this.createMiniCard(card));
      });
    }

    // Persuasion track (alliance only)
    if (isAlliance) {
      const persuasionTrack = document.getElementById(`${prefix}-persuasion`);
      persuasionTrack.innerHTML = '';
      
      if (!castle.isActive) {
        castle.persuasionCards.forEach(card => {
          persuasionTrack.appendChild(this.createMiniCard(card, 'persuasion'));
        });
        castle.threatCards.forEach(card => {
          persuasionTrack.appendChild(this.createMiniCard(card, 'threat'));
        });
      }
    }

    // Stats
    let statsText = '';
    if (castle.isActive) {
      if (castle.royalFamily.length > 0) {
        statsText = `Royals: ${castle.royalFamily.length}`;
      }
    } else if (isAlliance) {
      if (!castle.isActive) {
        statsText = 'Inactive';
      }
    } else {
      statsText = 'Active';
    }
    statsEl.textContent = statsText;
    
    // Health bar (always show for active castles)
    const healthContainer = document.getElementById(`${prefix}-health`);
    if (healthContainer) {
      const damage = castle.isActive ? castle.totalDamage : 0;
      const hp = Math.max(0, 20 - damage);
      const hpPercent = (hp / 20) * 100;
      
      const fill = healthContainer.querySelector('.health-bar-fill');
      const text = healthContainer.querySelector('.health-bar-text');
      
      fill.style.width = `${hpPercent}%`;
      fill.classList.remove('critical', 'warning');
      if (hp <= 5) {
        fill.classList.add('critical');
      } else if (hp <= 10) {
        fill.classList.add('warning');
      }
      
      text.textContent = `${hp}/20`;
      
      // Hide health bar for inactive alliance castles
      healthContainer.style.display = castle.isActive || !isAlliance ? 'flex' : 'none';
    }
    
    // Persuasion bar (alliance only)
    if (isAlliance) {
      const persuasionContainer = document.getElementById(`${prefix}-persuasion-bar`);
      if (persuasionContainer) {
        const net = castle.netPersuasion;
        const persuasion = Math.max(0, net);
        const persuasionPercent = Math.min(100, (persuasion / 20) * 100);
        
        const fill = persuasionContainer.querySelector('.persuasion-bar-fill');
        const text = persuasionContainer.querySelector('.persuasion-bar-text');
        
        fill.style.width = `${persuasionPercent}%`;
        fill.classList.remove('active', 'close');
        if (castle.isActive) {
          fill.classList.add('active');
        } else if (persuasion >= 15) {
          fill.classList.add('close');
        }
        
        text.textContent = castle.isActive ? 'ACTIVE!' : `${persuasion}/20`;
        
        // Add threat indicator
        if (castle.totalThreats > 0 && !castle.isActive) {
          text.textContent += ` (-${castle.totalThreats})`;
        }
      }
    }
  }

  renderGameInfo() {
    // Age indicator
    const isOppression = this.game.currentAge === 'oppression';
    this.ageIndicator.classList.toggle('oppression', isOppression);
    this.ageIndicator.querySelector('.age-icon').textContent = isOppression ? '🌙' : '☀️';
    this.ageIndicator.querySelector('.age-text').textContent = 
      isOppression ? 'Age of Oppression' : 'Age of Uprising';

    // Round and turn
    this.roundNumber.textContent = `Round ${this.game.roundNumber}`;
    this.turnInfo.textContent = `Turn ${this.game.currentTurnIndex + 1}/3`;
  }

  renderActionArea() {
    // Drawn card
    this.drawnCardSlot.innerHTML = '';
    if (this.game.drawnCard) {
      const cardEl = this.createCardElement(this.game.drawnCard);
      this.drawnCardSlot.appendChild(cardEl);
    }

    // Actions
    this.actionsList.innerHTML = '';
    
    if (this.game.phase === 'draw') {
      this.actionsPanel.style.display = 'block';
      const instruction = document.createElement('div');
      instruction.className = 'action-instruction';
      instruction.style.cssText = 'color: var(--text-secondary); font-style: italic; padding: 8px 0;';
      instruction.textContent = 'Draw a card from the deck or field';
      this.actionsList.appendChild(instruction);
    } else if (this.game.phase === 'action') {
      this.actionsPanel.style.display = 'block';
      const actions = this.game.getAvailableActions();
      
      // Add cancel button if drawn from field
      if (this.game.canCancelDraw()) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'action-btn cancel-btn';
        cancelBtn.textContent = '← Put card back';
        cancelBtn.style.cssText = 'background: transparent; border-color: var(--text-muted); color: var(--text-muted); margin-bottom: 12px;';
        cancelBtn.addEventListener('click', () => {
          this.game.cancelDraw();
          this.render();
        });
        this.actionsList.appendChild(cancelBtn);
      }
      
      actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        
        // Handle disabled actions
        if (action.enabled === false) {
          btn.disabled = true;
          btn.classList.add('disabled');
          btn.textContent = action.label;
          btn.title = action.reason || 'Not available';
          
          // Add reason text below button
          const wrapper = document.createElement('div');
          wrapper.className = 'action-wrapper';
          wrapper.appendChild(btn);
          
          const reason = document.createElement('div');
          reason.className = 'action-reason';
          reason.textContent = action.reason;
          reason.style.cssText = 'font-size: 0.75rem; color: var(--text-muted); padding: 2px 8px 8px; font-style: italic;';
          wrapper.appendChild(reason);
          
          this.actionsList.appendChild(wrapper);
          return;
        }
        
        btn.textContent = action.label;
        
        if (action.type === 'field') {
          btn.classList.add('secondary');
        } else if (action.type === 'assassinate' || action.type === 'battle' || action.type === 'raid') {
          btn.classList.add('danger');
        } else {
          btn.classList.add('primary');
        }

        btn.addEventListener('click', () => this.handleAction(action));
        this.actionsList.appendChild(btn);
      });
    } else if (this.game.phase === 'field-select') {
      // Pile selection for field action
      this.actionsPanel.style.display = 'block';
      
      const title = document.createElement('div');
      title.style.cssText = 'color: var(--gold); margin-bottom: 8px;';
      title.textContent = 'Choose a pile to field the card:';
      this.actionsList.appendChild(title);
      
      for (let i = 0; i < 3; i++) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        const pileCount = this.game.fieldPiles[i].length;
        btn.textContent = `Field ${i + 1} (${pileCount} card${pileCount !== 1 ? 's' : ''})`;
        btn.addEventListener('click', async () => {
          this.game.phase = 'action'; // Reset phase

          // Animate card to field pile
          await this.animateCardToFieldPile(i);

          this.game.executeAction('field', i);
          this.render();
        });
        this.actionsList.appendChild(btn);
      }
      
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'action-btn';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = 'background: transparent; border-color: var(--text-muted); color: var(--text-muted); margin-top: 8px;';
      cancelBtn.addEventListener('click', () => {
        this.game.phase = 'action';
        this.render();
      });
      this.actionsList.appendChild(cancelBtn);
    } else if (this.game.phase === 'raid-choice') {
      this.actionsPanel.style.display = 'block';
      const options = this.game.getRaidOptions();
      
      const title = document.createElement('div');
      title.style.cssText = 'color: var(--gold); margin-bottom: 8px;';
      title.textContent = 'Choose raid action:';
      this.actionsList.appendChild(title);
      
      options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.textContent = option.label;
        
        if (option.type === 'kill' || option.type === 'kidnap') {
          btn.classList.add('danger');
        }
        
        btn.addEventListener('click', () => {
          this.game.executeRaidChoice(option.type, option.target);
          this.render();
        });
        this.actionsList.appendChild(btn);
      });
    } else if (this.game.phase === 'assassin-surprise') {
      this.actionsPanel.style.display = 'block';
      const royals = this.game.getOwnRoyals();
      
      const title = document.createElement('div');
      title.style.cssText = 'color: var(--red-light); margin-bottom: 8px;';
      title.textContent = '⚠️ Assassin attacks! Choose a royal to sacrifice:';
      this.actionsList.appendChild(title);
      
      if (royals.length === 0) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.textContent = 'No royals to sacrifice';
        btn.addEventListener('click', () => {
          this.game.executeAssassinSurprise(null, null);
          this.render();
        });
        this.actionsList.appendChild(btn);
      } else {
        royals.forEach(({ castle, royal }) => {
          const btn = document.createElement('button');
          btn.className = 'action-btn danger';
          btn.textContent = `Sacrifice ${royal.value}${royal.suit}`;
          btn.addEventListener('click', () => {
            this.game.executeAssassinSurprise(royal, castle);
            this.render();
          });
          this.actionsList.appendChild(btn);
        });
      }
    } else if (this.game.phase === 'flop') {
      this.actionsPanel.style.display = 'block';
      const btn = document.createElement('button');
      btn.className = 'action-btn primary';
      btn.textContent = 'Deal Next Round';
      btn.addEventListener('click', () => {
        this.game.nextRound();
        this.render();
      });
      this.actionsList.appendChild(btn);
    } else {
      this.actionsPanel.style.display = 'none';
    }
  }

  renderLog() {
    this.logContent.innerHTML = '';
    
    // Show last 15 messages
    const messages = this.game.messages.slice(-15);
    messages.forEach(msg => {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      
      // Highlight certain messages
      if (msg.text.includes('WINS') || msg.text.includes('DESTROYED')) {
        entry.classList.add('danger');
      } else if (msg.text.includes('═══') || msg.text.includes('---')) {
        entry.classList.add('highlight');
      }
      
      entry.textContent = msg.text;
      this.logContent.appendChild(entry);
    });
    
    // Scroll to bottom
    this.logContent.scrollTop = this.logContent.scrollHeight;
  }

  handleDeckClick() {
    if (this.game.phase !== 'draw') return;
    if (this.game.deck.length === 0) return;

    this.game.drawFromDeck();
    this.render();

    // Animate card draw with flip
    setTimeout(() => this.animateCardDrawFromDeck(), 50);
  }

  handleFieldClick(pileIndex) {
    if (this.game.phase !== 'draw') return;
    if (this.game.fieldPiles[pileIndex].length === 0) return;

    this.game.drawFromField(pileIndex);
    this.render();

    // Animate card draw from field
    setTimeout(() => this.animateCardDrawFromField(pileIndex), 50);
  }

  async handleAction(action) {
    switch (action.type) {
      case 'field':
        // Show pile selection
        this.game.phase = 'field-select';
        this.render();
        return;

      case 'persuade':
        const wasActive = this.game.getPlayer(this.game.currentPlayer).allianceCastle.isActive;
        const currentPlayer = this.game.getPlayer(this.game.currentPlayer);
        const allianceCastle = currentPlayer.allianceCastle;

        // Animate card to persuasion track
        await this.animateCardToPersuasionTrack(allianceCastle, currentPlayer);

        this.game.executeAction('persuade');
        const isNowActive = this.game.getPlayer(this.game.currentPlayer).allianceCastle.isActive;

        this.render();

        // Animate alliance activation if it just became active
        if (!wasActive && isNowActive) {
          setTimeout(() => {
            const player = this.game.getPlayer(this.game.currentPlayer);
            const castlePrefix = this.getCastlePrefix(player, player.allianceCastle);
            const castleEl = document.getElementById(`${castlePrefix}-castle`);
            if (castleEl) this.animateAllianceActivation(castleEl);
          }, 50);
        }
        return;

      case 'threaten':
        const opponent = this.game.getPlayer(this.game.currentPlayer === 1 ? 2 : 1);
        const opponentAlliance = opponent.allianceCastle;

        // Animate card to opponent's persuasion track
        await this.animateCardToPersuasionTrack(opponentAlliance, opponent);

        this.game.executeAction('threaten');
        break;

      case 'fortify':
      case 'upgrade-fortification':
      case 'repair-fortification':
        // Animate card to fortification
        await this.animateCardToFortification(action.castle);

        this.game.executeAction(action.type, action.castle);
        break;

      case 'battle':
        // Animate battle attack
        await this.animateCardToBattle(action.castle);

        this.game.executeAction('battle', action.castle);
        this.render();
        return;

      case 'raid':
        this.game.executeAction('raid', action.castle, action.attackingCastle);
        this.render();
        // Animate raid impact
        setTimeout(() => {
          const player = this.game.getPlayer(this.game.currentPlayer === 1 ? 2 : 1);
          const castlePrefix = this.getCastlePrefix(player, action.castle);
          const castleEl = document.getElementById(`${castlePrefix}-castle`);
          if (castleEl) this.animateCastleDamage(castleEl, true);
        }, 50);
        return;

      case 'raid-no-damage':
        this.game.executeAction('raid-no-damage', action.castle);
        break;

      case 'bring-to-power':
        // Animate royal to castle
        await this.animateCardToRoyalStack(action.castle);

        this.game.executeAction('bring-to-power', action.castle);
        this.render();

        // Animate royal entrance flourish
        setTimeout(() => {
          const player = this.game.getPlayer(this.game.currentPlayer);
          const castlePrefix = this.getCastlePrefix(player, action.castle);
          const royalsSlot = document.getElementById(`${castlePrefix}-royals`);
          const newRoyal = royalsSlot?.querySelector('.card:last-child');
          if (newRoyal) this.animateRoyalEntrance(newRoyal);
        }, 50);
        return;

      case 'assassinate':
        // Show target selection
        this.showTargetSelection(action.targets);
        return;
    }

    this.render();
  }

  // Helper to get castle prefix for animations
  getCastlePrefix(player, castle) {
    const prefix = player.id === 1 ? 'p1' : 'p2';
    const isAlliance = castle === player.allianceCastle;
    return `${prefix}-${isAlliance ? 'alliance' : 'primary'}`;
  }

  showTargetSelection(targets) {
    this.actionsList.innerHTML = '';

    const title = document.createElement('div');
    title.style.cssText = 'color: var(--gold); margin-bottom: 8px;';
    title.textContent = 'Select target to assassinate:';
    this.actionsList.appendChild(title);

    targets.forEach(target => {
      const btn = document.createElement('button');
      btn.className = 'action-btn danger';
      btn.textContent = `${target.royal.value}${target.royal.suit} in ${SUIT_NAMES[target.castle.suit]} castle`;
      btn.addEventListener('click', async () => {
        // Find the target royal element
        const targetPlayer = this.game.getPlayer(target.owner);
        const castlePrefix = this.getCastlePrefix(targetPlayer, target.castle);
        const royalsSlot = document.getElementById(`${castlePrefix}-royals`);

        // Find the specific royal card
        const royalCards = royalsSlot?.querySelectorAll('.card');
        let targetRoyalElement = null;
        if (royalCards) {
          for (const card of royalCards) {
            const valueText = card.querySelector('.card-value')?.textContent;
            const suitText = card.querySelector('.card-suit')?.textContent;
            if (valueText === target.royal.value && suitText === target.royal.suit) {
              targetRoyalElement = card;
              break;
            }
          }
        }

        // Animate assassin to target
        if (targetRoyalElement) {
          await this.animateAssassinToTarget(targetRoyalElement);
        }

        this.game.executeAction('assassinate', target);
        this.render();
      });
      this.actionsList.appendChild(btn);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'action-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this.render());
    this.actionsList.appendChild(cancelBtn);
  }

  showGameOver() {
    const winner = this.game.getPlayer(this.game.winner);
    const loser = this.game.getPlayer(this.game.winner === 1 ? 2 : 1);
    const playerWon = this.game.winner === 1;

    // Different messages based on who won
    if (this.vsAI) {
      if (playerWon) {
        this.winnerText.textContent = '👑 VICTORY! 👑';
        this.winnerName.innerHTML = `
          <span class="victory-message">You have defeated The Crown!</span>
          <br><span class="victory-subtitle">The realm bows to your might.</span>
        `;
        this.gameOverOverlay.classList.add('player-victory');
        this.gameOverOverlay.classList.remove('ai-victory');
      } else {
        this.winnerText.textContent = '💀 DEFEAT 💀';
        this.winnerName.innerHTML = `
          <span class="defeat-message">The Crown has crushed your rebellion!</span>
          <br><span class="defeat-subtitle">Your castles lie in ruin...</span>
        `;
        this.gameOverOverlay.classList.add('ai-victory');
        this.gameOverOverlay.classList.remove('player-victory');
      }
    } else {
      // Two player mode
      this.winnerText.textContent = '👑 VICTORY! 👑';
      this.winnerName.innerHTML = `
        <span class="victory-message">${winner.name} has conquered!</span>
        <br><span class="victory-subtitle">${loser.name}'s kingdom falls.</span>
      `;
      this.gameOverOverlay.classList.remove('player-victory', 'ai-victory');
    }

    this.gameOverOverlay.classList.add('active');
  }

  // ========== ANIMATION HELPERS ==========

  // Animate an element by adding a class and removing it after animation completes
  animateElement(element, animationClass, duration = 1000) {
    if (!element) return Promise.resolve();

    return new Promise((resolve) => {
      element.classList.add(animationClass);
      setTimeout(() => {
        element.classList.remove(animationClass);
        resolve();
      }, duration);
    });
  }

  // Animate card draw from deck
  animateCardDrawFromDeck() {
    const drawnCard = this.drawnCardSlot.querySelector('.card');
    if (drawnCard) {
      drawnCard.classList.add('card-slide-from-deck', 'card-flipping');
      setTimeout(() => {
        drawnCard.classList.remove('card-slide-from-deck', 'card-flipping');
      }, 600);
    }
  }

  // Animate card draw from field
  animateCardDrawFromField(pileIndex) {
    const drawnCard = this.drawnCardSlot.querySelector('.card');
    if (drawnCard) {
      drawnCard.classList.add('card-slide-from-field');
      setTimeout(() => {
        drawnCard.classList.remove('card-slide-from-field');
      }, 500);
    }
  }

  // Animate castle taking damage
  animateCastleDamage(castleElement, isRaid = false) {
    if (!castleElement) return;

    const animClass = isRaid ? 'castle-raid-impact' : 'castle-taking-damage';
    castleElement.classList.add(animClass, 'castle-damage-flash');

    setTimeout(() => {
      castleElement.classList.remove(animClass, 'castle-damage-flash');
    }, 800);
  }

  // Animate fortification taking damage
  animateFortificationBattle(fortElement) {
    if (!fortElement) return;

    fortElement.classList.add('fortification-battle');
    setTimeout(() => {
      fortElement.classList.remove('fortification-battle');
    }, 500);
  }

  // Animate royal entering castle
  animateRoyalEntrance(royalElement) {
    if (!royalElement) return;

    royalElement.classList.add('royal-entering');
    setTimeout(() => {
      royalElement.classList.remove('royal-entering');
    }, 700);
  }

  // Animate alliance activation
  animateAllianceActivation(castleElement) {
    if (!castleElement) return;

    castleElement.classList.add('alliance-activating');
    setTimeout(() => {
      castleElement.classList.remove('alliance-activating');
    }, 1000);
  }

  // Animate castle destruction
  animateCastleDestruction(castleElement) {
    if (!castleElement) return;

    castleElement.classList.add('castle-destroying');
    // Don't remove this class - it has 'forwards' in animation
  }

  // Animate number/stat change
  animateNumberChange(element) {
    if (!element) return;

    element.classList.add('number-pop');
    setTimeout(() => {
      element.classList.remove('number-pop');
    }, 400);
  }

  // Animate card moving from source to destination
  animateCardMovement(sourceElement, destinationElement, options = {}) {
    if (!sourceElement || !destinationElement) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Get positions
      const sourceRect = sourceElement.getBoundingClientRect();
      const destRect = destinationElement.getBoundingClientRect();

      // Create card clone
      const clone = sourceElement.cloneNode(true);
      clone.style.position = 'fixed';
      clone.style.left = `${sourceRect.left}px`;
      clone.style.top = `${sourceRect.top}px`;
      clone.style.width = `${sourceRect.width}px`;
      clone.style.height = `${sourceRect.height}px`;
      clone.style.zIndex = '1000';
      clone.style.pointerEvents = 'none';
      clone.style.transition = 'all 0.5s ease-out';

      document.body.appendChild(clone);

      // Animate after a frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          clone.style.left = `${destRect.left}px`;
          clone.style.top = `${destRect.top}px`;

          if (options.rotate) {
            clone.style.transform = 'rotate(90deg)';
          }

          if (options.scale) {
            clone.style.transform = (clone.style.transform || '') + ` scale(${options.scale})`;
          }

          if (options.fadeOut) {
            clone.style.opacity = '0';
          }
        });
      });

      // Clean up after animation
      setTimeout(() => {
        clone.remove();
        resolve();
      }, options.duration || 500);
    });
  }

  // Animate card to persuasion/threat track
  async animateCardToPersuasionTrack(targetCastle, targetPlayer) {
    const drawnCard = this.drawnCardSlot.querySelector('.card');
    if (!drawnCard) return;

    const castlePrefix = this.getCastlePrefix(targetPlayer, targetCastle);
    const trackElement = document.getElementById(`${castlePrefix}-persuasion-bar`);

    if (trackElement) {
      await this.animateCardMovement(drawnCard, trackElement, {
        scale: 0.4,
        duration: 400
      });
    }
  }

  // Animate card to fortification
  async animateCardToFortification(targetCastle) {
    const drawnCard = this.drawnCardSlot.querySelector('.card');
    if (!drawnCard) return;

    const player = this.game.getPlayer(this.game.currentPlayer);
    const castlePrefix = this.getCastlePrefix(player, targetCastle);
    const fortSlot = document.getElementById(`${castlePrefix}-fort`);

    if (fortSlot) {
      await this.animateCardMovement(drawnCard, fortSlot, {
        rotate: true,
        scale: 0.8,
        duration: 500
      });
    }
  }

  // Animate battle attack
  async animateCardToBattle(targetCastle) {
    const drawnCard = this.drawnCardSlot.querySelector('.card');
    if (!drawnCard) return;

    const opponent = this.game.getPlayer(this.game.currentPlayer === 1 ? 2 : 1);
    const castlePrefix = this.getCastlePrefix(opponent, targetCastle);
    const fortSlot = document.getElementById(`${castlePrefix}-fort`);

    if (fortSlot) {
      await this.animateCardMovement(drawnCard, fortSlot, {
        fadeOut: true,
        duration: 400
      });

      // Then animate fortification battle
      this.animateFortificationBattle(fortSlot);
    }
  }

  // Animate royal to castle
  async animateCardToRoyalStack(targetCastle) {
    const drawnCard = this.drawnCardSlot.querySelector('.card');
    if (!drawnCard) return;

    const player = this.game.getPlayer(this.game.currentPlayer);
    const castlePrefix = this.getCastlePrefix(player, targetCastle);
    const royalsSlot = document.getElementById(`${castlePrefix}-royals`);

    if (royalsSlot) {
      await this.animateCardMovement(drawnCard, royalsSlot, {
        duration: 500
      });
    }
  }

  // Animate assassin to target
  async animateAssassinToTarget(targetRoyalElement) {
    const drawnCard = this.drawnCardSlot.querySelector('.card');
    if (!drawnCard || !targetRoyalElement) return;

    await this.animateCardMovement(drawnCard, targetRoyalElement, {
      fadeOut: true,
      duration: 400
    });
  }

  // Animate card to field pile
  async animateCardToFieldPile(pileIndex) {
    const drawnCard = this.drawnCardSlot.querySelector('.card');
    if (!drawnCard) return;

    const fieldPile = this.fieldPiles[pileIndex];
    if (fieldPile) {
      await this.animateCardMovement(drawnCard, fieldPile, {
        scale: 0.9,
        duration: 400
      });
    }
  }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.gameUI = new GameUI();
});
