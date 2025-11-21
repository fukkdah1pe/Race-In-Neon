
export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  speedY?: number;
  type: 'OBSTACLE' | 'COLLECTIBLE';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface GameConfig {
  speed: number;
  laneCount: number;
  score: number;
  highScore: number;
  isInvincible: boolean;
  invincibleTimer: number;
  energy: number;
}