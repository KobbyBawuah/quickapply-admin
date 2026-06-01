import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import settingsRouter from "./settings.js";
import usersRouter from "./users.js";
import dashboardRouter from "./dashboard.js";
import templatesRouter from "./templates.js";
import campaignsRouter from "./campaigns.js";
import emailLogsRouter from "./emailLogs.js";
import debugRouter from "./debug.js";
import aiRouter from "./ai.js";
import approvedTemplatesRouter from "./approvedTemplates.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(settingsRouter);
router.use(usersRouter);
router.use(dashboardRouter);
router.use(templatesRouter);
router.use(campaignsRouter);
router.use(emailLogsRouter);
router.use(debugRouter);
router.use(aiRouter);
router.use(approvedTemplatesRouter);

export default router;
