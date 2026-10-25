import './style.css'
import sharedDiary from './shared-diary.json'

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
const UNANSWERED_DARK_BEFORE = '2026-10-25'
const STORAGE_KEY = 'treeningpaevik'

const monthLabel = document.querySelector('#month-label')
const days = document.querySelector('#days')
const calendar = document.querySelector('#calendar')
const bodyViews = document.querySelector('.body-views')
const muscleView = document.querySelector('#muscle')
const dayView = document.querySelector('#day')
const dayLabel = document.querySelector('#day-label')
const choiceButtons = [...document.querySelectorAll('[data-choice]')]
const nowLabel = document.querySelector('#now')
const today = new Date()
let year = today.getFullYear()
let month = today.getMonth()
let openKey = ''
let todayStamp = ''

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

function isToday(key) {
  return key === todayStamp
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
  if (!dayView.hidden && !isToday(openKey)) {
    for (const button of choiceButtons) button.disabled = true
  }
  if (!calendar.hidden) render()
}

function loadChoices() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveChoices(choices) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(choices))
  pushDiary()
}

const choices = loadChoices()

function choiceName(entry) {
  if (!entry) return ''
  if (typeof entry === 'string') return entry
  return entry.choice || ''
}

function choiceDetails(entry) {
  const name = choiceName(entry)
  if (!entry || typeof entry === 'string') {
    return { choice: name, pace: '', amount: '', extra: '', gym: '', gymNote: '' }
  }
  return {
    choice: name,
    pace: entry.pace || '',
    amount: entry.amount || '',
    extra: entry.extra || '',
    gym: entry.gym || '',
    gymNote: entry.gymNote || '',
  }
}

function needsRun(name) {
  return name === 'Jooksmine' || name === 'Mõlemad'
}

function needsGym(name) {
  return name === 'Jõusaal' || name === 'Mõlemad'
}

function markClass(choice) {
  const name = choiceName(choice)
  if (WENT.has(name)) return ' day-went'
  if (name === 'Ei käinud') return ' day-missed'
  return ''
}

function darkClass(key, choice) {
  if (choice || key >= UNANSWERED_DARK_BEFORE) return ''
  return ' day-dark'
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
      const choice = choices[key]
      const mark = markClass(choice)
      const dark = darkClass(key, choice)
      if (isToday(key)) {
        cells.push(
          `<td class="day${mark}"><button type="button" class="day-button" data-date="${key}">${date}</button></td>`,
        )
      } else if (isPast(key)) {
        cells.push(`<td class="day day-past${mark}${dark}">${date}</td>`)
      } else {
        cells.push(`<td class="day day-future${mark}">${date}</td>`)
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
  if (!isToday(key)) return
  openKey = key
  const [dateYear, dateMonth, dateDay] = key.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(dateYear, dateMonth - 1, dateDay).getDay()]
  dayLabel.textContent = `${monthTitle(weekday)}, ${dateDay}. ${MONTHS[dateMonth - 1]} ${dateYear}`
  const name = choiceName(choices[key])
  for (const button of choiceButtons) {
    button.disabled = false
    button.setAttribute('aria-pressed', String(button.dataset.choice === name))
  }
  fillFollowUp(name, choiceDetails(choices[key]))
  dayView.hidden = false
}

const MUSCLE_KEY = 'treeningpaevik-lihased'
const muscleTitle = document.querySelector('#muscle-title')
const muscleExercises = document.querySelector('#muscle-exercises')
const muscleReps = document.querySelector('#muscle-reps')
let muscles = {}
let openMuscle = ''
let openSpot = null

function loadMuscles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MUSCLE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveOpenMuscle() {
  if (!openSpot) return
  renameSpot(openSpot, muscleTitle.value)
  openMuscle = openSpot.dataset.muscle
  muscles[openMuscle] = {
    exercises: muscleExercises.value,
    reps: muscleReps.value,
  }
  localStorage.setItem(MUSCLE_KEY, JSON.stringify(muscles))
  localStorage.setItem(LAYOUT_KEY, JSON.stringify({ spots: collectSpots() }))
  pushDiary()
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
  if (!button || !isToday(button.dataset.date)) return
  const name = choiceName(choices[button.dataset.date])
  followStep = needsRun(name) ? 'run' : 'gym'
  showDay(button.dataset.date)
})

