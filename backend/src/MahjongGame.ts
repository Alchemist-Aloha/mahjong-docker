import { Server } from 'socket.io';
import { MahjongBot } from './MahjongBot';
import { MahjongScorer, FanResult } from './MahjongScorer';

export class MahjongGame {
  private io: Server;
  public room: any;
  private deck: string[] = [];
  public playerIds: string[] = [];
  public hands: Record<string, string[]> = {};
  public discards: Record<string, string[]> = {};
  public melds: Record<string, string[][]> = {};
  public flowers: Record<string, string[]> = {};
  public currentTurnIndex: number = 0;
  private bots: MahjongBot[] = [];
  private isRunning: boolean = false;
  public lastDrawnTile: Record<string, string | null> = {};

  private pendingDiscard: { playerId: string, tile: string } | null = null;
  private waitingForActions: Record<string, string[]> = {};
  private collectedActions: Record<string, string | null> = {};
  private actionTimeout: NodeJS.Timeout | null = null;

  private dealerIndex: number = 0;
  private nextRoundReady: Record<string, boolean> = {};
  private roundWinner: string | null = null;
  private logs: string[] = [];

  constructor(io: Server, room: any) {
    this.io = io;
    this.room = room;
    this.playerIds = Object.keys(room.players);
    this.resetState();
  }

  private resetState() {
    this.playerIds.forEach(id => {
      this.hands[id] = [];
      this.discards[id] = [];
      this.melds[id] = [];
      this.flowers[id] = [];
      this.lastDrawnTile[id] = null;
      this.nextRoundReady[id] = false;
    });
    this.pendingDiscard = null;
    this.waitingForActions = {};
    this.collectedActions = {};
    this.roundWinner = null;
    this.logs = [];
  }

  private addLog(message: string) {
    this.logs.push(message);
    if (this.logs.length > 30) {
      this.logs.shift();
    }
  }

  private getTileWeight(tile: string): number {
    const valueMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const suitMap: Record<string, number> = { '条': 10, '饼': 20, '万': 30 };
    const honorMap: Record<string, number> = { '东风': 41, '南风': 42, '西风': 43, '北风': 44, '红中': 45, '发财': 46, '白板': 47 };
    const flowerMap: Record<string, number> = { '春': 51, '夏': 52, '秋': 53, '冬': 54, '梅': 55, '兰': 56, '竹': 57, '菊': 58 };

    if (tile.length === 2) {
      const v = valueMap[tile[0]];
      const s = suitMap[tile[1]];
      if (v && s) return s + v;
    }
    return honorMap[tile] || flowerMap[tile] || 99;
  }

  private isFlower(tile: string): boolean {
    return ['春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'].includes(tile);
  }

  private sortHand(id: string) {
    this.hands[id].sort((a, b) => this.getTileWeight(a) - this.getTileWeight(b));
  }

  public start() {
    this.isRunning = true;
    this.initializeDeck();
    this.dealCards();
    this.initializeBots();
    this.playerIds.forEach(id => this.resolveInitialFlowers(id));
    this.currentTurnIndex = this.dealerIndex;
    this.addLog('游戏开始');
    this.broadcastState();
    this.drawTile(this.playerIds[this.currentTurnIndex]);
  }

  public startNextRound() {
    this.resetState();
    this.start();
  }

  public playerReadyForNextRound(playerId: string) {
    this.nextRoundReady[playerId] = true;
    this.broadcastState();
    const allReady = this.playerIds.every(id => this.nextRoundReady[id] || this.room.players[id].isBot);
    if (allReady) {
      setTimeout(() => this.startNextRound(), 1000);
    }
  }

  private resolveInitialFlowers(playerId: string) {
    let hasFlowers = true;
    while (hasFlowers) {
      const flowerIndices = this.hands[playerId]
        .map((t, i) => this.isFlower(t) ? i : -1)
        .filter(i => i !== -1);

      if (flowerIndices.length === 0) {
        hasFlowers = false;
      } else {
        const idx = flowerIndices[0];
        const flower = this.hands[playerId].splice(idx, 1)[0];
        this.flowers[playerId].push(flower);
        if (this.deck.length > 0) {
          this.hands[playerId].push(this.deck.shift()!);
        }
      }
    }
    this.sortHand(playerId);
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
    const flowerTiles = ['春', '夏', '秋', '冬', '梅', '兰', '竹', '菊'];

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
    flowerTiles.forEach(f => this.deck.push(f));

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
  }

