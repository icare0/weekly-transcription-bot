// Format time (seconds to MM:SS)
const formatTime = (time) => {
  if (isNaN(time)) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-8">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

// Event marker component for timeline
const EventMarker = ({ event, position, onClick }) => {
  let colorClass, Icon;
  
  switch (event.type) {
    case 'join':
      colorClass = 'bg-green-500';
      Icon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-plus"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="16" x2="22" y1="11" y2="11"></line></svg>
      );
      break;
    case 'leave':
      colorClass = 'bg-red-500';
      Icon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user-minus"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="16" x2="22" y1="11" y2="11"></line></svg>
      );
      break;
    case 'startSpeaking':
      colorClass = 'bg-blue-500';
      Icon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
      );
      break;
    case 'mute':
      colorClass = 'bg-red-400';
      Icon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic-off"><line x1="2" x2="22" y1="2" y2="22"></line><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path><path d="M5 10v2a7 7 0 0 0 12 7"></path><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
      );
      break;
    default:
      colorClass = 'bg-gray-500';
      Icon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>
      );
  }
  
  return (
    <div 
      className="absolute group cursor-pointer"
      style={{ left: `${position}%`, height: '100%' }}
      onClick={onClick}
    >
      <div className={`${colorClass} h-full w-0.5`}></div>
      <div className={`absolute -top-4 -translate-x-1/2 ${colorClass} text-white rounded-full p-1`}>
        <Icon />
      </div>
      
      {/* Tooltip */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 transform scale-0 group-hover:scale-100 transition-transform origin-bottom z-10">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-md p-2 text-xs whitespace-nowrap">
          <p className="font-medium">{event.displayName}</p>
          <p>{
            event.type === 'startSpeaking' ? 'Started speaking' : 
            event.type === 'join' ? 'Joined' : 
            event.type === 'leave' ? 'Left' : 
            event.type === 'mute' ? 'Muted' : 
            event.type
          }</p>
          <p>{formatTime(event.recordingTimestamp)}</p>
        </div>
        <div className="w-2 h-2 bg-white dark:bg-gray-800 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
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
  const [meetingData, setMeetingData] = React.useState(null);
  const [loadingMeetingData, setLoadingMeetingData] = React.useState(false);
  const [activeSpeakers, setActiveSpeakers] = React.useState([]);
  const [darkMode, setDarkMode] = React.useState(
    localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

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
  }, []);

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
        
        wavesurfer.on('error', (err) => {
          console.error('WaveSurfer error:', err);
        });
        
        // Load the audio file
        try {
          wavesurfer.load(audioUrl);
        } catch (err) {
          console.error('Error loading audio:', err);
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

  // Seek to specific time (for timeline events)
  const seekToTime = (time) => {
    if (wavesurferRef.current && duration) {
      wavesurferRef.current.seekTo(time / duration);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${darkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4">Loading meetings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 
          Discord Meeting Player
        </h1>
        <button 
          onClick={toggleDarkMode} 
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="Toggle dark mode"
        >
          {darkMode ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sun"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-moon"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>
          )}
        </button>
      </header>
      
      <main className="container mx-auto p-4">
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg mb-6">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}
        
        {!selectedMeeting ? (
          // Meeting selection screen
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list"><line x1="8" x2="21" y1="6" y2="6"></line><line x1="8" x2="21" y1="12" y2="12"></line><line x1="8" x2="21" y1="18" y2="18"></line><line x1="3" x2="3.01" y1="6" y2="6"></line><line x1="3" x2="3.01" y1="12" y2="12"></line><line x1="3" x2="3.01" y1="18" y2="18"></line></svg>
              Available Meetings
            </h2>
            {meetings.length === 0 ? (
              <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300 p-4 rounded-lg">
                <p>No meetings found. Record a meeting using your Discord bot first.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {meetings.map(meeting => (
                  <div 
                    key={meeting.id} 
                    className="border dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow dark:hover:bg-gray-800"
                    onClick={() => setSelectedMeeting(meeting)}
                  >
                    <h3 className="font-semibold text-lg">{meeting.name}</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-clock"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        {new Date(meeting.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {meeting.recorded && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full">
                          Recorded
                        </span>
                      )}
                      {meeting.transcribed && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full">
                          Transcribed
                        </span>
                      )}
                      {meeting.summarized && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-1 rounded-full">
                          Summarized
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Meeting player screen
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <button 
                onClick={() => setSelectedMeeting(null)} 
                className="flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>
                Back to Meetings
              </button>
              <h2 className="text-xl font-semibold">{selectedMeeting.name}</h2>
              <div className="w-20"></div> {/* Spacer for alignment */}
            </div>
            
            {/* Tabs */}
            <div className="flex border-b dark:border-gray-700 mb-6">
              <button 
                onClick={() => setActiveTab('player')} 
                className={`py-2 px-4 font-medium text-sm ${
                  activeTab === 'player' 
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Player
              </button>
              <button 
                onClick={() => setActiveTab('transcription')} 
                className={`py-2 px-4 font-medium text-sm ${
                  activeTab === 'transcription' 
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Transcription
              </button>
              <button 
                onClick={() => setActiveTab('summary')} 
                className={`py-2 px-4 font-medium text-sm ${
                  activeTab === 'summary' 
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Summary
              </button>
            </div>
            
            {activeTab === 'player' && (
              <>
                {/* Audio player */}
                {selectedMeeting.audioFile ? (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={togglePlayPause} 
                          className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          aria-label={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pause"><rect width="4" height="16" x="6" y="4"></rect><rect width="4" height="16" x="14" y="4"></rect></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-play"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                          )}
                        </button>
                        <button 
                          onClick={() => skipBackward(10)} 
                          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          aria-label="Skip backward 10 seconds"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-skip-back"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" x2="5" y1="19" y2="5"></line></svg>
                        </button>
                        <button 
                          onClick={() => skipForward(10)} 
                          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          aria-label="Skip forward 10 seconds"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-skip-forward"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" x2="19" y1="5" y2="19"></line></svg>
                        </button>
                      </div>
                      
                      <div className="text-sm font-medium">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                    </div>
                    
                    {/* Waveform visualization */}
                    <div ref={waveformRef} className="my-4 rounded-md overflow-hidden h-20"></div>
                  </div>
                ) : (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>
                      <span>No audio recording available for this meeting.</span>
                    </div>
                  </div>
                )}
                
                {/* Participants section */}
                {loadingMeetingData ? (
                  <LoadingSpinner />
                ) : meetingData && meetingData.participants ? (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      Participants ({meetingData.participants.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {meetingData.participants.sort((a, b) => b.totalSpeakingTime - a.totalSpeakingTime).map(participant => {
                        const isSpeaking = activeSpeakers.includes(participant.id);
                        const speakingPercentage = Math.round((participant.totalSpeakingTime / (currentTime || 1)) * 100);
                        
                        return (
                          <div 
                            key={participant.id} 
                            className={`flex items-center gap-3 p-3 rounded-md ${
                              isSpeaking ? 'bg-blue-100 dark:bg-blue-900/30 animate-pulse' : ''
                            } transition-colors duration-300`}
                          >
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
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic-off"><line x1="2" x2="22" y1="2" y2="22"></line><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"></path><path d="M5 10v2a7 7 0 0 0 12 7"></path><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"></path><path d="M9 9v3a3 3 0 0 0 5.12 2.12"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate" title={participant.displayName}>
                                {participant.displayName}
                              </p>
                              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1">
                                <div 
                                  className="h-full bg-blue-500 rounded-full" 
                                  style={{ width: `${Math.min(speakingPercentage, 100)}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {formatTime(participant.totalSpeakingTime)} ({speakingPercentage}%)
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>
                      <span>No participant data available for this meeting.</span>
                    </div>
                  </div>
                )}
                
                {/* Timeline */}
                {meetingData && meetingData.events && duration > 0 && (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                    <h3 className="font-semibold mb-3">Events Timeline</h3>
                    
                    {/* Timeline scale */}
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>00:00</span>
                      <span>{formatTime(duration / 4)}</span>
                      <span>{formatTime(duration / 2)}</span>
                      <span>{formatTime(3 * duration / 4)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    
                    {/* Timeline track */}
                    <div className="relative h-16 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
                      {/* Current time indicator */}
                      <div 
                        className="absolute h-full w-0.5 bg-red-500 z-10 transition-all duration-100"
                        style={{ left: `${(currentTime / duration) * 100}%` }}
                      ></div>
                      
                      {/* Event markers */}
                      {meetingData.events
                        .filter(event => ['join', 'leave', 'startSpeaking', 'mute', 'unmute'].includes(event.type))
                        .map((event, index) => (
                          <EventMarker 
                            key={index}
                            event={event}
                            position={(event.recordingTimestamp / duration) * 100}
                            onClick={() => seekToTime(event.recordingTimestamp)}
                          />
                        ))
                      }
                    </div>
                    
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 mt-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Join</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span>Leave</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>Speaking</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <span>Mute</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {activeTab === 'transcription' && (
              <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <h3 className="font-semibold mb-3">Transcription</h3>
                <div className="max-h-screen-3/4 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-700 rounded-md whitespace-pre-wrap custom-scrollbar">
                  {transcription}
                </div>
              </div>
            )}
            
            {activeTab === 'summary' && (
              <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <h3 className="font-semibold mb-3">Summary</h3>
                <div className="max-h-screen-3/4 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-700 rounded-md whitespace-pre-wrap markdown-content custom-scrollbar">
                  {summary}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      
      <footer className="p-4 border-t dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
        Discord Meeting Player © 2025 - Weekly Transcription Bot
      </footer>
    </div>
  );
};

// Render the app to the DOM
ReactDOM.render(<App />, document.getElementById('root'));