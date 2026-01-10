// Royal Family AI vs AI Simulation
// Run headless games to analyze AI decision-making

class GameSimulator {
  constructor(options = {}) {
    this.verbose = options.verbose ?? true;
    this.captureStates = options.captureStates ?? true;
    this.maxTurns = options.maxTurns ?? 500; // Safety limit
  }

  // Run a single simulation
  async runGame(seed = null) {
    const gameLog = [];
    const stateSnapshots = [];
    const decisions = [];
    
    // Create game
    const game = new GameState();
    
    // Override the log function to capture logs
    const originalLog = game.log.bind(game);
    game.log = (message) => {
      gameLog.push({ turn: game.turnNumber, round: game.roundNumber, message });
      if (this.verbose) console.log(`[R${game.roundNumber} T${game.turnNumber}] ${message}`);
    };
    
    // Create two AI players
    const ai1 = new AIPlayer(game, 1);
    const ai2 = new AIPlayer(game, 2);
    ai1.thinkingDelay = 0; // No delay for simulation
    ai2.thinkingDelay = 0;
    
    // Start game
    game.startGame();
    
    let turnCount = 0;
    
    // Main game loop - process one step at a time
    let stepCount = 0;
    const maxSteps = this.maxTurns * 10; // Allow for multiple phases per turn
    
    while (game.phase !== 'gameOver' && stepCount < maxSteps) {
      stepCount++;
      
      const currentAI = game.currentPlayer === 1 ? ai1 : ai2;
      const playerName = game.currentPlayer === 1 ? 'Player 1 (Black)' : 'Player 2 (Red)';
      const previousPhase = game.phase;
      
      switch (game.phase) {
        case 'flop':
          game.dealFlop();
          break;
          
        case 'draw':
          turnCount++;
          if (this.captureStates) {
            stateSnapshots.push(this.captureState(game, `Turn ${turnCount}: ${playerName}`));
          }
          await currentAI.decideDraw();
          break;
          
        case 'action':
          const decision = { 
            player: playerName, 
            turn: turnCount, 
            phase: 'action',
            mood: currentAI.mood,
            card: game.drawnCard ? `${game.drawnCard.displayValue}${game.drawnCard.suit || ''}` : null
          };
          
          const actions = game.getAvailableActions().filter(a => a.enabled !== false);
          decision.availableActions = actions.map(a => ({ type: a.type, score: currentAI.scoreAction(a) }));
          
          await currentAI.decideAction();
          decisions.push(decision);
          break;
          
        case 'field-select':
          await currentAI.decideFieldPile();
          break;
          
        case 'raid-choice':
          await currentAI.decideRaidChoice();
          break;
          
        case 'assassin-surprise':
          await currentAI.decideAssassinSurprise();
          break;
          
        default:
          // Unknown phase, break out
          console.warn('Unknown phase:', game.phase);
          break;
      }
      
      // If phase didn't change, something's stuck
      if (game.phase === previousPhase && game.phase !== 'flop' && game.phase !== 'gameOver') {
        console.warn(`Phase stuck at ${game.phase}, forcing advance`);
        if (game.phase === 'action' && game.drawnCard) {
          game.executeAction('field', 0);
        } else if (game.phase === 'draw') {
          game.drawFromDeck();
        } else {
          break; // Can't recover
        }
      }
    }
    
    // Final state
    if (this.captureStates) {
      stateSnapshots.push(this.captureState(game, 'Final State'));
    }
    
    // Determine winner
    const winner = game.winner ? game.getPlayer(game.winner) : null;
    
    return {
      winner: winner ? { id: game.winner, name: winner.name } : null,
      totalTurns: turnCount,
      totalRounds: game.roundNumber,
      log: gameLog,
      decisions,
      stateSnapshots,
      summary: this.generateSummary(game, gameLog, decisions)
    };
  }

