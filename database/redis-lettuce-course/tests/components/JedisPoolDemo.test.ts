// tests/components/JedisPoolDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import JedisPoolDemo from '../../components/demos/JedisPoolDemo.vue'

describe('JedisPoolDemo', () => {
  it('clicking Run schedules events that change thread state on step', async () => {
    const wrapper = mount(JedisPoolDemo, { attachTo: document.body })

    // Initial state: no threads (empty hint visible)
    const initial = wrapper.text()
    expect(initial.includes('点击') || initial.includes('载入并播放')).toBe(true)

    // Click Run
    const runBtn = wrapper.find('[data-test="run"]')
    expect(runBtn.exists()).toBe(true)
    await runBtn.trigger('click')

    // After Run, threads should be populated
    expect(wrapper.text()).toContain('T1')

    // Step the clock — should fire first borrow event
    const stepBtn = wrapper.find('[data-test="step"]')
    await stepBtn.trigger('click')

    // T1 should now have borrowed a connection (status busy)
    const threadsAfterStep = wrapper.findAll('.thread')
    expect(threadsAfterStep.length).toBe(8)

    // Step more — more threads should transition
    for (let i = 0; i < 5; i++) {
      await stepBtn.trigger('click')
    }

    // After several steps, at least some thread should be busy or waiting
    const allText = wrapper.text()
    const hasBusyOrWaiting = allText.includes('使用中') || allText.includes('等待')
    expect(hasBusyOrWaiting).toBe(true)

    wrapper.unmount()
  })

  it('Reset button clears threads and pool', async () => {
    const wrapper = mount(JedisPoolDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')
    expect(wrapper.text()).toContain('T1')

    await wrapper.find('[data-test="reset"]').trigger('click')
    expect(wrapper.text()).not.toContain('T1')

    wrapper.unmount()
  })
})
