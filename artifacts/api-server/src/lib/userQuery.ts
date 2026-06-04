import mongoose from "mongoose";
import { getSettings } from "../models/Settings.js";

function envString(key: string): string | undefined {
  const value = process.env[key];

  if (value === undefined || value === null) return undefined;

  const clean = String(value).trim();

  return clean === "" ? undefined : clean;
}

export async function getUserCollection() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB is not connected");
  }

  const settings = await getSettings();

  const dbName =
    envString("MONGO_DB_NAME") ||
    envString("MONGODB_DB") ||
    settings.databaseName ||
    "test";

  const collectionName =
    envString("USERS_COLLECTION") ||
    settings.usersCollection ||
    "users";

  return mongoose.connection.useDb(dbName).collection(collectionName);
}

function asDate(value: any): Date | null {
  if (!value) return null;

  const d = new Date(value);

  return Number.isNaN(d.getTime()) ? null : d;
}

export function getUserActivityDate(user: any): Date | null {
  return (
    asDate(user.lastLoginAt) ||
    asDate(user.lastActiveAt) ||
    asDate(user.loginAt) ||
    asDate(user.updatedAt) ||
    asDate(user.createdAt)
  );
}

export function computeDaysInactive(userOrDate: any): number {
  const d =
    userOrDate && typeof userOrDate === "object"
      ? getUserActivityDate(userOrDate)
      : asDate(userOrDate);

  if (!d) return -1;

  return Math.max(
    0,
    Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
  );
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

function activityOlderThan(days: number) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return {
    $or: [
      { lastLoginAt: { $lt: cutoff, $exists: true, $ne: null } },
      { lastActiveAt: { $lt: cutoff, $exists: true, $ne: null } },
      { loginAt: { $lt: cutoff, $exists: true, $ne: null } },
      {
        $and: [
          {
            $or: [
              { lastLoginAt: { $exists: false } },
              { lastLoginAt: null },
            ],
          },
          {
            $or: [
              { lastActiveAt: { $exists: false } },
              { lastActiveAt: null },
            ],
          },
          {
            $or: [{ loginAt: { $exists: false } }, { loginAt: null }],
          },
          {
            $or: [
              { updatedAt: { $lt: cutoff, $exists: true } },
              { createdAt: { $lt: cutoff, $exists: true } },
            ],
          },
        ],
      },
    ],
  };
}

function activityNewerThan(days: number) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return {
    $or: [
      { lastLoginAt: { $gte: cutoff } },
      { lastActiveAt: { $gte: cutoff } },
      { loginAt: { $gte: cutoff } },
      { updatedAt: { $gte: cutoff } },
      { createdAt: { $gte: cutoff } },
    ],
  };
}

export function buildUserQuery(
  filter?: string,
  search?: string
): Record<string, any> {
  const and: any[] = [];

  if (search?.trim()) {
    const s = search.trim();

    and.push({
      $or: [
        { email: { $regex: s, $options: "i" } },
        { firstName: { $regex: s, $options: "i" } },
        { lastName: { $regex: s, $options: "i" } },
        { name: { $regex: s, $options: "i" } },
        { loginFrom: { $regex: s, $options: "i" } },
        { language: { $regex: s, $options: "i" } },
        { subscriptionPlanName: { $regex: s, $options: "i" } },
      ],
    });
  }

  if (filter === "active") {
    and.push(activityNewerThan(7));
  }

  if (filter === "inactive7") {
    and.push(activityOlderThan(7));
  }

  if (filter === "inactive14") {
    and.push(activityOlderThan(14));
  }

  if (filter === "free") {
    and.push({
      $or: [
        { subscription: false },
        { subscription: "false" },
        { subscriptionStatus: "free" },
        { plan: "free" },
        { subscription: { $exists: false } },
      ],
    });
  }

  if (filter === "paid") {
    and.push({
      $or: [
        { subscription: true },
        { subscription: "true" },
        { subscriptionStatus: "active" },
        { plan: "paid" },
      ],
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