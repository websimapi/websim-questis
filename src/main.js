import { loadAssets } from './assets.js';
import { soundManager } from './SoundManager.js';
import { Game } from './Game.js';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const input = new Input();
let game = null;

const loop = () => {
    if (game) {
        // Handle Input
        const dir = input.getDirection();
        if (dir) {
            if (dir === 'up') game.movePlayer(0, -1);
            if (dir === 'down') game.movePlayer(0, 1);
            if (dir === 'left') game.movePlayer(-1, 0);
            if (dir === 'right') game.movePlayer(1, 0);
        }

        if (input.getAction()) {
            game.interact();
        }

        // Draw
        renderer.draw(game);
    }
    requestAnimationFrame(loop);
};

const init = async () => {
    await loadAssets();
    await soundManager.init();    
    
    // Start music interaction listener if needed, but we rely on first click for SFX ctx resume
    
    game = new Game();    
    
    // Initial UI update
    game.updateStats();

    // Remove loading logic if any
    requestAnimationFrame(loop);
};

// Simple tap to start audio context if needed
document.addEventListener('click', () => {
    if (soundManager.ctx.state === 'suspended') {
        soundManager.ctx.resume();
    }
}, { once: true });
document.addEventListener('touchstart', () => {
    if (soundManager.ctx.state === 'suspended') {
        soundManager.ctx.resume();
    }
}, { once: true });

init();