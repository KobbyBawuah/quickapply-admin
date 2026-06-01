import { EmailTemplate } from "../models/EmailTemplate.js";
import { logger } from "./logger.js";

const INACTIVE_TEMPLATES = [
  {
    name: "Still applying the slow way?",
    angle: "Sunday night anxiety before applying",
    subject: "Still applying the slow way?",
    htmlBody: `<p>Hi {{firstName}},</p>
<p>Most people don't lose momentum because they lack talent. They lose it because every application feels like another unpaid task.</p>
<p>QuickApply Pro helps you move faster without lowering the quality:</p>
<ul>
<li>Tailor your resume to a role in under 60 seconds</li>
<li>Autofill application forms with the Chrome extension</li>
<li>Check job posts for scam signals before you invest time</li>
<li>Prep for interviews before the callback lands</li>
</ul>
<p>If you're still watching roles and waiting for the right one, this is the faster way to act when it appears.</p>
<p><a href="{{ctaUrl}}">Continue with QuickApply Pro</a></p>
<br/>
<p style="font-size:12px;color:#999;">You're receiving this because you signed up for QuickApply Pro. <a href="{{ctaUrl}}">Manage preferences or unsubscribe</a>.</p>`,
    textBody: `Hi {{firstName}},\n\nMost people don't lose momentum because they lack talent. They lose it because every application feels like another unpaid task.\n\nQuickApply Pro helps you move faster without lowering the quality.\n\nContinue with QuickApply Pro: {{ctaUrl}}`,
  },
  {
    name: "The professional who's not desperate yet",
    angle: "Working professional bored in current role",
    subject: "Keeping your options open?",
    htmlBody: `<p>Hi {{firstName}},</p>
<p>You're not desperate. You're not sending applications from panic. But you're keeping an eye open — because you know the right role could appear any time.</p>
<p>The problem is that when it does appear, most people aren't ready. Their resume isn't updated. Their cover letter takes hours. Their application goes in a week late.</p>
<p>QuickApply Pro keeps you ready:</p>
<ul>
<li>Resume tailored to any job description in under 60 seconds</li>
<li>Chrome extension that autofills forms in one click</li>
<li>Resume grader that shows you exactly where you stand</li>
</ul>
<p>The best opportunities go to people who move fast. Keep moving.</p>
<p><a href="{{ctaUrl}}">Get back in QuickApply Pro</a></p>
<br/>
<p style="font-size:12px;color:#999;">You're receiving this because you signed up for QuickApply Pro. <a href="{{ctaUrl}}">Manage preferences or unsubscribe</a>.</p>`,
    textBody: `Hi {{firstName}},\n\nYou're not desperate. But the best opportunities go to people who move fast.\n\nQuickApply Pro keeps you ready. Get back in: {{ctaUrl}}`,
  },
  {
    name: "50 applications, 0 callbacks",
    angle: "Applying to 50 jobs and hearing nothing",
    subject: "Volume doesn't work. Here's what does.",
    htmlBody: `<p>Hi {{firstName}},</p>
<p>Sending 50 applications with the same resume is not a strategy. It's noise. Hiring systems filter it out before a human ever reads it.</p>
<p>What actually works: one resume, tailored to one job description, applied within the first 48 hours.</p>
<p>QuickApply Pro makes that fast enough to scale:</p>
<ul>
<li>Tailored resume in under 60 seconds</li>
<li>Instant ATS compatibility check</li>
<li>Auto-detect scam job posts before you waste a full application</li>
<li>Chrome extension that fills forms so you can apply faster</li>
</ul>
<p>Work smarter. Not louder.</p>
<p><a href="{{ctaUrl}}">Try QuickApply Pro again</a></p>
<br/>
<p style="font-size:12px;color:#999;">You're receiving this because you signed up for QuickApply Pro. <a href="{{ctaUrl}}">Manage preferences or unsubscribe</a>.</p>`,
    textBody: `Hi {{firstName}},\n\nVolume doesn't work. Tailored applications do.\n\nQuickApply Pro: {{ctaUrl}}`,
  },
  {
    name: "60 seconds resume tailoring",
    angle: "Resume tailoring in under 60 seconds",
    subject: "Your resume in 60 seconds. Seriously.",
    htmlBody: `<p>Hi {{firstName}},</p>
<p>The biggest reason good candidates get filtered out? Their resume doesn't match the job description closely enough.</p>
<p>Not because they're unqualified. Because tailoring a resume properly takes 45 minutes and most people skip it.</p>
<p>QuickApply Pro does it in under 60 seconds:</p>
<ul>
<li>Paste the job description</li>
<li>Get a tailored version of your resume</li>
<li>See your ATS match score instantly</li>
</ul>
<p>It's not a shortcut. It's a smarter process.</p>
<p><a href="{{ctaUrl}}">Use QuickApply Pro now</a></p>
<br/>
<p style="font-size:12px;color:#999;">You're receiving this because you signed up for QuickApply Pro. <a href="{{ctaUrl}}">Manage preferences or unsubscribe</a>.</p>`,
    textBody: `Hi {{firstName}},\n\nTailored resumes in under 60 seconds — not a shortcut, a smarter process.\n\nQuickApply Pro: {{ctaUrl}}`,
  },
  {
    name: "Fraud detection before you apply",
    angle: "Interview prep and fraud detection",
    subject: "Before you spend time on that application...",
    htmlBody: `<p>Hi {{firstName}},</p>
<p>Job fraud is more common than most people realize. Fake postings that collect your personal information. Roles that don't exist. Interviews that waste hours.</p>
<p>QuickApply Pro flags suspicious posts before you apply:</p>
<ul>
<li>Scam signal detection built into the job review flow</li>
<li>Interview prep based on actual role requirements</li>
<li>Resume tailoring so you're ready when a real opportunity appears</li>
</ul>
<p>Protect your time. Apply to roles worth your effort.</p>
<p><a href="{{ctaUrl}}">Return to QuickApply Pro</a></p>
<br/>
<p style="font-size:12px;color:#999;">You're receiving this because you signed up for QuickApply Pro. <a href="{{ctaUrl}}">Manage preferences or unsubscribe</a>.</p>`,
    textBody: `Hi {{firstName}},\n\nProtect your time. Detect job fraud before you apply.\n\nQuickApply Pro: {{ctaUrl}}`,
  },
];

