import mongoose from "mongoose";
import { getSettings } from "../models/Settings.js";

export async function getUserCollection() {
  const settings = await getSettings();

  const dbName =
    settings.databaseName ||
    process.env.MONGO_DB_NAME ||
    process.env.MONGODB_DB ||
    "test";

  const collectionName =
    settings.usersCollection ||
    process.env.USERS_COLLECTION ||
    "users";

  return mongoose.connection.useDb(dbName).collection(collectionName);
}

function asDate(value: any): Date | null {
  if (!value) return null;

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d;
}

export function getUserActivityDate(user: any): Date | null {
  // For inactivity, do NOT use updatedAt.
  // updatedAt changes because of profile/data updates, not necessarily login activity.
  return asDate(user.lastLoginAt) || asDate(user.createdAt);
}

export function computeDaysInactive(userOrDate: any): number {
  const d =
    userOrDate && typeof userOrDate === "object"
      ? getUserActivityDate(userOrDate)
      : asDate(userOrDate);

  if (!d) return -1;

  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function getUserDisplayName(user: any): string {
  return (
    user.name ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
    user.email ||
    "Unknown User"
  );
}

export function getUserPlan(user: any): string {
  return (
    user.subscriptionPlanName ||
    user.plan ||
    (user.subscription === true || user.subscription === "true" ? "paid" : "free")
  );
}

export function getUserSubscriptionStatus(user: any): string {
  if (user.subscriptionStatus) return String(user.subscriptionStatus);

  return user.subscription === true || user.subscription === "true"
    ? "active"
    : "free";
}

export function buildUserQuery(
  filter?: string,
  search?: string
): Record<string, any> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const and: any[] = [];

  if (search?.trim()) {
    const s = search.trim();

    and.push({
      $or: [
        { email: { $regex: s, $options: "i" } },
        { firstName: { $regex: s, $options: "i" } },
        { lastName: { $regex: s, $options: "i" } },
        { loginFrom: { $regex: s, $options: "i" } },
        { language: { $regex: s, $options: "i" } },
        { subscriptionPlanName: { $regex: s, $options: "i" } },
      ],
    });
  }

  if (filter === "active") {
    and.push({
      $or: [
        { lastLoginAt: { $gte: sevenDaysAgo } },
        {
          $or: [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }],
          createdAt: { $gte: sevenDaysAgo },
        },
      ],
    });
  }

  if (filter === "inactive7") {
    and.push({
      $or: [
        { lastLoginAt: { $lt: sevenDaysAgo, $exists: true } },
        {
          $or: [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }],
          createdAt: { $lt: sevenDaysAgo, $exists: true },
        },
      ],
    });
  }

  if (filter === "inactive14") {
    and.push({
      $or: [
        { lastLoginAt: { $lt: fourteenDaysAgo, $exists: true } },
        {
          $or: [{ lastLoginAt: { $exists: false } }, { lastLoginAt: null }],
          createdAt: { $lt: fourteenDaysAgo, $exists: true },
        },
      ],
    });
  }

  if (filter === "free") {
    and.push({
      $or: [
        { subscription: false },
        { subscription: "false" },
        { subscription: { $exists: false } },
      ],
    });
  }

  if (filter === "paid") {
    and.push({
      $or: [{ subscription: true }, { subscription: "true" }],
    });
  }

  if (filter === "trial") {
    and.push({
      $or: [
        { subscriptionStatus: "trial" },
        { plan: "trial" },
        { subscriptionPlanName: { $regex: "trial", $options: "i" } },
      ],
    });
  }

  if (filter === "expired") {
    and.push({
      $or: [
        { subscriptionStatus: "expired" },
        { plan: "expired" },
        { subscriptionPlanName: { $regex: "expired", $options: "i" } },
      ],
    });
  }

  if (filter === "neverLoggedIn") {
    and.push({
      $or: [
        { isFirstLogin: true },
        { lastLoginAt: { $exists: false } },
        { lastLoginAt: null },
      ],
    });
  }

  if (filter === "doNotContact") {
    and.push({ doNotContact: true });
  }

  if (and.length === 0) return {};
  if (and.length === 1) return and[0];

  return { $and: and };
}