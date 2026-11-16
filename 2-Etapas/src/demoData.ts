import type { Employee, Shift } from './domain.ts';

export interface TenantSeed {
  id: string;
  name: string;
  demoKey: string;
  employees: Employee[];
  shifts: Shift[];
}

/** Datos sutampa su I etapo pavyzdžiu; duomenys fiktyvūs. */
const A = 'klinika-a';
const B = 'klinika-b';
const dateKeys = (date: string) => [`${date}:D`, `${date}:V`, `${date}:N`];

export const seed: TenantSeed[] = [
  {
    id: A, name: 'Vilniaus klinika (A)', demoKey: 'demo-a-2026',
    employees: [
      {
        id: 'E1', tenantId: A, name: 'Aistė Petrauskaitė',
        maxHours: 40, currentHours: 32, lastShiftEnd: '2026-10-10T16:00:00.000Z',
        preferences: ['D', 'V'],
        availability: [...dateKeys('2026-10-12'), ...dateKeys('2026-10-13'), ...dateKeys('2026-10-14')],
        unavailableDates: [], assignedDates: []
      },
      {
        id: 'E2', tenantId: A, name: 'Mantas Kazlauskas',
        maxHours: 40, currentHours: 24, lastShiftEnd: '2026-10-10T08:00:00.000Z',
        preferences: ['N', 'D'],
        availability: [...dateKeys('2026-10-12'), ...dateKeys('2026-10-13'), ...dateKeys('2026-10-14')],
        unavailableDates: [], assignedDates: []
      },
      {
        id: 'E3', tenantId: A, name: 'Rūta Jankauskienė',
        maxHours: 40, currentHours: 32, lastShiftEnd: '2026-10-10T16:00:00.000Z',
        preferences: ['V', 'N'],
        availability: [...dateKeys('2026-10-12'), ...dateKeys('2026-10-13'), ...dateKeys('2026-10-14')],
        unavailableDates: [], assignedDates: []
      }
    ],
    shifts: [
      { id: 'S1', tenantId: A, date: '2026-10-12', type: 'D', durationHours: 8 },
      { id: 'S2', tenantId: A, date: '2026-10-12', type: 'V', durationHours: 8 },
      { id: 'S3', tenantId: A, date: '2026-10-13', type: 'N', durationHours: 8 },
      { id: 'S4', tenantId: A, date: '2026-10-13', type: 'D', durationHours: 8 },
      { id: 'S5', tenantId: A, date: '2026-10-14', type: 'D', durationHours: 8 }
    ]
  },
  {
    id: B, name: 'Kauno klinika (B)', demoKey: 'demo-b-2026',
    employees: [
      {
        id: 'B1', tenantId: B, name: 'Gabija Rimkutė',
        maxHours: 40, currentHours: 16, lastShiftEnd: null,
        preferences: ['D', 'V'],
        availability: [...dateKeys('2026-10-12'), ...dateKeys('2026-10-13')],
        unavailableDates: [], assignedDates: []
      },
      {
        id: 'B2', tenantId: B, name: 'Tomas Žukauskas',
        maxHours: 40, currentHours: 24, lastShiftEnd: null,
        preferences: ['V', 'N'],
        availability: [...dateKeys('2026-10-12'), ...dateKeys('2026-10-13')],
        unavailableDates: ['2026-10-12'], assignedDates: []
      }
    ],
    shifts: [
      { id: 'B-S1', tenantId: B, date: '2026-10-12', type: 'D', durationHours: 8 },
      { id: 'B-S2', tenantId: B, date: '2026-10-13', type: 'V', durationHours: 8 }
    ]
  }
];
