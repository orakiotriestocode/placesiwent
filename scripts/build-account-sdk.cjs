const { buildSync } = require('esbuild');
const fs = require('node:fs');
buildSync({
  stdin: {
    contents: "export { createClient } from '@supabase/supabase-js';",
    resolveDir: process.cwd(),
    sourcefile: 'supabase-sdk-entry.js',
    loader: 'js',
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'PiwSupabase',
  outfile: 'assets/vendor/supabase-browser.js',
  minify: true,
  target: ['es2020'],
  legalComments: 'eof',
});
fs.copyFileSync(
  'node_modules/@supabase/supabase-js/LICENSE',
  'assets/vendor/supabase-LICENSE.txt',
);
