import { MapGen } from './MapGen.js';
import { soundManager } from './SoundManager.js';

export class LevelManager {
    constructor(game) {
        this.game = game;
    }

    enterLevel(levelNum, entryMethod = 'down') {
        const game = this.game;

        // Save current floor state if exists
        if (game.floors[game.level]) {
            game.floors[game.level].enemies = game.enemies;
            game.floors[game.level].objects = game.objects;
            // Mark shopkeeper as gone if we are leaving this floor
            if (game.floors[game.level].hasShopkeeper) {
                game.objects = game.objects.filter(o => o.type !== 'shopkeeper');
                game.floors[game.level].objects = game.objects;
                game.floors[game.level].hasShopkeeper = false;
            }
        }

        game.level = levelNum;

        if (!game.floors[levelNum]) {
            this.generateNewLevel(levelNum);
        } else {
            const floor = game.floors[levelNum];
            game.map = floor.map;
            game.enemies = floor.enemies;
            game.objects = floor.objects;
            game.mapWidth = floor.width;
            game.mapHeight = floor.height;
        }

        // Position Player
        if (entryMethod === 'down') {
            const start = game.objects.find(o => o.type === 'stairs_up');
            if (start) {
                game.player.x = start.x;
                game.player.y = start.y;
            } else {
                if (game.floors[levelNum].startPos) {
                    game.player.x = game.floors[levelNum].startPos.x;
                    game.player.y = game.floors[levelNum].startPos.y;
                }
            }
        } else if (entryMethod === 'up') {
            const exit = game.objects.find(o => o.type === 'stairs');
            if (exit) {
                game.player.x = exit.x;
                game.player.y = exit.y;
            }
        }

        game.addLog(`Floor ${game.level}`);
        game.updateStats();
    }

    generateNewLevel(levelNum) {
        const game = this.game;

        const isShop = levelNum > 1 && (levelNum % 4 === 0 || Math.random() < 0.1);
        const isBossKeyFloor = Math.random() < 0.3;
        const isBossGateFloor = levelNum % 5 === 0;

        let width = 25, height = 25;
        let newMap, startPos, objects = [], enemies = [];

        if (isShop) {
            width = 12; height = 12;
            newMap = [];
            for (let y = 0; y < height; y++) {
                const row = [];
                for (let x = 0; x < width; x++) {
                    if (y === 0 || y === height - 1 || x === 0 || x === width - 1) row.push(1);
                    else row.push(0);
                }
                newMap.push(row);
            }
            startPos = { x: 2, y: 6 };
            objects.push({ type: 'stairs', x: 10, y: 6 });
            objects.push({ type: 'stairs_up', x: 2, y: 6 });
            objects.push({ type: 'shopkeeper', x: 6, y: 5 });
        } else {
            const gen = new MapGen(width, height);
            let attempts = 0;
            while (attempts < 10) {
                newMap = gen.generate();
                startPos = gen.findFreeSpot(newMap);
                const stairsPos = gen.findFreeSpot(newMap);

                const dist = gen.getPath(newMap, startPos, stairsPos);
                if (dist > 5) {
                    objects.push({ type: 'stairs', x: stairsPos.x, y: stairsPos.y });
                    objects.push({ type: 'stairs_up', x: startPos.x, y: startPos.y });

                    if (isBossKeyFloor && !game.player.hasKey) {
                        const keyPos = gen.findFreeSpot(newMap);
                        objects.push({ type: 'key', x: keyPos.x, y: keyPos.y });
                    }

                    if (isBossGateFloor) {
                        const bossDoorPos = gen.findFreeSpot(newMap);
                        if (gen.getPath(newMap, startPos, bossDoorPos) !== -1) {
                            objects.push({ type: 'boss_door', x: bossDoorPos.x, y: bossDoorPos.y });
                        }
                    }

                    break;
                }
                attempts++;
            }

            const enemyCount = 4 + Math.floor(levelNum * 0.8);
            const gen2 = new MapGen(width, height);

            for (let i = 0; i < enemyCount; i++) {
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

            if (Math.random() > 0.5) {
                const pos = gen2.findFreeSpot(newMap);
                objects.push({ type: 'chest', x: pos.x, y: pos.y, opened: false });
            }
        }

        game.floors[levelNum] = {
            map: newMap,
            enemies: enemies,
            objects: objects,
            width: width,
            height: height,
            startPos: startPos,
            hasShopkeeper: isShop
        };

        game.map = newMap;
        game.enemies = enemies;
        game.objects = objects;
        game.mapWidth = width;
        game.mapHeight = height;
    }

    enterBossRoom() {
        const game = this.game;

        game.player.hasKey = false;
        soundManager.play('win');

        game.level = 999;

        game.mapWidth = 15;
        game.mapHeight = 15;
        game.map = [];
        for (let y = 0; y < game.mapHeight; y++) {
            const row = [];
            for (let x = 0; x < game.mapWidth; x++) {
                if (y === 0 || y === game.mapHeight - 1 || x === 0 || x === game.mapWidth - 1) row.push(1);
                else row.push(0);
            }
            game.map.push(row);
        }

        game.player.x = 7;
        game.player.y = 12;

        game.enemies = [{
            x: 7, y: 3,
            hp: 50 + (game.level * 2),
            maxHp: 50 + (game.level * 2),
            dmg: 4 + Math.floor(game.level * 0.5),
            type: 'boss'
        }];

        game.objects = [];

        game.addLog("BOSS FIGHT!");
        game.updateStats();
    }
}