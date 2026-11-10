<template>
  <div class="visibility-menu-root" ref="rootRef">
    <button
      ref="triggerRef"
      type="button"
      class="visibility-toggle"
      :class="`visibility-toggle--${variant}`"
      data-testid="visibility-toggle"
      :disabled="disabled"
      :aria-disabled="disabled ? 'true' : undefined"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      :aria-label="`Visibility: ${statusLabel}`"
      @click="toggle"
      @keydown.enter.prevent="openMenu"
      @keydown.space.prevent="openMenu"
    >
      <component :is="stateIcon" :size="iconSize" />
      <span v-if="variant === 'inline'" class="visibility-toggle__label">{{ statusLabel }}</span>
    </button>

    <Teleport to="body" :disabled="variant !== 'sheet'">
      <div v-if="isOpen" class="visibility-layer">
        <div v-if="variant === 'sheet'" class="visibility-backdrop" @click="close"></div>
        <div
          ref="panelRef"
          class="visibility-panel"
          :class="`visibility-panel--${variant}`"
          data-testid="visibility-menu"
          role="menu"
        >
          <div v-if="variant === 'sheet'" class="visibility-sheet-header">
            <span class="visibility-sheet-title">可见性</span>
            <button type="button" class="visibility-sheet-close" aria-label="Close" @click="close">
              <XIcon :size="20" />
            </button>
          </div>

          <button
            v-if="showPublic"
            type="button"
            class="visibility-item"
            data-testid="visibility-item-public"
            role="menuitem"
            @click="choose({ kind: 'public' })"
          >
            <GlobeIcon :size="16" />
            <span class="visibility-item-label">Public</span>
          </button>

          <button
            v-if="showPrivate"
            type="button"
            class="visibility-item"
            data-testid="visibility-item-private"
            role="menuitem"
            @click="choose({ kind: 'private' })"
          >
            <LockIcon :size="16" />
            <span class="visibility-item-label">Private</span>
          </button>

          <button
            v-if="showTeam"
            type="button"
            class="visibility-item"
            data-testid="visibility-item-team"
            role="menuitem"
            aria-haspopup="true"
            :aria-expanded="isTeamSubmenuOpen"
            :disabled="teamsFailed || disabled"
            :title="teamsFailed ? '团队列表加载失败' : undefined"
            @click="toggleTeamSubmenu"
          >
            <UsersIcon :size="16" />
            <span class="visibility-item-label">{{ teamsFailed ? '团队列表加载失败' : 'Team' }}</span>
            <ChevronRightIcon v-if="!teamsFailed" :size="14" class="visibility-item-caret" />
          </button>

          <div
            v-if="isTeamSubmenuOpen"
            class="visibility-submenu"
            data-testid="visibility-team-submenu"
            role="menu"
          >
            <button
              v-for="team in options.teamSubmenu"
              :key="team.slug"
              type="button"
              class="visibility-item visibility-item--sub"
              :data-testid="`visibility-team-option-${team.slug}`"
              role="menuitem"
              @click="choose({ kind: 'team', teamSlug: team.slug, teamName: team.name })"
            >
              <span class="visibility-item-label">{{ team.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      :visible="isConfirming"
      variant="primary"
      title="Make this entry public?"
      message="Anyone with the link will be able to view this entry. Team visibility will be removed."
      confirm-label="Make public"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  Globe as GlobeIcon,
  Lock as LockIcon,
  Users as UsersIcon,
  ChevronRight as ChevronRightIcon,
  X as XIcon,
} from 'lucide-vue-next'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { buildVisibilityOptions, visibilityStatusLabel, type VisibilityTarget } from '@/utils/visibility-options'
import { needsConfirm } from '@/utils/visibility-target'
import type { Entry, Team } from '@/types'

const props = withDefaults(
  defineProps<{
    entry: Entry
    teams: Team[]
    variant?: 'icon' | 'inline' | 'sheet'
    disabled?: boolean
    teamsFailed?: boolean
  }>(),
  {
    variant: 'icon',
    disabled: false,
    teamsFailed: false,
  },
)

const emit = defineEmits<{
  select: [target: VisibilityTarget]
  'confirm-cancel': []
}>()

const isOpen = ref(false)
const isTeamSubmenuOpen = ref(false)
const pendingTarget = ref<VisibilityTarget | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)

