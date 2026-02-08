/**
 * ========================================================================
 * Trading Journal - Production Build Script
 * ========================================================================
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  log(`\n📦 ${description}...`, 'yellow');
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname.replace('/scripts', '').replace('\\scripts', '') });
    log(`✓ ${description} abgeschlossen`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${description} fehlgeschlagen`, 'red');
    return false;
  }
}

async function main() {
  log('═══════════════════════════════════════════════════════════════', 'blue');
  log('   Trading Journal Desktop - Production Build', 'blue');
  log('═══════════════════════════════════════════════════════════════', 'blue');

  const rootDir = __dirname.replace('/scripts', '').replace('\\scripts', '');

  // Step 1: TypeScript für Electron kompilieren
  if (!runCommand('npx tsc -p tsconfig.node.json', 'Electron TypeScript kompilieren')) {
    process.exit(1);
  }

  // Step 2: Vite Build
  if (!runCommand('npx vite build', 'React App bauen')) {
    process.exit(1);
  }

  // Step 3: Electron Builder
  if (!runCommand('npx electron-builder --win --config', 'Windows Installer erstellen')) {
    process.exit(1);
  }

  log('\n═══════════════════════════════════════════════════════════════', 'green');
  log('   ✓ Build erfolgreich abgeschlossen!', 'green');
  log('   Die .exe Datei befindet sich in: dist/', 'green');
  log('═══════════════════════════════════════════════════════════════', 'green');
}

main().catch(console.error);
