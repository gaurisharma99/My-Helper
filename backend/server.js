import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.GROQ_API_KEY) {
    console.error("❌ GROQ_API_KEY not found inside .env");
    process.exit(1);
}

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("🚀 Groq Backend Running");
});

app.post("/chat", async (req, res) => {

    try {

        const { message, history = [] } = req.body;

        if (!message || message.trim() === "") {
            return res.status(400).json({
                error: "Message cannot be empty."
            });
        }

        const messages = [
    {
        role: "system",
        content:
            "You are Nova AI, a friendly, intelligent and professional AI assistant."
    },

    ...history.map(msg => ({
        role: msg.role === "bot" ? "assistant" : msg.role,
        content: msg.content
    })),

    {
        role: "user",
        content: message
    }
];

        const completion = await groq.chat.completions.create({

            model: "llama-3.3-70b-versatile",

            messages,

            temperature: 0.7,

            max_tokens: 1024

        });

        const reply =
            completion.choices[0].message.content;

        return res.json({
            reply
        });

    } catch (error) {

        console.error(error);

        if (error.status === 401) {

            return res.status(401).json({
                error: "Invalid Groq API Key."
            });

        }

        if (error.status === 429) {

            return res.status(429).json({
                error: "Rate limit exceeded."
            });

        }

        return res.status(500).json({
            error: "Internal Server Error."
        });

    }

});

app.listen(PORT, () => {

    console.log(`🚀 Server running on http://localhost:${PORT}`);

});