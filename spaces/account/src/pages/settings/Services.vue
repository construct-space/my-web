<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useSessionStore } from '@construct-space/infra-shell'
import {
  listServices,
  revokeService,
  enrollAsDeveloper,
  unenrollAsDeveloper,
  createOrganization,
  enableDelivery,
  disableDelivery,
  type ConnectedService,
} from '../../api'

const session = useSessionStore()

// ─── Connected services (existing behavior) ──────────────────────────────────
const services = ref<ConnectedService[]>([])
const loadingServices = ref(false)
const revoking  = ref<string | null>(null)
const error     = ref<string | null>(null)

// ─── Capability enablement state ─────────────────────────────────────────────
const enrollingDev = ref(false)
const devKey       = ref('')          // returned once on fresh enroll
const devError     = ref<string | null>(null)

const showOrgForm  = ref(false)
const orgName      = ref('')
const orgSlug      = ref('')
const creatingOrg  = ref(false)
const orgError     = ref<string | null>(null)

// Derived from the session scope so we reflect backend truth without an
// extra round-trip. After any mutation we refreshScope() and these flip.
const isDeveloper = computed(() => !!session.scope?.developer)
const isDelivery  = computed(() => !!session.scope?.delivery)
const isInOrg     = computed(() => session.scope?.scope === 'org')
const org         = computed(() => session.scope?.org || null)

// Delivery enrollment state — mirrors the Developer card: the plaintext
// cd_live_ key is shown once on first enablement, then never again.
const enablingDelivery  = ref(false)
const disablingDelivery = ref(false)
const deliveryKey       = ref('')
const deliveryError     = ref<string | null>(null)

const iconFor: Record<string, string> = {
  construct_app:      'lucide:laptop',
  construct_teams:    'lucide:users',
  construct_my:       'lucide:hexagon',
  construct_website:  'lucide:globe',
  construct_blog:     'lucide:book-open',
  construct_delivery: 'lucide:mail',
  spaces_portal:      'lucide:layout-grid',
}

async function load() {
  loadingServices.value = true
  error.value = null
  try {
    const data = await listServices()
    services.value = data.services || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loadingServices.value = false
  }
}

async function revoke(clientId: string) {
  if (!confirm('Revoke access for this app? It will be signed out and have to authorize again.')) return
  revoking.value = clientId
  try {
    await revokeService(clientId)
    services.value = services.value.filter((s) => s.client_id !== clientId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    revoking.value = null
  }
}

async function enableDeveloper() {
  devError.value = null
  enrollingDev.value = true
  try {
    const res = await enrollAsDeveloper()
    devKey.value = res.apiKey || res.api_key || ''
    await session.refreshScope()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/409/.test(msg) || /already/i.test(msg)) {
      await session.refreshScope()
    } else {
      devError.value = msg
    }
  } finally {
    enrollingDev.value = false
  }
}

const disablingDev = ref(false)

async function disableDeveloper() {
  devError.value = null
  // Destructive + reversible only by re-enrolling; surface the trade-off.
  const ok = confirm(
    'Disable personal developer status?\n\n' +
    "Your csk_live_ API key is revoked. Your spaces (if any) must already be deleted or transferred.\n\n" +
    'You can re-enable later, but you\'ll get a fresh API key.',
  )
  if (!ok) return
  disablingDev.value = true
  try {
    await unenrollAsDeveloper()
    devKey.value = ''
    await session.refreshScope()
  } catch (e) {
    devError.value = e instanceof Error ? e.message : String(e)
  } finally {
    disablingDev.value = false
  }
}

async function enableDeliveryAction() {
  deliveryError.value = null
  enablingDelivery.value = true
  try {
    const res = await enableDelivery()
    // api_key is only returned on the first enrollment (created === true).
    deliveryKey.value = res.api_key || ''
    await session.refreshScope()
  } catch (e) {
    deliveryError.value = e instanceof Error ? e.message : String(e)
  } finally {
    enablingDelivery.value = false
  }
}

async function disableDeliveryAction() {
  deliveryError.value = null
  const ok = confirm(
    'Disable email delivery?\n\n' +
    'All your cd_live_ API keys will be revoked. Any integrations using them will start getting 401.\n\n' +
    'You can re-enable later, but you\'ll receive a fresh API key.',
  )
  if (!ok) return
  disablingDelivery.value = true
  try {
    await disableDelivery()
    deliveryKey.value = ''
    await session.refreshScope()
  } catch (e) {
    deliveryError.value = e instanceof Error ? e.message : String(e)
  } finally {
    disablingDelivery.value = false
  }
}

function copyDeliveryKey() {
  if (!deliveryKey.value) return
  navigator.clipboard.writeText(deliveryKey.value).catch(() => {})
}

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
}

