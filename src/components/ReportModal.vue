<template>
  <div class="modal-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:99999;">
    <div class="modal-box" @click.stop style="background:#fff;border-radius:10px;width:860px;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.3);overflow:hidden;">
      <div class="modal-header">
        <span class="header-title">航路气象风险评估报告</span>
        <div class="header-actions">
          <button class="dl-btn" @click="downloadPDF">下载 PDF</button>
          <button class="close-btn" @click="$emit('close')">关闭</button>
        </div>
      </div>

      <div class="report-body" id="report-print-area">
        <div class="report-title-block">
          <div class="report-main-title">航路气象风险评估报告</div>
          <div class="report-meta">生成时间：{{ now }}</div>
        </div>

        <!-- 一、基础信息 -->
        <div class="section">
          <div class="section-title">一、基础信息</div>
          <table class="info-table">
            <tbody>
              <tr>
                <td class="info-label">评估船舶</td>
                <td class="info-value strong">{{ selectedShip?.id }} — {{ selectedShip?.name }}</td>
                <td class="info-label">船型</td>
                <td class="info-value">{{ selectedShip?.type }}</td>
              </tr>
              <tr>
                <td class="info-label">推荐航线</td>
                <td class="info-value strong">{{ recommendation?.route?.name }}（{{ recommendation?.route?.label }}）</td>
                <td class="info-label">候选航线数</td>
                <td class="info-value">{{ selectedRoutes.length }} 条</td>
              </tr>
              <tr>
                <td class="info-label">计划开航时间</td>
                <td class="info-value">{{ startTime }}</td>
                <td class="info-label">预计总里程</td>
                <td class="info-value">{{ totalDistance }} nm</td>
              </tr>
              <tr>
                <td class="info-label">报告生成时间</td>
                <td class="info-value" colspan="3">{{ now }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 二、综合风险概览 -->
        <div class="section">
          <div class="section-title">二、航路综合风险概览</div>
          <div class="risk-level-badge" :class="overallRiskClass">整体风险等级：{{ overallRiskLabel }}</div>
          <div class="analysis-text" style="margin-top:12px">{{ situationSummary }}</div>
          <table class="compare-table" style="margin-top:12px">
            <thead>
              <tr>
                <th>航线</th><th>高风险点</th><th>中风险点</th>
                <th>峰值浪高(m)</th><th>峰值风速(m/s)</th><th>综合评价</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="route in selectedRoutes" :key="route.id"
                :class="{ 'row-recommend': recommendation?.route?.id === route.id }">
                <td>{{ route.name }}<span v-if="recommendation?.route?.id===route.id" class="tag-rec">推荐</span></td>
                <td class="risk-high">{{ riskSummary?.[route.id]?.highRisk ?? '—' }}</td>
                <td class="risk-mid">{{ riskSummary?.[route.id]?.midRisk ?? '—' }}</td>
                <td>{{ riskSummary?.[route.id]?.maxWave?.toFixed(1) ?? '—' }}</td>
                <td>{{ riskSummary?.[route.id]?.maxWind?.toFixed(1) ?? '—' }}</td>
                <td>{{ riskSummary?.[route.id]?.highRisk > 5 ? '风险较高' : riskSummary?.[route.id]?.highRisk > 0 ? '需关注' : '条件良好' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 三、关键气象要素分析 -->
        <div class="section">
          <div class="section-title">三、关键气象要素分析</div>

          <!-- 3.1 风速风向 -->
          <div class="sub-section">
            <div class="sub-title">3.1 风场趋势（风速折线 + 风向箭头）</div>
            <div class="chart-wrap">
              <svg v-if="windSeries.length > 1" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="chart-svg">
                <line v-for="(y,gi) in yGridLines" :key="'wg'+gi" :x1="PAD_L" :y1="y" :x2="SVG_W-PAD_R" :y2="y" stroke="#e5edf5" stroke-width="1"/>
                <template v-for="(pt,i) in windSeries" :key="'wxt'+i">
                  <text v-if="i % xStep(windSeries.length) === 0"
                    :x="ptX(i, windSeries.length)" :y="SVG_H-4" font-size="9" fill="#888" text-anchor="middle">{{ pt.timeLabel }}</text>
                </template>
                <text v-for="(v,i) in windYLabels" :key="'wyl'+i"
                  :x="PAD_L-4" :y="scaleY(v, maxWindSpeed)+4" font-size="9" fill="#555" text-anchor="end">{{ v }}</text>
                <polyline :points="windSeries.map((p,i)=>`${ptX(i,windSeries.length)},${scaleY(p.windSpeed,maxWindSpeed)}`).join(' ')"
                  fill="none" stroke="#4a9eff" stroke-width="2"/>
                <template v-for="(pt,i) in windSeries" :key="'wa'+i">
                  <g v-if="i % arrowStep(windSeries.length) === 0">
                    <g :transform="`translate(${ptX(i,windSeries.length)},${scaleY(pt.windSpeed,maxWindSpeed)}) rotate(${pt.windDir||0})`">
                      <line x1="0" y1="6" x2="0" y2="-6" stroke="#e03030" stroke-width="1.5"/>
                      <polygon points="0,-6 -2,-2 2,-2" fill="#e03030"/>
                    </g>
                  </g>
                </template>
                <template v-for="(pt,i) in windSeries" :key="'wn'+i">
                  <g v-if="i % labelStep(windSeries.length) === 0">
                    <rect :x="ptX(i,windSeries.length)-8" :y="scaleY(pt.windSpeed,maxWindSpeed)-20" width="16" height="12" fill="#ffe066" rx="2" opacity="0.9"/>
                    <text :x="ptX(i,windSeries.length)" :y="scaleY(pt.windSpeed,maxWindSpeed)-11" font-size="8" fill="#333" text-anchor="middle" font-weight="bold">{{ i+1 }}</text>
                  </g>
                </template>
                <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="SVG_H-PAD_B" stroke="#bbb" stroke-width="1"/>
                <line :x1="PAD_L" :y1="SVG_H-PAD_B" :x2="SVG_W-PAD_R" :y2="SVG_H-PAD_B" stroke="#bbb" stroke-width="1"/>
              </svg>
              <div v-else class="empty-hint">暂无风场数据</div>
            </div>
            <div class="chart-legend">
              <span><i class="leg-dot" style="background:#4a9eff"></i>风速(m/s)</span>
              <span style="color:#e03030">↑ 风向（红色箭头）</span>
              <span><i class="leg-box"></i>点位序号（黄框）</span>
            </div>
            <div class="analysis-text" style="margin-top:8px">{{ windAnalysisText }}</div>
          </div>

          <!-- 3.2 浪高 -->
          <div class="sub-section">
            <div class="sub-title">3.2 浪高变化趋势（合成浪 / 涌浪 / 风浪）</div>
            <div class="chart-wrap">
              <svg v-if="waveSeries.length > 1" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="chart-svg">
                <line v-for="(y,gi) in yGridLines" :key="'wvg'+gi" :x1="PAD_L" :y1="y" :x2="SVG_W-PAD_R" :y2="y" stroke="#e5edf5" stroke-width="1"/>
                <template v-for="(pt,i) in waveSeries" :key="'wvxt'+i">
                  <text v-if="i % xStep(waveSeries.length) === 0"
                    :x="ptX(i, waveSeries.length)" :y="SVG_H-4" font-size="9" fill="#888" text-anchor="middle">{{ pt.timeLabel }}</text>
                </template>
                <polyline :points="waveSeries.map((p,i)=>`${ptX(i,waveSeries.length)},${scaleY(p.waveHeight,maxWaveHeight)}`).join(' ')"
                  fill="none" stroke="#00c8a0" stroke-width="2"/>
                <polyline :points="waveSeries.map((p,i)=>`${ptX(i,waveSeries.length)},${scaleY(p.yWaveHeight,maxWaveHeight)}`).join(' ')"
                  fill="none" stroke="#ff9800" stroke-width="1.5" stroke-dasharray="5,3"/>
                <polyline :points="waveSeries.map((p,i)=>`${ptX(i,waveSeries.length)},${scaleY(p.fWaveHeight,maxWaveHeight)}`).join(' ')"
                  fill="none" stroke="#e040fb" stroke-width="1.5" stroke-dasharray="2,2"/>
                <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="SVG_H-PAD_B" stroke="#bbb" stroke-width="1"/>
                <line :x1="PAD_L" :y1="SVG_H-PAD_B" :x2="SVG_W-PAD_R" :y2="SVG_H-PAD_B" stroke="#bbb" stroke-width="1"/>
              </svg>
              <div v-else class="empty-hint">暂无浪高数据</div>
            </div>
            <div class="chart-legend">
              <span><i class="leg-dot" style="background:#00c8a0"></i>合成浪(m)</span>
              <span><i class="leg-dot" style="background:#ff9800"></i>涌浪(m)</span>
              <span><i class="leg-dot" style="background:#e040fb"></i>风浪(m)</span>
            </div>
            <div class="analysis-text" style="margin-top:8px">{{ waveAnalysisText }}</div>
          </div>

          <!-- 3.3 表层流 -->
          <div class="sub-section">
            <div class="sub-title">3.3 表层流分析（流速折线 + 流向箭头）</div>
            <div class="chart-wrap">
              <svg v-if="currentSeries.length > 1" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="chart-svg">
                <line v-for="(y,gi) in yGridLines" :key="'cg'+gi" :x1="PAD_L" :y1="y" :x2="SVG_W-PAD_R" :y2="y" stroke="#e5edf5" stroke-width="1"/>
                <template v-for="(pt,i) in currentSeries" :key="'cxt'+i">
                  <text v-if="i % xStep(currentSeries.length) === 0"
                    :x="ptX(i, currentSeries.length)" :y="SVG_H-4" font-size="9" fill="#888" text-anchor="middle">{{ pt.timeLabel }}</text>
                </template>
                <polyline :points="currentSeries.map((p,i)=>`${ptX(i,currentSeries.length)},${scaleY(p.liuSpeed,maxLiuSpeed)}`).join(' ')"
                  fill="none" stroke="#26c6da" stroke-width="2"/>
                <template v-for="(pt,i) in currentSeries" :key="'ca'+i">
                  <g v-if="i % arrowStep(currentSeries.length) === 0">
                    <g :transform="`translate(${ptX(i,currentSeries.length)},${scaleY(pt.liuSpeed,maxLiuSpeed)}) rotate(${pt.liuDir||0})`">
                      <line x1="0" y1="5" x2="0" y2="-5" stroke="#ff7043" stroke-width="1.5"/>
                      <polygon points="0,-5 -2,-1 2,-1" fill="#ff7043"/>
                    </g>
                  </g>
                </template>
                <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="SVG_H-PAD_B" stroke="#bbb" stroke-width="1"/>
                <line :x1="PAD_L" :y1="SVG_H-PAD_B" :x2="SVG_W-PAD_R" :y2="SVG_H-PAD_B" stroke="#bbb" stroke-width="1"/>
              </svg>
              <div v-else class="empty-hint">暂无流场数据</div>
            </div>
            <div class="chart-legend">
              <span><i class="leg-dot" style="background:#26c6da"></i>流速(kn)</span>
              <span style="color:#ff7043">↑ 流向（橙色箭头）</span>
            </div>
            <div class="analysis-text" style="margin-top:8px">{{ currentAnalysisText }}</div>
          </div>

          <!-- 3.4 能见度 -->
          <div class="sub-section">
            <div class="sub-title">3.4 能见度分析</div>
            <div class="chart-wrap">
              <svg v-if="visSeries.length > 1" :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="chart-svg">
                <rect v-if="visMin < 10" :x="PAD_L" :y="scaleY(10, maxVisKm)"
                  :width="SVG_W-PAD_L-PAD_R" :height="SVG_H-PAD_B - scaleY(10,maxVisKm)"
                  fill="rgba(255,80,80,0.08)"/>
                <line v-if="visMin < 10" :x1="PAD_L" :y1="scaleY(10,maxVisKm)" :x2="SVG_W-PAD_R" :y2="scaleY(10,maxVisKm)"
                  stroke="#f44" stroke-width="1" stroke-dasharray="4,3"/>
                <text v-if="visMin < 10" :x="SVG_W-PAD_R-2" :y="scaleY(10,maxVisKm)-3"
                  font-size="8" fill="#f44" text-anchor="end">低能见度警戒(10km)</text>
                <line v-for="(y,gi) in yGridLines" :key="'vvg'+gi" :x1="PAD_L" :y1="y" :x2="SVG_W-PAD_R" :y2="y" stroke="#e5edf5" stroke-width="1"/>
                <template v-for="(pt,i) in visSeries" :key="'vxt'+i">
                  <text v-if="i % xStep(visSeries.length) === 0"
                    :x="ptX(i, visSeries.length)" :y="SVG_H-4" font-size="9" fill="#888" text-anchor="middle">{{ pt.timeLabel }}</text>
                </template>
                <polyline :points="visSeries.map((p,i)=>`${ptX(i,visSeries.length)},${scaleY(p.visKm,maxVisKm)}`).join(' ')"
                  fill="none" stroke="#78909c" stroke-width="2"/>
                <template v-for="(pt,i) in visSeries" :key="'vc'+i">
                  <circle v-if="pt.visKm < 10"
                    :cx="ptX(i,visSeries.length)" :cy="scaleY(pt.visKm,maxVisKm)" r="3" fill="#f44" opacity="0.8"/>
                </template>
                <line :x1="PAD_L" :y1="PAD_T" :x2="PAD_L" :y2="SVG_H-PAD_B" stroke="#bbb" stroke-width="1"/>
                <line :x1="PAD_L" :y1="SVG_H-PAD_B" :x2="SVG_W-PAD_R" :y2="SVG_H-PAD_B" stroke="#bbb" stroke-width="1"/>
              </svg>
              <div v-else class="empty-hint">暂无能见度数据</div>
            </div>
            <div class="chart-legend">
              <span><i class="leg-dot" style="background:#78909c"></i>能见度(km)</span>
              <span><i class="leg-dot" style="background:#f44"></i>低能见度点(&lt;10km)</span>
            </div>
            <div class="analysis-text" style="margin-top:8px">{{ visAnalysisText }}</div>
          </div>
        </div>

        <!-- 四、详细点位数据表 -->
        <div class="section">
          <div class="section-title">四、航路关键点位气象数据</div>
          <table class="risk-table" v-if="meteoPoints.length">
            <thead>
              <tr>
                <th>序号</th><th>时间</th><th>风速(m/s)</th><th>风向(°)</th>
                <th>浪高(m)</th><th>流速(kn)</th><th>能见度(km)</th><th>风险等级</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(pt,idx) in meteoPoints" :key="'m'+idx"
                :class="pt.weatherWarn>=4 ? 'row-high-risk' : pt.weatherWarn>=2 ? 'row-mid-risk' : ''">
                <td>{{ idx+1 }}</td>
                <td>{{ formatTime(pt.time) }}</td>
                <td>{{ pt.windSpeed?.toFixed(1) ?? '—' }}</td>
                <td>{{ pt.windDir?.toFixed(0) ?? '—' }}</td>
                <td>{{ pt.waveHeight?.toFixed(1) ?? '—' }}</td>
                <td>{{ pt.liuSpeed?.toFixed(2) ?? '—' }}</td>
                <td>{{ pt.vis != null ? (pt.vis/1000).toFixed(1) : '—' }}</td>
                <td><span class="risk-tag" :class="riskTagClass(pt.weatherWarn)">{{ riskLevelLabel(pt.weatherWarn) }}</span></td>
              </tr>
            </tbody>
          </table>
          <div v-else class="empty-hint">暂无点位气象数据。</div>
        </div>

        <!-- 五、专项风险评估 -->
        <div class="section">
          <div class="section-title">五、专项风险评估</div>
          <div class="risk-items">
            <div class="risk-item">
              <div class="risk-item-title">大风 / 台风风险</div>
              <div class="risk-item-content">{{ windRiskText }}</div>
            </div>
            <div class="risk-item">
              <div class="risk-item-title">巨浪 / 涌浪风险</div>
              <div class="risk-item-content">{{ waveRiskText }}</div>
            </div>
            <div class="risk-item">
              <div class="risk-item-title">低能见度 / 雾风险</div>
              <div class="risk-item-content">{{ visRiskText }}</div>
            </div>
          </div>
        </div>

        <!-- 六、航行策略与建议 -->
        <div class="section">
          <div class="section-title">六、航行策略与建议</div>
          <div v-for="advice in adviceList" :key="advice.role" class="advice-block">
            <div class="advice-role">{{ advice.role }}</div>
            <div class="advice-text">{{ advice.text }}</div>
          </div>
        </div>

        <!-- 七、最终结论 -->
        <div class="section conclusion-section">
          <div class="section-title">七、最终结论</div>
          <div class="conclusion-text">{{ conclusionText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  recommendation: Object,
  selectedRoutes: { type: Array, default: () => [] },
  selectedShip: Object,
  routeResults: Object,
  riskSummary: Object
})

const now = new Date().toLocaleString('zh-CN')

const SVG_W = 520
const SVG_H = 150
const PAD_L = 34
const PAD_R = 10
const PAD_T = 14
const PAD_B = 22

const yGridLines = computed(() => {
  const h = SVG_H - PAD_T - PAD_B
  return [0, 0.25, 0.5, 0.75, 1].map(v => PAD_T + h * v)
})

function xStep(len) {
  if (len <= 8) return 1
  if (len <= 16) return 2
  if (len <= 32) return 4
  return 6
}

function arrowStep(len) {
  if (len <= 8) return 1
  if (len <= 16) return 2
  return 3
}

function labelStep(len) {
  if (len <= 8) return 1
  if (len <= 16) return 3
  return 4
}

function ptX(i, len) {
  const w = SVG_W - PAD_L - PAD_R
  if (len <= 1) return PAD_L
  return PAD_L + (i / (len - 1)) * w
}

function scaleY(v, maxV) {
  const safeMax = Math.max(maxV || 0, 1)
  const ratio = Math.min(Math.max((v || 0) / safeMax, 0), 1)
  const h = SVG_H - PAD_T - PAD_B
  return PAD_T + (1 - ratio) * h
}

const coords = computed(() => {
  const id = props.recommendation?.route?.id || props.selectedRoutes?.[0]?.id
  return props.routeResults?.[id]?.coordinates || []
})

const sampled = computed(() => {
  return coords.value.filter((_, i) => i % 3 === 0).slice(0, 48)
})

const meteoPoints = computed(() => coords.value.filter((_, i) => i % 6 === 0).slice(0, 20))

const windSeries = computed(() => sampled.value.map(pt => ({
  timeLabel: formatTimeLabel(pt.time),
  windSpeed: pt.windSpeed || 0,
  windDir: pt.windDir || 0
})))

const waveSeries = computed(() => sampled.value.map(pt => ({
  timeLabel: formatTimeLabel(pt.time),
  waveHeight: pt.waveHeight || 0,
  yWaveHeight: pt.yWaveHeight || 0,
  fWaveHeight: pt.fWaveHeight || 0
})))

const currentSeries = computed(() => sampled.value.map(pt => ({
  timeLabel: formatTimeLabel(pt.time),
  liuSpeed: pt.liuSpeed || 0,
  liuDir: pt.liuDir || 0
})))

const visSeries = computed(() => sampled.value.map(pt => ({
  timeLabel: formatTimeLabel(pt.time),
  visKm: (pt.vis || 0) / 1000
})))

const maxWindSpeed = computed(() => Math.max(1, ...windSeries.value.map(p => p.windSpeed || 0)))
const maxWaveHeight = computed(() => Math.max(1, ...waveSeries.value.flatMap(p => [p.waveHeight || 0, p.yWaveHeight || 0, p.fWaveHeight || 0])))
const maxLiuSpeed = computed(() => Math.max(1, ...currentSeries.value.map(p => p.liuSpeed || 0)))
const maxVisKm = computed(() => Math.max(10, ...visSeries.value.map(p => p.visKm || 0)))
const visMin = computed(() => visSeries.value.length ? Math.min(...visSeries.value.map(p => p.visKm || Infinity)) : Infinity)

const windYLabels = computed(() => {
  const m = maxWindSpeed.value
  return [0, 0.25, 0.5, 0.75, 1].map(v => Number((m * v).toFixed(1))).reverse()
})

const riskStats = computed(() => {
  const pts = coords.value
  return {
    total: pts.length,
    highRisk: pts.filter(p => (p.weatherWarn || 0) >= 4).length,
    midRisk: pts.filter(p => (p.weatherWarn || 0) >= 2 && (p.weatherWarn || 0) < 4).length,
    maxWind: Math.max(0, ...pts.map(p => p.windSpeed || 0)),
    maxWave: Math.max(0, ...pts.map(p => p.waveHeight || 0)),
    minVis: Math.min(...pts.map(p => p.vis || Infinity))
  }
})

const overallRiskLevel = computed(() => {
  const s = riskStats.value
  if (s.highRisk > 5) return { label: '高', cls: 'high' }
  if (s.highRisk > 0 || s.midRisk > 10) return { label: '中', cls: 'mid' }
  return { label: '低', cls: 'low' }
})

const overallRiskLabel = computed(() => overallRiskLevel.value.label)
const overallRiskClass = computed(() => overallRiskLevel.value.cls)

const startTime = computed(() => {
  const t = coords.value[0]?.time
  return t ? new Date(t).toLocaleString('zh-CN') : '—'
})

const totalDistance = computed(() => {
  const pts = coords.value
  if (pts.length < 2) return '—'
  let d = 0
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i].lon - pts[i - 1].lon) * 60 * Math.cos((pts[i].lat + pts[i - 1].lat) / 2 * Math.PI / 180)
    const dy = (pts[i].lat - pts[i - 1].lat) * 60
    d += Math.sqrt(dx * dx + dy * dy)
  }
  return Math.round(d)
})

