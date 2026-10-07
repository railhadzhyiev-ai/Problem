# AI_ADMISSION_SHADOW_V1 — offline experiment

Shadow verdicts are sidecar artifacts, never CanonicalWord values or admission status. Wire-contract v2, staging namespaces, canonical boundaries and source-only EVIDENCE_GATE are unchanged.

CRITICAL: language, lemma, POS, staged word/sense and localization identities. Zero tolerance; positive source or separately recorded QA confirmation required. Frozen input alone supplies selection context, not lexical truth. Absence of a QA complaint is not critical-field confirmation.

REQUIRED: applicable morphology, senses/glosses and RU/UK/AZ translations. GENERATED_CONTENT: examples and explanations, checked against sense relationships. OPTIONAL: IPA, CEFR and absent relations; absence is nonblocking. Only SOURCE_VERIFIED, AI_VERIFIED or MIXED_VERIFIED satisfies required fields. Conflicts and missing values block. Unsupported N/A is not inferred.

QA receipt must bind to the exact card SHA. Any mutation invalidates that receipt. Tests use a known fixture oracle, not a new provider call. These controls verify binding and refusal, not general linguistic accuracy.

The saved second-model QA reports were evidence-contaminated. Offline classification retains mixed findings. It cannot invent positive critical-field confirmations. Primary comparison uses original saved 100 envelopes, without applying further repair. The previous technical projection is mentioned separately.

Run controls first: `node --test backend/test/ai-admission-shadow-v1.test.mjs`; only after PASS run `node backend/scripts/ai-admission-shadow-v1.mjs` with existing immutable artifacts under `outputs/canonicalword-de100-result/data`. Outputs include per-card reasons and per-field verdicts, checksums and source hashes. No API credentials, DB, runtime or production dependencies.

SHADOW_PASS != CANONICAL_ADMITTED. No field is promoted into the current admission policy by this experiment.
