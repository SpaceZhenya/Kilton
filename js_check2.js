
;(function(){
'use strict'

// --- State ---
const STATE = {
  windows: [],
  zIndex: 100,
  winIdCounter: 0,
  focusedWin: null,
  startOpen: false,
  clockOpen: false,
  nextId: 1,
  maxId: 0,
}

// --- App Management ---
const VERSION_KEY = 'kilton_ver'
const INSTALLED_KEY = 'kilton_installed'
const REGISTERED_APPS = {}

// Auto-reset corrupted localStorage on version change
;(function() {
  const ver = '2.0'
  try {
    const old = localStorage.getItem(VERSION_KEY)
    if (old !== ver) {
      // Clean up old/corrupted keys
      const keys = ['kilton_installed', 'kilton_fs_default', 'kilton_notepad']
      keys.forEach(k => { try { localStorage.removeItem(k) } catch(e) {} })
      // Also clean per-user FS keys
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && key.startsWith('kilton_fs_')) {
          try { localStorage.removeItem(key) } catch(e) {}
        }
      }
      localStorage.setItem(VERSION_KEY, ver)
    }
  } catch(e) {}
  // Ensure installed key is valid
  try {
    const v = localStorage.getItem(INSTALLED_KEY)
    if (v) { JSON.parse(v) } // throws if invalid
    else localStorage.setItem(INSTALLED_KEY, '[]')
  } catch(e) {
    try { localStorage.setItem(INSTALLED_KEY, '[]') } catch(e2) {}
  }
})()

const BUILT_IN_APPS = [
  { id:'market',   ico:'рџ›’', label:'Kilton Market' },
  { id:'ai',       ico:'рџ¤–', label:'Kilton AI' },
  { id:'browser',  ico:'рџЊђ', label:'Browser' },
  { id:'explorer', ico:'рџ“Ѓ', label:'File Explorer' },
  { id:'computer', ico:'рџ’»', label:'Computer' },
  { id:'calculator',ico:'рџ”ў', label:'Calculator' },
  { id:'notepad',  ico:'рџ“ќ', label:'Notepad' },
  { id:'about',    ico:'в¬Ў', label:'About Kilton' },
]

const MARKET_APPS = [
  { id:'snake',    ico:'рџђЌ', label:'Snake Game',     desc:'Classic snake arcade game',  cat:'Games',   dev:'Kilton' },
  { id:'tetris',   ico:'рџ§±', label:'Tetris',          desc:'Stack blocks and clear lines',cat:'Games',   dev:'Kilton' },
  { id:'paint',    ico:'рџЋЁ', label:'Kilton Paint',    desc:'Simple drawing application',  cat:'Tools',   dev:'Kilton' },
  { id:'terminal', ico:'рџ’»', label:'Terminal',        desc:'Command line interface',      cat:'Tools',   dev:'Kilton' },
  { id:'music',    ico:'рџЋµ', label:'Music Player',    desc:'Play your uploaded music',    cat:'Media',   dev:'Kilton' },
  { id:'chat',     ico:'рџ’¬', label:'Kilton Chat',     desc:'Local messaging app',         cat:'Social',  dev:'Kilton' },
  { id:'settings', ico:'вљ™пёЏ', label:'Settings',        desc:'System preferences',          cat:'System',  dev:'Kilton' },
]

function getInstalledIds() {
  try { return JSON.parse(localStorage.getItem(INSTALLED_KEY)) || [] } catch(e) { return [] }
}

function saveInstalledIds(ids) {
  try { localStorage.setItem(INSTALLED_KEY, JSON.stringify(ids)) } catch(e) {}
}

function isInstalled(id) { return getInstalledIds().includes(id) }

function installApp(id) {
  const ids = getInstalledIds()
  if (!ids.includes(id)) { ids.push(id); saveInstalledIds(ids); rebuildDesktop(); showToast('Installed!') }
}

function uninstallApp(id) {
  const ids = getInstalledIds().filter(i => i !== id)
  saveInstalledIds(ids); rebuildDesktop(); showToast('Uninstalled')
}

function getAllDesktopApps() {
  const builtIn = BUILT_IN_APPS.map(a => ({ id:a.id, ico:a.ico, label:a.label }))
  const installed = getInstalledIds().map(id => {
    const m = MARKET_APPS.find(a => a.id === id)
    return m ? { id:m.id, ico:m.ico, label:m.label } : null
  }).filter(Boolean)
  return [...builtIn, ...installed]
}

function getAllStartApps() {
  const builtIn = BUILT_IN_APPS.map(a => ({ id:a.id, ico:a.ico, name:a.label }))
  const installed = getInstalledIds().map(id => {
    const m = MARKET_APPS.find(a => a.id === id)
    return m ? { id:m.id, ico:m.ico, name:m.label } : null
  }).filter(Boolean)
  return [...builtIn, ...installed]
}

function rebuildDesktop() {
  initDesktop()
  initStartMenu()
}

// --- Desktop ---
function initDesktop() {
  const container = document.getElementById('desktopIcons')
  container.innerHTML = ''
  // App shortcuts
  getAllDesktopApps().forEach(a => {
    const el = document.createElement('div')
    el.className = 'deskIcon'
    el.innerHTML = `<div class="icon">${a.ico}</div><div class="label">${a.label}</div>`
    el.addEventListener('dblclick', () => launchApp(a.id))
    container.appendChild(el)
  })
  // Desktop files/folders
  const desktopFiles = listDir('Desktop')
  desktopFiles.forEach(f => {
    const el = document.createElement('div')
    el.className = 'deskIcon'
    const ico = f.type === 'folder' ? 'рџ“Ѓ' : getFileIcon(f.type, f.name)
    el.innerHTML = `<div class="icon">${ico}</div><div class="label">${f.name}</div>`
    el.addEventListener('dblclick', () => {
      if (f.type === 'folder') launchExplorer('Desktop/' + f.name)
      else openFile('Desktop', f.name)
    })
    el.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation(); showFileContextMenu(e.clientX, e.clientY, 'Desktop', f.name)
    })
    container.appendChild(el)
  })
  container.addEventListener('contextmenu', e => {
    e.preventDefault()
    if (e.target === container || e.target === document.getElementById('desktop')) {
      showContextMenu(e.clientX, e.clientY)
    }
  })
}

// --- Background Canvas ---
function initBgCanvas() {
  const canvas = document.getElementById('bgCanvas')
  const ctx = canvas.getContext('2d')
  let w = canvas.width = window.innerWidth
  let h = canvas.height = window.innerHeight - 40
  const stars = Array.from({length:120},()=>({
    x:Math.random()*w, y:Math.random()*h, r:Math.random()*.8+.3,
    a:Math.random()*.6+.2, s:Math.random()*.003+.001
  }))
  function draw(ts) {
    ctx.clearRect(0,0,w,h)
    stars.forEach(s => {
      s.a = .3 + .4 * Math.sin(ts * s.s + s.x)
      ctx.beginPath()
      ctx.arc(s.x,s.y,s.r,0,Math.PI*2)
      ctx.fillStyle = `rgba(255,255,255,${s.a})`
      ctx.fill()
    })
  }
  let anim
  function loop(ts) { draw(ts); anim = requestAnimationFrame(loop) }
  anim = requestAnimationFrame(loop)
  window.addEventListener('resize', () => {
    w = canvas.width = window.innerWidth
    h = canvas.height = window.innerHeight - 40
  })
}

