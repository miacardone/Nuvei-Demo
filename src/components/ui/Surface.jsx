import Icon from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Overlay';

/* ---------- Button ---------- */

export function Button({ variant = 'secondary', size, block, icon, iconAfter, as: Tag = 'button', className = '', children, ...rest }) {
  const classes = ['btn', `btn--${variant}`, size ? `btn--${size}` : '', block ? 'btn--block' : '', !children ? 'btn--icon' : '', className]
    .filter(Boolean).join(' ');

  return (
    <Tag className={classes} {...(Tag === 'button' ? { type: rest.type ?? 'button' } : {})} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={size === 'sm' ? 12 : 14} />}
    </Tag>
  );
}

/** Icon-only button. Always tooltipped — an icon with no label is a guess. */
export function IconButton({ icon, label, tone, size = 15, onClick, disabled, className = '', ...rest }) {
  return (
    <Tooltip label={label} disabled={disabled && !label}>
      <button
        type="button"
        className={`icon-btn ${tone ? `icon-btn--${tone}` : ''} ${className}`.trim()}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        {...rest}
      >
        <Icon name={icon} size={size} />
      </button>
    </Tooltip>
  );
}

/* ---------- Badge ---------- */

export function Badge({ tone = 'neutral', dot = false, className = '', children }) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()}>
      {dot && <span className={`dot dot--${tone}`} />}
      {children}
    </span>
  );
}

const STATUS_ICON_TONE_VAR = {
  neutral: 'var(--c-ink-muted)',
  muted: 'var(--c-ink-subtle)',
  primary: 'var(--c-primary)',
  info: 'var(--c-info)',
  success: 'var(--c-success)',
  warning: 'var(--c-warning)',
  danger: 'var(--c-danger)',
};

/**
 * A status/state value as a tone-colored icon with a hover tooltip, instead
 * of a text pill — the table-wide replacement for `<Badge>` on any column
 * whose job is "which of a few known states is this," across every table in
 * the app (see caseColumns.jsx for the original of this pattern).
 */
export function StatusIcon({ icon, tone = 'neutral', label, size = 15 }) {
  return (
    <Tooltip label={label}>
      <span className="row row--xtight row--nowrap" style={{ display: 'inline-flex' }}>
        <Icon name={icon} size={size} style={{ color: STATUS_ICON_TONE_VAR[tone] ?? STATUS_ICON_TONE_VAR.neutral }} />
      </span>
    </Tooltip>
  );
}

/* ---------- Page header ---------- */

