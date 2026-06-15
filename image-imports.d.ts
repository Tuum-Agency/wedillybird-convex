// Types des imports statiques d'images (`import img from './x.jpg'`).
//
// Normalement fournis par `next-env.d.ts`, mais celui-ci est git-ignoré et n'est
// PAS régénéré dans le job CI « TypeScript » (qui lance `tsc` sans `next build`).
// Ce fichier committé garantit que `tsc --noEmit` résout les imports d'images en
// CI comme en local. Référence identique à next-env.d.ts → aucun conflit.
/// <reference types="next/image-types/global" />
