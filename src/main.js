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

    // Setup Class Selection
    const screen = document.getElementById('class-selection-screen');
    const options = document.querySelectorAll('.class-card');
    
    options.forEach(card => {
        card.addEventListener('click', (e) => {
            const cls = card.dataset.class;
            
            // Init Game
            if (soundManager.ctx.state === 'suspended') soundManager.ctx.resume();
            
            game = new Game(cls);
            game.updateStats();
            
            screen.style.display = 'none';
            requestAnimationFrame(loop);
        });
        
        // Also allow touch
        card.addEventListener('touchstart', (e) => {
            e.preventDefault(); // prevent mouse emulation
            const cls = card.dataset.class;
            if (soundManager.ctx.state === 'suspended') soundManager.ctx.resume();
            game = new Game(cls);
            game.updateStats();
            screen.style.display = 'none';
            requestAnimationFrame(loop);
        }, { passive: false });
    });
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