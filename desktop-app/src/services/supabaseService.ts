/**
 * ========================================================================
 * Trading Journal - Unified Supabase Service Layer
 * ========================================================================
 * Generic CRUD service for all Supabase tables with:
 * - Automatic camelCase <-> snake_case conversion
 * - Session checking
 * - Error handling
 */

import { supabase } from '@/lib/supabase';

// ============================================================
// CASE CONVERSION UTILITIES
// ============================================================

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function objectToSnake<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    result[snakeKey] = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
      ? objectToSnake(value)
      : value;
  }
  return result;
}

export function objectToCamel<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)
      ? objectToCamel(value)
      : value;
  }
  return result;
}

// ============================================================
// SESSION HELPERS
// ============================================================

export async function getSessionUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return session.user;
}

export async function requireSession() {
  const user = await getSessionUser();
  if (!user) throw new Error('Nicht eingeloggt');
  return user;
}

// ============================================================
// GENERIC CRUD OPERATIONS
// ============================================================

interface CrudOptions {
  table: string;
  orderBy?: string;
  ascending?: boolean;
}

export async function fetchAll<T>(options: CrudOptions & { filters?: Record<string, any> }): Promise<T[]> {
  const user = await requireSession();

  let query = supabase
    .from(options.table)
    .select('*')
    .eq('user_id', user.id);

  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      query = query.eq(key, value);
    }
  }

  if (options.orderBy) {
    query = query.order(options.orderBy, { ascending: options.ascending ?? false });
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(row => objectToCamel(row) as T);
}

export async function fetchOne<T>(table: string, id: string): Promise<T | null> {
  const user = await requireSession();

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data ? objectToCamel(data) as T : null;
}

export async function insertOne<T extends Record<string, any>>(
  table: string,
  data: T,
): Promise<any> {
  const user = await requireSession();

  const payload = objectToSnake(data);
  payload.user_id = user.id;

  // Remove undefined values
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }

  const { data: result, error } = await supabase
    .from(table)
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return result ? objectToCamel(result) : null;
}

export async function updateOne<T extends Record<string, any>>(
  table: string,
  id: string,
  data: T,
): Promise<any> {
  const user = await requireSession();

  const payload = objectToSnake(data);
  delete payload.id;
  delete payload.user_id;
  delete payload.created_at;
  payload.updated_at = new Date().toISOString();

  const { data: result, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return result ? objectToCamel(result) : null;
}

export async function deleteOne(table: string, id: string): Promise<boolean> {
  const user = await requireSession();

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) throw error;
  return true;
}

export async function upsertOne<T extends Record<string, any>>(
  table: string,
  data: T,
  uniqueColumns: string[] = ['id'],
): Promise<any> {
  const user = await requireSession();

  const payload = objectToSnake(data);
  payload.user_id = user.id;
  payload.updated_at = new Date().toISOString();

  const { data: result, error } = await supabase
    .from(table)
    .upsert([payload], { onConflict: uniqueColumns.map(toSnakeCase).join(',') })
    .select()
    .single();

  if (error) throw error;
  return result ? objectToCamel(result) : null;
}
