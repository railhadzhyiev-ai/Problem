import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import{resolve}from'node:path';
import{seedV2,sha,validateStagingV2}from'../benchmark/canonicalword-ai-pilot-v1/staging-v2.mjs';import{deterministicRepair}from'../benchmark/canonicalword-ai-pilot-v1/deterministic-repair-v2.mjs';import{issueDomain}from'../benchmark/canonicalword-ai-pilot-v1/replay-v2.mjs';
const root=resolve(import.meta.dirname,'../..'),rawdir=resolve(root,'outputs/canonicalword-de100-result/data'),raw=readFileSync(resolve(rawdir,'ledger.json')),ledger=JSON.parse(raw),input=readFileSync(resolve(root,'backend/benchmark/canonicalword-ai-pilot-v1/pilot-input.v1.jsonl')),rows=input.toString().trim().split('\n').map(JSON.parse),inputSha=sha(input);
for(const line of readFileSync(resolve(rawdir,'checksums.sha256'),'utf8').trim().split('\n')){const[h,n]=line.split(/\s+/);if(sha(readFileSync(resolve(rawdir,n)))!==h)throw Error('CHECKSUM_DRIFT');}
if(rows.length!==100||ledger.records.length!==100||inputSha!==ledger.plan.inputSha)throw Error('INPUT_DRIFT');
const records=[],provenance=[];
for(const[rowIndex,row]of rows.entries()){
 const r=ledger.records[rowIndex];if(r.candidateId!==row.candidate.candidateId||sha(JSON.stringify(r.generated))!==r.generatedSha256)throw Error('ROW_DRIFT');
 const repaired=deterministicRepair(r.generated,seedV2(row,inputSha)),c=repaired.card,w=c.word,targets=new Map(),holds=[];
 function add(path,category,reason,kind='QA_REPAIR_OR_REVIEW'){const key=category+'/'+path;if(!targets.has(key))targets.set(key,{path,category,kind,reasons:[]});const t=targets.get(key);if(kind==='CONFIRMED_MISSING')t.kind=kind;t.reasons.push(reason);}
 for(const[sIndex,s]of w.senses.entries()){
  if(!s.german_gloss?.trim())add(`word.senses[${sIndex}].german_gloss`,'sense','Missing gloss','CONFIRMED_MISSING');
  if(!s.sense_id)holds.push({path:`word.senses[${sIndex}].sense_id`,reason:'Unresolved mechanical identity; do not infer sense'});
  for(const locale of['ru','uk','az']){const l=c.localizations.find(x=>x.sense_id===s.sense_id&&x.locale===locale),path=`localizations[sense=${s.sense_id},locale=${locale}]`;
   if(!l?.translation?.trim())add(path+'.translation',locale,'Missing sense-locale translation','CONFIRMED_MISSING');
   if(!l?.explanation?.trim())add(path+'.explanation',locale,'Missing learner explanation','CONFIRMED_MISSING');
   if(!l||l.example_translations.length!==w.german_examples.length||l.example_translations.some(x=>!x.trim()))add(path+'.example_translations','examples','Missing or incomplete exact sentence translations','CONFIRMED_MISSING');
  }
 }
 for(const l of c.localizations)if(!w.senses.some(s=>s.sense_id===l.sense_id)||l.word_id!==w.word_id)holds.push({path:'localizations.identity',reason:'Unbound localization identity; separate deterministic/identity review'});
 const morphology=w.part_of_speech==='NOUN'?['article','plural']:['VERB','AUX'].includes(w.part_of_speech)?['grammar.presentIch','grammar.presentDu','grammar.presentErSieEs','grammar.pastParticiple']:[];
 for(const p of morphology){const value=p.startsWith('grammar.')?w.grammar[p.slice(8)]:w[p];if(value==null||value==='')add('word.'+p,'DE morphology','Missing applicable candidate or supported N/A determination','CONFIRMED_MISSING');}
 for(const issue of r.qa.issues){if(issueDomain(issue)==='EVIDENCE_ONLY')continue;const f=issue.field.toLowerCase(),reason=issue.reason;
  if(/lemma|part_of_speech|\bpos\b|sense_id/.test(f)){holds.push({path:issue.field,reason});add(issue.field,'identity',reason,'IDENTITY_REVIEW_NO_AUTOMATIC_CHANGE');continue;}
  if(/grammar|article|plural/.test(f)){add(issue.field,'DE morphology',reason);continue;}
  if(/example/.test(f)){add(issue.field,'examples',reason);continue;}
  if(/sense/.test(f))for(const[i,s]of w.senses.entries())add(`word.senses[${i}].german_gloss`,'sense',reason);
  if(/localization/.test(f)){
   const only=f.match(/\b(ru|uk|az)\b/);for(const locale of only?[only[1]]:['ru','uk','az'])for(const l of c.localizations.filter(x=>x.locale===locale))add(`localizations[sense=${l.sense_id},locale=${locale}].translation`,locale,reason);
  }
  if(!/sense|localization/.test(f))add(issue.field,'sense',reason);
 }
 const evidence=row.existingEvidence.fields;
 provenance.push({candidateId:r.candidateId,lemma:w.lemma,POS:w.part_of_speech,sourceReference:row.candidate.sourceReference,frequency:row.candidate.resolvedFrequency,classification:'CORPUS_NLP_DERIVED_CANDIDATE_NOT_VERIFIED',lemmaOrigin:'Frozen FILTER V2.2 from local Leipzig corpus + spaCy; no per-row manual dictionary confirmation',posOrigin:'Frozen FILTER V2.2 spaCy-derived POS; exact model/version not present in frozen receipt',lemmaEvidence:evidence.filter(f=>f.field==='lemma'),posEvidence:evidence.filter(f=>f.field==='partOfSpeech'),existingEvidenceFamily:'Leipzig corpus + NLP selection, not independent lexical admission evidence',verified:false});
 records.push({pilotOrder:r.pilotOrder,candidateId:r.candidateId,lemma:r.lemma,card:c,structuralPass:!repaired.error,structuralError:repaired.error,deterministicRepairs:repaired.changes,repairTargets:[...targets.values()],identityHolds:holds,evidenceOnlyFindings:r.qa.issues.filter(x=>issueDomain(x)==='EVIDENCE_ONLY'),canonicalAdmitted:false});
}
const targets=records.flatMap(r=>r.repairTargets),breakdown={};for(const category of['DE morphology','sense','ru','uk','az','examples','identity']){const ts=targets.filter(t=>t.category===category);breakdown[category]={fields:ts.length,confirmedMissing:ts.filter(t=>t.kind==='CONFIRMED_MISSING').length,qaReviewTargets:ts.filter(t=>t.kind==='QA_REPAIR_OR_REVIEW').length,identityReview:ts.filter(t=>t.kind==='IDENTITY_REVIEW_NO_AUTOMATIC_CHANGE').length};}
const repairCards=records.filter(r=>r.repairTargets.some(t=>t.category!=='identity')).length;
const report={processed:100,structuralPass:records.filter(r=>r.structuralPass).length,structuralFail:records.filter(r=>!r.structuralPass).length,deterministicRepairOperations:records.reduce((n,r)=>n+r.deterministicRepairs.length,0),repairPlanFieldTargets:targets.length,confirmedMissingFields:targets.filter(t=>t.kind==='CONFIRMED_MISSING').length,qaReviewTargets:targets.filter(t=>t.kind==='QA_REPAIR_OR_REVIEW').length,identityReviewTargets:targets.filter(t=>t.kind==='IDENTITY_REVIEW_NO_AUTOMATIC_CHANGE').length,breakdown,semanticRepairCandidateCards:repairCards,forecast:{generationRepairCalls:repairCards,separateQaCalls:repairCards,total:repairCards*2,retries:0,basis:'Upper-bound one field-scoped repair request + one separate QA request per affected card; identity holds must be resolved before execution; not full generation'},lemmaPosSourceRows:100,lemmaPosIndependentlyVerified:0,newApiRequests:0,rawLedgerSha:sha(raw),inputSha,limitations:['Broad saved QA findings expand to review targets, not proof every expanded field is incorrect.','Missing optional values are untouched.','No new lexical or sense identity is approved.','Model version cannot be reconstructed from a corpus provenance label.','No admission gate or v2 schema changed.']};
const out=resolve(root,'outputs/canonicalword-repair-plan-v1');mkdirSync(out,{recursive:true});for(const[n,v]of[['REPAIR_PLAN.json',records],['lemma-pos-provenance.json',provenance],['report.json',report]])writeFileSync(resolve(out,n),JSON.stringify(v,null,2)+'\n');writeFileSync(resolve(out,'checksums.sha256'),['REPAIR_PLAN.json','lemma-pos-provenance.json','report.json'].map(n=>sha(readFileSync(resolve(out,n)))+'  '+n).join('\n')+'\n');console.log(JSON.stringify(report,null,2));
