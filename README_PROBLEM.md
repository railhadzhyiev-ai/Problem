# DE word-pipeline diagnostic snapshot

Status: **INCOMPLETE — original saved output and measured reports have not yet been imported.**

This repository is a frozen diagnostic copy of source commit `bc4a3da6045daa3314f6c02fb0b955dfd41b570c`, branch `codex/canonicalword-wire-v2-ai-pilot-v1`. The source repository was only read. Per-file source commit, last-change commit and Git blob SHA are recorded in [PROVENANCE.json](PROVENANCE.json).

## Problem

Why do AI-generated candidates fail to reach verified/admission state after wire-contract v2 generation, deterministic repair and separate AI QA?

The existing shadow policy requires explicit positive critical-field confirmation and QA bound to the exact card hash. Its saved-QA adapter supplies an empty `criticalConfirmed` list; it cannot infer confirmation from absence of a complaint. The broad QA also mixes evidence findings with linguistic findings. Frozen corpus/NLP selection does not constitute independent lexical verification. Deterministic structural repair cannot manufacture evidence or resolve semantic correctness. `SHADOW_PASS != CANONICAL_ADMITTED`; the canonical identity contract rejects staging identifiers.

These are findings from the actual code and documentation, not a claim that the unavailable measured reports were inspected.

## Current evidence and metrics

| Item | Verified state |
| --- | --- |
| Frozen DE input | 100 rows; original bytes and checksums included |
| Latest relevant code | `bc4a3da6045daa3314f6c02fb0b955dfd41b570c`, 2026-10-07 |
| Latest completed original generation | Run `37546161114`; producing commit `2999476c9fdc2b5a3364d90c73a6dde643368f07` |
| Latest field-repair run observed | Run `37550962140`; still in progress during preparation |
| Generation, QA, shadow PASS/conflict/incomplete counts | Not measured here: original ledger is not yet imported |
| Snapshot model API calls | 0 |

The original generation artifact `11451059770` has archive SHA-256 `ce732dacfac378620dad28a25f1c86e1d90ec8e83d41d94089dacbda76e48e99`.
[ARTIFACTS_REQUIRED.json](ARTIFACTS_REQUIRED.json) records original run/artifact/commit provenance and the missing output paths. Artifacts are not Git-tracked files; their producing workflow commit must not be presented as a fabricated per-file commit.

## Included / pending

Included: actual wire-contract v2, its direct model dependencies, existing staging/shadow validators, repair modules, four existing control-test files, frozen 100 DE input/lock/checksums, three offline replay/report scripts and their current documentation.

Pending: byte-exact original generation/QA ledger and report, deterministic repaired projection, REPAIR_PLAN, measured QA/shadow reports, and the latest completed field-repair receipts. A script that can produce an artifact is not represented as the artifact itself.

The source lock predates the actual generation run and retains its historical zero-generation counters unchanged. Do not interpret those lock counters as current generation metrics.

No secrets, .env, API keys, production credentials, raw corpus, unrelated runtime/UI/backend files or live API runner are included.

## Offline reproduction

Prerequisites: Node.js 24, Python 3, POSIX shell. No package install, key, database, provider SDK or network access is needed for validators.

```sh
python3 verify_snapshot.py
node --test backend/test/canonicalword-replay-v2.test.mjs backend/test/deterministic-repair-v2.test.mjs backend/test/ai-admission-shadow-v1.test.mjs backend/test/field-repair-v1.test.mjs
```

Once the original artifact has been imported into `outputs/canonicalword-de100-result/data/` and verified against its archive/member hashes, reproduce the reports in a disposable copy of this checkout:

```sh
node backend/scripts/canonicalword-wire-v2-offline-replay.mjs
node backend/scripts/canonicalword-repair-plan-v1.mjs
node backend/scripts/ai-admission-shadow-v1.mjs
```

These commands use saved data only and write reports under `outputs/`; do not run them in the preserved snapshot checkout. The tests verify binding, scope and refusal controls, not general linguistic correctness. Dart contract files are included for inspection; Node controls do not claim a Flutter/Dart validation run.

## Preservation

[SNAPSHOT.sha256](SNAPSHOT.sha256) and `verify_snapshot.py` detect changes. This is a read-only snapshot by convention, not repository-level permission enforcement. No automatic update, deployment, canonical admission or source-pipeline modification is provided.
