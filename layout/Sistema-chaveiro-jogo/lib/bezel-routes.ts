import { NextResponse } from 'next/server';
import { requireAdmin, type SessionReader } from '@/lib/auth-guard';
import {
  BEZEL_MAX_BYTES,
  BEZEL_MAX_REQUEST_BYTES,
  hasPngSignature,
  isBezelConsoleId,
  type BezelConsoleId
} from '@/lib/bezel-console';
import { deleteBezel, getBezel, getBezelStorage, putBezel, type BezelStorage } from '@/lib/bezel';

// Route handler factories for console bezels (0002F SF04). The route files under app/api only
// bind these handlers; tests call the factories with a fake storage and an injected readSession,
// so next-auth never loads. No MongoDB and no public/ writes: R2 is the only store (RN03).
// Logs: `[bezel]` with method, console id (only when it is in the closed list) and status.
// Never bytes, file names, credentials or session data.

export type BezelRouteContext = { params: { console: string } };

export type BezelRouteDeps = {
  getStorage: () => BezelStorage | null;
  readSession?: SessionReader;
};

type Handler = (request: Request, context: BezelRouteContext) => Promise<Response>;

const NO_STORE = 'no-store';
const NO_CACHE = 'no-cache';

function jsonError(status: number, error: string, cacheControl?: string): Response {
  const init: ResponseInit = cacheControl ? { status, headers: { 'Cache-Control': cacheControl } } : { status };
  return NextResponse.json({ error }, init);
}

function logStatus(method: string, id: BezelConsoleId | null, status: number) {
  const entry = { console: id ?? 'unknown', status };
  if (status >= 500) {
    console.error('[bezel]', method, entry);
  } else if (status >= 400) {
    console.warn('[bezel]', method, entry);
  } else {
    console.info('[bezel]', method, entry);
  }
}

function resolveDeps(deps?: Partial<BezelRouteDeps>): BezelRouteDeps {
  return { getStorage: deps?.getStorage ?? getBezelStorage, readSession: deps?.readSession };
}

// requireAdmin keeps its own default reader (lazy '@/auth') when none is injected.
function guard(request: Request, readSession: SessionReader | undefined) {
  return readSession ? requireAdmin(request, readSession) : requireAdmin(request);
}

// Content-Length present and over the multipart bound: refuse without reading the body.
function declaredLengthTooLarge(request: Request): boolean {
  const header = request.headers.get('content-length');
  if (header === null) return false;
  const length = Number(header);
  return Number.isFinite(length) && length > BEZEL_MAX_REQUEST_BYTES;
}

function isMultipart(request: Request): boolean {
  const contentType = request.headers.get('content-type') ?? '';
  return contentType.toLowerCase().includes('multipart/form-data');
}

