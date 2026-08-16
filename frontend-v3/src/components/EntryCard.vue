<template>
  <div class="entry-card" :class="{ 'entry-card--own': isOwner, 'entry-card--archived': entry.status === 'archived' }">
    <div v-if="isOwner" class="card-actions" @click.stop.prevent>
      <button
        type="button"
        class="card-action-btn"
        :title="entry.isPublic ? 'Make private' : 'Make public'"
        @click="$emit('toggleVisibility', entry)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path v-if="entry.isPublic" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle v-if="entry.isPublic" cx="12" cy="12" r="3"/><path v-if="!entry.isPublic" d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line v-if="!entry.isPublic" x1="1" y1="1" x2="23" y2="23"/></svg>
      </button>
      <button
        type="button"
        class="card-action-btn card-action-btn--danger"
        title="Delete"
        @click="$emit('delete', entry)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
    </div>
    <div class="card-body">
      <a class="card-title" :href="'/' + entry.slug" @click.prevent="navigateToEntry">
        {{ entry.summary || entry.slug }}
      </a>
      <div class="card-meta-text">
        <a
          v-if="entry.username"
          class="meta-username"
          :href="'/users/' + entry.username"
          @click.prevent="navigateToUser"
        >@{{ entry.username }}</a>
        <span v-if="entry.username" class="meta-dot"></span>
        <span class="meta-time" :title="fullTime">{{ relativeTime }}</span>
        <template v-if="entry.fileCount">
          <span class="meta-dot"></span>
          <span>{{ entry.fileCount }} file{{ entry.fileCount !== 1 ? 's' : '' }}</span>
        </template>
      </div>
      <div v-if="entry.tags.length" class="card-tags">
        <BaseTag
          v-for="tag in visibleTags"
          :key="tag"
          :href="'/explore?tags=' + encodeURIComponent(tag)"
          @navigate="navigateToTag"
        >{{ tag }}</BaseTag>
        <button
          v-if="remainingTagCount > 0"
          type="button"
          class="tag-overflow"
          tabindex="0"
          :data-tags="entry.tags.join(', ')"
          :aria-label="'All tags: ' + entry.tags.join(', ')"
        >+{{ remainingTagCount }}</button>
      </div>
      <div v-if="isOwner || isExpiredButActive" class="card-footer">
        <template v-if="isExempt">
          <div class="star-exempt-block">
            <span class="star-exempt-label" data-testid="star-exempt-label">
              因被 {{ entry.starCount }} 位用户星标，已暂停自动删除
              <button
                type="button"
                class="star-exempt-help"
                data-testid="star-exempt-help"
                aria-label="星标豁免说明"
                @click.stop="showExemptHelp = !showExemptHelp"
              ><HelpCircle :size="12" /></button>
            </span>
            <p v-if="showExemptHelp" class="star-exempt-help-text">被星标的内容不会被自动删除，仅作者可强制删除。</p>
            <div class="star-exempt-actions">
              <button
                type="button"
                class="force-delete"
                data-testid="force-delete"
                @click.stop="showForceConfirm = true"
              >立即删除（强制）</button>
              <div v-if="showForceConfirm" class="force-delete-confirm" data-testid="force-delete-confirm" role="alertdialog" aria-labelledby="force-delete-confirm-desc">
                <p id="force-delete-confirm-desc" class="force-delete-confirm-text">此内容已被 {{ entry.starCount }} 位用户星标，确认删除后这些收藏将变为"作者已删除"。</p>
                <div class="force-delete-confirm-actions">
                  <button
                    type="button"
                    class="confirm__btn confirm__btn--destructive"
                    data-testid="confirm-force-delete"
                    @click.stop="confirmForceDelete"
                  >确认删除</button>
                  <button
                    type="button"
                    class="confirm__btn confirm__btn--cancel"
                    @click.stop="showForceConfirm = false"
                  >取消</button>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-else>
          <BaseBadge v-if="isExpiredButActive" status="expired" />
          <BaseBadge v-else-if="entry.status === 'archived'" status="archived" />
          <BaseBadge v-else :status="entry.isPublic ? 'public' : 'private'" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useRouter } from 'vue-router'
import { HelpCircle } from 'lucide-vue-next'
import type { Entry } from '@/types'
import BaseTag from '@/components/BaseTag.vue'
import BaseBadge from '@/components/BaseBadge.vue'
import { useRelativeTime } from '@/composables/useRelativeTime'
import { isExpired } from '@/utils/expires'

const props = withDefaults(defineProps<{
  entry: Entry
  isOwner?: boolean
  currentUsername?: string | null
}>(), {
  isOwner: false,
  currentUsername: null,
})

const emit = defineEmits<{
  toggleVisibility: [entry: Entry]
  delete: [entry: Entry]
}>()

const router = useRouter()

function navigateToEntry() {
  const firstFileId = props.entry.files?.[0]?.id
  if (firstFileId) {
    router.push({ path: `/${props.entry.slug}`, query: { firstFileId: String(firstFileId) } })
  } else {
    router.push(`/${props.entry.slug}`)
  }
}

