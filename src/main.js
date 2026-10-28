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
const UNANSWERED_DARK_BEFORE = '2026-10-29'
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
      cells.push(
        `<td class="day${mark}${dark}"><button type="button" class="day-button" data-date="${key}">${date}</button></td>`,
      )
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

function daySummaryText(details) {
  if (!details.choice) return ''
  const parts = [details.choice]
  if (details.amount) parts.push(details.amount)
  if (details.pace) parts.push(`tempo ${details.pace}`)
  if (details.gymNote) parts.push(details.gymNote)
  return parts.join(' · ')
}

let dayEditing = false

function showDay(key) {
  openKey = key
  dayEditing = false
  const [dateYear, dateMonth, dateDay] = key.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(dateYear, dateMonth - 1, dateDay).getDay()]
  dayLabel.textContent = `${monthTitle(weekday)}, ${dateDay}. ${MONTHS[dateMonth - 1]} ${dateYear}`
  const summary = daySummaryText(choiceDetails(choices[key]))
  daySummary.hidden = !summary
  daySummary.textContent = summary
  dayEdit.hidden = false
  dayChoices.hidden = true
  dayExtra.hidden = true
  dayView.hidden = false
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
  if (!button) return
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
const statsView = document.querySelector('#stats')
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

  const distanceChart = barChart('Kui palju', distanceBars, 'Koguse andmeid veel ei ole.')
  if (distanceBars.length) {
    const total = distanceBars.reduce((sum, item) => sum + item.value, 0)
    const average = Math.round((total / distanceBars.length) * 10) / 10
    const line = document.createElement('p')
    line.className = 'stat-line'
    line.textContent = `Keskmine: ${Number.isInteger(average) ? average : average.toFixed(1)} km`
    distanceChart.append(line)
  }
  statsBody.replaceChildren(distanceChart, barChart('Tempo 1km kohta', paceBars, 'Tempo andmeid veel ei ole.'))

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
      item.textContent = `${dateLabel(entry.key)}: ${entry.gymNote}`
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
const planScroll = document.querySelector('#plan-scroll')
const planCells = document.querySelector('#plan-cells')
const planEdit = document.querySelector('#plan-edit')
const planAddColumn = document.querySelector('#plan-add-column')

const PLAN_ROWS = 10
let planEditing = false
let planDrag = null

planScroll.addEventListener('pointerdown', (event) => {
  if (!planScroll.classList.contains('plan-wide')) return
  if (event.target.closest('input, button, textarea, select, label')) return
  planDrag = { x: event.clientX, left: planScroll.scrollLeft, pointer: event.pointerId }
  planScroll.setPointerCapture(event.pointerId)
  planScroll.classList.add('is-dragging')
})

planScroll.addEventListener('pointermove', (event) => {
  if (!planDrag || planDrag.pointer !== event.pointerId) return
  planScroll.scrollLeft = planDrag.left - (event.clientX - planDrag.x)
})

function endPlanDrag(event) {
  if (!planDrag || (event && planDrag.pointer !== event.pointerId)) return
  planDrag = null
  planScroll.classList.remove('is-dragging')
}

planScroll.addEventListener('pointerup', endPlanDrag)
planScroll.addEventListener('pointercancel', endPlanDrag)

function emptyPlanColumn(rowCount = PLAN_ROWS) {
  return {
    title: '',
    rows: Array.from({ length: rowCount }, () => ({ text: '', reps: '' })),
  }
}

function normalizeColumn(column) {
  const source = Array.isArray(column) ? column : column?.rows
  const title = Array.isArray(column) ? '' : column?.title || ''
  const rows = Array.isArray(source)
    ? source.map((row) => ({ text: row?.text || '', reps: row?.reps || '' }))
    : [{ text: '', reps: '' }]
  return { title, rows }
}

function loadPlanCells() {
  const saved = loadJson(PLAN_KEY)
  if (!Array.isArray(saved)) {
    return [emptyPlanColumn(), emptyPlanColumn(), emptyPlanColumn()]
  }
  return saved.map(normalizeColumn)
}

let planCellsData = loadPlanCells()

function savePlan() {
  localStorage.setItem(PLAN_KEY, JSON.stringify(planCellsData))
  pushDiary()
}

function renderPlan() {
  planCells.replaceChildren()
  planCells.style.setProperty('--plan-columns', String(Math.max(planCellsData.length, 1)))
  planScroll.classList.toggle('plan-wide', planCellsData.length > 3)
  planCellsData.forEach((column, columnIndex) => {
    const box = document.createElement('div')
    box.className = 'plan-box'
    const head = document.createElement('div')
    head.className = 'plan-head'
    const title = document.createElement('input')
    title.type = 'text'
    title.className = 'plan-title'
    title.value = column.title
    title.readOnly = !planEditing
    title.setAttribute('aria-label', 'Pealkiri')
    title.addEventListener('input', () => {
      planCellsData[columnIndex].title = title.value
      savePlan()
    })
    head.append(title)
    if (planEditing) {
      const removeColumn = document.createElement('button')
      removeColumn.type = 'button'
      removeColumn.className = 'plan-remove'
      removeColumn.textContent = 'Eemalda veerg'
      removeColumn.addEventListener('click', () => {
        planCellsData.splice(columnIndex, 1)
        savePlan()
        renderPlan()
      })
      head.append(removeColumn)
    }
    box.append(head)
    column.rows.forEach((row, rowIndex) => {
      const line = document.createElement('div')
      line.className = 'plan-row'
      const text = document.createElement('input')
      text.type = 'text'
      text.value = row.text
      text.readOnly = !planEditing
      text.setAttribute('aria-label', 'Harjutus')
      const reps = document.createElement('input')
      reps.type = 'text'
      reps.className = 'plan-reps'
      reps.value = row.reps
      reps.readOnly = !planEditing
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
      if (planEditing) {
        const removeRow = document.createElement('button')
        removeRow.type = 'button'
        removeRow.className = 'plan-remove plan-remove-row'
        removeRow.textContent = '×'
        removeRow.setAttribute('aria-label', 'Eemalda rida')
        removeRow.addEventListener('click', () => {
          planCellsData[columnIndex].rows.splice(rowIndex, 1)
          savePlan()
          renderPlan()
        })
        line.append(removeRow)
      }
      box.append(line)
    })
    if (planEditing) {
      const addRow = document.createElement('button')
      addRow.type = 'button'
      addRow.className = 'plan-add'
      addRow.textContent = 'Lisa rida'
      addRow.addEventListener('click', () => {
        planCellsData[columnIndex].rows.push({ text: '', reps: '' })
        savePlan()
        renderPlan()
      })
      box.append(addRow)
    }
    planCells.append(box)
  })
}

