export interface GameModule {
  readonly slug: string;
  init(canvas: HTMLCanvasElement, opts: GameOpts): GameHandle;
}

export interface GameOpts {
  rng: () => number;
  onScore(score: number): void;
  onGameOver(finalScore: number): void;
}

export interface GameHandle {
  destroy(): void;
}
