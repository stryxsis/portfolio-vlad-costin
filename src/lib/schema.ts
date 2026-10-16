/**
 * I DATI STRUTTURATI (JSON-LD, schema.org) di ogni pagina.
 *
 * Fino al 2026-10-17 non ce n'era nessuno: `Seo.astro` sapeva già stamparli
 * (prop `jsonLd`) e `SITE.bio`/`SITE.author.sameAs` erano già scritti per
 * loro, ma nessuna pagina li passava.
 *
 * Un grafo per pagina, con nodi che si richiamano per `@id`: la Persona e il
 * Sito sono definiti UNA volta (`#person`, `#website`) e ogni pagina li
 * referenzia invece di ricopiarli. È la forma che Google raccomanda, ed è
 * anche quella in cui un dato cambiato in `site.ts` non può restare indietro
 * da qualche parte.
 *
 * ⚠ Nessun dato qui è scritto a mano: viene tutto da `site.ts`, dalla timeline
 * o dal frontmatter dei case study. Il numero di telefono NON compare (vedi la
 * regola sulla privacy in CLAUDE.md), e nemmeno la data di nascita.
 */
import { SITE } from './site';
import { abs } from './seo';
import { TIMELINE } from '../data/timeline';
import type { Project } from './collections';

const PERSON_ID = abs('/#person');
const WEBSITE_ID = abs('/#website');

/** La voce in corso di un tipo, come la legge il pannello «Adesso». */
const inCorso = (kind: 'studio' | 'lavoro') =>
  [...TIMELINE].reverse().find((e) => e.current === true && e.kind === kind);

function person() {
  const a = SITE.author;
  const lavoro = inCorso('lavoro');
  const studio = inCorso('studio');
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: a.name,
    givenName: a.givenName,
    familyName: a.familyName,
    jobTitle: a.jobTitle,
    description: SITE.bio,
    url: abs('/'),
    image: abs(SITE.ogImage.path),
    email: `mailto:${a.email}`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: a.location.locality,
      addressRegion: a.location.region,
      addressCountry: a.location.country,
    },
    ...(lavoro ? { worksFor: { '@type': 'Organization', name: lavoro.org } } : {}),
    ...(studio ? { affiliation: { '@type': 'CollegeOrUniversity', name: studio.org } } : {}),
    knowsLanguage: ['it', 'ro', 'en'],
    sameAs: a.sameAs,
  };
}

function website() {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: abs('/'),
    name: SITE.name,
    description: SITE.description,
    inLanguage: SITE.inLanguage,
    publisher: { '@id': PERSON_ID },
  };
}

/** Il nodo della pagina. `type` è il sottotipo schema.org più preciso. */
function webPage(path: string, name: string, type = 'WebPage', extra: Record<string, unknown> = {}) {
  return {
    '@type': type,
    '@id': `${abs(path)}#webpage`,
    url: abs(path),
    name,
    inLanguage: SITE.inLanguage,
    isPartOf: { '@id': WEBSITE_ID },
    ...extra,
  };
}

function breadcrumb(path: string, items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${abs(path)}#breadcrumb`,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: abs(it.path),
    })),
  };
}

const grafo = (...nodi: unknown[]) => ({ '@context': 'https://schema.org', '@graph': nodi });

/** Home: il sito, la persona, e la pagina che parla di lei. */
export const schemaHome = () =>
  grafo(website(), person(), webPage('/', SITE.titleDefault, 'WebPage', { about: { '@id': PERSON_ID } }));

/** /chi-sono: una ProfilePage, il cui soggetto è la persona. */
export const schemaChiSono = () =>
  grafo(
    website(),
    person(),
    webPage('/chi-sono', 'Chi sono', 'ProfilePage', {
      mainEntity: { '@id': PERSON_ID },
      breadcrumb: { '@id': `${abs('/chi-sono')}#breadcrumb` },
    }),
    breadcrumb('/chi-sono', [
      { name: 'Home', path: '/' },
      { name: 'Chi sono', path: '/chi-sono' },
    ])
  );

/** /portfolio: una raccolta, con l'elenco dei case study nell'ordine della pagina. */
export const schemaPortfolio = (projects: Project[]) =>
  grafo(
    website(),
    person(),
    webPage('/portfolio', 'Portfolio', 'CollectionPage', {
      about: { '@id': PERSON_ID },
      breadcrumb: { '@id': `${abs('/portfolio')}#breadcrumb` },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: projects.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: abs(`/portfolio/${p.id}`),
          name: p.data.title,
        })),
      },
    }),
    breadcrumb('/portfolio', [
      { name: 'Home', path: '/' },
      { name: 'Portfolio', path: '/portfolio' },
    ])
  );

/** Un case study: il lavoro (CreativeWork) e la pagina che lo racconta. */
export const schemaCaseStudy = (project: Project, image: string) => {
  const d = project.data;
  const path = `/portfolio/${project.id}`;
  const lavoroId = `${abs(path)}#lavoro`;
  return grafo(
    website(),
    person(),
    {
      '@type': 'CreativeWork',
      '@id': lavoroId,
      name: d.title,
      headline: d.title,
      alternativeHeadline: d.subtitle,
      description: d.description,
      image: abs(image),
      creator: { '@id': PERSON_ID },
      dateCreated: String(d.year),
      datePublished: d.pubDate.toISOString(),
      ...(d.updatedDate ? { dateModified: d.updatedDate.toISOString() } : {}),
      inLanguage: SITE.inLanguage,
      ...(d.stack.length ? { keywords: d.stack.join(', ') } : {}),
      ...(d.client ? { sourceOrganization: { '@type': 'Organization', name: d.client } } : {}),
      ...(d.liveUrl ? { sameAs: d.liveUrl } : {}),
    },
    webPage(path, d.title, 'WebPage', {
      mainEntity: { '@id': lavoroId },
      primaryImageOfPage: abs(image),
      breadcrumb: { '@id': `${abs(path)}#breadcrumb` },
    }),
    breadcrumb(path, [
      { name: 'Home', path: '/' },
      { name: 'Portfolio', path: '/portfolio' },
      { name: d.title, path },
    ])
  );
};

/** /contatti: una ContactPage, il cui soggetto è la persona da contattare. */
export const schemaContatti = () =>
  grafo(
    website(),
    person(),
    webPage('/contatti', 'Contatti', 'ContactPage', {
      about: { '@id': PERSON_ID },
      breadcrumb: { '@id': `${abs('/contatti')}#breadcrumb` },
    }),
    breadcrumb('/contatti', [
      { name: 'Home', path: '/' },
      { name: 'Contatti', path: '/contatti' },
    ])
  );

/** Privacy e cookie: pagine semplici, con il loro percorso. */
export const schemaLegale = (path: string, name: string) =>
  grafo(
    website(),
    webPage(path, name, 'WebPage', { breadcrumb: { '@id': `${abs(path)}#breadcrumb` } }),
    breadcrumb(path, [
      { name: 'Home', path: '/' },
      { name, path },
    ])
  );
