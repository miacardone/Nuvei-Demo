import { useState } from 'react';
import { Button, Badge } from '@/components/ui/Surface';
import Icon from '@/components/ui/Icon';
import { COMMAND_EXAMPLES, parseCommand } from '@/domain/command-parser';

/**
 * COMMAND BAR — type what you want, and watch it fill the form in.
 *
 * The important design decision is what it does NOT do: it never applies
 * anything. It parses a sentence into the same structure the questionnaire
 * below already edits, fills that in, and then tells you what it understood.
 * You check the criteria and correct them. A bar that silently acted on its
 * own reading of "low risk merchants" across four hundred accounts would be
 * the most dangerous control on the site; one that types the form for you is
 * simply faster than clicking.
 *
 * The parse is a vocabulary scan, not a model — same sentence, same rule,
 * every time, and a wrong result is something you can point at.
 */
export function CommandBar({ onParsed }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [missed, setMissed] = useState(false);

  const run = (value) => {
    const query = value ?? text;
    const parsed = parseCommand(query);
    if (!parsed) {
      setResult(null);
      setMissed(true);
      return;
    }
    setMissed(false);
    setResult({ ...parsed, query });
    onParsed(parsed);
  };

  return (
    <div className="cmd">
      <div className="cmd__field">
        <Icon name="search" size={16} style={{ color: 'var(--c-primary)', flex: 'none' }} />
        <input
          type="text"
          value={text}
          placeholder="Tell it what you want — “indemnify all low risk merchants at 25 bps”"
          onChange={(e) => { setText(e.target.value); setMissed(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); }}
          aria-label="Describe what you want to do"
        />
        {text && (
          <button type="button" className="cmd__clear" onClick={() => { setText(''); setResult(null); setMissed(false); }} aria-label="Clear">
            <Icon name="close" size={13} />
          </button>
        )}
        <Button variant="primary" size="sm" onClick={() => run()} disabled={text.trim().length < 3}>
          Build it
        </Button>
      </div>

      {!result && !missed && (
        <div className="cmd__examples">
          {COMMAND_EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="cmd__example" onClick={() => { setText(ex); run(ex); }}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {missed && (
        <p className="cmd__note cmd__note--miss">
          <Icon name="alert" size={13} />
          That one did not land. Try naming a merchant, a risk tier, a percentage or a rate — or use the
          questions below. Nothing was changed.
        </p>
      )}

      {/* What it understood, in words, beside a form you can now correct. */}
      {result && (
        <div className="cmd__read">
          <div className="row row--xtight row--nowrap" style={{ alignItems: 'flex-start' }}>
            <Icon name="check" size={13} style={{ color: 'var(--c-success)', marginTop: 3, flex: 'none' }} />
            <div className="stack stack--xtight" style={{ minWidth: 0 }}>
              <span className="micro strong">Filled in below — check it before you apply anything.</span>
              <div className="cmd__tags">
                {result.understood.map((u) => <Badge key={u} tone="neutral">{u}</Badge>)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommandBar;
