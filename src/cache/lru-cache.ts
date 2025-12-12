import LRUCache from "lru-cache";
import { LRU_CACHE_CAPACITY } from "../configs";

const _options = {
  max: LRU_CACHE_CAPACITY,
  //   ttl: 100 * 60 * 10,   i dont think i need this as the node value wont be time dependent
  allowStale: false,
  updateAgeOnGet: true,
  updateAgeOnHas: true,
};

export const lruCache = new LRUCache(_options);
// -------------------------------------------------------
// since LRU Cache is not persistant on reload by default and is in-memory cache we dont need to be worried about clearing
