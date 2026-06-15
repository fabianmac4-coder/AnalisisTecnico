// Llamadas a la API de Portfolio Analysis (siempre vía apiClient con Bearer).
import { apiClient } from "@/services/apiClient";
import type {
  Portfolio,
  PortfolioAnalysis,
  PortfolioCreate,
  PortfolioPosition,
  PositionCreate,
} from "./portfolioTypes";

export const portfolioService = {
  list(): Promise<Portfolio[]> {
    return apiClient.get("/portfolios");
  },
  create(body: PortfolioCreate): Promise<Portfolio> {
    return apiClient.post("/portfolios", body);
  },
  update(c090Id: number, body: Partial<PortfolioCreate>): Promise<Portfolio> {
    return apiClient.patch(`/portfolios/${c090Id}`, body);
  },
  remove(c090Id: number): Promise<void> {
    return apiClient.delete(`/portfolios/${c090Id}`);
  },
  setDefault(c090Id: number): Promise<Portfolio> {
    return apiClient.patch(`/portfolios/${c090Id}/set-default`, {});
  },
  listPositions(c090Id: number): Promise<PortfolioPosition[]> {
    return apiClient.get(`/portfolios/${c090Id}/positions`);
  },
  addPosition(c090Id: number, body: PositionCreate): Promise<PortfolioPosition> {
    return apiClient.post(`/portfolios/${c090Id}/positions`, body);
  },
  updatePosition(c091Id: number, body: Partial<PositionCreate>): Promise<PortfolioPosition> {
    return apiClient.patch(`/portfolios/positions/${c091Id}`, body);
  },
  deletePosition(c091Id: number): Promise<void> {
    return apiClient.delete(`/portfolios/positions/${c091Id}`);
  },
  analysis(c090Id: number, forceRefresh = false): Promise<PortfolioAnalysis> {
    const q = forceRefresh ? "?forceRefresh=true" : "";
    return apiClient.get(`/portfolios/${c090Id}/analysis${q}`);
  },
  aiSummary(c090Id: number): Promise<{ available: boolean; summary: string | null; message?: string }> {
    return apiClient.post(`/portfolios/${c090Id}/ai-summary`, {});
  },
};
