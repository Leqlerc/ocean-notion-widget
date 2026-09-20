import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {PGlite}=await import(process.env.PGLITE_MODULE);
const path=mkdtempSync(join(tmpdir(),'nocean-integrations-'));
let db=new PGlite(path);
const owner='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
try {
 await db.exec('CREATE SCHEMA nocean');
 for(const file of ['001_goals.sql','002_integrations.sql'])await db.exec(readFileSync(new URL('../migrations/sql/'+file,import.meta.url),'utf8'));
 for(const id of [owner,other])await db.query('INSERT INTO nocean.owners VALUES ($1,$2,$3,$4)',[id,'test',id,'America/Indiana/Indianapolis']);
 await db.query('INSERT INTO nocean.provider_accounts(owner_id,provider,account_id,secret_ciphertext) VALUES ($1,$2,$3,$4)',[owner,'outlook','account','cipher']);
 await db.query('INSERT INTO nocean.provider_items(owner_id,provider,external_id,account_id,payload) VALUES ($1,$2,$3,$4,$5)',[owner,'outlook','immutable','account',JSON.stringify({at:'2026-09-24T12:00:00Z'})]);
 await db.query('UPDATE nocean.provider_items SET payload=$1 WHERE external_id=$2',[JSON.stringify({at:'2026-09-25T12:00:00Z'}),'immutable']);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM nocean.provider_items')).rows[0].n,1);
 await assert.rejects(db.query('INSERT INTO nocean.provider_items(owner_id,provider,external_id,account_id,payload) VALUES ($1,$2,$3,$4,$5)',[owner,'outlook','immutable','account','{}']),e=>e.code==='23505');
 await db.exec('CREATE ROLE runtime_integrations NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA nocean TO runtime_integrations; GRANT SELECT,INSERT,UPDATE,DELETE ON nocean.provider_accounts,nocean.provider_items,nocean.provider_operations,nocean.oauth_requests TO runtime_integrations;');
 await db.transaction(async tx=>{
  await tx.exec('SET LOCAL ROLE runtime_integrations');
  await tx.query("SELECT set_config('nocean.owner_id',$1,true)",[other]);
  assert.equal((await tx.query('SELECT * FROM nocean.provider_items')).rows.length,0);
 });
 await assert.rejects(db.transaction(async tx=>{
  await tx.exec('SET LOCAL ROLE runtime_integrations');
  await tx.query("SELECT set_config('nocean.owner_id',$1,true)",[other]);
  await tx.query('INSERT INTO nocean.oauth_requests VALUES ($1,$2,$3,now())',[owner,'state','cipher']);
 }),e=>e.code==='42501');
 await assert.rejects(db.transaction(async tx=>{await tx.exec('DELETE FROM nocean.provider_items');throw Error('upstream failed');}));
 await db.close();db=new PGlite(path);
 assert.equal((await db.query('SELECT payload FROM nocean.provider_items')).rows[0].payload.at,'2026-09-25T12:00:00Z');
 console.log('PASS: additive migrations, stable-ID uniqueness, moved-event update, RLS read/write isolation, rollback and committed persistence after reopen.');
} finally {await db.close();rmSync(path,{recursive:true,force:true});}
