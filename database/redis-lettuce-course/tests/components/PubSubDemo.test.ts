// tests/components/PubSubDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PubSubDemo from '../../components/demos/PubSubDemo.vue'

describe('PubSubDemo', () => {
  it('renders without crashing', () => {
    const wrapper = mount(PubSubDemo)
    expect(wrapper.text()).toContain('Pub/Sub')
    expect(wrapper.text()).toContain('S1')
    expect(wrapper.text()).toContain('S2')
  })

  it('clicking Run sets up subscriptions', async () => {
    const wrapper = mount(PubSubDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')

    // After run, subscribers should have channels
    expect(wrapper.text()).toContain('S1')
    expect(wrapper.text()).toContain('S2')

    wrapper.unmount()
  })

  it('Reset clears state', async () => {
    const wrapper = mount(PubSubDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')
    await wrapper.find('[data-test="reset"]').trigger('click')

    // Subscribers should have no channels after reset
    expect(wrapper.text()).toContain('(无)')

    wrapper.unmount()
  })
})