export function createAdminBezelHandlers(deps?: Partial<BezelRouteDeps>): { POST: Handler; DELETE: Handler } {
  const { getStorage, readSession } = resolveDeps(deps);

  async function POST(request: Request, context: BezelRouteContext): Promise<Response> {
    let id: BezelConsoleId | null = null;
    try {
      const auth = await guard(request, readSession);
      if (!auth.ok) return auth.response;

      const raw = context.params.console;
      if (!isBezelConsoleId(raw)) {
        logStatus('POST', null, 404);
        return jsonError(404, 'Unknown console');
      }
      id = raw;

      const storage = getStorage();
      if (!storage) {
        logStatus('POST', id, 503);
        return jsonError(503, 'Storage is not configured');
      }

      if (declaredLengthTooLarge(request)) {
        logStatus('POST', id, 413);
        return jsonError(413, 'File is over 2 MB');
      }

      if (!isMultipart(request)) {
        logStatus('POST', id, 400);
        return jsonError(400, 'No file');
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        logStatus('POST', id, 400);
        return jsonError(400, 'No file');
      }

      // file.name is never read: the R2 key comes only from the console id (RN02).
      const file = form.get('file');
      if (!(file instanceof File) || file.size === 0) {
        logStatus('POST', id, 400);
        return jsonError(400, 'No file');
      }

      if (file.size > BEZEL_MAX_BYTES) {
        logStatus('POST', id, 413);
        return jsonError(413, 'File is over 2 MB');
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasPngSignature(bytes)) {
        logStatus('POST', id, 415);
        return jsonError(415, 'File is not a PNG');
      }

      const result = await putBezel(storage, id, bytes);
      if (result.kind === 'failed') {
        logStatus('POST', id, 502);
        return jsonError(502, 'Storage failed');
      }

      logStatus('POST', id, 201);
      return NextResponse.json({ console: id, key: result.key }, { status: 201 });
    } catch (error) {
      console.error('[bezel]', 'POST', { console: id ?? 'unknown', status: 500, error: errorName(error) });
      return jsonError(500, 'Failed to save bezel');
    }
  }

  async function DELETE(request: Request, context: BezelRouteContext): Promise<Response> {
    let id: BezelConsoleId | null = null;
    try {
      const auth = await guard(request, readSession);
      if (!auth.ok) return auth.response;

      const raw = context.params.console;
      if (!isBezelConsoleId(raw)) {
        logStatus('DELETE', null, 404);
        return jsonError(404, 'Unknown console');
      }
      id = raw;

      const storage = getStorage();
      if (!storage) {
        logStatus('DELETE', id, 503);
        return jsonError(503, 'Storage is not configured');
      }

      const result = await deleteBezel(storage, id);
      if (result.kind === 'missing') {
        logStatus('DELETE', id, 404);
        return jsonError(404, 'No bezel for this console');
      }
      if (result.kind === 'failed') {
        logStatus('DELETE', id, 502);
        return jsonError(502, 'Storage failed');
      }

      logStatus('DELETE', id, 204);
      return new Response(null, { status: 204 });
    } catch (error) {
      console.error('[bezel]', 'DELETE', { console: id ?? 'unknown', status: 500, error: errorName(error) });
      return jsonError(500, 'Failed to remove bezel');
    }
  }

  return { POST, DELETE };
}

// One body for every absent bezel (id outside list, R2 not configured, object missing).
function bezelNotFound(): Response {
  return jsonError(404, 'Bezel not found', NO_STORE);
}

export function createPublicBezelHandlers(deps?: Partial<BezelRouteDeps>): { GET: Handler } {
  // readSession is accepted for a uniform deps shape and never called: the read is public (RN01).
  const { getStorage } = resolveDeps(deps);

  async function GET(request: Request, context: BezelRouteContext): Promise<Response> {
    let id: BezelConsoleId | null = null;
    try {
      const raw = context.params.console;
      if (!isBezelConsoleId(raw)) {
        logStatus('GET', null, 404);
        return bezelNotFound();
      }
      id = raw;

      const storage = getStorage();
      if (!storage) {
        logStatus('GET', id, 404);
        return bezelNotFound();
      }

      const result = await getBezel(storage, id, request.headers.get('if-none-match'));
      switch (result.kind) {
        case 'missing':
          logStatus('GET', id, 404);
          return bezelNotFound();
        case 'failed':
          logStatus('GET', id, 502);
          return jsonError(502, 'Storage failed', NO_STORE);
        case 'not-modified':
          return new Response(null, {
            status: 304,
            headers: { ETag: result.etag, 'Cache-Control': NO_CACHE }
          });
        case 'found': {
          const headers: Record<string, string> = {
            'Content-Type': 'image/png',
            'Cache-Control': NO_CACHE,
            'Content-Length': String(result.contentLength),
            'X-Content-Type-Options': 'nosniff'
          };
          if (result.etag !== null) headers.ETag = result.etag;
          return new Response(result.body, { status: 200, headers });
        }
      }
    } catch (error) {
      console.error('[bezel]', 'GET', { console: id ?? 'unknown', status: 500, error: errorName(error) });
      return jsonError(500, 'Failed to read bezel', NO_STORE);
    }
  }

  return { GET };
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}
