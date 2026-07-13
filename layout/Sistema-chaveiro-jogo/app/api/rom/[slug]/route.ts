import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { getGameBySlug } from '@/lib/data';
import { getR2BucketName, getR2Endpoint } from '@/lib/r2';
import fs from 'fs';
import path from 'path';

function getEnvVar(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function hasR2Config() {
  return Boolean(
    getEnvVar('R2_ACCESS_KEY_ID') &&
    getEnvVar('R2_SECRET_ACCESS_KEY') &&
    getR2BucketName() &&
    getR2Endpoint()
  );
}

function getFilenameFromRomPath(romPath: string, fallbackSlug: string): string {
  const basename = path.basename(romPath || '');
  return basename || `${fallbackSlug}.bin`;
}

function getContentTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.zip':
      return 'application/zip';
    case '.7z':
      return 'application/x-7z-compressed';
    case '.rar':
      return 'application/vnd.rar';
    case '.iso':
      return 'application/x-iso9660-image';
    case '.bin':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}

async function fetchRomFromR2(objectKey: string) {
  if (!hasR2Config()) {
    console.warn('[rom] R2 not configured - skipping R2 fetch for', objectKey);
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

  console.info('[rom] Attempting R2 fetch for', objectKey, 'bucket=', getR2BucketName());

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: getR2BucketName(),
        Key: objectKey
      })
    );

    const bodyArray = await response.Body?.transformToByteArray();
    const fileBuffer = Buffer.from(bodyArray ?? []);
    return fileBuffer;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[rom] R2 fetch error for', objectKey, message);
    return null;
  }
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const game = await getGameBySlug(params.slug);

    if (!game || !game.active) {
      console.warn('[rom] Game not found or inactive for slug', params.slug);
      console.info('[rom] Returning JSON error response', { status: 404, contentType: 'application/json' });
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const romPath = game.romPath || '';

    // Normalize romPath: remove leading slash if present
    const normalizedRomPath = romPath.startsWith('/') ? romPath.slice(1) : romPath;

    // Try R2 first if romPath looks like it's meant for R2 (starts with roms/)
    if (normalizedRomPath.startsWith('roms/')) {
      console.info('[rom] romPath indicates R2 key:', normalizedRomPath, 'for game', game.slug);
      const fileBuffer = await fetchRomFromR2(normalizedRomPath);
      if (fileBuffer) {
        const filename = getFilenameFromRomPath(normalizedRomPath, game.slug);
        const contentLength = Buffer.byteLength(fileBuffer);
        const headers = {
          'Content-Type': getContentTypeFromFilename(filename),
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(contentLength),
          'Cache-Control': 'public, max-age=86400'
        };
        console.info('[rom] Served ROM from R2 for', game.slug, { status: 200, headers, contentLength, filename });
        return new NextResponse(fileBuffer, { headers });
      } else {
        console.error('[rom] R2 fetch returned no data for', normalizedRomPath);
        console.info('[rom] Returning JSON error response', { status: 404, contentType: 'application/json' });
        return NextResponse.json(
          { error: 'ROM not found on R2', details: `Expected ROM at R2 key: ${normalizedRomPath}` },
          { status: 404 }
        );
      }
    }

    // If romPath doesn't start with roms/ and R2 is not configured, try local filesystem
    const localPath = path.join(process.cwd(), 'public', normalizedRomPath);

    try {
      console.info('[rom] Attempting to read local ROM file at', localPath);
      const fileBuffer = fs.readFileSync(localPath);
      const filename = getFilenameFromRomPath(normalizedRomPath, game.slug);
      const contentLength = Buffer.byteLength(fileBuffer);
      const headers = {
        'Content-Type': getContentTypeFromFilename(filename),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(contentLength),
        'Cache-Control': 'public, max-age=86400'
      };
      console.info('[rom] Served ROM from local file for', game.slug, { status: 200, headers, localPath });
      return new NextResponse(fileBuffer, { headers });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[rom] ROM file not found for', game.slug, localPath, message);
      console.info('[rom] Returning JSON error response', { status: 404, contentType: 'application/json' });
      return NextResponse.json(
        { error: 'ROM file not available', details: `Unable to locate ROM at local path or R2: ${normalizedRomPath}` },
        { status: 404 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[rom] Unexpected error while fetching ROM for', params.slug, message);
    console.info('[rom] Returning JSON error response', { status: 500, contentType: 'application/json' });
    return NextResponse.json({ error: 'Failed to fetch ROM', details: message }, { status: 500 });
  }
}
