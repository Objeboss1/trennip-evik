import './style.css'
import sharedDiary from './shared-diary.json'
import { applyLanguage, getLang, months, setLang, t, weekdays } from './i18n.js'
import { EXERCISES, EXERCISE_GROUPS, exerciseById, findExercise } from './exercises.js'
import { FOODS, foodById } from './foods.js'

const CHOICE_KEYS = {
  Jooksmine: 'run',
  Jõusaal: 'gym',
  Mõlemad: 'both',
  'Ei käinud': 'missed',
}

const WENT = new Set(['Jooksmine', 'Jõusaal', 'Mõlemad'])
const STORAGE_KEY = 'treeningpaevik'

const monthLabel = document.querySelector('#month-label')
const days = document.querySelector('#days')
const calendar = document.querySelector('#calendar')
const bodyViews = document.querySelector('.body-views')
const muscleView = document.querySelector('#muscle')
const dayView = document.querySelector('#day')
const dayLabel = document.querySelector('#day-label')
const daySummary = document.querySelector('#day-summary')
const dayEdit = document.querySelector('#day-edit')
const choiceButtons = [...document.querySelectorAll('[data-choice]')]
const helloTitle = document.querySelector('#hello-title')
const streakCountNode = document.querySelector('#streak-count')
const streakNode = document.querySelector('#streak')
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

function shiftStamp(stamp, days) {
  const [stampYear, stampMonth, stampDay] = stamp.split('-').map(Number)
  const date = new Date(stampYear, stampMonth - 1, stampDay)
  date.setDate(date.getDate() + days)
  return stampFromDate(date)
}

function isLocked(key) {
  if (!todayStamp) return false
  return key < shiftStamp(todayStamp, -1)
}

function helloName() {
  if (!account?.email) return ''
  const named = (loadAccounts()[account.email]?.nimi || '').trim()
  return named ? named.split(/\s+/)[0] : ''
}

function streakCount() {
  if (!todayStamp) return 0
  let cursor = todayStamp
  if (!WENT.has(choiceName(choices[cursor]))) {
    if (choiceName(choices[cursor])) return 0
    cursor = shiftStamp(cursor, -1)
  }
  let count = 0
  while (WENT.has(choiceName(choices[cursor]))) {
    count += 1
    cursor = shiftStamp(cursor, -1)
    if (count > 4000) break
  }
  return count
}

function renderHello() {
  const hour = new Date().getHours()
  const greet = t(hour < 12 ? 'helloMorning' : hour < 18 ? 'helloDay' : 'helloEvening')
  const name = helloName()
  helloTitle.textContent = name ? `${greet}, ${name} 👋` : `${greet} 👋`
  const count = streakCount()
  streakCountNode.textContent = String(count)
  streakNode.setAttribute('aria-label', `${count} ${t('streakDays')}`)
  const record = account?.email ? loadAccounts()[account.email] : null
  const photo = document.querySelector('#hello-photo')
  const initial = document.querySelector('#hello-initial')
  if (record?.photo) {
    photo.src = record.photo
    photo.hidden = false
    initial.hidden = true
  } else {
    photo.hidden = true
    photo.removeAttribute('src')
    initial.hidden = false
    const source = (record?.nimi || account?.email || '').trim()
    initial.textContent = source ? source.slice(0, 1).toUpperCase() : '?'
  }
}

function tick() {
  const date = new Date()
  const stamp = stampFromDate(date)
  if (stamp !== todayStamp) {
    todayStamp = stamp
    if (openKey && isLocked(openKey)) {
      dayView.hidden = true
      openKey = ''
    }
    if (!calendar.hidden) render()
  }
  renderHello()
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
  renderHello()
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

function lockedClass(key) {
  return isLocked(key) ? ' day-locked' : ''
}

function render() {
  monthLabel.textContent = `${monthTitle(months()[month])} ${year}`

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
      const locked = lockedClass(key)
      const todayMark = key === todayStamp ? ' day-today' : ''
      const content = locked
        ? `<span class="day-number">${date}</span>`
        : `<button type="button" class="day-button" data-date="${key}">${date}</button>`
      cells.push(`<td class="day${mark}${locked}${todayMark}">${content}</td>`)
    }
    if (index % 7 === 6) cells.push('</tr>')
  }

  days.innerHTML = cells.join('')
}

function showView(name) {
  for (const section of document.querySelectorAll('[data-section]')) {
    section.hidden = section.dataset.section !== name
  }
  for (const button of document.querySelectorAll('.tab-bar button')) {
    button.setAttribute('aria-pressed', String(button.dataset.view === name))
  }
  if (name === 'calendar') render()
  if (name === 'plan') renderPlan()
  if (name === 'records') renderStats()
  document.dispatchEvent(new CustomEvent('trennip-view', { detail: name }))
}

function showCalendar() {
  dayView.hidden = true
  muscleView.hidden = true
  showView('calendar')
}

function daySummaryText(details) {
  if (!details.choice) return ''
  const parts = [CHOICE_KEYS[details.choice] ? t(CHOICE_KEYS[details.choice]) : details.choice]
  if (details.amount) parts.push(details.amount)
  if (details.pace) parts.push(`${t('paceWord')} ${details.pace}`)
  if (details.gymNote) parts.push(details.gymNote)
  return parts.join(' · ')
}

let dayEditing = false

