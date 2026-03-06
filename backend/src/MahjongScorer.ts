export interface FanResult {
  name: string;
  points: number;
}

export interface ScorerContext {
  isLastTile?: boolean;
  isKongWin?: boolean;
  isRobKong?: boolean;
  isLastDiscard?: boolean;
  prevalentWind?: string;
  seatWind?: string;
}

interface Meld {
  type: 'chow' | 'pong' | 'kong' | 'combo';
  tiles: string[];
  isConcealed: boolean;
}

interface Interpretation {
  melds: Meld[];
  pair: string;
  waitType: 'single' | 'edge' | 'closed' | 'two-way' | 'double-pong' | 'none';
  special?: 'SevenPairs' | 'ThirteenOrphans' | 'QuanBuKao';
  allTiles: string[];
  concealedTiles: string[];
  isTsumo: boolean;
}

export class MahjongScorer {
  private static valueMap: Record<string, number> = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  private static revMap = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  public static calculate(hand: string[], exposedMelds: string[][], winningTile: string, isTsumo: boolean, flowers: string[], context: ScorerContext = {}): { total: number, fans: FanResult[] } {
    const interpretations = this.generateInterpretations(hand, exposedMelds, winningTile, isTsumo);

    let bestScore = 0;
    let bestFans: FanResult[] = [];

    for (const interp of interpretations) {
      let currentFans = this.evaluateFans(interp, context);

      // Resolve exclusions
      let toRemove = new Set<string>();
      for (const f of currentFans) {
        if (EXCLUSIONS[f.name]) {
          EXCLUSIONS[f.name].forEach(ex => toRemove.add(ex));
        }
      }
      currentFans = currentFans.filter(f => !toRemove.has(f.name));

      let score = currentFans.reduce((sum, f) => sum + f.points, 0);

      // Handle 无番和 (Chicken Hand)
      if (score === 0 && currentFans.length === 0) {
        currentFans.push({ name: '无番和', points: 8 });
        score = 8;
      }

      // Add flowers (Flowers do not count towards the 8-point minimum for winning, but are added to total)
      // Actually, in Guobiao, flowers are added after. If the base score is < 8, it cannot win.
      // We will handle the 8 point check in the game logic, but we must return the total.
      const flowerPoints = flowers.length;
      let totalScore = score + flowerPoints;

      if (totalScore >= bestScore) {
        bestScore = totalScore;
        bestFans = [...currentFans];
        if (flowerPoints > 0) {
          // Ensure we don't add multiple flower entries
          bestFans = bestFans.filter(f => !f.name.startsWith('花牌'));
          bestFans.push({ name: `花牌 x${flowers.length}`, points: flowerPoints });
        }
      }
    }

    if (interpretations.length === 0) {
      return { total: 0, fans: [] };
    }

    return { total: bestScore, fans: bestFans };
  }

  private static generateInterpretations(hand: string[], exposedMelds: string[][], winningTile: string, isTsumo: boolean): Interpretation[] {
    const results: Interpretation[] = [];
    const flattenedExposed = exposedMelds.flat();
    const allTiles = [...hand, winningTile, ...flattenedExposed];
    const concealedTiles = [...hand, winningTile];

    const exposed: Meld[] = exposedMelds.map(m => ({
      type: m.length === 4 ? 'kong' : (m[0] === m[1] ? 'pong' : 'chow'),
      tiles: m,
      isConcealed: false
    }));

    // Irregular hands (only possible if no exposed melds)
    if (exposed.length === 0) {
      if (this.isThirteenOrphans(allTiles)) {
        results.push({ melds: [], pair: '', waitType: 'none', special: 'ThirteenOrphans', allTiles, concealedTiles, isTsumo });
      }
      if (this.isSevenPairs(allTiles)) {
        results.push({ melds: [], pair: '', waitType: 'none', special: 'SevenPairs', allTiles, concealedTiles, isTsumo });
      }
      if (this.isQuanBuKao(allTiles)) {
        results.push({ melds: [], pair: '', waitType: 'none', special: 'QuanBuKao', allTiles, concealedTiles, isTsumo });
      }
    }

    // Regular hands
    const structures = this.findAllWinningStructures(hand, winningTile);

    for (const struct of structures) {
      const { melds: concealedMelds, pair } = struct;

      // Determine which meld/pair contains the winning tile to mark it exposed if !isTsumo
      // We branch for each possible completion
      let foundCompletion = false;

      if (pair === winningTile) {
        results.push({
          melds: [...exposed, ...concealedMelds.map(m => ({ ...m }))],
          pair,
          waitType: 'single',
          allTiles, concealedTiles, isTsumo
        });
        foundCompletion = true;
      }

      for (let i = 0; i < concealedMelds.length; i++) {
        const m = concealedMelds[i];
        const idx = m.tiles.indexOf(winningTile);
        if (idx !== -1) {
          const newMelds = concealedMelds.map((cm, j) => ({
            ...cm,
            isConcealed: (j === i && !isTsumo) ? false : true
          }));

          let waitType: 'edge' | 'closed' | 'two-way' | 'double-pong' = 'two-way';
          if (m.type === 'pong') waitType = 'double-pong';
          else if (m.type === 'chow') {
            const vals = m.tiles.map(t => this.valueMap[t[0]]).sort((a, b) => a - b);
            const winVal = this.valueMap[winningTile[0]];
            if (winVal === vals[1]) waitType = 'closed';
            else if (winVal === vals[0] && winVal === 7) waitType = 'edge';
            else if (winVal === vals[2] && winVal === 3) waitType = 'edge';
          }

          results.push({
            melds: [...exposed, ...newMelds],
            pair,
            waitType,
            allTiles, concealedTiles, isTsumo
          });
          foundCompletion = true;
        }
      }

      // Fallback
      if (!foundCompletion) {
        results.push({
          melds: [...exposed, ...concealedMelds.map(m => ({ ...m }))],
          pair,
          waitType: 'none',
          allTiles, concealedTiles, isTsumo
        });
      }
    }

    return results;
  }

