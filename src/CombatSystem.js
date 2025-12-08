import { soundManager } from './SoundManager.js';

export class CombatSystem {
    constructor(game) {
        this.game = game;
    }

    spawnEffect(x, y, type) {
        this.game.effects.push({
            x, y, type,
            startTime: Date.now(),
            duration: 250
        });
    }

    attackEnemy(enemy) {
        const game = this.game;
        let dmg = 1;
        let effectType = 'slash';

        if (game.player.classType === 'mage') {
            dmg = 2 + Math.floor(game.player.level / 2);
            effectType = 'magic';
        } else if (game.player.classType === 'archer') {
            dmg = 1 + Math.floor(game.player.level / 3);
            effectType = 'arrow';
            if (Math.random() < 0.3) {
                dmg *= 2;
                game.addLog("Critical Hit!");
            }
        } else {
            dmg = 1 + Math.floor(game.player.level / 3);
        }

        dmg += (game.player.dmgMod - (game.player.classType === 'mage' ? 2 : 1));

        this.spawnEffect(enemy.x, enemy.y, effectType);

        enemy.hp -= dmg;
        soundManager.play('attack');

        if (enemy.hp <= 0) {
            game.enemies = game.enemies.filter(e => e !== enemy);

            if (enemy.type === 'boss') {
                game.addLog("BOSS DEFEATED!");
                soundManager.play('win');
                game.player.gold += 500;
                this.gainXp(500);
                game.objects.push({ type: 'stairs', x: 7, y: 7 });
            } else {
                game.addLog(`${enemy.type} defeated!`);
                this.gainXp(10 + (game.level * 2));
            }
        } else {
            game.addLog(`Hit ${enemy.type} for ${dmg}!`);
        }
    }

    gainXp(amount) {
        const game = this.game;
        game.player.xp += amount;
        if (game.player.xp >= game.player.xpToNext) {
            game.player.level++;
            game.player.xp -= game.player.xpToNext;
            game.player.xpToNext = Math.floor(game.player.xpToNext * 1.5);
            game.player.maxHp += 2;
            game.player.hp = game.player.maxHp;
            soundManager.play('unlock');
            game.addLog(`Level Up! You are lvl ${game.player.level}`);
        }
        game.save();
        game.updateStats();
    }

    processTurn() {
        const game = this.game;

        game.enemies.forEach(enemy => {
            const dx = game.player.x - enemy.x;
            const dy = game.player.y - enemy.y;
            const dist = Math.abs(dx) + Math.abs(dy);

            if (dist <= 1) {
                game.player.hp -= enemy.dmg;
                soundManager.play('hit');
                game.addLog(`${enemy.type} hits you!`);

                if (game.player.hp <= 0) {
                    game.addLog(`YOU DIED! Respawning...`);
                    soundManager.play('hit');
                    setTimeout(() => game.respawn(), 1000);
                }
            } else if (dist < 6) {
                const moveX = dx !== 0 ? Math.sign(dx) : 0;
                const moveY = dy !== 0 ? Math.sign(dy) : 0;

                let nextX = enemy.x + moveX;
                let nextY = enemy.y;

                if (dx === 0 || game.map[nextY][nextX] === 1 || this.isOccupied(nextX, nextY)) {
                    nextX = enemy.x;
                    nextY = enemy.y + moveY;
                }

                if (game.map[nextY][nextX] === 0 && !this.isOccupied(nextX, nextY)) {
                    enemy.x = nextX;
                    enemy.y = nextY;
                }
            }
        });

        game.updateStats();
    }

    isOccupied(x, y) {
        const game = this.game;
        if (x === game.player.x && y === game.player.y) return true;
        if (game.enemies.some(e => e.x === x && e.y === y)) return true;
        if (game.objects.some(o => o.x === x && o.y === y && o.type === 'shopkeeper')) return true;
        return false;
    }
}