document.querySelector('#back').addEventListener('click', showCalendar)

for (const button of choiceButtons) {
  button.addEventListener('click', () => {
    if (!isToday(openKey)) return
    const name = button.dataset.choice
    const previous = choiceDetails(choices[openKey])
    const keepRun = needsRun(name) && needsRun(previous.choice)
    const keepGym = needsGym(name) && needsGym(previous.choice)
    choices[openKey] = {
      choice: name,
      pace: keepRun ? previous.pace : '',
      amount: keepRun ? previous.amount : '',
      gym: keepGym ? previous.gym : '',
      gymNote: keepGym ? previous.gymNote : '',
    }
    followStep = needsRun(name) ? 'run' : 'gym'
    saveChoices(choices)
    showDay(openKey)
    render()
  })
}

const dayExtra = document.querySelector('#day-extra')
const runQuestions = document.querySelector('#run-questions')
const gymQuestions = document.querySelector('#gym-questions')
const runPace = document.querySelector('#run-pace')
const runAmount = document.querySelector('#run-amount')
const gymNote = document.querySelector('#gym-note')
const gymButtons = [...document.querySelectorAll('[data-gym]')]
const statsView = document.querySelector('#stats')
const statsBody = document.querySelector('#stats-body')
let gymAnswer = ''
let followStep = 'run'

function selectValue(select, value) {
  if (value && ![...select.options].some((option) => option.value === value)) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value
    select.append(option)
  }
  select.value = value || ''
}

function fillFollowUp(name, details) {
  const both = needsRun(name) && needsGym(name)
  const showRun = needsRun(name) && (!both || followStep !== 'gym')
  const showGym = needsGym(name) && (!both || followStep === 'gym')
  dayExtra.hidden = !(showRun || showGym)
  runQuestions.hidden = !showRun
  gymQuestions.hidden = !showGym
  if (showRun) {
    selectValue(runPace, details.pace)
    selectValue(runAmount, details.amount)
  }
  gymAnswer = details.gym
  gymNote.value = showGym ? details.gymNote : ''
  for (const button of gymButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.gym === gymAnswer))
  }
}

function saveFollowUp() {
  const name = choiceName(choices[openKey])
  if (!isToday(openKey) || !name) return
  const both = needsRun(name) && needsGym(name)
  const savingGym = needsGym(name) && (!both || followStep === 'gym')
  const current = choiceDetails(choices[openKey])
  choices[openKey] = {
    choice: name,
    pace: savingGym ? current.pace : runPace.value,
    amount: savingGym ? current.amount : runAmount.value,
    gym: savingGym ? gymAnswer : current.gym,
    gymNote: savingGym ? gymNote.value.trim() : current.gymNote,
  }
  saveChoices(choices)
  render()
  if (both && followStep !== 'gym') {
    followStep = 'gym'
    fillFollowUp(name, choiceDetails(choices[openKey]))
    return
  }
  showCalendar()
}

for (const button of gymButtons) {
  button.addEventListener('click', () => {
    gymAnswer = button.dataset.gym
    for (const item of gymButtons) {
      item.setAttribute('aria-pressed', String(item === button))
    }
  })
}

document.querySelector('#day-save').addEventListener('click', saveFollowUp)

function dateLabel(key) {
  const [, monthNumber, dayNumber] = key.split('-').map(Number)
  return `${dayNumber}. ${MONTHS[monthNumber - 1]}`
}

function paceSeconds(pace) {
  const match = String(pace).match(/(\d+):(\d+)/)
  if (!match) return 0
  return Number(match[1]) * 60 + Number(match[2])
}

