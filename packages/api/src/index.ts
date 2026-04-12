export { appRouter, type AppRouter } from "./root";
export { createContext, type Context, type Session } from "./context";
export { router, publicProcedure, protectedProcedure } from "./trpc";
export { uploadFile, deleteFile } from "./lib/supabase-storage";
export {
  streamChatCompletion,
  buildServiceAgentSystemPrompt,
  buildFieldExtractionTools,
} from "./lib/openrouter";
export { handleInboundWhatsApp } from "./lib/whatsapp-inbound";
export {
  sendWhatsAppBusinessMessage,
  validateMetaSignature,
  parseMetaWebhook,
  markMessageAsRead,
} from "./lib/whatsapp-business";
export {
  sendWhatsAppMessageHybrid,
  getWhatsAppProviderStatus,
  type WhatsAppProvider,
} from "./lib/whatsapp-router";
export { analyzeAgencyRisks } from "./lib/risk-engine";
export { runQATesting, type QAReport, type TestResult } from "./lib/qa-testing";

// Shared DB utilities for cross-product features
export {
  getOrganizationByAgencyId,
  getOrCreateOrganization,
  getOrganizationSubscriptions,
  hasActiveSubscription,
  hasActiveSubscriptionByAgency,
  hasBothProducts,
  upsertSubscription as upsertSharedSubscription,
  getSubscription as getSharedSubscription,
  queueEvent,
  fetchPendingEvents,
  markEventDone,
  markEventFailed,
  getEventBusHealth,
  createSSOSession,
  consumeSSOSession,
  cleanupExpiredSSOSessions,
} from "./lib/shared-db";
export type {
  Organization,
  SharedSubscription,
  CrossAppEvent,
  SSOSession,
} from "./lib/shared-db";

export { isWorkingTime, addWorkingHours, workingHoursUntilDue, getWorkingConfig } from "./lib/working-hours";
export type { BusinessHoursConfig, DayConfig, TimeBlock, WorkingConfig } from "./lib/working-hours";

export { audit } from "./lib/audit";
export type { AuditAction, AuditParams } from "./lib/audit";
