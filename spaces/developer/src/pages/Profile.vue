<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { getPublisher, updatePublisher, type Publisher } from '../api'

const publisher = ref<Publisher | null>(null)
const name        = ref('')
const slug        = ref('')
const description = ref('')
const website     = ref('')

const loading = ref(false)
const saving  = ref(false)
const error   = ref<string | null>(null)
const success = ref(false)

const dirty = computed(() => {
  if (!publisher.value) return false
  return name.value !== publisher.value.name
      || slug.value !== publisher.value.slug
      || description.value !== (publisher.value.description || '')
      || website.value !== (publisher.value.website || '')
})

async function load() {
  loading.value = true
  error.value = null
  try {
    const { publisher: p } = await getPublisher()
    publisher.value = p
    if (p) {
      name.value        = p.name
      slug.value        = p.slug
      description.value = p.description || ''
      website.value     = p.website || ''
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function save() {
  error.value = null
  success.value = false
  saving.value = true
  try {
    const { publisher: p } = await updatePublisher({
      name: name.value.trim(),
      slug: slug.value.trim(),
      description: description.value.trim(),
      website: website.value.trim(),
    })
    publisher.value = p
    success.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="max-w-2xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">Publisher profile</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Shown on the marketplace next to every space you publish.
      </p>
    </div>

    <div v-if="!loading && !publisher" class="rounded-xl border border-dashed border-[var(--app-border)] p-8 text-center">
      <div class="size-12 rounded-lg mx-auto grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
        <Icon icon="lucide:user-round" class="size-6" />
      </div>
      <div class="text-sm font-medium mt-3">Not enrolled as a publisher yet</div>
      <p class="text-xs text-[var(--app-muted)] mt-1 max-w-sm mx-auto">
        Run <code class="font-mono">construct enroll</code> in a terminal or use the Publish tab
        to set up your publisher account.
      </p>
    </div>

    <form v-else class="flex flex-col gap-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-6" @submit.prevent="save">
      <div class="flex items-center gap-3 pb-4 border-b border-[var(--app-border)]">
        <div class="size-12 rounded-full grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_15%,transparent)] text-[var(--app-accent)] text-lg font-semibold">
          {{ (name?.[0] || '?').toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-base font-medium truncate">{{ name || '—' }}</div>
          <div class="text-xs text-[var(--app-muted)] truncate flex items-center gap-1.5 mt-0.5">
            <code class="font-mono">@{{ slug || '…' }}</code>
            <span v-if="publisher?.verified" class="text-green-500 inline-flex items-center gap-1">
              <Icon icon="lucide:badge-check" class="size-3.5" />
              Verified
            </span>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--app-muted)]">Display name</label>
        <Input v-model="name" placeholder="Acme Studio" :disabled="loading || saving" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--app-muted)]">Slug</label>
        <Input v-model="slug" placeholder="acme" :disabled="loading || saving" icon="lucide:at-sign" />
        <p class="text-xs text-[var(--app-muted)]">Appears in every space URL under your name. Lowercase letters + dashes.</p>
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--app-muted)]">Description <span class="opacity-60">(optional)</span></label>
        <Input v-model="description" placeholder="What you build with Construct" :disabled="loading || saving" />
      </div>
      <div class="flex flex-col gap-1">
        <label class="text-xs text-[var(--app-muted)]">Website <span class="opacity-60">(optional)</span></label>
        <Input v-model="website" type="url" placeholder="https://…" :disabled="loading || saving" icon="lucide:link" />
      </div>

      <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
        <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
        <span>{{ error }}</span>
      </div>
      <div v-if="success" class="flex items-start gap-2 text-sm text-green-500">
        <Icon icon="lucide:check-circle-2" class="size-4 mt-0.5 shrink-0" />
        <span>Saved.</span>
      </div>

      <div class="flex justify-end pt-2">
        <Button type="submit" :loading="saving" :disabled="saving || !dirty">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </Button>
      </div>
    </form>
  </section>
</template>
