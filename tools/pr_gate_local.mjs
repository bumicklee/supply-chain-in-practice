import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const [base, head] = process.argv.slice(2);
if (![base, head].every(ref => /^[A-Za-z0-9._/-]+$/.test(ref ?? ''))) {
  console.error('사용법: make pr-gate-local BASE=main HEAD=<가지>');
  process.exit(2);
}

const packagesAt = ref => {
  const lock = JSON.parse(execFileSync('git', ['show', `${ref}:parts-api/package-lock.json`], { encoding: 'utf8' }));
  const result = new Map();
  for (const [location, pkg] of Object.entries(lock.packages ?? {})) {
    if (!location || !pkg.version) continue;
    const name = pkg.name ?? location.split('node_modules/').at(-1);
    result.set(`${name}@${pkg.version}`, { name, version: pkg.version });
  }
  return result;
};

const before = packagesAt(base);
const after = packagesAt(head);
const added = [...after].filter(([key]) => !before.has(key)).map(([, value]) => value);
console.log(`Git 기준 ${base} → ${head}; 새 부품 ${added.length}개`);
for (const pkg of added) console.log(`+ ${pkg.name}@${pkg.version}`);
if (!added.length) {
  console.log('PR 관문: 통과(새 부품 없음)');
  process.exit(0);
}

mkdirSync('.lab/pr-gate', { recursive: true });
const component = pkg => ({
  type: 'library',
  name: pkg.name,
  version: pkg.version,
  purl: `pkg:npm/${pkg.name.startsWith('@') ? pkg.name.replace('@', '%40') : pkg.name}@${pkg.version}`,
});
writeFileSync('.lab/pr-gate/new.cdx.json', JSON.stringify({
  bomFormat: 'CycloneDX', specVersion: '1.6', version: 1,
  components: added.map(component),
}));
const scan = spawnSync('./bin/grype', ['sbom:.lab/pr-gate/new.cdx.json', '-o', 'json'], {
  encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 180_000,
});
if (scan.status !== 0) {
  console.error(scan.stderr || scan.error?.message || 'Grype 실행 실패');
  process.exit(2);
}
const matches = JSON.parse(scan.stdout).matches ?? [];
const blocking = matches.filter(match => ['high', 'critical'].includes(match.vulnerability?.severity?.toLowerCase()));
for (const match of blocking) {
  console.log(`! ${match.artifact.name}@${match.artifact.version} ${match.vulnerability.id} ${match.vulnerability.severity}`);
}
if (blocking.length) {
  console.error(`PR 관문: 실패(새 high 이상 ${blocking.length}건)`);
  process.exit(1);
}
console.log('PR 관문: 통과(새 high 이상 0건)');
