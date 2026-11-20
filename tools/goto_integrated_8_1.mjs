import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const lab = path.join(root, '.lab');
const at = process.argv[2] || 'start';
const force = process.argv[3] === '1';
const output = path.join(lab, 'lesson-8-1');
if (!['start', 'done'].includes(at)) throw new Error('사용법: make goto L=8-1 [AT=done] [FORCE=1]');
fs.mkdirSync(lab, { recursive: true });
function backup(source, name) {
  if (!fs.existsSync(source)) return;
  const destination = path.join(lab, 'backup', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`, name);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(source, destination);
  console.log(`이전 자료 사본: ${path.relative(root, destination)}`);
}
if (at === 'start') {
  if (fs.existsSync(output) && !force) throw new Error('이전 8-1 실측이 있습니다. FORCE=1로 백업 후 시작하세요.');
  backup(output, 'lesson-8-1');
} else {
  if (!fs.existsSync(path.join(lab, 'dt-api-key'))) throw new Error('5-1의 DT 준비가 필요합니다. make dt-up, make dt-bootstrap, make dt-setup-5-1을 먼저 실행하세요.');
  fs.mkdirSync(output, { recursive: true });
  const started = Date.now();
  function record(label, command, args, expected = 'pass') {
    console.log(`$ ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 900_000, maxBuffer: 32 * 1024 * 1024 });
    if (result.error) throw result.error;
    const contents = `${result.stdout || ''}${result.stderr || ''}`;
    fs.writeFileSync(path.join(output, `${label}.txt`), `# ${command} ${args.join(' ')}\n# 종료 코드: ${result.status ?? '없음'}\n${contents}`);
    process.stdout.write(contents);
    if (expected === 'pass' && result.status !== 0 || expected === 'reject' && result.status === 0)
      throw new Error(`${label}: 예상한 ${expected === 'pass' ? '통과' : '거부'} 결과가 아닙니다.`);
    return contents;
  }
  record('grype-db', 'make', ['grype-db']);
  const base = 'b78b1ff2c150a96257a3c8fc5b4ea089c4800374';
  const vulnerable = record('pr-vulnerable', 'make', ['pr-gate-local', `BASE=${base}`, 'HEAD=5d187cbd33facc68c3c26c65e222faeddda7a94c'], 'reject');
  if (!vulnerable.includes('minimist@0.0.8') || !vulnerable.includes('PR 관문: 실패')) throw new Error('취약 버전 PR 실패 근거가 없습니다.');
  const fixed = record('pr-fixed', 'make', ['pr-gate-local', `BASE=${base}`, 'HEAD=4798897d7371de85064c0d01a1472a6dca6af439']);
  if (!fixed.includes('PR 관문: 통과')) throw new Error('수정 버전 PR 통과 근거가 없습니다.');
  const dl = path.join(output, 'dl');
  backup(dl, '8-1-release-download');
  record('release-download', 'gh', ['release', 'download', 'v1.2.0', '--repo', 'bumicklee/supply-chain-in-practice', '-p', '*.tgz', '-p', '*.cdx.json', '-D', path.relative(root, dl)]);
  for (const name of ['parts-api-1.2.0.tgz', 'parts-api-1.2.0.cdx.json']) if (!fs.existsSync(path.join(dl, name))) throw new Error(`릴리스 첨부 누락: ${name}`);
  record('dt-up', 'make', ['dt-up', 'DT_WAIT_SECONDS=900']);
  record('dt-upload', 'make', ['dt-upload', 'V=1.2.0', `SBOM=${path.relative(root, path.join(dl, 'parts-api-1.2.0.cdx.json'))}`]);
  let report = [];
  for (let attempt = 0; attempt < 24; attempt++) {
    const result = record('dt-report', 'make', ['dt-report']);
    report = result.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
    if (report.length === 3 && report.find(row => row.version === '1.2.0')?.components === 75) break;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (report.length !== 3 || report.find(row => row.version === '1.2.0')?.components !== 75) throw new Error('DT에서 세 릴리스와 1.2.0 부품 75개를 확인하지 못했습니다.');
  backup(path.join(lab, 'deploy/v1.2.0'), 'deploy-v1.2.0');
  const deployed = record('deploy-pass', 'make', ['deploy', `TGZ=${path.relative(root, path.join(dl, 'parts-api-1.2.0.tgz'))}`, 'TAG=v1.2.0']);
  if (!deployed.includes('배포: 통과(v1.2.0)')) throw new Error('정상 릴리스 배포가 끝나지 않았습니다.');
  const changed = path.join(output, 'parts-api-1.2.0-tampered.tgz');
  fs.writeFileSync(changed, Buffer.concat([fs.readFileSync(path.join(dl, 'parts-api-1.2.0.tgz')), Buffer.from('lesson-8-1-tamper')]));
  const rejected = record('deploy-reject', 'make', ['deploy', `TGZ=${path.relative(root, changed)}`, 'TAG=v1.2.0'], 'reject');
  if (!rejected.includes('배포: 거부(출처 증명)')) throw new Error('변조 결과물이 출처 증명에서 거부되지 않았습니다.');
  fs.writeFileSync(path.join(output, 'elapsed.json'), JSON.stringify({ replaySeconds: Math.round((Date.now() - started) / 1000), note: '기존 PR 커밋·GitHub 릴리스를 재사용한 학생 재연 시간. 신규 PR/Actions 실행 시간은 제외.' }, null, 2) + '\n');
}
fs.writeFileSync(path.join(lab, 'checkpoint.json'), JSON.stringify({ lesson: '8-1', at }) + '\n');
console.log(`지점: 8-1 ${at === 'done' ? '끝' : '시작'}`);
