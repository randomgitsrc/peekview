<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="visible" class="pwd-overlay" @click.self="cancel">
        <div
          class="pwd-dialog"
          role="alertdialog"
          aria-labelledby="pwd-title"
          aria-describedby="pwd-desc"
          @keydown.escape="cancel"
        >
          <h3 id="pwd-title" class="pwd__title">重置密码</h3>
          <p id="pwd-desc" class="pwd__desc">为用户 {{ username }} 设置新密码</p>

          <div class="pwd__field">
            <label for="pwd-input">新密码</label>
            <div class="pwd__input-row">
              <input
                id="pwd-input"
                ref="pwdInputRef"
                :type="showPwd ? 'text' : 'password'"
                v-model="password"
                :aria-invalid="error ? 'true' : undefined"
                :aria-describedby="error ? 'pwd-error' : undefined"
                autocomplete="new-password"
                @keyup.enter="confirm"
              />
              <button
                type="button"
                class="pwd__toggle"
                @click="showPwd = !showPwd"
                :aria-label="showPwd ? '隐藏密码' : '显示密码'"
              >{{ showPwd ? '🙈' : '👁' }}</button>
            </div>
            <p v-if="error" id="pwd-error" class="pwd__error">{{ error }}</p>
          </div>

          <div class="pwd__actions">
            <button class="pwd__btn pwd__btn--cancel" @click="cancel">取消</button>
            <button
              class="pwd__btn pwd__btn--confirm"
              :disabled="password.length < 8"
              @click="confirm"
            >确认</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'

defineProps<{
  username: string
}>()

const emit = defineEmits<{
  confirm: [newPassword: string]
  cancel: []
}>()

const visible = defineModel<boolean>('visible', { default: false })
const password = ref('')
const showPwd = ref(false)
const pwdInputRef = ref<HTMLInputElement | null>(null)

const error = computed(() => {
  if (password.value.length > 0 && password.value.length < 8) {
    return '密码至少 8 个字符'
  }
  return null
})

watch(visible, async (v) => {
  if (v) {
    password.value = ''
    showPwd.value = false
    await nextTick()
    pwdInputRef.value?.focus()
  }
})

function confirm() {
  if (password.value.length < 8) return
  visible.value = false
  emit('confirm', password.value)
}

function cancel() {
  visible.value = false
  emit('cancel')
}
</script>

<style scoped>
.pwd-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwd-dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.pwd__title {
  margin: 0 0 12px;
  font-size: 18px;
  color: var(--text-primary);
}

.pwd__desc {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--text-secondary);
}

.pwd__field {
  margin-bottom: 20px;
}

.pwd__field label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: var(--text-secondary);
}

.pwd__input-row {
  display: flex;
  gap: 8px;
}

.pwd__input-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.pwd__input-row input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.pwd__toggle {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-primary);
  cursor: pointer;
  font-size: 16px;
}

.pwd__error {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--error-text);
}

.pwd__actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.pwd__btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.pwd__btn--cancel:hover {
  background: var(--bg-tertiary);
}

.pwd__btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.pwd__btn--confirm {
  background: var(--accent-color);
  color: var(--text-on-accent);
  border-color: var(--accent-color);
}

.pwd__btn--confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dialog-enter-active { transition: opacity 0.2s ease; }
.dialog-leave-active { transition: opacity 0.2s ease; }
.dialog-enter-from { opacity: 0; }
.dialog-leave-to { opacity: 0; }
</style>
