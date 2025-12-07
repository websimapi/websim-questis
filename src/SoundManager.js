import { assets } from './assets.js';

class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = {};
        this.enabled = true;
    }

    async init() {
        // Load sound buffers
        const promises = Object.entries(assets.sounds).map(async ([key, url]) => {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers[key] = audioBuffer;
            } catch (e) {
                console.warn(`Failed to load sound: ${url}`, e);
            }
        });
        await Promise.all(promises);
    }

    play(name) {
        if (!this.enabled || !this.buffers[name]) return;

        // Resume context if suspended (browser policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.buffers[name];
        source.connect(this.ctx.destination);
        source.start(0);
    }
}

export const soundManager = new SoundManager();

