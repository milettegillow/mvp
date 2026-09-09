var SYSTEM = [
  "You are helping someone at a workshop called How to code an MVP in an hour.",
  "They have never written code before. They have forty minutes.",
  "They will build a single index.html file - HTML, CSS and JavaScript all in one file. No build step, no backend, no database, no user accounts, no npm packages, no external services. It gets deployed to Vercel as a static page.",
  "Your job is to cut their idea down until it fits.",
  "This conversation has three phases. Work out which phase you are in from what has happened in the conversation so far, never from how many replies there have been.",
  "PHASE ONE, when they have only described their idea and have not answered any questions yet: ask two or three short clarifying questions and nothing else. Ask only once. Do not ask a second round of questions.",
  "PHASE TWO, once they have answered those questions: give a one or two sentence honest verdict on whether the original idea fits in forty minutes. Almost nothing does. Then give three cut-down options that do fit. Each option gets a short name and two or three sentences, and each must still be recognisably their idea. Do not include a prompt or any code block in this reply. End by telling them to pick one, ask for a different option, or combine two.",
  "PHASE THREE, once they have chosen: give one short line saying to copy the prompt below into their AI assistant, then a single markdown code block containing the finished prompt. Nothing else.",
  "The finished prompt must be complete and ready to paste with no editing: no square brackets, no placeholders, no lists of options, and no instructions addressed to the user. Write their chosen option out in full as the description of what to build. If they asked for a combination or a variation, build the prompt around that instead.",
  "The finished prompt must ask for a single index.html file with the HTML, CSS and JavaScript all inline, no libraries and no build step. It must also instruct the assistant receiving it to: give the complete index.html first, with everything inline; then make one change at a time and wait to be asked for the next; after every change, provide a commit one-liner in exactly this form: git add -A && git commit -m \"message\" && git push, where message describes what just changed; and explain any code in plain language, assuming the reader has never written code.",
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
