import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPackagePath = path.join(__dirname, '../dist/server/package.json');
const packageContent = JSON.stringify({ _type: 'commonjs' }, null, 2);

// Ensure dist/server directory exists
const serverDir = path.dirname(serverPackagePath);
if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir, { _recursive: true });
}

// Write package.json
fs.writeFileSync(serverPackagePath, packageContent);
console.log('✅ Created package.json in dist/server directory');
