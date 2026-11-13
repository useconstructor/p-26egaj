---
name: imageless-premium-visuals
description: Build an agency-level site when no photographs or raster images are provided (Constructor "imageless" builds). Use when .build-instructions.md contains "IMAGELESS VISUAL MODE", or when a page needs premium visuals but public/ has no photos. Covers brand systems, SVG illustration, texture, motion and keeping data independent of images.
---

# Imageless premium visuals

No photograph, render or stock image exists for this build, and none will arrive
later. Do not download, fetch or generate raster images. The site must still look
like the work of a top agency. The visuals come from code: type, colour, vector
illustration, texture, layout and motion.

## 1. Brand system first

Before you build any page, define the system in `src/app/globals.css` (Tailwind 4 `@theme`):

- Colour tokens from the plan palette: surface, surface-alt, ink, muted, accent,
  plus one deep "stage" colour for dramatic bands.
- Type: one display face with real character (condensed, slab, wide grotesk or
  high-contrast serif) and one readable text face. Build a steep scale, for
  example `clamp(3rem, 9vw, 9rem)` for the hero, and tight leading on display sizes.
- Motion tokens: `--ease-out: cubic-bezier(.16,1,.3,1)`, durations of 180, 320
  and 700 ms.
- One motif taken from the subject (comal rings, papel picado cut-outs, ticket
  perforations, chalk menu rules). Reuse it everywhere: dividers, buttons,
  section edges, loading states.

## 2. Hero without a photo

Pick one approach and commit to it:

- **Typographic poster:** an oversized wordmark or headline as the composition,
  with an inline SVG illustration overlapping the type. The primary action
  stays in the first phone viewport.
- **Illustrated scene:** a layered SVG of the offering, with simple parallax
  between the layers.
- **Colour-field split:** a bold stage-colour panel with a large SVG mark and an
  animated pattern on one side, and the copy and action on the other.

The LCP element should be text or inline SVG, never a missing image.

## 3. SVG illustration recipes

- Build illustrations from a small set of primitives (circles, rounded rects,
  paths) in the brand palette, using `currentColor` or CSS variables for fills.
- Keep one consistent style: either flat fills with a 2px ink stroke, or flat
  fills with no stroke. Don't mix the two.
- For catalogs, make a **parametric component**, for example
  `<DishIllustration variant="pastor" />`. All items share base shapes
  (plate, tortilla) and change toppings, colours and garnish per item, so every
  item looks distinct but belongs to the same family.
- Decorative SVG: `aria-hidden="true"`. Meaningful SVG: `role="img"` with
  `<title>`.
- Keep each inline SVG small, with fewer than about 60 elements. Put repeated
  parts in `<symbol>`/`<use>`.

## 4. Texture and depth

- Grain: an SVG `feTurbulence` filter as a fixed overlay at about 4–8%
  opacity, with `pointer-events: none`.
- Pattern: an SVG `<pattern>` or a `background-image` data URI built from the motif.
- Light: layered `radial-gradient` and `conic-gradient` in brand colours. Avoid
  generic purple-blue blobs.
- Depth: overlapping bands, rotated stickers or labels, cut-out section edges
  (`clip-path`), and shadows that have a direction.

## 5. Motion that feels expensive

- Reveal on scroll with IntersectionObserver. Add a class once, and stagger
  children with `style={{ '--i': index }}` and `transition-delay: calc(var(--i) * 60ms)`.
- Where supported, use scroll-driven CSS (`animation-timeline: view()` inside
  `@supports`), and fall back to the observer.
- Microinteractions: button press scale (0.98), hover lift with shadow,
  underline draw, and an SVG garnish that wiggles on hover.
- One **signature interaction** tied to the brand, for example the illustration
  assembling when an item is added to the cart.
- Respect `prefers-reduced-motion: reduce`: no transforms or parallax, just
  instant or opacity-only changes.
- Use CSS and the Web Animations API only. Don't add animation packages that
  aren't already in package.json.

```tsx
'use client'
import { useEffect, useRef } from 'react'
export function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect() } }, { rootMargin: '0px 0px -10% 0px' })
    io.observe(el); return () => io.disconnect()
  }, [])
  return <div ref={ref} className="reveal">{children}</div>
}
```

## 6. Data never depends on images

- Seed the example catalog or menu inside the normal atomic, idempotent database
  initialization, so it exists the first time the app runs.
- Ordering, booking, availability and owner tools must work without image
  files, asset manifests, hashes, bindings or a separate operator command.
- Store no image URL columns unless the user asked for them. The illustration
  variant comes from the item id or slug.

## Never

- Grey boxes, empty frames, "Imagen no disponible", or broken `<img>`/`next/image` paths.
- Emoji or giant lucide icons standing in for illustrations.
- Gradient product cards with just a name on them.
- Loading, error or retry states for photographs that don't exist.

## Checklist

- [ ] `grep -rn "/images/" src` only shows files that really exist in `public/`.
- [ ] The hero reads as a finished poster at 375px and 1440px.
- [ ] Every catalog item has its own authored illustration.
- [ ] Reveal and stagger animations run, and reduced motion disables the transforms.
- [ ] The catalog shows data on a fresh database without any manual step.
