import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type CertificatePdfInput = {
  learnerName: string;
  title: string;
  description?: string | null;
  issuedAt: Date;
  expiresAt?: Date | null;
  badgePng?: Buffer | null;
  courseTitle?: string | null;
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Shared Storm Sprinklers certificate PDF template (landscape letter). */
export async function buildCertificatePdf(input: CertificatePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([792, 612]); // landscape letter
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(0.05, 0.12, 0.28);
  const blue = rgb(0, 0.345, 0.878); // #0058E0
  const muted = rgb(0.35, 0.4, 0.48);
  const white = rgb(1, 1, 1);

  // Background
  page.drawRectangle({ x: 0, y: 0, width, height, color: white });

  // Outer border
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: blue,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: navy,
    borderWidth: 1,
  });

  // Header
  page.drawText("STORM SPRINKLERS", {
    x: 60,
    y: height - 78,
    size: 14,
    font: fontBold,
    color: blue,
  });
  page.drawText("Certificate of Completion", {
    x: 60,
    y: height - 108,
    size: 28,
    font: fontBold,
    color: navy,
  });

  // Badge (right side)
  if (input.badgePng && input.badgePng.length > 0) {
    try {
      const badge = await doc.embedPng(input.badgePng);
      const badgeSize = 140;
      page.drawImage(badge, {
        x: width - 60 - badgeSize,
        y: height - 80 - badgeSize,
        width: badgeSize,
        height: badgeSize,
      });
    } catch {
      // ignore bad badge bytes
    }
  }

  page.drawText("This certifies that", {
    x: 60,
    y: height - 170,
    size: 12,
    font,
    color: muted,
  });

  page.drawText(input.learnerName || "Learner", {
    x: 60,
    y: height - 210,
    size: 26,
    font: fontBold,
    color: navy,
  });

  page.drawText("has successfully earned", {
    x: 60,
    y: height - 245,
    size: 12,
    font,
    color: muted,
  });

  page.drawText(input.title, {
    x: 60,
    y: height - 285,
    size: 20,
    font: fontBold,
    color: blue,
    maxWidth: width - 280,
  });

  if (input.courseTitle) {
    page.drawText(`Course: ${input.courseTitle}`, {
      x: 60,
      y: height - 320,
      size: 11,
      font,
      color: muted,
      maxWidth: width - 280,
    });
  }

  if (input.description?.trim()) {
    const desc = input.description.trim();
    page.drawText(desc.length > 420 ? `${desc.slice(0, 417)}…` : desc, {
      x: 60,
      y: height - 360,
      size: 11,
      font,
      color: navy,
      maxWidth: width - 120,
      lineHeight: 15,
    });
  }

  page.drawText(`Issued ${formatDate(input.issuedAt)}`, {
    x: 60,
    y: 70,
    size: 11,
    font,
    color: muted,
  });

  if (input.expiresAt) {
    page.drawText(`Valid through ${formatDate(input.expiresAt)}`, {
      x: 280,
      y: 70,
      size: 11,
      font,
      color: muted,
    });
  }

  return doc.save();
}