function amountNumber(amount) {
  const match = String(amount).replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

function barChart(title, items, emptyText) {
  const block = document.createElement('section')
  block.className = 'stat-block'
  const heading = document.createElement('h3')
  heading.textContent = title
  block.append(heading)
  if (!items.length) {
    const empty = document.createElement('p')
    empty.className = 'stat-line'
    empty.textContent = emptyText
    block.append(empty)
    return block
  }
  const max = Math.max(...items.map((item) => item.value))
  const chart = document.createElement('div')
  chart.className = 'bar-chart'
  for (const item of items) {
    const column = document.createElement('div')
    column.className = 'bar-col'
    const value = document.createElement('span')
    value.textContent = item.text
    const bar = document.createElement('div')
    bar.className = 'bar'
    bar.style.height = `${Math.max(12, (item.value / max) * 100)}%`
    const label = document.createElement('span')
    label.textContent = item.label
    column.append(value, bar, label)
    chart.append(column)
  }
  block.append(chart)
  return block
}

function renderStats() {
  const runs = Object.entries(choices)
    .map(([key, entry]) => ({ key, ...choiceDetails(entry) }))
    .filter((entry) => needsRun(entry.choice))
    .sort((a, b) => a.key.localeCompare(b.key))
  const achievements = Object.entries(choices)
    .map(([key, entry]) => ({ key, ...choiceDetails(entry) }))
    .filter((entry) => needsGym(entry.choice) && (entry.gym === 'Jah' || entry.gymNote))
    .sort((a, b) => a.key.localeCompare(b.key))

  const distanceBars = runs
    .filter((entry) => amountNumber(entry.amount))
    .map((entry) => ({
      label: dateLabel(entry.key),
      text: entry.amount,
      value: amountNumber(entry.amount),
    }))
  const paceBars = runs
    .filter((entry) => paceSeconds(entry.pace))
    .map((entry) => ({
      label: dateLabel(entry.key),
      text: entry.pace,
      value: paceSeconds(entry.pace),
    }))

  statsBody.replaceChildren(
    barChart('Kui palju', distanceBars, 'Koguse andmeid veel ei ole.'),
    barChart('Tempo', paceBars, 'Tempo andmeid veel ei ole.'),
  )

  const gymBlock = document.createElement('section')
  gymBlock.className = 'stat-block'
  const gymHeading = document.createElement('h3')
  gymHeading.textContent = 'Jõusaalis saavutasin'
  gymBlock.append(gymHeading)
  if (!achievements.length) {
    const empty = document.createElement('p')
    empty.className = 'stat-line'
    empty.textContent = 'Jõusaalis ei ole veel saavutusi.'
    gymBlock.append(empty)
  } else {
    const list = document.createElement('ul')
    list.className = 'achieve-list'
    for (const entry of achievements) {
      const item = document.createElement('li')
      item.textContent = `${dateLabel(entry.key)}: ${entry.gymNote || 'Jah'}`
      list.append(item)
    }
    gymBlock.append(list)
  }
  statsBody.append(gymBlock)
}

document.querySelector('#stats-open').addEventListener('click', () => {
  renderStats()
  statsView.hidden = false
})

document.querySelector('#stats-close').addEventListener('click', () => {
  statsView.hidden = true
})

document.querySelector('#clear-diary').addEventListener('click', () => {
  for (const key of Object.keys(choices)) delete choices[key]
  saveChoices(choices)
  dayView.hidden = true
  statsView.hidden = true
  render()
})

muscles = loadMuscles()

const SPOT_KEY = 'treeningpaevik-kohad'
const LAYOUT_KEY = 'treeningpaevik-paigutus'
const editSpotsButton = document.querySelector('#edit-spots')
const spotTools = document.querySelector('#spot-tools')
const saveSpotsButton = document.querySelector('#save-spots')
const spotView = document.querySelector('#spot-view')
let movingSpots = false
let spotMoved = false

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function makeSpot({ id, muscle, top, left }) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'spot'
  button.dataset.spot = id
  button.dataset.muscle = muscle
  button.title = muscle
  button.setAttribute('aria-label', muscle)
  button.style.top = top
  button.style.left = left
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

function applySavedLayout() {
  const layout = loadJson(LAYOUT_KEY)
  if (layout?.spots?.length) {
    document.querySelectorAll('.spot').forEach((spot) => spot.remove())
    for (const spot of layout.spots) {
      const shot = document.querySelector(`.shot[data-view="${spot.view}"]`)
      if (shot) shot.append(makeSpot(spot))
    }
    return
  }

  const places = loadJson(SPOT_KEY) || {}
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
  if (previous !== next) {
    if (muscles[previous] && !muscles[next]) muscles[next] = { ...muscles[previous] }
    localStorage.setItem(MUSCLE_KEY, JSON.stringify(muscles))
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
  localStorage.setItem(LAYOUT_KEY, JSON.stringify({ spots: collectSpots() }))
  pushDiary()
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
  localStorage.setItem(LAYOUT_KEY, JSON.stringify({ spots: collectSpots() }))
  pushDiary()
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

const PLAN_KEY = 'treeningpaevik-kava'
const planCells = document.querySelector('#plan-cells')

const PLAN_ROWS = 10

function emptyPlanColumn() {
  return {
    title: '',
    rows: Array.from({ length: PLAN_ROWS }, () => ({ text: '', reps: '' })),
  }
}

function loadPlanCells() {
  const saved = loadJson(PLAN_KEY)
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

let planCellsData = loadPlanCells()

function savePlan() {
  localStorage.setItem(PLAN_KEY, JSON.stringify(planCellsData))
  pushDiary()
}

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
      savePlan()
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
        savePlan()
      })
      reps.addEventListener('input', () => {
        planCellsData[columnIndex].rows[rowIndex].reps = reps.value
        savePlan()
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

const nutrition = document.querySelector('#nutrition')
const savedNutrition = localStorage.getItem('treeningpaevik-toitumine')
if (savedNutrition) nutrition.value = savedNutrition
nutrition.addEventListener('input', () => {
  localStorage.setItem('treeningpaevik-toitumine', nutrition.value)
  pushDiary()
})

function collectDiary() {
  return {
    choices: loadChoices(),
    muscles,
    layout: loadJson(LAYOUT_KEY),
    plan: planCellsData,
    nutrition: nutrition.value,
  }
}

function applyDiary(data) {
  if (!data || typeof data !== 'object') return
  for (const key of Object.keys(choices)) delete choices[key]
  Object.assign(choices, data.choices || {})
  localStorage.setItem(STORAGE_KEY, JSON.stringify(choices))
  muscles = data.muscles && typeof data.muscles === 'object' ? data.muscles : muscles
  localStorage.setItem(MUSCLE_KEY, JSON.stringify(muscles))
  if (data.layout?.spots?.length) {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(data.layout))
    applySavedLayout()
  }
  if (Array.isArray(data.plan)) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(data.plan))
    planCellsData = loadPlanCells()
    if (!planCells.hidden) renderPlan()
  }
  if (typeof data.nutrition === 'string') {
    localStorage.setItem('treeningpaevik-toitumine', data.nutrition)
    nutrition.value = data.nutrition
  }
  render()
}

let diaryTimer = 0
let diaryReady = false

function pushDiary() {
  if (!diaryReady) return
  clearTimeout(diaryTimer)
  diaryTimer = setTimeout(() => {
    fetch('/api/paevik', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...collectDiary(), edited: true }),
    }).catch(() => {})
  }, 300)
}

todayStamp = stampFromDate(new Date())
applyDiary(sharedDiary)

fetch('/api/paevik')
  .then((response) => response.json())
  .then((saved) => {
    if (saved?.layout?.spots?.length) applyDiary(saved)
    diaryReady = true
  })
  .catch(() => {
    diaryReady = true
  })

tick()
setInterval(tick, 1000)
render()
