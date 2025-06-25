import mongoose from "mongoose";

const examSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    category: { type: String, required: true },
    level: { type: String, required: true },
    examDate: { type: String, required: true },
    applicationDeadline: { type: String, required: true },
    eligibility: { type: String, required: true },
    pattern: { type: String, required: true },
    colleges: { type: Number, required: true },
    description: { type: String, required: true },
    subjects: [{ type: String, required: true }],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Exam", examSchema);
