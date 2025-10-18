// Projekt: Multiplayer Hide and Seek Web-App mit Live Standorttracking und Coins/Powerup Anzeige

/* ======== BACKEND: server.js ======== */
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));


app.use(express.json());
app.use(cors());

mongoose.connect('mongodb+srv://CTC:1234@ctc.6sdysob.mongodb.net/?retryWrites=true&w=majority&appName=CTC');

const teamSchema = new mongoose.Schema({
name: String,
members: [String],
location: { lat: Number, lng: Number },
coins: { type: Number, default: 0 },
powerups: { skipLocation: { type: Number, default: 0 } }
});
const Team = mongoose.model('Team', teamSchema);

const challengeSchema = new mongoose.Schema({
title: String,
description: String,
rewardCoins: Number
});
const Challenge = mongoose.model('Challenge', challengeSchema);

app.post('/api/teams', async (req, res) => {
const team = new Team(req.body);
await team.save();
res.json(team);
});

app.get('/api/teams', async (req, res) => {
const teams = await Team.find();
res.json(teams);
});

app.get('/api/challenges', async (req, res) => {
const challenges = await Challenge.find();
res.json(challenges);
});

app.post('/api/teams/:id/complete-challenge', async (req, res) => {
const { challengeId } = req.body;
const challenge = await Challenge.findById(challengeId);
const team = await Team.findById(req.params.id);
team.coins += challenge.rewardCoins;
await team.save();
res.json(team);
});

app.post('/api/teams/:id/use-powerup', async (req, res) => {
const { type } = req.body;
const team = await Team.findById(req.params.id);
if (type === 'skip' && team.powerups.skipLocation > 0) {
team.powerups.skipLocation -= 1;
await team.save();
return res.json({ success: true, team });
}
res.json({ success: false, message: 'Keine Powerups verfügbar' });
});

io.on('connection', (socket) => {
console.log('Neuer Client verbunden');

socket.on('updateLocation', async ({ teamId, location }) => {
await Team.findByIdAndUpdate(teamId, { location });
});

const interval = setInterval(async () => {
const teams = await Team.find();
socket.emit('locationUpdate', teams);
}, 300000);

setInterval(() => {
socket.emit('timer', { nextUpdate: new Date(Date.now() + 5*60*1000) });
}, 1000);

socket.on('disconnect', () => clearInterval(interval));
});
