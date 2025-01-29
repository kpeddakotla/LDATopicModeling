import os
import zipfile
import shutil
import tempfile
import threading
import queue
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
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd
import gc

app = Flask(__name__)
CORS(app)
result_queue = queue.Queue()
matplotlib_logger = logging.getLogger('matplotlib')
matplotlib_logger.setLevel(logging.WARNING)

# Set up logging for your own application
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logging.getLogger("PIL").setLevel(logging.INFO)

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

def generate_decade_chart(decade_topic_distribution, lda):
    plt.ioff()
    fig = plt.figure(figsize=(8, 4), dpi=100)
    ax = fig.add_subplot(111)
    
    topic_dist_df = pd.DataFrame(decade_topic_distribution).T
    topic_dist_df.columns = [f"Topic {i+1}" for i in range(lda.n_components)]
    
    topic_dist_df.plot(kind="bar", stacked=True, ax=ax, colormap='tab20', width=0.85)
    ax.set_ylabel("Average Topic Proportion", fontsize=8)
    ax.set_title("Topic Distribution Over Decades", fontsize=10, pad=10)
    ax.legend(title='Topics', bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=6)
    
    plt.tight_layout(pad=2)
    
    img_buffer = BytesIO()
    fig.savefig(img_buffer, format='png', bbox_inches='tight')
    img_buffer.seek(0)
    decade_chart = base64.b64encode(img_buffer.read()).decode('utf-8')
    plt.close(fig)
    
    return decade_chart

def generate_chart(data, title):
    fig, ax = plt.subplots()
    ax.plot(data['x'], data['y'])
    ax.set_title(title)
    # Save plot to BytesIO and convert to base64
    img_stream = BytesIO()
    plt.savefig(img_stream, format='png')
    plt.close(fig)
    img_stream.seek(0)
    return base64.b64encode(img_stream.read()).decode('utf-8')


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
        additional_stopwords = form_data.get("stopwords", "").split(",")
        additional_stopwords = [word.strip() for word in additional_stopwords]

        default_stopwords = stopwords.words("english")
        all_stopwords = list(set(default_stopwords + additional_stopwords))

        # Extract and process PDF files
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

        if not pdf_texts:
            result_queue.put({"error": "No valid text extracted from PDFs."})
            return

        # Create document-term matrix
        vectorizer = CountVectorizer(max_df=0.95, min_df=2, stop_words=all_stopwords)
        doc_term_matrix = vectorizer.fit_transform(pdf_texts)

        # Train LDA model
        lda = LDA(n_components=num_topics, random_state=42)
        lda.fit(doc_term_matrix)

        # Get feature names and components
        feature_names = vectorizer.get_feature_names_out()
        components = lda.components_

        # Generate topic-word distribution charts
        topic_charts = {}
        for topic_idx, topic_weights in enumerate(components):
            plt.figure(figsize=(10, 6))
            
            # Get top words and their weights
            top_indices = topic_weights.argsort()[-num_words:][::-1]
            top_words = [feature_names[i] for i in top_indices]
            weights = topic_weights[top_indices]
            
            # Create horizontal bar chart
            y_pos = np.arange(len(top_words))
            plt.barh(y_pos, weights, align='center', color='steelblue')
            plt.yticks(y_pos, labels=top_words)
            plt.gca().invert_yaxis()  # Highest weight at top
            plt.xlabel('Word Importance Score')
            plt.title(f'Topic {topic_idx + 1} - Key Terms Distribution')
            plt.tight_layout()

            # Save to buffer
            img_buffer = BytesIO()
            plt.savefig(img_buffer, format='png', bbox_inches='tight')
            img_buffer.seek(0)
            topic_charts[f"Topic {topic_idx + 1}"] = base64.b64encode(img_buffer.read()).decode('utf-8')
            plt.close()

        # Prepare topic metadata
        topics = []
        for topic_idx in range(num_topics):
            top_word_indices = components[topic_idx].argsort()[-num_words:][::-1]
            top_words = [feature_names[i] for i in top_word_indices]
            topics.append({
                "Topic": f"Topic {topic_idx + 1}",
                "Words": ", ".join(top_words),
                "WordScores": components[topic_idx][top_word_indices].tolist()
            })

        result_queue.put({
            "topics": topics,
            "topic_charts": topic_charts,
            "vectorizer": vectorizer,
            "lda_model": lda,
            "additional_stopwords": additional_stopwords
        })

    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        result_queue.put({"error": str(e)})
        
        
@app.route('/analyze', methods=["POST"])
def analyze():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    try:
        form_data = request.form
        result_queue = queue.Queue()
        error_queue = queue.Queue()
        
        analysis_thread = threading.Thread(
            target=analyze_task,
            args=(file, form_data, result_queue, error_queue)
        )
        analysis_thread.start()
        analysis_thread.join()

        if not error_queue.empty():
            return jsonify({"error": error_queue.get()}), 500

        result = result_queue.get()
        if "error" in result:
            return jsonify(result), 500

        # Generate topic distribution charts
        vectorizer = result['vectorizer']
        lda_model = result['lda_model']
        num_words = int(form_data.get("numWords", 10))
        
        topic_charts = generate_topic_distribution_charts(
            lda_model=lda_model,
            feature_names=vectorizer.get_feature_names_out(),
            num_words=num_words
        )

        return jsonify({
            'topics': result['topics'],
            'topic_charts': topic_charts
        })

    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return jsonify({"error": "Analysis failed", "details": str(e)}), 500

def generate_topic_distribution_charts(lda_model, feature_names, num_words=10):
    topic_charts = {}
    plt.ioff()  # Disable interactive plotting
    
    for topic_idx, topic_weights in enumerate(lda_model.components_):
        # Get top words and their weights
        top_indices = topic_weights.argsort()[-num_words:][::-1]
        top_words = [feature_names[i] for i in top_indices]
        weights = topic_weights[top_indices]
        
        # Create figure with constrained size
        fig, ax = plt.figure(num=f"topic_{topic_idx}", figsize=(10, 6), dpi=100)
        fig.clf()  # Clear any existing content
        
        # Create horizontal bar chart
        y_pos = np.arange(len(top_words))
        bars = ax.barh(y_pos, weights, align='center', color='steelblue')
        ax.set_yticks(y_pos)
        ax.set_yticklabels(top_words)
        ax.invert_yaxis()  # Highest weight at top
        ax.set_xlabel('Word Importance Score')
        ax.set_title(f'Topic {topic_idx+1} - Key Terms Distribution')
        
        # Add value labels
        for bar in bars:
            width = bar.get_width()
            ax.text(width * 1.02, bar.get_y() + bar.get_height()/2,
                    f'{width:.2f}',
                    va='center', ha='left', fontsize=8)
        
        plt.tight_layout()
        
        # Save to buffer
        buf = BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight', dpi=120)
        plt.close(fig)
        buf.seek(0)
        
        del fig
        gc.collect()
        topic_charts[f"Topic {topic_idx + 1}"] = base64.b64encode(buf.read()).decode('utf-8')
    
    return topic_charts        
        
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

if __name__ == "__main__":
    app.run(debug=False, port=5000)
