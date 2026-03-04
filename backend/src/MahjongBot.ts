import { MahjongGame } from './MahjongGame';

export class MahjongBot {
  public id: string;
  private game: MahjongGame;

  constructor(id: string, game: MahjongGame) {
    this.id = id;
    this.game = game;
  }

  public playTurn() {
    // Basic AI: discard a random tile for now
    this.game.handleDiscard(this.id, 0);
  }

  public handlePotentialAction(tile: string, actions: string[]) {
    // AI Strategy: Win if possible, then Kong, then Pong, then Chow.
    // In a more advanced AI, Chow/Pong might be skipped to keep the hand closed.
    if (actions.includes('WIN')) {
      this.game.performAction(this.id, 'WIN');
    } else if (actions.includes('KONG')) {
      this.game.performAction(this.id, 'KONG');
    } else if (actions.includes('PONG')) {
      this.game.performAction(this.id, 'PONG');
    } else if (actions.includes('CHOW')) {
      // Bots will chow if it completes a sequence, just to keep the game active.
      this.game.performAction(this.id, 'CHOW');
    } else {
      this.game.performAction(this.id, null);
    }
  }
}
