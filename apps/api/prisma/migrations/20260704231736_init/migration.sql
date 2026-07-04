-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('MATCH_REWARD', 'SPONSOR_PAYOUT', 'PURCHASE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "FanEventType" AS ENUM ('MATCH_PERFORMANCE', 'DRIBBLE', 'SPONSOR_EFFECT', 'DECAY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SponsorArchetype" AS ENUM ('AUTENTICO', 'EQUILIBRADO', 'MERCENARIO');

-- CreateEnum
CREATE TYPE "FanTierId" AS ENUM ('AMADOR', 'LOCAL', 'REGIONAL', 'NACIONAL', 'GLOBAL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DribbleOutcome" AS ENUM ('PERFECT', 'SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_profiles" (
    "user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "dribble" INTEGER NOT NULL DEFAULT 30,
    "passing" INTEGER NOT NULL DEFAULT 30,
    "finish" INTEGER NOT NULL DEFAULT 30,
    "fatigue" INTEGER NOT NULL DEFAULT 0,
    "dribble_pity" INTEGER NOT NULL DEFAULT 0,
    "dribble_chain" INTEGER NOT NULL DEFAULT 0,
    "fans" INTEGER NOT NULL DEFAULT 500,
    "lives" INTEGER NOT NULL DEFAULT 5,
    "lives_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "script_json" JSONB NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_progress" (
    "user_id" TEXT NOT NULL,
    "level_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "best_score" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "level_progress_pkey" PRIMARY KEY ("user_id","level_id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fan_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "type" "FanEventType" NOT NULL,
    "reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" "SponsorArchetype" NOT NULL,
    "min_tier" "FanTierId" NOT NULL,
    "fans_per_match" INTEGER NOT NULL,
    "base_pay_per_match" INTEGER NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sponsor_id" TEXT NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "matches_remaining" INTEGER NOT NULL DEFAULT 10,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dribble_spins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "level_id" TEXT,
    "outcome" "DribbleOutcome" NOT NULL,
    "roll" DOUBLE PRECISION NOT NULL,
    "chance" DOUBLE PRECISION NOT NULL,
    "perfect_zone" DOUBLE PRECISION NOT NULL,
    "fans_awarded" INTEGER NOT NULL,
    "pity_before" INTEGER NOT NULL,
    "chain_before" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dribble_spins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "levels_season_ordinal_key" ON "levels"("season", "ordinal");

-- CreateIndex
CREATE INDEX "ledger_entries_user_id_created_at_idx" ON "ledger_entries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "fan_events_user_id_created_at_idx" ON "fan_events"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sponsors_name_key" ON "sponsors"("name");

-- CreateIndex
CREATE INDEX "contracts_user_id_status_idx" ON "contracts"("user_id", "status");

-- CreateIndex
CREATE INDEX "dribble_spins_user_id_created_at_idx" ON "dribble_spins"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "player_profiles" ADD CONSTRAINT "player_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_events" ADD CONSTRAINT "fan_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dribble_spins" ADD CONSTRAINT "dribble_spins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
