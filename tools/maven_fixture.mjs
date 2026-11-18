import { mkdirSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const action = process.argv[2];
const base = '.lab';
const publicRoot = join(base, 'maven-public');
const internalRoot = join(base, 'maven-internal');
const backup = join(base, 'maven-backup', 'text-utils-2.0.0.jar');
const artifact = (root, group, name, version, origin, replace = false) => {
  const path = join(root, ...group.split('.'), name, version);
  const jar = join(path, `${name}-${version}.jar`);
  if (!replace && existsSync(jar)) return jar;
  mkdirSync(path, { recursive: true });
  const staging = join(base, 'maven-staging', `${name}-${version}-${origin.replaceAll(' ', '-')}`);
  mkdirSync(staging, { recursive: true });
  writeFileSync(join(staging, 'lab-origin.txt'), `${origin}\n`);
  execFileSync('jar', ['cf', jar, '-C', staging, '.']);
  writeFileSync(join(path, `${name}-${version}.pom`), `<project xmlns="http://maven.apache.org/POM/4.0.0"><modelVersion>4.0.0</modelVersion><groupId>${group}</groupId><artifactId>${name}</artifactId><version>${version}</version></project>\n`);
  return jar;
};
const metadata = (root, group, name, versions) => {
  const path = join(root, ...group.split('.'), name);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'maven-metadata.xml'), `<metadata><groupId>${group}</groupId><artifactId>${name}</artifactId><versioning><latest>${versions.at(-1)}</latest><release>${versions.at(-1)}</release><versions>${versions.map(v => `<version>${v}</version>`).join('')}</versions></versioning></metadata>\n`);
};
if (action === 'seed') {
  artifact(internalRoot, 'com.parts.internal', 'pricing', '1.2.0', '사내 저장소');
  artifact(internalRoot, 'com.parts.internal', 'pricing', '1.3.0', '사내 저장소');
  metadata(internalRoot, 'com.parts.internal', 'pricing', ['1.2.0', '1.3.0']);
  const original = artifact(publicRoot, 'com.labpub', 'text-utils', '2.0.0', '공개 역할 저장소');
  metadata(publicRoot, 'com.labpub', 'text-utils', ['2.0.0']);
  mkdirSync(join(base, 'maven-backup'), { recursive: true });
  if (!existsSync(backup)) copyFileSync(original, backup);
  if (existsSync('prebuilt/analytics-1.0.0.aar')) {
    const sdkDir = join(publicRoot, 'com', 'labsdk', 'analytics', '1.0.0');
    mkdirSync(sdkDir, { recursive: true });
    copyFileSync('prebuilt/analytics-1.0.0.aar', join(sdkDir, 'analytics-1.0.0.aar'));
    copyFileSync('sdk-fixture/analytics-1.0.0.pom', join(sdkDir, 'analytics-1.0.0.pom'));
  }
  console.log('✓ Maven 사내/공개 역할 저장소 기본 아티팩트 준비');
} else if (action === 'confusion') {
  artifact(publicRoot, 'com.parts.internal', 'pricing', '1.2.0', '공개 역할 저장소');
  artifact(publicRoot, 'com.parts.internal', 'pricing', '1.99.0', '공개 역할 저장소');
  metadata(publicRoot, 'com.parts.internal', 'pricing', ['1.2.0', '1.99.0']);
  console.log('✓ Maven 공개 역할 저장소에 같은 좌표와 높은 버전 게시');
} else if (action === 'confusion-undo') {
  rmSync(join(publicRoot, 'com', 'parts', 'internal', 'pricing'), { recursive: true, force: true });
  console.log('✓ Maven 공개 역할 저장소 공격 좌표 제거');
} else if (action === 'swap') {
  artifact(publicRoot, 'com.labpub', 'text-utils', '2.0.0', '바꿔 친 공개 저장소', true);
  console.log('✓ text-utils 2.0.0 jar 내용 바꿔치기');
} else if (action === 'swap-undo') {
  const target = join(publicRoot, 'com', 'labpub', 'text-utils', '2.0.0', 'text-utils-2.0.0.jar');
  if (!existsSync(backup)) throw new Error('원본 jar 백업 없음');
  copyFileSync(backup, target);
  console.log('✓ text-utils 2.0.0 jar 원본 복구');
} else {
  console.error('사용법: node tools/maven_fixture.mjs seed|confusion|confusion-undo|swap|swap-undo');
  process.exit(2);
}
