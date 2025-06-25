import express from "express";
import Exam from "../models/Exam.js";
import { auth, adminAuth } from "../middleware/auth.js";

const router = express.Router();



// Get all exams
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, subject, category, level, search } = req.query;
    const query = {};

    if (subject) query.subjects = { $in: [subject] };
    if (category) query.category = category;
    if (level) query.level = level;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } }
      ];
    }

    const exams = await Exam.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Exam.countDocuments(query);

    res.json({
      exams,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get exam by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create exam (Admin only)
router.post("/", adminAuth, async (req, res) => {
  try {
    const exam = new Exam({
      ...req.body,
    });

    await exam.save();
    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update exam (Admin only)
router.put("/:id", adminAuth, async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    res.json(exam);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
