
import React, { useState, useCallback, useEffect } from 'react';
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

  const handleCrash = useCallback(() => {
    setGameState(GameState.GAME_OVER);
    soundManager.stopMusic();
    soundManager.playCrash();
    
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('neon_racer_highscore', String(score));
    }
  }, [score, highScore]);

  // Инициализация рекорда
  React.useEffect(() => {
    const saved = localStorage.getItem('neon_racer_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

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
  };

  const restartGame = () => {
    initAudio();
    setGameState(GameState.PLAYING);
    setScore(0);
    setReviveTrigger(0);
    soundManager.startMusic();
  };

  // Имитация рекламы
  const showRewardedAd = () => {
    initAudio();
    console.log("ПОКАЗ РЕКЛАМЫ...");
    // Симуляция длительности рекламы
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
    adOverlay.innerText = 'ПРОСМОТР РЕКЛАМЫ... (2с)';
    document.body.appendChild(adOverlay);

    // TODO: Интеграция Yandex SDK
    // ysdk.adv.showRewardedVideo({ callbacks: { ... } })

    setTimeout(() => {
      document.body.removeChild(adOverlay);
      console.log("РЕКЛАМА ЗАВЕРШЕНА. ВОСКРЕШЕНИЕ.");
      setGameState(GameState.PLAYING);
      setReviveTrigger(prev => prev + 1); // Триггер логики воскрешения в Canvas
      soundManager.startMusic();
    }, 2000);
  };

  return (
    <div className="relative w-full h-full bg-black scanlines select-none font-bold">
      
      {/* Кнопка звука */}
      <button 
        onClick={toggleMute}
        className="absolute top-4 right-4 z-50 p-2 text-[#0ff] hover:text-white hover:bg-white/10 rounded border border-[#0ff]/30"
      >
        {isMuted ? '🔇 ВЫКЛ' : '🔊 ВКЛ'}
      </button>

      {/* HUD Игры */}
      {gameState !== GameState.MENU && (
        <div className="absolute top-4 left-4 z-30 pointer-events-none">
          <div className="text-[#0ff] text-2xl drop-shadow-[0_0_5px_#0ff]">
            СЧЕТ: {score}
          </div>
          <div className="text-sm text-gray-400">
            РЕКОРД: {highScore}
          </div>
        </div>
      )}

      {/* Главное меню */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <h1 className="text-5xl md:text-7xl mb-8 text-center italic tracking-tighter"
              style={{ color: COLORS.player, textShadow: `0 0 20px ${COLORS.player}` }}>
            НЕОНОВАЯ<br/><span style={{ color: COLORS.obstacle, textShadow: `0 0 20px ${COLORS.obstacle}` }}>СКОРОСТЬ</span>
          </h1>
          <p className="text-gray-300 mb-8 text-sm md:text-base animate-pulse">
            НАЖМИ ЧТОБЫ НАЧАТЬ
          </p>
          <button 
            onClick={startGame}
            className="px-8 py-4 bg-transparent border-2 border-[#0ff] text-[#0ff] text-xl rounded hover:bg-[#0ff] hover:text-black transition-all duration-300 shadow-[0_0_15px_#0ff]"
          >
            ПОЕХАЛИ!
          </button>
          <div className="mt-8 text-xs text-gray-500 text-center">
            ПК: СТРЕЛКИ<br/>ТЕЛЕФОН: НАЖИМАЙ ПО БОКАМ
          </div>
        </div>
      )}

      {/* Экран проигрыша */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
          <h2 className="text-6xl text-[#ff0000] mb-2 drop-shadow-[0_0_15px_#f00]">АВАРИЯ</h2>
          <div className="text-2xl mb-8 text-white">ИТОГОВЫЙ СЧЕТ: {score}</div>
          
          <div className="flex flex-col gap-4 w-64">
            <button 
              onClick={showRewardedAd}
              className="w-full py-3 bg-[#f0f] text-white rounded border border-[#f0f] hover:bg-transparent hover:text-[#f0f] transition-all shadow-[0_0_10px_#f0f] flex items-center justify-center gap-2"
            >
              <span>📺</span> ВОСКРЕСНУТЬ
            </button>
            
            <button 
              onClick={restartGame}
              className="w-full py-3 bg-gray-800 text-gray-300 rounded border border-gray-600 hover:bg-gray-700 transition-all"
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