import './style.css'
import sharedDiary from './shared-diary.json'
import { applyLanguage, getLang, months, setLang, t, weekdays } from './i18n.js'
import { EXERCISES, EXERCISE_GROUPS, exerciseById, findExercise } from './exercises.js'
import { MUSCLE_GROUPS } from './muscle-data.js'
import { FOODS, foodById } from './foods.js'

const STORAGE_KEY = 'treeningpaevik'

const monthLabel = document.querySelector('#month-label')
const days = document.querySelector('#days')
const calendar = document.querySelector('#calendar')
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
  if (!hasActivity(choices[cursor])) {
    if (choices[cursor]) return 0
    cursor = shiftStamp(cursor, -1)
  }
  let count = 0
  while (hasActivity(choices[cursor])) {
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

function activityFrom(item) {
  return {
    type: item.type,
    time: item.time || '',
    pace: item.pace || '',
    amount: item.amount || '',
    note: item.note || '',
  }
}

function activitiesOf(entry) {
  if (!entry) return []
  if (Array.isArray(entry.activities)) {
    return entry.activities.filter((item) => item && ['run', 'ride', 'weights'].includes(item.type)).map(activityFrom)
  }
  const name = choiceName(entry)
  const pace = typeof entry === 'object' ? entry.pace || '' : ''
  const amount = typeof entry === 'object' ? entry.amount || '' : ''
  const note = typeof entry === 'object' ? entry.gymNote || '' : ''
  const list = []
  if (name === 'Jooksmine' || name === 'Mõlemad') list.push({ type: 'run', time: '', pace, amount, note: '' })
  if (name === 'Jõusaal' || name === 'Mõlemad') list.push({ type: 'weights', time: '', pace: '', amount: '', note })
  return list
}

function hasActivity(entry, type) {
  const list = activitiesOf(entry)
  if (!type) return list.length > 0
  return list.some((item) => item.type === type)
}

function markClass(choice) {
  if (hasActivity(choice)) return ' day-went'
  if (choiceName(choice) === 'Ei käinud') return ' day-missed'
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
  if (name === 'goals') renderGoals()
  document.dispatchEvent(new CustomEvent('trennip-view', { detail: name }))
}

function showCalendar() {
  dayView.hidden = true
  showView('calendar')
}

function activityLabel(type) {
  if (type === 'run') return t('run')
  if (type === 'ride') return t('ride')
  return t('weights')
}

function activityLine(item) {
  const parts = [activityLabel(item.type)]
  if (item.time) parts.push(item.time)
  if (item.amount) parts.push(item.amount)
  if (item.pace) parts.push(`${t('paceWord')} ${item.pace}`)
  if (item.note) parts.push(item.note)
  return parts.join(' · ')
}

let dayMode = 'summary'
let pendingType = ''

function showDay(key) {
  if (isLocked(key)) return
  openKey = key
  const [dateYear, dateMonth, dateDay] = key.split('-').map(Number)
  const weekday = weekdays()[new Date(dateYear, dateMonth - 1, dateDay).getDay()]
  dayLabel.textContent = `${monthTitle(weekday)}, ${dateDay}. ${months()[dateMonth - 1]} ${dateYear}`
  dayView.hidden = false
  const list = activitiesOf(choices[key])
  dayMode = list.length ? 'summary' : 'add'
  pendingType = ''
  paintDay()
}

function paintSummary(list) {
  daySummary.replaceChildren()
  const log = document.createElement('ul')
  log.className = 'day-log'
  for (const item of list) {
    const row = document.createElement('li')
    const text = document.createElement('span')
    text.textContent = activityLine(item)
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.dataset.removeActivity = item.type
    remove.textContent = t('removeActivity')
    row.append(text, remove)
    log.append(row)
  }
  daySummary.append(log)
}

function showActivityForms(types) {
  const showRun = types.includes('run')
  const showRide = types.includes('ride')
  const showWeights = types.includes('weights')
  runQuestions.hidden = !showRun
  rideQuestions.hidden = !showRide
  gymQuestions.hidden = !showWeights
  dayExtra.hidden = !(showRun || showRide || showWeights)
}

function fillActivityForm(item) {
  if (item.type === 'run') {
    runTime.value = item.time || ''
    selectValue(runPace, item.pace)
    selectValue(runAmount, item.amount)
  }
  if (item.type === 'ride') {
    rideTime.value = item.time || ''
    rideAmount.value = amountNumber(item.amount) ? String(amountNumber(item.amount)) : ''
  }
  if (item.type === 'weights') {
    weightsTime.value = item.time || ''
    gymNote.value = item.note || ''
  }
}

function paintDay() {
  const list = activitiesOf(choices[openKey])
  const used = new Set(list.map((item) => item.type))
  daySummary.hidden = dayMode !== 'summary'
  dayEdit.hidden = dayMode !== 'summary' || !list.length
  dayAdd.hidden = dayMode !== 'summary' || used.size >= 3
  dayTools.hidden = dayAdd.hidden && dayEdit.hidden
  dayChoices.hidden = dayMode !== 'add'
  for (const button of choiceButtons) {
    button.hidden = dayMode === 'add' && used.has(button.dataset.choice)
    button.setAttribute('aria-pressed', String(dayMode === 'add' && button.dataset.choice === pendingType))
  }
  if (dayMode === 'summary') {
    dayExtra.hidden = true
    paintSummary(list)
    return
  }
  const types = dayMode === 'edit' ? list.map((item) => item.type) : pendingType ? [pendingType] : []
  showActivityForms(types)
  for (const type of types) fillActivityForm(list.find((item) => item.type === type) || { type })
}

const MUSCLE_KEY = 'treeningpaevik-lihased'
let muscles = {}

function loadMuscles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MUSCLE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
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

dayEdit.addEventListener('click', () => {
  dayMode = 'edit'
  pendingType = ''
  paintDay()
})

daySummary.addEventListener('click', (event) => {
  const button = event.target.closest('[data-remove-activity]')
  if (!button || !openKey) return
  const next = activitiesOf(choices[openKey]).filter((item) => item.type !== button.dataset.removeActivity)
  saveDayActivities(next)
  showDay(openKey)
})

document.querySelector('#back').addEventListener('click', showCalendar)

for (const button of choiceButtons) {
  button.addEventListener('click', () => {
    if (dayMode !== 'add' || !openKey) return
    pendingType = button.dataset.choice
    paintDay()
  })
}

const dayExtra = document.querySelector('#day-extra')
const runQuestions = document.querySelector('#run-questions')
const rideQuestions = document.querySelector('#ride-questions')
const gymQuestions = document.querySelector('#gym-questions')
const runPace = document.querySelector('#run-pace')
const runAmount = document.querySelector('#run-amount')
const runTime = document.querySelector('#run-time')
const rideAmount = document.querySelector('#ride-amount')
const rideTime = document.querySelector('#ride-time')
const weightsTime = document.querySelector('#weights-time')
const gymNote = document.querySelector('#gym-note')
const dayChoices = document.querySelector('#day-choices')
const dayAdd = document.querySelector('#day-add')
const dayTools = document.querySelector('#day-tools')
const statsBody = document.querySelector('#stats-body')

dayAdd.addEventListener('click', () => {
  dayMode = 'add'
  pendingType = ''
  paintDay()
})

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

function readActivity(type) {
  if (type === 'run') return { type, time: runTime.value, pace: runPace.value, amount: runAmount.value, note: '' }
  if (type === 'ride') {
    const km = amountNumber(rideAmount.value)
    return { type, time: rideTime.value, pace: '', amount: km ? `${km} km` : '', note: '' }
  }
  return { type, time: weightsTime.value, pace: '', amount: '', note: gymNote.value.trim() }
}

function saveDayActivities(list) {
  if (!list.length) delete choices[openKey]
  else {
    choices[openKey] = {
      activities: list.map((item) => {
        const next = { type: item.type }
        if (item.time) next.time = item.time
        if (item.pace) next.pace = item.pace
        if (item.amount) next.amount = item.amount
        if (item.note) next.note = item.note
        return next
      }),
    }
  }
  saveChoices(choices)
  render()
}

function saveFollowUp() {
  if (!openKey || (dayMode !== 'add' && dayMode !== 'edit')) return
  const current = activitiesOf(choices[openKey])
  let next = current
  if (dayMode === 'add') {
    if (!pendingType) return
    next = current.filter((item) => item.type !== pendingType).concat(readActivity(pendingType))
  } else {
    next = current.map((item) => readActivity(item.type))
  }
  saveDayActivities(next)
  showCalendar()
}

document.querySelector('#day-save').addEventListener('click', saveFollowUp)

function dateLabel(key) {
  const [, monthNumber, dayNumber] = key.split('-').map(Number)
  return `${dayNumber}. ${months()[monthNumber - 1]}`
}

function amountNumber(amount) {
  const match = String(amount).replace(',', '.').match(/(\d+(?:\.\d+)?)/)
  return match ? Number(match[1]) : 0
}

const RECORDS_KEY = 'treeningpaevik-rekordid'
const RECORD_KEYS = ['record1k', 'record5k', 'record10k', 'recordLong', 'recordTotal', 'recordRideLong', 'recordRideTotal']

function defaultRecords() {
  return { items: RECORD_KEYS.map((key) => ({ id: key, key, title: '', value: '' })) }
}

function emptyRecords() {
  return defaultRecords()
}

function loadRecordsFrom(saved) {
  if (!saved || typeof saved !== 'object' || !Array.isArray(saved.items)) return defaultRecords()
  return {
    items: saved.items
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: String(item.id || `custom-${Date.now()}`).slice(0, 40),
        key: typeof item.key === 'string' ? item.key.slice(0, 40) : '',
        title: String(item.title || '').slice(0, 60),
        value: String(item.value || '').slice(0, 40),
      })),
  }
}