const situationSummary = computed(() => {
  const s = riskStats.value
  const ship = props.selectedShip
  const route = props.recommendation?.route
  return `本次评估航线${route?.name || ''}（${route?.label || ''}），使用船型${ship?.id || ''}（${ship?.type || ''}，吨位${ship?.tonnage?.toLocaleString() || ''}吨）。` +
    `全程共 ${s.total} 个点位，其中高风险点 ${s.highRisk} 个、中风险点 ${s.midRisk} 个。` +
    `最大风速 ${s.maxWind.toFixed(1)} m/s，最大浪高 ${s.maxWave.toFixed(1)} m，` +
    `最低能见度 ${s.minVis === Infinity ? '—' : (s.minVis / 1000).toFixed(1)} km。`
})

const windAnalysisText = computed(() => {
  const s = riskStats.value
  return `全程最大风速 ${s.maxWind.toFixed(1)} m/s。` +
    (s.maxWind > 17 ? '存在大风风险，建议提前规划绕行。' : s.maxWind > 10 ? '风速适中，注意航向稳定性。' : '风力较小，气象条件良好。')
})

const waveAnalysisText = computed(() => {
  const s = riskStats.value
  return `全程最大浪高 ${s.maxWave.toFixed(1)} m。` +
    (s.maxWave > 4 ? '浪高较大，建议减速，检查货物系固。' : s.maxWave > 2 ? '中等浪况，注意船员防护。' : '海况平稳，正常航行。')
})

