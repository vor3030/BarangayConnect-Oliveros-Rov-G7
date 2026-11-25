# Barangay Connect — Product Context

## Product Summary
Barangay Connect is a Django web platform for a pilot Philippine barangay that moves essential barangay transactions online—eliminating long physical queues, manual paper logbooks, and unnecessary in-person status trips to the barangay hall.

## Users
- **Residents** (including remote workers, students, senior citizens, and persons with disabilities): register and manage their resident profile, submit online requests for standard barangay documents (Barangay Clearance, Certificate of Indigency, Certificate of Residency, Barangay Business Clearance, First-Time Jobseeker Certificate), edit or cancel pending requests, and track real-time processing status and staff pickup remarks.
- **Barangay Officials & Staff** (Admin role): monitor resident enrollment, review incoming document requests in a unified Request Queue, verify purposes, transition request statuses (`Pending` → `Approved` / `Rejected` / `Completed`), record pickup instructions or rejection reasons, and maintain digital audit history logs.

## Core Capabilities
1. **Public Landing Page (`/`)**: Introduces Barangay Connect, provides an interactive quick service launcher that routes directly into document requests, interactive service workflow walkthroughs, and an interactive 3D purok community overview.
2. **Authentication & Profiles (`/register/`, `/login/`, `/profile/`, `/profile/edit/`)**: Case-insensitive email or username sign-in, resident registration with unique email/username validation, profile editing, and validated profile photo uploads stored in PostgreSQL.
3. **Role-Based Dashboards (`/dashboard/resident/`, `/dashboard/admin/`)**: Resident overview with live document request metrics and profile progress; Admin/Staff overview with pending request queue, quick review links, and resident enrollment chart.
4. **Online Document & Service Requests (`/requests/*`)**: Full CRUD vertical slice with PostgreSQL/Supabase persistence, strict role/ownership enforcement (BR-01, BR-03, BR-04, BR-05), duplicate pending prevention, real-time progress stepper, and chronological `DocumentRequestLog` audit timeline.

## Brand Commitments
- **Visual Direction (User-Pinned via Reference Imagery)**: Inspired by serene architectural twilight photography—deep evergreen-slate atmosphere, translucent architectural glass framing, smoked dark-glass floating action cards, crisp pure-white pill command/search bars, warm champagne-sand and soft amber-lantern accents, paired with high-contrast daylight operational surfaces for effortless form and table legibility.
- **Voice & Copy**: Calm, direct, welcoming, plain language. Never display developer/placeholder framing such as "Interface showcase" or "Illustrative UI only".
- **Accessibility & Performance**: WCAG AA contrast (≥ 4.5:1 body, ≥ 3:1 large text/UI), visible keyboard focus, semantic landmarks, native form controls, compositor-only (`transform`, `opacity`) motion respecting `prefers-reduced-motion`, and full zero-overflow responsiveness from 375px mobile to 1440px+ desktop.
- **Stack Constraint**: Django server-rendered templates + vanilla CSS + esbuild-bundled vanilla JS (Alpine.js, Anime.js, GSAP, Motion, Chart.js, Three.js); no React migration.
