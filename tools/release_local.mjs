import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const version = process.argv[2];
const pkg = JSON.parse(readFileSync('parts-api/package.json', 'utf8'));
if (!version || version !== pkg.version) {
  console.error(`사용법: make release-local V=${pkg.version}`);
  process.exit(2);
}
const root = process.cwd();
const work = join(root, '.lab/release-work');
const installed = join(root, 'release-stage/installed');
const output = join(root, '.lab/releases');
rmSync(work, { recursive: true, force: true });
rmSync(installed, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
mkdirSync(installed, { recursive: true });
mkdirSync(output, { recursive: true });
for (const name of ['package.json', 'package-lock.json']) cpSync(`parts-api/${name}`, join(work, name));
for (const name of ['src', 'vendor']) cpSync(`parts-api/${name}`, join(work, name), { recursive: true, force: true });
const run = (command, args, cwd) => {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: 'inherit', env: { ...process.env, NPM_CONFIG_CACHE: join(root, '.lab/npm-cache-release') } });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run('npm', ['shrinkwrap', '--offline'], work);
run('npm', ['pack', '--ignore-scripts'], work);
const tgzName = `parts-api-${version}.tgz`;
cpSync(join(work, tgzName), join(output, tgzName));
run('tar', ['-xzf', join(output, tgzName), '-C', installed], root);
run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--registry=https://registry.npmjs.org/', '--replace-registry-host=never'], join(installed, 'package'));
run('./bin/syft', ['scan', 'dir:release-stage/installed/package', '--source-name', 'parts-api', '--source-version', version, '--override-default-catalogers', 'javascript-package-cataloger', '--select-catalogers=-file', '-o', `cyclonedx-json=.lab/releases/parts-api-${version}.cdx.json`], root);
console.log(`로컬 릴리스: .lab/releases/${tgzName}`);
console.log(`운영 SBOM: .lab/releases/parts-api-${version}.cdx.json`);
