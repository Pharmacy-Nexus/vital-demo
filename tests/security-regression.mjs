import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function loadTs(file) {
  const src=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  const {outputText,diagnostics}=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  assert.equal(diagnostics?.length??0,0,'TS syntax error in '+file);
  const exports={};
  runInNewContext(outputText,{exports,require,structuredClone,console,process,Buffer},{filename:file});
  return exports;
}
const {authorizedMedicalPath}=loadTs('lib/server/storageAuthorization.ts');
const {buildEmergencyPatient,sanitizeDeviceForPublic}=loadTs('lib/server/publicProfile.ts');
const ownerA='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const ownerB='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const A=`cloud:${ownerA}/patient-one/first/file.pdf`;
const B=`cloud:${ownerB}/patient-one/first/file.pdf`;
test('owner cannot sign another user storage file',()=>{
 assert.equal(authorizedMedicalPath(ownerA,'patient-one',A),A.slice(6));
 assert.equal(authorizedMedicalPath(ownerA,'patient-one',B),null);
 assert.equal(authorizedMedicalPath(ownerA,'patient-two',A),null);
 assert.equal(authorizedMedicalPath(ownerA,'patient-one',`cloud:${ownerA}/patient-one/../other/file.pdf`),null);
 assert.equal(authorizedMedicalPath(ownerA,'patient-one',`cloud:${ownerA}/patient-one/first/%2e%2e`),null);
});
test('public QR allowlist strips unknown fields and private medical records',()=>{
 const device=sanitizeDeviceForPublic({id:'raw-device',name:'Wallet Card',patientSlug:'internal',qrSlug:'qr-a1a1',type:'card',status:'active',createdAt:'today',display:{basicInfo:true,bloodType:true,allergies:true,conditions:false,medications:false,emergencyContact:false,documents:true}});
 const patient={slug:'secret-slug',firstName:'A',lastName:'B',age:33,photoColor:'#eee',photoFileKey:A,photoEmergencyVisible:false,emergencyProfile:{completeness:100},recordCompleteness:99,lastConfirmation:'now',linkedIds:2,bloodType:'O+',allergies:[{id:'1',visibility:'private'},{id:'2',visibility:'emergency'}],conditions:[],medications:[],emergencyContacts:[],documents:[{id:'3',fileKey:A,visibility:'emergency'}],labResults:[{id:'secret'}],radiology:[],surgeries:[],vaccinations:[],timeline:[],ssn:'SECRET'};
 const result=buildEmergencyPatient(patient,device);
 assert.equal(result.ssn,undefined);
 assert.equal(result.photoFileKey,undefined);
 assert.equal(result.slug,'');
 assert.equal(result.allergies.length,1);
 assert.equal(result.documents[0].fileKey,undefined);
 assert.equal(result.labResults.length,0);
 assert.equal(device.patientSlug,'');
});
test('missing display choices always fail closed',()=>{
 const result=sanitizeDeviceForPublic({id:'x',qrSlug:'slug',patientSlug:'p',name:'ID',type:'card',status:'active',createdAt:'now'});
 assert.equal(Object.values(result.display).every(v=>v===false),true);
});
test('authorization and central limiter have required database controls',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/004_security_and_scale.sql',import.meta.url),'utf8');
 for(const expected of ['devices_patient_owner_fk','shares_patient_owner_fk','suggestions_patient_owner_fk','GRANT UPDATE (revoked_at)','clinician_sessions','vital_take_rate_limit','vital_record_scan','vital_patient_json_max_bytes']) assert.ok(sql.includes(expected),expected);
 const source=readFileSync(new URL('../app/api/doctor/access/route.ts',import.meta.url),'utf8');
 assert.ok(!source.includes('VITAL_ID_DEMO_OTP'));
 assert.ok(source.includes('.eq("owner_id", share.owner_id)'));
});