const currentAnalysisText = computed(() => {
  const max = maxLiuSpeed.value
  if (max > 2.5) return `流速峰值 ${max.toFixed(2)} kn，局部流场较强，建议加强航向修正。`
  if (max > 1.5) return `流速峰值 ${max.toFixed(2)} kn，流场中等，注意保持航迹。`
  return `流速峰值 ${max.toFixed(2)} kn，流场平稳。`
})

const visAnalysisText = computed(() => {
  const low = coords.value.filter(p => (p.vis || 0) < 10000).length
  if (low === 0) return '全程能见度良好，均在10km以上，无低能见度风险。'
  return `全程共有 ${low} 个点位能见度低于10km，需注意雾航安全，建议使用雷达导航并减速。`
})

const windRiskText = computed(() => {
  const max = riskStats.value.maxWind
  return max > 17 ? '存在明显大风风险，建议提前避开高风速时段与海域。' : max > 10 ? '局部时段风速偏高，需加强值班瞭望与航向控制。' : '未见显著大风风险。'
})

const waveRiskText = computed(() => {
  const max = riskStats.value.maxWave
  return max > 4 ? '存在较大浪高风险，建议减速并强化货物系固。' : max > 2 ? '中等浪况，需关注船体纵摇横摇影响。' : '浪况总体平稳。'
})

