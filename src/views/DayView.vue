<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="day-view">
    <h1>Day View</h1>
    <p>{{ route.params.date }}</p>
  </div>
</template>