// --- Window Manager ---
function createWindow(opts) {
  const id = STATE.winIdCounter++
  const win = {
    id,
    title: opts.title || 'Window',
    icon: opts.icon || 'рџ“„',
    width: opts.width || 500,
    height: opts.height || 400,
    x: opts.x || 100 + (id % 5) * 30,
    y: opts.y || 40 + (id % 5) * 30,
    minWidth: opts.minWidth || 250,
    minHeight: opts.minHeight || 150,
    content: opts.content || '',
    onclose: opts.onclose || null,
    el: null,
    contentEl: null,
    state: 'normal', // normal | minimized | maximized
    prevRect: null,
  }

  const el = document.createElement('div')
  el.className = 'window'
  el.style.width = win.width + 'px'
  el.style.height = win.height + 'px'
  el.style.left = win.x + 'px'
  el.style.top = win.y + 'px'
  el.style.zIndex = ++STATE.zIndex
  el.dataset.winId = id

  // Title bar
  const tb = document.createElement('div')
  tb.className = 'window-titlebar'
  tb.innerHTML = `<span class="winIcon">${win.icon}</span><span class="winTitle">${win.title}</span>`

  // Buttons
  const btnMin = makeBtn('в”Ђ', () => minimizeWindow(id))
  const btnMax = makeBtn('вђ', () => maximizeWindow(id))
  const btnClose = makeBtn('вњ•', () => closeWindow(id))
  btnClose.className = 'winBtn close'
  tb.appendChild(btnMin)
  tb.appendChild(btnMax)
  tb.appendChild(btnClose)
  el.appendChild(tb)

  // Content
  const content = document.createElement('div')
  content.className = 'window-content'
  if (typeof win.content === 'string') content.innerHTML = win.content
  else content.appendChild(win.content)
  el.appendChild(content)

  // Resize handles
  const handles = ['n','s','e','w','ne','nw','se','sw']
  handles.forEach(h => {
    const r = document.createElement('div')
    r.className = 'resizeHandle ' + h
    el.appendChild(r)
  })

  document.body.appendChild(el)

  win.el = el
  win.contentEl = content

  // Events
  el.addEventListener('mousedown', () => focusWindow(id))

  // Drag
  let drag = false, dragOffX, dragOffY
  tb.addEventListener('mousedown', e => {
    if (e.target.closest('.winBtn')) return
    if (win.state === 'maximized') return
    drag = true; dragOffX = e.clientX - win.x; dragOffY = e.clientY - win.y
    e.preventDefault()
  })

  // Double click title to maximize/restore
  tb.addEventListener('dblclick', () => {
    if (win.state === 'maximized') restoreWindow(id)
    else maximizeWindow(id)
  })

  // Resize
  handles.forEach(h => {
    const r = el.querySelector('.resizeHandle.' + h)
    r.addEventListener('mousedown', e => {
      e.stopPropagation()
      if (win.state === 'maximized') return
      const startX = e.clientX, startY = e.clientY
      const startW = win.width, startH = win.height
      const startL = win.x, startT = win.y
      function onMove(ev) {
        const dx = ev.clientX - startX, dy = ev.clientY - startY
        let nw = startW, nh = startH, nl = startL, nt = startT
        if (h.includes('e')) nw = Math.max(win.minWidth, startW + dx)
        if (h.includes('w')) { nw = Math.max(win.minWidth, startW - dx); nl = startL + (startW - nw) }
        if (h.includes('s')) nh = Math.max(win.minHeight, startH + dy)
        if (h.includes('n')) { nh = Math.max(win.minHeight, startH - dy); nt = startT + (startH - nh) }
        win.x = nl; win.y = nt; win.width = nw; win.height = nh
        el.style.left = nl + 'px'; el.style.top = nt + 'px'
        el.style.width = nw + 'px'; el.style.height = nh + 'px'
      }
      function onUp() { document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
      document.addEventListener('mousemove',onMove)
      document.addEventListener('mouseup',onUp)
      e.preventDefault()
    })
  })

  document.addEventListener('mousemove', e => {
    if (!drag) return
    win.x = e.clientX - dragOffX; win.y = e.clientY - dragOffY
    el.style.left = win.x + 'px'; el.style.top = win.y + 'px'
  })
  document.addEventListener('mouseup', () => { drag = false })

  focusWindow(id)
  STATE.windows.push(win)
  updateTaskbar()

  return win
}

function makeBtn(label, fn) {
  const b = document.createElement('button')
  b.className = 'winBtn'
  b.textContent = label
  b.addEventListener('click', fn)
  return b
}

function focusWindow(id) {
  const win = STATE.windows.find(w => w.id === id)
  if (!win) return
  STATE.zIndex++
  win.el.style.zIndex = STATE.zIndex
  STATE.windows.forEach(w => w.el.classList.remove('focused'))
  win.el.classList.add('focused')
  STATE.focusedWin = id
  updateTaskbar()
}

function minimizeWindow(id) {
  const win = STATE.windows.find(w => w.id === id)
  if (!win) return
  win.state = 'minimized'
  win.el.classList.add('minimized')
  // Find next window to focus
  const visible = STATE.windows.filter(w => w.state !== 'minimized')
  if (visible.length > 0) focusWindow(visible[visible.length-1].id)
  updateTaskbar()
}

function maximizeWindow(id) {
  const win = STATE.windows.find(w => w.id === id)
  if (!win) return
  if (win.state === 'maximized') { restoreWindow(id); return }
  win.prevRect = { x: win.x, y: win.y, width: win.width, height: win.height }
  win.state = 'maximized'
  win.el.classList.add('maximized')
  focusWindow(id)
  updateTaskbar()
}

function restoreWindow(id) {
  const win = STATE.windows.find(w => w.id === id)
  if (!win) return
  if (win.state === 'minimized') {
    win.state = 'normal'
    win.el.classList.remove('minimized')
    focusWindow(id)
    updateTaskbar()
    return
  }
  if (win.prevRect) {
    win.x = win.prevRect.x; win.y = win.prevRect.y
    win.width = win.prevRect.width; win.height = win.prevRect.height
    win.el.style.left = win.x + 'px'; win.el.style.top = win.y + 'px'
    win.el.style.width = win.width + 'px'; win.el.style.height = win.height + 'px'
  }
  win.state = 'normal'
  win.el.classList.remove('maximized')
  focusWindow(id)
  updateTaskbar()
}

function closeWindow(id) {
  const win = STATE.windows.find(w => w.id === id)
  if (!win) return
  if (win.onclose) win.onclose()
  win.el.remove()
  STATE.windows = STATE.windows.filter(w => w.id !== id)
  if (STATE.focusedWin === id) {
    const last = STATE.windows[STATE.windows.length-1]
    STATE.focusedWin = last ? last.id : null
    if (last) last.el.classList.add('focused')
  }
  updateTaskbar()
}

function closeAllWindows() {
  STATE.windows.slice().forEach(w => closeWindow(w.id))
}

// --- Taskbar ---
function updateTaskbar() {
  const container = document.getElementById('taskbarWindows')
  container.innerHTML = ''
  STATE.windows.forEach(win => {
    const btn = document.createElement('button')
    btn.className = 'tbWin' + (win.id === STATE.focusedWin ? ' active' : '')
    btn.innerHTML = `<span class="ico">${win.icon}</span>${win.title}`
    btn.addEventListener('click', () => {
      if (win.state === 'minimized') restoreWindow(win.id)
      else if (win.id === STATE.focusedWin) minimizeWindow(win.id)
      else focusWindow(win.id)
    })
    container.appendChild(btn)
  })
}

// --- Start Menu ---
function toggleStartMenu() {
  STATE.startOpen = !STATE.startOpen
  document.getElementById('startMenu').classList.toggle('open', STATE.startOpen)
  if (STATE.startOpen && STATE.clockOpen) toggleClockPopup()
}

function initStartMenu() {
  const container = document.getElementById('startApps')
  container.innerHTML = ''
  getAllStartApps().forEach(a => {
    const btn = document.createElement('button')
    btn.className = 'startApp'
    btn.innerHTML = `<span class="ico">${a.ico}</span>${a.name}`
    btn.addEventListener('click', () => { toggleStartMenu(); launchApp(a.id) })
    container.appendChild(btn)
  })

  document.getElementById('powerBtn').addEventListener('click', () => {
    toggleStartMenu()
    showToast('Shutting down...')
    setTimeout(() => {
      closeAllWindows()
      showToast('Ready to close tab')
    }, 500)
  })
  document.getElementById('lockBtn').addEventListener('click', () => {
    toggleStartMenu()
    clearSession()
    closeAllWindows()
    document.getElementById('loginScreen').classList.remove('hidden')
    document.getElementById('loginUser').value = ''
    document.getElementById('loginPass').value = ''
    document.getElementById('loginError').textContent = ''
    document.getElementById('loginUser').focus()
  })
}

// --- Market App Launcher ---
function launchMarketApp(app) {
  switch(app.id) {
    case 'snake': launchSnake(); break
    case 'tetris': launchTetris(); break
    case 'paint': launchPaint(); break
    case 'terminal': launchTerminal(); break
    case 'music': launchMusicPlayer(); break
    case 'chat': launchChat(); break
    case 'settings': launchSettings(); break
    default:
      const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;gap:16px;text-align:center'
      d.innerHTML = `<div style="font-size:48px">${app.ico}</div><div style="font-size:18px;font-weight:500;color:#fff">${app.label}</div><div style="color:#888;font-size:13px;max-width:300px;line-height:1.5">${app.desc}</div><div style="color:#555;font-size:11px">by ${app.dev} В· ${app.cat}</div>`
      createWindow({title:app.label, icon:app.ico, width:360, height:260, minWidth:280, minHeight:200, content:d})
  }
}

function launchSnake() {
  const G=20,SZ=15;const c=document.createElement('canvas');c.width=G*SZ;c.height=G*SZ+20;c.style.cssText='display:block;margin:auto;background:#111'
  const ctx=c.getContext('2d');const w=createWindow({title:'Snake Game',icon:'рџђЌ',width:G*SZ+20,height:G*SZ+80,minWidth:300,minHeight:340,content:c})
  let snake=[{x:5,y:5}],dir={x:1,y:0},food={x:10,y:5},nextDir={x:1,y:0},score=0,high=parseInt(localStorage.getItem('kilton_snake_high')||'0'),dead=false,paused=false,speed=150
  function placeFood(){food={x:Math.floor(Math.random()*G),y:Math.floor(Math.random()*G)};if(snake.some(s=>s.x===food.x&&s.y===food.y))placeFood()}
  function step(){
    if(dead||paused)return
    dir={...nextDir};const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y}
    if(head.x<0||head.x>=G||head.y<0||head.y>=G||snake.some(s=>s.x===head.x&&s.y===head.y)){dead=true;if(score>high){high=score;localStorage.setItem('kilton_snake_high',String(high))}draw();return}
    snake.unshift(head)
    if(head.x===food.x&&head.y===food.y){score+=10;speed=Math.max(60,150-score);placeFood()}else snake.pop()
    clearInterval(w._interval);w._interval=setInterval(step,speed)
    draw()
  }
  function draw(){
    ctx.fillStyle='#111';ctx.fillRect(0,0,c.width,c.height)
    // Grid
    ctx.strokeStyle='rgba(255,255,255,.03)';for(let i=0;i<=G;i++){ctx.beginPath();ctx.moveTo(i*SZ,0);ctx.lineTo(i*SZ,G*SZ);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*SZ);ctx.lineTo(G*SZ,i*SZ);ctx.stroke()}
    // Snake
    snake.forEach((s,i)=>{const t=i/snake.length;ctx.fillStyle=`hsl(${120-t*40},${60+40*t}%,${40+20*t}%)`;ctx.shadowColor=i===0?'#0f0':'transparent';ctx.shadowBlur=i===0?8:0;ctx.beginPath();ctx.roundRect(s.x*SZ+1,s.y*SZ+1,SZ-2,SZ-2,3);ctx.fill()});ctx.shadowBlur=0
    // Food
    ctx.fillStyle='#f44';ctx.shadowColor='#f44';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(food.x*SZ+SZ/2,food.y*SZ+SZ/2,SZ/2-1,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0
    // Score
    ctx.fillStyle='#888';ctx.font='11px sans-serif';ctx.fillText('Score: '+score+'  Best: '+high,5,G*SZ+14)
    ctx.fillStyle='#555';ctx.font='9px sans-serif';ctx.fillText('Space:pause R:restart',c.width-110,G*SZ+14)
    if(paused&&!dead){ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,c.width,G*SZ);ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText('PAUSED',c.width/2-40,G*SZ/2-4)}
    if(dead){ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(0,0,c.width,G*SZ);ctx.fillStyle='#f88';ctx.font='22px sans-serif';ctx.fillText('Game Over',c.width/2-65,G*SZ/2-10);ctx.fillStyle='#aaa';ctx.font='12px sans-serif';ctx.fillText('Score: '+score+'  Best: '+high,c.width/2-55,G*SZ/2+14);ctx.fillStyle='#888';ctx.font='11px sans-serif';ctx.fillText('Click / Press R to restart',c.width/2-75,G*SZ/2+34)}
  }
  document.addEventListener('keydown',function handler(e){
    if(w.state==='minimized')return
    if(e.key===' '||e.key==='Escape'){e.preventDefault();if(!dead)paused=!paused;draw();return}
    if(e.key==='r'||e.key==='R'){if(dead||true){snake=[{x:5,y:5}];dir={x:1,y:0};nextDir={x:1,y:0};score=0;dead=false;paused=false;speed=150;clearInterval(w._interval);w._interval=setInterval(step,speed);placeFood();draw()};return}
    const k=e.key;const opp={ArrowUp:'ArrowDown',ArrowDown:'ArrowUp',ArrowLeft:'ArrowRight',ArrowRight:'ArrowLeft'}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)&&dir.x!=={ArrowUp:0,ArrowDown:0,ArrowLeft:-1,ArrowRight:1}[opp[k]]){e.preventDefault();nextDir={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}}[k]}
  })
  c.addEventListener('click',()=>{if(dead){snake=[{x:5,y:5}];dir={x:1,y:0};nextDir={x:1,y:0};score=0;dead=false;paused=false;speed=150;clearInterval(w._interval);w._interval=setInterval(step,speed);placeFood();draw()}})
  // Touch controls
  let tx=0,ty=0;c.addEventListener('touchstart',e=>{const t=e.touches[0];tx=t.clientX;ty=t.clientY})
  c.addEventListener('touchend',e=>{if(dead){c.click();return}const t=e.changedTouches[0];const dx=t.clientX-tx,dy=t.clientY-ty;if(Math.abs(dx)>Math.abs(dy)){if(dx>0&&dir.x!==-1)nextDir={x:1,y:0}else if(dx<0&&dir.x!==1)nextDir={x:-1,y:0}}else{if(dy>0&&dir.y!==-1)nextDir={x:0,y:1}else if(dy<0&&dir.y!==1)nextDir={x:0,y:-1}}})
  placeFood();draw();w._interval=setInterval(step,speed)
}

function launchTetris() {
  const COLS=10,ROWS=20,BS=24,SIDE=140
  const c=document.createElement('canvas');c.width=COLS*BS+SIDE;c.height=ROWS*BS;c.style.cssText='display:block;margin:auto;background:#111'
  const ctx=c.getContext('2d');const w=createWindow({title:'Tetris',icon:'рџ§±',width:COLS*BS+SIDE+20,height:ROWS*BS+45,minWidth:380,minHeight:460,content:c})
  const COLORS=['#00f0f0','#f0f000','#a000f0','#0000f0','#f0a000','#00f000','#f00000']
  const PIECES=[[[1,1,1,1]],[[1,1],[1,1]],[[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[1,0],[1,1],[0,1]],[[0,1],[1,1],[1,0]],[[1,1,1],[0,1,0]]]
  let board=Array.from({length:ROWS},()=>Array(COLS).fill(0))
  let piece={shape:PIECES[0],x:3,y:0},next=PIECES[Math.floor(Math.random()*PIECES.length)],score=0,lines=0,level=1,dead=false,paused=false
  let high=parseInt(localStorage.getItem('kilton_tetris_high')||'0')
  function ghostY(){let p={...piece};while(!collides({shape:p.shape,x:p.x,y:p.y+1}))p.y++;return p.y}
  function newPiece(){piece={shape:next,x:(COLS-next[0].length)/2|0,y:0};next=PIECES[Math.floor(Math.random()*PIECES.length)];if(collides(piece))dead=true}
  function collides(p){return p.shape.some((r,dy)=>r.some((v,dx)=>v&&(p.x+dx<0||p.x+dx>=COLS||p.y+dy>=ROWS||(p.y+dy>=0&&board[p.y+dy][p.x+dx]))))}
  function lock(){
    piece.shape.forEach((r,dy)=>r.forEach((v,dx)=>{if(v&&piece.y+dy>=0)board[piece.y+dy][piece.x+dx]=1}))
    let cleared=0;for(let y=ROWS-1;y>=0;y--){if(board[y].every(v=>v)){board.splice(y,1);board.unshift(Array(COLS).fill(0));y++;cleared++}}
    if(cleared){lines+=cleared;const pts=[0,100,300,500,800];score+=pts[Math.min(cleared,4)]*level;level=Math.floor(lines/10)+1}
    if(score>high){high=score;localStorage.setItem('kilton_tetris_high',String(high))}
    newPiece()
  }
  function move(dx,dy){const p2={...piece,x:piece.x+dx,y:piece.y+dy};if(!collides(p2))piece=p2;else if(dy)lock()}
  function rotate(){const sh=piece.shape[0].map((_,i)=>piece.shape.map(r=>r[i]).reverse());const p2={...piece,shape:sh};if(!collides(p2))piece=p2}
  function hardDrop(){while(!collides({shape:piece.shape,x:piece.x,y:piece.y+1}))piece.y++;lock()}
  function draw(){
    ctx.fillStyle='#111';ctx.fillRect(0,0,c.width,c.height)
    // Board
    board.forEach((r,y)=>r.forEach((v,x)=>{if(v){ctx.fillStyle=COLORS[v-1]||'#4488ff';ctx.shadowColor=COLORS[v-1]||'#4488ff';ctx.shadowBlur=4;ctx.fillRect(x*BS,y*BS,BS-1,BS-1);ctx.shadowBlur=0}}))
    // Ghost
    const gy=ghostY();if(!dead){ctx.globalAlpha=.2;piece.shape.forEach((r,dy)=>r.forEach((v,dx)=>{if(v){ctx.fillStyle=COLORS[PIECES.indexOf(piece.shape)]||'#66aaff';ctx.fillRect((piece.x+dx)*BS,(gy+dy)*BS,BS-1,BS-1)}}));ctx.globalAlpha=1}
    // Piece
    if(!dead)piece.shape.forEach((r,dy)=>r.forEach((v,dx)=>{if(v){ctx.fillStyle=COLORS[PIECES.indexOf(piece.shape)]||'#66aaff';ctx.shadowColor=COLORS[PIECES.indexOf(piece.shape)]||'#66aaff';ctx.shadowBlur=6;ctx.fillRect((piece.x+dx)*BS,(piece.y+dy)*BS,BS-1,BS-1);ctx.shadowBlur=0}}))
    // Grid
    ctx.strokeStyle='rgba(255,255,255,.03)';for(let i=0;i<=COLS;i++){ctx.beginPath();ctx.moveTo(i*BS,0);ctx.lineTo(i*BS,ROWS*BS);ctx.stroke()}
    for(let i=0;i<=ROWS;i++){ctx.beginPath();ctx.moveTo(0,i*BS);ctx.lineTo(COLS*BS,i*BS);ctx.stroke()}
    // Side panel
    const sx=COLS*BS+10
    ctx.fillStyle='#888';ctx.font='11px sans-serif';ctx.fillText('SCORE',sx,18);ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(String(score),sx,38)
    ctx.fillStyle='#888';ctx.font='11px sans-serif';ctx.fillText('HIGH',sx,65);ctx.fillStyle='#ff0';ctx.font='14px sans-serif';ctx.fillText(String(high),sx,82)
    ctx.fillStyle='#888';ctx.font='11px sans-serif';ctx.fillText('LEVEL',sx,108);ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText(String(level),sx,125)
    ctx.fillStyle='#888';ctx.font='11px sans-serif';ctx.fillText('LINES',sx,150);ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText(String(lines),sx,167)
    ctx.fillStyle='#555';ctx.font='10px sans-serif';ctx.fillText('NEXT',sx,200)
    if(next){next.forEach((r,dy)=>r.forEach((v,dx)=>{if(v){ctx.fillStyle=COLORS[PIECES.indexOf(next)]||'#66aaff';ctx.fillRect(sx+dx*16+20,205+dy*16,14,14)}}))}
    // Controls help
    ctx.fillStyle='#444';ctx.font='9px sans-serif';const hx=sx;const hy=ROWS*BS-80
    const helps=['в†ђв†’ Move','в†‘ Rotate','в†“ Soft','Space Hard','P Pause','R Restart'];helps.forEach((h,i)=>{ctx.fillText(h,hx,hy+i*14)})
    // Overlays
    if(paused&&!dead){ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(0,0,COLS*BS,ROWS*BS);ctx.fillStyle='#fff';ctx.font='22px sans-serif';ctx.fillText('PAUSED',COLS*BS/2-48,ROWS*BS/2-4)}
    if(dead){ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(0,0,COLS*BS,ROWS*BS);ctx.fillStyle='#f88';ctx.font='24px sans-serif';ctx.fillText('GAME OVER',COLS*BS/2-70,ROWS*BS/2-14);ctx.fillStyle='#aaa';ctx.font='12px sans-serif';ctx.fillText('Score: '+score+'  Best: '+high,COLS*BS/2-55,ROWS*BS/2+12);ctx.fillStyle='#888';ctx.font='11px sans-serif';ctx.fillText('Press R to restart',COLS*BS/2-55,ROWS*BS/2+32)}
  }
  newPiece();draw()
  const speed=()=>Math.max(50,400-level*25)
  document.addEventListener('keydown',function handler(e){
    if(w.state==='minimized')return
    if(e.key==='p'||e.key==='P'){if(!dead){paused=!paused;draw()}return}
    if(e.key==='r'||e.key==='R'){board=Array.from({length:ROWS},()=>Array(COLS).fill(0));score=0;lines=0;level=1;dead=false;paused=false;newPiece();clearInterval(w._interval);w._interval=setInterval(step,speed());draw();return}
    if(dead||paused)return
    if(e.key==='ArrowLeft')move(-1,0)
    else if(e.key==='ArrowRight')move(1,0)
    else if(e.key==='ArrowDown')move(0,1)
    else if(e.key==='ArrowUp')rotate()
    else if(e.key===' '||e.key==='Space'){e.preventDefault();hardDrop()}
    else return
    e.preventDefault();draw()
  })
  function step(){if(!dead&&!paused){move(0,1);draw()}}
  w._interval=setInterval(step,speed())
}

function launchPaint() {
  const c = document.createElement('canvas'); c.width=400; c.height=300; c.style.cssText='display:block;margin:auto;background:#fff;cursor:crosshair'
  const ctx = c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,400,300)
  const w = createWindow({title:'Kilton Paint', icon:'рџЋЁ', width:440, height:400, minWidth:380, minHeight:340, content:c})
  let drawing=false, color='#000', size=3
  const tbar = document.createElement('div'); tbar.style.cssText='display:flex;gap:4px;padding:4px;flex-wrap:wrap;flex-shrink:0'
  const colors=['#000','#f44','#fa0','#ff0','#0a0','#08f','#a0f','#fff','#888','#faa','#fc8','#ff8','#8f8','#8cf','#c8f']
  colors.forEach(c2=>{const b=document.createElement('button');b.style.cssText=`width:18px;height:18px;border:1px solid #555;border-radius:3px;background:${c2};cursor:pointer`;b.addEventListener('click',()=>color=c2);tbar.appendChild(b)})
  tbar.appendChild(document.createTextNode(' '))
  const sizes=[1,3,6];sizes.forEach(s=>{const b=document.createElement('button');b.textContent='в¬¤';b.style.cssText=`font-size:${s*4+8}px;border:none;background:transparent;color:#aaa;cursor:pointer;padding:0 2px`;b.addEventListener('click',()=>size=s);tbar.appendChild(b)})
  const clr=document.createElement('button');clr.textContent='рџ—‘пёЏ';clr.style.cssText='border:none;background:transparent;cursor:pointer;font-size:14px;margin-left:auto';clr.addEventListener('click',()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,400,300)});tbar.appendChild(clr)
  w.contentEl.parentNode.insertBefore(tbar,w.contentEl); c.parentNode.style.borderRadius='0 0 7px 7px'
  function pos(e){const r=c.getBoundingClientRect();return{x:(e.clientX||e.touches[0].clientX)-r.left,y:(e.clientY||e.touches[0].clientY)-r.top}}
  c.addEventListener('mousedown',e=>{drawing=true;const p=pos(e);ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.fill()})
  c.addEventListener('mousemove',e=>{if(!drawing)return;const p=pos(e);ctx.fillStyle=color;ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.fill()})
  c.addEventListener('mouseup',()=>drawing=false);c.addEventListener('mouseleave',()=>drawing=false)
}

