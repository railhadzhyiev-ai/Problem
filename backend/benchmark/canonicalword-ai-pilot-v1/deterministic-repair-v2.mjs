import {repairV2} from './replay-v2.mjs';import {stagingSenseId,validateStagingV2} from './staging-v2.mjs';
export function deterministicRepair(raw,seed){
 const card=structuredClone(raw),changes=[];
 const w=card.word;
 // Recover split object serialization only when every group starts with exactly one nonempty gloss.
 if(Array.isArray(w.senses)&&w.senses.some(s=>!s.german_gloss)){
  const groups=[];let ok=true;
  for(const s of w.senses){if(typeof s.german_gloss==='string'&&s.german_gloss.trim())groups.push({...s});else if(groups.length){const g=groups.at(-1);for(const[k,v]of Object.entries(s)){if(k in g&&JSON.stringify(g[k])!==JSON.stringify(v))ok=false;else g[k]=v;}}else ok=false;}
  if(ok&&groups.length>0&&groups.length<=8){changes.push({path:'word.senses',operation:'COALESCE_DISJOINT_SERIALIZATION_FRAGMENTS',original:w.senses,value:groups});w.senses=groups;}
 }
 if(Array.isArray(w.senses)&&w.senses.length<=8&&w.senses.every(s=>typeof s.german_gloss==='string'&&s.german_gloss.trim())){
  for(const[sIndex,s]of w.senses.entries())if(!Object.hasOwn(s,'sense_id')){s.sense_id=stagingSenseId(seed.word.word_id,sIndex+1);changes.push({path:`word.senses[${sIndex}].sense_id`,operation:'RESTORE_ORDERED_STAGING_ID',value:s.sense_id});}
 }
 const repaired=repairV2(card,seed);changes.push(...repaired.changes);
 // Reuse an already generated translation only for the exact same German sentence and locale.
 // No sense reassignment or new translation. Ambiguous existing translations are never copied.
 const c=repaired.card,maps=new Map();
 function observe(locale,sentence,translation){if(typeof sentence!=='string'||typeof translation!=='string'||!translation.trim())return;const key=locale+'\n'+sentence;if(!maps.has(key))maps.set(key,new Set());maps.get(key).add(translation);}
 for(const l of card.localizations??[]){const s=card.word.senses.find(s=>s.sense_id===l.sense_id);const a=l.example_translations;
  if(!Array.isArray(a))continue;const examples=a.length===card.word.german_examples.length?card.word.german_examples:Array.isArray(s?.examples)&&s.examples.length===a.length?s.examples:null;
  if(examples)examples.forEach((x,i)=>observe(l.locale,x,a[i]));
 }
 for(const[i,l]of(c.localizations??[]).entries())if(Array.isArray(l.example_translations)&&l.example_translations.length!==c.word.german_examples.length){
  const translations=c.word.german_examples.map(e=>maps.get(l.locale+'\n'+e));
  if(translations.every(s=>s?.size===1)){const old=l.example_translations;l.example_translations=translations.map(s=>[...s][0]);changes.push({path:`localizations[${i}].example_translations`,operation:'REUSE_EXACT_SENTENCE_LOCALE_TRANSLATIONS',original:old,value:l.example_translations});}
 }
 let error=null;try{validateStagingV2(c,seed);}catch(e){error=e.message;}
 return{card:c,changes,error};
}
