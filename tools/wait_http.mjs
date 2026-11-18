const [url, seconds = '120'] = process.argv.slice(2);
if (!url) { console.error('사용법: node tools/wait_http.mjs <url> <최대 초>'); process.exit(2); }
const until = Date.now() + Number(seconds) * 1000;
let lastProgress = Date.now();
while (Date.now() < until) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (response.ok) { console.log(`✓ 준비 완료: ${url}`); process.exit(0); }
  } catch {}
  if (Date.now() - lastProgress >= 30_000) {
    console.log(`대기 중: ${url} (남은 최대 ${Math.ceil((until - Date.now()) / 1000)}초)`);
    lastProgress = Date.now();
  }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
console.error(`✗ 준비 시간 초과: ${url}`);
process.exit(1);
