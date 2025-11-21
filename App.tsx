import React, { useState, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState } from './types';
import { COLORS } from './constants';

function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [reviveTrigger, setReviveTrigger] = useState(0);

  const handleCrash = useCallback(() => {
    setGameState(GameState.GAME_OVER);
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('neon_racer_highscore', String(score));
    }
  }, [score, highScore]);

  // Initialize highscore
  React.useEffect(() => {
    const saved = localStorage.getItem('neon_racer_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  const startGame = () => {
    setGameState(GameState.PLAYING);
    setScore(0);
    setReviveTrigger(0);
  };

  const restartGame = () => {
    setGameState(GameState.PLAYING);
    setScore(0);
    setReviveTrigger(0);
  };

  // Mock Ad Function
  const showRewardedAd = () => {
    console.log("SHOWING AD...");
    // Simulate Ad duration
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
    adOverlay.innerText = 'WATCHING AD... (2s)';
    document.body.appendChild(adOverlay);

    // TODO: Integrate Yandex SDK here
    // ysdk.adv.showRewardedVideo({ callbacks: { ... } })

    setTimeout(() => {
      document.body.removeChild(adOverlay);
      console.log("AD COMPLETED. REVIVING.");
      setGameState(GameState.PLAYING);
      setReviveTrigger(prev => prev + 1); // Trigger revive logic in Canvas
    }, 2000);
  };

  return (
    <div className="relative w-full h-full bg-black scanlines select-none font-bold">
      
      {/* Game HUD */}
      {gameState !== GameState.MENU && (
        <div className="absolute top-4 left-4 z-30 pointer-events-none">
          <div className="text-[#0ff] text-2xl drop-shadow-[0_0_5px_#0ff]">
            SCORE: {score}
          </div>
          <div className="text-sm text-gray-400">
            HI: {highScore}
          </div>
        </div>
      )}

      {/* Main Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <h1 className="text-5xl md:text-7xl mb-8 text-center italic tracking-tighter"
              style={{ color: COLORS.player, textShadow: `0 0 20px ${COLORS.player}` }}>
            NEON<br/><span style={{ color: COLORS.obstacle, textShadow: `0 0 20px ${COLORS.obstacle}` }}>VELOCITY</span>
          </h1>
          <p className="text-gray-300 mb-8 text-sm md:text-base animate-pulse">
            TAP OR CLICK TO START
          </p>
          <button 
            onClick={startGame}
            className="px-8 py-4 bg-transparent border-2 border-[#0ff] text-[#0ff] text-xl rounded hover:bg-[#0ff] hover:text-black transition-all duration-300 shadow-[0_0_15px_#0ff]"
          >
            START ENGINE
          </button>
          <div className="mt-8 text-xs text-gray-500 text-center">
            DESKTOP: ARROWS<br/>MOBILE: TAP LEFT/RIGHT
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
          <h2 className="text-6xl text-[#ff0000] mb-2 drop-shadow-[0_0_15px_#f00]">CRASHED</h2>
          <div className="text-2xl mb-8 text-white">FINAL SCORE: {score}</div>
          
          <div className="flex flex-col gap-4 w-64">
            <button 
              onClick={showRewardedAd}
              className="w-full py-3 bg-[#f0f] text-white rounded border border-[#f0f] hover:bg-transparent hover:text-[#f0f] transition-all shadow-[0_0_10px_#f0f] flex items-center justify-center gap-2"
            >
              <span>📺</span> REVIVE
            </button>
            
            <button 
              onClick={restartGame}
              className="w-full py-3 bg-gray-800 text-gray-300 rounded border border-gray-600 hover:bg-gray-700 transition-all"
            >
              RESTART
            </button>
          </div>
        </div>
      )}

      {/* The Actual Game Canvas */}
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