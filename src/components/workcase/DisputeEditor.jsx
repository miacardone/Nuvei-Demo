import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, EmptyState, IconButton, Toolbar } from '@/components/ui/Surface';
import { TextAreaField } from '@/components/ui/Form';
import { Tooltip } from '@/components/ui/Overlay';
import Icon from '@/components/ui/Icon';
import RedactionStudio, { fileToDataUrl } from '@/components/workcase/RedactionStudio';
import { blockKind, drawSampleScreenshot } from '@/data/dispute-packet';
import { blocksFromFiles, resetPacket } from '@/data/packet-store';
import { usePacket } from '@/hooks/usePacket';
import { assessPacket, strategyFor } from '@/domain/evidence';
import PacketPreview from '@/components/workcase/PacketPreview';
import { CURRENT_USER } from '@/data/people';
import { useBrand } from '@/brand/BrandProvider';
import { useToast } from '@/context/ToastContext';
import { blockedActions } from '@/data/work-case';
import { formatDateTime, pluralise } from '@/utils/format';

/**
 * DISPUTE EDITOR
 * ==============
 * Assemble the response before it is submitted: argue it, order the exhibits,
 * and redact anything in a pasted screenshot that must not reach an issuer.
 *
 * WHY THIS IS A TAB ON WORK CASE and not its own page: the packet is only
 * meaningful next to the case it defends. An analyst editing the opening
 * statement needs the reason code, the amount and the deadline in view, and
 * those are already in the columns either side of this one.
 *
 * WHAT AN UNREDACTED SCREENSHOT ACTUALLY COSTS. Evidence gets pasted straight
 * out of an internal support tool, which means agent names, staff IDs and
 * internal escalation notes travel to the issuer along with the proof of
 * delivery. That is a staff-privacy incident, and — because the notes usually
 * contain the internal thresholds — it hands the other side the argument. So
 * a screenshot cannot be included in the packet until it has been through the
 * redaction step, and the editor enforces that rather than reminding people.
 */

const CAN_INCLUDE_UNREDACTED = false; // Kept explicit: this is a policy, not an oversight.

/* ------------------------------------------------------------------ *
 * Blocks
 * ------------------------------------------------------------------ */

function NarrativeBlock({ block, onChange }) {
  return (
    <TextAreaField
      label={block.title}
      rows={Math.min(Math.max(block.body.split('\n').length + 1, 4), 14)}
      value={block.body}
      onChange={(e) => onChange({ ...block, body: e.target.value })}
    />
  );
}

function EvidenceBlock({ block }) {
  return (
    <div className="row row--between row--nowrap packet__evidence">
      <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
        <Icon name="checklist" size={15} className="subtle" />
        <span style={{ minWidth: 0 }}>
          <span className="small strong truncate" style={{ display: 'block' }}>{block.title}</span>
          <span className="nano subtle">Attached to the case · received {block.receivedAt}</span>
        </span>
      </span>
      <Badge tone="success" dot>On file</Badge>
    </div>
  );
}

/**
 * A file the merchant supplied themselves — most often a PDF representment
 * they wrote outside this console.
 *
 * It counts as evidence and can satisfy a checklist item, but this build
 * cannot open or redact a PDF, and saying so plainly matters: a file shown
 * with the same green "reviewed" treatment as a redacted screenshot would
 * imply somebody had checked it for staff data when nobody has.
 */
function AttachmentBlock({ block }) {
  return (
    <div className="row row--between row--nowrap packet__evidence">
      <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
        <Icon name="file" size={15} className="subtle" />
        <span style={{ minWidth: 0 }}>
          <span className="small strong truncate" style={{ display: 'block' }}>{block.title}</span>
          <span className="nano subtle">
            {block.mimeType}{block.size ? ` · ${Math.max(1, Math.round(block.size / 1024))} KB` : ''} · supplied by the merchant
          </span>
        </span>
      </span>
      <Tooltip label="Attached as supplied. This console cannot open or redact a PDF, so it has not been checked for staff data — review it before submitting." wide>
        <Badge tone="warning" dot>Not reviewed</Badge>
      </Tooltip>
    </div>
  );
}

