// tests/components/ScriptsDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ScriptsDemo from '../../components/demos/ScriptsDemo.vue'

describe('ScriptsDemo', () => {
  it('renders without crashing', () => {
    const wrapper = mount(ScriptsDemo)
    expect(wrapper.text()).toContain('Lua')
    expect(wrapper.text()).toContain('EVAL')
    expect(wrapper.text()).toContain('KEYS')
    expect(wrapper.text()).toContain('ARGV')
  })

  it('clicking Run triggers EVAL on step', async () => {
    const wrapper = mount(ScriptsDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')

    const stepBtn = wrapper.find('[data-test="step"]')
    for (let i = 0; i < 5; i++) {
      await stepBtn.trigger('click')
    }

    // After stepping, log should have entries
    const text = wrapper.text()
    expect(text).toContain('EVAL')

    wrapper.unmount()
  })

  it('Reset clears state', async () => {
    const wrapper = mount(ScriptsDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')
    await wrapper.find('[data-test="step"]').trigger('click')

    await wrapper.find('[data-test="reset"]').trigger('click')

    expect(wrapper.findAll('.log-line').length).toBe(0)

    wrapper.unmount()
  })
})
