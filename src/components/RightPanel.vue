<template>
  <div class="right-panel">
    <div class="panel-header">
      <span class="panel-icon">🤖</span>
      <span>智能体分析面板</span>
    </div>

    <!-- Idle state -->
    <div class="idle-hint" v-if="steps.length === 0 && !isRunning">
      <div class="hint-icon">🧭</div>
      <div class=”hint-text”>你可以自然表达，例如”选01船第三条航线评估风险”或”评估A01船航路2的风险”</div>
    </div>

    <!-- Workflow steps -->
    <div class="workflow" v-if="steps.length > 0">
      <div class="workflow-title">
        <span class="wf-dot"></span>
        顺序工作流执行
      </div>

      <div v-for="step in steps" :key="step.id" class="step-block">
        <!-- Step header -->
        <div class="step-header">
          <div class="step-num" :class="step.status">{{ step.index }}</div>
          <div class="step-title">{{ step.title }}</div>
          <div class="step-status-icon">
            <span v-if="step.status === 'running'" class="spinner">⟳</span>
            <span v-else class="done-icon">✓</span>
          </div>
        </div>

        <!-- Tools used -->
        <div class="step-tools">
          <span class="tools-label">tool：</span>
          <span v-for="tool in step.tools" :key="tool" class="tool-tag">{{ tool }}</span>
        </div>

        <!-- Data sources -->
        <div class="data-sources">
          <span class="ds-label">读取数据</span>
          <div class="ds-tags">
            <span v-for="ds in step.dataSource" :key="ds" class="ds-tag">{{ ds }}</span>
          </div>
        </div>

        <!-- Result cards -->
        <div class="result-cards" v-if="step.cards">
          <div
            v-for="card in step.cards"
            :key="card.label"
            class="result-card"
            :class="{ highlight: card.highlight }"
          >
            <div class="card-label">{{ card.label }}</div>
            <div class="card-value">{{ card.value }}</div>
          </div>
        </div>
      </div>

      <!-- Running indicator -->
      <div class="running-indicator" v-if="isRunning">
        <span class="pulse"></span>
        智能体执行中...
      </div>
    </div>

    <!-- Recommendation conclusion -->
    <div class="recommendation" v-if="recommendation">
      <div class="rec-title">📋 推荐结论</div>
      <div class="rec-route">
        <span class="rec-dot" :style="{ background: getRouteColor(recommendation.route.id) }"></span>
        {{ recommendation.route.name }} — {{ recommendation.route.label }}
      </div>
      <div class="rec-reason">{{ recommendation.reason }}</div>
      <button class="report-btn" v-if="reportReady" @click.stop="$emit('showReport')">
        📄 查看完整报告
      </button>
    </div>

    <!-- Hover point info -->
    <div class="hover-info" v-if="hoveredPoint">
      <div class="hover-title">📍 当前航段气象</div>
      <div class="hover-grid">
        <div class="hg-item">
          <span class="hg-label">时间</span>
          <span class="hg-val">{{ formatTime(hoveredPoint.time) }}</span>
        </div>
        <div class="hg-item">
          <span class="hg-label">风速</span>
          <span class="hg-val">{{ hoveredPoint.windSpeed != null ? hoveredPoint.windSpeed.toFixed(1) + ' m/s' : '—' }}</span>
        </div>
        <div class="hg-item">
          <span class="hg-label">风向</span>
          <span class="hg-val">{{ hoveredPoint.windDir != null ? hoveredPoint.windDir + '°' : '—' }}</span>
        </div>
        <div class="hg-item">
          <span class="hg-label">浪高</span>
          <span class="hg-val">{{ hoveredPoint.waveHeight != null ? hoveredPoint.waveHeight.toFixed(1) + ' m' : '—' }}</span>
        </div>
        <div class="hg-item">
          <span class="hg-label">浪向</span>
          <span class="hg-val">{{ hoveredPoint.waveDir != null ? hoveredPoint.waveDir + '°' : '—' }}</span>
        </div>
        <div class="hg-item">
          <span class="hg-label">流速</span>
          <span class="hg-val">{{ hoveredPoint.liuSpeed != null ? hoveredPoint.liuSpeed.toFixed(2) + ' kn' : '—' }}</span>
        </div>
        <div class="hg-item">
          <span class="hg-label">能见度</span>
          <span class="hg-val">{{ hoveredPoint.vis != null ? (hoveredPoint.vis / 1000).toFixed(1) + ' km' : '—' }}</span>
        </div>
        <div class="hg-item">
          <span class="hg-label">风险等级</span>
          <span class="hg-val" :style="{ color: getRiskColor(hoveredPoint.weatherWarn) }">
            {{ getRiskLabel(hoveredPoint.weatherWarn) }}
          </span>
        </div>
      </div>
      <div class="hover-explain">{{ getExplanation(hoveredPoint) }}</div>
    </div>

    <!-- Clicked segment analysis -->
    <div class="segment-analysis" v-if="clickedPoint">
      <div class="seg-title">🔍 航段风险分析</div>
      <div class="seg-risk" :style="{ color: getRiskColor(clickedPoint.weatherWarn) }">
        风险等级：{{ getRiskLabel(clickedPoint.weatherWarn) }}
      </div>
      <div class="seg-explain">{{ getExplanation(clickedPoint) }}</div>
      <div class="seg-advice">
        <div class="advice-title">建议动作</div>
        <div class="advice-text">{{ getAdvice(clickedPoint) }}</div>
      </div>
      <button class="add-report-btn" @click="$emit('addToReport', clickedPoint)">
        + 加入报告
      </button>
    </div>

    <!-- Weather chart during evaluation -->
    <div class="weather-chart" v-if="weatherSeries.length">
      <div class="wc-title">气象要素趋势（前24点）</div>
      <svg viewBox="0 0 260 90" class="wc-svg" preserveAspectRatio="none">
        <polyline
          :points="buildPolyline(weatherSeries, p => windY(p.windSpeed))"
          fill="none"
          stroke="#4a9eff"
          stroke-width="2"
        />
        <polyline
          :points="buildPolyline(weatherSeries, p => waveY(p.waveHeight))"
          fill="none"
          stroke="#00ff88"
          stroke-width="2"
        />
      </svg>
      <div class="wc-legend">
        <span class="legend-item"><i class="dot wind"></i>风速(m/s)</span>
        <span class="legend-item"><i class="dot wave"></i>浪高(m)</span>
      </div>
    </div>

    <!-- AI Chat -->
    <div class="ai-chat-section">
      <div class="chat-header">
        <span>💬 AI 航行助手</span>
        <span class="chat-model-tag">意图识别</span>
      </div>
      <div class="chat-messages" ref="chatMessagesEl">
        <div v-if="chatMessages.length === 0" class="chat-empty">
          可以询问航线风险、气象建议等问题...
        </div>
        <div
          v-for="(msg, idx) in chatMessages"
          :key="idx"
          class="chat-msg"
          :class="msg.role"
        >
          <div class="msg-role">{{ msg.role === 'user' ? '你' : 'AI' }}</div>
          <div class="msg-content">{{ msg.content }}</div>
        </div>
        <div v-if="chatLoading" class="chat-msg assistant">
          <div class="msg-role">AI</div>
          <div class="msg-content chat-typing">正在思考...</div>
        </div>
      </div>
      <div class="chat-input-row">
        <textarea
          v-model="chatInput"
          class="chat-input"
          :placeholder="isListening ? '🎙 正在录音，再点一次停止...' : '输入问题，按 Enter 发送...'"
          rows="2"
          @keydown.enter.exact.prevent="sendChat"
          :disabled="chatLoading"
        ></textarea>
        <div class="chat-btns">
          <button
            class="chat-voice-btn"
            :class="{ listening: isListening, unsupported: !speechSupported }"
            @click="toggleVoice"
            :title="!speechSupported ? '浏览器不支持录音' : isListening ? '点击停止录音并识别' : '点击开始语音输入'"
            :disabled="!speechSupported || chatLoading || chatInput === '🔄 识别中...'"
          >
            <span class="mic-icon">{{ isListening ? '⏹' : '🎙' }}</span>
            <span class="mic-wave" v-if="isListening"></span>
          </button>
          <button class="chat-send-btn" @click="sendChat" :disabled="chatLoading || !chatInput.trim()">
            发送
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import { routesMeta, getRiskLevel, getRiskExplanation } from '../data/mockData.js'

