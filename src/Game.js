import { MapGen } from './MapGen.js';
import { soundManager } from './SoundManager.js';

export class Game {
    constructor(playerClass = 'warrior') {
        this.mapWidth = 25;
        this.mapHeight = 25;
        this.level = 1;
        
        // Initial Stats based on Class
        let hp = 10;
        let maxHp = 10;
        let dmg = 1; // Base damage mod
        
        if (playerClass === 'mage') {
            hp = 6;
            maxHp = 6;
            dmg = 2; 
        } else if (playerClass === 'archer') {
            hp = 8;
            maxHp = 8;
            dmg = 1;
        }

        this.player = { 
            x: 1, 
            y: 1, 
            classType: playerClass,
            hp: hp, 
            maxHp: maxHp, 
            dmgMod: dmg,
            level: 1,
            xp: 0,
            xpToNext: 20,
            gold: 0, 
            hasKey: false 
        };

        this.map = []; 
        this.enemies = [];
        this.objects = [];
        this.log = [];
        this.effects = [];
        this.inShop = false;
        
        this.initLevel();

        // Setup global buy handler
        window.buyItem = (item) => this.buyItem(item);
        const closeBtn = document.getElementById('close-shop-btn');
        if (closeBtn) closeBtn.onclick = () => this.closeShop();
    }

    initLevel() {
        // Check if shop floor (Every 4 levels or 10% chance, but ensuring first floor is normal)
        const isShop = this.level > 1 && (this.level % 4 === 0 || Math.random() < 0.05);

        if (isShop) {
            this.initShopLevel();
        } else {
            this.initNormalLevel();
        }
    }

    initShopLevel() {
        this.mapWidth = 10;
        this.mapHeight = 10;
        
        // Simple room
        this.map = [];
        for(let y=0; y<this.mapHeight; y++) {
            const row = [];
            for(let x=0; x<this.mapWidth; x++) {
                if (y===0 || y===this.mapHeight-1 || x===0 || x===this.mapWidth-1) row.push(1);
                else row.push(0);
            }
            this.map.push(row);
        }

        this.player.x = 2;
        this.player.y = 5;
        this.enemies = [];
        this.objects = [
            { type: 'shopkeeper', x: 5, y: 5 },
            { type: 'stairs', x: 7, y: 5 }
        ];
        
        // Auto grant key for shop levels so they can leave freely
        this.player.hasKey = true; 
        
        this.addLog(`Floor ${this.level}: Safe Zone`);
        this.updateStats();
    }

    initNormalLevel() {
        const gen = new MapGen(this.mapWidth, this.mapHeight);
        
        // Retry loop to ensure valid map with connected objectives
        let attempts = 0;
        while (attempts < 10) {
            this.map = gen.generate();
            
            // Spawn Player
            const startPos = gen.findFreeSpot(this.map);
            
            // Spawn Key - Try to put it somewhat far
            let keyPos = gen.findFreeSpot(this.map);
            let distToKey = gen.getPath(this.map, startPos, keyPos);
            
            // Attempt to find a better key spot if too close
            for(let i=0; i<5; i++) {
                if (distToKey > 8) break; 
                const candidate = gen.findFreeSpot(this.map);
                const d = gen.getPath(this.map, startPos, candidate);
                if (d > distToKey) {
                    keyPos = candidate;
                    distToKey = d;
                }
            }

            // Spawn Exit - Try to put it far from start AND key
            let exitPos = gen.findFreeSpot(this.map);
            let distToExit = gen.getPath(this.map, startPos, exitPos);
            let keyToExit = gen.getPath(this.map, keyPos, exitPos);

            // Simple check: Valid paths must exist
            if (distToKey !== -1 && distToExit !== -1 && keyToExit !== -1) {
                // Apply positions
                this.player.x = startPos.x;
                this.player.y = startPos.y;
                this.player.hasKey = false;
                
                this.objects = [
                    { type: 'stairs', x: exitPos.x, y: exitPos.y },
                    { type: 'key', x: keyPos.x, y: keyPos.y }
                ];
                break; // Valid map found
            }
            attempts++;
        }
        
        // If loop finishes without break (rare), we rely on last generated.

        // Spawn Enemies
        this.enemies = [];
        const enemyCount = 4 + Math.floor(this.level * 0.7);
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
        if (Math.random() > 0.4) {
            const pos = gen.findFreeSpot(this.map);
            this.objects.push({ type: 'chest', x: pos.x, y: pos.y, opened: false });
        }

        this.addLog(`Floor ${this.level}: Find the Key!`);
        this.updateStats();
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
        document.getElementById('lvl-val').innerText = this.player.level;
        document.getElementById('xp-val').innerText = this.player.xp;
        document.getElementById('xp-req-val').innerText = this.player.xpToNext;
        document.getElementById('level-text').innerText = `Floor: ${this.level}`;
        
        if (this.inShop) {
             document.getElementById('shop-gold').innerText = `Gold: ${this.player.gold}`;
        }

        const questText = document.getElementById('quest-text');
        if (this.player.hasKey) {
            questText.innerText = "Quest: Enter Stairs";
            questText.style.color = "#4ff";
        } else {
            questText.innerText = "Quest: Find Key";
            questText.style.color = "#fff";
        }
    }

