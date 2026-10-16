/**
 * /llms.txt — il sito in breve, per i modelli linguistici e gli agenti AI.
 * Formato di llmstxt.org: un H1, un riassunto in blockquote, poi elenchi di
 * link in Markdown divisi per sezione.
 *
 * Generato in build e non scritto a mano, per la stessa ragione di robots.txt:
 * ogni riga viene da una fonte che esiste già. Il riassunto è `SITE.bio` (la
 * bio in terza persona scritta apposta per chi la cita senza riscriverla); i
 * lavori vengono dalla collection, con il loro mirror in Markdown
 * (`/portfolio/<slug>.md`), che un agente legge senza dover estrarre il testo
 * dall'HTML. Un case study nuovo compare qui da solo.
 *
 * ⚠ Il numero di telefono NON va qui. Vive solo in `SITE.author.whatsapp` e ha
 * un solo uso dichiarato, il link della CTA (vedi la regola sulla privacy in
 * CLAUDE.md): per un agente bastano email e modulo.
 */
import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';
import { abs } from '../lib/seo';
import { allProjects } from '../lib/collections';

export const GET: APIRoute = async () => {
  const projects = await allProjects();
  const a = SITE.author;

  const righe = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.bio}`,
    '',
    `Portfolio personale, solo in italiano. ${SITE.availability ? `${SITE.availability}: ` : ''}per un progetto, il canale giusto è il modulo nella pagina Contatti.`,
    '',
    '## Pagine',
    '',
    `- [Home](${abs('/')}): chi è, cosa fa, i lavori in evidenza e le recensioni dei clienti.`,
    `- [Chi sono](${abs('/chi-sono')}): il percorso fra studio e lavoro, il metodo, gli strumenti e le lingue.`,
    `- [Portfolio](${abs('/portfolio')}): tutti i lavori, ognuno con il suo case study.`,
    `- [Contatti](${abs('/contatti')}): modulo con allegati, email, LinkedIn e GitHub.`,
    '',
    '## Case study',
    '',
    ...projects.map((p) => `- [${p.data.title}](${abs(`/portfolio/${p.id}.md`)}): ${p.data.description}`),
    '',
    '## Contatti',
    '',
    `- [Email](mailto:${a.email}): ${a.email}`,
    `- [LinkedIn](${a.linkedin})`,
    `- [GitHub](${a.github.url})`,
    '',
    '## Optional',
    '',
    `- [Curriculum (PDF)](${abs(SITE.cv.path)}): ultima versione, ${SITE.cv.updated}.`,
    `- [Privacy](${abs('/privacy')}): come vengono trattati i dati di chi scrive.`,
    `- [Cookie](${abs('/cookie')}): il sito non usa cookie.`,
    '',
  ];

  return new Response(righe.join('\n'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