const props = defineProps({
  steps: Array,
  isRunning: Boolean,
  recommendation: Object,
  reportReady: Boolean,
  hoveredPoint: Object,
  clickedPoint: Object,
  riskSummary: Object,
  selectedShip: Object,
  selectedRoutes: Array,
  routeResults: Object
})

const emit = defineEmits(['showReport', 'addToReport', 'selectShipById', 'selectRouteById', 'evaluate'])

// AI Chat state
const chatMessages = ref([])
const chatInput = ref('')
const chatLoading = ref(false)
const chatMessagesEl = ref(null)

// Voice input — 浏览器原生 Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
const speechSupported = !!SpeechRecognition
const isListening = ref(false)
let recognition = null

// 航运领域语音识别错别字矫正
const ASR_CORRECTIONS = [
  // 船的误识别（传、chuan 等）
  [/传/g, '船'],
  [/chuan/gi, '船'],
  // 数字谐音（零一/林依晨 → 01 等）
  [/林依晨|林依传|林依/g, '01'],
  [/零遗|零一/g, '01'],
  [/零二/g, '02'],
  [/零三/g, '03'],
  // 其他航运词汇矫正
  [/杭路|行路/g, '航路'],
  [/行线|杭线/g, '航线'],
  [/丰险|封险/g, '风险'],
  [/评固|评鼓/g, '评估'],
  [/报鼓|爆告/g, '报告'],
  [/旋转/g, '选择'],
  [/钩选/g, '勾选'],
]