function ScreenshotBlock({ block, onRedact, onReplace }) {
  const redacted = block.redactions?.length > 0;

  return (
    <div className="stack stack--tight">
      <div className={`packet__shot ${redacted ? 'is-redacted' : 'is-raw'}`}>
        <img src={block.dataUrl} alt={block.title} />
        {!redacted && (
          <div className="packet__shot-veil">
            <Icon name="alert" size={18} />
            <span className="small strong">Not yet redacted</span>
            <span className="micro">This exhibit is blocked from the packet until it has been reviewed.</span>
            <Button variant="primary" size="sm" icon="lock" onClick={() => onRedact(block)}>Open redaction</Button>
          </div>
        )}
      </div>

      <div className="row row--between row--nowrap">
        <span className="row row--xtight">
          {redacted ? (
            <>
              <Badge tone="success" dot>{block.redactions.length} redacted</Badge>
              <span className="nano subtle">
                {block.audit.by} · {formatDateTime(block.audit.at)}
              </span>
            </>
          ) : (
            <Badge tone="danger" dot>Unredacted</Badge>
          )}
        </span>

        <span className="row row--xtight">
          {redacted && (
            <Tooltip label="Redaction is destructive, so a further pass can only add to it — the covered pixels are already gone." wide>
              <Button variant="ghost" size="sm" icon="lock" onClick={() => onRedact(block)}>Redact more</Button>
            </Tooltip>
          )}
          <Button variant="ghost" size="sm" icon="refresh" onClick={() => onReplace(block)}>Replace</Button>
        </span>
      </div>

      {redacted && (
        <div className="row row--tight">
          {block.redactions.map((r) => (
            <Tooltip key={r.id} label={`${r.retention} · ${r.mode === 'solid' ? 'solid box' : 'pixelated'}${r.note ? ` · ${r.note}` : ''}`} wide>
              <span className="chip">{r.reasonLabel}</span>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Editor
 * ------------------------------------------------------------------ */

export function DisputeEditor({ c, onSubmitted }) {
  const brand = useBrand();
  const { notify } = useToast();

  // The packet lives in a per-case store, not in this component: the upload
  // control sits in the Work case toolbar, outside this tree, and needs to put
  // files somewhere the editor will see them.
  const [packet, setPacket] = usePacket(c);
  const [studio, setStudio] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState(false);
  const fileRef = useRef(null);
  const rootRef = useRef(null);

  const blocked = useMemo(() => blockedActions(c.id), [c.id]);
  const assessment = useMemo(() => assessPacket(c, packet?.blocks ?? []), [c, packet]);
  const representmentBlocked = blocked.get('representment');

  const update = (id, next) => setPacket((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? next : b)) }));
  const remove = (id) => setPacket((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));

  const move = (id, delta) => setPacket((p) => {
    const i = p.blocks.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= p.blocks.length) return p;
    const blocks = [...p.blocks];
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    return { ...p, blocks };
  });

  // Date.now() alone collides when a multi-image paste lands inside one tick.
  const addScreenshot = useCallback((dataUrl, title) => {
    const id = `sb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPacket((p) => ({
      ...p,
      blocks: [...p.blocks, { id, kind: 'screenshot', title, dataUrl, included: true, redactions: null, audit: null }],
    }));
    return id;
  }, [setPacket]);

  const addNarrative = () => setPacket((p) => ({
    ...p,
    blocks: [...p.blocks, { id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind: 'narrative', title: 'Additional argument', body: '', included: true }],
  }));

  /* --- Image intake: paste, drop, file picker, generated sample --------- */

  const ingestFiles = useCallback(async (files) => {
    const list = Array.from(files);
    if (!list.length) return;

    const blocks = await blocksFromFiles(list, fileToDataUrl);
    setPacket((p) => ({ ...p, blocks: [...p.blocks, ...blocks] }));

    const images = blocks.filter((b) => b.kind === 'screenshot').length;
    const docs = blocks.length - images;
    notify(
      [images ? `${pluralise(images, 'screenshot')} added — redact before including` : null,
        docs ? `${pluralise(docs, 'document')} attached` : null].filter(Boolean).join(' · '),
      'success',
    );
  }, [notify, setPacket]);

  /**
   * Paste is bound to the document while this tab is mounted, because a paste
   * lands on whatever has focus and an analyst pressing Ctrl+V has almost
   * never clicked a specific drop target first. Text pastes are left alone so
   * editing the narrative still works normally.
   */
  useEffect(() => {
    const onPaste = (e) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const images = items.filter((i) => i.type.startsWith('image/'));
      if (!images.length) return;
      e.preventDefault();
      ingestFiles(images.map((i) => i.getAsFile()).filter(Boolean));
    };

    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [ingestFiles]);

  const insertSample = () => {
    const dataUrl = drawSampleScreenshot(c);
    addScreenshot(dataUrl, 'Internal support console — ticket view');
    notify('Sample screenshot added. It carries staff data on purpose.', 'success');
  };

  /* --- Redaction --------------------------------------------------------- */

  const applyRedaction = (result) => {
    const target = studio;
    setStudio(null);
    if (!target) return;

    update(target.id, {
      ...packet.blocks.find((b) => b.id === target.id),
      dataUrl: result.dataUrl,
      redactions: [...(packet.blocks.find((b) => b.id === target.id)?.redactions ?? []), ...result.redactions],
      audit: result.audit,
    });

    notify(`${pluralise(result.redactions.length, 'region')} redacted. The original was discarded.`, 'success');
  };

  /* --- Packet state ------------------------------------------------------ */

  const included = packet.blocks.filter((b) => b.included);
  const unredacted = packet.blocks.filter((b) => b.kind === 'screenshot' && !b.redactions?.length && b.included);
  const emptyNarrative = included.filter((b) => b.kind === 'narrative' && !b.body.trim());

  /**
   * BLOCKING vs CAUTION, kept apart deliberately.
   *
   * An unredacted screenshot is a hard stop — sending staff data to an issuer
   * is not a judgement call. Missing evidence is not: an analyst may know the
   * carrier file is coming, or that this one is worth filing thin. So it warns
   * and lets them through.
   *
   * What it must never do is say "Ready to submit" while the checklist shows
   * two required exhibits missing, which is what it did before this split —
   * the same class of false confirmation as the toast on a rule that was never
   * saved.
   */
  const problems = [
    ...(unredacted.length ? [`${pluralise(unredacted.length, 'screenshot')} still unredacted`] : []),
    ...(emptyNarrative.length ? [`${pluralise(emptyNarrative.length, 'empty narrative block')} to fill or remove`] : []),
    ...(representmentBlocked ? [representmentBlocked.title] : []),
  ];

  const cautions = assessment.missingRequired.map((i) => `No ${i.label.toLowerCase()} attached`);

  const redactionCount = packet.blocks.reduce((s, b) => s + (b.redactions?.length ?? 0), 0);

  const submit = () => {
    onSubmitted?.(
      `Packet submitted — ${pluralise(included.length, 'block')}, ${pluralise(redactionCount, 'redaction')} applied.`,
    );
  };

  // Guard sits BELOW every hook — an early return above `useEffect`/`useCallback`
  // would make the hook order conditional. The store creates a packet on first
  // access, so this only fires for a case that has none.
  if (!packet) return null;

  return (
    <div
      className="packet"
      ref={rootRef}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); ingestFiles(e.dataTransfer.files); }}
    >
      <Toolbar>
        <div className="row row--tight">
          <Button variant="secondary" size="sm" icon="plus" onClick={addNarrative}>Add argument</Button>
          <Button variant="secondary" size="sm" icon="image" onClick={() => fileRef.current?.click()}>Add screenshot</Button>
          <Tooltip label={`Draws a realistic internal ticket for ${c.id} containing an agent name, a staff ID, an internal address and an internal note — so the redaction step has something to redact.`} wide>
            <Button variant="ghost" size="sm" icon="wrench" onClick={insertSample}>Use a sample</Button>
          </Tooltip>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => { ingestFiles(e.target.files); e.target.value = ''; }}
          />
        </div>

        <span className="micro subtle row row--xtight">
          <Icon name="copy" size={12} /> Paste a screenshot anywhere with <kbd className="code-inline">Ctrl</kbd>+<kbd className="code-inline">V</kbd>
        </span>
      </Toolbar>

      {dragging && (
        <div className="packet__dropveil">
          <Icon name="upload" size={20} /> Drop the screenshot to add it as an exhibit
        </div>
      )}

      <div className="packet__grid">
        {/* ---- The document ------------------------------------------- */}
        <div className="stack stack--tight">
          {packet.blocks.map((block, i) => (
            <section key={block.id} className={`packet__block ${block.included ? '' : 'is-excluded'}`.trim()}>
              <header className="packet__block-head">
                <span className="row row--xtight row--nowrap" style={{ minWidth: 0 }}>
                  <span className="packet__block-no">{i + 1}</span>
                  <Icon name={blockKind(block.kind).icon} size={13} className="subtle" />
                  <span className="micro strong truncate">{block.title}</span>
                  <Badge tone="neutral">{blockKind(block.kind).label}</Badge>
                </span>

                <span className="row row--xtight row--nowrap">
                  <IconButton icon="arrowUp" label="Move up" size={12} disabled={i === 0} onClick={() => move(block.id, -1)} />
                  <IconButton icon="arrowDown" label="Move down" size={12} disabled={i === packet.blocks.length - 1} onClick={() => move(block.id, 1)} />
                  <Tooltip label={block.included ? 'Exclude from the submitted packet' : 'Include in the submitted packet'}>
                    <button type="button" className="icon-btn" onClick={() => update(block.id, { ...block, included: !block.included })} aria-label={block.included ? 'Exclude block' : 'Include block'}>
                      <Icon name={block.included ? 'check' : 'close'} size={13} />
                    </button>
                  </Tooltip>
                  <IconButton icon="trash" label="Remove block" tone="danger" size={12} onClick={() => remove(block.id)} />
                </span>
              </header>

              <div className="packet__block-body">
                {block.kind === 'narrative' && <NarrativeBlock block={block} onChange={(next) => update(block.id, next)} />}
                {block.kind === 'evidence' && <EvidenceBlock block={block} />}
                {block.kind === 'attachment' && <AttachmentBlock block={block} />}
                {block.kind === 'screenshot' && (
                  <ScreenshotBlock
                    block={block}
                    onRedact={(b) => setStudio({ id: b.id, dataUrl: b.dataUrl })}
                    onReplace={() => fileRef.current?.click()}
                  />
                )}
              </div>
            </section>
          ))}

          {packet.blocks.length === 0 && (
            <EmptyState icon="file" title="Empty packet" hint="Add an argument or paste a screenshot to begin." />
          )}
        </div>

        {/* ---- Submission rail ---------------------------------------- */}
        <aside className="stack stack--tight packet__rail">
          <div className="packet__panel">
            <span className="t-section-label">Packet</span>
            <div className="row row--between"><span className="micro muted">Blocks included</span><span className="micro mono strong">{included.length} / {packet.blocks.length}</span></div>
            <div className="row row--between"><span className="micro muted">Exhibits</span><span className="micro mono strong">{included.filter((b) => b.kind !== 'narrative').length}</span></div>
            <div className="row row--between"><span className="micro muted">Redactions applied</span><span className="micro mono strong">{redactionCount}</span></div>
            <div className="row row--between"><span className="micro muted">Reason code</span><span className="micro mono strong">{c.reasonCode}</span></div>
          </div>

          {/*
            The checklist is keyed to this case's reason code, so it asks for
            what this argument is actually won on — delivery evidence for a
            non-receipt code, authorisation results for a fraud one. Without it
            the editor can assemble a packet but cannot say whether it is worth
            filing.
          */}
          <div className="packet__panel">
            <div className="row row--between">
              <span className="t-section-label">Evidence for {c.reasonCode}</span>
              <Badge tone={assessment.readiness === 100 ? 'success' : assessment.readiness >= 50 ? 'warning' : 'danger'}>
                {assessment.readiness}%
              </Badge>
            </div>

            <div className="meter"><div className="meter__fill" style={{ width: `${assessment.readiness}%` }} /></div>

            <Tooltip label={strategyFor(c)} wide>
              <span className="micro subtle row row--xtight" style={{ cursor: 'help' }}>
                <Icon name="info" size={11} /> What wins this code
              </span>
            </Tooltip>

            <div className="stack stack--xtight">
              {assessment.items.map((item) => (
                <Tooltip key={item.id} label={item.satisfied ? `Matched by "${item.satisfiedBy}"` : item.hint} wide>
                  <span className="row row--xtight row--nowrap check-row">
                    <Icon
                      name={item.satisfied ? 'check' : item.required ? 'alert' : 'clock'}
                      size={12}
                      style={{ color: item.satisfied ? 'var(--c-success)' : item.required ? 'var(--c-danger)' : 'var(--c-ink-subtle)', flex: 'none' }}
                    />
                    <span className={`micro truncate ${item.satisfied ? '' : 'subtle'}`}>{item.label}</span>
                    {!item.required && <span className="nano subtle">optional</span>}
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>

          <div className="packet__panel">
            <span className="t-section-label">Before submission</span>
            {problems.length === 0 && cautions.length === 0 && (
              <span className="row row--xtight micro" style={{ color: 'var(--c-success)' }}>
                <Icon name="check" size={13} /> Ready to submit
              </span>
            )}

            {problems.map((p) => (
              <span key={p} className="row row--xtight micro" style={{ color: 'var(--c-danger)' }}>
                <Icon name="alert" size={13} /> {p}
              </span>
            ))}

            {cautions.map((p) => (
              <span key={p} className="row row--xtight micro" style={{ color: 'var(--c-warning)' }}>
                <Icon name="clock" size={13} /> {p}
              </span>
            ))}

            {problems.length === 0 && cautions.length > 0 && (
              <span className="nano subtle">Not blocking — you can file without these, but expect a harder fight.</span>
            )}

            <Tooltip
              label={representmentBlocked
                ? `${representmentBlocked.title}. ${representmentBlocked.text}`
                : unredacted.length
                  ? 'Every screenshot has to go through redaction first. This is not a warning you can click past.'
                  : `Submits to ${c.networkLabel ?? brand.terms.claimProgramme}.`}
              wide
            >
              <span style={{ display: 'block' }}>
                <Button
                  variant="primary"
                  block
                  icon="file"
                  disabled={problems.length > 0 || (unredacted.length > 0 && !CAN_INCLUDE_UNREDACTED)}
                  onClick={() => setPreview(true)}
                >
                  Compile packet
                </Button>
              </span>
            </Tooltip>
          </div>

          {redactionCount > 0 && (
            <div className="packet__panel">
              <span className="t-section-label">Redaction audit</span>
              {packet.blocks.filter((b) => b.redactions?.length).map((b) => (
                <div key={b.id} className="stack stack--xtight" style={{ paddingBottom: 'var(--s-2)' }}>
                  <span className="micro strong truncate">{b.title}</span>
                  <span className="nano subtle">
                    {pluralise(b.redactions.length, 'region')} · {b.audit?.by} · {formatDateTime(b.audit?.at)}
                  </span>
                  {[...new Set(b.redactions.map((r) => r.retention))].map((ret) => (
                    <span key={ret} className="nano subtle">— {ret}</span>
                  ))}
                </div>
              ))}
              <p className="nano subtle">
                Recorded against {c.id}. The pre-redaction image is not retained anywhere in this build.
              </p>
            </div>
          )}
        </aside>
      </div>

      <PacketPreview
        open={preview}
        onClose={() => setPreview(false)}
        c={c}
        packet={packet}
        assessment={assessment}
        canSubmit={problems.length === 0}
        onSubmit={() => { setPreview(false); submit(); }}
      />

      <RedactionStudio
        open={Boolean(studio)}
        source={studio}
        onClose={() => setStudio(null)}
        onApply={applyRedaction}
      />
    </div>
  );
}

export default DisputeEditor;
