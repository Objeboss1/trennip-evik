import './style.css'
import { supabase } from './supabaseClient.js'

const MONTHS = [
  'jaanuar',
  'veebruar',
  'märts',
  'aprill',
  'mai',
  'juuni',
  'juuli',
  'august',
  'september',
  'oktoober',
  'november',
  'detsember',
]

const WEEKDAYS = [
  'pühapäev',
  'esmaspäev',
  'teisipäev',
  'kolmapäev',
  'neljapäev',
  'reede',
  'laupäev',
]

const WENT = new Set(['Jooksmine', 'Jõusaal', 'Mõlemad'])
const LEGACY_FLAG = 'treeningpaevik-imporditud'
const PLAN_ROWS = 10

const monthLabel = document.querySelector('#month-label')
const days = document.querySelector('#days')
const calendar = document.querySelector('#calendar')
const bodyViews = document.querySelector('.body-views')
const muscleView = document.querySelector('#muscle')
const dayView = document.querySelector('#day')
const dayLabel = document.querySelector('#day-label')
const choiceButtons = [...document.querySelectorAll('[data-choice]')]
const nowLabel = document.querySelector('#now')
const muscleTitle = document.querySelector('#muscle-title')
const muscleExercises = document.querySelector('#muscle-exercises')
const muscleReps = document.querySelector('#muscle-reps')
const editSpotsButton = document.querySelector('#edit-spots')
const spotTools = document.querySelector('#spot-tools')
const saveSpotsButton = document.querySelector('#save-spots')
const spotView = document.querySelector('#spot-view')
const planCells = document.querySelector('#plan-cells')
const nutrition = document.querySelector('#nutrition')
const authGate = document.querySelector('#auth-gate')
const authForm = document.querySelector('#auth-form')
const authLoading = document.querySelector('#auth-loading')
const authEmail = document.querySelector('#auth-email')
const authPassword = document.querySelector('#auth-password')
const authError = document.querySelector('#auth-error')
const diary = document.querySelector('#diary')
const accountEmail = document.querySelector('#account-email')
const saveStatus = document.querySelector('#save-status')

const originalShots = [...document.querySelectorAll('.shot')].map((shot) => ({
  view: shot.dataset.view,
  html: shot.innerHTML,
}))

const today = new Date()
let year = today.getFullYear()
let month = today.getMonth()
let openKey = ''
let todayStamp = ''
const choices = {}
let muscles = {}
let openMuscle = ''
let openSpot = null
let movingSpots = false
let spotMoved = false
let planCellsData = normalizePlan(null)
let currentUser = null
let diaryReady = false
let loadSeq = 0
let loadingUserId = ''
let saveTimer = 0
let saveQueue = Promise.resolve()

function monthTitle(value) {
  return value.charAt(0).toLocaleUpperCase('et') + value.slice(1)
}

function dateKey(day) {
  const monthNumber = String(month + 1).padStart(2, '0')
  const dayNumber = String(day).padStart(2, '0')
  return `${year}-${monthNumber}-${dayNumber}`
}

