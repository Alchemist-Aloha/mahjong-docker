import { Server } from 'socket.io';
import { MahjongBot } from './MahjongBot';

export class MahjongGame {
  private io: Server;
  private room: any;
  private deck: string[] = [];
  private playerIds: string[] = [];
  private hands: Record<string, string[]> = {};
  private discards: Record<string, string[]> = {};
  private currentTurnIndex: number = 0;
  private bots: MahjongBot[] = [];
  private isRunning: boolean = false;

  constructor(io: Server, room: any) {
    this.io = io;
    this.room = room;
    this.playerIds = Object.keys(room.players);
    this.playerIds.forEach(id => {
      this.hands[id] = [];
      this.discards[id] = [];
    });
  }

  public start() {
    this.isRunning = true;
    this.initializeDeck();
    this.dealCards();
    this.initializeBots();
    this.broadcastState();
    
    // First player draws a tile to start their turn
    this.drawTile(this.playerIds[this.currentTurnIndex]);
  }

  public stop() {
    this.isRunning = false;
  }

  private initializeDeck() {
    const suits = ['bamboo', 'characters', 'dots'];
    const values = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const winds = ['east', 'south', 'west', 'north'];
    const dragons = ['red', 'green', 'white'];

    this.deck = [];
    suits.forEach(suit => {
      values.forEach(value => {
        for (let i = 0; i < 4; i++) this.deck.push(`${value}_${suit}`);
      });
    });
    winds.forEach(wind => {
      for (let i = 0; i < 4; i++) this.deck.push(`${wind}_wind`);
    });
    dragons.forEach(dragon => {
      for (let i = 0; i < 4; i++) this.deck.push(`${dragon}_dragon`);
    });

    // Shuffle
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  private dealCards() {
    for (let i = 0; i < 13; i++) {
      this.playerIds.forEach(id => {
        if (this.deck.length > 0) {
          this.hands[id].push(this.deck.pop()!);
        }
      });
    }
    // Sort hands for players
    this.playerIds.forEach(id => this.hands[id].sort());
  }

  private initializeBots() {
    this.bots = [];
    this.playerIds.forEach(id => {
      if (this.room.players[id].isBot) {
        this.bots.push(new MahjongBot(id, this));
      }
    });
  }

  private broadcastState() {
    this.playerIds.forEach(id => {
      if (!this.room.players[id].isBot) {
        const state = {
          currentTurn: this.playerIds[this.currentTurnIndex],
          hand: [...this.hands[id]].sort(),
          deckSize: this.deck.length,
          discards: this.discards,
          players: this.playerIds.map(pid => ({
            id: pid,
            handSize: this.hands[pid].length,
            isBot: this.room.players[pid].isBot
          }))
        };
        this.io.to(id).emit('gameState', state);
      }
    });
  }

  private drawTile(playerId: string) {
    if (this.deck.length === 0) {
      this.io.to(this.room.id).emit('gameOver', { message: 'Draw' });
      this.isRunning = false;
      return;
    }

    const tile = this.deck.pop()!;
    this.hands[playerId].push(tile);
    this.broadcastState();

    // Check for Tsumo (self-draw win)
    if (this.checkWin(this.hands[playerId])) {
      this.io.to(this.room.id).emit('gameOver', { winner: playerId, type: 'Tsumo' });
      this.isRunning = false;
      return;
    }

    if (this.room.players[playerId].isBot) {
      const bot = this.bots.find(b => b.id === playerId);
      if (bot) {
        setTimeout(() => bot.playTurn(), 1000);
      }
    }
  }

  public handleDiscard(playerId: string, tileIndex: number) {
    if (!this.isRunning) return;
    if (this.playerIds[this.currentTurnIndex] !== playerId) return;

    const hand = this.hands[playerId];
    if (tileIndex >= 0 && tileIndex < hand.length) {
      const discarded = hand.splice(tileIndex, 1)[0];
      this.discards[playerId].push(discarded);
      
      // Check if any other player can Win (Ron) - simplified: just broadcast
      // Move to next turn
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerIds.length;
      this.broadcastState();
      setTimeout(() => this.drawTile(this.playerIds[this.currentTurnIndex]), 500);
    }
  }

  // Simplified Hu (Win) check: 3n+2 pattern
  private checkWin(hand: string[]): boolean {
    if (hand.length % 3 !== 2) return false;
    
    // Sort and convert to counts
    const counts: Record<string, number> = {};
    hand.forEach(t => counts[t] = (counts[t] || 0) + 1);
    
    const tiles = Object.keys(counts);
    
    for (let i = 0; i < tiles.length; i++) {
      const pairTile = tiles[i];
      if (counts[pairTile] >= 2) {
        // Try removing this pair and see if the rest forms melds
        const remaining = { ...counts };
        remaining[pairTile] -= 2;
        if (this.canFormMelds(remaining)) return true;
      }
    }
    return false;
  }

  private canFormMelds(counts: Record<string, number>): boolean {
    const tiles = Object.keys(counts).filter(t => counts[t] > 0).sort();
    if (tiles.length === 0) return true;

    const first = tiles[0];
    
    // Try Pung
    if (counts[first] >= 3) {
      const nextCounts = { ...counts };
      nextCounts[first] -= 3;
      if (this.canFormMelds(nextCounts)) return true;
    }

    // Try Chow (only for suited tiles)
    const [valStr, suit] = first.split('_');
    const val = parseInt(valStr);
    if (!isNaN(val) && val <= 7) {
      const second = `${val + 1}_${suit}`;
      const third = `${val + 2}_${suit}`;
      if (counts[second] > 0 && counts[third] > 0) {
        const nextCounts = { ...counts };
        nextCounts[first]--;
        nextCounts[second]--;
        nextCounts[third]--;
        if (this.canFormMelds(nextCounts)) return true;
      }
    }

    return false;
  }
}
