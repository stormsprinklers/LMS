import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { bootstrapDatabase } from "./seed-bootstrap";

config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error(`
DATABASE_URL is missing. For local dev, copy .env.example to .env.local.

On Vercel, seeding runs automatically during deploy — no local seed required.
`);
  process.exit(1);
}

const prisma = new PrismaClient();

async function reset() {
  await prisma.certification.deleteMany();
  await prisma.examAttempt.deleteMany();
  await prisma.answerOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.videoAsset.deleteMany();
  await prisma.manualAsset.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.module.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.certificationRule.deleteMany();
  await prisma.courseAssignment.deleteMany();
  await prisma.course.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await reset();
  const { adminEmail, adminPassword } = await bootstrapDatabase(prisma);

  console.log("Local seed complete (database reset).");
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log("Employee: employee@stormsprinklers.com / demo123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
