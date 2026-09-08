<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import {
  listPasskeys,
  passkeyRegisterBegin,
  passkeyRegisterFinish,
  deletePasskey,
  type Passkey,
} from '../../api'

const passkeys = ref<Passkey[]>([])
const loading   = ref(false)
const adding    = ref(false)
const deleting  = ref<string | null>(null)
const error     = ref<string | null>(null)
const success   = ref<string | null>(null)
const supported = ref(true)

function base64urlToBuffer(b64url: string): ArrayBuffer {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4)
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return buf
}
function bufferToBase64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let str = ''
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i])
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const data = await listPasskeys()
    passkeys.value = data.passkeys || []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function add() {
  if (!window.PublicKeyCredential) {
    supported.value = false
    error.value = 'Passkeys are not supported in this browser.'
    return
  }
  error.value = null
  success.value = null
  adding.value = true
  try {
    // Begin — server returns PublicKeyCredentialCreationOptions with
    // base64url-encoded challenge + user.id + excludeCredentials[].id
    // that we rehydrate into ArrayBuffers for the WebAuthn API.
    const opts = await passkeyRegisterBegin() as { publicKey: any }
    const pk = opts.publicKey
    const createOptions: CredentialCreationOptions = {
      publicKey: {
        ...pk,
        challenge: base64urlToBuffer(pk.challenge),
        user: { ...pk.user, id: base64urlToBuffer(pk.user.id) },
        excludeCredentials: (pk.excludeCredentials || []).map((c: any) => ({
          ...c,
          id: base64urlToBuffer(c.id),
        })),
      },
    }
    const credential = (await navigator.credentials.create(createOptions)) as PublicKeyCredential | null
    if (!credential) throw new Error('Passkey prompt was cancelled.')

    const response = credential.response as AuthenticatorAttestationResponse
    const result = await passkeyRegisterFinish({
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        attestationObject: bufferToBase64url(response.attestationObject),
        clientDataJSON:    bufferToBase64url(response.clientDataJSON),
      },
    })
    if (result?.passkey) {
      passkeys.value = [result.passkey, ...passkeys.value]
    } else {
      await load()
    }
    success.value = 'Passkey added.'
  } catch (e) {
    // Cancel is treated as the user backing out — not an error.
    const msg = e instanceof Error ? e.message : String(e)
    if (/cancel/i.test(msg) || /abort/i.test(msg)) {
      error.value = null
    } else {
      error.value = msg
    }
  } finally {
    adding.value = false
    setTimeout(() => (success.value = null), 2500)
  }
}

async function remove(id: string) {
  if (!confirm('Delete this passkey? You can add it again later if you still have the device.')) return
  deleting.value = id
  error.value = null
  try {
    await deletePasskey(id)
    passkeys.value = passkeys.value.filter((p) => p.id !== id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    deleting.value = null
  }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

onMounted(() => {
  supported.value = !!window.PublicKeyCredential
  load()
})
</script>

<template>
  <section class="max-w-2xl flex flex-col gap-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold">Passkeys</h1>
        <p class="text-sm text-[var(--app-muted)] mt-1">
          Sign in without a password using your device's biometric or security key.
        </p>
      </div>
      <Button :loading="adding" :disabled="adding || !supported" @click="add">
        <Icon icon="lucide:plus" class="size-4" />
        {{ adding ? 'Waiting…' : 'Add passkey' }}
      </Button>
    </div>

    <div v-if="!supported" class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-4 flex items-start gap-3 text-sm">
      <Icon icon="lucide:info" class="size-4 mt-0.5 shrink-0 text-[var(--app-muted)]" />
      <span>Passkeys aren't supported in this browser. Try Safari, Chrome, Edge, or Firefox.</span>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>
    <div v-if="success" class="flex items-start gap-2 text-sm text-green-500">
      <Icon icon="lucide:check-circle-2" class="size-4 mt-0.5 shrink-0" />
      <span>{{ success }}</span>
    </div>

    <div v-if="loading && !passkeys.length" class="text-sm text-[var(--app-muted)]">Loading…</div>

    <div
      v-else-if="passkeys.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] divide-y divide-[var(--app-border)]"
    >
      <div
        v-for="pk in passkeys"
        :key="pk.id"
        class="flex items-center gap-4 px-5 py-4"
      >
        <div class="size-10 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]">
          <Icon icon="lucide:key-round" class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium">{{ pk.name || 'Passkey' }}</div>
          <div class="text-xs text-[var(--app-muted)] mt-0.5">
            Added {{ fmtDate(pk.created_at) }}
            <span v-if="pk.last_used_at"> · last used {{ fmtDate(pk.last_used_at) }}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          color="error"
          size="sm"
          :icon="deleting === pk.id ? 'lucide:loader-circle' : 'lucide:trash-2'"
          :loading="deleting === pk.id"
          :disabled="deleting === pk.id"
          :title="`Delete ${pk.name || 'passkey'}`"
          :aria-label="`Delete ${pk.name || 'passkey'}`"
          @click="remove(pk.id)"
        />
      </div>
    </div>

    <div v-else-if="!loading" class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:key-round" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">No passkeys yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Adding a passkey registers your fingerprint, face, or hardware key so you can sign in instantly on this device.
      </p>
    </div>
  </section>
</template>
