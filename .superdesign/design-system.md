# Storia Design System

## Product Context

**Storia** is an immersive reading platform where every page comes alive with AI-generated soundscapes. The app transforms reading into a multi-sensory experience through sound and visuals.

**Target Audience:** Readers seeking immersive experiences, parents with children, anyone who wants to experience stories through sound.

## Brand Identity

### Logo & Name
- **Name:** Storia (Italian for "story/history")
- **Typography:** Playfair Display, serif, bold
- **Tagline:** "Experience Literature through Sound"

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| **Background (Dark)** | `#0a0a0a` | Primary background |
| **Slate 900** | `#0f172a` | Reader background |
| **Amber 100** | `#fef3c7` | Accent, highlights, spotlight sections |
| **Amber 500** | `#f59e0b` | First letter drop caps, badges |
| **Teal 400** | `#2dd4bf` | Active states, playing indicators |
| **Teal 500/20** | `rgba(20, 184, 166, 0.2)` | Active button backgrounds |
| **White/10-50** | `rgba(255,255,255,0.1-0.5)` | Borders, subtle UI elements |

### Typography

| Font | Usage |
|------|-------|
| **Playfair Display** | Hero headlines, brand name |
| **Lora** | Story text, serif content |
| **Inter** | UI elements, labels, buttons |
| **JetBrains Mono** | Metadata, technical labels |

### Design Principles

1. **Dark-first:** Rich dark backgrounds for immersive reading
2. **Cinematic:** Full-bleed imagery, dramatic gradients
3. **Minimal Chrome:** UI fades away during reading
4. **Subtle Animation:** Gentle transitions, nothing jarring
5. **Accessible:** Large tap targets (48px+), clear contrast

## Reader UI Components

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

## Animation Guidelines

| Animation | Duration | Easing |
|-----------|----------|--------|
| UI fade | 300ms | ease-out |
| Cross-fade audio | 1000-1500ms | linear |
| Hint pulse | 1000ms | ease-in-out, infinite |
| Sound wave | 500ms | ease-in-out, infinite |

## Spacing

- **Safe areas:** Always respect iOS safe-area-inset-*
- **Touch targets:** Minimum 48x48px
- **Padding:** 16px (p-4) mobile, 24px (p-6) desktop
