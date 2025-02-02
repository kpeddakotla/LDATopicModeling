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

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd
import gc
import time
from sklearn.feature_extraction.text import TfidfTransformer

app = Flask(__name__)
CORS(app)
result_queue = queue.Queue()
matplotlib_logger = logging.getLogger("matplotlib")
matplotlib_logger.setLevel(logging.WARNING)


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logging.getLogger("PIL").setLevel(logging.INFO)


nltk.download("stopwords")
logging.getLogger("PyPDF2").setLevel(logging.ERROR)


def extract_year_from_title(file_name):
    match = re.search(r"- (\d{4}) -", file_name)
    if match:
        return int(match.group(1))
    else:
        return None


def find_cutoff_position(text):
    pattern = r"\b(acknowledgments|works cited|notes|references)\b"
    lower_text = text.lower()
    matches = [match.start() for match in re.finditer(pattern, lower_text)]

    if not matches:
        return len(text)

    return min(matches)


def clean_pdf_text(text):
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\d+", "", text)
    text = text.lower()

    cutoff_pos = find_cutoff_position(text)

    if cutoff_pos < len(text) * 0.9:
        return text[:cutoff_pos]
    else:
        return text


def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        with open(pdf_path, "rb") as file:
            reader = PdfReader(file)

            if reader.is_encrypted:
                try:
                    reader.decrypt("")
                except Exception as e:
                    logger.warning(f"Skipping encrypted file {pdf_path}: {str(e)}")
                    return ""

            for page in reader.pages:
                text += page.extract_text() or ""
    except Exception as e:
        logger.error(f"Error processing {pdf_path}: {str(e)}")
        return ""
    return text


def generate_decade_chart(decade_topic_distribution, lda):
    plt.ioff()
    fig = plt.figure(figsize=(8, 4), dpi=100)
    ax = fig.add_subplot(111)

    topic_dist_df = pd.DataFrame(decade_topic_distribution).T
    topic_dist_df.columns = [f"Topic {i+1}" for i in range(lda.n_components)]

    topic_dist_df.plot(kind="bar", stacked=True, ax=ax, colormap="tab20", width=0.85)
    ax.set_ylabel("Average Topic Proportion", fontsize=8)
    ax.set_title("Topic Distribution Over Decades", fontsize=10, pad=10)
    ax.legend(title="Topics", bbox_to_anchor=(1.05, 1), loc="upper left", fontsize=6)

    plt.tight_layout(pad=2)

    img_buffer = BytesIO()
    plt.savefig(img_buffer, format="png", bbox_inches="tight", dpi=150)
    img_buffer.seek(0)
    decade_chart = base64.b64encode(img_buffer.read()).decode("utf-8")
    plt.close(fig)

    return decade_chart


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


def get_top_papers(doc_topic_matrix, topic_idx, titles, years, n=5):
    topic_scores = doc_topic_matrix[:, topic_idx]
    top_indices = np.argsort(topic_scores)[::-1][:n]
    return [
        {
            "title": titles[i],
            "year": years[i] or "Unknown",
            "score": float(topic_scores[i]),
            "score_pct": f"{topic_scores[i] * 100:.1f}%",
        }
        for i in top_indices
    ]


