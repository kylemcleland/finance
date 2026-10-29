-- Small bits of app state, e.g. the background sorting run's progress.
CREATE TABLE "AppState" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);
