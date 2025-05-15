// Simple development version of the React app
// This allows you to run without a build process

// Create a basic React component using JSX transformed in the browser
const App = () => {
  const [meetings, setMeetings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [selectedMeeting, setSelectedMeeting] = React.useState(null);
  const [darkMode, setDarkMode] = React.useState(
    localStorage.getItem('darkMode') === 'true' || 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

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
    fetch('/api/meetings')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setMeetings(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching meetings:', err);
        setError('Failed to load meetings. Please check if the meetings directory exists and contains recordings.');
        setLoading(false);
        
        // For demo purposes, use some sample data
        setMeetings([
          { id: '1', name: 'sample-meeting', date: '2025-05-10', duration: 60 },
          { id: '2', name: 'test-recording', date: '2025-05-08', duration: 45 }
        ]);
      });
  }, []);

  // Format time (seconds to MM:SS)
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
      <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-users"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> 
          Discord Meeting Player
        </h1>
        <button 
          onClick={toggleDarkMode} 
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
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
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
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
                        {meeting.duration ? formatTime(meeting.duration) : '00:00'}
                      </span>
                      <span>·</span>
                      <span>{new Date(meeting.date).toLocaleDateString()}</span>
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
          // Meeting view with player (simplified for direct implementation)
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">{selectedMeeting.name}</h2>
              <button 
                onClick={() => setSelectedMeeting(null)} 
                className="px-3 py-1 text-sm rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Back to Meetings
              </button>
            </div>
            
            {/* Basic audio player */}
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <div className="text-center p-8">
                <audio 
                  controls 
                  className="w-full" 
                  src={`/meetings/${selectedMeeting.name}/${selectedMeeting.name}.mp3`}
                  controlsList="nodownload"
                >
                  Your browser does not support the audio element.
                </audio>
                <p className="mt-4 text-sm">
                  This is a basic player. The full implementation with waveform visualization and 
                  participant tracking would require the complete React component setup.
                </p>
              </div>
            </div>
            
            {/* Get transcription if available */}
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <h3 className="font-semibold mb-3">Transcription</h3>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm max-h-96 overflow-y-auto">
                <p id="transcription-content">Loading transcription...</p>
              </div>
            </div>
            
            {/* Summary if available */}
            <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
              <h3 className="font-semibold mb-3">Summary</h3>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm max-h-96 overflow-y-auto">
                <div id="summary-content">Loading summary...</div>
              </div>
            </div>
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

// Fetch transcription and summary when a meeting is selected
window.addEventListener('load', function() {
  // Check periodically if a meeting has been selected and needs content loaded
  setInterval(() => {
    const transcriptionContent = document.getElementById('transcription-content');
    const summaryContent = document.getElementById('summary-content');
    
    if (transcriptionContent && transcriptionContent.textContent === 'Loading transcription...') {
      // Extract meeting name from URL if available
      const audioElement = document.querySelector('audio');
      if (audioElement && audioElement.src) {
        const match = audioElement.src.match(/\/meetings\/([^/]+)\//);
        if (match && match[1]) {
          const meetingName = match[1];
          
          // Fetch transcription
          fetch(`/meetings/${meetingName}/${meetingName}.txt`)
            .then(response => response.text())
            .then(text => {
              transcriptionContent.textContent = text || 'No transcription available';
            })
            .catch(() => {
              transcriptionContent.textContent = 'Failed to load transcription';
            });
            
          // Fetch summary  
          fetch(`/meetings/${meetingName}/${meetingName}.md`)
            .then(response => response.text())
            .then(markdown => {
              summaryContent.textContent = markdown || 'No summary available';
            })
            .catch(() => {
              summaryContent.textContent = 'Failed to load summary';
            });
        }
      }
    }
  }, 1000);
});