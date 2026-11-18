import { copyFileSync, existsSync, appendFileSync, unlinkSync } from 'node:fs';

const target = '/verdaccio/storage/string-padder/string-padder-2.4.0.tgz';
const backup = `${target}.original`;
const mode = process.argv[2];
if (!existsSync(target)) throw new Error('string-padder@2.4.0이 사내 레지스트리 캐시에 없습니다. 먼저 npm ci를 실행하세요.');
if (mode === 'swap') {
  if (existsSync(backup)) throw new Error('이미 변조한 상태입니다. 먼저 make attack-undo A=swap을 실행하세요.');
  copyFileSync(target, backup);
  appendFileSync(target, 'EDUCATIONAL-TAMPER');
  console.log('교육용: 로컬 tarball 끝에 바이트를 추가했습니다.');
} else if (mode === 'undo') {
  if (!existsSync(backup)) throw new Error('복구할 원본 tarball이 없습니다.');
  copyFileSync(backup, target);
  unlinkSync(backup);
  console.log('로컬 tarball 원본을 복구했습니다.');
} else {
  throw new Error('swap 또는 undo를 선택하세요.');
}
