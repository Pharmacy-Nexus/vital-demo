import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { resolve, join } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = resolve(import.meta.dirname,'..');
function loadModule(rel){
  const src=readFileSync(join(ROOT,rel),'utf8');
  const {outputText,diagnostics}=ts.transpileModule(src,{fileName:rel,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  assert.equal(diagnostics?.length??0,0);
  const exports={};
  runInNewContext(outputText,{exports,require,process,Buffer,console},{filename:rel});
  return exports;
}
const {buildEmergencyPatient,sanitizeDeviceForPublic}=loadModule('lib/server/publicProfile.ts');
const p={slug:'test-patient',firstName:'A',lastName:'B',age:44,sex:'female',emergencySummary:'Call my doctor first',photoColor:'#fff',bloodType:'A+',allergies:[],conditions:[],medications:[],emergencyContacts:[],documents:[],labResults:[],radiology:[],surgeries:[],vaccinations:[],timeline:[]};
const makeDevice=(display={})=>sanitizeDeviceForPublic({id:'d',name:'Card',qrSlug:'qr-test',patientSlug:'secret',type:'card',status:'active',createdAt:'today',display});
test('owner-written emergency text and sex are private by default',()=>{
  const result=buildEmergencyPatient(p,makeDevice());
  assert.equal(result.emergencySummary,'');
  assert.equal(result.sex,'unspecified');
  assert.equal(result.firstName,'');
});
test('owner explicitly allows summary and sex via per-device settings',()=>{
  const device=makeDevice({basicInfo:true,emergencySummary:true});
  const result=buildEmergencyPatient(p,device);
  assert.equal(result.emergencySummary,'Call my doctor first');
  assert.equal(result.sex,'female');
  assert.equal(result.firstName,'A');
});
test('public summary is length-limited',()=>{
  const result=buildEmergencyPatient({...p,emergencySummary:'x'.repeat(2000)},makeDevice({emergencySummary:true}));
  assert.equal(result.emergencySummary.length,800);
});
test('no sample fixtures or cinematic ad are shipped',()=>{
  for(const relative of ['data/demo/patients.ts','data/demo/devices.ts','app/demo/page.tsx','public/cinematic/index.html','components/ui/DemoTag.tsx']){
    assert.throws(()=>statSync(join(ROOT,relative)),/ENOENT/);
  }
  assert.ok(!readFileSync(join(ROOT,'app/page.tsx'),'utf8').includes('/cinematic/index.html'));
});
test('all application TypeScript/TSX files have valid syntax',()=>{
  const errors=[];
  const scan=(dir)=>{
    for(const name of readdirSync(dir)){
      const file=join(dir,name);const s=statSync(file);
      if(s.isDirectory())scan(file);
      else if(/\.tsx?$/.test(name)){
        const contents=readFileSync(file,'utf8');
        const ast=ts.createSourceFile(file,contents,ts.ScriptTarget.ES2022,true,name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
        for(const e of ast.parseDiagnostics){errors.push(`${file}: ${ts.flattenDiagnosticMessageText(e.messageText,' ')}`);}
      }
    }
  };
  for(const dir of ['app','components','lib'])scan(join(ROOT,dir));
  assert.deepEqual(errors,[]);
});