function launchTerminal() {
  const d = document.createElement('div'); d.style.cssText='display:flex;flex-direction:column;height:100%'
  const out = document.createElement('div'); out.style.cssText='flex:1;overflow-y:auto;padding:8px;font-family:monospace;font-size:13px;color:#0f0;background:#000;line-height:1.4;white-space:pre-wrap'
  const inp = document.createElement('div'); inp.style.cssText='display:flex;padding:4px 8px;border-top:1px solid #333;background:#000'
  const prompt = document.createElement('span'); prompt.textContent='$ '; prompt.style.cssText='color:#0f0;font-family:monospace;font-size:13px'
  const input = document.createElement('input'); input.style.cssText='flex:1;border:none;outline:none;background:transparent;color:#0f0;font-family:monospace;font-size:13px'; input.autofocus=true
  inp.appendChild(prompt); inp.appendChild(input); d.appendChild(out); d.appendChild(inp)
  const w = createWindow({title:'Terminal', icon:'рџ’»', width:520, height:360, minWidth:350, minHeight:250, content:d})
  out.innerHTML = 'Kilton Terminal v1.0<br>Type `help` for commands.<br>'
  function write(t){out.innerHTML+=t+'<br>';out.scrollTop=out.scrollHeight}
  const cmds={help:'Commands: help, echo, date, whoami, ls, uname, clear, neofetch',echo:args=>args||'',date:()=>new Date().toString(),whoami:()=>currentUser||'user',uname:()=>'Kilton OS 1.0',neofetch:()=>'Kilton OS 1.0
Kernel: Kilton
Shell: built-in
User: '+(currentUser||'user')+'
Apps: '+(BUILT_IN_APPS.length+getInstalledIds().length),ls:()=>{const f=listDir('Desktop');return f.length?f.map(x=>x.name).join('<br>'):'(empty)'},clear:()=>{out.innerHTML=''}}
  input.addEventListener('keydown',e=>{if(e.key!=='Enter')return;const full=input.value;input.value='';write('$ '+full);const parts=full.trim().split(/\s+/);const cmd=parts[0].toLowerCase();const args=parts.slice(1).join(' ');if(cmd in cmds){const r=cmds[cmd](args);if(r!==undefined)write(r)}else if(cmd)write('Command not found: '+cmd)})
}

function launchMusicPlayer() {
  const d=document.createElement('div');d.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:30px;gap:12px;text-align:center'
  const input=document.createElement('input');input.type='file';input.accept='audio/*';input.style.cssText='display:none';d.appendChild(input)
  d.innerHTML+=`<div style="font-size:40px">рџЋµ</div><div style="font-size:16px;color:#aaa">Upload music to play</div><div style="font-size:12px;color:#666">Supports MP3, WAV, OGG</div><button id="mpUpload" style="padding:8px 20px;border:none;border-radius:6px;background:rgba(0,120,215,.5);color:#fff;cursor:pointer;font-size:13px">Choose File</button><div id="mpStatus" style="font-size:11px;color:#555;margin-top:8px"></div>`
  createWindow({title:'Music Player', icon:'рџЋµ', width:340, height:360, minWidth:280, minHeight:300, content:d})
  d.querySelector('#mpUpload').addEventListener('click',()=>input.click())
  input.addEventListener('change',()=>{const file=input.files[0];if(!file)return;const url=URL.createObjectURL(file);const au=document.createElement('audio');au.src=url;au.controls=true;au.style.cssText='width:80%;margin:8px 0';d.querySelector('#mpStatus').textContent='Playing: '+file.name;d.appendChild(au);au.play()})
}

function launchChat() {
  const d=document.createElement('div');d.style.cssText='display:flex;flex-direction:column;height:100%'
  const msgs=document.createElement('div');msgs.style.cssText='flex:1;overflow-y:auto;padding:8px;font-size:13px;line-height:1.5'
  const bot=['Hello!','How are you?','Nice to chat!','What are you working on?','I like your desktop setup!','Want to play a game? Open Snake!','Check the weather!','Try the Calculator app!','рџЉ','рџ‘Ќ']
  msgs.innerHTML='<div style="color:#888;margin-bottom:8px;font-size:11px">Kilton Chat - Local mode</div>'
  const inp=document.createElement('div');inp.style.cssText='display:flex;gap:6px;padding:6px 8px;border-top:1px solid rgba(255,255,255,.06)'
  const input=document.createElement('input');input.style.cssText='flex:1;padding:6px 10px;border:none;border-radius:16px;background:rgba(255,255,255,.06);color:#fff;outline:none;font-size:13px';input.placeholder='Type a message...'
  const btn=document.createElement('button');btn.textContent='Send';btn.style.cssText='padding:6px 14px;border:none;border-radius:16px;background:linear-gradient(135deg,#6a11cb,#2575fc);color:#fff;cursor:pointer;font-size:12px'
  inp.appendChild(input);inp.appendChild(btn);d.appendChild(msgs);d.appendChild(inp)
  createWindow({title:'Kilton Chat', icon:'рџ’¬', width:360, height:400, minWidth:300, minHeight:300, content:d})
  function addMsg(who,text){const el=document.createElement('div');el.innerHTML=`<b style="color:${who==='You'?'#8af':'#f8a'}">${who}:</b> ${text}`;msgs.appendChild(el);msgs.scrollTop=msgs.scrollHeight}
  btn.addEventListener('click',()=>{const t=input.value.trim();if(!t)return;addMsg('You',t);input.value='';setTimeout(()=>addMsg('Bot',bot[Math.floor(Math.random()*bot.length)]),500+Math.random()*800)})
  input.addEventListener('keydown',e=>{if(e.key==='Enter')btn.click()})
  addMsg('Bot','Welcome to Kilton Chat! Say hi.')
}

function launchSettings() {
  const d=document.createElement('div');d.style.cssText='display:flex;flex-direction:column;padding:20px;gap:12px;font-size:13px'
  d.innerHTML=`<div style="font-size:16px;font-weight:500;margin-bottom:4px">вљ™пёЏ System Settings</div>`
  function addRow(label,ctrl){const r=document.createElement('div');r.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)';r.innerHTML=`<span style="color:#aaa">${label}</span>`;r.appendChild(ctrl);d.appendChild(r)}
  // Username
  const uName=document.createElement('span');uName.style.cssText='color:#fff';uName.textContent=currentUser||'User';addRow('Username',uName)
  // Version
  const ver=document.createElement('span');ver.style.cssText='color:#888';ver.textContent='Kilton OS 1.0.0';addRow('OS Version',ver)
  // Theme toggle
  const thm=document.createElement('button');thm.textContent='рџЋЁ Default Dark';thm.style.cssText='padding:4px 12px;border:none;border-radius:4px;background:rgba(255,255,255,.1);color:#ddd;cursor:pointer;font-size:12px'
  thm.addEventListener('click',()=>showToast('More themes coming soon!'));addRow('Theme',thm)
  // Clear data
  const clr=document.createElement('button');clr.textContent='рџ—‘пёЏ Clear All Data';clr.style.cssText='padding:4px 12px;border:none;border-radius:4px;background:rgba(200,60,60,.3);color:#faa;cursor:pointer;font-size:12px'
  clr.addEventListener('click',()=>{if(confirm('Clear all Kilton data? This cannot be undone.')){localStorage.clear();showToast('Data cleared. Refresh page.');setTimeout(()=>location.reload(),1000)}});addRow('Reset',clr)
  // App count
  const cnt=document.createElement('span');cnt.style.cssText='color:#fff';cnt.textContent=String(BUILT_IN_APPS.length+getInstalledIds().length);addRow('Apps installed',cnt)
  // Storage
  let size=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('kilton_'))size+=localStorage.getItem(k).length*2}}catch(e){}
  const st=document.createElement('span');st.style.cssText='color:#fff';st.textContent=size>1024?(size/1024).toFixed(1)+' KB':size+' B';addRow('Storage used',st)
  createWindow({title:'Settings', icon:'вљ™пёЏ', width:400, height:380, minWidth:320, minHeight:300, content:d})
}

// --- Launch App ---
function launchApp(id) {
  if (REGISTERED_APPS[id]) {
    REGISTERED_APPS[id]()
    return
  }
  // Check if already open, focus it
  const existing = STATE.windows.find(w => w.title.toLowerCase().includes(id) && w.state !== 'minimized')
  if (existing) { focusWindow(existing.id); return }
  const minimized = STATE.windows.find(w => w.title.toLowerCase().includes(id) && w.state === 'minimized')
  if (minimized) { restoreWindow(minimized.id); return }
  // Default handlers
  switch(id) {
    case 'calculator': launchCalculator(); break
    case 'notepad': launchNotepad(); break
    case 'explorer':
    case 'computer': launchExplorer(); break
    case 'about': launchAbout(); break
    default:
      // Check installed market app
      const a = MARKET_APPS.find(x => x.id === id && isInstalled(id))
      if (a) { launchMarketApp(a); return }
      showToast('App not found: ' + id)
  }
}

