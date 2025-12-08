import { soundManager } from './SoundManager.js';
import { LevelManager } from './LevelManager.js';
import { CombatSystem } from './CombatSystem.js';
import { ShopSystem } from './ShopSystem.js';

export class Game {
    constructor(persistence, slotIndex, loadData, newClass) {
        this.persistence = persistence;
        this.slotIndex = slotIndex;
        
        this.mapWidth = 25;
        this.mapHeight = 25;
        this.floors = {};
        this.effects = [];
        this.log = [];
        this.inShop = false;
        
        this.levelManager = new LevelManager(this);
        this.combat = new CombatSystem(this);
        this.shop = new ShopSystem(this);

        if (loadData) {
            // Load existing
            this.player = JSON.parse(JSON.stringify(loadData));
            this.dungeonSeed = this.player.seed;
            // Clear current floor-specifics to force regen based on seed if needed
            // Actually, we need to regenerate the floor we are on
            this.level = this.player.floor;
            // Note: `floors` cache is empty, so enterLevel will regen it using the seed logic
        } else {
            // New Game
            const playerClass = newClass || 'warrior';
            let hp = 10, maxHp = 10, dmg = 1;
            if (playerClass === 'mage') { hp = 6; maxHp = 6; dmg = 2; }
            if (playerClass === 'archer') { hp = 8; maxHp = 8; dmg = 1; }
            
            this.dungeonSeed = Math.random();

            this.player = {
                x: 1, y: 1,
                classType: playerClass,
                hp, maxHp, dmgMod: dmg,
                level: 1, xp: 0, xpToNext: 20,
                gold: 0, hasKey: false,
                floor: 1,
                seed: this.dungeonSeed
            };
            this.level = 1;
        }

        this.map = [];
        this.enemies = [];
        this.objects = [];

        // Init Level
        // If loading, we want to try to place at player x/y
        this.levelManager.enterLevel(this.level, loadData ? 'load' : 'down');
        
        // Initial Save
        this.save();
        this.broadcastPresence();

        window.buyItem = (index) => this.shop.buyItem(index);
        const closeBtn = document.getElementById('close-shop-btn');
        if (closeBtn) closeBtn.onclick = () => this.shop.closeShop();
        
        // Presence loop
        setInterval(() => this.broadcastPresence(), 1000);
    }
    
    save() {
        this.player.floor = this.level;
        this.player.seed = this.dungeonSeed;
        // Don't save x/y every frame, but we do here for explicit saves
        // When saving, we might want to save current floor state? 
        // For now, just save player stats. Floor is procedural deterministic.
        this.persistence.saveCharacter(this.slotIndex, this.player);
    }
    
    broadcastPresence() {
        this.persistence.updatePresence(this.player, this.level, this.dungeonSeed);
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

        if (newY < 0 || newY >= this.mapHeight || newX < 0 || newX >= this.mapWidth) return;
        if (this.map[newY][newX] === 1) return;

        const enemy = this.enemies.find(e => e.x === newX && e.y === newY);
        if (enemy) {
            this.combat.attackEnemy(enemy);
            this.combat.processTurn();
            this.save();
            return;
        }

        this.player.x = newX;
        this.player.y = newY;
        soundManager.play('step');
        
        this.broadcastPresence();

        this.combat.processTurn();
    }

    interact() {
        if (this.inShop) return;

        const obj = this.objects.find(o => o.x === this.player.x && o.y === this.player.y);
        const shopkeeper = this.objects.find(o => o.type === 'shopkeeper' && Math.abs(o.x - this.player.x) <= 1 && Math.abs(o.y - this.player.y) <= 1);

        if (shopkeeper) {
            this.shop.openShop();
            return;
        }

        if (obj) {
            if (obj.type === 'stairs') {
                this.levelManager.enterLevel(this.level + 1, 'down');
            } else if (obj.type === 'stairs_up') {
                if (this.level > 1) {
                    this.levelManager.enterLevel(this.level - 1, 'up');
                } else {
                    this.addLog("Can't leave the dungeon yet!");
                }
            } else if (obj.type === 'boss_door') {
                if (this.player.hasKey) {
                    this.levelManager.enterBossRoom();
                } else {
                    soundManager.play('locked');
                    this.addLog("Locked! Need a Key.");
                }
            } else if (obj.type === 'key') {
                this.player.hasKey = true;
                soundManager.play('unlock');
                this.addLog("Got a Boss Key!");
                this.objects = this.objects.filter(o => o !== obj);
                this.save();
                this.updateStats();
            } else if (obj.type === 'chest' && !obj.opened) {
                obj.opened = true;
                const gold = Math.floor(Math.random() * 20) + 10;
                this.player.gold += gold;
                soundManager.play('pickup');
                this.addLog(`Found ${gold} gold!`);
                this.objects = this.objects.filter(o => o !== obj);
                this.save();
            }
        }
    }

    respawn() {
        const loss = Math.floor(this.player.xp * 0.05);
        this.player.xp = Math.max(0, this.player.xp - loss);
        this.player.hp = this.player.maxHp;

        this.addLog(`Respawned. Lost ${loss} XP.`);

        const start = this.floors[this.level]?.startPos || { x: 1, y: 1 };
        this.player.x = start.x;
        this.player.y = start.y;
        
        this.save();
        this.broadcastPresence();
        this.updateStats();
    }
}