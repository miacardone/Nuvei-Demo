import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, EmptyState, IconButton } from '@/components/ui/Surface';
import { SelectField, TextField } from '@/components/ui/Form';
import { Tooltip } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import { REDACTION_REASONS, getRedactionReason } from '@/data/dispute-packet';
import { CURRENT_USER } from '@/data/people';

/**
 * MARKUP STUDIO
 * =============
 * Mark up an exhibit before it is sent: black out what must not leave the
 * building, and point at what the issuer should read first.
 *
 * THE ONE THING THAT MATTERS: redaction is applied to the PIXEL DATA and the
 * source image is dropped. It is not a black <div> over an intact picture and
 * it is not a CSS filter. Both of those are the classic redaction failure — the
 * exhibit leaves with the original still inside it, recoverable by anyone who
 * opens the file in an editor or reads the DOM. Everything composites onto a
 * canvas at the image's own resolution and exports a flattened PNG.
 *
 * TWO CLASSES OF TOOL, AND THE DIFFERENCE IS NOT COSMETIC.
 *   · Redact and pixelate REMOVE information. They carry a reason, they appear
 *     in the audit trail, and they cannot be undone once applied.
 *   · Highlight, pen, arrow, box and text ADD information. They are annotation.
 *     They never carry a redaction reason and never appear in the audit trail
 *     as one, because calling an annotation a redaction would misstate what was
 *     protected — the question a regulator asks six months later.
 *
 * EVERYTHING IS STORED NORMALISED (0-1), so marks drawn on a scaled-down
 * preview land exactly right on a 4K source and survive a window resize
 * mid-edit. Stroke widths scale off the canvas width for the same reason.
 */

const MIN_REGION = 0.004; // ~0.4% of a side — below this it was a stray click.

/**
 * `shape` is how the pointer behaves: 'rect' drags a box, 'line' drags end to
 * end, 'free' follows the pointer, 'point' drops at a click.
 */
export const TOOLS = [
  { id: 'redact', label: 'Black out', icon: 'blackoutBar', shape: 'rect', destructive: true, hint: 'Fills the region with flat black. The information is gone — the safe default for names, IDs and addresses.' },
  { id: 'pixelate', label: 'Pixelate', icon: 'grid', shape: 'rect', destructive: true, hint: 'Averages the region into blocks. Use for context you want readable as "something was here" — not for a short predictable string like a staff ID, where the structure that survives can be enough to guess it back.' },
  { id: 'highlight', label: 'Highlight', icon: 'pencil', shape: 'rect', hint: 'Draws attention to a passage without hiding it. Additive — nothing underneath is lost.' },
  { id: 'box', label: 'Box', icon: 'square', shape: 'rect', hint: 'Outlines an area, for pointing at a delivery scan or a total.' },
  { id: 'arrow', label: 'Arrow', icon: 'arrowUpRight', shape: 'line', hint: 'Points at one thing. Drag from where the eye starts to what it should land on.' },
  { id: 'pen', label: 'Draw', icon: 'scribble', shape: 'free', hint: 'Freehand. Circle a line item, tick a field, scribble a note.' },
  { id: 'text', label: 'Note', icon: 'type', shape: 'point', hint: 'Click to drop a note. Click it again any time to edit the wording.' },
];

export const getTool = (id) => TOOLS.find((t) => t.id === id) ?? TOOLS[0];
const isDestructive = (id) => Boolean(getTool(id).destructive);

const COLOURS = [
  { id: 'red', value: '#D32F2F', label: 'Red' },
  { id: 'amber', value: '#B26A00', label: 'Amber' },
  { id: 'ink', value: '#111827', label: 'Black' },
  { id: 'teal', value: '#00707A', label: 'Teal' },
];

/** Reads any File/Blob into a data URL so the canvas is never tainted. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ------------------------------------------------------------------ *
 * Burning marks into the pixels
 * ------------------------------------------------------------------ */

/**
 * Composites `marks` onto `src` and returns a new PNG data URL.
 *
 * Runs at the image's natural size so nothing is lost to the preview scale,
 * and returns a NEW url — the caller replaces the original reference and lets
 * it be collected.
 */
