<template>
  <Button
    :variant="variant"
    :icon="icon"
    icon-only
    v-bind="$attrs"
    @click="$emit('click', $event)"
  >
    <Tooltip v-if="tooltip" :text="tooltip" />
  </Button>
</template>

<script setup lang="ts">
import Button from './Button.vue'
import Tooltip from './Tooltip.vue'
import type { ButtonVariant } from '../../types'

interface Props {
  icon: string
  tooltip?: string
  variant?: ButtonVariant
}

defineProps<Props>()
defineEmits<{ click: [e: MouseEvent] }>()
</script>
