import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Moon, Sun, Users, File, Clock, Download } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';

// Main App component
const MeetingPlayer = () => {
  // State for available meetings, current meeting, etc.
  const [meetings, setMeetings] = useState([]);
  const [currentMeeting, setCurrentMeeting] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [currentSegment, setCurrentSegment] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [darkMode, setDarkMode] = useState(() => 
    localStorage.getItem('darkMode') === 'true' || window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  // Refs for audio player and wavesurfer
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };
  
  // Load meetings from server
  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const response = await fetch('/api/meetings');
        const data = await response.json();
        setMeetings(data);
      } catch (error) {
        console.error('Error fetching meetings:', error);
        // For demo, create some sample meetings
        setMeetings([
          { id: '1', name: 'Weekly Team Sync', date: '2025-05-10', duration: 3600 },
          { id: '2', name: 'Product Planning', date: '2025-05-08', duration: 2700 },
          { id: '3', name: 'Solvro-Weekly', date: '2025-05-01', duration: 1800 }
        ]);
      }
    };
    
    fetchMeetings();
  }, []);
  
  // Initialize WaveSurfer when a meeting is selected
  useEffect(() => {
    if (currentMeeting && waveformRef.current) {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      
      // Create WaveSurfer instance
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: darkMode ? '#9ca3af' : '#4b5563',
        progressColor: darkMode ? '#60a5fa' : '#3b82f6',
        cursorColor: darkMode ? '#f59e0b' : '#d97706',
        height: 80,
        barWidth: 2,
        barGap: 1,
        responsive: true
      });
      
      wavesurferRef.current = wavesurfer;
      
      // In a real implementation, load the actual audio file
      const audioUrl = `/meetings/${currentMeeting.name}/${currentMeeting.name}.mp3`;
      wavesurfer.load(audioUrl);
      
      wavesurfer.on('ready', () => {
        setDuration(wavesurfer.getDuration());
      });
      
      wavesurfer.on('audioprocess', () => {
        setCurrentTime(wavesurfer.getCurrentTime());
      });
      
      wavesurfer.on('play', () => {
        setIsPlaying(true);
      });
      
      wavesurfer.on('pause', () => {
        setIsPlaying(false);
      });
      
      // Load mock transcription and participants data
      loadMeetingData(currentMeeting.name);
    }
    
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [currentMeeting, darkMode]);
  
  // Apply dark mode on initial load
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);
  
  // Update current segment based on playback time
  useEffect(() => {
    if (transcription) {
      // In a real implementation, this would find the current segment based on timestamps
      const segments = transcription.split('\n\n');
      const segmentIndex = Math.floor((currentTime / duration) * segments.length);
      setCurrentSegment(segments[segmentIndex] || '');
    }
  }, [currentTime, duration, transcription]);
  
  // Simulated function to load meeting data
  const loadMeetingData = async (meetingName) => {
    try {
      // In a real implementation, this would fetch the actual transcription file
      const transcriptionUrl = `/meetings/${meetingName}/${meetingName}.txt`;
      const response = await fetch(transcriptionUrl);
      const text = await response.text();
      setTranscription(text);
      
      // Generate mock participants
      setParticipants([
        { id: '1', name: 'Alice', avatar: '/api/placeholder/40/40', speaking: Math.random() > 0.5, muted: false },
        { id: '2', name: 'Bob', avatar: '/api/placeholder/40/40', speaking: Math.random() > 0.7, muted: false },
        { id: '3', name: 'Charlie', avatar: '/api/placeholder/40/40', speaking: false, muted: true },
        { id: '4', name: 'Diana', avatar: '/api/placeholder/40/40', speaking: Math.random() > 0.8, muted: false }
      ]);
    } catch (error) {
      console.error('Error loading meeting data:', error);
      // Set mock transcription for demo
      setTranscription("This is a sample transcription.\n\nMultiple speakers will be visible in the actual implementation.\n\nThe text will be synchronized with the audio playback.");
    }
  };
  
  // Toggle play/pause
  const togglePlayback = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };
  
  // Format time (seconds to MM:SS)
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Select a meeting
  const selectMeeting = (meeting) => {
    setCurrentMeeting(meeting);
  };
  
  // Render the meeting list or the player
  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Discord Meeting Player
        </h1>
        <button 
          onClick={toggleDarkMode} 
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>
      
      <main className="container mx-auto p-4">
        {!currentMeeting ? (
          // Meeting selection screen
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <File className="h-5 w-5" /> Available Meetings
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {meetings.map(meeting => (
                <div 
                  key={meeting.id} 
                  className="border dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow dark:hover:bg-gray-800"
                  onClick={() => selectMeeting(meeting)}
                >
                  <h3 className="font-semibold text-lg">{meeting.name}</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" /> 
                      {formatTime(meeting.duration)}
                    </span>
                    <span>·</span>
                    <span>{new Date(meeting.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Meeting player screen
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">{currentMeeting.name}</h2>
              <button 
                onClick={() => setCurrentMeeting(null)} 
                className="px-3 py-1 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Back to Meetings
              </button>
            </div>
            
            {/* Audio player */}
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-center mb-3">
                <button 
                  onClick={togglePlayback} 
                  className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <div className="text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              
              {/* Waveform visualization */}
              <div ref={waveformRef} className="my-4 rounded-md overflow-hidden"></div>
              
              {/* Current segment display */}
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm mt-3">
                <p>{currentSegment || "Transcription will appear here during playback..."}</p>
              </div>
            </div>
            
            {/* Participants */}
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5" /> Participants
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {participants.map(participant => (
                  <div 
                    key={participant.id} 
                    className={`flex items-center gap-3 p-2 rounded-md ${participant.speaking ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`}
                  >
                    <div className={`relative ${participant.speaking ? 'animate-pulse' : ''}`}>
                      <img 
                        src={participant.avatar} 
                        alt={participant.name} 
                        className="w-10 h-10 rounded-full"
                      />
                      {participant.muted && (
                        <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                          <VolumeX className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{participant.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {participant.speaking ? 'Speaking...' : participant.muted ? 'Muted' : 'Silent'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Full transcription */}
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <File className="h-5 w-5" /> Complete Transcription
                </h3>
                <button className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400">
                  <Download className="h-4 w-4" /> Export
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                <pre className="whitespace-pre-wrap text-sm">{transcription || "No transcription available"}</pre>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className="p-4 border-t dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
        Discord Meeting Player © 2025 - Weekly Transcription Bot
      </footer>
    </div>
  );
};

export default MeetingPlayer;