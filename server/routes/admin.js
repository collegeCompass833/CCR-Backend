import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Course from "../models/Course.js";
import Note from "../models/Note.js";
import Blog from "../models/Blog.js";
import Exam from "../models/Exam.js";
import { adminAuth } from "../middleware/auth.js";
import { uploadAdminFiles } from "../utils/multer.js"; 
import {
  checkMegaReady,
  getTargetFolder,
  findNodeById,
} from "../utils/mega.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

const router = express.Router();

/*
-----------------------------------
Notes Routes ( Not Working.... )
-----------------------------------
*/

// POST /notes - Create a new note
router.post(
  "/notes",
  adminAuth,
  uploadAdminFiles,
  checkMegaReady,
  async (req, res) => {
    let megaNodeId = null;
    try {
      const {
        title,
        noteType,
        description,
        branch,
        year,
        subject,
        examName,
        tags,
      } = req.body;

      const file = req.files?.file?.[0];

      // Log incoming data
      console.log("Incoming note data:", {
        title,
        noteType,
        description,
        branch,
        year,
        subject,
        examName,
        tags,
        hasFile: !!file,
        fileName: file?.originalname,
        fileSize: file?.size,
      });

      // Validate required fields
      if (!file) {
        return res
          .status(400)
          .json({ success: false, message: "File is required" });
      }
      if (!title || !noteType || !description) {
        return res.status(400).json({
          success: false,
          message: "Title, note type, and description are required",
        });
      }
      if (noteType === "College" && (!branch || !year || !subject)) {
        return res.status(400).json({
          success: false,
          message: "Branch, year, and subject are required for College notes",
        });
      }
      if (noteType === "Government Exam" && (!subject || !examName)) {
        return res.status(400).json({
          success: false,
          message: "Subject and exam name are required for Government Exam notes",
        });
      }

      // Check for duplicate note
      const recentNote = await Note.findOne({
        title,
        uploadedBy: req.userId,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
      });
      if (recentNote) {
        return res.status(400).json({
          success: false,
          message:
            "A note with this title was recently created. Please wait or use a different title.",
        });
      }

      // Upload to MEGA
      const folder = getTargetFolder(file.originalname);
      if (!folder) {
        return res
          .status(500)
          .json({ success: false, message: "Target MEGA folder not found" });
      }

      const megaNode = await new Promise((resolve, reject) => {
        const uploadStream = folder.upload({
          name: file.originalname,
          size: file.size,
        });
        uploadStream.write(file.buffer);
        uploadStream.end();

        uploadStream.on("complete", resolve);
        uploadStream.on("error", reject);
      });

      megaNodeId = megaNode.nodeId || megaNode.id;
      const downloadLink = await megaNode.link(false);

      // Parse tags if provided
      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
          if (!Array.isArray(parsedTags)) {
            return res
              .status(400)
              .json({ success: false, message: "Tags must be an array" });
          }
        } catch (err) {
          console.error("Tag parsing error:", err.message);
          return res
            .status(400)
            .json({ success: false, message: "Invalid tags format" });
        }
      }

      // Create Note in DB
      const noteData = {
        title,
        noteType,
        description,
        branch: noteType === "College" ? branch : undefined,
        year: noteType === "College" ? year : undefined,
        subject: noteType !== "Other" ? subject : undefined,
        examName: noteType === "Government Exam" ? examName : undefined,
        downloadLink,
        megaId: megaNodeId,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        tags: parsedTags,
        uploadedBy: req.userId,
      };

      console.log("Saving note to DB:", noteData);
      const note = new Note(noteData);
      await note.save();

      res.status(201).json({
        success: true,
        message: "Note uploaded successfully",
        note,
      });
    } catch (error) {
      console.error("Note Upload Error:", error);

      // Clean up MEGA file
      if (megaNodeId) {
        try {
          const folder = getTargetFolder(req.files?.file?.[0]?.originalname);
          const node = findNodeById(folder, megaNodeId);
          if (node) {
            await node.delete();
            console.log(`✅ Cleaned up Mega file: ${megaNodeId}`);
          }
        } catch (cleanupError) {
          console.warn("⚠️ Mega cleanup failed:", cleanupError.message);
        }
      }

      // Handle Multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ success: false, message: "File size exceeds 100MB limit" });
      }
      if (error.message.includes("Invalid file type")) {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, TXT allowed",
        });
      }

      res.status(500).json({
        success: false,
        message: "Server error during note upload",
        error: error.message,
      });
    }
  }
);

