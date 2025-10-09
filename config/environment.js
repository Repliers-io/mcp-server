import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

export const NODE_ENV = process.env.NODE_ENV || "";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
const envFile = NODE_ENV ? `.${NODE_ENV}.env` : ".env";
const envPath = path.resolve(__dirname, `../${envFile}`);
try {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }
} catch (err) {
    console.error("[FATAL] Error loading .env file:", err);
    process.exit(1);
}
export const PORT = process.env.PORT || 3001;
