import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Entity, Particle, GameConfig, FloatingText } from '../types';
import { COLORS, CONSTANTS } from '../constants';
import { soundManager } from '../utils/audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  onCrash: () => void;
  reviveTrigger: number; // Инкремент для активации воскрешения
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  setScore, 
  onCrash,
  reviveTrigger 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Изменяемое состояние игры (ref для избежания ре-рендеров в цикле)
  const playerRef = useRef<Entity>({ x: 0, y: 0, width: CONSTANTS.PLAYER_WIDTH, height: CONSTANTS.PLAYER_HEIGHT, color: COLORS.player, type: 'OBSTACLE' });
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const gameConfigRef = useRef<GameConfig>({
    speed: CONSTANTS.BASE_SPEED,
    laneCount: CONSTANTS.LANE_COUNT,
    score: 0,
    highScore: 0,
    isInvincible: false,
    invincibleTimer: 0,
    energy: CONSTANTS.MAX_ENERGY
  });
  
  // Таймер спавна топлива
  const nextFuelSpawnTimeRef = useRef(0);

  // Состояние ввода
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const touchInputRef = useRef<'LEFT' | 'RIGHT' | null>(null);
  
  // Анимация дороги
  const roadOffsetRef = useRef(0);
  const lastTimeRef = useRef(0);

  // Инициализация/Сброс игры
  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Центрируем игрока
    playerRef.current.x = canvas.width / 2 - CONSTANTS.PLAYER_WIDTH / 2;
    playerRef.current.y = canvas.height - CONSTANTS.PLAYER_HEIGHT - 100;
    
    // Сброс препятствий и частиц
    entitiesRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    
    // Сброс конфига
    gameConfigRef.current.speed = CONSTANTS.BASE_SPEED;
    gameConfigRef.current.score = 0;
    gameConfigRef.current.isInvincible = false;
    gameConfigRef.current.energy = CONSTANTS.MAX_ENERGY;
    
    // Инициализация таймера спавна (первое топливо через 2с)
    nextFuelSpawnTimeRef.current = performance.now() + 2000;

    setScore(0);
  }, [setScore]);

  // Обработка воскрешения
  useEffect(() => {
    if (reviveTrigger > 0) {
      gameConfigRef.current.isInvincible = true;
      gameConfigRef.current.invincibleTimer = performance.now() + CONSTANTS.INVINCIBLE_TIME;
      gameConfigRef.current.energy = CONSTANTS.MAX_ENERGY; // Полный бак при воскрешении
      
      // Сброс таймера топлива, чтобы оно появилось вскоре после воскрешения
      nextFuelSpawnTimeRef.current = performance.now() + 5000;

      // Очистка ближайших препятствий для безопасного старта
      const safeZoneY = playerRef.current.y - 300;
      entitiesRef.current = entitiesRef.current.filter(obs => obs.y < safeZoneY);
      
      // Возобновление игры
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviveTrigger]);

  // Основной игровой цикл
  const gameLoop = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) return;
    
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    update(deltaTime, time);
    draw();

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState]);

  // Запуск цикла при начале игры
  useEffect(() => {
    if (gameState === GameState.PLAYING && reviveTrigger === 0) {
      initGame();
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else if (gameState === GameState.MENU) {
      // Рисуем фон меню
      drawMenuBackground();
    }
    
    return () => cancelAnimationFrame(requestRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, gameLoop, initGame]);

  const spawnEntity = (canvasWidth: number, forceType?: 'COLLECTIBLE' | 'OBSTACLE') => {
    // Логика: 
    // Если передан forceType (например, COLLECTIBLE), спавним сразу.
    // Если не передан, кидаем кубик на случайный спавн OBSTACLE.
    
    const isForced = forceType !== undefined;
    const shouldSpawnObstacle = !isForced && Math.random() < 0.12; // 12% шанс спавна препятствия

    if (isForced || shouldSpawnObstacle) {
      const laneWidth = canvasWidth / CONSTANTS.LANE_COUNT;
      const lane = Math.floor(Math.random() * CONSTANTS.LANE_COUNT);
      
      const type = forceType || 'OBSTACLE';
      const isCollectible = type === 'COLLECTIBLE';
      const size = isCollectible ? 30 : CONSTANTS.PLAYER_WIDTH;
      
      // Расчет скорости
      let entitySpeed = gameConfigRef.current.speed;
      
      if (!isCollectible) {
        const rand = Math.random();
        if (rand < 0.25) {
            // 25% шанс СУПЕР БЫСТРОГО (3x - 4x скорости)
            entitySpeed *= (3.0 + Math.random());
        } else if (rand < 0.5) {
            // 25% шанс БЫСТРОГО (1.5x - 2x скорости)
            entitySpeed *= (1.5 + Math.random() * 0.5);
        } else {
            // 50% шанс НОРМАЛЬНОЙ вариации скорости
            entitySpeed *= (0.8 + Math.random() * 0.4);
        }
      }

      const entity: Entity = {
        x: lane * laneWidth + (laneWidth - size) / 2,
        y: -200, // Спавним выше экрана для разгона
        width: size,
        height: size,
        color: isCollectible ? COLORS.collectible : COLORS.obstacle,
        speedY: entitySpeed,
        type: type,
        bonusAwarded: false
      };
      
      // Проверка на наложение с существующими объектами
      const overlap = entitiesRef.current.some(o => Math.abs(o.y - entity.y) < 150 && o.x === entity.x);
      if (!overlap) {
        entitiesRef.current.push(entity);
      }
    }
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < CONSTANTS.PARTICLE_COUNT; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color: color
      });
    }
  };

  const createFloatingText = (x: number, y: number, text: string, color: string, fontSize: number = 18) => {
    floatingTextsRef.current.push({
      x,
      y,
      text,
      color,
      life: 1.0,
      vy: -2,
      fontSize
    });
  };

  const update = (dt: number, time: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const config = gameConfigRef.current;
    
    // Увеличение скорости со временем
    if (config.speed < CONSTANTS.MAX_SPEED) {
      config.speed += CONSTANTS.SPEED_INCREMENT;
    }

    // Расход энергии
    config.energy -= CONSTANTS.ENERGY_DECAY;
    if (config.energy <= 0) {
      config.energy = 0;
      createExplosion(playerRef.current.x, playerRef.current.y, COLORS.player);
      cancelAnimationFrame(requestRef.current);
      onCrash(); // Закончилось топливо
      return;
    }

    // Скролл дороги
    roadOffsetRef.current = (roadOffsetRef.current + config.speed) % 100; // 100 - размер клетки

    // Движение игрока
    const speed = 22; 
    if (keysRef.current['ArrowLeft'] || touchInputRef.current === 'LEFT') {
      playerRef.current.x -= speed;
    }
    if (keysRef.current['ArrowRight'] || touchInputRef.current === 'RIGHT') {
      playerRef.current.x += speed;
    }

    // Границы
    if (playerRef.current.x < 0) playerRef.current.x = 0;
    if (playerRef.current.x + playerRef.current.width > canvas.width) {
      playerRef.current.x = canvas.width - playerRef.current.width;
    }

    // Таймер неуязвимости
    if (config.isInvincible && time > config.invincibleTimer) {
      config.isInvincible = false;
    }

    // --- Логика спавна ---
    
    // 1. Случайные препятствия
    spawnEntity(canvas.width);

    // 2. Топливо по таймеру (Каждые 5 секунд)
    if (time > nextFuelSpawnTimeRef.current) {
      spawnEntity(canvas.width, 'COLLECTIBLE');
      nextFuelSpawnTimeRef.current = time + 5000;
    }
    
    // --- Обновление сущностей ---

    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const ent = entitiesRef.current[i];
      
      const moveAmount = (ent.speedY || config.speed);
      const prevY = ent.y;
      ent.y += moveAmount;

      const p = playerRef.current;

      // Проверка коллизий
      const horizontalOverlap = 
          p.x < ent.x + ent.width &&
          p.x + p.width > ent.x;

      const verticalOverlap = 
          (p.y < ent.y + ent.height && p.y + p.height > ent.y) || // Обычное наложение
          (prevY + ent.height < p.y && ent.y + ent.height >= p.y); // Проверка на "пролет сквозь" (туннелирование)

      if (horizontalOverlap && verticalOverlap) {
            if (ent.type === 'COLLECTIBLE') {
              // Сбор топлива
              config.energy = Math.min(config.energy + CONSTANTS.ENERGY_GAIN, CONSTANTS.MAX_ENERGY);
              config.score += 50;
              createExplosion(ent.x + ent.width/2, ent.y + ent.height/2, COLORS.collectible);
              entitiesRef.current.splice(i, 1); // Удалить собранное
              setScore(Math.floor(config.score));
              soundManager.playCollect();
              continue;
            } else {
              // Столкновение с препятствием
              if (!config.isInvincible) {
                createExplosion(playerRef.current.x + playerRef.current.width/2, playerRef.current.y + playerRef.current.height/2, COLORS.player);
                cancelAnimationFrame(requestRef.current);
                onCrash();
                return;
              }
            }
      }

      // Логика "Почти попал" (Near Miss)
      if (ent.type === 'OBSTACLE' && !ent.bonusAwarded && ent.y > p.y) {
        let gap = 0;
        if (ent.x > p.x + p.width) {
          gap = ent.x - (p.x + p.width); // Препятствие справа
        } else if (ent.x + ent.width < p.x) {
          gap = p.x - (ent.x + ent.width); // Препятствие слева
        }
        
        const NEAR_MISS_THRESHOLD = 60; // Пиксели

        if (gap > 0 && gap < NEAR_MISS_THRESHOLD) {
          ent.bonusAwarded = true;
          
          // Расчет очков 0-100 в зависимости от близости
          const proximityRatio = 1 - (gap / NEAR_MISS_THRESHOLD);
          const bonus = Math.floor(100 * proximityRatio);
          
          if (bonus > 5) {
            config.score += bonus;
            setScore(Math.floor(config.score));
            soundManager.playNearMiss();
            
            // Динамические надписи
            let color = "#ffffff";
            let fontSize = 16;
            let text = `+${bonus}`;

            if (bonus >= 90) {
                color = "#ff0000"; // Красный
                fontSize = 28;
                text = `ОПАСНО +${bonus}`;
            } else if (bonus >= 75) {
                color = "#ff5500"; // Оранжевый
                fontSize = 24;
                text = `БЛИЗКО +${bonus}`;
            } else if (bonus >= 50) {
                color = "#ffaa00"; // Золотой
                fontSize = 20;
            } else if (bonus >= 25) {
                color = "#ffff00"; // Желтый
                fontSize = 18;
            }

            createFloatingText(p.x + p.width/2, p.y, text, color, fontSize);
          }
        }
      }

      // Очистка
      if (ent.y > canvas.height) {
        entitiesRef.current.splice(i, 1);
        // Очки за пройденное препятствие
        if (ent.type === 'OBSTACLE') {
          config.score += 10;
          setScore(Math.floor(config.score));
        }
      }
    }

    // Частицы
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }

    // Всплывающий текст
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
      const ft = floatingTextsRef.current[i];
      ft.y += ft.vy;
      ft.life -= 0.02;
      if (ft.life <= 0) floatingTextsRef.current.splice(i, 1);
    }
  };

  const draw = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const canvas = canvasRef.current;

    // Очистка экрана
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Сетка / Дорога
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;

    // Вертикальные линии (Полосы)
    const laneWidth = canvas.width / CONSTANTS.LANE_COUNT;
    ctx.beginPath();
    for (let i = 1; i < CONSTANTS.LANE_COUNT; i++) {
      const x = i * laneWidth;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();

    // Горизонтальные линии (Эффект скорости)
    ctx.beginPath();
    const gridGap = 100;
    for (let y = roadOffsetRef.current; y < canvas.height; y += gridGap) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Отрисовка игрока
    if (!gameConfigRef.current.isInvincible || Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLORS.playerGlow;
      ctx.fillStyle = COLORS.player;
      
      const p = playerRef.current;
      
      // Футуристичная форма машины
      ctx.beginPath();
      ctx.moveTo(p.x + p.width * 0.2, p.y); 
      ctx.lineTo(p.x + p.width * 0.8, p.y); 
      ctx.lineTo(p.x + p.width, p.y + p.height * 0.3); 
      ctx.lineTo(p.x + p.width, p.y + p.height); 
      ctx.lineTo(p.x + p.width * 0.8, p.y + p.height * 0.8); 
      ctx.lineTo(p.x + p.width * 0.2, p.y + p.height * 0.8); 
      ctx.lineTo(p.x, p.y + p.height); 
      ctx.lineTo(p.x, p.y + p.height * 0.3); 
      ctx.closePath();
      ctx.fill();

      // Свечение двигателя
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x + p.width * 0.3, p.y + p.height * 0.8, p.width * 0.4, 4);
    }

    // Отрисовка объектов
    entitiesRef.current.forEach(ent => {
      if (ent.type === 'COLLECTIBLE') {
        // Топливо (Зеленый ромб)
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.collectibleGlow;
        ctx.fillStyle = COLORS.collectible;
        
        ctx.beginPath();
        ctx.moveTo(ent.x + ent.width/2, ent.y);
        ctx.lineTo(ent.x + ent.width, ent.y + ent.height/2);
        ctx.moveTo(ent.x + ent.width, ent.y + ent.height/2);
        ctx.lineTo(ent.x + ent.width/2, ent.y + ent.height);
        ctx.moveTo(ent.x + ent.width/2, ent.y + ent.height);
        ctx.lineTo(ent.x, ent.y + ent.height/2);
        ctx.moveTo(ent.x, ent.y + ent.height/2);
        ctx.lineTo(ent.x + ent.width/2, ent.y);
        ctx.fill();

        // Белое ядро
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ent.x + ent.width/2, ent.y + ent.height/2, ent.width/4, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Препятствие (Розовый блок)
        const isFast = (ent.speedY || 0) > (gameConfigRef.current.speed * 1.5);
        
        ctx.shadowBlur = isFast ? 30 : 15;
        ctx.shadowColor = COLORS.obstacleGlow;
        ctx.fillStyle = COLORS.obstacle;
        
        ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
        
        ctx.strokeStyle = isFast ? '#fff' : '#ffccff';
        ctx.lineWidth = isFast ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(ent.x, ent.y);
        ctx.lineTo(ent.x + ent.width, ent.y + ent.height);
        ctx.moveTo(ent.x + ent.width, ent.y);
        ctx.lineTo(ent.x, ent.y + ent.height);
        ctx.stroke();
        
        // Шлейф для быстрых объектов
        if (isFast) {
           ctx.globalAlpha = 0.4;
           ctx.fillStyle = COLORS.obstacle;
           ctx.fillRect(ent.x, ent.y - 40, ent.width, 40);
           ctx.globalAlpha = 1.0;
        }
      }
    });

    // Отрисовка частиц
    particlesRef.current.forEach(p => {
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // Отрисовка текста
    floatingTextsRef.current.forEach(ft => {
      ctx.globalAlpha = ft.life;
      ctx.font = `bold ${ft.fontSize || 18}px 'Russo One', sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.shadowBlur = 5;
      ctx.shadowColor = ft.color;
      ctx.textAlign = "center";
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1.0;
    });

    // Отрисовка шкалы энергии
    const barWidth = 20;
    const barHeight = 200;
    const barX = 20;
    const barY = canvas.height / 2 - barHeight / 2;
    const energyRatio = gameConfigRef.current.energy / CONSTANTS.MAX_ENERGY;

    // Фон шкалы
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Заполнение
    let barColor = COLORS.collectible;
    if (energyRatio < 0.3) barColor = COLORS.danger;
    else if (energyRatio < 0.6) barColor = '#ffff00'; // Желтый уровень

    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 10;
    const currentHeight = barHeight * energyRatio;
    ctx.fillRect(barX, barY + (barHeight - currentHeight), barWidth, currentHeight);

    // Подпись
    ctx.fillStyle = '#fff';
    ctx.textAlign = "left";
    ctx.font = '12px "Russo One"';
    ctx.fillText("ТОПЛИВО", barX - 5, barY + barHeight + 20);
  };

  // Фон меню
  const drawMenuBackground = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // Обработка ресайза
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        if (gameState === GameState.MENU) {
            playerRef.current.x = window.innerWidth / 2 - CONSTANTS.PLAYER_WIDTH / 2;
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [gameState]);

  // Обработка ввода
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleTouchStart = (side: 'LEFT' | 'RIGHT') => {
    touchInputRef.current = side;
  };

  const handleTouchEnd = () => {
    touchInputRef.current = null;
  };

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      
      {/* Mobile Controls Overlay */}
      {gameState === GameState.PLAYING && (
        <div className="mobile-controls">
          <div 
            className="control-zone"
            onTouchStart={() => handleTouchStart('LEFT')}
            onTouchEnd={handleTouchEnd}
            onMouseDown={() => handleTouchStart('LEFT')}
            onMouseUp={handleTouchEnd}
          ></div>
          <div 
            className="control-zone"
            onTouchStart={() => handleTouchStart('RIGHT')}
            onTouchEnd={handleTouchEnd}
            onMouseDown={() => handleTouchStart('RIGHT')}
            onMouseUp={handleTouchEnd}
          ></div>
        </div>
      )}
    </>
  );
};

export default GameCanvas;