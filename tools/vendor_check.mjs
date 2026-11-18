import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const lock = JSON.parse(readFileSync('parts-api/package-lock.json', 'utf8'));
let count = 0;
let failed = 0;
for (const [key, entry] of Object.entries(lock.packages)) {
  const local = key.startsWith('node_modules/@parts/') || key === 'node_modules/string-padder';
  if (!local) continue;
  if (!entry.resolved?.startsWith('file:vendor/')) {
    console.log(`✗ ${key}: vendor tarball이 잠금 목록에 없음`);
    failed++;
    continue;
  }
  try {
    const data = readFileSync(`parts-api/${entry.resolved.slice(5)}`);
    const digest = `sha512-${createHash('sha512').update(data).digest('base64')}`;
    if (digest === entry.integrity) { console.log(`✓ ${key}: sha512 일치`); count++; }
    else { console.log(`✗ ${key}: sha512 불일치`); failed++; }
  } catch {
    console.log(`✗ ${key}: vendor tarball 없음`);
    failed++;
  }
}
console.log(`${count} passed, ${failed} failed`);
process.exit(failed || count === 0 ? 1 : 0);
