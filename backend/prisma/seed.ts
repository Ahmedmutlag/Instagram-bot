import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  const existingAdmin = await prisma.admin.findFirst({ where: { email: { equals: adminEmail, mode: "insensitive" } } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.admin.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: "المدير العام",
        role: "SUPER_ADMIN",
      },
    });
    // eslint-disable-next-line no-console
    console.log(`Created default admin: ${adminEmail} / ${adminPassword} (change this password immediately)`);
  } else {
    // eslint-disable-next-line no-console
    console.log(`Admin ${adminEmail} already exists, skipping.`);
  }

  const defaultSettings: Record<string, string> = {
    botName: "SMM Reseller Bot",
    currency: "USD",
    language: "ar",
    supportUsername: "@support",
    minDeposit: "5",
    referralPercent: "5",
    botToken: "",
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seeded default settings.");
  // eslint-disable-next-line no-console
  console.log(
    "No providers or services were seeded — add your own SMM API provider(s) and services from the admin dashboard (Providers -> Add Provider)."
  );
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
