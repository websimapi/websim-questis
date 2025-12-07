import nipplejs from 'nipplejs';

export class Input {
    constructor() {
        this.keys = {};
        this.joystickData = null;
        this.lastMoveTime = 0;
        this.moveDelay = 150; // ms between moves when holding
        this.actions = {
            up: false,
            down: false,
            left: false,
            right: false,
            interact: false
        };
        this.activeDir = null;

        this.setupKeyboard();
        this.setupJoystick();
        this.setupButtons();
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            this.updateDirectionFromKeys();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            this.updateDirectionFromKeys();
        });
    }

    updateDirectionFromKeys() {
        if (this.keys['ArrowUp'] || this.keys['w']) this.activeDir = 'up';
        else if (this.keys['ArrowDown'] || this.keys['s']) this.activeDir = 'down';
        else if (this.keys['ArrowLeft'] || this.keys['a']) this.activeDir = 'left';
        else if (this.keys['ArrowRight'] || this.keys['d']) this.activeDir = 'right';
        else if (!this.joystickData) this.activeDir = null;
    }

    setupJoystick() {
        const zone = document.getElementById('mobile-controls-zone');
        this.manager = nipplejs.create({
            zone: zone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white',
            size: 100
        });

        this.manager.on('move', (evt, data) => {
            if (data.direction) {
                this.joystickData = data.direction.angle; // up, down, left, right
                this.activeDir = data.direction.angle;
            }
        });

        this.manager.on('end', () => {
            this.joystickData = null;
            this.updateDirectionFromKeys(); // Fallback to keys if any
        });
    }

    setupButtons() {
        const btn = document.getElementById('interact-btn');
        // Handle touch and click
        const trigger = (e) => {
            e.preventDefault();
            this.actions.interact = true;
            setTimeout(() => this.actions.interact = false, 100);
        };
        btn.addEventListener('touchstart', trigger, {passive: false});
        btn.addEventListener('mousedown', trigger);
    }

    getDirection() {
        const now = Date.now();
        if (this.activeDir && now - this.lastMoveTime > this.moveDelay) {
            this.lastMoveTime = now;
            return this.activeDir;
        }
        return null;
    }

    getAction() {
        if (this.actions.interact) {
            this.actions.interact = false;
            return true;
        }
        // Keyboard space/enter
        if (this.keys[' '] || this.keys['Enter']) {
            // Debounce manually in game loop or here? Let's just return true and let game handle cooldown
            // Better to consume the key press
            this.keys[' '] = false;
            this.keys['Enter'] = false;
            return true;
        }
        return false;
    }
}