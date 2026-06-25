// tests/components/ClientCacheDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ClientCacheDemo from '../../components/demos/ClientCacheDemo.vue'

describe('ClientCacheDemo', () => {
  it('renders without crashing', () => {
    const wrapper = mount(ClientCacheDemo)
    expect(wrapper.text()).toContain('tracking')
    expect(wrapper.text()).toContain('Client A')
    expect(wrapper.text()).toContain('Client B')
    expect(wrapper.text()).toContain('Redis')
  })

  it('clicking Run triggers state changes on step', async () => {
    const wrapper = mount(ClientCacheDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')

    const stepBtn = wrapper.find('[data-test="step"]')
    for (let i = 0; i < 5; i++) {
      await stepBtn.trigger('click')
    }

    // After stepping, should show some log entries
    const text = wrapper.text()
    expect(text).toContain('Client A')

    wrapper.unmount()
  })

  it('Reset clears state', async () => {
    const wrapper = mount(ClientCacheDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')
    await wrapper.find('[data-test="step"]').trigger('click')

    await wrapper.find('[data-test="reset"]').trigger('click')

    expect(wrapper.findAll('.log-line').length).toBe(0)

    wrapper.unmount()
  })
})
