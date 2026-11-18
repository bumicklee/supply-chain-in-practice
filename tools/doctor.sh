#!/bin/sh
set -eu
fail=0
check_command() {
  if command -v "$1" >/dev/null 2>&1; then
    printf '✓ %s: %s\n' "$1" "$(command -v "$1")"
  else
    printf '✗ %s 없음 — 설치 후 다시 실행하세요.\n' "$1"
    fail=$((fail + 1))
  fi
}
for tool in git docker node npm make jq curl; do check_command "$tool"; done
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    printf '✓ Docker 데몬\n'
  else
    printf '✗ Docker 데몬에 연결할 수 없습니다 — Docker를 시작하세요.\n'
    fail=$((fail + 1))
  fi
  if docker compose version >/dev/null 2>&1; then
    printf '✓ Docker compose\n'
  else
    printf '✗ Docker compose 없음\n'
    fail=$((fail + 1))
  fi
fi
if command -v java >/dev/null 2>&1; then
  java_line=$(java -version 2>&1 | head -1)
  java_major=$(printf '%s\n' "$java_line" | sed -n 's/.*version "\([0-9][0-9]*\).*/\1/p')
  if [ -n "$java_major" ] && [ "$java_major" -ge 17 ]; then
    printf '✓ JDK 17 이상: %s\n' "$java_line"
  else
    printf '△ JDK 17 이상 필요(섹션 6): 현재 %s\n' "$java_line"
  fi
else
  printf '△ JDK 없음 — 섹션 6을 실습할 때 JDK 17 이상을 설치하세요.\n'
fi
if command -v gh >/dev/null 2>&1; then printf '✓ gh CLI\n'; else printf '△ gh CLI 없음 — GitHub 경로를 사용할 때 설치하세요.\n'; fi
if [ "$fail" -gt 0 ]; then printf '%s개 확인 필요\n' "$fail"; exit 1; fi
printf '준비 완료\n'

