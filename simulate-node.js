#!/usr/bin/env node

// Royal Family AI vs AI Simulation - Node.js Version
// Uses the ACTUAL game.js code for BOTH game engine AND AI logic

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Seeded random number generator (Mulberry32)
function createSeededRandom(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Load and execute game.js in a context
function loadGameEngine(seed = null) {
  const gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  
  // Create Math object - use seeded random if seed provided
  let mathObj = Math;
  if (seed !== null) {
    const seededRandom = createSeededRandom(seed);
    // Create a proxy that intercepts random() calls but passes through everything else
    mathObj = new Proxy(Math, {
      get(target, prop) {
        if (prop === 'random') return seededRandom;
        return target[prop];
      }
    });
  }
  
  // Create a sandbox context with browser-like globals
  const context = {
    console: { log: () => {}, warn: () => {}, error: () => {} }, // Suppress game.js console output
    Math: mathObj,
    Date: Date,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    window: {}, // Mock window for browser compatibility
  };
  
  vm.createContext(context);
  vm.runInContext(gameCode, context);
  
  // Classes are exported to window in game.js
  return {
    GameState: context.window.GameState,
    AIPlayer: context.window.AIPlayer,  // Use the REAL AIPlayer!
    Card: context.window.Card,
    SUITS: context.SUITS,
    SUIT_NAMES: context.SUIT_NAMES,
  };
}

const RESULTS_DIR = path.join(__dirname, 'simulation-results');

function ensureResultsDir() {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
}

function saveResults(results, stats, filename = null) {
  ensureResultsDir();
  // Use local time instead of UTC
  const now = new Date();
  const localTimestamp = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') + '-' +
    String(now.getMinutes()).padStart(2, '0') + '-' +
    String(now.getSeconds()).padStart(2, '0');
  const fname = filename || `sim-${results.length}games-${localTimestamp}.json`;
  const filepath = path.join(RESULTS_DIR, fname);
  
  const data = {
    timestamp: new Date().toISOString(),
    gameCount: results.length,
    stats,
    results: results.map(r => ({
      seed: r.seed,  // Include seed for reproducibility
      winner: r.winner,
      winnerId: r.winnerId,
      rounds: r.rounds,
      turns: r.turns,
      finalState: r.finalState,
      logs: r.logs
    }))
  };
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`\nResults saved to: ${filepath}`);
  return filepath;
}

function loadResults(filename) {
  const filepath = filename.includes('/') ? filename : path.join(RESULTS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`File not found: ${filepath}`);
    return null;
  }
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  console.log(`Loaded ${data.gameCount} games from ${filepath}`);
  return data;
}

function listSavedResults() {
  ensureResultsDir();
  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No saved simulation results found.');
    return [];
  }
  console.log('\nSaved simulation results:');
  files.forEach((f, i) => {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
    console.log(`  ${i + 1}. ${f} (${data.gameCount} games, ${data.timestamp})`);
  });
  return files;
}

// Capture the full board state at a moment in time
function captureState(game) {
  const captureCastle = (castle) => ({
    suit: castle.suit,
    isActive: castle.isActive,
    destroyed: castle.destroyed,
    royals: castle.royalFamily.map(r => r.value + r.suit),
    fortification: castle.fortification ? castle.fortification.numericValue : null,
    fortificationDamage: castle.fortificationDamage?.reduce((s, c) => s + c.numericValue, 0) || 0,
    permanentDamage: castle.totalDamage,
    persuasion: castle.netPersuasion || 0,
    prisoner: castle.prisoner ? castle.prisoner.value + castle.prisoner.suit : null
  });

  const capturePlayer = (player) => ({
    name: player.name,
    primary: captureCastle(player.primaryCastle),
    alliance: captureCastle(player.allianceCastle)
  });

  // Capture top 2 cards of each pile (top + what's underneath)
  const captureFieldPile = (pile) => {
    if (pile.length === 0) return null;
    if (pile.length === 1) {
      return [pile[0].value + (pile[0].suit || '')];
    }
    // Return [top, underneath]
    return [
      pile[pile.length - 1].value + (pile[pile.length - 1].suit || ''),
      pile[pile.length - 2].value + (pile[pile.length - 2].suit || '')
    ];
  };

  return {
    round: game.roundNumber,
    turn: game.turnNumber,
    phase: game.phase,
    currentPlayer: game.currentPlayer,
    age: game.jokerInPlay ? 'Oppression' : 'Uprising',
    deckSize: game.deck.length,
    discardSize: game.discardPile.length,
    fieldPiles: game.fieldPiles.map(captureFieldPile),
    drawnCard: game.drawnCard ? game.drawnCard.value + (game.drawnCard.suit || '') : null,
    p1: capturePlayer(game.player1),
    p2: capturePlayer(game.player2)
  };
}