  private static findAllWinningStructures(hand: string[], winningTile: string): { melds: Meld[], pair: string }[] {
    const fullHand = [...hand, winningTile];
    const results: { melds: Meld[], pair: string }[] = [];
    const counts: Record<string, number> = {};
    fullHand.forEach(t => counts[t] = (counts[t] || 0) + 1);

    // Try normal structures
    const uniqueTiles = Object.keys(counts);
    for (const pair of uniqueTiles) {
      if (counts[pair] >= 2) {
        const remaining = { ...counts };
        remaining[pair] -= 2;
        const meldResults: Meld[][] = [];
        this.decomposeMelds(remaining, [], meldResults);
        for (const melds of meldResults) {
          results.push({ melds, pair });
        }
      }
    }

    // Try Combo Dragon structures
    const comboDragons = this.getComboDragons(fullHand);
    for (const cd of comboDragons) {
      const remaining = { ...counts };
      cd.forEach(t => remaining[t]--);

      const uniqueRemaining = Object.keys(remaining).filter(k => remaining[k] > 0);
      for (const pair of uniqueRemaining) {
        if (remaining[pair] >= 2) {
          const rest = { ...remaining };
          rest[pair] -= 2;
          const meldResults: Meld[][] = [];
          this.decomposeMelds(rest, [], meldResults);
          for (const melds of meldResults) {
            results.push({
              melds: [...melds, { type: 'combo', tiles: cd, isConcealed: true }],
              pair
            });
          }
        }
      }
    }

    return results;
  }

  private static decomposeMelds(counts: Record<string, number>, current: Meld[], results: Meld[][]) {
    const keys = Object.keys(counts).filter(k => counts[k] > 0).sort((a, b) => this.getWeight(a) - this.getWeight(b));
    if (keys.length === 0) {
      results.push([...current]);
      return;
    }
    const first = keys[0];

    // Pong
    if (counts[first] >= 3) {
      counts[first] -= 3;
      current.push({ type: 'pong', tiles: [first, first, first], isConcealed: true });
      this.decomposeMelds(counts, current, results);
      current.pop();
      counts[first] += 3;
    }

    // Chow
    if (first.length === 2 && ['萬', '條', '餅'].includes(first[1])) {
      const val = this.valueMap[first[0]];
      const suit = first[1];
      if (val && val <= 7) {
        const second = this.revMap[val + 1] + suit;
        const third = this.revMap[val + 2] + suit;
        if (counts[second] > 0 && counts[third] > 0) {
          counts[first]--; counts[second]--; counts[third]--;
          current.push({ type: 'chow', tiles: [first, second, third], isConcealed: true });
          this.decomposeMelds(counts, current, results);
          current.pop();
          counts[first]++; counts[second]++; counts[third]++;
        }
      }
    }
  }

