import React, { useState, useEffect } from 'react';
import { User, Mic, MicOff, UserPlus, UserMinus } from 'lucide-react';

const ParticipantTimeline = ({ 
  participants, 
  currentTime, 
  duration, 
  darkMode,
  events = [] // join/leave/mute events
}) => {
  // Calculate timeline position percentage based on current time
  const timelinePosition = (currentTime / duration) * 100;
  
  return (
    <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 mt-6">
      <h3 className="font-semibold mb-4">Participant Timeline</h3>
      
      <div className="relative">
        {/* Current time indicator */}
        <div 
          className="absolute top-0 bottom-0 w-px bg-red-500 z-10" 
          style={{ left: `${timelinePosition}%` }}
        ></div>
        
        {/* Timeline scale */}
        <div className="flex justify-between mb-2 text-xs text-gray-500 dark:text-gray-400">
          <span>00:00</span>
          <span>{formatTime(duration / 4)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(3 * duration / 4)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        
        {/* Participant rows */}
        <div className="space-y-3">
          {participants.map(participant => (
            <div key={participant.id} className="flex">
              <div className="w-24 flex items-center pr-2">
                <img 
                  src={participant.avatar} 
                  alt={participant.name} 
                  className="w-6 h-6 rounded-full mr-2"
                />
                <span className="text-sm truncate">{participant.name}</span>
              </div>
              
              <div className="flex-grow h-6 bg-gray-100 dark:bg-gray-700 rounded relative">
                {/* Voice activity visualization */}
                {generateActivityBars(participant, duration, darkMode)}
                
                {/* Mute indicators */}
                {participant.muteEvents?.map((event, index) => (
                  <div 
                    key={index}
                    className="absolute top-0 bottom-0 flex items-center justify-center"
                    style={{ 
                      left: `${(event.time / duration) * 100}%`,
                      backgroundColor: event.muted ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                      width: event.duration ? `${(event.duration / duration) * 100}%` : '8px'
                    }}
                  >
                    {event.muted && (
                      <MicOff className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Events visualization (join/leave) */}
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Events</h4>
          <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded relative">
            {events.map((event, index) => (
              <div 
                key={index}
                className="absolute top-0 bottom-0 w-px"
                style={{ 
                  left: `${(event.time / duration) * 100}%`,
                  backgroundColor: event.type === 'join' ? '#10b981' : '#ef4444'
                }}
              >
                <div className="absolute -top-5 -translate-x-1/2 flex flex-col items-center">
                  <div className={`rounded-full p-1 ${
                    event.type === 'join' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {event.type === 'join' ? (
                      <UserPlus className="h-3 w-3" />
                    ) : (
                      <UserMinus className="h-3 w-3" />
                    )}
                  </div>
                  <span className="text-xs whitespace-nowrap mt-1">
                    {event.user}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to format time
const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Generate voice activity visualization
const generateActivityBars = (participant, duration, darkMode) => {
  // This function would normally use real voice activity data
  // For demo, we'll generate random activity
  
  if (!participant.activityData) {
    // Mock data generation
    const activityData = [];
    const activitySegments = Math.floor(duration / 10); // One segment per 10 seconds
    
    for (let i = 0; i < activitySegments; i++) {
      // Random activity level (more likely to be quiet than speaking)
      const level = Math.random() > 0.7 ? Math.random() * 0.8 + 0.2 : 0;
      
      if (level > 0) {
        activityData.push({
          startTime: i * 10,
          duration: Math.random() * 8 + 2, // 2-10 seconds
          level
        });
      }
    }
    
    // Store the generated data
    participant.activityData = activityData;
  }
  
  return participant.activityData.map((activity, index) => (
    <div
      key={index}
      className="absolute top-0 bottom-0 bg-blue-400 dark:bg-blue-500 rounded"
      style={{ 
        left: `${(activity.startTime / duration) * 100}%`,
        width: `${(activity.duration / duration) * 100}%`,
        opacity: activity.level
      }}
    />
  ));
};

// Component to show synchronized transcription with timestamps
const SynchronizedTranscription = ({ 
  transcription, 
  currentTime, 
  onSeek 
}) => {
  const [segments, setSegments] = useState([]);
  const [activeSegment, setActiveSegment] = useState(null);
  
  // Process transcription data
  useEffect(() => {
    if (transcription) {
      // In a real implementation, this would parse actual transcription data
      // with timestamps
      
      // Mock implementation - split text into segments with timestamps
      const lines = transcription.split('\n');
      const mockSegments = [];
      let currentTime = 0;
      
      for (const line of lines) {
        if (line.trim()) {
          // Generate a speaker randomly
          const speakers = ['Alice', 'Bob', 'Charlie', 'Diana'];
          const speaker = speakers[Math.floor(Math.random() * speakers.length)];
          
          // Generate segment duration based on text length
          const duration = (line.length / 20) * 5 + 2; // ~5 seconds per 20 chars + 2s base
          
          mockSegments.push({
            speaker,
            text: line.trim(),
            startTime: currentTime,
            endTime: currentTime + duration
          });
          
          currentTime += duration;
        }
      }
      
      setSegments(mockSegments);
    }
  }, [transcription]);
  
  // Update active segment based on current time
  useEffect(() => {
    const active = segments.find(
      segment => currentTime >= segment.startTime && currentTime <= segment.endTime
    );
    
    if (active && (!activeSegment || active.startTime !== activeSegment.startTime)) {
      setActiveSegment(active);
    }
  }, [currentTime, segments, activeSegment]);
  
  // Seek to segment time when clicked
  const handleSegmentClick = (segment) => {
    if (onSeek) {
      onSeek(segment.startTime);
    }
  };
  
  return (
    <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 mt-6">
      <h3 className="font-semibold mb-4">Synchronized Transcription</h3>
      
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {segments.map((segment, index) => (
          <div 
            key={index}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              activeSegment && segment.startTime === activeSegment.startTime
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => handleSegmentClick(segment)}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-sm">{segment.speaker}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(segment.startTime)}
              </span>
            </div>
            <p className="text-sm">{segment.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export { ParticipantTimeline, SynchronizedTranscription };