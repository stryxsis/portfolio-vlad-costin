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

/** Precedente e successivo nell'ordine della griglia, per la navigazione in
 *  fondo al case study. Ciclico: dall'ultimo si torna al primo. */
export async function projectNeighbours(
  id: string
): Promise<{ prev: Project | null; next: Project | null }> {
  const items = await allProjects();
  const i = items.findIndex((p) => p.id === id);
  if (i === -1 || items.length < 2) return { prev: null, next: null };
  return {
    prev: items[(i - 1 + items.length) % items.length] ?? null,
    next: items[(i + 1) % items.length] ?? null,
  };
}

/** Articoli pubblicati, dal più recente. */
export async function publishedPosts(): Promise<Post[]> {
  const items = await getCollection('blog', isVisible);
  return items.sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}