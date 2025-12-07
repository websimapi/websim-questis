import { MapGen } from './MapGen.js';
import { soundManager } from './SoundManager.js';

export class Game {
    constructor() {
        this.mapWidth = 20;
        this.mapHeight = 20;
        this.level = 1;
        this.player = { x: 1, y: 1, hp: 10, maxHp: 10, gold: 0 };
        this.map = []; // 2D array
        this.enemies = [];
        this.objects = [];
        this.log = [];
        
        this.initLevel();
    }

    initLevel() {
        const gen = new MapGen(this.mapWidth, this.mapHeight);
        this.map = gen.generate();
        
        // Spawn Player
        const startPos = gen.findFreeSpot(this.map);
        this.player.x = startPos.x;
        this.player.y = startPos.y;

        // Spawn Exit
        const exitPos = gen.findFreeSpot(this.map); // Might overwrite player, but rare/ok for this demo
        this.objects = [{ type: 'stairs', x: exitPos.x, y: exitPos.y }];

        // Spawn Enemies
        this.enemies = [];
        const enemyCount = 3 + Math.floor(this.level * 0.5);
        for(let i=0; i<enemyCount; i++) {
            const pos = gen.findFreeSpot(this.map);
            // Don't spawn on player
            if (pos.x === this.player.x && pos.y === this.player.y) continue;
            
            this.enemies.push({
                x: pos.x,
                y: pos.y,
                hp: 3,
                maxHp: 3,
                dmg: 1
            });
        }

        // Spawn Chests
        if (Math.random() > 0.5) {
            const pos = gen.findFreeSpot(this.map);
            this.objects.push({ type: 'chest', x: pos.x, y: pos.y, opened: false });
        }

        this.addLog(`Floor ${this.level} entered.`);
    }

    addLog(msg) {
        this.log.push(msg);
        if (this.log.length > 5) this.log.shift();
        
        const logEl = document.getElementById('message-log');
        if (logEl) logEl.innerText = msg;
    }

    updateStats() {
        document.getElementById('hp-val').innerText = this.player.hp;
        document.getElementById('max-hp-val').innerText = this.player.maxHp;
        document.getElementById('gold-val').innerText = this.player.gold;
        document.getElementById('level-text').innerText = `Floor: ${this.level}`;
    }

    movePlayer(dx, dy) {
        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        // Check walls
        if (this.map[newY][newX] === 1) return;

        // Check enemies
        const enemy = this.enemies.find(e => e.x === newX && e.y === newY);
        if (enemy) {
            this.attackEnemy(enemy);
            this.processTurn();
            return;
        }

        // Move
        this.player.x = newX;
        this.player.y = newY;
        soundManager.play('step');

        this.processTurn();
    }

    interact() {
        // Check objects under player
        const obj = this.objects.find(o => o.x === this.player.x && o.y === this.player.y);
        if (obj) {
            if (obj.type === 'stairs') {
                soundManager.play('win');
                this.level++;
                this.initLevel();
                this.updateStats();
            } else if (obj.type === 'chest' && !obj.opened) {
                obj.opened = true;
                const gold = Math.floor(Math.random() * 10) + 5;
                this.player.gold += gold;
                soundManager.play('pickup');
                this.addLog(`Found ${gold} gold!`);
                // Remove chest visually or change to open? For now remove
                this.objects = this.objects.filter(o => o !== obj);
            }
        }
    }

    attackEnemy(enemy) {
        enemy.hp--;
        soundManager.play('attack');
        this.addLog(`You hit the blob!`);
        if (enemy.hp <= 0) {
            this.enemies = this.enemies.filter(e => e !== enemy);
            this.addLog(`Blob defeated!`);
        }
    }

    processTurn() {
        // Enemies move
        this.enemies.forEach(enemy => {
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            const dist = Math.abs(dx) + Math.abs(dy);

            if (dist <= 1) {
                // Attack player
                this.player.hp -= enemy.dmg;
                soundManager.play('hit');
                this.addLog(`Blob hits you!`);
                if (this.player.hp <= 0) {
                    this.addLog(`GAME OVER. Reloading...`);
                    soundManager.play('hit'); // Death sound?
                    setTimeout(() => location.reload(), 2000);
                }
            } else if (dist < 6) {
                // Chase
                const moveX = dx !== 0 ? Math.sign(dx) : 0;
                const moveY = dy !== 0 ? Math.sign(dy) : 0;
                
                // Try X first
                let nextX = enemy.x + moveX;
                let nextY = enemy.y;
                
                // If X blocked or not moving X, try Y
                if (dx === 0 || this.map[nextY][nextX] === 1 || this.isOccupied(nextX, nextY)) {
                    nextX = enemy.x;
                    nextY = enemy.y + moveY;
                }

                if (this.map[nextY][nextX] === 0 && !this.isOccupied(nextX, nextY)) {
                    enemy.x = nextX;
                    enemy.y = nextY;
                }
            }
        });
        
        this.updateStats();
    }

    isOccupied(x, y) {
        if (x === this.player.x && y === this.player.y) return true;
        if (this.enemies.some(e => e.x === x && e.y === y)) return true;
        return false;
    }
}