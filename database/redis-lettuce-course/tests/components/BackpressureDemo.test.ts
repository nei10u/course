// tests/components/BackpressureDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BackpressureDemo from '../../components/demos/BackpressureDemo.vue'

describe('BackpressureDemo', () => {
  it('renders without crashing', () => {
    const wrapper = mount(BackpressureDemo)
    expect(wrapper.text()).toContain('Backpressure')
  })

  it('clicking Run starts the demo', async () => {
    const wrapper = mount(BackpressureDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')

    expect(wrapper.text()).toContain('Reactive Backpressure')

    wrapper.unmount()
  })

  it('Reset clears state', async () => {
    const wrapper = mount(BackpressureDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')
    await wrapper.find('[data-test="reset"]').trigger('click')

    expect(wrapper.text()).not.toContain('已丢弃')

    wrapper.unmount()
  })
})
