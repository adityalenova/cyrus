export class DataCache {
  private static store = new Map<string, { data: any; expiry: number }>();
  static set(key: string, data: any, ttl = 300000) { this.store.set(key, { data, expiry: Date.now() + ttl }); }
  static get(key: string) {
    const entry = this.store.get(key);
    if (!entry || Date.now() > entry.expiry) return null;
    return entry.data;
  }
}
