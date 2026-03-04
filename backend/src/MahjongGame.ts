import { Server } from 'socket.io';
import { MahjongBot } from './MahjongBot';

export class MahjongGame {
  private io: Server;
  public room: any;
  private deck: string[] = [];
  public playerIds: string[] = [];
  public hands: Record<string, string[]> = {};
  public discards: Record<string, string[]> = {};
  public melds: Record<string, string[][]> = {}; // Track Pong/Kong sets
  public currentTurnIndex: number = 0;
  private bots: MahjongBot[] = [];
  private isRunning: boolean = false;
  public lastDrawnTile: Record<string, string | null> = {};
  
  // Action waiting state
  private pendingDiscard: { playerId: string, tile: string } | null = null;
  private waitingForActions: Record<string, string[]> = {}; // playerId -> ['PONG', 'KONG']
  private actionTimeout: NodeJS.Timeout | null = null;

  constructor(io: Server, room: any) {
    this.io = io;
    this.room = room;
    this.playerIds = Object.keys(room.players);
    this.playerIds.forEach(id => {
      this.hands[id] = [];
      this.discards[id] = [];
      this.melds[id] = [];
      this.lastDrawnTile[id] = null;
    });
  }

  private getTileWeight(tile: string): number {
    const valueMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const suitMap: Record<string, number> = { '条': 10, '饼': 20, '万': 30 };
    const honorMap: Record<string, number> = { '东风': 41, '南风': 42, '西风': 43, '北风': 44, '红中': 45, '发财': 46, '白板': 47 };

    if (tile.length === 2) {
      const v = valueMap[tile[0]];
      const s = suitMap[tile[1]];
      if (v && s) return s + v;
    }
    return honorMap[tile] || 99;
  }

  private sortHand(id: string) {
    this.hands[id].sort((a, b) => this.getTileWeight(a) - this.getTileWeight(b));
  }

  public start() {
    this.isRunning = true;
    this.initializeDeck();
    this.dealCards();
    this.initializeBots();
    this.broadcastState();
    this.drawTile(this.playerIds[this.currentTurnIndex]);
  }

  public stop() {
    this.isRunning = false;
    if (this.actionTimeout) clearTimeout(this.actionTimeout);
  }

