<template>
  <div class="teams-page" data-testid="teams-page">
    <header class="teams-header">
      <router-link to="/" class="teams-logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="var(--text-on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="teams-logo-word">PeekView</span>
      </router-link>
      <div class="teams-actions">
        <ThemeToggle />
      </div>
    </header>

    <div class="teams-body">
      <div class="teams-head">
        <h1 class="teams-title">团队管理</h1>
        <router-link class="teams-explore-link" data-testid="teams-explore-link" to="/explore?view=teams">返回团队内容</router-link>
      </div>

      <div class="teams-live" role="status" data-testid="teams-status-live" aria-live="polite">{{ liveMessage }}</div>

      <section class="teams-owned" data-testid="teams-owned">
        <h2 class="section-title">我拥有的</h2>

        <form class="team-create-form" data-testid="team-create-form" @submit.prevent="handleCreate">
          <label class="field-label" for="team-name-input">新建团队</label>
          <div class="create-row">
            <input
              id="team-name-input"
              v-model="newTeamName"
              type="text"
              class="text-input"
              data-testid="team-name-input"
              placeholder="团队名称"
              aria-describedby="team-name-error"
            />
            <button type="submit" class="primary-btn" data-testid="team-create-submit">创建</button>
          </div>
          <p v-if="createError" id="team-name-error" class="field-error" data-testid="team-error" role="alert">{{ createError }}</p>
        </form>

        <div v-if="teamsLoading" class="section-loading" role="status">加载中…</div>

        <ul v-else-if="owned.length === 0" class="section-empty">暂无拥有的团队</ul>

        <div v-else class="team-cards">
          <article v-for="team in owned" :key="team.slug" class="team-card" :data-slug="team.slug">
            <div class="team-card-head">
              <div class="team-card-title">
                <span class="team-name">{{ team.name }}</span>
                <span class="team-slug">#{{ team.slug }}</span>
                <span class="team-member-count">{{ team.memberCount }} 成员</span>
              </div>
              <button
                v-if="!isRenaming(team.slug)"
                type="button"
                class="link-btn"
                data-testid="team-rename-toggle"
                @click="startRename(team)"
              >重命名</button>
            </div>

            <form v-if="isRenaming(team.slug)" class="rename-form" data-testid="team-rename-form" @submit.prevent="handleRename(team)">
              <input
                v-model="renameName"
                type="text"
                class="text-input"
                :data-testid="`team-rename-input-${team.slug}`"
                placeholder="新名称"
              />
              <button type="submit" class="primary-btn small">保存</button>
              <button type="button" class="ghost-btn small" @click="cancelRename">取消</button>
              <p v-if="renameError" class="field-error" data-testid="team-error" role="alert">{{ renameError }}</p>
            </form>

            <div class="team-card-detail">
              <h3 class="detail-title">成员（{{ team.memberCount }}）</h3>
              <div v-if="memberLoadingSlug === team.slug" class="detail-loading">加载中…</div>
              <template v-else>
                <ul v-if="teamMembers[team.slug]?.length" class="member-list">
                  <li v-for="m in teamMembers[team.slug]" :key="m.id" class="member-item">
                    <span class="member-name">
                      @{{ m.username }}
                      <span v-if="m.username === ownerUsername" class="member-owner-tag">owner</span>
                    </span>
                    <button
                      v-if="m.username !== ownerUsername"
                      type="button"
                      class="link-btn danger"
                      :data-testid="`team-member-remove-${m.username}`"
                      @click="removeMember(team.slug, m.id)"
                    >移除</button>
                  </li>
                </ul>
                <p v-else class="detail-empty">暂无成员…</p>

                <form class="member-add-form" @submit.prevent="handleAddMember(team.slug)">
                  <input
                    v-model="memberUsernames[team.slug]"
                    type="text"
                    class="text-input"
                    data-testid="team-member-username-input"
                    placeholder="用户名添加成员"
                    :aria-describedby="`member-error-${team.slug}`"
                  />
                  <button type="submit" class="primary-btn small">添加</button>
                </form>
                <p v-if="memberErrors[team.slug]" :id="`member-error-${team.slug}`" class="field-error" data-testid="team-error" role="alert">{{ memberErrors[team.slug] }}</p>
              </template>
            </div>

            <button
              type="button"
              class="danger-btn"
              data-testid="team-delete"
              @click="requestDelete(team)"
            >删除团队</button>
          </article>
        </div>
      </section>

      <section class="teams-joined" data-testid="teams-joined">
        <h2 class="section-title">我加入的</h2>
        <div v-if="teamsLoading" class="section-loading" role="status">加载中…</div>
        <ul v-else-if="joined.length === 0" class="section-empty">暂无加入的团队</ul>
        <ul v-else class="joined-list">
          <li v-for="team in joined" :key="team.slug" class="joined-item">
            <span class="team-name">{{ team.name }}</span>
            <span class="team-slug">#{{ team.slug }}</span>
            <span class="team-member-count">{{ team.memberCount }} 成员</span>
            <button
              type="button"
              class="link-btn danger"
              :data-testid="`team-leave-${team.slug}`"
              @click="requestLeave(team)"
            >退出团队</button>
          </li>
        </ul>
      </section>
    </div>

    <ConfirmDialog
      v-model:visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-label="确认"
      variant="destructive"
      @confirm="handleConfirm"
      @cancel="closeConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useTeamStore } from '@/stores/team'
import { useToast } from '@/composables/useToast'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Team } from '@/types'

