const express = require("express");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    category: { type: String, required: true, default: "Digital Kampus" },
    status: { type: String, enum: ["Pengajuan", "Diproses", "Selesai"], default: "Pengajuan" },
    owner: { type: String, required: true, trim: true },
    progress: { type: Number, min: 0, max: 100, default: 0 }
  },
  { timestamps: true }
);

const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);

let usingMemory = false;
let memoryProjects = [
  {
    _id: "demo-1",
    title: "Kampus Digital One",
    description: "Portal terintegrasi untuk akademik, jadwal, pembayaran, dan layanan mahasiswa.",
    category: "Academic",
    status: "Selesai",
    owner: "Tim Digital Akademik",
    progress: 100,
    createdAt: new Date("2026-01-08")
  },
  {
    _id: "demo-2",
    title: "AI Campus Assistant",
    description: "Asisten berbasis AI untuk menjawab pertanyaan akademik dan administrasi kampus.",
    category: "Artificial Intelligence",
    status: "Diproses",
    owner: "Lab AI Kampus",
    progress: 68,
    createdAt: new Date("2026-02-14")
  },
  {
    _id: "demo-3",
    title: "Smart Attendance",
    description: "Presensi QR berbasis lokasi untuk meningkatkan akurasi kehadiran perkuliahan.",
    category: "Smart Campus",
    status: "Diproses",
    owner: "Biro TI",
    progress: 45,
    createdAt: new Date("2026-03-05")
  }
];

async function connectDatabase() {
  if (!process.env.MONGODB_URI) return;
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
}

async function getProjects(req, res, next) {
  try {
    await connectDatabase();
    if (mongoose.connection.readyState === 1) return next();
    usingMemory = true;
  } catch (error) {
    console.error("MongoDB unavailable, using demo memory:", error.message);
    usingMemory = true;
  }
  next();
}

app.use("/api/projects", getProjects);

app.get("/api/projects", async (req, res) => {
  try {
    if (usingMemory || mongoose.connection.readyState !== 1) {
      return res.json(memoryProjects);
    }
    const projects = await Project.find().sort({ createdAt: -1 });
    res.json(projects);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data proyek." });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    if (usingMemory || mongoose.connection.readyState !== 1) {
      const project = {
        ...req.body,
        _id: `demo-${Date.now()}`,
        progress: Number(req.body.progress || 0),
        createdAt: new Date()
      };
      memoryProjects.unshift(project);
      return res.status(201).json(project);
    }
    const project = await Project.create(req.body);
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ message: error.message || "Data proyek tidak valid." });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  try {
    if (usingMemory || mongoose.connection.readyState !== 1) {
      const index = memoryProjects.findIndex((item) => item._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: "Proyek tidak ditemukan." });
      memoryProjects[index] = {
        ...memoryProjects[index],
        ...req.body,
        progress: Number(req.body.progress ?? memoryProjects[index].progress)
      };
      return res.json(memoryProjects[index]);
    }
    const project = await Project.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!project) return res.status(404).json({ message: "Proyek tidak ditemukan." });
    res.json(project);
  } catch (error) {
    res.status(400).json({ message: error.message || "Gagal memperbarui proyek." });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    if (usingMemory || mongoose.connection.readyState !== 1) {
      const index = memoryProjects.findIndex((item) => item._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: "Proyek tidak ditemukan." });
      memoryProjects.splice(index, 1);
      return res.status(204).send();
    }
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) return res.status(404).json({ message: "Proyek tidak ditemukan." });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ message: "Gagal menghapus proyek." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

module.exports = app;
