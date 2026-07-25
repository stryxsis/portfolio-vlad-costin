/**
 * Nessun plugin di ordinamento classi Tailwind: in v4 non esiste un tailwind.config
 * da cui il plugin possa leggere l'ordine dei token.
 */
export default {
  plugins: ['prettier-plugin-astro'],
  singleQuote: true,
  semi: true,
  printWidth: 100,
  overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};