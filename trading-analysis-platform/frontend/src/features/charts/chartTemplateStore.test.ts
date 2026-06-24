import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock de la API: el store no debe tocar la red en tests.
vi.mock("./userPreferencesApi", () => ({
  userPreferencesApi: {
    getTemplate: vi.fn(),
    saveTemplate: vi.fn(),
    resetTemplate: vi.fn(),
  },
}));

import { userPreferencesApi } from "./userPreferencesApi";
import { useChartTemplateStore } from "./chartTemplateStore";
import type { ChartSlotConfig } from "./chartWorkspaceTypes";

const api = userPreferencesApi as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

const SLOTS: ChartSlotConfig[] = [
  { slotId: "chart_1", range: "1Y", interval: "1h" },
  { slotId: "chart_2", range: "1Y", interval: "1d" },
  { slotId: "chart_3", range: "6M", interval: "1d" },
  { slotId: "chart_4", range: "3M", interval: "1d" },
  { slotId: "chart_5", range: "1M", interval: "1h" },
  { slotId: "chart_6", range: "1W", interval: "30m" },
];

beforeEach(() => {
  vi.clearAllMocks();
  useChartTemplateStore.setState({
    template: null,
    loading: false,
    saving: false,
    error: null,
  });
});

describe("chartTemplateStore", () => {
  it("load trae la plantilla efectiva del backend", async () => {
    api.getTemplate.mockResolvedValue({ source: "SYSTEM", chartSlots: SLOTS, isUserTemplate: false });
    await useChartTemplateStore.getState().load();
    const s = useChartTemplateStore.getState();
    expect(api.getTemplate).toHaveBeenCalledTimes(1);
    expect(s.template?.source).toBe("SYSTEM");
  });

  it("load no recarga si ya hay plantilla (salvo force)", async () => {
    useChartTemplateStore.setState({
      template: { source: "USER", chartSlots: SLOTS, isUserTemplate: true },
    });
    await useChartTemplateStore.getState().load();
    expect(api.getTemplate).not.toHaveBeenCalled();
    api.getTemplate.mockResolvedValue({ source: "SYSTEM", chartSlots: SLOTS, isUserTemplate: false });
    await useChartTemplateStore.getState().load({ force: true });
    expect(api.getTemplate).toHaveBeenCalledTimes(1);
    expect(useChartTemplateStore.getState().template?.source).toBe("SYSTEM");
  });

  it("save persiste y actualiza el estado con source USER", async () => {
    api.saveTemplate.mockResolvedValue({ source: "USER", chartSlots: SLOTS, isUserTemplate: true });
    const result = await useChartTemplateStore.getState().save(SLOTS);
    expect(api.saveTemplate).toHaveBeenCalledWith(SLOTS);
    expect(result?.source).toBe("USER");
    expect(useChartTemplateStore.getState().template?.source).toBe("USER");
  });

  it("reset restablece y actualiza el estado a SYSTEM", async () => {
    useChartTemplateStore.setState({
      template: { source: "USER", chartSlots: SLOTS, isUserTemplate: true },
    });
    api.resetTemplate.mockResolvedValue({ source: "SYSTEM", chartSlots: SLOTS, isUserTemplate: false });
    const result = await useChartTemplateStore.getState().reset();
    expect(api.resetTemplate).toHaveBeenCalledTimes(1);
    expect(result?.source).toBe("SYSTEM");
    expect(useChartTemplateStore.getState().template?.source).toBe("SYSTEM");
  });

  it("save devuelve null y setea error si falla", async () => {
    api.saveTemplate.mockRejectedValue(new Error("boom"));
    const result = await useChartTemplateStore.getState().save(SLOTS);
    expect(result).toBeNull();
    expect(useChartTemplateStore.getState().error).toBe("boom");
  });
});
