// @vitest-environment jsdom
// Tests del chat de IA: boton, panel por ticker, envio de mensajes y errores.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { AiChatButton } from "./AiChatButton";
import { AiChatPanel } from "./AiChatPanel";
import { useAiChatStore } from "./aiChatStore";
import { useChartStore } from "@/stores/chartStore";

const CONV_AAPL = {
  id: 1,
  title: "Análisis de AAPL",
  symbol: "AAPL",
  yahooSymbol: "AAPL",
  model: "gpt-5.2",
  active: true,
  createdAt: "2026-06-10T10:00:00",
  updatedAt: "2026-06-10T10:00:00",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function resetStores() {
  useAiChatStore.setState({
    isOpen: false,
    activeSymbol: null,
    activeConversationId: null,
    conversationsBySymbol: {},
    messagesByConversation: {},
    loading: false,
    sending: false,
    error: null,
    includeChartContext: true,
    includeDrawings: true,
    includeIndicators: true,
    includeNews: true,
  });
  useChartStore.setState({ activeSymbol: "AAPL" });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  resetStores();
});
afterEach(() => cleanup());

describe("AiChatButton", () => {
  it("se renderiza y abre el chat cargando las conversaciones del ticker activo", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (String(url).includes("/ai/conversations/1/messages")) {
        return Promise.resolve(jsonResponse([]) as never);
      }
      return Promise.resolve(jsonResponse([CONV_AAPL]) as never);
    });
    render(<AiChatButton />);
    const button = screen.getByTestId("ai-chat-button");
    expect(button.textContent).toContain("AI Chat");

    fireEvent.click(button);
    await waitFor(() => expect(useAiChatStore.getState().isOpen).toBe(true));
    const listCall = fetchSpy.mock.calls.find((c) =>
      String(c[0]).includes("/ai/conversations?symbol=AAPL")
    );
    expect(listCall).toBeTruthy();
    // Reabre la conversacion mas reciente automaticamente.
    await waitFor(() =>
      expect(useAiChatStore.getState().activeConversationId).toBe(1)
    );
  });

  it("esta deshabilitado sin ticker activo", () => {
    useChartStore.setState({ activeSymbol: null });
    render(<AiChatButton />);
    expect((screen.getByTestId("ai-chat-button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("AiChatPanel", () => {
  it("muestra el ticker activo en el header del panel", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([]) as never);
    useAiChatStore.setState({ isOpen: true, activeSymbol: "AAPL" });
    render(<AiChatPanel />);
    expect(screen.getByTestId("ai-chat-panel")).toBeTruthy();
    expect(screen.getByText("AAPL")).toBeTruthy();
    // Sin conversaciones: ofrece iniciar una.
    expect(screen.getByTestId("ai-chat-start").textContent).toContain("AAPL");
  });

  it("enviar un mensaje agrega el mensaje del usuario y la respuesta del asistente", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      if (init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            userMessage: {
              id: 10,
              conversationId: 1,
              role: "user",
              content: "¿Tendencia de AAPL?",
              createdAt: "2026-06-10T10:01:00",
            },
            assistantMessage: {
              id: 11,
              conversationId: 1,
              role: "assistant",
              content: "Escenario alcista mientras respete el soporte.",
              createdAt: "2026-06-10T10:01:05",
            },
          }) as never
        );
      }
      return Promise.resolve(jsonResponse([]) as never);
    });
    useAiChatStore.setState({
      isOpen: true,
      activeSymbol: "AAPL",
      activeConversationId: 1,
      conversationsBySymbol: { AAPL: [CONV_AAPL] },
      messagesByConversation: { 1: [] },
    });
    render(<AiChatPanel />);

    fireEvent.change(screen.getByTestId("ai-chat-input"), {
      target: { value: "¿Tendencia de AAPL?" },
    });
    fireEvent.click(screen.getByTestId("ai-chat-send"));

    await waitFor(() => expect(screen.getByText("¿Tendencia de AAPL?")).toBeTruthy());
    expect(
      screen.getByText("Escenario alcista mientras respete el soporte.")
    ).toBeTruthy();

    // Los toggles de contexto viajan en el payload (todos true por defecto).
    const post = fetchSpy.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST"
    );
    const body = JSON.parse((post![1] as RequestInit).body as string);
    expect(body).toEqual({
      message: "¿Tendencia de AAPL?",
      includeChartContext: true,
      includeDrawings: true,
      includeIndicators: true,
      includeNews: true,
    });
  });

  it("los toggles desactivados se reflejan en el payload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      if (init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            userMessage: {
              id: 10,
              conversationId: 1,
              role: "user",
              content: "hola",
              createdAt: "2026-06-10T10:01:00",
            },
            assistantMessage: {
              id: 11,
              conversationId: 1,
              role: "assistant",
              content: "ok",
              createdAt: "2026-06-10T10:01:05",
            },
          }) as never
        );
      }
      return Promise.resolve(jsonResponse([]) as never);
    });
    useAiChatStore.setState({
      isOpen: true,
      activeSymbol: "AAPL",
      activeConversationId: 1,
      conversationsBySymbol: { AAPL: [CONV_AAPL] },
      messagesByConversation: { 1: [] },
    });
    render(<AiChatPanel />);

    fireEvent.click(screen.getByTestId("ai-toggle-includeNews"));
    fireEvent.click(screen.getByTestId("ai-toggle-includeDrawings"));
    fireEvent.change(screen.getByTestId("ai-chat-input"), { target: { value: "hola" } });
    fireEvent.click(screen.getByTestId("ai-chat-send"));

    await waitFor(() => {
      const post = fetchSpy.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "POST"
      );
      expect(post).toBeTruthy();
      const body = JSON.parse((post![1] as RequestInit).body as string);
      expect(body.includeNews).toBe(false);
      expect(body.includeDrawings).toBe(false);
      expect(body.includeChartContext).toBe(true);
    });
  });

  it("muestra error limpio cuando la IA falla (la app no se rompe)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      if (init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(
            { detail: "El servicio de IA no está disponible en este momento" },
            503
          ) as never
        );
      }
      return Promise.resolve(jsonResponse([]) as never);
    });
    useAiChatStore.setState({
      isOpen: true,
      activeSymbol: "AAPL",
      activeConversationId: 1,
      conversationsBySymbol: { AAPL: [CONV_AAPL] },
      messagesByConversation: { 1: [] },
    });
    render(<AiChatPanel />);

    fireEvent.change(screen.getByTestId("ai-chat-input"), { target: { value: "hola" } });
    fireEvent.click(screen.getByTestId("ai-chat-send"));

    await waitFor(() =>
      expect(
        screen.getByText("El servicio de IA no está disponible en este momento")
      ).toBeTruthy()
    );
    expect(screen.getByTestId("ai-chat-panel")).toBeTruthy(); // sigue montado
  });

  it("al cambiar el ticker activo carga las conversaciones de ese simbolo", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([]) as never
    );
    useAiChatStore.setState({ isOpen: true, activeSymbol: "AAPL" });
    render(<AiChatPanel />);

    useChartStore.setState({ activeSymbol: "MSFT" });
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes("/ai/conversations?symbol=MSFT")
      );
      expect(call).toBeTruthy();
    });
    expect(useAiChatStore.getState().activeSymbol).toBe("MSFT");
  });
});
