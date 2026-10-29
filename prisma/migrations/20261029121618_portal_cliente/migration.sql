-- CreateEnum
CREATE TYPE "ClientVisibility" AS ENUM ('HIDDEN', 'PENDING_RELEASE', 'VISIBLE', 'APPROVAL');

-- CreateEnum
CREATE TYPE "PortalTokenPurpose" AS ENUM ('INVITE', 'LOGIN');

-- CreateEnum
CREATE TYPE "ComponentKind" AS ENUM ('VIDEO', 'CAPTION', 'COVER');

-- CreateEnum
CREATE TYPE "ComponentStatus" AS ENUM ('AWAITING_UPLOAD', 'PENDING', 'APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "clientVisibility" "ClientVisibility" NOT NULL DEFAULT 'HIDDEN',
ADD COLUMN     "reviewDueAt" TIMESTAMP(3),
ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "clientVisible" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "client_portal" (
    "companyId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "visibleStages" TEXT[] DEFAULT ARRAY['PLANNING', 'RECORDING', 'EDITING', 'REVIEW', 'APPROVAL', 'SCHEDULING', 'PUBLISHING']::TEXT[],
    "showAssignee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_portal_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "client_contact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "revokedAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "lastAccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_token" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "PortalTokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_session" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_component" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "kind" "ComponentKind" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "ComponentStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "component_version" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "fileId" TEXT,
    "caption" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "component_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decision" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "timestampMs" INTEGER,
    "contactId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "componentId" TEXT,
    "versionId" TEXT,
    "body" TEXT NOT NULL,
    "timestampMs" INTEGER,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "contactId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_contact_email_idx" ON "client_contact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "client_contact_companyId_email_key" ON "client_contact"("companyId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "portal_token_tokenHash_key" ON "portal_token"("tokenHash");

-- CreateIndex
CREATE INDEX "portal_token_contactId_idx" ON "portal_token"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_session_tokenHash_key" ON "portal_session"("tokenHash");

-- CreateIndex
CREATE INDEX "portal_session_contactId_idx" ON "portal_session"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "post_component_currentVersionId_key" ON "post_component"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "post_component_postId_kind_key" ON "post_component"("postId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "component_version_fileId_key" ON "component_version"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "component_version_componentId_number_key" ON "component_version"("componentId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decision_versionId_key" ON "approval_decision"("versionId");

-- CreateIndex
CREATE INDEX "approval_decision_postId_createdAt_idx" ON "approval_decision"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "review_comment_postId_createdAt_idx" ON "review_comment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_userId_readAt_createdAt_idx" ON "notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "post_companyId_clientVisibility_idx" ON "post"("companyId", "clientVisibility");

-- CreateIndex
CREATE INDEX "post_taskId_idx" ON "post"("taskId");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_portal" ADD CONSTRAINT "client_portal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contact" ADD CONSTRAINT "client_contact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contact" ADD CONSTRAINT "client_contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contact" ADD CONSTRAINT "client_contact_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_token" ADD CONSTRAINT "portal_token_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "client_contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_session" ADD CONSTRAINT "portal_session_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "client_contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_component" ADD CONSTRAINT "post_component_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_component" ADD CONSTRAINT "post_component_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "component_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_version" ADD CONSTRAINT "component_version_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "post_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_version" ADD CONSTRAINT "component_version_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_file"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "component_version" ADD CONSTRAINT "component_version_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "post_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "component_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "client_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "post_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "component_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "client_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comment" ADD CONSTRAINT "review_comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
