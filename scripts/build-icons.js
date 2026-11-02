// Builds vendor/lucide.js with only the icons TradeFlow uses (instead of all ~1,700).
// It keeps every lucide icon name that appears anywhere in the app's markup or scripts,
// including names chosen at runtime, so a superset is bundled and nothing goes missing.
// Run after adding new icons: npm run icons:build
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const lucide = require('lucide');
const files = ['index.html', 'mobile_snap.html', ...fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f)];
const source = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const pascal = s => s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('');
const names = [...new Set(source.match(/[a-z][a-z0-9]*(?:-[a-z0-9]+)*/g))].map(pascal).filter(n => lucide.icons && lucide.icons[n]).sort();
const entry = `import { createIcons as create, ${names.join(', ')} } from 'lucide';
const icons = { ${names.join(', ')} };
window.lucide = { icons, createIcons: (options = {}) => create({ icons, ...options }) };
`;
const entryFile = path.join(root, 'node_modules', '.tradeflow-icons-entry.js');
fs.writeFileSync(entryFile, entry);
esbuild.build({ entryPoints: [entryFile], outfile: path.join(root, 'vendor/lucide.js'), bundle: true, format: 'iife', platform: 'browser', target: 'es2020', minify: true, legalComments: 'eof' })
  .then(() => { fs.unlinkSync(entryFile); console.log(`Built vendor/lucide.js with ${names.length} icons (of ${Object.keys(lucide.icons).length}).`); })
  .catch(error => { console.error(error); process.exitCode = 1; });
