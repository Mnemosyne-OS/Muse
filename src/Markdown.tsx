/**
 * Minimal dependency-free Markdown renderer for the in-cartridge doc reader.
 * Covers what the Mnemosyne docs actually use: headings, paragraphs, lists,
 * fenced code, inline code, bold/italic, links, images (as placeholders),
 * blockquotes, tables and horizontal rules.
 * Renders to React elements — no innerHTML, so no XSS surface.
 */
import { type CSSProperties, type ReactNode } from 'react';

type LinkHandler = (href: string) => void;

const INLINE_RE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(!\[[^\]\n]*\]\([^)\n]+\))|(\[[^\]\n]+\]\([^)\n]+\))/g;

/** Parse inline spans: code, bold, italic, images, links. */
function inline(text: string, onLink?: LinkHandler): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    if (m[1]) {
      out.push(<code key={k++} style={MS.codeInline}>{tok.slice(1, -1)}</code>);
    } else if (m[2] || m[3]) {
      out.push(<b key={k++}>{inline(tok.slice(2, -2), onLink)}</b>);
    } else if (m[4]) {
      out.push(<i key={k++}>{inline(tok.slice(1, -1), onLink)}</i>);
    } else if (m[5]) {
      // Remote images are CSP-blocked in the cartridge iframe → placeholder.
      const alt = tok.slice(2, tok.indexOf(']'));
      out.push(<span key={k++} style={MS.image}>🖼 {alt || 'image'}</span>);
    } else {
      const close = tok.indexOf('](');
      const label = tok.slice(1, close);
      const href = tok.slice(close + 2, -1).trim();
      const external = /^https?:\/\//i.test(href);
      out.push(
        <a
          key={k++}
          href="#"
          style={external ? MS.link : MS.linkDead}
          onClick={(e) => { e.preventDefault(); if (external) onLink?.(href); }}
        >
          {inline(label, onLink)}{external ? ' ↗' : ''}
        </a>
      );
    }
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function headingStyle(level: number): CSSProperties {
  switch (level) {
    case 1: return MS.h1;
    case 2: return MS.h2;
    case 3: return MS.h3;
    default: return MS.h4;
  }
}

export function Markdown({ source, onLink }: { source: string; onLink?: LinkHandler }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: ReactNode[] = [];
  const para: string[] = [];
  let i = 0;
  let k = 0;

  const flushPara = () => {
    if (para.length) {
      out.push(<p key={k++} style={MS.p}>{inline(para.join(' '), onLink)}</p>);
      para.length = 0;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^\s*```/.test(line)) {
      flushPara();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // skip closing fence
      out.push(<pre key={k++} style={MS.pre}><code>{buf.join('\n')}</code></pre>);
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      out.push(<div key={k++} style={headingStyle(h[1].length)}>{inline(h[2].replace(/\s#+\s*$/, ''), onLink)}</div>);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      out.push(<hr key={k++} style={MS.hr} />);
      i++;
      continue;
    }

    // Blockquote (consecutive > lines merge into one block)
    if (/^\s*>/.test(line)) {
      flushPara();
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(<blockquote key={k++} style={MS.quote}>{inline(buf.join(' '), onLink)}</blockquote>);
      continue;
    }

    // Table (header row + |---| separator)
    const sep = lines[i + 1] ?? '';
    if (/^\s*\|/.test(line) && /^\s*\|?[\s:|-]+\|?\s*$/.test(sep) && sep.includes('-')) {
      flushPara();
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(
        <div key={k++} style={MS.tableWrap}>
          <table style={MS.table}>
            <thead><tr>{head.map((c, ci) => <th key={ci} style={MS.th}>{inline(c, onLink)}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={MS.td}>{inline(c, onLink)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // List (flat — nesting renders as a single level, fine for our docs)
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flushPara();
      const ordered = /^\s*\d/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const m2 = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (!m2) break;
        items.push(<li key={items.length} style={MS.li}>{inline(m2[2], onLink)}</li>);
        i++;
      }
      out.push(ordered
        ? <ol key={k++} style={MS.list}>{items}</ol>
        : <ul key={k++} style={MS.list}>{items}</ul>);
      continue;
    }

    // Blank line ends the current paragraph
    if (line.trim() === '') { flushPara(); i++; continue; }

    para.push(line.trim());
    i++;
  }
  flushPara();

  return <div style={MS.root}>{out}</div>;
}

const MS: Record<string, CSSProperties> = {
  // Capped measure keeps long docs readable even when the pane is very wide.
  root: { fontSize: '14.5px', lineHeight: 1.7, color: 'var(--mu-text-2)', textAlign: 'left', wordBreak: 'break-word', maxWidth: '880px', margin: '0 auto' },
  p: { margin: '0 0 12px' },
  h1: { fontSize: '24px', fontWeight: 700, color: 'var(--mu-text)', margin: '22px 0 12px', letterSpacing: '-0.01em' },
  h2: { fontSize: '19px', fontWeight: 700, color: 'var(--mu-text)', margin: '20px 0 10px', borderBottom: '1px solid var(--mu-line)', paddingBottom: '6px' },
  h3: { fontSize: '16px', fontWeight: 700, color: 'var(--mu-text-2)', margin: '16px 0 8px' },
  h4: { fontSize: '14px', fontWeight: 700, color: 'var(--mu-text-2)', margin: '14px 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  pre: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '12px', lineHeight: 1.6, background: 'rgba(0,0,0,0.35)', border: '1px solid var(--mu-line)', borderRadius: '10px', padding: '12px 14px', overflowX: 'auto', margin: '0 0 12px', color: 'var(--mu-text-2)' },
  codeInline: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: '12.5px', background: 'color-mix(in srgb, var(--mu-link) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--mu-link) 15%, transparent)', borderRadius: '5px', padding: '1px 5px', color: 'var(--mu-link)' },
  quote: { margin: '0 0 12px', padding: '8px 14px', borderLeft: '3px solid color-mix(in srgb, var(--mu-accent) 55%, transparent)', background: 'color-mix(in srgb, var(--mu-accent) 6%, transparent)', borderRadius: '0 8px 8px 0', color: 'var(--mu-text-3)' },
  list: { margin: '0 0 12px', paddingLeft: '22px' },
  li: { margin: '3px 0' },
  hr: { border: 'none', borderTop: '1px solid var(--mu-line)', margin: '18px 0' },
  link: { color: 'var(--mu-link)', textDecoration: 'none', borderBottom: '1px solid color-mix(in srgb, var(--mu-link) 35%, transparent)', cursor: 'pointer' },
  linkDead: { color: 'var(--mu-text-3)', textDecoration: 'none', borderBottom: '1px dotted rgba(159,178,214,0.4)', cursor: 'default' },
  image: { fontSize: '12px', color: 'var(--mu-text-4)', fontStyle: 'italic' },
  tableWrap: { overflowX: 'auto', margin: '0 0 12px', border: '1px solid var(--mu-line)', borderRadius: '10px' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: '13px' },
  th: { textAlign: 'left', padding: '8px 12px', background: 'var(--mu-wash-2)', color: 'var(--mu-text)', fontWeight: 700, borderBottom: '1px solid var(--mu-line)', whiteSpace: 'nowrap' },
  td: { padding: '7px 12px', borderBottom: '1px solid var(--mu-wash-2)', verticalAlign: 'top' },
};
