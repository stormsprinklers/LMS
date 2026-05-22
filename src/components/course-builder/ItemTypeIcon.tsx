import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Film,
  GitBranch,
  HelpCircle,
} from "lucide-react";
import type { CourseItemType } from "@prisma/client";

const ICONS: Record<CourseItemType, typeof FileText> = {
  LESSON: FileText,
  VIDEO: Film,
  QUIZ: HelpCircle,
  EXAM: ClipboardCheck,
  SKILL_CHECK: BookOpen,
  SCENARIO: GitBranch,
};

export function ItemTypeIcon({ type, className }: { type: CourseItemType; className?: string }) {
  const Icon = ICONS[type] ?? FileText;
  return <Icon className={className ?? "h-4 w-4 shrink-0"} aria-hidden />;
}
