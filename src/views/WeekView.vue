<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="week-view">
    <h1>Week View</h1>
    <p>Week of {{ route.params.date }}</p>
  </div>
</template>
