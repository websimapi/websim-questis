import { MapGen } from './MapGen.js';
import { soundManager } from './SoundManager.js';

export class Game {
    constructor(playerClass = 'warrior') {
        this.mapWidth = 25;
        this.mapHeight = 25;
        this.level = 1;
        this.floors = {}; // Cache for visited floors: { [level]: { map, enemies, objects, visited } }
        
        // Initial Stats based on Class
        let hp = 10;
        let maxHp = 10;
        let dmg = 1; 
        
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
        
        this.enterLevel(1, 'down'); // Start at level 1

        // Setup global buy handler
        window.buyItem = (index) => this.buyItem(index);
        const closeBtn = document.getElementById('close-shop-btn');
        if (closeBtn) closeBtn.onclick = () => this.closeShop();
    }

    async enterLevel(levelNum, entryMethod = 'down') {
        // entryMethod: 'down' (came from above, so spawn at stairs_up or start), 'up' (came from below, spawn at stairs_down)
        
        // Save current floor state if exists
        if (this.floors[this.level]) {
            this.floors[this.level].enemies = this.enemies;
            this.floors[this.level].objects = this.objects;
            // Mark shopkeeper as gone if we are leaving this floor
            if (this.floors[this.level].hasShopkeeper) {
                this.objects = this.objects.filter(o => o.type !== 'shopkeeper');
                this.floors[this.level].objects = this.objects;
                this.floors[this.level].hasShopkeeper = false;
            }
        }

        this.level = levelNum;

        if (!this.floors[levelNum]) {
            this.generateNewLevel(levelNum);
        } else {
            // Restore level
            const floor = this.floors[levelNum];
            this.map = floor.map;
            this.enemies = floor.enemies;
            this.objects = floor.objects;
            this.mapWidth = floor.width;
            this.mapHeight = floor.height;
        }

        // Position Player
        if (entryMethod === 'down') {
            // Find 'stairs_up' or default start
            const start = this.objects.find(o => o.type === 'stairs_up');
            if (start) {
                this.player.x = start.x;
                this.player.y = start.y;
            } else {
                // Fallback for level 1
                 // If level 1 and just started, we might not have stairs_up, map gen handles player pos usually?
                 // Actually map gen doesn't set player pos in state, it just returns start pos.
                 // We need to store start pos in floor data or rely on stairs.
                 if (this.floors[levelNum].startPos) {
                     this.player.x = this.floors[levelNum].startPos.x;
                     this.player.y = this.floors[levelNum].startPos.y;
                 }
            }
        } else if (entryMethod === 'up') {
            // Find 'stairs' (down stairs)
            const exit = this.objects.find(o => o.type === 'stairs');
            if (exit) {
                this.player.x = exit.x;
                this.player.y = exit.y;
            }
        }

        this.addLog(`Floor ${this.level}`);
        this.updateStats();
    }