let recordsState = loadRecordsFrom(loadJson(RECORDS_KEY))

function saveRecords() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(recordsState))
  pushDiary()
}

function recordTitle(item) {
  if (item.key) return t(item.key)
  return item.title
}

function renderStats() {
  const section = document.createElement('section')
  section.className = 'record-head'
  const heading = document.createElement('h3')
  heading.textContent = t('recordsAuto')
  const hint = document.createElement('p')
  hint.textContent = t('recordsHint')
  const grid = document.createElement('div')
  grid.className = 'record-grid'
  for (const item of recordsState.items) {
    const card = document.createElement('article')
    card.className = 'record-card'
    const title = document.createElement('input')
    title.className = 'record-title'
    title.value = recordTitle(item)
    title.placeholder = t('recordTitle')
    title.addEventListener('input', () => {
      item.key = ''
      item.title = title.value.slice(0, 60)
      saveRecords()
    })
    const value = document.createElement('input')
    value.className = 'record-value-input'
    value.value = item.value
    value.placeholder = t('recordValue')
    value.addEventListener('input', () => {
      item.value = value.value.slice(0, 40)
      saveRecords()
    })
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'record-remove'
    remove.textContent = t('removeActivity')
    remove.addEventListener('click', () => {
      recordsState.items = recordsState.items.filter((entry) => entry.id !== item.id)
      saveRecords()
      renderStats()
    })
    card.append(title, value, remove)
    grid.append(card)
  }
  const add = document.createElement('button')
  add.type = 'button'
  add.className = 'records-add'
  add.textContent = t('recordsAdd')
  add.addEventListener('click', () => {
    recordsState.items.push({ id: `custom-${Date.now()}`, key: '', title: '', value: '' })
    saveRecords()
    renderStats()
    document.querySelector('.record-grid .record-card:last-child .record-title')?.focus()
  })
  section.append(heading, hint, grid, add)
  statsBody.replaceChildren(section)
}