function correctASR(text) {
  let result = text
  for (const [pattern, replacement] of ASR_CORRECTIONS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

function toggleVoice() {
  if (!speechSupported) {
    chatMessages.value.push({ role: 'assistant', content: '⚠️ 当前浏览器不支持语音输入，请使用 Chrome。' })
    return
  }
  if (isListening.value) {
    recognition && recognition.stop()
    return
  }

  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.interimResults = false
  recognition.maxAlternatives = 1

  recognition.onstart = () => { isListening.value = true }
  recognition.onend = () => { isListening.value = false }
  recognition.onerror = (e) => {
    isListening.value = false
    if (e.error === 'not-allowed') {
      chatMessages.value.push({ role: 'assistant', content: '⚠️ 麦克风权限被拒绝，请在浏览器设置中允许麦克风访问。' })
    } else {
      chatMessages.value.push({ role: 'assistant', content: `⚠️ 语音识别失败：${e.error}` })
    }
  }
  recognition.onresult = async (e) => {
    const raw = e.results[0][0].transcript.trim()
    const text = correctASR(raw)
    if (text) {
      chatInput.value = text
      await nextTick()
      sendChat()
    }
  }

  recognition.start()
}

function routeNumToId(num) {
  if (num === 1) return 'A'
  if (num === 2) return 'B'
  if (num === 3) return 'C'
  return null
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/第\s*([一二三123])\s*条?/g, '$1')
    .replace(/\s+/g, '')
}

function detectShipId(text) {
  const t = normalizeText(text)

  // a01/a02/a03 直接匹配
  const mA = t.match(/a0?([123])/i)
  if (mA) return `A0${mA[1]}`

  // 数字+船/船型
  const mNumShip = t.match(/(?:船型|船|chuan|ship)([123])/i) || t.match(/([123])(?:号?船型|号?船|号?chuan)/i)
  if (mNumShip) return `A0${mNumShip[1]}`

  // 第X个/第X条船
  if (/第?一个?船|第?1个?船|第一个chuan|第1个chuan/.test(t)) return 'A01'
  if (/第?二个?船|第?2个?船|第二个chuan|第2个chuan/.test(t)) return 'A02'
  if (/第?三个?船|第?3个?船|第三个chuan|第3个chuan/.test(t)) return 'A03'

  // 一/二/三号船
  if (/一号?[船c]|第一个船型|第1个船型/.test(t)) return 'A01'
  if (/二号?[船c]|第二个船型|第2个船型/.test(t)) return 'A02'
  if (/三号?[船c]|第三个船型|第3个船型/.test(t)) return 'A03'

  // 独立 01/02/03（ASR矫正零一→01后，文本中只有数字）
  if (/(?:选择|勾选|选)01/.test(t) || /^01$/.test(t.replace(/[^0-9]/g, ''))) return 'A01'
  if (/(?:选择|勾选|选)02/.test(t) || t === '02') return 'A02'
  if (/(?:选择|勾选|选)03/.test(t) || t === '03') return 'A03'

  return null
}

function detectRouteId(text) {
  const t = normalizeText(text)

  const mRouteNum = t.match(/(?:航线|航路|route)([123一二三])/i)
  if (mRouteNum) {
    const n = mRouteNum[1]
    if (n === '1' || n === '一') return 'A'
    if (n === '2' || n === '二') return 'B'
    if (n === '3' || n === '三') return 'C'
    return routeNumToId(Number(n))
  }

  const mRouteLetter = t.match(/route([abc])/i)
  if (mRouteLetter) return mRouteLetter[1].toUpperCase()

  if (/第一条航线|第一条航路|第1条航线|第1条航路/.test(t)) return 'A'
  if (/第二条航线|第二条航路|第2条航线|第2条航路/.test(t)) return 'B'
  if (/第三条航线|第三条航路|第3条航线|第3条航路/.test(t)) return 'C'
  if (/第一个航线|第一个航路/.test(t)) return 'A'
  if (/第二个航线|第二个航路/.test(t)) return 'B'
  if (/第三个航线|第三个航路/.test(t)) return 'C'
  if (/选择?1号?航|选择?一号?航/.test(t)) return 'A'
  if (/选择?2号?航|选择?二号?航/.test(t)) return 'B'
  if (/选择?3号?航|选择?三号?航/.test(t)) return 'C'

  return null
}

function parseIntent(text) {
  const raw = text.trim()
  const shipId = detectShipId(raw)
  const routeId = detectRouteId(raw)
  const wantsEvaluate = /(评估|分析|风险评估|开始分析|开始评估|执行评估|assess|evaluate)/i.test(raw)
  const mentionsSelection = /(选择|勾选|选中|选|choose|pick)/i.test(raw)

  if (wantsEvaluate && (shipId || routeId)) {
    return { type: 'evaluateWithGuess', shipId, routeId }
  }
  if (wantsEvaluate) {
    return { type: 'evaluateCurrent' }
  }
  if (shipId && routeId) {
    return { type: 'selectBoth', shipId, routeId }
  }
  if (shipId && (mentionsSelection || /船型|船|chuan/i.test(raw) || shipId)) {
    return { type: 'selectShip', shipId }
  }
  if (routeId && (mentionsSelection || /航线|航路|route/i.test(raw) || routeId)) {
    return { type: 'selectRoute', routeId }
  }

  return { type: 'qa' }
}

async function callQwen(text) {
  const history = chatMessages.value.slice(-8).map(m => ({ role: m.role, content: m.content }))
  const messages = [
    { role: 'system', content: '你是智能助手。若用户问题与航运系统无关（如讲笑话、闲聊、常识问答），直接正常回答。回答简洁自然。' },
    ...history,
    { role: 'user', content: text }
  ]

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '暂时没有生成回复。'
}

function routeNameById(routeId) {
  return routeId === 'A' ? '航路1' : routeId === 'B' ? '航路2' : routeId === 'C' ? '航路3' : routeId
}

async function sendChat() {
  const text = chatInput.value.trim()
  if (!text || chatLoading.value) return
  chatInput.value = ''
  chatMessages.value.push({ role: 'user', content: text })
  chatLoading.value = true
  await scrollToBottom()

  try {
    const intent = parseIntent(text)

    if (intent.type === 'selectShip') {
      emit('selectShipById', intent.shipId)
      chatMessages.value.push({ role: 'assistant', content: `已勾选 ${intent.shipId} 船型。` })
    } else if (intent.type === 'selectRoute') {
      emit('selectRouteById', intent.routeId)
      chatMessages.value.push({ role: 'assistant', content: `已勾选 ${routeNameById(intent.routeId)}。` })
    } else if (intent.type === 'selectBoth') {
      emit('selectShipById', intent.shipId)
      emit('selectRouteById', intent.routeId)
      chatMessages.value.push({ role: 'assistant', content: `已勾选 ${intent.shipId} 船型 和 ${routeNameById(intent.routeId)}。` })
    } else if (intent.type === 'evaluateWithGuess') {
      const shipId = intent.shipId || props.selectedShip?.id
      const routeId = intent.routeId || props.selectedRoutes?.[0]?.id

      if (!shipId || !routeId) {
        const missing = []
        if (!shipId) missing.push('船型')
        if (!routeId) missing.push('航线')
        chatMessages.value.push({ role: 'assistant', content: `我可以开始评估，但还缺少${missing.join('和')}信息。你可以说“评估01船型第三条航线的风险”。` })
      } else {
        emit('evaluate', { shipId, routeId })
        chatMessages.value.push({ role: 'assistant', content: `已自动勾选 ${shipId} 和 ${routeNameById(routeId)}，正在执行风险评估并生成报告。` })
      }
    } else if (intent.type === 'evaluateCurrent') {
      if (!props.selectedShip || !props.selectedRoutes?.length) {
        const missing = []
        if (!props.selectedShip) missing.push('船型')
        if (!props.selectedRoutes?.length) missing.push('航线')
        chatMessages.value.push({ role: 'assistant', content: `当前还没有勾选${missing.join('和')}，请补充后我就开始评估。` })
      } else {
        emit('evaluate')
        chatMessages.value.push({ role: 'assistant', content: `已开始评估 ${props.selectedShip.id} 与 ${props.selectedRoutes.map(r => r.name).join('、')} 的风险，并生成报告。` })
      }
    } else {
      const reply = await callQwen(text)
      chatMessages.value.push({ role: 'assistant', content: reply })
    }
  } catch (e) {
    chatMessages.value.push({ role: 'assistant', content: `处理失败：${e.message}` })
  } finally {
    chatLoading.value = false
    await scrollToBottom()
  }
}

async function scrollToBottom() {
  await nextTick()
  if (chatMessagesEl.value) {
    chatMessagesEl.value.scrollTop = chatMessagesEl.value.scrollHeight
  }
}

function getRouteColor(id) {
  return routesMeta.find(r => r.id === id)?.color || '#fff'
}

function getRiskColor(warn) {
  return getRiskLevel(warn).color
}

function getRiskLabel(warn) {
  return getRiskLevel(warn).label
}

function getExplanation(point) {
  return getRiskExplanation(point)
}

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function getAdvice(point) {
  if (!point.weatherWarn) return '正常航行，保持监控。'
  if (point.weatherWarn >= 6) return '建议减速至安全航速，密切关注气象变化，必要时绕行或等待窗口期。'
  if (point.weatherWarn >= 4) return '建议适当减速，加强瞭望，关注后续气象预报。'
  if (point.weatherWarn >= 2) return '保持正常航速，注意浪向变化，做好防浪准备。'
  return '气象条件良好，正常航行。'
}

const weatherSeries = computed(() => {
  const routeId = props.recommendation?.route?.id || props.selectedRoutes?.[0]?.id
  const points = props.routeResults?.[routeId]?.coordinates || []
  return points.slice(0, 24).map((p, idx) => ({
    idx: idx + 1,
    windSpeed: p.windSpeed || 0,
    waveHeight: p.waveHeight || 0
  }))
})

const maxWind = computed(() => {
  const vals = weatherSeries.value.map(i => i.windSpeed)
  return vals.length ? Math.max(...vals, 1) : 1
})

const maxWave = computed(() => {
  const vals = weatherSeries.value.map(i => i.waveHeight)
  return vals.length ? Math.max(...vals, 1) : 1
})

function windY(v) {
  const h = 72
  return 8 + (1 - v / maxWind.value) * h
}

function waveY(v) {
  const h = 72
  return 8 + (1 - v / maxWave.value) * h
}

function buildPolyline(points, yGetter) {
  if (!points.length) return ''
  const w = 240
  const step = points.length <= 1 ? 0 : w / (points.length - 1)
  return points.map((p, i) => `${(i * step).toFixed(1)},${yGetter(p).toFixed(1)}`).join(' ')
}
</script>

<style scoped>
.right-panel {
  width: 100%;
  height: 100%;
  background: rgba(5, 15, 35, 0.95);
  border-left: 1px solid #0d2a4a;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.panel-header {
  padding: 16px;
  font-size: 14px;
  font-weight: 600;
  color: #00d4ff;
  border-bottom: 1px solid #0d2a4a;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: 1px;
  flex-shrink: 0;
}

.idle-hint {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: #2a4a6a;
}
.hint-icon { font-size: 36px; }
.hint-text { font-size: 13px; text-align: center; line-height: 1.6; }

.workflow { padding: 14px; }

.workflow-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4a9eff;
  letter-spacing: 1px;
  margin-bottom: 14px;
  font-weight: 600;
}
.wf-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4a9eff;
  box-shadow: 0 0 8px #4a9eff;
  animation: pulse 1.5s infinite;
}

