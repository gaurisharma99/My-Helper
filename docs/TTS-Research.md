# Engineering Design Document (EDD)

## Feature
Speech Synthesis Layer for My-Helper AI Assistant

Version: 0.1 (Research Phase)

Author: Gauri Sharma

Date: July 2026

---

# 1. Problem Statement

The current chatbot communicates exclusively through textual responses. While this satisfies the primary conversational workflow, it limits accessibility, multitasking, and hands-free interaction.

The objective is to extend the conversational pipeline with a Text-to-Speech (TTS) layer capable of converting every assistant response into natural human speech while maintaining low latency and a modular backend architecture.

The implementation should satisfy the following engineering constraints:

- Zero licensing cost
- High speech intelligibility
- Easy backend integration
- Future compatibility with Speech-to-Text (ASR)
- Low deployment complexity
- Replaceable speech engine

---

# 2. Functional Requirements

The system should support:

✓ On-demand speech generation

✓ Multiple voices (future)

✓ English (Phase 1)

✓ Low latency response

✓ Modular architecture

✓ Stateless API

---

# 3. Evaluation Criteria

Every model was evaluated against the following metrics:

| Criterion | Weight |
|-----------|---------|
| Speech Quality | High |
| Naturalness | High |
| Deployment Complexity | High |
| Offline Capability | Medium |
| Community Support | High |
| Latency | High |
| Scalability | High |
| Node.js Integration | High |

---

# 4. Candidate Models

## Piper

Developer:
Open Home Foundation (originally Rhasspy)

Strengths

• Lightweight

• CPU friendly

• Fully Offline

• Open Source

• Fast inference

Weaknesses

• Voice quality lower than latest neural models

• Limited expressive speech

Best Use Case

Embedded applications

Offline assistants

Edge devices

---

## Kokoro

Developer

Hexgrad

Strengths

• Excellent neural speech quality

• Lightweight compared to many modern neural TTS systems

• Multiple voices

• Open Source

Weaknesses

• Young ecosystem

• Smaller community

Best Use Case

Modern AI Assistants

Desktop AI

Personal assistants

---

## Coqui XTTS

Developer

Coqui AI

Strengths

• Voice cloning

• Multilingual

• High fidelity speech

Weaknesses

• Heavy dependencies

• Python ecosystem

• Higher deployment complexity

Best Use Case

Production AI

Voice cloning

Research

---

## ElevenLabs

Developer

ElevenLabs

Strengths

• State-of-the-art speech

• Excellent prosody

• Developer friendly API

Weaknesses

• Usage limits on free tier

• Cloud dependency

Best Use Case

Commercial products

Content creation

Narration

---

## Microsoft Speech

Developer

Microsoft

Strengths

• Enterprise reliability

• Large voice catalog

• SSML support

Weaknesses

• Cloud dependency

• Pricing beyond free tiers

Best Use Case

Enterprise applications

Large-scale deployments

---

# 5. Comparative Analysis

| Model | Open Source | Offline | Quality | Integration | Scalability |
|--------|-------------|----------|----------|--------------|-------------|
| Piper | ✓ | ✓ | ★★★★☆ | ★★★★☆ | ★★★★★ |
| Kokoro | ✓ | ✓ | ★★★★★ | ★★★☆☆ | ★★★★☆ |
| XTTS | ✓ | ✓ | ★★★★★ | ★★☆☆☆ | ★★★★☆ |
| ElevenLabs | Limited | ✗ | ★★★★★ | ★★★★★ | ★★★★★ |
| Microsoft Speech | ✗ | ✗ | ★★★★★ | ★★★★★ | ★★★★★ |

---

# 6. Engineering Decision

Rather than selecting the model with the highest speech quality alone, the decision prioritizes maintainability, deployment simplicity, and architectural flexibility.

The speech engine will remain abstracted behind a dedicated service layer.

```

Frontend
        ↓
POST /tts
        ↓
TTS Service
        ↓
Selected Engine
```

This allows future replacement of the underlying model without modifying the frontend.

---

# 7. Future Scope

- Voice personalization

- Streaming synthesis

- Emotion-aware speech

- SSML support

- Audio caching

- Multi-language synthesis

- Voice cloning

---

# References

1. Open Home Foundation – Piper
2. Hexgrad – Kokoro
3. Coqui AI – XTTS
4. ElevenLabs Documentation
5. Microsoft Speech Documentation