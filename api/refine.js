var SYSTEM = [
  "You are helping someone at a workshop called How to code an MVP in an hour.",
  "They have never written code before. They have forty minutes.",
  "They will build a single index.html file - HTML, CSS and JavaScript all in one file. No build step, no backend, no database, no user accounts, no npm packages, no external services. It gets deployed to Vercel as a static page.",
  "Your job is to cut their idea down until it fits.",
  "On your FIRST reply, ask two or three short clarifying questions and nothing else. Do not give a verdict yet.",
  "On your SECOND reply, give exactly three things, in this order:",
  "1. One or two sentences on whether the original idea fits in forty minutes. Be honest. Almost nothing does.",
  "2. A cut-down version that does fit, described in three or four sentences. It must still be recognisably their idea. Give them 3 cut-down versions they can choose between.",
  "3. A prompt they can paste into Claude or ChatGPT to build it, inside a markdown code block. The prompt must ask for a single complete index.html file with everything inline.",
  "Write in British English. Use spaced hyphens, never em dashes. Be direct and brief. Do not lecture and do not pad.",
  "Never refuse to help. Always give them something buildable.",
].join(" ");

var MAX_MESSAGES = 20;
var MAX_CONTENT_LENGTH = 4000;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  var body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  var messages = body && body.messages;
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES
  ) {
    return res
      .status(400)
      .json({
        error: "messages must be an array of 1 to " + MAX_MESSAGES + " entries",
      });
  }

  for (var i = 0; i < messages.length; i++) {
    var content = messages[i] && messages[i].content;
    if (typeof content !== "string") {
      return res
        .status(400)
        .json({ error: "Each message must have string content" });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return res
        .status(400)
        .json({
          error:
            "Message content must be " +
            MAX_CONTENT_LENGTH +
            " characters or fewer",
        });
    }
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is not configured" });
  }

  var upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM,
        messages: messages,
      }),
    });
  } catch (e) {
    return res.status(502).json({ error: "Upstream request failed" });
  }

  if (!upstream.ok) {
    return res.status(502).json({ error: "Upstream request failed" });
  }

  var data;
  try {
    data = await upstream.json();
  } catch (e) {
    return res.status(502).json({ error: "Upstream request failed" });
  }

  var text = (Array.isArray(data.content) ? data.content : [])
    .map(function (block) {
      return block && typeof block.text === "string" ? block.text : "";
    })
    .join("")
    .trim();

  return res.status(200).json({ text: text });
};
