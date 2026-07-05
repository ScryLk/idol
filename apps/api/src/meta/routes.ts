import argon2 from 'argon2';
import { z } from 'zod';
import type { App } from '../app.js';
import { authenticate, getUserId } from '../auth/plugin.js';
import { MetaError, type MetaService } from './metaService.js';
import type { MetaRepo } from './repo.js';

const Credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const RegisterBody = Credentials.extend({
  displayName: z.string().min(2).max(32).default('Jogador'),
});

const AuthOk = z.object({ token: z.string(), userId: z.string() });
const ErrorBody = z.object({ error: z.string() });

const TierView = z.object({ id: z.string(), name: z.string(), multiplier: z.number() });
const LivesView = z.object({
  current: z.number().int(),
  max: z.number().int(),
  nextLifeAtMs: z.number().nullable(),
});

const MeResponse = z.object({
  displayName: z.string(),
  fans: z.number().int(),
  tier: TierView,
  wallet: z.number().int(),
  lives: LivesView,
  attributes: z.object({
    dribble: z.number(),
    passing: z.number(),
    finish: z.number(),
    fatigue: z.number(),
  }),
  contracts: z.array(
    z.object({
      id: z.string(),
      sponsorName: z.string(),
      archetype: z.string(),
      matchesRemaining: z.number().int(),
      fansPerMatch: z.number().int(),
      payoutPerMatchNow: z.number().int(),
    }),
  ),
  slots: z.object({ used: z.number().int(), total: z.number().int() }),
});

const SponsorsResponse = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    archetype: z.string(),
    minTier: z.string(),
    fansPerMatch: z.number().int(),
    basePayPerMatch: z.number().int(),
    payoutPerMatchNow: z.number().int(),
    canSign: z.boolean(),
    reason: z.enum(['tier_too_low', 'no_slots', 'duplicate_contract']).nullable(),
  }),
);

const MatchBody = z.object({
  /** Avaliação do lance em [0,1] (0 = mínimo, 1 = perfeito). */
  rating: z.number().min(0).max(1),
  levelId: z.string().optional(),
});

const MatchResponse = z.object({
  fansBefore: z.number().int(),
  fansAfter: z.number().int(),
  tierBefore: z.string(),
  tierAfter: z.string(),
  matchFans: z.number().int(),
  sponsors: z.array(
    z.object({
      sponsorName: z.string(),
      payout: z.number().int(),
      fansDelta: z.number().int(),
      completed: z.boolean(),
    }),
  ),
  wallet: z.number().int(),
  lives: LivesView,
});

const META_ERROR_STATUS: Record<string, number> = {
  user_not_found: 404,
  sponsor_not_found: 404,
  tier_too_low: 409,
  no_slots: 409,
  duplicate_contract: 409,
  no_lives: 409,
};

export function registerMetaRoutes(app: App, service: MetaService, repo: MetaRepo): void {
  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof MetaError) {
      return reply.status(META_ERROR_STATUS[err.code] ?? 500).send({ error: err.code });
    }
    return reply.send(err);
  });

  app.route({
    method: 'POST',
    url: '/auth/register',
    schema: { body: RegisterBody, response: { 201: AuthOk, 409: ErrorBody } },
    handler: async (request, reply) => {
      const { email, password, displayName } = request.body;
      if (await repo.findUserByEmail(email)) {
        return reply.status(409).send({ error: 'email_taken' });
      }
      const user = await repo.createUser(email, await argon2.hash(password), displayName);
      const token = app.jwt.sign({ sub: user.id });
      return reply.status(201).send({ token, userId: user.id });
    },
  });

  app.route({
    method: 'POST',
    url: '/auth/login',
    schema: { body: Credentials, response: { 200: AuthOk, 401: ErrorBody } },
    handler: async (request, reply) => {
      const user = await repo.findUserByEmail(request.body.email);
      if (!user || !(await argon2.verify(user.passwordHash, request.body.password))) {
        return reply.status(401).send({ error: 'invalid_credentials' });
      }
      return { token: app.jwt.sign({ sub: user.id }), userId: user.id };
    },
  });

  app.route({
    method: 'GET',
    url: '/me',
    preHandler: authenticate,
    schema: { response: { 200: MeResponse, 404: ErrorBody } },
    handler: async (request) => service.me(getUserId(request)),
  });

  app.route({
    method: 'GET',
    url: '/sponsors',
    preHandler: authenticate,
    schema: { response: { 200: SponsorsResponse } },
    handler: async (request) => service.listSponsors(getUserId(request)),
  });

  app.route({
    method: 'POST',
    url: '/contracts',
    preHandler: authenticate,
    schema: {
      body: z.object({ sponsorId: z.string() }),
      response: { 201: z.object({ contractId: z.string() }), 404: ErrorBody, 409: ErrorBody },
    },
    handler: async (request, reply) => {
      const result = await service.signContract(getUserId(request), request.body.sponsorId);
      return reply.status(201).send(result);
    },
  });

  app.route({
    method: 'POST',
    url: '/gameplay/match',
    preHandler: authenticate,
    schema: { body: MatchBody, response: { 200: MatchResponse, 409: ErrorBody } },
    handler: async (request) =>
      service.completeMatch(getUserId(request), request.body.rating, request.body.levelId),
  });
}
