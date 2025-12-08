import { Game } from './Game.js';

export class Persistence {
    constructor() {
        this.room = new WebsimSocket();
        this.myRecord = null;
        this.collection = 'dungeon_heroes_v2'; // Bumped version
        this.currentUser = null;
        this.ready = false;
    }

    async init() {
        await this.room.initialize();
        this.currentUser = await window.websim.getCurrentUser();
        
        // Subscribe to find my record
        return new Promise((resolve) => {
            const unsub = this.room.collection(this.collection).filter({ username: this.currentUser.username }).subscribe((recs) => {
                if (recs.length > 0) {
                    this.myRecord = recs[0];
                    this.ready = true;
                    unsub();
                    resolve();
                } else {
                    // Try to create
                    this.room.collection(this.collection).create({
                        created_at: new Date().toISOString()
                    }).then(rec => {
                        this.myRecord = rec;
                        this.ready = true;
                        unsub();
                        resolve();
                    });
                }
            });
        });
    }

    getSlots() {
        if (!this.myRecord) return [];
        const slots = [];
        for (let i = 0; i < 10; i++) {
            slots.push(this.myRecord[`char_${i}`] || null);
        }
        return slots;
    }

    async saveCharacter(slotIndex, charData) {
        if (!this.myRecord) return;
        const update = {};
        update[`char_${slotIndex}`] = charData;
        await this.room.collection(this.collection).update(this.myRecord.id, update);
        this.myRecord[`char_${slotIndex}`] = charData;
    }

    updatePresence(player, floor, seed) {
        if (!this.room) return;
        this.room.updatePresence({
            x: player.x,
            y: player.y,
            floor: floor,
            seed: seed, // The root seed for this character
            level: player.level,
            classType: player.classType,
            lastUpdate: Date.now()
        });
    }
}