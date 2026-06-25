// tests/components/CodecDemo.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CodecDemo from '../../components/demos/CodecDemo.vue'

describe('CodecDemo', () => {
  it('renders without crashing', () => {
    const wrapper = mount(CodecDemo)
    expect(wrapper.text()).toContain('Codec')
  })

  it('clicking Run serializes and shows result', async () => {
    const wrapper = mount(CodecDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')

    // After run, should show deserialization result
    expect(wrapper.text()).toContain('反序列化')

    wrapper.unmount()
  })

  it('Reset clears result', async () => {
    const wrapper = mount(CodecDemo, { attachTo: document.body })

    await wrapper.find('[data-test="run"]').trigger('click')
    await nextTick()
    expect(wrapper.find('.codec-box.result').exists()).toBe(true)

    await wrapper.find('[data-test="reset"]').trigger('click')
    await nextTick()
    expect(wrapper.find('.codec-box.result').exists()).toBe(false)

    wrapper.unmount()
  })

  it('shows serialization info for different codecs', async () => {
    const wrapper = mount(CodecDemo)

    // String codec is default
    expect(wrapper.text()).toContain('StringCodec')

    // Switch to JSON
    await wrapper.find('select[data-test="codec"]').setValue('json')
    expect(wrapper.text()).toContain('JSON')

    wrapper.unmount()
  })
})
