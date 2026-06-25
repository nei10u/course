// tests/components/TimeControls.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { VirtualClock } from '../../mock/VirtualClock'
import TimeControls from '../../components/base/TimeControls.vue'

describe('TimeControls', () => {
  it('renders play/step/reset buttons', () => {
    const clock = new VirtualClock()
    const wrapper = mount(TimeControls, { props: { clock } })
    expect(wrapper.text()).toContain('▶')
    expect(wrapper.text()).toContain('⏭')
    expect(wrapper.text()).toContain('↻')
  })

  it('hides Run button when onRun not provided', () => {
    const clock = new VirtualClock()
    const wrapper = mount(TimeControls, { props: { clock } })
    expect(wrapper.find('[data-test="run"]').exists()).toBe(false)
  })

  it('shows Run button when onRun provided', () => {
    const clock = new VirtualClock()
    const wrapper = mount(TimeControls, { props: { clock, onRun: () => {} } })
    expect(wrapper.find('[data-test="run"]').exists()).toBe(true)
  })

  it('Run button calls onRun callback', async () => {
    const clock = new VirtualClock()
    const onRun = vi.fn()
    const wrapper = mount(TimeControls, { props: { clock, onRun } })
    await wrapper.find('[data-test="run"]').trigger('click')
    expect(onRun).toHaveBeenCalledOnce()
  })

  it('play button calls clock.play', () => {
    const clock = new VirtualClock()
    const wrapper = mount(TimeControls, { props: { clock } })
    const playSpy = vi.spyOn(clock, 'play')
    wrapper.find('[data-test="play"]').trigger('click')
    expect(playSpy).toHaveBeenCalled()
  })

  it('step button calls clock.step', () => {
    const clock = new VirtualClock()
    const wrapper = mount(TimeControls, { props: { clock } })
    const stepSpy = vi.spyOn(clock, 'step')
    wrapper.find('[data-test="step"]').trigger('click')
    expect(stepSpy).toHaveBeenCalled()
  })

  it('speed selector updates clock speed', async () => {
    const clock = new VirtualClock()
    const wrapper = mount(TimeControls, { props: { clock } })
    await wrapper.find('[data-test="speed"]').setValue('0.5')
    expect(clock.speed).toBe(0.5)
  })
})
