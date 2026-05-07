import { useState, useEffect, useCallback } from 'react';

export interface InventoryItem {
  partType: string;
  material: string;
  available: number;
}

const STORAGE_KEY = 'precision_inventory';

const DEFAULT_INVENTORY: InventoryItem[] = [
  { partType: 'Flanges', material: 'Titanium', available: 250 },
  { partType: 'Bolts', material: 'Steel', available: 500 },
  { partType: 'Gears', material: 'Steel', available: 100 },
  { partType: 'Bearings', material: 'Steel', available: 300 },
  { partType: 'Shafts', material: 'Aluminum', available: 150 },
  { partType: 'Valves', material: 'Brass', available: 200 },
  { partType: 'Pistons', material: 'Aluminum', available: 80 },
  { partType: 'Brackets', material: 'Steel', available: 400 },
  { partType: 'Plates', material: 'Titanium', available: 60 },
  { partType: 'Rods', material: 'Steel', available: 350 },
];

function loadInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_INVENTORY;
  } catch { return DEFAULT_INVENTORY; }
}

export const useInventory = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>(loadInventory);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
  }, [inventory]);

  /** Find matching inventory item (fuzzy match on part type and material) */
  const findItem = useCallback((partName: string, material: string): InventoryItem | undefined => {
    const pLower = partName.toLowerCase();
    const mLower = material.toLowerCase();
    return inventory.find(item =>
      pLower.includes(item.partType.toLowerCase()) &&
      mLower.includes(item.material.toLowerCase())
    );
  }, [inventory]);

  /**
   * Check if quantity is available.
   * Returns: { ok, available, warning? }
   *  - ok=false if quantity > available
   *  - warning='depleted' if quantity === available (stock will hit 0)
   */
  const checkStock = useCallback((partName: string, material: string, quantity: number): {
    ok: boolean;
    available: number;
    warning?: 'exceeds' | 'depleted';
    item?: InventoryItem;
  } => {
    const item = findItem(partName, material);
    if (!item) {
      // No inventory record — allow (custom/unknown part)
      return { ok: true, available: -1 };
    }
    if (quantity > item.available) {
      return { ok: false, available: item.available, warning: 'exceeds', item };
    }
    if (quantity === item.available) {
      return { ok: true, available: item.available, warning: 'depleted', item };
    }
    return { ok: true, available: item.available, item };
  }, [findItem]);

  /** Deduct stock after order is confirmed */
  const deductStock = useCallback((partName: string, material: string, quantity: number) => {
    setInventory(prev => prev.map(item => {
      const pLower = partName.toLowerCase();
      const mLower = material.toLowerCase();
      if (pLower.includes(item.partType.toLowerCase()) && mLower.includes(item.material.toLowerCase())) {
        return { ...item, available: Math.max(0, item.available - quantity) };
      }
      return item;
    }));
  }, []);

  /** Reset inventory to defaults */
  const resetInventory = useCallback(() => {
    setInventory(DEFAULT_INVENTORY);
  }, []);

  return { inventory, checkStock, deductStock, findItem, resetInventory };
};
