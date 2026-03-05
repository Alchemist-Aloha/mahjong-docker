export interface Player {
  id: string;
  name: string;
  ready: boolean;
  isBot: boolean;
  isOnline: boolean;
  totalScore: number;
  handSize?: number;
  isDealer?: boolean;
}

export interface Room {
  id: string;
  players: Record<string, Player>;
  host: string;
}

export interface FanResult {
  name: string;
  points: number;
}

export interface GameOverData {
  winner?: string;
  type?: string;
  message?: string;
  score?: {
    total: number;
    fans: FanResult[];
  };
  hand?: string[];
  melds?: string[][];
  winningTile?: string;
}

export interface GameState {
  currentTurn: string;
  dealer: string;
  hand: string[];
  drawnTile: string | null;
  melds: Record<string, string[][]>;
  flowers: Record<string, string[]>;
  deckSize: number;
  discards: Record<string, string[]>;
  pendingActionTile: string | null;
  possibleActions: string[];
  roundOver: boolean;
  roundWinner: string | null;
  nextRoundReady: Record<string, boolean>;
  players: Player[];
  logs: string[];
}
