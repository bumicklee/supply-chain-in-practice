#!/usr/bin/env node
// 4-1 수업의 검사 결과가 바뀌지 않도록 실측한 Grype DB를 복원한다.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const lock = fs.readFileSync('tools/versions.lock', 'utf8');
const built = /^grype_db_built=(.+)$/m.exec(lock)?.[1];
const url = /^grype_db_url=(.+)$/m.exec(lock)?.[1];
if (!built || !url) {
  console.error('tools/versions.lock에 Grype DB 빌드 시각과 URL이 필요합니다.');
  process.exit(2);
}

function grype(args, print = true) {
  const result = spawnSync('./bin/grype', args, { encoding: 'utf8', timeout: 1_800_000 });
  if (result.error) throw result.error;
  if (print) {
    process.stdout.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
  }
  return result;
}

try {
  let status = grype(['db', 'status'], false);
  if (status.status !== 0 || !status.stdout.includes(`Built:     ${built}`)) {
    console.log(`Grype DB ${built} 복원 중. 최초 실행은 수 GB 다운로드와 압축 해제에 시간이 걸립니다.`);
    const imported = grype(['db', 'import', url]);
    if (imported.status !== 0) process.exit(imported.status || 1);
    status = grype(['db', 'status'], false);
  }
  if (status.status !== 0 || !status.stdout.includes(`Built:     ${built}`)) {
    console.error(`Grype DB 날짜가 ${built}와 다릅니다.\n${status.stdout || status.stderr || ''}`);
    process.exit(1);
  }
  process.stdout.write(status.stdout);
} catch (error) {
  console.error(`Grype DB 확인 실패: ${error.message}`);
  process.exit(1);
}
