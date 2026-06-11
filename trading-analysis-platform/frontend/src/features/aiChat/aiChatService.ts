// Llamadas a la API del chat de IA (siempre via apiClient: Bearer + 401).
// La clave de OpenAI vive SOLO en el backend; aqui nunca se toca.

import { apiClient } from "@/services/apiClient";
import type {
  AiConversation,
  AiMessage,
  SendMessagePayload,
  SendMessageResponse,
} from "./aiChatTypes";

export const aiChatService = {
  listConversations(symbol?: string): Promise<AiConversation[]> {
    const q = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
    return apiClient.get(`/ai/conversations${q}`);
  },

  createConversation(symbol: string, title?: string): Promise<AiConversation> {
    return apiClient.post("/ai/conversations", { symbol, title });
  },

  getMessages(conversationId: number): Promise<AiMessage[]> {
    return apiClient.get(`/ai/conversations/${conversationId}/messages`);
  },

  sendMessage(
    conversationId: number,
    payload: SendMessagePayload
  ): Promise<SendMessageResponse> {
    return apiClient.post(`/ai/conversations/${conversationId}/messages`, payload);
  },

  renameConversation(conversationId: number, title: string): Promise<AiConversation> {
    return apiClient.patch(`/ai/conversations/${conversationId}`, { title });
  },

  deleteConversation(conversationId: number): Promise<void> {
    return apiClient.delete(`/ai/conversations/${conversationId}`);
  },
};