muscles = loadMuscles()

const LAYOUT_KEY = 'treeningpaevik-paigutus'

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null')
  } catch {
    return null
  }
}

function applySavedLayout() {}

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
let pendingExercise = null
const planPlace = document.querySelector('#plan-place')
const planPlacePhoto = document.querySelector('#plan-place-photo')
const planPlaceName = document.querySelector('#plan-place-name')

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

function placePending(day) {
  if (!pendingExercise) return -1
  const list = planCellsData.days[day]
  const match = pendingExercise.id ? pendingExercise : null
  const name = pendingExercise.et || pendingExercise.name || ''
  let index = list.findIndex((item) => (match ? item.id === match.id : item.name?.toLowerCase() === name.toLowerCase()))
  if (index < 0) {
    list.push(match ? { id: match.id, sets: '', reps: '' } : { name, sets: '', reps: '' })
    index = list.length - 1
    savePlan()
  }
  pendingExercise = null
  return index
}

function renderPlan() {
  const today = todayPlanDay()
  const shorts = PLAN_SHORT[getLang()] || PLAN_SHORT.et
  planPlace.hidden = !pendingExercise
  planDays.classList.toggle('is-placing', Boolean(pendingExercise))
  if (pendingExercise) {
    const photo = pendingExercise.id ? `/exercises/${pendingExercise.id}.jpg` : ''
    planPlacePhoto.hidden = !photo
    if (photo) {
      planPlacePhoto.src = photo
      planPlacePhoto.alt = exerciseLabel(pendingExercise)
    }
    planPlaceName.textContent = pendingExercise.id ? exerciseLabel(pendingExercise) : pendingExercise.name
  }
  planDays.replaceChildren()
  for (const day of PLAN_DAYS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'plan-day'
    if (day === today) button.classList.add('is-today')
    button.setAttribute('aria-pressed', String(day === selectedDay && !pendingExercise))
    const full = document.createElement('span')
    full.className = 'plan-day-name'
    full.textContent = t(day)
    const short = document.createElement('span')
    short.className = 'plan-day-short'
    short.textContent = shorts[day]
    button.append(full, short)
    button.addEventListener('click', () => {
      selectedDay = day
      const placedIndex = placePending(day)
      renderPlan()
      if (placedIndex >= 0) {
        const card = planList.querySelectorAll('.plan-card')[placedIndex]
        card?.scrollIntoView({ block: 'center' })
        card?.querySelector('input')?.focus()
      }
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
let muscle3dLoading = null
let pendingGroup = ''

function paintMuscleFilters(selected = pendingGroup) {
  const filters = document.querySelector('#muscle-filters')
  const lang = getLang()
  filters.replaceChildren()
  const all = document.createElement('button')
  all.type = 'button'
  all.dataset.group = ''
  all.textContent = lang === 'ru' ? 'Все' : lang === 'en' ? 'All' : 'Kõik'
  all.setAttribute('aria-pressed', String(!selected))
  filters.append(all)
  for (const group of MUSCLE_GROUPS) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.group = group.id
    button.textContent = group[lang] || group.et
    button.setAttribute('aria-pressed', String(group.id === selected))
    filters.append(button)
  }
}

paintMuscleFilters()
document.querySelector('#muscle-filters').addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (!button || muscle3d) return
  pendingGroup = button.dataset.group || ''
  paintMuscleFilters()
})
const muscleCredit = document.querySelector('#muscle-credit')
const muscleCreditOpen = document.querySelector('#muscle-credit-open')
function fitMuscleStage() {
  const stage = document.querySelector('.muscle-stage')
  const section = document.querySelector('[data-section="muscles"]')
  if (!stage || section.hidden) return
  const barTop = document.querySelector('.tab-bar').getBoundingClientRect().top
  const sourceHeight = document.querySelector('.muscle-source').getBoundingClientRect().height
  const top = stage.getBoundingClientRect().top
  if (top < 0) return
  const height = Math.max(260, Math.floor(barTop - top - sourceHeight - 28))
  stage.style.height = `${height}px`
}

muscleCreditOpen.addEventListener('click', () => {
  const open = muscleCredit.hidden
  muscleCredit.hidden = !open
  muscleCreditOpen.setAttribute('aria-expanded', String(open))
  requestAnimationFrame(fitMuscleStage)
})

async function ensureMuscle3d() {
  const view = document.querySelector('#muscle-3d')
  if (!muscle3d) {
    if (!muscle3dLoading) {
      muscle3dLoading = import('./muscle3d.js').then((mod) => {
        muscle3d = mod.mountMuscle3d(view, pendingGroup)
        return muscle3d
      })
    }
    await muscle3dLoading
  }
  if (pendingGroup) {
    muscle3d.selectGroup(pendingGroup)
    pendingGroup = ''
  }
  const section = document.querySelector('[data-section="muscles"]')
  if (section.hidden) muscle3d.stop()
  else muscle3d.start()
}

document.addEventListener('trennip-view', (event) => {
  if (event.detail === 'muscles') {
    window.scrollTo(0, 0)
    requestAnimationFrame(() => {
      fitMuscleStage()
      ensureMuscle3d()
    })
  } else muscle3d?.stop()
})

window.addEventListener('resize', () => {
  if (!document.querySelector('[data-section="muscles"]').hidden) fitMuscleStage()
})

document.querySelector('#plan-place-cancel').addEventListener('click', () => {
  pendingExercise = null
  renderPlan()
})

document.addEventListener('trennip-open-exercise', (event) => {
  const name = String(event.detail?.name || '').trim()
  if (!name) return
  pendingExercise = findExercise(name) || { name }
  showView('plan')
  requestAnimationFrame(() => planPlace.scrollIntoView({ block: 'center' }))
})

const goal = document.querySelector('#goal')
const GOAL_KEY = 'treeningpaevik-eesmark'
const savedGoal = localStorage.getItem(GOAL_KEY)
if (savedGoal) goal.value = savedGoal
goal.addEventListener('input', () => {
  localStorage.setItem(GOAL_KEY, goal.value)
  pushDiary()
})

const GOALS_STATE_KEY = 'treeningpaevik-eesmargid'

function emptyGoals() {
  return {
    v: 1,
    sleepOn: false,
    sleepHours: 8,
    caloriesOn: false,
    runOn: false,
    gymOn: false,
    gymEvery: 2,
    waterOn: false,
    waterGlasses: 8,
    log: {},
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, number))
}

