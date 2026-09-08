<script setup lang="ts">
/**
 * Services — capabilities the org can enable. Today: Developer (enroll
 * the org as a publisher). Future: integrations, SSO providers, webhooks.
 *
 * Distinct from Account → Services, which enables personal capabilities.
 * An org can be a publisher even if the caller's personal account is not,
 * and vice versa — two independent publisher rows keyed by user_id vs org_id.
 */
import { ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import { enrollOrgAsDeveloper, unenrollOrgAsDeveloper } from '../api'

const session = useSessionStore()

const org           = computed(() => session.scope?.org || null)
const isOrgOwner    = computed(() => (session.scope?.roles || []).includes('owner'))
const isOrgDev      = computed(() => !!session.scope?.org?.developer)

const enrolling = ref(false)
const disabling = ref(false)
const devKey    = ref('')
const error     = ref<string | null>(null)

async function enable() {
  error.value = null
  enrolling.value = true
  try {
    const res = await enrollOrgAsDeveloper()
    devKey.value = res.apiKey || res.api_key || ''
    await session.refreshScope()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/409/.test(msg) || /already/i.test(msg)) {
      await session.refreshScope()
    } else {
      error.value = msg
    }
  } finally {
    enrolling.value = false
  }
}

async function disable() {
  error.value = null
  const ok = confirm(
    `Disable developer status for ${org.value?.name || 'this organization'}?\n\n` +
    "The org's API key is revoked, and the Developer role is removed from your role catalog (members who had it revert to Member).\n\n" +
    "Any org-owned spaces must already be deleted or transferred.",
  )
  if (!ok) return
  disabling.value = true
  try {
    await unenrollOrgAsDeveloper()
    devKey.value = ''
    await session.refreshScope()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    disabling.value = false
  }
}

function copyKey() {
  if (!devKey.value) return
  navigator.clipboard.writeText(devKey.value).catch(() => {})
}
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Services</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Capabilities <span v-if="org" class="font-medium text-[var(--app-foreground)]">{{ org.name }}</span> can enable.
      </p>
    </div>

    <!-- Developer -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
      <div class="flex items-start gap-4">
        <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)] shrink-0">
          <Icon icon="lucide:code" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold flex items-center gap-2">
            Developer
            <span v-if="isOrgDev" class="text-[10px] uppercase tracking-wider text-green-500 border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 rounded">Enabled</span>
          </div>
          <p class="text-xs text-[var(--app-muted)] mt-1">
            Enroll the org as a publisher. Spaces published under it are owned
            by the org, and the Developer role is added to your role catalog
            so admins can grant it to members.
          </p>
        </div>
        <div class="shrink-0 flex items-center gap-2">
          <template v-if="isOrgDev">
            <RouterLink to="/developer">
              <Button variant="outline" color="neutral" size="sm">Open</Button>
            </RouterLink>
            <Button
              v-if="isOrgOwner"
              variant="outline"
              color="danger"
              size="sm"
              icon="lucide:power-off"
              :loading="disabling"
              :disabled="disabling"
              @click="disable"
            >{{ disabling ? 'Disabling…' : 'Disable' }}</Button>
          </template>
          <Button
            v-else-if="isOrgOwner"
            size="sm"
            icon="lucide:sparkles"
            :loading="enrolling"
            :disabled="enrolling"
            @click="enable"
          >{{ enrolling ? 'Enabling…' : 'Enable' }}</Button>
          <span v-else class="text-xs text-[var(--app-muted)]">Owner-only</span>
        </div>
      </div>

      <div v-if="devKey" class="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex flex-col gap-2">
        <div class="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <Icon icon="lucide:key" class="size-3.5" />
          Org API key — shown once
        </div>
        <div class="flex items-center gap-2">
          <code class="flex-1 bg-[var(--app-surface)] border border-[var(--app-border)] px-3 py-2 rounded font-mono text-xs break-all">{{ devKey }}</code>
          <Button variant="outline" color="neutral" size="sm" @click="copyKey">Copy</Button>
        </div>
        <p class="text-xs text-[var(--app-muted)]">
          Save it now. Rotate later on Developer → API keys.
        </p>
      </div>

      <div v-if="error" class="text-sm text-red-500 flex items-start gap-2">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>
    </div>
  </section>
</template>
