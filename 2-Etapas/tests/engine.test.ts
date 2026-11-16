import test from 'node:test';
import assert from 'node:assert/strict';
import type { Employee, Shift } from '../src/domain.ts';
import { ShiftOptimizationEngine } from '../src/engine.ts';
import { calculateScore } from '../src/rules.ts';

const engine = new ShiftOptimizationEngine();
const tenantId = 'test-klinika';

function employee(id: string, hours: number, prefs: Employee['preferences'], last: string | null = null): Employee {
  return {
    id, tenantId, name: id, maxHours: 40, currentHours: hours,
    lastShiftEnd: last, preferences: prefs,
    availability: ['2026-10-12:D', '2026-10-12:N', '2026-10-13:D', '2026-10-13:N'],
    unavailableDates: [], assignedDates: []
  };
}
function shift(id: string, date: string, type: Shift['type']): Shift {
  return { id, tenantId, date, type, durationHours: 8 };
}

test('I etapo įprastas atvejis: S1 skiriama E1 (60 balų) ir valandos atnaujinamos', () => {
  const e1 = employee('E1', 32, ['D', 'V']);
  const employees = [e1, employee('E2', 24, ['N', 'D']), employee('E3', 32, ['V', 'N'])];
  const result = engine.generate(tenantId, employees, [shift('S1', '2026-10-12', 'D')]);
  const a = result.assignments[0];
  assert.equal(a.status, 'assigned');
  assert.equal(a.employeeId, 'E1');
  assert.equal(a.score, 60);
  assert.deepEqual(a.candidates.map(c => c.score), [60, 45, 10]);
  assert.equal(e1.currentHours, 32, 'Išorinė įvestis neturi būti mutuojama');
  assert.equal(result.assignedCount, 1);
  assert.equal(result.conflictCount, 0);
});

test('I etapo ribinis atvejis: E1 atmetamas pagal T3, laimi E2 su 60', () => {
  const employees = [
    employee('E1', 32, ['N'], '2026-10-11T16:00:00.000Z'),
    employee('E2', 32, ['N'], '2026-10-11T08:00:00.000Z'),
    employee('E3', 20, ['V', 'N'], '2026-10-11T08:00:00.000Z')
  ];
  const a = engine.generate(tenantId, employees, [shift('S2', '2026-10-12', 'N')]).assignments[0];
  assert.equal(a.employeeId, 'E2');
  assert.equal(a.score, 60);
  assert.deepEqual(a.candidates[0].rejections.map(r => r.rule), ['T3']);
  assert.equal(a.candidates[2].score, 50);
});

test('I etapo klaidos atvejis: T2/T3/T4 atmeta visus, grąžinamas konkretus klaidos kodas', () => {
  const e3 = employee('E3', 32, ['D'], '2026-10-12T08:00:00.000Z');
  e3.assignedDates = ['2026-10-12'];
  const employees = [employee('E1', 36, ['D']), employee('E2', 40, ['D']), e3];
  const result = engine.generate(tenantId, employees, [shift('S3', '2026-10-12', 'D')]);
  const a = result.assignments[0];
  assert.equal(a.status, 'conflict');
  assert.equal(a.employeeId, null);
  assert.equal(a.errorCode, 'ERR_NO_ELIGIBLE_EMPLOYEE');
  assert.deepEqual(a.candidates[0].rejections.map(r => r.rule), ['T2']);
  assert.deepEqual(a.candidates[1].rejections.map(r => r.rule), ['T2']);
  assert.deepEqual(a.candidates[2].rejections.map(r => r.rule), ['T3', 'T4']);
  assert.equal(result.conflictCount, 1);
});

test('I etapo lygiosios: vienodi 70 balų ir valandos – mažesnis ID E1', () => {
  const result = engine.generate(tenantId,
    [employee('E2', 24, ['D']), employee('E1', 24, ['D'])],
    [shift('S4', '2026-10-13', 'D')]);
  assert.equal(result.assignments[0].score, 70);
  assert.equal(result.assignments[0].employeeId, 'E1');
});

test('Chronologinis apdorojimas atnaujina savaitines valandas ir T4 būseną', () => {
  const shifts = [shift('S2', '2026-10-12', 'N'), shift('S1', '2026-10-12', 'D')];
  const result = engine.generate(tenantId, [employee('E1', 24, ['N', 'D'])], shifts);
  assert.equal(result.assignments[0].shiftId, 'S2');
  assert.equal(result.assignments[0].employeeId, 'E1');
  assert.equal(result.assignments[1].shiftId, 'S1');
  assert.equal(result.assignments[1].status, 'conflict');
  assert.ok(result.assignments[1].candidates[0].rejections.some(r => r.rule === 'T4'));
});

test('T1 atmeta neprieinamą ir atostogaujantį darbuotoją', () => {
  const e1 = employee('E1', 0, ['D']);
  e1.availability = [];
  const e2 = employee('E2', 0, ['D']);
  e2.unavailableDates = ['2026-10-12'];
  const result = engine.generate(tenantId, [e1, e2], [shift('S1', '2026-10-12', 'D')]);
  assert.equal(result.conflictCount, 1);
  assert.deepEqual(result.assignments[0].candidates.map(c => c.rejections.map(r => r.rule)), [['T1'], ['T1']]);
});

test('T6 pirmas lygiųjų žingsnis: esant vienodam balui, laimi mažiau valandų', () => {
  // Z: 0 val. (S_bal=50) + 0 pref; A: 20 val. (S_bal=25) + 25 pref.
  const e1 = employee('Z', 0, []);
  const e2 = employee('A', 20, ['N', 'D']);
  const a = engine.generate(tenantId, [e2, e1], [shift('S1', '2026-10-12', 'D')]).assignments[0];
  assert.equal(calculateScore(e1, shift('S1', '2026-10-12', 'D')).score, 50);
  assert.equal(calculateScore(e2, shift('S1', '2026-10-12', 'D')).score, 50);
  assert.equal(a.employeeId, 'Z');
});

test('Sauga: nesuderintų skirtingų klinikų darbuotojų ir pamainų negalima apdoroti', () => {
  const other = employee('X', 0, ['D']);
  other.tenantId = 'kita-klinika';
  assert.throws(() => engine.generate(tenantId, [other], [shift('S1', '2026-10-12', 'D')]), /nepriklauso/);
});
