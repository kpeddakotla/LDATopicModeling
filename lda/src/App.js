import React, { useState } from "react";
import PropTypes from "prop-types";
import { useDropzone } from "react-dropzone";

// File Upload Component
const FileUpload = ({ getRootProps, getInputProps, file }) => (
  <div {...getRootProps()} style={styles.dropzone}>
    <input {...getInputProps()} />
    <p>{file ? file.name : "📁 Drag & drop a ZIP file here, or click to select one"}</p>
  </div>
);

FileUpload.propTypes = {
  getRootProps: PropTypes.func.isRequired,
  getInputProps: PropTypes.func.isRequired,
  file: PropTypes.object,
};

// Settings Component
const Settings = ({ 
  numTopics, 
  setNumTopics, 
  numWords, 
  setNumWords, 
  stopwords, 
  setStopwords 
}) => (
  <div style={styles.settingsContainer}>
    {/* Number of Topics and Words per Topic */}
    {[{ label: "Number of Topics:  ", value: numTopics, setValue: setNumTopics },
      { label: "Number of Words per Topic:  ", value: numWords, setValue: setNumWords }]
      .map(({ label, value, setValue }, index) => (
        <div key={index} style={styles.setting}>
          <label>
            {label}
            <input
              type="number"
              value={value}
              onChange={(e) => {
                console.debug(`Input change for ${label}: ${e.target.value}`);
                setValue(Math.min(45, Math.max(1, parseInt(e.target.value, 10) || 1)));
              }}
              min="1"
              max="45"
              style={styles.input}
            />
          </label>
        </div>
      ))}

    {/* Stopwords Input */}
    <div style={styles.setting}>
      <label>
    <br />
        Additional Stopwords (comma-separated) 🚫:
        <input
          type="text"
          value={stopwords}
          onChange={(e) => {
            console.debug("Stopwords input:", e.target.value); // Debug log
            setStopwords(e.target.value); // Update stopwords state
          }}
          placeholder="e.g., example, word, stop"
          style={styles.stopwordsInput}
        />
      </label>
    </div>
  </div>
);

Settings.propTypes = {
  numTopics: PropTypes.number.isRequired,
  setNumTopics: PropTypes.func.isRequired,
  numWords: PropTypes.number.isRequired,
  setNumWords: PropTypes.func.isRequired,
  stopwords: PropTypes.string.isRequired,
  setStopwords: PropTypes.func.isRequired,
};

// Bibliography Settings Component
const BibliographySettings = ({ includeBibliography, setIncludeBibliography, includeDecadeAnalysis, setIncludeDecadeAnalysis, stopwords, setStopwords }) => (
  <div style={styles.bibliographyContainer}>
    <br />
    <br />
    <h3 style={styles.sectionHeader}>Additional Settings</h3>
    <label style={styles.checkboxLabel}>
      <input
        type="checkbox"
        checked={includeBibliography}
        onChange={(e) => setIncludeBibliography(e.target.checked)}
        style={styles.checkbox}
      />
      Consider bibliography in analysis 📚
    </label>
    <br></br>
    <label style={styles.checkboxLabel}>
      <input
        type="checkbox"
        checked={includeDecadeAnalysis}
        onChange={(e) => setIncludeDecadeAnalysis(e.target.checked)}
        style={styles.checkbox}
      />
      Consider decade analysis in results 🕰️
    </label>
    <br />
    <br />
  </div>
);

BibliographySettings.propTypes = {
  includeBibliography: PropTypes.bool.isRequired,
  setIncludeBibliography: PropTypes.func.isRequired,
  includeDecadeAnalysis: PropTypes.bool.isRequired,
  setIncludeDecadeAnalysis: PropTypes.func.isRequired,
};

// Results Component
const Results = ({ 
  results, 
  chartBase64, 
  selectedTopic, 
  setSelectedTopic, 
  decadeChartBase64,
  includeDecadeAnalysis,
  topicCharts
}) => (
  <div style={styles.resultsContainer}>
    {/* Topic charts container */}
    <div style={styles.chartContainer}>
      <h3>Topic Distributions</h3>
      {Object.entries(topicCharts || {}).map(([topicName, chartData]) => (
        <img
          src={`data:image/png;base64,${chartData}`}
          alt={`${topicName} Distribution`}
          style={styles.chartImage}
        />
      ))}
    </div>

    {/* Decade chart - conditional and scaled */}
    {includeDecadeAnalysis && decadeChartBase64 && (
      <div style={styles.decadeChartContainer}>
        <h3>Decade Distribution</h3>
        <img
          src={`data:image/png;base64,${decadeChartBase64}`}
          alt="Decade Distribution Chart"
          style={styles.chartImage}
        />
      </div>
    )}
  </div>
);


