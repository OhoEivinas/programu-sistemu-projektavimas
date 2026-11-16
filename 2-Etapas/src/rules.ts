import type { Employee, Rejection, RuleCode, Shift } from './domain.ts';
import { shiftKey, shiftStart } from './domain.ts';

/** Sąsaja iš I etapo. III etape pagal ją galėsime pridėti T7 taisyklę. */
export interface IConstraintRule {
  readonly code: RuleCode;
  check(employee: Employee, shift: Shift): Rejection | null;
}

export const availabilityRule: IConstraintRule = {
  code: 'T1',
  check(employee, shift) {
    if (!employee.availability.includes(shiftKey(shift))) {
      return { rule: 'T1', reason: 'Darbuotojas nepažymėtas kaip galintis dirbti šią pamainą.' };
    }
    if (employee.unavailableDates.includes(shift.date)) {
      return { rule: 'T1', reason: 'Darbuotojui pažymėtos atostogos arba nedarbingumas.' };
    }
    return null;
  }
};

export const weeklyHoursRule: IConstraintRule = {
  code: 'T2',
  check(employee, shift) {
    if (employee.currentHours + shift.durationHours > employee.maxHours) {
      return { rule: 'T2', reason: `Viršijamas valandų limitas: ${employee.currentHours} + ${shift.durationHours} > ${employee.maxHours} val.` };
    }
    return null;
  }
};

export const restRule: IConstraintRule = {
  code: 'T3',
  check(employee, shift) {
    if (employee.lastShiftEnd === null) return null;
    const rest = (shiftStart(shift).getTime() - new Date(employee.lastShiftEnd).getTime()) / 3_600_000;
    if (rest < 12) {
      return { rule: 'T3', reason: `Nepakankamas poilsis: ${Number(rest.toFixed(2))} val. (reikia bent 12 val.).` };
    }
    return null;
  }
};

export const oneShiftPerDayRule: IConstraintRule = {
  code: 'T4',
  check(employee, shift) {
    if (employee.assignedDates.includes(shift.date)) {
      return { rule: 'T4', reason: 'Tą pačią kalendorinę dieną jau priskirta pamaina.' };
    }
    return null;
  }
};

export const defaultRules: IConstraintRule[] = [
  availabilityRule,
  weeklyHoursRule,
  restRule,
  oneShiftPerDayRule
];

/** T5. Balas skaičiuojamas tik patikrinus T1–T4. */
export function calculateScore(employee: Employee, shift: Shift) {
  const rank = employee.preferences.indexOf(shift.type);
  const preferenceScore = rank === 0 ? 50 : rank === 1 ? 25 : 0;
  const balanceScore = 50 - (employee.currentHours / employee.maxHours) * 50;
  const score = preferenceScore + balanceScore;
  return { preferenceScore, balanceScore, score };
}
