# PDF LDA Topic Modeling Tool

The **PDF LDA Topic Modeling Tool** is a Python-based web application that allows users to analyze collections of academic papers (in PDF format) and extract meaningful topics using Latent Dirichlet Allocation (LDA). This tool provides insights into the underlying themes within the documents and visualizes trends across topics.

---

## Features

### Working Features
- **Upload ZIP of PDFs**: Users can upload a `.zip` file containing multiple PDFs for analysis.
- **Customizable Topic Modeling**:
  - Specify the number of topics to generate.
  - Customize the number of words per topic.
- **Stopword Integration**:
  - Uses default English stopwords.
  - Allows users to specify additional stopwords.
- **Bibliography Skipping**: Option to skip bibliography sections in PDFs during analysis.
- **LDA Model with Scikit-Learn**: Implements LDA to identify topics and extract relevant terms.

### Not Working
- **Topic Visualization**:
  - Currently does not correctly generate a chart visualizing topics and trends over time.
- **Year-Based Trend Visualization**:
  - Currently does not correctly correlate topics with decades from the documents.
- **Error Handling for Incorrect Inputs**:
  - Insufficient validation for improperly formatted ZIP files (e.g., missing PDFs).

### Planned Features
- **Improved Year Extraction**:
  - Extract publication years from metadata or document text for trend analysis.
- **Better PDF Parsing**:
  - Support for a wider variety of PDF formats (e.g., scanned PDFs using OCR).
- **Interactive Visualizations**:
  - Enable users to interact with topic charts for deeper insights.
- **Multi-Language Support**:
  - Add support for stopwords and analysis in other languages.
- **Export Results**:
  - Allow users to download topics and visualizations as files (CSV, PNG, etc.).
- **Real-Time Analysis Progress**:
  - Display progress during the analysis for better user experience.
- **Advanced Preprocessing Options**:
  - Enable users to customize tokenization, stemming, and lemmatization settings.

---

## Installation

Follow these steps to set up the application on your local machine:

### Prerequisites
- Python 3.8+
- Node.js and npm (for the frontend)
- pip (Python package manager)

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/pdf-lda-topic-modeling.git
   cd pdf-lda-topic-modeling
   ```
2. Set up a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the  server:
   ```bash
   npm start
   ```

---

## Usage

1. Launch the server using npm start, which will run on `http://localhost:3000` by default.
2. Navigate to `http://localhost:3000` in your browser.
3. Upload a `.zip` file containing academic PDFs.
4. Specify the desired parameters:
   - Number of topics
   - Number of words per topic
   - Additional stopwords (optional)
   - Whether to skip bibliography sections
5. Click "Analyze" to run the topic modeling process and view the results.

---

## Example Results

### Input
- A `.zip` file containing 10 research papers.
- Parameters:
  - Topics: 5
  - Words per Topic: 10
  - Stopwords: "algorithm, dataset, system"

### Output
- **Topic List**:
  - **Topic 1**: data, model, learning, algorithm, neural, network, training, accuracy, performance, features
  - **Topic 2**: method, analysis, system, simulation, process, parameters, experiment, conditions, testing, results
- **Visualization**: Chart showing topic trends over time.

---

## File Structure

```
pdf-lda-topic-modeling/
├── lda/
│   ├── public/              # Static files
│   ├── src/                 # React source files
│   │   ├── App.js           # Main React component
│   │   ├── app.py           # Main Python component
│   └── package.json         # Frontend dependencies
└── README.md                # Project documentation
```

---

## Contributing

We welcome contributions! To contribute:
1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit:
   ```bash
   git commit -m "Add your feature description"
   ```
4. Push to your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a pull request.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Contact

If you have any questions or need help, feel free to contact the project maintainer:
- **Name**: Kushal Peddakotla
- **Email**: [kpeddakotla@gmail.com]
- **GitHub**: [kpeddakotla](https://github.com/kpeddakotla)
