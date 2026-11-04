// The end of a focus session, made visible: what it produced and where to continue. The scene
// returns to normal on its own (the focus attributes clear), so this card is the only interruption.
import { useEffect } from 'react';
import { resumeActivity } from '../state/resume';
import { describeActivity } from '../state/workspace';
import { Icon } from '../ui/icons';
import { sessionSummary } from './summary';

export function SessionSummaryCard() {
  const s = sessionSummary.use(x => x.summary);
  useEffect(() => {
    if (!s) return;
    const t = setTimeout(() => sessionSummary.set({ summary: null }), 45000);
    return () => clearTimeout(t);
  }, [s]);
  if (!s) return null;
  const close = () => sessionSummary.set({ summary: null });
  const stats = [
    { n: s.minutes, label: 'focused minutes' },
    { n: s.pages, label: s.pages === 1 ? 'page read' : 'pages read' },
    { n: s.highlights, label: s.highlights === 1 ? 'highlight' : 'highlights' },
    { n: s.cards, label: s.cards === 1 ? 'board card' : 'board cards' },
  ];
  return (
    <section className="session-summary" role="status" aria-label="Focus session summary">
      <header>
        <span className="sh-eyebrow">
          <span className="sh-live" aria-hidden /> Session complete
        </span>
        <button className="ibtn tiny" onClick={close} aria-label="Close">
          <Icon name="close" size={14} />
        </button>
      </header>
      <ul className="ss-stats">
        {stats.map(x => (
          <li key={x.label} className={x.n ? '' : 'zero'}>
            <b>{x.n}</b>
            <span>{x.label}</span>
          </li>
        ))}
      </ul>
      {s.resume && (
        <button
          className="sh-btn primary"
          onClick={() => {
            close();
            void resumeActivity(s.resume!);
          }}
        >
          <Icon name={s.resume.kind === 'video' ? 'play' : 'book'} size={16} /> Pick up: {describeActivity(s.resume)}
        </button>
      )}
    </section>
  );
}
