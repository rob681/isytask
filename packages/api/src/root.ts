import { router } from "./trpc";
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

export const appRouter = router({
  users: usersRouter,
  clients: clientsRouter,
  services: servicesRouter,
  tasks: tasksRouter,
  comments: commentsRouter,
  notifications: notificationsRouter,
  metrics: metricsRouter,
  config: configRouter,
  search: searchRouter,
  push: pushRouter,
  recurring: recurringRouter,
  audit: auditRouter,
  templates: templatesRouter,
});

export type AppRouter = typeof appRouter;