    movePlayer(dx, dy) {
        if (this.inShop) return; // Prevent movement while shopping

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
        if (this.inShop) return;

        // Check objects under player
        const obj = this.objects.find(o => o.x === this.player.x && o.y === this.player.y);
        
        // Also check adjacent for shopkeeper interaction (since we can't stand ON him usually if he was solid, 
        // but here objects are not solid, so we can check overlap or distance)
        // Let's support overlapping logic first.
        
        if (obj) {
            if (obj.type === 'stairs') {
                if (this.player.hasKey) {
                    soundManager.play('win');
                    this.level++;
                    this.initLevel();
                } else {
                    soundManager.play('locked');
                    this.addLog("Locked! Need a key.");
                }
            } else if (obj.type === 'key') {
                this.player.hasKey = true;
                soundManager.play('unlock');
                this.addLog("Got the Key!");
                this.objects = this.objects.filter(o => o !== obj);
                this.updateStats();
            } else if (obj.type === 'chest' && !obj.opened) {
                obj.opened = true;
                const gold = Math.floor(Math.random() * 10) + 5;
                this.player.gold += gold;
                soundManager.play('pickup');
                this.addLog(`Found ${gold} gold!`);
                // Remove chest visually or change to open? For now remove
                this.objects = this.objects.filter(o => o !== obj);
            } else if (obj.type === 'shopkeeper') {
                this.openShop();
            }
        }
    }

    openShop() {
        this.inShop = true;
        document.getElementById('shop-ui').style.display = 'flex';
        this.updateStats();
    }

    closeShop() {
        this.inShop = false;
        document.getElementById('shop-ui').style.display = 'none';
    }

    buyItem(item) {
        let cost = 0;
        if (item === 'potion') cost = 50;
        if (item === 'upgrade') cost = 100;
        if (item === 'maxhp') cost = 100;

        if (this.player.gold >= cost) {
            this.player.gold -= cost;
            soundManager.play('buy');
            
            if (item === 'potion') {
                this.player.hp = Math.min(this.player.hp + 5, this.player.maxHp);
                this.addLog("Healed 5 HP!");
            }
            if (item === 'upgrade') {
                this.player.dmgMod += 1;
                this.addLog("Weapon Upgraded!");
            }
            if (item === 'maxhp') {
                this.player.maxHp += 2;
                this.player.hp += 2;
                this.addLog("Max HP Increased!");
            }
            this.updateStats();
        } else {
            soundManager.play('locked');
            this.addLog("Not enough gold!");
        }
    }

    spawnEffect(x, y, type) {
        this.effects.push({
            x, y, type,
            startTime: Date.now(),
            duration: 250 // ms
        });
    }

    attackEnemy(enemy) {
        let dmg = 1;
        let effectType = 'slash';

        // Class calculations
        if (this.player.classType === 'mage') {
            dmg = 2 + Math.floor(this.player.level / 2); // Mage scales damage faster
            effectType = 'magic';
        } else if (this.player.classType === 'archer') {
            dmg = 1 + Math.floor(this.player.level / 3);
            effectType = 'arrow';
            if (Math.random() < 0.3) { // 30% Crit chance
                dmg *= 2;
                this.addLog("Critical Hit!");
            }
        } else {
            // Warrior
            dmg = 1 + Math.floor(this.player.level / 3);
        }

        // Add visual effect
        this.spawnEffect(enemy.x, enemy.y, effectType);

        enemy.hp -= dmg;
        soundManager.play('attack');
        
        if (enemy.hp <= 0) {
            this.enemies = this.enemies.filter(e => e !== enemy);
            this.addLog(`Blob defeated!`);
            this.gainXp(10 + (this.level * 2));
        } else {
            this.addLog(`You hit blob for ${dmg}!`);
        }
    }

    gainXp(amount) {
        this.player.xp += amount;
        if (this.player.xp >= this.player.xpToNext) {
            this.player.level++;
            this.player.xp -= this.player.xpToNext;
            this.player.xpToNext = Math.floor(this.player.xpToNext * 1.5);
            
            // Stat up
            this.player.maxHp += 2;
            this.player.hp = this.player.maxHp; // Full heal on level up
            
            soundManager.play('unlock'); // Reuse unlock sound for level up
            this.addLog(`Level Up! You are lvl ${this.player.level}`);
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
                
                // Enemy attack effect? Maybe later.
                
                if (this.player.hp <= 0) {
                    this.addLog(`YOU DIED! Respawning...`);
                    soundManager.play('hit'); 
                    setTimeout(() => this.respawn(), 1000);
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
        if (this.objects.some(o => o.x === x && o.y === y && o.type === 'shopkeeper')) return true; // Treat shopkeeper as obstacle
        return false;
    }

    respawn() {
        // Penalty
        const loss = Math.floor(this.player.xp * 0.05);
        this.player.xp = Math.max(0, this.player.xp - loss);
        this.player.hp = this.player.maxHp;
        
        this.addLog(`Respawned. Lost ${loss} XP.`);
        this.initLevel(); // Regenerate level
    }
}