/**
 * The shared profile header: a wide cover (the brand or creator's own image,
 * or the accent gradient), the avatar overlapping it, name, meta line and the
 * badges the server says are true. Used by the creator's own profile, the
 * creator profile brands see, and the brand profile.
 */
import { Avatar } from '@/components/ds';

export function ProfileHero({ coverUrl, avatarUrl, name, meta, badges, rounded, children }: {
  coverUrl?: string | null;
  avatarUrl?: string | null;
  name: string;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  rounded?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="ds-card ds-card--flush ds-hero">
      <div className={`ds-cover${coverUrl ? '' : ' ds-cover--default'}`} aria-hidden>
        {coverUrl && <img src={coverUrl} alt="" />}
      </div>
      <div className="ds-hero-body">
        <div className="ds-hero-avatar"><Avatar name={name} src={avatarUrl} size="xl" rounded={rounded} gradient /></div>
        <div className="ds-heading">{name}</div>
        {meta && <div className="ds-caption ds-muted">{meta}</div>}
        {badges && <div className="ds-row ds-row--wrap" style={{ marginTop: 6 }}>{badges}</div>}
        {children}
      </div>
    </div>
  );
}