const visRiskText = computed(() => {
  const low = coords.value.filter(p => (p.vis || 0) < 10000).length
  return low > 0 ? `存在 ${low} 处低能见度点位，建议开启雾航程序并提升通信频率。` : '未见低能见度风险。'
})

const adviceList = computed(() => [
  { role: '航速建议', text: riskStats.value.highRisk > 3 ? '建议在高风险区段减速至计划航速的80%，并随时关注气象更新。' : '建议保持计划航速，密切关注气象变化。' },
  { role: '货物系固建议', text: riskStats.value.maxWave > 3 ? '建议出港前全面检查货物系固，并准备应急方案。' : '常规检查即可，确保货物固定到位。' },
  { role: '通信保障建议', text: '保持与岸基气象服务联络，每6小时更新一次气象预报，高风险段每3小时更新。' },
  { role: '备降/锚泊建议', text: riskStats.value.highRisk > 5 ? '建议预先标注沿途可用锚地，以备恶劣天气避风。' : '当前气象条件无需特别备降安排。' }
])

const conclusionText = computed(() => {
  const route = props.recommendation?.route
  const ship = props.selectedShip
  const s = riskStats.value
  const lvl = overallRiskLevel.value
  return `综合气象要素分析，${route?.name || '本航线'}（${route?.label || ''}）整体风险等级为【${lvl.label}】。` +
    `建议${ship?.id || ''}船按计划开航，${s.highRisk > 0 ? `重点关注 ${s.highRisk} 个高风险点位，适时调整航速航向，` : ''}保持与岸基气象台的实时联系，确保航行安全。`
})