function loadGoalsFrom(saved) {
  const next = emptyGoals()
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return next
  next.sleepOn = Boolean(saved.sleepOn)
  next.sleepHours = clampNumber(saved.sleepHours, 4, 12, 8)
  next.caloriesOn = Boolean(saved.caloriesOn)
  next.runOn = Boolean(saved.runOn)
  next.gymOn = Boolean(saved.gymOn)
  next.gymEvery = clampNumber(saved.gymEvery, 1, 4, 2)
  next.waterOn = Boolean(saved.waterOn)
  next.waterGlasses = clampNumber(saved.waterGlasses, 1, 20, 8)
  next.log = saved.log && typeof saved.log === 'object' && !Array.isArray(saved.log) ? saved.log : {}
  return next
}

let goalsState = loadGoalsFrom(loadJson(GOALS_STATE_KEY))

function saveGoals() {
  localStorage.setItem(GOALS_STATE_KEY, JSON.stringify(goalsState))
  pushDiary()
}

function todayKey() {
  return stampFromDate(new Date())
}

function readGoalLog(key) {
  const entry = goalsState.log[key]
  return entry && typeof entry === 'object' ? entry : {}
}

function recentKeys(count) {
  const today = todayKey()
  const keys = []
  for (let offset = count - 1; offset >= 0; offset -= 1) keys.push(shiftStamp(today, -offset))
  return keys
}

function weekdayShort(key) {
  const [year, month, day] = key.split('-').map(Number)
  const names = {
    et: ['P', 'E', 'T', 'K', 'N', 'R', 'L'],
    en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  }
  return (names[getLang()] || names.et)[new Date(year, month - 1, day).getDay()]
}

function eatenOn(key) {
  const items = nutritionState.days?.[key]
  if (!Array.isArray(items)) return 0
  return items.reduce((sum, item) => sum + (Number(item.kcal) || 0), 0)
}

function dayDistance(from, to) {
  const [year, month, day] = from.split('-').map(Number)
  const [year2, month2, day2] = to.split('-').map(Number)
  return Math.round((new Date(year2, month2 - 1, day2) - new Date(year, month - 1, day)) / 86400000)
}

function goalField(label, control) {
  const wrap = document.createElement('label')
  wrap.className = 'goal-field'
  const span = document.createElement('span')
  span.textContent = label
  wrap.append(span, control)
  return wrap
}

function weekDots(met) {
  const row = document.createElement('div')
  row.className = 'goal-week'
  for (const key of recentKeys(7)) {
    const dot = document.createElement('span')
    dot.textContent = weekdayShort(key)
    if (met(key)) dot.classList.add('is-met')
    row.append(dot)
  }
  return row
}

function goalCard(title, flag, fill) {
  const card = document.createElement('article')
  card.className = 'goal-card'
  const header = document.createElement('header')
  const heading = document.createElement('h3')
  heading.textContent = title
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'goal-switch'
  const on = Boolean(goalsState[flag])
  button.setAttribute('aria-pressed', String(on))
  button.textContent = on ? t('goalOn') : t('goalOff')
  button.addEventListener('click', () => {
    goalsState[flag] = !on
    saveGoals()
    renderGoals()
  })
  header.append(heading, button)
  card.append(header)
  if (on) {
    const body = document.createElement('div')
    body.className = 'goal-body'
    fill(body)
    card.append(body)
  }
  return card
}

