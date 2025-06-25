import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    noteType: {
      type: String,
      required: true,
      enum: ["College", "Government Exam", "Other"],
      trim: true,
    },
    branch: {
      type: String,
      required: function () {
        return this.noteType === "College";
      },
      trim: true,
    },
    year: {
      type: String,
      required: function () {
        return this.noteType === "College";
      },
      trim: true,
    },
    subject: {
      type: String,
      required: function () {
        return (
          this.noteType === "College" || this.noteType === "Government Exam"
        );
      },
      trim: true,
    },
    examName: {
      type: String,
      required: function () {
        return this.noteType === "Government Exam";
      },
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    downloadLink: {
      type: String,
      required: true,
      trim: true,
    },
    megaId: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    fileType: {
      type: String,
      required: true,
      trim: true,
    },
    // image: {
    //   type: String,
    //   default: "",
    //   trim: true,
    // },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    bookmarks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Note", noteSchema);
