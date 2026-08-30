/**
 * MusicFlow iOS App Icon Generator
 * Generates all required Apple iOS / iPadOS icon resolutions from high-res source icon.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SOURCE_ICON = path.join(ROOT_DIR, 'web-app', 'assets', 'icon-512.png');
const APPICONSET_DIR = path.join(ROOT_DIR, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');

const ICON_SPECS = [
  // iPhone
  { name: 'AppIcon-20@2x.png', size: 40 },
  { name: 'AppIcon-20@3x.png', size: 60 },
  { name: 'AppIcon-29@2x.png', size: 58 },
  { name: 'AppIcon-29@3x.png', size: 87 },
  { name: 'AppIcon-40@2x.png', size: 80 },
  { name: 'AppIcon-40@3x.png', size: 120 },
  { name: 'AppIcon-60@2x.png', size: 120 },
  { name: 'AppIcon-60@3x.png', size: 180 },
  // iPad
  { name: 'AppIcon-20@1x.png', size: 20 },
  { name: 'AppIcon-29@1x.png', size: 29 },
  { name: 'AppIcon-40@1x.png', size: 40 },
  { name: 'AppIcon-76@1x.png', size: 76 },
  { name: 'AppIcon-76@2x.png', size: 152 },
  { name: 'AppIcon-83.5@2x.png', size: 167 },
  // App Store 1024x1024
  { name: 'AppIcon-512@2x.png', size: 1024 },
  // Legacy / Direct Bundle filenames
  { name: 'AppIcon60x60@2x.png', size: 120 },
  { name: 'AppIcon60x60@3x.png', size: 180 },
  { name: 'AppIcon76x76@2x~ipad.png', size: 152 },
  { name: 'AppIcon83.5x83.5@2x~ipad.png', size: 167 },
  { name: 'AppIcon.png', size: 120 }
];

console.log('====================================================');
console.log('🎨 GENERATING HIGH-RESOLUTION iOS APP ICONS');
console.log('====================================================\n');

if (!fs.existsSync(SOURCE_ICON)) {
  console.error('❌ Source icon not found:', SOURCE_ICON);
  process.exit(1);
}

if (!fs.existsSync(APPICONSET_DIR)) {
  fs.mkdirSync(APPICONSET_DIR, { recursive: true });
}

// Generate using PowerShell System.Drawing
const psScript = `
Add-Type -AssemblyName System.Drawing

$srcPath = "${SOURCE_ICON.replace(/\\/g, '/')}"
$srcImg = [System.Drawing.Image]::FromFile($srcPath)

$destDir = "${APPICONSET_DIR.replace(/\\/g, '/')}"

$icons = @(
${ICON_SPECS.map(s => `  @{ Name = "${s.name}"; Size = ${s.size} }`).join(",\n")}
)

foreach ($icon in $icons) {
    $size = $icon.Size
    $destPath = Join-Path $destDir $icon.Name
    $destBmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($destBmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($srcImg, 0, 0, $size, $size)
    $destBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $destBmp.Dispose()
    Write-Host ("  [OK] Generated " + $icon.Name + " (" + $size + "x" + $size + ")")
}

$srcImg.Dispose()
`;

const tempPs = path.join(ROOT_DIR, 'build', 'gen_icons.ps1');
if (!fs.existsSync(path.dirname(tempPs))) fs.mkdirSync(path.dirname(tempPs), { recursive: true });
fs.writeFileSync(tempPs, psScript, 'utf8');

try {
  execSync(`powershell -ExecutionPolicy Bypass -File "${tempPs}"`, { stdio: 'inherit' });
  console.log('\n✅ All iOS icon resolutions generated successfully in AppIcon.appiconset!\n');
} catch (e) {
  console.error('❌ Failed to generate icons:', e.message);
  process.exit(1);
}
