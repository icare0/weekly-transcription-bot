
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Sun, Moon, ChevronLeft, 
  Mic, MessageSquare, BarChart2, Clock, Users, Download, Maximize2, Minimize2, 
  ListFilter, Layout, PieChart } from 'lucide-react';

const formatTime = (time) => {
  if (isNaN(time)) return '00:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const MeetingPlayer = () => {
  // State
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [summary, setSummary] = useState('');
  const [activeTab, setActiveTab] = useState('player');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [meetingData, setMeetingData] = useState(null);
  const [loadingMeetingData, setLoadingMeetingData] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [participantStats, setParticipantStats] = useState([]);
  const [viewMode, setViewMode] = useState('default'); // default, compact, discord, transcript
  const [activeParticipant, setActiveParticipant] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [participantTranscripts, setParticipantTranscripts] = useState({});
  
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const containerRef = useRef(null);

  // Generate random colors for visualization
  const COLORS = [
    '#4287f5', '#42c2f5', '#42f587', '#f5d442', '#f54242', 
    '#a142f5', '#f542c2', '#42f5d4', '#7042f5', '#f5427a'
  ];

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

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!fullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      } else if (containerRef.current.msRequestFullscreen) {
        containerRef.current.msRequestFullscreen();
      }
      setFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
      setFullscreen(false);
    }
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

    // Set dark mode on mount
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Handle fullscreen change
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Process transcription to separate by participant
  useEffect(() => {
    if (transcription && meetingData) {
      const participants = meetingData.participants || [];
      const transcriptsByParticipant = {};
      
      // Initialize all participants with empty transcripts
      participants.forEach(p => {
        transcriptsByParticipant[p.id] = [];
      });
      
      // Simple parsing of transcription - this is a basic implementation
      // In a real app, you'd want to use timestamps and more robust parsing
      const lines = transcription.split('\n');
      
      for (const line of lines) {
        // Look for lines that might be participant speech
        // Format might be "Name: speech content" or "[Name] speech content"
        const nameMatch = line.match(/^([^\:]+)\:(.+)$/) || line.match(/^\[([^\]]+)\](.+)$/);
        
        if (nameMatch) {
          const speakerName = nameMatch[1].trim();
          const content = nameMatch[2].trim();
          
          // Find participant by name
          const participant = participants.find(p => 
            p.displayName.toLowerCase() === speakerName.toLowerCase() || 
            p.username.toLowerCase() === speakerName.toLowerCase()
          );
          
          if (participant) {
            transcriptsByParticipant[participant.id].push({
              content,
              timestamp: null // In a real app, you'd extract timestamps
            });
          }
        }
      }
      
      setParticipantTranscripts(transcriptsByParticipant);
    }
  }, [transcription, meetingData]);

  // Fetch meeting data (participants, events) when a meeting is selected
  useEffect(() => {
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
  useEffect(() => {
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
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Fetch transcription and summary when a meeting is selected
  useEffect(() => {
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

  // Parse transcription lines into structured data
  const parseTranscription = (text) => {
    const lines = text.split('\n');
    const parsedLines = [];
    
    for (const line of lines) {
      if (line.trim()) {
        // Try to detect speaker and text
        const match = line.match(/^\[?([^\]:]+)[\]:](.+)$/);
        if (match) {
          parsedLines.push({
            speaker: match[1].trim(),
            text: match[2].trim(),
            timestamp: null // In a real app, you'd extract timestamps
          });
        } else {
          parsedLines.push({
            speaker: null,
            text: line.trim(),
            timestamp: null
          });
        }
      }
    }
    
    return parsedLines;
  };

  // Render meeting selection screen
  const renderMeetingList = () => (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <h2 className="text-xl font-semibold mb-4 md:mb-0 flex items-center gap-2 text-gray-900 dark:text-white">
          <Users className="h-5 w-5" />
          Available Meetings
        </h2>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search meetings..."
            className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <ListFilter className="h-5 w-5 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        </div>
      </div>

      {meetings.length === 0 ? (
        <div className="bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 p-4 rounded-lg">
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
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{meeting.name}</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(meeting.date).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                {meeting.recorded && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded-full flex items-center">
                    <Play className="h-3 w-3 mr-1" />
                    Recorded
                  </span>
                )}
                {meeting.transcribed && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full flex items-center">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Transcribed
                  </span>
                )}
                {meeting.summarized && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 px-2 py-1 rounded-full flex items-center">
                    <BarChart2 className="h-3 w-3 mr-1" />
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

  // Render the discord-like view
  const renderDiscordView = () => {
    if (!meetingData || !meetingData.participants) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
          <p>No participant data available for this meeting</p>
        </div>
      );
    }
    
    const sortedParticipants = [...meetingData.participants].sort((a, b) => {
      // First sort by speaking status (active speakers first)
      const aActive = activeSpeakers.includes(a.id);
      const bActive = activeSpeakers.includes(b.id);
      
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      
      // Then by total speaking time
      return (b.totalSpeakingTime || 0) - (a.totalSpeakingTime || 0);
    });
    
    return (
      <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-900">
        <div className="flex items-center mb-3 px-2 py-2 bg-gray-800 rounded-t-lg">
          <h3 className="font-semibold text-gray-100 flex items-center">
            <Users className="mr-2 h-5 w-5 text-gray-400" /> 
            Voice Channel - {selectedMeeting.name}
          </h3>
        </div>
        
        <div className="space-y-2 px-2">
          {sortedParticipants.map(participant => {
            const isSpeaking = activeSpeakers.includes(participant.id);
            const speakingPercentage = Math.round((participant.totalSpeakingTime || 0) / (duration || 1) * 100);
            
            return (
              <div 
                key={participant.id} 
                className={`flex items-center p-2 rounded-md transition-all ${
                  isSpeaking ? 'bg-gray-700/50' : 'hover:bg-gray-800'
                }`}
                onClick={() => {
                  setActiveParticipant(participant.id === activeParticipant ? null : participant.id);
                  if (activeTab === 'transcription') {
                    setActiveTab('player');
                  }
                }}
              >
                <div className={`relative ${activeParticipant === participant.id ? 'ring-2 ring-blue-500' : ''}`}>
                  <div className={`rounded-full overflow-hidden ${
                    isSpeaking ? 'ring-2 ring-green-500 animate-pulse' : ''
                  }`}>
                    <img 
                      src={participant.avatarURL || `/api/placeholder/40/40?text=${participant.displayName.charAt(0)}`} 
                      alt={participant.displayName} 
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = `/api/placeholder/40/40?text=${participant.displayName.charAt(0)}`;
                      }}
                    />
                  </div>
                  
                  {participant.isMuted && (
                    <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-0.5">
                      <Mic className="h-3 w-3" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-white transform rotate-45"></div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="ml-3 flex-1">
                  <div className="flex items-center">
                    <p className="font-medium text-white">{participant.displayName}</p>
                    {isSpeaking && (
                      <div className="ml-2 flex space-x-0.5">
                        <div className="bg-green-500 w-1 h-3 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="bg-green-500 w-1 h-4 rounded-full animate-bounce" style={{ animationDelay: '100ms' }}></div>
                        <div className="bg-green-500 w-1 h-5 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="w-full h-1.5 bg-gray-700 rounded-full mt-1">
                    <div 
                      className="h-full bg-green-500 rounded-full" 
                      style={{ width: `${Math.min(speakingPercentage, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatTime(participant.totalSpeakingTime || 0)} ({speakingPercentage}%)
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        
        {activeParticipant && (
          <div className="mt-4 border-t border-gray-700 pt-3">
            <h4 className="text-sm font-medium text-gray-200 mb-2">
              Transcript - {meetingData.participants.find(p => p.id === activeParticipant)?.displayName}
            </h4>
            <div className="max-h-64 overflow-y-auto custom-scrollbar rounded bg-gray-800 p-3 text-sm text-gray-300">
              {participantTranscripts[activeParticipant]?.length > 0 ? (
                participantTranscripts[activeParticipant].map((entry, idx) => (
                  <div key={idx} className="mb-2 px-2 py-1 bg-gray-700/50 rounded">
                    {entry.content}
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No transcript entries available for this participant</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render meeting player when a meeting is selected
  const renderMeetingPlayer = () => (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => setSelectedMeeting(null)} 
          className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Meetings
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedMeeting.name}</h2>
        <div className="flex gap-2">
          <button 
            onClick={toggleFullscreen} 
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
          <div className="dropdown relative">
            <button className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
              <Layout className="h-5 w-5" />
            </button>
            <div className="dropdown-menu absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-10 border dark:border-gray-700 hidden group-hover:block">
              <button 
                onClick={() => setViewMode('default')} 
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${viewMode === 'default' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}`}
              >
                Standard View
              </button>
              <button 
                onClick={() => setViewMode('discord')} 
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${viewMode === 'discord' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}`}
              >
                Discord View
              </button>
              <button 
                onClick={() => setViewMode('transcript')} 
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${viewMode === 'transcript' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}`}
              >
                Transcript View
              </button>
            </div>
          </div>
        </div>
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
          <Play className="h-4 w-4" />
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
          <MessageSquare className="h-4 w-4" />
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
          <BarChart2 className="h-4 w-4" />
          Summary
        </button>
      </div>
      
      {activeTab === 'player' && (
        <div>
          {/* Audio player panel */}
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm mb-6">
            {selectedMeeting.audioFile ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={togglePlayPause} 
                      className="p-3 rounded-full bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <button 
                      onClick={() => skipBackward(10)} 
                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      aria-label="Skip backward 10 seconds"
                    >
                      <SkipBack className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={() => skipForward(10)} 
                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                      aria-label="Skip forward 10 seconds"
                    >
                      <SkipForward className="h-5 w-5" />
                    </button>
                    
                    <button 
                      onClick={toggleMute} 
                      className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
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
                      className="w-20 accent-blue-600" 
                      aria-label="Volume control"
                    />
                  </div>
                  
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>
                
                {/* Waveform visualization */}
                <div ref={waveformRef} className="rounded-md overflow-hidden h-20"></div>
                
                {/* Current activity */}
                {viewMode === 'default' && (
                  <div className="mt-4 grid md:grid-cols-2 gap-6">
                    <div className="flex flex-col">
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
                                        <Mic className="h-3 w-3" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-full h-0.5 bg-white transform rotate-45"></div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{participant.displayName}</p>
                                    <div className="flex items-center text-xs text-blue-500 dark:text-blue-400">
                                      <Mic className="h-3 w-3 mr-1" />
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
                    </div>
                    
                    <div className="flex flex-col">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Top Participants</h4>
                      {participantStats.slice(0, 5).map((stat, index) => (
                        <div key={index} className="flex items-center justify-between mb-2 p-2 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
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
                      
                      <div className="flex-1 mt-2">
                        <div className="relative h-32 w-full">
                          <PieChart className="h-full w-full mx-auto text-gray-300 dark:text-gray-700" />
                          {participantStats.slice(0, 5).map((stat, index) => (
                            <div 
                              key={index}
                              className="absolute"
                              style={{
                                width: '60%',
                                height: '60%',
                                top: '20%',
                                left: '20%',
                                borderRadius: '50%',
                                background: `conic-gradient(${COLORS[index % COLORS.length]} 0deg, ${COLORS[index % COLORS.length]} ${stat.percentage * 3.6}deg, transparent ${stat.percentage * 3.6}deg 360deg)`,
                                transform: `rotate(${index > 0 ? participantStats.slice(0, index).reduce((acc, curr) => acc + curr.percentage * 3.6, 0) : 0}deg)`,
                                opacity: 0.85
                              }}
                            ></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {viewMode === 'discord' && renderDiscordView()}
                
                {viewMode === 'transcript' && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                      <div className="p-3 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                        <h3 className="font-medium text-gray-900 dark:text-white">Participants</h3>
                      </div>
                      <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {meetingData?.participants?.map(participant => (
                          <div 
                            key={participant.id}
                            className={`flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              activeParticipant === participant.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                            onClick={() => setActiveParticipant(participant.id === activeParticipant ? null : participant.id)}
                          >
                            <div className="relative">
                              <img 
                                src={participant.avatarURL || `/api/placeholder/32/32?text=${participant.displayName.charAt(0)}`}
                                alt={participant.displayName}
                                className="w-8 h-8 rounded-full"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `/api/placeholder/32/32?text=${participant.displayName.charAt(0)}`;
                                }}
                              />
                              {activeSpeakers.includes(participant.id) && (
                                <div className="absolute -bottom-1 -right-1 bg-green-500 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800"></div>
                              )}
                            </div>
                            <div className="ml-2">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{participant.displayName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTime(participant.totalSpeakingTime || 0)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                      <div className="p-3 bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {activeParticipant ? `${meetingData?.participants?.find(p => p.id === activeParticipant)?.displayName}'s Transcript` : 'Full Transcript'}
                        </h3>
                      </div>
                      <div className="p-3 max-h-60 overflow-y-auto custom-scrollbar">
                        {activeParticipant ? (
                          participantTranscripts[activeParticipant]?.length > 0 ? (
                            participantTranscripts[activeParticipant].map((entry, idx) => (
                              <div key={idx} className="mb-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700">
                                <p className="text-sm text-gray-900 dark:text-white">{entry.content}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400">No transcript entries available for this participant</p>
                          )
                        ) : (
                          parseTranscription(transcription).map((line, idx) => (
                            <div key={idx} className="mb-2">
                              {line.speaker && (
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{line.speaker}</p>
                              )}
                              <p className="text-sm text-gray-900 dark:text-white">{line.text}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 h-full justify-center p-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" x2="12" y1="16" y2="12"></line><line x1="12" x2="12.01" y1="8" y2="8"></line></svg>
                <span>No audio recording available for this meeting.</span>
              </div>
            )}
          </div>
          
          {/* Timeline under the player */}
          {meetingData && meetingData.events && duration > 0 && (
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm mb-6">
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
              <div className="relative h-10 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
                {/* Current time indicator */}
                <div 
                  className="absolute h-full w-0.5 bg-red-500 z-20 transition-all duration-100"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                ></div>
                
                {/* Event markers - key points */}
                {meetingData.events
                  .filter(event => ['join', 'leave', 'startSpeaking', 'stopSpeaking'].includes(event.type))
                  .map((event, index) => {
                    const position = (event.recordingTimestamp / duration) * 100;
                    let color;
                    
                    switch(event.type) {
                      case 'join': color = 'bg-green-500'; break;
                      case 'leave': color = 'bg-red-500'; break;
                      case 'startSpeaking': color = 'bg-blue-500'; break;
                      case 'stopSpeaking': color = 'bg-gray-500'; break;
                      default: color = 'bg-gray-400';
                    }
                    
                    return (
                      <div 
                        key={index}
                        className="absolute group cursor-pointer z-10"
                        style={{ left: `${position}%`, height: '100%' }}
                        onClick={() => seekToTime(event.recordingTimestamp)}
                      >
                        <div className={`${color} h-full w-0.5`}></div>
                        
                        {/* Tooltip */}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 transform scale-0 group-hover:scale-100 transition-transform origin-bottom z-30">
                          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-md p-2 text-xs whitespace-nowrap text-gray-800 dark:text-gray-200">
                            <p className="font-medium">{event.displayName}</p>
                            <p>{
                              event.type === 'join' ? 'Joined' : 
                              event.type === 'leave' ? 'Left' : 
                              event.type === 'startSpeaking' ? 'Started speaking' : 
                              event.type === 'stopSpeaking' ? 'Stopped speaking' : 
                              event.type
                            }</p>
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
                  <span>Start speaking</span>
                </div>
                <div className="flex items-center gap-1 text-gray-800 dark:text-gray-200">
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <span>Stop speaking</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'transcription' && (
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm">
          <div className="flex justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Transcription</h3>
            <button className="text-blue-600 dark:text-blue-400 text-sm flex items-center">
              <Download className="h-4 w-4 mr-1" />
              Download
            </button>
          </div>
          <div className="max-h-screen-3/4 overflow-y-auto p-4 bg-white dark:bg-gray-800 rounded-md whitespace-pre-wrap custom-scrollbar text-gray-800 dark:text-gray-200">
            {transcription}
          </div>
        </div>
      )}
      
      {activeTab === 'summary' && (
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 shadow-sm">
          <div className="flex justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Summary</h3>
            <button className="text-blue-600 dark:text-blue-400 text-sm flex items-center">
              <Download className="h-4 w-4 mr-1" />
              Download
            </button>
          </div>
          <div className="max-h-screen-3/4 overflow-y-auto p-4 bg-white dark:bg-gray-800 rounded-md whitespace-pre-wrap markdown-content custom-scrollbar text-gray-800 dark:text-gray-200">
            {summary}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900'}`}
    >
      <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center sticky top-0 z-10 bg-white dark:bg-gray-900 shadow-sm">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-gray-100">
          <Users className="h-6 w-6" /> 
          Discord Meeting Player
        </h1>
        <button 
          onClick={toggleDarkMode} 
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Toggle dark mode"
        >
          {darkMode ? <Sun className="h-5 w-5 text-gray-800 dark:text-gray-200" /> : <Moon className="h-5 w-5 text-gray-800 dark:text-gray-200" />}
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
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 dark:border-blue-400"></div>
          </div>
        ) : (
          selectedMeeting ? renderMeetingPlayer() : renderMeetingList()
        )}
      </main>
      
      <footer className="p-4 border-t dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
        Discord Meeting Player © 2025 - Weekly Transcription Bot
      </footer>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${darkMode ? '#1f2937' : '#f3f4f6'};
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: ${darkMode ? '#4b5563' : '#d1d5db'};
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: ${darkMode ? '#6b7280' : '#9ca3af'};
        }
        
        .dropdown:hover .dropdown-menu {
          display: block;
        }
      `}</style>
    </div>
  );
};

export default MeetingPlayer;