// --- Calculator ---
function launchCalculator() {
  const div = document.createElement('div')
  div.className = 'calc-body'
  div.innerHTML = `
    <div class="calc-display"><div class="expr" id="calcExpr"></div><div class="result" id="calcResult">0</div></div>
    <div class="calc-grid">
      <button class="clr" data-v="C">C</button><button data-v="В±">В±</button><button data-v="%">%</button><button class="op" data-v="Г·">Г·</button>
      <button data-v="7">7</button><button data-v="8">8</button><button data-v="9">9</button><button class="op" data-v="Г—">Г—</button>
      <button data-v="4">4</button><button data-v="5">5</button><button data-v="6">6</button><button class="op" data-v="-">в€’</button>
      <button data-v="1">1</button><button data-v="2">2</button><button data-v="3">3</button><button class="op" data-v="+">+</button>
      <button data-v="0" style="grid-column:span2">0</button><button data-v=".">.</button><button class="eq" data-v="=">=</button>
    </div>`
  const win = createWindow({
    title:'Calculator', icon:'рџ”ў', width:260, height:340, minWidth:220, minHeight:300, content:div
  })
  let expr = '', result = '0', prev = '', op = ''
  const exprEl = div.querySelector('#calcExpr')
  const resEl = div.querySelector('#calcResult')
  function updateDisplay() { resEl.textContent = result; exprEl.textContent = expr }
  div.querySelectorAll('.calc-grid button').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.v
      if (v === 'C') { expr = ''; result = '0'; prev = ''; op = '' }
      else if (v === 'В±') { result = String(-parseFloat(result)) }
      else if (v === '%') { result = String(parseFloat(result)/100) }
      else if (['+','-','Г—','Г·'].includes(v)) {
        if (prev) { compute() }
        op = v; prev = result; expr = prev + ' ' + v + ' '; result = '0'
      }
      else if (v === '=') { if (prev) { compute() }; op = ''; prev = ''; expr = result }
      else { // number or .
        if (result === '0' && v !== '.') result = v
        else if (v === '.' && result.includes('.')) {}
        else result += v
      }
      updateDisplay()
    })
  })
  function compute() {
    const a = parseFloat(prev), b = parseFloat(result)
    if (isNaN(a) || isNaN(b)) return
    let r = 0
    switch(op) {
      case '+': r = a + b; break
      case '-': r = a - b; break
      case 'Г—': r = a * b; break
      case 'Г·': r = b !== 0 ? a / b : 'Error'; break
    }
    result = typeof r === 'number' ? String(parseFloat(r.toFixed(10))) : 'Error'
  }
}

// --- Notepad ---
function launchNotepad() {
  const div = document.createElement('div')
  div.className = 'notepad-body'
  div.innerHTML = `
    <div class="notepad-toolbar">
      <button data-a="new">рџ“„ New</button>
      <button data-a="clear">рџ—‘пёЏ Clear</button>
      <span style="flex:1"></span>
      <button data-a="info">в„№пёЏ ${document.querySelectorAll('.notepad-body textarea') ? 'Chars: 0' : ''}</button>
    </div>
    <textarea placeholder="Start typing..." spellcheck="false"></textarea>`
  const win = createWindow({title:'Notepad', icon:'рџ“ќ', width:520, height:400, minWidth:300, minHeight:200, content:div})
  const ta = div.querySelector('textarea')
  ta.addEventListener('input', () => {
    // Save to localStorage
    try { localStorage.setItem('kilton_notepad', ta.value) } catch(e) {}
  })
  // Restore
  try { const saved = localStorage.getItem('kilton_notepad'); if (saved) ta.value = saved } catch(e) {}
  div.querySelectorAll('[data-a]').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.a
      if (a === 'new') { ta.value = ''; try { localStorage.removeItem('kilton_notepad') } catch(e){} }
      if (a === 'clear') ta.value = ''
      if (a === 'info') showToast('Chars: ' + ta.value.length)
    })
  })
}

// --- File Explorer ---
function launchExplorer(startDir) {
  initFS()
  const dir = startDir || 'Desktop'
  const div = document.createElement('div')
  div.className = 'explorer-body'
  div.innerHTML = `
    <div class="explorer-toolbar">
      <button data-d="back">в—Ђ</button>
      <button data-d="refresh">вџі</button>
      <input class="addrBar" value="рџ“Ѓ ${dir}" readonly>
      <button data-d="upload">рџ“¤ Upload</button>
      <input type="file" id="fuInput" multiple style="display:none">
      <button data-d="newFolder">рџ“Ѓ New Folder</button>
      <button data-d="dlurl">рџЊђ Download URL</button>
      <button data-d="paste" style="display:${CLIPBOARD.mode?'inline-flex':'none'}">рџ“‹ Paste</button>
    </div>
    <div class="explorer-content">
      <div class="explorer-sidebar">
        <button class="sideItem" data-s="Desktop"><span>рџ–ҐпёЏ</span> Desktop</button>
        <button class="sideItem" data-s="Documents"><span>рџ“‚</span> Documents</button>
        <button class="sideItem" data-s="Pictures"><span>рџ–јпёЏ</span> Pictures</button>
        <button class="sideItem" data-s="Music"><span>рџЋµ</span> Music</button>
        <button class="sideItem" data-s="Downloads"><span>в¬‡пёЏ</span> Downloads</button>
      </div>
      <div class="explorer-files" id="explorerFiles"></div>
    </div>`
  const win = createWindow({title:dir + ' - File Explorer', icon:'рџ“Ѓ', width:640, height:440, minWidth:350, minHeight:250, content:div})
  const filesEl = div.querySelector('#explorerFiles')
  const addrBar = div.querySelector('.addrBar')
  const fuInput = div.querySelector('#fuInput')
  const pasteBtn = div.querySelector('[data-d="paste"]')
  let currentDir = dir
  let navStack = [dir]

  function activateSidebar(name) {
    div.querySelectorAll('.sideItem').forEach(s => s.classList.remove('active'))
    const rootDir = name.split('/')[0]
    const btn = div.querySelector(`.sideItem[data-s="${rootDir}"]`)
    if (btn) btn.classList.add('active')
  }

  function pasteHere() {
    if (!CLIPBOARD.mode || !CLIPBOARD.srcDir || !CLIPBOARD.name) return
    if (CLIPBOARD.mode === 'copy') copyItem(CLIPBOARD.srcDir, CLIPBOARD.name, currentDir)
    else moveItem(CLIPBOARD.srcDir, CLIPBOARD.name, currentDir)
    CLIPBOARD.mode = null; CLIPBOARD.srcDir = null; CLIPBOARD.name = null
    pasteBtn.style.display = 'none'
    showToast('Pasted successfully')
    refreshAllExplorers()
    renderFiles()
  }

  function updatePasteBtn() {
    pasteBtn.style.display = CLIPBOARD.mode ? 'inline-flex' : 'none'
  }

  function renderFiles() {
    filesEl.innerHTML = ''
    const items = listDir(currentDir)
    if (!items.length) { filesEl.innerHTML = '<div style="color:#666;padding:20px;width:100%;text-align:center">Empty folder</div>'; return }
    items.forEach(f => {
      const item = document.createElement('div')
      item.className = 'fileItem'
      const ico = f.type === 'folder' ? 'рџ“Ѓ' : getFileIcon(f.type, f.name)
      item.draggable = true
      item.innerHTML = `<div class="ico">${ico}</div><div class="name">${f.name}</div>`
      item.addEventListener('dblclick', () => {
        if (f.type === 'folder') { navigateTo(currentDir + '/' + f.name); return }
        openFile(currentDir, f.name)
      })
      item.addEventListener('contextmenu', e => {
        e.preventDefault(); showFileContextMenu(e.clientX, e.clientY, currentDir, f.name)
      })
      // Drag start
      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ dir: currentDir, name: f.name }))
        e.dataTransfer.effectAllowed = 'move'
        item.style.opacity = '0.4'
      })
      item.addEventListener('dragend', e => { item.style.opacity = '1' })
      // Drop target for folders
      if (f.type === 'folder') {
        item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; item.style.background = 'rgba(100,150,255,.15)' })
        item.addEventListener('dragleave', e => { item.style.background = '' })
        item.addEventListener('drop', e => {
          e.preventDefault(); e.stopPropagation(); item.style.background = ''
          try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'))
            if (data.name && data.dir) {
              const dstDir = currentDir + '/' + f.name
              if (moveItem(data.dir, data.name, dstDir)) { showToast('Moved to ' + f.name); refreshAllExplorers(); renderFiles() }
              else showToast('Could not move')
            }
          } catch(ex) { showToast('Invalid drag data') }
        })
      }
      filesEl.appendChild(item)
    })
    // Drop on empty area (into current dir)
    filesEl.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' })
    filesEl.addEventListener('drop', e => {
      e.preventDefault()
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'))
        if (data.name && data.dir && data.dir !== currentDir) {
          if (moveItem(data.dir, data.name, currentDir)) { showToast('Moved here'); refreshAllExplorers(); renderFiles() }
        }
      } catch(ex) {}
    })
  }

  function navigateTo(path) {
    navStack.push(currentDir)
    currentDir = path
    ensureDir(getFS(), currentDir)
    addrBar.value = 'рџ“Ѓ ' + currentDir
    activateSidebar(currentDir)
    renderFiles()
  }

  div.querySelector('[data-d="back"]').addEventListener('click', () => {
    if (navStack.length > 0) { currentDir = navStack.pop(); addrBar.value = 'рџ“Ѓ ' + currentDir; activateSidebar(currentDir); renderFiles() }
  })
  div.querySelector('[data-d="refresh"]').addEventListener('click', renderFiles)

  div.querySelector('[data-d="newFolder"]').addEventListener('click', () => {
    const name = prompt('Folder name:')
    if (name && name.trim()) { createFolder(currentDir, name.trim()); renderFiles() }
  })

  div.querySelector('[data-d="upload"]').addEventListener('click', () => fuInput.click())

  div.querySelector('[data-d="dlurl"]').addEventListener('click', () => {
    const url = prompt('Paste file URL to download:')
    if (!url || !url.trim()) return
    const fileName = url.split('/').pop().split('?')[0] || 'download'
    showToast('Downloading ' + fileName + '...')
    fetch(url).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status)
      const ct = r.headers.get('content-type') || ''
      return r.blob().then(blob => ({ blob, ct }))
    }).then(({ blob, ct }) => {
      const reader = new FileReader()
      reader.onload = e => {
        const ext = fileName.split('.').pop().toLowerCase()
        const textExts = ['txt','md','js','py','html','css','json','xml','csv','ini','cfg','log','bat','sh','svg']
        const isText = ct.startsWith('text/') || textExts.includes(ext)
        const isAudio = ct.startsWith('audio/') || ['mp3','wav','ogg','flac','aac'].includes(ext)
        const isVideo = ct.startsWith('video/') || ['mp4','avi','mkv','webm','mov','wmv','flv'].includes(ext)
        let ft = 'image'
        if (isText) ft = 'text'
        else if (isAudio) ft = 'audio'
        else if (isVideo) ft = 'video'
        if (['exe','msi','app'].includes(ext)) {
          const appName = fileName.replace(/\.(exe|msi|app)$/i, '')
          const appId = 'installed_' + appName.toLowerCase().replace(/[^a-z0-9]/g,'_') + '_' + Date.now()
          REGISTERED_APPS[appId] = () => {
            const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;gap:16px;text-align:center'
            d.innerHTML = `<div style="font-size:48px">вљ™пёЏ</div><div style="font-size:18px;font-weight:500;color:#fff">${appName}</div><div style="color:#888;font-size:13px;max-width:300px">Downloaded app</div>`
            createWindow({title:appName, icon:'вљ™пёЏ', width:360, height:240, content:d})
          }
          launchApp(appId)
          showToast('Installed app: ' + appName)
          return
        }
        try {
          if (createFile(currentDir, fileName, ft, e.target.result))
            showToast('Downloaded: ' + fileName)
          else showToast('Already exists')
        } catch(ex) { showToast('File too large for storage') }
        renderFiles()
      }
      reader.readAsDataURL(blob)
    }).catch(err => showToast('Download error: ' + err.message))
  })

  div.querySelector('[data-d="paste"]').addEventListener('click', pasteHere)

  fuInput.addEventListener('change', () => {
    Array.from(fuInput.files).forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      const textExts = ['txt','md','js','py','html','css','json','xml','csv','ini','cfg','log','bat','sh']
      const isText = file.type.startsWith('text/') || file.type === '' || textExts.includes(ext)
      let fileType = 'image'
      if (isText) fileType = 'text'
      else if (file.type.startsWith('audio/') || ['mp3','wav','ogg','flac','aac','wma'].includes(ext)) fileType = 'audio'
      else if (file.type.startsWith('video/') || ['mp4','avi','mkv','webm','mov','wmv','flv'].includes(ext)) fileType = 'video'
      const reader = new FileReader()
      reader.onload = e => {
        try {
          createFile(currentDir, file.name, fileType, e.target.result)
          renderFiles()
          showToast('Uploaded: ' + file.name)
        } catch(ex) {
          showToast('File too large for storage')
        }
      }
      reader.onerror = () => showToast('Error reading file')
      try {
        isText ? reader.readAsText(file) : reader.readAsDataURL(file)
      } catch(ex) {
        showToast('File too large to read')
      }
    })
    fuInput.value = ''
  })

  div.querySelectorAll('.sideItem').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.s
      currentDir = name; addrBar.value = 'рџ“Ѓ ' + name; navStack = []; activateSidebar(name); renderFiles()
    })
  })

  activateSidebar(dir)
  renderFiles()
}

