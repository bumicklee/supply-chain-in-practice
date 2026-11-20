import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const lab = path.join(root, '.lab');
const at = process.argv[2] || 'start';
const force = process.argv[3] === '1';
const source = 'solutions/checkpoints/7-1/parts-api';
const files = ['package.json', 'package-lock.json', '.npmrc', 'src/app.js', 'src/server.js'];
const stateFile = path.join(lab, 'goto-release-7-1-files.json');
const hash = file => fs.existsSync(file) ? createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null;
function run(command, args) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', timeout: 900_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 종료 코드 ${result.status ?? '없음'}`);
}
function record(label, command, args) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 900_000 });
  if (result.error) throw result.error;
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  fs.mkdirSync(path.join(lab, 'release-7-1'), { recursive: true });
  fs.writeFileSync(path.join(lab, 'release-7-1', `${label}.txt`), `# ${command} ${args.join(' ')}\n# 종료 코드: ${result.status ?? '없음'}\n${output}`);
  process.stdout.write(output);
  if (result.status !== 0) throw new Error(`${command} 종료 코드 ${result.status ?? '없음'}`);
}
if (!['start', 'done'].includes(at)) throw new Error('사용법: make goto L=7-1 [AT=done] [FORCE=1]');
fs.mkdirSync(lab, { recursive: true });
let previous = {}, generic = {};
try { previous = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch {}
try { generic = JSON.parse(fs.readFileSync(path.join(lab, 'goto-files.json'), 'utf8')); } catch {}
const changed = files.filter(rel => {
  const target = `parts-api/${rel}`;
  const expected = previous.hashes?.[target] ?? generic.hashes?.[target] ?? hash(path.join(root, source, rel));
  return hash(path.join(root, target)) !== expected;
});
if (changed.length && !force) throw new Error(`고친 수업 파일이 있습니다: ${changed.join(', ')}. FORCE=1로 .lab/backup에 사본을 남기고 이동하세요.`);
const backup = path.join(lab, 'backup', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`);
for (const rel of files) {
  const target = `parts-api/${rel}`;
  const original = path.join(root, target);
  if (!fs.existsSync(original)) continue;
  const destination = path.join(backup, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(original, destination);
}
if (fs.existsSync(path.join(root, 'parts-api/vendor'))) fs.cpSync(path.join(root, 'parts-api/vendor'), path.join(backup, 'parts-api/vendor'), { recursive: true });
console.log(`이전 파일 사본: ${path.relative(root, backup)}`);
for (const rel of files) {
  const target = path.join(root, 'parts-api', rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, source, rel), target);
}
fs.rmSync(path.join(root, 'parts-api/vendor'), { recursive: true, force: true });
fs.rmSync(path.join(root, 'parts-api/npm-shrinkwrap.json'), { force: true });
fs.rmSync(path.join(lab, 'release-7-1'), { recursive: true, force: true });
if (at === 'done') {
  run('make', ['up']);
  run('make', ['vendor']);
  run('make', ['vendor-check']);
  record('release-local', 'make', ['release-local', 'V=1.1.0']);
  record('release-compare', 'make', ['release-compare', 'V=1.1.0']);
}
const hashes = Object.fromEntries(files.map(rel => [`parts-api/${rel}`, hash(path.join(root, 'parts-api', rel))]));
fs.writeFileSync(stateFile, JSON.stringify({ lesson: '7-1', at, hashes }, null, 2) + '\n');
fs.writeFileSync(path.join(lab, 'checkpoint.json'), JSON.stringify({ lesson: '7-1', at }) + '\n');
console.log(`지점: 7-1 ${at === 'done' ? '끝' : '시작'}`);
