import { useState, useEffect } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import "./App.css";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false); // Why is there false written here? Because the loading state and the startup of the app is false as the app isn't loading anything at the start.
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const handleMouseDown = () => {
    getCurrentWindow().startDragging();
  };

  const handleAskGemini = async () => {
    // FIX: Allow either a text prompt OR a captured screenshot
    if (!apiKey || (!prompt && !imageBase64)) {
      alert("Please provide an API key and either a query or screenshot!");
      return; // Return statement is needed to terminate the entire function if the condition that is unwanted is met.
    }

    setLoading(true); // Sets the loading state to be true now that the app is loading the response from the Gemini API.
    setResponse(""); // Clear response from previous conversation.

    // Build payload dynamic parts inside handler
    const parts: any[] = [];
    if (imageBase64) {
      parts.push({
        inline_data: {
          mime_type: "image/png",
          // FIX: Use .includes(",") to properly extract raw base64 data
          data: imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64,
        },
      });
    }

    if (prompt.trim()) {
      parts.push({ text: prompt });
    } else if (imageBase64) {
      parts.push({ text: "Analyze this image and explain what is shown." });
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
      const res = await fetch(url, { // await makes the code wait until the fetched data is received from the API
        method: "POST", // Telling google we are sending new data
        headers: { "Content-Type": "application/json" }, // Telling google it has JSON data
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: parts,
            },
          ],
        }),
      });

      const data = await res.json(); // Awaiting response from API and converting to JSON format.

      if (!res.ok) {
        setResponse(`API Error (${res.status}): ${data?.error?.message || "Invalid API Key or Request"}`);
        return;
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text; // Optional chaining to get text from response.
      setResponse(text || "No response received.");
    } catch (error) {
      // Captures the actual network/system exception instead of hiding it behind a hardcoded string
      setResponse(`Fetch Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unlisten = listen("trigger_snip", async () => {
      console.log("Global shortcut pressed!");
      try {
        const base64Img = await invoke<string>("capture_screen");
        console.log("Screenshot base64 length:", base64Img.length);
        // FIX: Save captured base64 string to React state so Gemini payload uses it
        setImageBase64(base64Img);
      } catch (err) {
        console.log("Capture state:", err);
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  return (
    <div
      data-tauri-drag-region
      style={{
        width: "100vw",
        height: "100vh",
        background: "rgba(22, 22, 26, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: "16px",
        padding: "20px",
        color: "#f0f0f0",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "6px 8px",
          margin: "-6px -8px 0 -8px",
          cursor: "grab",
          userSelect: "none",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#a78bfa" }}>
          ✦ Snip AI
        </h3>
      </div>

      {/* Screenshot Preview & Clear Badge */}
      {imageBase64 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(0, 0, 0, 0.4)",
            padding: "6px 10px",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <img
            src={`data:image/png;base64,${imageBase64}`}
            alt="Snip preview"
            style={{ width: "36px", height: "36px", objectFit: "cover", borderRadius: "4px" }}
          />
          <span style={{ fontSize: "12px", flex: 1, color: "#a78bfa" }}>
            Screenshot attached
          </span>
          <button
            onClick={() => setImageBase64(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            ✕
          </button>
        </div>
      )}

      <input
        type="password"
        placeholder="Enter your Google Gemini API Key"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          background: "rgba(0, 0, 0, 0.3)",
          color: "#fff",
          outline: "none",
          fontSize: "13px",
        }}
      />

      <textarea
        placeholder="Enter your query..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          background: "rgba(0, 0, 0, 0.3)",
          color: "#fff",
          outline: "none",
          resize: "none",
          fontSize: "14px",
        }}
      />

      <button
        onClick={handleAskGemini}
        disabled={loading} // Disables the button when loading
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          border: "none",
          background: loading ? "#4c1d95" : "#7c3aed",
          color: "#fff",
          fontWeight: "600",
          cursor: "pointer",
          fontSize: "13px",
        }}
      >
        {loading ? "Thinking..." : "Ask Gemini"}
      </button>

      {response && (
        <div
          style={{
            flex: 1,
            marginTop: "4px",
            padding: "12px",
            background: "rgba(0, 0, 0, 0.4)",
            borderRadius: "8px",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            overflowY: "auto",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          <strong style={{ color: "#a78bfa", display: "block", marginBottom: "6px" }}>
            Answer:
          </strong>
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {response}
          </ReactMarkdown>
        </div>
)      }
    </div>
  );
}