function openFile(dir, name) {
  const fs = getFS(); const items = fs[dir] || []; const f = items.find(i => i.name === name)
  if (!f) { showToast('File not found'); return }
  const cont = f.content || ''
  const isText = f.type === 'text' || !cont.startsWith('data:')

  if (isText) {
    const ta = document.createElement('textarea')
    ta.style.cssText = 'width:100%;height:100%;border:none;outline:none;padding:10px;font-family:monospace;font-size:13px;resize:none;background:rgba(0,0,0,.2);color:#e0e0e0;line-height:1.5;tab-size:2'
    ta.value = cont
    ta.addEventListener('input', () => { f.content = ta.value; f.size = ta.value.length; f.modified = new Date().toISOString(); saveFS(fs) })
    createWindow({title:name + ' - Editor', icon:getFileIcon(f.type, name), width:520, height:400, minWidth:300, minHeight:200, content:ta})
  } else if (cont.startsWith('data:image/')) {
    const img = document.createElement('img'); img.src = cont; img.style.cssText = 'max-width:100%;max-height:100%;display:block;margin:auto;object-fit:contain'
    const c = document.createElement('div'); c.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;padding:10px'; c.appendChild(img)
    createWindow({title:name, icon:'рџ–јпёЏ', width:500, height:400, content:c})
  } else if (cont.startsWith('data:audio/')) {
    const au = document.createElement('audio'); au.src = cont; au.controls = true; au.style.cssText = 'width:80%;margin:auto'
    const c = document.createElement('div'); c.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;padding:20px'; c.appendChild(au)
    createWindow({title:name, icon:'рџЋµ', width:400, height:120, content:c})
  } else if (cont.startsWith('data:video/')) {
    const vi = document.createElement('video'); vi.src = cont; vi.controls = true; vi.style.cssText = 'max-width:100%;max-height:100%;display:block;margin:auto'
    const c = document.createElement('div'); c.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;padding:10px'; c.appendChild(vi)
    createWindow({title:name, icon:'рџЋ¬', width:560, height:380, minWidth:300, minHeight:200, content:c})
  } else {
    const d = document.createElement('div'); d.style.cssText = 'padding:20px;color:#aaa;font-size:13px;line-height:1.6'
    d.innerHTML = `<b>${name}</b><br>Type: ${f.type || 'unknown'}<br>Size: ${formatSize(f.size)}<br>Content: ${cont.substring(0,200)}...`
    createWindow({title:name, icon:'рџ“„', width:400, height:200, content:d})
  }
}

function showFileContextMenu(x, y, dir, fileName) {
  const menu = document.getElementById('ctxMenu')
  menu.innerHTML = ''
  const items = [
    {ico:'рџ“‚', label:'Open', fn:() => openFile(dir, fileName)},
    {divider:true},
    {ico:'рџ“‹', label:'Copy', fn:() => {
      CLIPBOARD.mode = 'copy'; CLIPBOARD.srcDir = dir; CLIPBOARD.name = fileName
      showToast('Copied: ' + fileName)
      // Update all paste buttons
      document.querySelectorAll('[data-d="paste"]').forEach(b => b.style.display = 'inline-flex')
    }},
    {ico:'вњ‚пёЏ', label:'Cut', fn:() => {
      CLIPBOARD.mode = 'cut'; CLIPBOARD.srcDir = dir; CLIPBOARD.name = fileName
      showToast('Cut: ' + fileName)
      document.querySelectorAll('[data-d="paste"]').forEach(b => b.style.display = 'inline-flex')
    }},
    {ico:'рџ“‹', label:'Paste', fn:() => {
      if (!CLIPBOARD.mode || !CLIPBOARD.srcDir || !CLIPBOARD.name) { showToast('Nothing to paste'); return }
      if (CLIPBOARD.mode === 'copy') copyItem(CLIPBOARD.srcDir, CLIPBOARD.name, dir)
      else moveItem(CLIPBOARD.srcDir, CLIPBOARD.name, dir)
      CLIPBOARD.mode = null; CLIPBOARD.srcDir = null; CLIPBOARD.name = null
      document.querySelectorAll('[data-d="paste"]').forEach(b => b.style.display = 'none')
      showToast('Pasted successfully'); refreshAllExplorers()
    }},
    {divider:true},
    {ico:'рџ“›', label:'Rename', fn:() => {
      const newName = prompt('Rename to:', fileName)
      if (newName && newName.trim() && newName.trim() !== fileName) { renameItem(dir, fileName, newName.trim()); refreshAllExplorers() }
    }},
    {ico:'рџ“¦', label:'Compress to ZIP', fn:() => {
      compressToZip(dir, fileName)
    }},
    {ico:'рџ—‘пёЏ', label:'Delete', fn:() => {
      if (confirm('Delete ' + fileName + '?')) { deleteItem(dir, fileName); refreshAllExplorers() }
    }},
    {divider:true},
    {ico:'в„№пёЏ', label:'Properties'},
  ]
  renderContextMenu(menu, items)
  positionContextMenu(menu, x, y)
}

function refreshAllExplorers() {
  STATE.windows.filter(w => w.title.includes('File Explorer') || w.title.includes(' - Explorer') || w.title.includes(' - Editor')).forEach(w => {
    const content = w.el.querySelector('.window-content')
    if (content) { const btn = content.querySelector('[data-d="refresh"]'); if (btn) btn.click() }
  })
  // Re-render desktop icons
  initDesktop()
  // Update paste buttons in all explorer windows
  setTimeout(() => {
    document.querySelectorAll('[data-d="paste"]').forEach(b => { b.style.display = CLIPBOARD.mode ? 'inline-flex' : 'none' })
  }, 50)
}

// --- About ---
function launchAbout() {
  const div = document.createElement('div')
  div.className = 'about-body'
  div.innerHTML = `
    <div class="logo">в¬Ў</div>
    <h2>Kilton OS</h2>
    <div class="ver">Version 1.0.0</div>
    <div class="desc">A web-based desktop environment inspired by Windows. Built with HTML, CSS, and JavaScript.</div>
    <div class="desc" style="font-size:11px;color:#666">В© 2026 Kilton. All rights reserved.</div>
    <div class="copy">Made with вќ¤пёЏ</div>`
  createWindow({title:'About Kilton', icon:'в¬Ў', width:380, height:300, minWidth:300, minHeight:250, content:div})
}

// --- Market ---
function launchMarket() {
  const div = document.createElement('div')
  div.className = 'market-body'
  div.innerHTML = `
    <div class="market-header">
      <h2>рџ›’ Kilton Market</h2>
      <div class="sub">Discover and install apps for your desktop</div>
    </div>
    <div class="market-tabs" id="marketTabs">
      <button class="mktab active" data-cat="all">All</button>
      <button class="mktab" data-cat="Games">рџЋ® Games</button>
      <button class="mktab" data-cat="Tools">рџ”§ Tools</button>
      <button class="mktab" data-cat="Utility">рџ“± Utility</button>
      <button class="mktab" data-cat="Media">рџЋµ Media</button>
      <button class="mktab" data-cat="Social">рџ’¬ Social</button>
      <button class="mktab" data-cat="System">вљ™пёЏ System</button>
    </div>
    <div class="market-grid" id="marketGrid"></div>`
  createWindow({title:'Kilton Market', icon:'рџ›’', width:620, height:480, minWidth:400, minHeight:350, content:div})

  const grid = div.querySelector('#marketGrid')
  const tabs = div.querySelectorAll('.mktab')
  let currentCat = 'all'

  function renderMarket() {
    grid.innerHTML = ''
    const apps = currentCat === 'all' ? MARKET_APPS : MARKET_APPS.filter(a => a.cat === currentCat)
    if (!apps.length) { grid.innerHTML = '<div style="color:#666;padding:40px;text-align:center;width:100%">No apps in this category</div>'; return }
    apps.forEach(a => {
      const installed = isInstalled(a.id)
      const card = document.createElement('div')
      card.className = 'mkcard'
      card.innerHTML = `
        <div class="top">
          <div class="ico">${a.ico}</div>
          <div class="info">
            <div class="name">${a.label}</div>
            <div class="dev">${a.dev} В· ${a.cat}</div>
          </div>
        </div>
        <div class="desc">${a.desc}</div>
        <div style="display:flex;gap:4px">
          ${installed ? `<button class="btn install" data-id="${a.id}" style="flex:1">в–¶ Open</button><button class="btn uninstall" data-id="${a.id}" style="flex:0;padding:5px 8px">вњ•</button>` : `<button class="btn install" data-id="${a.id}" style="flex:1">+ Install</button>`}
        </div>`
      card.querySelectorAll('.btn').forEach(b => b.addEventListener('click', () => {
        if (isInstalled(a.id) && b.classList.contains('uninstall')) { uninstallApp(a.id); renderMarket(); rebuildDesktop() }
        else if (isInstalled(a.id)) { launchApp(a.id) }
        else { installApp(a.id); renderMarket() }
      }))
      grid.appendChild(card)
    })
  }

  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active')); t.classList.add('active')
    currentCat = t.dataset.cat; renderMarket()
  }))

  renderMarket()
}

// --- Browser ---
function launchBrowser(url) {
  const div = document.createElement('div')
  div.style.cssText = 'display:flex;flex-direction:column;height:100%'
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:4px;padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0">
      <button data-b="back" style="padding:3px 8px;border:none;background:transparent;color:#aaa;cursor:pointer;border-radius:3px;font-size:13px">в—Ђ</button>
      <button data-b="fwd" style="padding:3px 8px;border:none;background:transparent;color:#aaa;cursor:pointer;border-radius:3px;font-size:13px">в–¶</button>
      <button data-b="ref" style="padding:3px 8px;border:none;background:transparent;color:#aaa;cursor:pointer;border-radius:3px;font-size:13px">вџі</button>
      <div style="flex:1;display:flex;align-items:center;gap:4px;background:rgba(0,0,0,.3);border-radius:20px;padding:4px 12px">
        <span style="color:#666;font-size:11px">рџ”’</span>
        <input id="browserUrl" style="flex:1;border:none;outline:none;background:transparent;color:#ddd;font-size:12px" placeholder="Search or enter URL" spellcheck="false">
      </div>
      <button data-b="dl" style="padding:3px 8px;border:none;background:transparent;color:#aaa;cursor:pointer;border-radius:3px;font-size:13px" title="Download to Kilton">рџ“Ґ</button>
      <button data-b="ext" style="padding:3px 8px;border:none;background:transparent;color:#aaa;cursor:pointer;border-radius:3px;font-size:12px">в†—</button>
    </div>
    <div style="flex:1;position:relative;background:#fff">
      <iframe id="browserFrame" style="width:100%;height:100%;border:none" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
      <div id="browserFallback" style="display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(20,20,30,.98);padding:40px;text-align:center;flex-direction:column;align-items:center;justify-content:center;gap:16px">
        <div style="font-size:40px">рџЊђ</div>
        <div style="font-size:18px;font-weight:300;color:#fff">This site can't be embedded</div>
        <div style="color:#888;font-size:13px;max-width:400px;line-height:1.5">Some websites block being displayed inside other pages.</div>
        <button id="browserOpenTab" style="padding:8px 24px;border:none;border-radius:6px;background:linear-gradient(135deg,#6a11cb,#2575fc);color:#fff;font-size:14px;cursor:pointer">Open in new tab в†’</button>
        <button id="browserSearch" style="padding:6px 16px;border:1px solid rgba(255,255,255,.2);border-radius:6px;background:transparent;color:#aaa;font-size:12px;cursor:pointer;margin-top:4px">Search Google instead</button>
      </div>
    </div>`
  const win = createWindow({title:'Browser', icon:'рџЊђ', width:750, height:500, minWidth:400, minHeight:300, content:div})

  const frame = div.querySelector('#browserFrame')
  const urlInput = div.querySelector('#browserUrl')
  const fallback = div.querySelector('#browserFallback')
  const openTabBtn = div.querySelector('#browserOpenTab')
  const searchBtn = div.querySelector('#browserSearch')
  let history = [], histIdx = -1, currentUrl = ''

  function navigate(url) {
    if (!url) return
    if (!url.match(/^https?:\/\//i)) {
      if (url.includes('.')) url = 'https://' + url
      else url = 'https://www.google.com/search?igu=1&q=' + encodeURIComponent(url)
    }
    currentUrl = url
    urlInput.value = url
    // Remove old history after current position
    if (histIdx < history.length - 1) history = history.slice(0, histIdx + 1)
    history.push(url); histIdx = history.length - 1
    try { frame.src = url; fallback.style.display = 'none' } catch(e) {}
    updateWinTitle('Loading...')
  }

  function checkFallback() {
    // If iframe fails to load (blocked by X-Frame-Options), show fallback
    try {
      if (frame.contentDocument || frame.contentWindow) {
        try {
          const doc = frame.contentDocument || frame.contentWindow.document
          if (doc && doc.body && doc.body.innerHTML) { fallback.style.display = 'none'; return }
        } catch(e2) { /* cross-origin = blocked */ }
      }
    } catch(e) {}
    // For known blocking sites, show fallback
    const blocked = ['google.com', 'youtube.com', 'facebook.com', 'github.com']
    if (blocked.some(d => currentUrl.includes(d))) { fallback.style.display = 'flex'; return }
    // Otherwise, try loading and check after timeout
    setTimeout(() => {
      try {
        if (frame.contentDocument && frame.contentDocument.body && frame.contentDocument.body.innerHTML.length > 0)
          fallback.style.display = 'none'
        else if (frame.contentDocument && frame.contentDocument.body && frame.contentDocument.body.innerHTML.length === 0)
          fallback.style.display = 'flex'
      } catch(e) { fallback.style.display = 'flex' }
    }, 2000)
  }

  function updateWinTitle(t) {
    win.title = t + ' - Browser'
    const titleEl = win.el && win.el.querySelector('.winTitle')
    if (titleEl) titleEl.textContent = t
  }

  frame.addEventListener('load', () => {
    const t = frame.contentDocument ? frame.contentDocument.title : currentUrl
    updateWinTitle(t || 'Browser')
    fallback.style.display = 'none'
  })
  frame.addEventListener('error', checkFallback)

  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { navigate(urlInput.value); e.preventDefault() }
  })

  div.querySelector('[data-b="back"]').addEventListener('click', () => {
    if (histIdx > 0) { histIdx--; navigate(history[histIdx], true) }
  })
  div.querySelector('[data-b="fwd"]').addEventListener('click', () => {
    if (histIdx < history.length - 1) { histIdx++; navigate(history[histIdx], true) }
  })
  div.querySelector('[data-b="ref"]').addEventListener('click', () => { frame.src = currentUrl })
  div.querySelector('[data-b="ext"]').addEventListener('click', () => {
    if (currentUrl) window.open(currentUrl, '_blank')
  })
  div.querySelector('[data-b="dl"]').addEventListener('click', () => {
    if (!currentUrl) { showToast('No URL'); return }
    const url = currentUrl
    const fileName = url.split('/').pop().split('?')[0] || 'download'
    const ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : ''
    // Try to fetch and download, fallback to saving page link
    if (['exe','msi','app','zip','rar','7z','pdf','docx','xlsx','dmg','iso'].includes(ext)) {
      showToast('Downloading ' + fileName + '...')
      fetch(url, { mode: 'cors' }).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status)
        const ct = r.headers.get('content-type') || ''
        return r.blob().then(b => ({ blob: b, ct }))
      }).then(({ blob, ct }) => {
        const reader = new FileReader()
        reader.onload = e => {
          if (['exe','msi','app'].includes(ext)) {
            const appName = fileName.replace(/\.(exe|msi|app)$/i, '')
            const appId = 'installed_' + appName.toLowerCase().replace(/[^a-z0-9]/g,'_') + '_' + Date.now()
            REGISTERED_APPS[appId] = () => {
              const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:40px;gap:16px;text-align:center'
              d.innerHTML = `<div style="font-size:48px">вљ™пёЏ</div><div style="font-size:18px;font-weight:500;color:#fff">${appName}</div><div style="color:#888;font-size:13px;max-width:300px">Installed from browser</div>`
              createWindow({title:appName, icon:'вљ™пёЏ', width:360, height:240, content:d})
            }
            launchApp(appId); showToast('Installed: ' + appName)
          } else {
            const textExts = ['txt','md','js','py','html','css','json','xml','csv','svg']
            const isText = ct.startsWith('text/') || textExts.includes(ext)
            let ft = isText ? 'text' : ct.startsWith('audio/') ? 'audio' : ct.startsWith('video/') ? 'video' : 'image'
            try {
              if (createFile('Downloads', fileName, ft, e.target.result)) showToast('Downloaded: ' + fileName)
              else showToast('Already exists')
            } catch(ex) { showToast('File too large') }
          }
          refreshAllExplorers()
        }
        reader.readAsDataURL(blob)
      }).catch(() => {
        showToast('Blocked by CORS - use в†— to download externally')
      })
    } else {
      // Save page link
      const name = url.replace(/https?:\/\//,'').replace(/[^a-z0-9]/gi,'_').substring(0,40) + '.html'
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Saved page</title></head><body><p>URL: <a href="${url}">${url}</a></p><p>${new Date().toLocaleString()}</p></body></html>`
      createFile('Downloads', name, 'text', html)
      showToast('Saved page link to Downloads')
    }
  })

  openTabBtn.addEventListener('click', () => { if (currentUrl) window.open(currentUrl, '_blank') })
  searchBtn.addEventListener('click', () => {
    navigate('https://www.google.com/search?igu=1&q=' + encodeURIComponent(urlInput.value))
  })

  // Navigate to Google by default
  navigate(url || 'https://www.google.com/webhp?igu=1')
  setTimeout(checkFallback, 1500)
}

