import React, { useState, useCallback, useEffect, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState } from './types';
import { COLORS } from './constants';
import { soundManager } from './utils/audio';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [reviveTrigger, setReviveTrigger] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  
  // Yandex Games SDK State
  const [ysdk, setYsdk] = useState<any>(null);
  const restartCountRef = useRef(0);

  // Инициализация SDK
  useEffect(() => {
    if ((window as any).YaGames) {
      (window as any).YaGames.init().then((_sdk: any) => {
        console.log('Yandex Games SDK initialized');
        setYsdk(_sdk);
      });
    }
  }, []);

  // Инициализация рекорда
  React.useEffect(() => {
    // Пытаемся получить данные из Yandex Storage, если нет - из LocalStorage
    const saved = localStorage.getItem('neon_racer_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const handleCrash = useCallback(() => {
    setGameState(GameState.GAME_OVER);
    soundManager.stopMusic();
    soundManager.playCrash();
    
    // Gameplay API: Stop
    if (ysdk && ysdk.features.GameplayAPI) {
      ysdk.features.GameplayAPI.stop();
    }
    
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('neon_racer_highscore', String(score));
    }
  }, [score, highScore, ysdk]);

  const toggleMute = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    soundManager.toggleMute(newState);
  };

  const initAudio = () => {
    // Браузеры требуют взаимодействия пользователя для запуска AudioContext
    soundManager.init();
    soundManager.playClick();
  };

  const startGame = () => {
    initAudio();
    setGameState(GameState.PLAYING);
    setScore(0);
    setReviveTrigger(0);
    soundManager.startMusic();
    
    // Gameplay API: Start
    if (ysdk && ysdk.features.GameplayAPI) {
      ysdk.features.GameplayAPI.start();
    }
  };

  // Логика самого рестарта
  const performRestart = () => {
    initAudio();
    setGameState(GameState.PLAYING);
    setScore(0);
    setReviveTrigger(0);
    soundManager.startMusic();

    // Gameplay API: Start
    if (ysdk && ysdk.features.GameplayAPI) {
      ysdk.features.GameplayAPI.start();
    }
  };

  // Обработчик кнопки рестарт (с рекламой)
  const handleRestartClick = () => {
    restartCountRef.current += 1;

    // Показываем рекламу каждый 3-й раз, если SDK загружен
    if (ysdk && restartCountRef.current % 3 === 0) {
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => {
            soundManager.toggleMute(true);
          },
          onClose: (wasShown: boolean) => {
            soundManager.toggleMute(isMuted); // Возвращаем как было (или false если хотим включить)
            if (!isMuted) soundManager.toggleMute(false); // Принудительно включаем, если пользователь не мьютил сам
            performRestart();
          },
          onError: (error: any) => {
            console.error('Ad error:', error);
            performRestart();
          }
        }
      });
    } else {
      performRestart();
    }
  };

  // Воскрешение за рекламу (Rewarded Video)
  const showRewardedAd = () => {
    initAudio();

    if (ysdk) {
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => {
            soundManager.toggleMute(true);
          },
          onRewarded: () => {
            console.log("РЕКЛАМА ПРОСМОТРЕНА. ВОСКРЕШЕНИЕ.");
            setGameState(GameState.PLAYING);
            setReviveTrigger(prev => prev + 1); // Триггер логики воскрешения в Canvas
            soundManager.startMusic();
            
            // Gameplay API: Start (continuing)
            if (ysdk.features.GameplayAPI) {
              ysdk.features.GameplayAPI.start();
            }
          },
          onClose: () => {
             soundManager.toggleMute(isMuted); 
             if (!isMuted) soundManager.toggleMute(false);
          },
          onError: (e: any) => {
            console.error('Rewarded Ad Error', e);
            // В случае ошибки можно либо просто закрыть, либо дать награду (на усмотрение разработчика)
            // Здесь просто восстановим звук
            soundManager.toggleMute(isMuted);
          }
        }
      });
    } else {
      // Fallback для разработки (без SDK)
      console.log("SDK не найден. Симуляция рекламы...");
      const adOverlay = document.createElement('div');
      adOverlay.style.position = 'fixed';
      adOverlay.style.inset = '0';
      adOverlay.style.backgroundColor = 'black';
      adOverlay.style.color = 'white';
      adOverlay.style.display = 'flex';
      adOverlay.style.alignItems = 'center';
      adOverlay.style.justifyContent = 'center';
      adOverlay.style.zIndex = '9999';
      adOverlay.style.fontSize = '2rem';
      adOverlay.style.fontFamily = '"Russo One", sans-serif';
      adOverlay.innerText = 'СИМУЛЯЦИЯ РЕКЛАМЫ... (2с)';
      document.body.appendChild(adOverlay);

      setTimeout(() => {
        document.body.removeChild(adOverlay);
        setGameState(GameState.PLAYING);
        setReviveTrigger(prev => prev + 1);
        soundManager.startMusic();
      }, 2000);
    }
  };

  return (
    <div className="app-wrapper scanlines">
      
      {/* Кнопка звука */}
      <button 
        onClick={toggleMute}
        className="mute-btn"
      >
        {isMuted ? '🔇 ВЫКЛ' : '🔊 ВКЛ'}
      </button>

      {/* HUD Игры */}
      {gameState !== GameState.MENU && (
        <div className="hud">
          <div className="score-text">
            СЧЕТ: {score}
          </div>
          <div className="highscore-text">
            РЕКОРД: {highScore}
          </div>
        </div>
      )}

      {/* Главное меню */}
      {gameState === GameState.MENU && (
        <div className="overlay menu-bg">
          <h1 className="game-title">
            <span style={{ color: COLORS.player, textShadow: `0 0 20px ${COLORS.player}` }}>НЕОНОВАЯ</span><br/>
            <span style={{ color: COLORS.obstacle, textShadow: `0 0 20px ${COLORS.obstacle}` }}>СКОРОСТЬ</span>
          </h1>
          <p className="pulse-text">
            НАЖМИ ЧТОБЫ НАЧАТЬ
          </p>
          <button 
            onClick={startGame}
            className="btn btn-primary"
          >
            ПОЕХАЛИ!
          </button>
          <div className="footer-hint">
            ПК: СТРЕЛКИ<br/>ТЕЛЕФОН: НАЖИМАЙ ПО БОКАМ
          </div>
        </div>
      )}

      {/* Экран проигрыша */}
      {gameState === GameState.GAME_OVER && (
        <div className="overlay game-over-bg">
          <h2 className="game-over-title">АВАРИЯ</h2>
          <div className="final-score">ИТОГОВЫЙ СЧЕТ: {score}</div>
          
          <div className="btn-group">
            <button 
              onClick={showRewardedAd}
              className="btn btn-revive"
            >
              <span>📺</span> ВОСКРЕСНУТЬ
            </button>
            
            <button 
              onClick={handleRestartClick}
              className="btn btn-restart"
            >
              ЗАНОВО
            </button>
          </div>
        </div>
      )}

      {/* Канвас игры */}
      <GameCanvas 
        gameState={gameState} 
        setGameState={setGameState} 
        setScore={setScore}
        onCrash={handleCrash}
        reviveTrigger={reviveTrigger}
      />
    </div>
  );
}

export default App;