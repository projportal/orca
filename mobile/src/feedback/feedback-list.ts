import type { FeedbackIntent } from './feedback-message'

export type FeedbackItemStatus = 'sending' | 'delivered' | 'copied' | 'failed'

/** One piece of feedback in the phone's local list, from the first send attempt on. */
export type FeedbackItem = {
  id: string
  createdAt: number
  thumbnailUri: string
  pageLabel: string
  intent: FeedbackIntent
  commentPreview: string
  status: FeedbackItemStatus
  targetLabel: string | null
  hostImagePath: string | null
  error: string | null
  updatedAt: number
}

export const FEEDBACK_LIST_LIMIT = 20

type Listener = () => void

/**
 * The local feedback list: an append-mostly store the composer writes and the delivered view
 * reads. Held in memory for the app's lifetime; the images it points at live in the capture cache.
 */
export function createFeedbackList(limit: number = FEEDBACK_LIST_LIMIT) {
  let items: readonly FeedbackItem[] = []
  const listeners = new Set<Listener>()
  const publish = (next: readonly FeedbackItem[]): void => {
    items = next
    for (const listener of listeners) {
      listener()
    }
  }
  return {
    getSnapshot: (): readonly FeedbackItem[] => items,
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    /** Adds or replaces by id, newest first, trimmed to the limit. */
    upsert: (item: FeedbackItem): void => {
      publish([item, ...items.filter((existing) => existing.id !== item.id)].slice(0, limit))
    },
    update: (id: string, patch: Partial<Omit<FeedbackItem, 'id' | 'createdAt'>>): void => {
      if (!items.some((item) => item.id === id)) {
        return
      }
      publish(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    },
    /** Capture ids still referenced, so cache cleanup keeps their images. */
    referencedIds: (): Set<string> => new Set(items.map((item) => item.id)),
    clear: (): void => publish([])
  }
}

export type FeedbackList = ReturnType<typeof createFeedbackList>

export function feedbackCommentPreview(comment: string, max = 80): string {
  const flat = comment.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export function feedbackStatusLabel(item: Pick<FeedbackItem, 'status' | 'targetLabel'>): string {
  switch (item.status) {
    case 'sending':
      return 'Sending…'
    case 'delivered':
      return item.targetLabel ? `Delivered to ${item.targetLabel}` : 'Delivered'
    case 'copied':
      return 'Copied'
    case 'failed':
      return 'Not delivered'
  }
}
