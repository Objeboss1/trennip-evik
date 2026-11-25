import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { getLang } from './i18n.js'
import { findExercise } from './exercises.js'
import { MUSCLE_GROUPS, muscleGroup } from './muscle-data.js'

const VIEWS = {
  front: new THREE.Vector3(0, 0.05, 2.55),
  back: new THREE.Vector3(0, 0.05, -2.55),
  side: new THREE.Vector3(2.35, 0.08, 0.85),
}

function text(lang, value) {
  return value[lang] || value.et
}

export function mountMuscle3d(root, initialGroup = '') {
  const canvas = root.querySelector('#muscle-canvas')
  const filters = root.querySelector('#muscle-filters')
  const info = document.querySelector('#muscle-info')
  const status = root.querySelector('#muscle-status')
  const viewButtons = [...root.querySelectorAll('[data-view3]')]
  let running = false
  let selectedGroup = initialGroup
  let selectedLabel = ''
  let hovered = null
  const meshes = []

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 20)
  camera.position.copy(VIEWS.front)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 0.9
  controls.maxDistance = 5.5
  controls.target.set(0, 0.05, 0)

  scene.add(new THREE.HemisphereLight(0xfff6ef, 0x141820, 1.15))
  const key = new THREE.DirectionalLight(0xffffff, 1.7)
  key.position.set(2.2, 3.2, 3.4)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0xd6ff4a, 0.9)
  rim.position.set(-2.4, 1.6, -2.2)
  scene.add(rim)

  const materials = {
    base: new THREE.MeshStandardMaterial({ color: '#c45c56', roughness: 0.52 }),
    bone: new THREE.MeshStandardMaterial({ color: '#eadfce', roughness: 0.74 }),
    other: new THREE.MeshStandardMaterial({ color: '#7d4b46', roughness: 0.62 }),
    dim: new THREE.MeshStandardMaterial({ color: '#5c3834', roughness: 0.7 }),
    hover: new THREE.MeshStandardMaterial({ color: '#e08a78', roughness: 0.42, emissive: '#e08a78', emissiveIntensity: 0.08 }),
    selected: new THREE.MeshStandardMaterial({ color: '#d6ff4a', roughness: 0.38, emissive: '#d6ff4a', emissiveIntensity: 0.42 }),
  }

  function accent() {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d6ff4a'
    const color = new THREE.Color(value)
    materials.selected.color.copy(color)
    materials.selected.emissive.copy(color)
    rim.color.copy(color)
  }

  function paint() {
    accent()
    for (const mesh of meshes) {
      const { kind, group, label } = mesh.userData
      if (!group) {
        mesh.material = kind === 'bone' ? materials.bone : materials.other
        continue
      }
      if (selectedLabel && label === selectedLabel) mesh.material = materials.selected
      else if (selectedGroup && group === selectedGroup && !selectedLabel) mesh.material = materials.selected
      else if (selectedGroup && group === selectedGroup) mesh.material = materials.dim
      else if (hovered === mesh) mesh.material = materials.hover
      else mesh.material = materials.base
    }
  }

  function goView(name) {
    const next = VIEWS[name] || VIEWS.front
    camera.position.copy(next)
    controls.target.set(0, 0.05, 0)
    controls.update()
    for (const button of viewButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.view3 === name))
    }
  }

  function renderInfo() {
    const lang = getLang()
    const group = muscleGroup(selectedGroup)
    info.replaceChildren()
    if (!group) {
      const empty = document.createElement('p')
      empty.className = 'muscle-empty'
      empty.textContent = lang === 'ru' ? 'Нажми на мышцу.' : lang === 'en' ? 'Tap a muscle.' : 'Vajuta lihasele.'
      info.append(empty)
      info.hidden = false
      return
    }
    const title = document.createElement('h3')
    title.textContent = text(lang, group)
    const names = document.createElement('p')
    names.className = 'muscle-names'
    names.textContent = `${group.et} · ${group.en}`
    info.append(title, names)
    if (selectedLabel) {
      const exact = document.createElement('p')
      exact.className = 'muscle-exact'
      exact.textContent = selectedLabel
      info.append(exact)
    }
    const fnLabel = document.createElement('p')
    fnLabel.className = 'muscle-kicker'
    fnLabel.textContent = lang === 'ru' ? 'Функция' : lang === 'en' ? 'Function' : 'Funktsioon'
    const fn = document.createElement('p')
    fn.textContent = text(lang, group.function)
    info.append(fnLabel, fn)

    const exLabel = document.createElement('p')
    exLabel.className = 'muscle-kicker'
    exLabel.textContent = lang === 'ru' ? 'Упражнения' : lang === 'en' ? 'Exercises' : 'Harjutused'
    const list = document.createElement('div')
    list.className = 'muscle-exercises'
    for (const exercise of group.exercises) {
      const button = document.createElement('button')
      button.type = 'button'
      const match = findExercise(exercise.et)
      if (match) {
        const img = document.createElement('img')
        img.src = `/exercises/${match.id}.jpg`
        img.alt = ''
        button.append(img)
      } else {
        const fallback = document.createElement('span')
        fallback.className = 'muscle-exercise-fallback'
        fallback.textContent = text(lang, exercise).slice(0, 1)
        button.append(fallback)
      }
      const label = document.createElement('span')
      label.textContent = text(lang, exercise)
      button.append(label)
      button.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('trennip-open-exercise', { detail: { name: exercise.et } }))
      })
      list.append(button)
    }
    info.append(exLabel, list)
    info.hidden = false
  }

  function renderFilters() {
    const lang = getLang()
    filters.replaceChildren()
    const all = document.createElement('button')
    all.type = 'button'
    all.dataset.group = ''
    all.textContent = lang === 'ru' ? 'Все' : lang === 'en' ? 'All' : 'Kõik'
    filters.append(all)
    for (const group of MUSCLE_GROUPS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.group = group.id
      button.textContent = text(lang, group)
      filters.append(button)
    }
    for (const button of filters.querySelectorAll('button')) {
      const id = button.dataset.group
      button.setAttribute('aria-pressed', String(id ? id === selectedGroup : !selectedGroup))
    }
  }

  function showSelection() {
    paint()
    renderFilters()
    renderInfo()
    if (selectedGroup) info.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function selectGroup(id) {
    selectedGroup = id
    selectedLabel = ''
    const group = muscleGroup(id)
    if (group) goView(group.view)
    showSelection()
  }

  function selectMesh(mesh) {
    selectedGroup = mesh.userData.group || ''
    selectedLabel = mesh.userData.label || ''
    showSelection()
  }

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('button')
    if (!button) return
    selectGroup(button.dataset.group || '')
  })

  for (const button of viewButtons) {
    button.addEventListener('click', () => goView(button.dataset.view3))
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let down = null

  function pick(event) {
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects(meshes, false).find((item) => item.object.userData.group)
    return hit?.object || null
  }

  canvas.addEventListener('pointerdown', (event) => {
    down = { x: event.clientX, y: event.clientY }
  })
  canvas.addEventListener('pointerup', (event) => {
    if (!down) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    down = null
    if (moved > 6) return
    const mesh = pick(event)
    if (mesh) selectMesh(mesh)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (down) return
    const mesh = pick(event)
    if (mesh === hovered) return
    hovered = mesh
    canvas.style.cursor = mesh ? 'pointer' : ''
    paint()
  })
  canvas.addEventListener('pointerleave', () => {
    hovered = null
    canvas.style.cursor = ''
    paint()
  })

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(canvas.parentElement)

  const language = new MutationObserver(() => {
    renderFilters()
    renderInfo()
  })
  language.observe(document.documentElement, { attributes: true, attributeFilter: ['lang', 'data-theme'] })

  function frame() {
    if (!running) return
    accent()
    controls.update()
    renderer.render(scene, camera)
    requestAnimationFrame(frame)
  }

  function start() {
    if (running) {
      resize()
      return
    }
    running = true
    resize()
    frame()
  }

  function stop() {
    running = false
  }

  renderFilters()
  renderInfo()
  status.hidden = false
  const draco = new DRACOLoader()
  draco.setDecoderPath('/draco/')
  const loader = new GLTFLoader()
  loader.setDRACOLoader(draco)
  loader.load(
    '/models/anatomy.glb',
    (gltf) => {
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      model.position.sub(center)
      model.scale.setScalar(1.72 / Math.max(size.y, 0.001))
      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = false
          object.receiveShadow = false
          meshes.push(object)
        }
      })
      scene.add(model)
      draco.dispose()
      status.hidden = true
      paint()
      renderFilters()
      renderInfo()
      const group = muscleGroup(selectedGroup)
      goView(group ? group.view : 'front')
      resize()
    },
    undefined,
    () => {
      status.textContent = getLang() === 'en' ? 'The 3D model did not load.' : '3D mudel ei laadunud.'
    },
  )

  document.addEventListener('trennip-view', (event) => {
    const mode = root.hidden ? 'photos' : '3d'
    if (event.detail === 'muscles' && mode === '3d') start()
    else stop()
  })

  return { start, stop, selectGroup }
}