function riskLevelLabel(w) {
  if (!w) return '正常'
  if (w >= 6) return '极高'
  if (w >= 4) return '高'
  if (w >= 2) return '中'
  return '低'
}

function riskTagClass(w) {
  if (w >= 4) return 'high'
  if (w >= 2) return 'mid'
  return 'low'
}

function formatTime(t) {
  if (!t) return '—'
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatTimeLabel(t) {
  if (!t) return '—'
  return new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

async function downloadPDF() {
  const { default: html2pdf } = await import('html2pdf.js')
  const el = document.getElementById('report-print-area')

  // Clone the element outside the clipped modal so html2pdf captures full content
  const clone = el.cloneNode(true)
  clone.style.cssText = 'position:fixed;left:-9999px;top:0;width:860px;background:#fff;overflow:visible;max-height:none;'
  document.body.appendChild(clone)

  try {
    await html2pdf().set({
      margin: 10,
      filename: '航路气象风险评估报告.pdf',
      html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(clone).save()
  } finally {
    document.body.removeChild(clone)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal-box {
  background: #fff;
  border-radius: 10px;
  width: 860px;
  max-height: 90vh;
  display: flex; flex-direction: column;
  box-shadow: 0 8px 40px rgba(0,0,0,0.3);
  overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #e0e8f5;
  background: #1a3a6f;
  color: #fff;
}
.header-title { font-size: 16px; font-weight: 700; letter-spacing: 1px; }
.dl-btn, .close-btn {
  padding: 6px 14px; border-radius: 5px; cursor: pointer;
  font-size: 13px; border: none;
}
.dl-btn { background: #0066cc; color: #fff; margin-right: 8px; }
.close-btn { background: #eee; color: #333; }
.report-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
.report-title-block { text-align: center; margin-bottom: 20px; }
.report-main-title { font-size: 20px; font-weight: 800; color: #1a3a6f; letter-spacing: 2px; }
.report-meta { font-size: 12px; color: #555; margin-top: 4px; }
.section { margin-bottom: 24px; }
.section-title {
  font-size: 15px; font-weight: 700; color: #1a3a6f;
  border-left: 4px solid #0066cc; padding-left: 10px;
  margin-bottom: 12px;
}
.info-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.info-table td { padding: 6px 10px; border: 1px solid #dde6f5; color: #222; }
.info-label { background: #f0f5ff; color: #333; width: 100px; font-weight: 600; }
.info-value { color: #222; }
.strong { font-weight: 700; color: #1a3a6f; }
.risk-badge {
  display: inline-block; padding: 2px 10px; border-radius: 12px;
  font-size: 12px; font-weight: 700;
}
.risk-badge.low { background: #e8f8e8; color: #2a8a2a; }
.risk-badge.mid { background: #fff8e0; color: #b07000; }
.risk-badge.high { background: #fee8e8; color: #cc2222; }
.risk-badge.extreme { background: #4a0000; color: #fff; }
.chart-box {
  border: 1px solid #dde6f5; border-radius: 6px;
  padding: 12px; background: #f8fbff;
  margin-bottom: 10px;
}
.chart-title { font-size: 12px; font-weight: 600; color: #222; margin-bottom: 6px; }
.chart-svg { width: 100%; height: 120px; display: block; }
.chart-legend {
  display: flex; gap: 16px; margin-top: 6px;
  font-size: 11px; color: #444;
}
.leg-dot {
  display: inline-block; width: 10px; height: 10px;
  border-radius: 50%; margin-right: 4px;
  vertical-align: middle;
}
.analysis-text {
  font-size: 13px; color: #111; line-height: 1.8;
  background: #f9fbff; border: 1px solid #dbe7f5;
  border-radius: 4px; padding: 10px 12px;
}
.risk-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.risk-table th { background: #1a3a6f; color: #fff; padding: 7px 8px; text-align: center; }
.risk-table td { padding: 6px 8px; border: 1px solid #dde6f5; text-align: center; }
.row-high-risk td { background: #fff0f0; color: #cc2222; }
.row-mid-risk td { background: #fffbee; color: #996600; }
.risk-seg-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.risk-seg-table th { background: #2a4a8f; color: #fff; padding: 7px 8px; text-align: center; }
.risk-seg-table td { padding: 6px 8px; border: 1px solid #dde6f5; text-align: center; }
.risk-tag {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 11px; font-weight: 600;
}
.risk-tag.high { background: #fee8e8; color: #cc2222; }
.risk-tag.mid { background: #fff8e0; color: #b07000; }
.risk-tag.low { background: #e8f8e8; color: #2a8a2a; }
.advice-block { margin-bottom: 10px; border-left: 3px solid #0066cc; padding-left: 12px; }
.sub-title { font-size: 13px; font-weight: 600; color: #222; margin-bottom: 6px; }
.advice-role { font-size: 13px; font-weight: 700; color: #1a3a6f; }
.advice-text { font-size: 13px; color: #222; line-height: 1.7; margin-top: 2px; }
.conclusion-section { background: #f0f5ff; border: 1px solid #c8d8f0; border-radius: 6px; padding: 16px; }
.conclusion-text { font-size: 13px; color: #111; line-height: 1.8; }
.empty-hint { font-size: 13px; color: #666; padding: 10px 0; }
.risk-level-badge { font-size: 14px; font-weight: 700; color: #222; padding: 6px 12px; border-radius: 6px; display: inline-block; margin-bottom: 8px; }
.compare-table td { padding: 6px 10px; border: 1px solid #dde6f5; color: #222; }
.compare-table th { background: #1a3a6f; color: #fff; padding: 7px 8px; text-align: center; }
.risk-item { margin-bottom: 10px; }
.risk-item-title { font-size: 13px; font-weight: 700; color: #1a3a6f; margin-bottom: 4px; }
.risk-item-content { font-size: 13px; color: #222; line-height: 1.7; }
</style>
