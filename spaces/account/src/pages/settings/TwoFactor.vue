<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import {
  getProfile,
  twoFactorSetup,
  twoFactorVerify,
  twoFactorDisable,
  type TwoFactorSetup as SetupPayload,
} from '../../api'

type Step = 'start' | 'qr'

const enabled    = ref(false)
const step       = ref<Step>('start')
const setup      = ref<SetupPayload | null>(null)
const code       = ref('')

const setupLoading   = ref(false)
const setupError     = ref<string | null>(null)
const verifyLoading  = ref(false)
const verifyError    = ref<string | null>(null)

const showDisable   = ref(false)
const disablePwd    = ref('')
const disableLoading = ref(false)
const disableError  = ref<string | null>(null)

const secretCopied = ref(false)

async function loadStatus() {
  try {
    const p = await getProfile()
    enabled.value = !!p.totp_enabled
  } catch { /* leave defaults */ }
}

async function startSetup() {
  setupError.value = null
  setupLoading.value = true
  try {
    setup.value = await twoFactorSetup()
    step.value = 'qr'
  } catch (e) {
    setupError.value = e instanceof Error ? e.message : String(e)
  } finally {
    setupLoading.value = false
  }
}

async function confirmSetup() {
  verifyError.value = null
  verifyLoading.value = true
  try {
    await twoFactorVerify(code.value.trim())
    enabled.value = true
    step.value = 'start'
    code.value = ''
    setup.value = null
  } catch (e) {
    verifyError.value = e instanceof Error ? e.message : String(e)
  } finally {
    verifyLoading.value = false
  }
}

async function disable() {
  disableError.value = null
  disableLoading.value = true
  try {
    await twoFactorDisable(disablePwd.value)
    enabled.value = false
    showDisable.value = false
    disablePwd.value = ''
  } catch (e) {
    disableError.value = e instanceof Error ? e.message : String(e)
  } finally {
    disableLoading.value = false
  }
}

async function copySecret() {
  if (!setup.value) return
  try {
    await navigator.clipboard.writeText(setup.value.secret)
    secretCopied.value = true
    setTimeout(() => (secretCopied.value = false), 1500)
  } catch { /* clipboard permission denied, ignore */ }
}

onMounted(loadStatus)
</script>

<template>
  <section class="max-w-xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Two-factor authentication</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Require a 6-digit code from your authenticator app on every sign-in.
      </p>
    </div>

    <!-- Enabled state -->
    <div v-if="enabled" class="rounded-xl border border-green-500/40 bg-[color-mix(in_srgb,#22c55e_4%,transparent)] p-5 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <div class="size-10 rounded-lg grid place-items-center bg-green-500/20 text-green-400">
          <Icon icon="lucide:shield-check" class="size-5" />
        </div>
        <div class="flex-1">
          <div class="text-sm font-medium">2FA is on</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">Every sign-in will ask for a code from your authenticator.</div>
        </div>
      </div>

      <div v-if="showDisable" class="flex flex-col gap-3 border-t border-[var(--app-border)] pt-4">
        <p class="text-sm text-[var(--app-muted)]">Confirm with your password to turn 2FA off.</p>
        <InputPassword v-model="disablePwd" placeholder="Password" autocomplete="current-password" :disabled="disableLoading" />
        <div v-if="disableError" class="text-sm text-red-500">{{ disableError }}</div>
        <div class="flex justify-end gap-2">
          <Button variant="outline" color="neutral" :disabled="disableLoading" @click="showDisable = false">Cancel</Button>
          <Button color="error" :loading="disableLoading" :disabled="disableLoading || !disablePwd" @click="disable">
            {{ disableLoading ? 'Disabling…' : 'Disable 2FA' }}
          </Button>
        </div>
      </div>
      <Button
        v-else
        variant="link"
        color="error"
        size="sm"
        class="self-start"
        @click="showDisable = true; disableError = null"
      >Disable two-factor authentication</Button>
    </div>

    <!-- Disabled: start setup -->
    <div v-else-if="step === 'start'" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6 flex flex-col gap-4">
      <p class="text-sm text-[var(--app-muted)]">
        Use an authenticator app like 1Password, Authy, or Google Authenticator. We'll show a QR code to scan.
      </p>
      <div v-if="setupError" class="text-sm text-red-500">{{ setupError }}</div>
      <div>
        <Button :loading="setupLoading" :disabled="setupLoading" @click="startSetup">
          {{ setupLoading ? 'Preparing…' : 'Set up 2FA' }}
        </Button>
      </div>
    </div>

    <!-- Disabled: QR + verify -->
    <div v-else-if="step === 'qr' && setup" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6 flex flex-col gap-5">
      <div>
        <h2 class="text-base font-medium">Scan the QR code</h2>
        <p class="text-sm text-[var(--app-muted)] mt-1">Open your authenticator app, scan the code, then enter the 6-digit code it shows.</p>
      </div>

      <div class="self-center rounded-lg overflow-hidden">
        <img :src="setup.qr_code" alt="2FA QR code" class="size-52 bg-white p-2 rounded-lg" />
      </div>

      <!-- Manual entry key -->
      <div class="flex items-center gap-2 text-xs text-[var(--app-muted)]">
        <span class="shrink-0">Can't scan?</span>
        <code class="flex-1 bg-[var(--app-surface)] px-3 py-1.5 rounded font-mono text-[var(--app-foreground)] truncate">{{ setup.secret }}</code>
        <Button variant="outline" color="neutral" size="xs" @click="copySecret">
          {{ secretCopied ? 'Copied!' : 'Copy' }}
        </Button>
      </div>

      <form class="flex flex-col gap-3" @submit.prevent="confirmSetup">
        <Input
          v-model="code"
          inputmode="numeric"
          pattern="[0-9]{6}"
          maxlength="6"
          autocomplete="one-time-code"
          placeholder="123456"
          :disabled="verifyLoading"
        />
        <div v-if="verifyError" class="text-sm text-red-500">{{ verifyError }}</div>
        <div class="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            color="neutral"
            :disabled="verifyLoading"
            @click="step = 'start'; code = ''; setup = null"
          >Cancel</Button>
          <Button type="submit" :loading="verifyLoading" :disabled="verifyLoading || code.length !== 6">
            {{ verifyLoading ? 'Verifying…' : 'Verify & enable' }}
          </Button>
        </div>
      </form>
    </div>
  </section>
</template>