const NEWSLETTER_TEMPLATES = [
  {
    name: "Job Market Newsletter",
    angle: "General newsletter",
    subject: "{{topic}} — QuickApply Pro",
    htmlBody: `<p>Hi {{firstName}},</p>
<p><strong>{{topic}}</strong></p>
<p>This is something most job seekers don't talk about enough. Here's what we've seen:</p>
<ul>
<li>The job market rewards preparation, not volume</li>
<li>Tailored applications consistently outperform generic ones</li>
<li>Most candidates spend more time applying than preparing — and it shows</li>
<li>International job seekers face additional friction that good tooling can reduce</li>
<li>The first 48 hours of a posting are the most competitive — speed matters</li>
</ul>
<p>QuickApply Pro is built around these realities. Faster tailoring, smarter screening, better preparation.</p>
<p>If you haven't used it recently, now might be a good time to check what's new.</p>
<p><a href="{{ctaUrl}}">Visit QuickApply Pro</a></p>
<br/>
<p style="font-size:12px;color:#999;">You're receiving this because you signed up for QuickApply Pro. <a href="{{ctaUrl}}">Manage preferences or unsubscribe</a>.</p>`,
    textBody: `Hi {{firstName}},\n\n{{topic}}\n\nQuickApply Pro is built for faster, smarter job applications.\n\nVisit: {{ctaUrl}}`,
  },
];

export async function seedTemplatesIfEmpty(): Promise<void> {
  const count = await EmailTemplate.countDocuments();
  if (count > 0) return;

  logger.info("Seeding email templates...");
  for (const t of INACTIVE_TEMPLATES) {
    await EmailTemplate.create({ ...t, campaignType: "inactive", isActive: true });
  }
  for (const t of NEWSLETTER_TEMPLATES) {
    await EmailTemplate.create({ ...t, campaignType: "newsletter", isActive: true });
  }
  logger.info("Email templates seeded");
}
