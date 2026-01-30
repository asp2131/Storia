# Storia Design System

## Brand Identity
**Storia** - Immersive Reading Platform with AI-generated ambient soundscapes

### Mission
Revolutionize digital reading through multi-sensory literary experiences. Combat the education crisis (40% of kids not reading on grade level) while creating magical reading journeys.

### Brand Voice
- **Magical yet purposeful** - Wonder and imagination balanced with educational impact
- **Elegant and immersive** - Premium feel, cinematic quality
- **Warm and inviting** - Accessible, not intimidating

### Product Context
**Storia** is an immersive reading platform where every page comes alive with AI-generated soundscapes. The app transforms reading into a multi-sensory experience through sound and visuals.

**Target Audience:** Readers seeking immersive experiences, parents with children, anyone who wants to experience stories through sound.

### Logo & Name
- **Name:** Storia (Italian for "story/history")
- **Typography:** Playfair Display, serif, bold
- **Tagline:** "Experience Literature through Sound"

---

## Color Palette

### Primary Colors
| Name | Hex | Usage |
|------|-----|-------|
| Deep Black | `#0a0a0a` | Primary background |
| Pure White | `#ffffff` | Primary text, high contrast elements |
| Amber Glow | `#fef3c7` | Selection highlight, accent warmth, spotlight sections |
| Amber-200 | `#fde68a` | Hover states, warm accents |
| Slate 900 | `#0f172a` | Reader background |
| Amber 500 | `#f59e0b` | First letter drop caps, badges |
| Teal 400 | `#2dd4bf` | Active states, playing indicators |
| Teal 500/20 | `rgba(20, 184, 166, 0.2)` | Active button backgrounds |

### Atmospheric Colors (Background Blobs)
| Name | Hex | Usage |
|------|-----|-------|
| Indigo Night | `#312e81` (indigo-900) | Background blob, mystical |
| Purple Dusk | `#581c87` (purple-900) | Background blob, depth |
| Amber Warmth | `#78350f` (amber-900) | Background blob, cozy |
| Midnight Blue | `#1e3a8a` | Scene morph target |
| Forest Green | `#064e3b` | Scene morph target |

### UI Colors
| Name | Hex | Usage |
|------|-----|-------|
| Modal White | `#ffffff` | Auth modal background |
| Text Dark | `#111827` | Modal text, dark mode text |
| Gray Muted | `#6b7280` | Secondary text, placeholders |
| Border Light | `#e5e7eb` | Input borders, dividers |
| Error Red | `#dc2626` (red-600) | Error states |
| Error BG | `#fef2f2` (red-50) | Error background |
| White/10-50 | `rgba(255,255,255,0.1-0.5)` | Borders, subtle UI elements |

---

## Typography

### Font Families
```css
--font-serif: 'Lora', 'Playfair Display', serif;
--font-sans: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;
--font-playfair: 'Playfair Display', serif;
```

| Font | Usage |
|------|-------|
| **Playfair Display** | Hero headlines, brand name |
| **Lora** | Story text, serif content |
| **Inter** | UI elements, labels, buttons |
| **JetBrains Mono** | Metadata, technical labels |

### Type Scale

| Element | Size | Weight | Font | Usage |
|---------|------|--------|------|-------|
| Hero Title | `text-5xl md:text-8xl lg:text-9xl` | `font-black` | Serif | Main hero text |
| Section Title | `text-5xl md:text-7xl` | `font-black` | Serif | CTA sections |
| Feature Title | `text-4xl` | `italic` | Serif | Feature cards |
| Body Large | `text-lg md:text-xl` | `font-light` | Sans | Hero description |
| Body | `text-sm` | `normal` | Sans | General text |
| Label | `text-xs` | `tracking-[0.5em] uppercase` | Mono | Section labels |
| Nav | `text-sm tracking-widest uppercase` | `normal` | Mono | Navigation |

### Text Styles
- **Selection**: `selection:bg-amber-200 selection:text-black`
- **Opacity levels**: 40%, 60%, 70%, 100%
- **Letter spacing**: `tracking-tight`, `tracking-tighter`, `tracking-widest`, `tracking-[0.3em]`, `tracking-[0.5em]`

---

## Spacing & Layout

### Container
- Max width: `max-w-6xl`, `max-w-7xl`, `max-w-lg` (modal)
- Padding: `px-4`, `px-8`, `py-4`, `py-8`, `py-32`
- Gaps: `gap-2`, `gap-6`, `gap-8`, `gap-16`

### Sections
- Hero: `min-h-screen`, centered flex
- Features: `min-h-screen`, `py-32`, grid `md:grid-cols-3`
- CTA: `min-h-screen`, centered

