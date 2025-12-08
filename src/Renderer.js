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
            if (obj.type === 'chest') img = assets.images.chest;
            if (obj.type === 'key') img = assets.images.key;
            if (obj.type === 'shopkeeper') img = assets.images.shopkeeper;

            if (img) {
                this.ctx.drawImage(img, px, py, effectiveTileSize, effectiveTileSize);
            }
        });

        // Draw Enemies
        game.enemies.forEach(enemy => {
            const px = enemy.x * effectiveTileSize;
            const py = enemy.y * effectiveTileSize;
            this.ctx.drawImage(assets.images.enemy, px, py, effectiveTileSize, effectiveTileSize);

            // HP bar for enemy
            if (enemy.hp < enemy.maxHp) {
                this.ctx.fillStyle = 'red';
                this.ctx.fillRect(px, py - 5, effectiveTileSize, 4);
                this.ctx.fillStyle = 'green';
                this.ctx.fillRect(px, py - 5, effectiveTileSize * (enemy.hp / enemy.maxHp), 4);
            }
        });

        // Draw Player
        const px = game.player.x * effectiveTileSize;
        const py = game.player.y * effectiveTileSize;
        
        let playerImg = assets.images.player; // Default warrior
        if (game.player.classType === 'mage') playerImg = assets.images.mage;
        if (game.player.classType === 'archer') playerImg = assets.images.archer;
        
        this.ctx.drawImage(playerImg, px, py, effectiveTileSize, effectiveTileSize);

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