function showDay(key) {
  if (isLocked(key)) return
  openKey = key
  const [dateYear, dateMonth, dateDay] = key.split('-').map(Number)
  const weekday = weekdays()[new Date(dateYear, dateMonth - 1, dateDay).getDay()]
  dayLabel.textContent = `${monthTitle(weekday)}, ${dateDay}. ${months()[dateMonth - 1]} ${dateYear}`
  dayView.hidden = false
  const details = choiceDetails(choices[key])
  if (!details.choice) {
    beginDayEdit()
    return
  }
  dayEditing = false
  daySummary.hidden = false
  daySummary.textContent = daySummaryText(details)
  dayEdit.hidden = false
  dayChoices.hidden = true
  dayExtra.hidden = true
}

function refreshDayEditor() {
  const name = choiceName(choices[openKey])
  for (const button of choiceButtons) {
    button.disabled = false
    button.setAttribute('aria-pressed', String(button.dataset.choice === name))
  }
  fillFollowUp(name, choiceDetails(choices[openKey]))
}

function beginDayEdit() {
  dayEditing = true
  dayEdit.hidden = true
  daySummary.hidden = true
  const name = choiceName(choices[openKey])
  for (const button of choiceButtons) {
    button.disabled = false
    button.setAttribute('aria-pressed', String(button.dataset.choice === name))
  }
  dayChoices.hidden = false
  dayExtra.hidden = true
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
  if (!button || isLocked(button.dataset.date)) return
  showDay(button.dataset.date)
})

dayEdit.addEventListener('click', beginDayEdit)

document.querySelector('#back').addEventListener('click', showCalendar)

for (const button of choiceButtons) {
  button.addEventListener('click', () => {
    if (!dayEditing || !openKey) return
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
    refreshDayEditor()
    render()
  })
}

const dayExtra = document.querySelector('#day-extra')
const runQuestions = document.querySelector('#run-questions')
const gymQuestions = document.querySelector('#gym-questions')
const runPace = document.querySelector('#run-pace')
const runAmount = document.querySelector('#run-amount')
const gymNote = document.querySelector('#gym-note')
const dayChoices = document.querySelector('#day-choices')
const statsBody = document.querySelector('#stats-body')
let followStep = 'run'

for (let km = 1; km <= 21; km += 1) {
  const option = document.createElement('option')
  option.value = `${km} km`
  option.textContent = `${km} km`
  runAmount.append(option)
}

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
  dayChoices.hidden = showRun || showGym
  runQuestions.hidden = !showRun
  gymQuestions.hidden = !showGym
  if (showRun) {
    selectValue(runPace, details.pace)
    selectValue(runAmount, details.amount)
  }
  gymNote.value = showGym ? details.gymNote : ''
}

