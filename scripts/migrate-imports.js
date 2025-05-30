import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';

// Define path aliases and their corresponding directories
const pathAliases = {
  '@src': 'server',
  '@shared': 'shared',
  '@db': 'server/db',
  '@services': 'server/services',
  '@utils': 'server/utils'
};

// Find all TypeScript files
const tsFiles = globSync('**/*.{ts,tsx}', {
  ignore: ['node_modules/**', 'dist/**', 'scripts/**'],
  cwd: process.cwd()
});

// Counter for statistics
let totalFilesModified = 0;
let totalImportsChanged = 0;

tsFiles.forEach(filePath => {
  const fullPath = path.join(process.cwd(), filePath);
  const fileContent = fs.readFileSync(fullPath, 'utf8');
  const dirName = path.dirname(filePath);
  
  // Regular expression to find relative imports
  const importRegex = /import\s+(?:(?:\{[^}]*\})|(?:[^{}\s]+))?\s*(?:from\s+)?['"]([\.\/][^'"]+)['"]/g;
  
  let match;
  let newContent = fileContent;
  let hasChanges = false;
  
  while ((match = importRegex.exec(fileContent)) !== null) {
    const importPath = match[1];
    
    // Skip if it's a same-folder relative import (e.g., './foo')
    if (importPath.startsWith('./')) {
      continue;
    }
    
    // Try to convert the relative path to an alias path
    let absolutePath = path.resolve(path.dirname(fullPath), importPath);
    let relativePath = path.relative(process.cwd(), absolutePath);
    relativePath = relativePath.replace(/\\/g, '/'); // Normalize path separators
    
    // Check if this path matches any of our alias directories
    for (const [alias, dir] of Object.entries(pathAliases)) {
      if (relativePath.startsWith(dir + '/')) {
        const aliasPath = relativePath.replace(dir + '/', alias + '/');
        const originalImport = match[0];
        const newImport = originalImport.replace(importPath, aliasPath);
        
        newContent = newContent.replace(originalImport, newImport);
        hasChanges = true;
        totalImportsChanged++;
        break;
      }
    }
  }
  
  if (hasChanges) {
    fs.writeFileSync(fullPath, newContent, 'utf8');
    totalFilesModified++;
    console.log(`Modified: ${filePath}`);
  }
});

console.log(`\nMigration Complete!`);
console.log(`Total files modified: ${totalFilesModified}`);
console.log(`Total imports changed: ${totalImportsChanged}`);
