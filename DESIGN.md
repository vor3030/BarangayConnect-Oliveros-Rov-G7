# Barangay Connect — Design System (`DESIGN.md`)

## 1. Design Philosophy: Twilight Civic Sanctuary

Barangay Connect balances atmospheric calm with crisp operational clarity for Philippine barangay residents and officials:

- **Atmospheric Twilight Framing (Public Entry, Navigation Rail, Dashboard Heroes & Identity Cards):** Deep nocturnal evergreen-slate (`#0d1518` / `#101b1f`), translucent architectural glass rims (`rgba(235, 244, 246, 0.28)`), smoked dark glass panels (`rgba(11, 20, 24, 0.78)`), and warm lantern accents (champagne sand `#e7d4b5` and amber `#e59a3c`) evoke a welcoming barangay hall at dusk.
- **Crisp Daylight Operating Surfaces (Forms, Tables, Status Trackers, Queues):** Soft mineral canvas (`#f2f5f4`) paired with pure white cards (`#ffffff`), deep pine-slate ink (`#111e22`), and high-contrast status pills ensure effortless legibility for first-time mobile residents, senior citizens, and barangay staff processing high-volume requests.
- **Zero Developer Chrome:** All public and portal screens speak in plain civic language. No showcase banners, no placeholder boilerplate, and no internal specification codes in user-facing copy.

---

## 2. Color Tokens (`accounts/static/accounts/theme.css`)

### Twilight & Glass Surfaces
| Token | Value | Role |
|---|---|---|
| `--bc-night` | `#0d1518` | Deepest nocturnal canvas & landing ground |
| `--bc-sidebar` | `#101b1f` | Portal left sidebar, mobile bottom nav, dark accent cards |
| `--bc-fjord` | `#182930` | Elevated twilight surfaces, light-surface default avatars |
| `--bc-pine` | `#173832` | Deep evergreen accent |
| `--bc-glass-dark` | `rgba(11, 20, 24, 0.78)` | Smoked glass floating cards (`Live queue pulse`, certificate preview) |
| `--bc-glass-field` | `rgba(255, 255, 255, 0.08)` | Nested metric wells inside smoked glass cards |
| `--bc-glass-border` | `rgba(235, 244, 246, 0.16)` | Glass panel hairline border |
| `--bc-glass-rim` | `rgba(235, 244, 246, 0.28)` | Architectural inset frame border on heroes & profile cards |
| `--bc-on-dark` | `#f5f8f8` | Primary text on twilight surfaces (`>14:1` contrast) |
| `--bc-on-dark-muted` | `#bdd0d6` | Secondary text on twilight surfaces (`>9:1` contrast) |

### Warm Lantern & Champagne Accents
| Token | Value | Role |
|---|---|---|
| `--bc-champagne` | `#e7d4b5` | Primary warm CTA on dark/twilight surfaces & dark-surface focus outlines |
| `--bc-champagne-hover` | `#f2e4cb` | Champagne hover state |
| `--bc-champagne-ink` | `#111c20` | Text on champagne buttons (`11.96:1` contrast) |
| `--bc-amber` | `#e59a3c` | Lantern indicators & Pending dot on dark backgrounds |
| `--bc-amber-ink` | `#7d4908` | Accessible amber text on light surfaces (`7.45:1` contrast) |

### Crisp Daylight Operating Surfaces & Semantic States
| Token | Value | Role |
|---|---|---|
| `--bc-background` | `#f2f5f4` | Portal operational page ground |
| `--bc-surface` | `#ffffff` | Cards, tables, forms, floating launcher pill |
| `--bc-inset` | `#e6eeec` | Hover fills & subtle icon wells |
| `--bc-ink` | `#111e22` | Primary operational copy (`15.6:1` on white) |
| `--bc-muted` | `#4b5f66` | Supporting labels, metadata, timestamps (`6.3:1` on white) |
| `--bc-accent` | `#173b35` | Primary action buttons, links, Approved state (`12.2:1` with white text) |
| `--bc-accent-hover` | `#0f2a26` | Primary button hover |
| `--bc-border` | `#d5e0de` | Structural card & table dividers |
| `--bc-control-border` | `#8da1a6` | Interactive secondary button, filter pill, and chip borders |
| `--bc-field-border` | `#687e84` | Text input, select, and textarea borders (`4.28:1`) |
| `--bc-error` | `#a3262a` | Validation errors & Rejected status (`6.63:1` on `--bc-error-bg`) |
| `--bc-error-bg` | `#fdf1f1` | Error summary & Rejected pill surface |
| `--bc-success-bg` | `#e7f3ee` | Success notices & Approved pill surface |
| `--bc-success-border` | `#b3d5c7` | Success notice & Approved pill border |

---

## 3. Typography & Scale

