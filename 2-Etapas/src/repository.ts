import type { Employee, ScheduleResult, Shift, ShiftType } from './domain.ts';
import { cloneEmployees } from './domain.ts';
import { seed, type TenantSeed } from './demoData.ts';

interface TenantState {
  id: string;
  name: string;
  demoKey: string;
  employees: Employee[];
  shifts: Shift[];
  schedule: ScheduleResult | null;
}

/**
 * Atminties saugykla: minimalus II etapo adapteris vietoje planuotos PostgreSQL.
 * Kiekvienas metodas gauna patikimo konteksto tenantId ir duomenis filtruoja čia,
 * o ne tik naudotojo sąsajoje. Pakeitimas į DB nelies variklio.
 */
export class ScheduleRepository {
  private states = new Map<string, TenantState>();

  private readonly initialData: TenantSeed[];

  constructor(initialData: TenantSeed[] = seed) {
    this.initialData = initialData;
    this.restoreAll();
  }

  private restoreAll() {
    this.states.clear();
    for (const tenant of this.initialData) {
      this.states.set(tenant.id, {
        id: tenant.id,
        name: tenant.name,
        demoKey: tenant.demoKey,
        employees: cloneEmployees(tenant.employees),
        shifts: tenant.shifts.map(s => ({ ...s })),
        schedule: null
      });
    }
  }

  tenants() {
    return [...this.states.values()].map(t => ({ id: t.id, name: t.name }));
  }

  /** Demo raktas serverio pusėje išsprendžiamas į kliento kontekstą. */
  tenantIdFromKey(key: string | undefined): string | null {
    const tenant = [...this.states.values()].find(state => state.demoKey === key);
    return tenant?.id ?? null;
  }

  getEmployees(tenantId: string): Employee[] {
    const state = this.states.get(tenantId);
    return cloneEmployees((state?.employees ?? []).filter(e => e.tenantId === tenantId));
  }

  getEmployee(tenantId: string, employeeId: string): Employee | null {
    return this.getEmployees(tenantId).find(e => e.id === employeeId) ?? null;
  }

  updatePreferences(tenantId: string, employeeId: string, preferences: ShiftType[]): Employee | null {
    const state = this.states.get(tenantId);
    const employee = state?.employees.find(e => e.tenantId === tenantId && e.id === employeeId);
    if (!employee) return null;
    employee.preferences = [...preferences];
    state!.schedule = null; // Po pakeitimo senasis grafikas nebegalioja.
    return this.getEmployee(tenantId, employeeId);
  }

  getShifts(tenantId: string): Shift[] {
    return (this.states.get(tenantId)?.shifts ?? [])
      .filter(s => s.tenantId === tenantId).map(s => ({ ...s }));
  }

  getSchedule(tenantId: string): ScheduleResult | null {
    const schedule = this.states.get(tenantId)?.schedule;
    return schedule ? structuredClone(schedule) : null;
  }

  saveSchedule(tenantId: string, schedule: ScheduleResult): void {
    const state = this.states.get(tenantId);
    if (!state || schedule.tenantId !== tenantId ||
        schedule.assignments.some(a => !state.shifts.some(s => s.id === a.shiftId && s.tenantId === tenantId))) {
      throw new Error('Bandyta išsaugoti kito kliento duomenis');
    }
    state.schedule = structuredClone(schedule);
  }

  reset(tenantId: string): boolean {
    const original = this.initialData.find(t => t.id === tenantId);
    const state = this.states.get(tenantId);
    if (!original || !state) return false;
    state.employees = cloneEmployees(original.employees);
    state.shifts = original.shifts.map(s => ({ ...s }));
    state.schedule = null;
    return true;
  }
}
