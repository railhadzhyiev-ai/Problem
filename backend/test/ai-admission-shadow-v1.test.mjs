import test from 'node:test';import assert from 'node:assert/strict';
import {shadowGate} from '../benchmark/canonicalword-ai-pilot-v1/ai-admission-shadow-v1.mjs';
import {sha} from '../benchmark/canonicalword-ai-pilot-v1/staging-v2.mjs';
const id='staging:ai-pilot:control',sid=id+':sense:1';
const seed={schemaVersion:2,word:{word_id:id,lemma:'Haus',part_of_speech:'NOUN',target_language:'de',article:null,plural:null,cefr:null,ipa:null,german_examples:[],grammar:{},provenance:{control:true},senses:[],lookup_forms:[]},localizations:[]};
const card={schemaVersion:2,word:{...structuredClone(seed.word),article:'das',plural:'Häuser',senses:[{sense_id:sid,german_gloss:'Gebäude zum Wohnen'}],german_examples:['Das Haus ist groß.']},localizations:[['ru','дом','Дом большой.'],['uk','будинок','Будинок великий.'],['az','ev','Ev böyükdür.']].map(([locale,translation,ex])=>({word_id:id,sense_id:sid,locale,translation,explanation:translation,example_translations:[ex]}))};
// Test oracle only, not independent evidence for any pilot record.
const receipt={cardSha256:sha(JSON.stringify(card)),languagePass:true,languageIssues:[],rawVerdict:'PASS',criticalConfirmed:['targetLanguage','lemma','POS']};
test('known correct synthetic control PASS, optional absence allowed',()=>assert.equal(shadowGate({card,seed,qaReceipt:receipt}).verdict,'SHADOW_PASS'));
const mutations={language:c=>c.word.target_language='en',lemma:c=>c.word.lemma='Hund',POS:c=>c.word.part_of_speech='VERB',sense:c=>c.word.senses[0].sense_id='other',localization:c=>c.localizations[0].sense_id='other',morphology:c=>c.word.plural='Hause',translation:c=>c.localizations[0].translation='собака',example:c=>c.word.german_examples[0]='Die Katze schläft.'};
for(const [name,mutate] of Object.entries(mutations))test(name+' mutation invalidates bound QA and FAILS',()=>{const changed=structuredClone(card);mutate(changed);assert.notEqual(shadowGate({card:changed,seed,qaReceipt:receipt}).verdict,'SHADOW_PASS');});
test('AI_GENERATED without independent QA cannot pass',()=>assert.notEqual(shadowGate({card,seed,qaReceipt:{...receipt,languagePass:false}}).verdict,'SHADOW_PASS'));
test('missing explicit critical confirmation cannot pass',()=>assert.notEqual(shadowGate({card,seed,qaReceipt:{...receipt,criticalConfirmed:[]}}).verdict,'SHADOW_PASS'));
test('matching exact QA cannot hide marked semantic conflict',()=>assert.equal(shadowGate({card,seed,qaReceipt:{...receipt,languagePass:false,rawVerdict:'CONFLICT',languageIssues:[{field:'plural',reason:'wrong plural'}]}}).verdict,'CONFLICT'));
