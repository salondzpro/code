/**
 * Primitives UI — reproduction fidèle des classes du design « Salon DZ Hi-Fi »
 * (voir styles/index.css). Aucune couleur ni rayon en dur ici.
 */
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes, type Ref } from 'react';
import { Link } from 'react-router';
import { useBack } from '@/lib/useBack';
import { Check, ChevronLeft, ChevronRight, Info, X, type LucideIcon } from 'lucide-react';
import type { BookingStatus, CancellationKind, CancelledBy } from '@salondz/constants';

/** Icône aux réglages du design : 22 px, trait 1.6. */
export function I({
  icon: Icon,
  size = 22,
  strokeWidth,
  className = '',
}: {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth ?? (size <= 16 ? 1.7 : 1.6)}
      className={className}
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
      aria-hidden
    />
  );
}

// ---------- Boutons ----------
type Variant = 'ink' | 'g' | 'd' | 'off';
export function Button({
  variant = 'ink',
  sm,
  auto,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; sm?: boolean; auto?: boolean }) {
  const cls = [
    'btn',
    variant !== 'ink' ? variant : '',
    sm ? 'sm' : '',
    auto ? 'auto' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return <button type="button" {...props} className={cls} />;
}

export function LinkButton({
  to,
  variant = 'ink',
  sm,
  auto,
  className = '',
  children,
  ...props
}: {
  to: string;
  variant?: Variant;
  sm?: boolean;
  auto?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const cls = [
    'btn',
    variant !== 'ink' ? variant : '',
    sm ? 'sm' : '',
    auto ? 'auto' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Link to={to} className={cls} {...props}>
      {children}
    </Link>
  );
}

export function IconButton({
  ink,
  lg,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ink?: boolean; lg?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={['ib', ink ? 'ink' : '', lg ? 'lg' : '', className].filter(Boolean).join(' ')}
    />
  );
}

/** `to` = écran parent de secours (lien direct, nouvel onglet) ; sinon on remonte l'historique réel. */
export function BackButton({ to, close, label }: { to?: string; close?: boolean; label?: string }) {
  const back = useBack(to ?? '/');
  return (
    <IconButton lg aria-label={label ?? (close ? 'Fermer' : 'Retour')} onClick={back}>
      <I icon={close ? X : ChevronLeft} />
    </IconButton>
  );
}

/** En-tête d'écran : bouton rond à gauche, texte ou nœud à droite (« Étape 1 sur 3 »). */
export function TopBar({
  backTo,
  close,
  right,
  noBack,
}: {
  backTo?: string;
  close?: boolean;
  right?: ReactNode;
  noBack?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      {noBack ? <span /> : <BackButton to={backTo} close={close} />}
      {typeof right === 'string' ? (
        <span className="text-[0.9375rem] text-muted">{right}</span>
      ) : (
        (right ?? null)
      )}
    </div>
  );
}

// ---------- Pastilles / badges / créneaux ----------
export function Pill({
  on,
  lg,
  soft,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; lg?: boolean; soft?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={['pill', on ? 'on' : '', lg ? 'lg' : '', soft ? 'soft' : '', className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

export type BadgeTone = 'ok' | 'pd' | 'cn' | 'nu' | 'cf' | 'dk';
export function Badge({
  tone,
  dot = true,
  md,
  lg,
  children,
}: {
  tone: BadgeTone;
  dot?: boolean;
  md?: boolean;
  lg?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`badge b-${tone}${lg ? ' lg' : md ? ' md' : ''}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

const STATUS: Record<BookingStatus, { tone: BadgeTone; label: string; dot: boolean }> = {
  confirmed: { tone: 'cf', label: 'Confirmé', dot: true },
  pending: { tone: 'pd', label: 'En attente', dot: true },
  cancelled: { tone: 'cn', label: 'Annulé', dot: true },
  completed: { tone: 'ok', label: 'Terminé', dot: true },
  no_show: { tone: 'dk', label: 'Client absent', dot: true },
};
/** Libellé d'une annulation selon qui l'a faite et qui regarde (client ou salon). */
export function cancelledLabel(
  cancelledBy: CancelledBy | null | undefined,
  viewer: 'client' | 'pro' = 'client',
  kind?: CancellationKind | null,
): string {
  if (kind === 'late') return 'Annulé pour retard';
  if (cancelledBy === 'client')
    return viewer === 'client' ? 'Annulé par vous' : 'Annulé par le client';
  if (cancelledBy === 'salon')
    return viewer === 'client' ? 'Annulé par le salon' : 'Annulé par vous';
  if (cancelledBy === 'system') return 'Demande expirée';
  return 'Annulé';
}

export function StatusBadge({
  status,
  md,
  lg,
  cancelledBy,
  viewer = 'client',
  kind,
}: {
  status: BookingStatus;
  md?: boolean;
  lg?: boolean;
  cancelledBy?: CancelledBy | null;
  viewer?: 'client' | 'pro';
  kind?: CancellationKind | null;
}) {
  const s = STATUS[status];
  return (
    <Badge tone={s.tone} dot={s.dot} md={md} lg={lg}>
      {status === 'cancelled' && cancelledBy !== undefined
        ? cancelledLabel(cancelledBy, viewer, kind)
        : s.label}
    </Badge>
  );
}

export function Slot({
  on,
  off,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; off?: boolean }) {
  return (
    <button
      type="button"
      disabled={off}
      {...props}
      className={['slot', on ? 'on' : '', off ? 'off' : '', className].filter(Boolean).join(' ')}
    />
  );
}

// ---------- Champs ----------
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { err?: boolean; lg?: boolean }
>(function Input({ err, lg, className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={['inp', err ? 'err' : '', lg ? 'lg' : '', className].filter(Boolean).join(' ')}
    />
  );
});

export function Textarea({
  err,
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { err?: boolean }) {
  return (
    <textarea
      {...props}
      className={['inp', err ? 'err' : '', className].filter(Boolean).join(' ')}
      style={{ resize: 'none', minHeight: '6rem' }}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="lbl" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[0.8125rem] text-danger">{error}</p>
      ) : hint ? (
        <p className="t3 mt-1.5">{hint}</p>
      ) : null}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
  onSubmit,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onSubmit?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <form
      className="search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
      />
    </form>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`sw${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    />
  );
}

export function Checkbox({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      className={`chk${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
    >
      {on && <I icon={Check} size={16} />}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.icon && (
            <I icon={o.icon} size={16} className="mr-1.5 inline-block align-[-0.1875rem]" />
          )}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Surfaces ----------
export function Card({
  sm,
  sel,
  className = '',
  onClick,
  children,
  as: As = 'div',
}: {
  sm?: boolean;
  sel?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
  as?: 'div' | 'button' | 'article' | 'section';
}) {
  const cls = [
    'crd',
    sm ? 'sm' : '',
    sel ? 'sel' : '',
    onClick ? 'cursor-pointer text-left' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <As className={cls} onClick={onClick} {...(As === 'button' ? { type: 'button' } : {})}>
      {children}
    </As>
  );
}

/** Encadré d'information gris avec l'icône ⓘ (design .sf). */
export function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div className="sf flex items-start gap-3 text-[0.9375rem] leading-[1.45] text-muted">
      <I icon={Info} size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="h3">{children}</span>
      {right}
    </div>
  );
}

/** Ligne de liste avec chevron (design .li). */
export function ListRow({
  to,
  onClick,
  children,
  right,
  chevron = true,
}: {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
  right?: ReactNode;
  chevron?: boolean;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">{children}</div>
      {right}
      {chevron && <I icon={ChevronRight} size={18} className="shrink-0 text-disabled" />}
    </>
  );
  if (to)
    return (
      <Link to={to} className="li">
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="li w-full text-left">
        {inner}
      </button>
    );
  return <div className="li">{inner}</div>;
}

export function Avatar({
  src,
  name,
  size = 44,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  return (
    <div
      className="av"
      style={{
        width: `${size / 16}rem`,
        height: `${size / 16}rem`,
        fontSize: `${Math.round(size / 2.6) / 16}rem`,
      }}
      aria-hidden
    >
      {src ? <img src={src} alt="" /> : name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

export function Img({
  src,
  alt = '',
  className = '',
  style,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`imgp ${className}`} style={style}>
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" /> : null}
    </div>
  );
}

// ---------- Overlays ----------
export function BottomSheet({
  children,
  grab = true,
  className = '',
  sheetRef,
}: {
  children: ReactNode;
  grab?: boolean;
  className?: string;
  /** Pour mesurer la hauteur réelle de la feuille (espace inférieur du contenu). */
  sheetRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div ref={sheetRef} className={`sheet ${className}`}>
      {grab && <div className="grab" />}
      {children}
    </div>
  );
}

export function Toast({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="toast" role="status">
      {Icon && <I icon={Icon} size={18} />}
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`sk ${className}`} aria-hidden />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="h2">{title}</div>
      {description && <p className="p">{description}</p>}
      {action && <div className="mt-3 w-full">{action}</div>}
    </div>
  );
}