function saveFollowUp() {
  const name = choiceName(choices[openKey])
  if (!dayEditing || !openKey || !name) return
  const both = needsRun(name) && needsGym(name)
  const savingGym = needsGym(name) && (!both || followStep === 'gym')
  const current = choiceDetails(choices[openKey])
  choices[openKey] = {
    choice: name,
    pace: savingGym ? current.pace : runPace.value,
    amount: savingGym ? current.amount : runAmount.value,
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

document.querySelector('#day-save').addEventListener('click', saveFollowUp)

function dateLabel(key) {
  const [, monthNumber, dayNumber] = key.split('-').map(Number)
  return `${dayNumber}. ${months()[monthNumber - 1]}`
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
    .filter((entry) => needsGym(entry.choice) && entry.gymNote)
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

  const distanceChart = barChart(t('statsDistance'), distanceBars, t('statsEmptyDistance'))
  if (distanceBars.length) {
    const total = distanceBars.reduce((sum, item) => sum + item.value, 0)
    const average = Math.round((total / distanceBars.length) * 10) / 10
    const line = document.createElement('p')
    line.className = 'stat-line'
    line.textContent = `${t('average')}: ${Number.isInteger(average) ? average : average.toFixed(1)} km`
    distanceChart.append(line)
  }
  statsBody.replaceChildren(distanceChart, barChart(t('paceTitle'), paceBars, t('statsEmptyPace')))

  const gymBlock = document.createElement('section')
  gymBlock.className = 'stat-block'
  const gymHeading = document.createElement('h3')
  gymHeading.textContent = t('gymAchieved')
  gymBlock.append(gymHeading)
  if (!achievements.length) {
    const empty = document.createElement('p')
    empty.className = 'stat-line'
    empty.textContent = t('gymEmpty')
    gymBlock.append(empty)
  } else {
    const list = document.createElement('ul')
    list.className = 'achieve-list'
    for (const entry of achievements) {
      const item = document.createElement('li')
      item.textContent = `${dateLabel(entry.key)}: ${entry.gymNote}`
      list.append(item)
    }
    gymBlock.append(list)
  }
  statsBody.append(gymBlock)
}

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
const planPanel = document.querySelector('#plan-panel')
const planDays = document.querySelector('#plan-days')
const planList = document.querySelector('#plan-list')
const planAdd = document.querySelector('#plan-add')
const planPicker = document.querySelector('#plan-picker')
const planBrowser = document.querySelector('#plan-browser')
const planDetail = document.querySelector('#plan-detail')
const planSearch = document.querySelector('#plan-search')
const planGroups = document.querySelector('#plan-groups')
const planGrid = document.querySelector('#plan-grid')
const PLAN_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const PLAN_SHORT = {
  et: { mon: 'E', tue: 'T', wed: 'K', thu: 'N', fri: 'R', sat: 'L', sun: 'P' },
  en: { mon: 'M', tue: 'T', wed: 'W', thu: 'T', fri: 'F', sat: 'S', sun: 'S' },
  ru: { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' },
}

function todayPlanDay() {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
}

let selectedDay = todayPlanDay()
let pickerGroup = ''
let detailExercise = null
let detailInfoOnly = false

function emptyPlan() {
  return { v: 2, days: Object.fromEntries(PLAN_DAYS.map((day) => [day, []])) }
}

function planItemFromRow(row) {
  const name = String(row?.text || row?.name || '').trim()
  const reps = String(row?.reps || '')
  const sets = String(row?.sets || '')
  if (!name) return null
  const match = findExercise(name)
  if (match) return { id: match.id, sets, reps }
  return { name, sets, reps }
}

function migrateColumns(columns) {
  const plan = emptyPlan()
  columns.forEach((column, index) => {
    const day = PLAN_DAYS[Math.min(index, PLAN_DAYS.length - 1)]
    const rows = Array.isArray(column) ? column : column?.rows || []
    for (const row of rows) {
      const item = planItemFromRow(row)
      if (item) plan.days[day].push(item)
    }
  })
  return plan
}

function loadPlan() {
  const saved = loadJson(PLAN_KEY)
  if (Array.isArray(saved)) return migrateColumns(saved)
  const plan = emptyPlan()
  if (!saved || typeof saved !== 'object' || !saved.days) return plan
  for (const day of PLAN_DAYS) {
    const rows = Array.isArray(saved.days[day]) ? saved.days[day] : []
    plan.days[day] = rows.map((row) => {
      if (row?.id && exerciseById(row.id)) return { id: row.id, sets: String(row.sets || ''), reps: String(row.reps || '') }
      return planItemFromRow(row)
    }).filter(Boolean)
  }
  return plan
}

let planCellsData = loadPlan()

function savePlan() {
  localStorage.setItem(PLAN_KEY, JSON.stringify(planCellsData))
  pushDiary()
}

function exerciseLabel(value) {
  if (!value) return ''
  return value[getLang()] || value.et || ''
}

function countField(label, value, onInput) {
  const wrap = document.createElement('label')
  const span = document.createElement('span')
  span.textContent = label
  const input = document.createElement('input')
  input.inputMode = 'numeric'
  input.value = value
  input.addEventListener('input', () => onInput(input.value))
  wrap.append(span, input)
  return wrap
}

function renderPlan() {
  const today = todayPlanDay()
  const shorts = PLAN_SHORT[getLang()] || PLAN_SHORT.et
  planDays.replaceChildren()
  for (const day of PLAN_DAYS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'plan-day'
    if (day === today) button.classList.add('is-today')
    button.setAttribute('aria-pressed', String(day === selectedDay))
    const full = document.createElement('span')
    full.className = 'plan-day-name'
    full.textContent = t(day)
    const short = document.createElement('span')
    short.className = 'plan-day-short'
    short.textContent = shorts[day]
    button.append(full, short)
    button.addEventListener('click', () => {
      selectedDay = day
      renderPlan()
    })
    planDays.append(button)
  }

  planList.replaceChildren()
  const items = planCellsData.days[selectedDay] || []
  if (!items.length) {
    const empty = document.createElement('p')
    empty.className = 'plan-empty'
    empty.textContent = t('planEmpty')
    planList.append(empty)
  }
  items.forEach((item, index) => {
    const exercise = item.id ? exerciseById(item.id) : null
    const card = document.createElement('article')
    card.className = 'plan-card'
    const photo = document.createElement('button')
    photo.type = 'button'
    photo.className = 'plan-photo'
    if (exercise) {
      const img = document.createElement('img')
      img.src = `/exercises/${exercise.id}.jpg`
      img.alt = exerciseLabel(exercise)
      photo.append(img)
      photo.addEventListener('click', () => openDetail(exercise, true))
    } else {
      photo.textContent = (item.name || '?').slice(0, 1).toUpperCase()
      photo.disabled = true
    }
    const body = document.createElement('div')
    body.className = 'plan-card-body'
    const title = document.createElement('h3')
    title.textContent = exercise ? exerciseLabel(exercise) : item.name
    const muscle = document.createElement('p')
    muscle.textContent = exercise ? exerciseLabel(exercise.muscle) : ''
    const counts = document.createElement('div')
    counts.className = 'plan-counts'
    counts.append(
      countField(t('sets'), item.sets, (value) => {
        planCellsData.days[selectedDay][index].sets = value
        savePlan()
      }),
      countField(t('planReps'), item.reps, (value) => {
        planCellsData.days[selectedDay][index].reps = value
        savePlan()
      }),
    )
    body.append(title, muscle, counts)
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'plan-remove'
    remove.textContent = '×'
    remove.setAttribute('aria-label', t('planRemove'))
    remove.addEventListener('click', () => {
      planCellsData.days[selectedDay].splice(index, 1)
      savePlan()
      renderPlan()
    })
    card.append(photo, body, remove)
    planList.append(card)
  })
  if (!planPicker.hidden && planDetail.hidden) renderPicker()
  if (!planDetail.hidden && detailExercise) fillDetail(false)
}

function openPicker() {
  pickerGroup = ''
  detailExercise = null
  planSearch.value = ''
  planDetail.hidden = true
  planBrowser.hidden = false
  planPicker.hidden = false
  renderPicker()
  planSearch.focus()
}

function closePicker() {
  planPicker.hidden = true
  detailExercise = null
}

function renderPicker() {
  planGroups.replaceChildren()
  const all = document.createElement('button')
  all.type = 'button'
  all.textContent = getLang() === 'ru' ? 'Все' : getLang() === 'en' ? 'All' : 'Kõik'
  all.setAttribute('aria-pressed', String(!pickerGroup))
  all.addEventListener('click', () => {
    pickerGroup = ''
    renderPicker()
  })
  planGroups.append(all)
  for (const group of EXERCISE_GROUPS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = exerciseLabel(group)
    button.setAttribute('aria-pressed', String(pickerGroup === group.id))
    button.addEventListener('click', () => {
      pickerGroup = group.id
      renderPicker()
    })
    planGroups.append(button)
  }
  const query = planSearch.value.trim().toLowerCase()
  planGrid.replaceChildren()
  for (const exercise of EXERCISES) {
    if (pickerGroup && exercise.group !== pickerGroup) continue
    const blob = `${exercise.et} ${exercise.en} ${exercise.ru} ${exercise.muscle.et} ${exercise.muscle.en} ${exercise.muscle.ru}`.toLowerCase()
    if (query && !blob.includes(query)) continue
    const tile = document.createElement('button')
    tile.type = 'button'
    tile.className = 'plan-tile'
    const img = document.createElement('img')
    img.src = `/exercises/${exercise.id}.jpg`
    img.alt = ''
    img.loading = 'lazy'
    const name = document.createElement('span')
    name.textContent = exerciseLabel(exercise)
    tile.append(img, name)
    tile.addEventListener('click', () => openDetail(exercise, false))
    planGrid.append(tile)
  }
}

function fillDetail(resetCounts) {
  const exercise = detailExercise
  if (!exercise) return
  const photo = document.querySelector('#plan-detail-photo')
  photo.src = `/exercises/${exercise.id}.jpg`
  photo.alt = exerciseLabel(exercise)
  document.querySelector('#plan-detail-title').textContent = exerciseLabel(exercise)
  document.querySelector('#plan-detail-names').textContent = `${exercise.et} · ${exercise.en}`
  document.querySelector('#plan-detail-muscle').textContent = exerciseLabel(exercise.muscle)
  document.querySelector('#plan-detail-info').textContent = exerciseLabel(exercise.info)
  document.querySelector('#plan-detail .plan-counts').hidden = detailInfoOnly
  document.querySelector('#plan-detail-add').hidden = detailInfoOnly
  if (resetCounts && !detailInfoOnly) {
    document.querySelector('#plan-detail-sets').value = '3'
    document.querySelector('#plan-detail-reps').value = '10'
  }
}

function openDetail(exercise, infoOnly) {
  if (!exercise) return
  detailExercise = exercise
  detailInfoOnly = infoOnly
  planBrowser.hidden = true
  planDetail.hidden = false
  planPicker.hidden = false
  fillDetail(true)
  if (!infoOnly) document.querySelector('#plan-detail-sets').focus()
}

planAdd.addEventListener('click', openPicker)
document.querySelector('#plan-picker-close').addEventListener('click', closePicker)
planPicker.addEventListener('click', (event) => {
  if (event.target === planPicker) closePicker()
})
document.querySelector('#plan-detail-back').addEventListener('click', () => {
  if (detailInfoOnly) {
    closePicker()
    return
  }
  planDetail.hidden = true
  planBrowser.hidden = false
  detailExercise = null
})
planSearch.addEventListener('input', renderPicker)
document.querySelector('#plan-detail-add').addEventListener('click', () => {
  if (!detailExercise) return
  planCellsData.days[selectedDay].push({
    id: detailExercise.id,
    sets: document.querySelector('#plan-detail-sets').value.trim(),
    reps: document.querySelector('#plan-detail-reps').value.trim(),
  })
  savePlan()
  closePicker()
  renderPlan()
  const cards = planList.querySelectorAll('.plan-card')
  cards[cards.length - 1]?.scrollIntoView({ block: 'nearest' })
})
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !planPicker.hidden) closePicker()
})

