-- ════════════════════════════════════════════════════════════
-- ISYWEB — Foundation migration (Phase 1)
-- Adds: Product=ISYWEB, 9 enums, 10 tables, Task↔Annotation link
-- ════════════════════════════════════════════════════════════

-- 1) Extend existing Product enum
ALTER TYPE "Product" ADD VALUE IF NOT EXISTS 'ISYWEB';

-- 2) New Isyweb enums
CREATE TYPE "IsywebProjectStatus" AS ENUM ('DRAFT', 'BROCHURE', 'IN_DEVELOPMENT', 'IN_REVIEW', 'APPROVED', 'ARCHIVED');
CREATE TYPE "IsywebSiteType" AS ENUM ('LANDING', 'ONE_PAGE', 'MULTI_PAGE', 'ECOMMERCE', 'WEBAPP', 'BLOG', 'OTHER');
CREATE TYPE "IsywebEmbedMethod" AS ENUM ('SCRIPT', 'PROXY', 'SCREENSHOT');
CREATE TYPE "IsywebPageStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'APPROVED');
CREATE TYPE "IsywebBrochureMode" AS ENUM ('AI_ASSISTED', 'MANUAL');
CREATE TYPE "IsywebRevisionStatus" AS ENUM ('OPEN', 'SUBMITTED', 'IN_PROGRESS', 'RESOLVED', 'APPROVED');
CREATE TYPE "IsywebAnnotationType" AS ENUM ('PIN', 'PRIORITY', 'POSTIT', 'EMOJI', 'CAPTURE', 'ARROW', 'CIRCLE', 'RECTANGLE', 'FREEHAND', 'HIGHLIGHT', 'TEXT');
CREATE TYPE "IsywebViewport" AS ENUM ('DESKTOP', 'TABLET', 'MOBILE');
CREATE TYPE "IsywebAnnotationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');
CREATE TYPE "IsywebAssetCategory" AS ENUM ('LOGO', 'BRAND_MANUAL', 'PRODUCT', 'REFERENCE_LINK', 'IMAGE', 'VIDEO', 'DOCUMENT', 'COPY');

-- 3) Tables

CREATE TABLE "isyweb_projects" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "IsywebProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "siteType" "IsywebSiteType",
    "devUrl" TEXT,
    "productionUrl" TEXT,
    "embedMethod" "IsywebEmbedMethod" NOT NULL DEFAULT 'SCRIPT',
    "widgetApiKey" TEXT NOT NULL,
    "clientAccessExpiresAt" TIMESTAMP(3),
    "maxRevisionRounds" INTEGER NOT NULL DEFAULT 3,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "isyweb_projects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "isyweb_projects_widgetApiKey_key" ON "isyweb_projects"("widgetApiKey");
CREATE INDEX "isyweb_projects_agencyId_status_idx" ON "isyweb_projects"("agencyId", "status");
CREATE INDEX "isyweb_projects_clientId_idx" ON "isyweb_projects"("clientId");

CREATE TABLE "isyweb_pages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT,
    "status" "IsywebPageStatus" NOT NULL DEFAULT 'PLANNED',
    CONSTRAINT "isyweb_pages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "isyweb_pages_projectId_idx" ON "isyweb_pages"("projectId");
