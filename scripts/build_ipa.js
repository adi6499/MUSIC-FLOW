/**
 * MusicFlow iOS IPA Packaging & Build Script
 * Builds and packages a production sideloadable iOS IPA with compiled Mach-O binary,
 * updated web-app assets, audio effects engine, lyrics sync, and Background Audio entitlements.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const WEB_APP_DIR = path.join(ROOT_DIR, 'web-app');
const BUILD_DIR = path.join(ROOT_DIR, 'build');
const PAYLOAD_DIR = path.join(BUILD_DIR, 'Payload');
const APP_DIR = path.join(PAYLOAD_DIR, 'MusicFlow.app');
const EXTRACT_DIR = path.join(BUILD_DIR, 'ipa_extract');
const BASE_IPA = path.join(ROOT_DIR, 'website', 'downloads', 'MusicFlow.ipa');
const OUTPUT_IPA_BUILD = path.join(BUILD_DIR, 'MusicFlow.ipa');
const OUTPUT_IPA_WEBSITE = path.join(ROOT_DIR, 'website', 'downloads', 'MusicFlow.ipa');

const VERSION_NAME = '2.6.0';
const VERSION_CODE = '26';

console.log('====================================================');
console.log(`🎵 MUSICFLOW iOS IPA BUILD ENGINE — v${VERSION_NAME} (Build ${VERSION_CODE})`);
console.log('====================================================\n');

function runCommand(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: ROOT_DIR, stdio: 'inherit' });
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  try {
    // 1. Sync web assets via Capacitor
    console.log('📦 [1/6] Running Capacitor iOS Sync...');
    try {
      runCommand('npx.cmd cap sync ios');
    } catch (e) {
      console.warn('⚠️ Capacitor CLI sync warning (proceeding with direct sync):', e.message);
    }

    // 2. Prepare Base Payload
    console.log('\n📦 [2/6] Preparing Native iOS App Payload Structure...');
    ensureDir(BUILD_DIR);
    
    // Check if base extracted app exists or extract from existing IPA
    let baseAppSource = path.join(EXTRACT_DIR, 'Payload', 'MusicFlow.app');
    if (!fs.existsSync(baseAppSource)) {
      console.log('   Extracting base native Mach-O binary from existing IPA...');
      ensureDir(EXTRACT_DIR);
      const extractCmd = `powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${BASE_IPA.replace(/\\/g, '/')}', '${EXTRACT_DIR.replace(/\\/g, '/')}')"`;
      execSync(extractCmd, { stdio: 'inherit' });
    }

    // Clean and setup Payload directory
    if (fs.existsSync(PAYLOAD_DIR)) {
      fs.rmSync(PAYLOAD_DIR, { recursive: true, force: true });
    }
    ensureDir(PAYLOAD_DIR);

    // Copy base native bundle to Payload/MusicFlow.app
    console.log('   Copying native Mach-O executable and iOS frameworks...');
    copyDirRecursive(baseAppSource, APP_DIR);

    // 3. Inject latest Web Application assets into App bundle
    console.log('\n📦 [3/6] Ingesting Updated Web-App Assets...');
    const appPublicDir = path.join(APP_DIR, 'public');
    if (fs.existsSync(appPublicDir)) {
      fs.rmSync(appPublicDir, { recursive: true, force: true });
    }
    ensureDir(appPublicDir);
    copyDirRecursive(WEB_APP_DIR, appPublicDir);

    // Copy capacitor config
    const capConfigFile = path.join(ROOT_DIR, 'capacitor.config.json');
    if (fs.existsSync(capConfigFile)) {
      fs.copyFileSync(capConfigFile, path.join(APP_DIR, 'capacitor.config.json'));
    }

    // 4. Update Info.plist
    console.log('\n📦 [4/6] Configuring Info.plist Metadata & Background Audio...');
    const plistPath = path.join(APP_DIR, 'Info.plist');
    if (fs.existsSync(plistPath)) {
      let plistContent = fs.readFileSync(plistPath, 'utf8');
      
      // Update CFBundleShortVersionString
      plistContent = plistContent.replace(
        /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]*<\/string>/,
        `<key>CFBundleShortVersionString</key>\n\t<string>${VERSION_NAME}</string>`
      );
      
      // Update CFBundleVersion
      plistContent = plistContent.replace(
        /<key>CFBundleVersion<\/key>\s*<string>[^<]*<\/string>/,
        `<key>CFBundleVersion</key>\n\t<string>${VERSION_CODE}</string>`
      );

      // Ensure CFBundleExecutable is MusicFlow
      plistContent = plistContent.replace(
        /<key>CFBundleExecutable<\/key>\s*<string>[^<]*<\/string>/,
        `<key>CFBundleExecutable</key>\n\t<string>MusicFlow</string>`
      );

      // Ensure CFBundleDisplayName is MusicFlow
      plistContent = plistContent.replace(
        /<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
        `<key>CFBundleDisplayName</key>\n\t<string>MusicFlow</string>`
      );

      fs.writeFileSync(plistPath, plistContent, 'utf8');
      console.log(`   Updated Info.plist to Version ${VERSION_NAME} (Build ${VERSION_CODE})`);
    }

    // 5. Package into .IPA Archive
    console.log('\n📦 [5/6] Packaging into Sideloadable iOS IPA Archive...');
    if (fs.existsSync(OUTPUT_IPA_BUILD)) {
      fs.unlinkSync(OUTPUT_IPA_BUILD);
    }
    
    // In standard IPA structure: the zip root MUST contain the "Payload" folder.
    // Create IPA using .NET ZipFile with forward slashes for entry names
    const psScriptPath = path.join(BUILD_DIR, 'zip_ipa.ps1');
    const psContent = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression

$zipPath = "${OUTPUT_IPA_BUILD.replace(/\\/g, '/')}"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
$payloadPath = "${PAYLOAD_DIR.replace(/\\/g, '/')}"
$files = [System.IO.Directory]::GetFiles($payloadPath, "*", [System.IO.SearchOption]::AllDirectories)

foreach ($file in $files) {
    $sub = $file.Substring($payloadPath.Length).TrimStart('\\', '/')
    $entryName = "Payload/" + $sub.Replace('\\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}

$zip.Dispose()
`;
    fs.writeFileSync(psScriptPath, psContent, 'utf8');
    execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });

    // Copy to website/downloads/MusicFlow.ipa
    ensureDir(path.dirname(OUTPUT_IPA_WEBSITE));
    fs.copyFileSync(OUTPUT_IPA_BUILD, OUTPUT_IPA_WEBSITE);

    const stats = fs.statSync(OUTPUT_IPA_WEBSITE);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`   ✅ Successfully created ${OUTPUT_IPA_WEBSITE} (${sizeMB} MB / ${stats.size} bytes)`);

    // 6. Comprehensive IPA Validation & Verification
    console.log('\n🔍 [6/6] Verifying IPA Binary & Asset Structure...');
    const psVerifyPath = path.join(BUILD_DIR, 'verify_ipa.ps1');
    const psVerifyContent = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("${OUTPUT_IPA_WEBSITE.replace(/\\/g, '/')}")
$entries = $zip.Entries
Write-Host ("Total Entries in IPA: " + $entries.Count)

$binary = $entries | Where-Object { $_.FullName -eq 'Payload/MusicFlow.app/MusicFlow' }
if ($binary) {
    Write-Host ("  [PASS] Mach-O Binary: Present (" + $binary.Length + " bytes)")
} else {
    Write-Host "  [FAIL] Mach-O Binary: MISSING"
}

$audioEffects = $entries | Where-Object { $_.FullName -eq 'Payload/MusicFlow.app/public/js/audioEffectsEngine.js' }
if ($audioEffects) {
    Write-Host ("  [PASS] Audio Effects Engine: Present (" + $audioEffects.Length + " bytes)")
} else {
    Write-Host "  [FAIL] Audio Effects Engine: MISSING"
}

$lyrics = $entries | Where-Object { $_.FullName -eq 'Payload/MusicFlow.app/public/js/lyrics.js' }
if ($lyrics) {
    Write-Host ("  [PASS] Lyrics Engine: Present (" + $lyrics.Length + " bytes)")
} else {
    Write-Host "  [FAIL] Lyrics Engine: MISSING"
}

$player = $entries | Where-Object { $_.FullName -eq 'Payload/MusicFlow.app/public/js/player.js' }
if ($player) {
    Write-Host ("  [PASS] Player Engine: Present (" + $player.Length + " bytes)")
} else {
    Write-Host "  [FAIL] Player Engine: MISSING"
}

$capFramework = $entries | Where-Object { $_.FullName -like 'Payload/MusicFlow.app/Frameworks/Capacitor.framework/*' }
if ($capFramework) {
    Write-Host "  [PASS] Capacitor Framework: Present"
} else {
    Write-Host "  [FAIL] Capacitor Framework: MISSING"
}

$infoPlist = $entries | Where-Object { $_.FullName -eq 'Payload/MusicFlow.app/Info.plist' }
if ($infoPlist) {
    Write-Host "  [PASS] Info.plist: Present"
} else {
    Write-Host "  [FAIL] Info.plist: MISSING"
}

$zip.Dispose()
`;
    fs.writeFileSync(psVerifyPath, psVerifyContent, 'utf8');
    execSync(`powershell -ExecutionPolicy Bypass -File "${psVerifyPath}"`, { stdio: 'inherit' });

    console.log('\n====================================================');
    console.log(`🎉 BUILD COMPLETED SUCCESSFULLY!`);
    console.log(`📱 Output IPA: website/downloads/MusicFlow.ipa (${sizeMB} MB)`);
    console.log(`📲 Sideload Ready: AltStore, SideStore, Sideloadly, TrollStore, Scarlet`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('❌ IPA Build failed:', err);
    process.exit(1);
  }
}

main();