let muscle3d = null
document.querySelector('.muscle-mode').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-muscle-mode]')
  if (!button) return
  const mode = button.dataset.muscleMode
  document.querySelector('.body-views').hidden = mode === '3d'
  document.querySelector('.spot-edit').hidden = mode === '3d'
  const view = document.querySelector('#muscle-3d')
  view.hidden = mode !== '3d'
  for (const item of document.querySelectorAll('[data-muscle-mode]')) {
    item.setAttribute('aria-pressed', String(item === button))
  }
  if (mode !== '3d') {
    muscle3d?.stop()
    return
  }
  if (!muscle3d) {
    const mod = await import('./muscle3d.js')
    muscle3d = mod.mountMuscle3d(view)
  }
  muscle3d.start()
})

document.addEventListener('trennip-open-exercise', (event) => {
  const name = String(event.detail?.name || '').trim()
  if (!name) return
  selectedDay = todayPlanDay()
  const match = findExercise(name)
  const list = planCellsData.days[selectedDay]
  let index = list.findIndex((item) => (match ? item.id === match.id : item.name?.toLowerCase() === name.toLowerCase()))
  if (index < 0) {
    list.push(match ? { id: match.id, sets: '', reps: '' } : { name, sets: '', reps: '' })
    index = list.length - 1
    savePlan()
  }
  showView('plan')
  requestAnimationFrame(() => {
    const card = planList.querySelectorAll('.plan-card')[index]
    card?.scrollIntoView({ block: 'center' })
    card?.querySelector('input')?.focus()
  })
})

const goal = document.querySelector('#goal')
const GOAL_KEY = 'treeningpaevik-eesmark'
const savedGoal = localStorage.getItem(GOAL_KEY)
if (savedGoal) goal.value = savedGoal
goal.addEventListener('input', () => {
  localStorage.setItem(GOAL_KEY, goal.value)
  pushDiary()
})

const NUTRITION_KEY = 'treeningpaevik-toitumine'
const nutritionStart = document.querySelector('#nutrition-start')
const nutritionForm = document.querySelector('#nutrition-form')
const nutritionBoard = document.querySelector('#nutrition-board')
const nutritionError = document.querySelector('#nutrition-error')
const nutritionWeight = document.querySelector('#nutrition-weight')
const nutritionHeight = document.querySelector('#nutrition-height')
const nutritionAge = document.querySelector('#nutrition-age')
let nutritionSex = ''
let nutritionFormOpen = false
let nutritionDay = stampFromDate(new Date())

