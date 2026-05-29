"use client";

import type { LibraryAssetListItem } from "@/lib/actions/library";
import {
  assetDisplaySize,
  assetPreviewThumbnail,
} from "@/lib/library/folders";
import { kindLabel } from "@/lib/media/asset-utils";
import { LibraryTagList } from "@/components/library/LibraryTagChip";
import {
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Music,
  Presentation,
} from "lucide-react";

function FallbackIcon({ kind }: { kind: string }) {
  const cls = "h-10 w-10 text-storm-medium-blue";
  if (kind === "image") return <ImageIcon className={cls} />;
  if (kind === "video") return <Film className={cls} />;
  if (kind === "audio") return <Music className={cls} />;
  if (kind === "pptx") return <Presentation className={cls} />;
  if (kind === "webpage" || kind === "embed") return <Globe className={cls} />;
  return <FileText className={cls} />;
}

export function LibraryAssetTile({
  asset,
  onClick,
}: {
  asset: LibraryAssetListItem;
  onClick: () => void;
}) {
  const thumb = assetPreviewThumbnail(asset);
  const size = assetDisplaySize(asset);
  const processing =
    asset.processingStatus === "pending" || asset.processingStatus === "processing";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-lg border border-storm-light-blue/50 bg-white p-2 text-left transition-colors hover:border-storm-medium-blue/60 hover:bg-storm-light-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storm-medium-blue/40"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-storm-light-grey/50">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gradient-to-b from-storm-light-blue/30 to-storm-light-grey/80">
            <FallbackIcon kind={asset.kind} />
            <span className="text-[10px] font-medium uppercase tracking-wide text-storm-navy/50">
              {kindLabel(asset.kind)}
            </span>
          </div>
        )}
        {processing && (
          <span className="absolute bottom-1 right-1 rounded bg-storm-navy/75 px-1.5 py-0.5 text-[10px] text-white">
            Processing…
          </span>
        )}
        {asset.scope === "shared" && (
          <span className="absolute left-1 top-1 rounded bg-storm-medium-blue/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            Shared
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-storm-navy group-hover:text-storm-medium-blue">
        {asset.title}
      </p>
      {asset.tags.length > 0 && (
        <div className="mt-1">
          <LibraryTagList tags={asset.tags} />
        </div>
      )}
      <p className="mt-0.5 truncate text-xs text-storm-navy/50">
        {size}
        {asset.filename ? ` · ${asset.filename}` : ""}
      </p>
    </button>
  );
}

export function LibraryFolderTile({
  label,
  count,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center rounded-lg border border-storm-light-blue/50 bg-white p-4 text-center transition-colors hover:border-storm-medium-blue/60 hover:bg-storm-light-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storm-medium-blue/40"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-storm-light-blue/40 text-storm-medium-blue">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-storm-navy">{label}</p>
      <p className="mt-0.5 text-xs text-storm-navy/50">
        {count} item{count === 1 ? "" : "s"}
      </p>
    </button>
  );
}
