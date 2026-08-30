const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const webAppDir = path.join(__dirname, '..', 'web-app');
const files = fs.readdirSync(webAppDir).filter(f => f.startsWith('test_') && f.endsWith('.js'));

console.log('=============================================================');
console.log(`  MUSICFLOW COMPLETE REGRESSION SUITE (${files.length} Test Suites)`);
console.log('=============================================================\n');

let failedSuites = 0;
let passedSuites = 0;

for (const file of files) {
  const filePath = path.join(webAppDir, file);
  process.stdout.write(`• Executing ${file}... `);
  try {
    const output = execSync(`node "${filePath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    passedSuites++;
    console.log('\x1b[32mPASSED\x1b[0m');
  } catch (err) {
    failedSuites++;
    console.log('\x1b[31mFAILED\x1b[0m');
    console.error(err.stdout || err.message);
  }
}

console.log('\n=============================================================');
console.log(`  SUMMARY: ${passedSuites} / ${files.length} Suites PASSED (${failedSuites} Failed)`);
console.log('=============================================================\n');

if (failedSuites > 0) {
  process.exit(1);
}
