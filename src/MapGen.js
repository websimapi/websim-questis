// Simple dungeon generator
export class MapGen {
    constructor(width, height, seed) {
        this.width = width;
        this.height = height;
        this.seed = seed || Math.random();
        this.rng = this.sfc32(this.seed, this.seed + 1, this.seed + 2, this.seed + 3);
    }

    // Simple seeded RNG
    sfc32(a, b, c, d) {
        return function() {
            a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
            var t = (a + b) | 0;
            a = b ^ b >>> 9;
            b = c + (c << 3) | 0;
            c = (c << 21 | c >>> 11);
            d = d + 1 | 0;
            t = (t + d) | 0;
            c = (c + t) | 0;
            return (t >>> 0) / 4294967296;
        }
    }

    rand() {
        return this.rng();
    }

    generate() {
        const map = [];
        // Fill with walls
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(1); // 1 = wall, 0 = floor
            }
            map.push(row);
        }

        // Drunkard's Walk algorithm for simple connected caves/rooms
        let x = Math.floor(this.width / 2);
        let y = Math.floor(this.height / 2);
        let floorCount = 0;
        const targetFloors = this.width * this.height * 0.4; // 40% open space

        while (floorCount < targetFloors) {
            if (map[y][x] === 1) {
                map[y][x] = 0;
                floorCount++;
            }

            // Move randomly
            const dir = Math.floor(this.rand() * 4);
            switch (dir) {
                case 0: y--; break; // Up
                case 1: y++; break; // Down
                case 2: x--; break; // Left
                case 3: x++; break; // Right
            }

            // Clamp
            if (x < 1) x = 1;
            if (x >= this.width - 1) x = this.width - 2;
            if (y < 1) y = 1;
            if (y >= this.height - 1) y = this.height - 2;
        }

        return map;
    }

    findFreeSpot(map) {
        let attempts = 0;
        while (attempts < 1000) {
            const x = Math.floor(this.rand() * this.width);
            const y = Math.floor(this.rand() * this.height);
            if (map[y][x] === 0) {
                return { x, y };
            }
            attempts++;
        }
        // Fallback scan
        for(let y=1; y<this.height-1; y++) {
            for(let x=1; x<this.width-1; x++) {
                if (map[y][x] === 0) return { x, y };
            }
        }
        return { x: 1, y: 1 };
    }

    // A simple BFS to check connectivity and distance
    getPath(map, start, end) {
        const queue = [{ x: start.x, y: start.y, dist: 0 }];
        const visited = new Set();
        visited.add(`${start.x},${start.y}`);

        while (queue.length > 0) {
            const current = queue.shift();
            if (current.x === end.x && current.y === end.y) {
                return current.dist;
            }

            const dirs = [
                { x: 0, y: -1 }, { x: 0, y: 1 },
                { x: -1, y: 0 }, { x: 1, y: 0 }
            ];

            for (const dir of dirs) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                const key = `${nx},${ny}`;

                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height &&
                    map[ny][nx] === 0 && !visited.has(key)) {
                    visited.add(key);
                    queue.push({ x: nx, y: ny, dist: current.dist + 1 });
                }
            }
        }
        return -1; // No path
    }
}