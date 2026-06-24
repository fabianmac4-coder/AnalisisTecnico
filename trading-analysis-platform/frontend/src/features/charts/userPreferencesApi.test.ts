import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock del cliente HTTP: la API no debe tocar la red en tests.
vi.mock("@/services/apiClient", () => {
  const client = { get: vi.fn(), post: vi.fn(), delete: vi.fn() };
  return { apiClient: client };
});

import { apiClient } from "@/services/apiClient";
import { userPreferencesApi } from "./userPreferencesApi";

const client = apiClient as unknown as Record<string, ReturnType<typeof vi.fn>>;

const TEMPLATE_PATH = "/user-preferences/default-chart-layout-template";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("userPreferencesApi", () => {
  it("getTemplate normaliza los seis slots y mapea source", async () => {
    client.get.mockResolvedValue({
      source: "USER",
      chartSlots: [{ slotId: "chart_1", range: "1Y", interval: "1h" }],
      isUserTemplate: true,
    });
    const t = await userPreferencesApi.getTemplate();
    expect(client.get).toHaveBeenCalledWith(TEMPLATE_PATH);
    // normalizeChartSlots completa siempre seis slots.
    expect(t.chartSlots).toHaveLength(6);
    expect(t.chartSlots[0]).toMatchObject({ range: "1Y", interval: "1h" });
    expect(t.source).toBe("USER");
    expect(t.isUserTemplate).toBe(true);
  });

  it("getTemplate deriva source de isUserTemplate si el backend no lo envía", async () => {
    client.get.mockResolvedValue({
      chartSlots: [{ slotId: "chart_1", range: "5Y", interval: "1wk" }],
      isUserTemplate: false,
    });
    const t = await userPreferencesApi.getTemplate();
    expect(t.source).toBe("SYSTEM");
    expect(t.isUserTemplate).toBe(false);
  });

  it("saveTemplate envía solo los campos canónicos saneados", async () => {
    client.post.mockResolvedValue({
      chartSlots: [{ slotId: "chart_1", range: "6M", interval: "30m" }],
      isUserTemplate: true,
    });
    const slots = [
      { slotId: "chart_1", range: "6M", interval: "30m", label: "x" },
    ] as Parameters<typeof userPreferencesApi.saveTemplate>[0];
    await userPreferencesApi.saveTemplate(slots);
    const [path, body] = client.post.mock.calls[0];
    expect(path).toBe(TEMPLATE_PATH);
    // Seis slots, cada uno con slotId/range/interval (sin label).
    expect(body.chartSlots).toHaveLength(6);
    expect(body.chartSlots[0]).toEqual({
      slotId: "chart_1",
      range: "6M",
      interval: "30m",
    });
  });

  it("resetTemplate llama al DELETE y marca isUserTemplate=false", async () => {
    client.delete.mockResolvedValue({
      chartSlots: [{ slotId: "chart_1", range: "5Y", interval: "1wk" }],
      isUserTemplate: false,
    });
    const t = await userPreferencesApi.resetTemplate();
    expect(client.delete).toHaveBeenCalledWith(TEMPLATE_PATH);
    expect(t.isUserTemplate).toBe(false);
    expect(t.chartSlots).toHaveLength(6);
  });
});
