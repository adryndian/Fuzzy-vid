// Template: React Native Screen (Expo Router + TypeScript)
// Usage: Place in app/ directory → rename → replace TODO sections
// Stack: Expo SDK 52, expo-router, TypeScript, NativeWind / StyleSheet

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

// TODO: Define item type
interface Item {
  id: string
  title: string
  subtitle?: string
  // add fields
}

// TODO: Replace with actual fetch function
const fetchItems = async (): Promise<Item[]> => {
  const response = await fetch('https://api.example.com/items')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

export default function ItemListScreen() {
  // If this screen has params (e.g. app/category/[id].tsx)
  // const { id } = useLocalSearchParams<{ id: string }>()

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadItems = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true)
      setError(null)
      const data = await fetchItems()
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  const handleRefresh = () => {
    setRefreshing(true)
    loadItems(true)
  }

  const handleItemPress = (item: Item) => {
    // TODO: Replace with actual navigation target
    router.push(`/items/${item.id}`)
  }

  // Render each list item
  const renderItem = useCallback(({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{item.title}</Text>
        {item.subtitle && (
          <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  ), [])

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </SafeAreaView>
    )
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadItems()}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Screen header — expo-router Stack.Screen */}
      <Stack.Screen
        options={{
          title: 'Items', // TODO: Replace title
          headerLargeTitle: Platform.OS === 'ios',
        }}
      />

      <StatusBar style="auto" />

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
        // Performance props
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={15}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  itemSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
})
