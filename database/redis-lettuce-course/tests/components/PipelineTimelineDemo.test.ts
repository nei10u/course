// tests/components/PipelineTimelineDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PipelineTimelineDemo from '../../components/demos/PipelineTimelineDemo.vue'

describe('PipelineTimelineDemo', () => {
  it('renders with sync and async timelines', () => {
    const wrapper = mount(PipelineTimelineDemo)
    expect(wrapper.text()).toContain('Sync API')
    expect(wrapper.text()).toContain('Async API')
  })

  it('loop count selector has 10/100/1000 options', () => {
    const wrapper = mount(PipelineTimelineDemo)
    const options = wrapper.findAll('option')
    const values = options.map(o => o.attributes('value'))
    expect(values).toContain('10')
    expect(values).toContain('100')
    expect(values).toContain('1000')
  })

  it('renders without error for 1000 loops', () => {
    const wrapper = mount(PipelineTimelineDemo)
    const select = wrapper.find('select[data-test="loop-count"]')
    select.setValue('1000')
    expect(wrapper.find('[data-test="sync-timeline"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="async-timeline"]').exists()).toBe(true)
  })

  it('clicking Run populates events and shows them in Timeline', async () => {
    const wrapper = mount(PipelineTimelineDemo, { attachTo: document.body })
    // Before Run: empty state hint visible
    expect(wrapper.text()).toContain('点击')

    // Click Run (now inside TimeControls as data-test="run")
    const runBtn = wrapper.find('[data-test="run"]')
    expect(runBtn.exists()).toBe(true)
    await runBtn.trigger('click')

    // After Run but before any clock tick: events are scheduled, not yet visible.
    // (Previously events were pushed synchronously; now they fire via clock.step/play.)
    // Step the clock a few times to let scheduled events emit.
    const stepBtn = wrapper.find('[data-test="step"]')
    for (let i = 0; i < 5; i++) {
      await stepBtn.trigger('click')
    }

    // After stepping, syncEvents should have events (sync has 2 events per step)
    // Empty state hint should be gone
    expect(wrapper.text()).not.toContain('点击 ▶ Run 开始时间线')

    // The SVG should now be rendered (events ≤ 500 threshold)
    const svg = wrapper.find('svg.timeline-svg')
    expect(svg.exists()).toBe(true)

    wrapper.unmount()
  })
})
