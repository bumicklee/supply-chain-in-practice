import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const lab = path.join(root, '.lab');
const at = process.argv[2] || 'start';
const force = process.argv[3] === '1';
if (!['start', 'done'].includes(at)) throw new Error('사용법: make goto L=7-2 [AT=done] [FORCE=1]');
fs.mkdirSync(lab, { recursive: true });
const output = path.join(lab, 'lesson-7-2');
if (at === 'start') {
  if (fs.existsSync(output) && !force) throw new Error('이전 7-2 실측이 있습니다. FORCE=1로 .lab/backup에 보관한 뒤 시작하세요.');
  if (fs.existsSync(output)) {
    const backup = path.join(lab, 'backup', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`, 'lesson-7-2');
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.renameSync(output, backup);
    console.log(`이전 실측 사본: ${path.relative(root, backup)}`);
  }
} else {
  fs.mkdirSync(output, { recursive: true });
  function record(label, command, args, expected) {
    console.log(`$ ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 900_000 });
    if (result.error) throw result.error;
    const contents = `${result.stdout || ''}${result.stderr || ''}`;
    fs.writeFileSync(path.join(output, `${label}.txt`), `# ${command} ${args.join(' ')}\n# 종료 코드: ${result.status ?? '없음'}\n${contents}`);
    process.stdout.write(contents);
    if (expected === 'pass' && result.status !== 0 || expected === 'reject' && result.status === 0)
      throw new Error(`${label}: 예상한 ${expected === 'pass' ? '통과' : '거부'} 결과가 아닙니다.`);
    return contents;
  }
  const passed = record('offline-pass', 'make', ['verify-offline'], 'pass');
  if (!passed.includes('통과(https://slsa.dev/provenance/v1)') || !passed.includes('통과(https://cyclonedx.org/bom)'))
    throw new Error('출처·SBOM 증명 두 종류가 모두 통과하지 않았습니다.');
  const original = fs.readFileSync(path.join(root, 'fixtures/attestation/parts-api-1.1.0.tgz'));
  const changed = path.join(output, 'parts-api-1.1.0-tampered.tgz');
  fs.writeFileSync(changed, Buffer.concat([original, Buffer.from('lesson-7-2-tamper')]));
  const rejected = record('offline-reject', 'make', ['verify-offline', `TGZ=${path.relative(root, changed)}`], 'reject');
  if (!rejected.includes('오프라인 검증: 거부')) throw new Error('변조 파일의 거부 원인을 확인하지 못했습니다.');
  const destination = path.join(lab, 'deploy/v1.1.0');
  if (fs.existsSync(destination)) {
    const backup = path.join(lab, 'backup', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`, 'deploy-v1.1.0');
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.renameSync(destination, backup);
    console.log(`이전 배포 사본: ${path.relative(root, backup)}`);
  }
  const deployed = record('deploy-pass', 'make', ['deploy', 'TGZ=fixtures/attestation/parts-api-1.1.0.tgz', 'TAG=v1.1.0'], 'pass');
  if (!deployed.includes('배포: 통과(v1.1.0)') || !deployed.includes('SBOM 증명 확인')) throw new Error('배포 검증 기록이 불완전합니다.');
}
fs.writeFileSync(path.join(lab, 'checkpoint.json'), JSON.stringify({ lesson: '7-2', at }) + '\n');
console.log(`지점: 7-2 ${at === 'done' ? '끝' : '시작'}`);
