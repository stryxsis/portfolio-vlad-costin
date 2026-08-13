/**
 * Le competenze, dai dati reali del CV.
 *
 * Presentate come INVENTARIO e non come barre di percentuale: una barra al 70%
 * non significa niente (70% di cosa? misurato da chi?) ed è il cliché più
 * riconoscibile del portfolio da studente. Un elenco tipografico onesto dice la
 * stessa cosa senza inventare numeri.
 */
import type { SkillGroup } from '../lib/types';

export const SKILLS: SkillGroup[] = [
  {
    label: 'Linguaggi',
    items: ['JavaScript', 'TypeScript', 'PHP', 'Python', 'C++', 'C#', 'SQL', 'HTML', 'CSS'],
  },
  {
    label: 'Framework e strumenti',
    items: [
      'Astro',
      'React',
      'Node.js',
      'Express',
      'Tailwind CSS',
      'Bootstrap',
      'SCSS',
      'jQuery',
      'GSAP',
    ],
  },
  {
    label: 'Ambienti',
    items: ['Visual Studio Code', 'Visual Studio', 'Android Studio', 'Git'],
  },
  {
    /* Riga dedicata e separata da "Ambienti": è la lista che Vlad vuole
       poter allungare più spesso di tutte le altre, quindi ha un posto suo
       invece di essere mescolata a editor/IDE che non cambiano quasi mai. */
    label: 'Strumenti AI',
    items: ['Claude Code', 'Antigravity'],
  },
  {
    label: 'Corsi completati',
    note: 'FreeCodeCamp · Codegrinde',
    items: ['JavaScript', 'PHP', 'Node.js', 'React', 'API con Express', 'Bootstrap', 'Tailwind'],
  },
];

/** Lingue parlate. Vive qui e non in site.ts perché è contenuto della pagina
 *  About, non un dato di identità del sito. */
export const LANGUAGES = [
  { name: 'Italiano', level: 'madrelingua' },
  { name: 'Romeno', level: 'madrelingua' },
  { name: 'Inglese', level: 'intermedio' },
] as const;