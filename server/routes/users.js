import express from "express";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Note from "../models/Note.js";
import Blog from "../models/Blog.js";
import Exam from "../models/Exam.js";
import { auth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js"; // Keep existing upload for other routes if needed
import multer from "multer";
import { uploadToCloudinary } from "../utils/cloudinary.js"; // Import Cloudinary upload function
import path from "path"; // Added path module import

const router = express.Router();

// Configure Multer with memory storage for avatar upload
const memoryStorage = multer.memoryStorage();
const uploadAvatar = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for avatar
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images (JPEG, PNG, GIF) are allowed."
        )
      );
    }
  },
});

// Get user profile with populated data
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("-password")
      .populate(
        "purchasedCourses",
        "title description thumbnail price instructor category"
      )
      .lean();

    // Get bookmarks with populated data
    const bookmarks = [];
    for (const bookmarkId of user.bookmarks || []) {
      let item = await Course.findById(bookmarkId)
        .select("title description thumbnail category")
        .lean();
      if (item) {
        bookmarks.push({ ...item, type: "course" });
        continue;
      }

      item = await Note.findById(bookmarkId)
        .select("title description noteType subject branch year")
        .lean();
      if (item) {
        bookmarks.push({ ...item, type: "note" });
        continue;
      }

      item = await Blog.findById(bookmarkId)
        .select("title excerpt thumbnail category")
        .lean();
      if (item) {
        bookmarks.push({ ...item, type: "blog" });
        continue;
      }
    }

    // Get favorites with populated data
    const favorites = [];
    for (const favoriteId of user.favorites || []) {
      let item = await Course.findById(favoriteId)
        .select("title description thumbnail category")
        .lean();
      if (item) {
        favorites.push({ ...item, type: "course" });
        continue;
      }

      item = await Note.findById(favoriteId)
        .select("title description noteType subject branch year")
        .lean();
      if (item) {
        favorites.push({ ...item, type: "note" });
        continue;
      }

      item = await Blog.findById(favoriteId)
        .select("title excerpt thumbnail category")
        .lean();
      if (item) {
        favorites.push({ ...item, type: "blog" });
        continue;
      }
    }

    // Get user's exam attempts
    const examAttempts = await Exam.find(
      { "attempts.user": req.userId },
      {
        title: 1,
        subject: 1,
        totalMarks: 1,
        "attempts.$": 1,
      }
    ).lean();

    const userAttempts = examAttempts.map((exam) => ({
      examId: exam._id,
      examTitle: exam.title,
      subject: exam.subject,
      totalMarks: exam.totalMarks,
      ...exam.attempts[0],
    }));

    // Calculate stats
    const stats = {
      totalCourses: user.purchasedCourses?.length || 0,
      totalBookmarks: bookmarks.length,
      totalFavorites: favorites.length,
      totalExamAttempts: userAttempts.length,
      averageScore:
        userAttempts.length > 0
          ? Math.round(
              userAttempts.reduce((sum, attempt) => sum + attempt.score, 0) /
                userAttempts.length
            )
          : 0,
    };

    res.json({
      ...user,
      bookmarks,
      favorites,
      examAttempts: userAttempts,
      stats,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: error.message });
  }
});

// Update profile
router.put(
  "/profile",
  auth,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      const updateData = { ...req.body };

      if (req.file) {
        // Upload to Cloudinary
        const result = await uploadToCloudinary(
          req.file.buffer,
          `college-compass/images/avatar_${req.userId}`,
          "image"
        );
        updateData.avatar = result.secure_url; // Save Cloudinary URL
      }

      // Convert year to number if provided
      if (updateData.year) {
        updateData.year = parseInt(updateData.year);
      }

      const user = await User.findByIdAndUpdate(req.userId, updateData, {
        new: true,
        runValidators: true,
      }).select("-password");

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: error.message });
    }
  }
);

// Add to bookmarks
router.post("/bookmarks", auth, async (req, res) => {
  try {
    const { itemId, itemType } = req.body;

    if (!itemId || !itemType) {
      return res.status(400).json({ message: "Item ID and type are required" });
    }

    const user = await User.findById(req.userId);

    if (!user.bookmarks.includes(itemId)) {
      user.bookmarks.push(itemId);
      await user.save();
    }

    res.json({ message: "Added to bookmarks", bookmarked: true });
  } catch (error) {
    console.error("Error adding bookmark:", error);
    res.status(500).json({ message: error.message });
  }
});

// Remove from bookmarks
router.delete("/bookmarks/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.bookmarks = user.bookmarks.filter(
      (id) => id.toString() !== req.params.id
    );
    await user.save();

    res.json({ message: "Removed from bookmarks", bookmarked: false });
  } catch (error) {
    console.error("Error removing bookmark:", error);
    res.status(500).json({ message: error.message });
  }
});

// Add to favorites
router.post("/favorites", auth, async (req, res) => {
  try {
    const { itemId, itemType } = req.body;

    if (!itemId || !itemType) {
      return res.status(400).json({ message: "Item ID and type are required" });
    }

    const user = await User.findById(req.userId);

    if (!user.favorites.includes(itemId)) {
      user.favorites.push(itemId);
      await user.save();
    }

    res.json({ message: "Added to favorites", favorited: true });
  } catch (error) {
    console.error("Error adding favorite:", error);
    res.status(500).json({ message: error.message });
  }
});

// Remove from favorites
router.delete("/favorites/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    user.favorites = user.favorites.filter(
      (id) => id.toString() !== req.params.id
    );
    await user.save();

    res.json({ message: "Removed from favorites", favorited: false });
  } catch (error) {
    console.error("Error removing favorite:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get user's learning progress
router.get("/progress", auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate("purchasedCourses");

    // Get exam attempts
    const examAttempts = await Exam.find(
      { "attempts.user": req.userId },
      { title: 1, subject: 1, totalMarks: 1, "attempts.$": 1 }
    );

    // Calculate progress metrics
    const progress = {
      coursesEnrolled: user.purchasedCourses.length,
      coursesCompleted: 0, // This would be calculated based on course progress
      examsAttempted: examAttempts.length,
      averageScore:
        examAttempts.length > 0
          ? Math.round(
              examAttempts.reduce(
                (sum, exam) => sum + exam.attempts[0].score,
                0
              ) / examAttempts.length
            )
          : 0,
      totalStudyTime: 0, // This would be tracked separately
      achievements: [], // This would be based on milestones
    };

    res.json(progress);
  } catch (error) {
    console.error("Error fetching progress:", error);
    res.status(500).json({ message: error.message });
  }
});

// Change password
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new passwords are required" });
    }

    const user = await User.findById(req.userId);

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: error.message });
  }
});

// Delete account
router.delete("/account", auth, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res
        .status(400)
        .json({ message: "Password is required to delete account" });
    }

    const user = await User.findById(req.userId);

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password is incorrect" });
    }

    // Deactivate account instead of deleting
    user.isActive = false;
    await user.save();

    res.json({ message: "Account deactivated successfully" });
  } catch (error) {
    console.error("Error deleting account:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