// --- Kilton AI ---
function launchAI() {
  const div = document.createElement('div')
  div.className = 'chat-body'
  div.innerHTML = `
    <div style="padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:8px;flex-shrink:0">
      <span style="font-size:18px">рџ¤–</span>
      <span style="font-weight:500;font-size:13px">Kilton AI</span>
      <span style="color:#666;font-size:11px">Assistant</span>
      <span style="flex:1"></span>
      <button id="aiClear" style="padding:2px 8px;border:none;border-radius:4px;background:rgba(255,255,255,.06);color:#888;cursor:pointer;font-size:11px" title="Clear chat">рџ—‘пёЏ</button>
    </div>
    <div class="chat-msgs" id="chatMessages"></div>
    <div class="chat-input-area">
      <input id="chatInput" placeholder="Ask me anything..." spellcheck="false">
      <button id="chatSend">Send</button>
    </div>`
  const win = createWindow({title:'Kilton AI', icon:'рџ¤–', width:460, height:540, minWidth:320, minHeight:350, content:div})

  const msgsEl = div.querySelector('#chatMessages')
  const inputEl = div.querySelector('#chatInput')
  const sendBtn = div.querySelector('#chatSend')
  const clearBtn = div.querySelector('#aiClear')
  const chatHistory = []

  function addMsg(role, text) {
    const now = new Date()
    const t = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
    const el = document.createElement('div')
    el.className = 'chat-msg ' + role
    el.innerHTML = text.replace(/
/g, '<br>') + `<div class="time">${t}</div>`
    msgsEl.appendChild(el)
    msgsEl.scrollTop = msgsEl.scrollHeight
    chatHistory.push({ role, text })
  }

  // All apps mapping (built-in + market)
  function getAllAppNames() {
    const map = {}
    BUILT_IN_APPS.forEach(a => { map[a.label.toLowerCase()] = a.id; map[a.id] = a.id })
    MARKET_APPS.forEach(a => { map[a.label.toLowerCase()] = a.id; map[a.id] = a.id })
    map['settings'] = 'settings'; map['terminal'] = 'terminal'; map['paint'] = 'paint'
    map['chat'] = 'chat'; map['music player'] = 'music'; map['snake'] = 'snake'
    map['tetris'] = 'tetris'; map['ai'] = 'ai'; map['app store'] = 'market'
    map['store'] = 'market'; map['file manager'] = 'explorer'; map['files'] = 'explorer'
    map['calc'] = 'calculator'; map['text editor'] = 'notepad'
    return map
  }

  function aiRespond(input) {
    const lower = input.toLowerCase().trim()
    const apps = getAllAppNames()

    // --- Open/Launch any app ---
    const openMatch = lower.match(/^(open|launch|start|run)\s+(.+)/)
    if (openMatch) {
      const target = openMatch[2].trim()
      // Check for exact app name match
      for (const [name, id] of Object.entries(apps)) {
        if (target === name || target === id || target.includes(name)) {
          try { launchApp(id); return `вњ… Opening **${name}**...` } catch(e) { return `вќЊ Could not open ${name}` }
        }
      }
      // Try partial match
      for (const [name, id] of Object.entries(apps)) {
        if (name.includes(target) || id.includes(target)) {
          try { launchApp(id); return `вњ… Opening **${name}**...` } catch(e) { return `вќЊ Could not open ${name}` }
        }
      }
      return `вќЊ App "${target}" not found. Try: browser, market, explorer, calculator, notepad, terminal, paint, snake, tetris, chat, music, settings`
    }

    // --- Close window ---
    if (lower.includes('close window') || lower.startsWith('close ')) {
      const target = lower.replace(/close\s*(window)?/,'').trim()
      if (target) {
        for (const [name, id] of Object.entries(apps)) {
          if (target === name || target === id || target.includes(name) || name.includes(target)) {
            const w = STATE.windows.find(w => w.title.toLowerCase().includes(name))
            if (w) { closeWindow(w.id); return `вњ… Closed **${name}**` }
            return `в„№пёЏ No open window for **${name}**`
          }
        }
        return `вќЊ App "${target}" not found`
      }
      // Close active/focused window
      const focused = STATE.windows.find(w => w.el && w.el.style.zIndex === String(STATE.maxZ))
      if (focused) { closeWindow(focused.id); return `вњ… Closed **${focused.title}**` }
      return 'в„№пёЏ No windows open'
    }

    // --- Minimize window ---
    if (lower.includes('minimize')) {
      const target = lower.replace(/minimize\s*/,'').trim()
      for (const [name, id] of Object.entries(apps)) {
        if (target && (target === name || target === id || name.includes(target))) {
          const w = STATE.windows.find(w => w.title.toLowerCase().includes(name))
          if (w) { minimizeWindow(w.id); return `вњ… Minimized **${name}**` }
          return `в„№пёЏ No open window for **${name}**`
        }
      }
      const focused = STATE.windows.find(w => w.el && w.el.style.zIndex === String(STATE.maxZ))
      if (focused) { minimizeWindow(focused.id); return `вњ… Minimized **${focused.title}**` }
      return 'в„№пёЏ No windows open'
    }

    // --- List files ---
    if (lower.includes('list files') || lower.includes('show files') || lower.includes('what\'s on') || lower.includes('whats on')) {
      const dirs = ['Desktop','Documents','Downloads','Pictures','Music']
      const dir = dirs.find(d => lower.includes(d.toLowerCase()))
      const targetDir = dir || 'Desktop'
      const files = listDir(targetDir)
      if (!files.length) return `рџ“Ѓ **${targetDir}** is empty.`
      let result = `рџ“Ѓ **${targetDir}**:<br>`
      files.forEach(f => {
        const ico = f.type === 'folder' ? 'рџ“Ѓ' : getFileIcon(f.type, f.name)
        result += `${ico} ${f.name}<br>`
      })
      return result
    }

    // --- Search files ---
    if (lower.includes('find ') || lower.includes('search files') || lower.includes('search for ')) {
      const query = input.replace(/find |search for |search files |search /gi, '').trim().toLowerCase()
      if (!query) return 'рџ”Ќ What file are you looking for?'
      const fs = getFS()
      let results = []
      Object.keys(fs).forEach(dir => {
        fs[dir].forEach(f => {
          if (f.name.toLowerCase().includes(query)) results.push(`рџ“Ѓ ${dir} в†’ ${f.name}`)
        })
      })
      if (!results.length) return `рџ”Ќ No files matching "${query}"`
      return `рџ”Ќ Found ${results.length} file(s):<br>${results.slice(0,15).join('<br>')}`
    }

    // --- Read file ---
    if (lower.includes('read ') || lower.includes('show file ') || lower.includes('open file ')) {
      const target = input.replace(/read |show file |open file /gi, '').trim()
      if (!target) return 'Which file should I read?'
      const fs = getFS()
      for (const dir of Object.keys(fs)) {
        const f = fs[dir].find(x => x.name.toLowerCase().includes(target.toLowerCase()))
        if (f) {
          if (f.type === 'folder') return `рџ“Ѓ **${f.name}** is a folder. Use \`list files\` to see contents.`
          const cont = (f.content || '').substring(0, 300)
          return `рџ“„ **${f.name}** (${dir}):<br><span style="color:#aaa;font-size:11px">${cont.replace(/
/g,'<br>')}</span>`
        }
      }
      return `вќЊ File "${target}" not found`
    }

    // --- Delete file ---
    if (lower.includes('delete ') || lower.includes('remove ') || lower.includes('trash ')) {
      const target = input.replace(/delete |remove |trash /gi, '').trim()
      if (!target) return 'What should I delete?'
      const fs = getFS()
      for (const dir of Object.keys(fs)) {
        const idx = fs[dir].findIndex(x => x.name.toLowerCase() === target.toLowerCase())
        if (idx !== -1) {
          deleteItem(dir, fs[dir][idx].name); refreshAllExplorers()
          return `вњ… Deleted **${fs[dir][idx].name}** from ${dir}`
        }
      }
      return `вќЊ File "${target}" not found`
    }

    // --- Calculator / Math ---
    const mathMatch = lower.match(/^(calculate|calc|math|what is|what's)\s+(.+)/)
    if (mathMatch || lower.match(/^[\d\s+\-*/().%^]+$/)) {
      const expr = (mathMatch ? mathMatch[2] : lower).replace(/Г—/g,'*').replace(/Г·/g,'/').replace(/x/g,'*').replace(/ /g,'')
      const safe = expr.replace(/[\d+\-*/().%]/g,'')
      if (!safe && expr.length > 0) {
        try {
          // Safety: only eval math expressions
          const result = Function('"use strict"; return (' + expr + ')')()
          if (typeof result === 'number' && !isNaN(result)) return `рџ§® **${expr}** = **${result}**`
        } catch(e) {}
      }
    }

    // --- System info ---
    if (lower.includes('system') || lower.includes('info') || lower.includes('status') || lower.includes('specs') || lower.includes('about')) {
      let size = 0
      try { for (let i=0;i<localStorage.length;i++) { const k=localStorage.key(i); if (k&&k.startsWith('kilton_')) size+=localStorage.getItem(k).length*2 } } catch(e) {}
      const sizeStr = size > 1024 ? (size/1024).toFixed(1) + ' KB' : size + ' B'
      return `рџ’» **Kilton OS**<br>User: **${currentUser||'guest'}**<br>Apps: ${BUILT_IN_APPS.length + getInstalledIds().length} (${getInstalledIds().length} installed)<br>Windows open: ${STATE.windows.length}<br>Storage: ${sizeStr}<br>Version: 1.0.0`
    }

    // --- Time & Date ---
    if (lower.includes('time') || lower.includes('clock')) {
      const now = new Date()
      return 'рџ•ђ **' + now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}) + '**'
    }
    if (lower.includes('date') || lower.includes('today')) {
      const now = new Date()
      return 'рџ“… **' + now.toLocaleDateString([], {weekday:'long',month:'long',day:'numeric',year:'numeric'}) + '**'
    }

    // --- Create file ---
    if (lower.includes('create file') || lower.includes('new file') || lower.includes('make file')) {
      const name = input.replace(/create file|new file|make file/gi, '').trim() || 'ai_note.txt'
      if (!name.includes('.')) return 'Please include an extension (e.g., note.txt, script.js)'
      try {
        createFile('Desktop', name, 'text', 'Created by Kilton AI on ' + new Date().toLocaleString())
        refreshAllExplorers()
        return 'вњ… Created **' + name + '** on Desktop'
      } catch(e) { return 'вќЊ Could not create file' }
    }

    // --- Create folder ---
    if (lower.includes('create folder') || lower.includes('new folder') || lower.includes('mkdir')) {
      const name = input.replace(/create folder|new folder|mkdir/gi, '').trim() || 'New Folder'
      try {
        createFolder('Desktop', name)
        refreshAllExplorers()
        return 'вњ… Created folder **' + name + '** on Desktop'
      } catch(e) { return 'вќЊ Could not create folder' }
    }

    // --- Rename ---
    if (lower.includes('rename ') || lower.includes('rename file')) {
      const m = input.match(/rename\s+(.+?)\s+to\s+(.+)/i)
      if (m) {
        const oldName = m[1].trim(), newName = m[2].trim()
        const fs = getFS()
        for (const dir of Object.keys(fs)) {
          const f = fs[dir].find(x => x.name.toLowerCase() === oldName.toLowerCase())
          if (f) { renameItem(dir, f.name, newName); refreshAllExplorers(); return `вњ… Renamed **${oldName}** в†’ **${newName}**` }
        }
        return `вќЊ File "${oldName}" not found`
      }
      return 'Usage: rename [oldname] to [newname]'
    }

    // --- Market search ---
    if (lower.includes('search market') || lower.includes('find app') || lower.includes('install ')) {
      const installMatch = lower.match(/install\s+(.+)/)
      const searchQuery = installMatch ? installMatch[1].trim() : lower.replace(/search market|find app|find /gi, '').trim()
      if (searchQuery) {
        const found = MARKET_APPS.filter(a => a.label.toLowerCase().includes(searchQuery) || a.desc.toLowerCase().includes(searchQuery) || a.cat.toLowerCase().includes(searchQuery))
        if (found.length === 0) return `рџ”Ќ No apps matching "${searchQuery}" in Market`
        if (found.length === 1 && installMatch) {
          // Install directly
          const ids = getInstalledIds()
          if (ids.includes(found[0].id)) return `вњ… **${found[0].label}** is already installed`
          ids.push(found[0].id); saveInstalledIds(ids); refreshAllExplorers(); initDesktop()
          return `вњ… Installed **${found[0].label}**! Find it on your Desktop or Start Menu`
        }
        let result = `рџ”Ќ Found ${found.length} app(s):<br>`
        found.forEach(a => result += `${a.ico} **${a.label}** вЂ” ${a.cat}<br>`)
        result += '<br>Use `install [app name]` to install one'
        return result
      }
    }

    // --- My apps ---
    if (lower.includes('my apps') || lower.includes('installed') || lower.includes('applications')) {
      const ids = getInstalledIds()
      if (!ids.length) return "рџ“¦ You haven't installed any apps yet. Try `search market` or `install [name]`"
      const names = ids.map(id => { const a = MARKET_APPS.find(m => m.id === id); return a ? a.ico + ' ' + a.label : id }).join('<br>')
      return 'рџ“¦ Your installed apps:<br>' + names
    }

    // --- Joke ---
    if (lower.includes('joke') || lower.includes('funny') || lower.includes('laugh')) {
      const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs! рџђ›",
        "What do you call a fake noodle? An **impasta**! рџЌќ",
        "Why did the developer go broke? He used up all his cache! рџ’ё",
        "I told my computer I needed a break. Now it won't stop sending vacation ads.",
        "Why was the JS developer sad? He didn't know how to `null` his feelings.",
        "Why do Java developers wear glasses? Because they can't C#!",
        "How many programmers does it take to change a light bulb? None вЂ” that's a hardware problem.",
        "What's a computer's favorite snack? Microchips! рџЌџ",
        "Why did the CSS developer leave? They didn't get enough **margin**.",
        "AI: **A**lways **I**mproving! рџ„"
      ]
      return 'рџ‚ ' + jokes[Math.floor(Math.random() * jokes.length)]
    }

    // --- Greetings ---
    if (lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'sup' || lower === 'yo') {
      const greets = [
        "Hey there! What can I help with?",
        "Hello! Ready for action. Try `help` for ideas.",
        "Hi! I can open apps, manage files, tell time, and more.",
        "Hey! Need something? Just ask.",
        "Hello, " + (currentUser || 'friend') + "! How can I assist?"
      ]
      return greets[Math.floor(Math.random() * greets.length)]
    }

    // --- Who are you ---
    if (lower.includes('who are you') || lower.includes('what are you') || lower.includes('your name')) {
      return "I'm **Kilton AI**, version 2.0 вЂ” your built-in OS assistant.<br><br>рџ§  I can open apps, manage files & folders, do math, search files, find & install Market apps, control windows, tell jokes, and more.<br><br>Type `help` for a full list!"
    }

    // --- How are you ---
    if (lower.includes('how are you') || lower.includes('how\'s it going') || lower.includes('how do you')) {
      const states = ["I'm doing great! How about you?", "All systems operational! рџЉ", "Running smoothly! Thanks for asking.", "Busy as always, but happy to help!"]
      return states[Math.floor(Math.random() * states.length)]
    }

    // --- Thanks ---
    if (lower.includes('thank') || lower.includes('thanks') || lower.includes('thx')) {
      return "You're welcome! рџЉ Anything else?"
    }

    // --- Goodbye ---
    if (lower.includes('bye') || lower.includes('goodbye') || lower.includes('see you') || lower.includes('cya')) {
      return "Bye! Come back anytime. рџ‘‹"
    }

    // --- Help ---
    if (lower === 'help' || lower === '?' || lower.includes('help') || lower.includes('commands') || lower.includes('what can you')) {
      return `рџ¤– **Kilton AI вЂ” Help**<br><br>
рџ“± **Apps:** open [app], close [app], minimize [app], install [app]<br>
рџ“Ѓ **Files:** list files, read [file], find [query], create file [name], delete [name], rename [old] to [new]<br>
рџ“‚ **Folders:** create folder [name], list files<br>
рџ§® **Math:** calculate [expression], what is [expression]<br>
рџ›’ **Market:** search market [query], install [app], my apps<br>
рџ’» **System:** system info, time, date<br>
рџЋ® **Fun:** joke, hello, bye<br><br>
<i>I understand natural language! Try: "open browser and tell me the time"</i>`
    }

    // --- Default: fallback ---
    return "рџ¤” I'm not sure how to respond to that.<br><br>Try: `open browser`, `list files`, `create file note.txt`, `joke`, `system info`, `install snake`, or `help`."
  }

  // Handle chained commands
  function processInput(input) {
    const parts = input.split(/ and | then |, /i).filter(Boolean)
    if (parts.length > 1) {
      let result = ''
      parts.forEach((p, i) => {
        const r = aiRespond(p.trim())
        if (i > 0) result += '<br><br>'
        result += r
      })
      return result
    }
    return aiRespond(input)
  }

  // Typing indicator
  function showTyping() {
    const el = document.createElement('div')
    el.className = 'chat-msg ai'
    el.id = 'typingIndicator'
    el.innerHTML = '<span style="opacity:.5">рџ¤– thinking</span><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span>'
    msgsEl.appendChild(el)
    msgsEl.scrollTop = msgsEl.scrollHeight
  }
  function hideTyping() { const el = document.getElementById('typingIndicator'); if (el) el.remove() }

  addMsg('ai', "Hello! I'm **Kilton AI v2**. I can open apps, manage files, do math, search the Market, and more. Try typing `help` to see everything I can do!")

  function handleSend() {
    const text = inputEl.value.trim()
    if (!text) return
    addMsg('user', text)
    inputEl.value = ''
    showTyping()
    setTimeout(() => {
      hideTyping()
      if (text.toLowerCase() === 'clear') { msgsEl.innerHTML = ''; return }
      const resp = processInput(text)
      // Format code blocks
      const formatted = resp.replace(/```(\w*)
?([\s\S]*?)```/g, '<div style="background:#1a1a2e;padding:8px 12px;border-radius:4px;font-family:monospace;font-size:11px;color:#8f8;margin:4px 0;white-space:pre;overflow-x:auto">$2</div>')
      addMsg('ai', formatted)
    }, 300 + Math.random() * 500)
  }

  clearBtn.addEventListener('click', () => { msgsEl.innerHTML = ''; addMsg('ai', 'Chat cleared. Need anything?') })
  sendBtn.addEventListener('click', handleSend)
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend() })
  inputEl.focus()
}

