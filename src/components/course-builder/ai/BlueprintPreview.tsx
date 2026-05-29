"use client";

import { LessonHtmlContent } from "@/components/lesson/LessonHtmlContent";
import type { CourseBlueprint } from "@/lib/ai/blueprint-schema";
import type { BlueprintIssue } from "@/lib/ai/validate-blueprint";
import type { CourseItemType } from "@prisma/client";
import { YouTubeIframe } from "@/components/video/YouTubeIframe";
import { ItemTypeIcon } from "../ItemTypeIcon";

export function BlueprintPreview({
  blueprint,
  issues,
  selectedModule,
  selectedItem,
  onSelectModule,
  onSelectItem,
  structureOnly = false,
}: {
  blueprint: CourseBlueprint;
  issues: BlueprintIssue[];
  selectedModule: number | null;
  selectedItem: number | null;
  onSelectModule: (index: number) => void;
  onSelectItem: (moduleIndex: number, itemIndex: number) => void;
  structureOnly?: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="rounded-xl border border-storm-light-blue/50 bg-white p-4">
        <h3 className="font-title text-sm font-semibold text-storm-navy">Structure</h3>
        <p className="mt-1 text-xs text-storm-navy/60">
          {blueprint.course.title} · {blueprint.modules.length} module(s)
        </p>
        <ul className="mt-3 space-y-2">
          {blueprint.modules.map((mod, mi) => (
            <li key={mi}>
              <button
                type="button"
                onClick={() => onSelectModule(mi)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                  selectedModule === mi && selectedItem === null
                    ? "bg-storm-medium-blue/10 text-storm-medium-blue"
                    : "hover:bg-storm-light-grey/50 text-storm-navy"
                }`}
              >
                <span className="font-medium">{mod.title}</span>
                <span className="ml-2 text-xs text-storm-navy/50">
                  {mod.items.length} item(s)
                </span>
              </button>
              <ul className="ml-3 mt-1 space-y-0.5 border-l border-storm-light-blue/40 pl-3">
                {mod.items.map((item, ii) => (
                  <li key={ii}>
                    <button
                      type="button"
                      onClick={() => onSelectItem(mi, ii)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                        selectedModule === mi && selectedItem === ii
                          ? "bg-storm-medium-blue/10 text-storm-medium-blue"
                          : "hover:bg-storm-light-grey/40 text-storm-navy/80"
                      }`}
                    >
                      <ItemTypeIcon
                        type={item.type as CourseItemType}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        {issues.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">Validation</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/90">
              {issues.map((issue, i) => (
                <li key={i} className={issue.level === "error" ? "font-medium" : ""}>
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border border-storm-light-blue/50 bg-white p-4">
          <h3 className="font-title text-sm font-semibold text-storm-navy">Detail</h3>
          {selectedModule === null ? (
            <div className="mt-3 text-sm text-storm-navy/70">
              <p>{blueprint.course.description || "No description."}</p>
              {blueprint.course.learningObjectives?.length ? (
                <ul className="mt-3 list-disc pl-5">
                  {blueprint.course.learningObjectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <PreviewItemDetail
              blueprint={blueprint}
              moduleIndex={selectedModule}
              itemIndex={selectedItem}
              structureOnly={structureOnly}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewItemDetail({
  blueprint,
  moduleIndex,
  itemIndex,
  structureOnly,
}: {
  blueprint: CourseBlueprint;
  moduleIndex: number;
  itemIndex: number | null;
  structureOnly?: boolean;
}) {
  const mod = blueprint.modules[moduleIndex];
  if (!mod) return null;

  if (itemIndex === null) {
    return (
      <div className="mt-3 text-sm text-storm-navy/80">
        <p className="font-medium text-storm-navy">{mod.title}</p>
        {mod.description && <p className="mt-2">{mod.description}</p>}
      </div>
    );
  }

  const item = mod.items[itemIndex];
  if (!item) return null;

  return (
    <div className="mt-3 text-sm text-storm-navy/80">
      <p className="font-medium text-storm-navy">
        {item.type}: {item.title}
      </p>
      {item.outline && (structureOnly || !item.lesson?.bodyHtml?.trim()) && (
        <p className="mt-2 rounded-lg bg-storm-light-grey/40 px-3 py-2 text-storm-navy/90">
          {item.outline}
        </p>
      )}
      {!structureOnly && item.lesson?.bodyHtml && (
        <div className="mt-3 max-w-none">
          <LessonHtmlContent
            html={item.lesson.bodyHtml}
            assets={(blueprint.sourceAssets ?? []).map((a) => ({
              id: a.id,
              kind: a.kind,
              filename: a.filename ?? null,
              blobUrl: a.blobUrl ?? null,
              muxPlaybackId: a.muxPlaybackId ?? null,
              extractedText: a.extractedText ?? null,
              placementHint: a.placementHint ?? null,
            }))}
          />
        </div>
      )}
      {item.video && (
        <div className="mt-3 space-y-2 text-xs">
          {item.video.youtubeUrl && (
            <div className="overflow-hidden rounded-lg bg-storm-navy">
              <YouTubeIframe
                urlOrId={item.video.youtubeUrl}
                title={item.title}
              />
            </div>
          )}
          {item.video.sourceAssetRef && (
            <p>Source asset: {item.video.sourceAssetRef}</p>
          )}
          {item.video.transcript && (
            <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-storm-navy/70">
              {item.video.transcript}
            </p>
          )}
        </div>
      )}
      {item.exam?.questions && (
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {item.exam.questions.map((q, i) => (
            <li key={i}>
              <span>{q.text}</span>
              <span className="ml-2 text-xs text-storm-navy/50">({q.type})</span>
            </li>
          ))}
        </ol>
      )}
      {item.scenario?.prompt && (
        <p className="mt-3 italic">{item.scenario.prompt}</p>
      )}
    </div>
  );
}
