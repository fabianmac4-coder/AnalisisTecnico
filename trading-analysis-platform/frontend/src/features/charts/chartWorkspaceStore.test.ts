import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ChartWorkspace } from "./chartWorkspaceTypes";

// Mock del servicio HTTP: el store no debe tocar la red en tests.
vi.mock("./chartWorkspaceApi", () => {
  const api = {
    list: vi.fn(),
    create: vi.fn(),
    rename: vi.fn(),
    updateChartSlots: vi.fn(),
    setDefault: vi.fn(),
    remove: vi.fn(),
  };
  return { chartWorkspaceApi: api };
});

import { chartWorkspaceApi } from "./chartWorkspaceApi";
import {
  useChartWorkspaceStore,
  selectActiveWorkspace,
} from "./chartWorkspaceStore";

const api = chartWorkspaceApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function ws(c030Id: number, name: string, isDefault = false): ChartWorkspace {
  return {
    c030Id,
    name,
    symbol: "AAPL",
    c010Id: 1,
    isDefault,
    chartSlots: [],
    configuration: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useChartWorkspaceStore.setState({
    workspacesBySymbol: {},
    activeWorkspaceBySymbol: {},
    loading: false,
    saving: false,
    error: null,
  });
});

describe("chartWorkspaceStore", () => {
  it("loadWorkspaces guarda la lista y activa el default", async () => {
    api.list.mockResolvedValue([ws(1, "A"), ws(2, "B", true)]);
    await useChartWorkspaceStore.getState().loadWorkspaces("aapl");
    const s = useChartWorkspaceStore.getState();
    expect(s.workspacesBySymbol.AAPL).toHaveLength(2);
    expect(s.activeWorkspaceBySymbol.AAPL).toBe(2); // el default
    expect(selectActiveWorkspace(s, "AAPL")?.c030Id).toBe(2);
  });

  it("loadWorkspaces respeta un activo previamente seleccionado", async () => {
    useChartWorkspaceStore.setState({ activeWorkspaceBySymbol: { AAPL: 1 } });
    api.list.mockResolvedValue([ws(1, "A"), ws(2, "B", true)]);
    await useChartWorkspaceStore.getState().loadWorkspaces("AAPL");
    expect(useChartWorkspaceStore.getState().activeWorkspaceBySymbol.AAPL).toBe(1);
  });

  it("createWorkspace agrega y activa el nuevo", async () => {
    useChartWorkspaceStore.setState({ workspacesBySymbol: { AAPL: [ws(1, "A", true)] } });
    api.create.mockResolvedValue(ws(2, "Short-term"));
    await useChartWorkspaceStore.getState().createWorkspace("AAPL", "Short-term");
    const s = useChartWorkspaceStore.getState();
    expect(s.workspacesBySymbol.AAPL.map((w) => w.c030Id)).toEqual([1, 2]);
    expect(s.activeWorkspaceBySymbol.AAPL).toBe(2);
  });

  it("duplicateWorkspace crea copiando el origen", async () => {
    api.create.mockResolvedValue(ws(9, "A copy"));
    await useChartWorkspaceStore
      .getState()
      .duplicateWorkspace("AAPL", 1, "A copy");
    expect(api.create).toHaveBeenCalledWith("AAPL", "A copy", 1);
  });

  it("setActiveWorkspace cambia el activo sin tocar otros simbolos", () => {
    useChartWorkspaceStore.setState({
      workspacesBySymbol: { AAPL: [ws(1, "A"), ws(2, "B")] },
      activeWorkspaceBySymbol: { MSFT: 7 },
    });
    useChartWorkspaceStore.getState().setActiveWorkspace("AAPL", 2);
    const s = useChartWorkspaceStore.getState();
    expect(s.activeWorkspaceBySymbol.AAPL).toBe(2);
    expect(s.activeWorkspaceBySymbol.MSFT).toBe(7);
  });

  it("updateChartSlot reemplaza el workspace con la respuesta del backend", async () => {
    useChartWorkspaceStore.setState({ workspacesBySymbol: { AAPL: [ws(1, "A")] } });
    const updated = {
      ...ws(1, "A"),
      chartSlots: [{ slotId: "chart_1", range: "1Y", interval: "1h" }],
    } as ChartWorkspace;
    api.updateChartSlots.mockResolvedValue(updated);
    await useChartWorkspaceStore
      .getState()
      .updateChartSlot("AAPL", 1, "chart_1", "1Y", "1h");
    expect(api.updateChartSlots).toHaveBeenCalledWith(1, [
      { slotId: "chart_1", range: "1Y", interval: "1h" },
    ]);
    const s = useChartWorkspaceStore.getState();
    expect(s.workspacesBySymbol.AAPL[0].chartSlots[0].interval).toBe("1h");
  });

  it("applyChartSlots reemplaza los seis slots y devuelve los saneados", async () => {
    useChartWorkspaceStore.setState({ workspacesBySymbol: { AAPL: [ws(1, "A")] } });
    const six = [
      { slotId: "chart_1", range: "1Y", interval: "1h" },
      { slotId: "chart_2", range: "1Y", interval: "1d" },
      { slotId: "chart_3", range: "6M", interval: "1d" },
      { slotId: "chart_4", range: "3M", interval: "1d" },
      { slotId: "chart_5", range: "1M", interval: "1h" },
      { slotId: "chart_6", range: "1W", interval: "30m" },
    ];
    const updated = { ...ws(1, "A"), chartSlots: six } as ChartWorkspace;
    api.updateChartSlots.mockResolvedValue(updated);
    const result = await useChartWorkspaceStore
      .getState()
      .applyChartSlots("AAPL", 1, six as ChartWorkspace["chartSlots"]);
    // Envia los SEIS slots al backend.
    expect(api.updateChartSlots).toHaveBeenCalledWith(
      1,
      six.map((s) => ({ slotId: s.slotId, range: s.range, interval: s.interval }))
    );
    expect(result?.[0].interval).toBe("1h");
    const s = useChartWorkspaceStore.getState();
    expect(s.workspacesBySymbol.AAPL[0].chartSlots).toHaveLength(6);
  });

  it("applyChartSlots devuelve null y setea error si el backend falla", async () => {
    useChartWorkspaceStore.setState({ workspacesBySymbol: { AAPL: [ws(1, "A")] } });
    api.updateChartSlots.mockRejectedValue(new Error("boom"));
    const result = await useChartWorkspaceStore
      .getState()
      .applyChartSlots("AAPL", 1, [] as ChartWorkspace["chartSlots"]);
    expect(result).toBeNull();
    expect(useChartWorkspaceStore.getState().error).toBe("boom");
  });

  it("deleteWorkspace recarga y reasigna el activo", async () => {
    useChartWorkspaceStore.setState({
      workspacesBySymbol: { AAPL: [ws(1, "A", true), ws(2, "B")] },
      activeWorkspaceBySymbol: { AAPL: 1 },
    });
    api.remove.mockResolvedValue(undefined);
    api.list.mockResolvedValue([ws(2, "B", true)]); // backend reasigno default
    await useChartWorkspaceStore.getState().deleteWorkspace("AAPL", 1);
    const s = useChartWorkspaceStore.getState();
    expect(s.workspacesBySymbol.AAPL.map((w) => w.c030Id)).toEqual([2]);
    expect(s.activeWorkspaceBySymbol.AAPL).toBe(2);
  });

  it("setDefaultWorkspace marca uno y desmarca el resto en memoria", async () => {
    useChartWorkspaceStore.setState({
      workspacesBySymbol: { AAPL: [ws(1, "A", true), ws(2, "B")] },
    });
    api.setDefault.mockResolvedValue(ws(2, "B", true));
    await useChartWorkspaceStore.getState().setDefaultWorkspace("AAPL", 2);
    const list = useChartWorkspaceStore.getState().workspacesBySymbol.AAPL;
    expect(list.find((w) => w.c030Id === 1)?.isDefault).toBe(false);
    expect(list.find((w) => w.c030Id === 2)?.isDefault).toBe(true);
  });
});
