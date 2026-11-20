// Prepare a fresh local DT volume for the internal-vulnerability lesson.
// This follows Dependency-Track's developer-guide dummy NVD cache approach,
// using the 2.0 feed filenames observed in the pinned 4.14.5 image.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const match = /^COMPOSE_PROJECT_NAME=(scl-[a-f0-9]{8})$/m.exec(fs.readFileSync('.env', 'utf8'));
if (!match) throw new Error('make compose-id로 이 클론의 .env를 먼저 만드세요.');
const volume = `${match[1]}_dt-data`;
function run(args) {
  const result = spawnSync('docker', args, { stdio: 'inherit', timeout: 120_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`docker ${args[0]} 실패: ${result.status}`);
}

const inspected = spawnSync('docker', ['volume', 'inspect', volume], { stdio: 'ignore' });
if (inspected.status !== 0) run([
  'volume', 'create',
  '--label', `com.docker.compose.project=${match[1]}`,
  '--label', 'com.docker.compose.volume=dt-data',
  volume,
]);
const script = [
  'set -eu',
  'data=/data/.dependency-track',
  'if [ -f "$data/db.mv.db" ]; then echo "기존 DT 데이터 볼륨 유지: NVD 캐시를 바꾸지 않음"; exit 0; fi',
  'mkdir -p "$data/nist"',
  'year=2002',
  'last=$(date +%Y)',
  'while [ "$year" -le "$last" ]; do',
  '  : > "$data/nist/nvdcve-2.0-$year.json.gz"',
  '  printf 9999999999999 > "$data/nist/nvdcve-2.0-$year.json.gz.ts"',
  '  year=$((year + 1))',
  'done',
  'chown -R 1000:1000 "$data"',
  'echo "✓ 교육용 NVD 캐시 준비: 실제 NVD 이력 대신 내부 취약점으로 실습"',
].join('\n');
run(['run', '--rm', '-v', `${volume}:/data`,
  'node:22.21.1-alpine@sha256:0340fa682d72068edf603c305bfbc10e23219fb0e40df58d9ea4d6f33a9798bf',
  'sh', '-c', script]);