ALTER TABLE "isyweb_pages" ADD CONSTRAINT "isyweb_pages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "isyweb_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_brochure_sessions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mode" "IsywebBrochureMode" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "isyweb_brochure_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "isyweb_brochure_sessions_projectId_key" ON "isyweb_brochure_sessions"("projectId");
ALTER TABLE "isyweb_brochure_sessions" ADD CONSTRAINT "isyweb_brochure_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "isyweb_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_brochure_questions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "fieldKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "isyweb_brochure_questions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "isyweb_brochure_questions_sessionId_idx" ON "isyweb_brochure_questions"("sessionId");
ALTER TABLE "isyweb_brochure_questions" ADD CONSTRAINT "isyweb_brochure_questions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "isyweb_brochure_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_brochure_fields" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "isyweb_brochure_fields_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "isyweb_brochure_fields_sessionId_key_key" ON "isyweb_brochure_fields"("sessionId", "key");
CREATE INDEX "isyweb_brochure_fields_sessionId_idx" ON "isyweb_brochure_fields"("sessionId");
ALTER TABLE "isyweb_brochure_fields" ADD CONSTRAINT "isyweb_brochure_fields_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "isyweb_brochure_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_revisions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "IsywebRevisionStatus" NOT NULL DEFAULT 'OPEN',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "isyweb_revisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "isyweb_revisions_projectId_roundNumber_key" ON "isyweb_revisions"("projectId", "roundNumber");
CREATE INDEX "isyweb_revisions_projectId_status_idx" ON "isyweb_revisions"("projectId", "status");
ALTER TABLE "isyweb_revisions" ADD CONSTRAINT "isyweb_revisions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "isyweb_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_annotations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT,
    "revisionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "IsywebAnnotationType" NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "viewport" "IsywebViewport" NOT NULL DEFAULT 'DESKTOP',
    "domSelector" TEXT,
    "domXPath" TEXT,
    "domTextSnippet" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "text" TEXT,
    "emoji" TEXT,
    "priorityLevel" INTEGER,
    "pathData" JSONB,
    "color" TEXT NOT NULL DEFAULT '#ef4444',
    "strokeWidth" INTEGER NOT NULL DEFAULT 3,
    "status" "IsywebAnnotationStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "isyweb_annotations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "isyweb_annotations_projectId_revisionId_idx" ON "isyweb_annotations"("projectId", "revisionId");
CREATE INDEX "isyweb_annotations_pageUrl_viewport_idx" ON "isyweb_annotations"("pageUrl", "viewport");
CREATE INDEX "isyweb_annotations_authorId_idx" ON "isyweb_annotations"("authorId");
ALTER TABLE "isyweb_annotations" ADD CONSTRAINT "isyweb_annotations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "isyweb_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "isyweb_annotations" ADD CONSTRAINT "isyweb_annotations_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "isyweb_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "isyweb_annotations" ADD CONSTRAINT "isyweb_annotations_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "isyweb_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_comments" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "isyweb_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "isyweb_comments_annotationId_idx" ON "isyweb_comments"("annotationId");
ALTER TABLE "isyweb_comments" ADD CONSTRAINT "isyweb_comments_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "isyweb_annotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_snapshots" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "desktopUrl" TEXT NOT NULL,
    "tabletUrl" TEXT,
    "mobileUrl" TEXT,
    "htmlSnapshot" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "isyweb_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "isyweb_snapshots_revisionId_key" ON "isyweb_snapshots"("revisionId");
ALTER TABLE "isyweb_snapshots" ADD CONSTRAINT "isyweb_snapshots_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "isyweb_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_assets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" "IsywebAssetCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT,
    "externalUrl" TEXT,
    "metadata" JSONB,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "isyweb_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "isyweb_assets_projectId_category_idx" ON "isyweb_assets"("projectId", "category");
ALTER TABLE "isyweb_assets" ADD CONSTRAINT "isyweb_assets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "isyweb_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "isyweb_project_assignments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "role" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "isyweb_project_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "isyweb_project_assignments_projectId_colaboradorId_key" ON "isyweb_project_assignments"("projectId", "colaboradorId");
CREATE INDEX "isyweb_project_assignments_projectId_idx" ON "isyweb_project_assignments"("projectId");
ALTER TABLE "isyweb_project_assignments" ADD CONSTRAINT "isyweb_project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "isyweb_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Cross-product link: Task ↔ IsywebAnnotation
ALTER TABLE "tasks" ADD COLUMN "isywebAnnotationId" TEXT;
CREATE UNIQUE INDEX "tasks_isywebAnnotationId_key" ON "tasks"("isywebAnnotationId");
CREATE INDEX "tasks_isywebAnnotationId_idx" ON "tasks"("isywebAnnotationId");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_isywebAnnotationId_fkey" FOREIGN KEY ("isywebAnnotationId") REFERENCES "isyweb_annotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
