import { useId, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { Button } from '@/components/ui/Surface';

/**
 * Form fields.
 *
 * Required fields carry a red asterisk and validation errors render beneath
 * the field, never as a bare red border — a border alone does not tell you
 * what is wrong.
 */

function Shell({ label, required, hint, error, htmlFor, children }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && <span className="field__req" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? <span className="field__error">{error}</span> : hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}

export function TextField({ label, required, hint, error, id: providedId, className = '', type, ...rest }) {
  const generated = useId();
  const id = providedId ?? generated;
  const [revealed, setRevealed] = useState(false);

  // A password field gets a reveal toggle. It lives here rather than at each
  // call site so every password box in the console behaves the same way, and
  // it swaps the input's own type — no second hidden field to fall out of sync.
  const isPassword = type === 'password';
  const inputType = isPassword && revealed ? 'text' : type;

  const input = (
    <input
      id={id}
      type={inputType}
      className={`input ${error ? 'input--error' : ''} ${isPassword ? 'input--with-reveal' : ''} ${className}`.trim()}
      aria-invalid={Boolean(error)}
      {...rest}
    />
  );

  return (
    <Shell label={label} required={required} hint={hint} error={error} htmlFor={id}>
      {isPassword ? (
        <span className="field__reveal-wrap">
          {input}
          <button
            type="button"
            className="field__reveal"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            aria-controls={id}
            tabIndex={-1}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={15} />
          </button>
        </span>
      ) : input}
    </Shell>
  );
}

export function SelectField({ label, required, hint, error, options = [], placeholder, children, id: providedId, className = '', ...rest }) {
  const generated = useId();
  const id = providedId ?? generated;
  return (
    <Shell label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <select id={id} className={`select ${error ? 'select--error' : ''} ${className}`.trim()} aria-invalid={Boolean(error)} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {children ?? options.map((o) => (
          <option key={String(o.value)} value={o.value ?? ''}>{o.label}</option>
        ))}
      </select>
    </Shell>
  );
}

export function TextAreaField({ label, required, hint, error, id: providedId, className = '', maxLength, value, showCount, ...rest }) {
  const generated = useId();
  const id = providedId ?? generated;
  const used = String(value ?? '').length;

  return (
    <Shell
      label={label}
      required={required}
      hint={showCount && maxLength ? `${used} / ${maxLength} characters, ${maxLength - used} remaining` : hint}
      error={error}
      htmlFor={id}
    >
      <textarea
        id={id}
        className={`textarea ${error ? 'textarea--error' : ''} ${className}`.trim()}
        maxLength={maxLength}
        value={value}
        aria-invalid={Boolean(error)}
        {...rest}
      />
    </Shell>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }) {
  return (
    <div className={`search ${className}`.trim()}>
      <Icon name="search" size={14} className="subtle" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button type="button" className="icon-btn" onClick={() => onChange('')} aria-label="Clear search" style={{ width: 18, height: 18 }}>
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  );
}

/** Search + the brand-colored Advanced Search button, glued together. */
export function SearchBar({ value, onChange, placeholder, onAdvanced, advancedCount = 0, advancedLabel = 'Advanced Search' }) {
  return (
    <div className="row row--tight row--nowrap">
      <SearchInput value={value} onChange={onChange} placeholder={placeholder} />
      {onAdvanced && (
        <Button variant="primary" icon="filter" onClick={onAdvanced}>
          {advancedLabel}
          {advancedCount > 0 && <span className="tab__badge" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>{advancedCount}</span>}
        </Button>
      )}
    </div>
  );
}

export function CheckboxRow({ label, description, checked, onChange, disabled }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`checkbox-row ${checked ? 'is-checked' : ''}`.trim()}>
      <input id={id} type="checkbox" className="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ marginTop: 1 }} />
      <span style={{ minWidth: 0 }}>
        <span className="small strong" style={{ display: 'block' }}>{label}</span>
        {description && <span className="micro subtle">{description}</span>}
      </span>
    </label>
  );
}

export function RadioRow({ name, label, description, value, checked, onChange }) {
  const id = useId();
  return (
    <label htmlFor={id} className="row row--tight row--top" style={{ cursor: 'pointer' }}>
      <input id={id} type="radio" className="radio" name={name} value={value} checked={checked} onChange={onChange} style={{ marginTop: 2 }} />
      <span style={{ minWidth: 0 }}>
        <span className="small">{label}</span>
        {description && <span className="micro subtle" style={{ display: 'block' }}>{description}</span>}
      </span>
    </label>
  );
}

export function ToggleField({ label, description, checked, onChange, disabled, id: providedId }) {
  const generated = useId();
  const id = providedId ?? generated;
  return (
    <label htmlFor={id} className="row row--between row--nowrap" style={{ cursor: disabled ? 'not-allowed' : 'pointer', width: '100%' }}>
      <span style={{ minWidth: 0 }}>
        <span className="small strong" style={{ display: 'block' }}>{label}</span>
        {description && <span className="micro subtle">{description}</span>}
      </span>
      <input id={id} type="checkbox" className="toggle" checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}

export default TextField;