def analyze_task(file, form_data):
    zip_path = None
    extracted_path = None
    try:

        num_topics = int(form_data.get("numTopics", 5))
        num_words = int(form_data.get("numWords", 10))
        skip_bibliography = (
            form_data.get("skip_bibliography", "false").lower() == "true"
        )
        additional_stopwords = form_data.get("stopwords", "").split(",")
        additional_stopwords = [word.strip() for word in additional_stopwords]

        default_stopwords = stopwords.words("english")
        all_stopwords = list(set(default_stopwords + additional_stopwords))

        zip_path = tempfile.mktemp()
        file.save(zip_path)
        extracted_path = tempfile.mkdtemp()
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(extracted_path)

        pdf_texts = []
        titles = []
        years = []
        pdf_count = 0

        for root, _, files in os.walk(extracted_path):
            for file_name in files:
                if file_name.endswith(".pdf"):
                    pdf_path = os.path.join(root, file_name)
                    logger.debug(f"Processing PDF: {pdf_path}")

                    text = extract_text_from_pdf(pdf_path)
                    if not text:
                        logger.warning(f"No text extracted from {pdf_path}")
                        continue

                    cleaned_text = clean_pdf_text(text) if skip_bibliography else text
                    pdf_texts.append(cleaned_text)
                    titles.append(file_name)
                    years.append(extract_year_from_title(file_name))
                    pdf_count += 1
        if not pdf_texts:
            return {"error": "No valid text extracted from PDFs."}

        vectorizer = CountVectorizer(max_df=0.95, min_df=2, stop_words=all_stopwords)
        doc_term_matrix = vectorizer.fit_transform(pdf_texts)
        feature_names = vectorizer.get_feature_names_out()

        lda = LDA(n_components=num_topics, random_state=42)
        lda.fit(doc_term_matrix)

        if lda.components_.shape[0] == 0:
            return {"error": "LDA model training failed. No topics generated."}

        logger.debug(f"Trained LDA model with {lda.n_components} topics")
        components = lda.components_
        doc_topic_matrix = lda.transform(doc_term_matrix)

        topic_charts = {}
        topics = []

        for topic_idx in range(num_topics):

            top_indices = components[topic_idx].argsort()[-num_words:][::-1]
            top_words = [feature_names[i] for i in top_indices]
            raw_weights = components[topic_idx][top_indices]
            EPSILON = 1e-12 
            marginal_word_prob = (lda.components_.sum(axis=0) + EPSILON) / (lda.components_.sum() + EPSILON)
            lift_scores = (lda.components_ + EPSILON) / (marginal_word_prob + EPSILON)

            # Calculate average lift per topic
            average_lift_per_topic = np.mean(lift_scores, axis=1).tolist()
    

            total_weight = raw_weights.sum()
            percentages = (raw_weights / total_weight * 100).round(2)

            plt.figure(figsize=(10, 6))
            plt.barh(top_words, percentages, color="steelblue")
            plt.gca().invert_yaxis()
            plt.xlabel("Percentage Importance (%)")
            plt.title(f"Topic {topic_idx + 1} - Word Distribution")

            for i, (word, pct) in enumerate(zip(top_words, percentages)):
                plt.text(pct + 0.5, i, f"{pct:.1f}%", va="center", fontsize=8)

            plt.tight_layout()

            img_buffer = BytesIO()
            plt.savefig(img_buffer, format="png", bbox_inches="tight", dpi=120)
            img_buffer.seek(0)
            topic_charts[f"Topic {topic_idx + 1}"] = base64.b64encode(
                img_buffer.read()
            ).decode("utf-8")
            plt.close()

            topics.append(
                {
                    "Topic": f"Topic {topic_idx + 1}",
                    "Words": ", ".join(top_words),
                    "WordScores": {
                        "raw": raw_weights.tolist(),
                        "percentages": percentages.tolist(),
                    },
                }
            )

        valid_years = [y for y in years if y is not None]
        time_period = f"{min(valid_years)}-{max(valid_years)}" if valid_years else "N/A"

        return {
            "topics": topics,
            "topic_charts": topic_charts,
            "vectorizer": vectorizer,
            "lda_model": lda,
            "doc_topic_matrix": doc_topic_matrix,
            "additional_stopwords": additional_stopwords,
            "num_pdfs": pdf_count,  
            "num_topics": lda.n_components, 
            "num_words": num_words, 
            "titles": titles,
            "years": years,
            "time_period": time_period,
            "average_lift_per_topic": average_lift_per_topic
        }

    except Exception as e:
        logger.error(f"Error during analysis: {e}")
        return {"error": str(e)}
    finally:
        plt.close("all")
        gc.collect()
        try:
            if zip_path and os.path.exists(zip_path):
                os.remove(zip_path)
        except Exception as e:
            logger.error(f"Error removing zip file: {str(e)}")

        try:
            if extracted_path and os.path.exists(extracted_path):
                shutil.rmtree(extracted_path)
        except Exception as e:
            logger.error(f"Error removing extracted files: {str(e)}")


@app.route("/analyze", methods=["POST"])
def analyze():
    file = request.files.get("file")

    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    try:
        form_data = request.form.to_dict()
        result = analyze_task(file, form_data)

        if "error" in result:
            return jsonify(result), 500

        if form_data.get("include_decade_analysis", "false").lower() == "true":
            decade_chart = generate_decade_chart(
                group_by_decades(result["years"], result["doc_topic_matrix"]),
                result["lda_model"],
            )
            result["decade_chart_base64"] = decade_chart

        return jsonify(
            {
                "topics": result["topics"],
                "topic_charts": result["topic_charts"],
                "decade_chart_base64": result.get("decade_chart_base64", None),
                "num_words": result["num_words"], 
                "num_pdfs": result["num_pdfs"], 
                "num_topics": result["num_topics"], 
                "time_period": result["time_period"],
                "average_lift_per_topic": result["average_lift_per_topic"],
                "cache_id": int(time.time()),
            }
        )

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        return jsonify({"error": "Analysis failed", "details": str(e)}), 500
    finally:
        plt.close("all")
        gc.collect()


def generate_topic_distribution_charts(lda_model, feature_names, num_words=10):
    topic_charts = {}
    try:
        plt.ioff()

        for topic_idx, topic_weights in enumerate(lda_model.components_):

            top_indices = topic_weights.argsort()[-num_words:][::-1]
            top_words = [feature_names[i] for i in top_indices]
            weights = topic_weights[top_indices]

            fig, ax = plt.figure(num=f"topic_{topic_idx}", figsize=(10, 6), dpi=100)
            fig.clf()

            y_pos = np.arange(len(top_words))
            bars = ax.barh(y_pos, weights, align="center", color="steelblue")
            ax.set_yticks(y_pos)
            ax.set_yticklabels(top_words)
            ax.invert_yaxis()
            ax.set_xlabel("Word Importance Score")
            ax.set_title(f"Topic {topic_idx+1} - Key Terms Distribution")

            for bar in bars:
                width = bar.get_width()
                ax.text(
                    width * 1.02,
                    bar.get_y() + bar.get_height() / 2,
                    f"{width:.2f}",
                    va="center",
                    ha="left",
                    fontsize=8,
                )

            plt.tight_layout()

            buf = BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", dpi=150)
            plt.close(fig)
            buf.seek(0)

            del fig
            gc.collect()
            topic_charts[f"Topic {topic_idx + 1}"] = base64.b64encode(
                buf.read()
            ).decode("utf-8")
    finally:
        plt.close("all")
        gc.collect()
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
