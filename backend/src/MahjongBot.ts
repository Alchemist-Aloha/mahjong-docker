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
    const countInHand = fullHand.filter(t => t === tile).length;
    
    // Calculate Visibility: tiles already seen in discards and melds
    let visibleCount = 0;
    Object.values(this.game.discards).forEach(list => {
      visibleCount += list.filter(t => t === tile).length;
    });
    Object.values(this.game.melds).forEach(playerMelds => {
      playerMelds.forEach(meld => {
        visibleCount += meld.filter(t => t === tile).length;
      });
    });

    const remainingCount = 4 - visibleCount;
    // if (remainingCount <= 0 && countInHand === 1) return -100; // Tile is dead, discard immediately

    let score = 0;

    // 1. Sets/Pairs potential
    if (countInHand >= 3) score += 120; 
    if (countInHand === 2) score += 60;

    // 2. Suit/Value Logic
    const valueMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
    const revMap = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const num = valueMap[tile[0]];
    const suit = tile[1];

    if (!num) {
      // Honors (Winds & Dragons) - Value is purely based on triplets/pairs
      if (countInHand === 1) {
        // Isolated honor: check if others have discarded it (Safe Play)
        if (visibleCount > 0) return -10; 
        return 5; 
      }
      return score;
    }

    // Terminals are less flexible
    score += (num === 1 || num === 9) ? 5 : (num === 2 || num === 8) ? 15 : 25;

    // 3. Sequence Potential (Neighbors)
    const h = new Set(fullHand);
    let sequenceUtility = 0;

    if (num > 1 && h.has(`${revMap[num - 1]}${suit}`)) sequenceUtility += 30;
    if (num < 9 && h.has(`${revMap[num + 1]}${suit}`)) sequenceUtility += 30;
    if (num > 2 && h.has(`${revMap[num - 2]}${suit}`)) sequenceUtility += 15;
    if (num < 8 && h.has(`${revMap[num + 2]}${suit}`)) sequenceUtility += 15;

    score += sequenceUtility;

    // 4. Rarity Penalty: if the tiles needed to complete a set are visible, reduce score
    if (sequenceUtility > 0 || countInHand > 1) {
      score += (remainingCount * 5); 
    } else {
      score -= (visibleCount * 10); // Isolated and visible? Trash it.
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
    } else {
      const chowActions = actions.filter(a => a.startsWith('CHOW'));
      if (chowActions.length > 0) {
        // 40% chance to Chow (less aggressive about opening the hand)
        if (Math.random() < 0.4) {
          const chosenChow = chowActions[Math.floor(Math.random() * chowActions.length)];
          this.game.performAction(this.id, chosenChow);
        } else {
          this.game.performAction(this.id, null);
        }
      } else {
        this.game.performAction(this.id, null);
      }
    }
  }
}