// --- Clock ---
function updateClock() {
  const now = new Date()
  const timeStr = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})
  const dateStr = now.toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'})
  const dayStr = now.toLocaleDateString([], {weekday:'long'})
  document.querySelector('#clock .time').textContent = timeStr
  document.querySelector('#clock .date').textContent = dateStr
  document.getElementById('popupTime').textContent = now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})
  document.getElementById('popupDate').textContent = dayStr + ', ' + dateStr
}

function toggleClockPopup() {
  STATE.clockOpen = !STATE.clockOpen
  document.getElementById('clockPopup').classList.toggle('open', STATE.clockOpen)
  if (STATE.clockOpen && STATE.startOpen) toggleStartMenu()
}

// --- Context Menu ---
function renderContextMenu(menu, items) {
  menu.innerHTML = ''
  items.forEach(item => {
    if (item.divider) { const d = document.createElement('div'); d.className='ctxDivider'; menu.appendChild(d); return }
    const btn = document.createElement('button')
    btn.className = 'ctxItem'
    btn.innerHTML = `<span>${item.ico}</span>${item.label}`
    if (item.shortcut) btn.innerHTML += `<span class="shortcut">${item.shortcut}</span>`
    btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.remove('open'); if (item.fn) item.fn() })
    menu.appendChild(btn)
  })
}

function positionContextMenu(menu, x, y) {
  menu.classList.add('open')
  menu.style.left = Math.min(x, window.innerWidth - 170) + 'px'
  menu.style.top = Math.min(y, window.innerHeight - 60 - 40) + 'px'
}

function showContextMenu(x, y) {
  const menu = document.getElementById('ctxMenu')
  const items = [
    {ico:'рџ“Ѓ', label:'New Folder', fn:() => {
      const name = prompt('Folder name:')
      if (name && name.trim()) { createFolder('Desktop', name.trim()); refreshAllExplorers() }
    }},
    {ico:'рџ“„', label:'New Text Document', fn:() => {
      createFile('Desktop', 'New Document.txt', 'text', ''); refreshAllExplorers()
    }},
    {ico:'рџ”·', label:'New JavaScript File', fn:() => {
      createFile('Desktop', 'script.js', 'text', ''); refreshAllExplorers()
    }},
    {ico:'рџЊђ', label:'New HTML File', fn:() => {
      createFile('Desktop', 'page.html', 'text', '<!DOCTYPE html>
<html>
<head><title>Page</title></head>
<body>

</body>
</html>'); refreshAllExplorers()
    }},
    {ico:'рџЋЁ', label:'New CSS File', fn:() => {
      createFile('Desktop', 'style.css', 'text', '/* styles */'); refreshAllExplorers()
    }},
    {ico:'рџ“‹', label:'New JSON File', fn:() => {
      createFile('Desktop', 'data.json', 'text', '{}'); refreshAllExplorers()
    }},
    {ico:'рџ“', label:'New Markdown File', fn:() => {
      createFile('Desktop', 'readme.md', 'text', '# Title
'); refreshAllExplorers()
    }},
    {ico:'рџђЌ', label:'New Python File', fn:() => {
      createFile('Desktop', 'script.py', 'text', '# Python script
'); refreshAllExplorers()
    }},
    {ico:'рџ“', label:'New Word Document', fn:() => {
      createWordDoc('Desktop', 'New Document.docx')
    }},
    {divider:true},
    {ico:'рџ“‹', label:'Paste', fn:() => {
      if (!CLIPBOARD.mode || !CLIPBOARD.srcDir || !CLIPBOARD.name) { showToast('Nothing to paste'); return }
      if (CLIPBOARD.mode === 'copy') copyItem(CLIPBOARD.srcDir, CLIPBOARD.name, 'Desktop')
      else moveItem(CLIPBOARD.srcDir, CLIPBOARD.name, 'Desktop')
      CLIPBOARD.mode = null; CLIPBOARD.srcDir = null; CLIPBOARD.name = null
      document.querySelectorAll('[data-d="paste"]').forEach(b => b.style.display = 'none')
      showToast('Pasted successfully'); refreshAllExplorers()
    }},
    {divider:true},
    {ico:'рџ”„', label:'Refresh'},
    {ico:'рџЋЁ', label:'Change Background', fn:() => showToast('Background change coming soon')},
  ]
  renderContextMenu(menu, items)
  positionContextMenu(menu, x, y)
}

// --- Toast ---
function showToast(msg) {
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  const t = document.createElement('div')
  t.className = 'toast'
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => { t.classList.add('fade'); setTimeout(() => t.remove(), 300) }, 2000)
}

// --- Auth System ---
const AUTH_KEY = 'kilton_users'
const SESSION_KEY = 'kilton_session'
let currentUser = null

function getUsers() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || {} } catch(e) { return {} }
}

function saveUsers(users) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(users)) } catch(e) {}
}

function setSession(user) {
  currentUser = user
  try { localStorage.setItem(SESSION_KEY, user) } catch(e) {}
  const nameEl = document.getElementById('startUserName')
  if (nameEl) nameEl.textContent = user
  const avEl = document.getElementById('startAvatar')
  if (avEl) avEl.textContent = user.charAt(0).toUpperCase()
}

function clearSession() {
  currentUser = null
  try { localStorage.removeItem(SESSION_KEY) } catch(e) {}
}

function checkSession() {
  try {
    const s = localStorage.getItem(SESSION_KEY)
    if (s) { setSession(s); return true }
  } catch(e) {}
  return false
}

