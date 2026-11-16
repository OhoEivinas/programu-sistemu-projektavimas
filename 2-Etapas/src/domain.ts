/** Bendri, nuo HTTP ir saugyklos nepriklausomi dalykiniai tipai. */
export type ShiftType = 'D' | 'V' | 'N';
export type RuleCode = 'T1' | 'T2' | 'T3' | 'T4';

export interface Employee {
  id: string;
  tenantId: string;
  name: string;
  maxHours: number;
  currentHours: number;
  lastShiftEnd: string | null;
  preferences: ShiftType[];
  /** Konkrečios pamainos, kurias darbuotojas gali dirbti: YYYY-MM-DD:D/V/N */
  availability: string[];
  /** Atostogų ir nedarbingumo dienos (įvestos prieš generavimą). */
  unavailableDates: string[];
  /** Jau priskirtų pamainų kalendorinės datos. */
  assignedDates: string[];
}

export interface Shift {
  id: string;
  tenantId: string;
  date: string;
  type: ShiftType;
  durationHours: 8;
}

export interface Rejection {
  rule: RuleCode;
  reason: string;
}

export interface CandidateEvaluation {
  employeeId: string;
  employeeName: string;
  eligible: boolean;
  rejections: Rejection[];
  score: number | null;
  preferenceScore: number | null;
  balanceScore: number | null;
  hoursBefore: number;
}

export interface AssignmentResult {
  shiftId: string;
  date: string;
  type: ShiftType;
  startsAt: string;
  endsAt: string;
  status: 'assigned' | 'conflict';
  employeeId: string | null;
  employeeName: string | null;
  score: number | null;
  reason: string;
  errorCode: 'ERR_NO_ELIGIBLE_EMPLOYEE' | null;
  candidates: CandidateEvaluation[];
}

export interface ScheduleResult {
  tenantId: string;
  assignments: AssignmentResult[];
  assignedCount: number;
  conflictCount: number;
  /** Būsena po vieno generavimo; pradiniai duomenys nekeičiami, kad galima būtų perskaičiuoti. */
  employeeHours: { employeeId: string; hoursBefore: number; hoursAfter: number; lastShiftEnd: string | null }[];
}

export function shiftStart(shift: Shift): Date {
  const hour = shift.type === 'D' ? 8 : shift.type === 'V' ? 16 : 0;
  return new Date(`${shift.date}T${String(hour).padStart(2, '0')}:00:00.000Z`);
}

export function shiftEnd(shift: Shift): Date {
  return new Date(shiftStart(shift).getTime() + shift.durationHours * 60 * 60 * 1000);
}

export function shiftKey(shift: Shift): string {
  return `${shift.date}:${shift.type}`;
}

/** Kiekvienas skaičiavimas atliekamas su atskiromis darbuotojų kopijomis. */
export function cloneEmployees(employees: Employee[]): Employee[] {
  return employees.map(e => ({
    ...e,
    preferences: [...e.preferences],
    availability: [...e.availability],
    unavailableDates: [...e.unavailableDates],
    assignedDates: [...e.assignedDates]
  }));
}
