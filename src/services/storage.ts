import { LifeboxItem, Collection, UserProfile } from '../types';

const ITEMS_STORAGE_KEY = 'lifebox_items_v1';
const COLLECTIONS_STORAGE_KEY = 'lifebox_collections_v1';
const PROFILE_STORAGE_KEY = 'lifebox_profile_v1';

// Migration / purge of old demo mock keys so real user accounts start completely clean
if (typeof window !== 'undefined' && localStorage.getItem('lifebox_demo_scrubbed_v3') !== 'true') {
  localStorage.removeItem(ITEMS_STORAGE_KEY);
  localStorage.removeItem(COLLECTIONS_STORAGE_KEY);
  localStorage.removeItem(PROFILE_STORAGE_KEY);
  localStorage.setItem('lifebox_demo_scrubbed_v3', 'true');
}

const DEFAULT_COLLECTIONS: Collection[] = [];

const DEFAULT_PROFILE: UserProfile = {
  username: '',
  email: '',
  avatarUrl: '',
  language: 'English',
  pinCode: '',
  isPinRequiredForLocked: false,
  aiSummariesEnabled: true,
  theme: 'light',
};

const INITIAL_ITEMS: LifeboxItem[] = [];

export const StorageService = {
  getItems(): LifeboxItem[] {
    try {
      const raw = localStorage.getItem(ITEMS_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(INITIAL_ITEMS));
        return INITIAL_ITEMS;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_ITEMS;
    }
  },

  saveItem(item: LifeboxItem): LifeboxItem {
    const items = this.getItems();
    const existingIndex = items.findIndex((i) => i.id === item.id);
    let updated: LifeboxItem[];
    if (existingIndex >= 0) {
      updated = [...items];
      updated[existingIndex] = { ...item, updatedAt: new Date().toISOString() };
    } else {
      updated = [
        {
          ...item,
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...items,
      ];
    }
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
    return item;
  },

  deleteItem(id: string, permanent = false): void {
    const items = this.getItems();
    if (permanent) {
      const filtered = items.filter((i) => i.id !== id);
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(filtered));
    } else {
      const updated = items.map((i) => (i.id === id ? { ...i, isTrash: true } : i));
      localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
    }
  },

  restoreItem(id: string): void {
    const items = this.getItems();
    const updated = items.map((i) => (i.id === id ? { ...i, isTrash: false } : i));
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
  },

  emptyTrash(): void {
    const items = this.getItems().filter((i) => !i.isTrash);
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  },

  toggleFavorite(id: string): void {
    const items = this.getItems();
    const updated = items.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i));
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
  },

  togglePin(id: string): void {
    const items = this.getItems();
    const updated = items.map((i) => (i.id === id ? { ...i, pinned: !i.pinned } : i));
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
  },

  toggleLock(id: string): void {
    const items = this.getItems();
    const updated = items.map((i) => (i.id === id ? { ...i, locked: !i.locked } : i));
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(updated));
  },

  duplicateItem(id: string): LifeboxItem | null {
    const items = this.getItems();
    const target = items.find((i) => i.id === id);
    if (!target) return null;
    const duplicated: LifeboxItem = {
      ...target,
      id: 'item-' + Date.now(),
      title: `${target.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveItem(duplicated);
    return duplicated;
  },

  saveItems(items: LifeboxItem[]): void {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(items));
  },

  getCollections(): Collection[] {
    try {
      const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(DEFAULT_COLLECTIONS));
        return DEFAULT_COLLECTIONS;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_COLLECTIONS;
    }
  },

  saveCollections(cols: Collection[]): void {
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(cols));
  },

  saveCollection(col: Collection): void {
    const cols = this.getCollections();
    const idx = cols.findIndex((c) => c.id === col.id);
    if (idx >= 0) {
      cols[idx] = col;
    } else {
      cols.push(col);
    }
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(cols));
  },

  deleteCollection(id: string): void {
    const cols = this.getCollections().filter((c) => c.id !== id);
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(cols));
  },

  getUserProfile(): UserProfile {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
        return DEFAULT_PROFILE;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  getProfile(): UserProfile {
    return this.getUserProfile();
  },

  saveUserProfile(profile: UserProfile): void {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  },

  saveProfile(profile: UserProfile): void {
    this.saveUserProfile(profile);
  },

  exportBackup(): string {
    const data = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      profile: this.getUserProfile(),
      collections: this.getCollections(),
      items: this.getItems(),
    };
    return JSON.stringify(data, null, 2);
  },

  exportData(): string {
    return this.exportBackup();
  },

  resetToDemo(): void {
    localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(INITIAL_ITEMS));
    localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(DEFAULT_COLLECTIONS));
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
  },

  importBackup(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.items)) {
        localStorage.setItem(ITEMS_STORAGE_KEY, JSON.stringify(data.items));
      }
      if (Array.isArray(data.collections)) {
        localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(data.collections));
      }
      if (data.profile) {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data.profile));
      }
      return true;
    } catch (e) {
      console.error('Backup import failed', e);
      return false;
    }
  },
};
