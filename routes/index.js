import express from "express";
import mcpRoutes from "./mcp.routes.js";
import healthRoutes from "./health.routes.js";

const router = express.Router();

router.use("/mcp", mcpRoutes);
router.use("/health", healthRoutes);

// Root endpoint
router.get("/", (req, res) => {
    res.redirect("/health/info");
});

export default router;