function emptyNutrition() {
  return { v: 1, sex: '', weight: '', height: '', age: '', kcal: 0, days: {} }
}

function loadNutritionFrom(saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return emptyNutrition()
  return {
    v: 1,
    sex: saved.sex === 'f' ? 'f' : saved.sex === 'm' ? 'm' : '',
    weight: String(saved.weight || ''),
    height: String(saved.height || ''),
    age: String(saved.age || ''),
    kcal: Number(saved.kcal) || 0,
    days: saved.days && typeof saved.days === 'object' ? saved.days : {},
  }
}

function loadNutrition() {
  return loadNutritionFrom(loadJson(NUTRITION_KEY))
}

let nutritionState = loadNutrition()

function saveNutrition() {
  localStorage.setItem(NUTRITION_KEY, JSON.stringify(nutritionState))
  pushDiary()
}

function nutritionText(value) {
  return value?.[getLang()] || value?.et || ''
}

function dailyCalories(profile) {
  const weight = Number(profile.weight)
  const height = Number(profile.height)
  const age = Number(profile.age)
  const base = 10 * weight + 6.25 * height - 5 * age
  const bmr = profile.sex === 'f' ? base - 161 : base + 5
  return Math.round((bmr * 1.55) / 10) * 10
}

function nutritionCopy(kind, values = {}) {
  const lang = getLang()
  const lines = {
    target: {
      et: () => `Sinu päevane kogus on ${values.kcal} kcal.`,
      en: () => `Your daily amount is ${values.kcal} kcal.`,
      ru: () => `Твоя дневная норма — ${values.kcal} ккал.`,
    },
    hint: {
      et: () => 'Arvestatud on mõõduka treeninguga. See on hinnang, mitte arsti soovitus.',
      en: () => 'This assumes moderate training. It is an estimate, not medical advice.',
      ru: () => 'Расчёт для умеренных тренировок. Это оценка, не совет врача.',
    },
    left: {
      et: () => `Söödud ${values.eaten} / ${values.kcal} kcal. Jäänud ${values.left} kcal.`,
      en: () => `Eaten ${values.eaten} / ${values.kcal} kcal. ${values.left} kcal left.`,
      ru: () => `Съедено ${values.eaten} / ${values.kcal} ккал. Осталось ${values.left} ккал.`,
    },
    over: {
      et: () => `Söödud ${values.eaten} / ${values.kcal} kcal. Üle ${values.over} kcal.`,
      en: () => `Eaten ${values.eaten} / ${values.kcal} kcal. ${values.over} kcal over.`,
      ru: () => `Съедено ${values.eaten} / ${values.kcal} ккал. Сверх нормы ${values.over} ккал.`,
    },
    emptyLog: {
      et: () => 'Sellel päeval ei ole veel midagi märgitud.',
      en: () => 'Nothing is logged for this day yet.',
      ru: () => 'За этот день пока ничего не отмечено.',
    },
  }
  const pack = lines[kind]
  return (pack[lang] || pack.et)()
}

function dayItems() {
  const items = nutritionState.days[nutritionDay]
  return Array.isArray(items) ? items : []
}

function addNutritionItem(item) {
  const next = dayItems().concat(item)
  nutritionState.days[nutritionDay] = next
  saveNutrition()
  renderNutrition()
}

function renderNutrition() {
  const ready = nutritionState.kcal > 0 && !nutritionFormOpen
  nutritionStart.hidden = ready || nutritionFormOpen
  nutritionForm.hidden = !nutritionFormOpen
  nutritionBoard.hidden = !ready
  for (const button of nutritionForm.querySelectorAll('[data-sex]')) {
    button.setAttribute('aria-pressed', String(button.dataset.sex === nutritionSex))
  }
  if (!ready) return
  document.querySelector('#nutrition-kcal').textContent = nutritionCopy('target', nutritionState)
  document.querySelector('#nutrition-hint').textContent = nutritionCopy('hint')
  document.querySelector('#nutrition-date').textContent = dateLabel(nutritionDay)
  document.querySelector('#nutrition-next').disabled = nutritionDay >= stampFromDate(new Date())
  const eaten = dayItems().reduce((sum, item) => sum + (Number(item.kcal) || 0), 0)
  const left = Math.max(nutritionState.kcal - eaten, 0)
  document.querySelector('#nutrition-status').textContent = eaten > nutritionState.kcal
    ? nutritionCopy('over', { ...nutritionState, eaten, over: eaten - nutritionState.kcal })
    : nutritionCopy('left', { ...nutritionState, eaten, left })
  document.querySelector('#nutrition-fill').style.width = `${Math.min(100, Math.round((eaten / nutritionState.kcal) * 100))}%`
  const log = document.querySelector('#nutrition-log')
  log.replaceChildren()
  if (!dayItems().length) {
    const empty = document.createElement('li')
    empty.textContent = nutritionCopy('emptyLog')
    log.append(empty)
  }
  dayItems().forEach((item, index) => {
    const food = item.id ? foodById(item.id) : null
    const line = document.createElement('li')
    const name = document.createElement('span')
    name.textContent = food ? `${nutritionText(food)} · ${item.kcal} kcal` : `${item.name} · ${item.kcal} kcal`
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.textContent = '×'
    remove.setAttribute('aria-label', t('planRemove'))
    remove.addEventListener('click', () => {
      nutritionState.days[nutritionDay] = dayItems().filter((_, itemIndex) => itemIndex !== index)
      saveNutrition()
      renderNutrition()
    })
    line.append(name, remove)
    log.append(line)
  })
  for (const kind of ['food', 'drink']) {
    const box = document.querySelector(kind === 'food' ? '#nutrition-foods' : '#nutrition-drinks')
    box.replaceChildren()
    for (const food of FOODS.filter((item) => item.kind === kind)) {
      const card = document.createElement('button')
      card.type = 'button'
      card.className = 'nutrition-pick'
      const title = document.createElement('strong')
      title.textContent = nutritionText(food)
      const meta = document.createElement('span')
      meta.textContent = `${nutritionText(food.portion)} · ${food.kcal} kcal`
      const note = document.createElement('small')
      note.textContent = nutritionText(food.note)
      card.append(title, meta, note)
      card.addEventListener('click', () => addNutritionItem({ id: food.id, kcal: food.kcal }))
      box.append(card)
    }
  }
}