// Run a single game using the REAL AIPlayer from game.js
async function runGame(GameState, AIPlayer, maxSteps = 5000, captureFullState = true) {
  const game = new GameState();
  const logs = [];
  
  // Capture logs WITH full board state
  game.log = (msg) => {
    const entry = { 
      round: game.roundNumber, 
      turn: game.turnNumber, 
      message: msg 
    };
    
    // Add full state for decision-relevant logs
    if (captureFullState) {
      entry.state = captureState(game);
    }
    
    logs.push(entry);
  };
  
  // Create REAL AIPlayers with NO delay for fast simulation
  const ai1 = new AIPlayer(game, 1);
  const ai2 = new AIPlayer(game, 2);
  ai1.thinkingDelay = 0;  // Instant decisions
  ai2.thinkingDelay = 0;
  
  game.startGame();
  
  let steps = 0;
  
  while (game.phase !== 'gameOver' && steps < maxSteps) {
    steps++;
    const ai = game.currentPlayer === 1 ? ai1 : ai2;
    
    switch (game.phase) {
      case 'flop':
        game.dealFlop();
        break;
      case 'draw':
      case 'action':
      case 'field-select':
      case 'raid-choice':
      case 'assassin-surprise':
        // Use the REAL AIPlayer.takeTurn() which handles all phases
        await ai.takeTurn();
        break;
      default:
        console.warn('Unknown phase:', game.phase);
        break;
    }
  }
  
  return {
    winner: game.winner ? game.getPlayer(game.winner).name : null,
    winnerId: game.winner,
    rounds: game.roundNumber,
    turns: game.turnNumber,
    logs,
    ai1Mood: ai1.mood,
    ai2Mood: ai2.mood,
    finalState: {
      p1: {
        primary: { 
          destroyed: game.player1.primaryCastle.destroyed, 
          damage: game.player1.primaryCastle.totalDamage,
          royals: game.player1.primaryCastle.royalFamily.length 
        },
        alliance: { 
          active: game.player1.allianceCastle.isActive, 
          destroyed: game.player1.allianceCastle.destroyed,
          damage: game.player1.allianceCastle.totalDamage 
        }
      },
      p2: {
        primary: { 
          destroyed: game.player2.primaryCastle.destroyed, 
          damage: game.player2.primaryCastle.totalDamage,
          royals: game.player2.primaryCastle.royalFamily.length 
        },
        alliance: { 
          active: game.player2.allianceCastle.isActive, 
          destroyed: game.player2.allianceCastle.destroyed,
          damage: game.player2.allianceCastle.totalDamage 
        }
      }
    }
  };
}

