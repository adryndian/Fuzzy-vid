<script setup lang="ts">
// Template: Vue 3 Component (Composition API + TypeScript)
// Usage: Copy → rename file → replace TODO sections
// Stack: Vue 3, TypeScript, Tailwind CSS

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// TODO: Define props
interface Props {
  id: string
  className?: string
}

// TODO: Define emits
interface Emits {
  (e: 'action', id: string): void
  (e: 'close'): void
}

// TODO: Define data type
interface DataType {
  id: string
  name: string
  // add fields
}

const props = withDefaults(defineProps<Props>(), {
  className: '',
})

const emit = defineEmits<Emits>()

// State
const data = ref<DataType | null>(null)
const loading = ref(true)
const error = ref<Error | null>(null)

// Computed
const hasData = computed(() => data.value !== null)

// Methods
const fetchData = async () => {
  try {
    loading.value = true
    error.value = null
    // TODO: Replace with actual fetch / composable call
    const response = await fetch(`/api/resource/${props.id}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    data.value = await response.json()
  } catch (err) {
    error.value = err instanceof Error ? err : new Error('Unknown error')
  } finally {
    loading.value = false
  }
}

const handleAction = () => {
  if (data.value) emit('action', data.value.id)
}

// Watch for prop changes
watch(() => props.id, fetchData, { immediate: false })

// Lifecycle
onMounted(fetchData)
</script>

<template>
  <!-- Loading state -->
  <div v-if="loading" class="animate-pulse" :class="className">
    <div class="h-4 bg-gray-200 rounded w-3/4 mb-2" />
    <div class="h-4 bg-gray-200 rounded w-1/2" />
  </div>

  <!-- Error state -->
  <div v-else-if="error" class="text-red-500 text-sm" :class="className">
    Failed to load: {{ error.message }}
  </div>

  <!-- Empty state -->
  <div v-else-if="!hasData" class="text-gray-400 text-sm" :class="className">
    No data found.
  </div>

  <!-- Main content -->
  <div v-else class="rounded-lg border border-gray-200 p-4" :class="className">
    <!-- TODO: Replace with actual UI -->
    <h3 class="font-semibold text-gray-900">{{ data!.name }}</h3>

    <button
      class="mt-2 text-sm text-blue-600 hover:text-blue-800"
      @click="handleAction"
    >
      Action
    </button>
  </div>
</template>

<!--
VARIANT: Using a Composable (recommended for reusable fetch logic)

// composables/useResource.ts
export const useResource = (id: MaybeRef<string>) => {
  const data = ref<DataType | null>(null)
  const loading = ref(true)
  const error = ref<Error | null>(null)

  const fetchData = async () => {
    try {
      loading.value = true
      const res = await fetch(`/api/resource/${toValue(id)}`)
      data.value = await res.json()
    } catch (err) {
      error.value = err as Error
    } finally {
      loading.value = false
    }
  }

  watch(() => toValue(id), fetchData, { immediate: true })

  return { data: readonly(data), loading: readonly(loading), error: readonly(error) }
}

// In component:
const { data, loading, error } = useResource(toRef(props, 'id'))
-->
