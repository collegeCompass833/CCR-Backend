
import multer from "multer";
import path from "path";

// Configure Multer with memory storage for admin uploads
const memoryStorage = multer.memoryStorage();

const uploadAdminFiles = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for files
    files: 2, // Allow up to 2 files (file and image)
  },
  fileFilter: (req, file, cb) => {
    // Define allowed file types based on fieldname
    if (file.fieldname === "file") {
      // For note files, allow PDF, DOC, DOCX, PPT, PPTX, TXT
      const allowedTypes = /pdf|doc|docx|ppt|pptx|txt|sdocx/;
      const extname = allowedTypes.test(
        path.extname(file.originalname).toLowerCase()
      );
      const mimetype = allowedTypes.test(file.mimetype);
      if (mimetype && extname) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, TXT are allowed for notes."
          )
        );
      }
    } else if (file.fieldname === "image") {
      // For images, allow JPEG, JPG, PNG, GIF
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
            "Invalid file type. Only JPEG, JPG, PNG, GIF are allowed for images."
          )
        );
      }
    } else {
      cb(new Error("Unknown field name. Only 'file' and 'image' are allowed."));
    }
  },
}).fields([
  { name: "file", maxCount: 1 }, // Main file field
  { name: "image", maxCount: 1 }, // Image field (optional)
]);

export { uploadAdminFiles };
