type Attachment = { name: string; context: string };
type Pinned = { source_name: string; extracted_text: string };

export function attachmentFirstContext(attachments: Attachment[], pinned: Pinned[], question: string) {
  const sources = attachments.length ? attachments : pinned.map(p => ({ name: p.source_name, context: p.extracted_text }));
  if (!sources.length) return '';
  if (sources.some(s => !s.context.trim())) throw new Error('The active file could not be read. Retry or remove it.');
  const budget = Math.floor(24000 / sources.length);
  const query = new Set(question.toLowerCase().match(/[a-z]{4,}/g) || []);
  return sources.map(source => {
    const paragraphs = source.context.split(/\n\s*\n/).map((text, order) => ({ text, order,
      rank: (text.toLowerCase().match(/[a-z]{4,}/g) || []).filter(t => query.has(t)).length }));
    let remaining = budget;
    const chosen = paragraphs.sort((a, b) => b.rank - a.rank || a.order - b.order).filter(p => {
      if (p.text.length > remaining) return false;
      remaining -= p.text.length + 2; return true;
    }).sort((a, b) => a.order - b.order);
    if (!chosen.length) throw new Error('The active source is too large to read safely. Select a smaller section.');
    return `[ACTIVE SOURCE: ${source.name}]\n${chosen.map(p => p.text).join('\n\n')}`;
  }).join('\n\n');
}
