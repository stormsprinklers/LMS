import { prisma } from "@/lib/db";
import { toManualDTO } from "@/lib/mappers";
import type { Manual } from "@/lib/types";

export async function getManuals(): Promise<Manual[]> {
  const manuals = await prisma.manualAsset.findMany({
    where: { archived: false },
    orderBy: { updatedAt: "desc" },
  });
  return manuals.map((m) => toManualDTO(m));
}

export async function getManualById(id: string) {
  return prisma.manualAsset.findUnique({ where: { id } });
}
