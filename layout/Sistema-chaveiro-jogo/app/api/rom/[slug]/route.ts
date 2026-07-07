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

    if (romPath.startsWith('roms/')) {
      console.info('[rom] romPath indicates R2 key:', romPath, 'for game', game.slug);
      const fileBuffer = await fetchRomFromR2(romPath);
      if (fileBuffer) {
        const contentLength = Buffer.byteLength(fileBuffer);
        const filename = `${game.slug}.bin`;
        const headers = {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(contentLength),
          'Cache-Control': 'public, max-age=86400'
        };
        console.info('[rom] Served ROM from R2 for', game.slug, { status: 200, headers, contentLength, filename });
        return new NextResponse(fileBuffer, { headers });
      } else {
        console.warn('[rom] R2 fetch returned no data for', romPath, '; falling back to local if applicable');
      }
    }

    if (!romPath.startsWith('/roms/')) {
      console.error('[rom] Invalid romPath for', game.slug, romPath);
      console.info('[rom] Returning JSON error response', { status: 400, contentType: 'application/json' });
      return NextResponse.json({ error: 'Invalid ROM path' }, { status: 400 });
    }

    const localPath = path.join(process.cwd(), 'public', romPath);

    try {
      console.info('[rom] Attempting to read local ROM file at', localPath);
      const fileBuffer = fs.readFileSync(localPath);
      const contentLength = Buffer.byteLength(fileBuffer);
      const filename = `${game.slug}.bin`;
      const headers = {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(contentLength),
        'Cache-Control': 'public, max-age=86400'
      };
      console.info('[rom] Served ROM from local file for', game.slug, { status: 200, headers, localPath });
      return new NextResponse(fileBuffer, { headers });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[rom] Failed to read local ROM file for', game.slug, localPath, message);
      console.info('[rom] Returning JSON error response', { status: 404, contentType: 'application/json' });
      return NextResponse.json(
        { error: 'ROM file not available', url: null, details: message },
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
