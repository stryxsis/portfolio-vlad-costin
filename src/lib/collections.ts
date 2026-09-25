/**
 * Tutte le query sulle collection in un solo posto.
 *
 * Motivo: il filtro sui draft deve essere impossibile da dimenticare. Se ogni
 * pagina chiamasse `getCollection` da sé, prima o poi una lo ometterebbe e
 * pubblicherebbe una bozza.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Project = CollectionEntry<'projects'>;
export type Post = CollectionEntry<'blog'>;
export type Metric = Project['data']['metrics'][number];

/**
 * Le sole metriche pubblicabili. ⚠ È L'UNICO filtro: case study, mirror .md
 * e chiunque altro renda risultati passa di qui, così un numero non verificato
 * non ha nessuna strada per finire in pagina.
 */
export const verifiedMetrics = (metrics: Metric[]): Metric[] => metrics.filter((m) => m.verified);

/** In dev le bozze si vedono, in produzione no: si lavora su un contenuto
 *  incompleto senza doverlo marcare pubblicato. */
const isVisible = ({ data }: { data: { draft: boolean } }) =>
  import.meta.env.DEV || !data.draft;

/** Tutti i progetti pubblicati, ordinati per `order` e poi per anno discendente. */
export async function allProjects(): Promise<Project[]> {
  const items = await getCollection('projects', isVisible);
  return items.sort((a, b) => a.data.order - b.data.order || b.data.year - a.data.year);
}

/** I progetti in evidenza per la Home. `limit` protegge dal caso in cui si
 *  dimentichi di togliere un `featured`. */
export async function featuredProjects(limit = 3): Promise<Project[]> {
  return (await allProjects()).filter((p) => p.data.featured).slice(0, limit);
}

/**
 * Dove sta un progetto nel catalogo, e chi gli sta accanto. Serve al selettore
 * del palco e alla navigazione in fondo al case study.
 *
 * ⚠ NON è più ciclico (dal 2026-09-25). Dall'ultimo si tornava al primo, e con
 * un contatore `03 / 03` accanto il "successivo" che riporta a `01` è una
 * freccia che mente sulla direzione. Agli estremi il link semplicemente non
 * c'è; con un progetto solo non c'è nessuno dei due.
 */
export async function projectNeighbours(id: string): Promise<{
  prev: Project | null;
  next: Project | null;
  index: number;
  all: Project[];
}> {
  const all = await allProjects();
  const index = all.findIndex((p) => p.id === id);
  return {
    prev: index > 0 ? (all[index - 1] ?? null) : null,
    next: index !== -1 ? (all[index + 1] ?? null) : null,
    index,
    all,
  };
}

/**
 * Il percorso del case study di un progetto, SE quel case study è pubblicato
 * (in dev anche le bozze, come ovunque). Serve a chi mostra un progetto fuori
 * dalla collection — la vetrina della Home — per decidere se offrire "Leggi il
 * case study" senza scrivere a mano un URL che potrebbe non esistere.
 */
export async function caseStudyHref(slug: string | undefined): Promise<string | undefined> {
  if (!slug) return undefined;
  return (await allProjects()).some((p) => p.id === slug) ? `/portfolio/${slug}` : undefined;
}

/** Articoli pubblicati, dal più recente. */
export async function publishedPosts(): Promise<Post[]> {
  const items = await getCollection('blog', isVisible);
  return items.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}