function renderGoals() {
  const board = document.querySelector('#goal-board')
  board.replaceChildren()
  board.append(
    goalCard(t('goalSleep'), 'sleepOn', (body) => {
      const hours = document.createElement('input')
      hours.type = 'number'
      hours.min = '4'
      hours.max = '12'
      hours.step = '0.5'
      hours.value = String(goalsState.sleepHours)
      hours.addEventListener('change', () => {
        goalsState.sleepHours = clampNumber(hours.value, 4, 12, goalsState.sleepHours)
        saveGoals()
        renderGoals()
      })
      const slept = document.createElement('input')
      slept.type = 'number'
      slept.min = '0'
      slept.max = '16'
      slept.step = '0.5'
      slept.value = readGoalLog(todayKey()).sleep ?? ''
      const mark = document.createElement('button')
      mark.type = 'button'
      mark.className = 'goal-mark'
      mark.textContent = t('goalMark')
      mark.addEventListener('click', () => {
        if (slept.value === '') return
        const key = todayKey()
        goalsState.log[key] = { ...readGoalLog(key), sleep: clampNumber(slept.value, 0, 16, 0) }
        saveGoals()
        renderGoals()
      })
      const row = document.createElement('div')
      row.className = 'goal-row'
      row.append(goalField(t('goalSleepHours'), hours), goalField(t('goalSleepToday'), slept), mark)
      const todaySleep = Number(readGoalLog(todayKey()).sleep)
      const status = document.createElement('p')
      status.className = 'goal-status'
      status.textContent = Number.isFinite(todaySleep) && readGoalLog(todayKey()).sleep !== undefined
        ? (todaySleep >= goalsState.sleepHours ? t('goalMet') : t('goalOpen'))
        : t('goalOpen')
      body.append(row, status, weekDots((key) => Number(readGoalLog(key).sleep) >= goalsState.sleepHours && readGoalLog(key).sleep !== undefined))
    }),
    goalCard(t('goalCalories'), 'caloriesOn', (body) => {
      const target = Number(nutritionState.kcal) || 0
      const eaten = eatenOn(todayKey())
      const status = document.createElement('p')
      status.className = 'goal-status'
      if (!target) {
        status.textContent = t('goalCaloriesNeed')
        body.append(status)
        return
      }
      status.textContent = `${eaten} / ${target} kcal. ${eaten >= target ? t('goalMet') : t('goalOpen')}`
      const bar = document.createElement('div')
      bar.className = 'goal-bar'
      const fill = document.createElement('span')
      fill.style.width = `${Math.min(100, Math.round((eaten / target) * 100))}%`
      bar.append(fill)
      body.append(status, bar)
    }),
    goalCard(t('goalRun'), 'runOn', (body) => {
      const keys = recentKeys(7)
      const met = keys.filter((key) => hasActivity(choices[key], 'run')).length
      const status = document.createElement('p')
      status.className = 'goal-status'
      status.textContent = `${met}/7. ${hasActivity(choices[todayKey()], 'run') ? t('goalMet') : t('goalOpen')}`
      body.append(status, weekDots((key) => hasActivity(choices[key], 'run')))
    }),
    goalCard(t('goalGym'), 'gymOn', (body) => {
      const select = document.createElement('select')
      for (const days of [1, 2, 3, 4]) {
        const option = document.createElement('option')
        option.value = String(days)
        option.textContent = String(days)
        if (days === goalsState.gymEvery) option.selected = true
        select.append(option)
      }
      select.addEventListener('change', () => {
        goalsState.gymEvery = clampNumber(select.value, 1, 4, 2)
        saveGoals()
        renderGoals()
      })
      const last = Object.keys(choices).filter((key) => key <= todayKey() && hasActivity(choices[key], 'weights')).sort().at(-1) || ''
      const status = document.createElement('p')
      status.className = 'goal-status'
      if (!last) status.textContent = t('goalGymNone')
      else {
        const gap = dayDistance(last, todayKey())
        status.textContent = `${t('goalLast')} ${dateLabel(last)}. ${gap <= goalsState.gymEvery ? t('goalGymOk') : t('goalGymDue')}`
      }
      body.append(goalField(t('goalGymEvery'), select), status, weekDots((key) => hasActivity(choices[key], 'weights')))
    }),
    goalCard(t('goalWater'), 'waterOn', (body) => {
      const glasses = document.createElement('input')
      glasses.type = 'number'
      glasses.min = '1'
      glasses.max = '20'
      glasses.step = '1'
      glasses.value = String(goalsState.waterGlasses)
      glasses.addEventListener('change', () => {
        goalsState.waterGlasses = clampNumber(glasses.value, 1, 20, goalsState.waterGlasses)
        saveGoals()
        renderGoals()
      })
      const drunk = document.createElement('input')
      drunk.type = 'number'
      drunk.min = '0'
      drunk.max = '30'
      drunk.step = '1'
      drunk.value = readGoalLog(todayKey()).water ?? ''
      const mark = document.createElement('button')
      mark.type = 'button'
      mark.className = 'goal-mark'
      mark.textContent = t('goalMark')
      mark.addEventListener('click', () => {
        if (drunk.value === '') return
        const key = todayKey()
        goalsState.log[key] = { ...readGoalLog(key), water: clampNumber(drunk.value, 0, 30, 0) }
        saveGoals()
        renderGoals()
      })
      const row = document.createElement('div')
      row.className = 'goal-row'
      row.append(goalField(t('goalGlasses'), glasses), goalField(t('goalTodayGlasses'), drunk), mark)
      const todayWater = Number(readGoalLog(todayKey()).water)
      const status = document.createElement('p')
      status.className = 'goal-status'
      status.textContent = readGoalLog(todayKey()).water !== undefined
        ? (todayWater >= goalsState.waterGlasses ? t('goalMet') : t('goalOpen'))
        : t('goalOpen')
      body.append(row, status, weekDots((key) => Number(readGoalLog(key).water) >= goalsState.waterGlasses && readGoalLog(key).water !== undefined))
    }),
  )
}

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

