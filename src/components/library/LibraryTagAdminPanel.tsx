"use client";

import { useEffect, useState } from "react";
import type { LibraryTagListItem } from "@/lib/library/types";
import { createLibraryTag, deleteLibraryTag, fetchLibraryTags } from "@/lib/library/client";
import { LibraryTagList } from "@/components/library/LibraryTagChip";
import { Loader2, Plus, Trash2 } from "lucide-react";

export function LibraryTagAdminPanel({
  onTagsChange,
}: {
  onTagsChange?: () => void;
}) {
  const [tags, setTags] = useState<LibraryTagListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  async function loadTags() {
    const result = await fetchLibraryTags();
    if (result.error) setError(result.error);
    else setTags(result.tags ?? []);
  }

  useEffect(() => {
    void loadTags();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const result = await createLibraryTag(name.trim());
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    await loadTags();
    onTagsChange?.();
  }

  async function handleDelete(tagId: string, tagName: string) {
    if (!confirm(`Delete tag "${tagName}"? Items will keep their other tags.`)) return;
    setBusy(true);
    setError("");
    const result = await deleteLibraryTag(tagId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    await loadTags();
    onTagsChange?.();
  }

  return (
    <div className="rounded-xl border border-storm-light-blue/40 bg-white p-4">
      <h3 className="font-medium text-storm-navy">Library tags</h3>
      <p className="mt-1 text-xs text-storm-navy/60">
        Admins create tags here. Tag items in the library so teams can add whole sets to AI
        courses at once.
      </p>

      {error && (
        <p className="mt-2 text-sm text-red-700">{error}</p>
      )}

      <form onSubmit={handleCreate} className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag name"
          className="min-h-9 flex-1 rounded-lg border px-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-storm-medium-blue px-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </form>

      <ul className="mt-4 space-y-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
          >
            <LibraryTagList tags={[tag]} showCounts tagCounts={{ [tag.id]: tag.assetCount }} />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDelete(tag.id, tag.name)}
              className="rounded p-1 text-red-700 hover:bg-red-50"
              aria-label={`Delete ${tag.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
