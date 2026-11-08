import assert from 'node:assert/strict'

const base = process.argv[2]
if (!base) throw new Error('Usage: node scripts/smoke.mjs https://preview-url')
for (const path of ['/admin/login']) {
  const response = await fetch(new URL(path, base))
  assert.equal(response.status, 200, `${path} must load`)
}
for (const path of ['/api/process-image', '/api/admin/photographs/00000000-0000-0000-0000-000000000000']) {
  const response = await fetch(new URL(path, base), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  })
  assert.equal(response.status, 401, `${path} must reject an unsigned request`)
  assert.equal((await response.json()).error, 'Sign in required.')
}
console.log('Passed: admin login loads; privileged image and photograph endpoints reject unsigned requests.')
