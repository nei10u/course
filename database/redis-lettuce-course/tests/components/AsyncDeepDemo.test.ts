// tests/components/AsyncDeepDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AsyncDeepDemo from '../../components/demos/AsyncDeepDemo.vue'

describe('AsyncDeepDemo', () => {
  it('renders without crashing', () => {
    const wrapper = mount(AsyncDeepDemo)
    expect(wrapper.text()).toContain('CompletableFuture')
  })

  it('clicking Run triggers state changes on step', async () => {
    const wrapper = mount(AsyncDeepDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')

    const stepBtn = wrapper.find('[data-test="step"]')
    for (let i = 0; i < 5; i++) {
      await stepBtn.trigger('click')
    }

    const text = wrapper.text()
    // After stepping, chain steps should have changed status
    expect(text).toContain('CompletableFuture')
    expect(text).toContain('SET counter')

    wrapper.unmount()
  })

  it('Reset clears state', async () => {
    const wrapper = mount(AsyncDeepDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')
    await wrapper.find('[data-test="step"]').trigger('click')

    await wrapper.find('[data-test="reset"]').trigger('click')

    // After reset, log should be empty
    expect(wrapper.findAll('.log-line').length).toBe(0)

    wrapper.unmount()
  })
})
