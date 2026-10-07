import{sha}from'./staging-v2.mjs';
export function fieldScope(record){
 const textPresent=value=>typeof value==='string'&&value.trim().length>0;
 const card=record.card,w=card.word,allowed=new Map();
 const add=(path,category,before,missing,reason)=>{if(!allowed.has(path))allowed.set(path,{path,category,before:before??null,missing,reason});};
 for(const s of w.senses)for(const locale of['ru','uk','az']){
  const l=card.localizations.find(l=>l.sense_id===s.sense_id&&l.locale===locale),p=`locale/${s.sense_id}/${locale}`;
  for(const f of['translation','explanation'])if(!textPresent(l?.[f]))add(p+'/'+f,locale,l?.[f],true,'deterministic missing or malformed scalar');
  for(let i=0;i<w.german_examples.length;i++)if(!textPresent(l?.example_translations?.[i]))add(p+'/example_translations/'+i,'examples',l?.example_translations?.[i],true,'deterministic missing or malformed exact sentence translation');
 }
 for(const t of record.repairTargets){
  if(t.category==='identity'||t.kind==='CONFIRMED_MISSING')continue;
  const reason=t.reasons.join('\n');
  if(t.category==='sense')for(let i=0;i<w.senses.length;i++)add('sense/'+i+'/german_gloss','sense',w.senses[i].german_gloss,false,reason);
  if(['ru','uk','az'].includes(t.category))for(const l of card.localizations.filter(l=>l.locale===t.category&&w.senses.some(s=>s.sense_id===l.sense_id)))for(const f of['translation','explanation'])add(`locale/${l.sense_id}/${l.locale}/${f}`,l.locale,l[f],!textPresent(l[f]),reason);
  if(t.category==='DE morphology'){
   const exact=t.path.match(/(?:word\.)?grammar\.([A-Za-z]+)$/);
   for(const k of exact?[exact[1]]:Object.keys(w.grammar))add('grammar/'+k,'DE morphology',w.grammar[k],w.grammar[k]==null,reason);
   if(/article/.test(t.path))add('word/article','DE morphology',w.article,w.article==null,reason);
   if(/plural/.test(t.path))add('word/plural','DE morphology',w.plural,w.plural==null,reason);
  }
  if(t.category==='examples'){
   for(let i=0;i<w.german_examples.length;i++)add('example/'+i,'examples',w.german_examples[i],false,reason);
   for(const s of w.senses)for(const locale of['ru','uk','az']){const l=card.localizations.find(l=>l.sense_id===s.sense_id&&l.locale===locale);for(let i=0;i<w.german_examples.length;i++)add(`locale/${s.sense_id}/${locale}/example_translations/${i}`,'examples',l?.example_translations?.[i],!textPresent(l?.example_translations?.[i]),reason);}
  }
 }
 return[...allowed.values()];
}
export function applyFields(card,patches,scope){
 const c=structuredClone(card),allowed=new Map(scope.map(s=>[s.path,s])),seen=new Set();
 for(const p of patches){
  const s=allowed.get(p.path);if(!s||seen.has(p.path)||p.beforeHash!==sha(JSON.stringify(s.before)))throw Error('PATCH_SCOPE_OR_PRECONDITION');seen.add(p.path);
  if(typeof p.reason!=='string'||!p.reason.trim()||p.defectConfirmed!==true)throw Error('UNCONFIRMED_PATCH');
  if(typeof s.before==='boolean'){if(typeof p.value!=='boolean')throw Error('PATCH_TYPE');}
  else if(typeof p.value!=='string'||!p.value.trim())throw Error('PATCH_TYPE');
  const parts=p.path.split('/');
  if(parts[0]==='sense')c.word.senses[Number(parts[1])].german_gloss=p.value;
  else if(parts[0]==='grammar')c.word.grammar[parts[1]]=p.value;
  else if(parts[0]==='word')c.word[parts[1]]=p.value;
  else if(parts[0]==='example')c.word.german_examples[Number(parts[1])]=p.value;
  else if(parts[0]==='locale'){
   const[,sid,locale,f,index]=parts;if(!c.word.senses.some(s=>s.sense_id===sid)||!['ru','uk','az'].includes(locale))throw Error('IDENTITY_PATCH_FORBIDDEN');
   let l=c.localizations.find(l=>l.sense_id===sid&&l.locale===locale);if(!l){l={word_id:c.word.word_id,sense_id:sid,locale,translation:'',pronunciation_hint:null,explanation:null,example_translations:[]};c.localizations.push(l);}
   if(f==='example_translations'){const i=Number(index);if(!Number.isInteger(i)||i<0||i>=c.word.german_examples.length)throw Error('PATCH_INDEX');while(l.example_translations.length<=i)l.example_translations.push('');l.example_translations[i]=p.value;}else l[f]=p.value;
  }else throw Error('IDENTITY_PATCH_FORBIDDEN');
 }
 if(c.word.word_id!==card.word.word_id||c.word.lemma!==card.word.lemma||c.word.part_of_speech!==card.word.part_of_speech||c.word.target_language!==card.word.target_language||JSON.stringify(c.word.senses.map(s=>s.sense_id))!==JSON.stringify(card.word.senses.map(s=>s.sense_id))||JSON.stringify(c.word.provenance)!==JSON.stringify(card.word.provenance))throw Error('IDENTITY_OR_EVIDENCE_CHANGED');
 return c;
}
export function qaApprovedPatches(card,patches,results){
 const approved=p=>results.some(q=>q.path===p.path&&q.verdict==='PASS'&&q.defectConfirmed===true);
 // Grammar can affect every represented sense. Do not apply a subset assessed against different grammar.
 if(patches.some(p=>p.path.startsWith('grammar/')||p.path.startsWith('word/'))&&!patches.every(approved))return[];
 const parent=patches.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),union=(a,b)=>{parent[find(a)]=find(b);};
 const senses=p=>{const a=p.path.split('/');return a[0]==='sense'?card.word.senses[Number(a[1])].sense_id:a[0]==='locale'?a[1]:null;};
 for(let i=0;i<patches.length;i++)for(let j=i+1;j<patches.length;j++){
  const a=patches[i].path.split('/'),b=patches[j].path.split('/');
  if((a[0]==='sense'||b[0]==='sense')&&senses(patches[i])&&senses(patches[i])===senses(patches[j]))union(i,j);
  if((a[0]==='example'&&b[0]==='locale'&&b[3]==='example_translations'&&a[1]===b[4])||(b[0]==='example'&&a[0]==='locale'&&a[3]==='example_translations'&&b[1]===a[4]))union(i,j);
 }
 const failed=new Set(patches.map((p,i)=>approved(p)?null:find(i)).filter(x=>x!=null));
 return patches.filter((p,i)=>approved(p)&&!failed.has(find(i)));
}
