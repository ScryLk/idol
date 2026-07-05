import type { FastifyReply, FastifyRequest } from 'fastify';

/** preHandler: exige JWT válido (Authorization: Bearer <token>). */
export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.status(401).send({ error: 'unauthorized' });
  }
}

/** Id do usuário autenticado (claim `sub` do JWT). */
export function getUserId(request: FastifyRequest): string {
  return (request.user as { sub: string }).sub;
}
