/**
 * ========================================================================
 * Trading Journal - Electron Builder Script
 * ========================================================================
 * 
 * Dieses Script kompiliert TypeScript und startet Electron
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const isWindows = process.platform === 'win32';

// Farben für Console Output
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

function ensureDistFolder() {
  const distElectron = path.join(__dirname, '..', 'dist-electron');
  if (!fs.existsSync(distElectron)) {
    fs.mkdirSync(distElectron, { recursive: true });
  }
}

function compileTypeScript() {
  log('\n📦 Kompiliere Electron TypeScript...', 'yellow');
  
  try {
    execSync('npx tsc -p tsconfig.node.json', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    log('✓ TypeScript kompiliert', 'green');
    return true;
  } catch (error) {
    log('✗ TypeScript Kompilierung fehlgeschlagen', 'red');
    return false;
  }
}

const projectRoot = path.join(__dirname, '..');

function startVite() {
  log('\n🚀 Starte Vite Dev Server...', 'yellow');
  
  const vite = spawn(isWindows ? 'npx.cmd' : 'npx', ['vite'], {
    cwd: projectRoot,
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: true
  });

  return new Promise((resolve) => {
    vite.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      
      // Warte bis Vite bereit ist
      if (output.includes('Local:') || output.includes('ready in')) {
        resolve(vite);
      }
    });
  });
}

function startElectron() {
  log('\n⚡ Starte Electron...', 'yellow');
  
  const electron = spawn(
    isWindows ? 'npx.cmd' : 'npx',
    ['electron', './dist-electron/main.js'],
    {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: 'http://localhost:5173'
      }
    }
  );

  electron.on('close', (code) => {
    log(`\nElectron beendet mit Code ${code}`, code === 0 ? 'green' : 'red');
    process.exit(code);
  });

  return electron;
}

async function main() {
  log('═══════════════════════════════════════════════════════════════', 'blue');
  log('   Trading Journal Desktop - Development Mode', 'blue');
  log('═══════════════════════════════════════════════════════════════', 'blue');

  ensureDistFolder();
  
  if (!compileTypeScript()) {
    process.exit(1);
  }

  const vite = await startVite();
  
  // Kurze Pause um sicherzustellen dass Vite bereit ist
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const electron = startElectron();

  // Cleanup bei CTRL+C
  process.on('SIGINT', () => {
    log('\n\n🛑 Beende Prozesse...', 'yellow');
    vite.kill();
    electron.kill();
    process.exit(0);
  });
}

main().catch(console.error);
