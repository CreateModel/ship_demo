<template>
  <div class="left-panel">
    <div class="panel-header">
      <span class="panel-icon">⚓</span>
      <span>航运决策工作台</span>
    </div>

    <!-- Ship Selection -->
    <div class="section">
      <div class="section-title">选择船舶</div>
      <div
        v-for="ship in ships"
        :key="ship.id"
        class="ship-card"
        :class="{ active: selectedShip?.id === ship.id }"
        @click="$emit('selectShip', ship)"
      >
        <div class="ship-id">{{ ship.id }}</div>
        <div class="ship-info">
          <div class="ship-name">{{ ship.name }}</div>
          <div class="ship-meta">{{ ship.type }} · {{ ship.tonnage.toLocaleString() }}吨 · {{ ship.maxSpeed }}kn</div>
        </div>
      </div>
    </div>

    <!-- Route Selection -->
    <div class="section">
      <div class="section-title">选择候选航路</div>
      <div
        v-for="route in routesMeta"
        :key="route.id"
        class="route-card"
        :class="{ active: selectedRoutes.some(r => r.id === route.id) }"
        @click="$emit('toggleRoute', route)"
      >
        <div class="route-dot" :style="{ background: route.color }"></div>
        <div class="route-info">
          <div class="route-name">{{ route.name }}</div>
          <div class="route-label">{{ route.label }}</div>
          <div class="route-detail">
            <span>{{ route.distance }} nm</span>
            <span class="sep">·</span>
            <span>{{ route.speed }} kn</span>
            <span class="sep">·</span>
            <span>{{ route.direction }}</span>
          </div>
        </div>
        <div class="route-check" v-if="selectedRoutes.some(r => r.id === route.id)">✓</div>
      </div>
    </div>

    <!-- Route Summary Cards (after analysis) -->
    <div class="section" v-if="routeResults && Object.keys(routeResults).length">
      <div class="section-title">航路摘要</div>
      <div
        v-for="route in routesMeta.filter(r => routeResults[r.id])"
        :key="route.id"
        class="summary-card"
        :class="{ recommended: recommendation?.route?.id === route.id }"
      >
        <div class="summary-header">
          <span class="summary-dot" :style="{ background: route.color }"></span>
          <span class="summary-name">{{ route.name }}</span>
          <span class="rec-badge" v-if="recommendation?.route?.id === route.id">推荐</span>
        </div>
        <div class="summary-stats" v-if="riskSummary[route.id]">
          <div class="stat">
            <span class="stat-label">高风险点</span>
            <span class="stat-val red">{{ riskSummary[route.id].highRisk }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">峰值浪高</span>
            <span class="stat-val">{{ riskSummary[route.id].maxWave?.toFixed(1) }}m</span>
          </div>
          <div class="stat">
            <span class="stat-label">峰值风速</span>
            <span class="stat-val">{{ riskSummary[route.id].maxWind?.toFixed(1) }}m/s</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ships, routesMeta } from '../data/mockData.js'

defineProps({
  selectedShip: Object,
  selectedRoutes: Array,
  routeResults: Object,
  recommendation: Object,
  riskSummary: Object,
  isRunning: Boolean
})
defineEmits(['selectShip', 'toggleRoute'])
</script>

<style scoped>
.left-panel {
  width: 100%;
  height: 100%;
  background: rgba(5, 15, 35, 0.95);
  border-right: 1px solid #0d2a4a;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-bottom: 16px;
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
}

.panel-icon { font-size: 16px; }

.section {
  padding: 12px 14px;
  border-bottom: 1px solid #0a1e38;
}

.section-title {
  font-size: 11px;
  color: #4a7fa5;
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 10px;
}

.ship-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 6px;
  border: 1px solid #0d2a4a;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(13, 42, 74, 0.3);
}
.ship-card:hover { border-color: #1a5080; background: rgba(13, 42, 74, 0.6); }
.ship-card.active { border-color: #00d4ff; background: rgba(0, 212, 255, 0.08); }

.ship-id {
  font-size: 12px;
  font-weight: 700;
  color: #00d4ff;
  background: rgba(0, 212, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  min-width: 36px;
  text-align: center;
}

.ship-name { font-size: 13px; color: #c8dff0; margin-bottom: 2px; }
.ship-meta { font-size: 11px; color: #4a7fa5; }

.route-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 6px;
  border: 1px solid #0d2a4a;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(13, 42, 74, 0.3);
}
.route-card:hover { border-color: #1a5080; }
.route-card.active { border-color: #1a5080; background: rgba(13, 42, 74, 0.6); }

.route-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}

.route-name { font-size: 13px; color: #c8dff0; }
.route-label { font-size: 11px; color: #4a7fa5; }
.route-detail { font-size: 10px; color: #3a6a85; margin-top: 3px; }
.route-detail .sep { margin: 0 4px; opacity: 0.5; }
.route-check { margin-left: auto; color: #00ff88; font-size: 14px; }

.summary-card {
  border: 1px solid #0d2a4a;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
  background: rgba(13, 42, 74, 0.3);
  transition: all 0.2s;
}
.summary-card.recommended {
  border-color: #00ff88;
  background: rgba(0, 255, 136, 0.05);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.summary-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.summary-name { font-size: 13px; color: #c8dff0; flex: 1; }
.rec-badge {
  font-size: 10px;
  background: rgba(0, 255, 136, 0.15);
  color: #00ff88;
  border: 1px solid #00ff88;
  padding: 1px 6px;
  border-radius: 10px;
}

.summary-stats { display: flex; gap: 8px; }
.stat { flex: 1; text-align: center; }
.stat-label { display: block; font-size: 10px; color: #4a7fa5; margin-bottom: 2px; }
.stat-val { font-size: 13px; color: #c8dff0; font-weight: 600; }
.stat-val.red { color: #ff4444; }
</style>