  private initializeBots() {
    this.bots = [];
    this.playerIds.forEach(id => {
      if (this.room.players[id].isBot) {
        this.bots.push(new MahjongBot(id, this));
      }
    });
  }

  public broadcastState() {
    this.playerIds.forEach(id => {
      const player = this.room.players[id];
      if (!player.isBot) {
        const state = {
          currentTurn: this.playerIds[this.currentTurnIndex],
          dealer: this.playerIds[this.dealerIndex],
          hand: [...this.hands[id]],
          drawnTile: this.lastDrawnTile[id],
          melds: this.melds,
          flowers: this.flowers,
          deckSize: this.deck.length,
          discards: this.discards,
          pendingActionTile: this.pendingDiscard?.tile || null,
          possibleActions: this.waitingForActions[id] || [],
          roundOver: !this.isRunning,
          roundWinner: this.roundWinner,
          nextRoundReady: this.nextRoundReady,
          logs: this.logs,
          players: this.playerIds.map(pid => ({
            id: pid,
            name: this.room.players[pid].name,
            totalScore: this.room.players[pid].totalScore,
            handSize: this.hands[pid].length + (this.lastDrawnTile[pid] ? 1 : 0),
            isBot: this.room.players[pid].isBot,
            isOnline: this.room.players[pid].isOnline,
            isDealer: pid === this.playerIds[this.dealerIndex]
          }))
        };
        this.io.to(player.socketId).emit('gameState', state);
      }
    });
  }

  private drawTile(playerId: string, fromTail: boolean = false) {
    if (!this.isRunning) return;
    if (this.deck.length === 0) {
      this.endRound(null);
      return;
    }

    const tile = fromTail ? this.deck.shift()! : this.deck.pop()!;

    if (this.isFlower(tile)) {
      this.flowers[playerId].push(tile);
      this.addLog(`${this.room.players[playerId].name} 补花: ${tile}`);
      this.broadcastState();
      setTimeout(() => this.drawTile(playerId, true), 800);
      return;
    }

    this.lastDrawnTile[playerId] = tile;
    this.addLog(`${this.room.players[playerId].name} 摸牌`);
    this.broadcastState();

    const scoreResult = this.calculateScore(playerId, tile, true);
    if (scoreResult) {
      this.endRound(playerId, 'Tsumo', scoreResult);
      return;
    }

    if (this.room.players[playerId].isBot) {
      const bot = this.bots.find(b => b.id === playerId);
      if (bot) {
        setTimeout(() => bot.playTurn(), 1000);
      }
    }
  }

  private calculateScore(playerId: string, tile: string, isTsumo: boolean) {
    const { total, fans } = MahjongScorer.calculate(this.hands[playerId], this.melds[playerId], tile, isTsumo, this.flowers[playerId]);
    if (total > 0) return { total, fans };
    return null;
  }

  private endRound(winnerId: string | null, type: string = '', scoreResult?: any) {
    this.isRunning = false;
    this.roundWinner = winnerId;
    const scoreChanges: Record<string, number> = {};
    this.playerIds.forEach(pid => scoreChanges[pid] = 0);

    if (winnerId) {
      const fans = scoreResult.total;
      const winnerIndex = this.playerIds.indexOf(winnerId);

      // Points exchange
      if (type === 'Tsumo') {
        this.playerIds.forEach(pid => {
          if (pid !== winnerId) {
            const pay = fans + 8;
            this.room.players[pid].totalScore -= pay;
            this.room.players[winnerId].totalScore += pay;
            scoreChanges[pid] -= pay;
            scoreChanges[winnerId] += pay;
          }
        });
      } else {
        // Ron
        const discarderId = this.pendingDiscard!.playerId;
        this.playerIds.forEach(pid => {
          if (pid !== winnerId) {
            const pay = (pid === discarderId) ? (fans + 8) : 8;
            this.room.players[pid].totalScore -= pay;
            this.room.players[winnerId].totalScore += pay;
            scoreChanges[pid] -= pay;
            scoreChanges[winnerId] += pay;
          }
        });
      }

      if (winnerIndex !== this.dealerIndex) {
        this.dealerIndex = (this.dealerIndex + 1) % this.playerIds.length;
      }
      const winnerName = this.room.players[winnerId].name;
      this.addLog(`${winnerName} ${type === 'Tsumo' ? '自摸' : '荣和'}! (${scoreResult.total} 番)`);
      this.io.to(this.room.id).emit('gameOver', {
        winner: winnerId,
        type,
        score: scoreResult,
        hand: [...this.hands[winnerId]],
        melds: this.melds[winnerId],
        winningTile: type === 'Tsumo' ? this.lastDrawnTile[winnerId] : this.pendingDiscard?.tile,
        scoreChanges
      });
    } else {
      this.dealerIndex = (this.dealerIndex + 1) % this.playerIds.length;
      this.addLog('流局了');
      this.io.to(this.room.id).emit('gameOver', { message: 'Draw', scoreChanges });
    }

    this.broadcastState();
  }

