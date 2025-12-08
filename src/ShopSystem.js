import { soundManager } from './SoundManager.js';

export class ShopSystem {
    constructor(game) {
        this.game = game;
    }

    async openShop() {
        const game = this.game;
        game.inShop = true;
        game.broadcastPresence(); // Sync inShop status
        document.getElementById('shop-ui').style.display = 'flex';
        document.getElementById('shop-items-container').innerHTML = '';
        document.getElementById('shop-loading').style.display = 'block';
        game.updateStats();

        if (!game.floors[game.level].shopItems) {
            try {
                const aiPromise = window.websim.chat.completions.create({
                    messages: [
                        {
                            role: "system",
                            content: `You are an RPG item generator. Generate 4 items for a shop.
                            Format: JSON array of objects with keys: name, type (weapon/armor/potion), cost, effect (description), stat (e.g. "hp+5", "dmg+2").
                            Player Level: ${game.player.level}, Class: ${game.player.classType}.
                            Include 1 cheap, 2 mid, 1 expensive item.`
                        }
                    ],
                    json: true
                });

                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000));

                const completion = await Promise.race([aiPromise, timeoutPromise]);

                if (!game.inShop) return; // Shop closed during load

                const items = JSON.parse(completion.content);
                game.floors[game.level].shopItems = items.items || items;
            } catch (e) {
                console.warn("Shop generation switched to fallback due to:", e.message);
                game.floors[game.level].shopItems = this.generateFallbackItems(game.player.level);
            }
        }

        if (!game.inShop) return;
        this.renderShopItems(game.floors[game.level].shopItems);
        document.getElementById('shop-loading').style.display = 'none';
    }

    generateFallbackItems(level) {
        const items = [];
        // Potion
        items.push({ 
            name: "Health Potion", 
            type: "potion", 
            cost: Math.floor(20 + (level * 5) * (0.8 + Math.random() * 0.4)), 
            effect: "Heals HP", 
            stat: `hp+${10 + level * 2}` 
        });

        // Weapon
        const weaponDmg = 1 + Math.floor(level/3);
        items.push({ 
            name: `Sharpened Blade +${weaponDmg}`, 
            type: "weapon", 
            cost: Math.floor((50 + (level * 20)) * (0.8 + Math.random() * 0.4)), 
            effect: `Dmg +${weaponDmg}`, 
            stat: `dmg+${weaponDmg}` 
        });

        // Buff Item
        const hpBuff = 5 + level;
        items.push({ 
            name: `Vitality Charm`, 
            type: "potion", 
            cost: Math.floor((80 + (level * 25)) * (0.8 + Math.random() * 0.4)), 
            effect: `Max HP +${hpBuff}`, 
            stat: `hp+${hpBuff}` 
        });
        
        return items;
    }

    renderShopItems(items) {
        const container = document.getElementById('shop-items-container');
        container.innerHTML = '';

        items.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'shop-item';
            div.onclick = () => this.buyItem(index);

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
        const game = this.game;
        const item = game.floors[game.level].shopItems[index];
        if (!item) return;

        if (game.player.gold >= item.cost) {
            game.player.gold -= item.cost;
            soundManager.play('buy');

            if (item.stat) {
                if (item.stat.includes('hp+')) {
                    const val = parseInt(item.stat.split('+')[1]);
                    if (item.type === 'potion') {
                        game.player.hp = Math.min(game.player.hp + val, game.player.maxHp);
                    } else {
                        game.player.maxHp += val;
                        game.player.hp += val;
                    }
                }
                if (item.stat.includes('dmg+')) {
                    const val = parseInt(item.stat.split('+')[1]);
                    game.player.dmgMod += val;
                }
            } else {
                if (item.type === 'potion') game.player.hp = Math.min(game.player.hp + 10, game.player.maxHp);
                if (item.type === 'weapon') game.player.dmgMod += 1;
            }

            game.addLog(`Bought ${item.name}!`);
            game.updateStats();
        } else {
            soundManager.play('locked');
            game.addLog("Not enough gold!");
        }
    }

    closeShop() {
        const game = this.game;
        game.inShop = false;
        game.broadcastPresence(); // Sync inShop status
        document.getElementById('shop-ui').style.display = 'none';
    }
}