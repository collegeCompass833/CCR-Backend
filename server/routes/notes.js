
import express from 'express';
import Note from '../models/Note.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Get all notes
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, noteType, subject, search } = req.query;
    const query = {};

    if (noteType) query.noteType = noteType;
    if (subject) query.subject = subject;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
        { branch: { $regex: search, $options: 'i' } },
        { year: { $regex: search, $options: 'i' } },
        { examName: { $regex: search, $options: 'i' } }
      ];
    }

    const notes = await Note.find(query)
      .populate('uploadedBy', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Note.countDocuments(query);

    res.json({
      notes,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get note by ID
router.get('/:id', async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('uploadedBy', 'name avatar');
      
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Download note
router.post('/:id/download', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Increment download count
    note.downloadCount += 1;
    await note.save();

    // Return updated note
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Like/Unlike note
router.post('/:id/like', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const isLiked = note.likes.includes(req.userId);
    
    if (isLiked) {
      note.likes = note.likes.filter(id => id.toString() !== req.userId);
    } else {
      note.likes.push(req.userId);
    }

    await note.save();
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bookmark/Unbookmark note
router.post('/:id/bookmark', auth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    const isBookmarked = note.bookmarks.includes(req.userId);
    
    if (isBookmarked) {
      note.bookmarks = note.bookmarks.filter(id => id.toString() !== req.userId);
    } else {
      note.bookmarks.push(req.userId);
    }

    await note.save();
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;