const teamStore = useTeamStore()
const toast = useToast()
const { owned, joined, loading: teamsLoading } = storeToRefs(teamStore)
const { loadMyTeams, createTeam, renameTeam, deleteTeam, addMember, removeMember: removeMemberAction, leaveTeam, fetchDetail, syncDetail } = teamStore

const liveMessage = ref('')
const newTeamName = ref('')
const createError = ref('')
const memberUsernames = ref<Record<string, string>>({})
const memberErrors = ref<Record<string, string>>({})
const renameName = ref('')
const renameError = ref('')
const renamingSlug = ref<string | null>(null)

const ownerUsername = ref('')
const teamMembers = ref<Record<string, Array<{ id: number; username: string }>>>({})
const memberLoadingSlug = ref<string | null>(null)

const confirmVisible = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const pendingAction = ref<(() => Promise<void>) | null>(null)

function speak(message: string): void {
  liveMessage.value = message
}

function serverError(err: unknown): string {
  const anyErr = err as { response?: { data?: { detail?: string; error?: { message?: string } } }; message?: string }
  return (
    anyErr?.response?.data?.detail
    ?? anyErr?.response?.data?.error?.message
    ?? anyErr?.message
    ?? '操作失败'
  )
}

async function handleCreate(): Promise<void> {
  createError.value = ''
  const name = newTeamName.value.trim()
  if (!name) {
    createError.value = '请输入团队名称'
    return
  }
  if (name.length > 64) {
    createError.value = '团队名称过长（最多 64 字符）'
    return
  }
  try {
    const detail = await createTeam(name)
    syncDetail(detail)
    speak(`已创建团队 ${detail.name}`)
    toast.success(`已创建团队 ${detail.name}`)
    newTeamName.value = ''
  } catch (err) {
    createError.value = serverError(err)
    speak(`创建团队失败：${createError.value}`)
  }
}

function isRenaming(slug: string): boolean {
  return renamingSlug.value === slug
}

function startRename(team: Team): void {
  renamingSlug.value = team.slug
  renameName.value = team.name
  renameError.value = ''
}

function cancelRename(): void {
  renamingSlug.value = null
  renameError.value = ''
}

async function handleRename(team: Team): Promise<void> {
  renameError.value = ''
  const name = renameName.value.trim()
  if (!name) {
    renameError.value = '请输入团队名称'
    return
  }
  try {
    const detail = await renameTeam(team.slug, name)
    syncDetail(detail)
    speak(`已重命名团队为 ${detail.name}`)
    renamingSlug.value = null
  } catch (err) {
    renameError.value = serverError(err)
  }
}

