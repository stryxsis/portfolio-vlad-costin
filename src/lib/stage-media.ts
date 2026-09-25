/**
 * Le opzioni d'immagine del visual del palco, in UN posto solo.
 *
 * ⚠ Due consumatori che DEVONO coincidere al byte: `ProjectVisual.astro` (il
 * `<Picture>` vero) e il preload su intento del selettore (`ProjectSwitcher`,
 * che chiede a `getImage()` lo stesso srcset). Se le opzioni divergessero, il
 * preload scaricherebbe un file che poi nessuno usa — banda sprecata proprio
 * nell'istante in cui serve a far arrivare prima quello giusto.
 */
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

export const STAGE_IMG = {
  widths: [640, 960, 1280, 1680, 2000],
  sizes: '(min-width: 90rem) 50rem, (min-width: 56.25rem) 56vw, 92vw',
  formats: ['avif', 'webp'],
} as const;

/** Lo srcset AVIF del visual, per il `<link rel=preload imagesrcset>`. */
export async function stagePreload(src: ImageMetadata): Promise<string> {
  const img = await getImage({
    src,
    widths: [...STAGE_IMG.widths],
    sizes: STAGE_IMG.sizes,
    format: 'avif',
  });
  return img.srcSet.attribute;
}
