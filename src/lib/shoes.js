// v2.0 — Supabase wrapper for the shoes table.
//
// Mileage is computed live by summing distance_km over run_activities for
// each shoe id, so a deleted run actually subtracts from the displayed total.

import { supabase } from './supabase';

const TABLE = 'shoes';

function fromRow(row) {
  if (!row) return null;
  return {
    id:        row.id,
    userId:    row.user_id,
    name:      row.name,
    brand:     row.brand,
    model:     row.model,
    startKm:   Number(row.start_km) || 0,
    retired:   !!row.retired,
    createdAt: row.created_at,
  };
}

export async function listShoes({ includeRetired = true } = {}) {
  let q = supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (!includeRetired) q = q.eq('retired', false);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function getShoe(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw error;
  return fromRow(data);
}

export async function createShoe({ name, brand, model, startKm = 0 }) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, name, brand: brand || null, model: model || null, start_km: Number(startKm) || 0 })
    .select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateShoe(id, patch) {
  const row = {};
  if (patch.name    != null) row.name    = patch.name;
  if (patch.brand   != null) row.brand   = patch.brand;
  if (patch.model   != null) row.model   = patch.model;
  if (patch.startKm != null) row.start_km = Number(patch.startKm) || 0;
  if (patch.retired != null) row.retired = !!patch.retired;
  const { data, error } = await supabase.from(TABLE).update(row).eq('id', id).select().single();
  if (error) throw error;
  return fromRow(data);
}

export async function deleteShoe(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/**
 * Sum of distance_km across all run_activities tagged with each shoe id.
 * Returns a map { shoeId -> km }. Pass the user's shoes list to scope
 * (saves a few extra rows in the response).
 */
export async function fetchShoesMileage(shoes) {
  if (!Array.isArray(shoes) || shoes.length === 0) return {};
  const ids = shoes.map(s => s.id);
  const { data, error } = await supabase
    .from('run_activities')
    .select('shoes_id, distance_km')
    .in('shoes_id', ids);
  if (error) return {};
  const sums = {};
  for (const r of (data || [])) {
    const k = r.shoes_id;
    sums[k] = (sums[k] || 0) + (Number(r.distance_km) || 0);
  }
  // Add the user's manual starting mileage
  for (const s of shoes) {
    sums[s.id] = (sums[s.id] || 0) + (s.startKm || 0);
  }
  return sums;
}
