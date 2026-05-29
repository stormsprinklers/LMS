import { CourseItemNav } from "@/components/courses/CourseItemNav";
import type { CourseItemNavigation } from "@/lib/courses/item-navigation";

export function CourseExamTakeNav({
  navigation,
}: {
  navigation: CourseItemNavigation;
}) {
  return (
    <CourseItemNav
      previous={navigation.previous}
      next={navigation.next}
      position={navigation.position}
      total={navigation.total}
    />
  );
}
