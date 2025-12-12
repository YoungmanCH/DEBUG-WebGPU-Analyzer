// Environment configuration

export const POINT_CLOUD_FILES = (process.env as any).POINT_CLOUD_FILES;
export const COPC_FILE = (process.env as any).COPC_FILE;
export const LAS_FILES = (process.env as any).LAS_FILES;
export const XYZ_FILES = (process.env as any).XYZ_FILES;
export const LAZ_FILES = (process.env as any).LAZ_FILES;
export const TIF_FIlES = (process.env as any).TIF_FIlES;

export const P_CACHE = (process.env as any).P_CACHE;
export const P_CACHE_CAPACITY = parseInt((process.env as any).P_CACHE_CAPACITY) || 150;
export const LRU_CACHE_CAPACITY = parseInt((process.env as any).LRU_CACHE_CAPACITY) || 500;

export const LEAF_CAPACITY = parseInt((process.env as any).LEAF_CAPACITY) || 16;
export const BUFFER_CAPACITY = parseInt((process.env as any).BUFFER_CAPACITY) || 16;
export const MAX_BUFFER_NODES = parseInt((process.env as any).MAX_BUFFER_NODES) || 5000;
