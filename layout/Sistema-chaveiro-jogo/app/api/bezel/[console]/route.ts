import { createPublicBezelHandlers } from '@/lib/bezel-routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = createPublicBezelHandlers();

export const GET = handlers.GET;