function initAuth() {
  const screen = document.getElementById('loginScreen')
  const userField = document.getElementById('loginUser')
  const passField = document.getElementById('loginPass')
  const errorEl = document.getElementById('loginError')
  const loginBtn = document.getElementById('loginBtn')
  const toggle = document.getElementById('loginToggle')
  const capsWarn = document.getElementById('capsWarn')
  let isRegister = false

  // Caps lock detection
  function checkCaps(e) {
    capsWarn.style.display = e.getModifierState && e.getModifierState('CapsLock') ? 'block' : 'none'
  }
  passField.addEventListener('keydown', checkCaps)
  passField.addEventListener('keyup', checkCaps)

  function doAuth() {
    const user = userField.value.trim()
    const pass = passField.value
    if (!user || !pass) { errorEl.textContent = 'Fill in both fields'; return }
    const users = getUsers()
    if (isRegister) {
      if (users[user]) { errorEl.textContent = 'Username already taken'; return }
      if (user.length < 2) { errorEl.textContent = 'Username too short (min 2)'; return }
      if (pass.length < 3) { errorEl.textContent = 'Password too short (min 3)'; return }
      users[user] = pass
      saveUsers(users)
      setSession(user)
      screen.classList.add('hidden')
      startDesktop()
    } else {
      if (!users[user]) { errorEl.textContent = 'User not found'; return }
      if (users[user] !== pass) { errorEl.textContent = 'Wrong password'; return }
      setSession(user)
      screen.classList.add('hidden')
      startDesktop()
    }
  }

  loginBtn.addEventListener('click', doAuth)

  userField.addEventListener('keydown', e => { if (e.key === 'Enter') passField.focus() })
  passField.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth() })

  toggle.addEventListener('click', () => {
    isRegister = !isRegister
    loginBtn.textContent = isRegister ? 'Create Account' : 'Sign In'
    toggle.textContent = isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"
    errorEl.textContent = ''
    capsWarn.style.display = 'none'
  })

  // If already logged in, skip
  if (checkSession()) {
    screen.classList.add('hidden')
    startDesktop()
  } else {
    // Make sure login is visible
    screen.classList.remove('hidden')
    userField.focus()
  }
}

// --- Virtual File System ---
function getFSKey() { return 'kilton_fs_' + (currentUser || 'default') }

function getDefaultFS() {
  return { 'Desktop': [], 'Documents': [], 'Downloads': [], 'Pictures': [], 'Music': [] }
}

function initFS() {
  try { if (!localStorage.getItem(getFSKey())) saveFS(getDefaultFS()) } catch(e) {}
}

function getFS() {
  try { return JSON.parse(localStorage.getItem(getFSKey())) || getDefaultFS() } catch(e) { return getDefaultFS() }
}

function saveFS(fs) {
  try { localStorage.setItem(getFSKey(), JSON.stringify(fs)) } catch(e) {}
}

function ensureDir(fs, dir) { if (!fs[dir]) fs[dir] = []; return fs }

function listDir(dir) { const fs = getFS(); return fs[dir] || [] }

function createFile(dir, name, type, content) {
  const fs = getFS(); ensureDir(fs, dir)
  if (fs[dir].some(f => f.name === name)) { showToast('Already exists'); return false }
  fs[dir].push({ name, type: type || 'text', content: content || '', size: (content||'').length, modified: new Date().toISOString() })
  saveFS(fs); return true
}

function createFolder(dir, name) {
  const fs = getFS(); ensureDir(fs, dir)
  if (fs[dir].some(f => f.name === name)) { showToast('Already exists'); return false }
  fs[dir].push({ name, type: 'folder', content: '', size: 0, modified: new Date().toISOString() })
  saveFS(fs); return true
}

function deleteItem(dir, name) {
  const fs = getFS(); if (!fs[dir]) return false
  fs[dir] = fs[dir].filter(f => f.name !== name)
  // Clean up orphaned subfolder keys
  const prefix = dir + '/' + name
  Object.keys(fs).filter(k => k === prefix || k.startsWith(prefix + '/')).forEach(k => delete fs[k])
  saveFS(fs); return true
}

function renameItem(dir, oldName, newName) {
  const fs = getFS(); if (!fs[dir]) return false
  const item = fs[dir].find(f => f.name === oldName); if (!item) return false
  if (fs[dir].some(f => f.name === newName && f !== item)) { showToast('Name taken'); return false }
  item.name = newName; item.modified = new Date().toISOString(); saveFS(fs); return true
}

function moveItem(srcDir, name, dstDir) {
  const fs = getFS(); if (!fs[srcDir]) return false
  const idx = fs[srcDir].findIndex(f => f.name === name); if (idx === -1) return false
  const item = fs[srcDir].splice(idx, 1)[0]
  ensureDir(fs, dstDir)
  if (fs[dstDir].some(f => f.name === name)) { fs[srcDir].push(item); showToast('Name exists in destination'); return false }
  fs[dstDir].push(item); saveFS(fs); return true
}

function copyItem(srcDir, name, dstDir) {
  const fs = getFS(); if (!fs[srcDir]) return false
  const item = fs[srcDir].find(f => f.name === name); if (!item) return false
  ensureDir(fs, dstDir)
  let newName = name; let cnt = 1
  while (fs[dstDir].some(f => f.name === newName)) { const p = name.lastIndexOf('.'); newName = p > 0 ? name.slice(0,p)+' ('+cnt+')'+name.slice(p) : name+' ('+cnt+')'; cnt++ }
  const copy = JSON.parse(JSON.stringify(item)); copy.name = newName; copy.modified = new Date().toISOString()
  // If it's a folder, copy its children too
  if (item.type === 'folder') {
    const childKeys = Object.keys(fs).filter(k => k.startsWith(srcDir+'/'+name))
    childKeys.forEach(k => { const suffix = k.slice((srcDir+'/'+name).length); fs[dstDir+'/'+newName+suffix] = JSON.parse(JSON.stringify(fs[k])) })
  }
  fs[dstDir].push(copy); saveFS(fs); return true
}

function getParentDir(path) { const i = path.lastIndexOf('/'); return i > 0 ? path.slice(0, i) : path.split('/')[0] }

function isSubfolder(fs, dir) { return !['Desktop','Documents','Downloads','Pictures','Music'].includes(dir) }

const CLIPBOARD = { mode: null, srcDir: null, name: null }

// --- CRC-32 for ZIP ---
function crc32(data) {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

// --- Create ZIP blob (store method) ---
function createZipBlob(files) {
  // files: [{name: "path/in/zip.txt", data: Uint8Array}, ...]
  const localHeaders = [], centralEntries = [], allData = []
  let offset = 0
  const encoder = new TextEncoder()
  files.forEach(f => {
    const nameBytes = encoder.encode(f.name)
    const crc = crc32(f.data)
    const sz = f.data.length
    // Local file header
    const lh = new ArrayBuffer(30 + nameBytes.length)
    const lv = new DataView(lh)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0, true)
    lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0, true)
    lv.setUint32(14, crc, true); lv.setUint32(18, sz, true); lv.setUint32(22, sz, true)
    lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true)
    new Uint8Array(lh).set(nameBytes, 30)
    localHeaders.push(new Uint8Array(lh))
    allData.push(f.data)
    // Central directory entry
    const ce = new ArrayBuffer(46 + nameBytes.length)
    const cv = new DataView(ce)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true); cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0, true)
    cv.setUint32(16, crc, true); cv.setUint32(20, sz, true); cv.setUint32(24, sz, true)
    cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true)
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true)
    cv.setUint32(42, offset, true)
    new Uint8Array(ce).set(nameBytes, 46)
    centralEntries.push(new Uint8Array(ce))
    offset += 30 + nameBytes.length + sz
  })
  const centralSize = centralEntries.reduce((s, e) => s + e.length, 0)
  const centralOffset = localHeaders.reduce((s, e) => s + e.length, 0) + allData.reduce((s, e) => s + e.length, 0)
  // End of central directory
  const ecd = new ArrayBuffer(22)
  const ev = new DataView(ecd)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true)
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true)
  ev.setUint32(12, centralSize, true); ev.setUint32(16, centralOffset, true); ev.setUint16(20, 0, true)
  // Combine
  const parts = [...localHeaders, ...allData, ...centralEntries, new Uint8Array(ecd)]
  const total = parts.reduce((s, p) => s + p.length, 0)
  const result = new Uint8Array(total)
  let pos = 0
  parts.forEach(p => { result.set(p, pos); pos += p.length })
  return new Blob([result], { type: 'application/zip' })
}

// --- Compress folder/files to ZIP ---
function compressToZip(dir, name) {
  const fs = getFS();
  const items = fs[dir] || [];
  const target = items.find(f => f.name === name);
  if (!target) { showToast('Not found'); return }
  const entries = [];
  function collect(path, prefix) {
    const list = fs[path] || [];
    list.forEach(item => {
      const zipName = prefix ? prefix + '/' + item.name : item.name
      if (item.type === 'folder') {
        collect(path + '/' + item.name, zipName)
      } else {
        const content = item.content || ''
        const data = content.startsWith('data:') ? dataURLtoUint8(content) : new TextEncoder().encode(content)
        entries.push({ name: zipName, data })
      }
    })
  }
  if (target.type === 'folder') {
    collect(dir + '/' + name, name)
  } else {
    const content = target.content || ''
    const data = content.startsWith('data:') ? dataURLtoUint8(content) : new TextEncoder().encode(content)
    entries.push({ name, data })
  }
  if (!entries.length) { showToast('Nothing to compress'); return }
  const blob = createZipBlob(entries)
  const reader = new FileReader()
  reader.onload = e => {
    createFile(dir, name + '.zip', 'image', e.target.result)
    showToast('Created: ' + name + '.zip'); refreshAllExplorers()
  }
  reader.readAsDataURL(blob)
}

function dataURLtoUint8(dataURL) {
  const parts = dataURL.split(',')
  const raw = atob(parts[1])
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return buf
}

// --- Create minimal DOCX ---
function createDocxBlob(title) {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const xml = (name, content) => ({ name, data: new TextEncoder().encode(content) })
  const files = [
    xml('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`),
    xml('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    xml('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    xml('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${esc(title||'New Document')}</w:t></w:r></w:p></w:body></w:document>`),
    xml('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="200" w:line="276"/></w:pPr><w:rPr><w:sz w:val="24"/></w:rPr></w:style></w:styles>`)
  ]
  return createZipBlob(files)
}

// --- Create Word document in FS ---
function createWordDoc(dir, name) {
  const title = name.replace(/\.docx$/i, '')
  const blob = createDocxBlob(title)
  const reader = new FileReader()
  reader.onload = e => {
    createFile(dir, name, 'image', e.target.result)
    showToast('Created: ' + name); refreshAllExplorers()
  }
  reader.readAsDataURL(blob)
}

function getFileIcon(type, name) {
  if (type === 'folder') return 'рџ“Ѓ'
  const ext = (name||'').split('.').pop().toLowerCase()
  const m = { txt:'рџ“„',md:'рџ“„',js:'рџ“„',py:'рџђЌ',html:'рџЊђ',css:'рџЋЁ',json:'рџ“‹',xml:'рџ“‹',jpg:'рџ–јпёЏ',jpeg:'рџ–јпёЏ',png:'рџ–јпёЏ',gif:'рџ–јпёЏ',svg:'рџ–јпёЏ',ico:'рџ–јпёЏ',webp:'рџ–јпёЏ',mp3:'рџЋµ',wav:'рџЋµ',ogg:'рџЋµ',flac:'рџЋµ',mp4:'рџЋ¬',avi:'рџЋ¬',mkv:'рџЋ¬',webm:'рџЋ¬',mov:'рџЋ¬',zip:'рџ“¦',rar:'рџ“¦',exe:'вљ™пёЏ',app:'рџ“¦',pdf:'рџ“•',doc:'рџ“',docx:'рџ“',xls:'рџ“Љ',xlsx:'рџ“Љ' }
  return m[ext] || 'рџ“„'
}

function formatSize(bytes) { if (!bytes) return ''; if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB'; return (bytes/1048576).toFixed(1) + ' MB' }

// --- Register built-in apps ---
REGISTERED_APPS['market'] = launchMarket
REGISTERED_APPS['ai'] = launchAI
REGISTERED_APPS['calculator'] = launchCalculator
REGISTERED_APPS['notepad'] = launchNotepad
REGISTERED_APPS['explorer'] = launchExplorer
REGISTERED_APPS['computer'] = launchExplorer
REGISTERED_APPS['about'] = launchAbout
REGISTERED_APPS['browser'] = launchBrowser

// --- Desktop Start (after auth) ---
function startDesktop() {
  // Show loading overlay
  const loadEl = document.getElementById('loading')
  loadEl.classList.remove('hidden')

  initFS()
  initDesktop()
  initBgCanvas()
  initStartMenu()
  updateClock()
  setInterval(updateClock, 1000)

  // Start button
  document.getElementById('startBtn').addEventListener('click', toggleStartMenu)

  // Clock popup
  document.getElementById('clock').addEventListener('click', toggleClockPopup)

  // Close menus on outside click
  document.addEventListener('click', e => {
    if (STATE.startOpen && !e.target.closest('#startMenu') && !e.target.closest('#startBtn')) {
      STATE.startOpen = false; document.getElementById('startMenu').classList.remove('open')
    }
    if (STATE.clockOpen && !e.target.closest('#clockPopup') && !e.target.closest('#clock')) {
      STATE.clockOpen = false; document.getElementById('clockPopup').classList.remove('open')
    }
    if (!e.target.closest('#ctxMenu') && e.button === 0) {
      document.getElementById('ctxMenu').classList.remove('open')
    }
  })

  // Right-click on desktop
  document.getElementById('desktop').addEventListener('contextmenu', e => {
    e.preventDefault()
    showContextMenu(e.clientX, e.clientY)
  })

  // Double-click on desktop background to open computer
  document.getElementById('desktop').addEventListener('dblclick', e => {
    if (e.target === e.currentTarget || e.target.tagName === 'CANVAS') {
      launchApp('explorer')
    }
  })

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (STATE.startOpen) { toggleStartMenu() }
      if (STATE.clockOpen) { toggleClockPopup() }
      document.getElementById('ctxMenu').classList.remove('open')
    }
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); launchApp('notepad') }
    if (e.ctrlKey && e.key === 'e') { e.preventDefault(); launchApp('explorer') }
    if (e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); launchApp('ai') }
  })

  // Loading animation
  const bar = document.getElementById('loadBar')
  let pct = 0
  const iv = setInterval(() => {
    pct += Math.random() * 15 + 5
    if (pct > 100) pct = 100
    bar.style.width = pct + '%'
    if (pct >= 100) {
      clearInterval(iv)
      setTimeout(() => {
        loadEl.classList.add('hidden')
        showToast('Welcome, ' + currentUser)
      }, 300)
    }
  }, 100)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAuth)
else initAuth()

})()

