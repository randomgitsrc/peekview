<template>
  <div class="admin-view">
    <div class="admin-header">
      <h1>用户管理</h1>
    </div>

    <div v-if="loading" class="loading-state" role="status" aria-live="polite">
      加载中...
    </div>

    <div v-else-if="error" class="error-state">
      <span>{{ error }}</span>
      <button @click="fetchUsers">重试</button>
    </div>

    <EmptyState
      v-else-if="users.length === 0"
      icon="Database"
      heading="暂无用户"
    />

    <template v-else>
      <div class="user-list" data-testid="admin-user-list">
        <div
          v-for="user in users"
          :key="user.id"
          class="user-row"
          data-testid="admin-user-row"
        >
          <div class="user-info">
            <span class="user-name">{{ user.username }}</span>
            <div class="user-badges">
              <BaseBadge v-if="user.isAdmin" status="admin" data-testid="user-badge" />
              <BaseBadge v-if="!user.isActive" status="disabled" data-testid="user-badge" />
              <span v-if="!user.isActive && user.disabledAt" class="disabled-time">{{ formatDisabledAt(user.disabledAt) }}</span>
            </div>
          </div>
          <OverflowMenu
            :variant="isMobile ? 'sheet' : 'dropdown'"
            :items="getMenuItems(user)"
            :disabled="!!pendingOp"
            @action="(item) => handleMenuAction(item, user)"
          />
        </div>
      </div>

      <Pagination
        v-if="totalPages > 1"
        v-model:page="currentPage"
        :per-page="perPage"
        :total="total"
        data-testid="pagination"
      />
    </template>

    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-label="confirmLabel"
      variant="destructive"
      @confirm="handleConfirm"
    />

    <PasswordResetDialog
      v-model:visible="pwdDialogVisible"
      :username="pwdDialogUsername"
      @confirm="handlePwdConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { api } from '@/api/client'
import { useToast } from '@/composables/useToast'
import { useResponsiveLayout } from '@/composables/useResponsiveLayout'
import type { User } from '@/types'
import BaseBadge from '@/components/BaseBadge.vue'
import OverflowMenu, { type OverflowMenuItem } from '@/components/OverflowMenu.vue'
import Pagination from '@/components/Pagination.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import PasswordResetDialog from '@/components/PasswordResetDialog.vue'
import EmptyState from '@/components/EmptyState.vue'

const { error: toastError, success: toastSuccess } = useToast()
const { isMobile } = useResponsiveLayout()

const users = ref<User[]>([])
const currentPage = ref(1)
const perPage = ref(20)
const total = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
const pendingOp = ref<string | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / perPage.value)))

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmLabel = ref('')
const confirmAction = ref<string | null>(null)
const confirmUser = ref<User | null>(null)

const pwdDialogVisible = ref(false)
const pwdDialogUsername = ref('')
const pwdDialogUserId = ref<number | null>(null)

watch(currentPage, () => fetchUsers())

async function fetchUsers() {
  loading.value = true
  error.value = null
  try {
    const resp = await api.listUsers({ page: currentPage.value, perPage: perPage.value })
    users.value = resp.items
    total.value = resp.total
  } catch (e: any) {
    error.value = e.response?.data?.error?.message ?? '加载失败'
  } finally {
    loading.value = false
  }
}

function getMenuItems(user: User): OverflowMenuItem[] {
  const items: OverflowMenuItem[] = []

  if (user.isActive) {
    items.push({ label: '禁用', action: () => openDisableConfirm(user) })
  } else {
    items.push({ label: '启用', action: () => doEnable(user) })
  }

  if (user.isAdmin) {
    items.push({ label: '降级', action: () => doDemote(user) })
  } else {
    items.push({ label: '升级管理员', action: () => doPromote(user) })
  }

  items.push({ label: '重置密码', action: () => openPwdDialog(user) })
  items.push({ label: '删除', variant: 'danger', action: () => openDeleteConfirm(user) })

  return items
}

function handleMenuAction(item: OverflowMenuItem, _user: User) {
  item.action?.()
}

function formatDisabledAt(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小时前`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay} 天前`
  return d.toLocaleDateString()
}

function openDisableConfirm(user: User) {
  confirmUser.value = user
  confirmAction.value = 'disable'
  confirmTitle.value = `禁用用户 ${user.username}？`
  confirmMessage.value = '该用户将被禁用，无法登录。已签发的 JWT 即时失效。可随时重新启用。'
  confirmLabel.value = '禁用'
  confirmVisible.value = true
}

