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
import videoAnalysisRouter from "./video-analysis";
import dmImporterRouter from "./dm-importer";
import reelSearchRouter from "./reel-search";
import trendingReelsRouter from "./trending-reels";
import mediaProxyRouter from "./media-proxy";

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
router.use(videoAnalysisRouter);
router.use(dmImporterRouter);
router.use(reelSearchRouter);
router.use(trendingReelsRouter);
router.use(mediaProxyRouter);

export default router;
