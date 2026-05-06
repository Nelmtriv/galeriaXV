const express = require("express");
const multer = require("multer");
const cors = require("cors");
require("dotenv").config();

const { v2: cloudinary } = require("cloudinary");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

console.log("ENV STATUS:", {
  cloud_name: process.env.CLOUD_NAME ? "OK" : "MISSING",
  api_key: process.env.API_KEY ? "OK" : "MISSING",
  api_secret: process.env.API_SECRET ? "OK" : "MISSING",
  admin_token: process.env.ADMIN_TOKEN ? "OK" : "MISSING",
});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Apenas imagens são permitidas!"));
    }
    cb(null, true);
  },
});

function isAdmin(req) {
  return req.headers.authorization === process.env.ADMIN_TOKEN;
}

app.post("/upload", upload.single("photo"), (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "Ficheiro inválido" });
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: "evento" },
      (error, result) => {
        if (error) {
          return res.status(500).json({ error: error.message });
        }

        res.json({
          success: true,
          url: result.secure_url,
          public_id: result.public_id,
          created_at: result.created_at
        });
      }
    );

    stream.end(req.file.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/photos", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:evento")
      .sort_by("created_at", "desc")
      .max_results(50)
      .execute();

    res.json(result.resources);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================================
   DELETE (CORRIGIDO E MAIS SEGURO)
================================ */
app.post("/delete", async (req, res) => {
  try {
    console.log("HEADERS:", req.headers);
    console.log("BODY:", req.body);

    if (!isAdmin(req)) {
      console.log("ADMIN FALHOU");
      return res.status(403).json({ error: "Sem permissão" });
    }

    const { public_id } = req.body;

    console.log("PUBLIC_ID:", public_id);

    if (!public_id) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const result = await cloudinary.uploader.destroy(public_id);

    console.log("CLOUDINARY RESULT:", result);

    res.json({ success: true, result });

  } catch (err) {
    console.log("ERRO:", err);
    res.status(500).json({ error: err.message });
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});