function emptyBody() {
  return { aim: 'lose', goalKg: '', weights: [], fat: [], measures: [], photos: { before: '', after: '' } }
}

function emptyNutrition() {
  return { v: 1, sex: '', weight: '', height: '', age: '', kcal: 0, days: {}, body: emptyBody() }
}

function finiteIn(value, min, max) {
  const number = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(number) || number < min || number > max) return null
  return Math.round(number * 10) / 10
}

function cleanPoints(list, key, min, max) {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => {
      const value = finiteIn(item?.[key], min, max)
      if (!item?.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || value === null) return null
      return { date: item.date, [key]: value }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-120)
}

function loadBody(saved) {
  const body = emptyBody()
  if (!saved || typeof saved !== 'object') return body
  if (saved.aim === 'gain' || saved.aim === 'keep' || saved.aim === 'lose') body.aim = saved.aim
  const goal = finiteIn(saved.goalKg, 30, 250)
  body.goalKg = goal === null ? '' : goal
  body.weights = cleanPoints(saved.weights, 'kg', 30, 250)
  body.fat = cleanPoints(saved.fat, 'pct', 2, 70)
  if (Array.isArray(saved.measures)) {
    body.measures = saved.measures
      .filter((item) => item && /^\d{4}-\d{2}-\d{2}$/.test(item.date))
      .map((item) => {
        const next = { date: item.date }
        for (const key of ['waist', 'chest', 'hips', 'arm', 'thigh']) {
          const value = finiteIn(item[key], 15, 220)
          if (value !== null) next[key] = value
        }
        return next
      })
      .filter((item) => Object.keys(item).length > 1)
      .slice(-80)
  }
  const photos = saved.photos && typeof saved.photos === 'object' ? saved.photos : {}
  for (const side of ['before', 'after']) {
    body.photos[side] = typeof photos[side] === 'string' && photos[side].startsWith('data:image/') ? photos[side] : ''
  }
  return body
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
    body: loadBody(saved.body),
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
  if (!ready) {
    renderBody()
    return
  }
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
    const unit = food?.kind === 'drink' ? t('nutritionMl') : 'g'
    const amount = item.amount ? `${item.amount} ${unit}` : ''
    name.textContent = [food ? nutritionText(food) : item.name, amount, `${item.kcal} kcal`].filter(Boolean).join(' · ')
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
  renderSearch()
  renderBody()
}

let nutritionKind = ''
let pickedId = ''

function foldText(value) {
  return String(value || '').toLocaleLowerCase('et').normalize('NFD').replace(/\p{M}/gu, '')
}

function scaledKcal(food, amount) {
  return Math.round((food.per100 * amount) / 100)
}

function matchingFoods() {
  const query = foldText(document.querySelector('#nutrition-query').value)
  const list = FOODS.filter((item) => item.kind === nutritionKind)
  const found = query
    ? list.filter((item) => [item.et, item.en, item.ru].some((name) => foldText(name).includes(query)))
    : list.slice(0, 12)
  return found.slice(0, 24)
}

function renderResults() {
  const box = document.querySelector('#nutrition-results')
  box.replaceChildren()
  if (!nutritionKind) return
  const foods = matchingFoods()
  if (!foods.length) {
    const empty = document.createElement('p')
    empty.className = 'nutrition-hint'
    empty.textContent = t('nutritionNone')
    box.append(empty)
    return
  }
  for (const food of foods) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'nutrition-result'
    const name = document.createElement('span')
    name.textContent = nutritionText(food)
    const meta = document.createElement('small')
    const unit = food.kind === 'drink' ? t('nutritionMl') : 'g'
    meta.textContent = `${food.per100} / 100 ${unit}`
    button.append(name, meta)
    button.addEventListener('click', () => {
      pickedId = food.id
      document.querySelector('#nutrition-grams').value = ''
      renderAmount()
      document.querySelector('#nutrition-grams').focus()
    })
    box.append(button)
  }
}

function renderAmount() {
  const form = document.querySelector('#nutrition-amount')
  const food = foodById(pickedId)
  const visible = Boolean(food && food.kind === nutritionKind)
  form.hidden = !visible
  if (!visible) return
  document.querySelector('#nutrition-picked').textContent = nutritionText(food)
  document.querySelector('#nutrition-amount-label').textContent = food.kind === 'drink' ? t('nutritionMl') : t('nutritionGrams')
  updateAmountPreview()
}

function updateAmountPreview() {
  const food = foodById(pickedId)
  const preview = document.querySelector('#nutrition-preview')
  if (!food) {
    preview.textContent = ''
    return
  }
  const unit = food.kind === 'drink' ? t('nutritionMl') : 'g'
  const amount = Number(String(document.querySelector('#nutrition-grams').value).replace(',', '.'))
  if (!amount) {
    preview.textContent = `${food.per100} kcal / 100 ${unit}`
    return
  }
  preview.textContent = `${amount} ${unit} · ${scaledKcal(food, amount)} kcal`
}

function renderSearch() {
  const panel = document.querySelector('#nutrition-search')
  panel.hidden = !nutritionKind
  document.querySelector('#nutrition-open-food').setAttribute('aria-pressed', String(nutritionKind === 'food'))
  document.querySelector('#nutrition-open-drink').setAttribute('aria-pressed', String(nutritionKind === 'drink'))
  renderResults()
  renderAmount()
}

function formatBody(value) {
  const number = Math.round(Number(value) * 10) / 10
  return Number.isInteger(number) ? String(number) : number.toFixed(1)
}