function stampFromDate(date) {
  const monthNumber = String(date.getMonth() + 1).padStart(2, '0')
  const dayNumber = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${monthNumber}-${dayNumber}`
}

function isPast(key) {
  return key < todayStamp
}

function formatNow(date) {
  const weekday = monthTitle(WEEKDAYS[date.getDay()])
  const clock = date.toLocaleTimeString('et-EE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return `${weekday}, ${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()} ${clock}`
}

function tick() {
  const date = new Date()
  const stamp = stampFromDate(date)
  nowLabel.textContent = formatNow(date)
  if (stamp === todayStamp) return
  todayStamp = stamp
  if (!dayView.hidden && isPast(openKey)) {
    for (const button of choiceButtons) button.disabled = true
  }
  if (!calendar.hidden) render()
}

function markClass(choice) {
  if (WENT.has(choice)) return ' day-went'
  if (choice === 'Ei käinud') return ' day-missed'
  return ''
}

function render() {
  monthLabel.textContent = `${monthTitle(MONTHS[month])} ${year}`

  const leading = (new Date(year, month, 1).getDay() + 6) % 7
  const count = new Date(year, month + 1, 0).getDate()
  const trailing = (7 - ((leading + count) % 7)) % 7
  const cells = []

  for (let index = 0; index < leading + count + trailing; index += 1) {
    if (index % 7 === 0) cells.push('<tr>')
    const date = index - leading + 1
    if (date < 1 || date > count) {
      cells.push('<td class="day-empty"></td>')
    } else {
      const key = dateKey(date)
      const mark = markClass(choices[key])
      if (isPast(key)) {
        cells.push(`<td class="day day-past${mark}">${date}</td>`)
      } else {
        cells.push(
          `<td class="day${mark}"><button type="button" class="day-button" data-date="${key}">${date}</button></td>`,
        )
      }
    }
    if (index % 7 === 6) cells.push('</tr>')
  }

  days.innerHTML = cells.join('')
}

function showCalendar() {
  dayView.hidden = true
  muscleView.hidden = true
  bodyViews.hidden = false
  calendar.hidden = false
  render()
}

function showDay(key) {
  if (isPast(key)) return
  openKey = key
  const [dateYear, dateMonth, dateDay] = key.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(dateYear, dateMonth - 1, dateDay).getDay()]
  dayLabel.textContent = `${monthTitle(weekday)}, ${dateDay}. ${MONTHS[dateMonth - 1]} ${dateYear}`
  for (const button of choiceButtons) {
    button.disabled = false
    button.setAttribute('aria-pressed', String(button.dataset.choice === choices[key]))
  }
  dayView.hidden = false
}

function cacheKey(userId) {
  return `treeningpaevik-kasutaja:${userId}`
}

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function emptyPlanColumn() {
  return {
    title: '',
    rows: Array.from({ length: PLAN_ROWS }, () => ({ text: '', reps: '' })),
  }
}

function normalizePlan(saved) {
  if (!Array.isArray(saved) || saved.length !== 3) {
    return [emptyPlanColumn(), emptyPlanColumn(), emptyPlanColumn()]
  }
  return saved.map((column) => {
    const source = Array.isArray(column) ? column : column?.rows
    const title = Array.isArray(column) ? '' : column?.title || ''
    return {
      title,
      rows: Array.from({ length: PLAN_ROWS }, (_, index) => ({
        text: source?.[index]?.text || '',
        reps: source?.[index]?.reps || '',
      })),
    }
  })
}

function planHasContent(plan) {
  return normalizePlan(plan).some(
    (column) =>
      column.title.trim() ||
      column.rows.some((row) => row.text.trim() || row.reps.trim()),
  )
}

function diaryHasContent(data) {
  if (!data || typeof data !== 'object') return false
  if (data.choices && typeof data.choices === 'object' && Object.keys(data.choices).length) return true
  if (data.muscles && typeof data.muscles === 'object') {
    const filled = Object.values(data.muscles).some(
      (entry) => (entry?.exercises || '').trim() || (entry?.reps || '').trim(),
    )
    if (filled) return true
  }
  if (data.layout?.spots?.length) return true
  if (data.places && typeof data.places === 'object' && Object.keys(data.places).length) return true
  if (typeof data.nutrition === 'string' && data.nutrition.trim()) return true
  if (planHasContent(data.plan)) return true
  return false
}

function readLegacyDiary() {
  if (localStorage.getItem(LEGACY_FLAG)) return null
  const legacy = {
    choices: readJson('treeningpaevik') || {},
    muscles: readJson('treeningpaevik-lihased') || {},
    layout: readJson('treeningpaevik-paigutus'),
    places: readJson('treeningpaevik-kohad'),
    plan: readJson('treeningpaevik-kava'),
    nutrition: localStorage.getItem('treeningpaevik-toitumine') || '',
  }
  if (!diaryHasContent(legacy)) {
    localStorage.setItem(LEGACY_FLAG, '1')
    return null
  }
  return legacy
}

function setAuthError(message) {
  authError.hidden = !message
  authError.textContent = message || ''
}

function setSaveStatus(message) {
  saveStatus.hidden = !message
  saveStatus.textContent = message || ''
}

function authMessage(error) {
  const code = error?.code || ''
  const message = error?.message || ''
  if (code === 'invalid_credentials' || /invalid login/i.test(message)) {
    return 'Vale e-post või parool.'
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return 'See e-post on juba kasutusel. Logi sisse.'
  }
  if (code === 'weak_password' || /password/i.test(message)) {
    return 'Parool peab olema vähemalt 6 märki.'
  }
  if (/email/i.test(message)) return 'Kontrolli e-posti aadressi.'
  return 'Sisselogimine ei õnnestunud. Proovi uuesti.'
}

function cloudSaveMessage(error) {
  const code = error?.code || ''
  const message = error?.message || ''
  if (code === 'PGRST205' || /schema cache/i.test(message) || /Could not find the table/i.test(message)) {
    return 'Salvestatud selles brauseris. Teises seadmes seda veel näha ei ole.'
  }
  return 'Salvestatud selles brauseris. Pilve salvestamine ei õnnestunud.'
}

function queueSave(userId, options) {
  const run = saveQueue.then(() => saveDiary(userId, options))
  saveQueue = run.catch(() => {})
  return run
}

function scheduleSave() {
  if (!diaryReady || !currentUser) return
  const userId = currentUser.id
  localStorage.setItem(cacheKey(userId), JSON.stringify(collectDiary()))
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void queueSave(userId)
  }, 300)
}

async function saveDiary(userId, { quiet = false } = {}) {
  if (!currentUser || currentUser.id !== userId || !diaryReady) return
  const payload = readJson(cacheKey(userId)) || collectDiary()
  const { error } = await supabase.from('paevikud').upsert(
    {
      user_id: userId,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (!currentUser || currentUser.id !== userId) return
  if (error) {
    if (!quiet) setSaveStatus(cloudSaveMessage(error))
    return
  }
  setSaveStatus('')
}

function saveChoices() {
  scheduleSave()
}

function saveOpenMuscle() {
  if (!openSpot) return
  renameSpot(openSpot, muscleTitle.value)
  openMuscle = openSpot.dataset.muscle
  muscles[openMuscle] = {
    exercises: muscleExercises.value,
    reps: muscleReps.value,
  }
  scheduleSave()
}

function showMuscle(spot) {
  saveOpenMuscle()
  openSpot = spot
  openMuscle = spot.dataset.muscle
  const entry = muscles[openMuscle] || { exercises: '', reps: '' }
  muscleTitle.value = openMuscle
  muscleExercises.value = entry.exercises || ''
  muscleReps.value = entry.reps || ''
  muscleView.hidden = false
}

document.querySelector('[data-nav="prev"]').addEventListener('click', () => {
  month -= 1
  if (month < 0) {
    month = 11
    year -= 1
  }
  render()
})

document.querySelector('[data-nav="next"]').addEventListener('click', () => {
  month += 1
  if (month > 11) {
    month = 0
    year += 1
  }
  render()
})

days.addEventListener('click', (event) => {
  const button = event.target.closest('[data-date]')
  if (!button || isPast(button.dataset.date)) return
  showDay(button.dataset.date)
})

document.querySelector('#back').addEventListener('click', showCalendar)

for (const button of choiceButtons) {
  button.addEventListener('click', () => {
    if (isPast(openKey)) return
    choices[openKey] = button.dataset.choice
    saveChoices()
    showDay(openKey)
  })
}

function makeSpot({ id, muscle, top, left }) {
  const name = String(muscle || 'Uus')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'spot'
  button.dataset.spot = String(id || `ring-${Date.now()}`)
  button.dataset.muscle = name
  button.title = name
  button.setAttribute('aria-label', name)
  button.style.top = String(top || '50%')
  button.style.left = String(left || '50%')
  return button
}

function collectSpots() {
  return [...document.querySelectorAll('.spot')].map((spot) => ({
    id: spot.dataset.spot,
    muscle: spot.dataset.muscle,
    view: spot.closest('.shot').dataset.view,
    top: spot.style.top,
    left: spot.style.left,
  }))
}

function applySavedLayout(layout) {
  if (!layout?.spots?.length) return
  document.querySelectorAll('.spot').forEach((spot) => spot.remove())
  for (const spot of layout.spots) {
    const shot = document.querySelector(`.shot[data-view="${spot.view}"]`)
    if (shot) shot.append(makeSpot(spot))
  }
}

function applyPlaces(places) {
  if (!places || typeof places !== 'object') return
  for (const spot of document.querySelectorAll('.spot')) {
    const place = places[spot.dataset.spot]
    if (!place) continue
    spot.style.top = place.top
    spot.style.left = place.left
  }
}

function renameSpot(spot, name) {
  const next = name.trim() || 'Uus'
  const previous = spot.dataset.muscle
  if (previous !== next && muscles[previous] && !muscles[next]) {
    muscles[next] = { ...muscles[previous] }
  }
  spot.dataset.muscle = next
  spot.title = next
  spot.setAttribute('aria-label', next)
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, value))
}

bodyViews.addEventListener('click', (event) => {
  const button = event.target.closest('.spot')
  if (!button || spotMoved) {
    spotMoved = false
    return
  }
  showMuscle(button)
})

bodyViews.addEventListener('pointerdown', (event) => {
  const spot = event.target.closest('.spot')
  if (!spot || !movingSpots) return
  spotMoved = false
  event.preventDefault()
  spot.setPointerCapture(event.pointerId)
  spot.dataset.dragging = 'true'
})

bodyViews.addEventListener('pointermove', (event) => {
  const spot = event.target.closest('.spot')
  if (!spot || spot.dataset.dragging !== 'true') return
  spotMoved = true
  const shot = spot.closest('.shot').getBoundingClientRect()
  const left = ((event.clientX - shot.left) / shot.width) * 100
  const top = ((event.clientY - shot.top) / shot.height) * 100
  spot.style.left = `${clampPercent(left)}%`
  spot.style.top = `${clampPercent(top)}%`
})

bodyViews.addEventListener('pointerup', (event) => {
  const spot = event.target.closest('.spot')
  if (!spot) return
  delete spot.dataset.dragging
})

document.querySelector('#add-spot').addEventListener('click', () => {
  const shot = document.querySelector(`.shot[data-view="${spotView.value}"]`)
  const spot = makeSpot({
    id: `ring-${Date.now()}`,
    muscle: 'Uus',
    top: '50%',
    left: '50%',
  })
  shot.append(spot)
  showMuscle(spot)
})

document.querySelector('#delete-open-spot').addEventListener('click', () => {
  if (!openSpot) return
  openSpot.remove()
  openSpot = null
  openMuscle = ''
  scheduleSave()
  muscleView.hidden = true
})

editSpotsButton.addEventListener('click', () => {
  movingSpots = true
  document.body.classList.add('moving-spots')
  editSpotsButton.hidden = true
  spotTools.hidden = false
  muscleView.hidden = true
})

saveSpotsButton.addEventListener('click', () => {
  saveOpenMuscle()
  scheduleSave()
  movingSpots = false
  document.body.classList.remove('moving-spots')
  spotTools.hidden = true
  editSpotsButton.hidden = false
})

document.querySelector('#muscle-back').addEventListener('click', () => {
  saveOpenMuscle()
  openSpot = null
  openMuscle = ''
  muscleView.hidden = true
})

muscleTitle.addEventListener('input', saveOpenMuscle)
muscleExercises.addEventListener('input', saveOpenMuscle)
muscleReps.addEventListener('input', saveOpenMuscle)

function renderPlan() {
  planCells.replaceChildren()
  planCellsData.forEach((column, columnIndex) => {
    const box = document.createElement('div')
    box.className = 'plan-box'
    const title = document.createElement('input')
    title.type = 'text'
    title.className = 'plan-title'
    title.value = column.title
    title.setAttribute('aria-label', 'Pealkiri')
    title.addEventListener('input', () => {
      planCellsData[columnIndex].title = title.value
      scheduleSave()
    })
    box.append(title)
    column.rows.forEach((row, rowIndex) => {
      const line = document.createElement('div')
      line.className = 'plan-row'
      const text = document.createElement('input')
      text.type = 'text'
      text.value = row.text
      const reps = document.createElement('input')
      reps.type = 'text'
      reps.className = 'plan-reps'
      reps.value = row.reps
      reps.setAttribute('aria-label', 'Korduste arv')
      text.addEventListener('input', () => {
        planCellsData[columnIndex].rows[rowIndex].text = text.value
        scheduleSave()
      })
      reps.addEventListener('input', () => {
        planCellsData[columnIndex].rows[rowIndex].reps = reps.value
        scheduleSave()
      })
      line.append(text, reps)
      box.append(line)
    })
    planCells.append(box)
  })
}

document.querySelector('#plan-open').addEventListener('click', () => {
  if (planCells.hidden) renderPlan()
  planCells.hidden = !planCells.hidden
})

nutrition.addEventListener('input', scheduleSave)

function collectDiary() {
  return {
    choices: { ...choices },
    muscles,
    layout: { spots: collectSpots() },
    plan: planCellsData,
    nutrition: nutrition.value,
  }
}

function resetLayoutToDefault() {
  for (const shot of document.querySelectorAll('.shot')) {
    const saved = originalShots.find((item) => item.view === shot.dataset.view)
    if (saved) shot.innerHTML = saved.html
  }
}

function resetTransientUi() {
  dayView.hidden = true
  muscleView.hidden = true
  openSpot = null
  openMuscle = ''
  movingSpots = false
  spotMoved = false
  document.body.classList.remove('moving-spots')
  spotTools.hidden = true
  editSpotsButton.hidden = false
  muscleTitle.value = ''
  muscleExercises.value = ''
  muscleReps.value = ''
}

function applyDiary(data) {
  const source = data && typeof data === 'object' ? data : {}
  const nextChoices =
    source.choices && typeof source.choices === 'object' && !Array.isArray(source.choices)
      ? source.choices
      : {}
  for (const key of Object.keys(choices)) delete choices[key]
  Object.assign(choices, nextChoices)
  muscles = source.muscles && typeof source.muscles === 'object' && !Array.isArray(source.muscles)
    ? source.muscles
    : {}
  if (source.layout?.spots?.length) applySavedLayout(source.layout)
  else applyPlaces(source.places)
  planCellsData = normalizePlan(source.plan)
  planCells.hidden = true
  planCells.replaceChildren()
  nutrition.value = typeof source.nutrition === 'string' ? source.nutrition : ''
  render()
}

function presentDiary(data) {
  resetTransientUi()
  resetLayoutToDefault()
  applyDiary(data || {})
}

function clearDiaryMemory() {
  presentDiary(null)
}

async function loadDiary(userId) {
  const cached = readJson(cacheKey(userId))
  const { data, error } = await supabase
    .from('paevikud')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()

  if (!error && data?.data && typeof data.data === 'object') {
    return { diary: data.data, upload: false, importedLegacy: false, fromServer: true }
  }

  if (cached && typeof cached === 'object') {
    return { diary: cached, upload: !error, importedLegacy: false, fromServer: false }
  }

  const legacy = readLegacyDiary()
  if (legacy) return { diary: legacy, upload: !error, importedLegacy: true, fromServer: false }
  return { diary: null, upload: !error, importedLegacy: false, fromServer: false }
}

function showChecking() {
  diary.hidden = true
  authGate.hidden = false
  authLoading.hidden = false
  authForm.hidden = true
}

function showLogin() {
  const hadUser = Boolean(currentUser)
  loadSeq += 1
  loadingUserId = ''
  diaryReady = false
  currentUser = null
  clearTimeout(saveTimer)
  diary.hidden = true
  authGate.hidden = false
  authLoading.hidden = true
  authForm.hidden = false
  setSaveStatus('')
  if (hadUser) authPassword.value = ''
  clearDiaryMemory()
}

function showDiaryShell(user) {
  accountEmail.textContent = user.email || ''
  authGate.hidden = true
  diary.hidden = false
}

async function enterApp(user) {
  if (currentUser?.id === user.id && (diaryReady || loadingUserId === user.id)) return
  loadingUserId = user.id
  const seq = ++loadSeq
  currentUser = user
  diaryReady = false
  showChecking()
  try {
    const result = await loadDiary(user.id)
    if (seq !== loadSeq || currentUser?.id !== user.id) return
    presentDiary(result.diary)
    if (result.importedLegacy || result.fromServer) localStorage.setItem(LEGACY_FLAG, '1')
    localStorage.setItem(cacheKey(user.id), JSON.stringify(collectDiary()))
    diaryReady = true
    showDiaryShell(user)
    if (result.upload) await queueSave(user.id, { quiet: true })
  } catch {
    if (seq !== loadSeq || currentUser?.id !== user.id) return
    presentDiary(null)
    diaryReady = true
    showDiaryShell(user)
    setSaveStatus('Selles brauseris salvestatud. Pilve salvestamine ei õnnestunud.')
  } finally {
    if (loadingUserId === user.id) loadingUserId = ''
  }
}

function credentials() {
  if (!authForm.reportValidity()) return null
  return {
    email: authEmail.value.trim().toLowerCase(),
    password: authPassword.value,
  }
}

async function withBusy(work) {
  const buttons = [...authForm.querySelectorAll('button')]
  for (const button of buttons) button.disabled = true
  try {
    await work()
  } finally {
    for (const button of buttons) button.disabled = false
  }
}

async function signIn() {
  const creds = credentials()
  if (!creds) return
  setAuthError('')
  try {
    const { error } = await supabase.auth.signInWithPassword(creds)
    if (error) setAuthError(authMessage(error))
  } catch {
    setAuthError('Ühendus ei õnnestunud. Proovi uuesti.')
  }
}

async function signUp() {
  const creds = credentials()
  if (!creds) return
  setAuthError('')
  try {
    const { data, error } = await supabase.auth.signUp({
      email: creds.email,
      password: creds.password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setAuthError(authMessage(error))
      return
    }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setAuthError('See e-post on juba kasutusel. Logi sisse.')
      return
    }
    if (!data.session) setAuthError('Konto on loodud. Kinnita e-post ja logi siis sisse.')
  } catch {
    setAuthError('Ühendus ei õnnestunud. Proovi uuesti.')
  }
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault()
  void withBusy(signIn)
})

document.querySelector('#auth-register').addEventListener('click', () => {
  void withBusy(signUp)
})

document.querySelector('#logout').addEventListener('click', async () => {
  clearTimeout(saveTimer)
  const userId = currentUser?.id
  if (userId && diaryReady) await queueSave(userId)
  await supabase.auth.signOut()
})

window.addEventListener('pagehide', () => {
  if (!currentUser || !diaryReady) return
  localStorage.setItem(cacheKey(currentUser.id), JSON.stringify(collectDiary()))
})

todayStamp = stampFromDate(new Date())
tick()
setInterval(tick, 1000)

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    void enterApp(session.user)
    return
  }
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_OUT') showLogin()
})
