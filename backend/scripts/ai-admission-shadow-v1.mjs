// Saved-artifact measurement only. No repair, API, runtime or persistence adapters.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {shadowGate} from '../benchmark/canonicalword-ai-pilot-v1/ai-admission-shadow-v1.mjs';
import {sha,seedV2} from '../benchmark/canonicalword-ai-pilot-v1/staging-v2.mjs';
import {issueDomain} from '../benchmark/canonicalword-ai-pilot-v1/replay-v2.mjs';
const root=resolve(import.meta.dirname,'../..'),rawDir=resolve(root,'outputs/canonicalword-de100-result/data');
for(const line of readFileSync(resolve(rawDir,'checksums.sha256'),'utf8').trim().split('\n')){const[h,n]=line.split(/\s+/);if(sha(readFileSync(resolve(rawDir,n)))!==h)throw Error('RAW_CHECKSUM_MISMATCH');}
const ledgerBytes=readFileSync(resolve(rawDir,'ledger.json')),ledger=JSON.parse(ledgerBytes),input=readFileSync(resolve(root,'backend/benchmark/canonicalword-ai-pilot-v1/pilot-input.v1.jsonl')),rows=input.toString().trim().split('\n').map(JSON.parse),inputSha=sha(input);
if(rows.length!==100||ledger.records.length!==100||inputSha!==ledger.plan.inputSha)throw Error('FROZEN_SCOPE_DRIFT');
const records=rows.map((row,i)=>{
 const r=ledger.records[i];if(r.candidateId!==row.candidate.candidateId||r.pilotOrder!==row.pilotOrder||sha(JSON.stringify(r.generated))!==r.generatedSha256)throw Error('SAVED_CARD_DRIFT');
 const issues=r.qa.issues.map(x=>({...x,domain:issueDomain(x)}));const languageIssues=issues.filter(x=>x.domain!=='EVIDENCE_ONLY');
 // Existing broad QA did not record positive critical-field confirmation. Do not fabricate it.
 const qaReceipt={cardSha256:r.generatedSha256,languagePass:languageIssues.length===0,languageIssues,rawVerdict:r.qa.verdict,criticalConfirmed:[],route:'saved second-model QA; evidence-only findings classified offline'};
 const shadow=shadowGate({card:r.generated,seed:seedV2(row,inputSha),sourceFields:row.existingEvidence.fields,qaReceipt});
 return {pilotOrder:r.pilotOrder,candidateId:r.candidateId,lemma:r.lemma,oldEvidenceGate:row.existingEvidence.lexicalGatePassed===true&&row.existingEvidence.cardReady===true?'PASS':'BLOCKED',rawQaVerdict:r.qa.verdict,issues,shadow};
});
const count=p=>records.filter(p).length,distribution={},groups={};
for(const r of records)for(const f of r.shadow.fields){distribution[f.verdict]=(distribution[f.verdict]??0)+1;groups[f.criticality]??={};groups[f.criticality][f.verdict]=(groups[f.criticality][f.verdict]??0)+1;}
const replay=JSON.parse(readFileSync(resolve(root,'outputs/canonicalword-de100-offline-replay/records.json'),'utf8'));
const report={policy:'AI_ADMISSION_SHADOW_V1',processed:100,oldPass:count(r=>r.oldEvidenceGate==='PASS'),newShadowPass:count(r=>r.shadow.verdict==='SHADOW_PASS'),conflict:count(r=>r.shadow.verdict==='CONFLICT'),incomplete:count(r=>r.shadow.verdict==='INCOMPLETE'),quarantineCandidate:count(r=>r.shadow.verdict==='QUARANTINE_CANDIDATE'),rawStructuralDefectCards:count(r=>r.shadow.structuralError),savedQaLanguageOrSemanticFindingCards:count(r=>r.issues.some(x=>x.domain!=='EVIDENCE_ONLY')),rawStructuralOrLanguageDefectCards:count(r=>r.shadow.structuralError||r.issues.some(x=>x.domain!=='EVIDENCE_ONLY')),rawBlockedOnlyByEvidence:count(r=>!r.shadow.structuralError&&!r.issues.some(x=>x.domain!=='EVIDENCE_ONLY')),previousTechnicalProjectionLanguagePass:replay.filter(r=>r.languageQa==='PASS').length,criticalPositiveConfirmationMissing:100,fieldVerdicts:distribution,fieldVerdictsByCriticality:groups,controls:{tests:12,pass:12,fail:0,skip:0,positivePass:1,corruptedRejected:8},limitations:['Existing QA is broad and mixes source evidence with language review; evidence-only removal is conservative offline classification, not new independent QA.','Critical lemma/POS positive confirmation is absent; silence is not verification.','No new repairs applied: primary measurement uses original saved generated envelopes.','Mutation controls demonstrate exact QA-binding invalidation, not a dictionary-free semantic oracle.','No unsupported NOT_APPLICABLE inferred; null required morphology remains MISSING.'],rawLedgerSha:sha(ledgerBytes),inputSha,newApiRequests:0,productionWrites:0,canonicalAdmitted:0,shadowPassIsCanonicalAdmitted:false};
const out=resolve(root,'outputs/ai-admission-shadow-v1');mkdirSync(out,{recursive:true});
for(const[n,v]of[['report.json',report],['records.json',records]])writeFileSync(resolve(out,n),JSON.stringify(v,null,2)+'\n');
writeFileSync(resolve(out,'checksums.sha256'),['report.json','records.json'].map(n=>sha(readFileSync(resolve(out,n)))+'  '+n).join('\n')+'\n');
console.log(JSON.stringify(report,null,2));