function navigateToUser() {
  if (props.entry.username) {
    router.push(`/users/${props.entry.username}`)
  }
}

function navigateToTag(href: string) {
  router.push(href)
}

const TAG_LIMIT = 3

const visibleTags = computed(() => props.entry.tags.slice(0, TAG_LIMIT))

const remainingTagCount = computed(() => Math.max(0, props.entry.tags.length - TAG_LIMIT))

const createdAtRef = toRef(() => props.entry.createdAt)
const { relative: relativeTime, full: fullTime } = useRelativeTime(createdAtRef)

const isExpiredButActive = computed(() => isExpired(props.entry))

const showExemptHelp = ref(false)
const showForceConfirm = ref(false)

const isExempt = computed(() =>
  props.isOwner && props.entry.status === 'archived' && (props.entry.starCount ?? 0) > 0
)

function confirmForceDelete(): void {
  showForceConfirm.value = false
  emit('delete', props.entry)
}
</script>

<style scoped>
.entry-card {
  position: relative;
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 14px;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  display: flex;
  flex-direction: column;
}

.entry-card:hover {
  border-color: var(--c-accent);
  box-shadow: var(--shadow-md);
}

.card-actions {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: flex;
  gap: var(--space-1);
  z-index: 1;
}

@media (hover: hover) {
  .card-actions {
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  .entry-card:hover .card-actions {
    opacity: 1;
  }
}

.card-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-tertiary);
  cursor: pointer;
  padding: 0;
  transition: all var(--transition-fast);
}

.card-action-btn:hover {
  background: var(--c-surface-lower);
  border-color: var(--c-border-strong);
  color: var(--c-text);
}

.card-action-btn--danger:hover {
  background: var(--c-error-surface);
  border-color: var(--c-error);
  color: var(--c-error);
}

.card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: var(--space-4);
}

.card-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--c-text);
  margin: 0 0 var(--space-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-decoration: none;
}

.card-title:hover {
  text-decoration: underline;
}

.card-title:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.card-desc {
  font-size: var(--font-sm);
  color: var(--c-text-secondary);
  margin: 0 0 var(--space-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta-text {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--c-text-tertiary);
  font-family: var(--font-mono);
  margin-bottom: var(--space-2);
}

.meta-username {
  color: var(--c-accent);
  text-decoration: none;
}

.meta-username:hover {
  text-decoration: underline;
}

.meta-username:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.meta-time {
  cursor: default;
}

.card-tags {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.tag-overflow {
  position: relative;
  display: inline-flex;
  align-items: center;
  background: var(--c-tag-bg);
  color: var(--c-text-tertiary);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: var(--font-xs);
  font-family: var(--font-mono);
  border: none;
  cursor: default;
}

.tag-overflow::after {
  content: attr(data-tags);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-xs);
  white-space: nowrap;
  box-shadow: var(--shadow-md);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.tag-overflow:hover::after,
.tag-overflow:focus::after {
  opacity: 1;
}

.tag-overflow:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.card-footer {
  display: flex;
  align-items: center;
  margin-top: auto;
}

.star-exempt-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.star-exempt-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-xs);
  color: var(--c-success);
  font-weight: 500;
  flex-wrap: wrap;
}

.star-exempt-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: var(--c-surface-lower);
  color: var(--c-text-secondary);
  border-radius: 50%;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.star-exempt-help:hover {
  background: var(--c-border);
  color: var(--c-text);
}

.star-exempt-help:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.star-exempt-help-text {
  margin: 0;
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
  line-height: 1.5;
}

.star-exempt-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.force-delete {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-error);
  font-size: var(--font-xs);
  font-weight: 500;
  cursor: pointer;
}

.force-delete:hover {
  background: var(--c-error-surface);
  border-color: var(--c-error);
}

.force-delete:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.force-delete-confirm {
  border: 1px solid var(--c-border-strong);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  background: var(--c-surface-lower);
}

.force-delete-confirm-text {
  margin: 0 0 var(--space-2);
  font-size: var(--font-xs);
  color: var(--c-text-secondary);
  line-height: 1.5;
}

.force-delete-confirm-actions {
  display: flex;
  gap: var(--space-2);
}

.confirm__btn {
  padding: 4px 12px;
  border-radius: var(--radius-md);
  font-size: var(--font-xs);
  cursor: pointer;
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text);
}

.confirm__btn--destructive {
  background: var(--c-error);
  color: var(--text-on-accent);
  border-color: var(--c-error);
}

.confirm__btn--cancel:hover {
  background: var(--c-surface-lower);
}

.confirm__btn:focus-visible {
  outline: 2px solid var(--c-accent-secondary);
  outline-offset: 2px;
}

.entry-card--archived {
  opacity: 0.6;
}

.entry-card--archived:hover {
  opacity: 0.8;
}
</style>
