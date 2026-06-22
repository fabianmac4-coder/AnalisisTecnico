// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  useDrawingStyleStore,
  panelStyleKey,
  defaultColorForSlot,
  DEFAULT_SLOT_COLORS,
} from "./drawingStyleStore";

beforeEach(() => {
  localStorage.clear();
  useDrawingStyleStore.setState({ panelStyles: {} });
});

describe("drawingStyleStore — estilo por PANEL (no por timeframe)", () => {
  it("getPanelStyle devuelve un default POR SLOT con su color propio", () => {
    const get = useDrawingStyleStore.getState().getPanelStyle;
    expect(get(7, "chart_1").color).toBe("#f97316"); // naranja
    expect(get(7, "chart_3").color).toBe("#ef4444"); // rojo
    expect(get(7, "chart_6").color).toBe("#eab308"); // amarillo
  });

  it("los seis slots tienen colores por defecto DISTINTOS", () => {
    const get = useDrawingStyleStore.getState().getPanelStyle;
    const colors = ["chart_1", "chart_2", "chart_3", "chart_4", "chart_5", "chart_6"].map(
      (id) => get(7, id).color
    );
    expect(new Set(colors).size).toBe(6); // todos distintos
    expect(colors).toEqual(Object.values(DEFAULT_SLOT_COLORS));
  });

  it("el default NO es una referencia compartida (mutar uno no afecta a otros)", () => {
    const get = useDrawingStyleStore.getState().getPanelStyle;
    const a = get(7, "chart_1");
    a.color = "#000000"; // mutar el objeto devuelto
    a.lineWidth = 99;
    // Otra llamada devuelve un objeto NUEVO intacto.
    expect(get(7, "chart_1").color).toBe("#f97316");
    expect(get(7, "chart_1").lineWidth).toBe(2);
    // Y otro slot no se ve afectado.
    expect(get(7, "chart_2").color).toBe("#3b82f6");
  });

  it("defaultColorForSlot cicla para slots fuera de 1..6", () => {
    expect(defaultColorForSlot("chart_1")).toBe("#f97316");
    expect(defaultColorForSlot("chart_7")).toBe("#f97316"); // (7-1)%6 = 0
  });

  it("el color del panel NO depende del timeframe: persiste tras 'cambiar' range/interval", () => {
    const st = useDrawingStyleStore.getState();
    st.setPanelStyle(7, "chart_1", { color: "#f97316" }); // naranja
    // Cambiar range/interval del panel NO toca el store (está acotado por slot).
    expect(useDrawingStyleStore.getState().getPanelStyle(7, "chart_1").color).toBe("#f97316");
  });

  it("paneles distintos mantienen estilos separados", () => {
    const st = useDrawingStyleStore.getState();
    st.setPanelStyle(7, "chart_1", { color: "#f97316" }); // naranja
    st.setPanelStyle(7, "chart_2", { color: "#3b82f6" }); // azul
    const get = useDrawingStyleStore.getState().getPanelStyle;
    expect(get(7, "chart_1").color).toBe("#f97316");
    expect(get(7, "chart_2").color).toBe("#3b82f6");
  });

  it("el estilo es específico por workspace (C030Id)", () => {
    const st = useDrawingStyleStore.getState();
    st.setPanelStyle(7, "chart_1", { color: "#f97316" }); // workspace A
    st.setPanelStyle(9, "chart_1", { color: "#3b82f6" }); // workspace B
    const get = useDrawingStyleStore.getState().getPanelStyle;
    expect(get(7, "chart_1").color).toBe("#f97316");
    expect(get(9, "chart_1").color).toBe("#3b82f6");
  });

  it("ensurePanelStyle siembra una vez y NO pisa un estilo existente", () => {
    const st = useDrawingStyleStore.getState();
    st.ensurePanelStyle(7, "chart_1", { color: "#eab308" }); // siembra amarillo
    expect(useDrawingStyleStore.getState().getPanelStyle(7, "chart_1").color).toBe("#eab308");
    // Segunda siembra (otro color) NO debe cambiar el ya existente.
    st.ensurePanelStyle(7, "chart_1", { color: "#000000" });
    expect(useDrawingStyleStore.getState().getPanelStyle(7, "chart_1").color).toBe("#eab308");
  });

  it("la clave usa c030Id + slotId (y '_' si falta c030Id)", () => {
    expect(panelStyleKey(7, "chart_1")).toBe("7:chart_1");
    expect(panelStyleKey(undefined, "chart_1")).toBe("_:chart_1");
  });

  it("persiste en localStorage bajo tradingPlatform.drawingPanelStyles", () => {
    useDrawingStyleStore.getState().setPanelStyle(7, "chart_1", { color: "#f97316" });
    const raw = localStorage.getItem("tradingPlatform.drawingPanelStyles");
    expect(raw).toBeTruthy();
    expect(raw).toContain("7:chart_1");
    expect(raw).toContain("#f97316");
  });
});
