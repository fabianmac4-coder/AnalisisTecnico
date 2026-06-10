import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageDrawingRepository } from "./LocalStorageDrawingRepository";
import type { Drawing } from "@/features/drawings/drawingTypes";

// Polyfill minimo de localStorage para el entorno de pruebas (node).
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

function makeDrawing(id: string, symbol: string): Drawing {
  return {
    id,
    symbol,
    sourceTimeframe: "1Y_1D",
    type: "horizontal",
    points: [{ time: 1, price: 100 }],
    style: { color: "#fff", width: 1, lineStyle: "solid", opacity: 1 },
    visible: true,
    locked: false,
    showOnAllTimeframes: true,
    showOnTimeframes: [],
    createdAt: "",
    updatedAt: "",
    version: 2,
  };
}

describe("LocalStorageDrawingRepository", () => {
  let repo: LocalStorageDrawingRepository;

  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemoryStorage() as unknown as Storage;
    repo = new LocalStorageDrawingRepository();
  });

  it("persiste y lista dibujos por simbolo", async () => {
    await repo.upsert(makeDrawing("d1", "AAPL"));
    await repo.upsert(makeDrawing("d2", "AAPL"));
    await repo.upsert(makeDrawing("d3", "TSLA"));
    expect(await repo.listBySymbol("AAPL")).toHaveLength(2);
    expect(await repo.listBySymbol("TSLA")).toHaveLength(1);
    expect(await repo.listBySymbol("NVDA")).toEqual([]);
  });

  it("actualiza un dibujo existente sin duplicar", async () => {
    await repo.upsert(makeDrawing("d1", "AAPL"));
    const updated = { ...makeDrawing("d1", "AAPL"), visible: false };
    await repo.upsert(updated);
    const list = await repo.listBySymbol("AAPL");
    expect(list).toHaveLength(1);
    expect(list[0].visible).toBe(false);
  });

  it("elimina un dibujo por id", async () => {
    await repo.upsert(makeDrawing("d1", "AAPL"));
    await repo.remove("d1");
    expect(await repo.listBySymbol("AAPL")).toEqual([]);
  });

  it("sobrevive a una nueva instancia (persistencia real)", async () => {
    await repo.upsert(makeDrawing("d1", "AAPL"));
    const repo2 = new LocalStorageDrawingRepository();
    expect(await repo2.listBySymbol("AAPL")).toHaveLength(1);
  });
});
