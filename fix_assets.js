const fs = require('fs');
const path = require('path');

async function generateImages() {
    try {
        console.log('Attempting to load jimp-compact...');
        const Jimp = require('jimp-compact');

        async function create(filename, width, height, color) {
            const p = path.join(__dirname, filename);
            console.log(`Generating ${p}...`);
            const image = new Jimp(width, height, color);
            await image.writeAsync(p);
            console.log(`Success: ${filename}`);
        }

        await create('assets/icon.png', 1024, 1024, 0x3498dbff); // Blue
        await create('assets/splash.png', 1242, 2436, 0xffffff00); // White
        await create('assets/adaptive-icon.png', 1024, 1024, 0xe74c3cff); // Red
        await create('assets/favicon.png', 48, 48, 0xf1c40fff); // Yellow

    } catch (error) {
        console.error('Error using jimp-compact:', error);
        console.log('Falling back to base64 write...');

        // Fallback: Write a simple valid PNG (1x1 pixel) to all files if Jimp fails
        // This is just to ensure files are valid images, even if dimensions are wrong.
        const base64PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const buffer = Buffer.from(base64PNG, 'base64');

        ['assets/icon.png', 'assets/splash.png', 'assets/adaptive-icon.png', 'assets/favicon.png'].forEach(file => {
            fs.writeFileSync(path.join(__dirname, file), buffer);
            console.log(`Wrote fallback ${file}`);
        });
    }
}

generateImages();
