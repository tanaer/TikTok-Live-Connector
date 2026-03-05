/**
 * Fix TikTok-Live-Connector dist/ path aliases
 * 
 * After sed replaced @/ with ./, paths in subdirectories are wrong.
 * This script fixes them by computing correct relative paths.
 * 
 * Run on server: node fix_dist_paths.js
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

function walkJs(dir) {
    let files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) files = files.concat(walkJs(full));
        else if (entry.name.endsWith('.js')) files.push(full);
    }
    return files;
}

let totalFixed = 0;

for (const filePath of walkJs(distDir)) {
    const fileDir = path.dirname(filePath);
    const depth = path.relative(distDir, fileDir).split(path.sep).filter(Boolean).length;
    
    if (depth === 0) continue; // root-level files are fine with ./

    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    // Match require("./something") patterns
    content = content.replace(/require\("\.\/([^"]+)"\)/g, (match, reqPath) => {
        // Check if this path resolves from the current directory
        const localResolved = path.join(fileDir, reqPath);
        if (fs.existsSync(localResolved + '.js') || fs.existsSync(localResolved + '/index.js') || fs.existsSync(localResolved)) {
            return match; // legitimate local require, keep as-is
        }

        // Check if it resolves from dist root (was originally @/path)
        const rootResolved = path.join(distDir, reqPath);
        if (fs.existsSync(rootResolved + '.js') || fs.existsSync(rootResolved + '/index.js') || fs.existsSync(rootResolved)) {
            const prefix = '../'.repeat(depth);
            changed = true;
            return `require("${prefix}${reqPath}")`;
        }

        return match; // unknown, leave alone
    });

    if (changed) {
        fs.writeFileSync(filePath, content);
        const rel = path.relative(distDir, filePath);
        console.log(`  [FIXED] dist/${rel}`);
        totalFixed++;
    }
}

console.log(`\nDone. Fixed ${totalFixed} files.`);
