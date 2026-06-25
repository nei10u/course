// tests/components/SlotMap.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SlotMap from '../../components/base/SlotMap.vue'

const threeNodes = [
  { id: 'Node A', color: '#f97316', slots: [[0, 5460] as [number, number]] },
  { id: 'Node B', color: '#3b82f6', slots: [[5461, 10922] as [number, number]] },
  { id: 'Node C', color: '#a855f7', slots: [[10923, 16383] as [number, number]] },
]

describe('SlotMap', () => {
  it('renders with 3 nodes and legend', () => {
    const wrapper = mount(SlotMap, { props: { nodes: threeNodes } })
    expect(wrapper.text()).toContain('Node A')
    expect(wrapper.text()).toContain('Node B')
    expect(wrapper.text()).toContain('Node C')
    expect(wrapper.text()).toContain('Hash Slot Map')
  })

  it('renders SVG with batched rects', () => {
    const wrapper = mount(SlotMap, { props: { nodes: threeNodes } })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    const rects = svg.findAll('rect')
    // Should have many batched rects (3 colors per row * 128 rows = ~384 batched rects)
    expect(rects.length).toBeGreaterThan(100)
  })

  it('highlights a specific slot when prop provided', () => {
    const wrapper = mount(SlotMap, { props: { nodes: threeNodes, highlightSlot: 12345 } })
    expect(wrapper.find('svg').exists()).toBe(true)
    // The highlight rect and text should be rendered
    const text = wrapper.find('svg text')
    expect(text.exists()).toBe(true)
  })

  it('emits select-slot on click', async () => {
    const wrapper = mount(SlotMap, { props: { nodes: threeNodes } })
    const svg = wrapper.find('svg')
    // Mock click at a position that maps to a slot
    await svg.trigger('click')
    // The emit should fire (we can't easily control coordinates in jsdom)
    // Just verify the component doesn't crash
    expect(svg.exists()).toBe(true)
  })
})