  private initializeDeck() {
    const suits = ['万', '条', '饼'];
    const values = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const winds = ['东风', '南风', '西风', '北风'];
    const dragons = ['红中', '发财', '白板'];

    this.deck = [];
    suits.forEach(suit => {
      values.forEach(value => {
        for (let i = 0; i < 4; i++) this.deck.push(`${value}${suit}`);
      });
    });
    winds.forEach(wind => {
      for (let i = 0; i < 4; i++) this.deck.push(wind);
    });
    dragons.forEach(dragon => {
      for (let i = 0; i < 4; i++) this.deck.push(dragon);
    });

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
    this.playerIds.forEach(id => this.sortHand(id));
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
          hand: [...this.hands[id]],
          drawnTile: this.lastDrawnTile[id],
          melds: this.melds,
          deckSize: this.deck.length,
          discards: this.discards,
          possibleActions: this.waitingForActions[id] || [],
          players: this.playerIds.map(pid => ({
            id: pid,
            handSize: this.hands[pid].length + (this.lastDrawnTile[pid] ? 1 : 0),
            isBot: this.room.players[pid].isBot
          }))
        };
        this.io.to(id).emit('gameState', state);
      }
    });
  }

  private drawTile(playerId: string) {
    if (!this.isRunning) return;
    if (this.deck.length === 0) {
      this.io.to(this.room.id).emit('gameOver', { message: 'Draw' });
      this.isRunning = false;
      return;
    }

    const tile = this.deck.pop()!;
    this.lastDrawnTile[playerId] = tile;
    this.broadcastState();

    if (this.checkWin(this.hands[playerId], tile)) {
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

    let discarded: string;
    if (tileIndex === -1) {
      discarded = this.lastDrawnTile[playerId]!;
      this.lastDrawnTile[playerId] = null;
    } else {
      const hand = this.hands[playerId];
      if (tileIndex >= 0 && tileIndex < hand.length) {
        discarded = hand.splice(tileIndex, 1)[0];
        if (this.lastDrawnTile[playerId]) {
          hand.push(this.lastDrawnTile[playerId]!);
          this.lastDrawnTile[playerId] = null;
        }
        this.sortHand(playerId);
      } else {
        return;
      }
    }

    this.pendingDiscard = { playerId, tile: discarded };
    this.checkForInterruptions(discarded, playerId);
  }

  private checkForInterruptions(tile: string, discarderId: string) {
    this.waitingForActions = {};
    let anyoneCanAct = false;

    this.playerIds.forEach(pid => {
      if (pid === discarderId) return;

      const actions: string[] = [];
      const count = this.hands[pid].filter(t => t === tile).length;
      
      if (count >= 2) actions.push('PONG');
      if (count === 3) actions.push('KONG');

      if (actions.length > 0) {
        this.waitingForActions[pid] = actions;
        anyoneCanAct = true;
      }
    });

    if (anyoneCanAct) {
      this.broadcastState();
      // Notify bots
      this.bots.forEach(bot => {
        if (this.waitingForActions[bot.id]) {
          setTimeout(() => bot.handlePotentialAction(tile, this.waitingForActions[bot.id]), 1000);
        }
      });

      // Set timeout to proceed if no one acts
      this.actionTimeout = setTimeout(() => this.proceedAfterNoAction(), 5000);
    } else {
      this.proceedAfterNoAction();
    }
  }

  public performAction(playerId: string, action: string | null) {
    if (!this.pendingDiscard) return;
    if (this.actionTimeout) clearTimeout(this.actionTimeout);

    if (action === 'PONG' || action === 'KONG') {
      const tile = this.pendingDiscard.tile;
      const hand = this.hands[playerId];
      const count = action === 'PONG' ? 2 : 3;
      
      // Remove tiles from hand
      for (let i = 0; i < count; i++) {
        const idx = hand.indexOf(tile);
        hand.splice(idx, 1);
      }
      
      this.melds[playerId].push(new Array(count + 1).fill(tile));
      this.waitingForActions = {};
      this.pendingDiscard = null;
      
      // It becomes this player's turn
      this.currentTurnIndex = this.playerIds.indexOf(playerId);
      this.broadcastState();

      if (this.room.players[playerId].isBot) {
        const bot = this.bots.find(b => b.id === playerId);
        if (bot) bot.playTurn();
      }
    } else {
      // Player skipped or invalid action
      delete this.waitingForActions[playerId];
      if (Object.keys(this.waitingForActions).length === 0) {
        this.proceedAfterNoAction();
      } else {
        this.broadcastState();
      }
    }
  }

  private proceedAfterNoAction() {
    if (!this.pendingDiscard) return;
    
    const { playerId, tile } = this.pendingDiscard;
    this.discards[playerId].push(tile);
    this.pendingDiscard = null;
    this.waitingForActions = {};

    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerIds.length;
    this.broadcastState();
    setTimeout(() => this.drawTile(this.playerIds[this.currentTurnIndex]), 500);
  }

  private checkWin(hand: string[], extraTile?: string): boolean {
    const fullHand = extraTile ? [...hand, extraTile] : [...hand];
    if (fullHand.length % 3 !== 2) return false;
    
    const counts: Record<string, number> = {};
    fullHand.forEach(t => counts[t] = (counts[t] || 0) + 1);
    
    const tiles = Object.keys(counts);
    for (let i = 0; i < tiles.length; i++) {
      const pairTile = tiles[i];
      if (counts[pairTile] >= 2) {
        const remaining = { ...counts };
        remaining[pairTile] -= 2;
        if (this.canFormMelds(remaining)) return true;
      }
    }
    return false;
  }

  private canFormMelds(counts: Record<string, number>): boolean {
    const tiles = Object.keys(counts).filter(t => counts[t] > 0).sort((a, b) => this.getTileWeight(a) - this.getTileWeight(b));
    if (tiles.length === 0) return true;

    const first = tiles[0];
    
    if (counts[first] >= 3) {
      const nextCounts = { ...counts };
      nextCounts[first] -= 3;
      if (this.canFormMelds(nextCounts)) return true;
    }

    const valueMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    if (first.length === 2) {
      const val = valueMap[first[0]];
      const suit = first[1];
      if (val && val <= 7) {
        const second = `${Object.keys(valueMap).find(key => valueMap[key] === val + 1)}${suit}`;
        const third = `${Object.keys(valueMap).find(key => valueMap[key] === val + 2)}${suit}`;
        if (counts[second] > 0 && counts[third] > 0) {
          const nextCounts = { ...counts };
          nextCounts[first]--;
          nextCounts[second]--;
          nextCounts[third]--;
          if (this.canFormMelds(nextCounts)) return true;
        }
      }
    }
    return false;
  }
}
