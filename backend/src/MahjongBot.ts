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
    // A better AI would avoid discarding tiles that form melds
    this.game.handleDiscard(this.id, 0);
  }
}
