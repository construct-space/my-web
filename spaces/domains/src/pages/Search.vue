<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { type SearchResult, createCheckout, searchDomain } from '../api'

// Search + cart + checkout. When the user arrives here from the public
// landing via `?register=<domain>`, we auto-seed the query so they don't
// retype what they already searched for. Read the query string off
// window.location directly — the space package intentionally doesn't
// depend on vue-router; routing is driven by the shell via subPage prop.

const query = ref('')
const results = ref<SearchResult[]>([])
const searching = ref(false)
const searched = ref(false)
const cart = ref<SearchResult[]>([])
const error = ref('')

const popularTLDs = [
  { ext: '.com', price: '$9.73' },
  { ext: '.io', price: '$33.38' },
  { ext: '.dev', price: '$12.98' },
  { ext: '.app', price: '$14.18' },
  { ext: '.domains', price: '$2.78' },
  { ext: '.space', price: '$1.88' },
]

const sorted = computed(() =>
  [...results.value].sort((a, b) => {
    if (a.available && !b.available) return -1
    if (!a.available && b.available) return 1
    return 0
  }),
)

const cartTotal = computed(() =>
  cart.value.reduce((s, c) => s + parseFloat(String(c.price || 0)), 0).toFixed(2),
)

async function search() {
  const q = query.value.trim()
  if (!q) return
  searching.value = true
  searched.value = true
  error.value = ''
  results.value = []
  try {
    const res = await searchDomain(q)
    results.value = res.results ?? []
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    searching.value = false
  }
}

function searchTLD(tld: string) {
  const base = query.value.trim().replace(/\.[a-z]+$/i, '')
  query.value = (base || 'construct') + tld
  search()
}

function inCart(domain: string) {
  return cart.value.some((c) => c.domain === domain)
}

function addToCart(r: SearchResult) {
  if (inCart(r.domain)) return
  cart.value.push(r)
}

function removeFromCart(domain: string) {
  cart.value = cart.value.filter((c) => c.domain !== domain)
}

const checkingOut = ref(false)
async function checkout() {
  if (!cart.value.length) return
  checkingOut.value = true
  error.value = ''
  try {
    const res = await createCheckout(cart.value.map((c) => ({ domain: c.domain, price: c.price })))
    if (res.checkout_url) {
      window.location.href = res.checkout_url
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    checkingOut.value = false
  }
}

function domainBase(d: string) {
  return d.split('.').slice(0, -1).join('.')
}
function domainTLD(d: string) {
  const parts = d.split('.')
  return parts[parts.length - 1]
}

onMounted(() => {
  // Hand-off from domains.lisaos.dev: `?register=<domain>` seeds + fires search.
  const seed = new URLSearchParams(window.location.search).get('register')
  if (seed) {
    query.value = seed
    search()
  }
})
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Search &amp; buy</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Find a domain, add to cart, check out. Your purchases appear under My domains once payment clears.
      </p>
    </div>

    <div class="flex gap-2">
      <input
        v-model="query"
        type="text"
        placeholder="Search for a domain…"
        class="flex-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-card-bg)] px-4 py-2.5 text-sm outline-none focus:border-[var(--app-accent)]"
        @keydown.enter="search"
      />
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)] px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        :disabled="searching"
        @click="search"
      >
        {{ searching ? 'Searching…' : 'Search' }}
      </button>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="tld in popularTLDs"
        :key="tld.ext"
        class="inline-flex items-center gap-1 text-xs border border-[var(--app-border)] rounded-full px-3 py-1 text-[var(--app-muted)] hover:text-[var(--app-foreground)] hover:border-[var(--app-foreground)]"
        @click="searchTLD(tld.ext)"
      >
        <span class="font-mono">{{ tld.ext }}</span>
        <span class="text-[var(--app-foreground)] font-medium">{{ tld.price }}</span>
      </button>
    </div>

    <div v-if="error" class="flex items-start gap-2 text-sm text-red-500">
      <Icon icon="lucide:alert-circle" class="size-4 mt-0.5 shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Results -->
    <div v-if="sorted.length" class="flex flex-col gap-2">
      <div
        v-for="r in sorted"
        :key="r.domain"
        class="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] px-5 py-3"
        :class="{ 'border-emerald-500/40': r.available }"
      >
        <span class="flex-1 font-mono text-sm truncate">
          {{ domainBase(r.domain) }}<span class="text-[var(--app-accent)]">.{{ domainTLD(r.domain) }}</span>
        </span>
        <span v-if="r.available && r.price" class="text-sm font-semibold">
          ${{ r.price }}<span class="text-xs text-[var(--app-muted)] font-normal">/yr</span>
        </span>
        <span
          class="inline-flex text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded"
          :class="r.available ? 'bg-emerald-500/15 text-emerald-600' : 'bg-[var(--app-surface)] text-[var(--app-muted)]'"
        >
          {{ r.available ? 'Available' : 'Taken' }}
        </span>
        <button
          v-if="r.available"
          class="text-xs rounded-md border border-[var(--app-border)] px-3 py-1.5 hover:bg-[var(--app-card-hover)] disabled:opacity-50"
          :disabled="inCart(r.domain)"
          @click="addToCart(r)"
        >
          {{ inCart(r.domain) ? 'In cart' : 'Add' }}
        </button>
      </div>
    </div>

    <div v-else-if="searched && !searching" class="text-sm text-[var(--app-muted)] text-center py-6">
      No results. Try a different name.
    </div>

    <!-- Cart -->
    <div
      v-if="cart.length"
      class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3"
    >
      <div class="text-sm font-semibold">Cart ({{ cart.length }})</div>
      <div
        v-for="c in cart"
        :key="c.domain"
        class="flex items-center gap-3 text-sm"
      >
        <span class="flex-1 font-mono">{{ c.domain }}</span>
        <span class="text-[var(--app-muted)]">${{ c.price }}/yr</span>
        <button
          class="text-[var(--app-muted)] hover:text-rose-500"
          :aria-label="`Remove ${c.domain} from cart`"
          @click="removeFromCart(c.domain)"
        >
          <Icon icon="lucide:x" class="size-4" />
        </button>
      </div>
      <div class="flex items-center justify-between pt-3 border-t border-[var(--app-border)]">
        <span class="text-sm text-[var(--app-muted)]">Total</span>
        <span class="text-lg font-semibold text-[var(--app-accent)]">${{ cartTotal }}</span>
      </div>
      <button
        class="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] text-[var(--app-accent-fg)] px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        :disabled="checkingOut"
        @click="checkout"
      >
        {{ checkingOut ? 'Creating checkout…' : 'Proceed to checkout' }}
      </button>
    </div>
  </section>
</template>
