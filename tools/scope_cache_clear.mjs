import { readFileSync, writeFileSync, renameSync } from 'node:fs';

const path = '/verdaccio/storage/@parts/price-rules/package.json';
const metadata = JSON.parse(readFileSync(path, 'utf8'));
const removed = [];
for (const [version, item] of Object.entries(metadata.versions || {})) {
  const tarball = item.dist?.tarball || '';
  if (tarball.includes('verdaccio-public:4873/') || tarball.includes('127.0.0.1:4874/')) {
    delete metadata.versions[version];
    removed.push(version);
  }
}
if (removed.length) {
  const local = Object.keys(metadata.versions);
  if (!local.length) throw new Error('로컬 버전이 없어 캐시를 지우지 않았습니다.');
  metadata['dist-tags'].latest = local.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  if (metadata._uplinks) delete metadata._uplinks.public;
  writeFileSync(`${path}.tmp`, JSON.stringify(metadata));
  renameSync(`${path}.tmp`, path);
}
console.log(`스코프 공개 캐시 정리: ${removed.length ? removed.join(', ') : '대상 없음'}`);
