import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

/**
 * Triggers an immediate TikTok view sync for the assignment (creator or the
 * campaign's brand). The sync runs in the background — data refreshes within
 * a minute or two.
 */
export function RefreshViewsButton({ assignmentId }: { assignmentId: string }) {
  const [done, setDone] = useState(false);
  const qc = useQueryClient();
  const refresh = useMutation({
    mutationFn: async () => { await api.post(`/assignments/${assignmentId}/refresh-views`); },
    onSuccess: () => {
      setDone(true);
      setTimeout(() => {
        setDone(false);
        qc.invalidateQueries({ queryKey: ['assignment'] });
        qc.invalidateQueries({ queryKey: ['creator-assignments'] });
        qc.invalidateQueries({ queryKey: ['campaign-analytics'] });
      }, 45000);
    },
  });

  return (
    <button
      type="button"
      className="view-all"
      style={{ background: 'none', border: 'none', cursor: refresh.isPending || done ? 'default' : 'pointer' }}
      disabled={refresh.isPending || done}
      onClick={() => refresh.mutate()}
    >
      {refresh.isPending ? 'Startar…' : done ? '✓ Synk startad — klar inom någon minut' : '↻ Uppdatera views nu'}
    </button>
  );
}
