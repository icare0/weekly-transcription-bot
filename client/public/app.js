// Helper functions
const formatTime = (time) => {
  if (isNaN(time)) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Main App component
const App = () => {
  // State
  const [darkMode, setDarkMode] = React.useState(
    localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [meetings, setMeetings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [selectedMeeting, setSelectedMeeting] = React.useState(null);
  const [transcription, setTranscription] = React.useState('');
  const [summary, setSummary] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('player');
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [volume, setVolume] = React.useState(0.8);
  const [isMuted, setIsMuted] = React.useState(false);
  const [meetingData, setMeetingData] = React.useState(null);
  const [loadingMeetingData, setLoadingMeetingData] = React.useState(false);
  const [activeSpeakers, setActiveSpeakers] = React.useState([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [participantStats, setParticipantStats] = React.useState([]);
  const [voiceActivities, setVoiceActivities] = React.useState([]);
  
  const waveformRef = React.useRef(null);
  const wavesurferRef = React.useRef(null);

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

  // Fetch meetings on component mount
  React.useEffect(() => {
    const fetchMeetings = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/meetings');
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        setMeetings(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching meetings:', err);
        setError('Failed to load meetings. Please check if the meetings directory exists.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeetings();

    // Set dark mode on mount
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Process and analyze participant speaking patterns
  const processSpeakingData = (data) => {
    if (!data || !data.events || !data.participants) return [];
    
    // Create a time-based map of activity for each participant
    const timeSegments = Math.ceil(data.endTime ? (data.endTime - data.startTime) / 1000 : 3600);
    const segmentDuration = 5; // 5-second segments for visualization
    const numSegments = Math.ceil(timeSegments / segmentDuration);
    
    // Initialize activity map for each participant
    const activities = data.participants.map(participant => {
      return {
        id: participant.id,
        name: participant.displayName,
        avatar: participant.avatarURL,
        segments: new Array(numSegments).fill(0),
        totalSpeakingTime: participant.totalSpeakingTime || 0
      };
    });
    
    // Process speaking events
    let speakingStarts = {};
    
    data.events.forEach(event => {
      if (event.type === "startSpeaking") {
        speakingStarts[event.userId] = event.recordingTimestamp;
      } else if (event.type === "stopSpeaking" && speakingStarts[event.userId]) {
        const startTime = speakingStarts[event.userId];
        const endTime = event.recordingTimestamp;
        const duration = endTime - startTime;
        
        // Find the participant
        const participantIndex = activities.findIndex(p => p.id === event.userId);
        if (participantIndex >= 0) {
          // Calculate which segments this spans
          const startSegment = Math.floor(startTime / segmentDuration);
          const endSegment = Math.floor(endTime / segmentDuration);
          
          // Mark those segments as active
          for (let i = startSegment; i <= endSegment && i < numSegments; i++) {
            activities[participantIndex].segments[i] = 1;
          }
        }
        
        // Clear the start time
        delete speakingStarts[event.userId];
      }
    });
    
    // If there are any ongoing speaking events at the end, process them too
    Object.keys(speakingStarts).forEach(userId => {
      const startTime = speakingStarts[userId];
      const endTime = duration; // Assume they spoke until the end
      
      const participantIndex = activities.findIndex(p => p.id === userId);
      if (participantIndex >= 0) {
        const startSegment = Math.floor(startTime / segmentDuration);
        const endSegment = Math.floor(endTime / segmentDuration);
        
        for (let i = startSegment; i <= endSegment && i < numSegments; i++) {
          activities[participantIndex].segments[i] = 1;
        }
      }
    });
    
    // Sort by total speaking time
    return activities.sort((a, b) => b.totalSpeakingTime - a.totalSpeakingTime);
  };

  // Fetch meeting data (participants, events) when a meeting is selected
  React.useEffect(() => {
    if (!selectedMeeting) return;
    
    const fetchMeetingData = async () => {
      try {
        setLoadingMeetingData(true);
        const response = await fetch(`/meetings/${selectedMeeting.name}/${selectedMeeting.name}.json`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setMeetingData(null);
            console.log('Participant data not available for this meeting');
          } else {
            throw new Error(`API error: ${response.status}`);
          }
        } else {
          const data = await response.json();
          setMeetingData(data);
          
          // Process voice activity data
          const activities = processSpeakingData(data);
          setVoiceActivities(activities);
          
          // Calculate speaking stats for participants
          if (data.participants && data.participants.length > 0) {
            // Calculate total speaking time
            const totalSpeakingTime = data.participants.reduce(
              (sum, participant) => sum + (participant.totalSpeakingTime || 0), 0
            );
            
            // Create stats for visualization
            const stats = data.participants
              .filter(p => p.totalSpeakingTime > 0)
              .map(p => ({
                name: p.displayName,
                value: p.totalSpeakingTime,
                percentage: totalSpeakingTime > 0 
                  ? Math.round((p.totalSpeakingTime / totalSpeakingTime) * 100) 
                  : 0
              }))
              .sort((a, b) => b.value - a.value);
            
            setParticipantStats(stats);
          }
        }
      } catch (err) {
        console.error('Error fetching meeting data:', err);
      } finally {
        setLoadingMeetingData(false);
      }
    };
    
    fetchMeetingData();
  }, [selectedMeeting]);

  // Initialize WaveSurfer when a meeting is selected
  React.useEffect(() => {
    if (selectedMeeting && waveformRef.current) {
      if (typeof WaveSurfer !== 'undefined' && selectedMeeting.audioFile) {
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
          responsive: true,
          hideScrollbar: true,
          barRadius: 2,
        });
        
        wavesurferRef.current = wavesurfer;
        
        // Find the audio file
        const audioUrl = selectedMeeting.audioFile ? 
          `/meetings/${selectedMeeting.name}/${selectedMeeting.audioFile}` : null;
        
        if (audioUrl) {
          // Set up event handlers
          wavesurfer.on('ready', () => {
            setDuration(wavesurfer.getDuration());
            wavesurfer.setVolume(volume);
          });
          
          wavesurfer.on('audioprocess', () => {
            setCurrentTime(wavesurfer.getCurrentTime());
          });
          
          wavesurfer.on('seek', () => {
            setCurrentTime(wavesurfer.getCurrentTime());
          });
          
          wavesurfer.on('play', () => {
            setIsPlaying(true);
          });
          
          wavesurfer.on('pause', () => {
            setIsPlaying(false);
          });
          
          // Load the audio file
          wavesurfer.load(audioUrl);
        }
      }
    }
    
    // Cleanup function
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [selectedMeeting, darkMode]);

  // Update volume when changed
  React.useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Fetch transcription and summary when a meeting is selected
  React.useEffect(() => {
    if (!selectedMeeting) return;
    
    const fetchTranscription = async () => {
      try {
        const response = await fetch(`/api/transcription/${selectedMeeting.name}`);
        if (response.ok) {
          const text = await response.text();
          setTranscription(text);
        } else {
          setTranscription('Transcription not available');
        }
      } catch (err) {
        console.error('Error fetching transcription:', err);
        setTranscription('Failed to load transcription');
      }
    };
    
    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/summary/${selectedMeeting.name}`);
        if (response.ok) {
          const text = await response.text();
          setSummary(text);
        } else {
          setSummary('Summary not available');
        }
      } catch (err) {
        console.error('Error fetching summary:', err);
        setSummary('Failed to load summary');
      }
    };
    
    fetchTranscription();
    fetchSummary();
  }, [selectedMeeting]);

  // Update active speakers based on current time
  React.useEffect(() => {
    if (!meetingData || !meetingData.events) return;
    
    const speakers = new Set();
    
    // Process events to determine active speakers at current time
    meetingData.events.forEach(event => {
      if (event.recordingTimestamp <= currentTime) {
        if (event.type === 'startSpeaking') {
          speakers.add(event.userId);
        } else if (event.type === 'stopSpeaking') {
          speakers.delete(event.userId);
        }
      }
    });
    
    setActiveSpeakers(Array.from(speakers));
  }, [meetingData, currentTime]);

  // Toggle play/pause
  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  // Skip forward/backward
  const skipForward = (seconds = 10) => {
    if (wavesurferRef.current) {
      const newTime = Math.min(currentTime + seconds, duration);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };
  
  const skipBackward = (seconds = 10) => {
    if (wavesurferRef.current) {
      const newTime = Math.max(currentTime - seconds, 0);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? volume : 0);
    }
  };

  // Seek to specific time (for timeline events)
  const seekToTime = (time) => {
    if (wavesurferRef.current && duration) {
      wavesurferRef.current.seekTo(time / duration);
    }
  };

  // Filter meetings by search term
  const filteredMeetings = meetings.filter(meeting => 
    meeting.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Generate random colors for visualization
  const COLORS = ['#4287f5', '#42c2f5', '#42f587', '#f5d442', '#f54242', '#a142f5', '#f542c2', '#42f5d4', '#7042f5', '#f5427a'];

  // Render meeting selection screen
  const renderMeetingList = () => (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h2 className="text-xl font-semibold mb-4 md:mb-0 flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"></line><line x1="8" x2="21" y1="12" y2="12"></line><line x1="8" x2="21" y1="18" y2="18"></line><line x1="3" x2="3.01" y1="6" y2="6"></line><line x1="3" x2="3.01" y1="12" y2="12"></line><line x1="3" x2="3.01" y1="18" y2="18"></line></svg>
          Available Meetings
        </h2>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search meetings..."
            className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line></svg>
        </div>
      </div>

      {meetings.length === 0 ? (
        <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 p-4 rounded-lg">
          <p>No meetings found. Record a meeting using your Discord bot first.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredMeetings.map(meeting => (
            <div 
              key={meeting.id} 
              className="border dark:border-gray-700 rounded-lg p-5 cursor-pointer hover:shadow-md transition-all transform hover:-translate-y-1 dark:hover:bg-gray-800/50 bg-white dark:bg-gray-800 shadow"
              onClick={() => setSelectedMeeting(meeting)}
            >
              <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{meeting.name}</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  {new Date(meeting.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                {meeting.recorded && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                    Recorded
                  </span>
                )}
                {meeting.transcribed && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                    Transcribed
                  </span>
                )}
                {meeting.summarized && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-1 rounded-full flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                    Summarized
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render meeting player when a meeting is selected
  const renderMeetingPlayer = () => (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => setSelectedMeeting(null)} 
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
          Back to Meetings
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{selectedMeeting.name}</h2>
        <div className="w-20"></div> {/* Spacer for alignment */}
      </div>
      
      {/* Tabs */}
      <div className="flex border-b dark:border-gray-700 mb-6">
        <button 
          onClick={() => setActiveTab('player')} 
          className={`py-2 px-4 font-medium text-sm flex items-center gap-1.5 border-b-2 ${
            activeTab === 'player' 
              ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' 
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          Player
        </button>
        <button 
          onClick={() => setActiveTab('transcription')} 
          className={`py-2 px-4 font-medium text-sm flex items-center gap-1.5 border-b-2 ${
            activeTab === 'transcription' 
              ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' 
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Transcription
        </button>
        <button 
          onClick={() => setActiveTab('summary')} 
          className={`py-2 px-4 font-medium text-sm flex items-center gap-1.5 border-b-2 ${
            activeTab === 'summary' 
              ? 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' 
              : 'text-gray-600 dark:text-gray-400 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path><line x1="16" x2="8" y1="13" y2="13"></line><line x1="16" x2="8" y1="17" y2="17"></line><line x1="10" x2="8" y1="9" y2="9"></line></svg>
          Summary
        </button>
      </div>
      
      {activeTab === 'player' && (
        <div>
          {/* Combined main player panel */}
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm mb-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left side: Audio player & waveform */}
              <div className={`w-full ${selectedMeeting.audioFile ? 'md:w-3/5' : 'md:w-full'}`}>
                {selectedMeeting.audioFile ? (
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={togglePlayPause} 
                          className="p-3 rounded-full bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                          aria-label={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="4" height="16" x="6" y="4"></rect><rect width="4" height="16" x="14" y="4"></rect></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                          )}
                        </button>
                        <button 
                          onClick={() => skipBackward(10)} 
                          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                          aria-label="Skip backward 10 seconds"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17l-5-5 5-5"></path><path d="M18 17l-5-5 5-5"></path></svg>
                          <span className="sr-only">10s</span>
                        </button>
                        <button 
                          onClick={() => skipForward(10)} 
                          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                          aria-label="Skip forward 10 seconds"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13 17 5-5-5-5"></path><path d="m6 17 5-5-5-5"></path></svg>
                          <span className="sr-only">10s</span>
                        </button>
                        
                        <button 
                          onClick={toggleMute} 
                          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                          aria-label={isMuted ? "Unmute" : "Mute"}
                        >
                          {isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="2" y2="22"></line><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path><path d="M5.6 5.6A10.08 10.08 0 0 0 2 12c0 4.41 3.59 8 8 8 1.45 0 2.84-.39 4.04-1.08"></path><path d="M14.83 9.17A4 4 0 0 0 12 8c-2.21 0-4 1.79-4 4 0 .73.21 1.41.56 2"></path><path d="M19.07 4.93A10.08 10.08 0 0 1 22 12c0 4.41-3.59 8-8 8"></path></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12c0 4.41 3.59 8 8 8 1.35 0 2.97-.34 4-.29 1.03.05 2.76.51 3.6 1.29"></path><path d="M5 10.2C5 7 8 5 12 5c2 0 4 .86 4 2.8 0 1.87-1.55 1.72-1.55 3.8 0 .5 0 2.4 1.55 2.4"></path><circle cx="12" cy="16" r=".5"></circle><path d="M12 16v-5"></path></svg>
                          )}
                        </button>
                        
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.01" 
                          value={volume} 
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-20 accent-blue-600" 
                          aria-label="Volume control"
                        />
                      </div>
                      
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                    </div>
                    
                    {/* Waveform visualization */}
                    <div ref={waveformRef} className="my-4 rounded-md overflow-hidden h-20"></div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 h-full justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>
                    <span>No audio recording available for this meeting.</span>
                  </div>
                )}
              </div>
              
              {/* Right side: Active participant & current stats */}
              {selectedMeeting.audioFile && (
                <div className="w-full md:w-2/5 flex flex-col">
                  <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Current Activity</h3>
                  
                  <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-3 border dark:border-gray-700">
                    {activeSpeakers.length > 0 ? (
                      <div className="space-y-3">
                        {activeSpeakers.map(speakerId => {
                          const participant = meetingData?.participants?.find(p => p.id === speakerId);
                          if (!participant) return null;
                          
                          return (
                            <div key={speakerId} className="flex items-center gap-3 bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg animate-pulse">
                              <div className="relative">
                                <img 
                                  src={participant.avatarURL || `/api/placeholder/40/40?text=${participant.displayName.charAt(0)}`} 
                                  alt={participant.displayName} 
                                  className="w-10 h-10 rounded-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = `/api/placeholder/40/40?text=${participant.displayName.charAt(0)}`;
                                  }}
                                />
                                {participant.isMuted && (
                                  <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" x2="22" y1="2" y2="22"></line><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path><path d="M5 10v2a7 7 0 0 0 12 7"></path><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{participant.displayName}</p>
                                <div className="flex items-center text-xs text-blue-500 dark:text-blue-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
                                  Speaking
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400 text-sm">
                        <p>No one is currently speaking</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Total Participation</h4>
                    {participantStats.slice(0, 3).map((stat, index) => (
                      <div key={index} className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <span className="text-sm truncate text-gray-800 dark:text-gray-200">{stat.name}</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(stat.value)} ({stat.percentage}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Timeline under the player */}
            {meetingData && meetingData.events && duration > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100 text-sm">Timeline</h3>
                
                {/* Timeline scale */}
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>00:00</span>
                  <span>{formatTime(duration / 4)}</span>
                  <span>{formatTime(duration / 2)}</span>
                  <span>{formatTime(3 * duration / 4)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                
                {/* Timeline track */}
                <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
                  {/* Current time indicator */}
                  <div 
                    className="absolute h-full w-0.5 bg-red-500 z-20 transition-all duration-100"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  ></div>
                  
                  {/* Speaking activity patterns */}
                  {voiceActivities.map((participant, participantIndex) => {
                    const segmentCount = participant.segments.length;
                    const segmentWidth = 100 / segmentCount;
                    
                    return participant.segments.map((active, segmentIndex) => {
                      if (!active) return null;
                      
                      return (
                        <div
                          key={`${participant.id}-${segmentIndex}`}
                          className="absolute h-full opacity-70 z-10"
                          style={{
                            left: `${segmentIndex * segmentWidth}%`,
                            width: `${segmentWidth}%`,
                            backgroundColor: COLORS[participantIndex % COLORS.length],
                            top: `${(participantIndex * 2)}px`,
                            height: '8px'
                          }}
                        />
                      );
                    });
                  })}
                  
                  {/* Event markers - just key points now */}
                  {meetingData.events
                    .filter(event => ['join', 'leave'].includes(event.type))
                    .map((event, index) => {
                      const position = (event.recordingTimestamp / duration) * 100;
                      const color = event.type === 'join' ? 'bg-green-500' : 'bg-red-500';
                      
                      return (
                        <div 
                          key={index}
                          className="absolute group cursor-pointer z-10"
                          style={{ left: `${position}%`, height: '100%' }}
                          onClick={() => seekToTime(event.recordingTimestamp)}
                        >
                          <div className={`${color} h-full w-0.5`}></div>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 transform scale-0 group-hover:scale-100 transition-transform origin-bottom z-30">
                            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-md p-2 text-xs whitespace-nowrap text-gray-800 dark:text-gray-200">
                              <p className="font-medium">{event.displayName}</p>
                              <p>{event.type === 'join' ? 'Joined' : 'Left'}</p>
                              <p>{formatTime(event.recordingTimestamp)}</p>
                            </div>
                            <div className="w-2 h-2 bg-white dark:bg-gray-800 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-3 text-xs justify-end">
                  <div className="flex items-center gap-1 text-gray-800 dark:text-gray-200">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Join</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-800 dark:text-gray-200">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Leave</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-800 dark:text-gray-200">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>Speaking activity</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Participants visualization */}
          {loadingMeetingData ? (
            <div className="animate-pulse flex space-x-4 h-24 w-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ) : meetingData && meetingData.participants ? (
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Participants ({meetingData.participants.length})
              </h3>
              
              {/* Improved participant timeline visualization */}
              <div className="space-y-4">
                {voiceActivities.map((participant, index) => {
                  const segmentCount = participant.segments.length;
                  const speakingPercentage = Math.round((participant.totalSpeakingTime / (duration || 1)) * 100);
                  const activeSegments = participant.segments.filter(s => s === 1).length;
                  const activityPercentage = Math.round((activeSegments / segmentCount) * 100);
                  
                  return (
                    <div key={participant.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border dark:border-gray-700">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="relative">
                          <img 
                            src={participant.avatar || `/api/placeholder/40/40?text=${participant.name.charAt(0)}`} 
                            alt={participant.name} 
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `/api/placeholder/40/40?text=${participant.name.charAt(0)}`;
                            }}
                          />
                          {activeSpeakers.includes(participant.id) && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5 animate-pulse">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{participant.name}</p>
                          <div className="flex text-xs text-gray-500 dark:text-gray-400 gap-2">
                            <span>Total: {formatTime(participant.totalSpeakingTime)}</span>
                            <span className="text-blue-500 dark:text-blue-400">{speakingPercentage}% of meeting</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Activity timeline */}
                      <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="absolute h-full w-0.5 bg-red-500 z-10 transition-all duration-100"
                            style={{ left: `${(currentTime / duration) * 100}%` }}></div>
                            
                        {participant.segments.map((active, segmentIndex) => {
                          if (!active) return null;
                          const segmentWidth = 100 / segmentCount;
                          
                          return (
                            <div
                              key={segmentIndex}
                              className="absolute h-full opacity-70"
                              style={{
                                left: `${segmentIndex * segmentWidth}%`,
                                width: `${segmentWidth}%`,
                                backgroundColor: COLORS[index % COLORS.length]
                              }}
                            />
                          );
                        })}
                      </div>
                      
                      <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>00:00</span>
                        <span>{activityPercentage}% speaking activity</span>
                        <span>{formatTime(duration)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>
                <span>No participant data available for this meeting.</span>
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'transcription' && (
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Transcription</h3>
          <div className="max-h-screen-3/4 overflow-y-auto p-4 bg-white dark:bg-gray-800 rounded-md whitespace-pre-wrap custom-scrollbar text-gray-800 dark:text-gray-200">
            {transcription}
          </div>
        </div>
      )}
      
      {activeTab === 'summary' && (
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Summary</h3>
          <div className="max-h-screen-3/4 overflow-y-auto p-4 bg-white dark:bg-gray-800 rounded-md whitespace-pre-wrap markdown-content custom-scrollbar text-gray-800 dark:text-gray-200">
            {summary}
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${darkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-800 dark:text-gray-200">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center sticky top-0 z-10 bg-white dark:bg-gray-900 shadow-sm">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 
          Discord Meeting Player
        </h1>
        <button 
          onClick={toggleDarkMode} 
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-800 dark:text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" x2="12" y1="1" y2="3"></line><line x1="12" x2="12" y1="21" y2="23"></line><line x1="4.22" x2="5.64" y1="4.22" y2="5.64"></line><line x1="18.36" x2="19.78" y1="18.36" y2="19.78"></line><line x1="1" x2="3" y1="12" y2="12"></line><line x1="21" x2="23" y1="12" y2="12"></line><line x1="4.22" x2="5.64" y1="19.78" y2="18.36"></line><line x1="18.36" x2="19.78" y1="5.64" y2="4.22"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-800 dark:text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>
      </header>
      
      <main>
        {error && (
          <div className="container mx-auto p-4">
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg mb-6">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}
        
        {selectedMeeting ? renderMeetingPlayer() : renderMeetingList()}
      </main>
      
      <footer className="p-4 border-t dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
        Discord Meeting Player © 2025 - Weekly Transcription Bot
      </footer>
    </div>
  );
};

// Add custom CSS for better scrollbar in dark mode
const styleElement = document.createElement('style');
styleElement.textContent = `
  /* Custom scrollbar styles */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: var(--bg-secondary);
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: var(--border-color);
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: var(--text-secondary);
  }
  
  /* Dark mode custom properties */
  :root {
    --bg-primary: #f9fafb;
    --bg-secondary: #ffffff;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --border-color: #e5e7eb;
  }
  
  .dark {
    --bg-primary: #111827;
    --bg-secondary: #1f2937;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border-color: #374151;
  }
`;
document.head.appendChild(styleElement);

// Render the app to the DOM
ReactDOM.render(<App />, document.getElementById('root'));