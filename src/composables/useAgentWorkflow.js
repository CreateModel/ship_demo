import { ref, reactive } from 'vue'
import { callRouteAlgorithm, getRiskLevel, getRiskExplanation, routesMeta } from '../data/mockData.js'

export function useAgentWorkflow() {
  const steps = ref([])
  const isRunning = ref(false)
  const routeResults = ref({})
  const recommendation = ref(null)
  const reportReady = ref(false)

  function addStep(step) {
    steps.value.push({ ...step, id: Date.now() + Math.random() })
  }

  function updateLastStep(patch) {
    const last = steps.value[steps.value.length - 1]
    if (last) Object.assign(last, patch)
  }

  async function delay(ms) {
    return new Promise(r => setTimeout(r, ms))
  }

  async function runWorkflow(ship, selectedRoutes, onRoutesReady) {
    isRunning.value = true
    steps.value = []
    routeResults.value = {}
    recommendation.value = null
    reportReady.value = false

    // Step 1: 任务解析
    addStep({
      index: 1,
      title: '任务解析与航路识别',
      status: 'running',
      tools: ['task_parser', 'region_resolver'],
      dataSource: ['船舶基础数据库', '航路信息库', '任务参数解析器'],
      cards: null
    })
    await delay(900)
    updateLastStep({
      status: 'done',
      cards: [
        { label: '选定船舶', value: ship.name },
        { label: '候选航路', value: selectedRoutes.map(r => r.name).join(' / ') },
        { label: '分析模式', value: '多航路比选 + 风险评估' }
      ]
    })

    // Step 2: 调用算法接口
    addStep({
      index: 2,
      title: '调用航路评估算法',
      status: 'running',
      tools: ['route_algorithm', 'weather_fetcher'],
      dataSource: ['气象预报模型', '海浪数值模型', '洋流数据库', '能见度观测网'],
      cards: null
    })
    const results = {}
    for (const route of selectedRoutes) {
      const data = await callRouteAlgorithm(ship.id, route.id)
      results[route.id] = data
    }
    routeResults.value = results
    if (onRoutesReady) onRoutesReady(results)
    updateLastStep({
      status: 'done',
      cards: selectedRoutes.map(r => ({
        label: r.name,
        value: `${results[r.id]?.content?.length || 0} 个关键航点，${results[r.id]?.coordinates?.length || 0} 个轨迹点`
      }))
    })

    // Step 3: 风险分析
    addStep({
      index: 3,
      title: '风险段识别与评估',
      status: 'running',
      tools: ['risk_analyzer', 'segment_classifier'],
      dataSource: ['weatherWarn 风险字段', '风速/浪高/能见度阈值库'],
      cards: null
    })
    await delay(700)

    const riskSummary = {}
    for (const route of selectedRoutes) {
      const coords = results[route.id]?.coordinates || []
      const highRisk = coords.filter(c => c.weatherWarn >= 6).length
      const midRisk = coords.filter(c => c.weatherWarn >= 2 && c.weatherWarn < 6).length
      const maxWarn = Math.max(...coords.map(c => c.weatherWarn || 0))
      const maxWave = Math.max(...coords.map(c => c.waveHeight || 0))
      const maxWind = Math.max(...coords.filter(c => c.windSpeed).map(c => c.windSpeed))
      riskSummary[route.id] = { highRisk, midRisk, maxWarn, maxWave, maxWind }
    }

    updateLastStep({
      status: 'done',
      cards: selectedRoutes.map(r => {
        const s = riskSummary[r.id]
        const risk = getRiskLevel(s.maxWarn)
        return {
          label: r.name,
          value: `最高${risk.label}，高风险点 ${s.highRisk} 个，峰值浪高 ${s.maxWave.toFixed(1)}m`
        }
      })
    })

    // Step 4: 比选推荐
    addStep({
      index: 4,
      title: '多航路比选与推荐',
      status: 'running',
      tools: ['route_comparator', 'recommendation_engine'],
      dataSource: ['各航路风险汇总', '时效性评估模型', '运营可行性规则库'],
      cards: null
    })
    await delay(600)

    // Pick recommendation: lowest high-risk count, then lowest maxWarn
    const sorted = selectedRoutes.slice().sort((a, b) => {
      const sa = riskSummary[a.id], sb = riskSummary[b.id]
      if (sa.highRisk !== sb.highRisk) return sa.highRisk - sb.highRisk
      return sa.maxWarn - sb.maxWarn
    })
    const rec = sorted[0]
    recommendation.value = {
      route: rec,
      riskSummary: riskSummary[rec.id],
      reason: `${rec.name}高风险点最少(${riskSummary[rec.id].highRisk}个)，综合安全性最优，兼顾时效与运营可行性。`
    }

    updateLastStep({
      status: 'done',
      cards: [
        { label: '推荐航路', value: rec.name, highlight: true },
        { label: '推荐理由', value: recommendation.value.reason }
      ]
    })

    // Step 5: 报告生成
    addStep({
      index: 5,
      title: '生成航线决策报告',
      status: 'running',
      tools: ['report_generator'],
      dataSource: ['风险分析结果', '比选结论', '气象数据摘要', '可视化图表'],
      cards: null
    })
    await delay(800)
    reportReady.value = true
    updateLastStep({
      status: 'done',
      cards: [
        { label: '报告章节', value: '总体态势 / 风险段分析 / 气象数据 / 操作建议' },
        { label: '状态', value: '报告已生成，可查看', highlight: true }
      ]
    })

    isRunning.value = false
    return { routeResults: results, recommendation: recommendation.value, riskSummary }
  }

  return { steps, isRunning, routeResults, recommendation, reportReady, runWorkflow }
}
