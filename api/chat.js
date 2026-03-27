const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

// 本地开发时通过代理访问外网
let _agentCache = null
async function getAgent() {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (!proxy) return undefined
  if (!_agentCache) {
    const { HttpsProxyAgent } = await import('https-proxy-agent')
    _agentCache = new HttpsProxyAgent(proxy)
  }
  return _agentCache
}

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

// 用 Open-Meteo（免费无需 key，直连）获取实时天气
async function fetchWeather(location) {
  // 第一步：地理编码
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=zh`
  const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(8000) })
  if (!geoRes.ok) throw new Error(`地理编码失败 ${geoRes.status}`)
  const geoData = await geoRes.json()
  const place = geoData.results?.[0]
  if (!place) throw new Error(`找不到地点：${location}`)

  // 第二步：获取当前天气
  const { latitude, longitude, name, country } = place
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,visibility,surface_pressure,cloud_cover,weather_code` +
    `&wind_speed_unit=ms&timezone=auto`
  const wRes = await fetch(weatherUrl, { signal: AbortSignal.timeout(8000) })
  if (!wRes.ok) throw new Error(`天气接口失败 ${wRes.status}`)
  const wData = await wRes.json()
  const c = wData.current

  const WMO = {
    0:'晴',1:'基本晴',2:'局部多云',3:'阴',45:'雾',48:'冻雾',
    51:'小毛毛雨',53:'毛毛雨',55:'大毛毛雨',61:'小雨',63:'中雨',65:'大雨',
    71:'小雪',73:'中雪',75:'大雪',80:'阵雨',81:'中阵雨',82:'强阵雨',
    95:'雷暴',96:'雷暴伴小冰雹',99:'雷暴伴大冰雹'
  }
  const desc = WMO[c.weather_code] || `天气代码${c.weather_code}`

  return JSON.stringify({
    地点: `${name}，${country}`,
    温度: `${c.temperature_2m}°C（体感 ${c.apparent_temperature}°C）`,
    天气: desc,
    湿度: `${c.relative_humidity_2m}%`,
    风速: `${c.wind_speed_10m} m/s`,
    风向: `${c.wind_direction_10m}°`,
    能见度: `${(c.visibility / 1000).toFixed(1)} km`,
    气压: `${c.surface_pressure} hPa`,
    云量: `${c.cloud_cover}%`
  }, null, 2)
}

// 调用 DashScope
async function callDashScope(apiKey, messages, withTools) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  const body = { model: 'qwen-plus', messages, stream: false }
  if (withTools) body.tools = tools

  const agent = await getAgent()
  const res = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal: controller.signal,
    ...(agent ? { agent } : {})
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