  public handleDiscard(playerId: string, tileIndex: number) {
    if (!this.isRunning) return;
    if (this.playerIds[this.currentTurnIndex] !== playerId) return;
    if (this.pendingDiscard) return;

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

    this.addLog(`${this.room.players[playerId].name} 出牌: ${discarded}`);
    this.pendingDiscard = { playerId, tile: discarded };
    this.checkForInterruptions(discarded, playerId);
  }

  private checkForInterruptions(tile: string, discarderId: string) {
    this.waitingForActions = {};
    this.collectedActions = {};
    let anyoneCanAct = false;

    const nextPlayerIndex = (this.playerIds.indexOf(discarderId) + 1) % this.playerIds.length;
    const nextPlayerId = this.playerIds[nextPlayerIndex];

    this.playerIds.forEach(pid => {
      if (pid === discarderId) return;

      const actions: string[] = [];
      const scoreResult = this.calculateScore(pid, tile, false);
      if (scoreResult) actions.push('WIN'); // Temporarily removed >= 8 check

      const count = this.hands[pid].filter(t => t === tile).length;
      if (count >= 2) actions.push('PONG');
      if (count === 3) actions.push('KONG');

      if (pid === nextPlayerId) {
        const chowMelds = this.canChow(this.hands[pid], tile);
        chowMelds.forEach(meld => {
          actions.push(`CHOW:${meld.join(',')}`);
        });
      }

      if (actions.length > 0) {
        this.waitingForActions[pid] = actions;
        anyoneCanAct = true;
      }
    });

    if (anyoneCanAct) {
      this.broadcastState();
      this.bots.forEach(bot => {
        if (this.waitingForActions[bot.id]) {
          setTimeout(() => bot.handlePotentialAction(tile, this.waitingForActions[bot.id]), 1500);
        }
      });
      this.actionTimeout = setTimeout(() => this.resolveCollectedActions(), 30000);
    } else {
      this.proceedAfterNoAction();
    }
  }

  private canChow(hand: string[], tile: string): string[][] {
    if (tile.length !== 2) return [];
    const valueMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const revMap = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const val = valueMap[tile[0]];
    const suit = tile[1];
    if (!val) return [];
    const possibleMelds: string[][] = [];
    const h = new Set(hand);
    if (val >= 3 && h.has(`${revMap[val - 2]}${suit}`) && h.has(`${revMap[val - 1]}${suit}`)) possibleMelds.push([`${revMap[val - 2]}${suit}`, `${revMap[val - 1]}${suit}`, tile]);
    if (val >= 2 && val <= 8 && h.has(`${revMap[val - 1]}${suit}`) && h.has(`${revMap[val + 1]}${suit}`)) possibleMelds.push([`${revMap[val - 1]}${suit}`, tile, `${revMap[val + 1]}${suit}`]);
    if (val <= 7 && h.has(`${revMap[val + 1]}${suit}`) && h.has(`${revMap[val + 2]}${suit}`)) possibleMelds.push([tile, `${revMap[val + 1]}${suit}`, `${revMap[val + 2]}${suit}`]);
    return possibleMelds;
  }

  public performAction(playerId: string, action: string | null) {
    if (!this.pendingDiscard) return;

    // Only accept actions from players we are waiting for
    if (!this.waitingForActions[playerId]) return;

    this.collectedActions[playerId] = action;
    console.log(`Action collected from ${playerId}: ${action} (Waiting for: ${Object.keys(this.waitingForActions).join(', ')})`);

    if (Object.keys(this.collectedActions).length === Object.keys(this.waitingForActions).length) {
      if (this.actionTimeout) {
        clearTimeout(this.actionTimeout);
        this.actionTimeout = null;
      }
      this.resolveCollectedActions();
    }
  }

