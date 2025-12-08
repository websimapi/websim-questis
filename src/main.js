import { loadAssets } from './assets.js';
import { soundManager } from './SoundManager.js';
import { Game } from './Game.js';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { Persistence } from './Persistence.js';

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const input = new Input();
const persistence = new Persistence();
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
    await persistence.init();

    document.getElementById('loading-screen').style.display = 'none';
    showSlots();
};

let selectedSlot = -1;

function showSlots() {
    const screen = document.getElementById('slot-selection-screen');
    screen.style.display = 'flex';
    document.getElementById('class-selection-screen').style.display = 'none';
    
    const container = document.getElementById('slots-container');
    container.innerHTML = '';
    
    const slots = persistence.getSlots();
    
    for (let i = 0; i < 10; i++) {
        const charData = slots[i];
        const div = document.createElement('div');
        div.className = 'slot-card';
        
        if (charData) {
            div.innerHTML = `
                <h3>${charData.classType.toUpperCase()}</h3>
                <p>Floor: ${charData.floor || 1}</p>
                <p>Lvl: ${charData.level}</p>
                <p style="font-size:0.7em; color:#888;">ID: ${charData.seed ? charData.seed.toFixed(4) : '?'}</p>
            `;
            div.onclick = () => loadGame(i, charData);
        } else {
            div.innerHTML = `<h3>Empty Slot ${i+1}</h3><p>Create New</p>`;
            div.onclick = () => createCharacter(i);
        }
        
        container.appendChild(div);
    }
}

function createCharacter(slotIndex) {
    selectedSlot = slotIndex;
    document.getElementById('slot-selection-screen').style.display = 'none';
    document.getElementById('class-selection-screen').style.display = 'flex';
}

function loadGame(slotIndex, charData) {
    selectedSlot = slotIndex;
    startGame(charData);
}

const startGame = (loadData = null, newClass = null) => {
    if (soundManager.ctx.state === 'suspended') soundManager.ctx.resume();
    
    document.getElementById('slot-selection-screen').style.display = 'none';
    document.getElementById('class-selection-screen').style.display = 'none';
    
    game = new Game(persistence, selectedSlot, loadData, newClass);
    game.updateStats();
    
    requestAnimationFrame(loop);
};

// Setup Class Selection
const classScreen = document.getElementById('class-selection-screen');
const options = document.querySelectorAll('.class-card');
options.forEach(card => {
    const select = (e) => {
        if(e) e.preventDefault();
        const cls = card.dataset.class;
        startGame(null, cls);
    };
    card.addEventListener('click', select);
    card.addEventListener('touchstart', select, { passive: false });
});

document.getElementById('cancel-class-btn').onclick = () => {
    showSlots();
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