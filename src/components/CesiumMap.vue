<template>
  <div class="map-container" ref="mapEl">
    <div class="map-overlay-label">3D 航线决策视图</div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { getRiskColor, routesMeta } from '../data/mockData.js'

const props = defineProps({
  routeResults: Object,
  selectedRoutes: Array,
  recommendation: Object,
  selectedShip: Object
})
const emit = defineEmits(['hoverPoint', 'clickPoint'])

const mapEl = ref(null)
let map = null
let drawRunId = 0
const previewCache = new Map()

// 所有已添加的 layer/source id，用于清除
const addedLayers = []
const addedSources = []

onMounted(() => {
  map = new maplibregl.Map({
    container: mapEl.value,
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['http://map.meteochina.com/tiles/googlesat/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© meteochina'
        }
      },
      layers: [
        { id: 'basemap', type: 'raster', source: 'basemap' }
      ]
    },
    center: [160, 35],
    zoom: 3,
    attributionControl: false
  })

  map.on('load', () => {
    // hover 事件
    map.on('mousemove', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: addedLayers.filter(l => l.startsWith('points-'))
      })
      if (features.length) {
        map.getCanvas().style.cursor = 'pointer'
        emit('hoverPoint', features[0].properties)
      } else {
        map.getCanvas().style.cursor = ''
        emit('hoverPoint', null)
      }
    })

    // click 事件
    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: addedLayers.filter(l => l.startsWith('points-'))
      })
      if (features.length) {
        const pt = features[0].properties
        emit('clickPoint', pt)
        map.flyTo({ center: [pt.lon, pt.lat], zoom: Math.max(map.getZoom(), 4), duration: 1200 })
      }
    })

    // watch 在 load 之后注册
    watch(
      [() => props.routeResults, () => props.selectedRoutes, () => props.selectedShip],
      async ([results]) => {
        const runId = ++drawRunId
        clearAllLayers()
        const shipId = props.selectedShip?.id
        const allCoords = []

        for (const route of (props.selectedRoutes || [])) {
          if (runId !== drawRunId) return
          const analyzedData = results?.[route.id]
          if (analyzedData) {
            drawRoute(route, analyzedData, true)
            for (const c of (analyzedData.coordinates || [])) {
              if (c.lon && c.lat) allCoords.push([c.lon, c.lat])
            }
            continue
          }

          const key = shipId ? `${shipId}_${route.id}` : `preview_${route.id}`
          let previewData = previewCache.get(key)
          if (!previewData) {
            try {
              const url = shipId
                ? `/data/${shipId}_Route_${route.id}.json`
                : `/data/Route_${route.id}.json`
              const res = await fetch(url)
              previewData = await res.json()
              previewCache.set(key, previewData)
            } catch (e) {
              console.warn('Failed to load preview data', e)
            }
          }
          if (runId !== drawRunId) return
          if (previewData) {
            drawRoute(route, previewData, false)
            const coords = previewData.coordinates || previewData.content || []
            for (const c of coords) {
              if (c.lon && c.lat) allCoords.push([c.lon, c.lat])
            }
          }
        }

        if (allCoords.length > 0) fitToCoords(allCoords)
      },
      { deep: true, immediate: true }
    )
  })
})

onUnmounted(() => {
  map?.remove()
})

function clearAllLayers() {
  for (const id of [...addedLayers]) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  for (const id of [...addedSources]) {
    if (map.getSource(id)) map.removeSource(id)
  }
  addedLayers.length = 0
  addedSources.length = 0
}

let _uid = 0
function uid(prefix) { return `${prefix}-${++_uid}` }

function addSource(id, data) {
  map.addSource(id, { type: 'geojson', data })
  addedSources.push(id)
}

function addLayer(layer) {
  map.addLayer(layer)
  addedLayers.push(layer.id)
}

function drawRoute(route, data, analyzed) {
  const coords = data.coordinates || data.content || []
  if (coords.length < 2) return
  const meta = routesMeta.find(r => r.id === route.id)
  const previewColor = meta?.color || '#ffffff'

  // 1. 航线线段（分段着色）
  const lineFeatures = []
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1]
    if (!a.lon || !a.lat || !b.lon || !b.lat) continue
    const color = analyzed ? getRiskColor(a.weatherWarn) : previewColor
    lineFeatures.push({
      type: 'Feature',
      properties: { color, analyzed: analyzed ? 1 : 0 },
      geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] }
    })
  }

  const lineSourceId = uid('line-src')
  const lineLayerId = uid('line-lyr')
  addSource(lineSourceId, { type: 'FeatureCollection', features: lineFeatures })
  addLayer({
    id: lineLayerId,
    type: 'line',
    source: lineSourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': analyzed ? 14 : 10,
      'line-opacity': analyzed ? 0.95 : 0.75
    }
  })

  // 2. 发光描边（叠在下面，略宽更淡）
  const glowLayerId = uid('glow-lyr')
  addLayer({
    id: glowLayerId,
    type: 'line',
    source: lineSourceId,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': analyzed ? 26 : 20,
      'line-opacity': analyzed ? 0.18 : 0.12,
      'line-blur': 6
    }
  })
  // 把发光层移到线段层下面
  map.moveLayer(glowLayerId, lineLayerId)

  // 3. 风险点（analyzed 时，每5点取一个）
  if (analyzed) {
    const pointFeatures = []
    for (let i = 0; i < coords.length; i += 5) {
      const pt = coords[i]
      if (!pt.lon || !pt.lat) continue
      pointFeatures.push({
        type: 'Feature',
        properties: {
          ...pt,
          riskColor: getRiskColor(pt.weatherWarn),
          size: pt.weatherWarn >= 4 ? 10 : 6
        },
        geometry: { type: 'Point', coordinates: [pt.lon, pt.lat] }
      })
    }
    const ptSourceId = uid('pt-src')
    const ptLayerId = uid(`points-${route.id}`)
    addSource(ptSourceId, { type: 'FeatureCollection', features: pointFeatures })
    addLayer({
      id: ptLayerId,
      type: 'circle',
      source: ptSourceId,
      paint: {
        'circle-radius': ['get', 'size'],
        'circle-color': ['get', 'riskColor'],
        'circle-stroke-color': 'rgba(255,255,255,0.6)',
        'circle-stroke-width': 1.5
      }
    })
  }

  // 4. 起点标签
  const first = coords[0]
  if (first?.lon && first?.lat) {
    const labelSourceId = uid('label-src')
    const labelLayerId = uid('label-lyr')
    addSource(labelSourceId, {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: meta?.name || route.id, color: previewColor },
        geometry: { type: 'Point', coordinates: [first.lon, first.lat] }
      }]
    })
    addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: labelSourceId,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 13,
        'text-offset': [0, -1.5],
        'text-anchor': 'bottom'
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#000',
        'text-halo-width': 2
      }
    })
  }
}

function fitToCoords(allCoords) {
  if (!allCoords.length) return
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const [lon, lat] of allCoords) {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 60, duration: 1800 })
}
</script>

<style scoped>
@import 'maplibre-gl/dist/maplibre-gl.css';

.map-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #1a3a5f;
}
.map-overlay-label {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 2px;
  pointer-events: none;
}
</style>
