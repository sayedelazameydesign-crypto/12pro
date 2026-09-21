#!/usr/bin/env python3
"""
Stage 7 — Transformers + LLMs: the same loop, one token at a time.

Lesson ref: ml-15-transformers-and-llms

We build the LLM pipeline from lesson 15 with nothing but the standard library:

    Text → Tokenization → Embeddings → Attention → Prediction → Loss → Gradient Descent

Scale is tiny (9 sentences, 6-dim embeddings, one attention head) but every
arrow is real code you can read. To keep the maths visible we freeze the
embedding/attention blocks and train the output head — a real transformer
backpropagates into *all* of them automatically (that is what autodiff is for).

What you will see:
  A. A tokenizer: text → ids → text, including <unk> for unknown words.
  B. Scaled dot-product attention over a 2-token context.
  C. Training on "predict the next token": loss falls from ~ln(vocab) toward
     the true conditional distribution.
  D. Why an LLM outputs probabilities, not answers: an ambiguous context
     ("the cat") keeps mass on several plausible continuations, while an
     unambiguous one ("the bird") becomes confident.

Run:  python3 examples/ml-course/stage7_attention_and_llm.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mlmini import cross_entropy, lcg, softmax  # noqa: E402

CORPUS = [
    "the cat sat",
    "the cat slept",
    "the dog sat",
    "the dog barked",
    "the bird sang",
    "a cat sat",
    "a dog barked",
    "a bird sang",
    "the bird sang",
]

EMBED_DIM = 6
ATTENTION_DIM = 4
EPOCHS = 4_000
LEARNING_RATE = 0.4
SEED = 921_2026


# ---------------------------------------------------------------------------
# A. Tokenization
# ---------------------------------------------------------------------------

class Tokenizer:
    """Word-level tokenizer: the smallest honest version of what an LLM does."""

    def __init__(self, sentences: list[str]):
        vocabulary = sorted({token for sentence in sentences for token in sentence.split()})
        self.unk = "<unk>"
        self.vocab = [self.unk] + vocabulary
        self.token_to_id = {token: i for i, token in enumerate(self.vocab)}

    def encode(self, text: str) -> list[int]:
        return [self.token_to_id.get(token, 0) for token in text.split()]

    def decode(self, ids: list[int]) -> str:
        return " ".join(self.vocab[i] for i in ids)

    def __len__(self) -> int:
        return len(self.vocab)


# ---------------------------------------------------------------------------
# B. Embeddings + single-head self-attention
# ---------------------------------------------------------------------------

def random_matrix(rows: int, cols: int, rng, scale: float) -> list[list[float]]:
    return [[(rng() * 2 - 1) * scale for _ in range(cols)] for _ in range(rows)]


def matmul_row(row: list[float], matrix: list[list[float]]) -> list[float]:
    return [sum(row[i] * matrix[i][j] for i in range(len(row))) for j in range(len(matrix[0]))]


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


class AttentionBlock:
    """Attention(Q, K, V) = softmax(Q·Kᵀ / √d_k) · V

    For a 2-token context this is literally: "how much should the last word
    look at itself versus the previous word?" — learned weights, no rules.
    """

    def __init__(self, vocab_size: int, embed_dim: int, attention_dim: int, seed: int = SEED):
        rng = lcg(seed)
        scale = 1.0 / math.sqrt(embed_dim)
        self.embeddings = random_matrix(vocab_size, embed_dim, rng, 1.0)
        self.wq = random_matrix(embed_dim, attention_dim, rng, scale)
        self.wk = random_matrix(embed_dim, attention_dim, rng, scale)
        self.wv = random_matrix(embed_dim, attention_dim, rng, scale)
        self.scale = math.sqrt(attention_dim)

    def context_vector(self, token_ids: list[int]) -> tuple[list[float], list[float]]:
        x = [self.embeddings[i] for i in token_ids]
        q = matmul_row(x[-1], self.wq)              # query = the position we predict from
        k = [matmul_row(xi, self.wk) for xi in x]   # keys  = every position
        v = [matmul_row(xi, self.wv) for xi in x]   # values = what each position offers

        scores = [dot(q, kj) / self.scale for kj in k]
        weights = softmax(scores)

        context = [
            sum(w * vj[d] for w, vj in zip(weights, v)) for d in range(len(v[0]))
        ]
        return context, weights


# ---------------------------------------------------------------------------
# C/D. Prediction head, loss and gradient descent
# ---------------------------------------------------------------------------

class NextTokenModel:
    def __init__(self, vocab_size: int, embed_dim: int = EMBED_DIM, seed: int = SEED):
        self.tokenizer = Tokenizer(CORPUS)
        self.attention = AttentionBlock(len(self.tokenizer), embed_dim, ATTENTION_DIM, seed)
        rng = lcg(seed + 1)
        self.w_out = random_matrix(embed_dim, vocab_size, rng, 1.0 / math.sqrt(embed_dim))
        self.b_out = [0.0] * vocab_size
        self.vocab_size = vocab_size

    def predict(self, context_text: str) -> tuple[list[float], list[float]]:
        ids = self.tokenizer.encode(context_text)
        context, weights = self.attention.context_vector(ids)
        logits = [
            dot(context, [self.w_out[d][c] for d in range(len(context))]) + self.b_out[c]
            for c in range(self.vocab_size)
        ]
        return softmax(logits), weights

    def train(self, examples: list[tuple[str, int]], epochs: int, lr: float) -> list[dict]:
        history = []
        for epoch in range(epochs):
            total_loss = 0.0
            for context_text, target_id in examples:
                ids = self.tokenizer.encode(context_text)
                context, _ = self.attention.context_vector(ids)
                logits = [
                    dot(context, [self.w_out[d][c] for d in range(len(context))]) + self.b_out[c]
                    for c in range(self.vocab_size)
                ]
                probs = softmax(logits)

                total_loss += -math.log(max(probs[target_id], 1e-12))

                # dL/dlogits for cross-entropy + softmax is simply (p - y)
                for c in range(self.vocab_size):
                    delta = probs[c] - (1.0 if c == target_id else 0.0)
                    for d in range(len(context)):
                        self.w_out[d][c] -= lr * delta * context[d] / len(examples)
                    self.b_out[c] -= lr * delta / len(examples)

            if epoch % max(1, epochs // 5) == 0 or epoch == epochs - 1:
                history.append({"epoch": epoch, "loss": round(total_loss / len(examples), 6)})
        return history

    def loss_on(self, examples: list[tuple[str, int]]) -> float:
        distributions = []
        targets = []
        for context_text, target_id in examples:
            probs, _ = self.predict(context_text)
            distributions.append(probs)
            targets.append(target_id)
        return cross_entropy(targets, distributions)


def main() -> int:
    print("Stage 7 — Tokenizer + Attention + next-token prediction")
    print("=" * 68)

    model = NextTokenModel(vocab_size=len(Tokenizer(CORPUS)))
    tokenizer = model.tokenizer

    # ------------------------------------------------------------------ A
    print("\n[A] Tokenization")
    print(f"  vocab ({len(tokenizer)}): {tokenizer.vocab}")
    for sentence in CORPUS[:3]:
        ids = tokenizer.encode(sentence)
        print(f"  \"{sentence}\" → {ids} → \"{tokenizer.decode(ids)}\"")
    unknown = tokenizer.encode("the rocket landed")
    print(f"  \"the rocket landed\" → {unknown}  (0 = {tokenizer.unk}, out of vocabulary)")
    assert unknown[1] == 0 and unknown[2] == 0, "unknown words must map to <unk>"

    # ------------------------------------------------------------------ B
    print("\n[B] Attention over a 2-token context")
    _, weights = model.predict("the cat")
    print(f"  attention weights for \"the cat\": {['%.3f' % w for w in weights]}")
    print("  → the last position mixes information from both tokens; those")
    print("    weights are computed from Q·K, not written by us.")
    assert abs(sum(weights) - 1.0) < 1e-9, "attention weights must sum to 1"

    # ------------------------------------------------------------------ C
    print("\n[C] Training: predict the next token")
    examples = []
    for sentence in CORPUS:
        tokens = sentence.split()
        context = " ".join(tokens[:-1])
        target = tokens[-1]
        examples.append((context, tokenizer.token_to_id[target]))

    print(f"  examples: {[(ctx, tokenizer.vocab[tid]) for ctx, tid in examples[:4]]} ...")

    initial_loss = model.loss_on(examples)
    print(f"  loss before training = {initial_loss:.4f}  (uniform ≈ ln({len(tokenizer)}) = {math.log(len(tokenizer)):.4f})")

    history = model.train(examples, epochs=EPOCHS, lr=LEARNING_RATE)
    for point in history:
        print(f"    epoch {point['epoch']:>5} → cross-entropy {point['loss']:.4f}")

    final_loss = model.loss_on(examples)
    print(f"  loss after training  = {final_loss:.4f}")

    # ------------------------------------------------------------------ D
    print("\n[D] Reading the model: probabilities, not answers")
    for context_text in ("the bird", "a dog", "the cat", "the dog"):
        probs, _ = model.predict(context_text)
        ranked = sorted(range(len(probs)), key=lambda i: probs[i], reverse=True)[:3]
        rendered = ", ".join(f"{tokenizer.vocab[i]}={probs[i]:.2f}" for i in ranked)
        print(f"  \"{context_text}\" → {rendered}")

    bird_probs, _ = model.predict("the bird")
    cat_probs, _ = model.predict("the cat")
    sung = bird_probs[tokenizer.token_to_id["sang"]]
    sat = cat_probs[tokenizer.token_to_id["sat"]]
    slept = cat_probs[tokenizer.token_to_id["slept"]]

    print(f"\n  unambiguous context \"the bird\": P(sang) = {sung:.3f}")
    print(f"  ambiguous context   \"the cat\":  P(sat) = {sat:.3f}, P(slept) = {slept:.3f}, sum = {sat + slept:.3f}")
    print("  This is exactly why an LLM 'continues' text instead of answering it:")
    print("  it learned a distribution over next tokens from examples.")

    assert final_loss < initial_loss * 0.6, "training must cut the cross-entropy substantially"
    assert sung > 0.6, "an unambiguous context should become confident"
    assert sat + slept > 0.7, "an ambiguous context should keep mass on both real continuations"
    assert history[-1]["loss"] <= history[0]["loss"], "the loss trace must not increase"

    print("\nRESULT " + json.dumps({
        "stage": 7,
        "name": "attention_and_llm",
        "status": "PASS",
        "vocab_size": len(tokenizer),
        "embed_dim": EMBED_DIM,
        "attention": {"heads": 1, "dim": ATTENTION_DIM, "weights_sum_to_one": True},
        "loss_before": round(initial_loss, 4),
        "loss_after": round(final_loss, 4),
        "epochs": EPOCHS,
        "probabilities": {
            "the bird → sang": round(sung, 4),
            "the cat → sat": round(sat, 4),
            "the cat → slept": round(slept, 4),
        },
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
