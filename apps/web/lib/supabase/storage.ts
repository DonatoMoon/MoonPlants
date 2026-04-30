import { env } from '@/lib/env';

export const PLANTS_BUCKET = 'plants';

export function plantPublicUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PLANTS_BUCKET}/${clean}`;
}

export function storagePublicUrl(bucket: string, path: string): string {
  const clean = path.replace(/^\/+/, '');
  return `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${clean}`;
}
