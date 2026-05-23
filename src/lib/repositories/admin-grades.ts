import { prisma } from "@/lib/db";

const SUBMITTED_STATUSES = [
  "SUBMITTED_PENDING_GRADE",
  "PASSED",
  "FAILED",
] as const;

export type CourseProgressSummary = {
  courseId: string;
  courseTitle: string;
  slug: string;
  completedItems: number;
  totalItems: number;
  progressPct: number;
};

export type ExamAttemptSummary = {
  examId: string;
  examTitle: string;
  attemptCount: number;
  bestScore: number | null;
  latestScore: number | null;
  latestStatus: string;
  latestCompletedAt: Date | null;
  pendingGrade: boolean;
  latestAttemptId: string | null;
};

export type LearnerGradesOverviewRow = {
  userId: string;
  name: string | null;
  email: string;
  courses: CourseProgressSummary[];
  exams: ExamAttemptSummary[];
};

export type ExamLearnerGradeRow = {
  userId: string;
  name: string | null;
  email: string;
  attemptCount: number;
  bestScore: number | null;
  latestScore: number | null;
  latestStatus: string;
  latestCompletedAt: Date | null;
  pendingGrade: boolean;
  latestAttemptId: string;
};

export type CourseExamGradeCell = {
  examId: string;
  examTitle: string;
  bestScore: number | null;
  latestScore: number | null;
  latestStatus: string;
  attemptCount: number;
  pendingGrade: boolean;
  latestAttemptId: string | null;
};

export type CourseLearnerGradeRow = {
  userId: string;
  name: string | null;
  email: string;
  enrolled: boolean;
  completedItems: number;
  totalItems: number;
  progressPct: number;
  exams: CourseExamGradeCell[];
};

function progressPct(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function buildExamSummariesByUser(
  attempts: {
    id: string;
    userId: string;
    examId: string;
    score: number | null;
    status: string;
    pendingManualGrade: boolean;
    completedAt: Date | null;
    exam: { title: string };
  }[],
): Map<string, ExamAttemptSummary[]> {
  const byUserExam = new Map<string, typeof attempts>();

  for (const a of attempts) {
    const key = `${a.userId}:${a.examId}`;
    const list = byUserExam.get(key) ?? [];
    list.push(a);
    byUserExam.set(key, list);
  }

  const byUser = new Map<string, ExamAttemptSummary[]>();

  for (const [key, list] of byUserExam) {
    const userId = key.split(":")[0]!;
    const sorted = [...list].sort((a, b) => {
      const ta = a.completedAt?.getTime() ?? 0;
      const tb = b.completedAt?.getTime() ?? 0;
      return tb - ta;
    });
    const latest = sorted[0]!;
    const scores = sorted
      .map((x) => x.score)
      .filter((s): s is number => s !== null);
    const summary: ExamAttemptSummary = {
      examId: latest.examId,
      examTitle: latest.exam.title,
      attemptCount: sorted.length,
      bestScore: scores.length ? Math.max(...scores) : null,
      latestScore: latest.score,
      latestStatus: latest.status,
      latestCompletedAt: latest.completedAt,
      pendingGrade: latest.pendingManualGrade,
      latestAttemptId: latest.id,
    };
    const userList = byUser.get(userId) ?? [];
    userList.push(summary);
    byUser.set(userId, userList);
  }

  for (const [, exams] of byUser) {
    exams.sort((a, b) =>
      (b.latestCompletedAt?.getTime() ?? 0) -
      (a.latestCompletedAt?.getTime() ?? 0),
    );
  }

  return byUser;
}

export async function getLearnersGradesOverview(): Promise<
  LearnerGradesOverviewRow[]
> {
  const [courses, itemCounts, progressRows, attempts, enrollments] =
    await Promise.all([
      prisma.course.findMany({
        where: { archived: false },
        select: { id: true, title: true, slug: true },
      }),
      prisma.courseItem.groupBy({
        by: ["courseId"],
        where: { archived: false },
        _count: { id: true },
      }),
      prisma.courseItemProgress.findMany({
        where: {
          status: "COMPLETED",
          courseItem: { archived: false },
        },
        select: {
          userId: true,
          courseItem: { select: { courseId: true } },
        },
      }),
      prisma.examAttempt.findMany({
        where: { status: { in: [...SUBMITTED_STATUSES] } },
        include: { exam: { select: { title: true } } },
        orderBy: { completedAt: "desc" },
      }),
      prisma.enrollment.findMany({ select: { userId: true, courseId: true } }),
    ]);

  const totalByCourse = new Map(
    itemCounts.map((g) => [g.courseId, g._count.id]),
  );
  const completedByUserCourse = new Map<string, number>();
  for (const p of progressRows) {
    const key = `${p.userId}:${p.courseItem.courseId}`;
    completedByUserCourse.set(key, (completedByUserCourse.get(key) ?? 0) + 1);
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const examByUser = buildExamSummariesByUser(attempts);

  const userIds = new Set<string>();
  for (const e of enrollments) userIds.add(e.userId);
  for (const p of progressRows) userIds.add(p.userId);
  for (const a of attempts) userIds.add(a.userId);

  if (userIds.size === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] }, archived: false },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: { id: true, name: true, email: true },
  });

  const enrollmentsByUser = new Map<string, Set<string>>();
  for (const e of enrollments) {
    const set = enrollmentsByUser.get(e.userId) ?? new Set();
    set.add(e.courseId);
    enrollmentsByUser.set(e.userId, set);
  }

  return users.map((user) => {
    const enrolledCourseIds = enrollmentsByUser.get(user.id) ?? new Set();
    const courseIdsForUser = new Set(enrolledCourseIds);
    for (const [key] of completedByUserCourse) {
      const [uid, cid] = key.split(":");
      if (uid === user.id) courseIdsForUser.add(cid!);
    }

    const courseSummaries: CourseProgressSummary[] = [...courseIdsForUser]
      .map((courseId) => {
        const course = courseById.get(courseId);
        if (!course) return null;
        const total = totalByCourse.get(courseId) ?? 0;
        const completed =
          completedByUserCourse.get(`${user.id}:${courseId}`) ?? 0;
        return {
          courseId,
          courseTitle: course.title,
          slug: course.slug,
          completedItems: completed,
          totalItems: total,
          progressPct: progressPct(completed, total),
        };
      })
      .filter((c): c is CourseProgressSummary => c !== null)
      .sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      courses: courseSummaries,
      exams: examByUser.get(user.id) ?? [],
    };
  });
}

