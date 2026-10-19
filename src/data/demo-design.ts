import { DesignElement, generateId } from '@/store/editor-store'

// Design tokens
const TOKENS = {
  bg: {
    primary: '#0D0D0D',
    secondary: '#1A1A2E',
    card: '#16213E',
  },
  accent: {
    red: '#E50914',
    blue: '#0D99FF',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#AAAAAA',
    tertiary: '#666666',
  },
  radius: {
    small: 8,
    medium: 12,
    large: 24,
  },
  font: 'Inter',
}

/**
 * Helper to create a base element with ALL required DesignElement properties.
 */
function baseEl(
  type: DesignElement['type'],
  overrides: Partial<DesignElement>
): DesignElement {
  return {
    id: generateId(type),
    name: overrides.name || `${type}`,
    type,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    strokeAlign: 'center',
    cornerRadius: 0,
    cornerRadiusTL: 0,
    cornerRadiusTR: 0,
    cornerRadiusBL: 0,
    cornerRadiusBR: 0,
    opacity: 100,
    rotation: 0,
    visible: true,
    locked: false,
    blendMode: 'normal',
    flipH: false,
    flipV: false,
    clipContent: false,
    ...overrides,
  }
}

/**
 * Helper to create a text element.
 */
function textEl(
  overrides: Partial<DesignElement> & {
    textContent: string
    fontSize: number
    fontWeight: number
    textColor: string
    textAlign?: 'left' | 'center' | 'right' | 'justified'
    lineHeight?: number
    letterSpacing?: number
  }
): DesignElement {
  return baseEl('text', {
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    fontFamily: TOKENS.font,
    textAlign: 'left',
    lineHeight: 1.3,
    letterSpacing: 0,
    ...overrides,
  })
}

/**
 * Helper to create a rectangle element.
 */
function rectEl(overrides: Partial<DesignElement>): DesignElement {
  return baseEl('rectangle', overrides)
}

/**
 * Helper to create an ellipse element.
 */
function ellipseEl(overrides: Partial<DesignElement>): DesignElement {
  return baseEl('ellipse', overrides)
}

/**
 * Helper to set uniform corner radius on all corners.
 */
function uniformRadius(r: number) {
  return {
    cornerRadius: r,
    cornerRadiusTL: r,
    cornerRadiusTR: r,
    cornerRadiusBL: r,
    cornerRadiusBR: r,
  }
}

// ─── Frame 1: Home Screen ────────────────────────────────────────────────

