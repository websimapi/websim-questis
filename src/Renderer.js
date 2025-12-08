import { assets } from './assets.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = 32;
        this.scale = 2;
        this.camera = { x: 0, y: 0 };

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // On mobile, text can be small, so we might want to scale up visuals
        this.scale = Math.min(window.innerWidth, window.innerHeight) / 200; 
        if (this.scale < 2) this.scale = 2;
        if (this.scale > 4) this.scale = 4;

        this.ctx.imageSmoothingEnabled = false;
    }

    draw(game) {
        // Clear
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Center camera on player
        // Player pos is in grid units. 
        // We want player to be in center of screen.

        const effectiveTileSize = this.tileSize * this.scale;

        // Target camera position (smooth follow could go here, but strict locking for now)
        const targetCamX = game.player.x * effectiveTileSize - this.canvas.width / 2 + effectiveTileSize / 2;
        const targetCamY = game.player.y * effectiveTileSize - this.canvas.height / 2 + effectiveTileSize / 2;

        this.camera.x = targetCamX;
        this.camera.y = targetCamY;

        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Calculate visible range to cull drawing (optimization)
        const startCol = Math.floor(this.camera.x / effectiveTileSize);
        const endCol = startCol + (this.canvas.width / effectiveTileSize) + 1;
        const startRow = Math.floor(this.camera.y / effectiveTileSize);
        const endRow = startRow + (this.canvas.height / effectiveTileSize) + 1;

        // Draw Map
        for (let y = startRow; y <= endRow; y++) {
            for (let x = startCol; x <= endCol; x++) {
                if (y >= 0 && y < game.mapHeight && x >= 0 && x < game.mapWidth) {
                    const tile = game.map[y][x];
                    const px = x * effectiveTileSize;
                    const py = y * effectiveTileSize;

                    if (tile === 1) {
                        this.ctx.drawImage(assets.images.wall, px, py, effectiveTileSize, effectiveTileSize);
                    } else {
                        this.ctx.drawImage(assets.images.floor, px, py, effectiveTileSize, effectiveTileSize);
                    }
                }
            }
        }

        // Draw Items/Objects
        game.objects.forEach(obj => {
            const px = obj.x * effectiveTileSize;
            const py = obj.y * effectiveTileSize;
            let img = null;
            if (obj.type === 'stairs') img = assets.images.stairs;
            if (obj.type === 'stairs_up') img = assets.images.stairs_up;
            if (obj.type === 'boss_door') img = assets.images.boss_door;
            if (obj.type === 'chest') img = assets.images.chest;
            if (obj.type === 'key') img = assets.images.key;
            if (obj.type === 'shopkeeper') img = assets.images.shopkeeper;
            if (obj.type === 'altar') img = assets.images.altar;
            if (obj.type === 'loot') {
                if (obj.item === 'bone') img = assets.images.bone;
                else if (obj.item === 'slime_goo') img = assets.images.slime_goo;
                else img = assets.images.loot_bag;
            }

            if (img) {
                // If altar, maybe tint it based on subtype?
                if (obj.type === 'altar' && obj.subtype === 'shadow') {
                    this.ctx.filter = 'hue-rotate(270deg)'; // Purple/Red ish
                }
                
                this.ctx.drawImage(img, px, py, effectiveTileSize, effectiveTileSize);
                
                this.ctx.filter = 'none';

                // Loot count
                if (obj.type === 'loot' && obj.count > 1) {
                    this.ctx.fillStyle = 'white';
                    this.ctx.font = '10px monospace';
                    this.ctx.fillText(obj.count, px + effectiveTileSize - 5, py + effectiveTileSize - 2);
                }
            }
        });

        // Draw Enemies
        game.enemies.forEach(enemy => {
            const px = enemy.x * effectiveTileSize;
            const py = enemy.y * effectiveTileSize;
            let img = assets.images.enemy;
            if (enemy.type === 'skeleton') img = assets.images.skeleton;
            if (enemy.type === 'boss') img = assets.images.boss;
            
            this.ctx.drawImage(img, px, py, effectiveTileSize, effectiveTileSize);

            // HP bar for enemy
            if (enemy.hp < enemy.maxHp) {
                this.ctx.fillStyle = 'red';
                this.ctx.fillRect(px, py - 5, effectiveTileSize, 4);
                this.ctx.fillStyle = 'green';
                this.ctx.fillRect(px, py - 5, effectiveTileSize * (enemy.hp / enemy.maxHp), 4);
            }
        });

        // Draw Other Players
        if (game.persistence && game.persistence.room && game.persistence.room.peers) {
            const peers = game.persistence.room.peers;
            const presence = game.persistence.room.presence;
            
            Object.keys(peers).forEach(clientId => {
                if (clientId === game.persistence.room.clientId) return; // Skip self
                
                const pData = presence[clientId];
                if (!pData) return;
                
                // Check visibility context
                let visible = false;
                if (game.inArena) {
                    if (pData.arenaId === game.arenaSystem.arenaId) visible = true;
                } else {
                    if (!pData.arenaId && pData.floor === game.level && Math.abs(pData.seed - game.dungeonSeed) < 0.0001) visible = true;
                }

                if (visible) {
                     const ppx = pData.x * effectiveTileSize;
                     const ppy = pData.y * effectiveTileSize;
                     
                     let pImg = assets.images.player;
                     if (pData.classType === 'mage') pImg = assets.images.mage;
                     if (pData.classType === 'archer') pImg = assets.images.archer;
                     
                     this.ctx.globalAlpha = 0.7; // Make others slightly ghosty
                     this.ctx.drawImage(pImg, ppx, ppy, effectiveTileSize, effectiveTileSize);
                     this.ctx.globalAlpha = 1.0;
                     
                     // Name tag
                     this.ctx.fillStyle = 'white';
                     this.ctx.font = '10px monospace';
                     this.ctx.textAlign = 'center';
                     const username = peers[clientId].username || 'Player';
                     this.ctx.fillText(username, ppx + effectiveTileSize/2, ppy - 5);
                }
            });
        }

        // Draw Player
        const px = game.player.x * effectiveTileSize;
        const py = game.player.y * effectiveTileSize;
        
        let playerImg = assets.images.player; // Default warrior
        if (game.player.classType === 'mage') playerImg = assets.images.mage;
        if (game.player.classType === 'archer') playerImg = assets.images.archer;
        
        this.ctx.drawImage(playerImg, px, py, effectiveTileSize, effectiveTileSize);
        
        // Player Name
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.font = '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("YOU", px + effectiveTileSize/2, py - 5);

        // Draw Effects
        const now = Date.now();
        game.effects = game.effects.filter(ef => now - ef.startTime < ef.duration);
        game.effects.forEach(ef => {
            const epx = ef.x * effectiveTileSize;
            const epy = ef.y * effectiveTileSize;
            
            // Simple fade out or just draw
            this.ctx.globalAlpha = 1 - ((now - ef.startTime) / ef.duration);
            
            let efImg = assets.images.slash;
            if (ef.type === 'magic') efImg = assets.images.magic_hit;
            if (ef.type === 'arrow') efImg = assets.images.arrow_hit;
            
            this.ctx.drawImage(efImg, epx, epy, effectiveTileSize, effectiveTileSize);
            this.ctx.globalAlpha = 1.0;
        });

        this.ctx.restore();
    }
}