    generateNewLevel(levelNum) {
        // Determine level type
        const isShop = levelNum > 1 && (levelNum % 4 === 0 || Math.random() < 0.1);
        const isBossKeyFloor = Math.random() < 0.3; // 30% chance to have a key
        // Every 5 levels is a potential boss gate floor
        const isBossGateFloor = levelNum % 5 === 0;

        let width = 25, height = 25;
        let newMap, startPos, objects = [], enemies = [];
        
        if (isShop) {
            width = 12; height = 12;
            newMap = [];
            for(let y=0; y<height; y++) {
                const row = [];
                for(let x=0; x<width; x++) {
                    if (y===0 || y===height-1 || x===0 || x===width-1) row.push(1);
                    else row.push(0);
                }
                newMap.push(row);
            }
            startPos = { x: 2, y: 6 };
            objects.push({ type: 'stairs', x: 10, y: 6 }); // Down
            objects.push({ type: 'stairs_up', x: 2, y: 6 }); // Up
            objects.push({ type: 'shopkeeper', x: 6, y: 5 });
        } else {
            // Normal Dungeon
            const gen = new MapGen(width, height);
            let attempts = 0;
            while(attempts < 10) {
                newMap = gen.generate();
                startPos = gen.findFreeSpot(newMap);
                const stairsPos = gen.findFreeSpot(newMap);
                
                // Path check
                const dist = gen.getPath(newMap, startPos, stairsPos);
                if (dist > 5) {
                    objects.push({ type: 'stairs', x: stairsPos.x, y: stairsPos.y });
                    objects.push({ type: 'stairs_up', x: startPos.x, y: startPos.y });
                    
                    if (isBossKeyFloor && !this.player.hasKey) {
                        const keyPos = gen.findFreeSpot(newMap);
                         objects.push({ type: 'key', x: keyPos.x, y: keyPos.y });
                    }

                    if (isBossGateFloor) {
                         const bossDoorPos = gen.findFreeSpot(newMap);
                         // Ensure it's reachable
                         if (gen.getPath(newMap, startPos, bossDoorPos) !== -1) {
                             objects.push({ type: 'boss_door', x: bossDoorPos.x, y: bossDoorPos.y });
                         }
                    }

                    break;
                }
                attempts++;
            }
            
            // Generate Enemies based on level
            const enemyCount = 4 + Math.floor(levelNum * 0.8);
            const gen2 = new MapGen(width, height); // Just for findFreeSpot helper
            
            for(let i=0; i<enemyCount; i++) {
                const pos = gen2.findFreeSpot(newMap);
                if (Math.abs(pos.x - startPos.x) < 3 && Math.abs(pos.y - startPos.y) < 3) continue;

                let eType = 'slime';
                let hp = 3 + Math.floor(levelNum * 0.5);
                let dmg = 1 + Math.floor(levelNum * 0.2);

                if (levelNum >= 3 && Math.random() > 0.6) {
                    eType = 'skeleton';
                    hp += 4;
                    dmg += 1;
                }
                
                enemies.push({ x: pos.x, y: pos.y, hp, maxHp: hp, dmg, type: eType });
            }

            // Chests
            if (Math.random() > 0.5) {
                 const pos = gen2.findFreeSpot(newMap);
                 objects.push({ type: 'chest', x: pos.x, y: pos.y, opened: false });
            }
        }

        this.floors[levelNum] = {
            map: newMap,
            enemies: enemies,
            objects: objects,
            width: width,
            height: height,
            startPos: startPos,
            hasShopkeeper: isShop
        };

        this.map = newMap;
        this.enemies = enemies;
        this.objects = objects;
        this.mapWidth = width;
        this.mapHeight = height;
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
            questText.innerText = "Key Found! Look for Boss Door.";
            questText.style.color = "#4ff";
        } else {
            questText.innerText = "Explore deeper...";
            questText.style.color = "#fff";
        }
    }

    movePlayer(dx, dy) {
        if (this.inShop) return; 

        const newX = this.player.x + dx;
        const newY = this.player.y + dy;

        if (this.map[newY][newX] === 1) return;

        const enemy = this.enemies.find(e => e.x === newX && e.y === newY);
        if (enemy) {
            this.attackEnemy(enemy);
            this.processTurn();
            return;
        }

        this.player.x = newX;
        this.player.y = newY;
        soundManager.play('step');

        this.processTurn();
    }

    interact() {
        if (this.inShop) return;

        const obj = this.objects.find(o => o.x === this.player.x && o.y === this.player.y);
        // Overlap logic for shopkeeper in small room
        const shopkeeper = this.objects.find(o => o.type === 'shopkeeper' && Math.abs(o.x - this.player.x) <= 1 && Math.abs(o.y - this.player.y) <= 1);

        if (shopkeeper) {
            this.openShop();
            return;
        }

        if (obj) {
            if (obj.type === 'stairs') {
                this.enterLevel(this.level + 1, 'down');
            } else if (obj.type === 'stairs_up') {
                if (this.level > 1) {
                    this.enterLevel(this.level - 1, 'up');
                } else {
                    this.addLog("Can't leave the dungeon yet!");
                }
            } else if (obj.type === 'boss_door') {
                if (this.player.hasKey) {
                    this.enterBossRoom();
                } else {
                    soundManager.play('locked');
                    this.addLog("Locked! Need a Key.");
                }
            } else if (obj.type === 'key') {
                this.player.hasKey = true;
                soundManager.play('unlock');
                this.addLog("Got a Boss Key!");
                this.objects = this.objects.filter(o => o !== obj);
                this.updateStats();
            } else if (obj.type === 'chest' && !obj.opened) {
                obj.opened = true;
                const gold = Math.floor(Math.random() * 20) + 10;
                this.player.gold += gold;
                soundManager.play('pickup');
                this.addLog(`Found ${gold} gold!`);
                this.objects = this.objects.filter(o => o !== obj);
            }
        }
    }

    enterBossRoom() {
        this.player.hasKey = false; // Consume key? Prompt says "take a key to go through", implies consumption.
        soundManager.play('win'); // Placeholder transition sound
        
        // Generate Boss Room Manually
        this.level = 999; // Special ID for boss room? Or just separate state?
        // Let's just overwrite current state for simplicity or use a sub-level
        
        this.mapWidth = 15;
        this.mapHeight = 15;
        this.map = [];
        for(let y=0; y<this.mapHeight; y++) {
            const row = [];
            for(let x=0; x<this.mapWidth; x++) {
                if (y===0 || y===this.mapHeight-1 || x===0 || x===this.mapWidth-1) row.push(1);
                else row.push(0);
            }
            this.map.push(row);
        }
        
        this.player.x = 7;
        this.player.y = 12;
        
        // Spawn Boss
        this.enemies = [{
            x: 7, y: 3,
            hp: 50 + (this.level * 2), // High HP
            maxHp: 50 + (this.level * 2),
            dmg: 4 + Math.floor(this.level * 0.5),
            type: 'boss'
        }];
        
        this.objects = []; // No exit until win?
        
        this.addLog("BOSS FIGHT!");
        this.updateStats();
    }

    async openShop() {
        this.inShop = true;
        document.getElementById('shop-ui').style.display = 'flex';
        document.getElementById('shop-items-container').innerHTML = '';
        document.getElementById('shop-loading').style.display = 'block';
        this.updateStats();

        // Check if we already generated items for this specific shop visit
        // Actually, let's just generate new ones for variety if they aren't cached on the floor object
        // But the prompt says shopkeeper disappears after leaving. 
        // We'll attach shopItems to the floor object so they persist while on the floor.
        
        if (!this.floors[this.level].shopItems) {
            try {
                const completion = await websim.chat.completions.create({
                    messages: [
                        {
                            role: "system",
                            content: `You are an RPG item generator. Generate 4 items for a shop.
                            Format: JSON array of objects with keys: name, type (weapon/armor/potion), cost, effect (description), stat (e.g. "hp+5", "dmg+2").
                            Player Level: ${this.player.level}, Class: ${this.player.classType}.
                            Include 1 cheap, 2 mid, 1 expensive item.`
                        }
                    ],
                    json: true
                });
                const items = JSON.parse(completion.content);
                this.floors[this.level].shopItems = items.items || items; // Handle if wrapped
            } catch (e) {
                console.error("Shop Gen Failed", e);
                // Fallback items
                this.floors[this.level].shopItems = [
                    { name: "Potion", type: "potion", cost: 50, effect: "Heals 10 HP", stat: "hp+10" },
                    { name: "Iron Sword", type: "weapon", cost: 100, effect: "Dmg +1", stat: "dmg+1" }
                ];
            }
        }

        this.renderShopItems(this.floors[this.level].shopItems);
        document.getElementById('shop-loading').style.display = 'none';
    }

    renderShopItems(items) {
        const container = document.getElementById('shop-items-container');
        container.innerHTML = '';
        
        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'shop-item';
            div.onclick = () => window.buyItem(index);
            
            let icon = '🛡️';
            if (item.type === 'weapon') icon = '⚔️';
            if (item.type === 'potion') icon = '❤️';

            div.innerHTML = `
                <div class="icon">${icon}</div>
                <div style="flex-grow:1; text-align:left; padding-left:10px;">
                    <div style="font-weight:bold">${item.name}</div>
                    <div style="font-size:0.8em; color:#aaa;">${item.effect}</div>
                </div>
                <div class="cost">${item.cost}g</div>
            `;
            container.appendChild(div);
        });
    }

    buyItem(index) {
        const item = this.floors[this.level].shopItems[index];
        if (!item) return;

        if (this.player.gold >= item.cost) {
            this.player.gold -= item.cost;
            soundManager.play('buy');
            
            // Apply Effects
            if (item.stat) {
                if (item.stat.includes('hp+')) {
                    const val = parseInt(item.stat.split('+')[1]);
                    if (item.type === 'potion') {
                         this.player.hp = Math.min(this.player.hp + val, this.player.maxHp);
                    } else {
                         // Max HP Up
                         this.player.maxHp += val;
                         this.player.hp += val;
                    }
                }
                if (item.stat.includes('dmg+')) {
                    const val = parseInt(item.stat.split('+')[1]);
                    this.player.dmgMod += val;
                }
            } else {
                // Heuristic parsing if stat field missing
                if (item.type === 'potion') this.player.hp = Math.min(this.player.hp + 10, this.player.maxHp);
                if (item.type === 'weapon') this.player.dmgMod += 1;
            }

            this.addLog(`Bought ${item.name}!`);
            this.updateStats();
        } else {
            soundManager.play('locked');
            this.addLog("Not enough gold!");
        }
    }

    closeShop() {
        this.inShop = false;
        document.getElementById('shop-ui').style.display = 'none';
    }

    spawnEffect(x, y, type) {
        this.effects.push({
            x, y, type,
            startTime: Date.now(),
            duration: 250 
        });
    }

    attackEnemy(enemy) {
        let dmg = 1;
        let effectType = 'slash';

        if (this.player.classType === 'mage') {
            dmg = 2 + Math.floor(this.player.level / 2); 
            effectType = 'magic';
        } else if (this.player.classType === 'archer') {
            dmg = 1 + Math.floor(this.player.level / 3);
            effectType = 'arrow';
            if (Math.random() < 0.3) { 
                dmg *= 2;
                this.addLog("Critical Hit!");
            }
        } else {
            dmg = 1 + Math.floor(this.player.level / 3);
        }
        
        // Add gear dmg
        dmg += (this.player.dmgMod - (this.player.classType==='mage'?2:1)); // Subtract base to get bonus

        this.spawnEffect(enemy.x, enemy.y, effectType);

        enemy.hp -= dmg;
        soundManager.play('attack');
        
        if (enemy.hp <= 0) {
            this.enemies = this.enemies.filter(e => e !== enemy);
            
            if (enemy.type === 'boss') {
                this.addLog("BOSS DEFEATED!");
                soundManager.play('win');
                // Drop massive loot
                this.player.gold += 500;
                this.gainXp(500);
                // Spawn stairs to exit boss room
                this.objects.push({ type: 'stairs', x: 7, y: 7 });
            } else {
                this.addLog(`${enemy.type} defeated!`);
                this.gainXp(10 + (this.level * 2));
            }
        } else {
            this.addLog(`Hit ${enemy.type} for ${dmg}!`);
        }
    }

    gainXp(amount) {
        this.player.xp += amount;
        if (this.player.xp >= this.player.xpToNext) {
            this.player.level++;
            this.player.xp -= this.player.xpToNext;
            this.player.xpToNext = Math.floor(this.player.xpToNext * 1.5);
            this.player.maxHp += 2;
            this.player.hp = this.player.maxHp; 
            soundManager.play('unlock'); 
            this.addLog(`Level Up! You are lvl ${this.player.level}`);
        }
    }

    processTurn() {
        this.enemies.forEach(enemy => {
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            const dist = Math.abs(dx) + Math.abs(dy);

            // Boss AI: Attack from range if possible? 
            // Keep simple: All enemies melee for now, maybe skeleton shoots later
            
            if (dist <= 1) {
                this.player.hp -= enemy.dmg;
                soundManager.play('hit');
                this.addLog(`${enemy.type} hits you!`);
                
                if (this.player.hp <= 0) {
                    this.addLog(`YOU DIED! Respawning...`);
                    soundManager.play('hit'); 
                    setTimeout(() => this.respawn(), 1000);
                }
            } else if (dist < 6) {
                // Chase
                const moveX = dx !== 0 ? Math.sign(dx) : 0;
                const moveY = dy !== 0 ? Math.sign(dy) : 0;
                
                let nextX = enemy.x + moveX;
                let nextY = enemy.y;
                
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
        if (this.objects.some(o => o.x === x && o.y === y && o.type === 'shopkeeper')) return true; 
        return false;
    }

    respawn() {
        const loss = Math.floor(this.player.xp * 0.05);
        this.player.xp = Math.max(0, this.player.xp - loss);
        this.player.hp = this.player.maxHp;
        
        this.addLog(`Respawned. Lost ${loss} XP.`);
        
        // Reset to start of current level? Or delete level?
        // Let's reset player position to start of this level
        const start = this.floors[this.level]?.startPos || {x:1, y:1};
        this.player.x = start.x;
        this.player.y = start.y;
        this.updateStats();
    }
}