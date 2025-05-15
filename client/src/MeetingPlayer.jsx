import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Moon, Sun, Users, File,
  Clock, Download, SkipBack, SkipForward, List, ArrowLeft, Info,
  Mic, MicOff, Headphones, HeadphonesOff, User, UserPlus, UserMinus
} from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';

// Custom hook for dark mode
const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState(() => 
    localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);
  
  return [darkMode, setDarkMode];
};

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

// Participant List Component
const ParticipantsList = ({ participants, currentTime, activeSpeakers }) => {
  // Sort participants by speaking time (most active first)
  const sortedParticipants = [...participants].sort((a, b) => b.totalSpeakingTime - a.totalSpeakingTime);
  
  return (
    <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Users className="h-5 w-5" /> Participants ({participants.length})
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedParticipants.map(participant => {
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
                    <MicOff className="h-3 w-3" />
                  </div>
                )}
                {participant.isDeafened && (
                  <div className="absolute -bottom-1 left-0 bg-yellow-500 text-white rounded-full p-0.5">
                    <HeadphonesOff className="h-3 w-3" />
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
        
        {participants.length === 0 && (
          <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-4">
            No participants data available
          </div>
        )}
      </div>
    </div>
  );
};

// Timeline Event Component
const EventMarker = ({ event, position, duration, onClick }) => {
  let color, icon;
  
  switch (event.type) {
    case 'join':
      color = 'bg-green-500';
      icon = <UserPlus className="h-3 w-3" />;
      break;
    case 'leave':
      color = 'bg-red-500';
      icon = <UserMinus className="h-3 w-3" />;
      break;
    case 'startSpeaking':
      color = 'bg-blue-500';
      icon = <Mic className="h-3 w-3" />;
      break;
    case 'stopSpeaking':
      color = 'bg-gray-500';
      icon = <MicOff className="h-3 w-3" />;
      break;
    case 'mute':
      color = 'bg-red-400';
      icon = <MicOff className="h-3 w-3" />;
      break;
    case 'unmute':
      color = 'bg-green-400';
      icon = <Mic className="h-3 w-3" />;
      break;
    default:
      color = 'bg-gray-500';
      icon = <Info className="h-3 w-3" />;
  }
  
  return (
    <div 
      className="absolute w-px group cursor-pointer"
      style={{ left: `${position}%`, height: '100%' }}
      onClick={onClick}
    >
      <div className={`${color} h-full w-0.5`}></div>
      
      {/* Icon at the top */}
      <div className={`absolute -top-4 -translate-x-1/2 ${color} text-white rounded-full p-1`}>
        {icon}
      </div>
      
      {/* Tooltip */}
      <div className="absolute bottom-8 -translate-x-1/2 transform scale-0 group-hover:scale-100 transition-transform origin-bottom z-10">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-md p-2 text-xs whitespace-nowrap">
          <p className="font-medium">{event.displayName}</p>
          <p>{event.type === 'startSpeaking' ? 'Started speaking' : 
              event.type === 'stopSpeaking' ? 'Stopped speaking' : 
              event.type === 'join' ? 'Joined' : 
              event.type === 'leave' ? 'Left' : 
              event.type === 'mute' ? 'Muted' : 
              event.type === 'unmute' ? 'Unmuted' : event.type}</p>
          <p>{formatTime(event.recordingTimestamp)}</p>
        </div>
        <div className="w-2 h-2 bg-white dark:bg-gray-800 transform rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
      </div>
    </div>
  );
};

// Events Timeline Component
const EventsTimeline = ({ events, duration, currentTime, onEventClick }) => {
  if (!events || events.length === 0 || !duration) {
    return (
      <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
        <h3 className="font-semibold mb-3">Events Timeline</h3>
        <div className="text-center text-gray-500 dark:text-gray-400 py-4">
          No event data available
        </div>
      </div>
    );
  }
  
  // Filter significant events for display
  const significantEvents = events.filter(event => 
    ['join', 'leave', 'startSpeaking', 'mute', 'unmute'].includes(event.type)
  );
  
  return (
    <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
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
        {significantEvents.map((event, index) => (
          <EventMarker 
            key={index}
            event={event}
            position={(event.recordingTimestamp / duration) * 100}
            duration={duration}
            onClick={() => onEventClick(event.recordingTimestamp)}
          />
        ))}
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
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-green-400"></div>
          <span>Unmute</span>
        </div>
      </div>
    </div>
  );
};

// Custom hook for fetching meeting data
const useMeetingData = (meetingName) => {
  const [meetingData, setMeetingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!meetingName) {
      setLoading(false);
      return;
    }
    
    const fetchMeetingData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/meetings/${meetingName}/${meetingName}.json`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setMeetingData(null);
            setError("Participant data not available for this meeting");
          } else {
            throw new Error(`API error: ${response.status}`);
          }
        } else {
          const data = await response.json();
          setMeetingData(data);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching meeting data:', err);
        setError("Failed to load participant data");
      } finally {
        setLoading(false);
      }
    };
    
    fetchMeetingData();
  }, [meetingName]);
  
  return { meetingData, loading, error };
};

// Main Meeting Player Component
const MeetingPlayer = () => {
  const [darkMode, setDarkMode] = useDarkMode();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMeeting, setCurrentMeeting] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingTranscription, setLoadingTranscription] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [activeTab, setActiveTab] = useState('player');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  
  // Fetch meeting data (participants, events)
  const { 
    meetingData, 
    loading: loadingMeetingData, 
    error: meetingDataError 
  } = useMeetingData(currentMeeting?.name);
  
  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  // Fetch meetings on component mount
  useEffect(() => {
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
        responsive: true,
        hideScrollbar: true,
        barRadius: 2,
      });
      
      wavesurferRef.current = wavesurfer;
      
      // In a real implementation, load the actual audio file
      const audioUrl = currentMeeting.audioFile ? 
        `/meetings/${currentMeeting.name}/${currentMeeting.audioFile}` : null;
      
      if (audioUrl) {
        wavesurfer.load(audioUrl);
        
        wavesurfer.on('ready', () => {
          setDuration(wavesurfer.getDuration());
          wavesurfer.setVolume(volume);
        });
        
        wavesurfer.on('audioprocess', () => {
          setCurrentTime(wavesurfer.getCurrentTime());
        });
        
        wavesurfer.on('seeking', () => {
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
          setError('Error loading audio: ' + err);
        });
      }
    }
    
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
    };
  }, [currentMeeting, darkMode, volume]);
  
  // Update volume when changed
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);
  
  // Fetch transcription and summary when a meeting is selected
  useEffect(() => {
    if (!currentMeeting) return;
    
    const fetchTranscription = async () => {
      try {
        setLoadingTranscription(true);
        const response = await fetch(`/api/transcription/${currentMeeting.name}`);
        if (response.ok) {
          const text = await response.text();
          setTranscription(text);
        } else {
          setTranscription('Transcription not available');
        }
      } catch (err) {
        console.error('Error fetching transcription:', err);
        setTranscription('Failed to load transcription');
      } finally {
        setLoadingTranscription(false);
      }
    };
    
    const fetchSummary = async () => {
      try {
        setLoadingSummary(true);
        const response = await fetch(`/api/summary/${currentMeeting.name}`);
        if (response.ok) {
          const text = await response.text();
          setSummary(text);
        } else {
          setSummary('Summary not available');
        }
      } catch (err) {
        console.error('Error fetching summary:', err);
        setSummary('Failed to load summary');
      } finally {
        setLoadingSummary(false);
      }
    };
    
    fetchTranscription();
    fetchSummary();
  }, [currentMeeting]);
  
  // Update active speakers based on current time
  useEffect(() => {
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
  
  // Seek to specific time (for timeline events)
  const seekToTime = (time) => {
    if (wavesurferRef.current && duration) {
      wavesurferRef.current.seekTo(time / duration);
    }
  };
  
  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };
  
  // Select a meeting
  const selectMeeting = (meeting) => {
    setCurrentMeeting(meeting);
    setActiveTab('player');
  };
  
  // Back to meeting list
  const goBack = () => {
    setCurrentMeeting(null);
    setTranscription('');
    setSummary('');
  };
  
  // Format a percentage for participant activity
  const formatPercentage = (value) => {
    if (isNaN(value)) return '0%';
    return `${Math.round(value * 100)}%`;
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
      <header className="sticky top-0 z-10 p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 shadow-sm">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Discord Meeting Player
        </h1>
        <button 
          onClick={toggleDarkMode} 
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </header>
      
      <main className="container mx-auto p-4">
        {error && (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg mb-6">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}
        
        {!currentMeeting ? (
          // Meeting selection screen
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <List className="h-5 w-5" /> Available Meetings
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
                    onClick={() => selectMeeting(meeting)}
                  >
                    <h3 className="font-semibold text-lg">{meeting.name}</h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
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
            <div className="flex justify-between items-center mb-4">
              <button 
                onClick={goBack} 
                className="flex items-center gap-1 px-3 py-1 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Meetings
              </button>
              <h2 className="text-xl font-semibold">{currentMeeting.name}</h2>
              <div className="w-24"></div> {/* Spacer for alignment */}
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
                {currentMeeting.audioFile ? (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={togglePlayPause} 
                          className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          aria-label={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                        </button>
                        <button 
                          onClick={() => skipBackward(10)} 
                          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          aria-label="Skip backward 10 seconds"
                        >
                          <SkipBack className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => skipForward(10)} 
                          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          aria-label="Skip forward 10 seconds"
                        >
                          <SkipForward className="h-5 w-5" />
                        </button>
                      </div>
                      
                      <div className="text-sm font-medium">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={toggleMute} 
                          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                          aria-label={isMuted ? "Unmute" : "Mute"}
                        >
                          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </button>
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.01" 
                          value={volume} 
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                          className="w-24 accent-blue-600" 
                          aria-label="Volume control"
                        />
                      </div>
                    </div>
                    
                    {/* Waveform visualization */}
                    <div ref={waveformRef} className="my-4 rounded-md overflow-hidden h-20"></div>
                  </div>
                ) : (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <Info className="h-5 w-5" />
                      <span>No audio recording available for this meeting.</span>
                    </div>
                  </div>
                )}
                
                {/* Participants section */}
                {loadingMeetingData ? (
                  <LoadingSpinner />
                ) : meetingDataError ? (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <Info className="h-5 w-5" />
                      <span>{meetingDataError}</span>
                    </div>
                  </div>
                ) : meetingData ? (
                  <>
                    <ParticipantsList 
                      participants={meetingData.participants || []}
                      currentTime={currentTime}
                      activeSpeakers={activeSpeakers}
                    />
                    
                    <EventsTimeline 
                      events={meetingData.events || []}
                      duration={duration}
                      currentTime={currentTime}
                      onEventClick={seekToTime}
                    />
                  </>
                ) : (
                  <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <Info className="h-5 w-5" />
                      <span>No participant data available for this meeting.</span>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {activeTab === 'transcription' && (
              <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
                <h3 className="font-semibold mb-3">Transcription</h3>
                {loadingTranscription ? (
                  <LoadingSpinner />
                ) : (
                  <div className="max-h-screen-3/4 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-700 rounded-md whitespace-pre-wrap custom-scrollbar">
                    {transcription}
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'summary' && (
              <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 shadow-sm">
                <h3 className="font-semibold mb-3">Summary</h3>
                {loadingSummary ? (
                  <LoadingSpinner />
                ) : (
                  <div className="max-h-screen-3/4 overflow-y-auto p-3 bg-gray-50 dark:bg-gray-700 rounded-md whitespace-pre-wrap markdown-content custom-scrollbar">
                    {summary}
                  </div>
                )}
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

export default MeetingPlayer;