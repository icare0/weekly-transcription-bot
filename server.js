const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const setupPlaceholderService = require('./src/utils/placeholder-service');

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

// Set up the placeholder service
setupPlaceholderService(app);

// API endpoint to get meetings
app.get('/api/meetings', (req, res) => {
  try {
    if (!fs.existsSync(MEETINGS_DIR)) {
      console.error(`Meetings directory not found: ${MEETINGS_DIR}`);
      return res.status(404).json({ error: 'Meetings directory not found' });
    }

    const directories = fs.readdirSync(MEETINGS_DIR)
      .filter(file => {
        const fullPath = path.join(MEETINGS_DIR, file);
        return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
      });
    
    console.log(`Found ${directories.length} meeting directories`);
    
    const meetings = directories.map(dir => {
      const meetingPath = path.join(MEETINGS_DIR, dir);
      let files = [];
      
      try {
        files = fs.readdirSync(meetingPath);
      } catch (err) {
        console.error(`Error reading directory ${meetingPath}:`, err);
        return null;
      }
      
      // List all files for debugging
      console.log(`Files in ${dir}:`, files);
      
      // Get stats for the meeting directory
      const stats = fs.statSync(meetingPath);
      
      // Look for audio files
      const mp3File = files.find(file => file.endsWith('.mp3'));
      const oggFile = files.find(file => file.endsWith('.ogg'));
      const audioFile = mp3File || oggFile;
      
      // Check for metadata JSON file
      const jsonFile = files.find(file => file.endsWith('.json'));
      
      return {
        id: dir,
        name: dir,
        date: stats.mtime.toISOString().split('T')[0],
        recorded: files.some(file => file.endsWith('.mp3') || file.endsWith('.ogg')),
        transcribed: files.some(file => file.endsWith('.txt')),
        summarized: files.some(file => file.endsWith('.md')),
        hasMetadata: files.some(file => file.endsWith('.json')),
        audioFile: audioFile,
        metadataFile: jsonFile
      };
    }).filter(Boolean); // Remove null entries
    
    res.json(meetings);
  } catch (error) {
    console.error('Error retrieving meetings:', error);
    res.status(500).json({ error: 'Failed to retrieve meetings: ' + error.message });
  }
});

// Improved audio serving endpoint with proper headers and error handling
app.get('/meetings/:meetingName/:fileName', (req, res) => {
  try {
    const { meetingName, fileName } = req.params;
    
    // Validate inputs to prevent path traversal
    if (meetingName.includes('..') || fileName.includes('..')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    const filePath = path.join(MEETINGS_DIR, meetingName, fileName);
    
    console.log(`Requested file: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // Set appropriate content type based on file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType;
    
    switch (ext) {
      case '.mp3':
        contentType = 'audio/mpeg';
        break;
      case '.ogg':
        contentType = 'audio/ogg';
        break;
      case '.txt':
        contentType = 'text/plain; charset=utf-8';
        break;
      case '.md':
        contentType = 'text/markdown; charset=utf-8';
        break;
      case '.json':
        contentType = 'application/json; charset=utf-8';
        break;
      default:
        contentType = 'application/octet-stream';
    }
    
    // Handle range requests for better streaming
    const range = req.headers.range;
    
    if (range && (ext === '.mp3' || ext === '.ogg')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      
      // Validate range
      if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize) {
        res.status(416).send('Range Not Satisfiable');
        return;
      }
      
      const chunkSize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      // Set appropriate headers for range request
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      });
      
      file.pipe(res);
    } else {
      // Set appropriate headers for full file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file: ' + error.message });
  }
});

// Get transcription file
app.get('/api/transcription/:meetingName', (req, res) => {
  try {
    const { meetingName } = req.params;
    
    // Validate input
    if (meetingName.includes('..')) {
      return res.status(400).json({ error: 'Invalid meeting name' });
    }
    
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
    
    // Validate input
    if (meetingName.includes('..')) {
      return res.status(400).json({ error: 'Invalid meeting name' });
    }
    
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

// Get meeting metadata
app.get('/api/metadata/:meetingName', (req, res) => {
  try {
    const { meetingName } = req.params;
    
    // Validate input
    if (meetingName.includes('..')) {
      return res.status(400).json({ error: 'Invalid meeting name' });
    }
    
    const filePath = path.join(MEETINGS_DIR, meetingName, `${meetingName}.json`);
    
    console.log(`Requested metadata: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`Metadata not found: ${filePath}`);
      return res.status(404).json({ error: 'Metadata not found' });
    }
    
    const metadata = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(metadata);
  } catch (error) {
    console.error('Error retrieving metadata:', error);
    res.status(500).json({ error: 'Failed to retrieve metadata: ' + error.message });
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