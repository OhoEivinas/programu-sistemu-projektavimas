import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/api.ts';
import { ScheduleRepository } from '../src/repository.ts';

async function fixture() {
  const app = createApp(new ScheduleRepository());
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  const addr = app.address();
  if (!addr || typeof addr === 'string') throw new Error('Nėra prievado');
  const root = `http://127.0.0.1:${addr.port}`;
  const request = (path: string, key = 'demo-a-2026', options: RequestInit = {}) =>
    fetch(root + path, { ...options, headers: {
      'X-Demo-Key': key,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    } });
  return { app, request };
}

test('End-to-end: tikras grafiko generavimas per HTTP, S4 konfliktas', async t => {
  const { app, request } = await fixture();
  t.after(() => app.close());
  const response = await request('/api/generate', 'demo-a-2026', { method: 'POST' });
  assert.equal(response.status, 200);
  const { schedule } = await response.json() as any;
  assert.equal(schedule.tenantId, 'klinika-a');
  assert.equal(schedule.assignments.length, 5);
  assert.equal(schedule.assignedCount, 4);
  assert.equal(schedule.conflictCount, 1);
  assert.deepEqual(schedule.employeeHours.map((h: any) => h.hoursAfter), [40, 40, 40]);
  assert.equal(schedule.assignments.find((a: any) => a.shiftId === 'S1').employeeId, 'E1');
  assert.equal(schedule.assignments.find((a: any) => a.shiftId === 'S4').errorCode, 'ERR_NO_ELIGIBLE_EMPLOYEE');
  const saved = await (await request('/api/schedule')).json() as any;
  assert.equal(saved.schedule.assignments.length, 5);
});

test('Klientų izoliacija: B negali perskaityti ar pakeisti A darbuotojo', async t => {
  const { app, request } = await fixture();
  t.after(() => app.close());
  const before = await (await request('/api/employees/E1', 'demo-a-2026')).json() as any;
  assert.equal(before.employee.id, 'E1');

  const readAcross = await request('/api/employees/E1', 'demo-b-2026');
  assert.equal(readAcross.status, 404);
  assert.equal((await readAcross.json() as any).error, 'EMPLOYEE_NOT_FOUND');

  const writeAcross = await request('/api/employees/E1/preferences', 'demo-b-2026', {
    method: 'PATCH', body: JSON.stringify({ preferences: ['N'] })
  });
  assert.equal(writeAcross.status, 404);
  const after = await (await request('/api/employees/E1', 'demo-a-2026')).json() as any;
  assert.deepEqual(after.employee.preferences, ['D', 'V']);

  const bData = await (await request('/api/employees', 'demo-b-2026')).json() as any;
  assert.ok(bData.employees.every((e: any) => e.tenantId === 'klinika-b'));
  assert.equal(bData.employees.some((e: any) => e.id === 'E1'), false);
});

test('Klientų izoliacija: A grafiko generavimas nepakeičia B grafiko', async t => {
  const { app, request } = await fixture();
  t.after(() => app.close());
  await request('/api/generate', 'demo-b-2026', { method: 'POST' });
  const bBefore = (await (await request('/api/schedule', 'demo-b-2026')).json() as any).schedule;
  await request('/api/generate', 'demo-a-2026', { method: 'POST' });
  const bAfter = (await (await request('/api/schedule', 'demo-b-2026')).json() as any).schedule;
  assert.deepEqual(bBefore, bAfter);
});

test('Darbuotojo preferencijų keitimas keičia rezultatus tik savo klinikoje', async t => {
  const { app, request } = await fixture();
  t.after(() => app.close());
  const change = await request('/api/employees/E1/preferences', 'demo-a-2026', {
    method: 'PATCH', body: JSON.stringify({ preferences: ['N', 'V'] })
  });
  assert.equal(change.status, 200);
  const changed = (await (await request('/api/employees/E1', 'demo-a-2026')).json() as any).employee;
  assert.deepEqual(changed.preferences, ['N', 'V']);
  const b = (await (await request('/api/employees/B1', 'demo-b-2026')).json() as any).employee;
  assert.deepEqual(b.preferences, ['D', 'V']);
  const reset = await request('/api/reset', 'demo-a-2026', { method: 'POST' });
  assert.equal(reset.status, 200);
  assert.deepEqual((await (await request('/api/employees/E1', 'demo-a-2026')).json() as any).employee.preferences, ['D', 'V']);
});

test('Be raktų API nieko negrąžina, neteisinga įvestis atmetama', async t => {
  const { app, request } = await fixture();
  t.after(() => app.close());
  assert.equal((await request('/api/employees', 'invalid-key')).status, 401);
  const invalid = await request('/api/employees/E1/preferences', 'demo-a-2026', {
    method: 'PATCH', body: JSON.stringify({ preferences: ['D', 'D'] })
  });
  assert.equal(invalid.status, 400);
});
