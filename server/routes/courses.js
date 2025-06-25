import express from 'express';
import Course from '../models/Course.js';
import { auth, adminAuth } from '../middleware/auth.js';

const router = express.Router();

// Get all courses
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, category, level, search } = req.query;
    const query = { isPublished: true };

    if (category) query.category = category;
    if (level) query.level = level;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { instructor: { $regex: search, $options: 'i' } }
      ];
    }

    const courses = await Course.find(query)
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Course.countDocuments(query);

    res.json({
      courses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get course by ID
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('createdBy', 'name avatar');
      
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Like/Unlike course
router.post('/:id/like', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Add likes field if it doesn't exist
    if (!course.likes) {
      course.likes = [];
    }

    const isLiked = course.likes.includes(req.userId);
    
    if (isLiked) {
      course.likes = course.likes.filter(id => id.toString() !== req.userId);
    } else {
      course.likes.push(req.userId);
    }

    await course.save();
    res.json({ liked: !isLiked, likesCount: course.likes.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;