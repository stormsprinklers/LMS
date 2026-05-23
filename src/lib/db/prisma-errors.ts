import { Prisma } from "@prisma/client";

export function isPrismaMissingColumn(
  error: unknown,
  column?: string,
): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2022"
  ) {
    if (!column) return true;
    const meta = error.meta as { column?: string } | undefined;
    return meta?.column === column;
  }
  return false;
}
