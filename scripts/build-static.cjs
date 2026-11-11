// Package only tracked website content, never node_modules, test reports or credentials.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
fs.rmSync('_site', { recursive: true, force: true });
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const excluded =
  /^(?:\.|tests\/|scripts\/|supabase\/|package(?:-lock)?\.json$|playwright\.config\.cjs$|eslint\.config\.cjs$|AGENTS\.md$)/;
for (const file of files) {
  if (excluded.test(file) && !['.nojekyll', '.pages.yml'].includes(file))
    continue;
  if (!fs.statSync(file).isFile()) continue;
  const target = path.join('_site', file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(file, target);
}
if (!fs.existsSync('_site/index.html')) throw Error('Missing homepage');
console.log('Static website packaged in _site');
