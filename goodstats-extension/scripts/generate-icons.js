﻿const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];
const iconDir = path.join(__dirname, '../icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Generate PNGs for each size
sizes.forEach(size => {
  sharp(path.join(iconDir, 'icon.svg'))
    .resize(size, size)
    .png()
    .toFile(path.join(iconDir, `icon${size}.png`))
    .then(() => console.log(`Generated ${size}x${size} icon`))
    .catch(err => console.error(`Error generating ${size}x${size} icon:`, err));
});
