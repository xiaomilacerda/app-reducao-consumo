import type { User } from '@supabase/supabase-js';

/**
 * Admin authorization must come from app_metadata, controlled by the server.
 * NEVER use profiles.is_admin or user_metadata for authorization:
 * existing profile policies allow users to update their own profile.
 */
export function isTrustedAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  const metadata = user.app_metadata;
  if (!metadata) return false;

  return metadata.is_admin === true ||
    metadata.role === 'admin' ||
    (Array.isArray(metadata.roles) && metadata.roles.includes('admin'));
}
