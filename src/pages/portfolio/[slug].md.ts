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
import { allProjects } from '../../lib/collections';
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
    // <Chapter id="sfida"> -> ## La sfida
    .replace(/<Chapter\s+id="(\w+)"(?:\s+title="([^"]*)")?\s*>/g, (_m, id: string, title?: string) => {
      const titles: Record<string, string> = {
        contesto: 'Il contesto',
        sfida: 'La sfida',
        processo: 'Il processo',
        risultato: 'Il risultato',
        note: 'Note tecniche',
      };
      return `\n## ${title || titles[id] || id}\n`;
    })
    .replace(/<\/Chapter>/g, '')
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
    ...d.metrics.map((m) => `- ${m.label}: ${m.value}`),
  ].filter(Boolean);

  const md = [
    `# ${d.title}`,
    '',
    `> ${d.subtitle}`,
    '',
    d.description,
    '',
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