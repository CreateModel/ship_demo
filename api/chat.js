module.exports = async function handler(req, res) {
  // 只允许 POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages' })
  }

  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server' })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 25000) // 25秒超时

    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({ model: 'qwen-plus', messages, stream: false }),
        signal: controller.signal
      }
    )
    clearTimeout(timeout)

    const text = await response.text()
    if (!response.ok) {
      console.error('DashScope error:', response.status, text)
      return res.status(response.status).json({ error: text })
    }

    return res.status(200).json(JSON.parse(text))
  } catch (err) {
    console.error('api/chat error:', err.message)
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request to DashScope timed out' })
    }
    return res.status(500).json({ error: err.message })
  }
}
