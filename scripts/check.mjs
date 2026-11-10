import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
for (const file of fs.readdirSync('src').filter(f=>f.endsWith('.js'))) {
  execFileSync(process.execPath,['--check',`src/${file}`],{stdio:'inherit'});
}
console.log('All runtime modules parse.');
