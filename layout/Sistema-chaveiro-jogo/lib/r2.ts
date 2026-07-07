import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { mockRooms } from '@/lib/mock-data';
import type { Room } from '@/models/game';

function getEnvVar(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

export function getR2Endpoint(): string {
  const explicit = getEnvVar('R2_ENDPOINT');
  if (explicit) {
    return explicit;
  }

  const accountId = getEnvVar('R2_ACCOUNT_ID');
  if (accountId) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }

  return '';
}

export function getR2BucketName(): string {
  return getEnvVar('R2_BUCKET_NAME');
}

export function getR2RoomsKey(): string {
  return getEnvVar('R2_ROOMS_KEY') || 'rooms.json';
}

export function buildRomObjectKey(slug: string, originalName: string): string {
  const normalizedSlug = slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const safeName = originalName
    .trim()
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'game';

  const extensionMatch = safeName.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : 'bin';

  return `roms/${normalizedSlug || 'game'}.${extension}`;
}

function hasR2Config() {
  return Boolean(
    getEnvVar('R2_ACCESS_KEY_ID') &&
    getEnvVar('R2_SECRET_ACCESS_KEY') &&
    getR2BucketName() &&
    getR2Endpoint()
  );
}

export async function readRoomsFromR2(): Promise<Room[] | null> {
  if (!hasR2Config()) {
    console.info('[r2] R2 not configured; skipping readRoomsFromR2');
    return null;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: getEnvVar('R2_ACCESS_KEY_ID'),
      secretAccessKey: getEnvVar('R2_SECRET_ACCESS_KEY')
    }
  });

  try {
    console.info('[r2] Attempting to read rooms key from R2', getR2RoomsKey(), 'bucket=', getR2BucketName());
    const response = await client.send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: getR2RoomsKey()
      })
    );

    const body = await response.Body?.transformToString();
    if (!body) {
      return null;
    }

    const parsed = JSON.parse(body) as Room[];
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[r2] Cloudflare R2 readRoomsFromR2 failed:', message);
    return null;
  }
}

export async function getRoomsFromStorage(): Promise<Room[]> {
  const roomsFromR2 = await readRoomsFromR2();
  return roomsFromR2 ?? mockRooms;
}

function saveRomFileLocally(fileBuffer: Buffer, slug: string, originalName: string): string {
  const romsDir = path.join(process.cwd(), 'public', 'roms');
  fs.mkdirSync(romsDir, { recursive: true });

  const objectKey = buildRomObjectKey(slug, originalName);
  const fileName = path.basename(objectKey);
  const localPath = path.join(romsDir, fileName);

  fs.writeFileSync(localPath, fileBuffer);
  return `/roms/${fileName}`;
}

export async function uploadRomToR2(fileBuffer: Buffer, slug: string, originalName: string): Promise<string> {
  if (!hasR2Config()) {
    return saveRomFileLocally(fileBuffer, slug, originalName);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: getR2Endpoint(),
    credentials: {
      accessKeyId: getEnvVar('R2_ACCESS_KEY_ID'),
      secretAccessKey: getEnvVar('R2_SECRET_ACCESS_KEY')
    }
  });

  const objectKey = buildRomObjectKey(slug, originalName);
  console.info('[r2] Uploading ROM to R2', objectKey, 'bucket=', getR2BucketName());

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: getR2BucketName(),
        Key: objectKey,
        Body: fileBuffer,
        ContentType: 'application/octet-stream'
      })
    );

    return objectKey;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Cloudflare R2 upload failed:', message);
    return saveRomFileLocally(fileBuffer, slug, originalName);
  }
}