function openDeleteConfirm(user: User) {
  confirmUser.value = user
  confirmAction.value = 'delete'
  confirmTitle.value = `删除用户 ${user.username}？`
  confirmMessage.value = '此操作不可撤销，将删除该用户及其所有 entries、files、API keys。'
  confirmLabel.value = '删除'
  confirmVisible.value = true
}

function openPwdDialog(user: User) {
  pwdDialogUserId.value = user.id
  pwdDialogUsername.value = user.username
  pwdDialogVisible.value = true
}

async function handleConfirm() {
  if (!confirmUser.value || !confirmAction.value) return
  const user = confirmUser.value
  const action = confirmAction.value
  confirmUser.value = null
  confirmAction.value = null

  if (action === 'disable') {
    await doDisable(user)
  } else if (action === 'delete') {
    await doDelete(user)
  }
}

async function doDisable(user: User) {
  pendingOp.value = 'disable'
  try {
    await api.disableUser(user.id)
    toastSuccess(`已禁用 ${user.username}`)
    await fetchUsers()
  } catch (e: any) {
    toastError(e.response?.data?.error?.message ?? '操作失败')
  } finally {
    pendingOp.value = null
  }
}

async function doEnable(user: User) {
  pendingOp.value = 'enable'
  try {
    await api.enableUser(user.id)
    toastSuccess(`已启用 ${user.username}`)
    await fetchUsers()
  } catch (e: any) {
    toastError(e.response?.data?.error?.message ?? '操作失败')
  } finally {
    pendingOp.value = null
  }
}

async function doPromote(user: User) {
  pendingOp.value = 'promote'
  try {
    await api.promoteUser(user.id)
    toastSuccess(`已升级 ${user.username} 为管理员`)
    await fetchUsers()
  } catch (e: any) {
    toastError(e.response?.data?.error?.message ?? '操作失败')
  } finally {
    pendingOp.value = null
  }
}

async function doDemote(user: User) {
  pendingOp.value = 'demote'
  try {
    await api.demoteUser(user.id)
    toastSuccess(`已降级 ${user.username}`)
    await fetchUsers()
  } catch (e: any) {
    toastError(e.response?.data?.error?.message ?? '操作失败')
  } finally {
    pendingOp.value = null
  }
}

async function doDelete(user: User) {
  pendingOp.value = 'delete'
  try {
    await api.deleteUser(user.id)
    toastSuccess(`已删除 ${user.username}`)
    if (users.value.length === 1 && currentPage.value > 1) {
      currentPage.value = Math.max(1, totalPages.value - 1)
    } else {
      await fetchUsers()
    }
  } catch (e: any) {
    toastError(e.response?.data?.error?.message ?? '操作失败')
  } finally {
    pendingOp.value = null
  }
}

async function handlePwdConfirm(newPassword: string) {
  if (pwdDialogUserId.value === null) return
  const id = pwdDialogUserId.value
  pwdDialogUserId.value = null
  try {
    await api.resetUserPassword(id, newPassword)
    toastSuccess('密码已重置')
  } catch (e: any) {
    toastError(e.response?.data?.error?.message ?? '密码重置失败')
  }
}

fetchUsers()
</script>

<style scoped>
.admin-view {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-6);
}

.admin-header {
  margin-bottom: var(--space-6);
}

.admin-header h1 {
  font-size: 24px;
  color: var(--text-primary);
}

.loading-state {
  text-align: center;
  padding: var(--space-7);
  color: var(--text-secondary);
}

.error-state {
  text-align: center;
  padding: var(--space-7);
  color: var(--error-text);
}

.error-state button {
  margin-left: var(--space-2);
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.error-state button:hover {
  background: var(--bg-tertiary);
}

.error-state button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.user-name {
  font-size: var(--font-sm);
  color: var(--text-primary);
}

.user-badges {
  display: flex;
  gap: 4px;
  align-items: center;
}

.disabled-time {
  font-size: var(--font-xs);
  color: var(--text-tertiary);
}

@media (max-width: 640px) {
  .admin-view {
    padding: var(--space-3);
  }

  .user-row {
    flex-direction: row;
    align-items: center;
  }
}
</style>
