import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import courseRoutes from "./routes/courses.js";
import noteRoutes from "./routes/notes.js";
import blogRoutes from "./routes/blogs.js";
import examRoutes from "./routes/exams.js";
import adminRoutes from "./routes/admin.js";
import contactRoutes from "./routes/contact.js";
import paymentRoutes from "./routes/payments.js";
import { initMega } from "./utils/mega.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://ccr-collegecompass-projects.vercel.app",
  process.env.NODE_ENV === "development" && "http://localhost:5173",
  process.env.NODE_ENV === "development" && "http://localhost:3000",
].filter(Boolean); // Remove undefined/null values

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Handle preflight requests
app.options("*", cors());

// Middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Create uploads directory
const uploadsDir = path.join(__dirname, "Uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(UploadsDir, { recursive: true });
}

// Serve static files
app.use("/Uploads", express.static(uploadsDir));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/payments", paymentRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "College Compass API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    frontendUrl: process.env.FRONTEND_URL || "Not set",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()} - ${err.stack}`);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  console.warn(
    `[WARN] ${new Date().toISOString()} - 404: Route ${
      req.originalUrl
    } not found`
  );
  res.status(404).json({ success: false, message: "Route not found" });
});

// Connect to MongoDB, initialize Mega, and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Initialize Mega
    try {
      await initMega();
      console.log("✅ Mega storage initialized");
    } catch (megaError) {
      console.error(
        `⚠️ Failed to initialize Mega storage: ${megaError.message}`
      );
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(
        `📱 Frontend URL: ${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }`
      );
      console.log(
        `🔧 API URL: ${
          process.env.NODE_ENV === "production"
            ? "https://ccr-backend.onrender.com"
            : `http://localhost:${PORT}`
        }`
      );
      console.log(
        `👨‍💼 Admin Panel: ${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/admin`
      );
    });
  } catch (error) {
    console.error(`❌ Database connection error: ${error.message}`);
    process.exit(1);
  }
};

startServer();
