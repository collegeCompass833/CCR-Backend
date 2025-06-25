import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  avatar: {
    type: String,
    default: ''
  },
  college: {
    type: String,
    default: ''
  },
  course: {
    type: String,
    default: ''
  },
  year: {
    type: Number,
    default: 1
  },
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'bookmarkType'
  }],
  bookmarkType: {
    type: String,
    enum: ['Course', 'Note', 'Blog'],
    default: 'Course'
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'favoriteType'
  }],
  favoriteType: {
    type: String,
    enum: ['Course', 'Note', 'Blog'],
    default: 'Course'
  },
  purchasedCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);