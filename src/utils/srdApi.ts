export type Category = 'spells' | 'monsters' | 'equipment' | 'feats' | 'items' | 'magic-items' | 'equipment-categories';

const BASE = 'https://www.dnd5eapi.co/api';

type ListResult = { index: string; name: string; url: string };

const cache = new Map<string, any>();

async function fetchJson<T = any>(url: string): Promise<T> {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const data = await res.json();
  cache.set(url, data);
  return data;
}

export async function fetchList(category: Category) {
  // map local category names to API endpoints (basic)
  const mapping: Record<string, string> = {
    items: 'equipment',
    equipment: 'equipment',
    'magic-items': 'magic-items',
    spells: 'spells',
    monsters: 'monsters',
    feats: 'feats',
    'equipment-categories': 'equipment-categories',
  };
  const endpoint = mapping[category] || category;
  const url = `${BASE}/${endpoint}`;
  const data = await fetchJson<{ results: ListResult[] }>(url);
  return data.results;
}

export async function fetchItem(category: Category, index: string) {
  const mapping: Record<string, string> = {
    items: 'equipment',
    equipment: 'equipment',
    'magic-items': 'magic-items',
  };
  const endpoint = mapping[category] || category;
  const url = `${BASE}/${endpoint}/${index}`;
  const data = await fetchJson(url);
  return data;
}

// Fetch equipment categories (list)
export async function fetchEquipmentCategories() {
  const url = `${BASE}/equipment-categories`;
  const data = await fetchJson<{ results: ListResult[] }>(url);
  return data.results;
}

// Fetch items belonging to a single equipment category by category index
export async function fetchEquipmentCategoryItems(categoryIndex: string) {
  const url = `${BASE}/equipment-categories/${categoryIndex}`;
  const data = await fetchJson<any>(url);
  // API returns { equipment: ListResult[] }
  return data.equipment as ListResult[];
}
