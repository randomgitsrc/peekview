<template>
  <div v-if="authState === 'authenticated'" class="settings-page" data-testid="settings-page">
    <header class="settings-header">
      <router-link to="/" class="settings-logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none"><rect x="2" y="2" width="28" height="28" rx="8" fill="var(--c-accent)"/><path d="M12 23.5V9.5h5.4a4.6 4.6 0 0 1 0 9.2H12" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="settings-logo-word">PeekView</span>
      </router-link>
      <div class="settings-actions">
        <ThemeToggle />
      </div>
    </header>

    <div class="settings-body">
      <nav class="tab-nav desktop-only">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :data-testid="`tab-${tab.key}`"
          :class="['tab-btn', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="tab-content desktop-only">
        <ProfileTab v-if="activeTab === 'profile'" />
        <SecurityTab v-else-if="activeTab === 'security'" />
        <ApiKeySettingsTab v-else-if="activeTab === 'apikeys'" />
      </div>

      <div class="mobile-stacked mobile-only">
        <section class="mobile-section">
          <h2 class="mobile-section-title">Profile</h2>
          <ProfileTab />
        </section>
        <section class="mobile-section">
          <h2 class="mobile-section-title">Security</h2>
          <SecurityTab />
        </section>
        <section class="mobile-section">
          <h2 class="mobile-section-title">API Keys</h2>
          <ApiKeySettingsTab />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ThemeToggle from '@/components/ThemeToggle.vue'
import ProfileTab from '@/components/settings/ProfileTab.vue'
import SecurityTab from '@/components/settings/SecurityTab.vue'
import ApiKeySettingsTab from '@/components/settings/ApiKeySettingsTab.vue'

const authStore = useAuthStore()
const authState = toRef(authStore, 'authState')
const route = useRoute()
const router = useRouter()

const tabs = [
  { key: 'profile' as const, label: 'Profile' },
  { key: 'security' as const, label: 'Security' },
  { key: 'apikeys' as const, label: 'API Keys' },
]

const validTabs = ['profile', 'security', 'apikeys'] as const
type TabName = typeof validTabs[number]

const activeTab = computed<TabName>({
  get: () => {
    const tab = route.query.tab as string
    return validTabs.includes(tab as TabName) ? (tab as TabName) : 'profile'
  },
  set: (tab: TabName) => {
    router.replace({ query: { tab } })
  },
})
</script>

<style scoped>
.settings-page { min-height: 100vh; background: var(--c-bg); display: flex; flex-direction: column; }

.settings-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--c-surface);
  border-bottom: 1px solid var(--c-border);
  padding: 0 var(--space-5);
  height: var(--header-height);
  flex-shrink: 0;
}

.settings-logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  flex-shrink: 0;
}

.settings-logo-word {
  font-size: 20px;
  font-weight: 700;
  color: var(--c-text);
  letter-spacing: -0.02em;
}

.settings-logo:hover .settings-logo-word { color: var(--c-accent); }

.settings-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.settings-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  padding: var(--space-4);
}

.tab-nav {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--c-border);
  margin-bottom: var(--space-4);
}

.tab-btn {
  padding: var(--space-2) var(--space-4);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--c-text-secondary);
  font-size: var(--font-md);
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover { color: var(--c-text); }
.tab-btn.active { color: var(--c-accent); border-bottom-color: var(--c-accent); }

.tab-content { flex: 1; }

.mobile-section {
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--c-border);
}

.mobile-section:last-child { border-bottom: none; }

.mobile-section-title {
  font-size: var(--font-lg);
  font-weight: 600;
  color: var(--c-text);
  margin: 0 0 var(--space-3);
}

.desktop-only { display: block; }
.mobile-only { display: none; }

@media (max-width: 640px) {
  .desktop-only { display: none; }
  .mobile-only { display: block; }
}
</style>
