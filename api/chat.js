const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

// 天气工具定义
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市、港口或海域的实时天气，包括温度、风速、湿度、能见度、气压等',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: '地点名称，支持中英文，如"上海"、"Tokyo"、"Hong Kong"、"Pacific Ocean"'
          }
        },
        required: ['location']
      }
    }
  }
]

// 调用 wttr.in 获取实时天气
async function fetchWeather(location) {
  const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'curl/7.68.0' },
    signal: AbortSignal.timeout(8000)
  })
  if (!res.ok) throw new Error(`天气接口返回 ${res.status}`)
  const data = await res.json()

  const c = data.current_condition?.[0]
  if (!c) throw new Error('天气数据为空')

  const area = data.nearest_area?.[0]
  const areaName = area?.areaName?.[0]?.value || location
  const country = area?.country?.[0]?.value || ''

  return JSON.stringify({
    地点: `${areaName}${country ? '，' + country : ''}`,
    温度: `${c.temp_C}°C（体感 ${c.FeelsLikeC}°C）`,
    天气: c.weatherDesc?.[0]?.value || '未知',
    湿度: `${c.humidity}%`,
    风速: `${c.windspeedKmph} km/h`,
    风向: c.winddir16Point,
    能见度: `${c.visibility} km`,
    气压: `${c.pressure} hPa`,
    云量: `${c.cloudcover}%`
  }, null, 2)
}

// 调用 DashScope
async function callDashScope(apiKey, messages, withTools) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  const body = { model: 'qwen-plus', messages, stream: false }
  if (withTools) body.tools = tools

  const res = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: controller.signal
  })
  clearTimeout(timer)

  const text = await res.text()
  if (!res.ok) throw new Error(`DashScope ${res.status}: ${text}`)
  return JSON.parse(text)
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages' })
  }

  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    // 第一轮：带工具定义发给 Qwen
    const data = await callDashScope(apiKey, messages, true)
    const choice = data.choices?.[0]

    // Qwen 决定调用工具
    if (choice?.finish_reason === 'tool_calls' && choice?.message?.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0]
      const args = JSON.parse(toolCall.function.arguments || '{}')

      let toolResult
      try {
        if (toolCall.function.name === 'get_weather') {
          toolResult = await fetchWeather(args.location)
        } else {
          toolResult = JSON.stringify({ error: '未知工具' })
        }
      } catch (e) {
        toolResult = JSON.stringify({ error: e.message })
      }

      // 第二轮：把工具结果回传给 Qwen，生成最终回复
      const msgsWithTool = [
        ...messages,
        choice.message,
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult
        }
      ]

      const finalData = await callDashScope(apiKey, msgsWithTool, false)
      return res.json(finalData)
    }

    // 不需要工具，直接返回
    return res.json(data)
  } catch (err) {
    console.error('[api/chat]', err.message)
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: '请求超时，请稍后重试' })
    }
    return res.status(500).json({ error: err.message })
  }
}
