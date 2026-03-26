// Paraformer 语音识别 API（阿里云 DashScope）
// 接收前端 base64 音频，提交异步任务并轮询结果，返回识别文本

const POLL_MAX = 15      // 最多轮询 15 次
const POLL_INTERVAL = 1000  // 每次间隔 1 秒

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

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

  const audioFormat = format || 'wav'

  try {
    // Step 1: 提交异步转写任务（base64 方式）
    const submitRes = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable'
        },
        body: JSON.stringify({
          model: 'paraformer-v2',
          input: {
            audio_format: audioFormat,
            audio_data: audio   // base64 字符串
          },
          parameters: {
            language_hints: ['zh', 'en']
          }
        }),
        signal: AbortSignal.timeout(15000)
      }
    )

    const submitText = await submitRes.text()
    if (!submitRes.ok) {
      console.error('[api/speech] submit error:', submitRes.status, submitText)
      return res.status(500).json({ error: `ASR submit error ${submitRes.status}: ${submitText}` })
    }

    const submitData = JSON.parse(submitText)
    const taskId = submitData?.output?.task_id
    if (!taskId) {
      return res.status(500).json({ error: 'No task_id returned', detail: submitText })
    }

    // Step 2: 轮询任务状态
    const pollUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`
    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_INTERVAL)

      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000)
      })
      const pollText = await pollRes.text()
      if (!pollRes.ok) {
        console.error('[api/speech] poll error:', pollRes.status, pollText)
        continue
      }

      const pollData = JSON.parse(pollText)
      const status = pollData?.output?.task_status

      if (status === 'SUCCEEDED') {
        // 解析识别结果
        const results = pollData?.output?.results || []
        // 每个文件有一个 transcription_url，或者直接有文本
        // 对于 base64 提交，通常直接返回文本
        let text = ''
        for (const r of results) {
          if (r.transcription_url) {
            // 拉取转写文本文件
            try {
              const txtRes = await fetch(r.transcription_url, { signal: AbortSignal.timeout(8000) })
              const txtData = await txtRes.json()
              // 格式: { transcripts: [ { text: '...' } ] }
              for (const t of (txtData?.transcripts || [])) {
                text += (t.text || t.transcript || '') + ' '
              }
            } catch (e) {
              console.warn('[api/speech] fetch transcription_url failed:', e.message)
            }
          } else if (r.text) {
            text += r.text + ' '
          }
        }
        return res.json({ text: text.trim() })
      }

      if (status === 'FAILED') {
        const reason = pollData?.output?.task_metrics || pollData?.output?.message || 'Unknown'
        console.error('[api/speech] task failed:', reason)
        return res.status(500).json({ error: `ASR task failed: ${reason}` })
      }

      // status: PENDING / RUNNING — 继续轮询
    }

    return res.status(504).json({ error: '语音识别超时，请缩短录音后重试' })

  } catch (err) {
    console.error('[api/speech]', err.message)
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return res.status(504).json({ error: '请求超时，请重试' })
    }
    return res.status(500).json({ error: err.message })
  }
}
