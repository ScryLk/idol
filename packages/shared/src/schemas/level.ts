import { z } from 'zod';

/**
 * LevelScript — formato canônico de nível (script_json).
 * Consumido pelo game E pelo editor; validado no seed e na importação.
 *
 * Coordenadas em unidades de campo: x ∈ [0, 720], y ∈ [0, 1280] (resolução base
 * portrait). Tempos em segundos desde o início da fase.
 */

export const Vec2 = z.object({
  x: z.number().min(0).max(720),
  y: z.number().min(0).max(1280),
});
export type Vec2 = z.infer<typeof Vec2>;

/** Ponto de rota com timestamp: o ator deve estar em (x, y) no instante t. */
export const Waypoint = Vec2.extend({
  t: z.number().min(0),
});
export type Waypoint = z.infer<typeof Waypoint>;

export const Route = z
  .array(Waypoint)
  .min(2)
  .refine((wps) => wps.every((wp, i) => i === 0 || wp.t > (wps[i - 1]?.t ?? 0)), {
    message: 'waypoints devem ter t estritamente crescente',
  });
export type Route = z.infer<typeof Route>;

export const Teammate = z.object({
  id: z.string().min(1),
  position: Vec2,
  /** Rota de movimento durante a fase (opcional: companheiro parado). */
  route: Route.optional(),
});
export type Teammate = z.infer<typeof Teammate>;

export const Defender = z.object({
  id: z.string().min(1),
  position: Vec2,
  /** Raio de interceptação da bola, em unidades de campo. */
  interceptRadius: z.number().positive(),
  route: Route.optional(),
});
export type Defender = z.infer<typeof Defender>;

export const Goalkeeper = z.object({
  position: Vec2,
  /** Arco de defesa: ângulo central e meia-abertura, em radianos. */
  arc: z.object({
    centerAngle: z.number(),
    halfAngle: z.number().positive().max(Math.PI),
    radius: z.number().positive(),
  }),
});
export type Goalkeeper = z.infer<typeof Goalkeeper>;

/** Posição onde a Roleta de Drible pode ser acionada durante o lance. */
export const DribbleOpportunity = z.object({
  id: z.string().min(1),
  position: Vec2,
  /** Raio de acionamento ao redor da posição. */
  radius: z.number().positive(),
  /** Atributo de defesa do marcador enfrentado nesta oportunidade. */
  defense: z.number().min(0),
});
export type DribbleOpportunity = z.infer<typeof DribbleOpportunity>;

export const LevelObjective = z.discriminatedUnion('type', [
  z.object({ type: z.literal('goal') }),
  z.object({ type: z.literal('goal_after_passes'), minPasses: z.number().int().positive() }),
  z.object({ type: z.literal('goal_with_dribble'), minDribbles: z.number().int().positive() }),
]);
export type LevelObjective = z.infer<typeof LevelObjective>;

/** Critério avaliável para conceder uma estrela extra (1ª estrela = completar). */
export const StarCriterion = z.object({
  /** Máximo de toques (traços desenhados) permitidos. */
  maxTouches: z.number().int().positive().optional(),
  /** Mínimo de dribles Perfeitos exigidos. */
  minPerfectDribbles: z.number().int().positive().optional(),
  /** Sem usar rewind. */
  noRewind: z.boolean().optional(),
});
export type StarCriterion = z.infer<typeof StarCriterion>;

export const LevelScript = z.object({
  version: z.literal(1),
  metadata: z.object({
    name: z.string().min(1),
    season: z.number().int().positive(),
    ordinal: z.number().int().positive(),
    /** Dificuldade 1 (tutorial) a 5 (elite). */
    difficulty: z.number().int().min(1).max(5),
  }),
  ball: Vec2,
  hero: z.object({ position: Vec2 }),
  teammates: z.array(Teammate),
  defenders: z.array(Defender),
  goalkeeper: Goalkeeper,
  objective: LevelObjective,
  stars: z.object({
    two: StarCriterion,
    three: StarCriterion,
  }),
  dribbleOpportunities: z.array(DribbleOpportunity),
});
export type LevelScript = z.infer<typeof LevelScript>;

/** Valida um script_json arbitrário, lançando ZodError se inválido. */
export function parseLevelScript(raw: unknown): LevelScript {
  return LevelScript.parse(raw);
}
