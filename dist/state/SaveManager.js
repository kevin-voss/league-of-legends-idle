export class SaveManager    {
          key        ;
          fallback           = null;

  constructor(key        ) {
    this.key = key;
  }

  load()           {
    const storage = this.getStorage();
    if (!storage) {
      return this.fallback;
    }

    const raw = storage.getItem(this.key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw)     ;
    } catch {
      storage.removeItem(this.key);
      return null;
    }
  }

  save(value   )       {
    const storage = this.getStorage();
    if (!storage) {
      this.fallback = value;
      return;
    }
    storage.setItem(this.key, JSON.stringify(value));
  }

  clear()       {
    const storage = this.getStorage();
    if (!storage) {
      this.fallback = null;
      return;
    }
    storage.removeItem(this.key);
  }

          getStorage()                 {
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
