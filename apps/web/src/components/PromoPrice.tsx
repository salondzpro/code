/**
 * PRIX D'UNE PRESTATION, avec sa PROMOTION en cours (18 nov. 2026) : tag « −20 % », nouveau prix, ancien
 * prix barré. Sans promotion : le prix seul. Une requête en cache pour toute la page.
 */
import { usePromos } from '@salondz/api-client';
import { formatDA, promoFor, promoLabel, promoPrice } from '@salondz/constants';

export function PromoPrice({ salonId, serviceId, priceDa }: { salonId: string; serviceId: string; priceDa: number }) {
  const promos = usePromos().data?.find((x) => x.salonId === salonId)?.promos ?? [];
  const p = promoFor(serviceId, priceDa, promos);
  if (!p) return <>{formatDA(priceDa)}</>;
  return (
    <>
      <span className="promo-tag me-1.5 align-[1px]">{promoLabel(p)}</span>
      {formatDA(promoPrice(priceDa, p))}
      <span className="promo-old">{formatDA(priceDa)}</span>
    </>
  );
}
