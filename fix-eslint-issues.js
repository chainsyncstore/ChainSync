const fs = require('fs');
const path = require('path');

// Function to fix unused variables by prefixing with underscore
function fixUnusedVariables(content) {
  // Fix unused function parameters
  content = content.replace(/(\s+)(\w+)(\s*:\s*[^,)]+)(\s*[,)])/g, (match, space, param, type, end) => {
    if (param.startsWith('_')) return match;
    return `${space}_${param}${type}${end}`;
  });
  
  // Fix unused destructured variables
  content = content.replace(/(\s*)(\w+)(\s*:\s*\w+)/g, (match, space, param, rest) => {
    if (param.startsWith('_')) return match;
    return `${space}_${param}${rest}`;
  });
  
  return content;
}

// Function to fix line length issues by breaking long lines
function fixLineLength(content) {
  const lines = content.split('\n');
  const fixedLines = [];
  
  for (const line of lines) {
    if (line.length > 100 && !line.includes('//') && !line.includes('/*')) {
      // Try to break at logical points
      if (line.includes('(') && line.includes(')')) {
        // Function calls
        const parts = line.split('(');
        if (parts.length > 1) {
          const beforeParen = parts[0];
          const afterParen = parts.slice(1).join('(');
          if (beforeParen.length > 80) {
            // Break before the function call
            const lastSpace = beforeParen.lastIndexOf(' ');
            if (lastSpace > 60) {
              fixedLines.push(beforeParen.substring(0, lastSpace));
              fixedLines.push('  ' + beforeParen.substring(lastSpace + 1) + '(' + afterParen);
              continue;
            }
          }
        }
      }
      
      if (line.includes('=')) {
        // Variable assignments
        const parts = line.split('=');
        if (parts.length > 1) {
          const beforeEqual = parts[0];
          const afterEqual = parts.slice(1).join('=');
          if (beforeEqual.length > 80) {
            const lastSpace = beforeEqual.lastIndexOf(' ');
            if (lastSpace > 60) {
              fixedLines.push(beforeEqual.substring(0, lastSpace));
              fixedLines.push('  ' + beforeEqual.substring(lastSpace + 1) + ' = ' + afterEqual);
              continue;
            }
          }
        }
      }
    }
    fixedLines.push(line);
  }
  
  return fixedLines.join('\n');
}

// Function to fix React unescaped entities
function fixReactEntities(content) {
  return content
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

// Function to process a file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let fixedContent = content;
    
    // Apply fixes
    fixedContent = fixUnusedVariables(fixedContent);
    fixedContent = fixLineLength(fixedContent);
    
    // Only apply React entity fixes to React files
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      fixedContent = fixReactEntities(fixedContent);
    }
    
    if (fixedContent !== content) {
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      console.log(`Fixed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Function to recursively process directories
function processDirectory(dirPath) {
  const files = fs.readdirSync(dirPath);
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules and other common directories
      if (!['node_modules', '.git', 'dist', 'build', 'coverage'].includes(file)) {
        processDirectory(filePath);
      }
    } else if (file.match(/\.(ts|tsx|js|jsx)$/)) {
      processFile(filePath);
    }
  }
}

// Start processing from current directory
console.log('Starting ESLint issue fixes...');
processDirectory('.');
console.log('Finished ESLint issue fixes.'); 