Results.propTypes = {
  results: PropTypes.array.isRequired,
  chartBase64: PropTypes.string,
  selectedTopic: PropTypes.string,
  setSelectedTopic: PropTypes.func.isRequired,
  decadeChartBase64: PropTypes.string,
};


// Main App Component
const App = () => {
  const [numTopics, setNumTopics] = useState(5); // Track number of topics
  const [numWords, setNumWords] = useState(10); // Track number of words per topic
  const [file, setFile] = useState(null); // Store the selected file
  const [results, setResults] = useState(null); // Store analysis results
  const [chartBase64, setChartBase64] = useState({});
  const [decadeChartBase64, setDecadeChartBase64] = useState({});
  const [stopwords, setStopwords] = useState(""); // Define the stopwords state
  const [includeBibliography, setIncludeBibliography] = useState(false); // Toggle bibliography inclusion
  const [includeDecadeAnalysis, setIncludeDecadeAnalysis] = useState(false); // Toggle decade analysis inclusion
  const [loading, setLoading] = useState(false); // Loading state during analysis
  const [selectedTopic, setSelectedTopic] = useState("");
  const [topics, setTopics] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleTopicSelect = (event) => {
    const selectedTopicId = event.target.value;
    const topic = topics.find((topic) => topic.Topic === selectedTopicId);
    setSelectedTopic(topic); // Update the selected topic based on user selection
  };

  
  const explanationContent = (
    <div style={styles.explanationBox}>
      <button 
        style={styles.closeButton}
        onClick={() => setShowExplanation(false)}
      >
        ×
      </button>
      <div style={styles.explanationContent}>
        <p style={styles.explanationText}>
          <strong>Word Importance Calculation:</strong><br/>
          Percentage = (word score ÷ total topic score) × 100
        </p>
        <ul style={styles.explanationList}>
          <li>Word score: Raw importance from LDA model</li>
          <li>Total score: Sum of top {results?.topics[0]?.Words.split(', ').length} word scores</li>
          <li>Percentage shows relative contribution to topic</li>
        </ul>
      </div>
    </div>
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept: ".zip", // Allow only ZIP file uploads
    onDrop: (acceptedFiles) => {
      setFile(acceptedFiles[0]); // Set the file when dropped
    },
  });
  
  const handleAnalyze = async () => {
    if (!file) {
      alert("Please upload a ZIP file.");
      return;
    }
  
    // Set loading state before making the request
    setLoading(true);
  
    // Clear previous results to reset state for the new analysis
    setResults(null);
    setChartBase64(null);
    setSelectedTopic(""); // Reset selected topic
  
    // Clean and log the stopwords
    const cleanedStopwords = stopwords.trim();
    const stopwordsToSend = cleanedStopwords || ""; // Ensure it's always a string
  
    console.log("Stopwords input:", stopwords);
    console.log("Stopwords to send:", stopwordsToSend);
  
    const formData = new FormData();
    formData.append("file", file);
    formData.append("numTopics", numTopics);
    formData.append("numWords", numWords);
    formData.append("stopwords", stopwordsToSend); // Send stopwords to the backend
    formData.append("skip_bibliography", !includeBibliography);
    formData.append("include_decade_analysis", includeDecadeAnalysis); // Send decade analysis state
  
    try {
      const response = await fetch("http://localhost:5000/analyze", {
        method: "POST",
        body: formData,
      });
  
      const data = await response.json();
  
      // Update the state with the results from the backend
      if (data.topics) {
        setTopics(data.topics);
        setResults(data);
      }
  
      console.log("Received stopwords from backend:", data.additional_stopwords);
  
      if (data.topic_charts) {
        setChartBase64(data.topic_charts); // Store ALL topic charts
      }
      if (data.decade_chart_base64) {
        setDecadeChartBase64(data.decade_chart_base64);
      }
    } catch (error) {
      console.error("Error during analysis:", error);
      setResults(null);
      setChartBase64(null);
    } finally {
      setLoading(false);
    }
  };  

  const handleExportCSV = () => {
    // Create CSV content
    const csvContent = [
      "Topic ID,Topic Name,Top Words,Word Scores",
      ...results.topics.map(topic => 
        `"${topic.Topic}","${topic.Topic}",` +
        `"${topic.Words}","${topic.WordScores.percentages.join(', ')}"`
      )
    ].join('\n');
  
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'topic_analysis.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };
  
  const handleExportPNG = () => {
    if (selectedTopic && chartBase64 && chartBase64[selectedTopic.Topic]) {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${chartBase64[selectedTopic.Topic]}`;
      link.download = `${selectedTopic.Topic.replace(' ', '_')}_chart.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
  
  return (
    <div style={styles.container}>
      <h1 style={styles.header}>📚 PDF Topic Analysis</h1>
      <FileUpload getRootProps={getRootProps} getInputProps={getInputProps} file={file} />
      <Settings
        numTopics={numTopics}
        setNumTopics={setNumTopics}
        numWords={numWords}
        setNumWords={setNumWords}
        stopwords={stopwords}
        setStopwords={setStopwords} 
      />
      <BibliographySettings 
        includeBibliography={includeBibliography} 
        setIncludeBibliography={setIncludeBibliography} 
        includeDecadeAnalysis={includeDecadeAnalysis} 
        setIncludeDecadeAnalysis={setIncludeDecadeAnalysis} 
      />
      <button onClick={handleAnalyze} style={styles.button} disabled={loading}>
        {loading ? "Analyzing..." : "🔍 Run Analysis"}
      </button>
      <div style={styles.resultsContainer}>
      <div style={styles.headerRow}>
                    <h3 style={styles.sectionHeader}>📊 Analysis Results</h3>
                    <button 
                      style={styles.infoButton}
                      onClick={() => setShowExplanation(!showExplanation)}
                    >
                      ℹ
                    </button>
                  </div>
                  
                  {showExplanation && explanationContent} 
      {loading ? (
        <p>Loading analysis...</p>
      ) : results && results.topics && results.topics.length > 0 ? (
        <>
          <div>
            <h4>Topics:</h4>
            {topics && topics.length > 0 ? (
              <div>
                <label htmlFor="topicDropdown">Select a Topic: </label>
                <select
                  id="topicDropdown"
                  value={selectedTopic ? selectedTopic.Topic : ""}
                  onChange={handleTopicSelect}
                >
                  <option value="">-- Select a Topic --</option>
                  {topics.map((topic, index) => (
                    <option key={index} value={topic.Topic}>
                      {topic.Topic}
                    </option>
                  ))}
                </select>

                {selectedTopic && (
                  <div>
                    <h4>{selectedTopic.Topic}</h4>
                    <p>
                      <strong>Words:</strong> {selectedTopic.Words || "No words available."}
                    </p>
                  </div>
                )}

                {/* Render Chart for the Selected Topic */}
                {chartBase64 && selectedTopic && (
                  <div style={styles.selectedTopicChart}>
                    <img
                      src={`data:image/png;base64,${chartBase64[selectedTopic.Topic]}`}
                      alt={`${selectedTopic.Topic} distribution chart`}
                      style={styles.responsiveChartImage}
                    />
                  </div>
                )}
                <div style={styles.resultsContainer}>
                </div>
                {includeDecadeAnalysis && decadeChartBase64 && (
                  <div>
                    <h4>📅 Decade Analysis Chart</h4>
                    <img 
                      src={`data:image/png;base64,${decadeChartBase64}`} 
                      alt="Decade Analysis Chart" 
                      style={styles.chartImage}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p>No topics available.</p>
            )}
          </div>
        </>
      ) : (
        <p>Results will appear here after analysis.</p>
      )}
      {results && (
        <div style={styles.exportButtons}>
          <button 
            style={styles.exportButton}
            onClick={handleExportCSV}
          >
            📥 Export Data (CSV)
          </button>
          <button 
            style={styles.exportButton}
            onClick={handleExportPNG}
          >
            🖼️ Export Charts (PNG)
          </button>
        </div>
      )}

      </div>
    </div>
  );  
};

// Dark Mode Styles
const styles = {
  selectedTopicChart: {
    width: '95%',
    maxWidth: '1000px',
    margin: '20px 0',
    padding: '20px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  responsiveChartImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '600px',
    objectFit: 'contain',
    border: '1px solid #eee',
    borderRadius: '4px'
  },
  chartTitle: {
    color: '#333',
    marginBottom: '15px',
    fontSize: '1.25rem',
    fontWeight: '500'
  },
  chartContainer: {
    width: '100%',
    maxWidth: '1200px',  // Maximum container width
    margin: '0 auto',    // Center container
    padding: '20px 0'
  },
  exportButtons: {
    margin: '20px 0',
    display: 'flex',
    gap: '10px'
  },
  exportButton: {
    padding: '10px 20px',
    backgroundColor: '#6200EE',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    '&:hover': {
      backgroundColor: '#45a049'
    }
  },
  chartImage: {
    width: '100%',       // Fill container width
    height: 'auto',      // Maintain aspect ratio
    maxHeight: '80vh',   // Prevent vertical overflow
    objectFit: 'contain' // Prevent distortion
  },
  decadeChartContainer: {
    width: '50%',
    marginTop: '30px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px'
  },
  container: {
    padding: "30px",
    marginTop: "40px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#121212", // Dark background color
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)", // Darker shadow for better depth
    maxWidth: "700px",
    margin: "auto",
    textAlign: "center",
    color: "#E0E0E0", // Light gray text
  },
  header: {
    color: "#FFF",
    fontSize: "36px",
    marginBottom: "20px",
  },
  dropzone: {
    border: "2px dashed #FFFFFF", // Light gray border
    padding: "30px",
    marginBottom: "20px",
    backgroundColor: "#1F1F1F", // Darker background for the dropzone
    cursor: "pointer",
    borderRadius: "8px",
    color: "#E0E0E0", // Light text
  },
  settingsContainer: {
    marginBottom: "20px",
  },
  setting: {
    marginBottom: "15px",
    textAlign: "left",
  },
  input: {
    backgroundColor: "#333", // Dark background for inputs
    color: "#E0E0E0", // Light text
    border: "1px solid #444", // Slightly lighter border for inputs
    padding: "5px",
    borderRadius: "4px",
    width: "100px",
  },
  button: {
    backgroundColor: "#6200EE", // Bright accent color for the button
    color: "#FFF",
    padding: "10px 20px",
    fontSize: "16px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s",
  },
  resultsContainer: {
    marginTop: "30px",
    textAlign: "left",
  },
  results: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    textAlign: "left",
    color: "#FFF",
  },
  stopwordsInput: {
    backgroundColor: "#333", // Dark background for inputs
    color: "#E0E0E0", // Light text
    border: "1px solid #444", // Slightly lighter border for inputs
    padding: "5px",
    borderRadius: "4px",
    width: "100%",
  },
  bibliographyContainer: {
    textAlign: "left",
    color: "#E0E0E0",
  },
  sectionHeader: {
    fontSize: "18px",
    marginBottom: "10px",
  },
  checkboxLabel: {
    fontSize: "16px",
    color: "#E0E0E0",
  },
  checkbox: {
    marginRight: "10px",
  },
  dropdown: {
    marginLeft: "10px",
    padding: "5px",
    borderRadius: "4px",
    backgroundColor: "#333",
    color: "#E0E0E0",
  },
  wordScores: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#2A2A2A',
    borderRadius: '6px'
  },
  scoreRow: {
    display: 'flex',
    justifyContent: 'space-between',
    margin: '5px 0'
  },
  wordLabel: {
    flex: 2,
    textAlign: 'left'
  },
  percentage: {
    flex: 1,
    textAlign: 'right',
    color: '#4CAF50', // Green for percentages
    margin: '0 10px'
  },
  rawScore: {
    flex: 1,
    textAlign: 'right',
    color: '#9E9E9E', // Grey for raw scores
    fontSize: '0.8em'
  },
  
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  infoButton: {
    background: 'none',
    border: 'none',
    color: '#FFFFFF',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '5px',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      backgroundColor: '#f0f0f0',
    }
  },
  explanationBox: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    padding: '15px',
    margin: '10px 0',
    border: '1px solid #dee2e6',
    fontSize: '0.9rem',
  },
  explanationContent: {
    marginRight: '20px', // Space for close button
  },
  explanationText: {
    margin: '0 0 10px 0',
    color: '#495057',
    lineHeight: '1.4',
  },
  explanationList: {
    margin: '0',
    paddingLeft: '20px',
    color: '#6c757d',
  },
  closeButton: {
    position: 'absolute',
    top: '5px',
    right: '5px',
    background: 'none',
    border: 'none',
    color: '#6c757d',
    fontSize: '1.3rem',
    cursor: 'pointer',
    padding: '2px 5px',
    '&:hover': {
      color: '#495057',
    }
  },
};

export default App;
