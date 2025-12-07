// Simple dungeon generator
export class MapGen {
    constructor(width, height) {
        this.width = width;
        this.height = height;
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
            const dir = Math.floor(Math.random() * 4);
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
        while (true) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            if (map[y][x] === 0) {
                return { x, y };
            }
        }
    }
}