export function PageHeader({ title, description, meta, actions }) {
  return (
    <header className="page-head">
      <div className="page-head__title">
        <div className="page-head__row">
          <h1>{title}</h1>
          {description && (
            <Tooltip label={description} side="bottom" wide>
              <button type="button" className="info-btn" aria-label={`About ${title}`}>
                <Icon name="info" size={14} />
              </button>
            </Tooltip>
          )}
        </div>
        {meta ?? (description && <p className="page-head__desc">{description}</p>)}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}

/* ---------- Card ---------- */

export function Card({ title, description, action, children, className = '', bodyClassName = 'card__body' }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || action) && (
        <header className="card__head">
          {title && (
            <span className="row row--xtight" style={{ gap: 4 }}>
              <h2 className="card__title">{title}</h2>
              {description && (
                <Tooltip label={description} side="bottom" wide>
                  <button type="button" className="info-btn" aria-label={`About ${title}`}>
                    <Icon name="info" size={12} />
                  </button>
                </Tooltip>
              )}
            </span>
          )}
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Toolbar({ children, className = '' }) {
  return <div className={`toolbar ${className}`.trim()}>{children}</div>;
}

/* ---------- Empty state ---------- */

export function EmptyState({ icon = 'inbox', title, hint, action }) {
  return (
    <div className="empty">
      <span className="empty__glyph"><Icon name={icon} size={20} /></span>
      <p className="empty__title">{title}</p>
      {hint && <p className="empty__hint">{hint}</p>}
      {action && <div style={{ marginTop: 'var(--s-2)' }}>{action}</div>}
    </div>
  );
}

/* ---------- Tabs ---------- */

export function Tabs({ tabs = [], value, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`.trim()} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={`tab ${value === tab.value ? 'is-active' : ''}`.trim()}
          onClick={() => onChange?.(tab.value)}
        >
          {tab.label}
          {tab.badge != null && <span className="tab__badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function SubTabs({ tabs = [], value, onChange }) {
  return (
    <div className="subtabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          className={`subtab ${value === tab.value ? 'is-active' : ''}`.trim()}
          onClick={() => onChange?.(tab.value)}
        >
          {tab.label}
          {tab.badge != null && <span className="subtle"> ({tab.badge})</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Stepper ---------- */

export function Stepper({ steps = [], current = 0 }) {
  return (
    <div className="stepper">
      {steps.map((label, i) => (
        <div key={label} className="row row--xtight row--nowrap">
          <div className={`step ${i === current ? 'is-active' : i < current ? 'is-done' : ''}`.trim()}>
            <span className="step__dot">{i < current ? <Icon name="check" size={11} strokeWidth={2.6} /> : i + 1}</span>
            <span className="step__label">{label}</span>
          </div>
          {i < steps.length - 1 && <span className="step__line" />}
        </div>
      ))}
    </div>
  );
}

/* ---------- KPI ---------- */

/** A compact blue line with a gold dot on the latest point — "now" against
 *  the last few weeks. Auto-scales to its own min/max, so it reads as shape
 *  (trending up/down/flat) rather than an axis to be read literally. */
function KpiSpark({ data }) {
  if (!data || data.length < 2) return null;
  const W = 64;
  const H = 28;
  const PAD = 3;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (data.length - 1);
  const points = data.map((v, i) => [PAD + i * stepX, H - PAD - ((v - min) / range) * (H - PAD * 2)]);
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1][0].toFixed(1)},${H} L${points[0][0].toFixed(1)},${H} Z`;
  const [lx, ly] = points[points.length - 1];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="kpi__spark" aria-hidden>
      <path d={areaPath} fill="var(--c-primary)" opacity="0.08" />
      <path d={path} fill="none" stroke="var(--c-primary)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.6" fill="var(--c-nav-active)" stroke="var(--c-surface)" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * `trend` is optional: { direction: 'up' | 'down', label } — a small
 * colored delta badge next to the value (e.g. vs. the prior 30 days).
 * `invert` flips which direction reads as good/bad — for a KPI like
 * "Overdue" where going up is the bad outcome, not the default good one.
 * `spark` is optional: an array of recent period values (oldest first),
 * rendered as a small blue/gold trend line next to the value.
 * `tooltip` is optional: hover context for a label that isn't self-evident.
 */
export function Kpi({ label, value, meta, trend, invert = false, spark, tooltip }) {
  const good = trend && (invert ? trend.direction === 'down' : trend.direction === 'up');
  const body = (
    <div className="kpi">
      <div className="row row--between" style={{ alignItems: 'center', gap: 'var(--s-3)' }}>
        <div className="stack stack--xtight" style={{ gap: 4, minWidth: 0 }}>
          <span className="kpi__label">{label}</span>
          <span className="row row--xtight" style={{ alignItems: 'baseline' }}>
            <span className="kpi__value">{value}</span>
            {trend && (
              <span className={`kpi__trend ${good ? 'kpi__trend--up' : 'kpi__trend--down'}`}>
                <Icon name={trend.direction === 'up' ? 'arrowUp' : 'arrowDown'} size={10} />
                {trend.label}
              </span>
            )}
          </span>
          {meta && <span className="kpi__meta">{meta}</span>}
        </div>
        <KpiSpark data={spark} />
      </div>
    </div>
  );
  return tooltip ? <Tooltip label={tooltip} className="kpi__tooltip-fill">{body}</Tooltip> : body;
}

export default Card;