document.querySelector('#nutrition-begin').addEventListener('click', () => {
  nutritionFormOpen = true
  nutritionSex = nutritionState.sex
  nutritionWeight.value = nutritionState.weight
  nutritionHeight.value = nutritionState.height
  nutritionAge.value = nutritionState.age
  if (!nutritionAge.value && account?.email) {
    const record = loadAccounts()[account.email]
    if (record?.vanus) nutritionAge.value = record.vanus
  }
  nutritionError.hidden = true
  renderNutrition()
})

nutritionForm.addEventListener('click', (event) => {
  const button = event.target.closest('[data-sex]')
  if (!button) return
  nutritionSex = button.dataset.sex
  renderNutrition()
})

nutritionForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const weight = Number(String(nutritionWeight.value).replace(',', '.'))
  const height = Number(nutritionHeight.value)
  const age = Number(nutritionAge.value)
  const ok = weight >= 30 && weight <= 250 && height >= 120 && height <= 230 && age >= 10 && age <= 100 && (nutritionSex === 'm' || nutritionSex === 'f')
  nutritionError.hidden = ok
  nutritionError.textContent = ok ? '' : t('nutritionBad')
  if (!ok) return
  nutritionState.sex = nutritionSex
  nutritionState.weight = String(weight)
  nutritionState.height = String(height)
  nutritionState.age = String(age)
  nutritionState.kcal = dailyCalories(nutritionState)
  nutritionFormOpen = false
  nutritionDay = stampFromDate(new Date())
  saveNutrition()
  renderNutrition()
})

document.querySelector('#nutrition-edit').addEventListener('click', () => {
  nutritionFormOpen = true
  nutritionSex = nutritionState.sex
  nutritionWeight.value = nutritionState.weight
  nutritionHeight.value = nutritionState.height
  nutritionAge.value = nutritionState.age
  renderNutrition()
})

document.querySelector('#nutrition-prev').addEventListener('click', () => {
  nutritionDay = shiftStamp(nutritionDay, -1)
  renderNutrition()
})

document.querySelector('#nutrition-next').addEventListener('click', () => {
  const next = shiftStamp(nutritionDay, 1)
  if (next > stampFromDate(new Date())) return
  nutritionDay = next
  renderNutrition()
})

document.querySelector('#nutrition-custom').addEventListener('submit', (event) => {
  event.preventDefault()
  const name = document.querySelector('#nutrition-custom-name').value.trim()
  const kcal = Number(document.querySelector('#nutrition-custom-kcal').value)
  if (!name || !Number.isFinite(kcal) || kcal < 0 || kcal > 5000) return
  document.querySelector('#nutrition-custom-name').value = ''
  document.querySelector('#nutrition-custom-kcal').value = ''
  addNutritionItem({ name, kcal: Math.round(kcal) })
})

function collectDiary() {
  return {
    choices: loadChoices(),
    muscles,
    layout: loadJson(LAYOUT_KEY),
    plan: planCellsData,
    nutrition: nutritionState,
    goal: goal.value,
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
  if (Array.isArray(data.plan) || data.plan?.v === 2) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(data.plan))
    planCellsData = loadPlan()
    if (!planPanel.hidden) renderPlan()
  }
  if (data.nutrition && typeof data.nutrition === 'object' && !Array.isArray(data.nutrition)) {
    nutritionState = loadNutritionFrom(data.nutrition)
    localStorage.setItem(NUTRITION_KEY, JSON.stringify(nutritionState))
    nutritionFormOpen = false
    renderNutrition()
  }
  if (typeof data.goal === 'string') {
    localStorage.setItem(GOAL_KEY, data.goal)
    goal.value = data.goal
  }
  render()
}

let diaryTimer = 0
let diaryReady = false

const ACCOUNTS_KEY = 'trennipaevik-kontod'
const SESSION_KEY = 'trennipaevik-sessioon'
const FIRST_EMAIL = 'karl.kiipus@icloud.com'
let account = null

function loadAccounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
}

function accountEmail(value) {
  return value.trim().toLowerCase()
}

function joinedLabel(iso) {
  const locale = getLang() === 'ru' ? 'ru-RU' : getLang() === 'en' ? 'en-GB' : 'et-EE'
  return new Date(iso).toLocaleDateString(locale, { timeZone: 'Europe/Tallinn' })
}