  private static getComboDragons(tiles: string[]): string[][] {
    const suits = ['萬', '條', '餅'];
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const results = [];
    for (const p of perms) {
      const s1 = suits[p[0]], s2 = suits[p[1]], s3 = suits[p[2]];
      const req = ['一' + s1, '四' + s1, '七' + s1, '二' + s2, '五' + s2, '八' + s2, '三' + s3, '六' + s3, '九' + s3];
      const counts = this.countTiles(tiles);
      if (req.every(t => counts[t] > 0)) {
        results.push(req);
      }
    }
    return results;
  }

  private static evaluateFans(i: Interpretation, ctx: ScorerContext): FanResult[] {
    const matched: FanResult[] = [];
    for (const def of FANS) {
      if (def.check(i, ctx)) {
        matched.push({ name: def.name, points: def.points });
      }
    }
    return matched;
  }

  // --- Helper Methods ---
  private static getWeight(t: string) { return (['萬', '條', '餅'].includes(t[1]) ? { '萬': 0, '條': 10, '餅': 20 }[t[1]]! : 30) + (this.valueMap[t[0]] || 0); }
  private static countTiles(tiles: string[]) { const c: Record<string, number> = {}; tiles.forEach(t => c[t] = (c[t] || 0) + 1); return c; }
  private static isThirteenOrphans(t: string[]) {
    const req = ['一萬', '九萬', '一條', '九條', '一餅', '九餅', '东风', '南风', '西风', '北风', '红中', '發財', '白板'];
    const c = this.countTiles(t);
    return req.every(x => c[x] >= 1) && t.length === 14;
  }
  private static isSevenPairs(t: string[]) {
    if (t.length !== 14) return false;
    return Object.values(this.countTiles(t)).every(v => v === 2 || v === 4);
  }
  private static isQuanBuKao(t: string[]) {
    if (t.length !== 14) return false;
    const honors = t.filter(x => x.length !== 2);
    if (new Set(honors).size !== honors.length) return false;
    const suits = t.filter(x => x.length === 2);
    const bySuit: Record<string, number[]> = {};
    for (const x of suits) {
      if (!bySuit[x[1]]) bySuit[x[1]] = [];
      bySuit[x[1]].push(this.valueMap[x[0]]);
    }
    const reqs = [[1, 4, 7], [2, 5, 8], [3, 6, 9]];
    const usedReqs = new Set<number>();
    for (const s in bySuit) {
      const vals = bySuit[s].sort((a, b) => a - b);
      if (new Set(vals).size !== vals.length) return false;
      let matchedReq = -1;
      for (let r = 0; r < 3; r++) {
        if (vals.every(v => reqs[r].includes(v))) { matchedReq = r; break; }
      }
      if (matchedReq === -1 || usedReqs.has(matchedReq)) return false;
      usedReqs.add(matchedReq);
    }
    return true;
  }
}

