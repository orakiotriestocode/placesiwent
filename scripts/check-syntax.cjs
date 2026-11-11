// Parse active browser code without executing it. Historic releases and vendor bundles stay untouched.
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
let count = 0;
function parse(source, name, sourceType) {
  try {
    acorn.parse(source, {
      ecmaVersion: 'latest',
      sourceType,
      allowHashBang: true,
    });
    count++;
  } catch (error) {
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  }
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name.startsWith('.') ||
        [
          'node_modules',
          'versions',
          'vendor',
          'playwright-report',
          'test-results',
          'performance-report',
          '_site',
        ].includes(entry.name)
      )
        continue;
      walk(file);
    } else if (file.endsWith('.js'))
      parse(
        fs.readFileSync(file, 'utf8'),
        file,
        file.includes('publisher') ? 'module' : 'script',
      );
    else if (file.endsWith('.html')) {
      let index = 0;
      for (const match of fs
        .readFileSync(file, 'utf8')
        .matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        const attrs = match[1];
        if (
          /\bsrc\s*=/.test(attrs) ||
          (/\btype\s*=/.test(attrs) &&
            !/type\s*=\s*["'](?:module|text\/javascript|application\/javascript)["']/.test(
              attrs,
            ))
        )
          continue;
        if (match[2].trim())
          parse(
            match[2],
            `${file}:script-${++index}`,
            /type\s*=\s*["']module["']/.test(attrs) ? 'module' : 'script',
          );
      }
    }
  }
}
walk('.');
console.log(`Checked ${count} active JavaScript blocks/files.`);
