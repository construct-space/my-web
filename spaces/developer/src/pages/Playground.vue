<script setup lang="ts">
/**
 * GraphQL Playground — links out to graph.lisaos.dev's own
 * Playground rather than embedding. The hosted playground has full
 * autocomplete, schema introspection, and history; iframing it here
 * would just re-render a worse copy. When we build a native in-portal
 * playground (later) this page's shell stays, only the iframe/launcher
 * body swaps.
 */
import { Icon } from '@iconify/vue'

const GRAPH_PLAYGROUND = 'https://graph.lisaos.dev/graphql'
</script>

<template>
  <section class="max-w-3xl flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold">GraphQL</h1>
      <p class="text-sm text-[var(--app-muted)] mt-1">
        Run live queries against your schemas. The playground is hosted on
        <code class="font-mono">graph.lisaos.dev</code> — the same endpoint your spaces' SDK hits at runtime.
      </p>
    </div>

    <!-- Primary CTA: open the playground. -->
    <a
      :href="GRAPH_PLAYGROUND"
      target="_blank"
      rel="noopener noreferrer"
      class="group rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 hover:border-[var(--app-accent)] transition-colors flex items-center gap-4"
    >
      <div class="size-11 rounded-lg grid place-items-center bg-[color-mix(in_srgb,var(--app-accent)_12%,transparent)] text-[var(--app-accent)]">
        <Icon icon="lucide:terminal-square" class="size-5" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold">Open GraphQL Playground</div>
        <div class="text-xs text-[var(--app-muted)] mt-0.5 truncate font-mono">{{ GRAPH_PLAYGROUND }}</div>
      </div>
      <Icon icon="lucide:arrow-up-right" class="size-5 text-[var(--app-muted)] group-hover:text-[var(--app-accent)] transition-colors" />
    </a>

    <!-- curl cheat sheet — covers the "I just want to hit it from my terminal" case. -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <div class="size-8 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:command" class="size-4" />
        </div>
        <h2 class="text-sm font-semibold">Query from the shell</h2>
      </div>
      <pre class="bg-[var(--app-surface)] border border-[var(--app-border)] rounded px-3 py-2 text-xs font-mono overflow-x-auto leading-relaxed m-0">curl https://graph.lisaos.dev/graphql \
  -H "Content-Type: application/json" \
  -H "X-Space-ID: my-space" \
  -H "Authorization: Bearer $CONSTRUCT_TOKEN" \
  -d '{"query":"{ __schema { types { name } } }"}'</pre>
      <p class="text-xs text-[var(--app-muted)]">
        Get your token from the
        <RouterLink to="/account/password" class="text-[var(--app-accent)] hover:underline">account</RouterLink>
        OAuth flow, or use a
        <RouterLink to="/developer/keys" class="text-[var(--app-accent)] hover:underline">publisher key</RouterLink>
        (<code class="font-mono">X-API-Key</code> header).
      </p>
    </div>

    <!-- SDK pointer. -->
    <div class="rounded-xl border border-[var(--app-border)] bg-[var(--app-card-bg)] p-5 flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <div class="size-8 rounded-lg grid place-items-center bg-[var(--app-surface)] text-[var(--app-muted)]">
          <Icon icon="lucide:box" class="size-4" />
        </div>
        <h2 class="text-sm font-semibold">Inside a space: the SDK</h2>
      </div>
      <pre class="bg-[var(--app-surface)] border border-[var(--app-border)] rounded px-3 py-2 text-xs font-mono overflow-x-auto leading-relaxed m-0">import { useGraph } from '@construct-space/graph'

const { data } = await useGraph().query({
  Posts: { _: { limit: 10 }, id: true, title: true }
})</pre>
      <p class="text-xs text-[var(--app-muted)]">
        The SDK reads the active Construct session automatically and targets
        <code class="font-mono">graph.lisaos.dev/graphql</code>. No base-URL wiring needed.
      </p>
    </div>
  </section>
</template>
