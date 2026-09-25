/**
 * MIRROR IN MARKDOWN PURO di ogni case study: /portfolio/<slug>.md
 *
 * Costa una ventina di righe e serve al GEO: un agente che recupera la pagina
 * per conto di un utente ottiene il contenuto senza doverlo estrarre dall'HTML,
 * senza CSS, senza componenti. È anche il modo più economico di rendere il
 * contenuto verificabile.
 *
 * Funziona solo con `trailingSlash: 'never'`: con lo slash finale il path
 * `.md` non si risolverebbe.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { allProjects, verifiedMetrics } from '../../lib/collections';
import { CHAPTERS, type ChapterId } from '../../lib/chapters';
import { SITE } from '../../lib/site';
import { abs } from '../../lib/seo';
import { isoDate } from '../../lib/format';

export const getStaticPaths = (async () => {
  const projects = await allProjects();
  return projects.map((project) => ({ params: { slug: project.id }, props: { project } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const { project } = props as { project: Awaited<ReturnType<typeof allProjects>>[number] };
  const d = project.data;

  // Il corpo MDX contiene i tag <Chapter>: si sostituiscono con heading di
  // markdown, così il testo resta leggibile senza JSX.
  const body = (project.body ?? '')
    // Rimuove la riga di import dei componenti.
    .replace(/^import .*$/gm, '')
    // <Chapter id="sfida"> -> ## La sfida (i titoli da lib/chapters, la fonte unica)
    .replace(/<Chapter\b([^>]*)>/g, (_m, attrs: string) => {
      const id = /\bid="(\w+)"/.exec(attrs)?.[1] as ChapterId | undefined;
      const title = /\btitle="([^"]*)"/.exec(attrs)?.[1];
      return `\n## ${title || (id && CHAPTERS[id]?.title) || id}\n`;
    })
    .replace(/<\/Chapter>/g, '')
    // I passi diventano ### (il numero lo dà l'ordine).
    .replace(/<Step\s+title="([^"]*)"\s*>/g, '\n### $1\n')
    .replace(/<\/?Steps>|<\/Step>/g, '')
    // Una coppia problema/soluzione: le righe presenti, con la loro etichetta.
    .replace(/<ProblemSolution\b([\s\S]*?)\/>/g, (_m, attrs: string) => {
      const get = (k: string) => new RegExp(`\\b${k}="([^"]*)"`).exec(attrs)?.[1];
      const rows: [string, string | undefined][] = [
        ['Problema', get('problem')],
        ['Intervento', get('solution')],
        ['Perché così', get('rationale')],
        ['Compromesso', get('tradeoffs')],
        ['Evidenza', get('evidence')],
      ];
      const t = get('title');
      return [
        t ? `\n### ${t}\n` : '',
        ...rows.filter(([, v]) => v).map(([k, v]) => `**${k}.** ${v}\n`),
      ].join('\n');
    })
    // Le citazioni diventano blockquote.
    .replace(/<CaseQuote[^>]*>/g, '\n> ')
    .replace(/<\/CaseQuote>/g, '\n')
    // Gli altri componenti e i commenti JSX non hanno equivalente testuale.
    .replace(/<CaseFigure[^>]*\/>/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const facts = [
    `- Anno: ${d.year}`,
    `- Ruolo: ${d.role}`,
    d.client ? `- Cliente: ${d.client}` : null,
    d.stack.length ? `- Stack: ${d.stack.join(', ')}` : null,
    d.liveUrl ? `- Online: ${d.liveUrl}` : null,
    // SOLO le verificate, con la loro fonte: vedi `verifiedMetrics`.
    ...verifiedMetrics(d.metrics).map(
      (m) => `- ${m.label}: ${m.value}${m.unit ? ` ${m.unit}` : ''} (fonte: ${m.source})`
    ),
  ].filter(Boolean);

  const md = [
    `# ${d.title}`,
    '',
    `> ${d.subtitle}`,
    '',
    d.description,
    '',
    ...(d.status === 'demo' ? ['> ⚠ Progetto di esempio: i contenuti sono segnaposto.', ''] : []),
    '## Dati',
    '',
    ...facts,
    `- Pubblicato: ${isoDate(d.pubDate)}`,
    `- Autore: ${SITE.author.name} — ${abs('/')}`,
    `- Pagina: ${abs(`/portfolio/${project.id}`)}`,
    '',
    body,
    '',
  ].join('\n');

  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};