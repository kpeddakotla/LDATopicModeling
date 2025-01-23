import os
import zipfile
import shutil
import tempfile
import threading
import queue
import matplotlib.pyplot as plt
import base64
from io import BytesIO
from sklearn.decomposition import LatentDirichletAllocation as LDA
from sklearn.feature_extraction.text import CountVectorizer
from nltk.corpus import stopwords
import nltk
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from PyPDF2 import PdfReader
import logging
import numpy as np

app = Flask(__name__)
CORS(app)
result_queue = queue.Queue()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Download NLTK stopwords
nltk.download("stopwords")

# Function to extract the year from the file name
def extract_year_from_title(file_name):
    match = re.search(r'- (\d{4}) -', file_name)
    if match:
        return int(match.group(1))
    else:
        return None

# Function to find the cutoff position based on specific sections
def find_cutoff_position(text):
    pattern = r"\b(acknowledgments|works cited|notes|references)\b"
    lower_text = text.lower()
    matches = [match.start() for match in re.finditer(pattern, lower_text)]

    if not matches:
        return len(text)

    return min(matches)

# Function to clean and truncate text
def clean_pdf_text(text):
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'\d+', '', text)
    text = text.lower()

    cutoff_pos = find_cutoff_position(text)

    if cutoff_pos < len(text) * 0.9:
        return text[:cutoff_pos]
    else:
        return text

# Function to extract text from a PDF
def extract_text_from_pdf(pdf_path):
    text = ""
    with open(pdf_path, 'rb') as file:
        reader = PdfReader(file)
        for page in reader.pages:
            text += page.extract_text() or ""
    return text

# Function to generate a bar chart and convert it to base64
def generate_topic_trend_chart(year_topic_trends, num_topics):
    topic_charts = {}

    for topic_idx in range(num_topics):
        plt.figure(figsize=(8, 4))
        topic_values = [year_topic_trends[year][topic_idx] for year in sorted(year_topic_trends)]
        plt.plot(sorted(year_topic_trends), topic_values, label=f"Topic {topic_idx + 1}", color="steelblue")
        plt.xlabel("Year")
        plt.ylabel("Topic Distribution")
        plt.title(f"Yearly Trends for Topic {topic_idx + 1}")
        plt.legend(loc="upper left")
        plt.tight_layout()

        img_buffer = BytesIO()
        plt.savefig(img_buffer, format="png")
        img_buffer.seek(0)
        topic_charts[f"Topic {topic_idx + 1}"] = base64.b64encode(img_buffer.read()).decode("utf-8")
        plt.close()

    return topic_charts

def group_by_decades(years, doc_topic_matrix):
    bins = np.arange(1950, 2030, 10)
    years_decade_group = np.digitize(years, bins)

    decade_topic_distribution = {}

    for decade_bin in np.unique(years_decade_group):
        decade_indices = np.where(years_decade_group == decade_bin)[0]
        decade_name = f"{bins[decade_bin - 1]}-{bins[decade_bin] - 1}"

        average_topic_distribution = np.mean(doc_topic_matrix[decade_indices], axis=0)

        decade_topic_distribution[decade_name] = average_topic_distribution

    return decade_topic_distribution

def analyze_task(file, form_data, result_queue):
    try:
        num_topics = int(form_data.get("numTopics", 5))
        num_words = int(form_data.get("numWords", 10))
        skip_bibliography = form_data.get("skip_bibliography", "false").lower() == "true"
        
        peak = form_data.get("stopwords", "")
        additional_stopwords = peak.split(",") if peak else []
        additional_stopwords = [word.strip() for word in additional_stopwords]

        default_stopwords = stopwords.words("english")
        custom_stopwords = additional_stopwords if additional_stopwords else []
        all_stopwords = list(set(default_stopwords + custom_stopwords))

        # Extracting the text from the PDF file
        zip_path = tempfile.mktemp()
        file.save(zip_path)

        extracted_path = tempfile.mkdtemp()
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extracted_path)

        pdf_texts = []
        for root, _, files in os.walk(extracted_path):
            for file_name in files:
                if file_name.endswith(".pdf"):
                    pdf_path = os.path.join(root, file_name)
                    text = extract_text_from_pdf(pdf_path)
                    cleaned_text = clean_pdf_text(text) if skip_bibliography else text
                    pdf_texts.append(cleaned_text)

        vectorizer = CountVectorizer(max_df=0.95, min_df=2, stop_words=all_stopwords)
        doc_term_matrix = vectorizer.fit_transform(pdf_texts)
        lda = LDA(n_components=num_topics, random_state=42)
        lda.fit(doc_term_matrix)

        words = vectorizer.get_feature_names_out()
        topic_word_frequencies = [
            ([words[i] for i in topic.argsort()[-num_words:][::-1]], 
             topic[topic.argsort()[-num_words:][::-1]] )
            for topic in lda.components_
        ]

        topics = [{"Topic": f"Topic {i + 1}", "Words": ", ".join(words)} for i, (words, _) in enumerate(topic_word_frequencies)]

        # Creating the topic trend charts (asynchronous task)
        year_topic_trends = {}  # Sample data for year-topic trends (replace with actual data)
        topic_charts = generate_topic_trend_chart(year_topic_trends, num_topics)

        # Send result back to the main thread via the queue
        result_queue.put({
            "topics": topics,
            "topic_charts": topic_charts,
            "additional_stopwords": additional_stopwords
        })

    except Exception as e:
        result_queue.put({"error": str(e)})