// PUT /notes/:id - Update an existing note
router.put(
  "/notes/:id",
  adminAuth,
  uploadAdminFiles,
  checkMegaReady,
  async (req, res) => {
    let megaNodeId = null;
    try {
      const { id } = req.params;
      const {
        title,
        noteType,
        description,
        branch,
        year,
        subject,
        examName,
        tags,
      } = req.body;
      const file = req.files?.file?.[0];

      // Log incoming data
      console.log("Updating note ID:", id, {
        title,
        noteType,
        description,
        branch,
        year,
        subject,
        examName,
        tags,
        hasFile: !!file,
        fileName: file?.originalname,
        fileSize: file?.size,
      });

      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid note ID" });
      }

      // Find existing note
      const existingNote = await Note.findById(id);
      if (!existingNote) {
        return res
          .status(404)
          .json({ success: false, message: "Note not found" });
      }

      // Validate conditional fields
      if (noteType) {
        if (noteType === "College" && (!branch || !year || !subject)) {
          return res.status(400).json({
            success: false,
            message: "Branch, year, and subject are required for College notes",
          });
        }
        if (noteType === "Government Exam" && (!subject || !examName)) {
          return res.status(400).json({
            success: false,
            message: "Subject and exam name are required for Government Exam notes",
          });
        }
      }

      // Prepare update data
      const updateData = {
        title: title || existingNote.title,
        noteType: noteType || existingNote.noteType,
        description: description || existingNote.description,
        branch:
          noteType === "College"
            ? branch
            : noteType !== undefined
            ? undefined
            : existingNote.branch,
        year:
          noteType === "College"
            ? year
            : noteType !== undefined
            ? undefined
            : existingNote.year,
        subject:
          noteType !== "Other"
            ? subject
            : noteType !== undefined
            ? undefined
            : subject,
        examName:
          noteType === "Government Exam"
            ? examName
            : noteType !== undefined
            ? undefined
            : existingNote.examName,
        tags: existingNote.tags,
      };

      // Parse tags
      if (tags) {
        try {
          updateData.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
          if (!Array.isArray(updateData.tags)) {
            return res.status(400).json({
              success: false,
              message: "Tags must be an array",
            });
          }
        } catch (error) {
          console.error("Tag parsing error:", error);
          return res.status(400).json({
            success: false,
            message: "Invalid tags format",
            error: error.message,
          });
        }
      }

      // Handle file upload to Mega
      if (file) {
        const folder = getTargetFolder(file.originalname);
        if (!folder) {
          return res.status(500).json({
            success: false,
            message: "Target MEGA folder not found",
          });
        }

        // Upload new file
        const megaNode = await new Promise((resolve, reject) => {
          const uploadStream = folder.upload({
            name: file.originalname,
            size: file.size,
          });
          uploadStream.write(file.buffer);
          uploadStream.end();

          uploadStream.on("complete", (node) => resolve(node));
          uploadStream.on("error", (err) => reject(err));
        });
        megaNodeId = megaNode.nodeId || megaNode.id;

        const downloadLink = await megaNode.link(false);

        // Delete old Mega file if exists
        if (existingNote.megaId) {
          try {
            const oldNode = findNodeById(folder, existingNote.megaId);
            if (oldNode) {
              await oldNode.delete();
              console.log(`Deleted old Mega file: ${existingNote.megaId}`);
            } else {
              console.warn(`Old Mega node file ${existingNote.megaId} not found`);
            }
          } catch (error) {
            console.warn(
              `Failed to delete old Mega file ${existingNote.megaId}:`,
              error.message
            );
          }
        }

        // Update file fields
        updateData.downloadLink = downloadLink;
        updateData.megaId = megaNodeId || "";
        updateData.fileName = file.originalname;
        updateData.fileSize = file.size;
        updateData.fileType = file.mimetype;
      }

      // Update note
      console.log("Updating note in DB:", updateData);
      const updatedNote = await Note.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      res.json({
        success: true,
        message: "Note updated successfully",
        note: updatedNote,
      });
    } catch (error) {
      console.error("Note Update Error:", error);

      // Cleanup: Delete new Mega file
      if (megaNodeId) {
        try {
          const folder = getTargetFolder(req.files?.file?.[0]?.originalname);
          const node = findNodeById(folder, megaNodeId);
          if (node) {
            await node.delete();
            console.log(`✅ Cleaned up Mega file: ${megaNodeId}`);
          }
        } catch (cleanupError) {
          console.warn("⚠️ Mega cleanup failed:", cleanupError.message);
        }
      }

      // Handle Multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "File size exceeds 100MB limit",
        });
      }
      if (error.message.includes("Invalid file type")) {
        return res.status(400).json({
          success: false,
          message: "Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, TXT allowed",
        });
      }

      res.status(500).json({
        success: false,
        message: "Server error during note update",
        error: error.message,
      });
    }
  }
);


