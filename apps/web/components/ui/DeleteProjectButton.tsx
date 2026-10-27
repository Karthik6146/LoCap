'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DeleteProjectButton({ projectId, projectName = 'this project' }: { projectId: string; projectName?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (!confirm('Delete "' + projectName + '" and its videos, captions, clips and exports? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/projects/' + projectId + '/delete', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not delete the project. Please retry.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the project.');
    } finally { setBusy(false); }
  }
  return <div className="project-delete">
    <button type="button" className="project-delete-button" title={busy ? 'Deleting project…' : 'Delete project'} aria-label={'Delete project ' + projectName} aria-busy={busy} disabled={busy} onClick={remove}>
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7" /></svg>
    </button>
    {error && <p role="alert" className="project-delete-error">{error}</p>}
  </div>;
}
