<template>
  <div class="user-menu-wrapper">
    <button class="user-menu-trigger" @click="toggleUserMenu">
      <span class="user-avatar">{{ userInitial }}</span>
      <span class="user-name">{{ userName }}</span>
      <span v-if="isAdmin" class="admin-badge">admin</span>
    </button>
    <Transition name="dropdown">
      <div v-if="showUserMenu" class="user-dropdown">
        <button class="dropdown-item" data-testid="user-menu-teams-item" @click="navigateToTeams">Teams</button>
        <button class="dropdown-item" data-testid="user-menu-settings-item" @click="navigateToSettings">Settings</button>
        <button class="dropdown-item" @click="handleLogout">Logout</button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const emit = defineEmits<{
  logout: []
}>()

const authStore = useAuthStore()
const { user, isAdmin } = storeToRefs(authStore)
const router = useRouter()

const showUserMenu = ref(false)

const userInitial = computed(() => {
  const name = user.value?.displayName || user.value?.username || ''
  return name.charAt(0).toUpperCase()
})

const userName = computed(() => {
  return user.value?.displayName || user.value?.username || ''
})

function toggleUserMenu() {
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.user-menu-wrapper')) {
    showUserMenu.value = false
  }
}

function navigateToSettings() {
  showUserMenu.value = false
  router.push(isAdmin.value ? '/settings?tab=user-manager' : '/settings?tab=apikeys')
}

function navigateToTeams() {
  showUserMenu.value = false
  router.push('/teams')
}

function handleLogout() {
  showUserMenu.value = false
  authStore.logout()
  emit('logout')
}

onMounted(() => document.addEventListener('click', closeUserMenu))
onUnmounted(() => document.removeEventListener('click', closeUserMenu))
</script>

<style scoped>
.user-menu-wrapper {
  position: relative;
  display: inline-flex;
}

.user-menu-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border-strong);
  background: transparent;
  color: var(--c-text);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.user-menu-trigger:hover {
  background: var(--c-surface-lower);
}

.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--c-accent);
  color: var(--text-on-accent);
  font-size: var(--font-xs);
  font-weight: 600;
}

.user-name {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--c-accent);
  color: var(--text-on-accent);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  min-width: max(140px, 100%);
  box-shadow: var(--shadow-md);
  z-index: 100;
}

.dropdown-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: none;
  color: var(--c-text-secondary);
  cursor: pointer;
  font-size: var(--font-sm);
  text-align: left;
  border-radius: var(--radius-sm);
}

.dropdown-item:hover {
  background: var(--c-surface-lower);
  color: var(--c-text);
}

.dropdown-enter-active {
  transition: opacity 0.15s ease;
}

.dropdown-leave-active {
  transition: opacity 0.15s ease;
}

.dropdown-enter-from {
  opacity: 0;
}

.dropdown-leave-to {
  opacity: 0;
}
</style>
