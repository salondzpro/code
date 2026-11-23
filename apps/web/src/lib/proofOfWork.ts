/**
 * PREUVE DE TRAVAIL anti-robots des codes WhatsApp (23 nov. 2026, `apps/api/src/lib/phoneOtp.ts`).
 * Trouve `nonce` tel que SHA-256(`<casse-tête>:<numéro>:<nonce>`) commence par `bits` bits à zéro.
 * ≈ 33 000 essais pour 15 bits : quelques dixièmes de seconde sur un téléphone, par lots en
 * parallèle (`crypto.subtle`), sans bloquer l'écran. Invisible pour la personne ; ruineux pour un
 * robot qui voudrait des milliers de codes.
 */
function zeros(buf: ArrayBuffer): number {
  const b = new Uint8Array(buf);
  let n = 0;
  for (const x of b) {
    if (x === 0) {
      n += 8;
      continue;
    }
    return n + Math.clz32(x) - 24;
  }
  return n;
}

export async function solveProof(challenge: string, phone: string, bits: number): Promise<string> {
  const enc = new TextEncoder();
  const prefix = `${challenge}:${phone}:`;
  const LOT = 512;
  for (let base = 0; base < 50_000_000; base += LOT) {
    const essais = Array.from({ length: LOT }, (_, i) => String(base + i));
    const hashes = await Promise.all(essais.map((n) => crypto.subtle.digest('SHA-256', enc.encode(prefix + n))));
    const i = hashes.findIndex((h) => zeros(h) >= bits);
    if (i >= 0) return essais[i] as string;
  }
  throw new Error('Preuve introuvable');
}