function shortStamp(key) {
  const [, month, day] = key.split('-')
  return `${Number(day)}.${month}`
}

function chartIndexes(count) {
  if (count <= 4) return [...Array(count).keys()]
  return [0, Math.round((count - 1) / 3), Math.round(((count - 1) * 2) / 3), count - 1]
}

function renderWeightChart(points, goal) {
  const svg = document.querySelector('#body-chart')
  svg.replaceChildren()
  if (points.length < 2) return
  const ns = 'http://www.w3.org/2000/svg'
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#c6f135'
  const muted = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim() || '#8b9384'
  const width = 360
  const height = 168
  const pad = { l: 8, r: 8, t: 14, b: 26 }
  const innerW = width - pad.l - pad.r
  const innerH = height - pad.t - pad.b
  const values = points.map((point) => point.kg)
  if (goal) values.push(goal)
  const spread = Math.max(...values) - Math.min(...values)
  const padValue = Math.max(0.8, spread * 0.2)
  const min = Math.min(...values) - padValue
  const max = Math.max(...values) + padValue
  const x = (index) => pad.l + (index / (points.length - 1)) * innerW
  const y = (value) => pad.t + (1 - (value - min) / (max - min)) * innerH
  const coords = points.map((point, index) => [x(index), y(point.kg)])
  const node = (name, attrs) => {
    const element = document.createElementNS(ns, name)
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value))
    return element
  }
  for (const index of chartIndexes(points.length)) {
    svg.append(node('line', {
      x1: coords[index][0],
      x2: coords[index][0],
      y1: pad.t,
      y2: pad.t + innerH,
      stroke: muted,
      'stroke-opacity': '0.35',
      'stroke-dasharray': '3 4',
    }))
  }
  if (goal) {
    svg.append(node('line', {
      x1: pad.l,
      x2: width - pad.r,
      y1: y(goal),
      y2: y(goal),
      stroke: accent,
      'stroke-opacity': '0.85',
      'stroke-dasharray': '1.5 4',
      'stroke-width': '1.6',
    }))
  }
  svg.append(node('polygon', {
    points: `${coords.map((pair) => pair.join(',')).join(' ')} ${coords.at(-1)[0]},${pad.t + innerH} ${coords[0][0]},${pad.t + innerH}`,
    fill: accent,
    'fill-opacity': '0.16',
  }))
  svg.append(node('polyline', {
    points: coords.map((pair) => pair.join(',')).join(' '),
    fill: 'none',
    stroke: accent,
    'stroke-width': '3',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  }))
  svg.append(node('circle', { cx: coords.at(-1)[0], cy: coords.at(-1)[1], r: '4.5', fill: accent }))
  for (const index of chartIndexes(points.length)) {
    const text = node('text', {
      x: coords[index][0],
      y: height - 6,
      fill: muted,
      'font-size': '11',
      'text-anchor': index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle',
    })
    text.textContent = shortStamp(points[index].date)
    svg.append(text)
  }
}

function latestPoint(list) {
  return list.length ? list[list.length - 1] : null
}

function renderBody() {
  const body = nutritionState.body
  document.querySelector('#body-aim-label').textContent = t(body.aim === 'gain' ? 'bodyGain' : body.aim === 'keep' ? 'bodyKeep' : 'bodyLose')
  const current = latestPoint(body.weights)
  const fat = latestPoint(body.fat)
  document.querySelector('#body-current').textContent = current ? `${formatBody(current.kg)} kg` : '—'
  document.querySelector('#body-goal').textContent = body.goalKg ? `${formatBody(body.goalKg)} kg` : '—'
  const fatLine = document.querySelector('#body-fat')
  fatLine.hidden = !fat
  fatLine.textContent = fat ? `${t('bodyFat')} ${formatBody(fat.pct)}%` : ''
  const empty = document.querySelector('#body-empty')
  empty.hidden = body.weights.length >= 2
  empty.textContent = body.weights.length ? t('bodyNeedMore') : t('bodyEmpty')
  renderWeightChart(body.weights, Number(body.goalKg) || 0)
  const measure = latestPoint(body.measures)
  const bits = []
  if (measure) {
    for (const [key, label] of [['waist', 'bodyWaist'], ['chest', 'bodyChest'], ['hips', 'bodyHips'], ['arm', 'bodyArm'], ['thigh', 'bodyThigh']]) {
      if (measure[key]) bits.push(`${t(label).replace(/\s*\(.*\)$/, '')} ${formatBody(measure[key])} cm`)
    }
  }
  document.querySelector('#body-measures').textContent = bits.length ? `${bits.join(' · ')} · ${shortStamp(measure.date)}` : t('bodyMeasuresEmpty')
  for (const side of ['before', 'after']) {
    const image = document.querySelector(`#body-${side}-photo`)
    image.hidden = !body.photos[side]
    if (body.photos[side]) image.src = body.photos[side]
  }
}

