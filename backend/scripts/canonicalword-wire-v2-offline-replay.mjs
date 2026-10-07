import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {seedV2,sha,validateStagingV2} from '../benchmark/canonicalword-ai-pilot-v1/staging-v2.mjs';
import {repairV2,issueDomain} from '../benchmark/canonicalword-ai-pilot-v1/replay-v2.mjs';
const root=resolve(import.meta.dirname,'../..'),dir=resolve(root,'outputs/canonicalword-de100-result/data');
for(const line of readFileSync(resolve(dir,'checksums.sha256'),'utf8').trim().split('\n')){const [h,n]=line.trim().split(/\s+/);if(sha(readFileSync(resolve(dir,n)))!==h)throw Error('CHECKSUM_MISMATCH');}
const ledger=JSON.parse(readFileSync(resolve(dir,'ledger.json'),'utf8')),input=readFileSync(resolve(root,'backend/benchmark/canonicalword-ai-pilot-v1/pilot-input.v1.jsonl'));
const inputSha=sha(input),rows=input.toString().trim().split('\n').map(JSON.parse);
if(rows.length!==100||ledger.records.length!==100||inputSha!==ledger.plan.inputSha)throw Error('FROZEN_SCOPE_DRIFT');
const records=ledger.records.map((r,i)=>{
 const row=rows[i];if(r.candidateId!==row.candidate.candidateId||r.pilotOrder!==row.pilotOrder)throw Error('FROZEN_ORDER_DRIFT');
 const seed=seedV2(row,inputSha);let before=null;try{validateStagingV2(r.generated,seed);}catch(e){before=e.message;}
 const repaired=repairV2(r.generated,seed),issues=r.qa.issues.map((x,index)=>({...x,index,domain:issueDomain(x)}));
 const languageIssues=issues.filter(x=>x.domain!=='EVIDENCE_ONLY');
 // No new linguistic judgement: replay existing independent model findings, conservatively retain mixed findings.
 const languageQa=languageIssues.length?'QUARANTINE':repaired.error?'QUARANTINE':'PASS';
 const ev=row.existingEvidence;const evidenceGate=ev.lexicalGatePassed===true&&ev.cardReady===true?'PASS':'BLOCKED';
 return {pilotOrder:r.pilotOrder,candidateId:r.candidateId,lemma:r.lemma,beforeTechnicalError:before,afterTechnicalError:repaired.error,repairs:repaired.changes,card:repaired.card,rawQa:r.qa,issues,languageQa,evidenceGate,admissionReady:languageQa==='PASS'&&evidenceGate==='PASS',canonicalAdmitted:false};
});
const count=pred=>records.filter(pred).length;
const report={processed:100,newApiRequests:0,technicalErrorCardsBefore:count(r=>r.beforeTechnicalError),technicalErrorCardsAfter:count(r=>r.afterTechnicalError),technicalErrorCardsResolved:count(r=>r.beforeTechnicalError&&!r.afterTechnicalError),repairOperations:records.reduce((n,r)=>n+r.repairs.length,0),languageQaPass:count(r=>r.languageQa==='PASS'),languageQaQuarantine:count(r=>r.languageQa==='QUARANTINE'),evidenceGatePass:count(r=>r.evidenceGate==='PASS'),admissionReady:count(r=>r.admissionReady),method:'Offline replay of saved QA; evidence-only findings separated; mixed findings retained; no new linguistic model assessment',inputSha,rawLedgerSha:sha(readFileSync(resolve(dir,'ledger.json')))};
const out=resolve(root,'outputs/canonicalword-de100-offline-replay');mkdirSync(out,{recursive:true});
for(const [name,data] of [['records.json',records],['report.json',report]])writeFileSync(resolve(out,name),JSON.stringify(data,null,2)+'\n');
writeFileSync(resolve(out,'checksums.sha256'),['records.json','report.json'].map(n=>sha(readFileSync(resolve(out,n)))+'  '+n).join('\n')+'\n');console.log(JSON.stringify(report,null,2));
