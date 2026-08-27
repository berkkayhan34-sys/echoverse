<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Katkı rehberi

Katkı göndermeden önce [`AGENTS.md`](../AGENTS.md), [mimari](../DOCS/architecture.md),
[güvenlik](../DOCS/security-policy.md) ve [test politikasını](../DOCS/testing-policy.md)
okuyun.

## Değişiklik kapsamı

Dokümantasyon temeli tamamlanana kadar yalnızca dokümantasyon, yönetişim,
metadata ve sürüm doğrulama değişiklikleri yapılır. Runtime, protokol,
persistence veya deployment davranışı değişiklikleri ayrı bir karar kaydı ve
onay gerektirir.

## Pull request kontrol listesi

- Değişiklik kapsamı ve etkilenen source-of-truth dosyaları açıklandı.
- İlgili test, metadata, link, YAML/JSON ve REUSE kontrolleri çalıştırıldı.
- Secret, kişisel veri, generated output ve ilgisiz dosya eklenmedi.
- Güvenlik etkisi ve ertelenen runtime işleri yazıldı.
- README, karar, roadmap ve release belgeleri tutarlı.

Focused branch adlandırması için `docs/<topic>`, `fix/<topic>`,
`feature/<topic>` kalıplarını kullanın. Commit/push işlemi sahibi tarafından
ayrıca onaylanmadıkça agent oturumunda yapılmaz.

EchoVerse public release hazırlığına kadar tek-maintainer reposudur; ikinci
reviewer zorunluluğu yoktur. Public release öncesinde CODEOWNERS ve zorunlu
reviewer politikası [ADR-0007](../DOCS/decisions/0007-governance-activation.md)
uyarınca etkinleştirilmelidir. Public-release süreci için
[governance runbook](../DOCS/governance.md) uygulanır.
