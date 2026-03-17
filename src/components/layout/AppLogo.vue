<template>
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="app-logo"
    aria-hidden="true"
  >
    <!-- Outer circle -->
    <circle cx="14" cy="14" r="12.5" stroke="var(--color-text)" stroke-width="1.5" />

    <!-- Category segments (donut slices) -->
    <!-- Projects: top-right arc -->
    <path
      d="M14 3 A11 11 0 0 1 25 14"
      stroke="var(--color-project)"
      stroke-width="3"
      stroke-linecap="round"
      fill="none"
    />
    <!-- Meetings: right-bottom arc -->
    <path
      d="M25 14 A11 11 0 0 1 14 25"
      stroke="var(--color-meetings)"
      stroke-width="3"
      stroke-linecap="round"
      fill="none"
    />
    <!-- Overhead: bottom-left arc -->
    <path
      d="M14 25 A11 11 0 0 1 3 14"
      stroke="var(--color-overhead)"
      stroke-width="3"
      stroke-linecap="round"
      fill="none"
    />
    <!-- Ad-hoc: left-top arc -->
    <path
      d="M3 14 A11 11 0 0 1 14 3"
      stroke="var(--color-adhoc)"
      stroke-width="3"
      stroke-linecap="round"
      fill="none"
    />

    <!-- Clock hands -->
    <line x1="14" y1="14" x2="14" y2="7.5" stroke="var(--color-text)" stroke-width="1.5" stroke-linecap="round" />
    <line x1="14" y1="14" x2="19" y2="14" stroke="var(--color-text)" stroke-width="1.5" stroke-linecap="round" />

    <!-- Center dot -->
    <circle cx="14" cy="14" r="1.5" fill="var(--color-text)" />
  </svg>
</template>

<style scoped>
.app-logo {
  flex-shrink: 0;
}
</style>
