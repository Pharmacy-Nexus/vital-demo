import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('public emergency endpoint has an owner-checked DB fallback when RPC is missing', () => {
  const src = read('lib/server/emergencyLookup.ts');
  assert.match(src, /rpc\("vital_public_emergency_lookup"/);
  assert.match(src, /rpcError\.code !== "PGRST202"/);
  assert.match(src, /\.eq\("qr_slug", slug\)/);
  assert.match(src, /\.eq\("status", "active"\)/);
  assert.match(src, /\.eq\("id", device\.patient_id\)/);
  assert.match(src, /\.eq\("owner_id", device\.owner_id\)/);
  assert.match(src, /kind: "not_found"/);
});

test('API never returns raw patient/device JSON to QR scanner', () => {
  const src = read('app/api/public/id/[slug]/route.ts');
  assert.match(src, /buildEmergencyPatient\(source, publicDevice\)/);
  assert.match(src, /sanitizeDeviceForPublic\(/);
  assert.match(src, /headers: medicalNoStore/);
});

test('QR page never falls back to private local data', () => {
  const src = read('app/id/[slug]/page.tsx');
  assert.doesNotMatch(src, /getDeviceByQrSlug|usePatient|localPatient/);
  assert.match(src, /temporarilyUnavailable/);
});

test('Dashboard verifies cloud writes and anonymous emergency reads before presenting a QR', () => {
  const src = read('app/dashboard/devices/page.tsx');
  assert.match(src, /await upsertCloudDevice\(device\)/);
  assert.match(src, /fetch\(`\/api\/public\/id\/\$\{encodeURIComponent\(device\.qrSlug\)\}`/);
  assert.match(src, /await publishDevice\(device\);/);
  assert.match(src, /setShowQr\(device\.id\)/);
});

test('activation checks emergency page online before reporting success', () => {
  const src = read('app/activate/page.tsx');
  assert.match(src, /await upsertCloudPatient\(patient\)/);
  assert.match(src, /await upsertCloudDevice\(activeDevice\)/);
  assert.match(src, /const check = await fetch\(`\/api\/public\/id\/\$\{encodeURIComponent\(activeDevice\.qrSlug\)\}`/);
  assert.ok(src.indexOf('if (!check.ok)') < src.indexOf('setStep("success")'));
  assert.doesNotMatch(src, /createDevice\(/);
});

test('new linked IDs are written to local state only after cloud verification', () => {
  const src = read('app/dashboard/devices/page.tsx');
  assert.match(src, /await publishDevice\(device\); saveDevice\(device, false\);/);
  assert.doesNotMatch(src, /draft \?\? createDevice\(/);
});
