export class SaveManager<T> {
  private key: string;
  private fallback: T | null = null;

  constructor(key: string) {
    this.key = key;
  }

  load(): T | null {
    const storage = this.getStorage();
    if (!storage) {
      return this.fallback;
    }

    const raw = storage.getItem(this.key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      storage.removeItem(this.key);
      return null;
    }
  }

  save(value: T): void {
    const storage = this.getStorage();
    if (!storage) {
      this.fallback = value;
      return;
    }
    storage.setItem(this.key, JSON.stringify(value));
  }

  clear(): void {
    const storage = this.getStorage();
    if (!storage) {
      this.fallback = null;
      return;
    }
    storage.removeItem(this.key);
  }

  private getStorage(): Storage | null {
    try {
      if (typeof localStorage === "undefined") {
        return null;
      }
      return localStorage;
    } catch {
      return null;
    }
  }
}
