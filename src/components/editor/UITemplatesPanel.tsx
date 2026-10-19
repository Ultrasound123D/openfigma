'use client'

import React, { useState } from 'react'
import { useEditorStore, DesignElement, generateId } from '@/store/editor-store'
import {
  Smartphone,
  Navigation,
  LayoutGrid,
  Square,
  List,
  MousePointerClick,
  Search,
  User,
  Type,
  ToggleLeft,
  Tag,
  ChevronRight,
} from 'lucide-react'

// Design system colors
const COLORS = {
  dark: '#1A1A1A',
  white: '#FFFFFF',
  accent: '#0D99FF',
  red: '#FF6B6B',
  green: '#4CAF50',
  gray100: '#F5F5F5',
  gray200: '#E8E8E8',
  gray300: '#D1D1D1',
  gray500: '#888888',
  gray700: '#555555',
  black: '#000000',
}

// Helper to create a base element with all required fields
function baseElement(overrides: Partial<DesignElement>): DesignElement {
  return {
    id: generateId('el'),
    name: 'Element',
    type: 'rectangle',
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

// =============================================
// TEMPLATE DEFINITIONS
// =============================================

function statusBarTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Status Bar',
      type: 'frame',
      x: baseX, y: baseY,
      width: 375, height: 44,
      fill: COLORS.white,
      cornerRadius: 0,
      clipContent: true,
    }),
    baseElement({
      name: 'Time',
      type: 'text',
      x: baseX + 30, y: baseY + 14,
      width: 54, height: 20,
      fill: 'transparent',
      textContent: '9:41',
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: 600,
      textColor: COLORS.dark,
      textAlign: 'center',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Signal',
      type: 'text',
      x: baseX + 280, y: baseY + 14,
      width: 30, height: 20,
      fill: 'transparent',
      textContent: '●●●●',
      fontFamily: 'Inter',
      fontSize: 10,
      fontWeight: 400,
      textColor: COLORS.dark,
      textAlign: 'center',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'WiFi',
      type: 'text',
      x: baseX + 310, y: baseY + 14,
      width: 20, height: 20,
      fill: 'transparent',
      textContent: '▲',
      fontFamily: 'Inter',
      fontSize: 10,
      fontWeight: 400,
      textColor: COLORS.dark,
      textAlign: 'center',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Battery',
      type: 'rectangle',
      x: baseX + 338, y: baseY + 16,
      width: 25, height: 12,
      fill: COLORS.dark,
      stroke: COLORS.dark,
      strokeWidth: 1,
      cornerRadius: 3,
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 3,
      cornerRadiusBR: 3,
    }),
    baseElement({
      name: 'Battery Tip',
      type: 'rectangle',
      x: baseX + 363, y: baseY + 19,
      width: 2, height: 6,
      fill: COLORS.dark,
      cornerRadius: 1,
      cornerRadiusTL: 1,
      cornerRadiusTR: 1,
      cornerRadiusBL: 1,
      cornerRadiusBR: 1,
    }),
  ]
}

function navigationBarTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Navigation Bar',
      type: 'frame',
      x: baseX, y: baseY,
      width: 375, height: 56,
      fill: COLORS.white,
      stroke: COLORS.gray200,
      strokeWidth: 1,
      cornerRadius: 0,
      clipContent: true,
    }),
    baseElement({
      name: 'Back Button',
      type: 'text',
      x: baseX + 16, y: baseY + 18,
      width: 24, height: 24,
      fill: 'transparent',
      textContent: '←',
      fontFamily: 'Inter',
      fontSize: 20,
      fontWeight: 400,
      textColor: COLORS.accent,
      textAlign: 'left',
      lineHeight: 1.2,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Nav Title',
      type: 'text',
      x: baseX + 130, y: baseY + 18,
      width: 115, height: 22,
      fill: 'transparent',
      textContent: 'Page Title',
      fontFamily: 'Inter',
      fontSize: 17,
      fontWeight: 600,
      textColor: COLORS.dark,
      textAlign: 'center',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Right Action',
      type: 'text',
      x: baseX + 335, y: baseY + 20,
      width: 30, height: 20,
      fill: 'transparent',
      textContent: 'Edit',
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: 400,
      textColor: COLORS.accent,
      textAlign: 'right',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

function bottomTabBarTemplate(baseX: number, baseY: number): DesignElement[] {
  const tabs = ['Home', 'Search', 'Add', 'Heart', 'Profile']
  const tabWidth = 375 / 5
  return [
    baseElement({
      name: 'Bottom Tab Bar',
      type: 'frame',
      x: baseX, y: baseY,
      width: 375, height: 83,
      fill: COLORS.white,
      stroke: COLORS.gray200,
      strokeWidth: 1,
      cornerRadius: 0,
      clipContent: true,
    }),
    ...tabs.map((tab, i) =>
      baseElement({
        name: `Tab ${tab}`,
        type: 'text',
        x: baseX + i * tabWidth + 10, y: baseY + 32,
        width: tabWidth - 20, height: 16,
        fill: 'transparent',
        textContent: tab,
        fontFamily: 'Inter',
        fontSize: 10,
        fontWeight: i === 0 ? 600 : 400,
        textColor: i === 0 ? COLORS.accent : COLORS.gray500,
        textAlign: 'center',
        lineHeight: 1.3,
        letterSpacing: 0,
      })
    ),
    // Tab icons (represented as small circles/squares)
    ...tabs.map((tab, i) =>
      baseElement({
        name: `${tab} Icon`,
        type: i === 2 ? 'ellipse' : 'rectangle',
        x: baseX + i * tabWidth + (tabWidth / 2) - 10,
        y: baseY + 10,
        width: 20, height: 20,
        fill: i === 0 ? COLORS.accent : COLORS.gray300,
        cornerRadius: i === 2 ? 0 : 4,
        cornerRadiusTL: i === 2 ? 0 : 4,
        cornerRadiusTR: i === 2 ? 0 : 4,
        cornerRadiusBL: i === 2 ? 0 : 4,
        cornerRadiusBR: i === 2 ? 0 : 4,
      })
    ),
    // Home indicator
    baseElement({
      name: 'Home Indicator',
      type: 'rectangle',
      x: baseX + 128, y: baseY + 73,
      width: 134, height: 5,
      fill: COLORS.dark,
      cornerRadius: 3,
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 3,
      cornerRadiusBR: 3,
      opacity: 20,
    }),
  ]
}

function cardTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Card',
      type: 'rectangle',
      x: baseX, y: baseY,
      width: 300, height: 220,
      fill: COLORS.white,
      stroke: COLORS.gray200,
      strokeWidth: 1,
      cornerRadius: 12,
      cornerRadiusTL: 12,
      cornerRadiusTR: 12,
      cornerRadiusBL: 12,
      cornerRadiusBR: 12,
      shadows: [{ type: 'drop-shadow', x: 0, y: 2, blur: 8, spread: 0, color: '#000000', opacity: 8, visible: true }],
    }),
    baseElement({
      name: 'Card Image',
      type: 'rectangle',
      x: baseX, y: baseY,
      width: 300, height: 120,
      fill: '#E3F2FD',
      cornerRadius: 0,
      cornerRadiusTL: 12,
      cornerRadiusTR: 12,
      cornerRadiusBL: 0,
      cornerRadiusBR: 0,
    }),
    baseElement({
      name: 'Image Placeholder Icon',
      type: 'ellipse',
      x: baseX + 130, y: baseY + 38,
      width: 40, height: 40,
      fill: COLORS.accent,
      opacity: 30,
    }),
    baseElement({
      name: 'Card Title',
      type: 'text',
      x: baseX + 16, y: baseY + 132,
      width: 268, height: 24,
      fill: 'transparent',
      textContent: 'Card Title',
      fontFamily: 'Inter',
      fontSize: 18,
      fontWeight: 600,
      textColor: COLORS.dark,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Card Subtitle',
      type: 'text',
      x: baseX + 16, y: baseY + 160,
      width: 268, height: 20,
      fill: 'transparent',
      textContent: 'Description text goes here',
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: 400,
      textColor: COLORS.gray500,
      textAlign: 'left',
      lineHeight: 1.4,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Card Action',
      type: 'text',
      x: baseX + 16, y: baseY + 190,
      width: 80, height: 18,
      fill: 'transparent',
      textContent: 'Learn More →',
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: 600,
      textColor: COLORS.accent,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

function listItemTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'List Item',
      type: 'rectangle',
      x: baseX, y: baseY,
      width: 375, height: 64,
      fill: COLORS.white,
      stroke: COLORS.gray200,
      strokeWidth: 0,
      cornerRadius: 0,
    }),
    baseElement({
      name: 'Item Icon',
      type: 'ellipse',
      x: baseX + 16, y: baseY + 14,
      width: 36, height: 36,
      fill: '#E3F2FD',
    }),
    baseElement({
      name: 'Icon Inner',
      type: 'text',
      x: baseX + 26, y: baseY + 22,
      width: 16, height: 20,
      fill: 'transparent',
      textContent: '⭐',
      fontFamily: 'Inter',
      fontSize: 14,
      fontWeight: 400,
      textColor: COLORS.accent,
      textAlign: 'center',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Item Title',
      type: 'text',
      x: baseX + 64, y: baseY + 14,
      width: 240, height: 18,
      fill: 'transparent',
      textContent: 'List Item Title',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 500,
      textColor: COLORS.dark,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Item Subtitle',
      type: 'text',
      x: baseX + 64, y: baseY + 36,
      width: 240, height: 16,
      fill: 'transparent',
      textContent: 'Secondary text',
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: 400,
      textColor: COLORS.gray500,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Chevron',
      type: 'text',
      x: baseX + 345, y: baseY + 22,
      width: 16, height: 20,
      fill: 'transparent',
      textContent: '›',
      fontFamily: 'Inter',
      fontSize: 20,
      fontWeight: 300,
      textColor: COLORS.gray300,
      textAlign: 'center',
      lineHeight: 1.2,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Separator',
      type: 'line',
      x: baseX + 64, y: baseY + 63.5,
      width: 297, height: 0,
      fill: 'transparent',
      stroke: COLORS.gray200,
      strokeWidth: 0.5,
    }),
  ]
}

function buttonPrimaryTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Button Primary',
      type: 'rectangle',
      x: baseX, y: baseY,
      width: 200, height: 48,
      fill: COLORS.accent,
      cornerRadius: 24,
      cornerRadiusTL: 24,
      cornerRadiusTR: 24,
      cornerRadiusBL: 24,
      cornerRadiusBR: 24,
    }),
    baseElement({
      name: 'Button Label',
      type: 'text',
      x: baseX + 50, y: baseY + 14,
      width: 100, height: 22,
      fill: 'transparent',
      textContent: 'Get Started',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 600,
      textColor: COLORS.white,
      textAlign: 'center',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

function buttonSecondaryTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Button Secondary',
      type: 'rectangle',
      x: baseX, y: baseY,
      width: 200, height: 48,
      fill: 'transparent',
      stroke: COLORS.accent,
      strokeWidth: 2,
      cornerRadius: 24,
      cornerRadiusTL: 24,
      cornerRadiusTR: 24,
      cornerRadiusBL: 24,
      cornerRadiusBR: 24,
    }),
    baseElement({
      name: 'Button Label',
      type: 'text',
      x: baseX + 50, y: baseY + 14,
      width: 100, height: 22,
      fill: 'transparent',
      textContent: 'Learn More',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 600,
      textColor: COLORS.accent,
      textAlign: 'center',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

function searchBarTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Search Bar',
      type: 'rectangle',
      x: baseX, y: baseY,
      width: 343, height: 40,
      fill: COLORS.gray100,
      cornerRadius: 12,
      cornerRadiusTL: 12,
      cornerRadiusTR: 12,
      cornerRadiusBL: 12,
      cornerRadiusBR: 12,
    }),
    baseElement({
      name: 'Search Icon',
      type: 'text',
      x: baseX + 12, y: baseY + 11,
      width: 18, height: 18,
      fill: 'transparent',
      textContent: '⌕',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 400,
      textColor: COLORS.gray500,
      textAlign: 'center',
      lineHeight: 1.1,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Search Placeholder',
      type: 'text',
      x: baseX + 38, y: baseY + 11,
      width: 200, height: 18,
      fill: 'transparent',
      textContent: 'Search...',
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: 400,
      textColor: COLORS.gray300,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

function avatarTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Avatar Circle',
      type: 'ellipse',
      x: baseX, y: baseY,
      width: 48, height: 48,
      fill: '#E3F2FD',
    }),
    baseElement({
      name: 'Avatar Initial',
      type: 'text',
      x: baseX + 12, y: baseY + 13,
      width: 24, height: 24,
      fill: 'transparent',
      textContent: 'JD',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 600,
      textColor: COLORS.accent,
      textAlign: 'center',
      lineHeight: 1.4,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Avatar Name',
      type: 'text',
      x: baseX + 60, y: baseY + 5,
      width: 120, height: 20,
      fill: 'transparent',
      textContent: 'Jane Doe',
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 500,
      textColor: COLORS.dark,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Avatar Status',
      type: 'text',
      x: baseX + 60, y: baseY + 26,
      width: 120, height: 16,
      fill: 'transparent',
      textContent: 'Online',
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: 400,
      textColor: COLORS.green,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

function inputFieldTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Field Label',
      type: 'text',
      x: baseX, y: baseY,
      width: 120, height: 16,
      fill: 'transparent',
      textContent: 'Email Address',
      fontFamily: 'Inter',
      fontSize: 13,
      fontWeight: 500,
      textColor: COLORS.gray700,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
    baseElement({
      name: 'Input Field',
      type: 'rectangle',
      x: baseX, y: baseY + 22,
      width: 300, height: 44,
      fill: COLORS.white,
      stroke: COLORS.gray300,
      strokeWidth: 1,
      cornerRadius: 8,
      cornerRadiusTL: 8,
      cornerRadiusTR: 8,
      cornerRadiusBL: 8,
      cornerRadiusBR: 8,
    }),
    baseElement({
      name: 'Input Placeholder',
      type: 'text',
      x: baseX + 12, y: baseY + 34,
      width: 200, height: 20,
      fill: 'transparent',
      textContent: 'you@example.com',
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: 400,
      textColor: COLORS.gray300,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

function toggleTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Toggle Track',
      type: 'rectangle',
      x: baseX, y: baseY,
      width: 51, height: 31,
      fill: COLORS.green,
      cornerRadius: 16,
      cornerRadiusTL: 16,
      cornerRadiusTR: 16,
      cornerRadiusBL: 16,
      cornerRadiusBR: 16,
    }),
    baseElement({
      name: 'Toggle Knob',
      type: 'ellipse',
      x: baseX + 26, y: baseY + 2,
      width: 27, height: 27,
      fill: COLORS.white,
      shadows: [{ type: 'drop-shadow', x: 0, y: 1, blur: 3, spread: 0, color: '#000000', opacity: 15, visible: true }],
    }),
    baseElement({
      name: 'Toggle Label',
      type: 'text',
      x: baseX + 60, y: baseY + 6,
      width: 80, height: 20,
      fill: 'transparent',
      textContent: 'Enabled',
      fontFamily: 'Inter',
      fontSize: 15,
      fontWeight: 400,
      textColor: COLORS.dark,
      textAlign: 'left',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

function badgeChipTemplate(baseX: number, baseY: number): DesignElement[] {
  return [
    baseElement({
      name: 'Chip Background',
      type: 'rectangle',
      x: baseX, y: baseY,
      width: 80, height: 28,
      fill: '#E3F2FD',
      cornerRadius: 14,
      cornerRadiusTL: 14,
      cornerRadiusTR: 14,
      cornerRadiusBL: 14,
      cornerRadiusBR: 14,
    }),
    baseElement({
      name: 'Chip Label',
      type: 'text',
      x: baseX + 14, y: baseY + 6,
      width: 52, height: 16,
      fill: 'transparent',
      textContent: 'Active',
      fontFamily: 'Inter',
      fontSize: 12,
      fontWeight: 600,
      textColor: COLORS.accent,
      textAlign: 'center',
      lineHeight: 1.3,
      letterSpacing: 0,
    }),
  ]
}

// Template registry
interface TemplateEntry {
  id: string
  name: string
  category: string
  icon: React.ReactNode
  color: string
  generate: (baseX: number, baseY: number) => DesignElement[]
}

const TEMPLATES: TemplateEntry[] = [
  {
    id: 'status-bar',
    name: 'Status Bar',
    category: 'Navigation',
    icon: <Smartphone className="w-4 h-4" />,
    color: '#333333',
    generate: statusBarTemplate,
  },
  {
    id: 'nav-bar',
    name: 'Navigation Bar',
    category: 'Navigation',
    icon: <Navigation className="w-4 h-4" />,
    color: '#2C2C2C',
    generate: navigationBarTemplate,
  },
  {
    id: 'bottom-tab',
    name: 'Bottom Tab Bar',
    category: 'Navigation',
    icon: <LayoutGrid className="w-4 h-4" />,
    color: '#383838',
    generate: bottomTabBarTemplate,
  },
  {
    id: 'card',
    name: 'Card',
    category: 'Content',
    icon: <Square className="w-4 h-4" />,
    color: '#0D99FF',
    generate: cardTemplate,
  },
  {
    id: 'list-item',
    name: 'List Item',
    category: 'Content',
    icon: <List className="w-4 h-4" />,
    color: '#4CAF50',
    generate: listItemTemplate,
  },
  {
    id: 'button-primary',
    name: 'Button Primary',
    category: 'Buttons',
    icon: <MousePointerClick className="w-4 h-4" />,
    color: '#0D99FF',
    generate: buttonPrimaryTemplate,
  },
  {
    id: 'button-secondary',
    name: 'Button Secondary',
    category: 'Buttons',
    icon: <MousePointerClick className="w-4 h-4" />,
    color: '#333333',
    generate: buttonSecondaryTemplate,
  },
  {
    id: 'search-bar',
    name: 'Search Bar',
    category: 'Input',
    icon: <Search className="w-4 h-4" />,
    color: '#888888',
    generate: searchBarTemplate,
  },
  {
    id: 'avatar',
    name: 'Avatar',
    category: 'Content',
    icon: <User className="w-4 h-4" />,
    color: '#E3F2FD',
    generate: avatarTemplate,
  },
  {
    id: 'input-field',
    name: 'Input Field',
    category: 'Input',
    icon: <Type className="w-4 h-4" />,
    color: '#555555',
    generate: inputFieldTemplate,
  },
  {
    id: 'toggle',
    name: 'Toggle',
    category: 'Input',
    icon: <ToggleLeft className="w-4 h-4" />,
    color: '#4CAF50',
    generate: toggleTemplate,
  },
  {
    id: 'badge-chip',
    name: 'Badge / Chip',
    category: 'Content',
    icon: <Tag className="w-4 h-4" />,
    color: '#0D99FF',
    generate: badgeChipTemplate,
  },
]

const CATEGORIES = ['Navigation', 'Content', 'Buttons', 'Input']

export function UITemplatesPanel() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('Navigation')
  const addElement = useEditorStore((s) => s.addElement)
  const pushHistory = useEditorStore((s) => s.pushHistory)

  const handleTemplateClick = (template: TemplateEntry) => {
    // Place templates near the center of the current canvas view
    const baseX = 100 + Math.random() * 100
    const baseY = 100 + Math.random() * 100

    const elements = template.generate(baseX, baseY)

    // Push history before adding elements (single undo step)
    pushHistory()

    // Add all elements from the template
    elements.forEach((el) => {
      addElement(el)
    })
  }

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category)
  }

  return (
    <div className="p-2">
      {CATEGORIES.map((category) => {
        const templates = TEMPLATES.filter((t) => t.category === category)
        const isExpanded = expandedCategory === category

        return (
          <div key={category} className="mb-1">
            <button
              className="flex items-center gap-1.5 w-full px-2 py-1.5 hover:bg-[#2A2A2A] rounded transition-colors"
              onClick={() => toggleCategory(category)}
            >
              {isExpanded ? (
                <ChevronRight className="w-3 h-3 text-[#666] rotate-90 transition-transform" />
              ) : (
                <ChevronRight className="w-3 h-3 text-[#666] transition-transform" />
              )}
              <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider">{category}</span>
              <span className="text-[9px] text-[#555] ml-auto">{templates.length}</span>
            </button>

            {isExpanded && (
              <div className="grid grid-cols-2 gap-1 px-1 pb-2 pt-1">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateClick(template)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-md bg-[#1E1E1E] border border-[#383838] hover:border-[#0D99FF]/50 hover:bg-[#2A2A2A] transition-all group cursor-pointer"
                    title={`Add ${template.name} template`}
                  >
                    {/* Preview thumbnail */}
                    <div
                      className="w-full h-10 rounded flex items-center justify-center"
                      style={{ backgroundColor: template.color + '20' }}
                    >
                      <div
                        className="w-6 h-4 rounded-sm"
                        style={{
                          backgroundColor: template.color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    {/* Name */}
                    <span className="text-[10px] text-[#AAA] group-hover:text-white transition-colors truncate w-full text-center">
                      {template.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
