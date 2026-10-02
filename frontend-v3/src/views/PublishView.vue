<template>
  <div v-if="authState === 'authenticated'" class="publish-page" data-testid="publish-view">
    <header class="publish-header">
      <router-link to="/" class="publish-logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="var(--text-on-accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="publish-logo-word">PeekView</span>
      </router-link>
      <div class="publish-header-actions">
        <UserMenu @logout="handleLogout" />
        <ThemeToggle />
      </div>
    </header>

    <div class="publish-content">
      <h1 class="publish-title">发布内容</h1>

      <div role="status" aria-live="polite" class="sr-only">{{ liveMessage }}</div>

      <PublishResultPanel
        v-if="phase === 'done' && result"
        ref="resultPanelRef"
        :result="result"
        @view-detail="viewDetail"
        @publish-again="publishAgain"
      />

      <form
        v-else
        class="publish-form"
        :aria-busy="phase === 'submitting' ? 'true' : 'false'"
        @submit.prevent="handleSubmit"
      >
        <div
          v-if="globalError"
          ref="errorSummaryRef"
          class="error-summary"
          data-testid="publish-error-summary"
          role="alert"
          tabindex="-1"
        >{{ globalError }}</div>

        <div class="form-field">
          <label class="field-label" for="publish-summary-input">Summary</label>
          <textarea
            id="publish-summary-input"
            v-model="summary"
            class="summary-input"
            data-testid="publish-summary-input"
            :maxlength="limits?.maxSummaryLength ?? 500"
            :disabled="disabled"
            :aria-describedby="summaryError ? 'publish-summary-error' : 'publish-summary-count'"
            :aria-invalid="summaryError ? 'true' : 'false'"
            placeholder="简要描述本次发布的内容"
          ></textarea>
          <span id="publish-summary-count" class="field-hint" data-testid="publish-summary-count">
            {{ summary.length }}/{{ limits?.maxSummaryLength ?? 500 }}
          </span>
          <p v-if="summaryError" id="publish-summary-error" class="field-error" data-testid="publish-summary-error" role="alert">{{ summaryError }}</p>
        </div>

        <div class="form-field">
          <span class="field-label">文件</span>
          <FileDropZone
            :disabled="disabled"
            :max-files="limits?.maxEntryFiles ?? 50"
            @files-added="addFiles"
            @reject="onReject"
          />
          <PublishFileList
            :drafts="drafts"
            :file-errors="fileErrors"
            :disabled="disabled"
            @update-path="updatePath"
            @remove="removeFile"
          />
        </div>

        <div class="form-field">
          <label class="field-label" for="publish-slug-input">Slug（可选）</label>
          <input
            id="publish-slug-input"
            v-model="slug"
            type="text"
            class="text-input"
            data-testid="publish-slug-input"
            :disabled="disabled"
            :aria-describedby="slug ? 'publish-slug-hint' : undefined"
            :aria-invalid="slugError ? 'true' : 'false'"
            placeholder="留空则由系统生成"
          />
          <span v-if="slug" id="publish-slug-hint" class="field-hint" data-testid="publish-slug-hint">
            自定义 slug 若与已有记录相同，将覆盖该记录（原内容被替换）
          </span>
          <p v-if="slugError" id="publish-slug-error" class="field-error" data-testid="publish-slug-error" role="alert">{{ slugError }}</p>
        </div>

        <div class="form-field">
          <label class="field-label" for="publish-tags-input">Tags</label>
          <input
            id="publish-tags-input"
            v-model="tagInput"
            type="text"
            class="text-input"
            data-testid="publish-tags-input"
            :disabled="disabled"
            aria-describedby="publish-tags-hint"
            placeholder="输入后按 Enter 添加"
            @keydown.enter.prevent="addTag"
          />
          <span id="publish-tags-hint" class="field-hint" data-testid="publish-tags-hint">输入后按 Enter 添加</span>
          <div v-if="tags.length" class="tag-list">
            <button
              v-for="tag in tags"
              :key="tag"
              type="button"
              class="tag-chip"
              :disabled="disabled"
              @click="removeTag(tag)"
            >{{ tag }} ×</button>
          </div>
        </div>

        <div class="form-field">
          <label class="visibility-row" for="publish-visibility-toggle">
            <input
              id="publish-visibility-toggle"
              v-model="isPublic"
              type="checkbox"
              data-testid="publish-visibility-toggle"
              :disabled="disabled"
            />
            <span>公开</span>
          </label>
          <span id="publish-visibility-text" class="field-hint" data-testid="publish-visibility-text">{{ visibilityText }}</span>
        </div>

        <div class="form-field">
          <label class="field-label" for="publish-expires-select">过期时间</label>
          <select
            id="publish-expires-select"
            v-model="expiresIn"
            class="text-input"
            data-testid="publish-expires-select"
            :disabled="disabled"
          >
            <option value="1d">1 天</option>
            <option value="7d">7 天</option>
            <option value="15d">15 天</option>
            <option value="30d">30 天</option>
            <option value="0">永久</option>
          </select>
        </div>

        <div v-if="teams.length" class="form-field">
          <label class="field-label" for="publish-team-select">团队（可选）</label>
          <select
            id="publish-team-select"
            v-model="teamId"
            class="text-input"
            data-testid="publish-team-select"
            :disabled="disabled"
          >
            <option :value="null">不归属团队</option>
            <option v-for="team in teams" :key="team.slug" :value="team.slug">{{ team.name }}</option>
          </select>
          <span v-if="teamId" class="field-hint">选择团队后将变为团队可见</span>
        </div>

        <BaseButton
          variant="primary"
          class="submit-button"
          data-testid="publish-submit"
          type="submit"
          :disabled="disabled"
        >{{ phase === 'submitting' ? '发布中…' : '发布' }}</BaseButton>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { api, extractApiErrorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import { readFileAsEncoded } from '@/composables/useFileEncoding'
import { buildEntryPayload, computePayloadFingerprint, validatePublishForm } from '@/composables/usePublishValidation'
import UserMenu from '@/components/UserMenu.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import FileDropZone from '@/components/FileDropZone.vue'
import PublishFileList from '@/components/PublishFileList.vue'
import PublishResultPanel from '@/components/PublishResultPanel.vue'
import BaseButton from '@/components/BaseButton.vue'
import type { PublishFileDraft, PublishLimits, PublishResult, Team } from '@/types'

const FALLBACK_LIMITS: PublishLimits = {
  defaultExpiresIn: '15d',
  maxFileSize: 20 * 1024 * 1024,
  maxEntryFiles: 50,
  maxEntrySize: 100 * 1024 * 1024,
  maxSlugLength: 64,
  maxSummaryLength: 500,
}

const authStore = useAuthStore()
const { authState } = storeToRefs(authStore)
const router = useRouter()
const toast = useToast()

const summary = ref('')
const slug = ref('')
const tags = ref<string[]>([])
const isPublic = ref(true)
const expiresIn = ref('15d')
const teamId = ref<string | null>(null)
const drafts = ref<PublishFileDraft[]>([])
const fileErrors = ref<Record<string, string>>({})
const summaryError = ref('')
const slugError = ref('')
const globalError = ref('')
const liveMessage = ref('')
const phase = ref<'form' | 'submitting' | 'done'>('form')
const result = ref<PublishResult | null>(null)
const limits = ref<PublishLimits | null>(null)
const teams = ref<Team[]>([])

const tagInput = ref('')
const idempotencyKey = ref<string | null>(null)
const errorSummaryRef = ref<HTMLElement | null>(null)
const resultPanelRef = ref<InstanceType<typeof PublishResultPanel> | null>(null)

const disabled = computed(() => phase.value === 'submitting')

const visibilityText = computed(() =>
  isPublic.value ? '公开：所有人可见' : '私有：仅自己与团队成员可见'
)

function currentInput() {
  return {
    summary: summary.value,
    slug: slug.value,
    tags: tags.value,
    isPublic: isPublic.value,
    expiresIn: expiresIn.value,
    teamId: teamId.value,
    files: drafts.value,
  }
}

const payloadFingerprint = computed(() => computePayloadFingerprint(currentInput(), limits.value))

watch(payloadFingerprint, () => {
  idempotencyKey.value = null
})

function addTag(): void {
  const value = tagInput.value.trim()
  if (!value) return
  if (!tags.value.includes(value)) tags.value.push(value)
  tagInput.value = ''
}

function removeTag(tag: string): void {
  tags.value = tags.value.filter(t => t !== tag)
}

async function addFiles(files: File[]): Promise<void> {
  for (const file of files) {
    const encoded = await readFileAsEncoded(file)
    drafts.value.push({
      fileId: crypto.randomUUID(),
      file,
      filename: file.name,
      size: file.size,
      isBinary: encoded.isBinary,
      path: file.name,
      encoded: encoded.contentBase64 ?? encoded.content ?? '',
    })
  }
}

function onReject(reason: string): void {
  toast.error(reason)
}

function updatePath(fileId: string, path: string): void {
  const draft = drafts.value.find(d => d.fileId === fileId)
  if (draft) draft.path = path
}

function removeFile(fileId: string): void {
  drafts.value = drafts.value.filter(d => d.fileId !== fileId)
  delete fileErrors.value[fileId]
}

function applyValidation(): boolean {
  const validation = validatePublishForm(currentInput(), limits.value ?? FALLBACK_LIMITS)
  summaryError.value = validation.summaryError
  slugError.value = validation.slugError
  globalError.value = validation.globalError
  fileErrors.value = validation.fileErrors
  return validation.ok
}

async function focusErrorSummary(): Promise<void> {
  await nextTick()
  errorSummaryRef.value?.focus()
}

async function handleSubmit(): Promise<void> {
  if (phase.value === 'submitting') return
  const ok = applyValidation()
  if (!ok) {
    globalError.value = globalError.value || '请检查表单中的错误后重试'
    await focusErrorSummary()
    return
  }
  phase.value = 'submitting'
  liveMessage.value = '正在发布…'
  if (!idempotencyKey.value) idempotencyKey.value = crypto.randomUUID()

  try {
    const payload = buildEntryPayload(currentInput(), limits.value, idempotencyKey.value)
    const published = await api.createEntry(payload)
    result.value = published
    phase.value = 'done'
    liveMessage.value = '发布成功'
    await nextTick()
    const title = resultPanelRef.value?.$el?.querySelector?.('.result-title') as HTMLElement | undefined
    title?.focus()
  } catch (err) {
    globalError.value = extractApiErrorMessage(err)
    phase.value = 'form'
    liveMessage.value = ''
    await focusErrorSummary()
  }
}

function viewDetail(): void {
  if (result.value) router.push('/' + result.value.slug)
}

async function publishAgain(): Promise<void> {
  summary.value = ''
  slug.value = ''
  tags.value = []
  tagInput.value = ''
  isPublic.value = true
  expiresIn.value = limits.value?.defaultExpiresIn ?? '15d'
  teamId.value = null
  drafts.value = []
  fileErrors.value = {}
  summaryError.value = ''
  slugError.value = ''
  globalError.value = ''
  liveMessage.value = ''
  idempotencyKey.value = null
  result.value = null
  phase.value = 'form'
  await nextTick()
  document.getElementById('publish-summary-input')?.focus()
}

function handleLogout(): void {
  router.push('/')
}

onMounted(async () => {
  try {
    limits.value = await api.getLimits()
    expiresIn.value = limits.value.defaultExpiresIn
  } catch {
    limits.value = null
  }
  try {
    const teamList = await api.listTeams()
    teams.value = [...teamList.owned, ...teamList.joined]
  } catch {
    teams.value = []
  }
})
</script>

<style scoped>
.publish-page {
  min-height: 100vh;
  background: var(--c-bg);
  display: flex;
  flex-direction: column;
}

.publish-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  padding: 0 var(--space-5);
  height: var(--header-height);
  flex-shrink: 0;
}

.publish-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  flex-shrink: 0;
}

