# Barangay Connect design direction

A warm, resident-first portal: clear enough for everyday tasks, considered enough to feel cared for.

## Palette and type

- Forest green `#244C3C`: primary actions, navigation, community scene.
- Sand beige `#E7DCC8`: welcoming panels, highlights, and inverse actions.
- Muted terracotta `#9E5037`: a small warm accent for editorial details and supporting icons.
- Warm paper `#FFFDF8`, ink `#203C32`, and muted text `#686B5E` keep the interface readable.
- Locally hosted Manrope for controls and body text; Lora for welcoming headlines. Fonts ship through the frontend build rather than third-party browser requests.

## Interaction and content

- Django templates and Alpine.js; no React. Motion's JavaScript API handles brief press, hover, and FAQ feedback; GSAP retains scroll reveals and SVG paths; Three.js retains the neighborhood scene.
- Desktop navigation stays in a quiet sidebar. At tablet/phone widths, primary navigation moves to a three-item bottom bar with safe-area clearance.
- Every quick action has a working destination. Profile completion counts the four displayed account details; enrollment statistics come from actual account counts. No fabricated notices, dates, service availability, or testimonials.
- Native details/summary controls provide help without requiring JavaScript. Password visibility is progressively enhanced; inline errors remain server rendered, with a linked error summary on failed submissions.
- Visible keyboard focus, clear labels, usable touch targets, natural text reflow, reduced-motion support, and static WebGL fallbacks take precedence over decorative animation.

## Public interface showcase

The public home page `/` (also available at `/portfolio-showcase/`) presents the actual account screens first, using the same forest/sand/terracotta palette and typography. The opening profile example, resident fields, and coherent staff counts are read-only samples, identified before the preview. No live resident information is shown. Tabs represent screens rather than mixing role and screen categories, and support arrow keys, Home, and End. Desktop/phone sizing is available at wide viewports; narrow viewports hide that selector and use a clearly responsive layout. Without JavaScript, all three examples and their captions remain available.

The page uses an enlarged screen followed by concise workflow notes and a sign-in identifier example. Repeated slogans, floating assurance cards, orbital decoration, palette/type specimen cards, the arbitrary donut, the motion study, and the oversized closing CTA have been removed. Supporting type and color choices are a compact note rather than the main content.

Motion on this page has explicit jobs: one opening screen reveal, brief screen/device transitions, identifier-example feedback, and press feedback. There are no autonomous loops. The page motion control finishes active effects and suppresses future transitions, CSS highlights, and Motion gestures; OS reduced motion takes precedence. The operational portal keeps its existing neighborhood and navigation effects. No scroll hijacking or navigation interception is used.

## References

- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): ran its design-system search for an accessible government community portal. Applied its Accessible & Ethical direction, contrast/focus guidance, and restrained motion; user-selected colors override the suggested blue palette. The enterprise sales layout recommendation was not applicable to this account portal.
- [21st.dev Sidebar](https://docs.21st.dev/@wensity/components/sidebar) and [Feature Overview Bento](https://docs.21st.dev/@mohammadshehadeh/components/feature-10): visual references for navigation hierarchy, card composition, and clear active states. Reimplemented as original Django/CSS components rather than importing their React source.
- [Motion JavaScript](https://motion.dev/docs/animate): framework-free gesture animations.