// DELETE /notes/:id - Delete a note
router.delete("/notes/:id", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid note ID" });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res
        .status(404)
        .json({ success: false, message: "Note not found" });
    }

    // Delete Mega file (if exists)
    if (note.megaId) {
      try {
        const folder = getTargetFolder(note.fileName);
        const node = findNodeById(folder, note.megaId);
        if (node) {
          await node.delete();
          console.log(`Deleted Mega file: ${note.megaId}`);
        }
      } catch (error) {
        console.warn(
          `Failed to delete Mega file ${note.megaId}:`,
          error.message
        );
      }
    }

    // Delete note from database
    await Note.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: "Note deleted successfully" });
  } catch (error) {
    console.error("Note Delete Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete note",
        error: error.message,
      });
  }
});







// GET /stats - Admin dashboard statistics
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const [
      totalUsers,
      totalCourses,
      totalNotes,
      totalBlogs,
      totalExams,
      recentUsers,
      recentCourses,
      totalDownloads,
    ] = await Promise.all([
      User.countDocuments({ role: "user" }),
      Course.countDocuments(),
      Note.countDocuments(),
      Blog.countDocuments(),
      Exam.countDocuments(),
      User.find({ role: "user" })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email createdAt"),
      Course.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title price createdAt"),
      Note.aggregate([
        { $group: { _id: null, total: { $sum: "$downloadCount" } } },
      ]),
    ]);

    res.json({
      totalUsers,
      totalCourses,
      totalNotes,
      totalBlogs,
      totalExams,
      totalDownloads: totalDownloads[0]?.total || 0,
      recentUsers,
      recentCourses,
    });
  } catch (error) {
    console.error("Stats Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch stats",
        error: error.message,
      });
  }
});

// GET /content - Fetch paginated content (courses, notes, blogs, exams)
router.get("/content", adminAuth, async (req, res) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    let Model;

    switch (type) {
      case "courses":
        Model = Course;
        break;
      case "notes":
        Model = Note;
        break;
      case "blogs":
        Model = Blog;
        break;
      case "exams":
        Model = Exam;
        break;
      default:
        return res
          .status(400)
          .json({ success: false, message: "Invalid content type" });
    }

    const content = await Model.find()
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Model.countDocuments();

    res.json({
      success: true,
      content,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
    });
  } catch (error) {
    console.error("Content Fetch Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch content",
        error: error.message,
      });
  }
});






/*
-----------------------------------
Blogs Routes ( Working porperly )
-----------------------------------
*/

