<template>
  <div class="map-container" ref="mapEl">
    <div class="map-overlay-label">3D 航线决策视图</div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import * as Cesium from 'cesium'
import { getRiskColor, routesMeta } from '../data/mockData.js'

const props = defineProps({
  routeResults: Object,
  selectedRoutes: Array,
  recommendation: Object,
  selectedShip: Object
})
const emit = defineEmits(['hoverPoint', 'clickPoint'])

const mapEl = ref(null)
let viewer = null
let hoverHandler = null
let drawRunId = 0

onMounted(() => {
  // 不使用 Ion token，直接用 OSM 底图
  viewer = new Cesium.Viewer(mapEl.value, {
    baseLayer: new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        credit: '© OpenStreetMap contributors'
      })
    ),
    timeline: false,
    animation: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider()
  })

  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a3a5f')

  hoverHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

  hoverHandler.setInputAction((movement) => {
    const picked = viewer.scene.pick(movement.endPosition)
    if (Cesium.defined(picked) && picked.id && picked.id._pointData) {
      emit('hoverPoint', picked.id._pointData)
    } else {
      emit('hoverPoint', null)
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

  hoverHandler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position)
    if (Cesium.defined(picked) && picked.id && picked.id._pointData) {
      emit('clickPoint', picked.id._pointData)
      const pt = picked.id._pointData
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, 800000),
        duration: 1.2
      })
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  // Watch inside onMounted so viewer is always ready
  watch([
    () => props.routeResults,
    () => props.selectedRoutes,
    () => props.selectedShip
  ], async ([results]) => {
    const runId = ++drawRunId
    viewer.entities.removeAll()
    const shipId = props.selectedShip?.id
    const displayDataMap = {}

    for (const route of (props.selectedRoutes || [])) {
      if (runId !== drawRunId) return

      const analyzedData = results?.[route.id]
      if (analyzedData) {
        drawRoute(route, analyzedData, true)
        displayDataMap[route.id] = analyzedData
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
        displayDataMap[route.id] = previewData
      }
    }

    fitToRoutes(displayDataMap)
  }, { deep: true, immediate: true })
})

onUnmounted(() => {
  hoverHandler?.destroy()
  viewer?.destroy()
})

const previewCache = new Map()

function drawRoute(route, data, analyzed = false) {
  const coords = data.coordinates || data.content || []
  if (coords.length < 2) return

  const meta = routesMeta.find(r => r.id === route.id)
  const baseColor = Cesium.Color.fromCssColorString(meta?.color || '#ffffff')

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1]
    if (!a.lon || !a.lat || !b.lon || !b.lat) continue
    const segColor = analyzed
      ? Cesium.Color.fromCssColorString(getRiskColor(a.weatherWarn))
      : Cesium.Color.fromCssColorString('#ffffff')

    viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([a.lon, a.lat, b.lon, b.lat]),
        width: analyzed ? 4 : 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: analyzed ? 0.12 : 0.08,
          color: segColor
        }),
        clampToGround: true
      }
    })
  }

  if (analyzed) {
    for (let i = 0; i < coords.length; i += 5) {
      const pt = coords[i]
      if (!pt.lon || !pt.lat) continue
      const riskColor = Cesium.Color.fromCssColorString(getRiskColor(pt.weatherWarn))
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(pt.lon, pt.lat, 0),
        point: {
          pixelSize: pt.weatherWarn >= 4 ? 9 : 5,
          color: riskColor,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
          outlineWidth: 1,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      })
      entity._pointData = { ...pt, routeId: route.id }
    }
  }

  // 起点标签
  const first = coords[0]
  if (first?.lon && first?.lat) {
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(first.lon, first.lat, 10000),
      label: {
        text: meta?.name || route.id,
        font: 'bold 14px sans-serif',
        fillColor: baseColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -20),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
      }
    })
  }
}

function fitToRoutes(dataMap = {}) {
  if (!props.selectedRoutes?.length) return
  const allCoords = []

  for (const route of props.selectedRoutes) {
    const data = dataMap[route.id]
    if (data?.coordinates) {
      for (const c of data.coordinates) {
        if (c.lon && c.lat) allCoords.push(Cesium.Cartesian3.fromDegrees(c.lon, c.lat))
      }
    }
  }

  if (allCoords.length === 0) return
  const sphere = Cesium.BoundingSphere.fromPoints(allCoords)
  viewer.camera.flyToBoundingSphere(sphere, {
    duration: 2,
    offset: new Cesium.HeadingPitchRange(0, -0.5, sphere.radius * 2.5)
  })
}
</script>

<style scoped>
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