### Spacing Guidelines
- **Safe areas:** Always respect iOS safe-area-inset-*
- **Touch targets:** Minimum 48x48px
- **Padding:** 16px (p-4) mobile, 24px (p-6) desktop

---

## Components

### Buttons

#### Primary CTA Button
```html
<button class="group relative px-12 py-5 overflow-hidden rounded-full border border-white/20 hover:border-white/50 transition-colors">
  <span class="relative z-10 font-mono uppercase tracking-widest text-sm">Button Text</span>
  <div class="absolute inset-0 bg-white translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out"></div>
  <span class="absolute inset-0 flex items-center justify-center z-20 font-mono uppercase tracking-widest text-sm text-black translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out">Button Text</span>
</button>
```

#### Modal Button (Dark)
```html
<button class="w-full h-12 rounded-full bg-[#111827] text-white font-semibold hover:bg-black transition disabled:opacity-50">
  Button Text
</button>
```

#### Modal Button (Outline)
```html
<button class="w-full h-12 rounded-full border border-[#e5e7eb] text-[#111827] font-medium hover:bg-[#f9fafb] transition">
  Button Text
</button>
```

### Inputs
```html
<input class="w-full h-12 rounded-lg border border-[#e5e7eb] px-4 focus:outline-none focus:ring-2 focus:ring-[#111827]" />
```

### Modal
- Background: `bg-white rounded-2xl shadow-2xl`
- Padding: `px-8 py-10`
- Overlay: `bg-black/70`

### Feature Cards
- Structure: Number label, serif italic title, light body text
- Spacing: `space-y-6`

### Mobile Navigation
- **Tap zones:** Left/right 25% of screen
- **Swipe:** 50px threshold for page turn
- **Hints:** Animated chevrons for first-time users

### Audio Controls
- **BGM Button:** Floating action button, bottom-right on mobile
- **Sound wave animation:** 3 bars with staggered animation
- **Mode selector:** Popover menu with radio-style options

### Text Display
- **Bottom sheet:** Draggable, snaps to 0%, 50%, 100%
- **First letter:** Drop cap style, amber color
- **Font size:** prose-lg (18px base)

---

## Animation & Interaction

### GSAP Animations
- **Entrance**: Logo fade in, scale to 100, fade out
- **Reveal items**: `y: 40, opacity: 0` to visible, `stagger: 0.2`
- **Scroll scrub**: Character wave effect, blur depth of field
- **Background blobs**: Position and color morph on scroll

### Transitions
- Default: `transition-colors`, `transition-opacity`
- Duration: `duration-300`, `duration-500`
- Ease: `ease-out`, `power2.out`, `power3.out`, `power4.inOut`

### Custom Cursor
- Circle with sound wave bars
- Mix blend mode: `mix-blend-difference`
- Scale on hover: `1.5x`

### Animation Guidelines

| Animation | Duration | Easing |
|-----------|----------|--------|
| UI fade | 300ms | ease-out |
| Cross-fade audio | 1000-1500ms | linear |
| Hint pulse | 1000ms | ease-in-out, infinite |
| Sound wave | 500ms | ease-in-out, infinite |

---

## Z-Index Scale
| Layer | Z-Index | Usage |
|-------|---------|-------|
| Background blobs | `z-0` | Ambient atmosphere |
| Content | `z-10` | Main content |
| Header | `z-50` | Fixed navigation |
| Hero entrance | `z-[100]` | Loading animation |
| Auth modal | `z-[200]` | Modal overlay |
| Custom cursor | `z-[9999]` | Always on top |

---

## Assets

### SVG Illustrations (public/landing/)
- `Book Spine:Side View.svg` - Side view of book spine
- `BookOpeningSequence.svg` - Book opening animation frames
- `Child with Wonder.svg` - Child reading illustration
- `Floating:Emerging.svg` - Elements emerging from book
- `LiteraryLandscape.svg` - Story world landscape
- `MagicalCreature.svg` - Fantasy creature element
- `Open Book-Front View.svg` - Front view of open book
- `TheReader.svg` - Person reading illustration
- `squigly.svg` - Decorative squiggle

### 3D Models
- `public/little_prince_pop_up_story_book.glb` - Interactive pop-up book model
- `public/landing/prince.glb` - Prince character model

---

## Responsive Breakpoints
- Mobile: Default
- Tablet: `md:` (768px)
- Desktop: `lg:` (1024px)

### Mobile Considerations
- Hide custom cursor on mobile
- Adjust hero text size
- Stack navigation
- Reduced animation complexity

---

## Design Principles

1. **Dark-first:** Rich dark backgrounds for immersive reading
2. **Cinematic:** Full-bleed imagery, dramatic gradients
3. **Minimal Chrome:** UI fades away during reading
4. **Subtle Animation:** Gentle transitions, nothing jarring
5. **Accessible:** Large tap targets (48px+), clear contrast
