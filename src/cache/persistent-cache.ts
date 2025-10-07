import { doesExist } from "../utils/file-manager";

export function getInCache(cache, key) {
  if (!cache.has(key)) return cache;
  const val = cache.get(key);
  cache.delete(key);
  cache.set(key, { date: Date.now(), count: val.count + 1 });
  return cache;
}

export function putInCache(cache, key, value) {
  cache.delete(key);
  if (cache.size == (process.env as any).p_cache_capacity) {
    cache.delete(cache.keys().next().value);
  } else {
    cache.set(key, value);
  }
  return cache;
}

export async function pCache() {
  const [, content]: any = await doesExist((process.env as any).p_cache);
  const cache = _sortObjectIntoMap(content);
  return cache;
}

function _sortObjectIntoMap(object: any) {
  const resultMap = new Map();
  if (!object) return resultMap;
  const sortedArray: any = Object.entries(object).sort(
    (a: any, b: any) => a.date - b.date
  );
  sortedArray.forEach(([key, value]: any) => resultMap.set(key, value));
  return resultMap;
}
