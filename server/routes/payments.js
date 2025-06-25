import express from 'express';
import { auth } from '../middleware/auth.js';
import User from '../models/User.js';
import Course from '../models/Course.js';

const router = express.Router();

// Mock payment system for development
// In production, integrate with actual payment gateway

// Create order (mock)
router.post('/create-order', auth, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Mock order creation
    const order = {
      id: `order_${Date.now()}`,
      amount: course.price * 100, // amount in paise
      currency: 'INR',
      receipt: `course_${courseId}_${req.userId}`,
      status: 'created'
    };

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify payment (mock)
router.post('/verify-payment', auth, async (req, res) => {
  try {
    const { courseId } = req.body;

    // Mock payment verification - always successful for development
    const user = await User.findById(req.userId);
    if (!user.purchasedCourses.includes(courseId)) {
      user.purchasedCourses.push(courseId);
      await user.save();
    }

    // Update course enrollment count
    await Course.findByIdAndUpdate(courseId, {
      $inc: { enrolledStudents: 1 }
    });

    res.json({ message: 'Payment verified and course enrolled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Free enrollment (for development)
router.post('/enroll-free', auth, async (req, res) => {
  try {
    const { courseId } = req.body;
    
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const user = await User.findById(req.userId);
    if (!user.purchasedCourses.includes(courseId)) {
      user.purchasedCourses.push(courseId);
      await user.save();
    }

    // Update course enrollment count
    await Course.findByIdAndUpdate(courseId, {
      $inc: { enrolledStudents: 1 }
    });

    res.json({ message: 'Successfully enrolled in course' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;