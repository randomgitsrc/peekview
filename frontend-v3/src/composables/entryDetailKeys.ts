import type { InjectionKey, Ref, ComputedRef } from 'vue'

export const ZenModeKey: InjectionKey<Ref<boolean>> = Symbol('zenMode')
export const IsMobileKey: InjectionKey<ComputedRef<boolean>> = Symbol('isMobile')
export const ZenAriaTextKey: InjectionKey<Ref<string>> = Symbol('zenAriaText')
