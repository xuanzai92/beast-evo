import { GameEngine } from './game';

window.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('game-root');
  if (!root) {
    console.error('Missing #game-root element');
    return;
  }

  const engine = new GameEngine(root);

  // Resize handler
  const onResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    engine.renderer3d.resize(width, height);
    engine.cameraController.setAspect(width / height);
  };

  window.addEventListener('resize', onResize);
  onResize();

  // Animation Loop
  let lastTime = performance.now();
  function loop(currentTime: number) {
    const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
    lastTime = currentTime;

    engine.update(dt);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