const statusLabel = computed(() => visibilityStatusLabel(props.entry))
const currentTeamSlug = computed(() => props.entry.team?.slug ?? null)
const options = computed(() =>
  buildVisibilityOptions({
    isPublic: props.entry.isPublic,
    currentTeamSlug: currentTeamSlug.value,
    teams: props.teams,
    teamsFailed: props.teamsFailed,
  }),
)
const showPublic = computed(() => options.value.items.some(i => i.kind === 'public'))
const showPrivate = computed(() => options.value.items.some(i => i.kind === 'private'))
const showTeam = computed(() => options.value.items.some(i => i.kind === 'team'))

const isConfirming = computed(() => pendingTarget.value !== null)

const stateIcon = computed(() => {
  if (props.entry.team) return UsersIcon
  return props.entry.isPublic ? GlobeIcon : LockIcon
})
const iconSize = computed(() => (props.variant === 'inline' ? 14 : 16))

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (!isOpen.value) isTeamSubmenuOpen.value = false
}

function openMenu() {
  if (props.disabled) return
  isOpen.value = true
}

function close() {
  isOpen.value = false
  isTeamSubmenuOpen.value = false
  triggerRef.value?.focus()
}

function toggleTeamSubmenu() {
  if (props.disabled || props.teamsFailed) return
  isTeamSubmenuOpen.value = !isTeamSubmenuOpen.value
}

function choose(target: VisibilityTarget) {
  if (props.disabled) return
  isOpen.value = false
  isTeamSubmenuOpen.value = false
  if (needsConfirm(target)) {
    pendingTarget.value = target
    return
  }
  emit('select', target)
}

function handleConfirm() {
  const target = pendingTarget.value
  pendingTarget.value = null
  if (target) emit('select', target)
}

function handleCancel() {
  pendingTarget.value = null
  isOpen.value = true
  emit('confirm-cancel')
  nextTick(() => triggerRef.value?.focus())
}

function handlePointerDown(e: MouseEvent) {
  if (!isOpen.value) return
  const target = e.target as Node
  if (rootRef.value?.contains(target) || panelRef.value?.contains(target)) return
  close()
}

function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return
  if (e.key === 'Escape') {
    if (isTeamSubmenuOpen.value) {
      isTeamSubmenuOpen.value = false
      return
    }
    close()
  }
  if (e.key === 'Tab') close()
}

onMounted(() => {
  document.addEventListener('mousedown', handlePointerDown)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handlePointerDown)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.visibility-menu-root {
  position: relative;
  display: inline-flex;
}

.visibility-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: 2px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--c-text-secondary);
  font-size: var(--font-sm);
  cursor: pointer;
  white-space: nowrap;
}

.visibility-toggle:hover {
  background: var(--c-surface-lower);
  color: var(--c-text);
}

.visibility-toggle:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

.visibility-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visibility-toggle--icon {
  padding: 0;
}

.visibility-layer {
  display: contents;
}

.visibility-panel {
  min-width: 180px;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  padding: var(--space-1) 0;
}

.visibility-panel--icon,
.visibility-panel--inline {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: var(--space-1);
  z-index: 100;
}

.visibility-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 36px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--c-text);
  font-size: var(--font-sm);
  text-align: left;
  cursor: pointer;
}

.visibility-item:hover {
  background: var(--c-surface-lower);
}

.visibility-item:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: -2px;
}

.visibility-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.visibility-item-label {
  flex: 1;
}

.visibility-item-caret {
  color: var(--c-text-tertiary);
}

.visibility-submenu {
  border-top: 1px solid var(--c-border);
  margin-top: var(--space-1);
  padding-top: var(--space-1);
}

.visibility-item--sub {
  padding-left: 36px;
}

.visibility-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 1000;
}

.visibility-panel--sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1001;
  min-width: 0;
  border-radius: 16px 16px 0 0;
  padding: var(--space-1) 0 calc(var(--space-2) + env(safe-area-inset-bottom, 0px));
  box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.2);
}

.visibility-panel--sheet .visibility-item {
  min-height: 48px;
  padding: 12px 16px;
}

.visibility-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 8px;
  border-bottom: 1px solid var(--c-border);
}

.visibility-sheet-title {
  font-size: var(--font-md);
  font-weight: 600;
}

.visibility-sheet-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--c-text-secondary);
  cursor: pointer;
}

.visibility-sheet-close:hover {
  background: var(--c-surface-lower);
  color: var(--c-text);
}

.visibility-sheet-close:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .visibility-toggle {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
