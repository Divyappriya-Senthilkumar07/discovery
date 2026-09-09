import json
from typing import List, Union, Optional
import numpy as np
from app.core.config import settings
from app.core.logging import logger

_model_instance = None


class EmbeddingService:
    @classmethod
    def get_model(cls):
        global _model_instance
        if _model_instance is None:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info("Loading sentence-transformers embedding model", model=settings.EMBEDDING_MODEL)
                _model_instance = SentenceTransformer(settings.EMBEDDING_MODEL)
            except Exception as e:
                logger.error("Failed to load sentence_transformers model, falling back to mock embedder", error=str(e))
                _model_instance = "MOCK"
        return _model_instance

    @classmethod
    def encode(cls, texts: Union[str, List[str]]) -> np.ndarray:
        """
        Encode single text or list of texts into normalized 384-dimensional embedding vectors.
        """
        model = cls.get_model()
        if isinstance(texts, str):
            single = True
            text_list = [texts]
        else:
            single = False
            text_list = texts

        if model != "MOCK":
            embeddings = model.encode(text_list, convert_to_numpy=True, normalize_embeddings=True)
            return embeddings[0] if single else embeddings
        else:
            # Deterministic fallback pseudo-embedder for testing if weights cannot load
            vecs = []
            for t in text_list:
                np.random.seed(abs(hash(t.lower())) % (2**32))
                v = np.random.randn(384).astype(np.float32)
                v = v / np.linalg.norm(v)
                vecs.append(v)
            return vecs[0] if single else np.array(vecs)

    @classmethod
    def cosine_similarity(cls, vec_a: np.ndarray, vec_b: np.ndarray) -> float:
        """
        Compute cosine similarity between two 1D vectors.
        """
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))

    @classmethod
    def serialize_vector(cls, vec: np.ndarray) -> str:
        return json.dumps(vec.tolist())

    @classmethod
    def deserialize_vector(cls, vec_str: str) -> np.ndarray:
        return np.array(json.loads(vec_str), dtype=np.float32)
