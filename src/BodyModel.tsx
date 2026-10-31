import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Props = { view: 'muscular' | 'hologram'; selected: string; onSelect: (name: string) => void }

export default function BodyModel({ view, selected, onSelect }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const selectRef = useRef(onSelect)
  useEffect(() => { selectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    if (!host.current) return
    const el = host.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#08111f')
    const camera = new THREE.PerspectiveCamera(35, el.clientWidth / el.clientHeight, 0.1, 100)
    camera.position.set(0, 1.15, 7.5)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0x9bdcff, 0x142033, 2.0))
    const key = new THREE.DirectionalLight(0x7bd8ff, 2.5); key.position.set(3, 5, 6); scene.add(key)
    const rim = new THREE.PointLight(0x00d9ff, 24, 12); rim.position.set(-3, 1, -2); scene.add(rim)

    const rig = new THREE.Group(); scene.add(rig)
    const material = new THREE.MeshStandardMaterial({
      color: view === 'hologram' ? 0x19b9e8 : 0x9aabba,
      metalness: view === 'hologram' ? 0.55 : 0.22,
      roughness: view === 'hologram' ? 0.28 : 0.58,
      emissive: view === 'hologram' ? 0x063b58 : 0x101923,
      emissiveIntensity: view === 'hologram' ? 0.75 : 0.22
    })
    const muscleMat = new THREE.MeshStandardMaterial({ color: 0x8facc0, metalness: .15, roughness: .52 })
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x26d8ff, emissive: 0x087ca5, emissiveIntensity: 1.3 })
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x:number,y:number,z:number,sx=1,sy=1,sz=1,name='') => {
      const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); mesh.userData.muscle=name; rig.add(mesh); return mesh
    }
    const sphere = new THREE.SphereGeometry(1, 28, 20)
    const cyl = (r1:number,r2:number,h:number) => new THREE.CylinderGeometry(r1,r2,h,18)
    // Stylised procedural body placeholder: replace with a licensed, segmented anatomy asset for production.
    add(sphere, material, 0, 2.15, 0, .37,.43,.34, 'Head')
    add(cyl(.24,.28,.25), material, 0,1.68,0,1,1,1,'Neck')
    add(sphere, material, 0,1.05,0,.77,.62,.34,'Torso')
    add(sphere, muscleMat, -.38,1.25,.27,.34,.3,.18,'Left chest')
    add(sphere, muscleMat, .38,1.25,.27,.34,.3,.18,'Right chest')
    add(sphere, material, 0,.48,0,.39,.4,.31,'Abdominals')
    for (let i=0;i<3;i++) {
      add(sphere, muscleMat, 0,.58-i*.22,.29,.28,.09,.07,`Abdominals ${i+1}`)
    }
    add(sphere, material, -.83,1.34,0,.28,.3,.28,'Left shoulder')
    add(sphere, material, .83,1.34,0,.28,.3,.28,'Right shoulder')
    add(cyl(.18,.14,.85), material, -1.02,.65,0,1,1,1,'Left upper arm')
    add(cyl(.18,.14,.85), material, 1.02,.65,0,1,1,1,'Right upper arm')
    add(sphere, muscleMat, -1.02,.7,.16,.19,.3,.17,'Left biceps')
    add(sphere, muscleMat, 1.02,.7,.16,.19,.3,.17,'Right biceps')
    add(cyl(.12,.09,.75), material, -1.04,-.15,0,1,1,1,'Left forearm')
    add(cyl(.12,.09,.75), material, 1.04,-.15,0,1,1,1,'Right forearm')
    add(sphere, material, -.28,-.38,0,.25,.28,.25,'Left hip')
    add(sphere, material, .28,-.38,0,.25,.28,.25,'Right hip')
    add(cyl(.24,.18,1.12), material, -.3,-1.05,0,1,1,1,'Left quadriceps')
    add(cyl(.24,.18,1.12), material, .3,-1.05,0,1,1,1,'Right quadriceps')
    add(sphere, muscleMat, -.3,-.92,.17,.22,.42,.14,'Left quadriceps')
    add(sphere, muscleMat, .3,-.92,.17,.22,.42,.14,'Right quadriceps')
    add(cyl(.16,.11,.9), material, -.3,-2.03,0,1,1,1,'Left calf')
    add(cyl(.16,.11,.9), material, .3,-2.03,0,1,1,1,'Right calf')
    add(sphere, material, -.3,-2.53,.12,.19,.11,.35,'Left foot')
    add(sphere, material, .3,-2.53,.12,.19,.11,.35,'Right foot')

    // A subtle torso spine line and floor grid.
    const grid = new THREE.GridHelper(8, 28, 0x14516b, 0x10283b); grid.position.y=-2.68; scene.add(grid)
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2()
    const onClick = (e: MouseEvent) => {
      const rect=renderer.domElement.getBoundingClientRect()
      pointer.x=((e.clientX-rect.left)/rect.width)*2-1
      pointer.y=-((e.clientY-rect.top)/rect.height)*2+1
      raycaster.setFromCamera(pointer,camera)
      const hit=raycaster.intersectObjects(rig.children)[0]
      if(hit?.object.userData.muscle) selectRef.current(String(hit.object.userData.muscle))
    }
    renderer.domElement.addEventListener('click',onClick)
    let dragging=false, previousX=0
    const down=(e:PointerEvent)=>{dragging=true;previousX=e.clientX}
    const move=(e:PointerEvent)=>{if(dragging){rig.rotation.y+=(e.clientX-previousX)*.009;previousX=e.clientX}}
    const up=()=>{dragging=false}
    renderer.domElement.addEventListener('pointerdown',down)
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
    let frame=0
    const animate=()=>{frame=requestAnimationFrame(animate); if(!dragging) rig.rotation.y+=.002; renderer.render(scene,camera)}
    animate()
    const resize=()=>{if(!host.current)return;camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight)}
    const observer=new ResizeObserver(resize);observer.observe(el)
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener('click',onClick);renderer.domElement.removeEventListener('pointerdown',down);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);renderer.dispose();el.innerHTML=''}
  },[view])

  return <div className="body-canvas" ref={host} aria-label="Interactive stylised 3D body model"><div className="model-hint">DRAG TO ROTATE · TAP A BODY PART</div><div className="model-selected">SELECTED: <b>{selected.toUpperCase()}</b></div></div>
}