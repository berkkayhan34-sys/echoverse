# SPDX-FileCopyrightText: 2026 EchoVerse contributors
# SPDX-License-Identifier: GPL-3.0-only

.DEFAULT_GOAL := help

.PHONY: help version-check roadmap-check docs-check metadata-check ai-check ai-test \
	ai-server-test server-run server-health server-test web-build desktop-build \
	release-check release release-win release-mac-intel release-mac-arm64 \
	install-deps setup tooling-check format-check format lint reuse-check secret-scan \
	dependency-check coverage db-test work-init typecheck test e2e quality security-check

help:
	@node -e "console.log('make version-check      Verify VERSION and package mirrors'); console.log('make roadmap-check      Validate roadmap status and audit lifecycle'); console.log('make docs-check         Check documentation inventory and whitespace'); console.log('make ai-check           Safe AI/agent docs and metadata gate'); console.log('make ai-server-test     Health-check an already running local server'); console.log('make server-run         Start the local server in the foreground'); console.log('make install-deps       Install server/web/desktop dependencies'); console.log('make setup              Prepare dependencies and verify metadata'); console.log('make tooling-check      Verify Node.js 22 LTS'); console.log('make format-check      Verify Prettier formatting'); console.log('make lint              Run ESLint'); console.log('make reuse-check       Run REUSE metadata validation'); console.log('make secret-scan       Run Gitleaks secret scanning'); console.log('make dependency-check   Run npm dependency audit'); console.log('make coverage           Run Vitest with coverage'); console.log('make db-test            Run PostgreSQL migration tests'); console.log('make web-build          Build the web client'); console.log('make desktop-build     Build the desktop renderer'); console.log('make release-check      Validate release metadata only'); console.log('make release-win        Build the Windows installer'); console.log('make release-mac-intel  Build the macOS Intel artifacts'); console.log('make release-mac-arm64  Build the macOS Apple Silicon artifacts'); console.log('make release             Windows release alias'); console.log('make work-init          Create ignored work/.tmp directories')"

version-check:
	@node -e "const fs=require('fs'); const v=fs.readFileSync('VERSION','utf8').trim(); if(!/^\d+\.\d+\.\d+$$/.test(v)) throw new Error('Invalid VERSION: '+v); for(const p of ['package.json','apps/server/package.json','apps/web/package.json','apps/desktop/package.json']) { const j=JSON.parse(fs.readFileSync(p,'utf8')); if(j.version!==v) throw new Error(p+' version '+j.version+' does not match '+v); } console.log('Canonical version '+v+' verified')"

metadata-check: version-check
	@node -e "const fs=require('fs'); for(const p of ['package.json','apps/server/package.json','apps/web/package.json','apps/desktop/package.json','packages/contracts/package.json','packages/config/package.json','packages/client-core/package.json','packages/shared-ui/package.json']) JSON.parse(fs.readFileSync(p,'utf8')); console.log('Package metadata verified')"

roadmap-check:
	@node DOCS/tools/validate-roadmap.mjs

docs-check: roadmap-check
	@git diff --check
	@node -e "const fs=require('fs'); const required=['AGENTS.md','LICENSE','REUSE.toml','VERSION','README-TR.md','DOCS/README.md','DOCS/architecture.md','DOCS/security-policy.md','DOCS/testing-policy.md','DOCS/development.md','DOCS/release.md','DOCS/roadmap.md','DOCS/decisions/README.md','DOCS/historic/README.md','.github/CONTRIBUTING.md','.github/SECURITY.md','.github/CODEOWNERS']; for(const p of required) if(!fs.existsSync(p)) throw new Error('Missing documentation file: '+p); console.log('Documentation inventory verified')"

ai-check: metadata-check docs-check
	@node -e "console.log('AI-safe repository gate passed; no product daemon was started')"

ai-test: ai-check

typecheck:
	@npm run typecheck

test:
	@npm test

format-check:
	@npm run format:check

format:
	@npm run format

lint:
	@npm run lint

reuse-check:
	@if ! command -v reuse >/dev/null 2>&1; then echo "REUSE is required; install requirements-dev.txt or use the CI action"; exit 1; fi
	@npm run reuse:check

secret-scan:
	@if ! command -v gitleaks >/dev/null 2>&1; then echo "Gitleaks is required; install it or use the CI action"; exit 1; fi
	@npm run secret-scan

dependency-check:
	@npm run dependency:check

coverage:
	@npm run coverage

db-test:
	@npm run test:db

e2e:
	@npm run test:e2e

quality: ai-check tooling-check format-check lint reuse-check secret-scan dependency-check typecheck test coverage

security-check:
	@npm audit --omit=dev

tooling-check:
	@node -e "const major=Number(process.versions.node.split('.')[0]); if(major!==22) throw new Error('Node.js 22 LTS is required; found '+process.version); console.log('Node.js 22 LTS verified')"

install-deps:
	@npm ci

setup: version-check install-deps

server-run:
	@npm --workspace=@echoverse/server run dev

server-health:
	@node -e "const u=process.env.ECHO_SERVER_URL||'http://127.0.0.1:3001/health'; fetch(u).then(async r=>{if(!r.ok) throw new Error('HTTP '+r.status+' from '+u); const body=await r.text(); console.log('Server health OK: '+body)}).catch(e=>{console.error('Server health failed: '+e.message); process.exit(1)})"

ai-server-test: server-health

server-test: ai-server-test

web-build: metadata-check
	@npm --workspace=@echoverse/web run build

desktop-build: metadata-check
	@npm --workspace=@echoverse/desktop run build

release-check: metadata-check
	@node -e "const fs=require('fs'); const v=fs.readFileSync('VERSION','utf8').trim(); console.log('Release metadata ready for v'+v)"

release-win: release-check
	@npm --workspace=@echoverse/desktop run release:win

release-mac-intel: release-check
	@npm --workspace=@echoverse/desktop run release:mac:intel

release-mac-arm64: release-check
	@npm --workspace=@echoverse/desktop run release:mac:arm64

release: release-win

work-init:
	@node -e "const fs=require('fs'); for(const p of ['work','.tmp']) fs.mkdirSync(p,{recursive:true}); console.log('Created ignored work and .tmp directories')"
