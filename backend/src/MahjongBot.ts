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
    // We prioritize discarding tiles that don't form pairs or sequences if we had a more complex AI
    this.game.handleDiscard(this.id, 0);
  }

  public handlePotentialAction(tile: string, actions: string[]) {
    // AI Strategy: Always Pong or Kong if possible to simplify the game
    // In a real game, bots might choose to skip to keep their hand closed
    if (actions.includes('KONG')) {
      this.game.performAction(this.id, 'KONG');
    } else if (actions.includes('PONG')) {
      this.game.performAction(this.id, 'PONG');
    } else {
      this.game.performAction(this.id, null);
    }
  }
}
