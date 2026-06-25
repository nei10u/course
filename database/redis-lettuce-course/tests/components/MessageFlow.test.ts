// tests/components/MessageFlow.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageFlow from '../../components/base/MessageFlow.vue'

describe('MessageFlow', () => {
  it('renders publishers, channels, and subscribers', () => {
    const wrapper = mount(MessageFlow, {
      props: {
        publishers: [{ id: 'P1' }, { id: 'P2' }],
        channels: [{ name: 'news', subscribers: ['S1', 'S2'] }],
        messages: [],
      },
    })
    expect(wrapper.text()).toContain('P1')
    expect(wrapper.text()).toContain('P2')
    expect(wrapper.text()).toContain('news')
    expect(wrapper.text()).toContain('S1')
    expect(wrapper.text()).toContain('S2')
    expect(wrapper.text()).toContain('Publishers')
    expect(wrapper.text()).toContain('Channels')
    expect(wrapper.text()).toContain('Subscribers')
  })

  it('renders message dots when messages provided', () => {
    const wrapper = mount(MessageFlow, {
      props: {
        publishers: [{ id: 'P1' }],
        channels: [{ name: 'news', subscribers: ['S1'] }],
        messages: [
          { id: 'm1', from: 'P1', to: 'S1', channel: 'news' },
        ],
      },
    })
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBeGreaterThan(0)
  })

  it('renders without crashing for empty props', () => {
    const wrapper = mount(MessageFlow, {
      props: {
        publishers: [],
        channels: [],
        messages: [],
      },
    })
    expect(wrapper.find('svg').exists()).toBe(true)
  })
})
