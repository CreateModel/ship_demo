// Mock ship data
export const ships = [
  {
    id: 'A01',
    name: 'A01 远洋货轮',
    type: '散货船',
    length: 225,
    draft: 14.5,
    maxSpeed: 18,
    tonnage: 75000,
    flag: '中国'
  },
  {
    id: 'A02',
    name: 'A02 集装箱船',
    type: '集装箱船',
    length: 300,
    draft: 13.0,
    maxSpeed: 22,
    tonnage: 50000,
    flag: '巴拿马'
  },
  {
    id: 'A03',
    name: 'A03 油轮',
    type: '油轮',
    length: 250,
    draft: 16.0,
    maxSpeed: 15,
    tonnage: 100000,
    flag: '利比里亚'
  }
]

// Mock routes metadata
export const routesMeta = [
  {
    id: 'A',
    name: '航路1',
    label: '北太平洋航路',
    color: '#ffffff',
    distance: 1264,
    speed: 18,
    waypoints: 7,
    startCoord: '33.2°N 141.1°E',
    endCoord: '30.0°N 162.2°E',
    direction: '东行'
  },
  {
    id: 'B',
    name: '航路2',
    label: '中太平洋航路',
    color: '#ffffff',
    distance: 1105,
    speed: 18,
    waypoints: 7,
    startCoord: '34.5°N 159.0°E',
    endCoord: '33.8°N 136.8°E',
    direction: '西行'
  },
  {
    id: 'C',
    name: '航路3',
    label: '西北太平洋航路',
    color: '#ffffff',
    distance: 612,
    speed: 18,
    waypoints: 8,
    startCoord: '43.1°N 152.9°E',
    endCoord: '35.6°N 144.3°E',
    direction: '西南行'
  }
]

// Mock algorithm interface - returns route JSON based on ship + route selection
export async function callRouteAlgorithm(shipId, routeId) {
  // Simulate API delay
  await new Promise(r => setTimeout(r, 800 + Math.random() * 400))
  // Use ship-specific + route-specific algorithm output data
  const routeMap = { A: 'A', B: 'B', C: 'C' }
  const routeLetter = routeMap[routeId] || routeId
  const url = `/data/${shipId}_Route_${routeLetter}.json`
  const res = await fetch(url)
  return res.json()
}

// Mock visualization algorithm - returns chart image URL for a given route
export async function callVisualizationAlgorithm(routeId) {
  await new Promise(r => setTimeout(r, 600 + Math.random() * 300))
  // Returns the shared visualization image (simulates algorithm output)
  return '/src/assets/visualization.jpg'
}

// Risk level from weatherWarn
export function getRiskLevel(warn) {
  if (warn === null || warn === undefined) return { level: 0, label: '无数据', color: '#666' }
  if (warn >= 6) return { level: 4, label: '高风险', color: '#ff3333' }
  if (warn >= 4) return { level: 3, label: '中高风险', color: '#ff8800' }
  if (warn >= 2) return { level: 2, label: '中风险', color: '#ffcc00' }
  return { level: 1, label: '低风险', color: '#00cc66' }
}

export function getRiskColor(warn) {
  return getRiskLevel(warn).color
}

// Generate one-line risk explanation
export function getRiskExplanation(point) {
  const parts = []
  if (point.windSpeed && point.windSpeed > 15) parts.push(`风速偏高(${point.windSpeed.toFixed(1)}m/s)`)
  if (point.waveHeight && point.waveHeight > 3) parts.push(`浪高较大(${point.waveHeight.toFixed(1)}m)`)
  if (point.vis && point.vis < 5000) parts.push(`能见度低(${(point.vis/1000).toFixed(1)}km)`)
  if (point.liuSpeed && point.liuSpeed > 1.5) parts.push(`流速强(${point.liuSpeed.toFixed(1)}kn)`)
  if (parts.length === 0) return '气象条件良好，航行安全。'
  return `该段风险升高，主要由${parts.join('、')}叠加造成。`
}
