import React, { useState } from "react";
import PropTypes from "prop-types";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Footer from "./Footer";

const FileUpload = ({ getRootProps, getInputProps, file }) => (
  <div {...getRootProps()} style={styles.dropzone}>
    <input {...getInputProps()} />
    <p>
      {file
        ? file.name
        : "📁 Drag & drop a ZIP file here, or click to select one"}
    </p>
  </div>
);

FileUpload.propTypes = {
  getRootProps: PropTypes.func.isRequired,
  getInputProps: PropTypes.func.isRequired,
  file: PropTypes.object,
};

const Settings = ({
  numTopics,
  setNumTopics,
  numWords,
  setNumWords,
  stopwords,
  setStopwords,
}) => (
  <div style={styles.settingsContainer}>
    {[
      {
        label: "Number of Topics:  ",
        value: numTopics,
        setValue: setNumTopics,
      },
      {
        label: "Number of Words per Topic:  ",
        value: numWords,
        setValue: setNumWords,
      },
    ].map(({ label, value, setValue }, index) => (
      <div key={index} style={styles.setting}>
        <label>
          {label}
          <input
            type="number"
            value={value}
            onChange={(e) => {
              console.debug(`Input change for ${label}: ${e.target.value}`);
              setValue(
                Math.min(45, Math.max(0, parseInt(e.target.value, 10) || 0))
              );
            }}
            min="0"
            max="45"
            style={styles.input}
          />
        </label>
      </div>
    ))}

    <div style={styles.setting}>
      <label>
        <br />
        Additional Stopwords (comma-separated) 🚫:
        <input
          type="text"
          value={stopwords}
          onChange={(e) => {
            console.debug("Stopwords input:", e.target.value); 
            setStopwords(e.target.value); 
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
  numPapers: PropTypes.number.isRequired,
  setNumTopics: PropTypes.func.isRequired,
  numWords: PropTypes.number.isRequired,
  setNumWords: PropTypes.func.isRequired,
  stopwords: PropTypes.string.isRequired,
  setStopwords: PropTypes.func.isRequired,
};

const BibliographySettings = ({
  includeBibliography,
  setIncludeBibliography,
  includeDecadeAnalysis,
  setIncludeDecadeAnalysis,
  stopwords,
  setStopwords,
}) => (
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

const App = () => {
  const [numTopics, setNumTopics] = useState(5);
  const [numWords, setNumWords] = useState(10); 
  const [file, setFile] = useState(null); 
  const [results, setResults] = useState(null); 
  const [chartBase64, setChartBase64] = useState({});
  const [decadeChartBase64, setDecadeChartBase64] = useState({});
  const [stopwords, setStopwords] = useState(""); 
  const [includeBibliography, setIncludeBibliography] = useState(false); 
  const [includeDecadeAnalysis, setIncludeDecadeAnalysis] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [topics, setTopics] = useState([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const handleTopicSelect = (event) => {
    const selectedTopicId = event.target.value;
    const topic = topics.find((topic) => topic.Topic === selectedTopicId);
    setSelectedTopic(topic); 
  };
  const averageLift = results?.average_lift_per_topic
  ? (results.average_lift_per_topic.reduce((a, b) => a + b, 0) / results.average_lift_per_topic.length).toFixed(1)
  : 'N/A';
  const handleExportCharts = async () => {
    if (!chartBase64 && !decadeChartBase64) {
      alert("No charts available to export!");
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder("topic_analysis_charts");

    if (chartBase64) {
      Object.entries(chartBase64).forEach(([topicName, base64], index) => {
        const content = base64.split(";base64,").pop();
        folder.file(`${topicName.replace(/ /g, "_")}.png`, content, {
          base64: true,
        });
      });
    }

    if (decadeChartBase64) {
      const decadeContent = decadeChartBase64.split(";base64,").pop();
      folder.file("decade_analysis.png", decadeContent, { base64: true });
    }

    zip.generateAsync({ type: "blob" }).then((content) => {
      saveAs(content, "topic_analysis_charts.zip");
    });
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
          <strong>Enhanced Word Importance Calculation:</strong>
          <br />
          Combined Score = (0.5 × Raw Score) + (0.3 × TF-IDF) + (0.2 × Saliency)
        </p>
        <ul style={styles.explanationList}>
          <li>
            <strong>Raw Score:</strong> Basic importance from LDA model
          </li>
          <li>
            <strong>TF-IDF:</strong> Term frequency adjusted for cross-topic
            rarity
          </li>
          <li>
            <strong>Saliency:</strong> Balances frequency and distinctiveness
          </li>
          <li>
            <strong>Lift:</strong> Specificity ratio (topic vs global
            probability)
          </li>
          <li>
            <strong>Entropy:</strong> Measures topic concentration (lower = more
            specific)
          </li>
        </ul>
      </div>
      <br></br>
      <div style={styles.explanationContent}>
        <p style={styles.explanationText}>
          This analysis processed {results?.num_pdfs || 0} PDF documents,
          identifying {results?.num_topics || 0} key topics with{" "}
          {results?.num_words || 0} words per topic.
        </p>
        <p style={styles.explanationText}>Key Metrics:</p>
        <ul style={styles.explanationList}>
          <li>📄 Processed Documents: {results?.num_pdfs  || 0}</li>
          <li>🗂️ Identified Topics: {results?.num_topics || 0}</li>
          <li>🔠 Words per Topic: {results?.num_words || 0}</li>
          <li>⏳ Time Period: {results?.time_period || 0}</li>
          <li>
            ⚖️ Average Lift:{" "}
            {averageLift}
          </li>
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

      console.log(
        "Received stopwords from backend:",
        data.additional_stopwords
      );

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
      ...results.topics.map(
        (topic) =>
          `"${topic.Topic}","${topic.Topic}",` +
          `"${topic.Words}","${topic.WordScores.percentages.join(", ")}"`
      ),
    ].join("\n");

    // Create download
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "topic_analysis.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>📚 PDF Topic Analysis</h1>
      <FileUpload
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        file={file}
      />
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
                  <div style={styles.dropdownContainer}>
                    <label htmlFor="topicDropdown" style={styles.dropdownLabel}>
                      Select a Topic:
                    </label>
                    <select
                      id="topicDropdown"
                      value={selectedTopic ? selectedTopic.Topic : ""}
                      onChange={handleTopicSelect}
                      style={styles.topicDropdown} // Apply topicDropdown styles here
                    >
                      <option value="" style={styles.dropdownOption}>
                        -- Select a Topic --
                      </option>
                      {topics.map((topic, index) => (
                        <option
                          key={index}
                          value={topic.Topic}
                          style={styles.dropdownOption}
                        >
                          {topic.Topic}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedTopic && (
                    <div>
                      <h4>{selectedTopic.Topic}</h4>
                      <p>
                        <strong>Words:</strong>{" "}
                        {selectedTopic.Words || "No words available."}
                      </p>
                    </div>
                  )}

                  {/* Render Chart for the Selected Topic */}
                  {chartBase64 && selectedTopic && (
                    <div style={styles.selectedTopicChart}>
                      <img
                        src={`data:image/png;base64,${
                          chartBase64[selectedTopic.Topic]
                        }`}
                        alt={`${selectedTopic.Topic} distribution chart`}
                        style={styles.responsiveChartImage}
                      />
                    </div>
                  )}
                  {includeDecadeAnalysis && decadeChartBase64 && (
                    <div>
                      <h4>📅 Decade Analysis Chart</h4>
                      <div style={styles.selectedTopicChart}>
                        <img
                          src={`data:image/png;base64,${decadeChartBase64}`}
                          alt="Decade Analysis Chart"
                          style={styles.responsiveChartImage}
                        />
                      </div>
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
            <button style={styles.exportButton} onClick={handleExportCSV}>
              📥 Export Data (CSV)
            </button>
            <button style={styles.exportButton} onClick={handleExportCharts}>
              🖼️ Export All Charts (ZIP)
            </button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

// Dark Mode Styles
const styles = {
  container: {
    padding: "30px",
    marginTop: "40px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#121212",
    borderRadius: "8px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.5)",
    maxWidth: "700px",
    margin: "auto",
    textAlign: "center",
    color: "#E0E0E0",
  },
  header: {
    color: "#FFF",
    fontSize: "36px",
    marginBottom: "20px",
  },
  dropzone: {
    border: "2px dashed #FFFFFF",
    padding: "30px",
    marginBottom: "20px",
    backgroundColor: "#1F1F1F",
    cursor: "pointer",
    borderRadius: "8px",
    color: "#E0E0E0",
  },
  settingsContainer: {
    marginBottom: "20px",
  },
  setting: {
    marginBottom: "15px",
    textAlign: "left",
  },
  input: {
    backgroundColor: "#333",
    color: "#E0E0E0",
    border: "1px solid #444",
    padding: "5px",
    borderRadius: "4px",
    width: "100px",
  },
  button: {
    backgroundColor: "#6200EE",
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
    backgroundColor: "#333",
    color: "#E0E0E0",
    border: "1px solid #444",
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
  dropdownContainer: {
    margin: "10px 0",
    position: "relative",
    maxWidth: "200px",
    width: "100%",
    backgroundColor: "#121212", // Black background
  },
  dropdownLabel: {
    display: "block",
    marginBottom: "8px",
    color: "#FFFFFF", // White text
    fontSize: "0.95rem",
    fontWeight: "500",
    backgroundColor: "#121212", // Black background
  },
  topicDropdown: {
    width: "100%",
    padding: "12px 16px",
    fontSize: "0.85rem",
    backgroundColor: "#1A1A1A", // Dark grey background
    border: "1px solid #333", // Grey border
    borderRadius: "8px",
    color: "#FFFFFF", // White text
    appearance: "none",
    transition: "all 0.3s ease",
    cursor: "pointer",
    "&:hover": {
      borderColor: "#555", // Lighter grey border on hover
      backgroundColor: "#2A2A2A", // Slightly lighter grey background
    },
    "&:focus": {
      outline: "none",
      borderColor: "#4CAF50", // Green border on focus
      boxShadow: "0 0 0 2px rgba(76, 175, 80, 0.2)", // Green focus shadow
    },
  },
  dropdownOption: {
    backgroundColor: "#1F1F1F", // Dark grey option background
    color: "#FFFFFF", // White text
    padding: "12px",
    fontSize: "0.85rem",
    "&:hover": {
      backgroundColor: "#4CAF50", // Green background on hover
      color: "#FFFFFF", // White text on hover
    },
  },
  dropdownArrow: {
    position: "absolute",
    right: "15px",
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "#AAAAAA", // Light grey arrow
    fontSize: "1.2rem",
  },

  selectedTopicChart: {
    width: "95%",
    maxWidth: "1000px",
    margin: "20px 0",
    padding: "20px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
  },
  responsiveChartImage: {
    width: "100%",
    height: "auto",
    maxHeight: "600px",
    objectFit: "contain",
    border: "1px solid #eee",
    borderRadius: "4px",
  },
  chartTitle: {
    color: "#333",
    marginBottom: "15px",
    fontSize: "1.25rem",
    fontWeight: "500",
  },
  chartContainer: {
    width: "100%",
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px 0",
  },
  exportButtons: {
    margin: "20px 0",
    display: "flex",
    gap: "10px",
  },
  exportButton: {
    padding: "10px 20px",
    backgroundColor: "#6200EE",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    "&:hover": {
      backgroundColor: "#45a049",
    },
  },
  chartImage: {
    width: "100%",
    height: "auto",
    maxHeight: "80vh",
    objectFit: "contain",
  },
  decadeChartContainer: {
    width: "50%",
    marginTop: "30px",
    padding: "20px",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  infoButton: {
    background: "none",
    border: "none",
    color: "#FFFFFF",
    fontSize: "1.1rem",
    cursor: "pointer",
    padding: "5px",
    borderRadius: "50%",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "&:hover": {
      backgroundColor: "#f0f0f0",
    },
  },
  explanationBox: {
    position: "relative",
    backgroundColor: "#f8f9fa",
    borderRadius: "6px",
    padding: "15px",
    margin: "10px 0",
    border: "1px solid #dee2e6",
    fontSize: "0.9rem",
  },
  explanationContent: {
    marginRight: "20px",
  },
  explanationText: {
    margin: "0 0 10px 0",
    color: "#495057",
    lineHeight: "1.4",
  },
  explanationList: {
    margin: "0",
    paddingLeft: "20px",
    color: "#6c757d",
  },
  closeButton: {
    position: "absolute",
    top: "5px",
    right: "5px",
    background: "none",
    border: "none",
    color: "#6c757d",
    fontSize: "1.3rem",
    cursor: "pointer",
    padding: "2px 5px",
    "&:hover": {
      color: "#495057",
    },
  },
  wordScores: {
    marginTop: "10px",
    padding: "10px",
    backgroundColor: "#2A2A2A",
    borderRadius: "6px",
  },
  scoreRow: {
    display: "flex",
    justifyContent: "space-between",
    margin: "5px 0",
  },
  wordLabel: {
    flex: 2,
    textAlign: "left",
  },
  percentage: {
    flex: 1,
    textAlign: "right",
    color: "#4CAF50",
    margin: "0 10px",
  },
  rawScore: {
    flex: 1,
    textAlign: "right",
    color: "#9E9E9E",
    fontSize: "0.8em",
  },
  topicSelection: {
    margin: "20px 0",
  },
  topicDetail: {
    backgroundColor: "#2A2A2A",
    padding: "20px",
    borderRadius: "8px",
    margin: "20px 0",
  },
  decadeAnalysis: {
    marginTop: "40px",
    padding: "20px",
    backgroundColor: "#2A2A2A",
    borderRadius: "8px",
  },
  statsContainer: {
    backgroundColor: "#2A2A2A",
    padding: "15px",
    borderRadius: "8px",
    margin: "20px 0",
  },
  statItem: {
    display: "flex",
    justifyContent: "space-between",
    margin: "8px 0",
    padding: "8px",
    backgroundColor: "#333",
    borderRadius: "4px",
  },
  statLabel: {
    color: "#E0E0E0",
    fontWeight: "500",
  },
  statValue: {
    color: "#4CAF50",
    fontWeight: "600",
  },
};

export default App;
