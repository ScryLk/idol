/* eslint-disable no-console */
import { PrismaClient, type FanTierId, type SponsorArchetype } from '@prisma/client';
import argon2 from 'argon2';
import { FAN_TIERS, SPONSOR_ARCHETYPES, parseLevelScript, type LevelScript } from '@idol/shared';

const prisma = new PrismaClient();

/**
 * Gera 20 níveis determinísticos de dificuldade crescente.
 * Todos passam pelo schema Zod LevelScript ANTES de persistir — o seed é
 * também um teste de contrato do formato de nível.
 */
function makeLevel(ordinal: number): LevelScript {
  const difficulty = Math.min(5, Math.ceil(ordinal / 4));
  const defenders = Array.from({ length: Math.min(4, 1 + Math.floor(ordinal / 5)) }, (_, i) => ({
    id: `zagueiro-${i + 1}`,
    position: { x: 160 + i * 130, y: 380 + (i % 2) * 90 },
    interceptRadius: 34 + difficulty * 4,
  }));

  const script: LevelScript = {
    version: 1,
    metadata: {
      name: `Temporada 1 — Lance ${ordinal}`,
      season: 1,
      ordinal,
      difficulty,
    },
    ball: { x: 360, y: 940 },
    hero: { position: { x: 360, y: 990 } },
    teammates: [
      {
        id: 'ponta-esquerda',
        position: { x: 150, y: 700 },
        route: [
          { x: 150, y: 700, t: 0 },
          { x: 210, y: 460, t: 1.2 },
          { x: 300, y: 300, t: 2.4 },
        ],
      },
      {
        id: 'centroavante',
        position: { x: 520, y: 640 },
        route: [
          { x: 520, y: 640, t: 0 },
          { x: 450, y: 380, t: 1.8 },
        ],
      },
    ],
    defenders,
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: {
        centerAngle: Math.PI / 2,
        halfAngle: Math.PI / 4 + difficulty * 0.06,
        radius: 80 + difficulty * 8,
      },
    },
    objective:
      ordinal % 5 === 0
        ? { type: 'goal_with_dribble', minDribbles: 1 }
        : ordinal % 3 === 0
          ? { type: 'goal_after_passes', minPasses: 2 }
          : { type: 'goal' },
    stars: {
      two: { maxTouches: 4 },
      three: { maxTouches: 3, noRewind: true },
    },
    dribbleOpportunities: [
      {
        id: 'drible-central',
        position: { x: 360, y: 480 },
        radius: 60,
        defense: 20 + difficulty * 10,
      },
    ],
  };

  return parseLevelScript(script);
}

async function main(): Promise<void> {
  // --- Usuário de teste ---------------------------------------------------
  const passwordHash = await argon2.hash('idol-dev-123');
  const user = await prisma.user.upsert({
    where: { email: 'teste@idol.dev' },
    update: {},
    create: {
      email: 'teste@idol.dev',
      passwordHash,
      profile: {
        create: {
          displayName: 'Craque de Teste',
          dribble: 30,
          passing: 30,
          finish: 30,
          fans: 500,
          lives: 5,
        },
      },
    },
  });
  console.log(`✓ usuário de teste: ${user.email} (senha: idol-dev-123)`);

  // --- 20 níveis ----------------------------------------------------------
  for (let ordinal = 1; ordinal <= 20; ordinal++) {
    const script = makeLevel(ordinal);
    await prisma.level.upsert({
      where: { season_ordinal: { season: 1, ordinal } },
      update: { scriptJson: script, difficulty: script.metadata.difficulty },
      create: {
        season: 1,
        ordinal,
        difficulty: script.metadata.difficulty,
        name: script.metadata.name,
        scriptJson: script,
      },
    });
  }
  console.log('✓ 20 níveis da temporada 1');

  // --- 3 patrocinadores por tier (5 tiers × 3 arquétipos) ------------------
  const brandNames: Record<string, Record<string, string>> = {
    amador: {
      autentico: 'Padaria do Zé',
      equilibrado: 'AutoEscola Chuteira',
      mercenario: 'Bet Vila FC',
    },
    local: {
      autentico: 'Mercado São Jorge',
      equilibrado: 'Academia Corpo em Campo',
      mercenario: 'LoanShark Crédito',
    },
    regional: {
      autentico: 'Suco Natural Gol',
      equilibrado: 'Rede Regional de Esportes',
      mercenario: 'Turbina Energético',
    },
    nacional: {
      autentico: 'Fundação Craque do Amanhã',
      equilibrado: 'Banco Nacional da Bola',
      mercenario: 'MegaBet Nacional',
    },
    global: {
      autentico: 'ONG Futebol Sem Fronteiras',
      equilibrado: 'AeroGlobal Airlines',
      mercenario: 'CryptoGoal Exchange',
    },
  };

  for (const tier of FAN_TIERS) {
    for (const spec of Object.values(SPONSOR_ARCHETYPES)) {
      const name = brandNames[tier.id]?.[spec.id];
      if (!name) throw new Error(`marca não definida para ${tier.id}/${spec.id}`);
      await prisma.sponsor.upsert({
        where: { name },
        update: {},
        create: {
          name,
          archetype: spec.id.toUpperCase() as SponsorArchetype,
          minTier: tier.id.toUpperCase() as FanTierId,
          fansPerMatch: spec.fansPerMatch,
          basePayPerMatch: spec.basePayPerMatch,
        },
      });
    }
  }
  console.log('✓ 15 patrocinadores (3 arquétipos × 5 tiers)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
