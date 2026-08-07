export type Player = "player" | "computer";

export interface Destroyable {
  destroy?(): void;
}

export interface BaseGameState {
  phase: string;
  message: string;
  winner: Player | null;
}

export interface BotStrategy<State, Action> {
  chooseAction(state: Readonly<State>): Action;
}
