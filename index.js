const express = require('express');
const bodyParser = require('body-parser');
const socketIo = require('socket.io')

const app = express();
const PORT = 5000;

// Use bodyParser middleware to parse incoming JSON data
app.use(bodyParser.json());

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Webhook server is listening at http://localhost:${PORT}`);
});

const io = socketIo(server, { cors: { origin: '*' } });

// Define your webhook endpoint
app.post('/webhook', (req, res) => {
  const eventData = req.body; // Data received from the webhook

  // Process the eventData and take actions as needed
  console.log('Webhook data received:', eventData.imageUrls);

  io.emit('generatedImages', eventData.imageUrls)

  // Respond to the webhook request
  res.status(200).send('Webhook data received successfully');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('message', (data) => {
    console.log('Message received:', data);
    io.emit('message', data); // Broadcast the message to all connected clients
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});
