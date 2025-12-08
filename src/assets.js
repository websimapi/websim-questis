export const assets = {
    images: {
        player: new Image(), // Warrior
        mage: new Image(),
        archer: new Image(),
        enemy: new Image(), // Slime
        skeleton: new Image(),
        boss: new Image(),
        wall: new Image(),
        floor: new Image(),
        stairs: new Image(),
        stairs_up: new Image(),
        boss_door: new Image(),
        chest: new Image(),
        key: new Image(),
        slash: new Image(),
        magic_hit: new Image(),
        arrow_hit: new Image(),
        shopkeeper: new Image(),
        bone: new Image(),
        slime_goo: new Image(),
        demon_horn: new Image(),
        altar: new Image(),
        loot_bag: new Image(),
        rare_item: new Image()
    },
    sounds: {
        step: "step.mp3",
        attack: "attack.mp3",
        hit: "hit.mp3",
        pickup: "pickup.mp3",
        win: "win.mp3",
        locked: "locked.mp3",
        unlock: "unlock.mp3",
        buy: "buy.mp3"
    }
};

export const loadAssets = async () => {
    const imagePromises = Object.entries(assets.images).map(([key, img]) => {
        return new Promise((resolve) => {
            img.src = `${key}.png`;
            img.onload = () => resolve();
            img.onerror = () => {
                console.warn(`Failed to load image: ${key}.png`);
                resolve(); 
            }
        });
    });

    await Promise.all(imagePromises);
};

