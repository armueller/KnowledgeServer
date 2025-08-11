import { LRUCache } from 'lru-cache';
import { config } from '../config.js';
import { logger } from './logger.js';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export class CacheManager {
  private cache: LRUCache<string, CacheEntry>;
  private defaultTTL: number;

  constructor() {
    this.cache = new LRUCache<string, CacheEntry>({
      max: config.cache.maxSize,
      ttl: config.cache.ttl * 1000, // Convert to milliseconds
      updateAgeOnGet: false,
      updateAgeOnHas: false,
    });
    this.defaultTTL = config.cache.ttl * 1000; // Convert to milliseconds
  }

  /**
   * Generate cache key from tool name and parameters
   */
  generateKey(tool: string, params: any): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null) {
          acc[key] = params[key];
        }
        return acc;
      }, {} as any);
    
    return `${tool}:${JSON.stringify(sortedParams)}`;
  }

  /**
   * Get cached value
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug(`Cache miss: ${key}`);
      return null;
    }

    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      logger.debug(`Cache expired: ${key}`);
      this.cache.delete(key);
      return null;
    }

    logger.debug(`Cache hit: ${key}`);
    return entry.data;
  }

  /**
   * Set cached value with optional custom TTL
   */
  set(key: string, data: any, ttl?: number): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    };
    
    this.cache.set(key, entry);
    logger.debug(`Cache set: ${key}`);
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      logger.info('Cache cleared completely');
      return;
    }

    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    if (count > 0) {
      logger.info(`Invalidated ${count} cache entries matching pattern: ${pattern}`);
    }
  }

  /**
   * Invalidate cache by vertex type
   */
  invalidateByType(type: string): void {
    this.invalidate(`"type":"${type}"`);
  }

  /**
   * Invalidate cache by project
   */
  invalidateByProject(project: string): void {
    this.invalidate(`"project":"${project}"`);
  }

  /**
   * Invalidate cache by vertex ID
   */
  invalidateByVertex(vertexId: string): void {
    this.invalidate(`"id":"${vertexId}"`);
    this.invalidate(`"vertexId":"${vertexId}"`);
    this.invalidate(`"fromId":"${vertexId}"`);
    this.invalidate(`"toId":"${vertexId}"`);
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    const stats = this.cache as any;
    const hits = stats.hits || 0;
    const misses = stats.misses || 0;
    const total = hits + misses;
    
    return {
      size: this.cache.size,
      maxSize: config.cache.maxSize,
      hitRate: total > 0 ? hits / total : 0,
    };
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();