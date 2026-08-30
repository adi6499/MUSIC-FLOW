const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDir = __dirname;
const files = fs.readdirSync(testDir).filter(f => f.startsWith('test_') && f.endsWith('.js') && f !== 'run_all_tests.js');

console.log(`\n======================================================`);
console.log(`🚀 RUNNING ALL ${files.length} TEST SUITES ACROSS PROJECT`);
console.log(`======================================================\n`);

let passed = 0;
let failed = 0;
const failures = [];

files.forEach(file => {
  try {
    execSync(`node "${path.join(testDir, file)}"`, { stdio: 'pipe' });
    console.log(`  ✅ [PASS] ${file}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ [FAIL] ${file}`);
    failed++;
    failures.push({ file, output: err.stdout ? err.stdout.toString() : err.message });
  }
});

console.log(`\n======================================================`);
console.log(`📊 OVERALL RESULTS: ${passed}/${files.length} PASSED (${failed} FAILED)`);
console.log(`======================================================\n`);

if (failed > 0) {
  console.log('Failure details:');
  failures.forEach(f => {
    console.log(`\n--- ${f.file} ---`);
    console.log(f.output);
  });
  process.exit(1);
} else {
  process.exit(0);
}
