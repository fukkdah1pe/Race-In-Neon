
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Entity, Particle, GameConfig } from '../types';
import { COLORS, CONSTANTS } from '../constants';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setScore: (score: number) => void;
  onCrash: () => void;
  reviveTrigger: number; // Increment to trigger revive
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
  
  // Mutable game state (using refs to avoid re-renders during game loop)
  const playerRef = useRef<Entity>({ x: 0, y: 0, width: CONSTANTS.PLAYER_WIDTH, height: CONSTANTS.PLAYER_HEIGHT, color: COLORS.player, type: 'OBSTACLE' });
  const entitiesRef = useRef<Entity[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const gameConfigRef = useRef<GameConfig>({
    speed: CONSTANTS.BASE_SPEED,
    laneCount: CONSTANTS.LANE_COUNT,
    score: 0,
    highScore: 0,
    isInvincible: false,
    invincibleTimer: 0,
    energy: CONSTANTS.MAX_ENERGY
  });
  
  // Input state
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const touchInputRef = useRef<'LEFT' | 'RIGHT' | null>(null);
  
  // Road animation state
  const roadOffsetRef = useRef(0);
  const lastTimeRef = useRef(0);

  // Initialize/Reset Game
  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    
    // Center player
    playerRef.current.x = canvas.width / 2 - CONSTANTS.PLAYER_WIDTH / 2;
    playerRef.current.y = canvas.height - CONSTANTS.PLAYER_HEIGHT - 100;
    
    // Reset obstacles and particles
    entitiesRef.current = [];
    particlesRef.current = [];
    
    // Reset config
    gameConfigRef.current.speed = CONSTANTS.BASE_SPEED;
    gameConfigRef.current.score = 0;
    gameConfigRef.current.isInvincible = false;
    gameConfigRef.current.energy = CONSTANTS.MAX_ENERGY;
    setScore(0);
  }, [setScore]);

  // Handle Revive
  useEffect(() => {
    if (reviveTrigger > 0) {
      gameConfigRef.current.isInvincible = true;
      gameConfigRef.current.invincibleTimer = performance.now() + CONSTANTS.INVINCIBLE_TIME;
      gameConfigRef.current.energy = CONSTANTS.MAX_ENERGY; // Refill energy on revive
      
      // Clear nearby obstacles to prevent instant death again
      const safeZoneY = playerRef.current.y - 300;
      entitiesRef.current = entitiesRef.current.filter(obs => obs.y < safeZoneY);
      
      // Resume game
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviveTrigger]);

  // Main Game Loop
  const gameLoop = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) return;
    
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    update(deltaTime, time);
    draw();

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState]); // Dependencies handled via refs

  // Start Loop when playing
  useEffect(() => {
    if (gameState === GameState.PLAYING && reviveTrigger === 0) {
      initGame();
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else if (gameState === GameState.MENU) {
      // Draw menu background
      drawMenuBackground();
    }
    
    return () => cancelAnimationFrame(requestRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, gameLoop, initGame]);

  const spawnEntity = (canvasWidth: number) => {
    // Increased spawn rate significantly: 12% chance per frame (was 6%)
    if (Math.random() < 0.12) {
      const laneWidth = canvasWidth / CONSTANTS.LANE_COUNT;
      const lane = Math.floor(Math.random() * CONSTANTS.LANE_COUNT);
      
      // Lowered collectible chance to 10% (was 15%) to make room for more obstacles
      const isCollectible = Math.random() < 0.10; 
      const size = isCollectible ? 30 : CONSTANTS.PLAYER_WIDTH;
      
      // Calculate Speed
      let entitySpeed = gameConfigRef.current.speed;
      
      if (!isCollectible) {
        const rand = Math.random();
        if (rand < 0.25) {
            // 25% chance of SUPER FAST (3x - 4x speed)
            entitySpeed *= (3.0 + Math.random());
        } else if (rand < 0.5) {
            // 25% chance of FAST (1.5x - 2x speed)
            entitySpeed *= (1.5 + Math.random() * 0.5);
        } else {
            // 50% chance of NORMAL speed variation
            entitySpeed *= (0.8 + Math.random() * 0.4);
        }
      }

      const entity: Entity = {
        x: lane * laneWidth + (laneWidth - size) / 2,
        y: -200, // Spawn higher to allow for high speed entry
        width: size,
        height: size,
        color: isCollectible ? COLORS.collectible : COLORS.obstacle,
        speedY: entitySpeed,
        type: isCollectible ? 'COLLECTIBLE' : 'OBSTACLE'
      };
      
      // Check for overlap with existing entities to prevent stacking
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

  const update = (dt: number, time: number) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const config = gameConfigRef.current;
    
    // Increase speed over time
    if (config.speed < CONSTANTS.MAX_SPEED) {
      config.speed += CONSTANTS.SPEED_INCREMENT;
    }

    // Decrease Energy
    config.energy -= CONSTANTS.ENERGY_DECAY;
    if (config.energy <= 0) {
      config.energy = 0;
      createExplosion(playerRef.current.x, playerRef.current.y, COLORS.player);
      cancelAnimationFrame(requestRef.current);
      onCrash(); // Ran out of fuel
      return;
    }

    // Scroll road
    roadOffsetRef.current = (roadOffsetRef.current + config.speed) % 100; // 100 is grid cell size

    // Player Movement
    const speed = 22; 
    if (keysRef.current['ArrowLeft'] || touchInputRef.current === 'LEFT') {
      playerRef.current.x -= speed;
    }
    if (keysRef.current['ArrowRight'] || touchInputRef.current === 'RIGHT') {
      playerRef.current.x += speed;
    }

    // Boundaries
    if (playerRef.current.x < 0) playerRef.current.x = 0;
    if (playerRef.current.x + playerRef.current.width > canvas.width) {
      playerRef.current.x = canvas.width - playerRef.current.width;
    }

    // Invincibility Timer
    if (config.isInvincible && time > config.invincibleTimer) {
      config.isInvincible = false;
    }

    // Entities (Obstacles & Collectibles)
    spawnEntity(canvas.width);
    
    for (let i = entitiesRef.current.length - 1; i >= 0; i--) {
      const ent = entitiesRef.current[i];
      
      const moveAmount = (ent.speedY || config.speed);
      const prevY = ent.y;
      ent.y += moveAmount;

      // Collision Detection
      // Using "Swept AABB" concept to detect high-speed objects passing through player
      const p = playerRef.current;
      const horizontalOverlap = 
          p.x < ent.x + ent.width &&
          p.x + p.width > ent.x;

      // Vertical overlap: either overlapping now, OR passed through the top of the player since last frame
      const verticalOverlap = 
          (p.y < ent.y + ent.height && p.y + p.height > ent.y) || // Standard overlap
          (prevY + ent.height < p.y && ent.y + ent.height >= p.y); // Tunneling check (hit top side)

      if (horizontalOverlap && verticalOverlap) {
            if (ent.type === 'COLLECTIBLE') {
              // Collect Fuel
              config.energy = Math.min(config.energy + CONSTANTS.ENERGY_GAIN, CONSTANTS.MAX_ENERGY);
              config.score += 50;
              createExplosion(ent.x + ent.width/2, ent.y + ent.height/2, COLORS.collectible);
              entitiesRef.current.splice(i, 1); // Remove collectible
              setScore(Math.floor(config.score));
              continue;
            } else {
              // Hit Obstacle
              if (!config.isInvincible) {
                createExplosion(playerRef.current.x + playerRef.current.width/2, playerRef.current.y + playerRef.current.height/2, COLORS.player);
                cancelAnimationFrame(requestRef.current);
                onCrash();
                return;
              }
            }
      }

      // Cleanup
      if (ent.y > canvas.height) {
        entitiesRef.current.splice(i, 1);
        // Score logic for passing obstacles
        if (ent.type === 'OBSTACLE') {
          config.score += 10;
          setScore(Math.floor(config.score));
        }
      }
    }

    // Particles
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;
      if (p.life <= 0) particlesRef.current.splice(i, 1);
    }
  };

  const draw = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const canvas = canvasRef.current;

    // Clear Screen
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Grid / Road
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;

    // Vertical Lines (Lanes)
    const laneWidth = canvas.width / CONSTANTS.LANE_COUNT;
    ctx.beginPath();
    for (let i = 1; i < CONSTANTS.LANE_COUNT; i++) {
      const x = i * laneWidth;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
    }
    ctx.stroke();

    // Horizontal Moving Lines (Speed effect)
    ctx.beginPath();
    const gridGap = 100;
    for (let y = roadOffsetRef.current; y < canvas.height; y += gridGap) {
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.globalAlpha = 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Draw Player
    if (!gameConfigRef.current.isInvincible || Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = COLORS.playerGlow;
      ctx.fillStyle = COLORS.player;
      
      const p = playerRef.current;
      
      // Draw Futuristic Car Shape
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

      // Engine glow
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(p.x + p.width * 0.3, p.y + p.height * 0.8, p.width * 0.4, 4);
    }

    // Draw Entities
    entitiesRef.current.forEach(ent => {
      if (ent.type === 'COLLECTIBLE') {
        // Draw Fuel Cell (Green Diamond)
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

        // Inner white core
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(ent.x + ent.width/2, ent.y + ent.height/2, ent.width/4, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Draw Obstacle (Pink Box)
        // Intensity of glow based on speed
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
        
        // Trail for fast objects
        if (isFast) {
           ctx.globalAlpha = 0.4;
           ctx.fillStyle = COLORS.obstacle;
           ctx.fillRect(ent.x, ent.y - 40, ent.width, 40);
           ctx.globalAlpha = 1.0;
        }
      }
    });

    // Draw Particles
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

    // Draw Energy Bar
    const barWidth = 20;
    const barHeight = 200;
    const barX = 20;
    const barY = canvas.height / 2 - barHeight / 2;
    const energyRatio = gameConfigRef.current.energy / CONSTANTS.MAX_ENERGY;

    // Background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Fill
    let barColor = COLORS.collectible;
    if (energyRatio < 0.3) barColor = COLORS.danger;
    else if (energyRatio < 0.6) barColor = '#ffff00'; // Yellow warning

    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 10;
    const currentHeight = barHeight * energyRatio;
    ctx.fillRect(barX, barY + (barHeight - currentHeight), barWidth, currentHeight);

    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '12px Orbitron';
    ctx.fillText("FUEL", barX - 5, barY + barHeight + 20);
  };

  // Simple background for menu
  const drawMenuBackground = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  // Resize Handler
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        // Re-center player on resize if not playing
        if (gameState === GameState.MENU) {
            playerRef.current.x = window.innerWidth / 2 - CONSTANTS.PLAYER_WIDTH / 2;
        }
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [gameState]);

  // Input Handlers
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
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* Mobile Controls Overlay - Only active during play */}
      {gameState === GameState.PLAYING && (
        <div className="absolute inset-0 z-20 flex">
          <div 
            className="w-1/2 h-full active:bg-white/5 transition-colors"
            onTouchStart={() => handleTouchStart('LEFT')}
            onTouchEnd={handleTouchEnd}
            onMouseDown={() => handleTouchStart('LEFT')} // Mouse fallback for testing
            onMouseUp={handleTouchEnd}
          ></div>
          <div 
            className="w-1/2 h-full active:bg-white/5 transition-colors"
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
