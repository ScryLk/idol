/**
 * Fila de ações pendentes (offline-tolerant, requisito do M7): o gameplay
 * funciona sem rede; partidas completadas sem API entram aqui e são
 * sincronizadas quando a conexão volta. FIFO, sobrevive a reload.
 */

const KEY = 'idol:pending-matches';
const MAX_QUEUE = 200;

export interface PendingMatch {
  rating: number;
  levelId?: string;
  at: number;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadQueue(): PendingMatch[] {
  try {
    const raw = storage()?.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is PendingMatch =>
        typeof m === 'object' &&
        m !== null &&
        typeof (m as PendingMatch).rating === 'number' &&
        (m as PendingMatch).rating >= 0 &&
        (m as PendingMatch).rating <= 1,
    );
  } catch {
    return [];
  }
}

function save(queue: PendingMatch[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // storage indisponível: fila só em memória nesta sessão
  }
}

export function enqueueMatch(match: PendingMatch): void {
  const queue = loadQueue();
  queue.push(match);
  save(queue);
}

/**
 * Tenta enviar a fila em ordem. Para no PRIMEIRO envio que falhar (mantém a
 * ordem e o restante para a próxima tentativa). Retorna quantos sincronizou.
 */
export async function drainQueue(send: (match: PendingMatch) => Promise<boolean>): Promise<number> {
  const queue = loadQueue();
  let sent = 0;
  for (const match of queue) {
    let ok = false;
    try {
      ok = await send(match);
    } catch {
      ok = false;
    }
    if (!ok) break;
    sent += 1;
  }
  if (sent > 0) save(queue.slice(sent));
  return sent;
}
