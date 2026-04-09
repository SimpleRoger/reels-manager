import { Router, type IRouter } from "express";
import healthRouter from "./health";
import instagramRouter from "./instagram";
import dashboardRouter from "./dashboard";
import reelsRouter from "./reels";
import analysisRouter from "./analysis";
import playbookRouter from "./playbook";
import referencesRouter from "./references";
import profileRouter from "./profile";
import viralFinderRouter from "./viral-finder";

const router: IRouter = Router();

router.use(healthRouter);
router.use(instagramRouter);
router.use(dashboardRouter);
router.use(reelsRouter);
router.use(analysisRouter);
router.use(playbookRouter);
router.use(referencesRouter);
router.use(profileRouter);
router.use(viralFinderRouter);

export default router;