export async function applyRedactions(src, marks) {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const W = canvas.width;
  const H = canvas.height;
  // Stroke and type scale with the image, so a mark drawn on a 900px preview
  // is not a hairline on a 4000px original.
  const unit = Math.max(2, Math.round(W / 320));

  const px = (m) => ({
    x: Math.round(m.x * W), y: Math.round(m.y * H),
    w: Math.round(m.w * W), h: Math.round(m.h * H),
  });

  marks.forEach((m) => {
    ctx.save();
    ctx.strokeStyle = m.colour ?? '#D32F2F';
    ctx.fillStyle = m.colour ?? '#D32F2F';
    ctx.lineWidth = unit;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (m.type) {
      case 'redact': {
        const r = px(m);
        if (r.w < 1 || r.h < 1) break;
        ctx.fillStyle = '#000000';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        break;
      }

      case 'pixelate': {
        const r = px(m);
        if (r.w < 1 || r.h < 1) break;
        /*
         * Downsample then blow back up with smoothing off. The original
         * samples are overwritten in place; no copy is kept.
         *
         * BLOCK SIZE HAS TO BEAT THE TEXT, and the old `min(w,h)/6` did not.
         * A redaction over a line of type is wide and short — a 500x29 strip —
         * so `min` picked the height, divided it to about 5, and produced 6px
         * blocks over 12px glyphs. The letters survived: sampling the result
         * still returned crisp ink next to clean white. It looked like a
         * texture and destroyed nothing.
         *
         * A block has to be at least as tall as a character to remove it, so
         * the floor is 12px and the divisor is gentler. Capped at 48 so a large
         * region does not collapse to four giant squares.
         */
        const block = Math.min(48, Math.max(12, Math.round(Math.min(r.w, r.h) / 3)));
        const tiny = document.createElement('canvas');
        tiny.width = Math.max(1, Math.ceil(r.w / block));
        tiny.height = Math.max(1, Math.ceil(r.h / block));
        const tctx = tiny.getContext('2d');
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, tiny.width, tiny.height);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, r.x, r.y, r.w, r.h);
        ctx.imageSmoothingEnabled = true;
        break;
      }

      case 'highlight': {
        const r = px(m);
        // Multiply keeps the text legible underneath rather than washing it out.
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#FFE08A';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        break;
      }

      case 'box': {
        const r = px(m);
        ctx.strokeRect(r.x, r.y, r.w, r.h);
        break;
      }

      case 'pen': {
        if (!m.points?.length) break;
        ctx.beginPath();
        m.points.forEach((p, i) => {
          const x = p.x * W;
          const y = p.y * H;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
        break;
      }

      case 'arrow': {
        const x1 = m.from.x * W; const y1 = m.from.y * H;
        const x2 = m.to.x * W; const y2 = m.to.y * H;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const angle = Math.atan2(y2 - y1, x2 - x1);
        const head = unit * 4;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 7), y2 - head * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 7), y2 - head * Math.sin(angle + Math.PI / 7));
        ctx.closePath();
        ctx.fill();
        break;
      }

      case 'text': {
        if (!m.text) break;
        const size = unit * 5;
        ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
        const metrics = ctx.measureText(m.text);
        const padding = size * 0.35;
        const x = m.x * W;
        const y = m.y * H;
        // A plate behind the type, or a caption over a dark scan is unreadable.
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(x - padding, y - size, metrics.width + padding * 2, size + padding * 1.4);
        ctx.fillStyle = m.colour ?? '#D32F2F';
        ctx.fillText(m.text, x, y);
        break;
      }

      default:
        break;
    }
    ctx.restore();
  });

  return canvas.toDataURL('image/png');
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function RedactionStudio({ open, source, onClose, onApply }) {
  const imgRef = useRef(null);
  const textRef = useRef(null);

  const [marks, setMarks] = useState([]);
  const [tool, setTool] = useState('redact');
  const [colour, setColour] = useState(COLOURS[0].value);
  const [reason, setReason] = useState('employee_name');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(null);
  const [natural, setNatural] = useState(null);
  const [busy, setBusy] = useState(false);

  const spec = getTool(tool);

  // A fresh image means a fresh set of marks — carrying them over would put
  // boxes in meaningless places on a different exhibit.
  useEffect(() => {
    if (open) {
      setMarks([]); setDraft(null); setEditing(null); setNote(''); setBusy(false);
    }
  }, [open, source?.id]);

  useEffect(() => { if (editing) textRef.current?.focus(); }, [editing]);

  const at = useCallback((event) => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect?.width) return null;
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    };
  }, []);

  const addMark = (mark) => setMarks((prev) => [...prev, { id: `m-${prev.length + 1}-${Date.now()}`, ...mark }]);

  const onPointerDown = (e) => {
    if (e.button !== 0 || editing) return;
    const p = at(e);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);

    if (spec.shape === 'point') {
      const mark = { type: 'text', x: p.x, y: p.y, text: '', colour };
      const id = `m-${marks.length + 1}-${Date.now()}`;
      setMarks((prev) => [...prev, { id, ...mark }]);
      setEditing(id);
      return;
    }
    setDraft(spec.shape === 'free' ? { points: [p] } : { from: p, to: p });
  };

  const onPointerMove = (e) => {
    if (!draft) return;
    const p = at(e);
    if (!p) return;
    setDraft((d) => (spec.shape === 'free' ? { points: [...d.points, p] } : { ...d, to: p }));
  };

  const onPointerUp = () => {
    if (!draft) return;
    const d = draft;
    setDraft(null);

    if (spec.shape === 'free') {
      if (d.points.length > 2) addMark({ type: 'pen', points: d.points, colour });
      return;
    }
    if (spec.shape === 'line') {
      const far = Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y);
      if (far > MIN_REGION) addMark({ type: 'arrow', from: d.from, to: d.to, colour });
      return;
    }

    const rect = {
      x: Math.min(d.from.x, d.to.x),
      y: Math.min(d.from.y, d.to.y),
      w: Math.abs(d.to.x - d.from.x),
      h: Math.abs(d.to.y - d.from.y),
    };
    if (rect.w < MIN_REGION || rect.h < MIN_REGION) return;

    addMark({
      type: tool,
      ...rect,
      colour,
      ...(isDestructive(tool) ? { reasonId: reason, note: reason === 'other' ? note.trim() : '' } : null),
    });
  };

  const redactions = useMemo(() => marks.filter((m) => isDestructive(m.type)), [marks]);
  const annotations = marks.length - redactions.length;
  const coverage = useMemo(
    () => Math.min(redactions.reduce((s, m) => s + (m.w ?? 0) * (m.h ?? 0), 0) * 100, 100),
    [redactions],
  );
  const weakOnShortString = redactions.some(
    (m) => m.type === 'pixelate' && ['employee_id', 'employee_name', 'payment_data'].includes(m.reasonId),
  );

  const apply = async () => {
    setBusy(true);
    try {
      // Empty captions are dropped rather than burned as a blank plate.
      const usable = marks.filter((m) => m.type !== 'text' || m.text.trim());
      const flattened = await applyRedactions(source.dataUrl, usable);
      onApply({
        dataUrl: flattened,
        redactions: redactions.map((m) => ({
          id: m.id,
          reasonId: m.reasonId,
          reasonLabel: getRedactionReason(m.reasonId).label,
          retention: getRedactionReason(m.reasonId).retention,
          mode: m.type,
          note: m.note,
        })),
        audit: {
          by: CURRENT_USER.email,
          at: new Date().toISOString(),
          regionCount: redactions.length,
          annotationCount: annotations,
          modes: [...new Set(marks.map((m) => m.type))],
        },
      });
    } finally {
      setBusy(false);
    }
  };

  if (!source) return null;

  const pct = (n) => `${n * 100}%`;
  const rectOf = (d) => ({
    x: Math.min(d.from.x, d.to.x), y: Math.min(d.from.y, d.to.y),
    w: Math.abs(d.to.x - d.from.x), h: Math.abs(d.to.y - d.from.y),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Markup — ${source.title ?? 'exhibit'}`}
      subtitle="Black out what must not be sent, and point at what should be read first. Applying flattens every mark into the image and discards the original."
      size="xl"
      footer={
        <>
          <span className="micro subtle" style={{ marginRight: 'auto' }}>
            {marks.length === 0 ? 'Nothing marked yet.' : [
              redactions.length ? `${redactions.length} redaction${redactions.length === 1 ? '' : 's'} · ${coverage.toFixed(1)}% of the image · irreversible` : null,
              annotations ? `${annotations} annotation${annotations === 1 ? '' : 's'}` : null,
            ].filter(Boolean).join(' · ')}
          </span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="check" disabled={!marks.length || busy} onClick={apply}>
            {busy ? 'Applying…' : 'Apply markup'}
          </Button>
        </>
      }
    >
      <div className="redact">
        <div className="redact__stage">
          {/* Tool strip sits over the document, the way a markup bar does. */}
          <div className="markup-bar">
            {TOOLS.map((t) => (
              <Tooltip key={t.id} label={<><span className="tooltip__title">{t.label}</span>{t.hint}</>} wide>
                <button
                  type="button"
                  className={`markup-bar__btn ${tool === t.id ? 'is-active' : ''} ${t.destructive ? 'is-destructive' : ''}`.trim()}
                  onClick={() => setTool(t.id)}
                  aria-pressed={tool === t.id}
                  aria-label={t.label}
                >
                  <Icon name={t.icon} size={14} />
                </button>
              </Tooltip>
            ))}

            <span className="markup-bar__sep" />

            {COLOURS.map((c) => (
              <Tooltip key={c.id} label={c.label}>
                <button
                  type="button"
                  className={`markup-bar__swatch ${colour === c.value ? 'is-active' : ''}`.trim()}
                  style={{ background: c.value }}
                  onClick={() => setColour(c.value)}
                  aria-label={c.label}
                  aria-pressed={colour === c.value}
                />
              </Tooltip>
            ))}

            <span className="spacer" />

            <Tooltip label="Undo the last mark">
              <button type="button" className="markup-bar__btn" disabled={!marks.length} onClick={() => setMarks((p) => p.slice(0, -1))} aria-label="Undo">
                <Icon name="refresh" size={14} />
              </button>
            </Tooltip>
          </div>

          <div
            className={`redact__canvas markup--${spec.shape}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            role="application"
            aria-label="Exhibit. Drag to mark it up."
          >
            <img
              ref={imgRef}
              src={source.dataUrl}
              alt=""
              draggable={false}
              onLoad={(e) => setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
            />

            {/* Rect marks as positioned elements; strokes as one SVG overlay. */}
            {marks.filter((m) => ['redact', 'pixelate', 'highlight', 'box'].includes(m.type)).map((m, i) => (
              <span
                key={m.id}
                className={`redact__box redact__box--${m.type}`}
                style={{ left: pct(m.x), top: pct(m.y), width: pct(m.w), height: pct(m.h), borderColor: m.type === 'box' ? m.colour : undefined }}
              >
                {isDestructive(m.type) && <span className="redact__box-tag">{i + 1}</span>}
              </span>
            ))}

            <svg className="markup-layer" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
              {marks.filter((m) => m.type === 'pen').map((m) => (
                <polyline key={m.id} points={m.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={m.colour} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {marks.filter((m) => m.type === 'arrow').map((m) => (
                <g key={m.id}>
                  <line x1={m.from.x} y1={m.from.y} x2={m.to.x} y2={m.to.y} stroke={m.colour} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                  <circle cx={m.to.x} cy={m.to.y} r="0.008" fill={m.colour} />
                </g>
              ))}
              {draft?.points && (
                <polyline points={draft.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={colour} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              )}
              {draft?.from && spec.shape === 'line' && (
                <line x1={draft.from.x} y1={draft.from.y} x2={draft.to.x} y2={draft.to.y} stroke={colour} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeDasharray="0.01 0.01" />
              )}
            </svg>

            {marks.filter((m) => m.type === 'text').map((m) => (
              editing === m.id ? (
                <input
                  key={m.id}
                  ref={textRef}
                  className="markup-text-input"
                  style={{ left: pct(m.x), top: pct(m.y), color: m.colour }}
                  value={m.text}
                  placeholder="Caption…"
                  onPointerDown={(e) => e.stopPropagation()}
                  onChange={(e) => setMarks((p) => p.map((x) => (x.id === m.id ? { ...x, text: e.target.value } : x)))}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(null); }}
                  onBlur={() => setEditing(null)}
                />
              ) : (
                <button
                  key={m.id}
                  type="button"
                  className="markup-text"
                  style={{ left: pct(m.x), top: pct(m.y), color: m.colour }}
                  /* Single click, and it stops the canvas seeing the press —
                     otherwise clicking a note with a tool active drew a new
                     mark on top of the one you were trying to edit. */
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); setEditing(m.id); }}
                  title="Click to edit this note"
                >
                  {m.text || 'Empty note — click to write'}
                </button>
              )
            ))}

            {draft?.from && spec.shape === 'rect' && (
              <span className="redact__box redact__box--drawing" style={{ left: pct(rectOf(draft).x), top: pct(rectOf(draft).y), width: pct(rectOf(draft).w), height: pct(rectOf(draft).h) }} />
            )}
          </div>

          <p className="micro subtle" style={{ marginTop: 'var(--s-2)' }}>
            {natural ? `Source ${natural.w} × ${natural.h}px — marks are burned in at full resolution, not at preview scale.` : 'Loading…'}
          </p>
        </div>

        <div className="redact__side stack stack--tight">
          <span className="t-section-label">{spec.label}</span>
          <p className="micro subtle">{spec.hint}</p>

          {/* A reason is required only where information is being removed. */}
          {spec.destructive ? (
            <>
              <SelectField
                label="Reason for the next region"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                options={REDACTION_REASONS.map((r) => ({ value: r.id, label: r.label }))}
                hint={getRedactionReason(reason).hint}
              />
              {reason === 'other' && (
                <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is being covered, and why?" />
              )}
            </>
          ) : (
            <p className="micro subtle">
              <Icon name="info" size={11} /> Annotation adds to the exhibit rather than removing from it, so it carries no
              redaction reason and is not recorded as one in the audit trail.
            </p>
          )}

          <div className="divider" />

          <div className="row row--between">
            <span className="t-section-label">Marks ({marks.length})</span>
            {marks.length > 0 && (
              <button type="button" className="micro" style={{ border: 0, background: 'transparent', color: 'var(--c-danger)', cursor: 'pointer', fontWeight: 600 }} onClick={() => setMarks([])}>
                Clear all
              </button>
            )}
          </div>

          {marks.length === 0 ? (
            <EmptyState icon="image" title="Pick a tool and mark the document" hint="Redactions carry a reason so the packet can prove what was covered and why." />
          ) : (
            <div className="stack stack--xtight" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {marks.map((m, i) => (
                <div key={m.id} className="row row--between row--nowrap redact__region">
                  <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
                    <span className="redact__region-no" style={{ background: isDestructive(m.type) ? 'var(--c-ink)' : m.colour }}>{i + 1}</span>
                    <span style={{ minWidth: 0 }}>
                      <span className="small strong truncate" style={{ display: 'block' }}>
                        {isDestructive(m.type) ? getRedactionReason(m.reasonId).label : getTool(m.type).label}
                      </span>
                      <span className="nano subtle">
                        {getTool(m.type).label}{isDestructive(m.type) ? ` · ${getRedactionReason(m.reasonId).retention}` : ' · annotation'}
                      </span>
                    </span>
                  </span>
                  <span className="row row--xtight row--nowrap" style={{ flex: 'none' }}>
                    {m.type === 'text' && (
                      <IconButton icon="edit" label="Edit this note" size={13} onClick={() => setEditing(m.id)} />
                    )}
                    <IconButton icon="trash" label="Remove mark" tone="danger" size={13} onClick={() => setMarks((p) => p.filter((x) => x.id !== m.id))} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {weakOnShortString && (
            <p className="instruction instruction--warning">
              <span className="dot dot--warning" style={{ marginTop: 5 }} />
              <span>
                <span className="instruction__title">Pixelation is weak here.</span>{' '}
                <span className="muted">
                  A name, staff ID or card number is short and predictable, so the block structure that survives
                  pixelation can be enough to recover it. Use Black out for those.
                </span>
              </span>
            </p>
          )}

          <div className="divider" />
          <p className="micro subtle">
            <Icon name="lock" size={11} /> Applying rewrites the image at pixel level and attaches only the flattened copy.
            The original is not stored on the case, not sent with the packet, and cannot be recovered from the exhibit.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export default RedactionStudio;
