<template>
  <div class="app-layout">
    <div class="left-col">
      <LeftPanel
        :selectedShip="selectedShip"
        :selectedRoutes="selectedRoutes"
        :routeResults="routeResults"
        :recommendation="recommendation"
        :riskSummary="riskSummary"
        :isRunning="isRunning"
        @selectShip="selectedShip = $event"
        @toggleRoute="toggleRoute"
      />
    </div>
    <div class="center-col">
      <CesiumMap
        :routeResults="routeResults"
        :selectedRoutes="selectedRoutes"
        :recommendation="recommendation"
        :selectedShip="selectedShip"
        @hoverPoint="hoveredPoint = $event"
        @clickPoint="clickedPoint = $event"
      />
    </div>
    <div class="right-col">
      <RightPanel
        :steps="steps"
        :isRunning="isRunning"
        :recommendation="recommendation"
        :reportReady="reportReady"
        :hoveredPoint="hoveredPoint"
        :clickedPoint="clickedPoint"
        :riskSummary="riskSummary"
        :selectedShip="selectedShip"
        :selectedRoutes="selectedRoutes"
        :routeResults="routeResults"
        @showReport="openReportModal"
        @addToReport="addToReport"
        @selectShipById="selectShipById"
        @selectRouteById="selectRouteById"
        @evaluate="evaluateFromChat"
      />
    </div>

    <Teleport to="body">
      <ReportModal
        v-if="showReport"
        :recommendation="recommendation"
        :routeResults="routeResults"
        :selectedRoutes="selectedRoutes"
        :selectedShip="selectedShip"
        :riskSummary="riskSummary"
        :reportItems="reportItems"
        :vizImageUrl="vizImageUrl"
        @close="showReport = false"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import LeftPanel from './components/LeftPanel.vue'
import RightPanel from './components/RightPanel.vue'
import CesiumMap from './components/CesiumMap.vue'
import ReportModal from './components/ReportModal.vue'
import { useAgentWorkflow } from './composables/useAgentWorkflow.js'
import { callVisualizationAlgorithm, ships, routesMeta } from './data/mockData.js'

const { steps, isRunning, routeResults, recommendation, reportReady, runWorkflow } = useAgentWorkflow()

const selectedShip = ref(null)
const selectedRoutes = ref([])
const riskSummary = ref({})
const hoveredPoint = ref(null)
const clickedPoint = ref(null)
const showReport = ref(false)
const reportItems = ref([])
const vizImageUrl = ref(null)

function openReportModal() {
  showReport.value = true
}

function toggleRoute(route) {
  const idx = selectedRoutes.value.findIndex(r => r.id === route.id)
  if (idx >= 0) selectedRoutes.value.splice(idx, 1)
  else selectedRoutes.value.push(route)
}

function selectShipById(shipId) {
  const ship = ships.find(s => s.id === shipId)
  if (!ship) return
  selectedShip.value = ship
}

function selectRouteById(routeId) {
  const route = routesMeta.find(r => r.id === routeId)
  if (!route) return
  if (!selectedRoutes.value.some(r => r.id === route.id)) {
    selectedRoutes.value.push(route)
  }
}

async function startAnalysis() {
  if (!selectedShip.value || selectedRoutes.value.length === 0) return
  reportItems.value = []
  vizImageUrl.value = null
  const result = await runWorkflow(selectedShip.value, selectedRoutes.value, null)
  riskSummary.value = result.riskSummary
  if (recommendation.value) {
    vizImageUrl.value = await callVisualizationAlgorithm(recommendation.value.route.id)
  }
  openReportModal()
}

async function evaluateFromChat(payload) {
  if (payload?.shipId) selectShipById(payload.shipId)
  if (payload?.routeId) {
    selectedRoutes.value = []
    selectRouteById(payload.routeId)
  }
  await startAnalysis()
}

function addToReport(point) {
  reportItems.value.push(point)
}
</script>

<style scoped>
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
.left-col {
  width: 260px;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}
.center-col {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
}
.right-col {
  width: 300px;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}
</style>
