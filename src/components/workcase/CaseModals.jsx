import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Surface';
import { RadioRow, SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import Icon from '@/components/ui/Icon';
import brand from '@/brand/brand.config';
import { ASSIGN_SKILLS, ASSIGN_USERS, PEND_REASONS, REFERRAL_TARGETS } from '@/data/work-case';
import { formatDate, formatDateTime } from '@/utils/format';

const DAY = 86_400_000;
const inDays = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);

/* ---------- Notes ---------- */

export function NotesModal({ open, onClose, notes, onAdd }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const valid = title.trim() && content.trim();

  const submit = () => {
    onAdd({ title: title.trim(), text: content.trim() });
    setTitle('');
    setContent('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notes"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>Add note</Button>
        </>
      }
    >
      <div className="stack">
        <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary" />
        <TextAreaField label="Content" required rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What did you find, and what happens next?" />

        {notes.length > 0 && (
          <div className="stack stack--tight">
            <span className="t-section-label">Existing notes</span>
            {notes.map((n) => (
              <article key={n.id} className="note-card">
                <div className="small strong">{n.title}</div>
                <p className="small muted">{n.text}</p>
                <div className="micro subtle">{n.author} · {formatDateTime(n.timestamp)}</div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Upload documents ---------- */

export function UploadModal({ open, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);

  const add = (list) => setFiles((f) => [...f, ...Array.from(list).map((x) => ({ name: x.name, size: x.size }))]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload documents"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!files.length} onClick={() => { onDone(`${files.length} document(s) uploaded.`); setFiles([]); }}>Upload</Button>
        </>
      }
    >
      <div className="stack">
        <label
          className={`dropzone ${dragging ? 'is-dragging' : ''}`.trim()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files); }}
        >
          <span className="empty__glyph"><Icon name="upload" size={18} /></span>
          <span className="small strong">Drop files here, or click to choose</span>
          <span className="micro subtle">PDF, PNG or JPG · up to 10 MB each</span>
          <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={(e) => add(e.target.files)} />
        </label>

        {files.length > 0 && (
          <div className="stack stack--tight">
            <span className="t-section-label">Attached</span>
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="row row--between" style={{ padding: 'var(--s-2)', border: '1px solid var(--c-line)', borderRadius: 'var(--r-md)' }}>
                <span className="row row--xtight"><Icon name="file" size={14} className="subtle" /><span className="small truncate">{f.name}</span></span>
                <Button variant="ghost" size="sm" onClick={() => setFiles((p) => p.filter((_, x) => x !== i))}>Remove</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Pend case ---------- */

const QUICK = [['Tomorrow', 1], ['3 Days', 3], ['7 Days', 7], ['35 Days', 35]];

export function PendModal({ open, onClose, onDone }) {
  const [expiry, setExpiry] = useState(inDays(7));
  const [reason, setReason] = useState('');
  const [assign, setAssign] = useState('keep');
  const [note, setNote] = useState('');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pend case"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!reason} onClick={() => onDone(`Case pended until ${formatDate(expiry)}.`)}>Pend case</Button>
        </>
      }
    >
      <div className="stack">
        <TextField label="Expiration date" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />

        <div className="row row--tight">
          {QUICK.map(([label, days]) => (
            <button key={label} type="button" className="chip chip--toggle" onClick={() => setExpiry(inDays(days))}>{label}</button>
          ))}
        </div>

        <SelectField label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Select a reason…" options={PEND_REASONS.map((r) => ({ value: r, label: r }))} />

        <div className="field">
          <span className="field__label">Assign to</span>
          <RadioRow name="pend-assign" label="Keep current owner" value="keep" checked={assign === 'keep'} onChange={() => setAssign('keep')} />
          <RadioRow name="pend-assign" label="Return to queue" value="queue" checked={assign === 'queue'} onChange={() => setAssign('queue')} />
          <RadioRow name="pend-assign" label="Assign to me" value="me" checked={assign === 'me'} onChange={() => setAssign('me')} />
        </div>

        <TextAreaField label="Pend note" rows={3} maxLength={255} showCount value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

/* ---------- Route to queue ---------- */

export function RouteModal({ open, onClose, onDone }) {
  const [queue, setQueue] = useState('');
  const [mode, setMode] = useState('unassigned');
  const [user, setUser] = useState('');
  const [skill, setSkill] = useState('');

  const valid = queue && (mode === 'unassigned' || (mode === 'user' && user) || (mode === 'skill' && skill));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Route case to queue"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onDone({ queueId: queue }, `Case routed to ${brand.queues.find((q) => q.id === queue)?.label}.`)}>Route case</Button>
        </>
      }
    >
      <div className="stack">
        <SelectField label="Select a queue" required value={queue} onChange={(e) => setQueue(e.target.value)} placeholder="Select a queue…" options={brand.queues.map((q) => ({ value: q.id, label: `${q.label} · ${q.sla}h SLA` }))} />

        <div className="field">
          <span className="field__label">Assignment</span>
          <RadioRow name="route-assign" label="Leave unassigned" value="unassigned" checked={mode === 'unassigned'} onChange={() => setMode('unassigned')} />
          <RadioRow name="route-assign" label="Assign to a user" value="user" checked={mode === 'user'} onChange={() => setMode('user')} />
          {mode === 'user' && (
            <SelectField value={user} onChange={(e) => setUser(e.target.value)} placeholder="Select a user…" options={ASSIGN_USERS.map((u) => ({ value: u, label: u }))} />
          )}
          <RadioRow name="route-assign" label="Route to a skill" value="skill" checked={mode === 'skill'} onChange={() => setMode('skill')} />
          {mode === 'skill' && (
            <SelectField value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="Select a skill…" options={ASSIGN_SKILLS.map((s) => ({ value: s, label: s }))} />
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Referral ---------- */

export function ReferralModal({ open, onClose, onDone }) {
  const [target, setTarget] = useState('');
  const [comment, setComment] = useState('');
  const valid = target && comment.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Referral"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onDone(`Case referred to ${target}.`)}>Refer case</Button>
        </>
      }
    >
      <div className="stack">
        <SelectField label="Refer to" required value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Select a destination…" options={REFERRAL_TARGETS.map((t) => ({ value: t, label: t }))} />
        <TextAreaField label="Comment" required rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Why is this being referred?" />
      </div>
    </Modal>
  );
}

/* ---------- Resubmit ---------- */

export function ResubmitModal({ open, onClose, onDone, c }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resubmit case"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onDone('Case resubmitted to the scheme.')}>Resubmit</Button>
        </>
      }
    >
      <p className="small muted">
        This will resubmit case <strong className="mono">{c?.id}</strong> to {c?.networkLabel ?? 'the scheme'} using the
        evidence currently attached. The existing submission will be superseded.
      </p>
    </Modal>
  );
}
