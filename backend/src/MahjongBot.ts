import { MahjongGame } from './MahjongGame';

export class MahjongBot {
  public id: string;
  private game: MahjongGame;

  constructor(id: string, game: MahjongGame) {
    this.id = id;
    this.game = game;
  }

  public playTurn() {
    const hand = this.game.hands[this.id];
    const drawnTile = this.game.lastDrawnTile[this.id];
    
    let fullHand = [...hand];
    if (drawnTile) fullHand.push(drawnTile);

    let minScore = Infinity;
    let bestIndicesToDiscard: number[] = [];

    // Evaluate hand tiles
    for (let i = 0; i < hand.length; i++) {
      const score = this.getTileScore(hand[i], fullHand);
      if (score < minScore) {
        minScore = score;
        bestIndicesToDiscard = [i];
      } else if (score === minScore) {
        bestIndicesToDiscard.push(i);
      }
    }

    // Evaluate drawn tile (if it exists)
    if (drawnTile) {
      const score = this.getTileScore(drawnTile, fullHand);
      if (score < minScore) {
        minScore = score;
        bestIndicesToDiscard = [-1]; // -1 represents the drawn tile
      } else if (score === minScore) {
        bestIndicesToDiscard.push(-1);
      }
    }

    // Randomly pick from the best candidates to add some unpredictability
    const chosenIndex = bestIndicesToDiscard[Math.floor(Math.random() * bestIndicesToDiscard.length)];
    this.game.handleDiscard(this.id, chosenIndex);
  }

  private getTileScore(tile: string, fullHand: string[]): number {
    const count = fullHand.filter(t => t === tile).length;
    if (count >= 3) return 100; // Triplets/Kongs are very valuable
    if (count === 2) return 50;  // Pairs are valuable

    // Honors (Winds & Dragons)
    if (['东风', '南风', '西风', '北风', '红中', '发财', '白板'].includes(tile)) {
      return 0; // Isolated honors are highly expendable
    }

    const valueMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const revMap = ['','一', '二', '三', '四', '五', '六', '七', '八', '九'];
    
    const num = valueMap[tile[0]];
    const suit = tile[1];
    
    if (!num) return 0; // Fallback for invalid tiles

    let score = 10;
    
    // Terminals are harder to meld than middle tiles
    if (num === 1 || num === 9) score -= 4;
    if (num === 2 || num === 8) score -= 2;

    const h = new Set(fullHand);
    let hasNeighbor = false;
    
    // Direct neighbors (sequences)
    if (num > 1 && h.has(`${revMap[num-1]}${suit}`)) { score += 20; hasNeighbor = true; }
    if (num < 9 && h.has(`${revMap[num+1]}${suit}`)) { score += 20; hasNeighbor = true; }
    
    // Skip-one neighbors (potential chows)
    if (num > 2 && h.has(`${revMap[num-2]}${suit}`)) { score += 10; hasNeighbor = true; }
    if (num < 8 && h.has(`${revMap[num+2]}${suit}`)) { score += 10; hasNeighbor = true; }

    if (!hasNeighbor) {
      score -= 5; // Isolated number tile
    }

    return score;
  }

  public handlePotentialAction(tile: string, actions: string[]) {
    // Advanced AI: don't ALWAYS chow/pong to sometimes keep a closed hand
    if (actions.includes('WIN')) {
      this.game.performAction(this.id, 'WIN');
    } else if (actions.includes('KONG')) {
      this.game.performAction(this.id, 'KONG');
    } else if (actions.includes('PONG')) {
      // 70% chance to Pong
      if (Math.random() < 0.7) { 
        this.game.performAction(this.id, 'PONG');
      } else {
        this.game.performAction(this.id, null);
      }
    } else if (actions.includes('CHOW')) {
      // 40% chance to Chow (less aggressive about opening the hand)
      if (Math.random() < 0.4) { 
        this.game.performAction(this.id, 'CHOW');
      } else {
        this.game.performAction(this.id, null);
      }
    } else {
      this.game.performAction(this.id, null);
    }
  }
}
