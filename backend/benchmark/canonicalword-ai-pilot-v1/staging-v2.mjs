import { createHash } from 'node:crypto';

export const sha = value => createHash('sha256').update(value).digest('hex');
export const prefix = 'staging:ai-pilot:';
export function stagingWordId(inputSha, candidateId) {
  return `${prefix}${sha(`${inputSha}\n${candidateId}`).slice(0, 32)}`;
}
export function stagingSenseId(wordId, ordinal) {
  if (!wordId.startsWith(prefix) || !Number.isInteger(ordinal) || ordinal < 1 || ordinal > 8) throw new Error('invalid_staging_sense');
  return `${wordId}:sense:${ordinal}`;
}
const fields = new Set(['word_id', 'lemma', 'part_of_speech', 'target_language', 'article', 'plural', 'cefr', 'ipa', 'german_examples', 'grammar', 'provenance', 'senses', 'lookup_forms']);
const localeFields = new Set(['word_id', 'sense_id', 'locale', 'translation', 'pronunciation_hint', 'explanation', 'example_translations']);
const exact = (obj, keys) => { if (!obj || Array.isArray(obj) || typeof obj !== 'object' || Object.keys(obj).some(k => !keys.has(k))) throw new Error('wire_v2_extra_or_invalid_field'); };
export function validateStagingV2(card, seed) {
  exact(card, new Set(['schemaVersion', 'word', 'localizations']));
  if (card.schemaVersion !== 2) throw new Error('wire_version_changed');
  exact(card.word, fields);
  const w = card.word;
  for (const key of ['word_id', 'lemma', 'part_of_speech', 'target_language']) if (w[key] !== seed.word[key]) throw new Error('frozen_identity_changed');
  if (!w.word_id.startsWith(prefix) || !Array.isArray(w.senses) || w.senses.length < 1 || w.senses.length > 8) throw new Error('staging_senses_invalid');
  const senses = new Set();
  w.senses.forEach((s, i) => {
    exact(s, new Set(['sense_id', 'german_gloss']));
    if (s.sense_id !== stagingSenseId(w.word_id, i + 1) || typeof s.german_gloss !== 'string' || !s.german_gloss.trim()) throw new Error('staging_sense_identity_invalid');
    senses.add(s.sense_id);
  });
  if (!Array.isArray(w.german_examples) || !w.german_examples.every(x => typeof x === 'string' && x.trim()) || !Array.isArray(w.lookup_forms) || !w.lookup_forms.every(x => typeof x === 'string' && x.trim())) throw new Error('wire_list_invalid');
  if (!w.grammar || Array.isArray(w.grammar) || typeof w.grammar !== 'object' || !w.provenance || typeof w.provenance !== 'object') throw new Error('wire_map_invalid');
  for (const key of ['article', 'plural', 'cefr', 'ipa']) if (w[key] != null && (typeof w[key] !== 'string' || !w[key].trim())) throw new Error('wire_optional_invalid');
  if (w.cefr != null && !['A1','A2','B1','B2','C1','C2'].includes(w.cefr)) throw new Error('cefr_invalid');
  if (JSON.stringify(w.provenance) !== JSON.stringify(seed.word.provenance)) throw new Error('source_evidence_overwritten');
  for (const [key, value] of Object.entries(seed.word)) if (key !== 'provenance' && !['word_id','lemma','part_of_speech','target_language'].includes(key) && value != null && (!(Array.isArray(value)) || value.length) && (!(typeof value === 'object') || Array.isArray(value) || Object.keys(value).length)) {
    if (JSON.stringify(w[key]) !== JSON.stringify(value)) throw new Error('source_value_overwritten');
  }
  if (!Array.isArray(card.localizations)) throw new Error('localizations_invalid');
  const seen = new Set();
  for (const l of card.localizations) {
    exact(l, localeFields);
    if (l.word_id !== w.word_id || !senses.has(l.sense_id) || !['ru','uk','az'].includes(l.locale) || typeof l.translation !== 'string' || !l.translation.trim()) throw new Error('localization_identity_invalid');
    const key = `${l.sense_id}/${l.locale}`;
    if (seen.has(key)) throw new Error('duplicate_localization');
    seen.add(key);
    for (const key of ['pronunciation_hint', 'explanation']) if (l[key] != null && (typeof l[key] !== 'string' || !l[key].trim())) throw new Error('wire_optional_invalid');
    if (!Array.isArray(l.example_translations) || l.example_translations.length !== w.german_examples.length || !l.example_translations.every(x => typeof x === 'string')) throw new Error('example_alignment_invalid');
  }
  if (seen.size !== senses.size * 3) throw new Error('locale_coverage_incomplete');
  return card;
}
export function seedV2(row, inputSha) {
  const c = row.candidate;
  const word = { word_id: stagingWordId(inputSha, c.candidateId), lemma: c.lemma, part_of_speech: c.partOfSpeech, target_language: c.targetLanguage,
    article: null, plural: null, cefr: null, ipa: null, german_examples: [], grammar: {}, senses: [], lookup_forms: [],
    provenance: { source_ref: c.sourceReference.sourceId, revision: c.sourceReference.artifactSha256, frozen_input_sha256: inputSha,
      candidateId: c.candidateId, frequency: c.resolvedFrequency, sourceReference: c.sourceReference, existingEvidence: row.existingEvidence } };
  // Independent facts remain separately attributable; never promote corpus/AI observations.
  const mappings = { article: 'article', nominativePlural: 'plural', cefr: 'cefr', ipa: 'ipa', examples: 'german_examples' };
  for (const f of row.existingEvidence.fields) {
    if (['VALIDATED', 'SOURCE_VERIFIED', 'ACCEPTED', 'LICENSED_SOURCE_ACCEPT'].includes(f.status) && f.value != null && mappings[f.field]) word[mappings[f.field]] = f.value;
  }
  return { schemaVersion: 2, word, localizations: [] };
}
