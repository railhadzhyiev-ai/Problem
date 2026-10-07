# Bounded existing wire v2 AI pilot

Owner approved 100 frozen German candidates and the reserved `staging:ai-pilot:`
namespace on 2026-10-07. No new word contract, canonical admission or production
migration is introduced. Frozen input bytes and evidence are immutable.

Staging word IDs hash the complete frozen input SHA and existing candidate ID;
sense IDs append an ordinal to that staging ID. They are reproducible references
inside this run, not canonical lexical identities. `WordId`/`SenseId`, backend
card/lookup, sync and PostgreSQL membership persistence reject the namespace.
LearningCandidate V1 and its admission mapping remain unchanged.

Generation only supplies missing existing wire v2 fields. The assembler restores
frozen lemma, POS and source provenance. Frequency remains in existing provenance.
IPA and pronunciation hints are not generated. Source observations remain intact,
with source/corpus/historical AI classifications preserved; only validated facts
can seed populated values. New values are AI_GENERATED and have request/model/
prompt/usage provenance in the separate immutable output ledger.

Generation: gpt-5.6-luna. Separate QA: gpt-5.6-terra. At most 200 requests, zero
automatic retries, calculated cost cap USD 12. Cached input and cache writes are
metered when returned in usage. Cost is calculated usage, not an invoice or an
estimate substituted for missing usage. Provider/transport/budget failures stop
the run; no automatic redispatch of completed requests is allowed.

AI_VERIFIED is a candidate QA result, never canonical ACCEPTED. QA is AI review,
not independent human/source validation. The output is files only under
`backend/build/canonicalword-wire-v2-ai-pilot`; no database client is imported.

GitHub Secret belongs only to the execution step; no key retrieval, printing,
command argument, artifact, or repository storage. Main and app runtime are not
activated or deployed. The feature-branch workflow is manual and contents-read.
