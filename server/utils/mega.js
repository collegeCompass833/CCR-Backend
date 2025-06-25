import { Storage } from "megajs";

let storageMega;
let notesFolder, pptFolder, docsFolder, thumbnailsFolder;

export function initMega() {
  return new Promise((resolve, reject) => {
    storageMega = new Storage({
      email: process.env.MEGA_EMAIL,
      password: process.env.MEGA_PASSWORD,
    });

    storageMega.on("error", (err) => {
      console.error("MEGA login error:", err);
      reject(err);
    });

    storageMega.once("ready", async () => {
      console.log("✅ MEGA logged in and ready.");
      notesFolder = await findOrCreateFolder("Notes");
      pptFolder = await findOrCreateFolder("PPT");
      docsFolder = await findOrCreateFolder("Docs");
      thumbnailsFolder = await findOrCreateFolder("Thumbnails");
      resolve();
    });
  });
}

async function findOrCreateFolder(folderName) {
  const existing = storageMega.root.children?.find(
    (child) => child.directory && child.name === folderName
  );
  if (existing) return existing;
  try {
    const newFolder = await storageMega.root.mkdir(folderName);
    return newFolder;
  } catch (err) {
    throw err;
  }
}

export function findNodeById(node, nodeId) {
  if (node.nodeId === nodeId) return node;
  if (!node.children) return null;
  for (const child of node.children) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

export function collectAllFiles(node, fileList = []) {
  if (!node.directory) return fileList;
  for (const child of node.children || []) {
    if (child.directory) collectAllFiles(child, fileList);
    else fileList.push({ name: child.name, nodeId: child.nodeId });
  }
  return fileList;
}

export function getTargetFolder(filename) {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return notesFolder;
  if (["ppt", "pptx"].includes(ext)) return pptFolder;
  if (["doc", "docx"].includes(ext)) return docsFolder;
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext))
    return thumbnailsFolder;
  return notesFolder;
}

export function checkMegaReady(req, res, next) {
  if (!storageMega)
    return res.status(500).json({ message: "MEGA not initialized" });
  next();
}