function createHomeScreen(frameX: number, frameY: number): DesignElement {
  const children: DesignElement[] = []

  // Status bar background
  children.push(rectEl({
    name: 'Status Bar BG',
    x: frameX, y: frameY,
    width: 375, height: 44,
    fill: TOKENS.bg.primary,
    ...uniformRadius(0),
  }))

  // Status bar time text
  children.push(textEl({
    name: 'Status Time',
    x: frameX + 16, y: frameY + 12,
    width: 54, height: 20,
    textContent: '9:41',
    fontSize: 15,
    fontWeight: 600,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Top bar background
  children.push(rectEl({
    name: 'Top Bar BG',
    x: frameX, y: frameY + 44,
    width: 375, height: 56,
    fill: TOKENS.bg.primary,
    ...uniformRadius(0),
  }))

  // VidVerse logo
  children.push(textEl({
    name: 'VidVerse Logo',
    x: frameX + 20, y: frameY + 56,
    width: 110, height: 32,
    textContent: 'VidVerse',
    fontSize: 24,
    fontWeight: 800,
    textColor: TOKENS.accent.red,
    lineHeight: 1.3,
    letterSpacing: -0.5,
  }))

  // Search icon (rectangle placeholder)
  children.push(ellipseEl({
    name: 'Search Icon',
    x: frameX + 331, y: frameY + 60,
    width: 24, height: 24,
    fill: 'transparent',
    stroke: TOKENS.text.primary,
    strokeWidth: 2,
    ...uniformRadius(0),
  }))

  // Notification dot
  children.push(ellipseEl({
    name: 'Notification Dot',
    x: frameX + 347, y: frameY + 58,
    width: 8, height: 8,
    fill: TOKENS.accent.red,
    stroke: 'transparent',
    strokeWidth: 0,
    ...uniformRadius(0),
  }))

  // ── Continue Watching Section ──

  // Section label
  children.push(textEl({
    name: 'Continue Watching Label',
    x: frameX + 20, y: frameY + 120,
    width: 200, height: 24,
    textContent: 'Continue Watching',
    fontSize: 18,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))

  // Movie card 1
  children.push(rectEl({
    name: 'Continue Card 1',
    x: frameX + 20, y: frameY + 156,
    width: 120, height: 170,
    fill: TOKENS.bg.card,
    ...uniformRadius(TOKENS.radius.medium),
  }))
  // Progress bar bg
  children.push(rectEl({
    name: 'Progress BG 1',
    x: frameX + 20, y: frameY + 312,
    width: 120, height: 3,
    fill: '#333333',
    ...uniformRadius(2),
  }))
  // Progress bar fill
  children.push(rectEl({
    name: 'Progress Fill 1',
    x: frameX + 20, y: frameY + 312,
    width: 78, height: 3,
    fill: TOKENS.accent.red,
    ...uniformRadius(2),
  }))
  // Movie title on card
  children.push(textEl({
    name: 'Card Title 1',
    x: frameX + 28, y: frameY + 258,
    width: 104, height: 16,
    textContent: 'Night Rider',
    fontSize: 12,
    fontWeight: 600,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))
  // Episode info
  children.push(textEl({
    name: 'Card Ep 1',
    x: frameX + 28, y: frameY + 276,
    width: 104, height: 14,
    textContent: 'S2 E5 · 32m left',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.secondary,
    lineHeight: 1.3,
  }))

  // Movie card 2
  children.push(rectEl({
    name: 'Continue Card 2',
    x: frameX + 152, y: frameY + 156,
    width: 120, height: 170,
    fill: '#1B2838',
    ...uniformRadius(TOKENS.radius.medium),
  }))
  children.push(rectEl({
    name: 'Progress BG 2',
    x: frameX + 152, y: frameY + 312,
    width: 120, height: 3,
    fill: '#333333',
    ...uniformRadius(2),
  }))
  children.push(rectEl({
    name: 'Progress Fill 2',
    x: frameX + 152, y: frameY + 312,
    width: 42, height: 3,
    fill: TOKENS.accent.red,
    ...uniformRadius(2),
  }))
  children.push(textEl({
    name: 'Card Title 2',
    x: frameX + 160, y: frameY + 258,
    width: 104, height: 16,
    textContent: 'Echoes',
    fontSize: 12,
    fontWeight: 600,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'Card Ep 2',
    x: frameX + 160, y: frameY + 276,
    width: 104, height: 14,
    textContent: 'S1 E2 · 48m left',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.secondary,
    lineHeight: 1.3,
  }))

  // Movie card 3
  children.push(rectEl({
    name: 'Continue Card 3',
    x: frameX + 284, y: frameY + 156,
    width: 72, height: 170,
    fill: '#2D1B38',
    ...uniformRadius(TOKENS.radius.medium),
  }))

  // ── Trending Now Section ──

  children.push(textEl({
    name: 'Trending Now Label',
    x: frameX + 20, y: frameY + 348,
    width: 200, height: 24,
    textContent: 'Trending Now',
    fontSize: 18,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))

  // Trending card 1
  children.push(rectEl({
    name: 'Trending Card 1',
    x: frameX + 20, y: frameY + 384,
    width: 160, height: 220,
    fill: '#1A2744',
    ...uniformRadius(TOKENS.radius.medium),
  }))
  // Gradient overlay on trending card
  children.push(rectEl({
    name: 'Trending Overlay 1',
    x: frameX + 20, y: frameY + 524,
    width: 160, height: 80,
    fill: '#0D0D0D',
    opacity: 70,
    ...uniformRadius(0),
  }))
  children.push(textEl({
    name: 'Trending Title 1',
    x: frameX + 28, y: frameY + 536,
    width: 144, height: 18,
    textContent: 'Crimson Peak',
    fontSize: 14,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'Trending Genre 1',
    x: frameX + 28, y: frameY + 558,
    width: 144, height: 14,
    textContent: 'Thriller · 2024',
    fontSize: 11,
    fontWeight: 400,
    textColor: TOKENS.text.secondary,
    lineHeight: 1.3,
  }))
  // Rank badge
  children.push(rectEl({
    name: 'Rank Badge 1',
    x: frameX + 28, y: frameY + 392,
    width: 28, height: 28,
    fill: TOKENS.accent.red,
    ...uniformRadius(TOKENS.radius.small),
  }))
  children.push(textEl({
    name: 'Rank Text 1',
    x: frameX + 28, y: frameY + 396,
    width: 28, height: 20,
    textContent: '#1',
    fontSize: 13,
    fontWeight: 800,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Trending card 2
  children.push(rectEl({
    name: 'Trending Card 2',
    x: frameX + 196, y: frameY + 384,
    width: 160, height: 220,
    fill: '#1B3A2A',
    ...uniformRadius(TOKENS.radius.medium),
  }))
  children.push(rectEl({
    name: 'Trending Overlay 2',
    x: frameX + 196, y: frameY + 524,
    width: 160, height: 80,
    fill: '#0D0D0D',
    opacity: 70,
    ...uniformRadius(0),
  }))
  children.push(textEl({
    name: 'Trending Title 2',
    x: frameX + 204, y: frameY + 536,
    width: 144, height: 18,
    textContent: 'Verdant',
    fontSize: 14,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'Trending Genre 2',
    x: frameX + 204, y: frameY + 558,
    width: 144, height: 14,
    textContent: 'Sci-Fi · 2024',
    fontSize: 11,
    fontWeight: 400,
    textColor: TOKENS.text.secondary,
    lineHeight: 1.3,
  }))
  children.push(rectEl({
    name: 'Rank Badge 2',
    x: frameX + 204, y: frameY + 392,
    width: 28, height: 28,
    fill: TOKENS.accent.blue,
    ...uniformRadius(TOKENS.radius.small),
  }))
  children.push(textEl({
    name: 'Rank Text 2',
    x: frameX + 204, y: frameY + 396,
    width: 28, height: 20,
    textContent: '#2',
    fontSize: 13,
    fontWeight: 800,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // ── Popular Categories ──

  children.push(textEl({
    name: 'Categories Label',
    x: frameX + 20, y: frameY + 624,
    width: 200, height: 24,
    textContent: 'Popular Categories',
    fontSize: 18,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))

  // Category pills
  const categories = ['Action', 'Comedy', 'Drama', 'Horror']
  const catColors = [TOKENS.accent.red, TOKENS.accent.blue, '#8B5CF6', '#F59E0B']
  categories.forEach((cat, i) => {
    children.push(rectEl({
      name: `Category Pill ${i + 1}`,
      x: frameX + 20 + i * 86,
      y: frameY + 658,
      width: 78, height: 32,
      fill: catColors[i],
      opacity: 20,
      ...uniformRadius(TOKENS.radius.large),
    }))
    children.push(textEl({
      name: `Category Text ${i + 1}`,
      x: frameX + 20 + i * 86,
      y: frameY + 662,
      width: 78, height: 24,
      textContent: cat,
      fontSize: 13,
      fontWeight: 600,
      textColor: catColors[i],
      textAlign: 'center',
      lineHeight: 1.5,
    }))
  })

  // ── Bottom Tab Bar ──

  children.push(rectEl({
    name: 'Tab Bar BG',
    x: frameX, y: frameY + 762,
    width: 375, height: 50,
    fill: TOKENS.bg.secondary,
    ...uniformRadius(0),
  }))

  // Tab bar separator line
  children.push(rectEl({
    name: 'Tab Bar Line',
    x: frameX, y: frameY + 762,
    width: 375, height: 1,
    fill: '#2A2A3E',
    ...uniformRadius(0),
  }))

  // Home tab icon (filled rectangle placeholder)
  children.push(rectEl({
    name: 'Home Tab Icon',
    x: frameX + 38, y: frameY + 772,
    width: 20, height: 20,
    fill: TOKENS.accent.red,
    ...uniformRadius(4),
  }))
  children.push(textEl({
    name: 'Home Tab Label',
    x: frameX + 30, y: frameY + 794,
    width: 36, height: 14,
    textContent: 'Home',
    fontSize: 10,
    fontWeight: 600,
    textColor: TOKENS.accent.red,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Search tab icon
  children.push(ellipseEl({
    name: 'Search Tab Icon',
    x: frameX + 130, y: frameY + 772,
    width: 20, height: 20,
    fill: 'transparent',
    stroke: TOKENS.text.tertiary,
    strokeWidth: 2,
    ...uniformRadius(0),
  }))
  children.push(textEl({
    name: 'Search Tab Label',
    x: frameX + 118, y: frameY + 794,
    width: 44, height: 14,
    textContent: 'Search',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Downloads tab icon (rectangle with arrow)
  children.push(rectEl({
    name: 'Downloads Tab Icon',
    x: frameX + 222, y: frameY + 772,
    width: 20, height: 20,
    fill: 'transparent',
    stroke: TOKENS.text.tertiary,
    strokeWidth: 2,
    ...uniformRadius(4),
  }))
  children.push(textEl({
    name: 'Downloads Tab Label',
    x: frameX + 206, y: frameY + 794,
    width: 52, height: 14,
    textContent: 'Downloads',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Profile tab icon (circle)
  children.push(ellipseEl({
    name: 'Profile Tab Icon',
    x: frameX + 316, y: frameY + 772,
    width: 20, height: 20,
    fill: 'transparent',
    stroke: TOKENS.text.tertiary,
    strokeWidth: 2,
    ...uniformRadius(0),
  }))
  children.push(textEl({
    name: 'Profile Tab Label',
    x: frameX + 306, y: frameY + 794,
    width: 40, height: 14,
    textContent: 'Profile',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  return baseEl('frame', {
    name: 'Home Screen',
    x: frameX,
    y: frameY,
    width: 375,
    height: 812,
    fill: TOKENS.bg.primary,
    stroke: '#2A2A3E',
    strokeWidth: 1,
    clipContent: true,
    ...uniformRadius(0),
    children,
  })
}

// ─── Frame 2: Movie Detail ──────────────────────────────────────────────

function createMovieDetail(frameX: number, frameY: number): DesignElement {
  const children: DesignElement[] = []

  // Large poster area
  children.push(rectEl({
    name: 'Movie Poster',
    x: frameX, y: frameY,
    width: 375, height: 300,
    fill: '#0A1628',
    ...uniformRadius(0),
  }))

  // Gradient overlay at bottom of poster
  children.push(rectEl({
    name: 'Poster Gradient',
    x: frameX, y: frameY + 180,
    width: 375, height: 120,
    fill: TOKENS.bg.primary,
    opacity: 85,
    ...uniformRadius(0),
  }))

  // Back button (circle)
  children.push(ellipseEl({
    name: 'Back Button',
    x: frameX + 16, y: frameY + 52,
    width: 36, height: 36,
    fill: '#000000',
    opacity: 50,
    stroke: 'transparent',
    strokeWidth: 0,
    ...uniformRadius(0),
  }))
  // Back arrow (small rectangle)
  children.push(rectEl({
    name: 'Back Arrow',
    x: frameX + 28, y: frameY + 67,
    width: 12, height: 2,
    fill: TOKENS.text.primary,
    rotation: -45,
    ...uniformRadius(1),
  }))
  children.push(rectEl({
    name: 'Back Arrow 2',
    x: frameX + 28, y: frameY + 67,
    width: 12, height: 2,
    fill: TOKENS.text.primary,
    rotation: 45,
    ...uniformRadius(1),
  }))

  // Favorite icon (heart placeholder)
  children.push(ellipseEl({
    name: 'Favorite Button',
    x: frameX + 323, y: frameY + 52,
    width: 36, height: 36,
    fill: '#000000',
    opacity: 50,
    stroke: 'transparent',
    strokeWidth: 0,
    ...uniformRadius(0),
  }))

  // Play button overlay on poster
  children.push(ellipseEl({
    name: 'Play Button',
    x: frameX + 155, y: frameY + 110,
    width: 64, height: 64,
    fill: TOKENS.accent.red,
    opacity: 90,
    stroke: 'transparent',
    strokeWidth: 0,
    ...uniformRadius(0),
    shadows: [{ type: 'drop-shadow', x: 0, y: 4, blur: 16, spread: 0, color: TOKENS.accent.red, opacity: 40, visible: true }],
  }))
  // Play triangle
  children.push(rectEl({
    name: 'Play Triangle',
    x: frameX + 180, y: frameY + 128,
    width: 0, height: 0,
    fill: TOKENS.text.primary,
    ...uniformRadius(0),
  }))

  // Movie title
  children.push(textEl({
    name: 'Movie Title',
    x: frameX + 20, y: frameY + 314,
    width: 335, height: 32,
    textContent: 'The Dark Horizon',
    fontSize: 26,
    fontWeight: 800,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
    letterSpacing: -0.5,
  }))

  // Rating stars area
  children.push(textEl({
    name: 'Rating Stars',
    x: frameX + 20, y: frameY + 352,
    width: 80, height: 18,
    textContent: '★★★★☆',
    fontSize: 16,
    fontWeight: 400,
    textColor: '#FFD700',
    lineHeight: 1.3,
  }))

  // Rating number
  children.push(textEl({
    name: 'Rating Number',
    x: frameX + 104, y: frameY + 354,
    width: 30, height: 16,
    textContent: '4.2',
    fontSize: 13,
    fontWeight: 600,
    textColor: TOKENS.text.secondary,
    lineHeight: 1.3,
  }))

  // Year & duration
  children.push(textEl({
    name: 'Year Duration',
    x: frameX + 142, y: frameY + 354,
    width: 120, height: 16,
    textContent: '2024 · 2h 18m',
    fontSize: 13,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    lineHeight: 1.3,
  }))

  // Genre tags
  const genres = ['Action', 'Sci-Fi', 'Thriller']
  genres.forEach((genre, i) => {
    children.push(rectEl({
      name: `Genre Tag ${i + 1}`,
      x: frameX + 20 + i * 80,
      y: frameY + 380,
      width: 70, height: 26,
      fill: TOKENS.bg.card,
      ...uniformRadius(TOKENS.radius.large),
    }))
    children.push(textEl({
      name: `Genre Text ${i + 1}`,
      x: frameX + 20 + i * 80,
      y: frameY + 384,
      width: 70, height: 18,
      textContent: genre,
      fontSize: 11,
      fontWeight: 600,
      textColor: TOKENS.text.secondary,
      textAlign: 'center',
      lineHeight: 1.5,
    }))
  })

  // Synopsis
  children.push(textEl({
    name: 'Synopsis',
    x: frameX + 20, y: frameY + 424,
    width: 335, height: 60,
    textContent: 'In a world ravaged by cosmic storms, a lone astronaut discovers a signal that could save humanity — or doom it forever.',
    fontSize: 13,
    fontWeight: 400,
    textColor: TOKENS.text.secondary,
    lineHeight: 1.6,
  }))

  // Watch Now button
  children.push(rectEl({
    name: 'Watch Now Button',
    x: frameX + 20, y: frameY + 502,
    width: 252, height: 50,
    fill: TOKENS.accent.red,
    ...uniformRadius(TOKENS.radius.large),
    shadows: [{ type: 'drop-shadow', x: 0, y: 4, blur: 16, spread: 0, color: TOKENS.accent.red, opacity: 35, visible: true }],
  }))
  children.push(textEl({
    name: 'Watch Now Text',
    x: frameX + 20, y: frameY + 514,
    width: 252, height: 24,
    textContent: '▶  Watch Now',
    fontSize: 16,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Download button
  children.push(rectEl({
    name: 'Download Button',
    x: frameX + 284, y: frameY + 502,
    width: 72, height: 50,
    fill: 'transparent',
    stroke: TOKENS.text.tertiary,
    strokeWidth: 1.5,
    ...uniformRadius(TOKENS.radius.large),
  }))
  children.push(textEl({
    name: 'Download Icon',
    x: frameX + 284, y: frameY + 512,
    width: 72, height: 24,
    textContent: '↓',
    fontSize: 22,
    fontWeight: 400,
    textColor: TOKENS.text.secondary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // More Like This section
  children.push(textEl({
    name: 'More Like This Label',
    x: frameX + 20, y: frameY + 572,
    width: 200, height: 22,
    textContent: 'More Like This',
    fontSize: 17,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))

  // Thumbnail 1
  children.push(rectEl({
    name: 'Thumb 1',
    x: frameX + 20, y: frameY + 606,
    width: 105, height: 148,
    fill: '#1E2D45',
    ...uniformRadius(TOKENS.radius.small),
  }))
  children.push(textEl({
    name: 'Thumb Title 1',
    x: frameX + 28, y: frameY + 724,
    width: 90, height: 16,
    textContent: 'Neon Abyss',
    fontSize: 12,
    fontWeight: 600,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'Thumb Year 1',
    x: frameX + 28, y: frameY + 740,
    width: 90, height: 14,
    textContent: '2024 · Action',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    lineHeight: 1.3,
  }))

  // Thumbnail 2
  children.push(rectEl({
    name: 'Thumb 2',
    x: frameX + 135, y: frameY + 606,
    width: 105, height: 148,
    fill: '#2A1E35',
    ...uniformRadius(TOKENS.radius.small),
  }))
  children.push(textEl({
    name: 'Thumb Title 2',
    x: frameX + 143, y: frameY + 724,
    width: 90, height: 16,
    textContent: 'Shadow Run',
    fontSize: 12,
    fontWeight: 600,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'Thumb Year 2',
    x: frameX + 143, y: frameY + 740,
    width: 90, height: 14,
    textContent: '2023 · Thriller',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    lineHeight: 1.3,
  }))

  // Thumbnail 3
  children.push(rectEl({
    name: 'Thumb 3',
    x: frameX + 250, y: frameY + 606,
    width: 105, height: 148,
    fill: '#1E352A',
    ...uniformRadius(TOKENS.radius.small),
  }))
  children.push(textEl({
    name: 'Thumb Title 3',
    x: frameX + 258, y: frameY + 724,
    width: 90, height: 16,
    textContent: 'Orbit',
    fontSize: 12,
    fontWeight: 600,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'Thumb Year 3',
    x: frameX + 258, y: frameY + 740,
    width: 90, height: 14,
    textContent: '2024 · Sci-Fi',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    lineHeight: 1.3,
  }))

  return baseEl('frame', {
    name: 'Movie Detail',
    x: frameX,
    y: frameY,
    width: 375,
    height: 812,
    fill: TOKENS.bg.primary,
    stroke: '#2A2A3E',
    strokeWidth: 1,
    clipContent: true,
    ...uniformRadius(0),
    children,
  })
}

// ─── Frame 3: Profile ───────────────────────────────────────────────────

function createProfile(frameX: number, frameY: number): DesignElement {
  const children: DesignElement[] = []

  // Header area
  children.push(rectEl({
    name: 'Profile Header BG',
    x: frameX, y: frameY,
    width: 375, height: 260,
    fill: TOKENS.bg.secondary,
    ...uniformRadius(0),
  }))

  // Status bar
  children.push(rectEl({
    name: 'Status Bar BG',
    x: frameX, y: frameY,
    width: 375, height: 44,
    fill: TOKENS.bg.secondary,
    ...uniformRadius(0),
  }))
  children.push(textEl({
    name: 'Status Time',
    x: frameX + 16, y: frameY + 12,
    width: 54, height: 20,
    textContent: '9:41',
    fontSize: 15,
    fontWeight: 600,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Header title
  children.push(textEl({
    name: 'Profile Title',
    x: frameX + 20, y: frameY + 56,
    width: 100, height: 28,
    textContent: 'Profile',
    fontSize: 22,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    lineHeight: 1.3,
  }))

  // Settings gear icon (top right)
  children.push(ellipseEl({
    name: 'Settings Gear',
    x: frameX + 331, y: frameY + 60,
    width: 24, height: 24,
    fill: 'transparent',
    stroke: TOKENS.text.secondary,
    strokeWidth: 2,
    ...uniformRadius(0),
  }))

  // Profile avatar circle
  children.push(ellipseEl({
    name: 'Profile Avatar',
    x: frameX + 148, y: frameY + 100,
    width: 80, height: 80,
    fill: TOKENS.bg.card,
    stroke: TOKENS.accent.blue,
    strokeWidth: 3,
    ...uniformRadius(0),
  }))

  // Avatar initials
  children.push(textEl({
    name: 'Avatar Initials',
    x: frameX + 148, y: frameY + 118,
    width: 80, height: 36,
    textContent: 'AJ',
    fontSize: 28,
    fontWeight: 700,
    textColor: TOKENS.accent.blue,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // User name
  children.push(textEl({
    name: 'User Name',
    x: frameX + 20, y: frameY + 196,
    width: 335, height: 28,
    textContent: 'Alex Johnson',
    fontSize: 22,
    fontWeight: 700,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Member since
  children.push(textEl({
    name: 'Member Since',
    x: frameX + 20, y: frameY + 224,
    width: 335, height: 18,
    textContent: 'Member since 2021',
    fontSize: 13,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // ── Stats Row ──

  children.push(rectEl({
    name: 'Stats Row BG',
    x: frameX + 20, y: frameY + 268,
    width: 335, height: 72,
    fill: TOKENS.bg.secondary,
    ...uniformRadius(TOKENS.radius.medium),
  }))

  // Divider lines in stats
  children.push(rectEl({
    name: 'Stats Divider 1',
    x: frameX + 132, y: frameY + 282,
    width: 1, height: 44,
    fill: '#2A2A3E',
    ...uniformRadius(0),
  }))
  children.push(rectEl({
    name: 'Stats Divider 2',
    x: frameX + 244, y: frameY + 282,
    width: 1, height: 44,
    fill: '#2A2A3E',
    ...uniformRadius(0),
  }))

  // Watched stat
  children.push(textEl({
    name: 'Watched Count',
    x: frameX + 20, y: frameY + 280,
    width: 112, height: 24,
    textContent: '142',
    fontSize: 22,
    fontWeight: 800,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'Watched Label',
    x: frameX + 20, y: frameY + 306,
    width: 112, height: 16,
    textContent: 'Watched',
    fontSize: 12,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // List stat
  children.push(textEl({
    name: 'List Count',
    x: frameX + 132, y: frameY + 280,
    width: 112, height: 24,
    textContent: '38',
    fontSize: 22,
    fontWeight: 800,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'List Label',
    x: frameX + 132, y: frameY + 306,
    width: 112, height: 16,
    textContent: 'My List',
    fontSize: 12,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Reviews stat
  children.push(textEl({
    name: 'Reviews Count',
    x: frameX + 244, y: frameY + 280,
    width: 112, height: 24,
    textContent: '24',
    fontSize: 22,
    fontWeight: 800,
    textColor: TOKENS.text.primary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))
  children.push(textEl({
    name: 'Reviews Label',
    x: frameX + 244, y: frameY + 306,
    width: 112, height: 16,
    textContent: 'Reviews',
    fontSize: 12,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // ── Settings Options ──

  const settings = [
    { label: 'Account Settings', icon: '#0D99FF' },
    { label: 'Notifications', icon: '#E50914' },
    { label: 'Playback Quality', icon: '#8B5CF6' },
    { label: 'Privacy & Security', icon: '#10B981' },
  ]

  settings.forEach((item, i) => {
    const rowY = frameY + 364 + i * 56
    // Row background
    children.push(rectEl({
      name: `Settings Row ${i + 1}`,
      x: frameX + 20, y: rowY,
      width: 335, height: 48,
      fill: TOKENS.bg.secondary,
      ...uniformRadius(TOKENS.radius.small),
    }))
    // Icon circle
    children.push(ellipseEl({
      name: `Settings Icon ${i + 1}`,
      x: frameX + 32, y: rowY + 12,
      width: 24, height: 24,
      fill: item.icon,
      opacity: 20,
      stroke: 'transparent',
      strokeWidth: 0,
      ...uniformRadius(0),
    }))
    // Label
    children.push(textEl({
      name: `Settings Label ${i + 1}`,
      x: frameX + 68, y: rowY + 14,
      width: 240, height: 20,
      textContent: item.label,
      fontSize: 15,
      fontWeight: 500,
      textColor: TOKENS.text.primary,
      lineHeight: 1.3,
    }))
    // Chevron (right arrow placeholder)
    children.push(textEl({
      name: `Settings Chevron ${i + 1}`,
      x: frameX + 323, y: rowY + 14,
      width: 20, height: 20,
      textContent: '›',
      fontSize: 18,
      fontWeight: 400,
      textColor: TOKENS.text.tertiary,
      textAlign: 'right',
      lineHeight: 1.3,
    }))
  })

  // ── Sign Out Button ──
  children.push(rectEl({
    name: 'Sign Out Button',
    x: frameX + 20, y: frameY + 604,
    width: 335, height: 48,
    fill: 'transparent',
    stroke: TOKENS.accent.red,
    strokeWidth: 1.5,
    ...uniformRadius(TOKENS.radius.large),
  }))
  children.push(textEl({
    name: 'Sign Out Text',
    x: frameX + 20, y: frameY + 616,
    width: 335, height: 24,
    textContent: 'Sign Out',
    fontSize: 16,
    fontWeight: 600,
    textColor: TOKENS.accent.red,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // App version
  children.push(textEl({
    name: 'App Version',
    x: frameX + 20, y: frameY + 672,
    width: 335, height: 16,
    textContent: 'VidVerse v3.2.1',
    fontSize: 12,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // ── Bottom Tab Bar ──
  children.push(rectEl({
    name: 'Tab Bar BG',
    x: frameX, y: frameY + 762,
    width: 375, height: 50,
    fill: TOKENS.bg.secondary,
    ...uniformRadius(0),
  }))

  children.push(rectEl({
    name: 'Tab Bar Line',
    x: frameX, y: frameY + 762,
    width: 375, height: 1,
    fill: '#2A2A3E',
    ...uniformRadius(0),
  }))

  // Home tab
  children.push(rectEl({
    name: 'Home Tab Icon',
    x: frameX + 38, y: frameY + 772,
    width: 20, height: 20,
    fill: 'transparent',
    stroke: TOKENS.text.tertiary,
    strokeWidth: 2,
    ...uniformRadius(4),
  }))
  children.push(textEl({
    name: 'Home Tab Label',
    x: frameX + 30, y: frameY + 794,
    width: 36, height: 14,
    textContent: 'Home',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Search tab
  children.push(ellipseEl({
    name: 'Search Tab Icon',
    x: frameX + 130, y: frameY + 772,
    width: 20, height: 20,
    fill: 'transparent',
    stroke: TOKENS.text.tertiary,
    strokeWidth: 2,
    ...uniformRadius(0),
  }))
  children.push(textEl({
    name: 'Search Tab Label',
    x: frameX + 118, y: frameY + 794,
    width: 44, height: 14,
    textContent: 'Search',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Downloads tab
  children.push(rectEl({
    name: 'Downloads Tab Icon',
    x: frameX + 222, y: frameY + 772,
    width: 20, height: 20,
    fill: 'transparent',
    stroke: TOKENS.text.tertiary,
    strokeWidth: 2,
    ...uniformRadius(4),
  }))
  children.push(textEl({
    name: 'Downloads Tab Label',
    x: frameX + 206, y: frameY + 794,
    width: 52, height: 14,
    textContent: 'Downloads',
    fontSize: 10,
    fontWeight: 400,
    textColor: TOKENS.text.tertiary,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  // Profile tab (active)
  children.push(ellipseEl({
    name: 'Profile Tab Icon',
    x: frameX + 316, y: frameY + 772,
    width: 20, height: 20,
    fill: TOKENS.accent.blue,
    stroke: 'transparent',
    strokeWidth: 0,
    ...uniformRadius(0),
  }))
  children.push(textEl({
    name: 'Profile Tab Label',
    x: frameX + 306, y: frameY + 794,
    width: 40, height: 14,
    textContent: 'Profile',
    fontSize: 10,
    fontWeight: 600,
    textColor: TOKENS.accent.blue,
    textAlign: 'center',
    lineHeight: 1.3,
  }))

  return baseEl('frame', {
    name: 'Profile',
    x: frameX,
    y: frameY,
    width: 375,
    height: 812,
    fill: TOKENS.bg.primary,
    stroke: '#2A2A3E',
    strokeWidth: 1,
    clipContent: true,
    ...uniformRadius(0),
    children,
  })
}

// ─── Main Export ─────────────────────────────────────────────────────────

/**
 * Creates a complete VidVerse Movie Streaming App design as an array of DesignElement objects.
 * Returns three frames positioned side by side:
 *   - Home Screen at (-590, -400)
 *   - Movie Detail at (-175, -400)
 *   - Profile at (240, -400)
 */
export function createVidVerseDesign(): DesignElement[] {
  return [
    createHomeScreen(-590, -400),
    createMovieDetail(-175, -400),
    createProfile(240, -400),
  ]
}
