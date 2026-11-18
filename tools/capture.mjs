import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform, release, arch } from 'node:os';

const [lesson, name, workdir, command, ...args] = process.argv.slice(2);
if (!lesson || !name || !workdir || !command || !/^\d+-\d+$/.test(lesson) || !/^[a-z0-9-]+$/.test(name)) {
  console.error('사용법: node tools/capture.mjs N-M name workdir command [args...]');
  process.exit(2);
}
const root = process.cwd();
const env = { ...process.env };
for (const match of readFileSync('.lab/env', 'utf8').matchAll(/^export ([A-Z_]+)=(.+)$/gm)) env[match[1]] = match[2];
const result = spawnSync(command, args, { cwd: resolve(root, workdir), env, encoding: 'utf8' });
const out = result.stdout || '';
const err = result.stderr || '';
const header = [
  `# 날짜 ${new Date().toISOString()} · OS ${platform()} ${release()} ${arch()} · Node ${process.version}`,
  `# 지점 ${lesson} · 실측`,
  `# 명령 ${[command, ...args].join(' ')}`,
  `# 종료 코드 ${result.status ?? 'signal'}`,
  '',
].join('\n');
const target = join(root, '..', '실측', 'results', `${lesson}-${name}.txt`);
mkdirSync(join(root, '..', '실측', 'results'), { recursive: true });
writeFileSync(target, header + out + err);
process.stdout.write(out);
process.stderr.write(err);
console.log(`실측 저장: ${target}`);
process.exit(result.status ?? 1);
