import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import type { ShiftType } from './domain.ts';
import { ScheduleRepository } from './repository.ts';
import { ShiftOptimizationEngine } from './engine.ts';

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}

async function bodyJson(req: IncomingMessage): Promise<unknown> {
  if (!(req.headers['content-type'] ?? '').includes('application/json')) {
    throw Object.assign(new Error('Reikalingas Content-Type: application/json'), { status: 415 });
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > 65_536) throw Object.assign(new Error('Per didelė užklausa'), { status: 413 });
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Neteisingas JSON formatas'), { status: 400 });
  }
}

/** Viename faile tik HTTP ribos – visos taisyklės yra engine.ts ir rules.ts. */
export function createApp(repository = new ScheduleRepository(), engine = new ShiftOptimizationEngine()): Server {
  const here = dirname(fileURLToPath(import.meta.url));
  const page = join(here, '..', 'public', 'index.html');

  return createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    try {
      if (method === 'GET' && path === '/') {
        const html = await readFile(page);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(html);
        return;
      }
      if (method === 'GET' && path === '/api/health') {
        json(res, 200, { status: 'ok' });
        return;
      }
      if (method === 'GET' && path === '/api/tenants') {
        json(res, 200, { tenants: repository.tenants() });
        return;
      }
      if (!path.startsWith('/api/')) {
        json(res, 404, { error: 'NOT_FOUND' });
        return;
      }
      // Demo prieigos raktas, o ne tenantId iš užklausos adreso ar JSON.
      const key = req.headers['x-demo-key'];
      const tenantId = repository.tenantIdFromKey(typeof key === 'string' ? key : undefined);
      if (!tenantId) {
        json(res, 401, { error: 'UNAUTHORIZED', message: 'Trūksta arba neteisingas X-Demo-Key raktas.' });
        return;
      }

      if (method === 'GET' && path === '/api/me') {
        json(res, 200, { tenantId });
        return;
      }
      if (method === 'GET' && path === '/api/employees') {
        json(res, 200, { employees: repository.getEmployees(tenantId) });
        return;
      }
      if (method === 'GET' && path === '/api/shifts') {
        json(res, 200, { shifts: repository.getShifts(tenantId) });
        return;
      }
      if (method === 'GET' && path === '/api/schedule') {
        json(res, 200, { schedule: repository.getSchedule(tenantId) });
        return;
      }
      const employeeRoute = path.match(/^\/api\/employees\/([A-Za-z0-9_-]+)$/);
      if (employeeRoute && method === 'GET') {
        const employee = repository.getEmployee(tenantId, employeeRoute[1]);
        if (!employee) json(res, 404, { error: 'EMPLOYEE_NOT_FOUND' });
        else json(res, 200, { employee });
        return;
      }
      const preferenceRoute = path.match(/^\/api\/employees\/([A-Za-z0-9_-]+)\/preferences$/);
      if (preferenceRoute && method === 'PATCH') {
        const payload = await bodyJson(req);
        if (!payload || typeof payload !== 'object' || !('preferences' in payload) ||
            !Array.isArray(payload.preferences) || payload.preferences.length > 2 ||
            !payload.preferences.every((p: unknown) => ['D', 'V', 'N'].includes(p as string)) ||
            new Set(payload.preferences).size !== payload.preferences.length) {
          json(res, 400, { error: 'INVALID_PREFERENCES', message: 'Įveskite 0–2 skirtingus D, V arba N tipus.' });
          return;
        }
        const updated = repository.updatePreferences(tenantId, preferenceRoute[1], payload.preferences as ShiftType[]);
        if (!updated) json(res, 404, { error: 'EMPLOYEE_NOT_FOUND' });
        else json(res, 200, { employee: updated });
        return;
      }
      if (method === 'POST' && path === '/api/generate') {
        // Nepriimame darbuotojų, pamainų ar tenantId iš kliento – skaitome pagal patikimą kontekstą.
        const result = engine.generate(tenantId, repository.getEmployees(tenantId), repository.getShifts(tenantId));
        repository.saveSchedule(tenantId, result);
        json(res, 200, { schedule: result });
        return;
      }
      if (method === 'POST' && path === '/api/reset') {
        repository.reset(tenantId);
        json(res, 200, { reset: true, tenantId });
        return;
      }
      json(res, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      const err = error as Error & { status?: number };
      const status = err.status ?? 500;
      json(res, status, { error: status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
        message: status >= 500 ? 'Netikėta serverio klaida.' : err.message });
      if (status >= 500) console.error('Serverio klaida:', err);
    }
  });
}
