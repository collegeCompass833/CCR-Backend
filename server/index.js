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

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "Uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
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
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Connect to MongoDB, initialize Mega, and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/college-compass"
    );
    console.log("✅ Connected to MongoDB");

    // Initialize Mega
    try {
      await initMega();
      console.log("✅ Mega storage initialized");
    } catch (megaError) {
      console.error("⚠️ Failed to initialize Mega storage:", megaError.message);
      // Continue server startup even if Mega fails
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(
        `📱 Frontend URL: ${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }`
      );
      console.log(`🔧 API URL: http://localhost:${PORT}`);
      console.log(
        `👨‍💼 Admin Panel: ${
          process.env.FRONTEND_URL || "http://localhost:5173"
        }/admin`
      );
    });
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
};

startServer();