  private resolveCollectedActions() {
    if (!this.pendingDiscard) return;
    const tile = this.pendingDiscard.tile;
    const discarderId = this.pendingDiscard.playerId;
    const priorities = ['WIN', 'KONG', 'PONG', 'CHOW'];

    console.log('Resolving collected actions:', this.collectedActions);

    for (const actionType of priorities) {
      const actingPlayers = Object.entries(this.collectedActions)
        .filter(([_, action]) => action && action.startsWith(actionType))
        .map(([pid]) => pid);

      if (actingPlayers.length > 0) {
        // If multiple players chose the same high-priority action (like WIN), 
        // pick the one closest to the discarder in turn order
        const discarderIndex = this.playerIds.indexOf(discarderId);
        actingPlayers.sort((a, b) => {
          const distA = (this.playerIds.indexOf(a) - discarderIndex + this.playerIds.length) % this.playerIds.length;
          const distB = (this.playerIds.indexOf(b) - discarderIndex + this.playerIds.length) % this.playerIds.length;
          return distA - distB;
        });

        const winner = actingPlayers[0];
        const specificAction = this.collectedActions[winner]!;
        console.log(`Executing prioritized action: ${actionType} (specific: ${specificAction}) for player ${winner}`);
        this.executeAction(winner, specificAction, tile);
        return;
      }
    }

    console.log('No players performed an action, proceeding.');
    this.proceedAfterNoAction();
  }

  private executeAction(playerId: string, action: string, tile: string) {
    const hand = this.hands[playerId];
    const playerName = this.room.players[playerId].name;
    if (action === 'WIN') {
      const scoreResult = this.calculateScore(playerId, tile, false);
      this.endRound(playerId, 'Ron', scoreResult);
      return;
    }

    let isKong = false;
    if (action === 'PONG' || action === 'KONG') {
      this.addLog(`${playerName} ${action === 'PONG' ? '碰' : '杠'}: ${tile}`);
      const count = action === 'PONG' ? 2 : 3;
      isKong = action === 'KONG';
      for (let i = 0; i < count; i++) {
        const idx = hand.indexOf(tile);
        if (idx !== -1) {
          hand.splice(idx, 1);
        }
      }
      this.melds[playerId].push(new Array(count + 1).fill(tile));
    } else if (action.startsWith('CHOW')) {
      let meld: string[];
      if (action.includes(':')) {
        meld = action.split(':')[1].split(',');
      } else {
        const possible = this.canChow(hand, tile);
        if (possible.length === 0) {
          console.error(`Player ${playerId} tried to CHOW but no valid meld found for tile ${tile}`);
          this.proceedAfterNoAction();
          return;
        }
        meld = possible[0];
      }

      this.addLog(`${playerName} 吃: ${meld.join('')}`);
      console.log(`Player ${playerId} performing CHOW with meld:`, meld);
      meld.forEach(t => {
        if (t !== tile) {
          const idx = hand.indexOf(t);
          if (idx !== -1) {
            hand.splice(idx, 1);
          } else {
            console.error(`Tile ${t} not found in hand for CHOW`);
          }
        }
      });
      this.melds[playerId].push(meld);
    }

    this.waitingForActions = {};
    this.collectedActions = {};
    this.pendingDiscard = null;
    this.currentTurnIndex = this.playerIds.indexOf(playerId);

    if (isKong) {
      this.broadcastState();
      setTimeout(() => this.drawTile(playerId, true), 800);
    } else {
      this.broadcastState();
      if (this.room.players[playerId].isBot) {
        const bot = this.bots.find(b => b.id === playerId);
        if (bot) setTimeout(() => bot.playTurn(), 1000);
      }
    }
  }

  private proceedAfterNoAction() {
    if (!this.pendingDiscard) return;
    const { playerId, tile } = this.pendingDiscard;
    this.discards[playerId].push(tile);
    this.pendingDiscard = null;
    this.waitingForActions = {};
    this.collectedActions = {};
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.playerIds.length;
    this.broadcastState();
    setTimeout(() => this.drawTile(this.playerIds[this.currentTurnIndex]), 500);
  }
}
