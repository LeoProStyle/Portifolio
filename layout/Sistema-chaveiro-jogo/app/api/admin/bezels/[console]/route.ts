import { createAdminBezelHandlers } from '@/lib/bezel-routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handlers = createAdminBezelHandlers();

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
