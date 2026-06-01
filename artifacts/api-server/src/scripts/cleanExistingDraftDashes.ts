import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { AiContentDraft } from "../models/AiContentDraft.js";
import { ApprovedContentTemplate } from "../models/ApprovedContentTemplate.js";
import { sanitizeDraftForNoDashes } from "../lib/contentSanitizer.js";

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    console.warn(`.env file not found at: ${envPath}`);
    return;
  }

  const envText = fs.readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");

    if (equalIndex === -1) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function connectMongo() {
  loadEnvFile();

  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.DATABASE_URL ||
    "";

  if (!mongoUri) {
    throw new Error(
      "MongoDB URI missing. Add MONGO_URI or MONGODB_URI in artifacts/api-server/.env"
    );
  }

  mongoose.set("bufferCommands", false);

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 30000,
  });

  console.log("MongoDB connected");
}

async function cleanCollection(model: any, name: string) {
  const docs = await model.find({});

  let updated = 0;

  for (const doc of docs) {
    const clean = sanitizeDraftForNoDashes({
      title: doc.title,
      subject: doc.subject,
      preheader: doc.preheader,
      htmlBody: doc.htmlBody,
      textBody: doc.textBody,
      angle: doc.angle,
    });

    doc.title = clean.title;
    doc.subject = clean.subject;
    doc.preheader = clean.preheader;
    doc.htmlBody = clean.htmlBody;
    doc.textBody = clean.textBody;
    doc.angle = clean.angle;

    await doc.save();
    updated += 1;
  }

  console.log(`${name}: cleaned ${updated} documents`);
}

async function main() {
  await connectMongo();

  await cleanCollection(AiContentDraft, "AiContentDraft");
  await cleanCollection(ApprovedContentTemplate, "ApprovedContentTemplate");

  await mongoose.disconnect();

  console.log("Done cleaning existing dashes.");
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exit(1);
});