function requestDelete(team: Team): void {
  confirmTitle.value = `删除团队「${team.name}」`
  confirmMessage.value = `该团队的所有内容将转为仅自己可见。确认删除？`
  pendingAction.value = async () => {
    try {
      await deleteTeam(team.slug)
      speak(`已删除团队 ${team.name}`)
      toast.success('团队已删除')
    } catch (err) {
      speak(`删除失败：${serverError(err)}`)
    }
  }
  confirmVisible.value = true
}

function requestLeave(team: Team): void {
  confirmTitle.value = `退出团队「${team.name}」`
  confirmMessage.value = `退出后将无法查看该团队的团队内内容。确认退出？`
  pendingAction.value = async () => {
    try {
      await leaveTeam(team.slug)
      speak(`已退出团队 ${team.name}`)
      toast.success('已退出团队')
    } catch (err) {
      speak(`退出失败：${serverError(err)}`)
    }
  }
  confirmVisible.value = true
}

async function handleConfirm(): Promise<void> {
  const action = pendingAction.value
  pendingAction.value = null
  confirmVisible.value = false
  if (action) await action()
}

function closeConfirm(): void {
  pendingAction.value = null
}

async function handleAddMember(slug: string): Promise<void> {
  memberErrors.value[slug] = ''
  const username = (memberUsernames.value[slug] ?? '').trim()
  if (!username) {
    memberErrors.value[slug] = '请输入用户名'
    return
  }
  try {
    const detail = await addMember(slug, username)
    if (slug === detail.slug) teamMembers.value[slug] = detail.members
    speak(`已添加成员 ${username}`)
    memberUsernames.value[slug] = ''
  } catch (err) {
    memberErrors.value[slug] = serverError(err)
    speak(`添加成员失败：${memberErrors.value[slug]}`)
  }
}

async function removeMember(slug: string, userId: number): Promise<void> {
  memberErrors.value[slug] = ''
  try {
    const detail = await removeMemberAction(slug, userId)
    if (slug === detail.slug) teamMembers.value[slug] = detail.members
    speak('已移除成员')
  } catch (err) {
    memberErrors.value[slug] = serverError(err)
  }
}

async function openDetail(team: Team): Promise<void> {
  memberLoadingSlug.value = team.slug
  memberErrors.value[team.slug] = ''
  teamMembers.value[team.slug] = []
  try {
    const detail = await fetchDetail(team.slug)
    if (team.slug === detail.slug) {
      teamMembers.value[team.slug] = detail.members
      ownerUsername.value = detail.ownerUsername
    }
  } catch {
    // 无权/不存在 → 忽略，卡保留
  } finally {
    memberLoadingSlug.value = null
  }
}

onMounted(() => {
  void loadMyTeams()
})

watch(owned, (teams) => {
  if (teams && teams.length > 0 && !teamMembers.value[teams[0].slug]) {
    void openDetail(teams[0])
  }
})
</script>

