import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

const app = createApp(App)

// 全局错误捕获，显示在页面上方便调试
app.config.errorHandler = (err, instance, info) => {
  const div = document.createElement('div')
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:#ff0000;color:#fff;padding:12px 16px;font-size:13px;font-family:monospace;white-space:pre-wrap;max-height:200px;overflow:auto;'
  div.textContent = `[Vue Error] ${info}\n${err?.message}\n${err?.stack?.split('\n').slice(0,5).join('\n')}`
  document.body.appendChild(div)
  console.error('[Vue Error]', err, info)
}

app.mount('#app')
