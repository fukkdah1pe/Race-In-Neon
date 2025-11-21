
export const COLORS = {
  background: '#050510',
  player: '#00f3ff', // Голубой (Циан)
  playerGlow: '#00f3ff',
  obstacle: '#ff00ff', // Маджента
  obstacleGlow: '#ff00ff',
  collectible: '#39ff14', // Неоновый зеленый
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
  BASE_SPEED: 15,     // Было 10. Начало в 1.5 раза быстрее.
  MAX_SPEED: 60,      // Было 30. Увеличен лимит.
  SPEED_INCREMENT: 0.01, // Было 0.002. Ускоряется намного быстрее.
  INVINCIBLE_TIME: 3000, // мс
  PARTICLE_COUNT: 20,
  
  // Система энергии
  MAX_ENERGY: 100,
  ENERGY_DECAY: 0.25, // Уменьшено, чтобы соответствовать спавну раз в 5 сек
  ENERGY_GAIN: 100    // Увеличено до полного восстановления
};