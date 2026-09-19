// npm install --prefix /tmp/nocean-db-check @electric-sql/pglite@0.5.8
// PGLITE_MODULE=/tmp/nocean-db-check/node_modules/@electric-sql/pglite/dist/index.js node tests/test_schema.mjs
// Embedded PostgreSQL checks, not a replacement for the native Preview integration suite.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const folder = mkdtempSync(join(tmpdir(),'nocean-schema-'));
let db = new PGlite(folder);
const owner=randomUUID(),other=randomUUID(),project=randomUUID(),phase=randomUUID(),p2=randomUUID(),metric=randomUUID();
try {
 await db.exec('CREATE SCHEMA nocean;');
 await db.exec(readFileSync(new URL('../migrations/sql/001_goals.sql',import.meta.url),'utf8'));
 for(const id of [owner,other])await db.query('INSERT INTO nocean.owners(id,auth_issuer,auth_subject,timezone) VALUES ($1,$2,$3,$4)',[id,'test',id,'America/Indiana/Indianapolis']);
 for(const id of [project,p2])await db.query('INSERT INTO nocean.projects(owner_id,id,name,status) VALUES ($1,$2,$3,$4)',[owner,id,'Goal','Active']);
 await assert.rejects(db.query('INSERT INTO nocean.project_objectives(owner_id,id,project_id,title) VALUES ($1,$2,$3,$4)',[other,randomUUID(),project,'Other owner']),e=>e.code==='23503');
 await db.query('INSERT INTO nocean.project_phases(owner_id,id,project_id,title) VALUES ($1,$2,$3,$4)',[owner,phase,project,'Base phase']);
 await assert.rejects(db.query('INSERT INTO nocean.project_milestones(owner_id,id,project_id,phase_id,title) VALUES ($1,$2,$3,$4,$5)',[owner,randomUUID(),p2,phase,'Wrong phase']),e=>e.code==='23503');
 await assert.rejects(db.query('UPDATE nocean.projects SET start_date=$1,target_date=$2 WHERE id=$3',['2026-12-01','2026-10-01',project]),e=>e.code==='23514');
 await db.query('INSERT INTO nocean.project_metrics(owner_id,id,project_id,name,unit,direction,target) VALUES ($1,$2,$3,$4,$5,$6,$7)',[owner,metric,project,'Pull-ups','reps','increase',20]);
 await db.query('INSERT INTO nocean.metric_samples(owner_id,id,metric_id,measured_at,value) VALUES ($1,$2,$3,$4,$5)',[owner,randomUUID(),metric,'2026-09-19T15:30:00-04:00',10]);
 const task=randomUUID();
 await db.query('INSERT INTO nocean.project_task_links VALUES ($1,$2,$3)',[owner,project,task]);
 await assert.rejects(db.query('INSERT INTO nocean.project_task_links VALUES ($1,$2,$3)',[owner,project,task]),e=>e.code==='23505');
 await assert.rejects(db.transaction(async tx=>{await tx.query('DELETE FROM nocean.metric_samples');throw Error('Abort test');}));
 assert.equal((await db.query('SELECT count(*)::int AS count FROM nocean.metric_samples')).rows[0].count,1);
 await db.exec('CREATE ROLE runtime_test NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA nocean TO runtime_test; GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nocean TO runtime_test;');
 await db.transaction(async tx=>{
  await tx.exec('SET LOCAL ROLE runtime_test');
  assert.equal((await tx.query('SELECT count(*)::int AS count FROM nocean.projects')).rows[0].count,0);
  await tx.query("SELECT set_config('nocean.owner_id',$1,true)",[other]);
  assert.equal((await tx.query('SELECT count(*)::int AS count FROM nocean.projects')).rows[0].count,0);
  await tx.query("SELECT set_config('nocean.owner_id',$1,true)",[owner]);
  assert.equal((await tx.query('SELECT count(*)::int AS count FROM nocean.projects')).rows[0].count,2);
 });
 await assert.rejects(db.transaction(async tx=>{
  await tx.exec('SET LOCAL ROLE runtime_test');
  await tx.query("SELECT set_config('nocean.owner_id',$1,true)",[owner]);
  await tx.query('INSERT INTO nocean.projects(owner_id,id,name,status) VALUES ($1,$2,$3,$4)',[other,randomUUID(),'Forbidden','Active']);
 }),e=>e.code==='42501');
 await db.close(); db=new PGlite(folder);
 const sample=(await db.query('SELECT value::int AS value, measured_at FROM nocean.metric_samples')).rows[0];
 assert.equal(sample.value,10);
 assert.equal(new Date(sample.measured_at).toISOString(),'2026-09-19T19:30:00.000Z');
 console.log('PASS: schema, owner/phase foreign keys, date checks, duplicate prevention, rollback, RLS, persisted metric/time.');
} finally {await db.close();rmSync(folder,{recursive:true,force:true});}
