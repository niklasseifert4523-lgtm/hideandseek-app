import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import cors from "cors";

// --- Setup ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "https://dein-frontend.netlify.app" } // Frontend URL anpassen
});

app.use(cors());
app.use(express.json());

// --- MongoDB verbinden ---
mongoose.connect(process.env.MONGO_URI, {
  ssl: true
});

// --- Team Schema ---
const teamSchema = new mongoose.Schema({
  name: String,
  location: { lat: Number, lng: Number },
  coins: { type: Number, default: 0 },
  powerups: { skipLocation: { type: Number, default: 0 } }
});

const Team = mongoose.model("Team", teamSchema);

// --- Timer für Standortaktualisierung ---
let nextUpdate = Date.now() + 5 * 60 * 1000;

setInterval(async () => {
  const teams = await Team.find();
  io.emit("updateTeams", teams);

  // nächsten Timestamp berechnen
  nextUpdate = Date.now() + 5 * 60 * 1000;
  io.emit("nextUpdate", nextUpdate);

  console.log("Standorte gesendet:", teams.length, "Teams");
}, 5 * 60 * 1000);

// --- Routes ---
// Team registrieren
app.post("/register-team", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Teamname fehlt" });

  try {
    const newTeam = await Team.create({
      name,
      location: { lat: 0, lng: 0 },
      coins: 0,
      powerups: { skipLocation: 0 }
    });
    io.emit("updateTeams", await Team.find());
    res.status(201).json({ message: "Team erfolgreich registriert", team: newTeam });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Socket.io ---
io.on("connection", (socket) => {
  console.log("Neuer Client verbunden:", socket.id);

  // direkt den aktuellen Timestamp senden
  socket.emit("nextUpdate", nextUpdate);

  socket.on("joinRoom", (teamId) => {
    socket.join(teamId);
  });

  socket.on("updateLocation", async ({ teamId, location }) => {
    await Team.findByIdAndUpdate(teamId, { location });
    io.emit("updateTeams", await Team.find());
  });
});

// --- Server starten ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log("Server läuft auf Port", PORT));