async function runSimulations(count = 10, verbose = true, captureFullState = true, baseSeed = null) {
  console.log('═'.repeat(60));
  console.log(`Running ${count} AI vs AI simulations...`);
  console.log('Using REAL AIPlayer from game.js');
  console.log(`State capture: ${captureFullState ? 'FULL (board state with each log)' : 'MINIMAL'}`);
  if (baseSeed !== null) {
    console.log(`Seed: ${baseSeed}${count > 1 ? ` (games use seeds ${baseSeed} to ${baseSeed + count - 1})` : ''}`);
  }
  console.log('═'.repeat(60));
  
  const results = [];
  let p1Wins = 0, p2Wins = 0, timeouts = 0;
  const finishedGames = [];
  
  for (let i = 0; i < count; i++) {
    // Load engine with seed for this specific game (seed+i makes each game different but reproducible)
    const gameSeed = baseSeed !== null ? baseSeed + i : null;
    const engine = loadGameEngine(gameSeed);
    const result = await runGame(engine.GameState, engine.AIPlayer, 5000, captureFullState);
    result.seed = gameSeed;  // Store seed in result for reference
    results.push(result);
    
    if (result.winnerId === 1) { p1Wins++; finishedGames.push(result); }
    else if (result.winnerId === 2) { p2Wins++; finishedGames.push(result); }
    else timeouts++;
    
    if (verbose && count <= 20) {
      console.log(`\nGame ${i + 1}: ${result.winner || 'Timeout'} wins in ${result.rounds} rounds`);
    } else if (count > 20 && (i + 1) % 10 === 0) {
      process.stdout.write(`\rCompleted ${i + 1}/${count} games...`);
    }
  }
  
  if (count > 20) console.log('');
  
  const finishedCount = p1Wins + p2Wins;
  const avgRounds = finishedGames.length > 0 
    ? finishedGames.reduce((s, g) => s + g.rounds, 0) / finishedGames.length 
    : 0;
  
  // Calculate game time stats
  const roundsList = finishedGames.map(g => g.rounds).sort((a, b) => a - b);
  const timesList = roundsList.map(r => r * 3 * 5 / 60); // minutes assuming 5 sec/turn
  
  console.log('\n' + '═'.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total: ${count}, Completed: ${finishedCount}, Timeouts: ${timeouts}`);
  console.log(`P1 (Black) Wins: ${p1Wins} (${finishedCount ? (p1Wins/finishedCount*100).toFixed(1) : 0}%)`);
  console.log(`P2 (Red) Wins: ${p2Wins} (${finishedCount ? (p2Wins/finishedCount*100).toFixed(1) : 0}%)`);
  console.log(`\nRounds: min=${roundsList[0] || 0}, median=${roundsList[Math.floor(roundsList.length/2)] || 0}, max=${roundsList[roundsList.length-1] || 0}, avg=${avgRounds.toFixed(1)}`);
  
  if (timesList.length > 0) {
    console.log(`\nGame Time (@ 5 sec/turn):`);
    console.log(`  Min: ${timesList[0].toFixed(1)} min`);
    console.log(`  25th: ${timesList[Math.floor(timesList.length * 0.25)].toFixed(1)} min`);
    console.log(`  Median: ${timesList[Math.floor(timesList.length * 0.5)].toFixed(1)} min`);
    console.log(`  75th: ${timesList[Math.floor(timesList.length * 0.75)].toFixed(1)} min`);
    console.log(`  Max: ${timesList[timesList.length - 1].toFixed(1)} min`);
  }
  
  const stats = { p1Wins, p2Wins, timeouts, avgRounds };
  return { results, stats };
}

// Analysis functions
function analyzeGames(results) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('DETAILED ANALYSIS');
  console.log('═'.repeat(60));
  
  // Assassin analysis
  let assassinations = 0;
  let surpriseKills = 0;
  let reshuffles = 0;
  
  for (const game of results) {
    for (const log of game.logs) {
      if (log.message.includes('assassinated')) assassinations++;
      if (log.message.includes('Assassin killed')) surpriseKills++;
      if (log.message.includes('reshuffled')) reshuffles++;
    }
  }
  
  console.log(`\nAssassin Stats:`);
  console.log(`  Total assassinations: ${assassinations} (${(assassinations/results.length).toFixed(1)} per game)`);
  console.log(`  By choice: ${assassinations - surpriseKills}`);
  console.log(`  Surprise (drew from deck): ${surpriseKills}`);
  console.log(`  Deck reshuffles: ${reshuffles} (${(reshuffles/results.length).toFixed(1)} per game)`);
  
  // Raid analysis
  let raids = 0, raidsNoDamage = 0;
  let kills = 0, kidnaps = 0, rescues = 0;
  
  for (const game of results) {
    for (const log of game.logs) {
      if (log.message.includes('raided') && log.message.includes('damage') && !log.message.includes('no damage')) raids++;
      if (log.message.includes('raided') && log.message.includes('no damage')) raidsNoDamage++;
      if (log.message.includes('killed') && !log.message.includes('Assassin')) kills++;
      if (log.message.includes('kidnapped')) kidnaps++;
      if (log.message.includes('rescued')) rescues++;
    }
  }
  
  console.log(`\nRaid Stats:`);
  console.log(`  Raids with damage: ${raids} (${(raids/results.length).toFixed(1)} per game)`);
  console.log(`  Raids without damage: ${raidsNoDamage}`);
  console.log(`  Follow-up kills: ${kills}, kidnaps: ${kidnaps}, rescues: ${rescues}`);
  
  // Action breakdown
  let fields = 0, fortify = 0, persuade = 0, battles = 0, bringToPower = 0;
  
  for (const game of results) {
    for (const log of game.logs) {
      const m = log.message;
      if (m.includes('fielded')) fields++;
      if (m.includes('fortified')) fortify++;
      if (m.includes('persuaded')) persuade++;
      if (m.includes('brought') && m.includes('power')) bringToPower++;
      if (m.includes('fortification') && (m.includes('destroyed') || m.includes('attacked'))) battles++;
    }
  }
  
  const avgTurns = results.reduce((s, g) => s + g.rounds * 3, 0) / results.length;
  console.log(`\nAction Breakdown (~${avgTurns.toFixed(0)} turns/game):`);
  console.log(`  Fields: ${(fields/results.length).toFixed(1)}/game`);
  console.log(`  Raids: ${(raids/results.length).toFixed(1)}/game`);
  console.log(`  Battles: ${(battles/results.length).toFixed(1)}/game`);
  console.log(`  Fortify: ${(fortify/results.length).toFixed(1)}/game`);
  console.log(`  Persuade: ${(persuade/results.length).toFixed(1)}/game`);
  console.log(`  Bring to power: ${(bringToPower/results.length).toFixed(1)}/game`);
  console.log(`  Assassinations: ${(assassinations/results.length).toFixed(1)}/game`);
  
  // Strategic covering analysis
  let coveredRoyals = 0, coveredAssassins = 0, coveredHigh = 0, coveredLow = 0;
  
  for (const game of results) {
    for (const log of game.logs) {
      const match = log.message.match(/fielded .+ \(covered (.+)\)/);
      if (match) {
        const covered = match[1];
        if (covered.includes('K') || covered.includes('Q') || covered.includes('J')) coveredRoyals++;
        else if (covered.startsWith('2')) coveredAssassins++;
        else {
          const num = parseInt(covered);
          if (num >= 7) coveredHigh++;
          else coveredLow++;
        }
      }
    }
  }
  
  console.log(`\nStrategic Covering:`);
  console.log(`  Royals covered: ${(coveredRoyals/results.length).toFixed(1)}/game`);
  console.log(`  Assassins covered: ${(coveredAssassins/results.length).toFixed(1)}/game`);
  console.log(`  High soldiers (7-10): ${(coveredHigh/results.length).toFixed(1)}/game`);
  console.log(`  Low cards (3-6): ${(coveredLow/results.length).toFixed(1)}/game`);
  
  // Stalemate analysis
  const timeouts = results.filter(r => !r.winnerId);
  if (timeouts.length > 0) {
    console.log(`\nStalemate Games (${timeouts.length}):`);
    for (const game of timeouts.slice(0, 3)) {
      console.log(`  Round ${game.rounds}: P1 primary ${game.finalState.p1.primary.destroyed ? 'DEAD' : game.finalState.p1.primary.damage + '/20'}, P2 primary ${game.finalState.p2.primary.destroyed ? 'DEAD' : game.finalState.p2.primary.damage + '/20'}`);
    }
  }
}

function printHelp() {
  console.log(`
Royal Family AI Simulation
Uses the REAL game.js engine and AIPlayer for accurate results

Usage: node simulate-node.js <command> [count] [--minimal]

Commands:
  run <count>     Run simulations (default: 10)
  analyze <count> Run with detailed analysis
  load <file>     Load and analyze saved results
  list            List saved result files
  help            Show this help

Options:
  --minimal       Don't capture full board state (smaller files)
                  Default: captures full state with every log entry
  --seed=NUMBER   Use deterministic randomness for reproducible games
                  Each game uses seed+gameIndex (so game 1 = seed, game 2 = seed+1, etc.)

Examples:
  node simulate-node.js 10              # Run 10 games with full state
  node simulate-node.js 1 --seed=12345  # Run 1 reproducible game
  node simulate-node.js analyze 50      # Run 50 games with analysis
  node simulate-node.js 100 --minimal   # Run 100 games, minimal logs
`);
}

// Main
(async () => {
  try {
    const args = process.argv.slice(2);
    const command = args[0] || 'run';
    const captureFullState = !args.includes('--minimal');
    const numericArgs = args.filter(a => !a.startsWith('--') && !isNaN(parseInt(a)));
    
    // Parse seed from --seed=NUMBER
    const seedArg = args.find(a => a.startsWith('--seed='));
    const seed = seedArg ? parseInt(seedArg.split('=')[1]) : null;
    
    console.log('Royal Family AI Simulator\n');
    
    switch (command) {
      case 'help':
      case '--help':
        printHelp();
        break;
      case 'list':
        listSavedResults();
        break;
      case 'load':
        const filename = args.find(a => a.endsWith('.json')) || args[1];
        const data = loadResults(filename);
        if (data) analyzeGames(data.results);
        break;
      case 'analyze':
        const count1 = parseInt(numericArgs[0]) || 50;
        const { results: r1, stats: s1 } = await runSimulations(count1, false, captureFullState, seed);
        saveResults(r1, s1);
        analyzeGames(r1);
        break;
      default:
        const count2 = parseInt(command) || parseInt(numericArgs[0]) || 10;
        const { results: r2, stats: s2 } = await runSimulations(count2, count2 <= 20, captureFullState, seed);
        saveResults(r2, s2);
        break;
    }
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
})();
