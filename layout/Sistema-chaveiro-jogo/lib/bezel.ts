import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client
} from '@aws-sdk/client-s3';
import { bezelObjectKey, type BezelConsoleId } from '@/lib/bezel-console';
import { createR2Client, getR2BucketName } from '@/lib/r2';

// Console bezel storage (0002F SF04). Server only. Every function here returns a result kind
// and never throws: an SDK error becomes `missing` (object absent) or `failed` (any other error).
// Nothing is written to public/ or MongoDB. Logs carry the object key and error.name only.

export type BezelR2Client = Pick<S3Client, 'send'>;
export type BezelStorage = { client: BezelR2Client; bucket: string };

export type BezelWriteResult = { kind: 'saved'; key: string } | { kind: 'failed' };
export type BezelReadResult =
  | { kind: 'found'; body: Uint8Array; etag: string | null; contentLength: number }
  | { kind: 'not-modified'; etag: string }
  | { kind: 'missing' }
  | { kind: 'failed' };
export type BezelDeleteResult = { kind: 'deleted' } | { kind: 'missing' } | { kind: 'failed' };

// The fake client in tests/bezel.test.ts accepts any command; the real S3Client is typed per
// command. Sending through this signature keeps both paths on one call site.
type LooseSend = (command: unknown) => Promise<unknown>;

function send(storage: BezelStorage, command: unknown): Promise<unknown> {
  return (storage.client.send as unknown as LooseSend).call(storage.client, command);
}

function errorName(error: unknown): string {
  if (error && typeof error === 'object' && typeof (error as { name?: unknown }).name === 'string') {
    return (error as { name: string }).name;
  }
  return 'UnknownError';
}

// True for NoSuchKey (GetObject), NotFound (HeadObject) or any SDK error with HTTP status 404.
export function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: unknown }).name;
  if (name === 'NoSuchKey' || name === 'NotFound') return true;
  const metadata = (error as { $metadata?: { httpStatusCode?: unknown } }).$metadata;
  return Boolean(metadata && metadata.httpStatusCode === 404);
}

function stripWeak(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith('W/') ? trimmed.slice(2) : trimmed;
}

// Weak comparison per RFC 9110 If-None-Match: `*`, comma lists and a `W/` prefix on either side.
export function etagMatches(ifNoneMatch: string | null, etag: string | null): boolean {
  if (ifNoneMatch === null || etag === null) return false;
  const header = ifNoneMatch.trim();
  if (!header) return false;
  if (header === '*') return true;
  const current = stripWeak(etag);
  if (!current) return false;
  return header
    .split(',')
    .map((candidate) => stripWeak(candidate))
    .some((candidate) => candidate === '*' || candidate === current);
}

// Null when R2 is not configured; callers answer 503 (write) or 404 (read).
export function getBezelStorage(): BezelStorage | null {
  const client = createR2Client();
  if (!client) return null;
  const bucket = getR2BucketName();
  if (!bucket) return null;
  return { client, bucket };
}

export async function putBezel(
  storage: BezelStorage,
  id: BezelConsoleId,
  bytes: Uint8Array
): Promise<BezelWriteResult> {
  const key = bezelObjectKey(id);
  try {
    await send(
      storage,
      new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: bytes, ContentType: 'image/png' })
    );
    return { kind: 'saved', key };
  } catch (error) {
    console.error('[r2] bezel put failed', key, errorName(error));
    return { kind: 'failed' };
  }
}

type GetObjectBody = {
  transformToByteArray?: () => Promise<Uint8Array>;
  destroy?: () => void;
};

type GetObjectResponse = { ETag?: string; ContentLength?: number; Body?: GetObjectBody };

export async function getBezel(
  storage: BezelStorage,
  id: BezelConsoleId,
  ifNoneMatch: string | null
): Promise<BezelReadResult> {
  const key = bezelObjectKey(id);
  try {
    const response = (await send(
      storage,
      new GetObjectCommand({ Bucket: storage.bucket, Key: key })
    )) as GetObjectResponse;
    const etag = typeof response.ETag === 'string' && response.ETag ? response.ETag : null;

    if (etag !== null && etagMatches(ifNoneMatch, etag)) {
      // Close the stream without reading it; the 304 carries no body.
      try {
        response.Body?.destroy?.();
      } catch {
        // A failed close does not change the answer.
      }
      return { kind: 'not-modified', etag };
    }

    if (!response.Body || typeof response.Body.transformToByteArray !== 'function') {
      console.error('[r2] bezel get returned no body', key, 'EmptyBody');
      return { kind: 'failed' };
    }

    const body = await response.Body.transformToByteArray();
    return { kind: 'found', body, etag, contentLength: body.byteLength };
  } catch (error) {
    if (isMissingObjectError(error)) {
      return { kind: 'missing' };
    }
    console.error('[r2] bezel get failed', key, errorName(error));
    return { kind: 'failed' };
  }
}

// R2 DeleteObject succeeds on an absent key, so HeadObject decides `missing` first.
export async function deleteBezel(storage: BezelStorage, id: BezelConsoleId): Promise<BezelDeleteResult> {
  const key = bezelObjectKey(id);
  try {
    await send(storage, new HeadObjectCommand({ Bucket: storage.bucket, Key: key }));
  } catch (error) {
    if (isMissingObjectError(error)) {
      return { kind: 'missing' };
    }
    console.error('[r2] bezel head failed', key, errorName(error));
    return { kind: 'failed' };
  }

  try {
    await send(storage, new DeleteObjectCommand({ Bucket: storage.bucket, Key: key }));
    return { kind: 'deleted' };
  } catch (error) {
    console.error('[r2] bezel delete failed', key, errorName(error));
    return { kind: 'failed' };
  }
}
