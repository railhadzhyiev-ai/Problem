// Offline only: lossless raw ledger remains authoritative. No provider or DB imports.
import { stagingSenseId, validateStagingV2 } from './staging-v2.mjs';
const wordKeys=new Set(['word_id','lemma','part_of_speech','target_language','article','plural','cefr','ipa','german_examples','grammar','provenance','senses','lookup_forms']);
const localeKeys=new Set(['word_id','sense_id','locale','translation','pronunciation_hint','explanation','example_translations']);
export function repairV2(raw,seed){
 const card=structuredClone(raw),changes=[];
 function project(obj,keys,path){if(!obj||Array.isArray(obj)||typeof obj!=='object')return;for(const k of Object.keys(obj))if(!keys.has(k)){changes.push({path:path+'.'+k,operation:'EXCLUDE_EXTRA_FIELD',original:obj[k]});delete obj[k];}}
 project(card,new Set(['schemaVersion','word','localizations']),'$');project(card.word,wordKeys,'word');
 const aliases=new Map(),used=new Set();
 for(const [i,s] of (card.word?.senses??[]).entries()){
  project(s,new Set(['sense_id','german_gloss']),`word.senses[${i}]`);
  if(i>=8)continue;
  const old=s.sense_id,expected=stagingSenseId(seed.word.word_id,i+1);
  // Only syntactically staged IDs, unique exact ordinal references; never infer sense by spelling.
  const ordinal=typeof old==='string'&&old.startsWith('staging:ai-pilot:')?Number(old.match(/:sense:(\d+)$/)?.[1]):NaN;
  if(ordinal===i+1&&!used.has(old)){aliases.set(old,expected);used.add(old);if(old!==expected){s.sense_id=expected;changes.push({path:`word.senses[${i}].sense_id`,operation:'RESTORE_FROZEN_STAGING_ID',original:old,value:expected});}}
 }
 for(const [i,l] of (card.localizations??[]).entries()){
  project(l,localeKeys,`localizations[${i}]`);
  if(!Object.hasOwn(l,'word_id')){l.word_id=seed.word.word_id;changes.push({path:`localizations[${i}].word_id`,operation:'INJECT_FROZEN_WORD_ID',value:l.word_id});}
  if(aliases.has(l.sense_id)&&aliases.get(l.sense_id)!==l.sense_id){const old=l.sense_id;l.sense_id=aliases.get(old);changes.push({path:`localizations[${i}].sense_id`,operation:'RESTORE_EXACT_ALIAS',original:old,value:l.sense_id});}
 }
 let error=null;try{validateStagingV2(card,seed);}catch(e){error=e.message;}
 return {card,changes,error};
}
export function issueDomain(issue){
 const f=issue.field.toLowerCase(),r=issue.reason.toLowerCase();
 // Mixed evidence+language findings are retained as language blockers.
 const substantive=/overlap|empty string|lack.*example|no example translations|no aligned example|also have no|in addition|mismatch|not consistently|misalign|misassign|contradiction|conflat|narrower|overstat|not represented|only.*sense|only.*locale|gloss-less|structurally inconsistent|not clearly distinct|not clearly compatible|substantially|inflected form|not an exact|does not.*exempl|do not.*exempl|semantically uncertain|morphology.*absent|repeats translations|also occurs adverbially/;
 if(substantive.test(r))return 'LANGUAGE_OR_STRUCTURE';
 if(/sourceevidence|exactsourcesense/.test(f)||(/evidence|source|admit|provenance/.test(r)&&!/not natural|ungrammatical|incorrect|wrong/.test(r)))return 'EVIDENCE_ONLY';
 return 'LANGUAGE_OR_STRUCTURE';
}
