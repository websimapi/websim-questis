import { soundManager } from './SoundManager.js';

export class AltarSystem {
    constructor(game) {
        this.game = game;
        this.loading = false;
    }

    async interact(altar) {
        const game = this.game;
        if (this.loading) return;

        // Check for bones/remains
        const bones = (game.player.inventory['bone'] || 0) + 
                      (game.player.inventory['slime_goo'] || 0) + 
                      (game.player.inventory['demon_horn'] || 0);

        if (bones === 0) {
            game.addLog("The altar is silent. It craves remains.");
            return;
        }

        // Prompt user? For simplicity in this UI, we automatically offer ALL bones to max the buff.
        // Or maybe just 5? Let's just offer all for a big buff.

        game.addLog("Praying to the altar...");
        this.loading = true;
        game.showingAltarDialog = true; // Block movement
        soundManager.play('unlock'); // Chime

        try {
            // Construct payload
            const offering = [];
            if (game.player.inventory['bone']) offering.push({ type: 'bone', count: game.player.inventory['bone'] });
            if (game.player.inventory['slime_goo']) offering.push({ type: 'slime_goo', count: game.player.inventory['slime_goo'] });
            if (game.player.inventory['demon_horn']) offering.push({ type: 'demon_horn', count: game.player.inventory['demon_horn'] });

            const isEvil = altar.subtype === 'shadow';
            let result;

            try {
                const messages = [
                    {
                        role: "system",
                        content: `You are a dungeon master AI. A player is offering monster remains at a ${altar.subtype} altar.
                        Generate a temporary buff (or curse+reward if shadow altar).
                        
                        Input: ${JSON.stringify(offering)}
                        Altar Type: ${altar.subtype} (Effects: Vitality=HP, Fortune=Gold, Might=Dmg, Wisdom=XP, Shadow=RareItem+Curse, Protection=Def, Luck=Crit)

                        If Shadow Altar: GIVE A POWERFUL PERMANENT ITEM (name, type=weapon/armor) BUT INFLICT A CURSE (Half Max HP).
                        If Normal Altar: Give a buff based on amount of bones. More bones = stronger/longer.
                        
                        Response Format JSON:
                        {
                            "buffName": "string",
                            "stat": "dmg" | "maxHp" | "maxHpMult" | "goldMult" | "xpMult", 
                            "val": number (e.g. 2, 0.5), 
                            "durationFloors": number,
                            "description": "string",
                            "isCurse": boolean,
                            "rewardItem": { "name": "string", "type": "weapon", "stat": "dmg+5" } (Only for Shadow)
                        }`
                    }
                ];

                const completion = await window.websim.chat.completions.create({
                    messages,
                    json: true
                });

                result = JSON.parse(completion.content);
            } catch (aiErr) {
                console.warn("AI Generation Failed, using fallback", aiErr);
                result = this.generateFallback(altar, offering);
            }
            
            this.applyResult(result, isEvil);

            // Remove items
            game.player.inventory['bone'] = 0;
            game.player.inventory['slime_goo'] = 0;
            game.player.inventory['demon_horn'] = 0;

        } catch (e) {
            console.error(e);
            game.addLog("The gods are silent (Error).");
        } finally {
            this.loading = false;
            game.showingAltarDialog = false;
            game.updateStats();
        }
    }

    generateFallback(altar, offering) {
        let value = 0;
        offering.forEach(o => {
            if (o.type === 'bone') value += o.count * 1;
            if (o.type === 'slime_goo') value += o.count * 2;
            if (o.type === 'demon_horn') value += o.count * 5;
        });

        const type = altar.subtype;
        let result = {
            buffName: "Blessing",
            stat: "maxHp",
            val: 5,
            durationFloors: 5,
            description: "The gods smile upon you.",
            isCurse: false
        };

        if (type === 'vitality') { result.stat = 'maxHp'; result.val = Math.max(5, value * 2); result.buffName = "Vitality"; }
        else if (type === 'might') { result.stat = 'dmg'; result.val = Math.max(1, Math.floor(value / 5)); result.buffName = "Might"; }
        else if (type === 'wisdom') { result.stat = 'xpMult'; result.val = 1.5; result.buffName = "Wisdom"; }
        else if (type === 'fortune') { result.stat = 'goldMult'; result.val = 1.5; result.buffName = "Fortune"; }
        else if (type === 'shadow') {
            result.isCurse = true;
            result.stat = 'maxHpMult';
            result.val = 0.5;
            result.durationFloors = 999;
            result.buffName = "Shadow Pact";
            result.description = "Power at a price.";
            result.rewardItem = { name: "Shadow Blade", type: "weapon", stat: "dmg+5" };
        }
        
        if (!result.isCurse) {
            result.durationFloors = 3 + Math.floor(value / 3);
        }

        return result;
    }

    applyResult(result, isEvil) {
        const game = this.game;

        if (result.rewardItem) {
             // Add item logic? For now we treat it as a permanent stat boost or specific item in inv
             game.addLog(`RECEIVED: ${result.rewardItem.name}!`);
             // Auto equip/use
             if (result.rewardItem.stat) {
                 if (result.rewardItem.stat.includes('dmg+')) game.player.dmgMod += parseInt(result.rewardItem.stat.split('+')[1]);
                 if (result.rewardItem.stat.includes('hp+')) game.player.maxHp += parseInt(result.rewardItem.stat.split('+')[1]);
             }
        }

        // Add Buff
        const buff = {
            name: result.buffName,
            stat: result.stat,
            val: result.val,
            duration: result.durationFloors,
            isCurse: result.isCurse || false,
            description: result.description
        };

        game.player.buffs.push(buff);
        
        if (result.isCurse) {
             soundManager.play('locked'); // Negative sound
             game.addLog(`CURSED: ${result.buffName}`);
        } else {
             soundManager.play('unlock');
             game.addLog(`BLESSED: ${result.buffName}`);
        }
        
        game.save();
    }
}