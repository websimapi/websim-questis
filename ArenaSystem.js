        if (totalGold > 0) {
            const gain = Math.floor(totalGold * 0.5);
            this.game.player.gold += gain;
            this.game.addLog(`Won ${gain} Gold!`);
        }

