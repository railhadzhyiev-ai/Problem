// SHADOW ONLY. Does not export a canonical card, change admission, or persist to a DB.
import {sha,validateStagingV2} from './staging-v2.mjs';
export const POLICY='AI_ADMISSION_SHADOW_V1';
const accepted=new Set(['SOURCE_VERIFIED','VALIDATED','ACCEPTED','LICENSED_SOURCE_ACCEPT']);
export function shadowGate({card,seed,sourceFields=[],qaReceipt}){
 const reasons=[],fields=[];let structuralError=null;
 try{validateStagingV2(card,seed);}catch(e){structuralError=e.message;reasons.push({code:'STRUCTURAL_DEFECT',detail:e.message});}
 const bound=qaReceipt?.cardSha256===sha(JSON.stringify(card));
 const qaOk=bound&&!structuralError&&qaReceipt.languagePass===true;
 if(!bound)reasons.push({code:'QA_NOT_BOUND_TO_EXACT_CARD'});
 const languageIssues=qaReceipt?.languageIssues??[];
 if(languageIssues.length)reasons.push({code:'LANGUAGE_SEMANTIC_FINDINGS',issues:languageIssues});
 function field(path,criticality,value,sourceName=path,confirmation=true){
  const source=sourceFields.find(f=>f.field===sourceName&&accepted.has(f.status)&&f.value!=null&&JSON.stringify(f.value)===JSON.stringify(value));
  const missing=value==null||value===''||(Array.isArray(value)&&!value.length);
  let verdict=missing?'MISSING':source?'SOURCE_VERIFIED':qaOk&&confirmation?'AI_VERIFIED':'AI_GENERATED';
  if(source&&qaOk&&confirmation)verdict='MIXED_VERIFIED';
  const relevant=languageIssues.filter(i=>i.field===path||i.field==='*');
  if(relevant.length)verdict='CONFLICT';
  const satisfied=criticality==='OPTIONAL'||['SOURCE_VERIFIED','AI_VERIFIED','MIXED_VERIFIED'].includes(verdict);
  fields.push({path,criticality,verdict,satisfied,sourceReference:source?.provenance??null});
  if(!satisfied&&criticality!=='OPTIONAL')reasons.push({code:missing?'MISSING_REQUIRED':'UNVERIFIED_OR_CONFLICT',field:path,verdict});
 }
 const w=card.word??{};
 field('targetLanguage','CRITICAL',w.target_language,'targetLanguage',qaReceipt?.criticalConfirmed?.includes('targetLanguage'));
 field('lemma','CRITICAL',w.lemma,'lemma',qaReceipt?.criticalConfirmed?.includes('lemma'));
 field('POS','CRITICAL',w.part_of_speech,'partOfSpeech',qaReceipt?.criticalConfirmed?.includes('POS'));
 field('wordIdentity','CRITICAL',w.word_id,'wordIdentity',!structuralError&&bound);
 for(const [i,s] of (w.senses??[]).entries()){
  field(`senses[${i}].identity`,'CRITICAL',s.sense_id,'senseIdentity',!structuralError&&bound);
  field(`senses[${i}].gloss`,'REQUIRED',s.german_gloss,'definition');
 }
 if(!w.senses?.length)field('senses','REQUIRED',null);
 if(w.part_of_speech==='NOUN'){
  field('article','REQUIRED',w.article);
  // Null plural needs a supported N/A determination; never assume singular-only.
  field('plural','REQUIRED',w.plural,'nominativePlural');
 }else if(['VERB','AUX'].includes(w.part_of_speech)){
  for(const k of ['presentIch','presentDu','presentErSieEs','pastParticiple'])field('grammar.'+k,'REQUIRED',w.grammar?.[k]);
 }
 for(const [i,l] of (card.localizations??[]).entries()){
  field(`localizations[${i}].identity`,'CRITICAL',l.word_id===w.word_id&&w.senses?.some(s=>s.sense_id===l.sense_id)?l.sense_id+'/'+l.locale:null,'localizationIdentity',!structuralError&&bound);
  field(`localizations[${i}].translation`,'REQUIRED',l.translation,'localization'+l.locale[0].toUpperCase()+l.locale.slice(1));
  field(`localizations[${i}].examples`,'GENERATED_CONTENT',l.example_translations);
  field(`localizations[${i}].explanation`,'GENERATED_CONTENT',l.explanation);
 }
 field('examples','GENERATED_CONTENT',w.german_examples,'examples');field('cefr','OPTIONAL',w.cefr);field('ipa','OPTIONAL',w.ipa);field('relations','OPTIONAL',null);
 const conflict=bound&&qaReceipt.rawVerdict==='CONFLICT'&&languageIssues.length>0;
 const incomplete=structuralError||fields.some(f=>f.criticality!=='OPTIONAL'&&f.verdict==='MISSING');
 const verdict=conflict?'CONFLICT':incomplete?'INCOMPLETE':reasons.length?'QUARANTINE_CANDIDATE':'SHADOW_PASS';
 return {policy:POLICY,verdict,fields,reasons,structuralError,canonicalAdmitted:false};
}
