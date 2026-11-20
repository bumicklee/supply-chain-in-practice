# 4-1 수업용 CISA KEV 스냅샷

- 원본: [CISA KEV 데이터 미러](https://github.com/CISAGov/kev-data), `develop` 커밋 `a705bb0fa3ba6fc554cf8694c9c321364a4a094e`
- 원본 파일: `known_exploited_vulnerabilities.json`
- 카탈로그 버전: `2026.11.18`, 발행 시각 `2026-11-18T19:17:41.0354Z`, 1,786건
- SHA-256: `ad618e404a43d72ac6435b6e5a8d75000778b9245a6b70dbde46530152f2eef3`

`make kev-check`는 Grype JSON 경보의 CVE 별칭을 이 목록과 대조한다. 일치가 0건이어도 실제 악용 가능성이 없다는 뜻은 아니다. 운영 환경에서는 최신 목록으로 다시 확인한다.
