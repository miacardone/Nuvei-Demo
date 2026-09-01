import { useState } from 'react';
import { PageHeader, Card, Button, Badge } from '@/components/ui/Surface';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Form';
import Icon from '@/components/ui/Icon';
import { HELP_CONTACT_TOPICS, HELP_DOCS, HELP_FAQ, HELP_VIDEOS } from '@/data/content';
import { useBrand } from '@/brand/BrandProvider';
import { useToast } from '@/context/ToastContext';

function Accordion({ items }) {
  const [openId, setOpenId] = useState(items[0]?.id ?? null);
  return (
    <div className="hairlines">
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id}>
            <button type="button" className="accordion__head" style={{ borderTop: 0 }} onClick={() => setOpenId(open ? null : item.id)} aria-expanded={open}>
              <Icon name="help" size={14} className="subtle" />
              {item.question}
              <Icon name="chevron" size={13} className={`accordion__chevron ${open ? 'is-open' : ''}`.trim()} />
            </button>
            {open && <div className="accordion__panel small muted" style={{ lineHeight: 1.6 }}>{item.answer}</div>}
          </div>
        );
      })}
    </div>
  );
}

export function Help() {
  const brand = useBrand();
  const { notify } = useToast();

  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const valid = topic && subject.trim() && message.trim();

  return (
    <>
      <PageHeader title="Help" description="Guides, reference material, and a way to reach a person when the docs run out." />

      <div className="stack">
        <Card title="Video walkthroughs">
          <div className="tile-grid">
            {HELP_VIDEOS.map((v) => (
              <button key={v.id} type="button" className="tile">
                <span className="tile__preview"><Icon name="play" size={20} /></span>
                <span className="row row--between"><span className="small strong">{v.title}</span><span className="micro mono subtle">{v.duration}</span></span>
                <span className="micro subtle">{v.description}</span>
                <Badge tone="neutral">{v.level}</Badge>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Documentation and guides">
          <div className="tile-grid">
            {HELP_DOCS.map((d) => (
              <button key={d.id} type="button" className="tile">
                <span className="row row--between"><Icon name="file" size={15} style={{ color: 'var(--c-primary)' }} /><span className="micro subtle">{d.readingMinutes} min read</span></span>
                <span className="small strong">{d.title}</span>
                <span className="micro subtle">{d.description}</span>
                <Badge tone="neutral">{d.category}</Badge>
              </button>
            ))}
          </div>
        </Card>

        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(300px, 1fr)', alignItems: 'start' }}>
          <Card title="Frequently asked" bodyClassName="card__body--flush">
            <Accordion items={HELP_FAQ} />
          </Card>

          <Card title="Contact support">
            <form
              className="stack"
              onSubmit={(e) => { e.preventDefault(); notify('Message sent. Support will reply by email.', 'success'); setTopic(''); setSubject(''); setMessage(''); }}
            >
              <SelectField label="Topic" required value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What is this about?" options={HELP_CONTACT_TOPICS.map((t) => ({ value: t, label: t }))} />
              <TextField label="Subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One line summary" />
              <TextAreaField label="Message" required rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Include case IDs where relevant — it saves a round trip." />
              <Button type="submit" variant="primary" icon="send" disabled={!valid}>Send message</Button>
              <p className="micro subtle">Urgent production issues: <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

export default Help;