// POST /blogs - Create a new blog
router.post(
  "/blogs",
  adminAuth,
  uploadAdminFiles,
  async (req, res) => {
    let cloudinaryPublicId = null;
    try {
      const {
        title,
        summary,
        excerpt,
        content,
        category,
        author,
        publishDate,
        readTime,
        tags,
      } = req.body;

      const image = req.files?.image?.[0];

      // Log incoming request data for debugging
      console.log("Incoming blog data:", {
        title,
        summary,
        excerpt,
        content,
        category,
        author,
        publishDate,
        readTime,
        tags,
        hasImage: !!image,
        imageName: image?.originalname,
        imageSize: image?.size,
      });

      // Validate required fields
      if (!title || !summary || !excerpt || !content || !category || !author || !publishDate || !readTime) {
        return res.status(400).json({
          success: false,
          message: "All fields (title, summary, excerpt, content, category, author, publish date, read time) are required",
        });
      }
      if (!image) {
        return res.status(400).json({
          success: false,
          message: "Image is required for new blogs",
        });
      }

      // Validate publishDate format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
        return res.status(400).json({
          success: false,
          message: "Invalid publish date format. Use YYYY-MM-DD",
        });
      }

      // Parse tags
      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
          if (!Array.isArray(parsedTags)) {
            return res
              .status(400)
              .json({ success: false, message: "Tags must be an array" });
          }
        } catch (err) {
          console.error("Tag parsing error:", err.message);
          return res
            .status(400)
            .json({ success: false, message: "Invalid tags format" });
        }
      }

      // Upload image to Cloudinary using your utility
      let imageUrl = "";
      try {
        if (!image.buffer || image.buffer.length === 0) {
          console.warn("Empty image buffer detected");
          return res.status(400).json({
            success: false,
            message: "Invalid image file: empty buffer",
          });
        }
        console.log("Uploading image to Cloudinary:", {
          name: image.originalname,
          size: image.size,
          mimetype: image.mimetype,
        });
        const result = await uploadToCloudinary(image.buffer, "lms-images", "image");
        imageUrl = result.secure_url;
        cloudinaryPublicId = result.public_id;
        console.log("Cloudinary Upload Success:", {
          public_id: result.public_id,
          url: result.secure_url,
        });
      } catch (cloudError) {
        console.error("Cloudinary upload error:", cloudError);
        return res.status(400).json({
          success: false,
          message: `Failed to upload image to Cloudinary: ${cloudError.message || "Unknown error"}`,
        });
      }

      // Create Blog in DB
      const blogData = {
        title,
        summary,
        excerpt,
        content,
        category,
        author,
        publishDate: new Date(publishDate),
        readTime,
        image: imageUrl,
        cloudinaryPublicId,
        tags: parsedTags,
        uploadedBy: req.userId,
      };

      console.log("Saving blog to DB:", blogData);
      const blog = new Blog(blogData);
      await blog.save();

      res.status(201).json({
        success: true,
        message: "Blog created successfully",
        blog,
      });
    } catch (error) {
      console.error("Blog Creation Error:", error);

      // Clean up Cloudinary image if uploaded
      if (cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(cloudinaryPublicId);
          console.log(`✅ Cleaned up Cloudinary image: ${cloudinaryPublicId}`);
        } catch (cleanupError) {
          console.warn("⚠️ Cloudinary cleanup failed:", cleanupError.message);
        }
      }

      // Handle Multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ success: false, message: "File size exceeds 100MB limit" });
      }
      if (error.message.includes("Invalid file type")) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid file type. Only images (JPEG, PNG, GIF) are allowed" });
      }

      res.status(500).json({
        success: false,
        message: "Server error during blog creation",
        error: error.message,
      });
    }
  }
);

// PUT /blogs/:id - Update an existing blog
router.put(
  "/blogs/:id",
  adminAuth,
  uploadAdminFiles,
  async (req, res) => {
    let cloudinaryPublicId = null;
    try {
      const { id } = req.params;
      const {
        title,
        summary,
        excerpt,
        content,
        category,
        author,
        publishDate,
        readTime,
        tags,
      } = req.body;
      const image = req.files?.image?.[0];

      // Log incoming request data for debugging
      console.log("Updating blog ID:", id, {
        title,
        summary,
        excerpt,
        content,
        category,
        author,
        publishDate,
        readTime,
        tags,
        hasImage: !!image,
        imageName: image?.originalname,
        imageSize: image?.size,
      });

      // Validate ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid blog ID" });
      }

      // Find existing blog
      const existingBlog = await Blog.findById(id);
      if (!existingBlog) {
        return res
          .status(404)
          .json({ success: false, message: "Blog not found" });
      }

      // Validate publishDate format if provided
      if (publishDate && !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
        return res.status(400).json({
          success: false,
          message: "Invalid publish date format. Use YYYY-MM-DD",
        });
      }

      // Parse tags if provided
      let parsedTags = existingBlog.tags;
      if (tags) {
        try {
          parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
          if (!Array.isArray(parsedTags)) {
            return res
              .status(400)
              .json({ success: false, message: "Tags must be an array" });
          }
        } catch (error) {
          console.error("Tag parsing error:", error.message);
          return res
            .status(400)
            .json({ success: false, message: "Invalid tags format" });
        }
      }

      // Prepare update data
      const updateData = {
        title: title || existingBlog.title,
        summary: summary || existingBlog.summary,
        excerpt: excerpt || existingBlog.excerpt,
        content: content || existingBlog.content,
        category: category || existingBlog.category,
        author: author || existingBlog.author,
        publishDate: publishDate ? new Date(publishDate) : existingBlog.publishDate,
        readTime: readTime || existingBlog.readTime,
        tags: parsedTags,
        image: existingBlog.image,
        cloudinaryPublicId: existingBlog.cloudinaryPublicId,
      };

      // Handle image upload to Cloudinary
      if (image) {
        try {
          if (!image.buffer || image.buffer.length === 0) {
            console.warn("Empty image buffer detected");
            updateData.image = existingBlog.image || "";
            updateData.cloudinaryPublicId = existingBlog.cloudinaryPublicId || "";
          } else {
            console.log("Uploading new image to Cloudinary:", {
              name: image.originalname,
              size: image.size,
              mimetype: image.mimetype,
            });
            const result = await uploadToCloudinary(image.buffer, "lms-images", "image");
            updateData.image = result.secure_url;
            cloudinaryPublicId = result.public_id;
            console.log("Cloudinary Upload Success:", {
              public_id: result.public_id,
              url: result.secure_url,
            });

            // Delete old Cloudinary image if exists
            if (existingBlog.cloudinaryPublicId) {
              try {
                await cloudinary.uploader.destroy(existingBlog.cloudinaryPublicId);
                console.log(
                  `Deleted old Cloudinary image: ${existingBlog.cloudinaryPublicId}`
                );
              } catch (error) {
                console.warn(
                  `Failed to delete old Cloudinary image ${existingBlog.cloudinaryPublicId}:`,
                  error.message
                );
              }
            }
          }
        } catch (cloudError) {
          console.error("Cloudinary upload error:", cloudError);
          updateData.image = existingBlog.image || "";
          updateData.cloudinaryPublicId = existingBlog.cloudinaryPublicId || "";
        }
      }

      // Update blog
      console.log("Updating blog in DB:", updateData);
      const updatedBlog = await Blog.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      res.json({
        success: true,
        message: "Blog updated successfully",
        blog: updatedBlog,
      });
    } catch (error) {
      console.error("Blog Update Error:", error);

      // Cleanup: Delete new Cloudinary image if uploaded
      if (cloudinaryPublicId) {
        try {
          await cloudinary.uploader.destroy(cloudinaryPublicId);
          console.log(`Cleaned up Cloudinary image: ${cloudinaryPublicId}`);
        } catch (cleanupError) {
          console.warn("Cloudinary cleanup failed:", cleanupError.message);
        }
      }

      // Handle specific Multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ success: false, message: "File size exceeds 100MB limit" });
      }
      if (error.message.includes("Invalid file type")) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid file type. Only images (JPEG, PNG, GIF) are allowed" });
      }

      res.status(500).json({
        success: false,
        message: "Server error during blog update",
        error: error.message,
      });
    }
  }
);


