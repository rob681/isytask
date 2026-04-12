import { router } from "./trpc";
import { authRouter } from "./routers/auth.router";
import { usersRouter } from "./routers/users.router";
import { clientsRouter } from "./routers/clients.router";
import { servicesRouter } from "./routers/services.router";
import { tasksRouter } from "./routers/tasks.router";
import { commentsRouter } from "./routers/comments.router";
import { notificationsRouter } from "./routers/notifications.router";
import { metricsRouter } from "./routers/metrics.router";
import { configRouter } from "./routers/config.router";
import { searchRouter } from "./routers/search.router";
import { pushRouter } from "./routers/push.router";
import { recurringRouter } from "./routers/recurring.router";
import { auditRouter } from "./routers/audit.router";
import { templatesRouter } from "./routers/templates.router";
import { agenciesRouter } from "./routers/agencies.router";
import { platformRouter } from "./routers/platform.router";
import { ecosystemRouter } from "./routers/ecosystem.router";
import { billingRouter } from "./routers/billing.router";
import { onboardingRouter } from "./routers/onboarding.router";
import { whatsappRouter } from "./routers/whatsapp.router";
import { riskRouter } from "./routers/risk.router";
import { videoCommentsRouter } from "./routers/video-comments.router";
import { crossAppRouter } from "./routers/cross-app.router";
import { platformConfigRouter } from "./routers/platform-config.router";
import { mfaRouter } from "./routers/mfa.router";

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  clients: clientsRouter,
  services: servicesRouter,
  tasks: tasksRouter,
  comments: commentsRouter,
  videoComments: videoCommentsRouter,
  notifications: notificationsRouter,
  metrics: metricsRouter,
  config: configRouter,
  search: searchRouter,
  push: pushRouter,
  recurring: recurringRouter,
  audit: auditRouter,
  templates: templatesRouter,
  agencies: agenciesRouter,
  platform: platformRouter,
  ecosystem: ecosystemRouter,
  billing: billingRouter,
  onboarding: onboardingRouter,
  whatsapp: whatsappRouter,
  risk: riskRouter,
  crossApp: crossAppRouter,
  platformConfig: platformConfigRouter,
  mfa: mfaRouter,
});

export type AppRouter = typeof appRouter;
