// 공개 역할 저장소에 새 패치 버전을 게시한 뒤 해당 목록만 다시 읽게 한다.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';

const file = '/verdaccio/storage/string-padder/package.json';
const metadata = JSON.parse(readFileSync(file, 'utf8'));
if (!metadata._uplinks?.public) {
  console.log('string-padder 공개 목록 캐시가 없습니다.');
  process.exit(0);
}
delete metadata._uplinks.public;
writeFileSync(`${file}.tmp`, JSON.stringify(metadata));
renameSync(`${file}.tmp`, file);
console.log('string-padder 공개 목록 캐시 갱신 준비');