  // Make AI decision and capture details
  async makeAIDecision(game, ai, playerName) {
    const decision = {
      player: playerName,
      turn: game.turnNumber,
      round: game.roundNumber,
      phase: game.phase,
      mood: ai.mood,
      moodEmoji: AIPlayer.MOOD_EMOJIS[ai.mood]
    };

    if (game.phase === 'draw') {
      // Capture field state
      decision.fieldCards = game.fieldPiles.map((pile, i) => 
        pile.length > 0 ? `${pile[pile.length - 1].displayValue}${pile[pile.length - 1].suit}` : 'empty'
      );
      
      // Evaluate options
      const fieldOptions = [];
      for (let i = 0; i < 3; i++) {
        const pile = game.fieldPiles[i];
        if (pile.length > 0) {
          const card = pile[pile.length - 1];
          const score = ai.evaluateCard(card);
          fieldOptions.push({ pile: i, card: `${card.displayValue}${card.suit}`, score });
        }
      }
      decision.fieldOptions = fieldOptions;
      
      // Let AI decide
      await ai.decideDraw();
      
      if (game.drawnCard) {
        decision.drewFrom = game.drawnFromDeck ? 'deck' : `field[${game.drawnFromPileIndex}]`;
        decision.drawnCard = `${game.drawnCard.displayValue}${game.drawnCard.suit || ''}`;
      }
    }
    
    if (game.phase === 'action') {
      const actions = game.getAvailableActions();
      const enabledActions = actions.filter(a => a.enabled !== false);
      
      // Score actions
      const scoredActions = enabledActions.map(action => ({
        type: action.type,
        label: action.label,
        score: ai.scoreAction(action)
      }));
      scoredActions.sort((a, b) => b.score - a.score);
      
      decision.availableActions = scoredActions.slice(0, 5); // Top 5
      
      await ai.decideAction();
      
      // The action was taken, check what happened
      decision.actionTaken = game.phase; // Will have changed if action was taken
    }
    
    // Handle other phases
    if (game.phase === 'field-select') {
      await ai.decideFieldPile();
    }
    
    if (game.phase === 'raid-choice') {
      decision.raidTarget = game.raidTarget ? SUIT_NAMES[game.raidTarget.suit] : null;
      await ai.decideRaidChoice();
    }
    
    if (game.phase === 'assassin-surprise') {
      await ai.decideAssassinSurprise();
    }

    return decision;
  }

  // Capture current game state
  captureState(game, label) {
    const state = {
      label,
      round: game.roundNumber,
      turn: game.turnNumber,
      age: game.currentAge,
      currentPlayer: game.currentPlayer,
      phase: game.phase
    };

    // Player 1 state
    state.player1 = {
      primaryCastle: this.captureCastleState(game.player1.primaryCastle),
      allianceCastle: this.captureCastleState(game.player1.allianceCastle)
    };

    // Player 2 state
    state.player2 = {
      primaryCastle: this.captureCastleState(game.player2.primaryCastle),
      allianceCastle: this.captureCastleState(game.player2.allianceCastle)
    };

    // Field state
    state.field = game.fieldPiles.map((pile, i) => ({
      pile: i,
      cards: pile.map(c => `${c.displayValue}${c.suit}`),
      topCard: pile.length > 0 ? `${pile[pile.length - 1].displayValue}${pile[pile.length - 1].suit}` : null
    }));

    state.deckSize = game.deck.length;
    state.discardSize = game.discardPile.length;

    return state;
  }

  captureCastleState(castle) {
    return {
      suit: castle.suit,
      isActive: castle.isActive,
      destroyed: castle.destroyed,
      royals: (castle.royalFamily || []).map(r => `${r.value}${r.suit}`),
      fortification: castle.fortification ? `${castle.fortification.displayValue}${castle.fortification.suit}` : null,
      fortificationStrength: castle.fortificationStrength || 0,
      damage: castle.totalDamage || 0,
      persuasion: castle.netPersuasion || 0,
      prisoners: (castle.dungeon || []).map(p => `${p.value}${p.suit}`)
    };
  }

