```markdown
# Design System Document

## 1. Overview & Creative North Star
### Creative North Star: "Kinetic Command"
This design system is engineered for high-stakes industrial environments where precision meets raw power. Moving beyond the clinical sterility of standard enterprise dashboards, "Kinetic Command" embraces a high-contrast, editorial aesthetic that mirrors the intensity of electrical energy flow. 

The system breaks the "template" look by utilizing intentional asymmetry, high-impact typography scales, and a layered depth model. Instead of a rigid grid of identical boxes, we utilize varying card dimensions and overlapping data visualizations to create a sense of mechanical complexity and technical authority. This is not just a dashboard; it is a mission-control interface for the future of energy.

---

## 2. Colors
The palette is built on a foundation of deep, matte neutrals to ensure the high-energy primary accents possess maximum "light-source" impact.

### Color Tokens
- **Background (Base):** `#131313` (The void; the canvas for all data)
- **Primary (Accent):** `#ffb693` (Secondary glow) / `#ff6b00` (Core Energy/Action)
- **Surface Tiers:**
  - `surface_container_lowest`: `#0e0e0e` (Deepest recesses)
  - `surface_container`: `#201f1f` (Standard card base)
  - `surface_container_highest`: `#353534` (Interactive/Elevated cards)
- **Tertiary (Auxiliary):** `#059eff` (Data contrast/Cooling states)

### The "No-Line" Rule
To maintain a sophisticated, futuristic feel, **the use of 1px solid borders for sectioning is strictly prohibited.** Boundaries must be defined solely through background color shifts. For example, a `surface_container_highest` card should sit directly on a `surface` background. The change in tonal value creates a cleaner, more premium separation than a line ever could.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of technical materials.
- **Base Layer:** `surface`
- **Primary Content Areas:** `surface_container`
- **Active/Hovered States:** `surface_container_highest`
Use these shifts to guide the eye. An inner detail pane within a card should use `surface_container_low` to create a "recessed" technical slot.

### The "Glass & Gradient" Rule
For hero visualizations or floating panels, use semi-transparent surface colors with a `20px` backdrop-blur. Apply a subtle linear gradient from `primary` (#ffb693) to `primary_container` (#ff6b00) at 45 degrees for main action triggers to give them a "charged" luminescence.

---

## 3. Typography
The system uses a dual-font strategy to balance high-tech industrialism with legible data density.

- **Display & Headlines (Space Grotesk):** This font brings a wide, technical, and slightly brutalist personality. Use `display-lg` (3.5rem) for primary metrics like "Total Output" to command immediate attention.
- **Body & Labels (Inter):** Chosen for its exceptional clarity at small sizes. All technical specs and tabular data must use Inter to ensure "at-a-glance" accuracy.

**Hierarchy as Identity:** 
Large typographic scales aren't just for size; they are for authority. By pairing a `display-md` metric with a `label-sm` unit (all caps), we create a high-contrast "Spec Sheet" look that feels intentional and engineered.

---

## 4. Elevation & Depth
In a dark UI, traditional shadows often disappear. We use **Tonal Layering** and **Luminescence** instead.

- **The Layering Principle:** Depth is achieved by stacking. A `surface_container_lowest` element on a `surface` background creates a "cut-out" effect, while `surface_container_high` creates a "raised" effect.
- **Ambient Glows:** For "active" high-power states, use a glow instead of a shadow. Apply a box-shadow with the `primary_container` color at 10% opacity and a 40px blur. This mimics the light cast by a high-voltage indicator.
- **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline_variant` token at **15% opacity**. It should be a suggestion of a container, not a hard cage.
- **Glassmorphism:** For top-level navigation or modal overlays, use a semi-transparent `surface_container` with a heavy backdrop-blur to maintain the "Kinetic Command" depth.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary_container`) with white text (`on_primary_fixed`). 12px corner radius (`lg`).
- **Secondary:** Surface-high fill with a "Ghost Border." No gradient.
- **Tertiary:** Text-only with a subtle `primary` glow on hover.

### Cards & Data Clusters
- **Forbid Divider Lines:** Use `Spacing Scale 6` (1.5rem) to separate sections within a card.
- **Nesting:** Place a `surface_container_highest` header within a `surface_container` card to define the control area.
- **Corners:** Use `lg` (1rem / 16px) for main containers and `md` (0.75rem / 12px) for inner elements.

### Specialized Components
- **The "Power Gauge":** A circular or semi-circular indicator using a `primary` to `error` gradient to show load.
- **Status Indicators:** Small, rounded chips using `on_tertiary_container` (blue) for "Cooling" and `primary_container` (orange) for "Active."
- **Data Glow Lines:** Use SVG paths with a `primary` stroke and a secondary `20px` blur stroke underneath to represent energy flow.

---

## 6. Do's and Don'ts

### Do:
- **Do** use intentional asymmetry. A large data visualization on the left can be balanced by a dense stack of technical specs on the right.
- **Do** use "all-caps" for `label-sm` text to increase the technical, "instrument-panel" feel.
- **Do** allow the `background` to breathe. High-tech doesn't mean cluttered; it means precise.

### Don't:
- **Don't** use 100% white (#FFFFFF) for body text. Use `on_surface` (#e5e2e1) to reduce eye strain in dark mode.
- **Don't** use standard "drop shadows." They look muddy on matte black. Use tonal shifts or subtle glows.
- **Don't** use sharp 0px corners. Even a "hard" industrial look needs the `sm` (4px) or `md` (12px) radius to feel like a high-end manufactured product.
- **Don't** use dividers. If two pieces of data are related, group them. If they aren't, use space.

---
*Note: This design system is built to scale. As the energy grid grows, the "Kinetic Command" philosophy ensures that every new metric feels like a critical part of the machine.*```