// tests/components/PipelineTimelineDemo.play.test.ts
// Verifies that clicking 载入并播放 auto-fires events over real time.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PipelineTimelineDemo from '../../components/demos/PipelineTimelineDemo.vue'

describe('PipelineTimelineDemo auto-play', () => {
  let originalRaf: typeof requestAnimationFrame
  let originalCancel: typeof cancelAnimationFrame

  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame
    originalCancel = globalThis.cancelAnimationFrame
    let rafTime = 0
    globalThis.requestAnimationFrame = ((cb: (t: number) => void) => {
      setTimeout(() => {
        rafTime += 16
        cb(rafTime)
      }, 0)
      return 1
    }) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame
  })

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf
    globalThis.cancelAnimationFrame = originalCancel
  })

  it('clicking 载入并播放 auto-fires events over time', async () => {
    const wrapper = mount(PipelineTimelineDemo, { attachTo: document.body })

    // Verify initial empty state
    expect(wrapper.text()).toContain('点击')

    // Click Run
    await wrapper.find('[data-test="run"]').trigger('click')

    // Wait for raf callbacks to flush (multiple ticks for 1000ms duration)
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 20))
    }

    // After auto-play, all events should have fired
    // Empty state hint should be gone
    expect(wrapper.text()).not.toContain('点击 ▶ Run 开始时间线')

    // SVG should be rendered with many events
    const circles = wrapper.findAll('circle')
    expect(circles.length).toBeGreaterThan(10)

    wrapper.unmount()
  })
})