- **Font Family:** Single geometric humanist sans-serif — `"Manrope Variable", "Segoe UI", system-ui, -apple-system, sans-serif` (self-hosted WOFF2 via `@fontsource-variable/manrope`).
- **Display Voice:** Dual-weight contrast on atmospheric heroes (`font-weight: 300` light lead lines paired with `font-weight: 700` bold focal line; tight display tracking `-0.032em`).
- **Hierarchy:**
  - Landing Hero `h1`: `clamp(2.65rem, 6.2vw, 4.95rem)`, line-height `1.03`
  - Portal Hero `h1`: `clamp(2rem, 3.3vw, 2.95rem)`, line-height `1.12`
  - Page `h1`: `clamp(1.75rem, 2.7vw, 2.35rem)`, weight `700`
  - Section `h2`: `clamp(1.3rem, 2vw, 1.7rem)`, weight `650`
  - Smoked Card `h2`: `1.4rem`, weight `600`
  - Body copy: `1rem / 1.6`, `text-wrap: pretty`; headings use `text-wrap: balance`
  - Micro-label floor: `>= 0.78rem` (`12.5px`) for senior readability
  - Numeric alignment: `font-variant-numeric: tabular-nums` on all counts, REQ IDs, dates, copy counts, and phone numbers.

---

## 4. Layout, Geometry & Elevation

- **Radii:** `--bc-frame-radius: 1.75rem` (architectural outer frames), `--bc-card-radius: 1.35rem` (operational cards), `--bc-control-radius: 0.75rem` (form fields & notices), `--bc-pill-radius: 999px` (buttons, status pills, floating service launcher, filter tabs).
- **Z-Index Scale:** `--z-base: 1`, `--z-sticky: 20`, `--z-sidebar: 30`, `--z-nav-mobile: 40`, `--z-popover: 50`, `--z-progress: 60`, `--z-skip: 100`.
- **Responsive Breakpoints:**
  - Desktop (`> 64rem`): Fixed `16rem` (`14.5rem` at `<= 75rem`) twilight sidebar + top breadcrumb/role header + `76rem` operational workspace.
  - Tablet & Mobile (`<= 64rem`): Full-bleed top brand header + bottom twilight navigation bar (`Overview | Requests/Queue | Profile | Help`) with `env(safe-area-inset-bottom)` padding and deliberate Sign Out located inside Profile to prevent accidental thumb-zone logouts.
  - Narrow Mobile (`<= 46.99rem`): Single-column stacked metrics, 3-column landing workflow tab bar, structured mobile request cards with full-width action buttons, and compact floating Help Desk icon button.

---

## 5. Component Grammar & Interaction Patterns

1. **Framed Atmospheric Hero (`.sanctuary-frame`, `.hero`):** Full-bleed Philippine barangay twilight photography (`hero-barangay-hall.jpg` on landing/auth, `hero-barangay-plaza.jpg` on dashboards/profile) bounded by an inset translucent glass rim (`::after`), enhanced by an interactive Three.js WebGL lantern particle canvas (`barangay-atmosphere.js`), live mood switching, Framer Motion spring pills, Anime.js staggered transitions and KPI roll-ups, and GSAP ScrollTrigger depth parallax.
2. **Floating White Service Launcher (`.floating-launcher`):** Real `GET` form on `/` submitting `document_type`, `purpose`, and `copies` directly into `/requests/new/` with automatic pre-population, linked bidirectionally via Alpine.js (`landingPortal`) with the smoked-glass certificate preview card.
3. **Smoked-Glass Action Panel (`.smoked-service-card`, `.hero-glass-panel`):** Dark frosted glass container hosting live metrics or interactive certificate previews with 5 clickable indicator dots, `aria-live="polite"` feedback, and a high-contrast pure-white pill CTA.
4. **Real-Time Status Stepper (`.doc-stepper`):** Explicit semantic colors — `Pending` (amber), `Approved` (pine accent), `Completed` (verified pine), `Rejected` (crimson) — backed by `aria-current="step"` and screen-reader state prefixes so status never relies on color alone.
5. **Instant Dashboard Filtering (`dashboardFilter`):** Client-side Alpine.js status pills and live search over recent requests and oldest-first pending queues, complete with live match counters and accessible empty-state reset actions.
6. **Staff Quick-Remark Presets (`reviewPresets`):** Sticky desktop review panel on `/requests/<id>/review/` with one-click Barangay Window 2 pickup, release, and clarification remark templates.

---

## 6. Accessibility & Motion Standards

- **WCAG AA Compliance:** Verified contrast ratios across light and twilight glass surfaces, `>= 44×44px` (`2.75rem`) minimum touch targets on interactive buttons/links/inputs, strict `h1 → h2 → h3` heading outlines, native `<nav>` landmarks, forced-colors-safe input focus outlines, and automatic focus return on modal/popover dismissal (`Escape` & click-outside).
- **Motion Discipline:** Compositor-only `transform` and `opacity` transitions (`<= 200ms` for interactive feedback, `<= 280ms` for calm load entrance); native CSS Scroll-Driven Animations (`animation-timeline: scroll()`) for scroll progress where supported; cached bounding boxes in `ResizeObserver` for WebGL pointer handlers; and complete `prefers-reduced-motion: reduce` support (`transition: none !important`, zero continuous Three.js drift, Pause/Resume toggles on all 3D stages).