// --- Fan Definitions & Utilities ---
const getVal = (t: string) => ({ '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 }[t[0]] || 0);
const getSuit = (t: string) => t.length === 2 ? t[1] : (['东风', '南风', '西风', '北风'].includes(t) ? '风' : '箭');
const isHonor = (t: string) => getSuit(t) === '风' || getSuit(t) === '箭';
const isTerminal = (t: string) => getVal(t) === 1 || getVal(t) === 9;
const isTerminalOrHonor = (t: string) => isTerminal(t) || isHonor(t);
const countMelds = (i: Interpretation, fn: (m: Meld) => boolean) => i.melds.filter(fn).length;

const FANS: { name: string, points: number, check: (i: Interpretation, ctx: ScorerContext) => boolean }[] = [
  // 88
  { name: '大四喜', points: 88, check: i => countMelds(i, m => m.type !== 'chow' && getSuit(m.tiles[0]) === '风') === 4 },
  { name: '大三元', points: 88, check: i => countMelds(i, m => m.type !== 'chow' && getSuit(m.tiles[0]) === '箭') === 3 },
  { name: '绿一色', points: 88, check: i => i.allTiles.every(t => ['二條', '三條', '四條', '六條', '八條', '發財'].includes(t)) },
  {
    name: '九莲宝灯', points: 88, check: i => {
      if (i.melds.some(m => !m.isConcealed && m.type !== 'kong')) return false;
      if (i.melds.filter(m => !m.isConcealed).length > 0) return false;
      const suit = getSuit(i.allTiles[0]);
      if (suit === '风' || suit === '箭') return false;
      if (!i.allTiles.every(t => getSuit(t) === suit)) return false;
      const counts = MahjongScorer['countTiles'](i.allTiles);
      if (counts['一' + suit] < 3 || counts['九' + suit] < 3) return false;
      for (let v = 2; v <= 8; v++) if (!counts[MahjongScorer['revMap'][v] + suit]) return false;
      return true;
    }
  },
  { name: '四杠', points: 88, check: i => countMelds(i, m => m.type === 'kong') === 4 },
  {
    name: '连七对', points: 88, check: i => {
      if (i.special !== 'SevenPairs') return false;
      if (new Set(i.allTiles.map(getSuit)).size !== 1) return false;
      const suit = getSuit(i.allTiles[0]);
      if (suit === '风' || suit === '箭') return false;
      const vals = Array.from(new Set(i.allTiles.map(getVal))).sort((a, b) => a - b);
      return vals.length === 7 && vals[6] - vals[0] === 6;
    }
  },
  { name: '十三幺', points: 88, check: i => i.special === 'ThirteenOrphans' },

  // 64
  { name: '清么九', points: 64, check: i => !i.special && i.melds.every(m => m.type !== 'chow' && isTerminal(m.tiles[0])) && isTerminal(i.pair) },
  { name: '小四喜', points: 64, check: i => !i.special && countMelds(i, m => m.type !== 'chow' && getSuit(m.tiles[0]) === '风') === 3 && getSuit(i.pair) === '风' },
  { name: '小三元', points: 64, check: i => !i.special && countMelds(i, m => m.type !== 'chow' && getSuit(m.tiles[0]) === '箭') === 2 && getSuit(i.pair) === '箭' },
  { name: '字一色', points: 64, check: i => i.allTiles.every(isHonor) },
  { name: '四暗刻', points: 64, check: i => countMelds(i, m => m.type !== 'chow' && m.isConcealed) === 4 },
  {
    name: '一色双龙会', points: 64, check: i => {
      if (i.special || i.pair[0] !== '五') return false;
      const suit = getSuit(i.pair);
      if (suit === '风' || suit === '箭') return false;
      const chows = i.melds.filter(m => m.type === 'chow' && getSuit(m.tiles[0]) === suit);
      if (chows.length !== 4) return false;
      const starts = chows.map(m => getVal(m.tiles[0])).sort((a, b) => a - b);
      return starts.join('') === '1177';
    }
  },

  // 48
  {
    name: '一色四同顺', points: 48, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const counts = MahjongScorer['countTiles'](chows.map(c => c.tiles[0]));
      return Object.values(counts).some(c => c === 4);
    }
  },
  {
    name: '一色四节高', points: 48, check: i => {
      if (i.special) return false;
      const pongs = i.melds.filter(m => m.type === 'pong' || m.type === 'kong');
      if (pongs.length < 4) return false;
      const bySuit: Record<string, number[]> = {};
      pongs.forEach(p => {
        const s = getSuit(p.tiles[0]);
        if (!bySuit[s]) bySuit[s] = [];
        bySuit[s].push(getVal(p.tiles[0]));
      });
      return Object.values(bySuit).some(vals => {
        if (vals.length < 4) return false;
        vals.sort((a, b) => a - b);
        return Array.from(new Set(vals)).length === 4 && vals[3] - vals[0] === 3;
      });
    }
  },

  // 32
  {
    name: '一色四步高', points: 32, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      if (chows.length < 4) return false;
      const bySuit: Record<string, number[]> = {};
      chows.forEach(c => {
        const s = getSuit(c.tiles[0]);
        if (!bySuit[s]) bySuit[s] = [];
        bySuit[s].push(getVal(c.tiles[0]));
      });
      return Object.values(bySuit).some(vals => {
        if (vals.length < 4) return false;
        vals.sort((a, b) => a - b);
        return (vals[1] - vals[0] === 1 && vals[2] - vals[1] === 1 && vals[3] - vals[2] === 1) ||
          (vals[1] - vals[0] === 2 && vals[2] - vals[1] === 2 && vals[3] - vals[2] === 2);
      });
    }
  },
  { name: '三杠', points: 32, check: i => countMelds(i, m => m.type === 'kong') === 3 },
  { name: '混么九', points: 32, check: i => !i.special && i.melds.every(m => m.type !== 'chow' && isTerminalOrHonor(m.tiles[0])) && isTerminalOrHonor(i.pair) && i.allTiles.some(isHonor) && i.allTiles.some(isTerminal) },

  // 24
  { name: '七对', points: 24, check: i => i.special === 'SevenPairs' },
  { name: '七星不靠', points: 24, check: i => i.special === 'QuanBuKao' && i.allTiles.filter(isHonor).length === 7 },
  { name: '全双刻', points: 24, check: i => !i.special && i.melds.every(m => m.type !== 'chow' && [2, 4, 6, 8].includes(getVal(m.tiles[0]))) && [2, 4, 6, 8].includes(getVal(i.pair)) },
  { name: '清一色', points: 24, check: i => new Set(i.allTiles.map(getSuit)).size === 1 && !isHonor(i.allTiles[0]) },
  {
    name: '一色三同顺', points: 24, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const counts = MahjongScorer['countTiles'](chows.map(c => c.tiles[0]));
      return Object.values(counts).some(c => c === 3);
    }
  },
  {
    name: '一色三节高', points: 24, check: i => {
      if (i.special) return false;
      const pongs = i.melds.filter(m => m.type === 'pong' || m.type === 'kong');
      const bySuit: Record<string, number[]> = {};
      pongs.forEach(p => {
        const s = getSuit(p.tiles[0]);
        if (!bySuit[s]) bySuit[s] = [];
        bySuit[s].push(getVal(p.tiles[0]));
      });
      return Object.values(bySuit).some(vals => {
        if (vals.length < 3) return false;
        vals.sort((a, b) => a - b);
        for (let j = 0; j <= vals.length - 3; j++) {
          if (vals[j + 1] === vals[j] + 1 && vals[j + 2] === vals[j + 1] + 1) return true;
        }
        return false;
      });
    }
  },
  { name: '全大', points: 24, check: i => i.allTiles.every(t => getVal(t) >= 7 && !isHonor(t)) },
  { name: '全中', points: 24, check: i => i.allTiles.every(t => getVal(t) >= 4 && getVal(t) <= 6 && !isHonor(t)) },
  { name: '全小', points: 24, check: i => i.allTiles.every(t => getVal(t) >= 1 && getVal(t) <= 3 && !isHonor(t)) },

  // 16
  {
    name: '清龙', points: 16, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const bySuit: Record<string, number[]> = {};
      chows.forEach(c => {
        const s = getSuit(c.tiles[0]);
        if (!bySuit[s]) bySuit[s] = [];
        bySuit[s].push(getVal(c.tiles[0]));
      });
      return Object.values(bySuit).some(vals => vals.includes(1) && vals.includes(4) && vals.includes(7));
    }
  },
  {
    name: '三色双龙会', points: 16, check: i => {
      if (i.special || getVal(i.pair) !== 5) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      if (chows.length !== 4) return false;
      const bySuit: Record<string, number[]> = {};
      chows.forEach(c => {
        const s = getSuit(c.tiles[0]);
        if (!bySuit[s]) bySuit[s] = [];
        bySuit[s].push(getVal(c.tiles[0]));
      });
      const suits = Object.keys(bySuit);
      if (suits.length !== 2 || suits.includes(getSuit(i.pair))) return false;
      return Object.values(bySuit).every(vals => vals.length === 2 && vals.includes(1) && vals.includes(7));
    }
  },
  {
    name: '一色三步高', points: 16, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const bySuit: Record<string, number[]> = {};
      chows.forEach(c => {
        const s = getSuit(c.tiles[0]);
        if (!bySuit[s]) bySuit[s] = [];
        bySuit[s].push(getVal(c.tiles[0]));
      });
      return Object.values(bySuit).some(vals => {
        if (vals.length < 3) return false;
        vals.sort((a, b) => a - b);
        for (let j = 0; j <= vals.length - 3; j++) {
          if ((vals[j + 1] - vals[j] === 1 && vals[j + 2] - vals[j + 1] === 1) ||
            (vals[j + 1] - vals[j] === 2 && vals[j + 2] - vals[j + 1] === 2)) return true;
        }
        return false;
      });
    }
  },
  { name: '全带五', points: 16, check: i => !i.special && i.melds.every(m => m.tiles.some(t => getVal(t) === 5)) && getVal(i.pair) === 5 },
  {
    name: '三同刻', points: 16, check: i => {
      if (i.special) return false;
      const pongs = i.melds.filter(m => m.type === 'pong' || m.type === 'kong');
      const counts = MahjongScorer['countTiles'](pongs.map(p => getVal(p.tiles[0]).toString()));
      return Object.values(counts).some(c => c >= 3);
    }
  },
  { name: '三暗刻', points: 16, check: i => countMelds(i, m => m.type !== 'chow' && m.isConcealed) === 3 },

  // 12
  { name: '全不靠', points: 12, check: i => i.special === 'QuanBuKao' },
  { name: '组合龙', points: 12, check: i => i.melds.some(m => m.type === 'combo') },
  { name: '大于五', points: 12, check: i => i.allTiles.every(t => getVal(t) >= 6 && !isHonor(t)) },
  { name: '小于五', points: 12, check: i => i.allTiles.every(t => getVal(t) <= 4 && !isHonor(t)) },
  { name: '三风刻', points: 12, check: i => countMelds(i, m => m.type !== 'chow' && getSuit(m.tiles[0]) === '风') === 3 },

  // 8
  {
    name: '花龙', points: 8, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const has1 = chows.some(c => getVal(c.tiles[0]) === 1);
      const has4 = chows.some(c => getVal(c.tiles[0]) === 4);
      const has7 = chows.some(c => getVal(c.tiles[0]) === 7);
      if (!has1 || !has4 || !has7) return false;
      const s1 = chows.find(c => getVal(c.tiles[0]) === 1)!.tiles[0];
      const s4 = chows.find(c => getVal(c.tiles[0]) === 4)!.tiles[0];
      const s7 = chows.find(c => getVal(c.tiles[0]) === 7)!.tiles[0];
      return new Set([getSuit(s1), getSuit(s4), getSuit(s7)]).size === 3;
    }
  },
  { name: '推不倒', points: 8, check: i => i.allTiles.every(t => ['一餅', '二餅', '三餅', '四餅', '五餅', '八餅', '九餅', '二條', '四條', '五條', '六條', '八條', '九條', '白板'].includes(t)) },
  {
    name: '三色三同顺', points: 8, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const byVal: Record<number, string[]> = {};
      chows.forEach(c => {
        const v = getVal(c.tiles[0]);
        if (!byVal[v]) return;
        byVal[v].push(getSuit(c.tiles[0]));
      });
      return Object.values(byVal).some(suits => new Set(suits).size >= 3);
    }
  },
  {
    name: '三色三节高', points: 8, check: i => {
      if (i.special) return false;
      const pongs = i.melds.filter(m => m.type === 'pong' || m.type === 'kong');
      if (pongs.length < 3) return false;
      for (let j = 0; j < pongs.length; j++) {
        for (let k = j + 1; k < pongs.length; k++) {
          for (let l = k + 1; l < pongs.length; l++) {
            const v1 = getVal(pongs[j].tiles[0]), v2 = getVal(pongs[k].tiles[0]), v3 = getVal(pongs[l].tiles[0]);
            const s1 = getSuit(pongs[j].tiles[0]), s2 = getSuit(pongs[k].tiles[0]), s3 = getSuit(pongs[l].tiles[0]);
            const vals = [v1, v2, v3].sort((a, b) => a - b);
            const suits = new Set([s1, s2, s3]);
            if (suits.size === 3 && vals[1] - vals[0] === 1 && vals[2] - vals[1] === 1 && !suits.has('风') && !suits.has('箭')) return true;
          }
        }
      }
      return false;
    }
  },
  { name: '妙手回春', points: 8, check: (i, c) => !!c.isLastTile && i.isTsumo },
  { name: '海底捞月', points: 8, check: (i, c) => !!c.isLastTile && !i.isTsumo },
  { name: '杠上开花', points: 8, check: (i, c) => !!c.isKongWin && i.isTsumo },
  { name: '抢杠和', points: 8, check: (i, c) => !!c.isRobKong },

  // 6
  { name: '碰碰和', points: 6, check: i => !i.special && countMelds(i, m => m.type === 'pong' || m.type === 'kong') === 4 },
  {
    name: '混一色', points: 6, check: i => {
      const suits = new Set(i.allTiles.map(getSuit));
      return suits.size === 2 && (suits.has('风') || suits.has('箭'));
    }
  },
  {
    name: '三色三步高', points: 6, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      if (chows.length < 3) return false;
      for (let j = 0; j < chows.length; j++) {
        for (let k = j + 1; k < chows.length; k++) {
          for (let l = k + 1; l < chows.length; l++) {
            const c1 = chows[j], c2 = chows[k], c3 = chows[l];
            const vals = [getVal(c1.tiles[0]), getVal(c2.tiles[0]), getVal(c3.tiles[0])].sort((a, b) => a - b);
            const suits = new Set([getSuit(c1.tiles[0]), getSuit(c2.tiles[0]), getSuit(c3.tiles[0])]);
            if (suits.size === 3 && vals[1] - vals[0] === 1 && vals[2] - vals[1] === 1) return true;
          }
        }
      }
      return false;
    }
  },
  {
    name: '五门齐', points: 6, check: i => {
      const suits = new Set(i.allTiles.map(getSuit));
      return suits.has('萬') && suits.has('條') && suits.has('餅') && suits.has('风') && suits.has('箭');
    }
  },
  { name: '全求人', points: 6, check: i => !i.isTsumo && countMelds(i, m => !m.isConcealed) === 4 && i.waitType === 'single' },
  { name: '双暗杠', points: 6, check: i => countMelds(i, m => m.type === 'kong' && m.isConcealed) === 2 },
  { name: '双箭刻', points: 6, check: i => countMelds(i, m => m.type !== 'chow' && getSuit(m.tiles[0]) === '箭') === 2 },

  // 4
  { name: '全带么', points: 4, check: i => !i.special && i.melds.every(m => m.tiles.some(isTerminalOrHonor)) && isTerminalOrHonor(i.pair) },
  { name: '不求人', points: 4, check: i => i.isTsumo && countMelds(i, m => !m.isConcealed) === 0 },
  { name: '双明杠', points: 4, check: i => countMelds(i, m => m.type === 'kong' && !m.isConcealed) === 2 },
  { name: '和绝张', points: 4, check: (i, c) => !!c.isLastDiscard },

  // 2
  { name: '箭刻', points: 2, check: i => countMelds(i, m => m.type !== 'chow' && getSuit(m.tiles[0]) === '箭') === 1 },
  { name: '圈风刻', points: 2, check: (i, c) => countMelds(i, m => m.type !== 'chow' && m.tiles[0] === (c.prevalentWind || '东风')) >= 1 },
  { name: '门风刻', points: 2, check: (i, c) => countMelds(i, m => m.type !== 'chow' && m.tiles[0] === (c.seatWind || '东风')) >= 1 },
  { name: '门前清', points: 2, check: i => !i.isTsumo && countMelds(i, m => !m.isConcealed && m.type !== 'kong') === 0 && countMelds(i, m => m.type === 'kong' && !m.isConcealed) === 0 }, // Wait, kong logic is nuanced, let's just say 0 exposed melds
  { name: '平和', points: 2, check: i => !i.special && countMelds(i, m => m.type === 'chow') === 4 && !isHonor(i.pair) },
  {
    name: '四归一', points: 2, check: i => {
      const counts = MahjongScorer['countTiles'](i.allTiles);
      const kongs = i.melds.filter(m => m.type === 'kong').map(m => m.tiles[0]);
      return Object.keys(counts).some(k => counts[k] === 4 && !kongs.includes(k));
    }
  },
  {
    name: '双同刻', points: 2, check: i => {
      if (i.special) return false;
      const pongs = i.melds.filter(m => m.type === 'pong' || m.type === 'kong');
      const counts = MahjongScorer['countTiles'](pongs.map(p => getVal(p.tiles[0]).toString()));
      return Object.values(counts).some(c => c === 2);
    }
  },
  { name: '双暗刻', points: 2, check: i => countMelds(i, m => m.type !== 'chow' && m.isConcealed) === 2 },
  { name: '暗杠', points: 2, check: i => countMelds(i, m => m.type === 'kong' && m.isConcealed) === 1 },
  { name: '断么', points: 2, check: i => !i.allTiles.some(isTerminalOrHonor) },

  // 1
  {
    name: '一般高', points: 1, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const counts = MahjongScorer['countTiles'](chows.map(c => c.tiles[0]));
      return Object.values(counts).some(c => c === 2);
    }
  },
  {
    name: '喜相逢', points: 1, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const byVal: Record<number, string[]> = {};
      chows.forEach(c => {
        const v = getVal(c.tiles[0]);
        if (!byVal[v]) return;
        byVal[v].push(getSuit(c.tiles[0]));
      });
      return Object.values(byVal).some(suits => new Set(suits).size === 2);
    }
  },
  {
    name: '连六', points: 1, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const bySuit: Record<string, number[]> = {};
      chows.forEach(c => {
        const s = getSuit(c.tiles[0]);
        if (!bySuit[s]) return;
        bySuit[s].push(getVal(c.tiles[0]));
      });
      return Object.values(bySuit).some(vals => {
        if (vals.length < 2) return false;
        vals.sort((a, b) => a - b);
        for (let j = 0; j <= vals.length - 2; j++) if (vals[j + 1] - vals[j] === 3) return true;
        return false;
      });
    }
  },
  {
    name: '老少副', points: 1, check: i => {
      if (i.special) return false;
      const chows = i.melds.filter(m => m.type === 'chow');
      const bySuit: Record<string, number[]> = {};
      chows.forEach(c => {
        const s = getSuit(c.tiles[0]);
        if (!bySuit[s]) return;
        bySuit[s].push(getVal(c.tiles[0]));
      });
      return Object.values(bySuit).some(vals => vals.includes(1) && vals.includes(7));
    }
  },
  { name: '么九刻', points: 1, check: i => countMelds(i, m => m.type !== 'chow' && isTerminalOrHonor(m.tiles[0])) === 1 },
  { name: '明杠', points: 1, check: i => countMelds(i, m => m.type === 'kong' && !m.isConcealed) === 1 },
  {
    name: '缺一门', points: 1, check: i => {
      const suits = new Set(i.allTiles.map(getSuit));
      let missing = 0;
      if (!suits.has('萬')) missing++;
      if (!suits.has('條')) missing++;
      if (!suits.has('餅')) missing++;
      return missing === 1;
    }
  },
  { name: '无字', points: 1, check: i => !i.allTiles.some(isHonor) },
  { name: '边张', points: 1, check: i => i.waitType === 'edge' },
  { name: '坎张', points: 1, check: i => i.waitType === 'closed' },
  { name: '单钓将', points: 1, check: i => i.waitType === 'single' },
  { name: '自摸', points: 1, check: i => i.isTsumo }
];

