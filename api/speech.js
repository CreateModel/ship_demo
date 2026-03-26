// Paraformer 语音识别（DashScope OpenAI 兼容接口）
// 用法：前端 POST { audio: base64字符串, format: 'webm'/'wav' }
// 返回：{ text: '识别文字' }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { audio, format } = req.body
  if (!audio) {
    return res.status(400).json({ error: 'Missing audio data' })
  }

  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const audioFormat = format || 'webm'
    const audioBuffer = Buffer.from(audio, 'base64')

    // 构建 multipart/form-data（手动拼接，兼容 Vercel Node.js 运行时）
    const boundary = 'Boundary' + Date.now().toString(16)
    const CRLF = '\r\n'
    const mimeType = audioFormat === 'wav' ? 'audio/wav'
                   : audioFormat === 'mp3' ? 'audio/mpeg'
                   : 'audio/webm'

    const partHeader = Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="audio.${audioFormat}"${CRLF}` +
      `Content-Type: ${mimeType}${CRLF}${CRLF}`
    )
    const modelPart = Buffer.from(
      `${CRLF}--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
      `paraformer-v2` +
      `${CRLF}--${boundary}--${CRLF}`
    )

    const body = Buffer.concat([partHeader, audioBuffer, modelPart])

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25000)

    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        },
        body,
        signal: controller.signal
      }
    )
    clearTimeout(timer)

    const responseText = await response.text()
    console.log('[api/speech] status:', response.status, 'body:', responseText.slice(0, 300))

    if (!response.ok) {
      return res.status(500).json({
        error: `ASR error ${response.status}`,
        detail: responseText.slice(0, 500)
      })
    }

    // 成功响应格式: { text: '识别文字' }
    const data = JSON.parse(responseText)
    const text = data?.text || ''
    return res.json({ text: text.trim() })

  } catch (err) {
    console.error('[api/speech]', err.message)
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return res.status(504).json({ error: '语音识别超时，请重试' })
    }
    return res.status(500).json({ error: err.message })
  }
}
