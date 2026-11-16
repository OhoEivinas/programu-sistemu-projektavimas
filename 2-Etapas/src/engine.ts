import type { AssignmentResult, CandidateEvaluation, Employee, ScheduleResult, Shift } from './domain.ts';
import { cloneEmployees, shiftEnd, shiftStart } from './domain.ts';
import { calculateScore, defaultRules, type IConstraintRule } from './rules.ts';

function assertInput(tenantId: string, employees: Employee[], shifts: Shift[]) {
  if (!tenantId) throw new Error('tenantId būtinas');
  const employeeIds = new Set<string>();
  for (const employee of employees) {
    if (employee.tenantId !== tenantId) throw new Error('Darbuotojas nepriklauso šiam klientui');
    if (employeeIds.has(employee.id)) throw new Error('Pasikartojantis darbuotojo ID');
    employeeIds.add(employee.id);
    if (!Number.isFinite(employee.maxHours) || employee.maxHours <= 0 ||
        !Number.isFinite(employee.currentHours) || employee.currentHours < 0 ||
        employee.currentHours > employee.maxHours) {
      throw new Error(`Neteisingas darbuotojo ${employee.id} valandų limitas`);
    }
    if (employee.lastShiftEnd !== null && !Number.isFinite(Date.parse(employee.lastShiftEnd))) {
      throw new Error(`Neteisinga darbuotojo ${employee.id} paskutinės pamainos data`);
    }
  }
  const shiftIds = new Set<string>();
  for (const shift of shifts) {
    if (shift.tenantId !== tenantId) throw new Error('Pamaina nepriklauso šiam klientui');
    if (shiftIds.has(shift.id)) throw new Error('Pasikartojantis pamainos ID');
    shiftIds.add(shift.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shift.date) || !Number.isFinite(shiftStart(shift).getTime()) ||
        !['D', 'V', 'N'].includes(shift.type) || shift.durationHours !== 8) {
      throw new Error(`Neteisingi pamainos ${shift.id} duomenys`);
    }
  }
}

/** Pagrindinis verslo modulis – jokios priklausomybės nuo HTTP ar DB. */
export class ShiftOptimizationEngine {
  private readonly rules: IConstraintRule[];
  constructor(rules: IConstraintRule[] = defaultRules) {
    this.rules = rules;
  }

  generate(tenantId: string, inputEmployees: Employee[], inputShifts: Shift[]): ScheduleResult {
    assertInput(tenantId, inputEmployees, inputShifts);
    const employees = cloneEmployees(inputEmployees);
    const shifts = [...inputShifts].sort((a, b) =>
      shiftStart(a).getTime() - shiftStart(b).getTime() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
    const assignments: AssignmentResult[] = [];

    for (const shift of shifts) {
      const candidates: CandidateEvaluation[] = employees.map(employee => {
        const rejections = this.rules.flatMap(rule => {
          const rejection = rule.check(employee, shift);
          return rejection ? [rejection] : [];
        });
        if (rejections.length) {
          return {
            employeeId: employee.id, employeeName: employee.name, eligible: false,
            rejections, score: null, preferenceScore: null, balanceScore: null,
            hoursBefore: employee.currentHours
          };
        }
        const scores = calculateScore(employee, shift);
        return {
          employeeId: employee.id, employeeName: employee.name, eligible: true,
          rejections: [], ...scores, hoursBefore: employee.currentHours
        };
      });

      // T6: didžiausias balas, tada mažiausiai valandų, tada leksikografinis ID.
      const eligible = candidates.filter(c => c.eligible).sort((a, b) =>
        (b.score! - a.score!) || a.hoursBefore - b.hoursBefore ||
        (a.employeeId < b.employeeId ? -1 : a.employeeId > b.employeeId ? 1 : 0)
      );
      const winner = eligible[0];
      const startsAt = shiftStart(shift).toISOString();
      const endsAt = shiftEnd(shift).toISOString();

      if (!winner) {
        assignments.push({
          shiftId: shift.id, date: shift.date, type: shift.type,
          startsAt, endsAt, status: 'conflict',
          employeeId: null, employeeName: null, score: null,
          reason: 'Nė vienas darbuotojas neatitiko T1–T4 griežtų apribojimų.',
          errorCode: 'ERR_NO_ELIGIBLE_EMPLOYEE', candidates
        });
        continue;
      }

      const selected = employees.find(employee => employee.id === winner.employeeId)!;
      selected.currentHours += shift.durationHours;
      selected.lastShiftEnd = endsAt;
      selected.assignedDates.push(shift.date);
      assignments.push({
        shiftId: shift.id, date: shift.date, type: shift.type,
        startsAt, endsAt, status: 'assigned',
        employeeId: winner.employeeId, employeeName: winner.employeeName,
        score: winner.score,
        reason: `Tinkamiausias kandidatas (T5: ${winner.score!.toFixed(1)} balo; T6: jei balai sutaptų, būtų taikomos lygiųjų taisyklės).`,
        errorCode: null, candidates
      });
    }

    return {
      tenantId,
      assignments,
      assignedCount: assignments.filter(a => a.status === 'assigned').length,
      conflictCount: assignments.filter(a => a.status === 'conflict').length,
      employeeHours: employees.map(employee => ({
        employeeId: employee.id,
        hoursBefore: inputEmployees.find(original => original.id === employee.id)!.currentHours,
        hoursAfter: employee.currentHours,
        lastShiftEnd: employee.lastShiftEnd
      }))
    };
  }
}
