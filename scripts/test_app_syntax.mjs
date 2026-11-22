import fs from 'fs';
import vm from 'vm';

try {
  const code = fs.readFileSync('public/classic/cd4bef5efafb3ec7/app.js', 'utf8');
  console.log('Read app.js, length:', code.length);
  // parse as module in node vm
  new vm.SourceTextModule(code);
  console.log('SUCCESS: app.js is syntactically valid ESM!');
} catch (e) {
  console.error('ERROR in app.js:', e);
}