  // Generate summary statistics
  generateSummary(game, log, decisions) {
    const summary = {
      winner: game.winner,
      rounds: game.roundNumber,
      
      player1: {
        royalsPlaced: 0,
        royalsKilled: 0,
        royalsKidnapped: 0,
        raidsPerformed: 0,
        damageDealt: 0,
        fortifications: 0,
        moodChanges: []
      },
      
      player2: {
        royalsPlaced: 0,
        royalsKilled: 0,
        royalsKidnapped: 0,
        raidsPerformed: 0,
        damageDealt: 0,
        fortifications: 0,
        moodChanges: []
      }
    };

    // Analyze logs
    for (const entry of log) {
      const msg = entry.message;
      const isP1 = msg.includes('Starless') || msg.includes('Player 1');
      const player = isP1 ? summary.player1 : summary.player2;

      if (msg.includes('brought') && msg.includes('to power')) player.royalsPlaced++;
      if (msg.includes('killed')) {
        if (isP1) summary.player1.royalsKilled++;
        else summary.player2.royalsKilled++;
      }
      if (msg.includes('kidnapped')) {
        if (isP1) summary.player1.royalsKidnapped++;
        else summary.player2.royalsKidnapped++;
      }
      if (msg.includes('raided')) player.raidsPerformed++;
      if (msg.includes('fortified')) player.fortifications++;
      
      // Extract damage numbers
      const damageMatch = msg.match(/\+(\d+) damage/);
      if (damageMatch && msg.includes('raided')) {
        player.damageDealt += parseInt(damageMatch[1]);
      }
    }

    // Track mood changes from decisions
    let lastP1Mood = null;
    let lastP2Mood = null;
    for (const d of decisions) {
      if (d.player.includes('1')) {
        if (d.mood !== lastP1Mood) {
          summary.player1.moodChanges.push({ turn: d.turn, mood: d.mood });
          lastP1Mood = d.mood;
        }
      } else {
        if (d.mood !== lastP2Mood) {
          summary.player2.moodChanges.push({ turn: d.turn, mood: d.mood });
          lastP2Mood = d.mood;
        }
      }
    }

    return summary;
  }