// DELETE /blogs/:id - Delete a blog
router.delete("/blogs/:id", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid blog ID" });
    }

    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) {
      return res
        .status(404)
        .json({ success: false, message: "Blog not found" });
    }

    res.json({ success: true, message: "Blog deleted successfully" });
  } catch (error) {
    console.error("Blog Delete Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete blog",
        error: error.message,
      });
  }
});

/*
-----------------------------------
Users Routes ( Working porperly )
-----------------------------------
*/

// GET /users - Fetch paginated users with search
router.get("/users", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
    });
  } catch (error) {
    console.error("Users Fetch Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch users",
        error: error.message,
      });
  }
});

// PATCH /users/:id/toggle-status - Toggle user active status
router.patch("/users/:id/toggle-status", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${
        user.isActive ? "activated" : "deactivated"
      } successfully`,
    });
  } catch (error) {
    console.error("User Status Toggle Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to toggle user status",
        error: error.message,
      });
  }
});

// DELETE /users/:id - Delete a user
router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("User Delete Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete user",
        error: error.message,
      });
  }
});

// DELETE /courses/:id - Delete a course
router.delete("/courses/:id", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid course ID" });
    }

    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      return res
        .status(404)
        .json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, message: "Course deleted successfully" });
  } catch (error) {
    console.error("Course Delete Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete course",
        error: error.message,
      });
  }
});




/*
-----------------------------------
Exams Routes ( Working porperly )
-----------------------------------
*/ 


// POST /exams - Create a new exam
router.post("/exams", adminAuth, async (req, res) => {
  try {
    const examData = { ...req.body };
    const exam = new Exam(examData);
    await exam.save();
    res
      .status(201)
      .json({ success: true, message: "Exam created successfully", exam });
  } catch (error) {
    console.error("Exam Create Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to create exam",
        error: error.message,
      });
  }
});

// PUT /exams/:id - Update an exam
router.put("/exams/:id", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid exam ID" });
    }

    const updateData = { ...req.body };
    const exam = await Exam.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!exam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    res.json({ success: true, message: "Exam updated successfully", exam });
  } catch (error) {
    console.error("Exam Update Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update exam",
        error: error.message,
      });
  }
});

// DELETE /exams/:id - Delete an exam
router.delete("/exams/:id", adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid exam ID" });
    }

    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    res.json({ success: true, message: "Exam deleted successfully" });
  } catch (error) {
    console.error("Exam Delete Error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete exam",
        error: error.message,
      });
  }
});

export default router;
