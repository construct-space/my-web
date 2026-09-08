<script setup lang="ts">
/**
 * Billing stub. No backend yet — source doesn't own invoices or
 * subscriptions. When the billing service lands this page becomes the
 * invoice list + payment method + plan-switch entry point.
 */
import { Placeholder } from '@construct-space/infra-shell'
</script>

<template>
  <Placeholder
    title="Billing"
    icon="credit-card"
    description="Plan, payment method, invoices, and usage-based overages for your organization. Lands when the billing service is online."
  />
</template>