export async function getExamGradesReport(examId: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      title: true,
      passingScore: true,
      course: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!exam) return null;

  const attempts = await prisma.examAttempt.findMany({
    where: { examId, status: { in: [...SUBMITTED_STATUSES] } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { completedAt: "desc" },
  });

  const byUser = new Map<string, typeof attempts>();
  for (const a of attempts) {
    const list = byUser.get(a.userId) ?? [];
    list.push(a);
    byUser.set(a.userId, list);
  }

  const learners: ExamLearnerGradeRow[] = [...byUser.entries()]
    .map(([userId, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
      );
      const latest = sorted[0]!;
      const scores = sorted
        .map((x) => x.score)
        .filter((s): s is number => s !== null);
      return {
        userId,
        name: latest.user.name,
        email: latest.user.email,
        attemptCount: sorted.length,
        bestScore: scores.length ? Math.max(...scores) : null,
        latestScore: latest.score,
        latestStatus: latest.status,
        latestCompletedAt: latest.completedAt,
        pendingGrade: latest.pendingManualGrade,
        latestAttemptId: latest.id,
      };
    })
    .sort((a, b) =>
      (a.name ?? a.email).localeCompare(b.name ?? b.email),
    );

  return { exam, learners };
}

export async function getCourseGradesReport(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, slug: true },
  });
  if (!course) return null;

  const courseExams = await prisma.exam.findMany({
    where: {
      archived: false,
      OR: [{ courseId }, { courseItem: { courseId } }],
    },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  const examIds = courseExams.map((e) => e.id);

  const [totalItems, enrollments, progressRows, attempts] = await Promise.all([
    prisma.courseItem.count({ where: { courseId, archived: false } }),
    prisma.enrollment.findMany({
      where: { courseId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.courseItemProgress.findMany({
      where: { courseItem: { courseId, archived: false } },
      select: { userId: true, status: true },
    }),
    examIds.length
      ? prisma.examAttempt.findMany({
          where: {
            examId: { in: examIds },
            status: { in: [...SUBMITTED_STATUSES] },
          },
          orderBy: { completedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const attemptsInCourse = attempts;
  const examSummariesByUser = buildExamSummariesByUser(
    attemptsInCourse.map((a) => ({
      ...a,
      exam: { title: courseExams.find((e) => e.id === a.examId)?.title ?? "" },
    })),
  );

  const completedByUser = new Map<string, number>();
  const userIdsFromProgress = new Set<string>();
  for (const p of progressRows) {
    userIdsFromProgress.add(p.userId);
    if (p.status === "COMPLETED") {
      completedByUser.set(p.userId, (completedByUser.get(p.userId) ?? 0) + 1);
    }
  }

  const userMap = new Map<
    string,
    { id: string; name: string | null; email: string; enrolled: boolean }
  >();
  for (const e of enrollments) {
    userMap.set(e.userId, {
      id: e.user.id,
      name: e.user.name,
      email: e.user.email,
      enrolled: true,
    });
  }
  const missingUserIds = [
    ...new Set([
      ...userIdsFromProgress,
      ...examSummariesByUser.keys(),
    ]),
  ].filter((id) => !userMap.has(id));

  if (missingUserIds.length) {
    const extraUsers = await prisma.user.findMany({
      where: { id: { in: missingUserIds }, archived: false },
      select: { id: true, name: true, email: true },
    });
    for (const u of extraUsers) {
      userMap.set(u.id, { ...u, enrolled: false });
    }
  }

  const learners: CourseLearnerGradeRow[] = [...userMap.values()]
    .map((user) => {
      const userExamSummaries = examSummariesByUser.get(user.id) ?? [];
      const exams: CourseExamGradeCell[] = courseExams.map((exam) => {
        const s = userExamSummaries.find((x) => x.examId === exam.id);
        return {
          examId: exam.id,
          examTitle: exam.title,
          bestScore: s?.bestScore ?? null,
          latestScore: s?.latestScore ?? null,
          latestStatus: s?.latestStatus ?? "—",
          attemptCount: s?.attemptCount ?? 0,
          pendingGrade: s?.pendingGrade ?? false,
          latestAttemptId: s?.latestAttemptId ?? null,
        };
      });
      const completed = completedByUser.get(user.id) ?? 0;
      return {
        userId: user.id,
        name: user.name,
        email: user.email,
        enrolled: user.enrolled,
        completedItems: completed,
        totalItems,
        progressPct: progressPct(completed, totalItems),
        exams,
      };
    })
    .filter(
      (row) =>
        row.enrolled ||
        row.completedItems > 0 ||
        row.exams.some((e) => e.attemptCount > 0),
    )
    .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));

  return { course, courseExams, learners, totalItems };
}