async function passwordHash(email, password) {
  const bytes = new TextEncoder().encode(`${email}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function accountDiary(data) {
  const diary = data && typeof data === 'object' ? data : {}
  return { ...diary, goal: typeof diary.goal === 'string' ? diary.goal : '' }
}

function emptyAccountDiary() {
  return {
    choices: {},
    muscles: {},
    layout: sharedDiary.layout,
    plan: emptyPlan(),
    nutrition: '',
    goal: '',
  }
}

const GUEST_KEY = 'treeningpaevik-kulaline'

function flushDiary() {
  if (!diaryReady) return
  clearTimeout(diaryTimer)
  const snapshot = structuredClone(collectDiary())
  if (account?.email) {
    const accounts = loadAccounts()
    const record = accounts[account.email]
    if (!record) return
    record.diary = snapshot
    saveAccounts(accounts)
    return
  }
  localStorage.setItem(GUEST_KEY, JSON.stringify(snapshot))
}

function pushDiary() {
  if (!diaryReady) return
  clearTimeout(diaryTimer)
  diaryTimer = setTimeout(flushDiary, 300)
}

window.addEventListener('pagehide', flushDiary)

const accountOpen = document.querySelector('#account-open')
const accountPanel = document.querySelector('#account-panel')
const infoPage = document.querySelector('#info-page')

const THEME_KEY = 'treeningpaevik-teema'
const LANG_KEY = 'treeningpaevik-keel'

function showSettings(name) {
  document.querySelector('#settings-menu').hidden = name !== 'menu'
  for (const panel of document.querySelectorAll('[data-settings-panel]')) {
    panel.hidden = panel.dataset.settingsPanel !== name
  }
  document.querySelector('#info-title').textContent = t(name === 'menu' ? 'settings' : name)
  if (name === 'account') showProfile()
}

function markLanguage() {
  const current = localStorage.getItem(LANG_KEY) || 'et'
  for (const button of document.querySelectorAll('[data-lang]')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === current))
  }
}

function applyTheme(name) {
  const theme = ['lime', 'orange', 'purple', 'yellow', 'cyan', 'red'].includes(name) ? name : 'lime'
  document.documentElement.dataset.theme = theme
  localStorage.setItem(THEME_KEY, theme)
  for (const button of document.querySelectorAll('[data-theme-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme))
  }
}

function accountRecord() {
  if (!account?.email) return null
  return loadAccounts()[account.email] || null
}

function saveProfile(patch) {
  if (!account?.email) return
  const accounts = loadAccounts()
  if (!accounts[account.email]) return
  Object.assign(accounts[account.email], patch)
  saveAccounts(accounts)
  if (patch.photo !== undefined) showProfile()
  renderHello()
  if (patch.photo === undefined && !accounts[account.email].photo && patch.nimi !== undefined) {
    document.querySelector('#profile-initial').textContent = (patch.nimi || account.email).slice(0, 1).toUpperCase() || '?'
  }
}

function showProfile() {
  const record = accountRecord()
  document.querySelector('#profile-form').hidden = !record
  document.querySelector('#profile-login').hidden = Boolean(record)
  if (!record) return
  document.querySelector('#profile-name').value = record.nimi || ''
  document.querySelector('#profile-email').value = account.email
  document.querySelector('#profile-age').value = record.vanus || ''
  document.querySelector('#profile-joined').textContent = joinedLabel(record.liitus)
  const photo = document.querySelector('#profile-photo')
  const initial = document.querySelector('#profile-initial')
  if (record.photo) {
    photo.src = record.photo
    photo.hidden = false
    initial.hidden = true
  } else {
    photo.removeAttribute('src')
    photo.hidden = true
    initial.hidden = false
    initial.textContent = (record.nimi || account.email).slice(0, 1).toUpperCase()
  }
}

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.onload = () => {
      const size = 256
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const scale = Math.max(size / image.width, size / image.height)
      const width = image.width * scale
      const height = image.height * scale
      canvas.getContext('2d').drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('photo'))
    }
    image.src = url
  })
}

function applyShortDays() {
  const letters = {
    et: ['E', 'T', 'K', 'N', 'R', 'L', 'P'],
    en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    ru: ['П', 'В', 'С', 'Ч', 'П', 'С', 'В'],
  }
  const list = letters[getLang()] || letters.et
  document.querySelectorAll('.day-short').forEach((node, index) => {
    node.textContent = list[index] || ''
  })
}

function refreshLanguage() {
  applyLanguage()
  applyShortDays()
  render()
  renderHello()
  if (openKey && !dayView.hidden) {
    const [dateYear, dateMonth, dateDay] = openKey.split('-').map(Number)
    const weekday = weekdays()[new Date(dateYear, dateMonth - 1, dateDay).getDay()]
    dayLabel.textContent = `${monthTitle(weekday)}, ${dateDay}. ${months()[dateMonth - 1]} ${dateYear}`
    const details = choiceDetails(choices[openKey])
    if (details.choice) daySummary.textContent = daySummaryText(details)
  }
  if (!document.querySelector('[data-section="records"]').hidden) renderStats()
  if (!document.querySelector('[data-section="plan"]').hidden) renderPlan()
  renderNutrition()
  renderAccount()
  markLanguage()
  if (!infoPage.hidden) {
    const openPanel = [...document.querySelectorAll('[data-settings-panel]')].find((panel) => !panel.hidden)
    showSettings(openPanel ? openPanel.dataset.settingsPanel : 'menu')
  }
}

document.querySelector('#hello-avatar').addEventListener('click', () => {
  if (account?.email) {
    accountPanel.hidden = true
    infoPage.hidden = false
    showSettings('account')
    return
  }
  infoPage.hidden = true
  accountPanel.hidden = false
  renderAccount()
})

document.querySelector('#settings-open').addEventListener('click', () => {
  accountPanel.hidden = true
  infoPage.hidden = false
  showSettings('menu')
  document.querySelector('#info-close').focus()
})

document.querySelector('#info-page').addEventListener('click', (event) => {
  const choice = event.target.closest('[data-settings]')
  if (choice) {
    showSettings(choice.dataset.settings)
    return
  }
  if (event.target.closest('[data-settings-back]')) showSettings('menu')
})

document.querySelector('#profile-open-login').addEventListener('click', () => {
  infoPage.hidden = true
  accountPanel.hidden = false
  renderAccount()
})

document.querySelector('#profile-form').addEventListener('submit', (event) => event.preventDefault())

document.querySelector('#profile-name').addEventListener('input', (event) => {
  saveProfile({ nimi: event.target.value.trim() })
})

document.querySelector('#profile-age').addEventListener('change', (event) => {
  const age = Number(event.target.value)
  saveProfile({ vanus: age >= 1 && age <= 120 ? String(age) : '' })
})

document.querySelector('#profile-file').addEventListener('change', async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    saveProfile({ photo: await readPhoto(file) })
  } catch {
    saveProfile({ photo: '' })
  }
})

for (const button of document.querySelectorAll('[data-lang]')) {
  button.addEventListener('click', () => {
    setLang(button.dataset.lang)
    localStorage.setItem(LANG_KEY, button.dataset.lang)
    refreshLanguage()
  })
}

for (const button of document.querySelectorAll('[data-theme-choice]')) {
  button.addEventListener('click', () => applyTheme(button.dataset.themeChoice))
}

document.querySelector('.tab-bar').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]')
  if (!button) return
  showView(button.dataset.view)
})

document.querySelector('#info-close').addEventListener('click', () => {
  infoPage.hidden = true
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !infoPage.hidden) infoPage.hidden = true
})
const accountError = document.querySelector('#account-error')
const loginForm = document.querySelector('#account-login')
const registerForm = document.querySelector('#account-register')
const accountInfo = document.querySelector('#account-info')

function showAccountError(message) {
  accountError.hidden = !message
  accountError.textContent = message || ''
}

function renderAccount() {
  const signedIn = Boolean(account?.email)
  accountOpen.textContent = signedIn ? t('account') : t('login')
  loginForm.hidden = signedIn
  registerForm.hidden = true
  accountInfo.hidden = !signedIn
  if (signedIn) {
    document.querySelector('#account-email').textContent = account.email
    const record = loadAccounts()[account.email]
    if (record?.liitus) account.liitus = joinedLabel(record.liitus)
    document.querySelector('#account-joined').textContent = account.liitus
  }
  renderHello()
}

accountOpen.addEventListener('click', () => {
  accountPanel.hidden = !accountPanel.hidden
  showAccountError('')
  if (!accountPanel.hidden) renderAccount()
})

document.querySelector('#show-register').addEventListener('click', () => {
  loginForm.hidden = true
  registerForm.hidden = false
  showAccountError('')
})

document.querySelector('#show-login').addEventListener('click', () => {
  registerForm.hidden = true
  loginForm.hidden = false
  showAccountError('')
})

async function enterAccount(emailValue, password, register) {
  showAccountError('')
  flushDiary()
  const email = accountEmail(emailValue)
  if (!email.includes('@')) throw new Error(t('badEmail'))
  if (password.length < 8) throw new Error(t('shortPassword'))
  const accounts = loadAccounts()
  const hash = await passwordHash(email, password)
  if (register) {
    if (accounts[email]) throw new Error(t('emailUsed'))
    const diary = email === FIRST_EMAIL ? structuredClone(collectDiary()) : emptyAccountDiary()
    accounts[email] = { passwordHash: hash, liitus: new Date().toISOString(), diary }
    saveAccounts(accounts)
  } else if (!accounts[email] || accounts[email].passwordHash !== hash) {
    throw new Error(t('badLogin'))
  }
  localStorage.setItem(SESSION_KEY, email)
  account = { email, liitus: joinedLabel(accounts[email].liitus) }
  applyDiary(accountDiary(accounts[email].diary))
  renderAccount()
  accountPanel.hidden = false
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault()
  enterAccount(loginForm.querySelector('#login-email').value, loginForm.querySelector('#login-password').value, false)
    .catch((error) => showAccountError(error.message))
})

registerForm.addEventListener('submit', (event) => {
  event.preventDefault()
  enterAccount(
    registerForm.querySelector('#register-email').value,
    registerForm.querySelector('#register-password').value,
    true,
  ).catch((error) => showAccountError(error.message))
})

document.querySelector('#account-logout').addEventListener('click', () => {
  flushDiary()
  localStorage.removeItem(SESSION_KEY)
  location.reload()
})

setLang(localStorage.getItem(LANG_KEY) || 'et')
applyLanguage()
applyShortDays()
applyTheme(localStorage.getItem(THEME_KEY) || 'lime')
markLanguage()

todayStamp = stampFromDate(new Date())
const savedAccounts = loadAccounts()
const sessionEmail = localStorage.getItem(SESSION_KEY)
if (sessionEmail && savedAccounts[sessionEmail]) {
  account = { email: sessionEmail, liitus: joinedLabel(savedAccounts[sessionEmail].liitus) }
  applyDiary(accountDiary(savedAccounts[sessionEmail].diary))
  renderAccount()
} else {
  const guest = loadJson(GUEST_KEY)
  if (guest) applyDiary(guest)
  else if (!localStorage.getItem(STORAGE_KEY) && !localStorage.getItem(LAYOUT_KEY)) applyDiary(sharedDiary)
  else applySavedLayout()
}
diaryReady = true
if (!account?.email && !loadJson(GUEST_KEY)) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(collectDiary()))
}

renderNutrition()
tick()
setInterval(tick, 1000)
render()
