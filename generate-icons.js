// Simple icon generator for Chrome extension
const fs = require('fs');

// SVG icon template
const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" fill="url(#gradient)" rx="16"/>
  <text x="64" y="64" font-family="Arial, sans-serif" font-size="64" text-anchor="middle" dominant-baseline="middle" fill="white">🚀</text>
</svg>`;

// Save SVG file
fs.writeFileSync('icon.svg', svgIcon);
console.log('SVG icon created! You can use online converters to create PNG versions.');

// Create a simple HTML file to generate PNG icons
const htmlGenerator = `<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial; padding: 20px; }
  .icon-container { display: inline-block; margin: 10px; text-align: center; }
  canvas { border: 1px solid #ccc; display: block; margin: 10px 0; }
</style>
</head>
<body>
<h1>Social Poster Icon Generator</h1>
<p>Click each button to download the corresponding icon:</p>

<div class="icon-container">
  <canvas id="canvas16" width="16" height="16"></canvas>
  <button onclick="downloadIcon(16)">Download icon16.png</button>
</div>

<div class="icon-container">
  <canvas id="canvas48" width="48" height="48"></canvas>
  <button onclick="downloadIcon(48)">Download icon48.png</button>
</div>

<div class="icon-container">
  <canvas id="canvas128" width="128" height="128"></canvas>
  <button onclick="downloadIcon(128)">Download icon128.png</button>
</div>

<script>
function drawIcon(size) {
  const canvas = document.getElementById('canvas' + size);
  const ctx = canvas.getContext('2d');
  
  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#667eea');
  gradient.addColorStop(1, '#764ba2');
  
  // Draw rounded rectangle
  const radius = size * 0.125;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Draw "SP" text
  ctx.fillStyle = 'white';
  ctx.font = 'bold ' + (size * 0.4) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SP', size / 2, size / 2);
}

function downloadIcon(size) {
  const canvas = document.getElementById('canvas' + size);
  const link = document.createElement('a');
  link.download = 'icon' + size + '.png';
  link.href = canvas.toDataURL();
  link.click();
}

// Draw all icons on load
drawIcon(16);
drawIcon(48);
drawIcon(128);
</script>
</body>
</html>`;

fs.writeFileSync('icon-generator.html', htmlGenerator);
console.log('HTML icon generator created! Open icon-generator.html in a browser to generate PNG icons.');