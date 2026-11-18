.DEFAULT_GOAL := help
.PHONY: help doctor up down status seed seed-release release-fixtures attack attack-undo scope-cache-clear collector-log collector-clear markers grype-db sbom ntia-check triage-check vex-lint pack-matrix vendor vendor-check release-local release-compare deploy verify-offline dt-up dt-down dt-status dt-key dt-upload dt-report dt-new-vuln pr-gate-local maven-up maven-down

help:
	@printf 'make doctor | up | down | status | seed | attack A=<이름> | collector-log | collector-clear | markers\n'

doctor:
	@sh tools/doctor.sh

up:
	@mkdir -p .lab/markers
	@docker compose up -d --wait --force-recreate verdaccio-public verdaccio-internal collector
	@$(MAKE) seed
	@printf '준비: http://127.0.0.1:4873/ http://127.0.0.1:4874/ http://127.0.0.1:4880/\n'

down:
	@docker compose down

status:
	@docker compose ps

seed:
	@node tools/seed.mjs

seed-release:
	@node tools/seed_release.mjs

release-fixtures:
	@node tools/make_release_fixtures.mjs

attack:
	@if [ '$(A)' = swap ]; then docker compose exec -T verdaccio-internal node /work/tools/swap_tarball.mjs swap; elif [ '$(A)' = maven-confusion ]; then node tools/maven_fixture.mjs confusion; elif [ '$(A)' = maven-swap ]; then node tools/maven_fixture.mjs swap; else node tools/attack.mjs '$(A)'; fi

attack-undo:
	@if [ '$(A)' = swap ]; then docker compose exec -T verdaccio-internal node /work/tools/swap_tarball.mjs undo; elif [ '$(A)' = maven-confusion ]; then node tools/maven_fixture.mjs confusion-undo; elif [ '$(A)' = maven-swap ]; then node tools/maven_fixture.mjs swap-undo; else printf '지원하지 않는 복구 대상: %s\n' '$(A)'; exit 2; fi

scope-cache-clear:
	@docker compose exec -T verdaccio-internal node /work/tools/scope_cache_clear.mjs
	@docker compose restart verdaccio-internal

collector-log:
	@if [ -s .lab/collector.log ]; then cat .lab/collector.log; else printf '수집 기록 없음\n'; fi

collector-clear:
	@mkdir -p .lab
	@: > .lab/collector.log

markers:
	@find .lab/markers -type f -maxdepth 1 -print 2>/dev/null || true

grype-db:
	@if [ ! -f .lab/grype-db/6/vulnerability.db ]; then ./bin/grype db update; fi
	@./bin/grype db status

sbom:
	@v=$$(node -p "require('./parts-api/package.json').version"); ./bin/syft scan dir:parts-api --source-name parts-api --source-version "$$v" -o cyclonedx-json=parts-api/sbom/parts-api.cdx.json -o spdx-json=parts-api/sbom/parts-api.spdx.json -o syft-json=parts-api/sbom/parts-api.syft.json

ntia-check:
	@node tools/ntia_check.mjs '$(SBOM)'

triage-check:
	@node tools/triage_check.mjs

vex-lint:
	@node tools/vex_lint.mjs

pack-matrix:
	@node tools/pack_matrix.mjs

vendor:
	@node tools/vendor.mjs

vendor-check:
	@node tools/vendor_check.mjs

release-local:
	@node tools/release_local.mjs '$(V)'

release-compare:
	@node tools/compare_release_sbom.mjs '$(V)'

deploy:
	@sh parts-api/scripts/deploy.sh '$(TGZ)' '$(TAG)'

verify-offline:
	@sh tools/verify_offline.sh '$(TGZ)' '$(BUNDLE)' '$(ROOT)'

dt-up:
	@docker compose --profile dt up -d dt-apiserver dt-frontend collector
	@node tools/wait_http.mjs http://127.0.0.1:8181/api/version 360
	@printf 'Dependency-Track: http://127.0.0.1:8180/\n'

dt-down:
	@docker compose --profile dt stop dt-frontend dt-apiserver

dt-status:
	@docker compose --profile dt ps dt-apiserver dt-frontend collector

dt-key:
	@if [ -s .lab/dt-api-key ]; then printf '✓ Dependency-Track API 키 준비\n'; else printf '✗ 관리 화면에서 팀 API 키를 만들어 .lab/dt-api-key에 저장하세요.\n'; exit 1; fi

dt-upload:
	@node tools/dt_upload.mjs '$(V)' '$(SBOM)'

dt-report:
	@node tools/dt_report.mjs

dt-new-vuln:
	@node tools/dt_new_vuln.mjs

pr-gate-local:
	@node tools/pr_gate_local.mjs '$(BASE)' '$(HEAD)'

maven-up:
	@node tools/maven_fixture.mjs seed
	@docker compose --profile maven up -d --wait maven-public maven-internal
	@printf 'Maven 역할 저장소: http://127.0.0.1:8082/ · http://127.0.0.1:8081/\n'

maven-down:
	@docker compose --profile maven stop maven-public maven-internal

