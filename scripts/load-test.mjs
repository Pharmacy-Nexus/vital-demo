// SAFE, opt-in load test. Usage: node scripts/load-test.mjs http://localhost:3000/api/public/id/YOUR_REAL_TEST_DEVICE_SLUG 20 200
// For a remote staging environment set VITAL_ALLOW_REMOTE_LOAD_TEST=YES and obtain authorization.
const url=new URL(process.argv[2]??'http://localhost:3000/api/public/id/YOUR_REAL_TEST_DEVICE_SLUG');
const local=['localhost','127.0.0.1','::1'].includes(url.hostname);
if(!local && process.env.VITAL_ALLOW_REMOTE_LOAD_TEST!=='YES'){
 console.error('Refusing to load test remote hosts without explicit VITAL_ALLOW_REMOTE_LOAD_TEST=YES');process.exit(1);
}
const concurrency=Math.min(100,Math.max(1,Number(process.argv[3]??10)));
const total=Math.min(5000,Math.max(1,Number(process.argv[4]??100)));
let index=0,success=0,errors=0,limited=0;const samples=[];
async function worker(){while(index<total){index++;const start=performance.now();try{
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  samples.push(performance.now()-start);
  if(response.ok)success++;else if(response.status===429)limited++;else errors++;
}catch{errors++;}}}
const begin=performance.now();await Promise.all(Array.from({length:concurrency},worker));
const totalSeconds=(performance.now()-begin)/1000;
samples.sort((a,b)=>a-b);const p=q=>samples[Math.min(samples.length-1,Math.floor(samples.length*q))]?.toFixed(1)??'n/a';
console.log(JSON.stringify({url:url.origin+url.pathname,total,concurrency,success,limited,errors,elapsedSeconds:+totalSeconds.toFixed(2),requestsPerSecond:+(total/totalSeconds).toFixed(1),p50Ms:p(.5),p95Ms:p(.95),p99Ms:p(.99)},null,2));