<style scoped>
.teams-page { min-height: 100vh; background: var(--c-bg); display: flex; flex-direction: column; }
.teams-header { display: flex; align-items: center; gap: var(--space-3); background: var(--c-surface); border-bottom: 1px solid var(--c-border); padding: 0 var(--space-5); height: var(--header-height); flex-shrink: 0; }
.teams-logo { display: inline-flex; align-items: center; gap: var(--space-2); text-decoration: none; flex-shrink: 0; }
.teams-logo-word { font-size: 20px; font-weight: 700; color: var(--c-text); letter-spacing: -0.02em; }
.teams-actions { margin-left: auto; display: flex; align-items: center; gap: var(--space-2); }
.teams-body { padding: var(--space-5); max-width: 900px; margin: 0 auto; width: 100%; flex: 1; }
.teams-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
.teams-title { font-size: var(--font-xl); font-weight: 700; color: var(--c-text); margin: 0; }
.teams-explore-link { color: var(--c-accent); text-decoration: none; font-size: var(--font-sm); font-weight: 500; }
.teams-live { min-height: 1.5em; font-size: var(--font-sm); color: var(--c-text-secondary); margin-bottom: var(--space-3); }
.section-title { font-size: var(--font-md); font-weight: 600; color: var(--c-text); margin: var(--space-6) 0 var(--space-3); }
.field-label { display: block; font-size: var(--font-sm); font-weight: 500; color: var(--c-text-secondary); margin-bottom: var(--space-2); }
.team-create-form { margin-bottom: var(--space-5); }
.create-row, .member-add-form, .rename-form { display: flex; gap: var(--space-2); align-items: center; flex-wrap: wrap; }
.text-input { flex: 1 1 200px; min-height: 44px; padding: 0 var(--space-3); border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: var(--c-surface); color: var(--c-text); font-size: var(--font-sm); }
.primary-btn { min-height: 44px; padding: 0 var(--space-4); border: none; border-radius: var(--radius-md); background: var(--c-accent); color: var(--text-on-accent); font-size: var(--font-sm); font-weight: 600; cursor: pointer; }
.primary-btn.small { min-height: 36px; padding: 0 var(--space-3); }
.ghost-btn { min-height: 36px; padding: 0 var(--space-3); border: 1px solid var(--c-border-strong); border-radius: var(--radius-md); background: transparent; color: var(--c-text-secondary); cursor: pointer; font-size: var(--font-sm); }
.ghost-btn.small { min-height: 36px; }
.link-btn { border: none; background: none; color: var(--c-accent); font-size: var(--font-sm); cursor: pointer; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); }
.link-btn.danger { color: var(--c-error); }
.danger-btn { min-height: 36px; padding: 0 var(--space-3); border: 1px solid var(--c-error); border-radius: var(--radius-md); background: transparent; color: var(--c-error); font-size: var(--font-sm); font-weight: 500; cursor: pointer; }
.field-error { color: var(--c-error); font-size: var(--font-sm); margin: var(--space-2) 0 0; }
.team-cards { display: flex; flex-direction: column; gap: var(--space-4); }
.team-card { background: var(--c-surface); border: 1px solid var(--c-border-strong); border-radius: var(--radius-lg); padding: var(--space-4); box-shadow: var(--shadow-sm); transition: border-color var(--transition-fast), box-shadow var(--transition-fast); }
.team-card:hover { border-color: var(--c-accent); box-shadow: var(--shadow-md); }
.team-card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
.team-card-detail { margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--c-border); }
.team-card-title { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; min-width: 0; }
.team-name { font-size: var(--font-md); font-weight: 600; color: var(--c-text); }
.team-slug { font-family: var(--font-mono); font-size: var(--font-xs); color: var(--c-text-tertiary); }
.team-member-count { font-size: var(--font-xs); color: var(--c-text-secondary); }
.detail-title { font-size: var(--font-sm); font-weight: 600; color: var(--c-text-secondary); margin: var(--space-3) 0 var(--space-2); }
.member-list { list-style: none; margin: 0 0 var(--space-2); padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
.member-item { display: flex; align-items: center; justify-content: space-between; padding: var(--space-1) var(--space-2); border-radius: var(--radius-sm); }
.member-name { font-family: var(--font-mono); font-size: var(--font-sm); color: var(--c-text); }
.member-owner-tag { font-size: 10px; padding: 1px 5px; border-radius: 3px; background: var(--c-accent-surface); color: var(--c-accent); margin-left: var(--space-1); }
.detail-empty, .section-empty, .section-loading, .detail-loading { font-size: var(--font-sm); color: var(--c-text-tertiary); padding: var(--space-2) 0; }
.joined-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.joined-item { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--radius-md); padding: var(--space-3); }

@media (max-width: 768px) {
  .teams-body { padding: var(--space-3); }
  .teams-head { flex-direction: column; align-items: flex-start; }
}
</style>