function upsertPoint(list, date, patch) {
  const found = list.find((item) => item.date === date)
  if (found) Object.assign(found, patch)
  else list.push({ date, ...patch })
  list.sort((a, b) => a.date.localeCompare(b.date))
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
  if (!nutritionState.body.weights.length) {
    nutritionState.body.weights.push({ date: nutritionDay, kg: weight })
  }
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

function openNutritionKind(kind) {
  nutritionKind = nutritionKind === kind ? '' : kind
  pickedId = ''
  document.querySelector('#nutrition-query').value = ''
  document.querySelector('#nutrition-grams').value = ''
  renderSearch()
  if (nutritionKind) document.querySelector('#nutrition-query').focus()
}

document.querySelector('#nutrition-open-food').addEventListener('click', () => openNutritionKind('food'))
document.querySelector('#nutrition-open-drink').addEventListener('click', () => openNutritionKind('drink'))
document.querySelector('#nutrition-query').addEventListener('input', renderResults)
document.querySelector('#nutrition-grams').addEventListener('input', updateAmountPreview)
document.querySelector('#nutrition-amount').addEventListener('submit', (event) => {
  event.preventDefault()
  const food = foodById(pickedId)
  const amount = finiteIn(document.querySelector('#nutrition-grams').value, 1, 2000)
  if (!food || amount === null) return
  addNutritionItem({ id: food.id, amount, kcal: scaledKcal(food, amount) })
  pickedId = ''
  document.querySelector('#nutrition-grams').value = ''
  renderAmount()
})

document.querySelector('#body-aim').addEventListener('click', () => {
  const order = ['lose', 'gain', 'keep']
  nutritionState.body.aim = order[(order.indexOf(nutritionState.body.aim) + 1) % order.length]
  saveNutrition()
  renderBody()
})

document.querySelector('#body-update').addEventListener('click', () => {
  const form = document.querySelector('#body-form')
  form.hidden = !form.hidden
  if (form.hidden) return
  const body = nutritionState.body
  const current = latestPoint(body.weights)
  const fat = latestPoint(body.fat)
  const measure = latestPoint(body.measures) || {}
  document.querySelector('#body-weight-input').value = current ? String(current.kg) : ''
  document.querySelector('#body-goal-input').value = body.goalKg ? String(body.goalKg) : ''
  document.querySelector('#body-fat-input').value = fat ? String(fat.pct) : ''
  document.querySelector('#body-waist').value = measure.waist || ''
  document.querySelector('#body-chest').value = measure.chest || ''
  document.querySelector('#body-hips').value = measure.hips || ''
  document.querySelector('#body-arm').value = measure.arm || ''
  document.querySelector('#body-thigh').value = measure.thigh || ''
})

document.querySelector('#body-form').addEventListener('submit', (event) => {
  event.preventDefault()
  const weight = finiteIn(document.querySelector('#body-weight-input').value, 30, 250)
  const goal = finiteIn(document.querySelector('#body-goal-input').value, 30, 250)
  const fat = finiteIn(document.querySelector('#body-fat-input').value, 2, 70)
  const waist = finiteIn(document.querySelector('#body-waist').value, 40, 200)
  const chest = finiteIn(document.querySelector('#body-chest').value, 40, 200)
  const hips = finiteIn(document.querySelector('#body-hips').value, 40, 200)
  const arm = finiteIn(document.querySelector('#body-arm').value, 15, 80)
  const thigh = finiteIn(document.querySelector('#body-thigh').value, 20, 120)
  const fields = [
    document.querySelector('#body-weight-input'),
    document.querySelector('#body-goal-input'),
    document.querySelector('#body-fat-input'),
    document.querySelector('#body-waist'),
    document.querySelector('#body-chest'),
    document.querySelector('#body-hips'),
    document.querySelector('#body-arm'),
    document.querySelector('#body-thigh'),
  ]
  const parsed = [weight, goal, fat, waist, chest, hips, arm, thigh]
  const invalid = parsed.some((value, index) => value === null && fields[index].value.trim())
  if (invalid || parsed.every((value) => value === null)) return
  const date = stampFromDate(new Date())
  const body = nutritionState.body
  if (goal !== null) body.goalKg = goal
  if (weight !== null) upsertPoint(body.weights, date, { kg: weight })
  if (fat !== null) upsertPoint(body.fat, date, { pct: fat })
  const measures = { waist, chest, hips, arm, thigh }
  if (Object.values(measures).some((value) => value !== null)) {
    const next = {}
    for (const [key, value] of Object.entries(measures)) if (value !== null) next[key] = value
    upsertPoint(body.measures, date, next)
  }
  saveNutrition()
  document.querySelector('#body-form').hidden = true
  renderBody()
})

for (const side of ['before', 'after']) {
  document.querySelector(`#body-${side}`).addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      nutritionState.body.photos[side] = await readPhoto(file)
      saveNutrition()
      renderBody()
    } catch {
      nutritionState.body.photos[side] = nutritionState.body.photos[side]
    }
  })
}

function collectDiary() {
  return {
    choices: loadChoices(),
    muscles,
    layout: loadJson(LAYOUT_KEY),
    plan: planCellsData,
    nutrition: nutritionState,
    goal: goal.value,
    goals: goalsState,
    records: recordsState,
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
  if (data.goals && typeof data.goals === 'object' && !Array.isArray(data.goals)) {
    goalsState = loadGoalsFrom(data.goals)
    localStorage.setItem(GOALS_STATE_KEY, JSON.stringify(goalsState))
    renderGoals()
  }
  if (data.records && typeof data.records === 'object' && !Array.isArray(data.records)) {
    recordsState = loadRecordsFrom(data.records)
    localStorage.setItem(RECORDS_KEY, JSON.stringify(recordsState))
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
    goals: emptyGoals(),
    records: emptyRecords(),
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
    paintDay()
  }
  if (!document.querySelector('[data-section="records"]').hidden) renderStats()
  if (!document.querySelector('[data-section="goals"]').hidden) renderGoals()
  if (!document.querySelector('[data-section="plan"]').hidden) renderPlan()
  if (!muscle3d) paintMuscleFilters()
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
paintMuscleFilters()
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