const EXCLUSIONS: Record<string, string[]> = {
  '大四喜': ['圈风刻', '门风刻', '三风刻', '碰碰和', '幺九刻'],
  '大三元': ['箭刻', '双箭刻', '幺九刻'],
  '绿一色': ['混一色'],
  '九莲宝灯': ['清一色', '门前清', '幺九刻', '不求人'],
  '四杠': ['碰碰和', '三杠', '双明杠', '双暗杠', '明杠', '暗杠', '单钓将'],
  '连七对': ['清一色', '不求人', '单钓将', '门前清', '七对'],
  '十三幺': ['五门齐', '不求人', '单钓将', '门前清', '混么九'],
  '清么九': ['碰碰和', '双同刻', '幺九刻', '无字', '混么九', '全带么'],
  '小四喜': ['三风刻', '幺九刻'],
  '小三元': ['箭刻', '双箭刻', '幺九刻'],
  '字一色': ['碰碰和', '幺九刻', '全带么'],
  '四暗刻': ['门前清', '碰碰和', '三暗刻', '双暗刻', '不求人'],
  '一色双龙会': ['平和', '七对', '清一色', '一般高', '老少副', '无字'],
  '一色四同顺': ['一色三同顺', '一般高', '四归一', '平和'],
  '一色四节高': ['一色三节高', '碰碰和'],
  '一色四步高': ['一色三步高', '连六', '老少副'],
  '三杠': ['双明杠', '双暗杠', '明杠', '暗杠'],
  '混么九': ['碰碰和', '全带么', '幺九刻'],
  '七对': ['门前清', '单钓将', '不求人'],
  '七星不靠': ['全不靠', '五门齐', '门前清', '单钓将', '不求人'],
  '全双刻': ['碰碰和', '断么', '无字'],
  '清一色': ['无字'],
  '一色三同顺': ['一般高'],
  '一色三节高': [],
  '全大': ['无字', '大于五'],
  '全中': ['无字', '断么'],
  '全小': ['无字', '小于五'],
  '清龙': ['连六', '老少副'],
  '三色双龙会': ['喜相逢', '老少副', '平和', '无字'],
  '一色三步高': [],
  '全带五': ['断么'],
  '三同刻': ['双同刻'],
  '三暗刻': ['双暗刻'],
  '全不靠': ['五门齐', '门前清', '单钓将', '不求人'],
  '组合龙': [],
  '大于五': ['无字'],
  '小于五': ['无字'],
  '三风刻': [],
  '花龙': [],
  '推不倒': ['缺一门'],
  '三色三同顺': ['喜相逢'],
  '三色三节高': [],
  '妙手回春': ['自摸'],
  '海底捞月': [],
  '杠上开花': ['自摸'],
  '抢杠和': ['和绝张'],
  '碰碰和': [],
  '混一色': [],
  '五门齐': [],
  '全求人': ['单钓将'],
  '双暗杠': ['暗杠'],
  '双箭刻': ['箭刻'],
  '全带么': [],
  '不求人': ['门前清', '自摸'],
  '双明杠': ['明杠'],
  '和绝张': [],
  '门前清': [],
  '平和': ['无字'],
  '四归一': [],
  '双同刻': [],
  '双暗刻': [],
  '暗杠': [],
  '断么': ['无字']
};