function onOrgNameInput() {
  // Auto-derive slug from name until the user has typed into slug themselves.
  if (!orgSlug.value || orgSlug.value === slugify(orgName.value.slice(0, -1))) {
    orgSlug.value = slugify(orgName.value)
  }
}

async function submitOrg() {
  orgError.value = null
  const name = orgName.value.trim()
  const slug = orgSlug.value.trim()
  if (!name || !slug) {
    orgError.value = 'Name and slug are both required.'
    return
  }
  creatingOrg.value = true
  try {
    await createOrganization({ name, slug })
    await session.refreshScope()
    showOrgForm.value = false
    orgName.value = ''
    orgSlug.value = ''
  } catch (e) {
    orgError.value = e instanceof Error ? e.message : String(e)
  } finally {
    creatingOrg.value = false
  }
}

function copyKey() {
  if (!devKey.value) return
  navigator.clipboard.writeText(devKey.value).catch(() => {})
}

function relTime(iso?: string | null): string {
  if (!iso) return 'never'
  const d = new Date(iso)
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 60) return 'moments ago'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  if (secs < 86400 * 30) return `${Math.floor(secs / 86400)}d ago`
  return d.toLocaleDateString()
}

onMounted(load)
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-8">
    <!-- ─── Capabilities ─────────────────────────────────────────────── -->
    <div class="flex flex-col gap-3">
      <div>
        <h1 class="text-xl font-semibold">Services</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Enable capabilities on your account and manage apps that have access.
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
              <span v-if="isDeveloper" class="text-[10px] uppercase tracking-wider text-green-500 border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 rounded">Enabled</span>
            </div>
            <p class="text-xs text-[var(--app-muted)] mt-1">
              Publish spaces under your personal name, push schemas, get an API key. Unlocks the Developer space in the sidebar.
              <template v-if="isInOrg">
                To enroll <span class="font-medium text-[var(--app-foreground)]">{{ org?.name }}</span> as a publisher instead, go to the Organization settings.
              </template>
            </p>
          </div>
          <div class="shrink-0 flex items-center gap-2">
            <template v-if="isDeveloper">
              <RouterLink to="/developer">
                <Button variant="outline" color="neutral" size="sm">Open</Button>
              </RouterLink>
              <Button
                variant="outline"
                color="danger"
                size="sm"
                icon="lucide:power-off"
                :loading="disablingDev"
                :disabled="disablingDev"
                @click="disableDeveloper"
              >{{ disablingDev ? 'Disabling…' : 'Disable' }}</Button>
            </template>
            <Button
              v-else
              size="sm"
              icon="lucide:sparkles"
              :loading="enrollingDev"
              :disabled="enrollingDev"
              @click="enableDeveloper"
            >{{ enrollingDev ? 'Enabling…' : 'Enable' }}</Button>
          </div>
        </div>

        <div v-if="devKey" class="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex flex-col gap-2">
          <div class="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Icon icon="lucide:key" class="size-3.5" />
            Your API key — shown once
          </div>
          <div class="flex items-center gap-2">
            <code class="flex-1 bg-[var(--app-surface)] border border-[var(--app-border)] px-3 py-2 rounded font-mono text-xs break-all">{{ devKey }}</code>
            <Button variant="outline" color="neutral" size="sm" @click="copyKey">Copy</Button>
          </div>
          <p class="text-xs text-[var(--app-muted)]">
            Save it now. You can always rotate it on Developer → API keys.
          </p>
        </div>
        <div v-if="devError" class="text-sm text-red-500 flex items-start gap-2">
          <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
          <span>{{ devError }}</span>
        </div>
      </div>

      <!-- Delivery -->
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
        <div class="flex items-start gap-4">
          <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)] shrink-0">
            <Icon icon="lucide:mail" class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold flex items-center gap-2">
              Delivery
              <span v-if="isDelivery" class="text-[10px] uppercase tracking-wider text-green-500 border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 rounded">Enabled</span>
            </div>
            <p class="text-xs text-[var(--app-muted)] mt-1">
              Send transactional email from your own domains with DKIM/SPF/DMARC. Unlocks the Delivery space in the sidebar and issues a <code class="font-mono">cd_live_</code> API key.
            </p>
          </div>
          <div class="shrink-0 flex items-center gap-2">
            <template v-if="isDelivery">
              <RouterLink to="/delivery">
                <Button variant="outline" color="neutral" size="sm">Open</Button>
              </RouterLink>
              <Button
                variant="outline"
                color="danger"
                size="sm"
                icon="lucide:power-off"
                :loading="disablingDelivery"
                :disabled="disablingDelivery"
                @click="disableDeliveryAction"
              >{{ disablingDelivery ? 'Disabling…' : 'Disable' }}</Button>
            </template>
            <Button
              v-else
              size="sm"
              icon="lucide:sparkles"
              :loading="enablingDelivery"
              :disabled="enablingDelivery"
              @click="enableDeliveryAction"
            >{{ enablingDelivery ? 'Enabling…' : 'Enable' }}</Button>
          </div>
        </div>

        <div v-if="deliveryKey" class="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 flex flex-col gap-2">
          <div class="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
            <Icon icon="lucide:key" class="size-3.5" />
            Your API key — shown once
          </div>
          <div class="flex items-center gap-2">
            <code class="flex-1 bg-[var(--app-surface)] border border-[var(--app-border)] px-3 py-2 rounded font-mono text-xs break-all">{{ deliveryKey }}</code>
            <Button variant="outline" color="neutral" size="sm" @click="copyDeliveryKey">Copy</Button>
          </div>
          <p class="text-xs text-[var(--app-muted)]">
            Save it now. You can manage keys later on Delivery → API keys.
          </p>
        </div>
        <div v-if="deliveryError" class="text-sm text-red-500 flex items-start gap-2">
          <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
          <span>{{ deliveryError }}</span>
        </div>
      </div>

      <!-- Organization -->
      <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-4">
        <div class="flex items-start gap-4">
          <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)] shrink-0">
            <Icon icon="lucide:building-2" class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold flex items-center gap-2">
              Organization
              <span v-if="isInOrg" class="text-[10px] uppercase tracking-wider text-green-500 border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 rounded">Active</span>
            </div>
            <p v-if="isInOrg && org" class="text-xs text-[var(--app-muted)] mt-1">
              You're in <span class="text-[var(--app-foreground)] font-medium">{{ org.name }}</span> (<code class="font-mono">@{{ org.slug }}</code>). Manage members + projects from the Organization space.
            </p>
            <p v-else class="text-xs text-[var(--app-muted)] mt-1">
              Create an organization to share spaces, projects, and billing across a team.
            </p>
          </div>
          <div class="shrink-0">
            <RouterLink v-if="isInOrg" to="/org">
              <Button variant="outline" color="neutral" size="sm">Open</Button>
            </RouterLink>
            <Button
              v-else-if="!showOrgForm"
              size="sm"
              icon="lucide:plus"
              @click="showOrgForm = true"
            >Create</Button>
          </div>
        </div>

        <!-- Create-org form (inline) -->
        <form
          v-if="!isInOrg && showOrgForm"
          class="flex flex-col gap-3 border-t border-[var(--app-border)] pt-4"
          @submit.prevent="submitOrg"
        >
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--app-muted)]">Organization name</label>
            <Input v-model="orgName" placeholder="Acme Inc." :disabled="creatingOrg" @input="onOrgNameInput" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-[var(--app-muted)]">Slug</label>
            <Input v-model="orgSlug" icon="lucide:at-sign" placeholder="acme" :disabled="creatingOrg" />
            <p class="text-xs text-[var(--app-muted)]">Used in URLs. Lowercase letters, numbers, dashes.</p>
          </div>
          <div v-if="orgError" class="text-sm text-red-500 flex items-start gap-2">
            <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
            <span>{{ orgError }}</span>
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <Button variant="outline" color="neutral" size="sm" :disabled="creatingOrg" @click="showOrgForm = false">Cancel</Button>
            <Button size="sm" :loading="creatingOrg" :disabled="creatingOrg || !orgName || !orgSlug">
              {{ creatingOrg ? 'Creating…' : 'Create organization' }}
            </Button>
          </div>
        </form>
      </div>
    </div>

    <!-- ─── Connected apps (existing) ────────────────────────────────── -->
    <div class="flex flex-col gap-3">
      <div>
        <h2 class="text-base font-semibold">Connected apps</h2>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Apps that have OAuth access to your account. Revoke any you no longer use.
        </p>
      </div>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>

      <div v-if="loadingServices && !services.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

      <div v-else-if="services.length" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]">
        <div
          v-for="s in services"
          :key="s.client_id"
          class="flex items-center gap-4 px-5 py-4"
        >
          <div class="size-10 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
            <Icon :icon="iconFor[s.client_id] || 'lucide:plug'" class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium">{{ s.name }}</div>
            <div v-if="s.description" class="text-xs text-[var(--app-muted)] mt-0.5 truncate">{{ s.description }}</div>
            <div class="text-xs text-[var(--app-muted)] mt-0.5">
              Granted {{ relTime(s.granted_at) }} · Last used {{ relTime(s.last_used_at) }}
            </div>
          </div>
          <Button
            variant="ghost"
            color="error"
            size="xs"
            :loading="revoking === s.client_id"
            :disabled="revoking === s.client_id"
            @click="revoke(s.client_id)"
          >{{ revoking === s.client_id ? 'Revoking…' : 'Revoke' }}</Button>
        </div>
      </div>

      <div v-else class="text-sm text-[var(--app-muted)]">
        No connected apps yet. OAuth apps (Construct Desktop, CLI) will appear here after you sign into them.
      </div>
    </div>
  </section>
</template>
