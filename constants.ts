
export const COLORS = {
  background: '#050510',
  player: '#00f3ff', // Cyan
  playerGlow: '#00f3ff',
  obstacle: '#ff00ff', // Magenta
  obstacleGlow: '#ff00ff',
  collectible: '#39ff14', // Neon Green
  collectibleGlow: '#39ff14',
  roadLine: '#2d2d44',
  text: '#ffee00',
  grid: '#1a1a2e',
  danger: '#ff0000'
};

export const CONSTANTS = {
  PLAYER_WIDTH: 40,
  PLAYER_HEIGHT: 60,
  LANE_COUNT: 4,
  BASE_SPEED: 15,     // Was 10. Started 1.5x faster.
  MAX_SPEED: 60,      // Was 30. Increased cap.
  SPEED_INCREMENT: 0.01, // Was 0.002. Accelerates much faster (approx +0.6 speed per second).
  INVINCIBLE_TIME: 3000, // ms
  PARTICLE_COUNT: 20,
  
  // Energy System
  MAX_ENERGY: 100,
  ENERGY_DECAY: 0.15, // How much energy opens per frame
  ENERGY_GAIN: 35     // Was 25. Increased to balance fewer green spawns.
};
