import { findOrCreateUser, getUserByTelegramId, setUserBanned } from "../../src/services/userService";
import { createTestUser } from "../factories";
import { prisma } from "../../src/lib/prisma";

describe("userService", () => {
  it("creates a new user on first contact", async () => {
    const telegramId = BigInt(111);
    const user = await findOrCreateUser({ telegramId, username: "newuser", firstName: "New" });

    expect(user.id).toBeDefined();
    expect(user.telegramId).toBe(telegramId);
    expect(user.referralCode).toHaveLength(8);
    expect(Number(user.balance)).toBe(0);
    expect(user.isBanned).toBe(false);
  });

  it("returns the same user record on repeated /start calls", async () => {
    const telegramId = BigInt(222);
    const first = await findOrCreateUser({ telegramId, username: "u1" });
    const second = await findOrCreateUser({ telegramId, username: "u1-renamed" });

    expect(second.id).toBe(first.id);
    expect(second.username).toBe("u1-renamed");
    const count = await prisma.user.count({ where: { telegramId } });
    expect(count).toBe(1);
  });

  it("links a new user to a referrer via referral code", async () => {
    const referrer = await createTestUser();
    const referred = await findOrCreateUser({ telegramId: BigInt(333), username: "referred" }, referrer.referralCode);

    expect(referred.referredById).toBe(referrer.id);
  });

  it("ignores an invalid referral code without failing", async () => {
    const user = await findOrCreateUser({ telegramId: BigInt(444), username: "u" }, "DOES-NOT-EXIST");
    expect(user.referredById).toBeNull();
  });

  it("bans and unbans a user", async () => {
    const user = await createTestUser();
    const banned = await setUserBanned(user.id, true);
    expect(banned.isBanned).toBe(true);

    const unbanned = await setUserBanned(user.id, false);
    expect(unbanned.isBanned).toBe(false);
  });

  it("getUserByTelegramId returns null for unknown users", async () => {
    const user = await getUserByTelegramId(BigInt(999999));
    expect(user).toBeNull();
  });
});
