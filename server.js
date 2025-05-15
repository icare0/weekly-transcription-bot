const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Create Express app
const app = express();
const PORT = process.env.WEB_PORT || 3000;

// Enhanced middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/public')));

// Define meeting directory
const MEETINGS_DIR = path.join(__dirname, 'meetings');

// Middleware to log all requests - useful for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API endpoint to get meetings
app.get('/api/meetings', (req, res) => {
  try {
    if (!fs.existsSync(MEETINGS_DIR)) {
      console.error(`Meetings directory not found: ${MEETINGS_DIR}`);
      return res.status(404).json({ error: 'Meetings directory not found' });
    }

    const directories = fs.readdirSync(MEETINGS_DIR)
      .filter(file => {
        const stat = fs.statSync(path.join(MEETINGS_DIR, file));
        return stat.isDirectory();
      });
    
    console.log(`Found ${directories.length} meeting directories`);
    
    const meetings = directories.map(dir => {
      const meetingPath = path.join(MEETINGS_DIR, dir);
      const files = fs.readdirSync(meetingPath);
      
      // List all files for debugging
      console.log(`Files in ${dir}:`, files);
      
      // Get stats for the meeting directory
      const stats = fs.statSync(meetingPath);
      
      // Look for MP3 file to get duration (simplified)
      const mp3File = files.find(file => file.endsWith('.mp3'));
      
      return {
        id: dir,
        name: dir,
        date: stats.mtime.toISOString().split('T')[0],
        recorded: files.some(file => file.endsWith('.mp3') || file.endsWith('.ogg')),
        transcribed: files.some(file => file.endsWith('.txt')),
        summarized: files.some(file => file.endsWith('.md')),
        audioFile: mp3File,
        audioPath: mp3File ? `/api/audio/${dir}/${mp3File}` : null
      };
    });
    
    res.json(meetings);
  } catch (error) {
    console.error('Error retrieving meetings:', error);
    res.status(500).json({ error: 'Failed to retrieve meetings: ' + error.message });
  }
});

// Improved audio serving endpoint with proper headers and error handling
app.get('/api/audio/:meetingName/:fileName', (req, res) => {
  try {
    const { meetingName, fileName } = req.params;
    const filePath = path.join(MEETINGS_DIR, meetingName, fileName);
    
    console.log(`Requested audio file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).json({ error: 'Audio file not found' });
    }
    
    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // Handle range requests for better streaming
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      // Set appropriate headers for range request
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600'
      });
      
      file.pipe(res);
    } else {
      // Set appropriate headers for full file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving audio file:', error);
    res.status(500).json({ error: 'Failed to serve audio file: ' + error.message });
  }
});

// Get transcription file
app.get('/api/transcription/:meetingName', (req, res) => {
  try {
    const { meetingName } = req.params;
    const filePath = path.join(MEETINGS_DIR, meetingName, `${meetingName}.txt`);
    
    console.log(`Requested transcription: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`Transcription not found: ${filePath}`);
      return res.status(404).json({ error: 'Transcription not found' });
    }
    
    const transcription = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(transcription);
  } catch (error) {
    console.error('Error retrieving transcription:', error);
    res.status(500).json({ error: 'Failed to retrieve transcription: ' + error.message });
  }
});

// Get summary file
app.get('/api/summary/:meetingName', (req, res) => {
  try {
    const { meetingName } = req.params;
    const filePath = path.join(MEETINGS_DIR, meetingName, `${meetingName}.md`);
    
    console.log(`Requested summary: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`Summary not found: ${filePath}`);
      return res.status(404).json({ error: 'Summary not found' });
    }
    
    const summary = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(summary);
  } catch (error) {
    console.error('Error retrieving summary:', error);
    res.status(500).json({ error: 'Failed to retrieve summary: ' + error.message });
  }
});

// Fallback route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`======================================`);
  console.log(`Meeting Player server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log(`Meetings directory: ${MEETINGS_DIR}`);
  console.log(`======================================`);
});

module.exports = app;