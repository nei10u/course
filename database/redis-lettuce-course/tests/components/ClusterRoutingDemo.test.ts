// tests/components/ClusterRoutingDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ClusterRoutingDemo from '../../components/demos/ClusterRoutingDemo.vue'

describe('ClusterRoutingDemo', () => {
  it('renders without crashing', () => {
    const wrapper = mount(ClusterRoutingDemo)
    expect(wrapper.text()).toContain('Cluster')
    expect(wrapper.text()).toContain('Node A')
    expect(wrapper.text()).toContain('Node B')
    expect(wrapper.text()).toContain('Node C')
  })

  it('computes slot for default key', () => {
    const wrapper = mount(ClusterRoutingDemo)
    expect(wrapper.text()).toContain('Slot:')
    expect(wrapper.text()).toContain('Node:')
  })

  it('clicking Run triggers animation', async () => {
    const wrapper = mount(ClusterRoutingDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')

    // After run, slot should be computed
    expect(wrapper.text()).toContain('Slot:')

    wrapper.unmount()
  })

  it('Reset clears state', async () => {
    const wrapper = mount(ClusterRoutingDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')
    await wrapper.find('[data-test="step"]').trigger('click')

    await wrapper.find('[data-test="reset"]').trigger('click')

    // Log should be empty after reset
    expect(wrapper.findAll('.log-line').length).toBe(0)

    wrapper.unmount()
  })
})
