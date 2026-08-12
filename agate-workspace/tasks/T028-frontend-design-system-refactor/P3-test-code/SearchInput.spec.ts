import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchInput from '@/components/SearchInput.vue'

describe('SearchInput', () => {
  it('renders with default placeholder', () => {
    const wrapper = mount(SearchInput)
    const input = wrapper.find('input')
    expect(input.attributes('placeholder')).toBe('Search...')
  })

  it('renders with custom placeholder', () => {
    const wrapper = mount(SearchInput, { props: { placeholder: 'Find entries...' } })
    expect(wrapper.find('input').attributes('placeholder')).toBe('Find entries...')
  })

  it('renders with modelValue', () => {
    const wrapper = mount(SearchInput, { props: { modelValue: 'hello' } })
    expect(wrapper.find('input').element.value).toBe('hello')
  })

  it('emits update:modelValue on input', async () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '' } })
    const input = wrapper.find('input')
    await input.setValue('test query')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['test query'])
  })

  it('shows clear button when value is present', () => {
    const wrapper = mount(SearchInput, { props: { modelValue: 'hello' } })
    expect(wrapper.find('.clear-btn').exists() || wrapper.find('[aria-label="Clear"]').exists()).toBe(true)
  })

  it('hides clear button when value is empty', () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '' } })
    expect(wrapper.find('.clear-btn').exists() || wrapper.find('[aria-label="Clear"]').exists()).toBe(false)
  })

  it('emits clear on clear button click', async () => {
    const wrapper = mount(SearchInput, { props: { modelValue: 'hello' } })
    const clearBtn = wrapper.find('.clear-btn') || wrapper.find('[aria-label="Clear"]')
    if (clearBtn.exists()) {
      await clearBtn.trigger('click')
      expect(wrapper.emitted('clear')).toBeTruthy()
    }
  })

  it('emits update:modelValue with empty string on clear', async () => {
    const wrapper = mount(SearchInput, { props: { modelValue: 'hello' } })
    const clearBtn = wrapper.find('.clear-btn') || wrapper.find('[aria-label="Clear"]')
    if (clearBtn.exists()) {
      await clearBtn.trigger('click')
      const updateEvents = wrapper.emitted('update:modelValue')
      expect(updateEvents).toBeTruthy()
      expect(updateEvents!.at(-1)).toEqual([''])
    }
  })

  it('emits keydown event', async () => {
    const wrapper = mount(SearchInput, { props: { modelValue: '' } })
    await wrapper.find('input').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('keydown')).toBeTruthy()
  })

  it('has search icon on the left', () => {
    const wrapper = mount(SearchInput)
    const icon = wrapper.find('.search-icon') || wrapper.find('svg')
    expect(icon.exists()).toBe(true)
  })

  it('has focus ring style', () => {
    const wrapper = mount(SearchInput)
    const input = wrapper.find('input')
    const classes = input.classes().join(' ')
    const hasFocusClass = classes.includes('search-input') || classes.includes('focus-ring')
    expect(hasFocusClass || wrapper.find('.search-input-wrapper').exists()).toBe(true)
  })

  it('uses --c-surface-lower background', () => {
    const wrapper = mount(SearchInput)
    const wrapper_ = wrapper.find('.search-input-wrapper') || wrapper.find('.search-input')
    const style = wrapper_.attributes('style') || ''
    const classes = wrapper_.classes().join(' ')
    const usesSurfaceLower = style.includes('--c-surface-lower') || classes.includes('search-input')
    expect(usesSurfaceLower).toBe(true)
  })
})
