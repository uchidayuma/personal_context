import type { ReactNode } from 'react'
import styles from './SimpleMarkdown.module.css'

function inlineFormat(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

export default function SimpleMarkdown({ children }: { children: string }) {
  const lines = children.split('\n')
  const nodes: ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('### ')) {
      nodes.push(<h3 key={i} className={styles.h3}>{inlineFormat(line.slice(4))}</h3>)
      i++
    } else if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} className={styles.h2}>{inlineFormat(line.slice(3))}</h2>)
      i++
    } else if (line.startsWith('# ')) {
      nodes.push(<h1 key={i} className={styles.h1}>{inlineFormat(line.slice(2))}</h1>)
      i++
    } else if (line.startsWith('> ')) {
      nodes.push(<blockquote key={i} className={styles.blockquote}>{inlineFormat(line.slice(2))}</blockquote>)
      i++
    } else if (line.startsWith('- ')) {
      const items: ReactNode[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(<li key={i}>{inlineFormat(lines[i].slice(2))}</li>)
        i++
      }
      nodes.push(<ul key={`ul-${i}`} className={styles.ul}>{items}</ul>)
    } else if (line.startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        const row = lines[i].split('|').slice(1, -1).map(c => c.trim())
        if (!row.every(c => /^[-: ]+$/.test(c))) rows.push(row)
        i++
      }
      if (rows.length > 0) {
        nodes.push(
          <table key={`tbl-${i}`} className={styles.table}>
            <thead>
              <tr>{rows[0].map((c, j) => <th key={j}>{inlineFormat(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.slice(1).map((row, r) => (
                <tr key={r}>{row.map((c, j) => <td key={j}>{inlineFormat(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        )
      }
    } else if (line.trim() === '' || line.startsWith('---')) {
      i++
    } else {
      nodes.push(<p key={i} className={styles.p}>{inlineFormat(line)}</p>)
      i++
    }
  }

  return <div className={styles.root}>{nodes}</div>
}
