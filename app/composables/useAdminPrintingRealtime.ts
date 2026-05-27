import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '../../types/database.types';
import {
  ADMIN_PRINTING_REALTIME_DEBOUNCE_MS,
  ADMIN_PRINTING_REALTIME_FALLBACK_INTERVAL_MS,
  type AdminPrintingRealtimePayload,
  type AdminPrintingRealtimeTopic,
  shouldRefreshAdminPrintingOnVisibility,
  shouldRunAdminPrintingFallbackRefresh,
} from '~/utils/admin-printing-realtime';

type RefreshReason = 'fallback' | 'queued' | 'realtime' | 'visibility';

interface UseAdminPrintingRealtimeOptions {
  fallbackIntervalMs?: number;
  onRefresh: () => Promise<void>;
  shouldRefreshFromEvent?: (payload: AdminPrintingRealtimePayload) => boolean;
  topics?: readonly AdminPrintingRealtimeTopic[];
}

export const useAdminPrintingRealtime = ({
  fallbackIntervalMs = ADMIN_PRINTING_REALTIME_FALLBACK_INTERVAL_MS,
  onRefresh,
  shouldRefreshFromEvent,
  topics = [],
}: UseAdminPrintingRealtimeOptions) => {
  const supabase = useSupabaseClient<Database>();
  const dirty = ref(false);
  const isVisible = ref(false);
  const lastSyncedAt = ref(Date.now());
  const refreshInFlight = ref(false);
  let fallbackTimer: number | null = null;
  let queuedRefresh = false;
  let realtimeRefreshTimer: number | null = null;
  const channels: RealtimeChannel[] = [];

  const clearRealtimeRefreshTimer = () => {
    if (realtimeRefreshTimer !== null) {
      window.clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = null;
    }
  };

  const markSynchronized = (syncedAt = Date.now()) => {
    dirty.value = false;
    lastSyncedAt.value = syncedAt;
  };

  const runRefresh = async (reason: RefreshReason) => {
    if (!import.meta.client) {
      return;
    }

    if ((reason === 'fallback' || reason === 'realtime' || reason === 'visibility') && !isVisible.value) {
      dirty.value = true;
      return;
    }

    if (refreshInFlight.value) {
      queuedRefresh = true;
      dirty.value = true;
      return;
    }

    refreshInFlight.value = true;
    dirty.value = false;

    try {
      await onRefresh();
      markSynchronized();
    } finally {
      refreshInFlight.value = false;

      if (queuedRefresh && isVisible.value) {
        queuedRefresh = false;
        await runRefresh('queued');
      }
    }
  };

  const scheduleRealtimeRefresh = () => {
    if (!import.meta.client || !isVisible.value) {
      return;
    }

    clearRealtimeRefreshTimer();
    realtimeRefreshTimer = window.setTimeout(() => {
      realtimeRefreshTimer = null;
      void runRefresh('realtime');
    }, ADMIN_PRINTING_REALTIME_DEBOUNCE_MS);
  };

  const markDirty = () => {
    dirty.value = true;
    scheduleRealtimeRefresh();
  };

  const handleVisibilityChange = () => {
    if (!import.meta.client) {
      return;
    }

    isVisible.value = !document.hidden;

    if (
      isVisible.value
      && shouldRefreshAdminPrintingOnVisibility({
        dirty: dirty.value,
        fallbackIntervalMs,
        lastSyncedAt: lastSyncedAt.value,
        now: Date.now(),
      })
    ) {
      void runRefresh('visibility');
    }
  };

  onMounted(() => {
    isVisible.value = !document.hidden;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    for (const topic of topics) {
      const channel = supabase
        .channel(topic, {
          config: {
            private: true,
          },
        })
        .on('broadcast', { event: '*' }, ({ payload }) => {
          const realtimePayload =
            payload && typeof payload === 'object' && !Array.isArray(payload)
              ? (payload as AdminPrintingRealtimePayload)
              : null;

          if (!realtimePayload) {
            markDirty();
            return;
          }

          if (!shouldRefreshFromEvent || shouldRefreshFromEvent(realtimePayload)) {
            markDirty();
          }
        });

      channel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          dirty.value = true;
        }
      });

      channels.push(channel);
    }

    fallbackTimer = window.setInterval(() => {
      if (
        shouldRunAdminPrintingFallbackRefresh({
          dirty: dirty.value,
          fallbackIntervalMs,
          isVisible: isVisible.value,
          lastSyncedAt: lastSyncedAt.value,
          now: Date.now(),
        })
      ) {
        void runRefresh('fallback');
      }
    }, fallbackIntervalMs);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearRealtimeRefreshTimer();

    if (fallbackTimer !== null) {
      window.clearInterval(fallbackTimer);
      fallbackTimer = null;
    }

    for (const channel of channels) {
      void supabase.removeChannel(channel);
    }
  });

  return {
    dirty: readonly(dirty),
    isVisible: readonly(isVisible),
    lastSyncedAt: readonly(lastSyncedAt),
    markDirty,
    markSynchronized,
    refreshInFlight: readonly(refreshInFlight),
    refreshNow: runRefresh,
  };
};