.publish-logo-word {
  font-size: 20px;
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.02em;
}

.publish-logo:hover .publish-logo-word { color: var(--c-accent); }

.publish-header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.publish-content {
  flex: 1;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-4);
}

.publish-title {
  margin: 0 0 var(--space-4);
  font-size: var(--font-xl);
  color: var(--c-text);
}

.publish-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.error-summary {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--c-badge-private-bg);
  border: 1px solid var(--c-error);
  color: var(--c-error);
  font-size: var(--font-sm);
  overflow-wrap: break-word;
}

.error-summary:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-label {
  font-size: 13px;
  color: var(--c-text-secondary);
}

.text-input,
.summary-input {
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface-lower);
  color: var(--c-text);
  font-family: inherit;
  font-size: 14px;
}

.summary-input {
  min-height: 88px;
  resize: vertical;
}

.text-input:focus,
.summary-input:focus {
  outline: 2px solid var(--c-accent);
  outline-offset: -1px;
}

.text-input[aria-invalid='true'] {
  border-color: var(--c-error);
}

.field-hint {
  font-size: var(--font-xs);
  color: var(--c-text-tertiary);
}

.field-error {
  margin: 0;
  font-size: var(--font-xs);
  color: var(--c-error);
}

.visibility-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
  color: var(--c-text);
  cursor: pointer;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.tag-chip {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--c-border-strong);
  background: transparent;
  color: var(--c-text-secondary);
  font-family: var(--font-mono);
  font-size: var(--font-xs);
  cursor: pointer;
}

.submit-button {
  align-self: flex-start;
  min-height: 44px;
}

@media (max-width: 640px) {
  .submit-button {
    align-self: stretch;
    width: 100%;
  }
}
</style>
