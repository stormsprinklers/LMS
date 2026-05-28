"use client";

import MuxPlayer from "@mux/mux-player-react";
import { YouTubeIframe } from "@/components/video/YouTubeIframe";
import { isYouTubeUrl } from "@/lib/video/youtube";
import type { LibraryAssetListItem } from "@/lib/actions/library";

type PreviewAsset = Pick<
  LibraryAssetListItem,
  "kind" | "blobUrl" | "muxPlaybackId" | "title" | "processingStatus"
>;

export function libraryAssetHasInAppPreview(asset: PreviewAsset): boolean {
  if (asset.muxPlaybackId) return true;
  if (asset.blobUrl && isYouTubeUrl(asset.blobUrl)) return true;
  if (!asset.blobUrl) return false;
  return ["video", "audio", "image", "pdf"].includes(asset.kind);
}

export function libraryAssetOpensExternally(asset: PreviewAsset): boolean {
  if (!asset.blobUrl) return false;
  if (isYouTubeUrl(asset.blobUrl)) return false;
  if (asset.muxPlaybackId) return false;
  if (["video", "audio", "image", "pdf"].includes(asset.kind)) return false;
  return true;
}

export function libraryAssetCanDownload(asset: PreviewAsset): boolean {
  if (!asset.blobUrl || isYouTubeUrl(asset.blobUrl)) return false;
  if (asset.kind === "webpage") return false;
  return true;
}

export function LibraryAssetMedia({ asset }: { asset: PreviewAsset }) {
  const blobUrl = asset.blobUrl;
  if (!blobUrl && !asset.muxPlaybackId) return null;

  if (asset.muxPlaybackId) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg bg-storm-navy">
        <MuxPlayer
          playbackId={asset.muxPlaybackId}
          streamType="on-demand"
          className="aspect-video w-full"
          accentColor="#4C9BC8"
        />
      </div>
    );
  }

  if (blobUrl && isYouTubeUrl(blobUrl)) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg bg-storm-navy">
        <YouTubeIframe urlOrId={blobUrl} title={asset.title} />
      </div>
    );
  }

  if (asset.kind === "video" && blobUrl) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg bg-storm-navy">
        <video src={blobUrl} controls className="aspect-video w-full" playsInline />
      </div>
    );
  }

  if (asset.kind === "audio" && blobUrl) {
    return (
      <audio src={blobUrl} controls className="mt-3 w-full" preload="metadata" />
    );
  }

  if (asset.kind === "image" && blobUrl) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-storm-light-blue/40 bg-storm-light-grey/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={asset.title}
          className="max-h-96 w-full object-contain"
        />
      </div>
    );
  }

  if (asset.kind === "pdf" && blobUrl) {
    return (
      <iframe
        title={asset.title}
        src={blobUrl}
        className="mt-3 h-[min(70vh,520px)] w-full rounded-lg border border-storm-light-blue/40 bg-white"
      />
    );
  }

  return null;
}
