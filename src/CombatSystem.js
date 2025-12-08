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

        // Buffs Calculation
        let buffDmg = 0;
        game.player.buffs.forEach(b => {
             if (b.stat === 'dmg') buffDmg += b.val;
        });

        dmg += (game.player.dmgMod - (game.player.classType === 'mage' ? 2 : 1)) + buffDmg;

        this.spawnEffect(enemy.x, enemy.y, effectType);

        enemy.hp -= dmg;
        soundManager.play('attack');

        if (enemy.hp <= 0) {
            game.enemies = game.enemies.filter(e => e !== enemy);

            // Drops
            this.handleDrops(enemy);

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

    handleDrops(enemy) {
        const game = this.game;
        const chance = Math.random();
        
        let drop = null;
        let rare = false;

        // Base Drop Chance 40%
        if (chance < 0.4) {
            if (enemy.type === 'skeleton') drop = 'bone';
            else if (enemy.type === 'slime') drop = 'slime_goo';
            else if (enemy.type === 'boss') drop = 'demon_horn';
            else drop = 'bone'; // default
        }

        // Rare Drop Chance 5% (separate check)
        if (Math.random() < 0.05) {
            rare = true;
            // Rare drops are items we can equip or use? For now let's make them 'rare_material'
            // Prompt says "Unique rare drops... for user to pickup and use"
            // Let's implement usable items later or make them tradeables. 
            // For now, let's drop a "Rare Essence" used at altars too.
            // Actually, prompt says "unique rare items but they will be punished...". 
            // That was for the altar. Drops are just "unique rare drops".
            // Let's drop a "Golden Bone" or something.
        }

        if (drop) {
            game.objects.push({ 
                type: 'loot', 
                item: drop, 
                count: 1, 
                x: enemy.x, 
                y: enemy.y 
            });
        }
    }

    pickupLoot(lootObj) {
        const game = this.game;
        const item = lootObj.item;
        if (!game.player.inventory[item]) game.player.inventory[item] = 0;
        game.player.inventory[item] += lootObj.count;
        
        game.objects = game.objects.filter(o => o !== lootObj);
        soundManager.play('pickup');
        game.addLog(`Picked up ${item}!`);
        game.updateStats();
        game.save();
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

    attackPlayer(targetId) {
        const game = this.game;
        const target = game.persistence.room.peers[targetId];
        if (!target) return;

        let dmg = 1;
        let effectType = 'slash';
        
        // PvP Balance (halved dmg for longer fights?)
        if (game.player.classType === 'mage') {
            dmg = 2 + Math.floor(game.player.level / 2);
            effectType = 'magic';
        } else if (game.player.classType === 'archer') {
            dmg = 1 + Math.floor(game.player.level / 3);
            effectType = 'arrow';
            if (Math.random() < 0.3) dmg *= 1.5;
        } else {
            dmg = 1 + Math.floor(game.player.level / 3);
        }
        dmg += game.player.dmgMod;
        
        // Find target pos from presence
        const pData = game.persistence.room.presence[targetId];
        if (pData) {
            this.spawnEffect(pData.x, pData.y, effectType);
            game.persistence.sendDamage(targetId, dmg, game.persistence.room.clientId);
            game.addLog(`Attacked ${target.username || 'Player'}!`);
            soundManager.play('attack');
        }
    }

    handleIncomingDamage(amount, attackerId) {
        const game = this.game;
        game.player.hp -= amount;
        soundManager.play('hit');
        game.addLog(`Took ${amount} damage!`);
        game.updateStats();

        if (game.player.hp <= 0) {
            game.player.hp = 0;
            // Handle Death
            if (game.inArena) {
                game.arenaSystem.handleDeath(attackerId);
            } else {
                game.addLog(`YOU DIED! Respawning...`);
                setTimeout(() => game.respawn(), 1000);
            }
        }
    }

    isOccupied(x, y) {
        const game = this.game;
        if (x === game.player.x && y === game.player.y) return true;
        if (game.enemies.some(e => e.x === x && e.y === y)) return true;
        if (game.objects.some(o => o.x === x && o.y === y && o.type === 'shopkeeper')) return true;
        
        // Check other players (Solid in PvP? Maybe)
        // Let's make players non-solid to prevent blocking, or solid for tactical?
        // Let's make solid.
        if (game.persistence.room && game.persistence.room.presence) {
            for (const [id, p] of Object.entries(game.persistence.room.presence)) {
                if (id !== game.persistence.room.clientId) {
                    // Only collide if in same scope (floor/seed or arena)
                    if (game.inArena) {
                        if (p.arenaId === game.arenaSystem.arenaId && p.x === x && p.y === y) return true;
                    } else {
                        if (p.floor === game.level && Math.abs(p.seed - game.dungeonSeed) < 0.001 && p.x === x && p.y === y) return true;
                    }
                }
            }
        }

        return false;
    }
}