@app.route('/analyze', methods=["POST"])
def analyze():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    try:
        # Run the analysis in a separate thread to avoid blocking the main thread
        form_data = request.form
        analysis_thread = threading.Thread(target=analyze_task, args=(file, form_data, result_queue))
        analysis_thread.start()

        # Wait for the result from the worker thread
        analysis_thread.join()

        # Get the result from the queue
        result = result_queue.get()

        if "error" in result:
            return jsonify({"error": result["error"]}), 500

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

@app.route("/summary", methods=["POST"])
def summary():
    try:
        num_topics = int(request.form["numTopics"])
        num_words = int(request.form["numWords"])
        summary_text = f"Analysis performed with {num_topics} topics and {num_words} words per topic."
        return jsonify({"results": summary_text})
    except Exception as e:
        logger.error("Error in summary endpoint: %s", str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/yearly_trends", methods=["POST"])
def yearly_trends():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    runtime_folder = tempfile.mkdtemp()

    try:
        num_topics = int(request.form.get("numTopics", 0))
        skip_bibliography = request.form.get("skip_bibliography", "false").lower() == "true"
        additional_stopwords = request.form.get("stopwords", "")

        if num_topics <= 0:
            return jsonify({"error": "Invalid number of topics"}), 400

        default_stopwords = stopwords.words("english")
        custom_stopwords = additional_stopwords.split(",") if additional_stopwords else []
        all_stopwords = list(set(default_stopwords + custom_stopwords))

        zip_path = os.path.join(runtime_folder, file.filename)
        file.save(zip_path)

        extracted_path = os.path.join(runtime_folder, "extracted")
        os.makedirs(extracted_path, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extracted_path)

        pdf_texts = []
        years = []
        for root, _, files in os.walk(extracted_path):
            for file_name in files:
                if file_name.endswith(".pdf"):
                    pdf_path = os.path.join(root, file_name)
                    text = extract_text_from_pdf(pdf_path)
                    cleaned_text = clean_pdf_text(text) if skip_bibliography else text
                    pdf_texts.append(cleaned_text)
                    years.append(extract_year_from_title(file_name))

        if not pdf_texts:
            return jsonify({"error": "No valid PDF text found"}), 400

        vectorizer = CountVectorizer(max_df=0.95, min_df=2, stop_words=all_stopwords)
        doc_term_matrix = vectorizer.fit_transform(pdf_texts)
        lda = LDA(n_components=num_topics, random_state=42)
        topic_distributions = lda.fit_transform(doc_term_matrix)

        # Create a dictionary to track yearly topic trends
        year_topic_trends = {year: [0] * num_topics for year in set(years)}
        for i, year in enumerate(years):
            if year is not None:
                year_topic_trends[year] = [
                    year_topic_trends[year][j] + topic_distributions[i][j]
                    for j in range(num_topics)
                ]

        # Normalize topic trends per year
        for year in year_topic_trends:
            total = sum(year_topic_trends[year])
            if total > 0:
                year_topic_trends[year] = [val / total for val in year_topic_trends[year]]

        # Generate individual charts for each topic
        topic_charts = {}
        for topic_idx in range(num_topics):
            plt.figure(figsize=(8, 4))
            topic_values = [year_topic_trends[year][topic_idx] for year in sorted(year_topic_trends)]
            plt.plot(sorted(year_topic_trends), topic_values, label=f"Topipppc {topic_idx + 1}", color="steelblue")
            plt.xlabel("Year")
            plt.ylabel("Topic Distribution")
            plt.title(f"Yearly Trends for Toppic {topic_idx + 1}")
            plt.legend(loc="upper left")
            plt.tight_layout()

            img_buffer = BytesIO()
            plt.savefig(img_buffer, format="png")
            img_buffer.seek(0)
            topic_charts[f"Topic {topic_idx + 1}"] = base64.b64encode(img_buffer.read()).decode("utf-8")
            plt.close()

        return jsonify({"topic_charts": topic_charts})
    finally:
        shutil.rmtree(runtime_folder)


if __name__ == "__main__":
    app.run(debug=False, port=5000)