  // Run multiple simulations
  async runMultiple(count = 3) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running ${count} AI vs AI simulations...`);
    console.log(`${'='.repeat(60)}\n`);

    const results = [];
    const stats = {
      player1Wins: 0,
      player2Wins: 0,
      draws: 0,
      avgRounds: 0,
      avgTurns: 0
    };

    for (let i = 0; i < count; i++) {
      console.log(`\n${'─'.repeat(40)}`);
      console.log(`GAME ${i + 1} OF ${count}`);
      console.log(`${'─'.repeat(40)}\n`);

      const result = await this.runGame();
      results.push(result);

      if (result.winner) {
        if (result.winner.id === 1) stats.player1Wins++;
        else stats.player2Wins++;
      } else {
        stats.draws++;
      }
      stats.avgRounds += result.totalRounds;
      stats.avgTurns += result.totalTurns;

      // Print game summary
      console.log(`\n--- Game ${i + 1} Summary ---`);
      console.log(`Winner: ${result.winner ? result.winner.name : 'Draw/Timeout'}`);
      console.log(`Rounds: ${result.totalRounds}, Turns: ${result.totalTurns}`);
      console.log(`P1 Stats: ${result.summary.player1.royalsPlaced} royals placed, ${result.summary.player1.raidsPerformed} raids, ${result.summary.player1.damageDealt} damage`);
      console.log(`P2 Stats: ${result.summary.player2.royalsPlaced} royals placed, ${result.summary.player2.raidsPerformed} raids, ${result.summary.player2.damageDealt} damage`);
    }

    stats.avgRounds /= count;
    stats.avgTurns /= count;

    // Print overall stats
    console.log(`\n${'='.repeat(60)}`);
    console.log('OVERALL STATISTICS');
    console.log(`${'='.repeat(60)}`);
    console.log(`Player 1 (Black) Wins: ${stats.player1Wins} (${(stats.player1Wins/count*100).toFixed(1)}%)`);
    console.log(`Player 2 (Red) Wins: ${stats.player2Wins} (${(stats.player2Wins/count*100).toFixed(1)}%)`);
    console.log(`Draws/Timeouts: ${stats.draws}`);
    console.log(`Average Rounds: ${stats.avgRounds.toFixed(1)}`);
    console.log(`Average Turns: ${stats.avgTurns.toFixed(1)}`);

    return { results, stats };
  }

  // Format a detailed report for analysis
  formatDetailedReport(result) {
    let report = [];
    
    report.push('═'.repeat(70));
    report.push('DETAILED GAME ANALYSIS');
    report.push('═'.repeat(70));
    report.push('');
    
    report.push(`Winner: ${result.winner ? result.winner.name : 'None'}`);
    report.push(`Total Rounds: ${result.totalRounds}`);
    report.push(`Total Turns: ${result.totalTurns}`);
    report.push('');
    
    // Key decision points
    report.push('─'.repeat(70));
    report.push('KEY DECISIONS');
    report.push('─'.repeat(70));
    
    for (const decision of result.decisions) {
      if (decision.phase === 'draw' && decision.fieldOptions) {
        report.push('');
        report.push(`[R${decision.round} T${decision.turn}] ${decision.player} (${decision.moodEmoji} ${decision.mood})`);
        report.push(`  Field: ${decision.fieldCards.join(' | ')}`);
        
        if (decision.fieldOptions.length > 0) {
          const optStr = decision.fieldOptions.map(o => `${o.card}(${o.score.toFixed(1)})`).join(', ');
          report.push(`  Scores: ${optStr}`);
        }
        
        report.push(`  Drew: ${decision.drawnCard} from ${decision.drewFrom}`);
        
        if (decision.availableActions && decision.availableActions.length > 0) {
          const actStr = decision.availableActions.slice(0, 3).map(a => `${a.type}(${a.score.toFixed(1)})`).join(', ');
          report.push(`  Actions: ${actStr}`);
        }
      }
    }
    
    report.push('');
    report.push('─'.repeat(70));
    report.push('FINAL BOARD STATE');
    report.push('─'.repeat(70));
    
    const finalState = result.stateSnapshots[result.stateSnapshots.length - 1];
    if (finalState) {
      report.push('');
      report.push('Player 1 (Black/Spades):');
      report.push(`  Primary (♠): ${finalState.player1.primaryCastle.destroyed ? 'DESTROYED' : 'Active'}`);
      report.push(`    Royals: ${finalState.player1.primaryCastle.royals.join(', ') || 'none'}`);
      report.push(`    Damage: ${finalState.player1.primaryCastle.damage}/20`);
      report.push(`    Fort: ${finalState.player1.primaryCastle.fortification || 'none'}`);
      report.push(`  Alliance (♣): ${finalState.player1.allianceCastle.isActive ? 'ACTIVE' : `Inactive (${finalState.player1.allianceCastle.persuasion}/20)`}`);
      if (finalState.player1.allianceCastle.isActive) {
        report.push(`    Royals: ${finalState.player1.allianceCastle.royals.join(', ') || 'none'}`);
        report.push(`    Damage: ${finalState.player1.allianceCastle.damage}/20`);
      }
      
      report.push('');
      report.push('Player 2 (Red/Hearts):');
      report.push(`  Primary (♥): ${finalState.player2.primaryCastle.destroyed ? 'DESTROYED' : 'Active'}`);
      report.push(`    Royals: ${finalState.player2.primaryCastle.royals.join(', ') || 'none'}`);
      report.push(`    Damage: ${finalState.player2.primaryCastle.damage}/20`);
      report.push(`    Fort: ${finalState.player2.primaryCastle.fortification || 'none'}`);
      report.push(`  Alliance (♦): ${finalState.player2.allianceCastle.isActive ? 'ACTIVE' : `Inactive (${finalState.player2.allianceCastle.persuasion}/20)`}`);
      if (finalState.player2.allianceCastle.isActive) {
        report.push(`    Royals: ${finalState.player2.allianceCastle.royals.join(', ') || 'none'}`);
        report.push(`    Damage: ${finalState.player2.allianceCastle.damage}/20`);
      }
    }
    
    report.push('');
    report.push('─'.repeat(70));
    report.push('GAME LOG (Last 30 entries)');
    report.push('─'.repeat(70));
    
    const lastLogs = result.log.slice(-30);
    for (const entry of lastLogs) {
      report.push(`[R${entry.round}] ${entry.message}`);
    }
    
    return report.join('\n');
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.GameSimulator = GameSimulator;
}

// Quick run function
async function runSimulation(count = 3, verbose = true) {
  const sim = new GameSimulator({ verbose, captureStates: true });
  const { results, stats } = await sim.runMultiple(count);
  
  // Print detailed report for the last game
  console.log('\n');
  console.log(sim.formatDetailedReport(results[results.length - 1]));
  
  return { results, stats };
}

if (typeof window !== 'undefined') {
  window.runSimulation = runSimulation;
}
