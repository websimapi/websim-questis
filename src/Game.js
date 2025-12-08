import { soundManager } from './SoundManager.js';
import { LevelManager } from './LevelManager.js';
import { CombatSystem } from './CombatSystem.js';
import { ShopSystem } from './ShopSystem.js';

export class Game {
    constructor(playerClass = 'warrior') {
        this.mapWidth = 25;
        this.mapHeight = 25;
        this.level = 1;
        this.floors = {};

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

        this.levelManager = new LevelManager(this);
        this.combat = new CombatSystem(this);
        this.shop = new ShopSystem(this);

        this.levelManager.enterLevel(1, 'down');

        window.buyItem = (index) => this.shop.buyItem(index);
        const closeBtn = document.getElementById('close-shop-btn');
        if (closeBtn) closeBtn.onclick = () => this.shop.closeShop();
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
            this.combat.attackEnemy(enemy);
            this.combat.processTurn();
            return;
        }

        this.player.x = newX;
        this.player.y = newY;
        soundManager.play('step');

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

    respawn() {
        const loss = Math.floor(this.player.xp * 0.05);
        this.player.xp = Math.max(0, this.player.xp - loss);
        this.player.hp = this.player.maxHp;

        this.addLog(`Respawned. Lost ${loss} XP.`);

        const start = this.floors[this.level]?.startPos || { x: 1, y: 1 };
        this.player.x = start.x;
        this.player.y = start.y;
        this.updateStats();
    }
}