.step-block {
  border: 1px solid #0d2a4a;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  background: rgba(10, 25, 50, 0.6);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
  border: 1px solid #1a5080;
  color: #4a9eff;
}
.step-num.done { border-color: #00ff88; color: #00ff88; }
.step-num.running { border-color: #4a9eff; color: #4a9eff; }

.step-title { font-size: 13px; color: #c8dff0; flex: 1; }

.step-status-icon { font-size: 14px; }
.spinner { color: #4a9eff; display: inline-block; animation: spin 1s linear infinite; }
.done-icon { color: #00ff88; }

.step-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.tools-label { font-size: 11px; color: #4a7fa5; }
.tool-tag {
  font-size: 11px;
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid rgba(74, 158, 255, 0.3);
  color: #4a9eff;
  padding: 2px 8px;
  border-radius: 10px;
}

.data-sources { margin-bottom: 8px; }
.ds-label { font-size: 11px; color: #4a7fa5; display: block; margin-bottom: 4px; }
.ds-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.ds-tag {
  font-size: 11px;
  background: rgba(13, 42, 74, 0.8);
  border: 1px solid #1a3a5a;
  color: #7ab0d0;
  padding: 2px 8px;
  border-radius: 12px;
}

.result-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.result-card {
  background: rgba(0, 30, 60, 0.6);
  border: 1px solid #0d2a4a;
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.result-card.highlight {
  border-color: #00ff88;
  background: rgba(0, 255, 136, 0.05);
}
.card-label { font-size: 11px; color: #4a7fa5; flex-shrink: 0; }
.card-value { font-size: 12px; color: #c8dff0; text-align: right; }
.result-card.highlight .card-value { color: #00ff88; }

.running-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #4a9eff;
  padding: 8px 0;
}
.pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4a9eff;
  animation: pulse 1s infinite;
}

.recommendation {
  margin: 0 14px 14px;
  border: 1px solid #00ff88;
  border-radius: 8px;
  padding: 14px;
  background: rgba(0, 255, 136, 0.04);
}
.rec-title { font-size: 13px; color: #00ff88; margin-bottom: 10px; font-weight: 600; }
.rec-route {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #c8dff0;
  margin-bottom: 8px;
}
.rec-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.rec-reason { font-size: 12px; color: #7ab0d0; line-height: 1.6; margin-bottom: 12px; }

.report-btn {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #006633, #004422);
  border: 1px solid #00ff88;
  border-radius: 6px;
  color: #00ff88;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 1px;
}
.report-btn:hover { background: linear-gradient(135deg, #008844, #006633); box-shadow: 0 0 12px rgba(0,255,136,0.3); }

.hover-info, .segment-analysis {
  margin: 0 14px 14px;
  border: 1px solid #1a3a5a;
  border-radius: 8px;
  padding: 12px;
  background: rgba(10, 25, 50, 0.6);
}

.hover-title, .seg-title {
  font-size: 12px;
  color: #4a9eff;
  margin-bottom: 10px;
  font-weight: 600;
}

.hover-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 10px;
}
.hg-item { display: flex; flex-direction: column; gap: 2px; }
.hg-label { font-size: 10px; color: #4a7fa5; }
.hg-val { font-size: 12px; color: #c8dff0; }

.hover-explain {
  font-size: 12px;
  color: #7ab0d0;
  line-height: 1.6;
  border-top: 1px solid #0d2a4a;
  padding-top: 8px;
}

.seg-risk { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
.seg-explain { font-size: 12px; color: #7ab0d0; line-height: 1.6; margin-bottom: 10px; }
.advice-title { font-size: 11px; color: #4a7fa5; margin-bottom: 4px; }
.advice-text { font-size: 12px; color: #c8dff0; line-height: 1.6; margin-bottom: 10px; }

.add-report-btn {
  width: 100%;
  padding: 8px;
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid #4a9eff;
  border-radius: 6px;
  color: #4a9eff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.add-report-btn:hover { background: rgba(74, 158, 255, 0.2); }

.weather-chart {
  margin: 0 14px 14px;
  border: 1px solid #1a3a5a;
  border-radius: 8px;
  padding: 10px 12px;
  background: rgba(10, 25, 50, 0.6);
}
.wc-title {
  font-size: 12px;
  color: #4a9eff;
  margin-bottom: 8px;
  font-weight: 600;
}
.wc-svg {
  width: 100%;
  height: 90px;
  background: rgba(5, 15, 35, 0.5);
  border: 1px solid #0d2a4a;
  border-radius: 6px;
}
.wc-legend {
  margin-top: 8px;
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: #7ab0d0;
}
.legend-item { display: inline-flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.wind { background: #4a9eff; }
.dot.wave { background: #00ff88; }

/* AI Chat */
.ai-chat-section {
  margin: 14px 14px 14px;
  border: 1px solid #1a3a5a;
  border-radius: 8px;
  background: rgba(10, 25, 50, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #4a9eff;
  border-bottom: 1px solid #0d2a4a;
  flex-shrink: 0;
}
.chat-model-tag {
  font-size: 10px;
  background: rgba(74,158,255,0.1);
  border: 1px solid rgba(74,158,255,0.3);
  color: #4a9eff;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: normal;
}
.chat-messages {
  max-height: 220px;
  min-height: 80px;
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chat-empty {
  font-size: 12px;
  color: #2a4a6a;
  text-align: center;
  padding: 16px 0;
}
.chat-msg { display: flex; flex-direction: column; gap: 3px; }
.chat-msg.user { align-items: flex-end; }
.chat-msg.assistant { align-items: flex-start; }
.msg-role {
  font-size: 10px;
  color: #4a7fa5;
}
.msg-content {
  font-size: 12px;
  line-height: 1.6;
  padding: 6px 10px;
  border-radius: 6px;
  max-width: 90%;
  white-space: pre-wrap;
  word-break: break-word;
}
.chat-msg.user .msg-content {
  background: rgba(74, 158, 255, 0.12);
  border: 1px solid rgba(74, 158, 255, 0.25);
  color: #c8dff0;
}
.chat-msg.assistant .msg-content {
  background: rgba(10, 30, 60, 0.8);
  border: 1px solid #0d2a4a;
  color: #c8dff0;
}
.chat-typing { color: #4a7fa5; font-style: italic; }
.chat-input-row {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid #0d2a4a;
  flex-shrink: 0;
}
.chat-btns {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}
.chat-voice-btn {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(74, 158, 255, 0.1);
  border: 1px solid #4a9eff;
  color: #4a9eff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
  overflow: visible;
}
.chat-voice-btn:hover:not(:disabled) { background: rgba(74, 158, 255, 0.25); }
.chat-voice-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.chat-voice-btn.unsupported { border-color: #2a4a6a; color: #2a4a6a; }
.chat-voice-btn.listening {
  background: rgba(255, 80, 80, 0.15);
  border-color: #ff5050;
  animation: mic-pulse 1.2s ease-in-out infinite;
}
.mic-icon { font-size: 15px; line-height: 1; }
.mic-wave {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #ff5050;
  animation: mic-ring 1.2s ease-out infinite;
  top: 0; left: 0;
}
.chat-input {
  flex: 1;
  background: rgba(5, 15, 35, 0.8);
  border: 1px solid #1a3a5a;
  border-radius: 6px;
  color: #c8dff0;
  font-size: 12px;
  padding: 6px 10px;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
}
.chat-input:focus { border-color: #4a9eff; }
.chat-input::placeholder { color: #2a4a6a; }
.chat-input:disabled { opacity: 0.5; }
.chat-send-btn {
  padding: 6px 14px;
  background: rgba(74, 158, 255, 0.15);
  border: 1px solid #4a9eff;
  border-radius: 6px;
  color: #4a9eff;
  font-size: 12px;
  cursor: pointer;
  align-self: flex-end;
  transition: all 0.2s;
  white-space: nowrap;
}
.chat-send-btn:hover:not(:disabled) { background: rgba(74, 158, 255, 0.3); }
.chat-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes mic-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,80,80,0.4); } 50% { box-shadow: 0 0 0 6px rgba(255,80,80,0); } }
@keyframes mic-ring { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.7); opacity: 0; } }
</style>
