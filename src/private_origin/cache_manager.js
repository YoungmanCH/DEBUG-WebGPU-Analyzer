import { doesExist } from "./file_manager";

export function getInCache(cache, key) {
  if (!cache.has(key)) return cache;
  const val = cache.get(key);
  cache.delete(key);
  cache.set(key, { date: Date.now(), count: val.count + 1 });
  return cache;
}

export function mapIntoJSON(map) {
  return JSON.stringify(Object.fromEntries(map));
}

export async function pCache() {
  const [, content] = await doesExist(process.env.p_cache);
  const cache = _sortObjectIntoMap(content);
  return cache;
}

export function putInCache(cache, key, value) {
  cache.delete(key);
  if (cache.size == process.env.p_cache_capacity) {
    cache.delete(cache.keys().next().value);
  } else {
    cache.set(key, value);
  }
  return cache;
}

function _sortObjectIntoMap(object) {
  const resultMap = new Map();
  if (!object) return resultMap;
  const sortedArray = Object.entries(object).sort((a, b) => a.date - b.date);
  sortedArray.forEach(([key, value]) => resultMap.set(key, value));
  return resultMap;
}
