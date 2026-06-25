// tests/components/BackpressureGauge.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BackpressureGauge from '../../components/base/BackpressureGauge.vue'

describe('BackpressureGauge', () => {
  it('renders with upstream and downstream bars', () => {
    const wrapper = mount(BackpressureGauge, {
      props: { upstreamRate: 10, downstreamRate: 5, bufferSize: 20, bufferFill: 8 },
    })
    expect(wrapper.text()).toContain('upstream')
    expect(wrapper.text()).toContain('downstream')
    expect(wrapper.text()).toContain('buffer')
    expect(wrapper.text()).toContain('10/s')
    expect(wrapper.text()).toContain('5/s')
    expect(wrapper.text()).toContain('8/20')
  })

  it('shows OK status when buffer low', () => {
    const wrapper = mount(BackpressureGauge, {
      props: { upstreamRate: 5, downstreamRate: 5, bufferSize: 20, bufferFill: 2 },
    })
    expect(wrapper.text()).toContain('OK')
  })

  it('shows BACKPRESSURE when buffer over 80%', () => {
    const wrapper = mount(BackpressureGauge, {
      props: { upstreamRate: 10, downstreamRate: 5, bufferSize: 20, bufferFill: 17 },
    })
    expect(wrapper.text()).toContain('BACKPRESSURE')
  })

  it('shows BLOCKED when buffer full', () => {
    const wrapper = mount(BackpressureGauge, {
      props: { upstreamRate: 10, downstreamRate: 5, bufferSize: 20, bufferFill: 20 },
    })
    expect(wrapper.text()).toContain('BLOCKED')
  })
})