function setPlanEditing(editing) {
  planEditing = editing
  planEdit.textContent = editing ? 'Valmis' : 'Muuda'
  planEdit.setAttribute('aria-pressed', String(editing))
  planAddColumn.hidden = !editing
  if (!planPanel.hidden) renderPlan()
}

document.querySelector('#plan-open').addEventListener('click', () => {
  const opening = planPanel.hidden
  planPanel.hidden = !opening
  if (!opening) setPlanEditing(false)
  else renderPlan()
})

planEdit.addEventListener('click', () => {
  setPlanEditing(!planEditing)
})

planAddColumn.addEventListener('click', () => {
  planCellsData.push(emptyPlanColumn(1))
  savePlan()
  renderPlan()
})

const nutrition = document.querySelector('#nutrition')
const goal = document.querySelector('#goal')
const GOAL_KEY = 'treeningpaevik-eesmark'
const savedNutrition = localStorage.getItem('treeningpaevik-toitumine')
if (savedNutrition) nutrition.value = savedNutrition
const savedGoal = localStorage.getItem(GOAL_KEY)
if (savedGoal) goal.value = savedGoal
nutrition.addEventListener('input', () => {
  localStorage.setItem('treeningpaevik-toitumine', nutrition.value)
  pushDiary()
})
goal.addEventListener('input', () => {
  localStorage.setItem(GOAL_KEY, goal.value)
  pushDiary()
})

function collectDiary() {
  return {
    choices: loadChoices(),
    muscles,
    layout: loadJson(LAYOUT_KEY),
    plan: planCellsData,
    nutrition: nutrition.value,
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
  if (Array.isArray(data.plan)) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(data.plan))
    planCellsData = loadPlanCells()
    if (!planPanel.hidden) renderPlan()
  }
  if (typeof data.nutrition === 'string') {
    localStorage.setItem('treeningpaevik-toitumine', data.nutrition)
    nutrition.value = data.nutrition
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
  return new Date(iso).toLocaleDateString('et-EE', { timeZone: 'Europe/Tallinn' })
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
    plan: [emptyPlanColumn(), emptyPlanColumn(), emptyPlanColumn()],
    nutrition: '',
    goal: '',
  }
}

function pushDiary() {
  if (!diaryReady || !account?.email) return
  clearTimeout(diaryTimer)
  diaryTimer = setTimeout(() => {
    const accounts = loadAccounts()
    const record = accounts[account.email]
    if (!record) return
    record.diary = structuredClone(collectDiary())
    saveAccounts(accounts)
  }, 300)
}

const accountOpen = document.querySelector('#account-open')
const accountPanel = document.querySelector('#account-panel')
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
  accountOpen.textContent = signedIn ? 'Konto' : 'Logi sisse'
  loginForm.hidden = signedIn
  registerForm.hidden = true
  accountInfo.hidden = !signedIn
  if (signedIn) {
    document.querySelector('#account-email').textContent = account.email
    document.querySelector('#account-joined').textContent = account.liitus
  }
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
  const email = accountEmail(emailValue)
  if (!email.includes('@')) throw new Error('E-post ei kõlba.')
  if (password.length < 8) throw new Error('Parool peab olema vähemalt 8 märki.')
  const accounts = loadAccounts()
  const hash = await passwordHash(email, password)
  if (register) {
    if (accounts[email]) throw new Error('See e-post on juba kasutusel.')
    const diary = email === FIRST_EMAIL ? openingDiary : emptyAccountDiary()
    accounts[email] = { passwordHash: hash, liitus: new Date().toISOString(), diary }
    saveAccounts(accounts)
  } else if (!accounts[email] || accounts[email].passwordHash !== hash) {
    throw new Error('Vale e-post või parool.')
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
  localStorage.removeItem(SESSION_KEY)
  location.reload()
})

const openingDiary = structuredClone(collectDiary())
todayStamp = stampFromDate(new Date())
const savedAccounts = loadAccounts()
const sessionEmail = localStorage.getItem(SESSION_KEY)
if (sessionEmail && savedAccounts[sessionEmail]) {
  account = { email: sessionEmail, liitus: joinedLabel(savedAccounts[sessionEmail].liitus) }
  applyDiary(accountDiary(savedAccounts[sessionEmail].diary))
  renderAccount()
} else {
  applyDiary(sharedDiary)
}
diaryReady = true

tick()
setInterval(tick, 1000)
render()
